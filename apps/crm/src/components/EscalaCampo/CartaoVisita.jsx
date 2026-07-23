// src/components/EscalaCampo/CartaoVisita.jsx
// Cartão de visita — extraído de EscalaCampo.jsx (Fase 3.1)
import { TIPO_LABEL, TIPO_COR, PRIORIDADE_LABEL } from '../../utils/escalaHelpers';

export default function CartaoVisita({
  visita, isFirst, isLast,
  onCima, onBaixo, onDeletar,
  // drag
  onDragStart, onDragEnd, isDragging,
  // seleção
  modoSelecao, selecionada, onToggleSel,
  // conflitos
  emSobreposicao, estouraDia,
  // prioridade (Fase 5.2)
  prioridade,
  mostrarPrioridade,
  // restrições (violação de dia/janela do cliente)
  restricao,
  // edição
  onEditar,
  // relatório (em_execucao / concluido)
  onVerRelatorio,
}) {
  const tipo   = visita.cliente_servicos?.tipo_servico;
  const status = visita.status;
  const editavel = status === 'rascunho';
  const editavelComAviso = status === 'publicado';
  const temRelatorio = status === 'em_execucao' || status === 'concluido';
  const abrirModal = editavel || editavelComAviso;
  const clicavelPorStatus = abrirModal || temRelatorio;

  const temRestricao = restricao?.restricaoDia || restricao?.restricaoHora;

  const classesConf = [
    emSobreposicao ? 'ec-cartao--conflito-sob' : '',
    estouraDia ? 'ec-cartao--conflito-fim' : '',
    mostrarPrioridade && prioridade ? `ec-cartao--prio-${prioridade}` : '',
    restricao?.restricaoDia ? 'ec-cartao--restr-dia' : '',
    restricao?.restricaoHora ? 'ec-cartao--restr-hora' : '',
  ].filter(Boolean).join(' ');

  const tooltipConf = [
    emSobreposicao ? 'Horário sobreposto com outra visita' : null,
    estouraDia ? 'Esta visita passa do fim do expediente' : null,
    mostrarPrioridade && prioridade ? `Prioridade: ${PRIORIDADE_LABEL[prioridade] ?? prioridade}` : null,
    ...(restricao?.motivos ?? []),
  ].filter(Boolean).join(' · ');

  const tooltipPadrao =
    editavel ? 'Clique para editar · arraste para mover' :
    editavelComAviso ? 'Publicada — clique para alterar ou cancelar' :
    temRelatorio ? 'Clique para ver o relatório' :
    undefined;

  return (
    <div
      className={`ec-cartao ec-cartao--${status} ${isDragging ? 'ec-cartao--dragging' : ''} ${selecionada ? 'ec-cartao--sel' : ''} ${classesConf} ${clicavelPorStatus && !modoSelecao ? 'ec-cartao--clicavel' : ''}`}
      title={tooltipConf || tooltipPadrao}
      draggable={editavel && !modoSelecao}
      onDragStart={editavel && !modoSelecao ? onDragStart : undefined}
      onDragEnd={onDragEnd}
      onClick={
        modoSelecao && (editavel || editavelComAviso)
          ? onToggleSel
          : (abrirModal && onEditar ? onEditar
              : (temRelatorio && onVerRelatorio ? () => onVerRelatorio(visita) : undefined))
      }
    >
      {modoSelecao && (editavel || editavelComAviso) && (
        <button
          className={`ec-cartao__check ${selecionada ? 'ec-cartao__check--on' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleSel(); }}
          title={selecionada ? 'Desmarcar' : 'Selecionar'}
        >
          {selecionada ? '✓' : ''}
        </button>
      )}

      {mostrarPrioridade && prioridade && (
        <span className="ec-cartao__prio-dot" title={`Prioridade ${PRIORIDADE_LABEL[prioridade] ?? prioridade}`} />
      )}

      {!modoSelecao && (
        <div className="ec-cartao__ordens" onClick={e => e.stopPropagation()}>
          <button className="ec-cartao__ord" onClick={e => { e.stopPropagation(); onCima();  }} disabled={isFirst || !editavel} title="Subir">▲</button>
          <button className="ec-cartao__ord" onClick={e => { e.stopPropagation(); onBaixo(); }} disabled={isLast  || !editavel} title="Descer">▼</button>
        </div>
      )}

      {tipo && (
        <span className="ec-cartao__tipo-bar" style={{ background: TIPO_COR[tipo] ?? '#888' }} title={TIPO_LABEL[tipo]} />
      )}

      <div className="ec-cartao__info">
        <span className="ec-cartao__nome">
          {visita.clientes?.nome_empresa ?? '—'}
          {visita.__isLead && (
            <span
              className="ec-cartao__lead-badge"
              title="Visita técnica em um lead — ainda não é cliente cadastrado"
              style={{
                marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: '.04em',
                color: '#7C3AED', background: '#F5F3FF', border: '1px solid #DDD6FE',
                padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase',
              }}
            >
              🌱 lead
            </span>
          )}
        </span>
        {visita.clientes?.bairro && (
          <span className="ec-cartao__bairro">{visita.clientes.bairro}</span>
        )}
        <div className="ec-cartao__meta">
          {visita.hora_estimada_chegada && (
            <span className="ec-cartao__hora">⏱ {visita.hora_estimada_chegada.slice(0, 5)}</span>
          )}
          {visita.duracao_estimada_min && (
            <span className="ec-cartao__dur">{visita.duracao_estimada_min} min</span>
          )}
          {tipo && (
            <span className="ec-cartao__tipo-tag" style={{ color: TIPO_COR[tipo] }}>
              {TIPO_LABEL[tipo]}
            </span>
          )}
        </div>
        {visita.observacoes_gestor && (
          <p className="ec-cartao__obs">{visita.observacoes_gestor}</p>
        )}
        {temRestricao && (
          <div className="ec-cartao__restr" title={restricao.motivos.join('\n')}>
            {restricao.restricaoDia && <span className="ec-cartao__restr-tag">⚠ dia</span>}
            {restricao.restricaoHora && <span className="ec-cartao__restr-tag">⚠ hora</span>}
          </div>
        )}
      </div>

      {editavel && !modoSelecao && (
        <button className="ec-cartao__del" onClick={e => { e.stopPropagation(); onDeletar(); }} title="Remover">✕</button>
      )}
      {!editavel && (
        <span className={`ec-cartao__pub ec-cartao__pub--${status}`}>
          {status === 'publicado'   && <>● Aguardando</>}
          {status === 'em_execucao' && <>▶ Em execução</>}
          {status === 'concluido'   && <>✓ Concluída</>}
          {status === 'cancelado'   && <>✕ Cancelada</>}
        </span>
      )}
    </div>
  );
}
