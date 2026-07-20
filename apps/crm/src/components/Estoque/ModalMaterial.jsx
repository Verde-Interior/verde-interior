// src/components/Estoque/ModalMaterial.jsx
// Cadastro / edição de material (Etapa 2 do Estoque)
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast/Toast';
import './ModalMaterial.css';

const CATEGORIAS = [
  { id: 'vaso',       label: 'Vaso' },
  { id: 'planta',     label: 'Planta' },
  { id: 'cobertura',  label: 'Cobertura' },
  { id: 'substrato',  label: 'Substrato' },
  { id: 'adubo',      label: 'Adubo' },
  { id: 'ferramenta', label: 'Ferramenta' },
  { id: 'outro',      label: 'Outro' },
];

const UNIDADES = [
  { id: 'un',     label: 'Unidade (un)' },
  { id: 'kg',     label: 'Quilograma (kg)' },
  { id: 'L',      label: 'Litro (L)' },
  { id: 'm',      label: 'Metro (m)' },
  { id: 'saco',   label: 'Saco (sc)' },
  { id: 'frasco', label: 'Frasco (fr)' },
  { id: 'rolo',   label: 'Rolo (rl)' },
];

export default function ModalMaterial({ material = null, onFechar, onSalvo }) {
  const toast = useToast();
  const editando = !!material?.id;

  const [form, setForm] = useState({
    nome:            material?.nome ?? '',
    categoria:       material?.categoria ?? '',
    unidade:         material?.unidade ?? '',
    sku:             material?.sku ?? '',
    descricao:       material?.descricao ?? '',
    foto_url:        material?.foto_url ?? '',
    estoque_minimo:  material?.estoque_minimo ?? 0,
    controla_posse:  material?.controla_posse ?? false,
    ativo:           material?.ativo ?? true,
  });

  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  // ESC fecha
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !salvando) onFechar?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar, salvando]);

  function atualiza(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: null }));
  }

  function validar() {
    const e = {};
    if (!form.nome.trim())    e.nome      = 'Nome é obrigatório';
    if (!form.categoria)      e.categoria = 'Categoria é obrigatória';
    if (!form.unidade)        e.unidade   = 'Unidade é obrigatória';
    const min = Number(form.estoque_minimo);
    if (Number.isNaN(min) || min < 0) e.estoque_minimo = 'Valor inválido';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function salvar() {
    if (!validar()) return;
    setSalvando(true);
    const payload = {
      nome:            form.nome.trim(),
      categoria:       form.categoria,
      unidade:         form.unidade,
      sku:             form.sku.trim() || null,
      descricao:       form.descricao.trim() || null,
      foto_url:        form.foto_url.trim() || null,
      estoque_minimo:  Number(form.estoque_minimo) || 0,
      controla_posse:  !!form.controla_posse,
      ativo:           !!form.ativo,
    };

    let error;
    if (editando) {
      ({ error } = await supabase.from('materiais').update(payload).eq('id', material.id));
    } else {
      ({ error } = await supabase.from('materiais').insert(payload));
    }
    setSalvando(false);

    if (error) {
      toast.erro('Erro ao salvar: ' + error.message);
      return;
    }
    toast.ok(editando ? 'Material atualizado' : 'Material cadastrado');
    onSalvo?.();
    onFechar?.();
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !salvando) onFechar?.(); }}>
      <div className="modal mm">
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">
              {editando ? 'Editar material' : 'Novo material'}
            </h2>
            <p className="modal__subinfo">
              {editando ? material.nome : 'Cadastre um material ou ferramenta no estoque'}
            </p>
          </div>
          <button className="modal__fechar" onClick={onFechar} aria-label="Fechar">✕</button>
        </header>

        <div className="modal__body">
          <div className="mm__campo">
            <label className="modal__label">
              Nome <span className="modal__obrigatorio">*</span>
            </label>
            <input
              className="modal__input"
              value={form.nome}
              onChange={(e) => atualiza('nome', e.target.value)}
              placeholder="Ex.: Vaso cerâmica 30cm"
              autoFocus
            />
            {erros.nome && <p className="modal__erro-msg">{erros.nome}</p>}
          </div>

          <div className="mm__grid">
            <div className="mm__campo">
              <label className="modal__label">
                Categoria <span className="modal__obrigatorio">*</span>
              </label>
              <select
                className="modal__select"
                value={form.categoria}
                onChange={(e) => atualiza('categoria', e.target.value)}
              >
                <option value="">Selecione...</option>
                {CATEGORIAS.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              {erros.categoria && <p className="modal__erro-msg">{erros.categoria}</p>}
            </div>

            <div className="mm__campo">
              <label className="modal__label">
                Unidade <span className="modal__obrigatorio">*</span>
              </label>
              <select
                className="modal__select"
                value={form.unidade}
                onChange={(e) => atualiza('unidade', e.target.value)}
              >
                <option value="">Selecione...</option>
                {UNIDADES.map(u => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
              {erros.unidade && <p className="modal__erro-msg">{erros.unidade}</p>}
            </div>
          </div>

          <div className="mm__grid">
            <div className="mm__campo">
              <label className="modal__label">SKU / Código</label>
              <input
                className="modal__input"
                value={form.sku}
                onChange={(e) => atualiza('sku', e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="mm__campo">
              <label className="modal__label">Estoque mínimo</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="modal__input"
                value={form.estoque_minimo}
                onChange={(e) => atualiza('estoque_minimo', e.target.value)}
              />
              {erros.estoque_minimo && <p className="modal__erro-msg">{erros.estoque_minimo}</p>}
            </div>
          </div>

          <div className="mm__campo">
            <label className="modal__label">Descrição</label>
            <textarea
              className="modal__textarea"
              value={form.descricao}
              onChange={(e) => atualiza('descricao', e.target.value)}
              placeholder="Detalhes adicionais (opcional)"
              rows={3}
            />
          </div>

          <div className="mm__campo">
            <label className="modal__label">URL da foto</label>
            <input
              className="modal__input"
              value={form.foto_url}
              onChange={(e) => atualiza('foto_url', e.target.value)}
              placeholder="https://... (opcional)"
            />
            {form.foto_url && (
              <img
                className="mm__preview"
                src={form.foto_url}
                alt="Preview"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
              />
            )}
          </div>

          <div className="mm__flags">
            <label className="mm__flag">
              <input
                type="checkbox"
                checked={form.controla_posse}
                onChange={(e) => atualiza('controla_posse', e.target.checked)}
              />
              <div>
                <div className="mm__flag-titulo">Controla posse por colaborador</div>
                <div className="mm__flag-hint">Ative para ferramentas atribuídas a pessoas</div>
              </div>
            </label>

            <label className="mm__flag">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => atualiza('ativo', e.target.checked)}
              />
              <div>
                <div className="mm__flag-titulo">Ativo</div>
                <div className="mm__flag-hint">Desmarcar oculta o item das listagens</div>
              </div>
            </label>
          </div>
        </div>

        <footer className="modal__footer">
          <button
            className="modal__btn modal__btn--cancelar"
            onClick={onFechar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            className="modal__btn modal__btn--salvar"
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? 'Salvando...' : (editando ? 'Salvar alterações' : 'Cadastrar material')}
          </button>
        </footer>
      </div>
    </div>
  );
}
