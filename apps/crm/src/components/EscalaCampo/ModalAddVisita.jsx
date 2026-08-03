// src/components/EscalaCampo/ModalAddVisita.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  TIPO_LABEL, TIPOS_TAREFA,
  textoObsDeTipos, verificarConflitos, verificarHorario,
} from '../../utils/escalaHelpers';
import { useOverlayClose } from '../../hooks/useOverlayClose';

export default function ModalAddVisita({ clientes, funcionarios, dataInicial, funcionarioIdInicial, clienteIdPre, onSalvar, onFechar, salvando }) {
  const idInicial = funcionarioIdInicial ?? (funcionarios[0]?.id?.toString() ?? '');
  const [form, setForm] = useState({
    clienteId:      clienteIdPre ?? '',
    enderecoTarefa: '',
    funcionariosIds: idInicial ? [String(idInicial)] : [],
    data:            dataInicial,
    hora:            '07:00',
    duracao:         '',
    servicoId:       '',
    tipos:           [],
    obs:             '',
    obsManual:       false,
  });

  const [busca,               setBusca]               = useState('');
  const [listAberta,          setListAberta]          = useState(false);
  const [dropdownFuncsAberto, setDropdownFuncsAberto] = useState(false);
  const dropdownRef = useRef(null);

  // Fecha dropdown de funcionários ao clicar fora
  useEffect(() => {
    function onClickFora(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownFuncsAberto(false);
      }
    }
    document.addEventListener('mousedown', onClickFora);
    return () => document.removeEventListener('mousedown', onClickFora);
  }, []);

  // Pré-preenche quando vem do painel de atrasados
  useEffect(() => {
    if (!clienteIdPre) return;
    const c = clientes.find(x => x.id === clienteIdPre);
    if (!c) return;
    setBusca(c.nome_empresa);
    setForm(f => ({
      ...f,
      clienteId: c.id,
      hora:      c.janela_entrada_inicio?.slice(0, 5) || f.hora,
      duracao:   c.duracao_estimada_min ? String(c.duracao_estimada_min) : f.duracao,
      servicoId: (c.cliente_servicos ?? []).find(s => s.ativo)?.id ?? '',
    }));
  }, [clienteIdPre, clientes]); // eslint-disable-line

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleFuncionario(id) {
    setForm(f => {
      const s   = String(id);
      const has = f.funcionariosIds.includes(s);
      return { ...f, funcionariosIds: has ? f.funcionariosIds.filter(x => x !== s) : [...f.funcionariosIds, s] };
    });
  }

  function toggleTipo(id) {
    setForm(f => {
      const has        = f.tipos.includes(id);
      const novos      = has ? f.tipos.filter(t => t !== id) : [...f.tipos, id];
      const textoAntigo = textoObsDeTipos(f.tipos);
      const textoNovo   = textoObsDeTipos(novos);
      const podeSobrescrever = !f.obsManual || f.obs.trim() === textoAntigo.trim() || !f.obs.trim();
      return { ...f, tipos: novos, obs: podeSobrescrever ? textoNovo : f.obs, obsManual: podeSobrescrever ? false : f.obsManual };
    });
  }

  function onObsChange(v) {
    setForm(f => ({ ...f, obs: v, obsManual: v.trim() !== textoObsDeTipos(f.tipos).trim() }));
  }

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

  // Cliente digitado mas não selecionado da lista = não cadastrado
  const clienteNaoCadastrado = busca.trim().length > 0 && !form.clienteId;

  const nomesFunc = funcionarios.filter(e => form.funcionariosIds.includes(String(e.id))).map(e => e.name);

  function selecionarCliente(c) {
    setBusca(c.nome_empresa);
    setListAberta(false);
    setF('clienteId', c.id);
    if (c.duracao_estimada_min)  setF('duracao', String(c.duracao_estimada_min));
    if (c.janela_entrada_inicio) setF('hora', c.janela_entrada_inicio.slice(0, 5));
    const servAtivos = (c.cliente_servicos ?? []).filter(s => s.ativo);
    setF('servicoId', servAtivos.length === 1 ? servAtivos[0].id : '');
  }

  function handleSubmit(forcar = false) {
    const payload = {
      ...form,
      // Quando não há cliente cadastrado, passa o nome digitado como nomeCliente
      nomeCliente:    !form.clienteId ? busca.trim() || null : null,
      enderecoTarefa: !form.clienteId ? form.enderecoTarefa || null : null,
    };
    if (forcar || erros.length === 0) {
      onSalvar(payload);
    }
  }

  const camposMinimos  = form.funcionariosIds.length > 0 && form.data;
  const semErros       = erros.length === 0;
  const podeSubmit     = camposMinimos && semErros;
  const podeForcar     = camposMinimos && !semErros;

  const overlayClose = useOverlayClose(onFechar);

  return (
    <div className="ec-overlay" {...overlayClose}>
      <div className="ec-modal">
        <header className="ec-modal__header">
          <h3 className="ec-modal__titulo">Adicionar Tarefa</h3>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">

          {/* ── Funcionário(s) + Data ── */}
          <div className="ec-grid2">
            <div className="ec-campo">
              <label>Funcionário(s) <span className="ec-req">*</span></label>
              <div className="ec-msel" ref={dropdownRef}>
                <button
                  type="button"
                  className={`ec-msel__trigger ${form.funcionariosIds.length > 0 ? 'ec-msel__trigger--sel' : ''}`}
                  onClick={() => setDropdownFuncsAberto(v => !v)}
                >
                  <span className="ec-msel__label">
                    {nomesFunc.length === 0
                      ? 'Selecione...'
                      : nomesFunc.length <= 2
                        ? nomesFunc.join(', ')
                        : `${nomesFunc.slice(0, 2).join(', ')} +${nomesFunc.length - 2}`}
                  </span>
                  <span className="ec-msel__arrow">{dropdownFuncsAberto ? '▴' : '▾'}</span>
                </button>
                {dropdownFuncsAberto && (
                  <div className="ec-msel__lista">
                    {funcionarios.map(emp => {
                      const sel = form.funcionariosIds.includes(String(emp.id));
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          className={`ec-msel__item ${sel ? 'ec-msel__item--sel' : ''}`}
                          onClick={() => toggleFuncionario(emp.id)}
                        >
                          <span className="ec-msel__check">{sel ? '✓' : ''}</span>
                          <span className="ec-msel__nome">{emp.name}</span>
                          {emp.cargo && <span className="ec-msel__cargo">{emp.cargo}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="ec-campo">
              <label>Data <span className="ec-req">*</span></label>
              <input type="date" value={form.data} onChange={e => setF('data', e.target.value)} />
            </div>
          </div>

          {/* ── Cliente / Local ── */}
          <div className="ec-campo">
            <label>Cliente / Local</label>
            <div className="ec-busca">
              <input
                className={`ec-busca__input ${form.clienteId ? 'ec-busca__input--sel' : ''}`}
                placeholder="Digite o nome do cliente ou local..."
                value={busca}
                onChange={e => { setBusca(e.target.value); setListAberta(true); if (form.clienteId) setF('clienteId', ''); }}
                onFocus={() => setListAberta(true)}
                onBlur={() => setTimeout(() => setListAberta(false), 150)}
                autoComplete="off"
              />
              {(form.clienteId || busca) && (
                <button className="ec-busca__clear" onClick={() => { setBusca(''); setF('clienteId', ''); setF('enderecoTarefa', ''); }}>✕</button>
              )}
              {listAberta && !form.clienteId && busca.trim() && (
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
            {clienteNaoCadastrado && (
              <span className="ec-aviso-nao-cad">⚠ Esse cliente ainda não foi cadastrado</span>
            )}
          </div>

          {/* Endereço — só aparece quando não há cliente cadastrado selecionado */}
          {clienteNaoCadastrado && (
            <div className="ec-campo">
              <label>
                Endereço
                <span className="ec-hint" style={{ marginLeft: 6 }}>(aparece no app para o colaborador abrir no Maps)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Av. Paulista, 1000 — Bela Vista, São Paulo"
                value={form.enderecoTarefa}
                onChange={e => setF('enderecoTarefa', e.target.value)}
              />
            </div>
          )}

          {/* Alertas de conflito de dia (só para clientes cadastrados) */}
          {clienteSel && (erros.length > 0 || avisos.length > 0) && (
            <div className="ec-alertas">
              {erros.map((e, i)  => <div key={i} className="ec-alerta ec-alerta--erro">✗ {e}</div>)}
              {avisos.map((a, i) => <div key={i} className="ec-alerta ec-alerta--aviso">⚠ {a}</div>)}
            </div>
          )}
          {clienteSel && erros.length === 0 && avisos.length === 0 && (
            <div className="ec-alerta ec-alerta--ok">✓ Dia disponível para este cliente</div>
          )}

          {/* ── Hora + Duração ── */}
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

          {/* Tipo de serviço — só quando há cliente cadastrado com serviços */}
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

          {/* ── Tipo de tarefa ── */}
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

          {/* ── Instruções ── */}
          <div className="ec-campo">
            <label>Instruções para o funcionário <span className="ec-hint">(aparece no celular; edite à vontade)</span></label>
            <textarea rows={3} value={form.obs} onChange={e => onObsChange(e.target.value)} placeholder="Instrução específica para esta tarefa..." />
          </div>

        </div>

        <footer className="ec-modal__footer">
          <button className="ec-btn ec-btn--sec" onClick={onFechar}>Cancelar</button>
          {podeForcar && !salvando && (
            <button
              className="ec-btn ec-btn--forcar"
              onClick={() => {
                if (confirm(`Este cliente tem restrição de dia, mas você quer forçar o agendamento.\n\n${erros.join('\n')}\n\nContinuar mesmo assim?`)) {
                  handleSubmit(true);
                }
              }}
            >
              ⚠ Adicionar mesmo assim
            </button>
          )}
          <button className="ec-btn ec-btn--pri" onClick={() => handleSubmit()} disabled={!podeSubmit || salvando}>
            {salvando ? 'Salvando...' : 'Adicionar Tarefa'}
          </button>
        </footer>
      </div>
    </div>
  );
}
