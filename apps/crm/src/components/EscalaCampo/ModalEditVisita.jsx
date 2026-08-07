// src/components/EscalaCampo/ModalEditVisita.jsx
// Modal de editar visita — extraído de EscalaCampo.jsx (Fase 3.2)
import { useState, useMemo } from 'react';
import { TIPO_LABEL, TIPOS_TAREFA, textoObsDeTipos, verificarHorario, ALERTA_FALTA_LABEL } from '../../utils/escalaHelpers';
import { useOverlayClose } from '../../hooks/useOverlayClose';

export default function ModalEditVisita({ visita, funcionarios, clientes, onSalvar, onFechar, salvando, onCancelar, onDespublicar, onMarcarFalta, alerta, onDuplicarFuncionario, onDuplicar }) {
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

  const tiposIniciais = Array.isArray(visita.tipos_tarefa) ? visita.tipos_tarefa : [];

  // Tarefa avulsa: não tem cliente cadastrado nem lead — o nome vem só do
  // texto livre (agenda.nome_cliente). É o único caso em que dá pra editar
  // o nome por aqui (cliente/lead têm o nome no próprio cadastro).
  const semCliente = !visita.cliente_id && !visita.lead_id;

  const [form, setForm] = useState({
    funcionarioId: String(visita.funcionario_id ?? ''),
    data:          visita.data_agendada ?? '',
    hora:          (visita.hora_estimada_chegada ?? '').slice(0, 5),
    duracao:       visita.duracao_estimada_min ? String(visita.duracao_estimada_min) : '',
    servicoId:     visita.cliente_servico_id ?? '',
    nomeTarefa:    visita.nome_cliente || '',
    endereco:      visita.endereco_tarefa || visita.clientes?.endereco || '',
    tipos:         tiposIniciais,
    obs:           visita.observacoes_gestor ?? '',
    obsManual:     (visita.observacoes_gestor ?? '').trim() !== textoObsDeTipos(tiposIniciais).trim(),
  });

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleTipo(id) {
    setForm(f => {
      const has = f.tipos.includes(id);
      const novos = has ? f.tipos.filter(t => t !== id) : [...f.tipos, id];
      const textoAntigo = textoObsDeTipos(f.tipos);
      const textoNovo   = textoObsDeTipos(novos);
      const podeSobrescrever = !f.obsManual || f.obs.trim() === textoAntigo.trim() || !f.obs.trim();
      return {
        ...f,
        tipos: novos,
        obs:   podeSobrescrever ? textoNovo : f.obs,
        obsManual: podeSobrescrever ? false : f.obsManual,
      };
    });
  }

  function onObsChange(v) {
    setForm(f => ({ ...f, obs: v, obsManual: v.trim() !== textoObsDeTipos(f.tipos).trim() }));
  }

  const avisos = useMemo(() => {
    if (!clienteCompleto) return [];
    return verificarHorario(clienteCompleto, form.hora);
  }, [clienteCompleto, form.hora]);

  const nomeCliente = visita.clientes?.nome_empresa ?? clienteCompleto?.nome_empresa ?? '—';
  const dataFmt = new Date(visita.data_agendada + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' });
  const publicada = visita.status === 'publicado';
  const jaExecutada = visita.status === 'em_execucao' || visita.status === 'concluido';

  const overlayClose = useOverlayClose(onFechar);

  return (
    <div className="ec-overlay" {...overlayClose}>
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
          {jaExecutada && (
            <div className="ec-alerta ec-alerta--aviso" style={{ marginBottom: 4 }}>
              ⚠ Esta visita já foi <strong>{visita.status === 'concluido' ? 'concluída' : 'iniciada'}</strong>. O relatório continua vinculado aos dados originais do check-in — mudar data, horário ou funcionário aqui não altera o que já foi registrado em campo.
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
              <label>Data</label>
              <input type="date" value={form.data} onChange={e => setF('data', e.target.value)} />
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

          {semCliente && (
            <div className="ec-campo">
              <label>Nome <span className="ec-hint">(essa visita não está vinculada a um cliente ou lead cadastrado)</span></label>
              <input
                type="text"
                value={form.nomeTarefa}
                onChange={e => setF('nomeTarefa', e.target.value)}
                placeholder="Ex: Nome da empresa ou do evento"
              />
            </div>
          )}

          <div className="ec-campo">
            <label>Local / Endereço <span className="ec-hint">(vale só para esta visita — não altera o cadastro do cliente)</span></label>
            <input
              type="text"
              value={form.endereco}
              onChange={e => setF('endereco', e.target.value)}
              placeholder="Ex: Av. Paulista, 1000 — Bela Vista, São Paulo"
            />
          </div>

          <div className="ec-campo">
            <label>Tipo de tarefa <span className="ec-hint">(marque um ou mais — atualiza a observação abaixo)</span></label>
            <div className="ec-chips">
              {TIPOS_TAREFA.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`ec-chip ${form.tipos.includes(t.id) ? 'ec-chip--ativo' : ''}`}
                  onClick={() => toggleTipo(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ec-campo">
            <label>Observação do gestor <span className="ec-hint">(aparece para o funcionário no celular)</span></label>
            <textarea
              rows={3}
              value={form.obs}
              onChange={e => onObsChange(e.target.value)}
              placeholder="Instruções específicas para esta visita..."
            />
          </div>

          {alerta && (
            <div className="ec-alertas">
              <div className="ec-alerta ec-alerta--falta">
                {alerta === 'falta_provavel' ? '🔴' : '⚠'} {ALERTA_FALTA_LABEL[alerta]} — sem check-in registrado até agora.
              </div>
            </div>
          )}

          {avisos.length > 0 && (
            <div className="ec-alertas">
              {avisos.map((a, i) => <div key={i} className="ec-alerta ec-alerta--aviso">⚠ {a}</div>)}
            </div>
          )}
        </div>

        <footer className="ec-modal__footer ec-modal__footer--edit">
          <div className="ec-modal__footer-esq">
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
                {onMarcarFalta && (
                  <button
                    className="ec-btn ec-btn--perigo"
                    onClick={onMarcarFalta}
                    disabled={salvando}
                    title="Marca que o colaborador não compareceu. Diferente de cancelar: fica registrado como falta, não como cancelamento do gestor."
                  >
                    ⛔ Marcar falta
                  </button>
                )}
                <button
                  className="ec-btn ec-btn--sec"
                  onClick={onDespublicar}
                  disabled={salvando}
                  title="Volta para rascunho. O funcionário não vê mais essa visita até você republicar o dia."
                >
                  ↩ Voltar para rascunho
                </button>
              </>
            )}
          </div>
          <div className="ec-modal__footer-dir">
            {onDuplicarFuncionario && (
              <button
                className="ec-btn ec-btn--sec"
                onClick={() => onDuplicarFuncionario(form)}
                disabled={salvando}
                title="Cria uma cópia desta visita atribuída a outro funcionário (mesma hora, tarefa e observações)"
              >
                👥 + Funcionário
              </button>
            )}
            {onDuplicar && (
              <button
                className="ec-btn ec-btn--sec"
                onClick={() => onDuplicar(form)}
                disabled={salvando}
                title="Cria uma cópia desta visita, escolhendo funcionário e data de destino"
              >
                ⧉ Duplicar
              </button>
            )}
            <button className="ec-btn ec-btn--sec" onClick={onFechar}>Fechar</button>
            <button
              className="ec-btn ec-btn--pri"
              onClick={() => onSalvar(form)}
              disabled={salvando || !form.funcionarioId}
            >
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
