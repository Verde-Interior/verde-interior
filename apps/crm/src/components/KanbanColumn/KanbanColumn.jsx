// src/components/KanbanColumn/KanbanColumn.jsx
import { useState, useEffect } from 'react';
import { useCRM } from '../../context/CRMContext';
import { supabase } from '../../lib/supabase';
import LeadCard from '../LeadCard/LeadCard';
import './KanbanColumn.css';

const STATUS_ORC_LABEL = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado' };

function ModalAprovacaoOrcamento({ lead, onConfirmar, onPularEMover }) {
  const [orcamentos, setOrcamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('orcamentos')
        .select('id, nome, tipo_servico, status, atualizado_em')
        .eq('lead_id', lead.id)
        .in('status', ['enviado', 'rascunho'])
        .order('atualizado_em', { ascending: false });
      setOrcamentos(data ?? []);
      setCarregando(false);
    })();
  }, [lead.id]);

  return (
    <div className="kanban-modal-orc__overlay">
      <div className="kanban-modal-orc">
        <h3 className="kanban-modal-orc__titulo">Qual orçamento foi aprovado?</h3>
        <p className="kanban-modal-orc__sub">Lead: <strong>{lead.empresa}</strong></p>

        {carregando ? (
          <p className="kanban-modal-orc__vazio">Carregando orçamentos...</p>
        ) : orcamentos.length === 0 ? (
          <p className="kanban-modal-orc__vazio">Nenhum orçamento encontrado para este lead.</p>
        ) : (
          <div className="kanban-modal-orc__lista">
            {orcamentos.map(orc => (
              <label key={orc.id} className={`kanban-modal-orc__item ${selecionado === orc.id ? 'kanban-modal-orc__item--selecionado' : ''}`}>
                <input type="radio" name="orc" value={orc.id} checked={selecionado === orc.id} onChange={() => setSelecionado(orc.id)} />
                <div className="kanban-modal-orc__item-info">
                  <span className="kanban-modal-orc__item-nome">{orc.nome}</span>
                  <span className="kanban-modal-orc__item-status">{STATUS_ORC_LABEL[orc.status] ?? orc.status}</span>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="kanban-modal-orc__acoes">
          <button className="kanban-modal-orc__btn-pular" onClick={onPularEMover}>Mover sem vincular</button>
          <button className="kanban-modal-orc__btn-confirmar" disabled={!selecionado} onClick={() => onConfirmar(selecionado)}>
            Confirmar aprovação
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KanbanColumn({ estagio, leadsFiltrados, onNavegar }) {
  const { leads, moverLead, dragLeadId } = useCRM();
  const [isDragOver, setIsDragOver] = useState(false);
  const [modalAprovacao, setModalAprovacao] = useState(null); // { leadId }

  const base      = leadsFiltrados ?? leads;
  const colLeads  = base.filter((l) => l.estagioId === estagio.id);
  const valorTotal = colLeads.reduce((s, l) => s + (l.valorEstimado ?? 0), 0);

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0,
  }).format(valorTotal);

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  }

  function handleDragLeave(e) {
    // Só desativa se saiu da coluna de fato (não de um filho)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const leadId = e.dataTransfer.getData('leadId');
    if (!leadId) return;

    if (estagio.id === 'orcamento_aprovado') {
      // intercepta para perguntar qual orçamento foi aprovado
      setModalAprovacao({ leadId });
    } else {
      moverLead(leadId, estagio.id);
    }
  }

  async function confirmarAprovacao(orcamentoId) {
    const { leadId } = modalAprovacao;
    // marca o orçamento como aprovado
    await supabase.from('orcamentos').update({ status: 'aprovado' }).eq('id', orcamentoId);
    moverLead(leadId, 'orcamento_aprovado');
    setModalAprovacao(null);
  }

  function pularEMover() {
    moverLead(modalAprovacao.leadId, 'orcamento_aprovado');
    setModalAprovacao(null);
  }

  const isDraggingToThis = isDragOver && dragLeadId;

  return (
    <section
      className={[
        'kanban-column',
        isDraggingToThis ? 'kanban-column--drag-over' : '',
      ].join(' ')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="kanban-column__header">
        <div className="kanban-column__titulo-row">
          <span
            className="kanban-column__indicador"
            style={{ '--col-cor': estagio.cor }}
          />
          <h2 className="kanban-column__titulo">{estagio.label}</h2>
          <span className="kanban-column__contador">{colLeads.length}</span>
        </div>
        {colLeads.length > 0 && (
          <p className="kanban-column__total">{valorFormatado}</p>
        )}
      </header>

      <div className="kanban-column__cards">
        {isDraggingToThis && colLeads.length === 0 && (
          <div className="kanban-column__drop-placeholder">Solte aqui</div>
        )}
        {colLeads.length === 0 && !isDraggingToThis ? (
          <p className="kanban-column__vazio">Nenhum lead aqui.</p>
        ) : (
          colLeads.map((lead) => <LeadCard key={lead.id} lead={lead} onNavegar={onNavegar} />)
        )}
      </div>

      {modalAprovacao && (() => {
        const lead = leads.find(l => l.id === modalAprovacao.leadId);
        return lead ? (
          <ModalAprovacaoOrcamento
            lead={lead}
            onConfirmar={confirmarAprovacao}
            onPularEMover={pularEMover}
          />
        ) : null;
      })()}
    </section>
  );
}
