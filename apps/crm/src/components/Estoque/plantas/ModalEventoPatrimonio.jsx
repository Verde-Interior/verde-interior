// src/components/Estoque/plantas/ModalEventoPatrimonio.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/Toast';

const TIPOS = [
  { id: 'instalacao',       label: 'Instalar no cliente'  },
  { id: 'retirada',         label: 'Retirar do cliente'   },
  { id: 'troca_especie',    label: 'Trocar espécie'        },
  { id: 'manutencao_inicio',label: 'Iniciar manutenção'   },
  { id: 'manutencao_fim',   label: 'Concluir manutenção'  },
  { id: 'descarte',         label: 'Descartar planta'      },
  { id: 'observacao',       label: 'Registrar observação'  },
];

const TIPOS_MANUTENCAO = [
  { id: 'rega_especial',    label: 'Rega especial'       },
  { id: 'troca_substrato',  label: 'Troca de substrato'  },
  { id: 'poda',             label: 'Poda'                },
  { id: 'tratamento_pragas',label: 'Tratamento de pragas'},
  { id: 'outro',            label: 'Outro'               },
];

// Status resultante após cada tipo de evento
const STATUS_APOS = {
  instalacao:        'em_cliente',
  retirada:          'disponivel',
  troca_especie:     null,          // mantém atual
  manutencao_inicio: 'em_manutencao',
  manutencao_fim:    'disponivel',
  descarte:          'descartado',
  observacao:        null,          // mantém atual
};

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
      if (t.id === 'manutencao_inicio' && s === 'em_manutencao') return false;
      if (t.id === 'manutencao_fim'    && s !== 'em_manutencao') return false;
      return true;
    });
  }

  async function salvar() {
    if (!tipo) { toast.erro('Selecione o tipo de evento.'); return; }
    if (tipo === 'instalacao' && !form.cliente_id) { toast.erro('Selecione o cliente.'); return; }
    if (tipo === 'troca_especie' && !form.especie_nova_id) { toast.erro('Selecione a nova espécie.'); return; }
    if (tipo === 'manutencao_inicio' && !form.tipo_manutencao) { toast.erro('Selecione o tipo de manutenção.'); return; }

    setSalvando(true);

    const evento = {
      patrimonio_id:      patrimonio.id,
      tipo,
      cliente_id:         form.cliente_id || null,
      especie_anterior_id: tipo === 'troca_especie' ? patrimonio.especie_id : null,
      especie_nova_id:    tipo === 'troca_especie' ? form.especie_nova_id : null,
      observacoes:        form.obs.trim() || null,
      dados_extra:        tipo === 'manutencao_inicio' ? {
        tipo_manutencao: form.tipo_manutencao,
        previsao:        form.previsao || null,
      } : {},
    };

    const { error: eEv } = await supabase.from('estoque_eventos').insert(evento);
    if (eEv) { toast.erro('Erro: ' + eEv.message); setSalvando(false); return; }

    // Atualiza status e espécie do patrimônio
    const patch = {};
    const novoStatus = STATUS_APOS[tipo];
    if (novoStatus) patch.status = novoStatus;
    if (tipo === 'instalacao') patch.cliente_id = form.cliente_id;
    if (tipo === 'retirada')   patch.cliente_id = null;
    if (tipo === 'troca_especie') patch.especie_id = form.especie_nova_id;

    if (Object.keys(patch).length) {
      const { error: ePat } = await supabase.from('estoque_patrimonios').update(patch).eq('id', patrimonio.id);
      if (ePat) { toast.erro('Evento salvo mas erro ao atualizar status: ' + ePat.message); }
    }

    // Cria manutenção aberta se aplicável
    if (tipo === 'manutencao_inicio') {
      await supabase.from('estoque_manutencoes').insert({
        patrimonio_id:             patrimonio.id,
        tipo:                      form.tipo_manutencao,
        motivo:                    form.obs.trim() || null,
        prevista_conclusao:        form.previsao || null,
        status:                    'aberta',
      });
    }

    // Fecha manutenção aberta
    if (tipo === 'manutencao_fim' && patrimonio.manutencao_aberta_id) {
      await supabase.from('estoque_manutencoes')
        .update({ status: 'concluida', concluida_em: new Date().toISOString() })
        .eq('id', patrimonio.manutencao_aberta_id);
    }

    toast.ok('Evento registrado com sucesso');
    setSalvando(false);
    onSalvo?.();
  }

  const tipos = tiposDisponiveis();

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
              {tipos.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          {tipo === 'instalacao' && (
            <div className="mm__campo">
              <label className="modal__label">Cliente <span className="modal__obrigatorio">*</span></label>
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
            <>
              <div className="mm__campo">
                <label className="modal__label">Tipo de manutenção <span className="modal__obrigatorio">*</span></label>
                <select className="modal__select" value={form.tipo_manutencao} onChange={e => setF('tipo_manutencao', e.target.value)}>
                  <option value="">Selecione...</option>
                  {TIPOS_MANUTENCAO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="mm__campo">
                <label className="modal__label">Previsão de conclusão</label>
                <input type="date" className="modal__input" value={form.previsao} onChange={e => setF('previsao', e.target.value)} />
              </div>
            </>
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
