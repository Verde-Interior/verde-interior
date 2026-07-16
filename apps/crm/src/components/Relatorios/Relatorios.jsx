// src/components/Relatorios/Relatorios.jsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { formatarDataHora, formatarData } from '../../utils/dateUtils';
import { distanciaMetros } from '../../utils/geoUtils';
import { formatarDuracao } from '../../utils/formatUtils';
import './Relatorios.css';

function duracaoEntre(inicio, fim) {
  if (!inicio || !fim) return '—';
  const ms = new Date(fim).getTime() - new Date(inicio).getTime();
  return formatarDuracao(Math.round(ms / 60000));
}

async function signedUrl(path, ttlSec = 60 * 60) {
  if (!path) return null;
  const { data } = await supabase.storage.from('field-photos').createSignedUrl(path, ttlSec);
  return data?.signedUrl ?? null;
}

export default function Relatorios() {
  const [relatorios, setRelatorios] = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [busca,      setBusca]      = useState('');
  const [filtroFunc, setFiltroFunc] = useState('todos');
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
        .select(`
          id, funcionario_id, status,
          checkin_at, checkin_lat, checkin_lng,
          checkout_at, checkout_lat, checkout_lng,
          relato, observacoes,
          assinatura_responsavel_nome, assinatura_responsavel_img, assinatura_storage_path,
          agendamento_id,
          agenda:agenda(
            id, data_agendada, hora_estimada_chegada, duracao_estimada_min,
            observacoes_gestor, ordem_rota,
            cliente:clientes(id, nome_empresa, endereco, bairro, lat, lng, contato_nome, grupo_servico)
          ),
          fotos:fotos_relatorio(id, url, storage_path, observacao, tipo, ordem)
        `)
        .gte('checkin_at', isoInicio)
        .lte('checkin_at', isoFim)
        .order('checkin_at', { ascending: false }),
      supabase.from('employees').select('id, name').order('name'),
    ]);

    setEmployees(empRes.data ?? []);
    setRelatorios(relRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [dataInicio, dataFim]);

  const empMap = useMemo(() => {
    const m = new Map();
    employees.forEach(e => m.set(String(e.id), e.name));
    return m;
  }, [employees]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return relatorios.filter(r => {
      if (filtroFunc !== 'todos' && String(r.funcionario_id) !== filtroFunc) return false;
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
  }, [relatorios, busca, filtroFunc, flagsAlerta]);

  const metricas = useMemo(() => ({
    total:    filtrados.length,
    hoje:     filtrados.filter(r => r.agenda?.data_agendada === new Date().toISOString().split('T')[0]).length,
    fotos:    filtrados.reduce((s, r) => s + (r.fotos?.length ?? 0), 0),
    assinados: filtrados.filter(r => r.assinatura_responsavel_img).length,
  }), [filtrados]);

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

      <div className="rel__filtros">
        <div className="rel__busca-wrap">
          <span className="rel__busca-icon">⌕</span>
          <input
            className="rel__busca"
            placeholder="Buscar por cliente ou bairro..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && <button className="rel__busca-clear" onClick={() => setBusca('')}>✕</button>}
        </div>

        <select className="rel__select" value={filtroFunc} onChange={e => setFiltroFunc(e.target.value)}>
          <option value="todos">Todos funcionários</option>
          {employees.map(e => (
            <option key={e.id} value={String(e.id)}>{e.name}</option>
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
              onAbrir={() => setDetalhe(r)}
            />
          ))}
        </div>
      )}

      {detalhe && (
        <DetalheRelatorio
          relatorio={detalhe}
          funcNome={empMap.get(String(detalhe.funcionario_id)) ?? '—'}
          onFechar={() => setDetalhe(null)}
          onRemovido={() => { setDetalhe(null); carregar(); }}
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

  return (
    <div
      className={`rel-card ${r.status === 'concluido' ? 'rel-card--ok' : 'rel-card--pend'} ${nAlertas > 0 ? 'rel-card--alerta' : ''}`}
      onClick={onAbrir}
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
    </div>
  );
}

// ── Modal de detalhe ──────────────────────────────────────────────
function DetalheRelatorio({ relatorio: r, funcNome, onFechar, onRemovido }) {
  const c = r.agenda?.cliente;
  const [fotoAmp, setFotoAmp] = useState(null); // { url, observacao }
  const [urlsFotos, setUrlsFotos] = useState({}); // fotoId -> signed url
  const [assinUrl, setAssinUrl] = useState(null);
  const [removendo, setRemovendo] = useState(false);

  async function remover() {
    const nome = c?.nome_empresa ?? 'este relatório';
    if (!confirm(`Remover o relatório de "${nome}"?\n\nIsso apaga:\n- ${r.fotos?.length ?? 0} foto(s)\n- Assinatura (se houver)\n- O registro do relatório\n\nA visita na agenda volta para status "publicado" para permitir refazer.\n\nEsta ação não pode ser desfeita.`)) return;
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
      alert('Erro ao remover: ' + e.message);
    } finally {
      setRemovendo(false);
    }
  }

  useEffect(() => {
    (async () => {
      const map = {};
      for (const f of (r.fotos ?? [])) {
        if (f.storage_path) {
          map[f.id] = await signedUrl(f.storage_path);
        } else if (f.url) {
          map[f.id] = f.url;
        }
      }
      setUrlsFotos(map);

      if (r.assinatura_storage_path) {
        setAssinUrl(await signedUrl(r.assinatura_storage_path));
      } else if (r.assinatura_responsavel_img) {
        setAssinUrl(r.assinatura_responsavel_img);
      }
    })();
  }, [r]);

  const dur = duracaoEntre(r.checkin_at, r.checkout_at);
  const dist = distanciaMetros(r.checkin_lat, r.checkin_lng, c?.lat, c?.lng);
  const foraLocal = dist != null && dist > 300;

  const mapaUrl = r.checkin_lat && r.checkin_lng
    ? `https://www.google.com/maps?q=${r.checkin_lat},${r.checkin_lng}`
    : null;

  return (
    <div className="rel-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="rel-modal">
        <header className="rel-modal__header">
          <div>
            <h3 className="rel-modal__titulo">{c?.nome_empresa ?? 'Relatório'}</h3>
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
              <div><strong>{c?.endereco ?? '—'}</strong></div>
              {c?.bairro && <div className="rel-hint">{c.bairro}</div>}
              {c?.grupo_servico && <div className="rel-hint">Grupo: {c.grupo_servico}</div>}
              {c?.contato_nome && <div className="rel-hint">Contato: {c.contato_nome}</div>}
            </div>
          </section>

          {/* GPS */}
          <section className={`rel-sec ${foraLocal ? 'rel-sec--warn' : ''}`}>
            <h4 className="rel-sec__titulo">📍 Localização</h4>
            <div className="rel-info">
              {r.checkin_lat != null ? (
                <>
                  <div>
                    <strong>Check-in:</strong> {r.checkin_lat.toFixed(6)}, {r.checkin_lng.toFixed(6)}
                    {mapaUrl && <a className="rel-link" href={mapaUrl} target="_blank" rel="noopener"> ver no mapa</a>}
                  </div>
                  {r.checkout_lat != null && (
                    <div><strong>Check-out:</strong> {r.checkout_lat.toFixed(6)}, {r.checkout_lng.toFixed(6)}</div>
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

          {/* Relato */}
          {r.relato && (
            <section className="rel-sec">
              <h4 className="rel-sec__titulo">Relato da tarefa</h4>
              <div className="rel-relato">{r.relato}</div>
            </section>
          )}

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
                {r.fotos.map(f => (
                  <div key={f.id} className="rel-foto" onClick={() => setFotoAmp({ url: urlsFotos[f.id], observacao: f.observacao })}>
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
          <button className="rel-btn" onClick={onFechar}>Fechar</button>
        </footer>
      </div>

      {fotoAmp && (
        <div className="rel-lightbox" onClick={() => setFotoAmp(null)}>
          <img src={fotoAmp.url} alt="foto ampliada" />
          {fotoAmp.observacao && <div className="rel-lightbox__obs">{fotoAmp.observacao}</div>}
        </div>
      )}
    </div>
  );
}
