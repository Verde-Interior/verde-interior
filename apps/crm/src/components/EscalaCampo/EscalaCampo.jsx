// src/components/EscalaCampo/EscalaCampo.jsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import './EscalaCampo.css';

// ── Constantes e helpers ──────────────────────────────────────────────────────

const DIA_ID_MAP = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const DIAS_LABEL = { segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb' };
const DIAS_NOME  = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado' };

const TIPO_LABEL = {
  manutencao: 'Manutenção', locacao: 'Locação',
  flores: 'Flores', reforma: 'Reforma', venda: 'Venda', evento: 'Evento',
};
const TIPO_COR = {
  manutencao: '#3D6B1E', locacao: '#2563EB',
  flores: '#9333EA', reforma: '#C47A1A', venda: '#1A7A4A', evento: '#C23B3B',
};

function getSemana(refDate) {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // volta para segunda-feira
  const seg = new Date(d);
  seg.setDate(d.getDate() + diff);
  return Array.from({ length: 6 }, (_, i) => {
    const curr = new Date(seg);
    curr.setDate(seg.getDate() + i);
    return curr.toISOString().split('T')[0];
  });
}

function getDiaId(iso) {
  return DIA_ID_MAP[new Date(iso + 'T12:00').getDay()];
}

function formatarDia(iso) {
  return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getHoje() {
  return new Date().toISOString().split('T')[0];
}

// ── Detecção de conflitos ─────────────────────────────────────────────────────

function verificarConflitos(cliente, isoDate) {
  const erros = [];
  const diaId = getDiaId(isoDate);
  if ((cliente.dias_disponiveis?.length ?? 0) > 0 && !cliente.dias_disponiveis.includes(diaId)) {
    const diasFormatados = (cliente.dias_disponiveis ?? []).map(d => DIAS_LABEL[d] ?? d).join(', ');
    erros.push(`${cliente.nome_empresa} não atende ${DIAS_NOME[diaId] ?? diaId}s · dias disponíveis: ${diasFormatados}`);
  }
  return erros;
}

function verificarHorario(cliente, hora) {
  const avisos = [];
  if (hora && cliente.janela_entrada_inicio && cliente.janela_entrada_fim) {
    const ini = cliente.janela_entrada_inicio.slice(0, 5);
    const fim = cliente.janela_entrada_fim.slice(0, 5);
    if (hora < ini || hora > fim) {
      avisos.push(`Janela de entrada: ${ini}–${fim} · você marcou ${hora}`);
    }
  }
  return avisos;
}

// ── Cartão de visita ──────────────────────────────────────────────────────────

function CartaoVisita({ visita, isFirst, isLast, onCima, onBaixo, onDeletar }) {
  const tipo   = visita.cliente_servicos?.tipo_servico;
  const status = visita.status;

  return (
    <div className={`ec-cartao ec-cartao--${status}`}>
      <div className="ec-cartao__ordens">
        <button className="ec-cartao__ord" onClick={onCima}  disabled={isFirst} title="Subir">▲</button>
        <button className="ec-cartao__ord" onClick={onBaixo} disabled={isLast}  title="Descer">▼</button>
      </div>

      {tipo && (
        <span
          className="ec-cartao__tipo-bar"
          style={{ background: TIPO_COR[tipo] ?? '#888' }}
          title={TIPO_LABEL[tipo]}
        />
      )}

      <div className="ec-cartao__info">
        <span className="ec-cartao__nome">{visita.clientes?.nome_empresa ?? '—'}</span>
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
      </div>

      {status === 'rascunho' && (
        <button className="ec-cartao__del" onClick={onDeletar} title="Remover">✕</button>
      )}
      {(status === 'publicado' || status === 'em_execucao' || status === 'concluido') && (
        <span
          className={`ec-cartao__pub ec-cartao__pub--${status}`}
          title={{ publicado: 'Publicado', em_execucao: 'Em execução', concluido: 'Concluído' }[status]}
        >
          {{ publicado: '●', em_execucao: '▶', concluido: '✓' }[status]}
        </span>
      )}
    </div>
  );
}

// ── Modal de adicionar visita ─────────────────────────────────────────────────

function ModalAddVisita({ clientes, funcionarios, dataInicial, funcionarioIdInicial, onSalvar, onFechar, salvando }) {
  const [form, setForm] = useState({
    clienteId:     '',
    funcionarioId: funcionarioIdInicial ?? (funcionarios[0]?.id?.toString() ?? ''),
    data:          dataInicial,
    hora:          '07:00',
    duracao:       '',
    servicoId:     '',
    obs:           '',
  });
  const [busca,    setBusca]    = useState('');
  const [listAberta, setListAberta] = useState(false);

  const clienteSel = useMemo(
    () => clientes.find(c => c.id === form.clienteId) ?? null,
    [clientes, form.clienteId]
  );

  const clientesFilt = useMemo(() => {
    const q = busca.toLowerCase();
    return q
      ? clientes.filter(c => c.nome_empresa.toLowerCase().includes(q) || c.bairro?.toLowerCase().includes(q))
      : clientes.slice(0, 10);
  }, [clientes, busca]);

  const servicos = useMemo(
    () => (clienteSel?.cliente_servicos ?? []).filter(s => s.ativo),
    [clienteSel]
  );

  const { erros, avisos } = useMemo(() => {
    if (!clienteSel) return { erros: [], avisos: [] };
    return {
      erros:  verificarConflitos(clienteSel, form.data),
      avisos: verificarHorario(clienteSel, form.hora),
    };
  }, [clienteSel, form.data, form.hora]);

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function selecionarCliente(c) {
    setBusca(c.nome_empresa);
    setListAberta(false);
    setF('clienteId', c.id);
    if (c.duracao_estimada_min)  setF('duracao', String(c.duracao_estimada_min));
    if (c.janela_entrada_inicio) setF('hora', c.janela_entrada_inicio.slice(0, 5));
    const servAtivos = (c.cliente_servicos ?? []).filter(s => s.ativo);
    if (servAtivos.length === 1) setF('servicoId', servAtivos[0].id);
    else setF('servicoId', '');
  }

  const podeSubmit = form.clienteId && form.funcionarioId && form.data && erros.length === 0;

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="ec-modal">

        <header className="ec-modal__header">
          <h3 className="ec-modal__titulo">Adicionar Visita</h3>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">

          {/* Funcionário + Data */}
          <div className="ec-grid2">
            <div className="ec-campo">
              <label>Funcionário <span className="ec-req">*</span></label>
              <select value={form.funcionarioId} onChange={e => setF('funcionarioId', e.target.value)}>
                {funcionarios.map(emp => (
                  <option key={emp.id} value={String(emp.id)}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div className="ec-campo">
              <label>Data <span className="ec-req">*</span></label>
              <input type="date" value={form.data} onChange={e => setF('data', e.target.value)} />
            </div>
          </div>

          {/* Busca de cliente */}
          <div className="ec-campo">
            <label>Cliente <span className="ec-req">*</span></label>
            <div className="ec-busca">
              <input
                className={`ec-busca__input ${form.clienteId ? 'ec-busca__input--sel' : ''}`}
                placeholder="Digite o nome ou bairro..."
                value={busca}
                onChange={e => {
                  setBusca(e.target.value);
                  setListAberta(true);
                  if (form.clienteId) setF('clienteId', '');
                }}
                onFocus={() => setListAberta(true)}
                autoComplete="off"
              />
              {form.clienteId && (
                <button className="ec-busca__clear" onClick={() => { setBusca(''); setF('clienteId', ''); setListAberta(false); }}>✕</button>
              )}
              {listAberta && !form.clienteId && (
                <div className="ec-busca__lista">
                  {clientesFilt.length === 0 ? (
                    <p className="ec-busca__vazio">Nenhum cliente encontrado</p>
                  ) : (
                    clientesFilt.slice(0, 8).map(c => (
                      <button key={c.id} className="ec-busca__item" onMouseDown={() => selecionarCliente(c)}>
                        <span className="ec-busca__item-nome">{c.nome_empresa}</span>
                        {c.bairro && <span className="ec-busca__item-bairro">{c.bairro}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Conflitos e avisos */}
          {clienteSel && (erros.length > 0 || avisos.length > 0) && (
            <div className="ec-alertas">
              {erros.map((e, i) => (
                <div key={i} className="ec-alerta ec-alerta--erro">✗ {e}</div>
              ))}
              {avisos.map((a, i) => (
                <div key={i} className="ec-alerta ec-alerta--aviso">⚠ {a}</div>
              ))}
            </div>
          )}

          {/* Confirmação de cliente selecionado */}
          {clienteSel && erros.length === 0 && avisos.length === 0 && (
            <div className="ec-alerta ec-alerta--ok">✓ Dia disponível para este cliente</div>
          )}

          {/* Hora + Duração */}
          <div className="ec-grid2">
            <div className="ec-campo">
              <label>Hora estimada de chegada</label>
              <input
                type="time"
                value={form.hora}
                onChange={e => setF('hora', e.target.value)}
              />
            </div>
            <div className="ec-campo">
              <label>Duração (min)</label>
              <input
                type="number"
                min="15"
                step="15"
                value={form.duracao}
                onChange={e => setF('duracao', e.target.value)}
                placeholder={clienteSel?.duracao_estimada_min ? `${clienteSel.duracao_estimada_min}` : 'Ex: 90'}
              />
            </div>
          </div>

          {/* Serviço */}
          {servicos.length > 0 && (
            <div className="ec-campo">
              <label>Tipo de serviço</label>
              <select value={form.servicoId} onChange={e => setF('servicoId', e.target.value)}>
                <option value="">Não especificar</option>
                {servicos.map(s => (
                  <option key={s.id} value={s.id}>
                    {TIPO_LABEL[s.tipo_servico] ?? s.tipo_servico} · {s.frequencia}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Observação */}
          <div className="ec-campo">
            <label>Observação do gestor <span className="ec-hint">(aparece no celular do funcionário)</span></label>
            <textarea
              rows={2}
              value={form.obs}
              onChange={e => setF('obs', e.target.value)}
              placeholder="Instrução específica para esta visita..."
            />
          </div>
        </div>

        <footer className="ec-modal__footer">
          <button className="ec-btn ec-btn--sec" onClick={onFechar}>Cancelar</button>
          <button
            className="ec-btn ec-btn--pri"
            onClick={() => onSalvar(form)}
            disabled={!podeSubmit || salvando}
          >
            {salvando ? 'Salvando...' : 'Adicionar Visita'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function EscalaCampo() {
  const [semana,    setSemana]    = useState(() => getSemana(new Date()));
  const [diaSel,   setDiaSel]    = useState(getHoje);
  const [employees, setEmployees] = useState([]);
  const [clientes,  setClientes]  = useState([]);
  const [agenda,    setAgenda]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null); // null | { funcionarioId }
  const [salvando,  setSalvando]  = useState(false);

  const hoje = getHoje();

  // ── Dados estáticos ────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const [empRes, cliRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, name, cargo')
          .in('cargo', ['Campo', 'Facilities'])
          .order('name'),
        supabase
          .from('clientes')
          .select('id, nome_empresa, bairro, dias_disponiveis, janela_entrada_inicio, janela_entrada_fim, duracao_estimada_min, cliente_servicos(id, tipo_servico, frequencia, ativo)')
          .eq('ativo', true)
          .order('nome_empresa'),
      ]);
      if (!empRes.error) setEmployees(empRes.data  ?? []);
      if (!cliRes.error) setClientes(cliRes.data   ?? []);
    }
    init();
  }, []);

  // ── Agenda da semana ───────────────────────────────────────────────────────

  async function carregarAgenda() {
    setLoading(true);
    const { data, error } = await supabase
      .from('agenda')
      .select('*, clientes(nome_empresa, bairro, dias_disponiveis, janela_entrada_inicio, janela_entrada_fim), cliente_servicos(tipo_servico, frequencia)')
      .gte('data_agendada', semana[0])
      .lte('data_agendada', semana[5])
      .order('ordem_rota');
    setLoading(false);
    if (!error) setAgenda(data ?? []);
  }

  useEffect(() => { carregarAgenda(); }, [semana]); // eslint-disable-line

  // ── Derivações ─────────────────────────────────────────────────────────────

  // { [date]: { [empId]: [visitas ordenadas por ordem_rota] } }
  const agendaOrg = useMemo(() => {
    const org = {};
    semana.forEach(d => {
      org[d] = {};
      employees.forEach(e => { org[d][e.id] = []; });
    });
    agenda.forEach(v => {
      const d   = v.data_agendada;
      const eid = v.funcionario_id;
      if (!org[d])     org[d]     = {};
      if (!org[d][eid]) org[d][eid] = [];
      org[d][eid].push(v);
    });
    Object.values(org).forEach(empMap =>
      Object.values(empMap).forEach(lista =>
        lista.sort((a, b) => a.ordem_rota - b.ordem_rota)
      )
    );
    return org;
  }, [agenda, semana, employees]);

  const countsPorDia = useMemo(() => {
    const c = {};
    semana.forEach(d => { c[d] = agenda.filter(v => v.data_agendada === d).length; });
    return c;
  }, [agenda, semana]);

  const statusDia = useMemo(() => {
    const s = {};
    semana.forEach(d => {
      const vs = agenda.filter(v => v.data_agendada === d);
      if (vs.length === 0)                           s[d] = 'vazio';
      else if (vs.some(v => v.status === 'rascunho')) s[d] = 'rascunho';
      else                                            s[d] = 'publicado';
    });
    return s;
  }, [agenda, semana]);

  // ── Navegação de semana ────────────────────────────────────────────────────

  function navSemana(dir) {
    setSemana(prev => {
      const ref = new Date(prev[0] + 'T12:00');
      ref.setDate(ref.getDate() + dir * 7);
      return getSemana(ref);
    });
  }

  function irHoje() {
    setSemana(getSemana(new Date()));
    setDiaSel(hoje);
  }

  // ── Ações ──────────────────────────────────────────────────────────────────

  async function adicionarVisita(form) {
    setSalvando(true);
    try {
      const visitasEmpDia = agendaOrg[form.data]?.[form.funcionarioId] ?? [];
      const proximaOrdem = visitasEmpDia.length > 0
        ? Math.max(...visitasEmpDia.map(v => v.ordem_rota)) + 1
        : 0;

      const { error } = await supabase.from('agenda').insert({
        cliente_id:            form.clienteId,
        funcionario_id:        String(form.funcionarioId),
        cliente_servico_id:    form.servicoId || null,
        data_agendada:         form.data,
        hora_estimada_chegada: form.hora || null,
        duracao_estimada_min:  form.duracao ? Number(form.duracao) : null,
        observacoes_gestor:    form.obs || null,
        ordem_rota:            proximaOrdem,
        status:                'rascunho',
      });
      if (error) throw error;
      setModal(null);
      await carregarAgenda();
    } catch (e) {
      alert('Erro ao adicionar visita: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function moverVisita(visita, dir) {
    const lista = [...(agendaOrg[visita.data_agendada]?.[visita.funcionario_id] ?? [])];
    const idx   = lista.findIndex(v => v.id === visita.id);
    const alvo  = lista[idx + dir];
    if (!alvo) return;
    await Promise.all([
      supabase.from('agenda').update({ ordem_rota: alvo.ordem_rota }).eq('id', visita.id),
      supabase.from('agenda').update({ ordem_rota: visita.ordem_rota }).eq('id', alvo.id),
    ]);
    await carregarAgenda();
  }

  async function deletarVisita(id) {
    await supabase.from('agenda').delete().eq('id', id);
    await carregarAgenda();
  }

  async function publicarDia(data) {
    const ids = agenda
      .filter(v => v.data_agendada === data && v.status === 'rascunho')
      .map(v => v.id);
    if (!ids.length) return;
    await supabase
      .from('agenda')
      .update({ status: 'publicado', publicado_em: new Date().toISOString() })
      .in('id', ids);
    await carregarAgenda();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const visitasDiaSel = agendaOrg[diaSel] ?? {};
  const statusAtual   = statusDia[diaSel] ?? 'vazio';
  const temRascunho   = agenda.some(v => v.data_agendada === diaSel && v.status === 'rascunho');

  return (
    <div className="ec">

      {/* ── Cabeçalho ── */}
      <header className="ec__header">
        <div className="ec__header-esq">
          <h2 className="ec__titulo">Escala de Campo</h2>
          <p className="ec__sub">Agenda semanal de visitas · {employees.length} funcionários</p>
        </div>
        <div className="ec__header-dir">
          <div className="ec__nav-semana">
            <button className="ec__nav-btn" onClick={() => navSemana(-1)}>‹</button>
            <span className="ec__semana-label">
              {formatarDia(semana[0])} – {formatarDia(semana[5])}
            </span>
            <button className="ec__nav-btn" onClick={() => navSemana(+1)}>›</button>
          </div>
          <button className="ec__btn-hoje" onClick={irHoje}>Hoje</button>
        </div>
      </header>

      {/* ── Tabs dos dias ── */}
      <div className="ec__tabs">
        {semana.map(d => {
          const diaId  = getDiaId(d);
          const count  = countsPorDia[d] ?? 0;
          const status = statusDia[d] ?? 'vazio';
          return (
            <button
              key={d}
              className={`ec__tab ${d === diaSel ? 'ec__tab--ativo' : ''} ${d === hoje ? 'ec__tab--hoje' : ''}`}
              onClick={() => setDiaSel(d)}
            >
              <span className="ec__tab-dia">{DIAS_LABEL[diaId] ?? diaId}</span>
              <span className="ec__tab-data">{formatarDia(d)}</span>
              {count > 0 && <span className="ec__tab-count">{count}</span>}
              {status !== 'vazio' && (
                <span
                  className={`ec__tab-dot ec__tab-dot--${status}`}
                  title={status === 'publicado' ? 'Publicado' : 'Rascunho'}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Barra do dia selecionado ── */}
      <div className="ec__dia-bar">
        <div className="ec__dia-info">
          <span className="ec__dia-nome">
            {DIAS_NOME[getDiaId(diaSel)] ?? ''}, {formatarDia(diaSel)}
          </span>
          {diaSel === hoje && <span className="ec__hoje-tag">Hoje</span>}
          <span className={`ec__status-badge ec__status-badge--${statusAtual}`}>
            {statusAtual === 'publicado' ? '● Publicado' : statusAtual === 'rascunho' ? '○ Rascunho' : '○ Sem visitas'}
          </span>
        </div>
        <div className="ec__dia-acoes">
          {temRascunho && (
            <button className="ec__btn-publicar" onClick={() => publicarDia(diaSel)}>
              Publicar dia →
            </button>
          )}
          <button
            className="ec__btn-add"
            onClick={() => setModal({ funcionarioId: employees[0]?.id?.toString() ?? '' })}
          >
            + Adicionar Visita
          </button>
        </div>
      </div>

      {/* ── Colunas de funcionários ── */}
      {loading ? (
        <div className="ec__estado">
          <div className="ec__spinner" />
          <p>Carregando agenda...</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="ec__estado">
          <p>Nenhum funcionário de campo cadastrado.</p>
        </div>
      ) : (
        <div className="ec__colunas">
          {employees.map(emp => {
            const visitas = visitasDiaSel[emp.id] ?? [];
            return (
              <div key={emp.id} className="ec__coluna">
                <div className="ec__coluna-header">
                  <div>
                    <span className="ec__coluna-nome">{emp.name}</span>
                    <span className="ec__coluna-cargo">{emp.cargo}</span>
                  </div>
                  {visitas.length > 0 && (
                    <span className="ec__coluna-count">{visitas.length}</span>
                  )}
                </div>

                <div className="ec__coluna-visitas">
                  {visitas.length === 0 ? (
                    <p className="ec__coluna-vazio">Nenhuma visita agendada</p>
                  ) : (
                    visitas.map((v, idx) => (
                      <CartaoVisita
                        key={v.id}
                        visita={v}
                        isFirst={idx === 0}
                        isLast={idx === visitas.length - 1}
                        onCima={() => moverVisita(v, -1)}
                        onBaixo={() => moverVisita(v, +1)}
                        onDeletar={() => deletarVisita(v.id)}
                      />
                    ))
                  )}
                </div>

                <button
                  className="ec__add-inline"
                  onClick={() => setModal({ funcionarioId: emp.id.toString() })}
                >
                  + Adicionar visita
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal de adicionar visita ── */}
      {modal && (
        <ModalAddVisita
          clientes={clientes}
          funcionarios={employees}
          dataInicial={diaSel}
          funcionarioIdInicial={modal.funcionarioId}
          onSalvar={adicionarVisita}
          onFechar={() => setModal(null)}
          salvando={salvando}
        />
      )}
    </div>
  );
}
