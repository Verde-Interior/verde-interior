import { state, save, dbAddJust } from './store.js';
import { supabase } from './supabase.js';
import { toast, esc } from './utils.js';
import { renderAttachList } from './upload.js';

export function renderJusts() {
  const mine = state.JUSTS.filter(j => j.user === state.cu);
  const sm   = { aprovado: 'rb-ap', pendente: 'rb-pe', recusado: 'rb-rc' };

  if (!mine.length) {
    document.getElementById('mjusts').innerHTML = '<div class="card"><div class="empty"><i class="fa-regular fa-file"></i>Nenhuma justificativa enviada</div></div>';
    return;
  }

  document.getElementById('mjusts').innerHTML = '<div class="rl">' + mine.map(j => {
    const files  = j.files || [];
    const badge  = files.length
      ? `<span class="jf-badge"><i class="fa-solid fa-paperclip" style="font-size:10px"></i> ${files.length} anexo${files.length > 1 ? 's' : ''}</span>`
      : '';
    const thumbs = files.length
      ? `<div class="jf-row">${files.map(f => {
          if (f.type === 'img' && f.preview) return `<img src="${f.preview}" class="ft-img" alt="">`;
          if (f.type === 'img' && f.url)     return `<img src="${f.url}" class="ft-img" alt="">`;
          if (f.type === 'pdf') return `<div class="ft-pdf">PDF</div>`;
          return `<div class="ft-doc">DOC</div>`;
        }).join('')}</div>`
      : '';
    return `<div class="ri" style="flex-direction:column;align-items:flex-start;gap:7px"><div style="display:flex;align-items:center;justify-content:space-between;width:100%"><div><div class="ri-name">${esc(j.type)} — ${esc(j.date)}</div><div class="ri-sub">${esc(j.desc)}</div></div><span class="rb ${sm[j.status]}">${esc(j.status)}</span></div>${badge}${thumbs}</div>`;
  }).join('') + '</div>';
}

export function sendJust() {
  const d    = document.getElementById('jdate').value;
  const t    = document.getElementById('jtype').value;
  const desc = document.getElementById('jdesc').value.trim();
  if (!d || !desc) { toast('Preencha data e descrição', false); return; }
  const pendingFiles = [...state.pendingFiles];
  const just = { date: d, type: t, desc, status: 'pendente', files: pendingFiles };
  (async () => {
    const dbRec = await dbAddJust(state.cu, just);
    if (dbRec) {
      just._id = dbRec.id;
      // Upload anexos para Supabase Storage
      const uploadedFiles = [];
      for (const f of pendingFiles) {
        if (!f._file) continue;
        const path = `${dbRec.id}/${Date.now()}-${f.name}`;
        const { error } = await supabase.storage.from('justifications').upload(path, f._file);
        if (error) { console.error('upload file:', error.message); continue; }
        const { data: urlData } = supabase.storage.from('justifications').getPublicUrl(path);
        uploadedFiles.push({ name: f.name, type: f.type, size: f.size, preview: f.preview, url: urlData?.publicUrl || null });
      }
      if (uploadedFiles.length) {
        just.files = uploadedFiles;
        // Salvar lista de caminhos no banco
        const paths = uploadedFiles.map(uf => uf.url || uf.name);
        await supabase.from('justifications').update({ files: paths }).eq('id', dbRec.id);
      }
    }
    state.JUSTS.push({ ...just, user: state.cu });
    document.getElementById('jdate').value = '';
    document.getElementById('jdesc').value = '';
    state.pendingFiles = [];
    renderAttachList();
    save();
    renderJusts();
    toast('✓ Justificativa enviada');
  })();
}
