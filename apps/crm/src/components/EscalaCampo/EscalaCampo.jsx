// src/components/EscalaCampo/EscalaCampo.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const diff = day === 0 ? -6 : 1 - day;
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

// Intervalo (em dias) entre visitas por frequência
const FREQ_INTERVALO = {
  '3x_semana': 2,
  '2x_semana': 3,
  '1x_semana': 7,
  'quinzenal': 14,
  'mensal':    30,
};

const FREQ_LABEL_LOCAL = {
  '3x_semana': '3× semana',
  '2x_semana': '2× semana',
  '1x_semana': '1× semana',
  'quinzenal': 'quinzenal',
  'mensal':    'mensal',
};

const HORA_FIM_DIA_MIN = 15 * 60; // 15:00 → 900 min

// Dias entre duas datas ISO (yyyy-mm-dd)
function diasEntre(iso1, iso2) {
  const d1 = new Date(iso1 + 'T00:00');
  const d2 = new Date(iso2 + 'T00:00');
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

// Adiciona dias a uma data ISO
function addDias(iso, n) {
  const d = new Date(iso + 'T12:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Distância Haversine em km
function distanciaKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity;
  const R = 6371;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function horaEmMinutos(h) {
  if (!h) return null;
  const [hh, mm] = h.slice(0, 5).split(':').map(Number);
  return hh * 60 + mm;
}
function minutosParaHora(m) {
  const h = Math.floor(m / 60);
  const mn = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
}

// Calcula clientes atrasados / próximos do vencimento
// Retorna: { atrasado: [], vencendo: [] }
function calcClientesAtrasados(clientes, hoje) {
  const atrasado = [];
  const vencendo = [];
  clientes.forEach(c => {
    if (!c.frequencia_visita) return;
    const intervalo = FREQ_INTERVALO[c.frequencia_visita];
    if (!intervalo) return;
    // Se nunca teve visita, marca como atrasado (base)
    if (!c.ultima_visita) {
      atrasado.push({ ...c, diasAtraso: null, esperado: null, motivo: 'sem última visita registrada' });
      return;
    }
    const dias = diasEntre(c.ultima_visita, hoje);
    const atraso = dias - intervalo;
    if (atraso > 0) {
      atrasado.push({ ...c, diasAtraso: atraso, esperado: c.ultima_visita });
    } else if (atraso >= -3) {
      vencendo.push({ ...c, diasParaVencer: -atraso, esperado: addDias(c.ultima_visita, intervalo) });
    }
  });
  atrasado.sort((a, b) => (b.diasAtraso ?? 999) - (a.diasAtraso ?? 999));
  vencendo.sort((a, b) => a.diasParaVencer - b.diasParaVencer);
  return { atrasado, vencendo };
}

// Detecta conflitos de tempo em uma lista de visitas do dia
// Retorna: { sobreposicoes, estouraDia, fimMin, idsSobrepostos, idsEstouram, sugestoes }
// sugestoes = [{ visitaId, nome, horaAtual, horaSugerida, mudou }]
function calcConflitosDia(visitas) {
  const sobreposicoes = [];
  const idsSobrepostos = new Set();
  const idsEstouram    = new Set();
  const ordenadas = [...visitas].filter(v => v.hora_estimada_chegada).sort((a, b) => (a.hora_estimada_chegada ?? '').localeCompare(b.hora_estimada_chegada ?? ''));
  let fimMin = 0;
  for (let i = 0; i < ordenadas.length; i++) {
    const v = ordenadas[i];
    const inicio = horaEmMinutos(v.hora_estimada_chegada);
    const dur    = v.duracao_estimada_min ?? 60;
    const fim    = inicio + dur;
    fimMin = Math.max(fimMin, fim);
    if (fim > HORA_FIM_DIA_MIN) idsEstouram.add(v.id);
    if (i > 0) {
      const prev = ordenadas[i - 1];
      const inicioPrev = horaEmMinutos(prev.hora_estimada_chegada);
      const durPrev    = prev.duracao_estimada_min ?? 60;
      const fimPrev    = inicioPrev + durPrev;
      if (fimPrev > inicio) {
        sobreposicoes.push({ a: prev.id, b: v.id, atraso: fimPrev - inicio });
        idsSobrepostos.add(prev.id);
        idsSobrepostos.add(v.id);
      }
    }
  }

  // Sugestão: cascata mantendo a primeira visita, empurrando as seguintes
  // para começarem no fim da anterior. Só gera se houver sobreposição.
  const sugestoes = [];
  if (sobreposicoes.length > 0) {
    let fimAnterior = null;
    for (const v of ordenadas) {
      const inicio = horaEmMinutos(v.hora_estimada_chegada);
      const dur    = v.duracao_estimada_min ?? 60;
      const inicioSug = fimAnterior != null ? Math.max(inicio, fimAnterior) : inicio;
      sugestoes.push({
        visitaId:     v.id,
        nome:         v.clientes?.nome_empresa ?? '—',
        horaAtual:    minutosParaHora(inicio),
        horaSugerida: minutosParaHora(inicioSug),
        duracao:      dur,
        mudou:        inicioSug !== inicio,
      });
      fimAnterior = inicioSug + dur;
    }
  }

  return { sobreposicoes, estouraDia: fimMin > HORA_FIM_DIA_MIN, fimMin, idsSobrepostos, idsEstouram, sugestoes };
}

// Nearest-neighbor a partir da primeira visita (ou primeira com hora)
function otimizarRotaNN(visitas) {
  if (visitas.length < 2) return [];
  // Se alguma tem hora fixa, começa por essa
  const comHora = visitas.filter(v => v.hora_estimada_chegada);
  const start = comHora.length
    ? comHora.sort((a, b) => a.hora_estimada_chegada.localeCompare(b.hora_estimada_chegada))[0]
    : visitas[0];

  const restantes = new Set(visitas.map(v => v.id));
  const ordem = [];
  let atual = start;
  restantes.delete(atual.id);
  ordem.push(atual);
  while (restantes.size) {
    let melhor = null;
    let melhorDist = Infinity;
    for (const id of restantes) {
      const v = visitas.find(x => x.id === id);
      const d = distanciaKm(atual.clientes?.lat, atual.clientes?.lng, v.clientes?.lat, v.clientes?.lng);
      if (d < melhorDist) { melhorDist = d; melhor = v; }
    }
    if (!melhor) break;
    ordem.push(melhor);
    restantes.delete(melhor.id);
    atual = melhor;
  }
  return ordem;
}

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

function CartaoVisita({
  visita, isFirst, isLast,
  onCima, onBaixo, onDeletar,
  // drag
  onDragStart, onDragEnd, isDragging,
  // seleção
  modoSelecao, selecionada, onToggleSel,
  // conflitos
  emSobreposicao, estouraDia,
  // edição
  onEditar,
}) {
  const tipo   = visita.cliente_servicos?.tipo_servico;
  const status = visita.status;
  const editavel = status === 'rascunho';

  const classesConf = [
    emSobreposicao ? 'ec-cartao--conflito-sob' : '',
    estouraDia ? 'ec-cartao--conflito-fim' : '',
  ].filter(Boolean).join(' ');

  const tooltipConf = [
    emSobreposicao ? 'Horário sobreposto com outra visita' : null,
    estouraDia ? 'Esta visita passa das 15:00' : null,
  ].filter(Boolean).join(' · ');

  return (
    <div
      className={`ec-cartao ec-cartao--${status} ${isDragging ? 'ec-cartao--dragging' : ''} ${selecionada ? 'ec-cartao--sel' : ''} ${classesConf} ${editavel && !modoSelecao ? 'ec-cartao--clicavel' : ''}`}
      title={tooltipConf || (editavel && !modoSelecao ? 'Clique para editar · arraste para mover' : undefined)}
      draggable={editavel && !modoSelecao}
      onDragStart={editavel && !modoSelecao ? onDragStart : undefined}
      onDragEnd={onDragEnd}
      onClick={
        modoSelecao && editavel
          ? onToggleSel
          : (editavel && onEditar ? onEditar : undefined)
      }
    >
      {/* Checkbox de seleção */}
      {modoSelecao && editavel && (
        <button
          className={`ec-cartao__check ${selecionada ? 'ec-cartao__check--on' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleSel(); }}
          title={selecionada ? 'Desmarcar' : 'Selecionar'}
        >
          {selecionada ? '✓' : ''}
        </button>
      )}

      {/* Botões de reordenar (ocultos no modo seleção) */}
      {!modoSelecao && (
        <div className="ec-cartao__ordens">
          <button className="ec-cartao__ord" onClick={onCima}  disabled={isFirst || !editavel} title="Subir">▲</button>
          <button className="ec-cartao__ord" onClick={onBaixo} disabled={isLast  || !editavel} title="Descer">▼</button>
        </div>
      )}

      {tipo && (
        <span className="ec-cartao__tipo-bar" style={{ background: TIPO_COR[tipo] ?? '#888' }} title={TIPO_LABEL[tipo]} />
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

      {editavel && !modoSelecao && (
        <button className="ec-cartao__del" onClick={e => { e.stopPropagation(); onDeletar(); }} title="Remover">✕</button>
      )}
      {!editavel && (
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

function ModalAddVisita({ clientes, funcionarios, dataInicial, funcionarioIdInicial, clienteIdPre, onSalvar, onFechar, salvando }) {
  const [form, setForm] = useState({
    clienteId:     clienteIdPre ?? '',
    funcionarioId: funcionarioIdInicial ?? (funcionarios[0]?.id?.toString() ?? ''),
    data:          dataInicial,
    hora:          '07:00',
    duracao:       '',
    servicoId:     '',
    obs:           '',
  });

  // Se veio com cliente pré-selecionado, preenche dados iniciais
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

  const podeSubmit = form.clienteId && form.funcionarioId && form.data && erros.length === 0;

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
            <label>Observação do gestor <span className="ec-hint">(aparece no celular do funcionário)</span></label>
            <textarea rows={2} value={form.obs} onChange={e => setF('obs', e.target.value)} placeholder="Instrução específica para esta visita..." />
          </div>
        </div>

        <footer className="ec-modal__footer">
          <button className="ec-btn ec-btn--sec" onClick={onFechar}>Cancelar</button>
          <button className="ec-btn ec-btn--pri" onClick={() => onSalvar(form)} disabled={!podeSubmit || salvando}>
            {salvando ? 'Salvando...' : 'Adicionar Visita'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function EscalaCampo() {
  const [semana,      setSemana]      = useState(() => getSemana(new Date()));
  const [diaSel,      setDiaSel]      = useState(getHoje);
  const [employees,   setEmployees]   = useState([]);
  const [clientes,    setClientes]    = useState([]);
  const [agenda,      setAgenda]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null);
  const [salvando,    setSalvando]    = useState(false);

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  const [dragId,      setDragId]      = useState(null); // id da visita sendo arrastada
  const [dragOverEmp, setDragOverEmp] = useState(null); // empId da coluna com hover

  // ── Seleção múltipla ─────────────────────────────────────────────────────────
  const [modoSelecao,  setModoSelecao]  = useState(false);
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [movParaEmp,   setMovParaEmp]   = useState('');

  // ── Painéis / ações avançadas ────────────────────────────────────────────────
  const [showAtrasados, setShowAtrasados] = useState(false);
  const [otimizando,    setOtimizando]    = useState(null); // empId em otimização
  const [copiando,      setCopiando]      = useState(false);

  // ── Edição de visita ────────────────────────────────────────────────────────
  const [modalEdit,     setModalEdit]     = useState(null); // visita sendo editada
  const [salvandoEdit,  setSalvandoEdit]  = useState(false);

  // ── Tooltip global (para escapar overflow das colunas) ─────────────────────
  const [tooltip, setTooltip] = useState(null); // { x, y, sugestoes }

  const hoje = getHoje();

  // ── Dados estáticos ────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const [empRes, cliRes] = await Promise.all([
        supabase.from('employees').select('id, name, cargo').in('cargo', ['Campo', 'Facilities', 'TI']).order('name'),
        supabase.from('clientes')
          .select('id, nome_empresa, bairro, dias_disponiveis, janela_entrada_inicio, janela_entrada_fim, duracao_estimada_min, ultima_visita, frequencia_visita, lat, lng, cliente_servicos(id, tipo_servico, frequencia, ativo)')
          .eq('ativo', true).order('nome_empresa'),
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
      .select('*, clientes(nome_empresa, bairro, dias_disponiveis, janela_entrada_inicio, janela_entrada_fim, lat, lng), cliente_servicos(tipo_servico, frequencia)')
      .gte('data_agendada', semana[0])
      .lte('data_agendada', semana[5])
      .order('ordem_rota');
    setLoading(false);
    if (!error) setAgenda(data ?? []);
  }

  useEffect(() => { carregarAgenda(); }, [semana]); // eslint-disable-line

  // ── Derivações ─────────────────────────────────────────────────────────────

  const agendaOrg = useMemo(() => {
    const org = {};
    semana.forEach(d => { org[d] = {}; employees.forEach(e => { org[d][e.id] = []; }); });
    agenda.forEach(v => {
      const d = v.data_agendada, eid = v.funcionario_id;
      if (!org[d])     org[d]     = {};
      if (!org[d][eid]) org[d][eid] = [];
      org[d][eid].push(v);
    });
    Object.values(org).forEach(empMap =>
      Object.values(empMap).forEach(lista => lista.sort((a, b) => a.ordem_rota - b.ordem_rota))
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
      if (!vs.length)                             s[d] = 'vazio';
      else if (vs.some(v => v.status === 'rascunho')) s[d] = 'rascunho';
      else                                         s[d] = 'publicado';
    });
    return s;
  }, [agenda, semana]);

  const atrasados = useMemo(() => calcClientesAtrasados(clientes, hoje), [clientes, hoje]);

  const conflitosPorEmp = useMemo(() => {
    const c = {};
    employees.forEach(emp => {
      const visitas = agendaOrg[diaSel]?.[emp.id] ?? [];
      c[emp.id] = calcConflitosDia(visitas);
    });
    return c;
  }, [agendaOrg, employees, diaSel]);

  // ── Navegação de semana ────────────────────────────────────────────────────

  function navSemana(dir) {
    setSemana(prev => {
      const ref = new Date(prev[0] + 'T12:00');
      ref.setDate(ref.getDate() + dir * 7);
      return getSemana(ref);
    });
    cancelarSelecao();
  }

  function irHoje() {
    setSemana(getSemana(new Date()));
    setDiaSel(hoje);
    cancelarSelecao();
  }

  // ── Seleção ────────────────────────────────────────────────────────────────

  function toggleSel(id) {
    setSelecionadas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function cancelarSelecao() {
    setModoSelecao(false);
    setSelecionadas(new Set());
    setMovParaEmp('');
  }

  function ativarModoSelecao() {
    setModoSelecao(true);
    setSelecionadas(new Set());
    setMovParaEmp(employees[0]?.id?.toString() ?? '');
  }

  async function moverSelecionadasPara(novoEmpId) {
    if (!novoEmpId || !selecionadas.size) return;
    setSalvando(true);
    try {
      const ids = [...selecionadas];
      const visitasDestino = agendaOrg[diaSel]?.[novoEmpId] ?? [];
      const baseOrdem = visitasDestino.length > 0
        ? Math.max(...visitasDestino.map(v => v.ordem_rota)) + 1
        : 0;

      await Promise.all(
        ids.map((id, i) =>
          supabase.from('agenda').update({ funcionario_id: String(novoEmpId), ordem_rota: baseOrdem + i }).eq('id', id)
        )
      );
      cancelarSelecao();
      await carregarAgenda();
    } catch (e) {
      alert('Erro ao mover: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  function handleDragStart(visitaId) {
    setDragId(visitaId);
  }

  function handleDragEnd() {
    setDragId(null);
    setDragOverEmp(null);
  }

  async function handleDrop(toEmpId) {
    setDragOverEmp(null);
    if (!dragId) return;

    const visita = agenda.find(v => v.id === dragId);
    if (!visita || visita.status !== 'rascunho') return;
    if (String(visita.funcionario_id) === String(toEmpId)) return; // mesma coluna — sem ação

    const visitasDestino = agendaOrg[diaSel]?.[toEmpId] ?? [];
    const novaOrdem = visitasDestino.length > 0
      ? Math.max(...visitasDestino.map(v => v.ordem_rota)) + 1
      : 0;

    await supabase.from('agenda').update({ funcionario_id: String(toEmpId), ordem_rota: novaOrdem }).eq('id', dragId);
    setDragId(null);
    await carregarAgenda();
  }

  // ── Ações na agenda ───────────────────────────────────────────────────────

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
    const ids = agenda.filter(v => v.data_agendada === data && v.status === 'rascunho').map(v => v.id);
    if (!ids.length) return;
    await supabase.from('agenda').update({ status: 'publicado', publicado_em: new Date().toISOString() }).in('id', ids);
    await carregarAgenda();
  }

  // ── Copiar semana anterior ─────────────────────────────────────────────────

  async function copiarSemanaAnterior() {
    if (agenda.length > 0) {
      if (!confirm('Essa semana já tem visitas. Copiar da semana anterior vai adicionar em cima delas. Continuar?')) return;
    } else {
      if (!confirm('Copiar todas as visitas da semana anterior como rascunho para esta semana?')) return;
    }
    setCopiando(true);
    try {
      const anterior = getSemana(new Date(new Date(semana[0] + 'T12:00').getTime() - 7 * 86400000));
      const { data: visitasAnt, error } = await supabase
        .from('agenda')
        .select('cliente_id, funcionario_id, cliente_servico_id, hora_estimada_chegada, duracao_estimada_min, ordem_rota, observacoes_gestor, data_agendada')
        .gte('data_agendada', anterior[0])
        .lte('data_agendada', anterior[5]);
      if (error) throw error;
      if (!visitasAnt?.length) { alert('Nenhuma visita na semana anterior para copiar.'); return; }

      const novas = visitasAnt.map(v => {
        const idxDia = anterior.indexOf(v.data_agendada);
        return {
          cliente_id:            v.cliente_id,
          funcionario_id:        v.funcionario_id,
          cliente_servico_id:    v.cliente_servico_id,
          data_agendada:         semana[idxDia] ?? semana[0],
          hora_estimada_chegada: v.hora_estimada_chegada,
          duracao_estimada_min:  v.duracao_estimada_min,
          ordem_rota:            v.ordem_rota,
          observacoes_gestor:    v.observacoes_gestor,
          status:                'rascunho',
        };
      });
      const { error: insErr } = await supabase.from('agenda').insert(novas);
      if (insErr) throw insErr;
      await carregarAgenda();
      alert(`✓ ${novas.length} visita${novas.length !== 1 ? 's' : ''} copiada${novas.length !== 1 ? 's' : ''} como rascunho.`);
    } catch (e) {
      alert('Erro ao copiar: ' + e.message);
    } finally {
      setCopiando(false);
    }
  }

  // ── Otimizar rota do funcionário no dia ────────────────────────────────────

  async function otimizarRotaEmp(empId) {
    const lista = agendaOrg[diaSel]?.[empId] ?? [];
    const rascunhos = lista.filter(v => v.status === 'rascunho');
    if (rascunhos.length < 2) return;
    if (rascunhos.some(v => !v.clientes?.lat || !v.clientes?.lng)) {
      alert('Alguns clientes não têm coordenadas GPS. Preencha lat/lng no cadastro para otimizar a rota.');
      return;
    }
    const ordem = otimizarRotaNN(rascunhos);
    if (!ordem.length) return;

    setOtimizando(String(empId));
    try {
      await Promise.all(
        ordem.map((v, i) => supabase.from('agenda').update({ ordem_rota: i }).eq('id', v.id))
      );
      await carregarAgenda();
    } catch (e) {
      alert('Erro ao otimizar: ' + e.message);
    } finally {
      setOtimizando(null);
    }
  }

  // ── Salvar edição de visita ────────────────────────────────────────────────
  async function salvarEdicao(campos) {
    if (!modalEdit) return;
    setSalvandoEdit(true);
    try {
      const payload = {
        funcionario_id:        String(campos.funcionarioId),
        cliente_servico_id:    campos.servicoId || null,
        hora_estimada_chegada: campos.hora || null,
        duracao_estimada_min:  campos.duracao ? Number(campos.duracao) : null,
        observacoes_gestor:    campos.obs || null,
      };
      const { error } = await supabase.from('agenda').update(payload).eq('id', modalEdit.id);
      if (error) throw error;
      setModalEdit(null);
      await carregarAgenda();
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSalvandoEdit(false);
    }
  }

  // ── Adicionar visita a partir do painel "atrasados" ────────────────────────
  function abrirModalCliente(cliente) {
    setModal({
      funcionarioId: employees[0]?.id?.toString() ?? '',
      clienteIdPre:  cliente.id,
    });
    setShowAtrasados(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const visitasDiaSel = agendaOrg[diaSel] ?? {};
  const statusAtual   = statusDia[diaSel] ?? 'vazio';
  const temRascunho   = agenda.some(v => v.data_agendada === diaSel && v.status === 'rascunho');
  const qtdSel        = selecionadas.size;

  return (
    <div className="ec">

      {/* ── Cabeçalho ── */}
      <header className="ec__header">
        <div className="ec__header-esq">
          <h2 className="ec__titulo">Escala de Campo</h2>
          <p className="ec__sub">Agenda semanal de visitas · {employees.length} funcionários</p>
        </div>
        <div className="ec__header-dir">
          <button
            className={`ec__btn-atras ${atrasados.atrasado.length > 0 ? 'ec__btn-atras--alerta' : ''}`}
            onClick={() => setShowAtrasados(true)}
            title="Clientes atrasados ou vencendo"
          >
            ⚠ Atrasados
            {atrasados.atrasado.length > 0 && (
              <span className="ec__btn-atras-badge">{atrasados.atrasado.length}</span>
            )}
          </button>
          <button
            className="ec__btn-copiar"
            onClick={copiarSemanaAnterior}
            disabled={copiando}
            title="Copiar todas as visitas da semana anterior como rascunho"
          >
            {copiando ? '⏳ Copiando...' : '↺ Copiar semana anterior'}
          </button>
          <div className="ec__nav-semana">
            <button className="ec__nav-btn" onClick={() => navSemana(-1)}>‹</button>
            <span className="ec__semana-label">{formatarDia(semana[0])} – {formatarDia(semana[5])}</span>
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
              onClick={() => { setDiaSel(d); cancelarSelecao(); }}
            >
              <span className="ec__tab-dia">{DIAS_LABEL[diaId] ?? diaId}</span>
              <span className="ec__tab-data">{formatarDia(d)}</span>
              {count > 0 && <span className="ec__tab-count">{count}</span>}
              {status !== 'vazio' && (
                <span className={`ec__tab-dot ec__tab-dot--${status}`} title={status === 'publicado' ? 'Publicado' : 'Rascunho'} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Barra do dia ── */}
      <div className="ec__dia-bar">
        <div className="ec__dia-info">
          <span className="ec__dia-nome">{DIAS_NOME[getDiaId(diaSel)] ?? ''}, {formatarDia(diaSel)}</span>
          {diaSel === hoje && <span className="ec__hoje-tag">Hoje</span>}
          <span className={`ec__status-badge ec__status-badge--${statusAtual}`}>
            {statusAtual === 'publicado' ? '● Publicado' : statusAtual === 'rascunho' ? '○ Rascunho' : '○ Sem visitas'}
          </span>
        </div>
        <div className="ec__dia-acoes">
          {temRascunho && !modoSelecao && (
            <button className="ec__btn-publicar" onClick={() => publicarDia(diaSel)}>Publicar dia →</button>
          )}
          {!modoSelecao ? (
            <>
              {temRascunho && (
                <button className="ec__btn-sel" onClick={ativarModoSelecao}>☑ Selecionar</button>
              )}
              <button className="ec__btn-add" onClick={() => setModal({ funcionarioId: employees[0]?.id?.toString() ?? '' })}>
                + Adicionar Visita
              </button>
            </>
          ) : (
            <button className="ec__btn-sel ec__btn-sel--cancelar" onClick={cancelarSelecao}>✕ Cancelar seleção</button>
          )}
        </div>
      </div>

      {/* ── Colunas de funcionários ── */}
      {loading ? (
        <div className="ec__estado">
          <div className="ec__spinner" />
          <p>Carregando agenda...</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="ec__estado"><p>Nenhum funcionário de campo cadastrado.</p></div>
      ) : (
        <div className="ec__colunas">
          {employees.map(emp => {
            const visitas    = visitasDiaSel[emp.id] ?? [];
            const isDragAlvo = dragOverEmp === String(emp.id);
            const conflitos  = conflitosPorEmp[emp.id] ?? { sobreposicoes: [], estouraDia: false, fimMin: 0 };
            const rascunhos  = visitas.filter(v => v.status === 'rascunho').length;
            const podeOtimizar = rascunhos >= 2 && !modoSelecao;

            return (
              <div
                key={emp.id}
                className={`ec__coluna ${isDragAlvo ? 'ec__coluna--drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverEmp(String(emp.id)); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverEmp(null); }}
                onDrop={() => handleDrop(emp.id)}
              >
                <div className="ec__coluna-header">
                  <div>
                    <span className="ec__coluna-nome">{emp.name}</span>
                    <span className="ec__coluna-cargo">{emp.cargo}</span>
                  </div>
                  <div className="ec__coluna-header-dir">
                    {podeOtimizar && (
                      <button
                        className="ec__coluna-otim"
                        onClick={() => otimizarRotaEmp(emp.id)}
                        disabled={otimizando === String(emp.id)}
                        title="Reordena as visitas em rascunho por proximidade GPS (nearest-neighbor)"
                      >
                        {otimizando === String(emp.id) ? '⏳' : '🧭'}
                      </button>
                    )}
                    {visitas.length > 0 && (
                      <span className="ec__coluna-count">{visitas.length}</span>
                    )}
                  </div>
                </div>

                {(conflitos.sobreposicoes.length > 0 || conflitos.estouraDia) && (
                  <div className="ec__coluna-warns">
                    {conflitos.sobreposicoes.length > 0 && (
                      <span
                        className="ec__warn ec__warn--sob ec__warn--clicavel"
                        onMouseEnter={e => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            x: r.left,
                            y: r.bottom + 6,
                            sugestoes: conflitos.sugestoes ?? [],
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        ⚠ {conflitos.sobreposicoes.length} sobrepos{conflitos.sobreposicoes.length > 1 ? 'ições' : 'ição'}
                        <span className="ec__warn-help">?</span>
                      </span>
                    )}
                    {conflitos.estouraDia && (
                      <span className="ec__warn ec__warn--fim" title={`Última visita termina ${minutosParaHora(conflitos.fimMin)}`}>
                        ⚠ passa das 15:00 ({minutosParaHora(conflitos.fimMin)})
                      </span>
                    )}
                  </div>
                )}

                <div className="ec__coluna-visitas">
                  {visitas.length === 0 ? (
                    <p className="ec__coluna-vazio">
                      {isDragAlvo ? 'Solte aqui ↓' : 'Nenhuma visita agendada'}
                    </p>
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
                        onDragStart={() => handleDragStart(v.id)}
                        onDragEnd={handleDragEnd}
                        isDragging={dragId === v.id}
                        modoSelecao={modoSelecao}
                        selecionada={selecionadas.has(v.id)}
                        onToggleSel={() => toggleSel(v.id)}
                        emSobreposicao={conflitos.idsSobrepostos?.has(v.id)}
                        estouraDia={conflitos.idsEstouram?.has(v.id)}
                        onEditar={() => setModalEdit(v)}
                      />
                    ))
                  )}
                </div>

                {!modoSelecao && (
                  <button
                    className="ec__add-inline"
                    onClick={() => setModal({ funcionarioId: emp.id.toString() })}
                  >
                    + Adicionar visita
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Barra de ação: mover selecionadas ── */}
      {modoSelecao && (
        <div className="ec__bulk-bar">
          <span className="ec__bulk-info">
            {qtdSel === 0
              ? 'Clique nas visitas para selecioná-las'
              : `${qtdSel} visita${qtdSel !== 1 ? 's' : ''} selecionada${qtdSel !== 1 ? 's' : ''}`}
          </span>
          <div className="ec__bulk-acoes">
            <span className="ec__bulk-label">Mover para:</span>
            <select
              className="ec__bulk-select"
              value={movParaEmp}
              onChange={e => setMovParaEmp(e.target.value)}
            >
              {employees.map(emp => (
                <option key={emp.id} value={String(emp.id)}>{emp.name}</option>
              ))}
            </select>
            <button
              className="ec__bulk-btn"
              disabled={qtdSel === 0 || !movParaEmp || salvando}
              onClick={() => moverSelecionadasPara(movParaEmp)}
            >
              {salvando ? 'Movendo...' : 'Mover'}
            </button>
            <button className="ec__bulk-btn ec__bulk-btn--sec" onClick={cancelarSelecao}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Modal de adicionar visita ── */}
      {modal && (
        <ModalAddVisita
          clientes={clientes}
          funcionarios={employees}
          dataInicial={diaSel}
          funcionarioIdInicial={modal.funcionarioId}
          clienteIdPre={modal.clienteIdPre}
          onSalvar={adicionarVisita}
          onFechar={() => setModal(null)}
          salvando={salvando}
        />
      )}

      {/* ── Painel de clientes atrasados ── */}
      {showAtrasados && (
        <PainelAtrasados
          atrasados={atrasados}
          onFechar={() => setShowAtrasados(false)}
          onAgendar={abrirModalCliente}
        />
      )}

      {/* ── Modal de edição de visita ── */}
      {modalEdit && (
        <ModalEditVisita
          visita={modalEdit}
          funcionarios={employees}
          clientes={clientes}
          onSalvar={salvarEdicao}
          onFechar={() => setModalEdit(null)}
          salvando={salvandoEdit}
        />
      )}

      {/* ── Tooltip global de sugestões (portal) ── */}
      {tooltip && createPortal(
        <div
          className="ec__warn-tooltip ec__warn-tooltip--portal"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="ec__warn-tooltip__title">Horários sugeridos para eliminar sobreposições:</div>
          <table className="ec__warn-tooltip__table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Atual</th>
                <th>Sugerido</th>
              </tr>
            </thead>
            <tbody>
              {tooltip.sugestoes.map(s => (
                <tr key={s.visitaId} className={s.mudou ? 'ec__warn-tooltip__mudou' : ''}>
                  <td>{s.nome}</td>
                  <td>{s.horaAtual}</td>
                  <td>
                    <strong>{s.horaSugerida}</strong>
                    {s.mudou && <span className="ec__warn-tooltip__seta"> ←</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ec__warn-tooltip__hint">
            Clique numa visita para ajustar a hora manualmente.
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Modal de editar visita ────────────────────────────────────────────────
function ModalEditVisita({ visita, funcionarios, clientes, onSalvar, onFechar, salvando }) {
  const clienteCompleto = useMemo(
    () => clientes.find(c => c.id === visita.cliente_id),
    [clientes, visita.cliente_id]
  );
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

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="ec-modal">
        <header className="ec-modal__header">
          <div>
            <h3 className="ec-modal__titulo">Editar visita</h3>
            <p className="ec-modal__sub">{nomeCliente} · {dataFmt}</p>
          </div>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">
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
          <button className="ec-btn ec-btn--sec" onClick={onFechar}>Cancelar</button>
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

// ── Painel de clientes atrasados ────────────────────────────────────────────
function PainelAtrasados({ atrasados, onFechar, onAgendar }) {
  const [aba, setAba] = useState('atrasado');
  const lista = aba === 'atrasado' ? atrasados.atrasado : atrasados.vencendo;

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="ec-modal ec-modal--atras">
        <header className="ec-modal__header">
          <div>
            <h3 className="ec-modal__titulo">Clientes por prioridade</h3>
            <p className="ec-modal__sub">Baseado em <em>última visita</em> + <em>frequência</em></p>
          </div>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-atras__tabs">
          <button
            className={`ec-atras__tab ${aba === 'atrasado' ? 'ec-atras__tab--ativa' : ''}`}
            onClick={() => setAba('atrasado')}
          >
            🔴 Atrasados ({atrasados.atrasado.length})
          </button>
          <button
            className={`ec-atras__tab ${aba === 'vencendo' ? 'ec-atras__tab--ativa' : ''}`}
            onClick={() => setAba('vencendo')}
          >
            🟡 Vencendo em breve ({atrasados.vencendo.length})
          </button>
        </div>

        <div className="ec-modal__corpo">
          {lista.length === 0 ? (
            <div className="ec-atras__vazio">
              {aba === 'atrasado' ? '✓ Nenhum cliente atrasado.' : 'Nenhum cliente vencendo nos próximos 3 dias.'}
            </div>
          ) : (
            <div className="ec-atras__lista">
              {lista.map(c => (
                <div key={c.id} className={`ec-atras__item ec-atras__item--${aba}`}>
                  <div className="ec-atras__info">
                    <div className="ec-atras__nome">{c.nome_empresa}</div>
                    <div className="ec-atras__meta">
                      {c.bairro && <span>📍 {c.bairro}</span>}
                      {c.frequencia_visita && <span>· {FREQ_LABEL_LOCAL[c.frequencia_visita]}</span>}
                    </div>
                    <div className="ec-atras__hint">
                      {aba === 'atrasado' && c.diasAtraso != null && (
                        <>Última visita: {c.esperado ? new Date(c.esperado + 'T12:00').toLocaleDateString('pt-BR') : '—'} · <strong>{c.diasAtraso} dia{c.diasAtraso !== 1 ? 's' : ''} de atraso</strong></>
                      )}
                      {aba === 'atrasado' && c.diasAtraso == null && (
                        <>⚠ {c.motivo}</>
                      )}
                      {aba === 'vencendo' && (
                        <>Vence em <strong>{c.diasParaVencer} dia{c.diasParaVencer !== 1 ? 's' : ''}</strong> ({new Date(c.esperado + 'T12:00').toLocaleDateString('pt-BR')})</>
                      )}
                    </div>
                  </div>
                  <button className="ec-atras__btn" onClick={() => onAgendar(c)}>
                    + Agendar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
