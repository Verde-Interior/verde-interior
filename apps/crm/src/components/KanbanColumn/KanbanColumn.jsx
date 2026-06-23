// src/components/KanbanColumn/KanbanColumn.jsx
import { useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import LeadCard from '../LeadCard/LeadCard';
import './KanbanColumn.css';

export default function KanbanColumn({ estagio, leadsFiltrados }) {
  const { leads, moverLead, dragLeadId } = useCRM();
  const [isDragOver, setIsDragOver] = useState(false);

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
    if (leadId && leadId !== dragLeadId?.estagioId) {
      moverLead(leadId, estagio.id);
    }
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
          colLeads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
        )}
      </div>
    </section>
  );
}
