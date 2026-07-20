// src/components/AddLeadModal/AddLeadModal.jsx
import { useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import './AddLeadModal.css';

const EMPTY = {
  empresa: '', contato: '', cargo: '', telefone: '', email: '',
  bairro: '', endereco: '', tiposServico: ['locacao'], canalOrigem: 'WhatsApp',
  quantidadeVasos: '', valorEstimado: '', frequenciaVisita: 'Mensal',
  observacoes: '',
};

export default function AddLeadModal({ aberto, onFechar }) {
  const { adicionarLead, leads, TIPOS_SERVICO, CANAIS_ORIGEM, FREQUENCIAS_VISITA } = useCRM();
  const [form, setForm]               = useState(EMPTY);
  const [erros, setErros]             = useState({});
  const [avisoEmpresa, setAviso]      = useState(null); // duplicata

  if (!aberto) return null;

  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: undefined }));
  };

  function validar() {
    const e = {};
    if (!form.empresa.trim())  e.empresa   = 'Obrigatório';
    if (!form.contato.trim())  e.contato   = 'Obrigatório';
    if (!form.telefone.trim()) e.telefone  = 'Obrigatório';
    if (!form.bairro.trim())   e.bairro    = 'Obrigatório';
    if (!form.tiposServico || form.tiposServico.length === 0) e.tiposServico = 'Selecione ao menos um';
    if (!form.canalOrigem)     e.canalOrigem = 'Obrigatório';
    return e;
  }

  function salvar() {
    const isRecorrente = (form.tiposServico ?? []).some(
      (t) => TIPOS_SERVICO[t]?.faturamento === 'recorrente'
    );
    adicionarLead({
      ...form,
      quantidadeVasos:  form.quantidadeVasos  ? Number(form.quantidadeVasos)  : undefined,
      valorEstimado:    form.valorEstimado    ? Number(form.valorEstimado)    : undefined,
      frequenciaVisita: isRecorrente ? form.frequenciaVisita : null,
      responsavel:  'Ana Carvalho',
      dataEntrada:  new Date().toISOString().split('T')[0],
      ultimoContato: new Date().toISOString().split('T')[0],
      proximoFollowUp: null,
    });
    setForm(EMPTY);
    setErros({});
    setAviso(null);
    onFechar();
  }

  function toggleTipoServico(key) {
    setForm((f) => {
      const atuais = f.tiposServico ?? [];
      const jaTem = atuais.includes(key);
      const novos = jaTem ? atuais.filter((t) => t !== key) : [...atuais, key];
      // Se tirou o único tipo "manutenção", volta frequência para Mensal
      const aindaTemManut = novos.includes('manutencao');
      const freq = f.frequenciaVisita === 'Pontual' && !aindaTemManut ? 'Mensal' : f.frequenciaVisita;
      return { ...f, tiposServico: novos, frequenciaVisita: freq };
    });
    setErros((e) => ({ ...e, tiposServico: undefined }));
  }

  function handleSalvar() {
    const e = validar();
    if (Object.keys(e).length) { setErros(e); return; }

    // Verificar duplicata
    const dup = leads.find(
      (l) => l.empresa.toLowerCase().trim() === form.empresa.toLowerCase().trim()
    );
    if (dup && !avisoEmpresa) {
      setAviso(dup);
      return;
    }

    salvar();
  }

  function handleOverlay(e) {
    if (e.target === e.currentTarget) { setAviso(null); onFechar(); }
  }

  const tiposSel            = form.tiposServico ?? [];
  const isRecorrente        = tiposSel.some((t) => TIPOS_SERVICO[t]?.faturamento === 'recorrente');
  const isRecorrenteEfetivo = isRecorrente && form.frequenciaVisita !== 'Pontual';
  const freqsDisponiveis    = FREQUENCIAS_VISITA.filter(
    (f) => f !== 'Pontual' || tiposSel.includes('manutencao')
  );

  return (
    <div className="add-modal-overlay" onClick={handleOverlay}>
      <div className="add-modal">
        <header className="add-modal__header">
          <h2 className="add-modal__titulo">Novo Lead</h2>
          <button className="add-modal__fechar" onClick={() => { setAviso(null); onFechar(); }}>✕</button>
        </header>

        <div className="add-modal__body">

          {/* Aviso de duplicata */}
          {avisoEmpresa && (
            <div className="add-modal__aviso-dup">
              <strong>⚠ Empresa já cadastrada</strong>
              <p>"{avisoEmpresa.empresa}" já existe no pipeline (contato: {avisoEmpresa.contato}). Deseja cadastrar mesmo assim?</p>
              <div className="add-modal__aviso-acoes">
                <button className="add-modal__btn add-modal__btn--cancelar" onClick={() => setAviso(null)}>Cancelar</button>
                <button className="add-modal__btn add-modal__btn--salvar" onClick={salvar}>Cadastrar mesmo assim</button>
              </div>
            </div>
          )}

          {/* Empresa */}
          <div className="add-modal__grupo add-modal__grupo--wide">
            <label className="add-modal__label">Empresa <span className="add-modal__req">*</span></label>
            <input
              className={`add-modal__input ${erros.empresa ? 'add-modal__input--erro' : ''}`}
              placeholder="Nome da empresa"
              value={form.empresa}
              onChange={(e) => set('empresa', e.target.value)}
            />
            {erros.empresa && <span className="add-modal__erro">{erros.empresa}</span>}
          </div>

          {/* Contato + Cargo */}
          <div className="add-modal__grupo">
            <label className="add-modal__label">Contato <span className="add-modal__req">*</span></label>
            <input
              className={`add-modal__input ${erros.contato ? 'add-modal__input--erro' : ''}`}
              placeholder="Nome do contato"
              value={form.contato}
              onChange={(e) => set('contato', e.target.value)}
            />
            {erros.contato && <span className="add-modal__erro">{erros.contato}</span>}
          </div>

          <div className="add-modal__grupo">
            <label className="add-modal__label">Cargo</label>
            <input
              className="add-modal__input"
              placeholder="Ex: Gerente de Facilities"
              value={form.cargo}
              onChange={(e) => set('cargo', e.target.value)}
            />
          </div>

          {/* Telefone + Canal */}
          <div className="add-modal__grupo">
            <label className="add-modal__label">Telefone <span className="add-modal__req">*</span></label>
            <input
              className={`add-modal__input ${erros.telefone ? 'add-modal__input--erro' : ''}`}
              placeholder="(11) 9xxxx-xxxx"
              value={form.telefone}
              onChange={(e) => set('telefone', e.target.value)}
            />
            {erros.telefone && <span className="add-modal__erro">{erros.telefone}</span>}
          </div>

          <div className="add-modal__grupo">
            <label className="add-modal__label">Canal de Origem <span className="add-modal__req">*</span></label>
            <select
              className={`add-modal__select ${erros.canalOrigem ? 'add-modal__input--erro' : ''}`}
              value={form.canalOrigem}
              onChange={(e) => set('canalOrigem', e.target.value)}
            >
              {CANAIS_ORIGEM.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Email */}
          <div className="add-modal__grupo add-modal__grupo--wide">
            <label className="add-modal__label">E-mail</label>
            <input
              className="add-modal__input"
              type="email"
              placeholder="contato@empresa.com.br"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>

          {/* Bairro + Endereço */}
          <div className="add-modal__grupo">
            <label className="add-modal__label">Bairro <span className="add-modal__req">*</span></label>
            <input
              className={`add-modal__input ${erros.bairro ? 'add-modal__input--erro' : ''}`}
              placeholder="Ex: Faria Lima"
              value={form.bairro}
              onChange={(e) => set('bairro', e.target.value)}
            />
            {erros.bairro && <span className="add-modal__erro">{erros.bairro}</span>}
          </div>

          <div className="add-modal__grupo">
            <label className="add-modal__label">Endereço</label>
            <input
              className="add-modal__input"
              placeholder="Rua, número, andar/conjunto"
              value={form.endereco}
              onChange={(e) => set('endereco', e.target.value)}
            />
          </div>

          {/* Tipos de Serviço — multi-select (checkbox) */}
          <div className="add-modal__grupo add-modal__grupo--wide">
            <label className="add-modal__label">
              Tipos de Serviço <span className="add-modal__req">*</span>
              <span className="add-modal__label-hint"> (marque um ou mais)</span>
            </label>
            <div className="add-modal__servicos">
              {Object.entries(TIPOS_SERVICO).map(([key, svc]) => {
                const ativo = tiposSel.includes(key);
                return (
                  <label
                    key={key}
                    className={`add-modal__servico-opcao ${ativo ? 'add-modal__servico-opcao--ativo' : ''}`}
                    style={{ '--svc-cor': svc.cor }}
                  >
                    <input
                      type="checkbox" checked={ativo}
                      onChange={() => toggleTipoServico(key)}
                    />
                    {svc.label}
                  </label>
                );
              })}
            </div>
            {erros.tiposServico && <span className="add-modal__erro">{erros.tiposServico}</span>}
          </div>

          {/* Qtd vasos + Valor */}
          <div className="add-modal__grupo">
            <label className="add-modal__label">Qtd. de Vasos</label>
            <input
              className="add-modal__input"
              type="number" min={1}
              placeholder="Ex: 12"
              value={form.quantidadeVasos}
              onChange={(e) => set('quantidadeVasos', e.target.value)}
            />
          </div>

          <div className="add-modal__grupo">
            <label className="add-modal__label">
              Valor Estimado (R$)
              {isRecorrenteEfetivo && <span className="add-modal__label-hint"> /mês</span>}
            </label>
            <input
              className="add-modal__input"
              type="number" min={0}
              placeholder="Ex: 1200"
              value={form.valorEstimado}
              onChange={(e) => set('valorEstimado', e.target.value)}
            />
          </div>

          {/* Frequência (só recorrente) */}
          {isRecorrente && (
            <div className="add-modal__grupo add-modal__grupo--wide">
              <label className="add-modal__label">Frequência de Visita</label>
              <div className="add-modal__freq-opcoes">
                {freqsDisponiveis.map((f) => (
                  <label
                    key={f}
                    className={`add-modal__freq-opcao ${form.frequenciaVisita === f ? 'add-modal__freq-opcao--ativo' : ''}`}
                  >
                    <input type="radio" name="frequencia" value={f} checked={form.frequenciaVisita === f} onChange={() => set('frequenciaVisita', f)} />
                    {f}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="add-modal__grupo add-modal__grupo--wide">
            <label className="add-modal__label">Observações</label>
            <textarea
              className="add-modal__textarea"
              rows={3}
              placeholder="Contexto inicial, necessidades específicas..."
              value={form.observacoes}
              onChange={(e) => set('observacoes', e.target.value)}
            />
          </div>
        </div>

        <footer className="add-modal__footer">
          <button className="add-modal__btn add-modal__btn--cancelar" onClick={() => { setAviso(null); onFechar(); }}>
            Cancelar
          </button>
          <button className="add-modal__btn add-modal__btn--salvar" onClick={handleSalvar}>
            + Criar Lead
          </button>
        </footer>
      </div>
    </div>
  );
}
