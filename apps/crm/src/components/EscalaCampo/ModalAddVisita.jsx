// src/components/EscalaCampo/ModalAddVisita.jsx
// Modal de adicionar visita — extraído de EscalaCampo.jsx (Fase 3.2)
import { useState, useEffect, useMemo } from 'react';
import {
  TIPO_LABEL, TIPOS_TAREFA,
  textoObsDeTipos, verificarConflitos, verificarHorario,
} from '../../utils/escalaHelpers';

export default function ModalAddVisita({ clientes, funcionarios, dataInicial, funcionarioIdInicial, clienteIdPre, onSalvar, onFechar, salvando }) {
  const [form, setForm] = useState({
    clienteId:     clienteIdPre ?? '',
    funcionarioId: funcionarioIdInicial ?? (funcionarios[0]?.id?.toString() ?? ''),
    data:          dataInicial,
    hora:          '07:00',
    duracao:       '',
    servicoId:     '',
    tipos:         [],
    obs:           '',
    obsManual:     false,
  });

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

  useEffect(() => {
    if (!clienteIdPre) return;
    const c = clientes.find(x => x.id === clienteIdPre);
    if (!c) return;
    setForm(f => ({
      ...f,
      clienteId: c.id,
      hora: c.janela_entrada_inicio?.slice(0, 5) || f.hora,
      duracao: c.duracao_estimada_min ? String(c.duracao_estimada_min) : f.duracao,
      servicoId: (c.cliente_servicos ?? []).find(s => s.ativo)?.id ?? '',
    }));
  }, [clienteIdPre, clientes]);

  const [busca,      setBusca]      = useState('');
  const [listAberta, setListAberta] = useState(false);

  const clienteSel   = useMemo(() => clientes.find(c => c.id === form.clienteId) ?? null, [clientes, form.clienteId]);
  const clientesFilt = useMemo(() => {
    const q = busca.toLowerCase();
    return q
      ? clientes.filter(c => c.nome_empresa.toLowerCase().includes(q) || c.bairro?.toLowerCase().includes(q))
      : clientes.slice(0, 10);
  }, [clientes, busca]);
  const servicos = useMemo(() => (clienteSel?.cliente_servicos ?? []).filter(s => s.ativo), [clienteSel]);

  const { erros, avisos } = useMemo(() => {
    if (!clienteSel) return { erros: [], avisos: [] };
    return { erros: verificarConflitos(clienteSel, form.data), avisos: verificarHorario(clienteSel, form.hora) };
  }, [clienteSel, form.data, form.hora]);

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function selecionarCliente(c) {
    setBusca(c.nome_empresa);
    setListAberta(false);
    setF('clienteId', c.id);
    if (c.duracao_estimada_min)  setF('duracao', String(c.duracao_estimada_min));
    if (c.janela_entrada_inicio) setF('hora', c.janela_entrada_inicio.slice(0, 5));
    const servAtivos = (c.cliente_servicos ?? []).filter(s => s.ativo);
    setF('servicoId', servAtivos.length === 1 ? servAtivos[0].id : '');
  }

  const camposMinimos = form.clienteId && form.funcionarioId && form.data;
  const semErros = erros.length === 0;
  const podeSubmit = camposMinimos && semErros;
  const podeForcarSubmit = camposMinimos && !semErros;

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="ec-modal">
        <header className="ec-modal__header">
          <h3 className="ec-modal__titulo">Adicionar Visita</h3>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">
          <div className="ec-grid2">
            <div className="ec-campo">
              <label>Funcionário <span className="ec-req">*</span></label>
              <select value={form.funcionarioId} onChange={e => setF('funcionarioId', e.target.value)}>
                {funcionarios.map(emp => <option key={emp.id} value={String(emp.id)}>{emp.name}</option>)}
              </select>
            </div>
            <div className="ec-campo">
              <label>Data <span className="ec-req">*</span></label>
              <input type="date" value={form.data} onChange={e => setF('data', e.target.value)} />
            </div>
          </div>

          <div className="ec-campo">
            <label>Cliente <span className="ec-req">*</span></label>
            <div className="ec-busca">
              <input
                className={`ec-busca__input ${form.clienteId ? 'ec-busca__input--sel' : ''}`}
                placeholder="Digite o nome ou bairro..."
                value={busca}
                onChange={e => { setBusca(e.target.value); setListAberta(true); if (form.clienteId) setF('clienteId', ''); }}
                onFocus={() => setListAberta(true)}
                autoComplete="off"
              />
              {form.clienteId && (
                <button className="ec-busca__clear" onClick={() => { setBusca(''); setF('clienteId', ''); }}>✕</button>
              )}
              {listAberta && !form.clienteId && (
                <div className="ec-busca__lista">
                  {clientesFilt.length === 0
                    ? <p className="ec-busca__vazio">Nenhum cliente encontrado</p>
                    : clientesFilt.slice(0, 8).map(c => (
                      <button key={c.id} className="ec-busca__item" onMouseDown={() => selecionarCliente(c)}>
                        <span className="ec-busca__item-nome">{c.nome_empresa}</span>
                        {c.bairro && <span className="ec-busca__item-bairro">{c.bairro}</span>}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          </div>

          {clienteSel && (erros.length > 0 || avisos.length > 0) && (
            <div className="ec-alertas">
              {erros.map((e, i)  => <div key={i} className="ec-alerta ec-alerta--erro">✗ {e}</div>)}
              {avisos.map((a, i) => <div key={i} className="ec-alerta ec-alerta--aviso">⚠ {a}</div>)}
            </div>
          )}
          {clienteSel && erros.length === 0 && avisos.length === 0 && (
            <div className="ec-alerta ec-alerta--ok">✓ Dia disponível para este cliente</div>
          )}

          <div className="ec-grid2">
            <div className="ec-campo">
              <label>Hora estimada de chegada</label>
              <input type="time" value={form.hora} onChange={e => setF('hora', e.target.value)} />
            </div>
            <div className="ec-campo">
              <label>Duração (min)</label>
              <input
                type="number" min="15" step="15" value={form.duracao}
                onChange={e => setF('duracao', e.target.value)}
                placeholder={clienteSel?.duracao_estimada_min ? `${clienteSel.duracao_estimada_min}` : 'Ex: 90'}
              />
            </div>
          </div>

          {servicos.length > 0 && (
            <div className="ec-campo">
              <label>Tipo de serviço</label>
              <select value={form.servicoId} onChange={e => setF('servicoId', e.target.value)}>
                <option value="">Não especificar</option>
                {servicos.map(s => (
                  <option key={s.id} value={s.id}>{TIPO_LABEL[s.tipo_servico] ?? s.tipo_servico} · {s.frequencia}</option>
                ))}
              </select>
            </div>
          )}

          <div className="ec-campo">
            <label>Tipo de tarefa <span className="ec-hint">(pode marcar mais de um — preenche o texto abaixo)</span></label>
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
            <label>Instruções para o funcionário <span className="ec-hint">(aparece no celular; edite à vontade)</span></label>
            <textarea rows={3} value={form.obs} onChange={e => onObsChange(e.target.value)} placeholder="Instrução específica para esta visita..." />
          </div>
        </div>

        <footer className="ec-modal__footer">
          <button className="ec-btn ec-btn--sec" onClick={onFechar}>Cancelar</button>
          {podeForcarSubmit && !salvando && (
            <button
              className="ec-btn ec-btn--forcar"
              onClick={() => {
                if (confirm(`Este cliente tem restrição de dia, mas você quer forçar o agendamento.\n\n${erros.join('\n')}\n\nContinuar mesmo assim?`)) {
                  onSalvar(form);
                }
              }}
              title="Ignora a restrição de dia do cliente e adiciona a visita"
            >
              ⚠ Adicionar mesmo assim
            </button>
          )}
          <button className="ec-btn ec-btn--pri" onClick={() => onSalvar(form)} disabled={!podeSubmit || salvando}>
            {salvando ? 'Salvando...' : 'Adicionar Visita'}
          </button>
        </footer>
      </div>
    </div>
  );
}
