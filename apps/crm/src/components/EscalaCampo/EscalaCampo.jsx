// src/components/EscalaCampo/EscalaCampo.jsx
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import { dateParaISO, addDias, getSemana as getSemanaUtil, getDiaSlug as getDiaSlugUtil, formatarDataCurta } from '../../utils/dateUtils';
import { supabase } from '../../lib/supabase';
import {
  DIAS_LABEL, DIAS_NOME,
  checarRestricoes, bloqueioNoDia,
  calcPrioridade, calcClientesAtrasados, calcConflitosDia,
  calcularAlertaFalta,
} from '../../utils/escalaHelpers';
import { minutosParaHora, otimizarRotaComRestricoes } from '../../utils/otimizadorRota';
import CartaoVisita from './CartaoVisita';
import ModalAddVisita from './ModalAddVisita';
import ModalEditVisita from './ModalEditVisita';
import ModalDuplicarVisita from './ModalDuplicarVisita';
import ModalRelatorioVisita from './ModalRelatorioVisita';
import ModalPreviewRota from './ModalPreviewRota';
import ModalRedistribuir from './ModalRedistribuir';
import ModalBloqueios from './ModalBloqueios';
import PainelAtrasados from './PainelAtrasados';
import ModalCopiarAgenda from './ModalCopiarAgenda';
import EscalaCalendario from './EscalaCalendario';
import { addMes } from '../../utils/calendarioUtils';
import './EscalaCampo.css';

// ── Wrappers finos para os utils centralizados (mantém API interna do arquivo) ──
const getSemana   = ref => getSemanaUtil(ref);
const getDiaId    = iso => getDiaSlugUtil(iso);
const formatarDia = iso => formatarDataCurta(iso);
const getHoje     = () => dateParaISO(new Date());

const ORDEM_COLUNAS_KEY = 'vi-escala-ordem-funcionarios';

// Ícone de "pode arrastar" — mesmo desenho do DragHandle do Dashboard, pra
// manter o mesmo sinal visual de reordenável em telas diferentes.
function DragHandleColuna() {
  return (
    <span className="ec__coluna-handle" title="Arraste para reorganizar">
      <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
        <circle cx="3" cy="2.5"  r="1.4" fill="currentColor"/>
        <circle cx="7" cy="2.5"  r="1.4" fill="currentColor"/>
        <circle cx="3" cy="7"    r="1.4" fill="currentColor"/>
        <circle cx="7" cy="7"    r="1.4" fill="currentColor"/>
        <circle cx="3" cy="11.5" r="1.4" fill="currentColor"/>
        <circle cx="7" cy="11.5" r="1.4" fill="currentColor"/>
      </svg>
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function EscalaCampo() {
  const [semana,      setSemana]      = useState(() => getSemana(new Date()));
  const [diaSel,      setDiaSel]      = useState(getHoje);
  const [employees,   setEmployees]   = useState([]);
  const [clientes,    setClientes]    = useState([]);
  const [agenda,      setAgenda]      = useState([]);
  const [bloqueios,   setBloqueios]   = useState([]);
  const [checkins,    setCheckins]    = useState(new Map()); // agendamento_id -> checkin_at
  const [modalBloqueio, setModalBloqueio] = useState(null); // { funcionarioId? }
  const [modalRedistrib, setModalRedistrib] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null);
  const [salvando,    setSalvando]    = useState(false);

  // ── Visão de calendário (quinzenal/mês) — complementa a Semana ──────────────
  const [modoVisao,   setModoVisao]   = useState('semana'); // 'semana' | 'quinzenal' | 'mes'
  const hojeDate = new Date();
  const [calAno,       setCalAno]       = useState(hojeDate.getFullYear());
  const [calMes,       setCalMes]       = useState(hojeDate.getMonth());
  const [quinzenaBase, setQuinzenaBase] = useState(getHoje);
  const [agendaCalendario, setAgendaCalendario] = useState([]);
  const [loadingCal,       setLoadingCal]       = useState(false);

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  const [dragId,      setDragId]      = useState(null); // id da visita sendo arrastada
  const [dragOverEmp, setDragOverEmp] = useState(null); // empId da coluna com hover

  // ── Ordem das colunas de funcionário (arrastar pra reorganizar) ────────────
  // Salva só no navegador (localStorage), igual ao mesmo recurso já usado nos
  // blocos do Dashboard — cada gestor organiza do seu jeito, sem afetar os
  // outros. Se um dia precisar ficar igual pra todo mundo, troca só a leitura/
  // gravação abaixo por uma tabela no banco; o drag-and-drop em si não muda.
  const [ordemColunas, setOrdemColunas] = useState(() => {
    try {
      const s = localStorage.getItem(ORDEM_COLUNAS_KEY);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });
  // Estado de verdade (não ref) — mutar uma ref não re-renderiza, então a
  // classe visual de "arrastando" ficava dependendo de algum outro re-render
  // acontecer por acaso pra atualizar, travando cinza às vezes.
  const [colDragSrc, setColDragSrc] = useState(null); // id do funcionário sendo arrastado (coluna)
  const [colDragOver, setColDragOver] = useState(null); // id do funcionário-alvo

  useEffect(() => {
    localStorage.setItem(ORDEM_COLUNAS_KEY, JSON.stringify(ordemColunas));
  }, [ordemColunas]);

  // ── Seleção múltipla ─────────────────────────────────────────────────────────
  const [modoSelecao,  setModoSelecao]  = useState(false);
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [movParaEmp,   setMovParaEmp]   = useState('');

  // ── Painéis / ações avançadas ────────────────────────────────────────────────
  const [showAtrasados,   setShowAtrasados]   = useState(false);
  const [otimizando,      setOtimizando]      = useState(null); // empId em otimização
  const [modalCopiar,     setModalCopiar]     = useState(false);
  const [mostrarPrioridade, setMostrarPrioridade] = useState(false);

  // ── Edição de visita ────────────────────────────────────────────────────────
  const [modalEdit,     setModalEdit]     = useState(null); // visita sendo editada
  const [modalRel,      setModalRel]      = useState(null); // visita cujo relatório está aberto
  const [salvandoEdit,  setSalvandoEdit]  = useState(false);

  // ── Tooltip global (para escapar overflow das colunas) ─────────────────────
  const [tooltip, setTooltip] = useState(null); // { x, y, sugestoes }

  // ── Preview da rota otimizada (quando difere da rota geográfica pura) ──────
  const [previewRota, setPreviewRota] = useState(null); // { empId, resultado }

  const hoje = getHoje();

  // ── Relógio pro alerta de falta (atrasado / possível falta) ────────────────
  // Recalcula a cada minuto pra o alerta avançar sozinho na tela, sem precisar
  // recarregar a agenda.
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // ── Dados estáticos ────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const [empRes, cliRes, bloqRes] = await Promise.all([
        supabase.from('employees').select('id, name, cargo, daily_hours').in('cargo', ['Campo', 'Facilities', 'TI', 'Sócio/Campo']).order('name'),
        supabase.from('clientes')
          .select('id, nome_empresa, endereco, bairro, dias_disponiveis, janela_entrada_inicio, janela_entrada_fim, duracao_estimada_min, ultima_visita, frequencia_visita, lat, lng, cliente_servicos(id, tipo_servico, frequencia, ativo)')
          .eq('ativo', true).order('nome_empresa'),
        supabase.from('employee_bloqueios').select('*').order('data_inicio'),
      ]);
      if (!empRes.error) setEmployees(empRes.data  ?? []);
      if (!cliRes.error) setClientes(cliRes.data   ?? []);
      if (!bloqRes.error) setBloqueios(bloqRes.data ?? []);
    }
    init();
  }, []);

  async function recarregarBloqueios() {
    const { data } = await supabase.from('employee_bloqueios').select('*').order('data_inicio');
    setBloqueios(data ?? []);
  }

  // ── Agenda da semana ───────────────────────────────────────────────────────

  async function carregarAgenda() {
    setLoading(true);
    // Agora agenda pode vir vinculada a cliente OU a lead (migration 016).
    // Fazemos left joins nas duas tabelas; a que estiver preenchida no row
    // é a fonte de dados exibidos no cartão.
    const { data, error } = await supabase
      .from('agenda')
      .select('*, nome_cliente, endereco_tarefa, clientes(nome_empresa, endereco, bairro, dias_disponiveis, janela_entrada_inicio, janela_entrada_fim, lat, lng, ultima_visita, frequencia_visita), cliente_servicos(tipo_servico, frequencia), leads(empresa, bairro, contato, telefone, endereco, lat, lng, tipos_servico, frequencia_visita)')
      .gte('data_agendada', semana[0])
      .lte('data_agendada', semana[6])
      .neq('status', 'cancelado')
      .order('hora_estimada_chegada', { ascending: true, nullsFirst: false });
    setLoading(false);
    if (!error) {
      // Compat: cartões e modais da Escala esperam sempre `v.clientes`.
      // Quando a visita veio de um lead (lead_id != null e cliente_id == null),
      // copiamos os campos essenciais do lead pra dentro de `.clientes`,
      // marcamos `__isLead` e fabricamos um id sintético com prefixo `lead-`
      // pra distinguir claramente de ids reais de cliente cadastrado.
      const enriched = (data ?? []).map((v) => {
        // Tarefa interna: sem cliente nem lead — usa nome_cliente/endereco_tarefa
        if (!v.clientes && !v.leads && v.nome_cliente) {
          return {
            ...v,
            __isTarefa: true,
            clientes: {
              id:           null,
              __isTarefa:   true,
              nome_empresa: v.nome_cliente,
              endereco:     v.endereco_tarefa ?? '',
              bairro:       '',
              lat:          null,
              lng:          null,
              cliente_servicos: [],
            },
          };
        }
        if (!v.clientes && v.leads) {
          const tipoPrimario = Array.isArray(v.leads.tipos_servico) && v.leads.tipos_servico.length
            ? v.leads.tipos_servico[0]
            : null;
          // Serviço sintético com id prefixado — ArrayVisita e ModalEditVisita
          // usam esse id como chave; prefixo `lead-` evita colisão com id real.
          const servicoSintetico = tipoPrimario ? {
            id:           `lead-${v.leads.id}-${tipoPrimario}`,
            tipo_servico: tipoPrimario,
            frequencia:   v.leads.frequencia_visita ?? null,
            ativo:        true,
            __isLead:     true,
          } : null;
          return {
            ...v,
            __isLead: true,
            leadId:   v.leads.id,
            clientes: {
              id:                `lead-${v.leads.id}`,   // id sintético prefixado
              __isLead:          true,
              nome_empresa:      v.leads.empresa,
              bairro:            v.leads.bairro,
              lat:               v.leads.lat,
              lng:               v.leads.lng,
              frequencia_visita: v.leads.frequencia_visita,
              contato_nome:      v.leads.contato,
              contato_telefone:  v.leads.telefone,
              endereco:          v.leads.endereco,
              // Array (mesma shape de cliente real) — consumido pelo ModalEditVisita
              cliente_servicos:  servicoSintetico ? [servicoSintetico] : [],
              // dias_disponiveis, janela_entrada_* ausentes ⇒ sem restrição pro otimizador.
            },
            // Objeto único (join FK do agenda.cliente_servico_id) — consumido pelo CartaoVisita
            cliente_servicos: v.cliente_servicos ?? servicoSintetico,
          };
        }
        return v;
      });
      setAgenda(enriched);

      // Busca check-ins da semana carregada, pra saber quais visitas
      // publicadas já tiveram o colaborador chegando de fato (usado no
      // alerta de atraso/possível falta — ver calcularAlertaFalta).
      const ids = enriched.map(v => v.id);
      if (ids.length) {
        const { data: relData } = await supabase
          .from('relatorios')
          .select('agendamento_id, checkin_at')
          .in('agendamento_id', ids);
        setCheckins(new Map((relData ?? []).map(r => [r.agendamento_id, r.checkin_at])));
      } else {
        setCheckins(new Map());
      }
    }
  }

  useEffect(() => { carregarAgenda(); }, [semana]); // eslint-disable-line

  // ── Dados pra visão de calendário (quinzenal/mês) ───────────────────────────
  // Busca separada da agenda da Semana: intervalo maior (14 ou ~35 dias) e só
  // os campos necessários pro resumo por dia — não reaproveita `agenda`/
  // `carregarAgenda` pra não arriscar mexer no pipeline já testado da Semana.
  function rangeDoMes(ano, mes) {
    const primeiro = new Date(ano, mes, 1);
    const inicio = new Date(primeiro); inicio.setDate(inicio.getDate() - primeiro.getDay());
    const ultimoDiaMes = new Date(ano, mes + 1, 0);
    const fim = new Date(ultimoDiaMes); fim.setDate(fim.getDate() + (6 - ultimoDiaMes.getDay()));
    return [dateParaISO(inicio), dateParaISO(fim)];
  }
  function rangeDaQuinzena(baseIso) {
    const inicio = getSemana(baseIso)[0];
    return [inicio, addDias(inicio, 13)];
  }

  useEffect(() => {
    if (modoVisao === 'semana') return;
    let cancelado = false;
    (async () => {
      setLoadingCal(true);
      const [inicio, fim] = modoVisao === 'mes' ? rangeDoMes(calAno, calMes) : rangeDaQuinzena(quinzenaBase);
      const { data } = await supabase
        .from('agenda')
        .select(`
          id, data_agendada, hora_estimada_chegada, funcionario_id, status,
          duracao_estimada_min, observacoes_gestor, tipos_tarefa,
          nome_cliente, endereco_tarefa,
          cliente:clientes(nome_empresa, endereco, lat, lng, frequencia_visita, ultima_visita),
          lead:leads(empresa, endereco, lat, lng)
        `)
        .gte('data_agendada', inicio)
        .lte('data_agendada', fim)
        .neq('status', 'cancelado')
        .order('hora_estimada_chegada', { ascending: true, nullsFirst: false });
      if (cancelado) return;
      setAgendaCalendario(data ?? []);
      setLoadingCal(false);
    })();
    return () => { cancelado = true; };
  }, [modoVisao, calAno, calMes, quinzenaBase]);

  const visitasPorDia = useMemo(() => {
    const empMap = new Map(employees.map(e => [String(e.id), e.name]));
    const mapa = new Map();
    agendaCalendario.forEach(v => {
      const cliente  = v.cliente?.nome_empresa ?? v.lead?.empresa ?? v.nome_cliente ?? '—';
      const endereco = v.cliente?.endereco ?? v.lead?.endereco ?? v.endereco_tarefa ?? null;
      const lat = v.cliente?.lat ?? v.lead?.lat ?? null;
      const lng = v.cliente?.lng ?? v.lead?.lng ?? null;
      const item = {
        id: v.id,
        hora: v.hora_estimada_chegada?.slice(0, 5) ?? null,
        cliente,
        endereco,
        lat, lng,
        funcionario: empMap.get(String(v.funcionario_id)) ?? '—',
        status: v.status,
        duracao: v.duracao_estimada_min ?? null,
        observacoes: v.observacoes_gestor ?? null,
        tiposTarefa: v.tipos_tarefa ?? [],
        prioridade: v.cliente ? calcPrioridade(v.cliente, v.data_agendada) : null,
        dataAgendada: v.data_agendada,
      };
      if (!mapa.has(v.data_agendada)) mapa.set(v.data_agendada, []);
      mapa.get(v.data_agendada).push(item);
    });
    return mapa;
  }, [agendaCalendario, employees]);

  function navMes(delta) {
    const { ano, mes } = addMes(calAno, calMes, delta);
    setCalAno(ano);
    setCalMes(mes);
  }

  function abrirDiaNoCalendario(iso) {
    setDiaSel(iso);
    setSemana(getSemana(new Date(iso + 'T12:00')));
    setModoVisao('semana');
  }

  // "Selecionar" na Quinzenal/Mês não seleciona entre dias diferentes — pula
  // pra Semana já naquele dia com o modo seleção ativo, reaproveitando a
  // mesma lógica de sempre (que já lida com mover/cancelar em lote dentro de
  // um dia). Evita duplicar esse comportamento pra grade do calendário.
  function abrirSelecaoNoDia(iso) {
    setDiaSel(iso);
    setSemana(getSemana(new Date(iso + 'T12:00')));
    setModoVisao('semana');
    ativarModoSelecao();
  }

  function abrirAdicionarTarefaNoCalendario(iso) {
    setDiaSel(iso);
    setModal({ funcionarioId: employeesOrdenados[0]?.id?.toString() ?? '' });
  }

  // ── Derivações ─────────────────────────────────────────────────────────────

  // employees na ordem alfabética (vinda do banco) reorganizada pela
  // preferência salva em ordemColunas — funcionário novo (ainda não presente
  // na ordem salva) aparece no fim, sem precisar resetar tudo.
  const employeesOrdenados = useMemo(() => {
    if (!ordemColunas.length) return employees;
    const porId = new Map(employees.map(e => [String(e.id), e]));
    const ordenados = ordemColunas.map(id => porId.get(id)).filter(Boolean);
    const faltando  = employees.filter(e => !ordemColunas.includes(String(e.id)));
    return [...ordenados, ...faltando];
  }, [employees, ordemColunas]);

  function reordenarColunas(fromId, toId) {
    if (fromId === toId) return;
    setOrdemColunas(prev => {
      const base = prev.length ? [...prev] : employees.map(e => String(e.id));
      employees.forEach(e => { if (!base.includes(String(e.id))) base.push(String(e.id)); });
      const from = base.indexOf(fromId);
      const to   = base.indexOf(toId);
      if (from < 0 || to < 0) return prev;
      base.splice(from, 1);
      base.splice(to, 0, fromId);
      return base;
    });
  }

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
      Object.values(empMap).forEach(lista => lista.sort((a, b) => {
        const ta = a.hora_estimada_chegada ?? 'ZZ';
        const tb = b.hora_estimada_chegada ?? 'ZZ';
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      }))
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

  // Visitas em conflito com bloqueios (funcionário está bloqueado, mas tem
  // visita agendada nesse dia)
  const visitasConflitantesComBloq = useMemo(() => {
    return agenda.filter(v => {
      if (v.status === 'concluido' || v.status === 'cancelado' || v.status === 'faltou') return false;
      return !!bloqueioNoDia(bloqueios, v.funcionario_id, v.data_agendada);
    });
  }, [agenda, bloqueios]);

  // Alerta de atraso/possível falta por visita (id -> 'atrasado' | 'falta_provavel').
  // Não mexe no status oficial — é só sinalização até o gestor confirmar
  // manualmente com "Marcar falta" (ver marcarFalta).
  const alertasPorVisita = useMemo(() => {
    const map = new Map();
    agenda.forEach(v => {
      const bloqueado = !!bloqueioNoDia(bloqueios, v.funcionario_id, v.data_agendada);
      const temCheckin = !!checkins.get(v.id);
      const alerta = calcularAlertaFalta(v, agora, temCheckin, bloqueado);
      if (alerta) map.set(v.id, alerta);
    });
    return map;
  }, [agenda, bloqueios, checkins, agora]);

  const conflitosPorEmp = useMemo(() => {
    const c = {};
    employees.forEach(emp => {
      // 'faltou' não ocupou tempo de fato — exclui do cálculo de sobreposição/
      // estouro de expediente, senão um horário livre acusaria conflito.
      const visitas = (agendaOrg[diaSel]?.[emp.id] ?? []).filter(v => v.status !== 'faltou');
      c[emp.id] = calcConflitosDia(visitas, emp.daily_hours);
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

  // Volta em bloco várias visitas selecionadas para rascunho. Útil quando
  // um funcionário adoece e o gestor precisa realocar tudo pra outra pessoa.
  async function voltarSelecionadasParaRascunho() {
    if (!selecionadas.size) return;
    const ids = [...selecionadas];
    if (!confirm(`Voltar ${ids.length} visita${ids.length !== 1 ? 's' : ''} para rascunho? O funcionário não vê mais elas até você republicar.`)) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from('agenda').update({ status: 'rascunho' }).in('id', ids);
      if (error) throw error;
      cancelarSelecao();
      await carregarAgenda();
    } catch (e) {
      alert('Erro ao voltar para rascunho: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarSelecionadasVisitas() {
    if (!selecionadas.size) return;
    const ids = [...selecionadas];
    if (!confirm(`Cancelar ${ids.length} visita${ids.length !== 1 ? 's' : ''}? Elas somem da agenda do funcionário.`)) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from('agenda').update({ status: 'cancelado' }).in('id', ids);
      if (error) throw error;
      cancelarSelecao();
      await carregarAgenda();
    } catch (e) {
      alert('Erro ao cancelar: ' + e.message);
    } finally {
      setSalvando(false);
    }
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

      // RPC atômica (migration 015): todos os UPDATEs numa única transação —
      // elimina inconsistências quando dois usuários arrastam em paralelo.
      const updates = ids.map((id, i) => ({
        id,
        funcionario_id: String(novoEmpId),
        ordem_rota: baseOrdem + i,
      }));
      const { error } = await supabase.rpc('reorder_agenda', { p_updates: updates });
      if (error) throw error;

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
    // Multi-funcionário (2B): se vier `funcionariosIds` (array), cria uma
    // linha por funcionário. Fallback pra `funcionarioId` (formato antigo)
    // pra não quebrar chamadas legadas.
    const funcs = Array.isArray(form.funcionariosIds) && form.funcionariosIds.length
      ? form.funcionariosIds
      : (form.funcionarioId ? [String(form.funcionarioId)] : []);
    if (funcs.length === 0) return;

    setSalvando(true);
    try {
      const rows = funcs.map(funcId => {
        const visitasEmpDia = agendaOrg[form.data]?.[funcId] ?? [];
        const proximaOrdem = visitasEmpDia.length > 0
          ? Math.max(...visitasEmpDia.map(v => v.ordem_rota)) + 1
          : 0;
        const row = {
          cliente_id:            form.clienteId || null,
          funcionario_id:        String(funcId),
          cliente_servico_id:    idServicoParaBanco(form.servicoId),
          data_agendada:         form.data,
          hora_estimada_chegada: form.hora || null,
          duracao_estimada_min:  form.duracao ? Number(form.duracao) : null,
          tipos_tarefa:          form.tipos?.length ? form.tipos : null,
          observacoes_gestor:    form.obs || null,
          ordem_rota:            proximaOrdem,
          status:                'rascunho',
        };
        // Só inclui colunas novas quando têm valor — evita erro de schema cache
        // antes da migration 030 ser aplicada e o PostgREST recarregado.
        if (form.nomeCliente)    row.nome_cliente    = form.nomeCliente;
        if (form.enderecoTarefa) row.endereco_tarefa = form.enderecoTarefa;
        return row;
      });
      const { error } = await supabase.from('agenda').insert(rows);
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
    // RPC atômica (migration 015): troca as duas ordens numa única transação.
    await supabase.rpc('reorder_agenda', { p_updates: [
      { id: visita.id, ordem_rota: alvo.ordem_rota },
      { id: alvo.id,   ordem_rota: visita.ordem_rota },
    ]});
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

  // ── Otimizar rota do funcionário no dia ────────────────────────────────────

  async function otimizarRotaEmp(empId) {
    const lista = agendaOrg[diaSel]?.[empId] ?? [];
    const rascunhos = lista.filter(v => v.status === 'rascunho');
    if (rascunhos.length < 2) return;
    if (rascunhos.some(v => !v.clientes?.lat || !v.clientes?.lng)) {
      alert('Alguns clientes não têm coordenadas GPS. Preencha lat/lng no cadastro para otimizar a rota.');
      return;
    }

    setOtimizando(String(empId));
    const resultado = otimizarRotaComRestricoes(rascunhos);
    if (!resultado || !resultado.ordem.length) { setOtimizando(null); return; }

    // Caso simples: nenhum desvio ou fallback — aplica direto
    if (resultado.iguais) {
      try {
        await aplicarOrdemRota(resultado.ordem, resultado.timeline);
        const kmFmt = resultado.distKmViavel.toFixed(1);
        const primeiro = resultado.timeline?.[0];
        const ultimo = resultado.timeline?.[resultado.timeline.length - 1];
        const janela = primeiro && ultimo
          ? ` · ${minutosParaHora(primeiro.chegada)}–${minutosParaHora(ultimo.chegada)}`
          : '';
        alert(`✓ Rota otimizada · ${kmFmt} km${janela}\n\nHorários das visitas foram atualizados para os ETAs calculados.`);
      } catch (e) {
        alert('Erro ao otimizar: ' + e.message);
      } finally {
        setOtimizando(null);
      }
      return;
    }

    // Desvio: abre modal com preview
    setOtimizando(null);
    setPreviewRota({ empId: String(empId), resultado });
  }

  async function aplicarOrdemRota(ordem, timeline) {
    // RPC atômica (migration 015): aplica ordem_rota + hora_estimada_chegada
    // pra todas as visitas em uma única transação.
    const updates = ordem.map((v, i) => {
      const item = { id: v.id, ordem_rota: i };
      if (timeline?.[i]?.chegada != null) {
        item.hora_estimada_chegada = minutosParaHora(timeline[i].chegada);
      }
      return item;
    });
    const { error } = await supabase.rpc('reorder_agenda', { p_updates: updates });
    if (error) throw error;
    await carregarAgenda();
  }

  async function confirmarPreviewRota() {
    if (!previewRota) return;
    setOtimizando(previewRota.empId);
    try {
      await aplicarOrdemRota(previewRota.resultado.ordem, previewRota.resultado.timeline);
      setPreviewRota(null);
    } catch (e) {
      alert('Erro ao aplicar: ' + e.message);
    } finally {
      setOtimizando(null);
    }
  }

  // ── Cancelar visita publicada (soft-delete) ─────────────────────────────────
  async function cancelarVisitaPublicada() {
    if (!modalEdit) return;
    const v = modalEdit;
    if (!confirm(`Cancelar a visita em "${v.clientes?.nome_empresa ?? '—'}"?\n\nO funcionário não verá mais essa visita no App Ponto.`)) return;
    setSalvandoEdit(true);
    try {
      const { error } = await supabase.from('agenda').update({ status: 'cancelado' }).eq('id', v.id);
      if (error) throw error;
      setModalEdit(null);
      await carregarAgenda();
    } catch (e) {
      alert('Erro ao cancelar: ' + e.message);
    } finally {
      setSalvandoEdit(false);
    }
  }

  // ── Marcar falta (confirmação manual do alerta de atraso) ──────────────────
  async function marcarFalta() {
    if (!modalEdit) return;
    const v = modalEdit;
    if (!confirm(`Marcar falta de ${employees.find(e => String(e.id) === String(v.funcionario_id))?.name ?? 'colaborador'} em "${v.clientes?.nome_empresa ?? '—'}"?\n\nA visita fica registrada como falta — você ainda pode duplicá-la pra outro funcionário se precisar cobrir o cliente.`)) return;
    setSalvandoEdit(true);
    try {
      const { error } = await supabase.from('agenda').update({ status: 'faltou' }).eq('id', v.id);
      if (error) throw error;
      setModalEdit(null);
      await carregarAgenda();
    } catch (e) {
      alert('Erro ao marcar falta: ' + e.message);
    } finally {
      setSalvandoEdit(false);
    }
  }

  // ── Voltar visita publicada para rascunho ───────────────────────────────────
  async function despublicarVisita() {
    if (!modalEdit) return;
    const v = modalEdit;
    if (!confirm(`Voltar a visita em "${v.clientes?.nome_empresa ?? '—'}" para rascunho?\n\nO funcionário não vê mais essa visita até você republicar o dia.`)) return;
    setSalvandoEdit(true);
    try {
      const { error } = await supabase.from('agenda').update({ status: 'rascunho', publicado_em: null }).eq('id', v.id);
      if (error) throw error;
      setModalEdit(null);
      await carregarAgenda();
    } catch (e) {
      alert('Erro ao despublicar: ' + e.message);
    } finally {
      setSalvandoEdit(false);
    }
  }

  // Ids sintéticos de cliente_servicos vindos de LEADS começam com "lead-"
  // (ver enrichment em carregarAgenda). Eles não podem ir pro banco pois
  // agenda.cliente_servico_id é UUID FK — só aceita id real.
  function idServicoParaBanco(id) {
    if (!id) return null;
    if (String(id).startsWith('lead-')) return null;
    return id;
  }

  // ── Salvar edição de visita ────────────────────────────────────────────────
  async function salvarEdicao(campos) {
    if (!modalEdit) return;
    setSalvandoEdit(true);
    try {
      const payload = {
        funcionario_id:        String(campos.funcionarioId),
        data_agendada:         campos.data,
        cliente_servico_id:    idServicoParaBanco(campos.servicoId),
        hora_estimada_chegada: campos.hora || null,
        duracao_estimada_min:  campos.duracao ? Number(campos.duracao) : null,
        endereco_tarefa:       campos.endereco?.trim() || null,
        tipos_tarefa:          campos.tipos?.length ? campos.tipos : null,
        observacoes_gestor:    campos.obs || null,
      };
      // Nome só é editável (e só existe como coluna própria) pra tarefa
      // avulsa — cliente/lead cadastrado têm o nome no próprio cadastro.
      if (!modalEdit.cliente_id && !modalEdit.lead_id) {
        payload.nome_cliente = campos.nomeTarefa?.trim() || null;
      }
      // Mudou de dia e/ou funcionário — manda pro fim da lista do destino
      // pra não colidir com a ordem de rota de quem já está lá.
      const mudouDestino = campos.data !== modalEdit.data_agendada
        || String(campos.funcionarioId) !== String(modalEdit.funcionario_id);
      if (mudouDestino) {
        const visitasDestino = agendaOrg[campos.data]?.[campos.funcionarioId] ?? [];
        payload.ordem_rota = visitasDestino.length > 0
          ? Math.max(...visitasDestino.map(v => v.ordem_rota)) + 1
          : 0;
      }
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

  // ── Duplicar visita para outro funcionário (2A) ────────────────────────────
  // O botão "+ Funcionário" no ModalEditVisita abre o picker (state abaixo).
  // Quando o usuário escolhe um funcionário, chamamos executarDuplicacao.
  const [pickerDup, setPickerDup] = useState(null); // { campos: form } | null

  function abrirPickerDuplicar(campos) {
    setPickerDup({ campos });
  }

  async function executarDuplicacao(alvoId) {
    if (!modalEdit || !pickerDup) return;
    const campos = pickerDup.campos;
    setPickerDup(null);
    setSalvandoEdit(true);
    try {
      const visitasEmpDia = agendaOrg[modalEdit.data_agendada]?.[alvoId] ?? [];
      const proximaOrdem = visitasEmpDia.length > 0
        ? Math.max(...visitasEmpDia.map(v => v.ordem_rota)) + 1
        : 0;
      const { error } = await supabase.from('agenda').insert({
        cliente_id:            modalEdit.cliente_id,
        lead_id:               modalEdit.lead_id,
        nome_cliente:          campos.nomeTarefa?.trim() || null,
        endereco_tarefa:       campos.endereco?.trim() || null,
        funcionario_id:        String(alvoId),
        cliente_servico_id:    idServicoParaBanco(campos.servicoId),
        data_agendada:         modalEdit.data_agendada,
        hora_estimada_chegada: campos.hora || null,
        duracao_estimada_min:  campos.duracao ? Number(campos.duracao) : null,
        tipos_tarefa:          campos.tipos?.length ? campos.tipos : null,
        observacoes_gestor:    campos.obs || null,
        ordem_rota:            proximaOrdem,
        status:                'rascunho',
      });
      if (error) throw error;
      setModalEdit(null);
      await carregarAgenda();
    } catch (e) {
      alert('Erro ao duplicar: ' + e.message);
    } finally {
      setSalvandoEdit(false);
    }
  }

  // ── Duplicar visita escolhendo funcionário e data de destino ───────────────
  // Botão "⧉ Duplicar" no ModalEditVisita — diferente do "+ Funcionário"
  // acima (que fixa o mesmo dia), aqui o destino é livre.
  const [modalDuplicar, setModalDuplicar] = useState(null); // { campos: form } | null

  function abrirModalDuplicar(campos) {
    setModalDuplicar({ campos });
  }

  async function executarDuplicacaoGeral({ funcionarioId, data }) {
    if (!modalEdit || !modalDuplicar) return;
    const campos = modalDuplicar.campos;
    setSalvandoEdit(true);
    try {
      const visitasDestino = agendaOrg[data]?.[funcionarioId] ?? [];
      const proximaOrdem = visitasDestino.length > 0
        ? Math.max(...visitasDestino.map(v => v.ordem_rota)) + 1
        : 0;
      const { error } = await supabase.from('agenda').insert({
        cliente_id:            modalEdit.cliente_id,
        lead_id:               modalEdit.lead_id,
        nome_cliente:          campos.nomeTarefa?.trim() || null,
        funcionario_id:        String(funcionarioId),
        cliente_servico_id:    idServicoParaBanco(campos.servicoId),
        data_agendada:         data,
        hora_estimada_chegada: campos.hora || null,
        duracao_estimada_min:  campos.duracao ? Number(campos.duracao) : null,
        endereco_tarefa:       campos.endereco?.trim() || null,
        tipos_tarefa:          campos.tipos?.length ? campos.tipos : null,
        observacoes_gestor:    campos.obs || null,
        ordem_rota:            proximaOrdem,
        status:                'rascunho',
      });
      if (error) throw error;
      setModalDuplicar(null);
      setModalEdit(null);
      await carregarAgenda();
    } catch (e) {
      alert('Erro ao duplicar: ' + e.message);
    } finally {
      setSalvandoEdit(false);
    }
  }

  // Funcionários candidatos: os que ainda não têm essa visita nesse dia
  const funcionariosParaDuplicar = pickerDup && modalEdit ? (() => {
    const idsExistentes = new Set(
      (agenda ?? [])
        .filter(v => v.cliente_id === modalEdit.cliente_id
                  && v.lead_id === modalEdit.lead_id
                  && v.data_agendada === modalEdit.data_agendada)
        .map(v => String(v.funcionario_id))
    );
    return employeesOrdenados.filter(e => !idsExistentes.has(String(e.id)));
  })() : [];

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
  const temRascunho    = agenda.some(v => v.data_agendada === diaSel && v.status === 'rascunho');
  // Modo seleção agora aceita rascunho + publicado, então o botão aparece se
  // existir qualquer um dos dois (útil pra reverter/mover em bloco tarefas
  // publicadas quando alguém falta ou precisa reprogramar).
  const temSelecionavel = agenda.some(v => v.data_agendada === diaSel && (v.status === 'rascunho' || v.status === 'publicado'));
  const qtdSel          = selecionadas.size;

  const pickerOverlay = useOverlayClose(() => setPickerDup(null));

  return (
    <div className="ec">

      {/* ── Cabeçalho ── */}
      <header className="ec__header">
        <div className="ec__header-esq">
          <h2 className="ec__titulo">Escala de Campo</h2>
          <p className="ec__sub">
            Agenda {modoVisao === 'semana' ? 'semanal' : modoVisao === 'quinzenal' ? 'quinzenal' : 'mensal'} de visitas · {employees.length} funcionários
          </p>
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
            className={`ec__btn-prio ${mostrarPrioridade ? 'ec__btn-prio--on' : ''}`}
            onClick={() => setMostrarPrioridade(v => !v)}
            title="Colorir cartões por prioridade (última visita × frequência)"
          >
            🎯 Prioridade
          </button>
          {visitasConflitantesComBloq.length > 0 && (
            <button
              className="ec__btn-redistrib"
              onClick={() => setModalRedistrib(true)}
              title="Visitas agendadas para funcionários ausentes"
            >
              🚨 Redistribuir
              <span className="ec__btn-atras-badge">{visitasConflitantesComBloq.length}</span>
            </button>
          )}
          <button
            className="ec__btn-copiar"
            onClick={() => setModalCopiar(true)}
            title="Copiar a agenda de um funcionário e dia específico para outro funcionário e dia"
          >
            ↺ Copiar agenda
          </button>
          <div className="ec__modo-visao">
            {[
              { id: 'semana',    label: 'Semana' },
              { id: 'quinzenal', label: 'Quinzenal' },
              { id: 'mes',       label: 'Mês' },
            ].map(m => (
              <button
                key={m.id}
                className={`ec__modo-pill ${modoVisao === m.id ? 'ec__modo-pill--ativo' : ''}`}
                onClick={() => setModoVisao(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Navegação de Semana — linha própria, igual Quinzenal/Mês já fazem
          com a data deles, pra fileira de cima (Atrasados/Prioridade/Copiar
          agenda/pills) nunca mudar de largura nem de posição ao trocar de
          modo. ── */}
      {modoVisao === 'semana' && (
        <div className="ec__semana-toolbar">
          <div className="ec__nav-semana">
            <button className="ec__nav-btn" onClick={() => navSemana(-1)}>‹</button>
            <span className="ec__semana-label">{formatarDia(semana[0])} – {formatarDia(semana[6])}</span>
            <button className="ec__nav-btn" onClick={() => navSemana(+1)}>›</button>
          </div>
          <button className="ec__btn-hoje" onClick={irHoje}>Hoje</button>
        </div>
      )}

      {modoVisao !== 'semana' ? (
        <EscalaCalendario
          modo={modoVisao}
          visitasPorDia={visitasPorDia}
          loading={loadingCal}
          calAno={calAno}
          calMes={calMes}
          onNavMes={navMes}
          quinzenaBase={quinzenaBase}
          onNavQuinzena={deltaDias => setQuinzenaBase(b => addDias(b, deltaDias))}
          hojeIso={hoje}
          onAbrirDia={abrirDiaNoCalendario}
          onSelecionarDia={abrirSelecaoNoDia}
          onAdicionarTarefa={abrirAdicionarTarefaNoCalendario}
        />
      ) : (
      <>
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
              {temSelecionavel && (
                <button className="ec__btn-sel" onClick={ativarModoSelecao}>☑ Selecionar</button>
              )}
              <button className="ec__btn-add" onClick={() => setModal({ funcionarioId: employees[0]?.id?.toString() ?? '' })}>
                + Adicionar Tarefa
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
          {employeesOrdenados.map(emp => {
            const empId      = String(emp.id);
            const visitas    = visitasDiaSel[emp.id] ?? [];
            const isDragAlvo = dragOverEmp === empId;
            const conflitos  = conflitosPorEmp[emp.id] ?? { sobreposicoes: [], estouraDia: false, fimMin: 0 };
            const rascunhos  = visitas.filter(v => v.status === 'rascunho').length;
            const podeOtimizar = rascunhos >= 2 && !modoSelecao;
            const bloqueio   = bloqueioNoDia(bloqueios, emp.id, diaSel);
            const isColDragSrc = colDragSrc === empId;
            const isColDropTgt = colDragOver === empId;

            return (
              <div
                key={emp.id}
                className={`ec__coluna ${isDragAlvo ? 'ec__coluna--drag-over' : ''} ${bloqueio ? 'ec__coluna--bloqueada' : ''} ${isColDragSrc ? 'ec__coluna--arrastando' : ''}`}
                onDragOver={e => { if (bloqueio) return; e.preventDefault(); setDragOverEmp(empId); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverEmp(null); }}
                onDrop={() => { if (bloqueio) { alert(`${emp.name} está ausente neste dia (${bloqueio.motivo || 'bloqueio'}). Escolha outro funcionário.`); return; } handleDrop(emp.id); }}
              >
                <div
                  className={`ec__coluna-header ${isColDropTgt ? 'ec__coluna-header--drop' : ''}`}
                  draggable
                  onDragStart={e => {
                    if (e.target.closest('button')) { e.preventDefault(); return; }
                    setColDragSrc(empId);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={e => {
                    if (!colDragSrc) return; // não é drag de coluna — deixa borbulhar pro drop de visita
                    e.preventDefault();
                    e.stopPropagation();
                    if (colDragSrc !== empId) setColDragOver(empId);
                  }}
                  onDragLeave={() => setColDragOver(null)}
                  onDrop={e => {
                    if (!colDragSrc) return; // idem — deixa a visita cair na coluna normalmente
                    e.preventDefault();
                    e.stopPropagation();
                    reordenarColunas(colDragSrc, empId);
                    setColDragSrc(null);
                    setColDragOver(null);
                  }}
                  onDragEnd={() => { setColDragSrc(null); setColDragOver(null); }}
                >
                  <div className="ec__coluna-titulo">
                    <DragHandleColuna />
                    <div>
                      <span className="ec__coluna-nome">{emp.name}</span>
                      <span className="ec__coluna-cargo">{emp.cargo}</span>
                    </div>
                  </div>
                  <div className="ec__coluna-header-dir">
                    <button
                      className="ec__coluna-bloq"
                      onClick={() => setModalBloqueio({ funcionarioId: String(emp.id), funcionarioNome: emp.name })}
                      title={`Marcar férias, folga ou feriado do ${emp.name}`}
                      aria-label={`Ausências de ${emp.name}`}
                    >
                      📅
                    </button>
                    {podeOtimizar && !bloqueio && (
                      <button
                        className="ec__coluna-otim"
                        onClick={() => otimizarRotaEmp(emp.id)}
                        disabled={otimizando === String(emp.id)}
                        title={`Otimizar a rota do ${emp.name} pela proximidade das visitas (GPS)`}
                        aria-label="Otimizar rota"
                      >
                        {otimizando === String(emp.id) ? '⏳' : '🧭'}
                      </button>
                    )}
                    {visitas.length > 0 && (
                      <span className="ec__coluna-count">{visitas.length}</span>
                    )}
                  </div>
                </div>

                {bloqueio && (
                  <div className="ec__coluna-bloqueio-badge">
                    🌴 {bloqueio.motivo || 'Ausente'}
                    {bloqueio.data_fim !== diaSel && (
                      <span className="ec__bloq-ate"> · até {new Date(bloqueio.data_fim + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                    )}
                  </div>
                )}

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
                      <span className="ec__warn ec__warn--fim" title={`Fim do expediente ${minutosParaHora(conflitos.fimDia)} · última visita termina ${minutosParaHora(conflitos.fimMin)}`}>
                        ⚠ passa das {minutosParaHora(conflitos.fimDia)} ({minutosParaHora(conflitos.fimMin)})
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
                        prioridade={calcPrioridade(v.clientes, v.data_agendada)}
                        mostrarPrioridade={mostrarPrioridade}
                        restricao={checarRestricoes(v.clientes, v.data_agendada, v.hora_estimada_chegada)}
                        alerta={alertasPorVisita.get(v.id)}
                        onEditar={() => setModalEdit(v)}
                        onVerRelatorio={(vis) => setModalRel(vis)}
                      />
                    ))
                  )}
                </div>

                {!modoSelecao && !bloqueio && (
                  <button
                    className="ec__add-inline"
                    onClick={() => setModal({ funcionarioId: emp.id.toString() })}
                  >
                    + Adicionar tarefa
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* ── Barra de ação: mover/reverter/cancelar selecionadas ── */}
      {modoVisao === 'semana' && modoSelecao && (
        <div className="ec__bulk-bar">
          <span className="ec__bulk-info">
            {qtdSel === 0
              ? 'Clique em rascunhos e/ou publicadas para selecioná-las'
              : `${qtdSel} visita${qtdSel !== 1 ? 's' : ''} selecionada${qtdSel !== 1 ? 's' : ''}`}
          </span>
          <div className="ec__bulk-acoes">
            <span className="ec__bulk-label">Mover para:</span>
            <select
              className="ec__bulk-select"
              value={movParaEmp}
              onChange={e => setMovParaEmp(e.target.value)}
            >
              {employeesOrdenados.map(emp => (
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
            <button
              className="ec__bulk-btn ec__bulk-btn--sec"
              disabled={qtdSel === 0 || salvando}
              onClick={voltarSelecionadasParaRascunho}
              title="Volta as visitas selecionadas para rascunho (útil quando alguém falta e você precisa realocar)"
            >
              ↩ Para rascunho
            </button>
            <button
              className="ec__bulk-btn ec__bulk-btn--perigo"
              disabled={qtdSel === 0 || salvando}
              onClick={cancelarSelecionadasVisitas}
              title="Cancela as visitas — desaparecem do App Ponto"
            >
              ✕ Cancelar
            </button>
            <button className="ec__bulk-btn ec__bulk-btn--sec" onClick={cancelarSelecao}>Fechar</button>
          </div>
        </div>
      )}

      {/* ── Modal de adicionar visita ── */}
      {modal && (
        <ModalAddVisita
          clientes={clientes}
          funcionarios={employeesOrdenados}
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
          funcionarios={employeesOrdenados}
          clientes={clientes}
          onSalvar={salvarEdicao}
          onFechar={() => setModalEdit(null)}
          onCancelar={cancelarVisitaPublicada}
          onDespublicar={despublicarVisita}
          onMarcarFalta={marcarFalta}
          alerta={alertasPorVisita.get(modalEdit.id)}
          onDuplicarFuncionario={abrirPickerDuplicar}
          onDuplicar={abrirModalDuplicar}
          salvando={salvandoEdit}
        />
      )}

      {modalDuplicar && (
        <ModalDuplicarVisita
          visita={modalEdit}
          funcionarios={employeesOrdenados}
          duplicando={salvandoEdit}
          onFechar={() => setModalDuplicar(null)}
          onDuplicar={executarDuplicacaoGeral}
        />
      )}

      {/* ── Modal de relatório (visita em_execução ou concluída) ── */}
      {modalRel && (
        <ModalRelatorioVisita
          visita={modalRel}
          funcNome={employees.find(e => String(e.id) === String(modalRel.funcionario_id))?.name ?? '—'}
          onFechar={() => setModalRel(null)}
          onRemovido={() => { setModalRel(null); carregarAgenda(); }}
          onEditarAgendamento={() => { setModalEdit(modalRel); setModalRel(null); }}
        />
      )}

      {/* ── Picker "+ Funcionário": lista clicável em vez de prompt() ── */}
      {pickerDup && (
        <div className="ec-overlay" {...pickerOverlay}>
          <div className="ec-modal" style={{ maxWidth: 380 }}>
            <header className="ec-modal__header">
              <div>
                <h3 className="ec-modal__titulo">Duplicar para outro funcionário</h3>
                <p className="ec-modal__sub">Cria uma cópia idêntica (hora, tarefa, observações) atribuída a quem você escolher.</p>
              </div>
              <button className="ec-modal__fechar" onClick={() => setPickerDup(null)}>✕</button>
            </header>
            <div className="ec-modal__corpo">
              {funcionariosParaDuplicar.length === 0 ? (
                <p className="ec-hint">Todos os funcionários já têm essa visita nesse dia.</p>
              ) : (
                <div className="ec-picker__lista">
                  {funcionariosParaDuplicar.map(f => (
                    <button
                      key={f.id}
                      className="ec-picker__item"
                      onClick={() => executarDuplicacao(String(f.id))}
                      disabled={salvandoEdit}
                    >
                      <span className="ec-picker__nome">{f.name}</span>
                      {f.cargo && <span className="ec-picker__cargo">{f.cargo}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <footer className="ec-modal__footer">
              <button className="ec-btn ec-btn--sec" onClick={() => setPickerDup(null)} disabled={salvandoEdit}>
                Cancelar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── Modal de bloqueios do funcionário ── */}
      {modalBloqueio && (
        <ModalBloqueios
          funcionarioId={modalBloqueio.funcionarioId}
          funcionarioNome={modalBloqueio.funcionarioNome}
          bloqueios={bloqueios.filter(b => String(b.funcionario_id) === modalBloqueio.funcionarioId)}
          onFechar={() => setModalBloqueio(null)}
          onMudou={recarregarBloqueios}
        />
      )}

      {/* ── Modal de preview da rota otimizada ── */}
      {previewRota && (
        <ModalPreviewRota
          resultado={previewRota.resultado}
          onAplicar={confirmarPreviewRota}
          onFechar={() => setPreviewRota(null)}
          aplicando={otimizando === previewRota.empId}
        />
      )}

      {/* ── Modal de redistribuição ── */}
      {modalRedistrib && (
        <ModalRedistribuir
          visitas={visitasConflitantesComBloq}
          employees={employeesOrdenados}
          agendaOrg={agendaOrg}
          bloqueios={bloqueios}
          clientes={clientes}
          onFechar={() => setModalRedistrib(false)}
          onMudou={carregarAgenda}
        />
      )}

      {/* ── Modal de copiar agenda (dia+pessoa origem → dia+pessoa destino) ── */}
      {modalCopiar && (
        <ModalCopiarAgenda
          employees={employeesOrdenados}
          clientes={clientes}
          diaSel={diaSel}
          onFechar={() => setModalCopiar(false)}
          onCopiado={() => { setModalCopiar(false); carregarAgenda(); }}
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
