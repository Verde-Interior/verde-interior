// Gera o HTML de impressão do relatório de visita técnica.
// Usado por ModalRelatorioVisita e DetalheRelatorio (Relatórios).
//
// fotos: [{ url, observacao }]

export function gerarHtmlImprimivel({
  cliente, bairro, data, status, checkin, checkout,
  obsGestor, relato, obsRelatorio, assinatura, responsavel, fotos,
}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

  const relatoLimpo      = (relato      || '').split('\n\n— Fotos —\n')[0].trim();
  const obsRelatorioLimpo = (obsRelatorio || '').split('\n\n— Fotos —\n')[0].trim();

  const fotosHtml = fotos.map((f) => `
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
  @page { size: A4; margin: 18mm 16mm 22mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: #111827;
    font-size: 12px;
    line-height: 1.5;
  }

  /* ── Cabeçalho ── */
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 3px solid #1a3d10;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  header h1 { font-size: 18px; color: #1a3d10; margin-bottom: 2px; }
  .sub { font-size: 11px; color: #6b7280; }
  .logo-txt { font-size: 11px; color: #9ca3af; text-align: right; }

  /* ── Bloco de meta info ── */
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  .meta-cel {
    padding: 8px 12px;
    border-right: 1px solid #e5e7eb;
  }
  .meta-cel:last-child { border-right: none; }
  .meta-cel__lbl {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: #9ca3af;
    margin-bottom: 3px;
  }
  .meta-cel__val { font-size: 12px; font-weight: 600; color: #111827; }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
    background: #d1fae5;
    color: #065f46;
  }

  /* ── Seções ── */
  section {
    margin-bottom: 16px;
  }
  section h2 {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: #1a3d10;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
  .relato {
    font-size: 12px;
    white-space: pre-wrap;
    color: #374151;
    line-height: 1.6;
  }

  /* ── Fotos ── */
  .fotos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .foto {
    border: 1px solid #e5e7eb;
    border-radius: 5px;
    overflow: hidden;
    break-inside: avoid-page;
  }
  .foto img {
    width: 100%;
    height: 200px;
    object-fit: cover;
    display: block;
  }
  .foto-obs {
    padding: 5px 8px;
    font-size: 11px;
    color: #4b5563;
    background: #f9fafb;
  }

  /* ── Assinatura ── */
  .assinatura-wrap { max-width: 240px; }
  .assinatura-wrap img {
    width: 100%;
    height: auto;
    max-height: 120px;
    object-fit: contain;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
  }
  .assinatura-nome { font-size: 11px; color: #6b7280; margin-top: 4px; }

  /* ── Rodapé ── */
  .rodape {
    margin-top: 24px;
    border-top: 1px solid #e5e7eb;
    padding-top: 6px;
    font-size: 10px;
    color: #9ca3af;
    text-align: center;
  }

  @media print {
    .rodape { position: running(rodape); }
    @page { @bottom-center { content: element(rodape); } }
  }
</style>
</head>
<body>

  <header>
    <div>
      <h1>Relatório de visita técnica</h1>
      <div class="sub">${esc(cliente)}${bairro ? ` · ${esc(bairro)}` : ''} · ${esc(data)}</div>
    </div>
    <div class="logo-txt">Verde Interior<br>Paisagismo Corporativo</div>
  </header>

  <div class="meta-grid">
    <div class="meta-cel">
      <div class="meta-cel__lbl">Status</div>
      <div class="meta-cel__val"><span class="badge">${esc(status)}</span></div>
    </div>
    <div class="meta-cel">
      <div class="meta-cel__lbl">Check-in</div>
      <div class="meta-cel__val">${esc(checkin)}</div>
    </div>
    <div class="meta-cel">
      <div class="meta-cel__lbl">Check-out</div>
      <div class="meta-cel__val">${esc(checkout)}</div>
    </div>
    ${responsavel ? `
    <div class="meta-cel" style="grid-column:1/-1;border-top:1px solid #e5e7eb">
      <div class="meta-cel__lbl">Responsável</div>
      <div class="meta-cel__val">${esc(responsavel)}</div>
    </div>` : ''}
  </div>

  ${obsGestor ? `<section><h2>Observações do gestor</h2><p class="relato">${esc(obsGestor)}</p></section>` : ''}

  ${relatoLimpo ? `<section><h2>Relato da tarefa</h2><p class="relato">${esc(relatoLimpo)}</p></section>` : ''}

  ${obsRelatorioLimpo ? `<section><h2>Observações gerais</h2><p class="relato">${esc(obsRelatorioLimpo)}</p></section>` : ''}

  ${fotos.length ? `<section><h2>Fotos (${fotos.length})</h2><div class="fotos">${fotosHtml}</div></section>` : ''}

  ${assinatura ? `
  <section>
    <h2>Assinatura do responsável</h2>
    <div class="assinatura-wrap">
      <img src="${esc(assinatura)}" alt="Assinatura"/>
      ${responsavel ? `<div class="assinatura-nome">${esc(responsavel)}</div>` : ''}
    </div>
  </section>` : ''}

  <div class="rodape">Verde Interior — Relatório gerado em ${esc(new Date().toLocaleString('pt-BR'))}</div>

</body>
</html>`;
}

export async function baixarPDF(params) {
  const html2pdf = (await import('html2pdf.js')).default;

  const nomeArquivo = `Relatorio-${(params.cliente || 'Verde-Interior').replace(/[^\w\s-]/g, '').trim()}-${params.data || ''}.pdf`
    .replace(/\s+/g, '-');

  const html = gerarHtmlImprimivel(params);

  // Extrai CSS e body separadamente — html2canvas só consegue renderizar
  // elementos no documento principal, não dentro de iframes ou com innerHTML
  // de documento completo (o browser descarta <head>/<style> ao injetar em div)
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const cssText = Array.from(parsed.querySelectorAll('style')).map((s) => s.textContent).join('\n');

  const styleEl = document.createElement('style');
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:0;left:0;width:794px;min-height:100vh;background:#fff;z-index:99999;overflow:auto;';
  container.innerHTML = parsed.body.innerHTML;
  document.body.appendChild(container);

  // Aguarda todas as imagens (fotos do relatório) carregarem
  await new Promise((resolve) => {
    const imgs = container.querySelectorAll('img');
    if (!imgs.length) { resolve(); return; }
    let pending = imgs.length;
    const done = () => { if (--pending === 0) resolve(); };
    imgs.forEach((img) => {
      if (img.complete) done();
      else { img.onload = done; img.onerror = done; }
    });
    setTimeout(resolve, 8000);
  });

  try {
    await html2pdf().set({
      margin:      [18, 14, 18, 14],
      filename:    nomeArquivo,
      image:       { type: 'jpeg', quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 794 },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:   { mode: 'avoid-all' },
    }).from(container).save();
  } finally {
    document.head.removeChild(styleEl);
    document.body.removeChild(container);
  }
}
