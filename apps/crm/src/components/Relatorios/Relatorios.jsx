// src/components/Relatorios/Relatorios.jsx
import { useState, useEffect, useMemo } from 'react';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { supabase } from '../../lib/supabase';
import { formatarDataHora, formatarData } from '../../utils/dateUtils';
import { distanciaMetros } from '../../utils/geoUtils';
import { formatarDuracao } from '../../utils/formatUtils';
import ModalConfirmar from '../ModalConfirmar/ModalConfirmar';
import ModalConsumo from '../ModalConsumo/ModalConsumo';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import { baixarPDF } from '../../lib/gerarRelatorio';
import SugestoesDropdown from '../SugestoesDropdown/SugestoesDropdown';
import './Relatorios.css';

function duracaoEntre(inicio, fim) {
  if (!inicio || !fim) return '—';
  const ms = new Date(fim).getTime() - new Date(inicio).getTime();
  return formatarDuracao(Math.round(ms / 60000));
}

async function signedUrl(path, ttlSec = 60 * 60 * 24 * 7) {
  if (!path) return null;
  const { data } = await supabase.storage.from('field-photos').createSignedUrl(path, ttlSec);
  return data?.signedUrl ?? null;
}

function urlExpirada(url) {
  if (!url) return true;
  try {
    const token = new URL(url).searchParams.get('token');
    if (!token) return false;
    const { exp } = JSON.parse(atob(token.split('.')[1]));
    return exp < Date.now() / 1000;
  } catch {
    return false;
  }
}

const SELECT_RELATORIO = `
  id, funcionario_id, status,
  checkin_at, checkin_lat, checkin_lng,
  checkout_at, checkout_lat, checkout_lng,
  relato, observacoes,
  assinatura_responsavel_nome, assinatura_responsavel_img, assinatura_storage_path,
  agendamento_id,
  agenda:agenda(
    id, data_agendada, hora_estimada_chegada, duracao_estimada_min,
    observacoes_gestor, ordem_rota, nome_cliente, endereco_tarefa,
    cliente:clientes(id, nome_empresa, endereco, bairro, lat, lng, contato_nome, grupo_servico)
  ),
  fotos:fotos_relatorio(id, url, storage_path, observacao, tipo, ordem, tamanho_bytes)
`;

function formatarBytes(n) {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Nome exibido do local visitado: cliente cadastrado, ou nome_cliente da
// tarefa avulsa (agenda sem cliente_id — ver migration 030_agenda_tarefa_interna).
function nomeLocal(r) {
  return r.agenda?.cliente?.nome_empresa ?? r.agenda?.nome_cliente ?? '—';
}

// Idem para endereço.
function enderecoLocal(r) {
  return r.agenda?.cliente?.endereco ?? r.agenda?.endereco_tarefa ?? null;
}

// Link direto para um relatório específico (usado no card e no deep-link de abertura)
function urlRelatorio(id) {
  return `?tela=relatorios&relatorio=${id}`;
}

// Reverse geocoding via Nominatim (OpenStreetMap) — free, sem chave de API
async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=pt-BR`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    const a = data?.address;
    if (!a) return data?.display_name ?? null;
    const rua    = a.road || a.pedestrian || a.footway || a.residential || '';
    const num    = a.house_number || '';
    const bairro = a.suburb || a.neighbourhood || a.city_district || '';
    if (!rua && !bairro) return data.display_name ?? null;
    let out = rua;
    if (num) out += `, ${num}`;
    if (bairro) out += out ? ` — ${bairro}` : bairro;
    return out || data.display_name || null;
  } catch { return null; }
}

export default function Relatorios() {
  const [relatorios, setRelatorios] = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [busca,      setBusca]      = useState('');
  const [filtroFunc, setFiltroFunc] = useState('todos');
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [indiceSugestao,   setIndiceSugestao]   = useState(0);
  // Range de datas (defaults: últimos 30 dias)
  const hojeStr = new Date().toISOString().split('T')[0];
  const trintaAtrasStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  })();
  const [dataInicio, setDataInicio] = useState(trintaAtrasStr);
  const [dataFim,    setDataFim]    = useState(hojeStr);
  const [flagsAlerta, setFlagsAlerta] = useState({ semFotos: false, semAssin: false, foraLocal: false });
  const [detalhe,    setDetalhe]    = useState(null); // relatorio expandido
  const [consumoAberto, setConsumoAberto] = useState(false);
  const [backfillRodando, setBackfillRodando] = useState(false);
  const [backfillResultado, setBackfillResultado] = useState(null);

  async function carregar() {
    setLoading(true);
    // Se dataInicio > dataFim, inverte para não retornar vazio silenciosamente
    let ini = dataInicio, fim = dataFim;
    if (ini > fim) [ini, fim] = [fim, ini];
    const isoInicio = `${ini}T00:00:00`;
    const isoFim    = `${fim}T23:59:59`;

    const [relRes, empRes] = await Promise.all([
      supabase
        .from('relatorios')
        .select(SELECT_RELATORIO)
        .gte('checkin_at', isoInicio)
        .lte('checkin_at', isoFim)
        .order('checkin_at', { ascending: false }),
      supabase.from('employees').select('id, name').order('name'),
    ]);

    setEmployees(empRes.data ?? []);
    setRelatorios(relRes.data ?? []);
    setLoading(false);
  }

  // Preenche tamanho_bytes de fotos enviadas antes da migration 031 — os
  // arquivos já existem no Storage, só falta o metadado na tabela. Busca o
  // tamanho via storage.list() (agrupado por pasta = relatorio_id) e
  // atualiza cada linha. Idempotente: só olha fotos com tamanho_bytes NULL,
  // então pode ser clicado de novo sem problema (ex: se algum lote falhar).
  async function recalcularTamanhosAntigos() {
    setBackfillRodando(true);
    setBackfillResultado(null);
    try {
      // Paginado: o Supabase limita a ~1000 linhas por request, e há mais
      // fotos que isso no total.
      const fotos = [];
      const PAGINA = 1000;
      for (let offset = 0; ; offset += PAGINA) {
        const { data: lote, error } = await supabase
          .from('fotos_relatorio')
          .select('id, storage_path')
          .is('tamanho_bytes', null)
          .not('storage_path', 'is', null)
          .range(offset, offset + PAGINA - 1);
        if (error) throw error;
        fotos.push(...(lote ?? []));
        if (!lote || lote.length < PAGINA) break;
      }

      const porPasta = new Map();
      (fotos ?? []).forEach(f => {
        const pasta = f.storage_path.split('/')[0];
        if (!porPasta.has(pasta)) porPasta.set(pasta, []);
        porPasta.get(pasta).push(f);
      });

      let atualizadas = 0, falhas = 0;
      for (const [pasta, itens] of porPasta) {
        const { data: arquivos, error: listErr } = await supabase.storage.from('field-photos').list(pasta, { limit: 1000 });
        if (listErr || !arquivos) { falhas += itens.length; continue; }
        const tamanhoPorNome = new Map(arquivos.map(a => [a.name, a.metadata?.size ?? null]));

        const resultados = await Promise.all(itens.map(async (foto) => {
          const nomeArquivo = foto.storage_path.split('/')[1];
          const tamanho = tamanhoPorNome.get(nomeArquivo);
          if (tamanho == null) return false;
          const { error: updErr } = await supabase
            .from('fotos_relatorio')
            .update({ tamanho_bytes: tamanho })
            .eq('id', foto.id);
          return !updErr;
        }));
        atualizadas += resultados.filter(Boolean).length;
        falhas += resultados.filter(r => !r).length;
      }

      setBackfillResultado({ total: fotos.length, atualizadas, falhas });
      await carregar();
    } catch (e) {
      setBackfillResultado({ erro: e.message });
    } finally {
      setBackfillRodando(false);
    }
  }

  // carregar é definida no escopo do componente e depende só de dataInicio/dataFim
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [dataInicio, dataFim]); // eslint-disable-line
  useRealtimeRefresh('relatorios', carregar);

  // Deep-link: ?tela=relatorios&relatorio=<id> abre direto o relatório, mesmo
  // que ele esteja fora do range de datas carregado na lista (busca isolada
  // por id, sem depender do filtro). Permite abrir o card em nova aba.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('relatorio');
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('relatorios').select(SELECT_RELATORIO).eq('id', id).single();
      if (data) setDetalhe(data);
    })();
  }, []);

  function abrirDetalhe(r) {
    window.history.pushState({}, '', urlRelatorio(r.id));
    setDetalhe(r);
  }

  function fecharDetalhe() {
    window.history.replaceState({}, '', '?tela=relatorios');
    setDetalhe(null);
  }

  const empMap = useMemo(() => {
    const m = new Map();
    employees.forEach(e => m.set(String(e.id), e.name));
    return m;
  }, [employees]);

  const grupos = useMemo(() => {
    const set = new Set(relatorios.map(r => r.agenda?.cliente?.grupo_servico).filter(Boolean));
    return [...set].sort();
  }, [relatorios]);

  const sugestoes = useMemo(() => {
    if (!busca.trim()) return [];
    const q = busca.toLowerCase();
    const vistos = new Set();
    const itens = [];
    for (const r of relatorios) {
      const c = r.agenda?.cliente;
      if (!c || vistos.has(c.id)) continue;
      const nome = c.nome_empresa?.toLowerCase() ?? '';
      const bairro = c.bairro?.toLowerCase() ?? '';
      if (!nome.includes(q) && !bairro.includes(q)) continue;
      vistos.add(c.id);
      itens.push({ id: c.id, label: c.nome_empresa, sublabel: c.bairro });
      if (itens.length >= 8) break;
    }
    return itens;
  }, [relatorios, busca]);

  function selecionarSugestao(item) {
    setSugestoesAbertas(false);
    setBusca(item.label);
  }

  function onBuscaKeyDown(e) {
    if (!sugestoesAbertas || sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceSugestao(i => Math.min(i + 1, sugestoes.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setIndiceSugestao(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter')     { e.preventDefault(); selecionarSugestao(sugestoes[indiceSugestao]); }
    else if (e.key === 'Escape')    { setSugestoesAbertas(false); }
  }

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return relatorios.filter(r => {
      if (filtroFunc !== 'todos' && String(r.funcionario_id) !== filtroFunc) return false;
      if (filtroGrupo !== 'todos' && r.agenda?.cliente?.grupo_servico !== filtroGrupo) return false;
      if (q) {
        const nomeEmp = nomeLocal(r).toLowerCase();
        const bairro  = r.agenda?.cliente?.bairro?.toLowerCase() ?? '';
        if (!nomeEmp.includes(q) && !bairro.includes(q)) return false;
      }
      if (flagsAlerta.semFotos && (r.fotos?.length ?? 0) > 0) return false;
      if (flagsAlerta.semAssin && r.assinatura_responsavel_img) return false;
      if (flagsAlerta.foraLocal) {
        const c = r.agenda?.cliente;
        const d = distanciaMetros(r.checkin_lat, r.checkin_lng, c?.lat, c?.lng);
        if (d == null || d <= 300) return false;
      }
      return true;
    });
  }, [relatorios, busca, filtroFunc, filtroGrupo, flagsAlerta]);

  const metricas = useMemo(() => ({
    total:    filtrados.length,
    hoje:     filtrados.filter(r => r.agenda?.data_agendada === new Date().toISOString().split('T')[0]).length,
    fotos:    filtrados.reduce((s, r) => s + (r.fotos?.length ?? 0), 0),
    assinados: filtrados.filter(r => r.assinatura_responsavel_img).length,
  }), [filtrados]);

  // Consumo estimado de dados por colaborador (fotos, já comprimidas, são o
  // grosso do tráfego — ver migração 031_fotos_tamanho_bytes). Usa o range de
  // datas selecionado, independente de busca/flags (é um resumo do período).
  const usoPorFuncionario = useMemo(() => {
    const m = new Map();
    relatorios.forEach(r => {
      const nome = empMap.get(String(r.funcionario_id)) ?? '—';
      const atual = m.get(nome) ?? { nome, fotos: 0, bytes: 0 };
      (r.fotos ?? []).forEach(f => {
        atual.fotos += 1;
        atual.bytes += f.tamanho_bytes ?? 0;
      });
      m.set(nome, atual);
    });
    return [...m.values()].filter(u => u.fotos > 0).sort((a, b) => b.bytes - a.bytes);
  }, [relatorios, empMap]);

  return (
    <div className="rel">
      <header className="rel__header">
        <div>
          <h2 className="rel__titulo">Relatórios de Campo</h2>
          <p className="rel__sub">Visitas concluídas pela equipe · Sistema de Campo</p>
        </div>
        <div className="rel__kpis">
          <div className="rel__kpi">
            <span className="rel__kpi-valor">{metricas.total}</span>
            <span className="rel__kpi-label">Relatórios</span>
          </div>
          <div className="rel__kpi rel__kpi--verde">
            <span className="rel__kpi-valor">{metricas.hoje}</span>
            <span className="rel__kpi-label">Hoje</span>
          </div>
          <div className="rel__kpi">
            <span className="rel__kpi-valor">{metricas.fotos}</span>
            <span className="rel__kpi-label">Fotos</span>
          </div>
          <div className="rel__kpi rel__kpi--verde">
            <span className="rel__kpi-valor">{metricas.assinados}</span>
            <span className="rel__kpi-label">Assinados</span>
          </div>
          <button
            className="rel__kpi rel__kpi--storage"
            onClick={() => setConsumoAberto(true)}
            title="Ver uso de storage por colaborador"
          >
            <span className="rel__kpi-valor">📶</span>
            <span className="rel__kpi-label">Storage</span>
          </button>
        </div>
      </header>

      {consumoAberto && (
        <ModalConsumo
          dados={usoPorFuncionario}
          dataInicio={dataInicio}
          dataFim={dataFim}
          backfillRodando={backfillRodando}
          backfillResultado={backfillResultado}
          onBackfill={recalcularTamanhosAntigos}
          onFechar={() => setConsumoAberto(false)}
        />
      )}

      <div className="rel__filtros">
        <div className="rel__busca-wrap">
          <span className="rel__busca-icon">⌕</span>
          <input
            className="rel__busca"
            placeholder="Buscar por cliente ou bairro..."
            value={busca}
            onChange={e => { setBusca(e.target.value); setSugestoesAbertas(true); setIndiceSugestao(0); }}
            onFocus={() => busca.trim() && setSugestoesAbertas(true)}
            onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
            onKeyDown={onBuscaKeyDown}
            autoComplete="off"
          />
          {busca && <button className="rel__busca-clear" onClick={() => setBusca('')}>✕</button>}
          {sugestoesAbertas && busca.trim() && (
            <SugestoesDropdown itens={sugestoes} indiceAtivo={indiceSugestao} onSelecionar={selecionarSugestao} onHover={setIndiceSugestao} />
          )}
        </div>

        <select className="rel__select" value={filtroFunc} onChange={e => setFiltroFunc(e.target.value)}>
          <option value="todos">Todos funcionários</option>
          {employees.map(e => (
            <option key={e.id} value={String(e.id)}>{e.name}</option>
          ))}
        </select>

        <select className="rel__select" value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}>
          <option value="todos">Todos os grupos</option>
          {grupos.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <div className="rel__range">
          <input
            type="date"
            className="rel__data"
            value={dataInicio}
            max={dataFim}
            onChange={e => setDataInicio(e.target.value)}
            title="Data inicial"
          />
          <span className="rel__range-sep">→</span>
          <input
            type="date"
            className="rel__data"
            value={dataFim}
            min={dataInicio}
            max={hojeStr}
            onChange={e => setDataFim(e.target.value)}
            title="Data final"
          />
        </div>

        <div className="rel__flags">
          <button
            className={`rel__flag ${flagsAlerta.semFotos ? 'rel__flag--on' : ''}`}
            onClick={() => setFlagsAlerta(f => ({ ...f, semFotos: !f.semFotos }))}
            title="Só mostrar relatórios sem fotos"
          >
            📷 Sem fotos
          </button>
          <button
            className={`rel__flag ${flagsAlerta.semAssin ? 'rel__flag--on' : ''}`}
            onClick={() => setFlagsAlerta(f => ({ ...f, semAssin: !f.semAssin }))}
            title="Só mostrar relatórios sem assinatura"
          >
            ✍ Sem assinatura
          </button>
          <button
            className={`rel__flag ${flagsAlerta.foraLocal ? 'rel__flag--on' : ''}`}
            onClick={() => setFlagsAlerta(f => ({ ...f, foraLocal: !f.foraLocal }))}
            title="Só mostrar relatórios com check-in > 300m do endereço"
          >
            📍 GPS fora
          </button>
        </div>

        <span className="rel__count">{filtrados.length} relatório{filtrados.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="rel__estado">
          <div className="rel__spinner" />
          <p>Carregando relatórios...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rel__estado">
          <p className="rel__estado-msg">
            Nenhum relatório encontrado no período.
          </p>
        </div>
      ) : (
        <div className="rel__lista">
          {filtrados.map(r => (
            <CartaoRelatorio
              key={r.id}
              relatorio={r}
              funcNome={empMap.get(String(r.funcionario_id)) ?? '—'}
              onAbrir={() => abrirDetalhe(r)}
            />
          ))}
        </div>
      )}

      {detalhe && (
        <DetalheRelatorio
          relatorio={detalhe}
          funcNome={empMap.get(String(detalhe.funcionario_id)) ?? '—'}
          onFechar={fecharDetalhe}
          onRemovido={() => { fecharDetalhe(); carregar(); }}
        />
      )}
    </div>
  );
}

// ── Cartão ────────────────────────────────────────────────────────
function CartaoRelatorio({ relatorio: r, funcNome, onAbrir }) {
  const c = r.agenda?.cliente;
  const nFotos = r.fotos?.length ?? 0;
  const temAssin = !!r.assinatura_responsavel_img;
  const dur = duracaoEntre(r.checkin_at, r.checkout_at);
  const dist = distanciaMetros(r.checkin_lat, r.checkin_lng, c?.lat, c?.lng);
  const foraLocal = dist != null && dist > 300;

  const nAlertas = (foraLocal ? 1 : 0) + (!nFotos ? 1 : 0) + (!temAssin ? 1 : 0);

  // <a href> de verdade (não <div onClick>): permite clique direito → "Abrir
  // em nova guia", clique do meio e Ctrl/Cmd+clique nativos do navegador. Um
  // clique comum continua abrindo o modal na mesma página (SPA).
  function handleClick(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    onAbrir();
  }

  return (
    <a
      href={urlRelatorio(r.id)}
      className={`rel-card ${r.status === 'concluido' ? 'rel-card--ok' : 'rel-card--pend'} ${nAlertas > 0 ? 'rel-card--alerta' : ''}`}
      onClick={handleClick}
    >
      <div className="rel-card__topo">
        <div className="rel-card__nome">{nomeLocal(r)}</div>
        <div className="rel-card__data">{formatarData(r.agenda?.data_agendada)}</div>
      </div>
      <div className="rel-card__meta">
        <span><i className="rel-i">👤</i>{funcNome}</span>
        {c?.bairro && <span>· {c.bairro}</span>}
        {r.checkin_at && <span>· ⏱ {new Date(r.checkin_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
        <span>· duração {dur}</span>
        {dist != null && (
          <span className={foraLocal ? 'rel-card__dist rel-card__dist--warn' : 'rel-card__dist'}>
            · 📍 <strong>{dist}m</strong> do endereço
          </span>
        )}
      </div>
      <div className="rel-card__tags">
        {nFotos > 0 && <span className="rel-tag rel-tag--ok">📷 {nFotos} foto{nFotos > 1 ? 's' : ''}</span>}
        {temAssin  && <span className="rel-tag rel-tag--ok">✍ assinado</span>}
        {!nFotos && <span className="rel-tag rel-tag--warn">sem fotos</span>}
        {!temAssin && <span className="rel-tag rel-tag--warn">sem assinatura</span>}
      </div>
    </a>
  );
}

// ── Modal de detalhe ──────────────────────────────────────────────
function DetalheRelatorio({ relatorio: r, funcNome, onFechar, onRemovido }) {
  const c = r.agenda?.cliente;
  const [fotoAmpIdx, setFotoAmpIdx] = useState(null); // índice em r.fotos, ou null se fechado
  const [urlsFotos, setUrlsFotos] = useState({}); // fotoId -> signed url
  const [assinUrl, setAssinUrl] = useState(null);
  const [removendo, setRemovendo] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [enderecoIn,  setEnderecoIn]  = useState(null); // rua+num do check-in
  const [enderecoOut, setEnderecoOut] = useState(null); // rua+num do check-out
  const [loadingEnd,  setLoadingEnd]  = useState(false);

  function exportarPDF() {
    const c = r.agenda?.cliente;
    const fotosComUrl = (r.fotos ?? []).map((f) => ({
      url: urlsFotos[f.id] ?? f.url ?? '',
      observacao: f.observacao ?? '',
    })).filter((f) => f.url);

    baixarPDF({
      cliente:      nomeLocal(r),
      bairro:       c?.bairro ?? '',
      data:         formatarData(r.agenda?.data_agendada),
      status:       { em_execucao: 'Em execução', concluido: 'Concluída' }[r.status] ?? r.status,
      checkin:      r.checkin_at  ? new Date(r.checkin_at).toLocaleTimeString('pt-BR',  { hour: '2-digit', minute: '2-digit' }) : '—',
      checkout:     r.checkout_at ? new Date(r.checkout_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
      obsGestor:    r.agenda?.observacoes_gestor ?? '',
      relato:       (r.relato || '').split('\n\n— Fotos —\n')[0].trim(),
      obsRelatorio: r.observacoes ?? '',
      assinatura:   assinUrl,
      responsavel:  r.assinatura_responsavel_nome ?? '',
      fotos:        fotosComUrl,
    });
  }

  function remover() {
    const nome = nomeLocal(r) !== '—' ? nomeLocal(r) : 'este relatório';
    setConfirmar({
      titulo: `Remover relatório de "${nome}"?`,
      mensagem: `Isso apaga ${r.fotos?.length ?? 0} foto(s), a assinatura e o registro. A visita volta para "publicado" para ser refeita. Ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      variante: 'danger',
      onConfirmar: async () => {
        setConfirmar(null);
        await _executarRemover();
      },
    });
  }

  async function _executarRemover() {
    setRemovendo(true);
    try {
      // Apaga arquivos do storage (fotos + assinatura)
      const paths = [];
      for (const f of (r.fotos ?? [])) if (f.storage_path) paths.push(f.storage_path);
      if (r.assinatura_storage_path) paths.push(r.assinatura_storage_path);
      if (paths.length > 0) {
        await supabase.storage.from('field-photos').remove(paths);
      }
      // Apaga fotos_relatorio
      await supabase.from('fotos_relatorio').delete().eq('relatorio_id', r.id);
      // Apaga relatorio
      const { error: e1 } = await supabase.from('relatorios').delete().eq('id', r.id);
      if (e1) throw e1;
      // Volta agenda para publicado (permite refazer)
      if (r.agendamento_id) {
        await supabase.from('agenda').update({ status: 'publicado' }).eq('id', r.agendamento_id);
      }
      onRemovido?.();
    } catch (e) {
      setConfirmar({
        titulo: 'Erro ao remover',
        mensagem: e.message,
        confirmLabel: 'OK',
        variante: 'normal',
        onConfirmar: () => setConfirmar(null),
      });
    } finally {
      setRemovendo(false);
    }
  }

  useEffect(() => {
    (async () => {
      const map = {};
      for (const f of (r.fotos ?? [])) {
        if (f.url && !urlExpirada(f.url)) {
          map[f.id] = f.url;
        } else if (f.storage_path) {
          map[f.id] = await signedUrl(f.storage_path);
        } else if (f.url) {
          map[f.id] = f.url;
        }
      }
      setUrlsFotos(map);

      if (r.assinatura_responsavel_img && !urlExpirada(r.assinatura_responsavel_img)) {
        setAssinUrl(r.assinatura_responsavel_img);
      } else if (r.assinatura_storage_path) {
        setAssinUrl(await signedUrl(r.assinatura_storage_path));
      } else if (r.assinatura_responsavel_img) {
        setAssinUrl(r.assinatura_responsavel_img);
      }

      // Endereços a partir das coordenadas (Nominatim)
      setLoadingEnd(true);
      const [endIn, endOut] = await Promise.all([
        reverseGeocode(r.checkin_lat,  r.checkin_lng),
        reverseGeocode(r.checkout_lat, r.checkout_lng),
      ]);
      setEnderecoIn(endIn);
      setEnderecoOut(endOut);
      setLoadingEnd(false);
    })();
  }, [r]);

  function navegarFoto(delta) {
    const n = r.fotos?.length ?? 0;
    if (n === 0) return;
    setFotoAmpIdx((i) => (i == null ? i : (i + delta + n) % n));
  }

  useEffect(() => {
    if (fotoAmpIdx == null) return;
    function onKey(e) {
      if (e.key === 'ArrowRight') navegarFoto(1);
      else if (e.key === 'ArrowLeft') navegarFoto(-1);
      else if (e.key === 'Escape') setFotoAmpIdx(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotoAmpIdx]);

  const dur = duracaoEntre(r.checkin_at, r.checkout_at);
  const dist = distanciaMetros(r.checkin_lat, r.checkin_lng, c?.lat, c?.lng);
  const foraLocal = dist != null && dist > 300;

  const mapaUrl = r.checkin_lat && r.checkin_lng
    ? `https://www.google.com/maps?q=${r.checkin_lat},${r.checkin_lng}`
    : null;

  const overlayClose = useOverlayClose(onFechar);

  return (
    <div className="rel-overlay" {...overlayClose}>
      <div className="rel-modal">
        <header className="rel-modal__header">
          <div>
            <h3 className="rel-modal__titulo">{c?.nome_empresa ?? r.agenda?.nome_cliente ?? 'Relatório'}</h3>
            <p className="rel-modal__sub">
              {formatarData(r.agenda?.data_agendada)} · {funcNome}
            </p>
          </div>
          <button className="rel-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="rel-modal__corpo">

          {/* Resumo */}
          <section className="rel-sec">
            <h4 className="rel-sec__titulo">Resumo</h4>
            <div className="rel-grid">
              <div className="rel-mc">
                <div className="rel-mc__lbl">Check-in</div>
                <div className="rel-mc__val">{formatarDataHora(r.checkin_at)}</div>
              </div>
              <div className="rel-mc">
                <div className="rel-mc__lbl">Check-out</div>
                <div className="rel-mc__val">{formatarDataHora(r.checkout_at)}</div>
              </div>
              <div className="rel-mc">
                <div className="rel-mc__lbl">Duração</div>
                <div className="rel-mc__val">{dur}</div>
              </div>
              <div className="rel-mc">
                <div className="rel-mc__lbl">Fotos</div>
                <div className="rel-mc__val">{r.fotos?.length ?? 0}</div>
              </div>
            </div>
          </section>

          {/* Cliente */}
          <section className="rel-sec">
            <h4 className="rel-sec__titulo">Cliente</h4>
            <div className="rel-info">
              <div><strong>{enderecoLocal(r) ?? '—'}</strong></div>
              {c?.bairro && <div className="rel-hint">{c.bairro}</div>}
              {c?.grupo_servico && <div className="rel-hint">Grupo: {c.grupo_servico}</div>}
              {c?.contato_nome && <div className="rel-hint">Contato: {c.contato_nome}</div>}
              {!c && <div className="rel-hint">Tarefa avulsa (sem cliente cadastrado)</div>}
            </div>
          </section>

          {/* Localização — endereço reverso via Nominatim */}
          <section className={`rel-sec ${foraLocal ? 'rel-sec--warn' : ''}`}>
            <h4 className="rel-sec__titulo">📍 Localização</h4>
            <div className="rel-info">
              {r.checkin_lat != null ? (
                <>
                  <div>
                    <strong>Check-in:</strong>{' '}
                    {loadingEnd
                      ? <span className="rel-hint">buscando endereço…</span>
                      : (enderecoIn || <span className="rel-hint">endereço não localizado</span>)}
                    {mapaUrl && <a className="rel-link" href={mapaUrl} target="_blank" rel="noopener"> ver no mapa</a>}
                  </div>
                  {r.checkout_lat != null && (
                    <div>
                      <strong>Check-out:</strong>{' '}
                      {loadingEnd
                        ? <span className="rel-hint">buscando endereço…</span>
                        : (enderecoOut || <span className="rel-hint">endereço não localizado</span>)}
                    </div>
                  )}
                  {dist != null && (
                    <div className={`rel-dist ${foraLocal ? 'rel-dist--warn' : 'rel-dist--ok'}`}>
                      {foraLocal ? `⚠ Check-in ${dist}m distante do endereço cadastrado` : `✓ Check-in ${dist}m do endereço (OK)`}
                    </div>
                  )}
                </>
              ) : <div className="rel-hint">GPS não capturado</div>}
            </div>
          </section>

          {/* Relato — filtra qualquer bloco de legendas legado (marker "— Fotos —") */}
          {(() => {
            const relatoLimpo = (r.relato || '').split('\n\n— Fotos —\n')[0].trim();
            if (!relatoLimpo) return null;
            return (
              <section className="rel-sec">
                <h4 className="rel-sec__titulo">Relato da tarefa</h4>
                <div className="rel-relato">{relatoLimpo}</div>
              </section>
            );
          })()}

          {r.observacoes && (
            <section className="rel-sec">
              <h4 className="rel-sec__titulo">Observações</h4>
              <div className="rel-relato">{r.observacoes}</div>
            </section>
          )}

          {r.agenda?.observacoes_gestor && (
            <section className="rel-sec rel-sec--gestor">
              <h4 className="rel-sec__titulo">Observação original do gestor</h4>
              <div className="rel-relato">{r.agenda.observacoes_gestor}</div>
            </section>
          )}

          {/* Fotos */}
          {r.fotos?.length > 0 && (
            <section className="rel-sec">
              <h4 className="rel-sec__titulo">Fotos ({r.fotos.length})</h4>
              <div className="rel-fotos">
                {r.fotos.map((f, i) => (
                  <div key={f.id} className="rel-foto" onClick={() => setFotoAmpIdx(i)}>
                    <span className="rel-foto__num">{i + 1}</span>
                    {urlsFotos[f.id]
                      ? <img src={urlsFotos[f.id]} alt="foto" />
                      : <div className="rel-foto__load">carregando...</div>}
                    {f.observacao && <div className="rel-foto__obs">{f.observacao}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Assinatura */}
          <section className="rel-sec">
            <h4 className="rel-sec__titulo">Assinatura do responsável</h4>
            <div className="rel-info">
              {r.assinatura_responsavel_nome
                ? <div><strong>{r.assinatura_responsavel_nome}</strong></div>
                : <div className="rel-hint">Sem nome informado</div>}
              {assinUrl
                ? <div className="rel-assin"><img src={assinUrl} alt="assinatura" /></div>
                : <div className="rel-hint">Sem imagem de assinatura</div>}
            </div>
          </section>

        </div>

        <footer className="rel-modal__footer">
          <button
            className="rel-btn rel-btn--perigo"
            onClick={remover}
            disabled={removendo}
            title="Apaga o relatório, fotos e assinatura. A visita volta para status publicado."
          >
            {removendo ? 'Removendo...' : '✕ Remover relatório'}
          </button>
          <span style={{ flex: 1 }} />
          <button className="rel-btn rel-btn--pdf" onClick={exportarPDF} title="Exportar como PDF">
            📄 Exportar PDF
          </button>
          <button className="rel-btn" onClick={onFechar}>Fechar</button>
        </footer>
      </div>

      {fotoAmpIdx != null && (() => {
        const fotoAtual = r.fotos[fotoAmpIdx];
        const temVarias = r.fotos.length > 1;
        return (
          <div className="rel-lightbox" onClick={() => setFotoAmpIdx(null)}>
            {temVarias && (
              <button
                className="rel-lightbox__seta rel-lightbox__seta--esq"
                onClick={(e) => { e.stopPropagation(); navegarFoto(-1); }}
                title="Foto anterior"
                aria-label="Foto anterior"
              >
                ‹
              </button>
            )}
            <img src={urlsFotos[fotoAtual.id]} alt="foto ampliada" />
            {temVarias && (
              <button
                className="rel-lightbox__seta rel-lightbox__seta--dir"
                onClick={(e) => { e.stopPropagation(); navegarFoto(1); }}
                title="Próxima foto"
                aria-label="Próxima foto"
              >
                ›
              </button>
            )}
            {fotoAtual.observacao && <div className="rel-lightbox__obs">{fotoAtual.observacao}</div>}
            {temVarias && (
              <div className="rel-lightbox__contador">{fotoAmpIdx + 1} / {r.fotos.length}</div>
            )}
          </div>
        );
      })()}

      {confirmar && (
        <ModalConfirmar
          titulo={confirmar.titulo}
          mensagem={confirmar.mensagem}
          confirmLabel={confirmar.confirmLabel}
          variante={confirmar.variante}
          onConfirmar={confirmar.onConfirmar}
          onCancelar={() => setConfirmar(null)}
        />
      )}
    </div>
  );
}
