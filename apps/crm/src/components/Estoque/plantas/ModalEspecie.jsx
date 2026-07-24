// src/components/Estoque/plantas/ModalEspecie.jsx
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/Toast';

export default function ModalEspecie({ especie = null, onFechar, onSalvo }) {
  const toast = useToast();
  const editando = !!especie?.id;
  const [form, setForm] = useState({
    nome:            especie?.nome ?? '',
    nome_cientifico: especie?.nome_cientifico ?? '',
    observacoes:     especie?.observacoes ?? '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); setErro(''); }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome obrigatório.'); return; }
    setSalvando(true);
    const payload = {
      nome:            form.nome.trim(),
      nome_cientifico: form.nome_cientifico.trim() || null,
      observacoes:     form.observacoes.trim() || null,
    };
    const q = editando
      ? supabase.from('estoque_especies').update(payload).eq('id', especie.id)
      : supabase.from('estoque_especies').insert(payload);
    const { error } = await q;
    setSalvando(false);
    if (error) { toast.erro('Erro: ' + error.message); return; }
    toast.ok(editando ? 'Espécie atualizada' : 'Espécie cadastrada');
    onSalvo?.();
    onFechar?.();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvando && onFechar()}>
      <div className="modal">
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">{editando ? 'Editar espécie' : 'Nova espécie'}</h2>
            <p className="modal__subinfo">{editando ? especie.nome : 'Adicionar ao catálogo'}</p>
          </div>
          <button className="modal__fechar" onClick={onFechar}>✕</button>
        </header>
        <div className="modal__body">
          <div className="mm__campo">
            <label className="modal__label">Nome <span className="modal__obrigatorio">*</span></label>
            <input className="modal__input" autoFocus value={form.nome}
              onChange={e => setF('nome', e.target.value)} placeholder="Ex: Zamioculca" />
            {erro && <p className="modal__erro-msg">{erro}</p>}
          </div>
          <div className="mm__campo">
            <label className="modal__label">Nome científico</label>
            <input className="modal__input" value={form.nome_cientifico}
              onChange={e => setF('nome_cientifico', e.target.value)} placeholder="Opcional" />
          </div>
          <div className="mm__campo">
            <label className="modal__label">Observações</label>
            <textarea className="modal__textarea" rows={3} value={form.observacoes}
              onChange={e => setF('observacoes', e.target.value)} placeholder="Cuidados, características..." />
          </div>
        </div>
        <footer className="modal__footer">
          <button className="modal__btn modal__btn--cancelar" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="modal__btn modal__btn--salvar" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
