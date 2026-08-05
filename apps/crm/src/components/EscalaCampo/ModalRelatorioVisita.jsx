// src/components/EscalaCampo/ModalRelatorioVisita.jsx
// Modal read-only que mostra o relatório de uma visita (em_execução ou concluída).
// Botão "Exportar PDF" abre uma nova aba com layout preparado pra window.print()
// — o usuário escolhe "Salvar como PDF" no diálogo de impressão do browser.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import { baixarPDF } from '../../lib/gerarRelatorio';

function formatarHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00');
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ModalRelatorioVisita({ visita, onFechar }) {
  const [relatorio, setRelatorio] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [cancelados, setCancelados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!visita?.id) return;
    (async () => {
      setLoading(true);
      setErro(null);
      try {
        const [{ data: rels, error: e1 }, { data: cans }] = await Promise.all([
          supabase.from('relatorios').select('*').eq('agendamento_id', visita.id).order('created_at', { ascending: false }).limit(1),
          supabase.from('checkin_cancelados').select('*').eq('agendamento_id', visita.id).order('cancelado_at', { ascending: true }),
        ]);
        if (e1) throw e1;
        const rel = rels?.[0] ?? null;
        setRelatorio(rel);
        setCancelados(cans ?? []);

        if (rel?.id) {
          const { data: fts, error: e2 } = await supabase
            .from('fotos_relatorio')
            .select('*')
            .eq('relatorio_id', rel.id)
            .order('ordem', { ascending: true });
          if (e2) throw e2;
          setFotos(fts ?? []);
        } else {
          setFotos([]);
        }
      } catch (e) {
        setErro(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [visita?.id]);

  const nomeCliente = visita.clientes?.nome_empresa ?? '—';
  const dataFmt = formatarData(visita.data_agendada);
  const statusLabel = { em_execucao: 'Em execução', concluido: 'Concluída' }[visita.status] ?? visita.status;

  function exportarPDF() {
    if (!relatorio) return;
    baixarPDF({
      cliente:      nomeCliente,
      bairro:       visita.clientes?.bairro ?? '',
      data:         dataFmt,
      status:       statusLabel,
      checkin:      formatarHora(relatorio.checkin_at),
      checkout:     formatarHora(relatorio.checkout_at),
      obsGestor:    visita.observacoes_gestor ?? '',
      relato:       relatorio.relato ?? '',
      obsRelatorio: relatorio.observacoes ?? '',
      assinatura:   relatorio.assinatura_responsavel_img ?? null,
      responsavel:  relatorio.assinatura_responsavel_nome ?? '',
      fotos,
    });
  }

  const overlayClose = useOverlayClose(onFechar);

  return (
    <div className="ec-overlay" {...overlayClose}>
      <div className="ec-modal ec-modal--relatorio" style={{ maxWidth: 720 }}>
        <header className="ec-modal__header">
          <div>
            <h3 className="ec-modal__titulo">Relatório da visita</h3>
            <p className="ec-modal__sub">{nomeCliente} · {dataFmt}</p>
          </div>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">
          {loading && <div className="ec-relatorio__loading">Carregando relatório...</div>}
          {erro && <div className="ec-alerta ec-alerta--erro">Erro ao carregar: {erro}</div>}
          {!loading && !erro && !relatorio && (
            <div className="ec-relatorio__vazio">
              <p>⏳ Este relatório ainda não foi iniciado pelo colaborador em campo.</p>
              <p className="ec-hint">Assim que ele fizer check-in no App Ponto, o relatório aparece aqui.</p>
            </div>
          )}

          {!loading && cancelados.length > 0 && (
            <section className="ec-relatorio__sec ec-relatorio__sec--cancelados">
              <h4>⚠ Tentativas de check-in canceladas <span className="ec-hint">({cancelados.length})</span></h4>
              <div className="ec-relatorio__cancelados-lista">
                {cancelados.map((c, i) => (
                  <div key={c.id} className="ec-relatorio__cancelado-item">
                    <span className="ec-relatorio__cancelado-num">{i + 1}</span>
                    <span>Check-in às <strong>{formatarHora(c.checkin_at)}</strong> — cancelado às <strong>{formatarHora(c.cancelado_at)}</strong></span>
                    {(c.checkin_lat && c.checkin_lng) && (
                      <a
                        href={`https://www.google.com/maps?q=${c.checkin_lat},${c.checkin_lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ec-relatorio__cancelado-mapa"
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

          {!loading && relatorio && (
            <>
              <div className="ec-relatorio__cabecalho">
                <span className={`ec-relatorio__badge ec-relatorio__badge--${visita.status}`}>{statusLabel}</span>
                <div className="ec-relatorio__horas">
                  <span>Check-in: <strong>{formatarHora(relatorio.checkin_at)}</strong></span>
                  <span>Check-out: <strong>{formatarHora(relatorio.checkout_at)}</strong></span>
                </div>
              </div>

              {visita.observacoes_gestor && (
                <section className="ec-relatorio__sec">
                  <h4>Observações do gestor</h4>
                  <p className="ec-relatorio__relato">{visita.observacoes_gestor}</p>
                </section>
              )}

              <section className="ec-relatorio__sec">
                <h4>Fotos <span className="ec-hint">({fotos.length})</span></h4>
                {fotos.length === 0 ? (
                  <p className="ec-hint">Nenhuma foto ainda.</p>
                ) : (
                  <div className="ec-relatorio__grid">
                    {fotos.map((f) => (
                      <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="ec-relatorio__foto">
                        <img src={f.url} alt="" loading="lazy" />
                        {f.observacao && <span className="ec-relatorio__foto-obs">{f.observacao}</span>}
                      </a>
                    ))}
                  </div>
                )}
              </section>

              <section className="ec-relatorio__sec">
                <h4>Relato da tarefa <span className="ec-hint">(escrito pelo colaborador)</span></h4>
                {relatorio.relato
                  ? <p className="ec-relatorio__relato">{relatorio.relato}</p>
                  : <p className="ec-hint">Ainda não preenchido.</p>}
              </section>

              {relatorio.observacoes && (
                <section className="ec-relatorio__sec">
                  <h4>Observações gerais</h4>
                  <p className="ec-relatorio__relato">{relatorio.observacoes}</p>
                </section>
              )}

              <section className="ec-relatorio__sec">
                <h4>Assinatura do responsável</h4>
                {relatorio.assinatura_responsavel_img
                  ? <img src={relatorio.assinatura_responsavel_img} alt="Assinatura" className="ec-relatorio__assinatura" />
                  : <p className="ec-hint">Ainda não assinada.</p>}
                {relatorio.assinatura_responsavel_nome && (
                  <p className="ec-hint">Responsável: <strong>{relatorio.assinatura_responsavel_nome}</strong></p>
                )}
              </section>
            </>
          )}
        </div>

        <footer className="ec-modal__footer">
          <span style={{ flex: 1 }} />
          {relatorio && (
            <button className="ec-btn ec-btn--pri" onClick={exportarPDF}>
              📄 Exportar PDF
            </button>
          )}
          <button className="ec-btn ec-btn--sec" onClick={onFechar}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}

