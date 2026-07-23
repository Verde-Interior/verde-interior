// src/components/EscalaCampo/ModalRelatorioVisita.jsx
// Modal read-only que mostra o relatório de uma visita (em_execução ou concluída).
// Botão "Exportar PDF" abre uma nova aba com layout preparado pra window.print()
// — o usuário escolhe "Salvar como PDF" no diálogo de impressão do browser.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

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
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!visita?.id) return;
    (async () => {
      setLoading(true);
      setErro(null);
      try {
        const { data: rels, error: e1 } = await supabase
          .from('relatorios')
          .select('*')
          .eq('agendamento_id', visita.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (e1) throw e1;
        const rel = rels?.[0] ?? null;
        setRelatorio(rel);

        if (rel?.id) {
          const { data: fts, error: e2 } = await supabase
            .from('relatorios_fotos')
            .select('*')
            .eq('relatorio_id', rel.id)
            .order('created_at', { ascending: true });
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
    // Abre uma janela nova com o relatório formatado pra impressão.
    // O usuário salva como PDF pelo diálogo padrão do browser.
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { alert('Bloqueio de pop-up — libere no browser pra exportar.'); return; }
    w.document.write(gerarHtmlImprimivel({
      cliente: nomeCliente,
      bairro: visita.clientes?.bairro ?? '',
      data: dataFmt,
      status: statusLabel,
      checkin: formatarHora(relatorio.checkin_at),
      checkout: formatarHora(relatorio.checkout_at),
      relato: relatorio.relato ?? '',
      assinatura: relatorio.assinatura_responsavel_img ?? null,
      responsavel: relatorio.responsavel_nome ?? '',
      fotos,
    }));
    w.document.close();
    // Auto-abre o diálogo de impressão após um instante pra fotos carregarem
    setTimeout(() => { w.focus(); w.print(); }, 800);
  }

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
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

          {!loading && relatorio && (
            <>
              <div className="ec-relatorio__cabecalho">
                <span className={`ec-relatorio__badge ec-relatorio__badge--${visita.status}`}>{statusLabel}</span>
                <div className="ec-relatorio__horas">
                  <span>Check-in: <strong>{formatarHora(relatorio.checkin_at)}</strong></span>
                  <span>Check-out: <strong>{formatarHora(relatorio.checkout_at)}</strong></span>
                </div>
              </div>

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
                <h4>Relato da tarefa</h4>
                {relatorio.relato
                  ? <p className="ec-relatorio__relato">{relatorio.relato}</p>
                  : <p className="ec-hint">Ainda não preenchido.</p>}
              </section>

              <section className="ec-relatorio__sec">
                <h4>Assinatura do responsável</h4>
                {relatorio.assinatura_responsavel_img
                  ? <img src={relatorio.assinatura_responsavel_img} alt="Assinatura" className="ec-relatorio__assinatura" />
                  : <p className="ec-hint">Ainda não assinada.</p>}
                {relatorio.responsavel_nome && (
                  <p className="ec-hint">Responsável: <strong>{relatorio.responsavel_nome}</strong></p>
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

// ─── HTML da página de impressão (usado por exportarPDF) ──────────────────────
function gerarHtmlImprimivel({ cliente, bairro, data, status, checkin, checkout, relato, assinatura, responsavel, fotos }) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
  const fotosHtml = fotos.map(f => `
    <div class="foto">
      <img src="${esc(f.url)}" alt=""/>
      ${f.observacao ? `<p class="foto-obs">${esc(f.observacao)}</p>` : ''}
    </div>
  `).join('');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório - ${esc(cliente)} - ${esc(data)}</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111827; margin: 0; padding: 0; line-height: 1.5; }
  header { border-bottom: 3px solid #1a3d10; padding-bottom: 14px; margin-bottom: 20px; }
  h1 { font-size: 22px; color: #1a3d10; margin: 0 0 4px; }
  .sub { font-size: 13px; color: #6b7280; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; background: #d1fae5; color: #065f46; }
  .info { display: flex; gap: 24px; margin: 14px 0 22px; font-size: 13px; }
  .info div { flex: 1; }
  .info span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; margin-bottom: 2px; }
  section { margin-bottom: 22px; page-break-inside: avoid; }
  section h2 { font-size: 15px; color: #1a3d10; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 10px; }
  .relato { white-space: pre-wrap; font-size: 13px; }
  .fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .foto { border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
  .foto img { width: 100%; height: auto; display: block; }
  .foto-obs { padding: 6px 8px; font-size: 12px; color: #4b5563; background: #f9fafb; margin: 0; }
  .assinatura-wrap { max-width: 260px; }
  .assinatura-wrap img { max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 4px; }
  footer { position: fixed; bottom: 10mm; left: 14mm; right: 14mm; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 5px; }
  @media print {
    body { font-size: 11pt; }
  }
</style>
</head>
<body>
  <header>
    <h1>Relatório de visita técnica</h1>
    <div class="sub">Verde Interior — Paisagismo Corporativo</div>
  </header>

  <div class="info">
    <div><span>Cliente</span>${esc(cliente)}${bairro ? ` · ${esc(bairro)}` : ''}</div>
    <div><span>Data</span>${esc(data)}</div>
    <div><span>Status</span><span class="badge">${esc(status)}</span></div>
  </div>

  <div class="info">
    <div><span>Check-in</span>${esc(checkin)}</div>
    <div><span>Check-out</span>${esc(checkout)}</div>
    ${responsavel ? `<div><span>Responsável</span>${esc(responsavel)}</div>` : '<div></div>'}
  </div>

  ${relato ? `<section><h2>Relato da tarefa</h2><p class="relato">${esc(relato)}</p></section>` : ''}

  ${fotos.length ? `<section><h2>Fotos (${fotos.length})</h2><div class="fotos">${fotosHtml}</div></section>` : ''}

  ${assinatura ? `<section><h2>Assinatura do responsável</h2><div class="assinatura-wrap"><img src="${esc(assinatura)}" alt="Assinatura"/></div></section>` : ''}

  <footer>Verde Interior — Relatório gerado em ${esc(new Date().toLocaleString('pt-BR'))}</footer>
</body>
</html>`;
}
