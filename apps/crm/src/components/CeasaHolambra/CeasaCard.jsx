// src/components/CeasaHolambra/CeasaCard.jsx
import { useState } from 'react';
import ModalConfirmar from '../ModalConfirmar/ModalConfirmar';
import { useToast } from '../Toast/Toast';
import { supabase } from '../../lib/supabase';
import './CeasaCard.css';

const COR_TIPO = {
  atacadista:  '#8B5CF6',
  varejista:   '#3B82F6',
  floricultura:'#10B981',
  outros:      '#6B7280',
};

function telLimpo(tel) { return tel?.replace(/\D/g, '') ?? ''; }

export default function CeasaCard({ prospect, dragId, setDragId, onEditar, onAtualizar }) {
  const toast = useToast();
  const [confirmar, setConfirmar] = useState(null);
  const isDragging = dragId === prospect.id;

  function handleDragStart(e) {
    setDragId(prospect.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('ceasaId', prospect.id);
  }

  function handleDragEnd() { setDragId(null); }

  function handleExcluir(e) {
    e.stopPropagation();
    setConfirmar({
      titulo: `Excluir "${prospect.nome_loja}"?`,
      mensagem: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      variante: 'danger',
      onConfirmar: async () => {
        setConfirmar(null);
        const { error } = await supabase.from('ceasa_prospects').delete().eq('id', prospect.id);
        if (error) toast.erro('Erro ao excluir');
        else { toast.ok(`${prospect.nome_loja} excluída`); onAtualizar(); }
      },
    });
  }

  const cor = COR_TIPO[prospect.tipo] ?? '#6B7280';
  const wppUrl = `https://wa.me/55${telLimpo(prospect.whatsapp || prospect.telefone)}`;
  const telUrl = `tel:${telLimpo(prospect.telefone)}`;

  return (
    <article
      className={`lead-card ${isDragging ? 'lead-card--dragging' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onEditar(prospect)}
    >
      {/* Header */}
      <header className="lead-card__header">
        <span className="lead-card__empresa">{prospect.nome_loja}</span>
      </header>

      {/* Responsável */}
      {prospect.responsavel && (
        <p className="lead-card__contato">{prospect.responsavel}</p>
      )}

      {/* Badge tipo */}
      <div className="lead-card__badges">
        <span className="lead-card__badge" style={{ '--badge-cor': cor }}>
          {prospect.tipo?.charAt(0).toUpperCase() + prospect.tipo?.slice(1)}
        </span>
        {prospect.produtos_interesse && (
          <span className="lead-card__badge" style={{ '--badge-cor': '#14B8A6' }}>
            🌿 {prospect.produtos_interesse}
          </span>
        )}
      </div>

      {/* Footer */}
      <footer className="lead-card__footer">
        <span className="lead-card__bairro">
          {prospect.endereco ? `📍 ${prospect.endereco}` : ''}
        </span>
      </footer>

      {/* Ações */}
      {(prospect.whatsapp || prospect.telefone) && (
        <div className="lead-card__acoes">
          {(prospect.whatsapp || prospect.telefone) && (
            <a
              className="lead-card__whatsapp"
              href={wppUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              💬 WhatsApp
            </a>
          )}
          {prospect.telefone && (
            <a
              className="lead-card__ligar"
              href={telUrl}
              onClick={(e) => e.stopPropagation()}
            >
              📞 Ligar
            </a>
          )}
        </div>
      )}

      {/* Drag handle */}
      <div className="lead-card__drag-handle" title="Arraste para mover">⠿</div>

      {/* Excluir */}
      <button
        type="button"
        className="lead-card__excluir"
        onClick={handleExcluir}
        title="Excluir"
        aria-label="Excluir prospect"
      >
        🗑
      </button>

      {confirmar && (
        <ModalConfirmar
          titulo={confirmar.titulo}
          mensagem={confirmar.mensagem}
          confirmLabel={confirmar.confirmLabel}
          variante={confirmar.variante}
          onConfirmar={confirmar.onConfirmar}
          onCancelar={() => setConfirmar(null)}
        />
      )}
    </article>
  );
}
