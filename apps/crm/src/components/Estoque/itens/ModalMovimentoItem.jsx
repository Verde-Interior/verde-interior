// src/components/Estoque/itens/ModalMovimentoItem.jsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/Toast';

const TIPOS = [
  { id: 'entrada',       label: 'Entrada',       icone: '⬇', cor: '#16A34A' },
  { id: 'saida',         label: 'Saída',         icone: '⬆', cor: '#DC2626' },
  { id: 'ajuste',        label: 'Ajuste',        icone: '≡', cor: '#2563EB' },
  { id: 'perda',         label: 'Perda',         icone: '⚠', cor: '#B45309' },
  { id: 'transferencia', label: 'Transferência', icone: '⇄', cor: '#7C3AED' },
];

const UNIDADE_LABEL = { un:'un', kg:'kg', L:'L', m:'m', saco:'sc', frasco:'fr', rolo:'rl' };

export default function ModalMovimentoItem({ categoriaFixa, onFechar, onSalvo }) {
  const toast = useToast();
  const [itens,      setItens]      = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando,   setSalvando]   = useState(false);
  const [busca,      setBusca]      = useState('');
  const [erros,      setErros]      = useState({});
  const [form,       setForm]       = useState({
    item_id: '', tipo: 'entrada', quantidade: '',
    titular_id: '', titular_destino_id: '', motivo: '', observacao: '',
  });

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !salvando) onFechar?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar, salvando]);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const [{ data: its }, { data: emps }] = await Promise.all([
        supabase.from('estoque_itens').select('id, nome, unidade, controla_posse')
          .eq('ativo', true).eq('categoria', categoriaFixa).order('nome'),
        supabase.from('employees').select('id, name').order('name'),
      ]);
      setItens(its ?? []);
      setEmployees(emps ?? []);
      setCarregando(false);
    })();
  }, [categoriaFixa]);

  function atualiza(k, v) { setForm(f => ({ ...f, [k]: v })); setErros(e => ({ ...e, [k]: null })); }

  const itensFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return q ? itens.filter(i => i.nome.toLowerCase().includes(q)) : itens;
  }, [itens, busca]);

  const itemSel = useMemo(() => itens.find(i => i.id === form.item_id) ?? null, [itens, form.item_id]);
  const isTransf = form.tipo === 'transferencia';

  function validar() {
    const e = {};
    if (!form.item_id) e.item_id = 'Selecione o item';
    const qtd = Number(form.quantidade);
    if (!form.quantidade || Number.isNaN(qtd) || qtd <= 0) e.quantidade = 'Quantidade deve ser maior que zero';
    if (isTransf) {
      if (!form.titular_id)         e.titular_id = 'Origem obrigatória';
      if (!form.titular_destino_id) e.titular_destino_id = 'Destino obrigatório';
      if (form.titular_id && form.titular_destino_id && String(form.titular_id) === String(form.titular_destino_id))
        e.titular_destino_id = 'Destino deve ser diferente da origem';
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function salvar() {
    if (!validar()) return;
    setSalvando(true);

    let criadoPor = 'sistema';
    try {
      const { data: ud } = await supabase.auth.getUser();
      criadoPor = ud?.user?.email ?? 'sistema';
    } catch { /* mantém 'sistema' */ }

    const { error } = await supabase.from('estoque_itens_movs').insert({
      item_id:            form.item_id,
      tipo:               form.tipo,
      quantidade:         Number(form.quantidade),
      titular_id:         form.titular_id ? Number(form.titular_id) : null,
      titular_destino_id: isTransf && form.titular_destino_id ? Number(form.titular_destino_id) : null,
      motivo:             form.motivo.trim() || null,
      observacao:         form.observacao.trim() || null,
      criado_por:         criadoPor,
    });

    setSalvando(false);
    if (error) { toast.erro('Erro: ' + error.message); return; }
    toast.ok('Movimentação registrada');
    onSalvo?.();
    onFechar?.();
  }

  const tipoAtual = TIPOS.find(t => t.id === form.tipo);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvando && onFechar?.()}>
      <div className="modal mv">
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">Nova movimentação</h2>
            <p className="modal__subinfo">Entrada, saída, ajuste ou transferência</p>
          </div>
          <button className="modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="modal__body">
          {carregando ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
          ) : (
            <>
              <div className="mv__campo">
                <label className="modal__label">Tipo <span className="modal__obrigatorio">*</span></label>
                <div className="mv__tipos">
                  {TIPOS.map(t => (
                    <label key={t.id} className={`mv__tipo ${form.tipo === t.id ? 'mv__tipo--ativo' : ''}`} style={{ '--tipo-cor': t.cor }}>
                      <input type="radio" name="tipo" value={t.id} checked={form.tipo === t.id} onChange={() => atualiza('tipo', t.id)} />
                      <span className="mv__tipo-icone">{t.icone}</span>
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mv__campo">
                <label className="modal__label">Item <span className="modal__obrigatorio">*</span></label>
                <input className="modal__input" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
                <select className="modal__select mv__material-select"
                  size={Math.min(6, Math.max(3, itensFiltrados.length))}
                  value={form.item_id} onChange={e => atualiza('item_id', e.target.value)}
                >
                  {itensFiltrados.length === 0
                    ? <option disabled value="">Nenhum item encontrado</option>
                    : itensFiltrados.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.nome} · {UNIDADE_LABEL[i.unidade] ?? i.unidade}
                      </option>
                    ))}
                </select>
                {erros.item_id && <p className="modal__erro-msg">{erros.item_id}</p>}
              </div>

              <div className="mv__campo">
                <label className="modal__label">
                  Quantidade <span className="modal__obrigatorio">*</span>
                  {itemSel && <span className="mv__label-hint"> ({UNIDADE_LABEL[itemSel.unidade] ?? itemSel.unidade})</span>}
                </label>
                <input type="number" min="0" step="0.01" className="modal__input"
                  value={form.quantidade} onChange={e => atualiza('quantidade', e.target.value)} placeholder="0"
                  style={tipoAtual ? { borderLeft: `4px solid ${tipoAtual.cor}` } : undefined}
                />
                {erros.quantidade && <p className="modal__erro-msg">{erros.quantidade}</p>}
              </div>

              <div className="mv__campo">
                <label className="modal__label">
                  {isTransf ? 'Origem (colaborador)' : 'Colaborador titular'}
                  {isTransf ? <span className="modal__obrigatorio"> *</span> : <span className="mv__label-hint"> (opcional)</span>}
                </label>
                <select className="modal__select" value={form.titular_id} onChange={e => atualiza('titular_id', e.target.value)}>
                  <option value="">— sem titular —</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
                {erros.titular_id && <p className="modal__erro-msg">{erros.titular_id}</p>}
              </div>

              {isTransf && (
                <div className="mv__campo">
                  <label className="modal__label">Destino (colaborador) <span className="modal__obrigatorio">*</span></label>
                  <select className="modal__select" value={form.titular_destino_id} onChange={e => atualiza('titular_destino_id', e.target.value)}>
                    <option value="">Selecione...</option>
                    {employees.filter(emp => String(emp.id) !== String(form.titular_id))
                      .map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                  {erros.titular_destino_id && <p className="modal__erro-msg">{erros.titular_destino_id}</p>}
                </div>
              )}

              <div className="mv__campo">
                <label className="modal__label">Motivo <span className="mv__label-hint">(opcional)</span></label>
                <input className="modal__input" value={form.motivo}
                  onChange={e => atualiza('motivo', e.target.value)} placeholder="Ex.: compra fornecedor X..." />
              </div>

              <div className="mv__campo">
                <label className="modal__label">Observação <span className="mv__label-hint">(opcional)</span></label>
                <textarea className="modal__textarea" rows={2} value={form.observacao}
                  onChange={e => atualiza('observacao', e.target.value)} placeholder="Detalhes adicionais" />
              </div>
            </>
          )}
        </div>

        <footer className="modal__footer">
          <button className="modal__btn modal__btn--cancelar" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="modal__btn modal__btn--salvar" onClick={salvar} disabled={salvando || carregando}>
            {salvando ? 'Registrando...' : 'Registrar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
