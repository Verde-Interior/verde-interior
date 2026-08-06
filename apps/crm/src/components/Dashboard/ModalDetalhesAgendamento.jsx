// src/components/Dashboard/ModalDetalhesAgendamento.jsx
import { useOverlayClose } from '../../hooks/useOverlayClose';
import { TIPOS_TAREFA } from '../../utils/escalaHelpers';

const TAREFA_LABEL = Object.fromEntries(TIPOS_TAREFA.map((t) => [t.id, t.label]));
import '../ModalDetalhesCliente/ModalDetalhesCliente.css';

const STATUS_LABEL = {
  rascunho:     'Rascunho',
  publicado:    'Publicado',
  em_execucao:  'Em execução',
  concluido:    'Concluído',
  cancelado:    'Cancelado',
};

// Card somente-leitura com os dados do agendamento em si (horário, status,
// funcionário, tipo de tarefa) — não confundir com ModalDetalhesCliente, que
// mostra o cadastro completo da empresa. Reaproveita as classes mdc-* (mesmo
// visual, já ajustado pro modo escuro) sem precisar de CSS próprio.
export default function ModalDetalhesAgendamento({ visita, funcionarioNome, onFechar, onVerNaEscala }) {
  const overlayClose = useOverlayClose(onFechar);
  const cliente = visita.cliente ?? {};
  const dataFmt = visita.data_agendada
    ? new Date(visita.data_agendada + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' })
    : '—';
  const tipos = Array.isArray(visita.tipos_tarefa) ? visita.tipos_tarefa : [];

  return (
    <div className="mdc-overlay" {...overlayClose}>
      <div className="mdc-modal">
        <header className="mdc-modal__header">
          <div>
            <h3 className="mdc-modal__titulo">{cliente.nome_empresa ?? 'Agendamento'}</h3>
            {cliente.bairro && <p className="mdc-modal__sub">📍 {cliente.bairro}</p>}
          </div>
          <button className="mdc-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="mdc-modal__corpo">
          <section className="mdc-sec">
            <h4 className="mdc-sec__titulo">Agendamento</h4>
            <div className="mdc-grid">
              <div className="mdc-mc"><div className="mdc-mc__lbl">Data</div><div className="mdc-mc__val">{dataFmt}</div></div>
              <div className="mdc-mc"><div className="mdc-mc__lbl">Hora estimada</div><div className="mdc-mc__val">{visita.hora_estimada_chegada?.slice(0, 5) ?? '—'}</div></div>
              <div className="mdc-mc"><div className="mdc-mc__lbl">Funcionário</div><div className="mdc-mc__val">{funcionarioNome ?? '—'}</div></div>
              <div className="mdc-mc"><div className="mdc-mc__lbl">Status</div><div className="mdc-mc__val">{STATUS_LABEL[visita.status] ?? visita.status ?? '—'}</div></div>
            </div>
          </section>

          <section className="mdc-sec">
            <h4 className="mdc-sec__titulo">Tipo de tarefa</h4>
            {tipos.length === 0 ? (
              <p className="mdc-hint">Nenhum tipo definido.</p>
            ) : (
              <ul className="mdc-servicos">
                {tipos.map((t) => (
                  <li key={t} className="mdc-servico">
                    <span className="mdc-servico__tipo">{TAREFA_LABEL[t] ?? t}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="mdc-modal__footer">
          <button className="mdc-btn mdc-btn--sec" onClick={onFechar}>Fechar</button>
          {onVerNaEscala && <button className="mdc-btn" onClick={onVerNaEscala}>📅 Ver na Escala</button>}
        </footer>
      </div>
    </div>
  );
}
