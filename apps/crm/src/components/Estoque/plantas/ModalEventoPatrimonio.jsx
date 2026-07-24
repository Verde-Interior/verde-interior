// src/components/Estoque/plantas/ModalEventoPatrimonio.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/Toast';

const TIPOS = [
  { id: 'entrada',          label: '📦 Chegou do fornecedor', grupo: 'ciclo' },
  { id: 'instalacao',       label: '📍 Instalar no cliente',  grupo: 'ciclo' },
  { id: 'retirada',         label: '↩ Retirar do cliente',    grupo: 'ciclo' },
  { id: 'evento_inicio',    label: '🎉 Enviar para evento',   grupo: 'ciclo' },
  { id: 'evento_fim',       label: '↩ Retorno de evento',     grupo: 'ciclo' },
  { id: 'manutencao_inicio',label: '🔧 Iniciar recuperação',  grupo: 'recup' },
  { id: 'manutencao_fim',   label: '✅ Concluir recuperação', grupo: 'recup' },
  { id: 'manejo_adubacao',   label: '🌿 Adubação',            grupo: 'manejo', obs: 'Adubação realizada' },
  { id: 'manejo_rega',       label: '💧 Rega especial',       grupo: 'manejo', obs: 'Rega especial' },
  { id: 'manejo_poda',       label: '✂ Poda',                 grupo: 'manejo', obs: 'Poda realizada' },
  { id: 'manejo_substrato',  label: '🪴 Troca de substrato',  grupo: 'manejo', obs: 'Substrato trocado' },
  { id: 'manejo_pragas',     label: '🐛 Tratamento de pragas',grupo: 'manejo', obs: 'Tratamento de pragas' },
  { id: 'observacao',       label: '💬 Observação livre',     grupo: 'outros' },
  { id: 'troca_especie',    label: '🔄 Trocar espécie',       grupo: 'outros' },
  { id: 'descarte',         label: '🗑 Descartar planta',     grupo: 'outros' },
];

// Status resultante após cada tipo de evento (null = mantém atual)
const STATUS_APOS = {
  entrada:           'disponivel',
  instalacao:        'em_cliente',
  retirada:          'disponivel',
  evento_inicio:     'em_evento',
  evento_fim:        'disponivel',
  troca_especie:     null,
  manutencao_inicio: 'em_manutencao',
  manutencao_fim:    'disponivel',
  descarte:          'descartado',
  observacao:        null,
  manejo_adubacao:   null,
  manejo_rega:       null,
  manejo_poda:       null,
  manejo_substrato:  null,
  manejo_pragas:     null,
};

// Mapeia o id da UI para o tipo real no banco
function tipoBanco(tipoUI) {
  if (tipoUI.startsWith('manejo_')) return 'observacao';
  return tipoUI;
}

export default function ModalEventoPatrimonio({ patrimonio, especies, onFechar, onSalvo }) {
  const toast = useToast();
  const [tipo,    setTipo]    = useState('');
  const [clientes, setClientes] = useState([]);
  const [form,    setForm]    = useState({
    cliente_id:     '',
    especie_nova_id: '',
    tipo_manutencao:'',
    previsao:       '',
    obs:            '',
  });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    supabase.from('clientes').select('id, nome_empresa').eq('ativo', true).order('nome_empresa')
      .then(({ data }) => setClientes(data ?? []));
  }, []);

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function tiposDisponiveis() {
    const s = patrimonio.status;
    return TIPOS.filter(t => {
      if (t.id === 'instalacao'        && s !== 'disponivel')    return false;
      if (t.id === 'retirada'          && s !== 'em_cliente')    return false;
      if (t.id === 'evento_inicio'     && s !== 'disponivel')    return false;
      if (t.id === 'evento_fim'        && s !== 'em_evento')     return false;
      if (t.id === 'manutencao_inicio' && s !== 'disponivel')    return false;
      if (t.id === 'manutencao_fim'    && s !== 'em_manutencao') return false;
      if (t.id === 'descarte'          && s === 'descartado')    return false;
      return true;
    });
  }

  function grupoOpcoes(grupo, label) {
    const opts = tiposDisponiveis().filter(t => t.grupo === grupo);
    if (!opts.length) return null;
    return <optgroup label={label}>{opts.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</optgroup>;
  }

  async function salvar() {
    if (!tipo) { toast.erro('Selecione o tipo de evento.'); return; }
    if (tipo === 'instalacao' && !form.cliente_id) { toast.erro('Selecione o cliente.'); return; }
    if (tipo === 'troca_especie' && !form.especie_nova_id) { toast.erro('Selecione a nova espécie.'); return; }

    setSalvando(true);

    const tipoUI = tipo;
    const tipoDB = tipoBanco(tipoUI);
    const meta = TIPOS.find(t => t.id === tipoUI);

    // Se é manejo, usa observação como texto default
    const obsUsuario = form.obs.trim();
    const observacoesFinal = tipoUI.startsWith('manejo_')
      ? (obsUsuario ? `${meta.obs}: ${obsUsuario}` : meta.obs)
      : (obsUsuario || null);

    const evento = {
      patrimonio_id:      patrimonio.id,
      tipo:               tipoDB,
      cliente_id:         form.cliente_id || null,
      especie_anterior_id: tipoUI === 'troca_especie' ? patrimonio.especie_id : null,
      especie_nova_id:    tipoUI === 'troca_especie' ? form.especie_nova_id : null,
      observacoes:        observacoesFinal,
      dados_extra:        tipoUI.startsWith('manejo_')
        ? { manejo: tipoUI.replace('manejo_', '') }
        : (tipoUI === 'manutencao_inicio' && form.previsao ? { previsao: form.previsao } : {}),
    };

    const { error: eEv } = await supabase.from('estoque_eventos').insert(evento);
    if (eEv) { toast.erro('Erro: ' + eEv.message); setSalvando(false); return; }

    // Atualiza status e espécie do patrimônio
    const patch = {};
    const novoStatus = STATUS_APOS[tipoUI];
    if (novoStatus) patch.status = novoStatus;
    if (tipoUI === 'instalacao' || tipoUI === 'evento_inicio') patch.cliente_id = form.cliente_id || null;
    if (tipoUI === 'retirada' || tipoUI === 'evento_fim')      patch.cliente_id = null;
    if (tipoUI === 'troca_especie') patch.especie_id = form.especie_nova_id;

    if (Object.keys(patch).length) {
      const { error: ePat } = await supabase.from('estoque_patrimonios').update(patch).eq('id', patrimonio.id);
      if (ePat) { toast.erro('Evento salvo mas erro ao atualizar status: ' + ePat.message); }
    }


    toast.ok('Evento registrado com sucesso');
    setSalvando(false);
    onSalvo?.();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvando && onFechar()}>
      <div className="modal">
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">Registrar evento</h2>
            <p className="modal__subinfo">{patrimonio.qr_codigo} · {patrimonio.especie_nome}</p>
          </div>
          <button className="modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="modal__body">
          <div className="mm__campo">
            <label className="modal__label">Tipo de evento <span className="modal__obrigatorio">*</span></label>
            <select className="modal__select" value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="">Selecione...</option>
              {grupoOpcoes('ciclo',  'Ciclo (fornecedor → cliente/evento)')}
              {grupoOpcoes('manejo', 'Manejo na Lapa')}
              {grupoOpcoes('recup',  'Recuperação')}
              {grupoOpcoes('outros', 'Outros')}
            </select>
          </div>

          {(tipo === 'instalacao' || tipo === 'evento_inicio') && (
            <div className="mm__campo">
              <label className="modal__label">
                Cliente {tipo === 'instalacao' && <span className="modal__obrigatorio">*</span>}
                {tipo === 'evento_inicio' && <span style={{ opacity: .6 }}> (opcional — onde é o evento)</span>}
              </label>
              <select className="modal__select" value={form.cliente_id} onChange={e => setF('cliente_id', e.target.value)}>
                <option value="">Selecione o cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_empresa}</option>)}
              </select>
            </div>
          )}

          {tipo === 'troca_especie' && (
            <div className="mm__campo">
              <label className="modal__label">Nova espécie <span className="modal__obrigatorio">*</span></label>
              <select className="modal__select" value={form.especie_nova_id} onChange={e => setF('especie_nova_id', e.target.value)}>
                <option value="">Selecione a nova espécie...</option>
                {especies.filter(e => e.id !== patrimonio.especie_id).map(e => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          )}

          {tipo === 'manutencao_inicio' && (
            <div className="mm__campo">
              <label className="modal__label">Previsão de conclusão</label>
              <input type="date" className="modal__input" value={form.previsao} onChange={e => setF('previsao', e.target.value)} />
            </div>
          )}

          {tipo === 'descarte' && (
            <div className="modal__alerta modal__alerta--perigo">
              ⚠ Esta ação marcará a planta como <strong>descartada</strong>. Não pode ser desfeita.
            </div>
          )}

          <div className="mm__campo">
            <label className="modal__label">Observações</label>
            <textarea
              className="modal__textarea"
              rows={3}
              placeholder={tipo === 'retirada' ? 'Motivo da retirada...' : 'Detalhes adicionais...'}
              value={form.obs}
              onChange={e => setF('obs', e.target.value)}
            />
          </div>
        </div>

        <footer className="modal__footer">
          <button className="modal__btn modal__btn--cancelar" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button
            className={`modal__btn ${tipo === 'descarte' ? 'modal__btn--perigo' : 'modal__btn--salvar'}`}
            onClick={salvar}
            disabled={salvando || !tipo}
          >
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
