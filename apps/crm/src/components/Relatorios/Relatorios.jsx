// src/components/Relatorios/Relatorios.jsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { formatarData } from '../../utils/dateUtils';
import { distanciaMetros } from '../../utils/geoUtils';
import SugestoesDropdown from '../SugestoesDropdown/SugestoesDropdown';
import DetalheRelatorio, { SELECT_RELATORIO, duracaoEntre, clienteDaVisita } from './DetalheRelatorio';
import './Relatorios.css';

function formatarBytes(n) {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Link direto para um relatório específico (usado no card e no deep-link de abertura)
function urlRelatorio(id) {
  return `?tela=relatorios&relatorio=${id}`;
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
    // A lista, busca e filtro por grupo leem r.agenda.cliente direto — sem
    // normalizar aqui, visita de lead/tarefa avulsa (sem cliente cadastrado)
    // sumia da busca/filtro e aparecia com "—" na lista.
    setRelatorios((relRes.data ?? []).map((r) => (
      r.agenda && !r.agenda.cliente
        ? { ...r, agenda: { ...r.agenda, cliente: clienteDaVisita(r.agenda) } }
        : r
    )));
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
  useEffect(() => { carregar(); }, [dataInicio, dataFim]);

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
      // Lead/tarefa avulsa não tem id real (cliente sintético) — usa o nome
      // como chave de dedupe pra não sumir depois da primeira ocorrência.
      const chave = c?.id ?? c?.nome_empresa;
      if (!c || vistos.has(chave)) continue;
      const nome = c.nome_empresa?.toLowerCase() ?? '';
      const bairro = c.bairro?.toLowerCase() ?? '';
      if (!nome.includes(q) && !bairro.includes(q)) continue;
      vistos.add(chave);
      itens.push({ id: chave, label: c.nome_empresa, sublabel: c.bairro });
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
        const nomeEmp = r.agenda?.cliente?.nome_empresa?.toLowerCase() ?? '';
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
        </div>
      </header>

      <div className="rel__consumo">
        <button
          className="rel__consumo-toggle"
          onClick={() => setConsumoAberto(v => !v)}
          title="Estimativa de dados consumidos (fotos) por colaborador, no período selecionado"
        >
          📶 Consumo de dados por colaborador {consumoAberto ? '▲' : '▼'}
        </button>
        {consumoAberto && (
          <>
            <div className="rel__consumo-backfill">
              <button
                className="rel__consumo-toggle"
                onClick={recalcularTamanhosAntigos}
                disabled={backfillRodando}
                title="Preenche o tamanho das fotos enviadas antes desse recurso existir, lendo direto do Storage"
              >
                {backfillRodando ? '⏳ Calculando...' : '🔄 Calcular fotos antigas (sem tamanho)'}
              </button>
              {backfillResultado && (
                backfillResultado.erro
                  ? <span className="rel__consumo-backfill-msg rel__consumo-backfill-msg--erro">Erro: {backfillResultado.erro}</span>
                  : <span className="rel__consumo-backfill-msg">
                      {backfillResultado.atualizadas} foto{backfillResultado.atualizadas !== 1 ? 's' : ''} atualizada{backfillResultado.atualizadas !== 1 ? 's' : ''}
                      {backfillResultado.falhas > 0 && ` · ${backfillResultado.falhas} não encontrada(s) no Storage`}
                      {backfillResultado.total === 0 && ' · nada pendente'}
                    </span>
              )}
            </div>
            {usoPorFuncionario.length === 0 ? (
              <p className="rel__consumo-vazio">Sem fotos no período selecionado.</p>
            ) : (
              <table className="rel__consumo-tabela">
                <thead>
                  <tr><th>Colaborador</th><th>Fotos</th><th>Dados (estimado)</th></tr>
                </thead>
                <tbody>
                  {usoPorFuncionario.map(u => (
                    <tr key={u.nome}>
                      <td>{u.nome}</td>
                      <td>{u.fotos}</td>
                      <td>{formatarBytes(u.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

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
        <div className="rel-card__nome">{c?.nome_empresa ?? '—'}</div>
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

