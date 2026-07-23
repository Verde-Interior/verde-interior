// src/components/Estoque/itens/ModalItem.jsx
// Cadastro / edição de item simples (insumo, vaso, material)
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/Toast';

const UNIDADES = [
  { id: 'un',     label: 'Unidade (un)' },
  { id: 'kg',     label: 'Quilograma (kg)' },
  { id: 'L',      label: 'Litro (L)' },
  { id: 'm',      label: 'Metro (m)' },
  { id: 'saco',   label: 'Saco (sc)' },
  { id: 'frasco', label: 'Frasco (fr)' },
  { id: 'rolo',   label: 'Rolo (rl)' },
];

const CAT_LABEL = { insumo: 'Insumo', vaso: 'Vaso', material: 'Material' };

export default function ModalItem({ item = null, categoriaFixa, onFechar, onSalvo }) {
  const toast = useToast();
  const editando = !!item?.id;

  const [form, setForm] = useState({
    nome:           item?.nome ?? '',
    unidade:        item?.unidade ?? '',
    sku:            item?.sku ?? '',
    descricao:      item?.descricao ?? '',
    foto_url:       item?.foto_url ?? '',
    estoque_minimo: item?.estoque_minimo ?? 0,
    controla_posse: item?.controla_posse ?? false,
    ativo:          item?.ativo ?? true,
  });
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !salvando) onFechar?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar, salvando]);

  function atualiza(k, v) { setForm(f => ({ ...f, [k]: v })); setErros(e => ({ ...e, [k]: null })); }

  function validar() {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Nome obrigatório';
    if (!form.unidade)     e.unidade = 'Unidade obrigatória';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function salvar() {
    if (!validar()) return;
    setSalvando(true);
    const payload = {
      nome:           form.nome.trim(),
      categoria:      categoriaFixa,
      unidade:        form.unidade,
      sku:            form.sku.trim() || null,
      descricao:      form.descricao.trim() || null,
      foto_url:       form.foto_url.trim() || null,
      estoque_minimo: Number(form.estoque_minimo) || 0,
      controla_posse: !!form.controla_posse,
      ativo:          !!form.ativo,
    };

    const q = editando
      ? supabase.from('estoque_itens').update(payload).eq('id', item.id)
      : supabase.from('estoque_itens').insert(payload);

    const { error } = await q;
    setSalvando(false);
    if (error) { toast.erro('Erro: ' + error.message); return; }
    toast.ok(editando ? 'Item atualizado' : 'Item cadastrado');
    onSalvo?.();
    onFechar?.();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvando && onFechar?.()}>
      <div className="modal mm">
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">{editando ? 'Editar item' : `Novo ${CAT_LABEL[categoriaFixa]?.toLowerCase()}`}</h2>
            <p className="modal__subinfo">{editando ? item.nome : `Categoria: ${CAT_LABEL[categoriaFixa]}`}</p>
          </div>
          <button className="modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="modal__body">
          <div className="mm__campo">
            <label className="modal__label">Nome <span className="modal__obrigatorio">*</span></label>
            <input className="modal__input" value={form.nome} autoFocus
              onChange={e => atualiza('nome', e.target.value)} placeholder="Ex: Substrato universal" />
            {erros.nome && <p className="modal__erro-msg">{erros.nome}</p>}
          </div>

          <div className="mm__grid">
            <div className="mm__campo">
              <label className="modal__label">Unidade <span className="modal__obrigatorio">*</span></label>
              <select className="modal__select" value={form.unidade} onChange={e => atualiza('unidade', e.target.value)}>
                <option value="">Selecione...</option>
                {UNIDADES.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
              {erros.unidade && <p className="modal__erro-msg">{erros.unidade}</p>}
            </div>
            <div className="mm__campo">
              <label className="modal__label">Estoque mínimo</label>
              <input type="number" min="0" step="0.01" className="modal__input"
                value={form.estoque_minimo} onChange={e => atualiza('estoque_minimo', e.target.value)} />
            </div>
          </div>

          <div className="mm__campo">
            <label className="modal__label">SKU / Código</label>
            <input className="modal__input" value={form.sku}
              onChange={e => atualiza('sku', e.target.value)} placeholder="Opcional" />
          </div>

          <div className="mm__campo">
            <label className="modal__label">Descrição</label>
            <textarea className="modal__textarea" rows={2} value={form.descricao}
              onChange={e => atualiza('descricao', e.target.value)} placeholder="Detalhes adicionais (opcional)" />
          </div>

          <div className="mm__flags">
            <label className="mm__flag">
              <input type="checkbox" checked={form.controla_posse} onChange={e => atualiza('controla_posse', e.target.checked)} />
              <div>
                <div className="mm__flag-titulo">Controla posse por colaborador</div>
                <div className="mm__flag-hint">Ative para itens atribuídos a pessoas (ex: ferramentas)</div>
              </div>
            </label>
            <label className="mm__flag">
              <input type="checkbox" checked={form.ativo} onChange={e => atualiza('ativo', e.target.checked)} />
              <div>
                <div className="mm__flag-titulo">Ativo</div>
                <div className="mm__flag-hint">Desmarcar oculta das listagens</div>
              </div>
            </label>
          </div>
        </div>

        <footer className="modal__footer">
          <button className="modal__btn modal__btn--cancelar" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="modal__btn modal__btn--salvar" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
