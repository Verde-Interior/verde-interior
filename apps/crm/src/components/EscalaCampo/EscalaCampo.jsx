// src/components/EscalaCampo/EscalaCampo.jsx
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { dateParaISO, getSemana as getSemanaUtil, getDiaSlug as getDiaSlugUtil, formatarDataCurta } from '../../utils/dateUtils';
import { distanciaKm } from '../../utils/geoUtils';
import { supabase } from '../../lib/supabase';
import {
  DIAS_LABEL, DIAS_NOME,
  FREQ_LABEL_LOCAL,
  checarRestricoes, bloqueioNoDia,
  calcPrioridade, calcClientesAtrasados, calcConflitosDia,
} from '../../utils/escalaHelpers';
import { minutosParaHora, otimizarRotaComRestricoes } from '../../utils/otimizadorRota';
import CartaoVisita from './CartaoVisita';
import ModalAddVisita from './ModalAddVisita';
import ModalEditVisita from './ModalEditVisita';
import './EscalaCampo.css';

// ── Wrappers finos para os utils centralizados (mantém API interna do arquivo) ──
const getSemana   = ref => getSemanaUtil(ref);
const getDiaId    = iso => getDiaSlugUtil(iso);
const formatarDia = iso => formatarDataCurta(iso);
const getHoje     = () => dateParaISO(new Date());

// ── Componente principal ──────────────────────────────────────────────────────

export default function EscalaCampo() {
  const [semana,      setSemana]      = useState(() => getSemana(new Date()));
  const [diaSel,      setDiaSel]      = useState(getHoje);
  const [employees,   setEmployees]   = useState([]);
  const [clientes,    setClientes]    = useState([]);
  const [agenda,      setAgenda]      = useState([]);
  const [bloqueios,   setBloqueios]   = useState([]);
  const [modalBloqueio, setModalBloqueio] = useState(null); // { funcionarioId? }
  const [modalRedistrib, setModalRedistrib] = useState(false);
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
  const [showAtrasados,   setShowAtrasados]   = useState(false);
  const [otimizando,      setOtimizando]      = useState(null); // empId em otimização
  const [modalCopiar,     setModalCopiar]     = useState(false);
  const [mostrarPrioridade, setMostrarPrioridade] = useState(false);

  // ── Edição de visita ────────────────────────────────────────────────────────
  const [modalEdit,     setModalEdit]     = useState(null); // visita sendo editada
  const [salvandoEdit,  setSalvandoEdit]  = useState(false);

  // ── Tooltip global (para escapar overflow das colunas) ─────────────────────
  const [tooltip, setTooltip] = useState(null); // { x, y, sugestoes }

  // ── Preview da rota otimizada (quando difere da rota geográfica pura) ──────
  const [previewRota, setPreviewRota] = useState(null); // { empId, resultado }

  const hoje = getHoje();

  // ── Dados estáticos ────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const [empRes, cliRes, bloqRes] = await Promise.all([
        supabase.from('employees').select('id, name, cargo, daily_hours').in('cargo', ['Campo', 'Facilities', 'TI']).order('name'),
        supabase.from('clientes')
          .select('id, nome_empresa, bairro, dias_disponiveis, janela_entrada_inicio, janela_entrada_fim, duracao_estimada_min, ultima_visita, frequencia_visita, lat, lng, cliente_servicos(id, tipo_servico, frequencia, ativo)')
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
      .select('*, clientes(nome_empresa, bairro, dias_disponiveis, janela_entrada_inicio, janela_entrada_fim, lat, lng, ultima_visita, frequencia_visita), cliente_servicos(tipo_servico, frequencia), leads(empresa, bairro, contato, telefone, endereco, lat, lng)')
      .gte('data_agendada', semana[0])
      .lte('data_agendada', semana[5])
      .neq('status', 'cancelado')
      .order('ordem_rota');
    setLoading(false);
    if (!error) {
      // Compat: cartões da Escala esperam sempre `v.clientes`. Quando a visita
      // veio de um lead (lead_id != null e cliente_id == null), copiamos os
      // campos essenciais do lead para dentro de `.clientes` e marcamos
      // `__isLead` para o cartão distinguir visualmente.
      const enriched = (data ?? []).map((v) => {
        if (!v.clientes && v.leads) {
          return {
            ...v,
            __isLead: true,
            clientes: {
              nome_empresa: v.leads.empresa,
              bairro:       v.leads.bairro,
              lat:          v.leads.lat,
              lng:          v.leads.lng,
              // dias_disponiveis, janela, frequencia_visita ficam ausentes ⇒
              // o otimizador de rota trata como "sem restrição".
            },
          };
        }
        return v;
      });
      setAgenda(enriched);
    }
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

  // Visitas em conflito com bloqueios (funcionário está bloqueado, mas tem
  // visita agendada nesse dia)
  const visitasConflitantesComBloq = useMemo(() => {
    return agenda.filter(v => {
      if (v.status === 'concluido' || v.status === 'cancelado') return false;
      return !!bloqueioNoDia(bloqueios, v.funcionario_id, v.data_agendada);
    });
  }, [agenda, bloqueios]);

  const conflitosPorEmp = useMemo(() => {
    const c = {};
    employees.forEach(emp => {
      const visitas = agendaOrg[diaSel]?.[emp.id] ?? [];
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
        tipos_tarefa:          form.tipos?.length ? form.tipos : null,
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
            const bloqueio   = bloqueioNoDia(bloqueios, emp.id, diaSel);

            return (
              <div
                key={emp.id}
                className={`ec__coluna ${isDragAlvo ? 'ec__coluna--drag-over' : ''} ${bloqueio ? 'ec__coluna--bloqueada' : ''}`}
                onDragOver={e => { if (bloqueio) return; e.preventDefault(); setDragOverEmp(String(emp.id)); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverEmp(null); }}
                onDrop={() => { if (bloqueio) { alert(`${emp.name} está ausente neste dia (${bloqueio.motivo || 'bloqueio'}). Escolha outro funcionário.`); return; } handleDrop(emp.id); }}
              >
                <div className="ec__coluna-header">
                  <div>
                    <span className="ec__coluna-nome">{emp.name}</span>
                    <span className="ec__coluna-cargo">{emp.cargo}</span>
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
                        onEditar={() => setModalEdit(v)}
                      />
                    ))
                  )}
                </div>

                {!modoSelecao && !bloqueio && (
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
          onCancelar={cancelarVisitaPublicada}
          onDespublicar={despublicarVisita}
          salvando={salvandoEdit}
        />
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
          employees={employees}
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
          employees={employees}
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

// ── Modal de redistribuição de visitas de funcionários ausentes ─────────────
// ── Modal de preview da rota otimizada (quando difere da ideal geográfica) ─
function ModalPreviewRota({ resultado, onAplicar, onFechar, aplicando }) {
  const { ordem, ordemGeo, distKmViavel, distKmGeo, timeline, motivos, temViolacao } = resultado;
  const diffKm = distKmViavel - distKmGeo; // positivo = rota viável mais longa

  const posGeo = new Map(ordemGeo.map((v, i) => [v.id, i + 1]));

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="ec-modal ec-modal--atras">
        <header className="ec-modal__header">
          <div>
            <h3 className="ec-modal__titulo">🧭 Rota otimizada</h3>
            <p className="ec-modal__sub">Ajustada para respeitar janelas de horário</p>
          </div>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">
          {motivos.length > 0 && (
            <div className="ec-preview__motivos">
              <div className="ec-preview__motivos-titulo">⚠ Por que essa não é a rota mais curta:</div>
              {motivos.map(m => (
                <div key={m.visitaId} className="ec-preview__motivo">
                  Priorizei <strong>{m.nome}</strong> ({m.moveuDe + 1}ª → {m.moveuPara + 1}ª posição) porque {m.texto.replace(m.nome, '').trim()}.
                </div>
              ))}
            </div>
          )}

          {temViolacao && (
            <div className="ec-alerta ec-alerta--erro">
              ⚠ Mesmo com esta ordem, alguma visita ficou fora da janela do cliente. Verifique horários manualmente ou aceite para revisar depois.
            </div>
          )}

          <div className="ec-preview__diff-km">
            <div>
              <div className="ec-preview__diff-lbl">Rota escolhida</div>
              <div className="ec-preview__diff-val">{distKmViavel.toFixed(1)} km</div>
            </div>
            <div className="ec-preview__diff-vs">vs</div>
            <div>
              <div className="ec-preview__diff-lbl">Rota mais curta ignorando restrições</div>
              <div className="ec-preview__diff-val ec-preview__diff-val--sec">{distKmGeo.toFixed(1)} km</div>
            </div>
            <div className={diffKm > 0 ? 'ec-preview__diff-tag ec-preview__diff-tag--custo' : 'ec-preview__diff-tag ec-preview__diff-tag--ganho'}>
              {diffKm > 0 ? `+${diffKm.toFixed(1)} km` : `${diffKm.toFixed(1)} km`}
            </div>
          </div>

          <div className="ec-preview__lista">
            <div className="ec-preview__lista-titulo">Nova ordem sugerida</div>
            {ordem.map((v, i) => {
              const t = timeline[i];
              const c = v.clientes ?? {};
              const janela = c.janela_entrada_inicio && c.janela_entrada_fim
                ? `${c.janela_entrada_inicio.slice(0,5)}–${c.janela_entrada_fim.slice(0,5)}`
                : null;
              const posAntes = posGeo.get(v.id);
              const mudou = posAntes !== (i + 1);
              return (
                <div key={v.id} className={`ec-preview__linha ${t.violacaoMin > 0 ? 'ec-preview__linha--viola' : ''}`}>
                  <div className="ec-preview__ord">{i + 1}</div>
                  <div className="ec-preview__info">
                    <div className="ec-preview__nome">{c.nome_empresa ?? '—'}</div>
                    <div className="ec-preview__meta">
                      chegada estimada <strong>{minutosParaHora(t.chegada)}</strong>
                      {janela && <span> · janela {janela}</span>}
                      {t.esperaMin > 0 && <span className="ec-preview__aviso"> · espera {t.esperaMin} min</span>}
                      {t.violacaoMin > 0 && <span className="ec-preview__erro"> · atrasado {t.violacaoMin} min</span>}
                    </div>
                  </div>
                  {mudou && (
                    <div className="ec-preview__mudou" title={`Antes ${posAntes}ª`}>
                      {posAntes > (i + 1) ? '↑' : '↓'} {posAntes}ª→{i + 1}ª
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <footer className="ec-modal__footer">
          <div className="ec-preview__foot-hint">
            Os horários das visitas serão atualizados para os ETAs calculados.
          </div>
          <button className="ec-btn ec-btn--sec" onClick={onFechar} disabled={aplicando}>Cancelar</button>
          <button className="ec-btn ec-btn--pri" onClick={onAplicar} disabled={aplicando}>
            {aplicando ? 'Aplicando...' : 'Aplicar nova ordem e horários'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ModalRedistribuir({ visitas, employees, agendaOrg, bloqueios, onFechar, onMudou }) {
  const [salvando, setSalvando] = useState(false);
  const [escolhas, setEscolhas] = useState({}); // visitaId -> empIdNovo

  // Para cada visita, gera lista de candidatos e sugere melhor opção
  const cards = visitas.map(v => {
    const empAtualId = String(v.funcionario_id);
    // Candidatos: não bloqueados no dia + não são o próprio
    const candidatos = employees.filter(e => {
      if (String(e.id) === empAtualId) return false;
      if (bloqueioNoDia(bloqueios, e.id, v.data_agendada)) return false;
      return true;
    }).map(e => {
      const visitasDoDia = agendaOrg[v.data_agendada]?.[e.id] ?? [];
      const cliente = v.clientes;
      let distMin = Infinity;
      for (const outra of visitasDoDia) {
        const d = distanciaKm(cliente?.lat, cliente?.lng, outra.clientes?.lat, outra.clientes?.lng);
        if (d < distMin) distMin = d;
      }
      return {
        emp: e,
        n: visitasDoDia.length,
        distMin: distMin === Infinity ? null : distMin,
      };
    });
    // Ordena: menor n visitas, depois menor distância
    candidatos.sort((a, b) => {
      if (a.n !== b.n) return a.n - b.n;
      const dA = a.distMin ?? 9999;
      const dB = b.distMin ?? 9999;
      return dA - dB;
    });
    const sugerido = candidatos[0]?.emp;
    return { visita: v, candidatos, sugerido };
  });

  // Inicializa escolhas com sugestões
  useEffect(() => {
    const init = {};
    cards.forEach(c => { if (c.sugerido) init[c.visita.id] = String(c.sugerido.id); });
    setEscolhas(init);
    // eslint-disable-next-line
  }, [visitas.length]);

  async function aplicar() {
    setSalvando(true);
    try {
      // RPC atômica (migration 015): redistribuição em uma única transação.
      const updates = Object.entries(escolhas).map(([visitaId, novoEmpId]) => ({
        id: visitaId,
        funcionario_id: String(novoEmpId),
      }));
      const { error } = await supabase.rpc('reorder_agenda', { p_updates: updates });
      if (error) throw error;
      await onMudou();
      onFechar();
    } catch (e) {
      alert('Erro ao aplicar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="ec-modal ec-modal--atras">
        <header className="ec-modal__header">
          <div>
            <h3 className="ec-modal__titulo">Redistribuir visitas de ausentes</h3>
            <p className="ec-modal__sub">Sugestão automática por carga e proximidade GPS</p>
          </div>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">
          {cards.length === 0 ? (
            <div className="ec-atras__vazio">Nenhuma visita para redistribuir.</div>
          ) : (
            cards.map(({ visita, candidatos, sugerido }) => {
              const empAtual = employees.find(e => String(e.id) === String(visita.funcionario_id));
              const dataFmt = new Date(visita.data_agendada + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' });
              return (
                <div key={visita.id} className="ec-redist__item">
                  <div className="ec-redist__info">
                    <div className="ec-redist__nome">{visita.clientes?.nome_empresa ?? '—'}</div>
                    <div className="ec-redist__meta">
                      {dataFmt} · {(visita.hora_estimada_chegada ?? '—').slice(0,5)}
                      · era do <strong>{empAtual?.name}</strong> (ausente)
                    </div>
                  </div>
                  {candidatos.length > 0 ? (
                    <select
                      className="ec-redist__select"
                      value={escolhas[visita.id] ?? ''}
                      onChange={e => setEscolhas(x => ({ ...x, [visita.id]: e.target.value }))}
                    >
                      {candidatos.map(({ emp, n, distMin }) => (
                        <option key={emp.id} value={String(emp.id)}>
                          {emp.name} · {n} visita{n !== 1 ? 's' : ''}{distMin != null ? ` · ${distMin.toFixed(1)}km` : ''}
                          {emp.id === sugerido?.id ? ' (sugerido)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="ec-redist__semaltern">Nenhum outro disponível</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <footer className="ec-modal__footer">
          <button className="ec-btn ec-btn--sec" onClick={onFechar}>Cancelar</button>
          <button className="ec-btn ec-btn--pri" onClick={aplicar} disabled={salvando || cards.length === 0}>
            {salvando ? 'Aplicando...' : `Aplicar redistribuição (${Object.keys(escolhas).length})`}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ── Modal de bloqueios (férias/folga) ───────────────────────────────────────
function ModalBloqueios({ funcionarioId, funcionarioNome, bloqueios, onFechar, onMudou }) {
  const hoje = new Date().toISOString().split('T')[0];
  const [novo, setNovo] = useState({ data_inicio: hoje, data_fim: hoje, motivo: 'Férias' });
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(null);

  async function adicionar() {
    if (novo.data_fim < novo.data_inicio) { alert('Data fim antes do início.'); return; }
    setSalvando(true);
    try {
      const { error } = await supabase.from('employee_bloqueios').insert({
        funcionario_id: funcionarioId,
        data_inicio: novo.data_inicio,
        data_fim: novo.data_fim,
        motivo: novo.motivo || null,
      });
      if (error) throw error;
      setNovo({ data_inicio: hoje, data_fim: hoje, motivo: 'Férias' });
      await onMudou();
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id) {
    if (!confirm('Remover este bloqueio?')) return;
    setRemovendo(id);
    try {
      await supabase.from('employee_bloqueios').delete().eq('id', id);
      await onMudou();
    } finally {
      setRemovendo(null);
    }
  }

  const ordenados = [...bloqueios].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="ec-modal">
        <header className="ec-modal__header">
          <div>
            <h3 className="ec-modal__titulo">Ausências de {funcionarioNome}</h3>
            <p className="ec-modal__sub">Bloqueia agendamento nos dias marcados</p>
          </div>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">
          <div className="ec-bloq__add">
            <div className="ec-grid2">
              <div className="ec-campo">
                <label>De</label>
                <input type="date" value={novo.data_inicio}
                       onChange={e => setNovo(n => ({ ...n, data_inicio: e.target.value, data_fim: e.target.value > n.data_fim ? e.target.value : n.data_fim }))} />
              </div>
              <div className="ec-campo">
                <label>Até</label>
                <input type="date" value={novo.data_fim} min={novo.data_inicio}
                       onChange={e => setNovo(n => ({ ...n, data_fim: e.target.value }))} />
              </div>
            </div>
            <div className="ec-campo">
              <label>Motivo</label>
              <select value={novo.motivo} onChange={e => setNovo(n => ({ ...n, motivo: e.target.value }))}>
                <option value="Férias">Férias</option>
                <option value="Folga">Folga</option>
                <option value="Feriado">Feriado</option>
                <option value="Atestado">Atestado</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <button className="ec-btn ec-btn--pri" onClick={adicionar} disabled={salvando}>
              {salvando ? 'Adicionando...' : '+ Adicionar bloqueio'}
            </button>
          </div>

          <div className="ec-bloq__lista">
            <div className="ec-bloq__lista-titulo">Bloqueios existentes ({ordenados.length})</div>
            {ordenados.length === 0 ? (
              <p className="ec-atras__vazio">Nenhum bloqueio cadastrado.</p>
            ) : (
              ordenados.map(b => {
                const fmt = iso => new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                const mesmo = b.data_inicio === b.data_fim;
                return (
                  <div key={b.id} className="ec-bloq__item">
                    <div className="ec-bloq__info">
                      <div className="ec-bloq__periodo">
                        {mesmo ? fmt(b.data_inicio) : `${fmt(b.data_inicio)} → ${fmt(b.data_fim)}`}
                      </div>
                      <div className="ec-bloq__motivo">{b.motivo || 'Sem motivo'}</div>
                    </div>
                    <button className="ec-bloq__del" onClick={() => remover(b.id)} disabled={removendo === b.id}>
                      {removendo === b.id ? '...' : '✕'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
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

// ────────────────────────────────────────────────────────────────────────────
//  ModalCopiarAgenda — copiar visitas de (funcionário X, dia Y) para (funcionário W, dia Z)
// ────────────────────────────────────────────────────────────────────────────
function ModalCopiarAgenda({ employees, clientes, diaSel, onFechar, onCopiado }) {
  const clienteMap = useMemo(() => {
    const m = new Map();
    clientes.forEach(c => m.set(c.id, c));
    return m;
  }, [clientes]);

  const ontem = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [origemFunc, setOrigemFunc] = useState(employees[0]?.id ? String(employees[0].id) : '');
  const [origemData, setOrigemData] = useState(ontem);
  const [destinoFunc, setDestinoFunc] = useState(employees[0]?.id ? String(employees[0].id) : '');
  const [destinoData, setDestinoData] = useState(diaSel);

  const [preview, setPreview] = useState([]); // visitas encontradas
  const [buscando, setBuscando] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [msg, setMsg] = useState('');

  async function buscar() {
    if (!origemFunc || !origemData) return;
    setBuscando(true);
    setMsg('');
    try {
      const { data, error } = await supabase
        .from('agenda')
        .select('id, cliente_id, funcionario_id, cliente_servico_id, hora_estimada_chegada, duracao_estimada_min, ordem_rota, observacoes_gestor, tipos_tarefa, status')
        .eq('funcionario_id', origemFunc)
        .eq('data_agendada', origemData)
        .order('ordem_rota', { ascending: true });
      if (error) throw error;
      setPreview(data ?? []);
      if (!data?.length) setMsg('Nenhuma visita encontrada para essa pessoa e dia.');
    } catch (e) {
      setMsg('Erro ao buscar: ' + e.message);
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => { setPreview([]); setMsg(''); }, [origemFunc, origemData]);

  async function copiar() {
    if (!preview.length || !destinoFunc || !destinoData) return;
    if (destinoFunc === origemFunc && destinoData === origemData) {
      if (!confirm('Você está copiando para a mesma pessoa e mesmo dia. Isso vai duplicar as visitas. Continuar?')) return;
    }
    setCopiando(true);
    try {
      const novas = preview.map(v => ({
        cliente_id:            v.cliente_id,
        funcionario_id:        destinoFunc,
        cliente_servico_id:    v.cliente_servico_id,
        data_agendada:         destinoData,
        hora_estimada_chegada: v.hora_estimada_chegada,
        duracao_estimada_min:  v.duracao_estimada_min,
        ordem_rota:            v.ordem_rota,
        observacoes_gestor:    v.observacoes_gestor,
        tipos_tarefa:          v.tipos_tarefa,
        status:                'rascunho',
      }));
      const { error } = await supabase.from('agenda').insert(novas);
      if (error) throw error;
      alert(`✓ ${novas.length} visita${novas.length !== 1 ? 's' : ''} copiada${novas.length !== 1 ? 's' : ''} como rascunho.`);
      onCopiado();
    } catch (e) {
      alert('Erro ao copiar: ' + e.message);
    } finally {
      setCopiando(false);
    }
  }

  const nomeOrigem  = employees.find(e => String(e.id) === String(origemFunc))?.name  ?? '—';
  const nomeDestino = employees.find(e => String(e.id) === String(destinoFunc))?.name ?? '—';

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="ec-modal ec-modal--copiar">
        <header className="ec-modal__header">
          <h3 className="ec-modal__titulo">↺ Copiar agenda</h3>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">

          {/* Origem */}
          <section className="ec-copiar__sec">
            <h4 className="ec-copiar__sec-titulo">1. Copiar de quem, e de qual dia?</h4>
            <div className="ec-copiar__linha">
              <label className="ec-copiar__campo">
                <span>Funcionário</span>
                <select value={origemFunc} onChange={e => setOrigemFunc(e.target.value)}>
                  {employees.map(e => (
                    <option key={e.id} value={String(e.id)}>{e.name}</option>
                  ))}
                </select>
              </label>
              <label className="ec-copiar__campo">
                <span>Dia</span>
                <input type="date" value={origemData} onChange={e => setOrigemData(e.target.value)} />
              </label>
              <button
                className="ec-copiar__btn-buscar"
                onClick={buscar}
                disabled={buscando || !origemFunc || !origemData}
              >
                {buscando ? '⏳' : '🔍 Buscar'}
              </button>
            </div>
          </section>

          {/* Preview */}
          {preview.length > 0 && (
            <section className="ec-copiar__sec">
              <h4 className="ec-copiar__sec-titulo">
                2. O que {nomeOrigem} fez em {new Date(origemData + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                <span className="ec-copiar__count">{preview.length} visita{preview.length !== 1 ? 's' : ''}</span>
              </h4>
              <div className="ec-copiar__preview">
                <table className="ec-copiar__tabela">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Cliente</th>
                      <th>Hora</th>
                      <th>Dur.</th>
                      <th>Tipos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((v, i) => {
                      const c = clienteMap.get(v.cliente_id);
                      return (
                        <tr key={v.id}>
                          <td>{i + 1}</td>
                          <td>{c?.nome_empresa ?? '—'}</td>
                          <td>{v.hora_estimada_chegada?.slice(0, 5) ?? '—'}</td>
                          <td>{v.duracao_estimada_min ? `${v.duracao_estimada_min}min` : '—'}</td>
                          <td className="ec-copiar__tipos">
                            {(v.tipos_tarefa ?? []).join(', ') || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {msg && !preview.length && <p className="ec-copiar__msg">{msg}</p>}

          {/* Destino */}
          {preview.length > 0 && (
            <section className="ec-copiar__sec">
              <h4 className="ec-copiar__sec-titulo">3. Aplicar para quem, e em qual dia?</h4>
              <div className="ec-copiar__linha">
                <label className="ec-copiar__campo">
                  <span>Funcionário</span>
                  <select value={destinoFunc} onChange={e => setDestinoFunc(e.target.value)}>
                    {employees.map(e => (
                      <option key={e.id} value={String(e.id)}>{e.name}</option>
                    ))}
                  </select>
                </label>
                <label className="ec-copiar__campo">
                  <span>Dia</span>
                  <input type="date" value={destinoData} onChange={e => setDestinoData(e.target.value)} />
                </label>
              </div>
              <p className="ec-copiar__hint">
                Vai criar {preview.length} visita{preview.length !== 1 ? 's' : ''} como <strong>rascunho</strong> na agenda de {nomeDestino} em {new Date(destinoData + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}.
              </p>
            </section>
          )}

        </div>

        <footer className="ec-modal__footer">
          <button className="ec-btn" onClick={onFechar} disabled={copiando}>Cancelar</button>
          <button
            className="ec-btn ec-btn--primario"
            onClick={copiar}
            disabled={copiando || !preview.length || !destinoFunc || !destinoData}
          >
            {copiando ? 'Copiando...' : `↺ Copiar ${preview.length} visita${preview.length !== 1 ? 's' : ''}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
