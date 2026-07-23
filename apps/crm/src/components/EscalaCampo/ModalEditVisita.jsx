// src/components/EscalaCampo/ModalEditVisita.jsx
// Modal de editar visita — extraído de EscalaCampo.jsx (Fase 3.2)
import { useState, useMemo } from 'react';
import { TIPO_LABEL, verificarHorario } from '../../utils/escalaHelpers';

export default function ModalEditVisita({ visita, funcionarios, clientes, onSalvar, onFechar, salvando, onCancelar, onDespublicar }) {
  // Se é visita real (cliente cadastrado), busca na lista completa de clientes;
  // se é visita de lead (cliente_id null), usa o `visita.clientes` sintético
  // já enriquecido pela EscalaCampo — traz cliente_servicos como array de 1 item
  // com id prefixado `lead-` pra o dropdown funcionar.
  const clienteCompleto = useMemo(() => {
    if (visita.cliente_id) return clientes.find(c => c.id === visita.cliente_id);
    return visita.clientes ?? null;
  }, [clientes, visita.cliente_id, visita.clientes]);

  const servicosAtivos = useMemo(
    () => (clienteCompleto?.cliente_servicos ?? []).filter(s => s.ativo),
    [clienteCompleto]
  );

  const [form, setForm] = useState({
    funcionarioId: String(visita.funcionario_id ?? ''),
    hora:          (visita.hora_estimada_chegada ?? '').slice(0, 5),
    duracao:       visita.duracao_estimada_min ? String(visita.duracao_estimada_min) : '',
    servicoId:     visita.cliente_servico_id ?? '',
    obs:           visita.observacoes_gestor ?? '',
  });

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const avisos = useMemo(() => {
    if (!clienteCompleto) return [];
    return verificarHorario(clienteCompleto, form.hora);
  }, [clienteCompleto, form.hora]);

  const nomeCliente = visita.clientes?.nome_empresa ?? clienteCompleto?.nome_empresa ?? '—';
  const dataFmt = new Date(visita.data_agendada + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' });
  const publicada = visita.status === 'publicado';

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="ec-modal">
        <header className="ec-modal__header">
          <div>
            <h3 className="ec-modal__titulo">Editar visita{publicada ? ' publicada' : ''}</h3>
            <p className="ec-modal__sub">{nomeCliente} · {dataFmt}</p>
          </div>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">
          {publicada && (
            <div className="ec-alerta ec-alerta--aviso" style={{ marginBottom: 4 }}>
              ⚠ Esta visita já foi <strong>publicada</strong> e pode ter sido vista pelo funcionário. Mudanças agora são refletidas no App Ponto na próxima vez que ele abrir a agenda.
            </div>
          )}
          <div className="ec-grid2">
            <div className="ec-campo">
              <label>Funcionário</label>
              <select value={form.funcionarioId} onChange={e => setF('funcionarioId', e.target.value)}>
                {funcionarios.map(f => (
                  <option key={f.id} value={String(f.id)}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="ec-campo">
              <label>Hora estimada de chegada</label>
              <input type="time" value={form.hora} onChange={e => setF('hora', e.target.value)} />
            </div>
            <div className="ec-campo">
              <label>Duração estimada (min)</label>
              <input
                type="number" min="15" step="15"
                value={form.duracao} onChange={e => setF('duracao', e.target.value)}
                placeholder="Ex: 90"
              />
            </div>
            {servicosAtivos.length > 0 && (
              <div className="ec-campo">
                <label>Tipo de serviço</label>
                <select value={form.servicoId} onChange={e => setF('servicoId', e.target.value)}>
                  <option value="">— (sem contrato específico)</option>
                  {servicosAtivos.map(s => (
                    <option key={s.id} value={s.id}>
                      {TIPO_LABEL[s.tipo_servico] ?? s.tipo_servico}
                      {s.frequencia ? ` · ${s.frequencia}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="ec-campo">
            <label>Observação do gestor <span className="ec-hint">(aparece para o funcionário no celular)</span></label>
            <textarea
              rows={3}
              value={form.obs}
              onChange={e => setF('obs', e.target.value)}
              placeholder="Instruções específicas para esta visita..."
            />
          </div>

          {avisos.length > 0 && (
            <div className="ec-alertas">
              {avisos.map((a, i) => <div key={i} className="ec-alerta ec-alerta--aviso">⚠ {a}</div>)}
            </div>
          )}
        </div>

        <footer className="ec-modal__footer">
          {publicada && (
            <>
              <button
                className="ec-btn ec-btn--perigo"
                onClick={onCancelar}
                disabled={salvando}
                title="Marca a visita como cancelada. Ela desaparece do App Ponto do funcionário."
              >
                ✕ Cancelar visita
              </button>
              <button
                className="ec-btn ec-btn--sec"
                onClick={onDespublicar}
                disabled={salvando}
                title="Volta para rascunho. O funcionário não vê mais essa visita até você republicar o dia."
              >
                ↩ Voltar para rascunho
              </button>
              <span style={{ flex: 1 }} />
            </>
          )}
          <button className="ec-btn ec-btn--sec" onClick={onFechar}>Fechar</button>
          <button
            className="ec-btn ec-btn--pri"
            onClick={() => onSalvar(form)}
            disabled={salvando || !form.funcionarioId}
          >
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </footer>
      </div>
    </div>
  );
}
