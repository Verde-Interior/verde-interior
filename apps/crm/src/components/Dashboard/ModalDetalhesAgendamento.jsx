// src/components/Dashboard/ModalDetalhesAgendamento.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import { TIPOS_TAREFA, STATUS_VISITA_LABEL, ALERTA_FALTA_LABEL } from '../../utils/escalaHelpers';
import '../ModalDetalhesCliente/ModalDetalhesCliente.css';

const TAREFA_LABEL = Object.fromEntries(TIPOS_TAREFA.map((t) => [t.id, t.label]));
const RESUMO_MAX = 160;

function resumir(texto) {
  if (!texto) return '';
  const limpo = texto.trim();
  return limpo.length > RESUMO_MAX ? limpo.slice(0, RESUMO_MAX).trim() + '…' : limpo;
}

function formatarHora(iso) {
  return iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

// Card somente-leitura com os dados do agendamento em si (horário, status,
// funcionário, tipo de tarefa) — não confundir com ModalDetalhesCliente, que
// mostra o cadastro completo da empresa. Reaproveita as classes mdc-* (mesmo
// visual, já ajustado pro modo escuro) sem precisar de CSS próprio.
// Busca o relatório vinculado (se já existir check-in) só pra mostrar um
// resumo — o relatório completo continua só na tela de Relatórios.
export default function ModalDetalhesAgendamento({ visita, funcionarioNome, alerta, onFechar, onVerNaEscala, onVerRelatorio }) {
  const overlayClose = useOverlayClose(onFechar);
  const cliente = visita.cliente ?? {};
  const dataFmt = visita.data_agendada
    ? new Date(visita.data_agendada + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' })
    : '—';
  const tipos = Array.isArray(visita.tipos_tarefa) ? visita.tipos_tarefa : [];

  const [relatorio, setRelatorio] = useState(null);
  const [carregandoRel, setCarregandoRel] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregandoRel(true);
      const { data } = await supabase
        .from('relatorios')
        .select('id, checkin_at, checkout_at, relato, observacoes')
        .eq('agendamento_id', visita.id)
        .maybeSingle();
      if (!cancelado) {
        setRelatorio(data ?? null);
        setCarregandoRel(false);
      }
    })();
    return () => { cancelado = true; };
  }, [visita.id]);

  const relatoLimpo = resumir((relatorio?.relato || '').split('\n\n— Fotos —\n')[0]);
  const obsRelatorio = resumir(relatorio?.observacoes);

  return (
    <div className="mdc-overlay" {...overlayClose}>
      <div className="mdc-modal">
        <header className="mdc-modal__header">
          <div>
            <h3 className="mdc-modal__titulo">{cliente.nome_empresa ?? 'Agendamento'}</h3>
            {cliente.regiao && <p className="mdc-modal__sub">📍 {cliente.regiao}</p>}
          </div>
          <button className="mdc-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        {alerta && (
          <div style={{
            margin: '0 20px', padding: '8px 12px', borderRadius: 8,
            background: alerta === 'falta_provavel' ? 'color-mix(in srgb, #DC2626 16%, transparent)' : 'color-mix(in srgb, #F59E0B 14%, transparent)',
            color: alerta === 'falta_provavel' ? '#DC2626' : '#B45309',
            fontSize: 13, fontWeight: 600,
          }}>
            {alerta === 'falta_provavel' ? '🔴' : '⚠'} {ALERTA_FALTA_LABEL[alerta]} — sem check-in registrado até agora
          </div>
        )}

        <div className="mdc-modal__corpo">
          <section className="mdc-sec">
            <h4 className="mdc-sec__titulo">Agendamento</h4>
            <div className="mdc-grid">
              <div className="mdc-mc"><div className="mdc-mc__lbl">Data</div><div className="mdc-mc__val">{dataFmt}</div></div>
              <div className="mdc-mc"><div className="mdc-mc__lbl">Hora estimada</div><div className="mdc-mc__val">{visita.hora_estimada_chegada?.slice(0, 5) ?? '—'}</div></div>
              <div className="mdc-mc"><div className="mdc-mc__lbl">Chegada</div><div className="mdc-mc__val">{carregandoRel ? '…' : formatarHora(relatorio?.checkin_at)}</div></div>
              {relatorio?.checkout_at && (
                <div className="mdc-mc"><div className="mdc-mc__lbl">Check-out</div><div className="mdc-mc__val">{formatarHora(relatorio.checkout_at)}</div></div>
              )}
              <div className="mdc-mc"><div className="mdc-mc__lbl">Funcionário</div><div className="mdc-mc__val">{funcionarioNome ?? '—'}</div></div>
              <div className="mdc-mc"><div className="mdc-mc__lbl">Status</div><div className="mdc-mc__val">{STATUS_VISITA_LABEL[visita.status] ?? visita.status ?? '—'}</div></div>
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

          {visita.observacoes_gestor && (
            <section className="mdc-sec">
              <h4 className="mdc-sec__titulo">Observação do gestor</h4>
              <p className="mdc-relato">{resumir(visita.observacoes_gestor)}</p>
            </section>
          )}

          {(relatoLimpo || obsRelatorio) && (
            <section className="mdc-sec">
              <h4 className="mdc-sec__titulo">Relato da tarefa</h4>
              {relatoLimpo && <p className="mdc-relato">{relatoLimpo}</p>}
              {obsRelatorio && <p className="mdc-relato mdc-relato--interna">{obsRelatorio}</p>}
            </section>
          )}
        </div>

        <footer className="mdc-modal__footer">
          <button className="mdc-btn mdc-btn--sec" onClick={onFechar}>Fechar</button>
          {onVerNaEscala && <button className="mdc-btn mdc-btn--sec" onClick={onVerNaEscala}>📅 Ver na Escala</button>}
          {relatorio && onVerRelatorio && (
            <button className="mdc-btn" onClick={() => onVerRelatorio(relatorio.id)}>📋 Ver relatório</button>
          )}
        </footer>
      </div>
    </div>
  );
}
