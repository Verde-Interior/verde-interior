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
  hospital:    '#EF4444',
  clinica:     '#EC4899',
  restaurante: '#F59E0B',
  hotel:       '#06B6D4',
  escola:      '#6366F1',
  outros:      '#6B7280',
};

const ICONE_PREFERENCIA = { telefone: '📞', whatsapp: '💬', email: '✉️', presencial: '🤝' };

const DIAS_PARADO_ALERTA = 14;

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
  const telefones = prospect.telefones ?? [];
  const telWpp = telefones.find(t => t.whatsapp)?.numero ?? telefones[0]?.numero;
  const telPrimeiro = telefones[0]?.numero;
  const wppUrl = `https://wa.me/55${telLimpo(telWpp)}`;
  const telUrl = `tel:${telLimpo(telPrimeiro)}`;

  const hoje = new Date().toISOString().split('T')[0];
  const followUpHoje     = prospect.proximo_followup_em === hoje;
  const followUpAtrasado = prospect.proximo_followup_em && prospect.proximo_followup_em < hoje;

  const etapaTerminal = prospect.etapa === 'fechado' || prospect.etapa === 'sem_interesse';
  const diasParado = prospect.etapa_atualizada_em
    ? Math.floor((Date.now() - new Date(prospect.etapa_atualizada_em).getTime()) / 86400000)
    : null;
  const paradoDemais = !etapaTerminal && diasParado !== null && diasParado >= DIAS_PARADO_ALERTA;

  return (
    <article
      className={[
        'lead-card',
        followUpHoje     ? 'lead-card--followup-hoje'     : '',
        followUpAtrasado ? 'lead-card--followup-atrasado' : '',
        isDragging        ? 'lead-card--dragging'          : '',
      ].join(' ')}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onEditar(prospect)}
    >
      {/* Alerta de follow-up */}
      {(followUpHoje || followUpAtrasado) && (
        <div className={`lead-card__followup ${followUpAtrasado ? 'lead-card__followup--atrasado' : ''}`}>
          {followUpAtrasado ? '⚠ Follow-up atrasado' : '🔔 Follow-up hoje'}
        </div>
      )}

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
        {prospect.preferencia_contato && (
          <span className="lead-card__badge" style={{ '--badge-cor': '#0EA5E9' }}>
            {ICONE_PREFERENCIA[prospect.preferencia_contato]} Prefere {prospect.preferencia_contato}
          </span>
        )}
        {prospect.origem && (
          <span className="lead-card__badge" style={{ '--badge-cor': '#A855F7' }}>
            🧭 {prospect.origem}
          </span>
        )}
      </div>

      {/* Footer */}
      <footer className="lead-card__footer">
        <span className="lead-card__bairro">
          {prospect.endereco ? `📍 ${prospect.endereco}` : ''}
        </span>
        {diasParado !== null && (
          <span className={`lead-card__dias-parado ${paradoDemais ? 'lead-card__dias-parado--alerta' : ''}`}>
            ⏱ {diasParado}d nesta etapa
          </span>
        )}
      </footer>

      {/* Ações */}
      {(telWpp || telPrimeiro) && (
        <div className="lead-card__acoes">
          {telWpp && (
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
          {telPrimeiro && (
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
