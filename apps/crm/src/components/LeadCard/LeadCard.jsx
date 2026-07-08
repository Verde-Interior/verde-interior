// src/components/LeadCard/LeadCard.jsx
import { useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import './LeadCard.css';

const ICONE_CANAL = { WhatsApp: '💬', 'E-mail': '✉️', Telefone: '📞' };
const LABEL_FREQ  = { Semanal: 'Semanal', Quinzenal: 'Quinzenal', Mensal: 'Mensal' };

function telefoneLimpo(tel) {
  return tel?.replace(/\D/g, '') ?? '';
}

export default function LeadCard({ lead }) {
  const { abrirModal, TIPOS_SERVICO, dragLeadId, setDragLeadId, ESTAGIOS_EXECUCAO, promoverParaCliente } = useCRM();
  const [promovendo, setPromovendo] = useState(false);

  const jaEhCliente = !!lead.clienteSupabaseId;
  const podePromover = lead.estagioId === 'orcamento_aprovado' && !jaEhCliente;

  async function handlePromover(e) {
    e.stopPropagation();
    if (!confirm(`Promover "${lead.empresa}" a Cliente na base de campo?\n\nIsso cria o cadastro em Clientes com o contrato do orçamento. O lead permanece no Kanban.`)) return;
    setPromovendo(true);
    const res = await promoverParaCliente(lead.id);
    setPromovendo(false);
    if (res.ok) alert(`✓ ${lead.empresa} agora está na base de Clientes. Complete os dados que faltam (dias disponíveis, duração, janela) na aba Clientes.`);
    else alert('Erro: ' + res.error);
  }

  const servico      = TIPOS_SERVICO[lead.tipoServico];
  const isRecorrente = servico?.faturamento === 'recorrente';
  const isDragging   = dragLeadId === lead.id;

  const hoje            = new Date().toISOString().split('T')[0];
  const followUpHoje    = lead.proximoFollowUp === hoje;
  const followUpAtrasado = lead.proximoFollowUp && lead.proximoFollowUp < hoje;

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0,
  }).format(lead.valorEstimado ?? 0);

  const whatsappUrl = `https://wa.me/55${telefoneLimpo(lead.telefone)}`;

  // Feature 6: Alerta de validade do orçamento
  const validadeOrc = lead.orcamento?.validade;
  const orcVencido  = validadeOrc && validadeOrc < hoje;
  const orcPrestes  = validadeOrc && !orcVencido && (() => {
    const diff = Math.floor((new Date(validadeOrc + 'T12:00') - new Date()) / 86400000);
    return diff <= 5;
  })();

  // Feature 8: Etapa de execução para aprovados
  const etapaExec = lead.estagioId === 'orcamento_aprovado' && lead.funilExecucao?.etapa
    ? ESTAGIOS_EXECUCAO?.find((e) => e.id === lead.funilExecucao.etapa)
    : null;

  function handleDragStart(e) {
    setDragLeadId(lead.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('leadId', lead.id);
  }

  function handleDragEnd() {
    setDragLeadId(null);
  }

  return (
    <article
      className={[
        'lead-card',
        followUpHoje      ? 'lead-card--followup-hoje'     : '',
        followUpAtrasado  ? 'lead-card--followup-atrasado' : '',
        isDragging        ? 'lead-card--dragging'          : '',
      ].join(' ')}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => abrirModal(lead)}
    >
      {/* Badges de fluxo */}
      {lead.fluxoOrcamento?.urgente && (
        <div className="lead-card__fluxo-tag lead-card__fluxo-tag--urgente">🚨 URGENTE</div>
      )}
      {lead.fluxoOrcamento?.aguardandoResposta && !lead.fluxoOrcamento?.urgente && (
        <div className="lead-card__fluxo-tag lead-card__fluxo-tag--aguardando">⏳ Aguardando Resposta</div>
      )}

      {/* Feature 6: Alerta de validade do orçamento */}
      {orcVencido && (
        <div className="lead-card__validade-tag lead-card__validade-tag--vencido">⛔ Orçamento Vencido</div>
      )}
      {orcPrestes && (
        <div className="lead-card__validade-tag lead-card__validade-tag--alerta">⚠ Validade em {Math.floor((new Date(validadeOrc + 'T12:00') - new Date()) / 86400000)}d</div>
      )}

      {/* Alerta de follow-up */}
      {(followUpHoje || followUpAtrasado) && (
        <div className={`lead-card__followup ${followUpAtrasado ? 'lead-card__followup--atrasado' : ''}`}>
          {followUpAtrasado ? '⚠ Follow-up atrasado' : '🔔 Follow-up hoje'}
        </div>
      )}

      {/* Header: empresa + canal */}
      <header className="lead-card__header">
        <span className="lead-card__empresa">{lead.empresa}</span>
        <span className="lead-card__canal" title={`Canal: ${lead.canalOrigem}`}>
          {ICONE_CANAL[lead.canalOrigem]}
        </span>
      </header>

      {/* Contato */}
      <p className="lead-card__contato">
        {lead.contato}
        {lead.cargo && <span className="lead-card__cargo"> · {lead.cargo}</span>}
      </p>

      {/* Badge de serviço */}
      <div className="lead-card__badges">
        <span
          className="lead-card__badge"
          style={{ '--badge-cor': servico?.cor ?? '#6B7280' }}
        >
          {servico?.label ?? lead.tipoServico}
        </span>
        {isRecorrente && lead.frequenciaVisita && (
          <span className="lead-card__badge lead-card__badge--freq">
            {LABEL_FREQ[lead.frequenciaVisita]}
          </span>
        )}
        {/* Feature 8: Etapa de execução */}
        {etapaExec && (
          <span className="lead-card__badge lead-card__badge--execucao" style={{ '--badge-cor': etapaExec.cor }}>
            ⚙ {etapaExec.label}
          </span>
        )}
      </div>

      {/* Footer: bairro + valor */}
      <footer className="lead-card__footer">
        <span className="lead-card__bairro">📍 {lead.bairro}</span>
        <div className="lead-card__valores">
          {lead.quantidadeVasos && (
            <span className="lead-card__vasos">🪴 {lead.quantidadeVasos}</span>
          )}
          <span className="lead-card__valor">
            {valorFormatado}
            {isRecorrente && <span className="lead-card__recorrencia">/mês</span>}
          </span>
        </div>
      </footer>

      {/* Feature 1: Ações rápidas de contato */}
      {lead.telefone && (
        <div className="lead-card__acoes">
          <a
            className="lead-card__whatsapp"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            title="Conversa no WhatsApp"
            onClick={(e) => e.stopPropagation()}
          >
            💬 WhatsApp
          </a>
          <a
            className="lead-card__ligar"
            href={`tel:${telefoneLimpo(lead.telefone)}`}
            title={`Ligar para ${lead.telefone}`}
            onClick={(e) => e.stopPropagation()}
          >
            📞 Ligar
          </a>
        </div>
      )}

      {/* Botão "Virar cliente" (só em orçamento aprovado, uma vez) */}
      {podePromover && (
        <button
          className="lead-card__promover"
          onClick={handlePromover}
          disabled={promovendo}
          title="Cria o cadastro na base de Clientes (Sistema de Campo)"
        >
          {promovendo ? 'Promovendo...' : '🌿 Virar cliente'}
        </button>
      )}
      {jaEhCliente && (
        <div className="lead-card__cliente-tag" title={`Já promovido a Cliente (Supabase)`}>
          ✓ Cliente na base
        </div>
      )}

      {/* Handle visual de drag */}
      <div className="lead-card__drag-handle" title="Arraste para mover" onMouseDown={(e) => e.stopPropagation()}>
        ⠿
      </div>
    </article>
  );
}
