// src/components/Relatorios/DetalheRelatorio.jsx
// Card de detalhe de um relatório de visita — extraído de Relatorios.jsx pra
// ser reaproveitado também na Escala (ver visita → mesma visualização,
// em vez de duas versões divergentes da mesma informação).
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatarDataHora, formatarData } from '../../utils/dateUtils';
import { distanciaMetros, reverseGeocode } from '../../utils/geoUtils';
import { formatarDuracao } from '../../utils/formatUtils';
import ModalConfirmar from '../ModalConfirmar/ModalConfirmar';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import { baixarPDF } from '../../lib/gerarRelatorio';
import './Relatorios.css';

export const SELECT_RELATORIO = `
  id, funcionario_id, status,
  checkin_at, checkin_lat, checkin_lng,
  checkout_at, checkout_lat, checkout_lng,
  relato, observacoes,
  assinatura_responsavel_nome, assinatura_responsavel_img, assinatura_storage_path,
  agendamento_id,
  agenda:agenda(
    id, data_agendada, hora_estimada_chegada, duracao_estimada_min,
    observacoes_gestor, ordem_rota, nome_cliente, endereco_tarefa,
    cliente:clientes(id, nome_empresa, endereco, bairro, lat, lng, contato_nome, grupo_servico),
    lead:leads(empresa, endereco, bairro, lat, lng, contato)
  ),
  fotos:fotos_relatorio(id, url, storage_path, observacao, tipo, ordem, tamanho_bytes)
`;

export function duracaoEntre(inicio, fim) {
  if (!inicio || !fim) return '—';
  const ms = new Date(fim).getTime() - new Date(inicio).getTime();
  return formatarDuracao(Math.round(ms / 60000));
}

function formatarHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

async function signedUrl(path, ttlSec = 60 * 60) {
  if (!path) return null;
  const { data } = await supabase.storage.from('field-photos').createSignedUrl(path, ttlSec);
  return data?.signedUrl ?? null;
}

// Normaliza a origem da visita (cliente cadastrado, lead, ou tarefa interna
// sem cadastro — nome_cliente/endereco_tarefa) num único formato de leitura,
// mesma lógica usada em Dashboard.jsx/EscalaCampo.jsx pra esse mesmo problema.
export function clienteDaVisita(agenda) {
  if (!agenda) return null;
  if (agenda.cliente) return agenda.cliente;
  if (agenda.lead) {
    return {
      nome_empresa: agenda.lead.empresa,
      endereco:     agenda.lead.endereco,
      bairro:       agenda.lead.bairro,
      lat:          agenda.lead.lat,
      lng:          agenda.lead.lng,
      contato_nome: agenda.lead.contato,
    };
  }
  if (agenda.nome_cliente) {
    return { nome_empresa: agenda.nome_cliente, endereco: agenda.endereco_tarefa };
  }
  return null;
}

export default function DetalheRelatorio({ relatorio: r, funcNome, onFechar, onRemovido, onEditarAgendamento }) {
  const c = clienteDaVisita(r.agenda);
  const [fotoAmpIdx, setFotoAmpIdx] = useState(null); // índice em r.fotos, ou null se fechado
  const [urlsFotos, setUrlsFotos] = useState({}); // fotoId -> signed url
  const [assinUrl, setAssinUrl] = useState(null);
  const [removendo, setRemovendo] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [enderecoIn,  setEnderecoIn]  = useState(null); // rua+num do check-in
  const [enderecoOut, setEnderecoOut] = useState(null); // rua+num do check-out
  const [loadingEnd,  setLoadingEnd]  = useState(false);
  const [cancelados,  setCancelados]  = useState([]);

  function exportarPDF() {
    const fotosComUrl = (r.fotos ?? []).map((f) => ({
      url: urlsFotos[f.id] ?? f.url ?? '',
      observacao: f.observacao ?? '',
    })).filter((f) => f.url);

    baixarPDF({
      cliente:      c?.nome_empresa ?? '—',
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
    const nome = c?.nome_empresa ?? 'este relatório';
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

      // Endereços a partir das coordenadas (Nominatim)
      setLoadingEnd(true);
      const [endIn, endOut] = await Promise.all([
        reverseGeocode(r.checkin_lat,  r.checkin_lng),
        reverseGeocode(r.checkout_lat, r.checkout_lng),
      ]);
      setEnderecoIn(endIn);
      setEnderecoOut(endOut);
      setLoadingEnd(false);

      // Tentativas de check-in canceladas antes deste relatório
      if (r.agendamento_id) {
        const { data: cans } = await supabase
          .from('checkin_cancelados')
          .select('*')
          .eq('agendamento_id', r.agendamento_id)
          .order('cancelado_at', { ascending: true });
        setCancelados(cans ?? []);
      } else {
        setCancelados([]);
      }
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
            <h3 className="rel-modal__titulo">{c?.nome_empresa ?? 'Relatório'}</h3>
            <p className="rel-modal__sub">
              {formatarData(r.agenda?.data_agendada)} · {funcNome}
            </p>
          </div>
          <button className="rel-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="rel-modal__corpo">

          {cancelados.length > 0 && (
            <section className="rel-sec rel-sec--warn">
              <h4 className="rel-sec__titulo">⚠ Tentativas de check-in canceladas <span className="rel-hint">({cancelados.length})</span></h4>
              <div className="rel-cancelados">
                {cancelados.map((cn, i) => (
                  <div key={cn.id} className="rel-cancelados__item">
                    <span className="rel-cancelados__num">{i + 1}</span>
                    <span>Check-in às <strong>{formatarHora(cn.checkin_at)}</strong> — cancelado às <strong>{formatarHora(cn.cancelado_at)}</strong></span>
                    {(cn.checkin_lat && cn.checkin_lng) && (
                      <a
                        href={`https://www.google.com/maps?q=${cn.checkin_lat},${cn.checkin_lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rel-link"
                        title="Ver localização do check-in cancelado"
                      >
                        📍
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

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
          {onEditarAgendamento && (
            <button className="rel-btn rel-btn--pdf" onClick={onEditarAgendamento}>
              ✏️ Editar agendamento
            </button>
          )}
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
