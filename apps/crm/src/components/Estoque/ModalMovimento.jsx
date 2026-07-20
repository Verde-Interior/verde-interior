// src/components/Estoque/ModalMovimento.jsx
// Registrar movimentação de estoque (entrada, saída, ajuste, perda, transferência)
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast/Toast';
import './ModalMovimento.css';

const TIPOS = [
  { id: 'entrada',       label: 'Entrada',       icone: '⬇',  cor: '#16A34A' },
  { id: 'saida',         label: 'Saída',         icone: '⬆',  cor: '#DC2626' },
  { id: 'ajuste',        label: 'Ajuste',        icone: '≡',  cor: '#2563EB' },
  { id: 'perda',         label: 'Perda',         icone: '⚠',  cor: '#B45309' },
  { id: 'transferencia', label: 'Transferência', icone: '⇄',  cor: '#7C3AED' },
];

const UNIDADE_LABEL = {
  un: 'un', kg: 'kg', L: 'L', m: 'm', saco: 'sc', frasco: 'fr', rolo: 'rl',
};

export default function ModalMovimento({ movimento = null, onFechar, onSalvo }) {
  const toast = useToast();

  const [materiais, setMateriais]   = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando]     = useState(false);

  const [form, setForm] = useState({
    material_id:          movimento?.material_id ?? '',
    tipo:                 movimento?.tipo ?? 'entrada',
    quantidade:           movimento?.quantidade ?? '',
    titular_id:           movimento?.titular_id ?? '',
    titular_destino_id:   movimento?.titular_destino_id ?? '',
    motivo:               movimento?.motivo ?? '',
    observacao:           movimento?.observacao ?? '',
  });

  const [buscaMaterial, setBuscaMaterial] = useState('');
  const [erros, setErros] = useState({});

  // ESC fecha
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !salvando) onFechar?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar, salvando]);

  // Carrega listas
  useEffect(() => {
    (async () => {
      setCarregando(true);
      const [mats, emps] = await Promise.all([
        supabase
          .from('materiais')
          .select('id, nome, unidade, categoria, controla_posse')
          .eq('ativo', true)
          .order('nome'),
        supabase
          .from('employees')
          .select('id, name')
          .order('name'),
      ]);
      if (mats.error) toast.erro('Erro ao carregar materiais: ' + mats.error.message);
      if (emps.error) toast.erro('Erro ao carregar colaboradores: ' + emps.error.message);
      setMateriais(mats.data ?? []);
      setEmployees(emps.data ?? []);
      setCarregando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function atualiza(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: null }));
  }

  const materiaisFiltrados = useMemo(() => {
    const q = buscaMaterial.toLowerCase().trim();
    if (!q) return materiais;
    return materiais.filter(m => m.nome.toLowerCase().includes(q));
  }, [materiais, buscaMaterial]);

  const materialSel = useMemo(
    () => materiais.find(m => m.id === form.material_id) ?? null,
    [materiais, form.material_id]
  );

  const isTransferencia = form.tipo === 'transferencia';

  function validar() {
    const e = {};
    if (!form.material_id) e.material_id = 'Selecione o material';
    if (!form.tipo)        e.tipo        = 'Tipo obrigatório';
    const qtd = Number(form.quantidade);
    if (!form.quantidade || Number.isNaN(qtd) || qtd <= 0) {
      e.quantidade = 'Quantidade deve ser maior que zero';
    }
    if (isTransferencia) {
      if (!form.titular_id)         e.titular_id         = 'Origem obrigatória na transferência';
      if (!form.titular_destino_id) e.titular_destino_id = 'Destino obrigatório na transferência';
      if (form.titular_id && form.titular_destino_id &&
          String(form.titular_id) === String(form.titular_destino_id)) {
        e.titular_destino_id = 'Destino deve ser diferente da origem';
      }
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function salvar() {
    if (!validar()) return;
    setSalvando(true);

    // Descobre email do usuário logado
    let criadoPor = 'sistema';
    try {
      const { data: userData } = await supabase.auth.getUser();
      criadoPor = userData?.user?.email ?? 'sistema';
    } catch {
      // se der erro, mantém 'sistema'
    }

    const payload = {
      material_id:        form.material_id,
      tipo:               form.tipo,
      quantidade:         Number(form.quantidade),
      titular_id:         form.titular_id ? Number(form.titular_id) : null,
      titular_destino_id: isTransferencia && form.titular_destino_id
                            ? Number(form.titular_destino_id) : null,
      motivo:             form.motivo.trim() || null,
      observacao:         form.observacao.trim() || null,
      criado_por:         criadoPor,
    };

    const { error } = await supabase.from('estoque_movimentacoes').insert(payload);
    setSalvando(false);

    if (error) {
      toast.erro('Erro ao registrar: ' + error.message);
      return;
    }
    toast.ok('Movimentação registrada');
    onSalvo?.();
    onFechar?.();
  }

  const tipoAtual = TIPOS.find(t => t.id === form.tipo);
  const unidade = materialSel ? (UNIDADE_LABEL[materialSel.unidade] ?? materialSel.unidade) : '';

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !salvando) onFechar?.(); }}>
      <div className="modal mv">
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">Nova movimentação</h2>
            <p className="modal__subinfo">Registre entrada, saída, ajuste, perda ou transferência</p>
          </div>
          <button className="modal__fechar" onClick={onFechar} aria-label="Fechar">✕</button>
        </header>

        <div className="modal__body">
          {carregando ? (
            <div className="mv__loading">Carregando...</div>
          ) : (
            <>
              {/* Tipo (radios em pills) */}
              <div className="mv__campo">
                <label className="modal__label">Tipo <span className="modal__obrigatorio">*</span></label>
                <div className="mv__tipos">
                  {TIPOS.map(t => (
                    <label
                      key={t.id}
                      className={`mv__tipo ${form.tipo === t.id ? 'mv__tipo--ativo' : ''}`}
                      style={{ '--tipo-cor': t.cor }}
                    >
                      <input
                        type="radio"
                        name="tipo"
                        value={t.id}
                        checked={form.tipo === t.id}
                        onChange={() => atualiza('tipo', t.id)}
                      />
                      <span className="mv__tipo-icone">{t.icone}</span>
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Material */}
              <div className="mv__campo">
                <label className="modal__label">
                  Material <span className="modal__obrigatorio">*</span>
                </label>
                <input
                  className="modal__input"
                  placeholder="Buscar material..."
                  value={buscaMaterial}
                  onChange={(e) => setBuscaMaterial(e.target.value)}
                />
                <select
                  className="modal__select mv__material-select"
                  size={Math.min(6, Math.max(3, materiaisFiltrados.length))}
                  value={form.material_id}
                  onChange={(e) => atualiza('material_id', e.target.value)}
                >
                  {materiaisFiltrados.length === 0 && (
                    <option disabled value="">Nenhum material encontrado</option>
                  )}
                  {materiaisFiltrados.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nome} · {UNIDADE_LABEL[m.unidade] ?? m.unidade}
                    </option>
                  ))}
                </select>
                {erros.material_id && <p className="modal__erro-msg">{erros.material_id}</p>}
              </div>

              {/* Quantidade */}
              <div className="mv__campo">
                <label className="modal__label">
                  Quantidade <span className="modal__obrigatorio">*</span>
                  {unidade && <span className="mv__label-hint"> ({unidade})</span>}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="modal__input"
                  value={form.quantidade}
                  onChange={(e) => atualiza('quantidade', e.target.value)}
                  placeholder="0"
                  style={tipoAtual ? { borderLeft: `4px solid ${tipoAtual.cor}` } : undefined}
                />
                {erros.quantidade && <p className="modal__erro-msg">{erros.quantidade}</p>}
              </div>

              {/* Titular (origem) */}
              <div className="mv__campo">
                <label className="modal__label">
                  {isTransferencia ? 'Origem (colaborador)' : 'Colaborador (titular)'}
                  {isTransferencia && <span className="modal__obrigatorio"> *</span>}
                  {!isTransferencia && <span className="mv__label-hint"> (opcional)</span>}
                </label>
                <select
                  className="modal__select"
                  value={form.titular_id}
                  onChange={(e) => atualiza('titular_id', e.target.value)}
                >
                  <option value="">— sem titular —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
                {erros.titular_id && <p className="modal__erro-msg">{erros.titular_id}</p>}
              </div>

              {/* Titular destino (só transferência) */}
              {isTransferencia && (
                <div className="mv__campo">
                  <label className="modal__label">
                    Destino (colaborador) <span className="modal__obrigatorio">*</span>
                  </label>
                  <select
                    className="modal__select"
                    value={form.titular_destino_id}
                    onChange={(e) => atualiza('titular_destino_id', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {employees
                      .filter(emp => String(emp.id) !== String(form.titular_id))
                      .map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                  </select>
                  {erros.titular_destino_id && <p className="modal__erro-msg">{erros.titular_destino_id}</p>}
                </div>
              )}

              {/* Motivo */}
              <div className="mv__campo">
                <label className="modal__label">
                  Motivo <span className="mv__label-hint">(opcional)</span>
                </label>
                <input
                  className="modal__input"
                  value={form.motivo}
                  onChange={(e) => atualiza('motivo', e.target.value)}
                  placeholder="Ex.: compra fornecedor X, uso em obra Y..."
                />
              </div>

              {/* Observação */}
              <div className="mv__campo">
                <label className="modal__label">
                  Observação <span className="mv__label-hint">(opcional)</span>
                </label>
                <textarea
                  className="modal__textarea"
                  rows={3}
                  value={form.observacao}
                  onChange={(e) => atualiza('observacao', e.target.value)}
                  placeholder="Detalhes adicionais"
                />
              </div>
            </>
          )}
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
            disabled={salvando || carregando}
          >
            {salvando ? 'Registrando...' : 'Registrar movimentação'}
          </button>
        </footer>
      </div>
    </div>
  );
}
