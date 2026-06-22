import { state } from './store.js';
import { fmtSize, classify, toast } from './utils.js';

export function fileIcon(f) {
  if (f.type === 'pdf') return `<div class="attach-ico ai-pdf"><i class="fa-solid fa-file-pdf"></i></div>`;
  if (f.type === 'img') return f.preview
    ? `<img src="${f.preview}" class="attach-img-preview" alt="preview">`
    : `<div class="attach-ico ai-img"><i class="fa-solid fa-image"></i></div>`;
  return `<div class="attach-ico ai-doc"><i class="fa-solid fa-file-word"></i></div>`;
}

export function renderAttachList() {
  const list = document.getElementById('attach-list');
  if (!state.pendingFiles.length) { list.innerHTML = ''; return; }
  list.innerHTML = state.pendingFiles.map((f, i) =>
    `<div class="attach-item">${fileIcon(f)}<div class="attach-info"><div class="attach-name">${f.name}</div><div class="attach-size">${fmtSize(f.size)}</div></div><button class="del-att" onclick="removeFile(${i})" title="Remover"><i class="fa-solid fa-xmark"></i></button></div>`
  ).join('');
}

export function handleFiles(fileList) {
  const arr = Array.from(fileList);
  const rem = 5 - state.pendingFiles.length;
  if (rem <= 0) { toast('Máximo de 5 anexos por justificativa', false); return; }
  if (arr.length > rem) toast(`Apenas ${rem} arquivo(s) adicionado(s) — limite de 5`, false);
  arr.slice(0, rem).forEach(file => {
    const kind = classify(file);
    const obj = { name: file.name, size: file.size, type: kind, preview: null, _file: file };
    if (kind === 'img') {
      const r = new FileReader();
      r.onload = e => { obj.preview = e.target.result; renderAttachList(); };
      r.readAsDataURL(file);
    }
    state.pendingFiles.push(obj);
  });
  renderAttachList();
  document.getElementById('file-input').value = '';
}

export function removeFile(i) {
  state.pendingFiles.splice(i, 1);
  renderAttachList();
}

export function handleDrag(e, on) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.toggle('drag', on);
}

export function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag');
  handleFiles(e.dataTransfer.files);
}
