// src/components/ModalOrcamento/ModalOrcamento.jsx
import { useState, useEffect } from 'react';
import { useCRM } from '../../context/CRMContext';
import { supabase } from '../../lib/supabase';
import SecaoHistorico from './sections/SecaoHistorico';
import './ModalOrcamento.css';

const ICONE_CANAL = { WhatsApp: '💬', 'E-mail': '✉️', Telefone: '📞', Indicação: '🤝' };
const INDICES_REAJUSTE = ['IPCA', 'IGPM', 'INPC', 'Fixo (sem reajuste)'];

export default function ModalOrcamento() {
  const {
    modalAberto, leadSelecionado, fecharModal, atualizarLead, removerLead,
    ESTAGIOS, TIPOS_SERVICO, MOTIVOS_PERDA, CANAIS_ORIGEM, FREQUENCIAS_VISITA,
    modalFocoSecao, getTiposServico,
  } = useCRM();

  // Rola até a seção pedida quando o modal abre com foco
  useEffect(() => {
    if (!modalAberto || !modalFocoSecao) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-modal-secao="${modalFocoSecao}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('modal__secao--foco');
        setTimeout(() => el.classList.remove('modal__secao--foco'), 2200);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [modalAberto, modalFocoSecao]);

  // Carrega funcionários (para o select de "agendar visita na Escala")
  useEffect(() => {
    if (!modalAberto) return;
    (async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, name, cargo')
        .order('name');
      setFuncionarios(data ?? []);
    })();
  }, [modalAberto]);

  // Carrega agendamentos deste lead (para listar/cancelar)
  useEffect(() => {
    if (!leadSelecionado?.id) { setAgendasDoLead([]); return; }
    (async () => {
      const { data } = await supabase
        .from('agenda')
        .select('id, data_agendada, hora_estimada_chegada, duracao_estimada_min, funcionario_id, status, observacoes_gestor')
        .eq('lead_id', leadSelecionado.id)
        .neq('status', 'cancelado')
        .order('data_agendada');
      setAgendasDoLead(data ?? []);
    })();
  }, [leadSelecionado]);

  // ── Campos editáveis do modal ──────────────────────────────────────────────
  const [estagioId, setEstagioId]         = useState('');
  const [motivoPerda, setMotivoPerda]     = useState('');
  const [observacoes, setObservacoes]     = useState('');
  const [proximoFollowUp, setFollowUp]    = useState('');
  const [followUpAssuntos, setFUAssuntos] = useState([]);
  const [followUpNota, setFUNota]         = useState('');
  const [errMotivo, setErrMotivo]         = useState(false);
  const [salvo, setSalvo]                 = useState(false);

  // ── Modo edição dos dados do lead ─────────────────────────────────────────
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState({});

  // ── Contrato ──────────────────────────────────────────────────────────────
  const [contrato, setContrato] = useState({
    dataInicio: '', vigenciaMeses: 12, indiceReajuste: 'IPCA', diaFaturamento: 5,
  });

  // ── Gerador de Mensagem ───────────────────────────────────────────────────
  const [msgAberto, setMsgAberto]   = useState(false);
  const [msgTipo, setMsgTipo]       = useState('whatsapp'); // 'whatsapp' | 'email'
  const [msgCopiado, setMsgCopiado] = useState(false);

  // ── Informações Extras ────────────────────────────────────────────────────
  const [extrasAberto, setExtrasAberto] = useState(false);
  const [infoExtras, setInfoExtras]     = useState('');
  const [relatorio, setRelatorio]       = useState(null);

  // ── Fluxo do Orçamento ────────────────────────────────────────────────────
  const [fluxo, setFluxo]                       = useState(null);
  const [t1NaoCumprido, setT1NaoCumprido]       = useState(false);
  const [t1Prorrogando, setT1Prorrogando]       = useState(false);
  const [t1NovoPrazo, setT1NovoPrazo]           = useState('');
  const [mostrarMotivoCiclo, setMostrarMotivo]  = useState(false);
  const [motivoCiclo, setMotivoCiclo]           = useState('');

  // ── Visitas técnicas ──────────────────────────────────────────────────────
  const [visitas, setVisitas]                   = useState([]);

  // ── Anexo de orçamento ────────────────────────────────────────────────────
  const [anexos, setAnexos]           = useState([]); // [{ nome, tipo, tamanho, dados }]
  const [pendingFile, setPendingFile] = useState(null); // aguardando escolha substituir/adicionar
  const [mostrarEscolha, setMostrarEscolha] = useState(false);
  const [erroAnexo, setErroAnexo]     = useState('');

  // ── Agendar visita na Escala (novo — usa lead_id em agenda) ───────────────
  const [funcionarios, setFuncionarios]     = useState([]);
  const [agendasDoLead, setAgendasDoLead]   = useState([]);
  const [agendarForm, setAgendarForm]       = useState({
    funcionarioId: '', dataAgendada: '', horaEstimada: '', duracaoMin: 60, observacoes: '',
  });
  const [agendarErro, setAgendarErro]       = useState('');
  const [agendarSalvando, setAgendarSalvando] = useState(false);

  useEffect(() => {
    if (leadSelecionado) {
      setEstagioId(leadSelecionado.estagioId ?? '');
      setMotivoPerda(leadSelecionado.motivoPerda ?? '');
      setObservacoes(leadSelecionado.observacoes ?? '');
      setFollowUp(leadSelecionado.proximoFollowUp ?? '');
      setInfoExtras(leadSelecionado.infoExtras ?? '');
      setFUAssuntos(leadSelecionado.followUpAssuntos ?? []);
      setFUNota(leadSelecionado.followUpNota ?? '');
      // suporte a array novo e ao campo singular legado
      const anexosExist = leadSelecionado.orcamentoAnexos;
      const anexoLegado = leadSelecionado.orcamentoAnexo;
      if (Array.isArray(anexosExist)) {
        setAnexos(anexosExist);
      } else if (anexoLegado) {
        setAnexos([anexoLegado]);
      } else {
        setAnexos([]);
      }
      setFluxo(leadSelecionado.fluxoOrcamento ?? null);
      setVisitas(leadSelecionado.visitas ?? []);
      setT1NaoCumprido(false);
      setT1Prorrogando(false);
      setT1NovoPrazo('');
      setMostrarMotivo(false);
      setMotivoCiclo('');
      setPendingFile(null);
      setMostrarEscolha(false);
      setErroAnexo('');
      setAgendarForm({ funcionarioId: '', dataAgendada: '', horaEstimada: '', duracaoMin: 60, observacoes: '' });
      setAgendarErro('');
      setErrMotivo(false);
      setSalvo(false);
      setEditando(false);
      setEditForm({});
      setExtrasAberto(false);
      setRelatorio(null);
      setMsgAberto(false);
      setMsgCopiado(false);
      setContrato({
        dataInicio:     leadSelecionado.contrato?.dataInicio     ?? '',
        vigenciaMeses:  leadSelecionado.contrato?.vigenciaMeses  ?? 12,
        indiceReajuste: leadSelecionado.contrato?.indiceReajuste ?? 'IPCA',
        diaFaturamento: leadSelecionado.contrato?.diaFaturamento ?? 5,
      });
    }
  }, [leadSelecionado]);

  if (!modalAberto || !leadSelecionado) return null;

  const lead   = leadSelecionado;
  const tiposLead = getTiposServico(lead);
  const servicosLead = tiposLead.map((t) => ({ id: t, ...TIPOS_SERVICO[t] })).filter((s) => s.label);
  const isRecorrente          = servicosLead.some((s) => s.faturamento === 'recorrente');
  const isEvento              = tiposLead.includes('locacao_evento');
  const isRecorrenteEfetivo   = isRecorrente && lead.frequenciaVisita !== 'Pontual';
  const mudouParaNaoAprovado  = estagioId === 'orcamento_nao_aprovado';
  const isAprovado            = estagioId === 'orcamento_aprovado';
  const isRecorrenteAprovado  = isAprovado && isRecorrente;

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0,
  }).format(lead.valorEstimado ?? 0);

  // ── Gerador de Mensagem ───────────────────────────────────────────────────
  function gerarMensagem() {
    const svcLabel = servicosLead.length > 0
      ? servicosLead.map((s) => s.label).join(' + ')
      : '(sem tipo definido)';
    const valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(lead.valorEstimado ?? 0);
    if (msgTipo === 'whatsapp') {
      return `Olá, *${lead.contato}*! 👋\n\nTudo bem? Sou da *Verde Interior Paisagismo Corporativo* e estou entrando em contato a respeito do projeto de *${svcLabel}* para a *${lead.empresa}*.\n\n` +
        `Preparamos uma proposta personalizada considerando as condições do ambiente (luz artificial, ar-condicionado e seleção de espécies resistentes) com o valor estimado de *${valor}${isRecorrenteEfetivo ? '/mês' : ''}*.\n\n` +
        `Podemos agendar uma conversa para apresentar os detalhes? 😊\n\n_Verde Interior · Paisagismo Corporativo_`;
    }
    return `Assunto: Proposta de ${svcLabel} — ${lead.empresa}\n\nPrezado(a) ${lead.contato},\n\nEspero que esteja bem.\n\n` +
      `Conforme conversado, segue nossa proposta de *${svcLabel}* para a ${lead.empresa}.\n\n` +
      `Valor estimado: ${valor}${isRecorrenteEfetivo ? '/mês' : ''}\n` +
      (lead.quantidadeVasos ? `Quantidade de vasos: ${lead.quantidadeVasos}\n` : '') +
      `\nNossos serviços incluem seleção de espécies resistentes a ambientes com ar-condicionado e luz artificial, além de manutenção periódica.\n\n` +
      `Fico à disposição para esclarecer qualquer dúvida.\n\nAtenciosamente,\nEquipe Verde Interior`;
  }

  function copiarMensagem() {
    navigator.clipboard.writeText(gerarMensagem()).then(() => {
      setMsgCopiado(true);
      setTimeout(() => setMsgCopiado(false), 2000);
    });
  }

  // ── Modo edição ───────────────────────────────────────────────────────────
  function iniciarEdicao() {
    setEditForm({
      empresa:          lead.empresa ?? '',
      contato:          lead.contato ?? '',
      cargo:            lead.cargo ?? '',
      telefone:         lead.telefone ?? '',
      email:            lead.email ?? '',
      bairro:           lead.bairro ?? '',
      endereco:         lead.endereco ?? '',
      tiposServico:     getTiposServico(lead),
      canalOrigem:      lead.canalOrigem ?? 'WhatsApp',
      quantidadeVasos:  lead.quantidadeVasos ?? '',
      valorEstimado:    lead.valorEstimado ?? '',
      frequenciaVisita: lead.frequenciaVisita ?? 'Mensal',
    });
    setEditando(true);
  }

  function toggleEditTipoServico(key) {
    setEditForm((f) => {
      const atuais = f.tiposServico ?? [];
      const jaTem = atuais.includes(key);
      return { ...f, tiposServico: jaTem ? atuais.filter((t) => t !== key) : [...atuais, key] };
    });
  }

  function setEdit(campo, valor) {
    setEditForm((f) => ({ ...f, [campo]: valor }));
  }

  // ── Anexo ─────────────────────────────────────────────────────────────────
  const LIMITE_BYTES = 4 * 1024 * 1024; // 4 MB

  function lerArquivo(file, callback) {
    if (file.size > LIMITE_BYTES) {
      setErroAnexo('Arquivo muito grande. Máximo permitido: 4 MB.');
      return;
    }
    setErroAnexo('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      callback({ nome: file.name, tipo: file.type, tamanho: file.size, dados: ev.target.result });
    };
    reader.readAsDataURL(file);
  }

  // Estágios iniciais: ao anexar avança para orcamento_enviado automaticamente
  function handleAnexoInicial(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    lerArquivo(file, (novoAnexo) => {
      setAnexos([novoAnexo]);
      setEstagioId('orcamento_enviado');
    });
  }

  // Em orcamento_enviado: abre picker e armazena pending para escolha
  function handleAnexoAdicional(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    lerArquivo(file, (novoAnexo) => {
      if (anexos.length === 0) {
        setAnexos([novoAnexo]);
      } else {
        setPendingFile(novoAnexo);
        setMostrarEscolha(true);
      }
    });
  }

  function handleEscolha(modo) {
    if (!pendingFile) return;
    if (modo === 'substituir') {
      setAnexos([pendingFile]);
    } else {
      setAnexos((prev) => [...prev, pendingFile]);
    }
    setPendingFile(null);
    setMostrarEscolha(false);
  }

  function visualizarAnexo(arq) {
    const [, base64] = arq.dados.split(',');
    const byteChars = atob(base64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: arq.tipo });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  function removerAnexo(i) {
    setAnexos((prev) => prev.filter((_, idx) => idx !== i));
    setErroAnexo('');
  }

  // Abre a ferramenta HTML de geração de orçamento em nova aba, com dados do
  // lead pré-preenchidos via query string. O tool lê os params no load.
  function abrirGeradorOrcamento(lead) {
    const params = new URLSearchParams();
    if (lead.empresa)  params.set('empresa', lead.empresa);
    if (lead.contato)  params.set('contato', lead.contato);
    if (lead.endereco) params.set('endereco', lead.endereco);
    if (lead.bairro)   params.set('bairro', lead.bairro);
    if (lead.telefone) params.set('telefone', lead.telefone);
    if (lead.email)    params.set('email', lead.email);
    const primario = getTiposServico(lead)[0];
    if (primario) params.set('servico', primario);
    if (lead.quantidadeVasos) params.set('qtd_vasos', String(lead.quantidadeVasos));
    if (lead.valorEstimado) params.set('valor', String(lead.valorEstimado));
    if (lead.frequenciaVisita) params.set('frequencia', lead.frequenciaVisita);
    const url = `/gerador-orcamento.html?${params.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function iconeArquivo(tipo) {
    if (tipo === 'application/pdf') return '📄';
    if (tipo?.startsWith('image/')) return '🖼️';
    if (tipo?.includes('word')) return '📝';
    if (tipo?.includes('sheet') || tipo?.includes('excel')) return '📊';
    return '📁';
  }

  function formatarTamanho(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── Salvar ────────────────────────────────────────────────────────────────
  function handleSalvar() {
    if (mudouParaNaoAprovado && !motivoPerda) { setErrMotivo(true); return; }

    const hoje = new Date().toISOString().split('T')[0];
    const novasEntradas = [];
    const ts = Date.now();

    if (estagioId !== lead.estagioId) {
      const novoEst = ESTAGIOS.find((e) => e.id === estagioId);
      novasEntradas.push({ id: `h-${ts}-e`, tipo: 'estagio', descricao: `Movido para ${novoEst?.label ?? estagioId}`, data: hoje });
    }
    if (proximoFollowUp && proximoFollowUp !== lead.proximoFollowUp) {
      novasEntradas.push({ id: `h-${ts}-f`, tipo: 'followup', descricao: `Follow-up agendado para ${new Date(proximoFollowUp + 'T12:00').toLocaleDateString('pt-BR')}`, data: hoje });
    }
    if (anexos.length > (lead.orcamentoAnexos?.length ?? 0)) {
      novasEntradas.push({ id: `h-${ts}-a`, tipo: 'orcamento', descricao: 'Orçamento anexado', data: hoje });
    }
    const idsExistentes = new Set((lead.visitas ?? []).map((v) => v.id));
    visitas.filter((v) => v.data && !idsExistentes.has(v.id)).forEach((v, i) => {
      novasEntradas.push({ id: `h-${ts}-v${i}`, tipo: 'visita', descricao: `Visita técnica agendada para ${new Date(v.data + 'T12:00').toLocaleDateString('pt-BR')}`, data: hoje });
    });

    const base = {
      estagioId,
      motivoPerda:     mudouParaNaoAprovado ? motivoPerda : undefined,
      observacoes,
      infoExtras,
      proximoFollowUp:  proximoFollowUp || null,
      followUpAssuntos: followUpAssuntos,
      followUpNota:     followUpNota || null,
      contrato:         isAprovado ? { ...contrato } : lead.contrato,
      orcamentoAnexos:  anexos,
      orcamentoAnexo:   undefined,
      visitas:          visitas.filter((v) => v.data),
      ...(novasEntradas.length > 0 && { historico: [...(lead.historico ?? []), ...novasEntradas] }),
    };

    if (editando) {
      Object.assign(base, {
        empresa:         editForm.empresa,
        contato:         editForm.contato,
        cargo:           editForm.cargo,
        telefone:        editForm.telefone,
        email:           editForm.email,
        bairro:          editForm.bairro,
        endereco:        editForm.endereco,
        tiposServico:    editForm.tiposServico ?? [],
        canalOrigem:     editForm.canalOrigem,
        quantidadeVasos: editForm.quantidadeVasos ? Number(editForm.quantidadeVasos) : undefined,
        valorEstimado:   editForm.valorEstimado   ? Number(editForm.valorEstimado)   : undefined,
        frequenciaVisita: editForm.frequenciaVisita,
      });
    }

    atualizarLead(lead.id, base);
    setSalvo(true);
    setEditando(false);
    setTimeout(() => { setSalvo(false); fecharModal(); }, 800);
  }

  // ── Relatório completo ────────────────────────────────────────────────────
  function gerarRelatorio() {
    const data = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const div  = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    const estagioAtual = ESTAGIOS.find((e) => e.id === estagioId)?.label ?? estagioId;

    const linhas = [
      `RELATÓRIO DE LEAD — VERDE INTERIOR`,
      `Data: ${data}`,
      div,
      ``,
      `DADOS DO CLIENTE`,
      `Empresa:       ${lead.empresa}`,
      `Contato:       ${lead.contato}${lead.cargo ? ` · ${lead.cargo}` : ''}`,
      `Telefone:      ${lead.telefone || '—'}`,
      `E-mail:        ${lead.email || '—'}`,
      `Bairro:        ${lead.bairro || '—'}`,
      lead.endereco ? `Endereço:      ${lead.endereco}` : null,
      `Canal:         ${lead.canalOrigem || '—'}`,
      ``,
      `SERVIÇO`,
      `Tipo:          ${servicosLead.length ? servicosLead.map((s) => s.label).join(' + ') : '—'}`,
      `Qtd. Vasos:    ${lead.quantidadeVasos ?? '—'}`,
      isRecorrente && lead.frequenciaVisita ? `Frequência:    ${lead.frequenciaVisita}` : null,
      isEvento && lead.dataEntradaEvento
        ? `Data do Evento: ${new Date(lead.dataEntradaEvento + 'T12:00').toLocaleDateString('pt-BR')}`
        : null,
      isEvento && lead.horarioEntrega
        ? `Entrega/Retirada: ${lead.horarioEntrega} – ${lead.horarioRetirada}`
        : null,
      ``,
      `STATUS`,
      `Etapa:         ${estagioAtual}`,
      lead.dataEntrada ? `Entrada:       ${new Date(lead.dataEntrada + 'T12:00').toLocaleDateString('pt-BR')}` : null,
      lead.contrato?.dataInicio
        ? `Contrato:      Início em ${new Date(lead.contrato.dataInicio + 'T12:00').toLocaleDateString('pt-BR')} · ${lead.contrato.vigenciaMeses} meses · ${lead.contrato.indiceReajuste}`
        : null,
      ``,
      observacoes ? `OBSERVAÇÕES\n${observacoes}` : null,
      ``,
      infoExtras ? `INFORMAÇÕES EXTRAS\n${infoExtras}` : null,
      ``,
      div,
      `⚠ Ambiente com ar condicionado constante e luz artificial.`,
      `   Utilizar apenas espécies shadow-tolerant homologadas.`,
      div,
    ].filter((l) => l !== null).join('\n');

    setRelatorio(linhas);
  }

  // ── Follow-up ─────────────────────────────────────────────────────────────
  // Enxuto para 4 ações reais do funil + "Só lembrete" (tipo=lembrete).
  // Se precisar de algo fora dessas 4 ações, o usuário escreve na nota rápida.
  // Labels e ids em sync com FU_ASSUNTO_LABEL em Dashboard.jsx.
  const FOLLOWUP_ASSUNTOS = [
    { id: 'enviar_orcamento',    label: 'Enviar orçamento',    icone: '📄', tipo: 'acao' },
    { id: 'confirmar_aprovacao', label: 'Confirmar aprovação', icone: '✅', tipo: 'acao' },
    { id: 'agendar_visita',      label: 'Agendar visita',      icone: '📅', tipo: 'acao' },
    { id: 'retornar_contato',    label: 'Retornar contato',    icone: '📞', tipo: 'acao' },
    { id: 'lembrete',            label: 'Só lembrete',         icone: '🕐', tipo: 'lembrete' },
  ];

  function toggleAssunto(id) {
    setFUAssuntos((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  // ── Visitas ───────────────────────────────────────────────────────────────
  function adicionarVisita() {
    if (visitas.length >= 2) return;
    setVisitas((prev) => [...prev, { id: `v-${Date.now()}`, data: '', obs: '' }]);
  }
  function atualizarVisita(idx, campo, valor) {
    setVisitas((prev) => prev.map((v, i) => i === idx ? { ...v, [campo]: valor } : v));
  }
  function removerVisita(idx) {
    setVisitas((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Agendar visita técnica na Escala (lead → agenda) ──────────────────────
  // Cria row em `agenda` com lead_id (sem cliente_id — vira visita "lead" na Escala).
  // Uma tarefa correspondente também é criada em `tarefas` para não perder rastro no CRM.
  async function publicarAgendaLead() {
    setAgendarErro('');
    const { funcionarioId, dataAgendada, horaEstimada, duracaoMin, observacoes } = agendarForm;
    if (!funcionarioId) { setAgendarErro('Selecione o funcionário responsável.'); return; }
    if (!dataAgendada)  { setAgendarErro('Escolha a data da visita.'); return; }

    setAgendarSalvando(true);
    const payload = {
      lead_id:                lead.id,
      cliente_id:             null,
      funcionario_id:         String(funcionarioId),
      data_agendada:          dataAgendada,
      hora_estimada_chegada:  horaEstimada || null,
      duracao_estimada_min:   duracaoMin || 60,
      status:                 'publicado',
      publicado_em:           new Date().toISOString(),
      observacoes_gestor:     observacoes || null,
      ordem_rota:             0,
    };
    const { data, error } = await supabase.from('agenda').insert(payload).select().single();
    setAgendarSalvando(false);

    if (error) {
      setAgendarErro(`Falha ao publicar: ${error.message}`);
      return;
    }

    setAgendasDoLead((prev) => [...prev, data]);
    setAgendarForm({ funcionarioId: '', dataAgendada: '', horaEstimada: '', duracaoMin: 60, observacoes: '' });
    // Registra no histórico do lead
    const hoje = new Date().toISOString().split('T')[0];
    const funcNome = funcionarios.find((f) => String(f.id) === String(funcionarioId))?.name ?? 'colaborador';
    atualizarLead(lead.id, {
      historico: [...(lead.historico ?? []), {
        id: `h-${Date.now()}`,
        tipo: 'agenda',
        descricao: `Visita técnica agendada para ${new Date(dataAgendada + 'T12:00').toLocaleDateString('pt-BR')} com ${funcNome}`,
        data: hoje,
      }],
    });
  }

  async function cancelarAgendaLead(agendaId) {
    if (!confirm('Cancelar essa visita técnica na Escala? O funcionário deixa de vê-la no App Ponto.')) return;
    const { error } = await supabase.from('agenda').update({ status: 'cancelado' }).eq('id', agendaId);
    if (error) { alert('Falha ao cancelar: ' + error.message); return; }
    setAgendasDoLead((prev) => prev.filter((a) => a.id !== agendaId));
  }

  // ── Fluxo do Orçamento ────────────────────────────────────────────────────
  function addDiasFront(isoDate, dias) {
    const d = new Date(isoDate + 'T12:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
  }

  function salvarFluxo(novoFluxo) {
    setFluxo(novoFluxo);
    atualizarLead(lead.id, { fluxoOrcamento: novoFluxo });
  }

  function concluirT1() {
    const hoje = new Date().toISOString().split('T')[0];
    salvarFluxo({ ...fluxo, etapaAtual: 't2', t1: { ...fluxo.t1, status: 'concluida', concluidaEm: hoje } });
    setT1NaoCumprido(false);
  }

  function prorrogarT1() {
    if (!t1NovoPrazo) return;
    salvarFluxo({
      ...fluxo,
      t1: { ...fluxo.t1, status: 'prorrogada', prazoData: t1NovoPrazo,
        prorrogacoes: [...(fluxo.t1.prorrogacoes ?? []), { de: fluxo.t1.prazoData, para: t1NovoPrazo }] },
    });
    setT1NaoCumprido(false); setT1Prorrogando(false); setT1NovoPrazo('');
  }

  function arquivarLeadFluxo() {
    const hoje = new Date().toISOString().split('T')[0];
    atualizarLead(lead.id, { arquivado: true, arquivadoEm: hoje, fluxoOrcamento: { ...fluxo, t1: { ...fluxo.t1, status: 'arquivada' } } });
    fecharModal();
  }

  function confirmarEnvioT2() {
    if (!fluxo.t2.envioWhatsapp && !fluxo.t2.envioEmail) return;
    const hoje = new Date().toISOString().split('T')[0];
    const novoFluxo = { ...fluxo, etapaAtual: 't3', t2: { ...fluxo.t2, status: 'concluida', enviadoEm: hoje } };
    setFluxo(novoFluxo);
    setEstagioId('orcamento_enviado');
    atualizarLead(lead.id, { fluxoOrcamento: novoFluxo, estagioId: 'orcamento_enviado' });
  }

  function marcarUrgenteT2() {
    salvarFluxo({ ...fluxo, urgente: true, t2: { ...fluxo.t2, status: 'urgente' } });
  }

  function toggleEnvioT2(canal) {
    salvarFluxo({ ...fluxo, t2: { ...fluxo.t2, [canal]: !fluxo.t2[canal] } });
  }

  function confirmarRecebimentoT3() {
    const hoje = new Date().toISOString().split('T')[0];
    const prazo = fluxo.cicloAprovacao.prazoDias;
    const dataLimite = addDiasFront(hoje, prazo);
    const novaTentativa = { tentativa: 1, dataInicio: hoje, dataLimite, resultado: null, motivoPerda: '' };
    salvarFluxo({
      ...fluxo, etapaAtual: 'ciclo_aprovacao', aguardandoResposta: true,
      t3: { ...fluxo.t3, status: 'concluida', confirmadoEm: hoje },
      cicloAprovacao: { ...fluxo.cicloAprovacao, historico: [novaTentativa] },
    });
  }

  function registrarAprovado() {
    const historico = fluxo.cicloAprovacao.historico;
    const ultima = { ...historico[historico.length - 1], resultado: 'aprovado' };
    const novoFluxo = {
      ...fluxo, etapaAtual: 'concluido', aguardandoResposta: false, urgente: false,
      cicloAprovacao: { ...fluxo.cicloAprovacao, historico: [...historico.slice(0, -1), ultima] },
    };
    setFluxo(novoFluxo);
    setEstagioId('orcamento_aprovado');
    atualizarLead(lead.id, { fluxoOrcamento: novoFluxo, estagioId: 'orcamento_aprovado' });
    setSalvo(true);
    setTimeout(() => { setSalvo(false); fecharModal(); }, 900);
  }

  function registrarNaoAprovado() {
    if (!motivoCiclo) { setMostrarMotivo(true); return; }
    const historico = fluxo.cicloAprovacao.historico;
    const ultima = { ...historico[historico.length - 1], resultado: 'nao_aprovado', motivoPerda: motivoCiclo };
    const novoFluxo = {
      ...fluxo, etapaAtual: 'concluido', aguardandoResposta: false,
      cicloAprovacao: { ...fluxo.cicloAprovacao, historico: [...historico.slice(0, -1), ultima] },
    };
    setFluxo(novoFluxo);
    setEstagioId('orcamento_nao_aprovado');
    setMotivoPerda(motivoCiclo);
    atualizarLead(lead.id, { fluxoOrcamento: novoFluxo, estagioId: 'orcamento_nao_aprovado', motivoPerda: motivoCiclo });
    setSalvo(true);
    setTimeout(() => { setSalvo(false); fecharModal(); }, 900);
  }

  function registrarSemResposta() {
    const hoje = new Date().toISOString().split('T')[0];
    const historico = fluxo.cicloAprovacao.historico;
    const ultima = { ...historico[historico.length - 1], resultado: 'sem_resposta' };
    const novosPrazoDias = Math.max(1, Math.floor(fluxo.cicloAprovacao.prazoDias / 2));
    const dataLimite = addDiasFront(hoje, novosPrazoDias);
    const novaTentativa = { tentativa: historico.length + 1, dataInicio: hoje, dataLimite, resultado: null, motivoPerda: '' };
    salvarFluxo({
      ...fluxo,
      cicloAprovacao: { prazoDias: novosPrazoDias, historico: [...historico.slice(0, -1), ultima, novaTentativa] },
    });
  }

  function formatarDataFluxo(iso) {
    if (!iso) return '—';
    return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function statusPrazoFluxo(prazoData) {
    if (!prazoData) return null;
    const hoje = new Date().toISOString().split('T')[0];
    if (prazoData < hoje) return 'atrasado';
    if (prazoData === hoje) return 'hoje';
    return null;
  }

  function copiarRelatorio() {
    if (relatorio) navigator.clipboard.writeText(relatorio);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && fecharModal()}>
      <div className="modal" role="dialog" aria-modal="true">

        {/* ── Cabeçalho ── */}
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">{editando ? (editForm.empresa || lead.empresa) : lead.empresa}</h2>
            <p className="modal__subinfo">
              {editando ? (editForm.contato || lead.contato) : lead.contato}
              {(editando ? editForm.cargo : lead.cargo) && (
                <span> · {editando ? editForm.cargo : lead.cargo}</span>
              )}
            </p>
          </div>
          <div className="modal__header-acoes">
            <button
              className={`modal__btn-editar ${editando ? 'modal__btn-editar--ativo' : ''}`}
              onClick={editando ? () => setEditando(false) : iniciarEdicao}
              title={editando ? 'Cancelar edição' : 'Editar dados do lead'}
            >
              {editando ? '✕ Cancelar Edição' : '✏ Editar'}
            </button>
            <button
              className="modal__btn-excluir"
              onClick={() => {
                if (!confirm(`Excluir o lead "${lead.empresa}"?\n\nEssa ação remove o lead do pipeline e não pode ser desfeita.`)) return;
                removerLead(lead.id);
                fecharModal();
              }}
              title="Excluir lead"
            >
              🗑 Excluir
            </button>
            <button className="modal__fechar" onClick={fecharModal} aria-label="Fechar">✕</button>
          </div>
        </header>

        {/* ── Corpo ── */}
        <div className="modal__body">

          {/* ── Dados do Cliente ── */}
          <section className="modal__secao">
            <h3 className="modal__secao-titulo">Dados do Cliente</h3>
            {editando ? (
              <div className="modal__grid">
                <div className="modal__campo-editavel">
                  <label className="modal__label">Empresa</label>
                  <input className="modal__input" value={editForm.empresa} onChange={(e) => setEdit('empresa', e.target.value)} />
                </div>
                <div className="modal__campo-editavel">
                  <label className="modal__label">Contato</label>
                  <input className="modal__input" value={editForm.contato} onChange={(e) => setEdit('contato', e.target.value)} />
                </div>
                <div className="modal__campo-editavel">
                  <label className="modal__label">Cargo</label>
                  <input className="modal__input" value={editForm.cargo} onChange={(e) => setEdit('cargo', e.target.value)} placeholder="Opcional" />
                </div>
                <div className="modal__campo-editavel">
                  <label className="modal__label">Telefone</label>
                  <input className="modal__input" value={editForm.telefone} onChange={(e) => setEdit('telefone', e.target.value)} />
                </div>
                <div className="modal__campo-editavel">
                  <label className="modal__label">E-mail</label>
                  <input className="modal__input" value={editForm.email} onChange={(e) => setEdit('email', e.target.value)} type="email" />
                </div>
                <div className="modal__campo-editavel">
                  <label className="modal__label">Bairro</label>
                  <input className="modal__input" value={editForm.bairro} onChange={(e) => setEdit('bairro', e.target.value)} />
                </div>
                <div className="modal__campo-editavel modal__campo-readonly--wide">
                  <label className="modal__label">Endereço</label>
                  <input className="modal__input" value={editForm.endereco} onChange={(e) => setEdit('endereco', e.target.value)} placeholder="Opcional" />
                </div>
                <div className="modal__campo-editavel">
                  <label className="modal__label">Canal de Origem</label>
                  <select className="modal__select" value={editForm.canalOrigem} onChange={(e) => setEdit('canalOrigem', e.target.value)}>
                    {(CANAIS_ORIGEM ?? ['WhatsApp', 'E-mail', 'Telefone', 'Indicação']).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="modal__grid">
                <div className="modal__campo-readonly">
                  <span className="modal__label">Telefone</span>
                  <span>{lead.telefone}</span>
                </div>
                <div className="modal__campo-readonly">
                  <span className="modal__label">E-mail</span>
                  <span>{lead.email}</span>
                </div>
                <div className="modal__campo-readonly">
                  <span className="modal__label">Bairro</span>
                  <span>📍 {lead.bairro || '—'}</span>
                </div>
                {lead.endereco && (
                  <div className="modal__campo-readonly modal__campo-readonly--wide">
                    <span className="modal__label">Endereço</span>
                    <span>{lead.endereco}</span>
                  </div>
                )}
                <div className="modal__campo-readonly">
                  <span className="modal__label">Canal de Origem</span>
                  <span>{ICONE_CANAL[lead.canalOrigem]} {lead.canalOrigem}</span>
                </div>
              </div>
            )}
          </section>

          {/* ── Serviço e Valores ── */}
          <section className="modal__secao">
            <h3 className="modal__secao-titulo">Serviço e Valores</h3>
            {editando ? (
              <div className="modal__grid">
                <div className="modal__campo-editavel modal__campo-readonly--wide">
                  <label className="modal__label">Tipos de Serviço <span className="modal__label-opc">(marque um ou mais)</span></label>
                  <div className="modal__tipos-servico-multi">
                    {Object.entries(TIPOS_SERVICO).map(([k, v]) => {
                      const ativo = (editForm.tiposServico ?? []).includes(k);
                      return (
                        <label
                          key={k}
                          className={`modal__tipo-servico-opcao ${ativo ? 'modal__tipo-servico-opcao--ativo' : ''}`}
                          style={{ '--svc-cor': v.cor }}
                        >
                          <input
                            type="checkbox"
                            checked={ativo}
                            onChange={() => toggleEditTipoServico(k)}
                          />
                          {v.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="modal__campo-editavel">
                  <label className="modal__label">Qtd. de Vasos</label>
                  <input className="modal__input" type="number" min={0} value={editForm.quantidadeVasos} onChange={(e) => setEdit('quantidadeVasos', e.target.value)} />
                </div>
                <div className="modal__campo-editavel">
                  <label className="modal__label">Valor Estimado (R$)</label>
                  <input className="modal__input" type="number" min={0} value={editForm.valorEstimado} onChange={(e) => setEdit('valorEstimado', e.target.value)} />
                </div>
                {(editForm.tiposServico ?? []).some((t) => TIPOS_SERVICO[t]?.faturamento === 'recorrente') && (
                  <div className="modal__campo-editavel">
                    <label className="modal__label">Frequência de Visita</label>
                    <select className="modal__select" value={editForm.frequenciaVisita} onChange={(e) => setEdit('frequenciaVisita', e.target.value)}>
                      {(FREQUENCIAS_VISITA ?? ['Mensal', 'Quinzenal', 'Semanal'])
                        .filter((f) => f !== 'Pontual' || (editForm.tiposServico ?? []).includes('manutencao'))
                        .map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="modal__grid">
                <div className="modal__campo-readonly modal__campo-readonly--wide">
                  <span className="modal__label">Tipos de Serviço</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {servicosLead.length === 0 ? (
                      <span className="modal__badge" style={{ '--badge-cor': '#6B7280' }}>—</span>
                    ) : (
                      servicosLead.map((s) => (
                        <span key={s.id} className="modal__badge" style={{ '--badge-cor': s.cor }}>
                          {s.label}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="modal__campo-readonly">
                  <span className="modal__label">Qtd. de Vasos</span>
                  <span>🪴 {lead.quantidadeVasos ?? '—'}</span>
                </div>
                <div className="modal__campo-readonly">
                  <span className="modal__label">Valor Estimado</span>
                  <span className="modal__valor">
                    {valorFormatado}
                    {isRecorrenteEfetivo && <span className="modal__recorrencia">/mês</span>}
                  </span>
                </div>
                {isRecorrente && lead.frequenciaVisita && (
                  <div className="modal__campo-readonly">
                    <span className="modal__label">Frequência de Visita</span>
                    <span>{lead.frequenciaVisita}</span>
                  </div>
                )}
                {isEvento && lead.dataEntradaEvento && (
                  <>
                    <div className="modal__campo-readonly">
                      <span className="modal__label">Data do Evento</span>
                      <span>{new Date(lead.dataEntradaEvento + 'T12:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="modal__campo-readonly">
                      <span className="modal__label">Entrega / Retirada</span>
                      <span>{lead.horarioEntrega} – {lead.horarioRetirada}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* ── Visitas técnicas (sempre editável) ── */}
          <div className="modal__visitas-bloco">
            <span className="modal__label">🗓 Visita Técnica</span>
            {visitas.map((v, idx) => (
              <div key={v.id} className="modal__visita-item">
                <span className="modal__visita-num">Visita {idx + 1}</span>
                <input
                  type="date"
                  className="modal__input modal__visita-input"
                  value={v.data}
                  onChange={(e) => atualizarVisita(idx, 'data', e.target.value)}
                />
                <input
                  type="text"
                  className="modal__input modal__visita-obs"
                  value={v.obs}
                  placeholder="Obs. (opcional)"
                  onChange={(e) => atualizarVisita(idx, 'obs', e.target.value)}
                />
                <button className="modal__visita-remover" onClick={() => removerVisita(idx)} title="Remover visita">✕</button>
              </div>
            ))}
            {visitas.length < 2 && (
              <button className="modal__visita-add" onClick={adicionarVisita}>
                + Agendar visita técnica
              </button>
            )}
            {visitas.length > 0 && fluxo?.t1?.status === 'pendente' && (
              <p className="modal__visita-hint">📌 Com visita agendada, o prazo da Tarefa 1 é de 6 dias.</p>
            )}
          </div>

          {/* ── Publicar visita na Escala do Campo ────────────────────────── */}
          <section className="modal__secao modal__secao--agenda-lead">
            <h3 className="modal__secao-titulo">📅 Agendar visita técnica na Escala</h3>
            <p className="modal__agenda-lead-hint">
              Ao publicar, esta visita aparece na Escala do funcionário escolhido, sem precisar cadastrar como Cliente.
              Ideal para visitas técnicas antes do orçamento fechar.
            </p>

            {/* Visitas já publicadas */}
            {agendasDoLead.length > 0 && (
              <ul className="modal__agenda-lead-lista">
                {agendasDoLead.map((a) => {
                  const func = funcionarios.find((f) => String(f.id) === String(a.funcionario_id));
                  const dataFmt = new Date(a.data_agendada + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
                  return (
                    <li key={a.id} className="modal__agenda-lead-item">
                      <div className="modal__agenda-lead-item-info">
                        <strong>{dataFmt}</strong>
                        {a.hora_estimada_chegada && <span> · {a.hora_estimada_chegada.slice(0, 5)}</span>}
                        <span> · {func?.name ?? 'colaborador'}</span>
                        {a.observacoes_gestor && <span className="modal__agenda-lead-obs">"{a.observacoes_gestor}"</span>}
                      </div>
                      <button
                        type="button"
                        className="modal__agenda-lead-cancelar"
                        onClick={() => cancelarAgendaLead(a.id)}
                        title="Cancelar essa visita"
                      >
                        ✕ Cancelar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Formulário */}
            <div className="modal__agenda-lead-form">
              <div className="modal__campo-editavel">
                <label className="modal__label">Funcionário responsável</label>
                <select
                  className="modal__select"
                  value={agendarForm.funcionarioId}
                  onChange={(e) => setAgendarForm((f) => ({ ...f, funcionarioId: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}{f.cargo ? ` · ${f.cargo}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="modal__campo-editavel">
                <label className="modal__label">Data</label>
                <input
                  type="date"
                  className="modal__input"
                  value={agendarForm.dataAgendada}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setAgendarForm((f) => ({ ...f, dataAgendada: e.target.value }))}
                />
              </div>
              <div className="modal__campo-editavel">
                <label className="modal__label">Hora estimada <span className="modal__label-opc">(opcional)</span></label>
                <input
                  type="time"
                  className="modal__input"
                  value={agendarForm.horaEstimada}
                  onChange={(e) => setAgendarForm((f) => ({ ...f, horaEstimada: e.target.value }))}
                />
              </div>
              <div className="modal__campo-editavel">
                <label className="modal__label">Duração (min)</label>
                <input
                  type="number"
                  min={15} step={15}
                  className="modal__input"
                  value={agendarForm.duracaoMin}
                  onChange={(e) => setAgendarForm((f) => ({ ...f, duracaoMin: Number(e.target.value) || 60 }))}
                />
              </div>
              <div className="modal__campo-editavel modal__campo-readonly--wide">
                <label className="modal__label">Observações para o funcionário <span className="modal__label-opc">(opcional)</span></label>
                <textarea
                  className="modal__textarea"
                  rows={2}
                  value={agendarForm.observacoes}
                  placeholder="Ex: chegar pela recepção, subir 12º andar, falar com Maria..."
                  onChange={(e) => setAgendarForm((f) => ({ ...f, observacoes: e.target.value }))}
                />
              </div>
            </div>

            {agendarErro && <p className="modal__anexo-erro">{agendarErro}</p>}

            <div className="modal__agenda-lead-acoes">
              <button
                type="button"
                className="modal__btn-agendar-lead"
                onClick={publicarAgendaLead}
                disabled={agendarSalvando}
              >
                {agendarSalvando ? 'Publicando...' : '📅 Publicar na Escala'}
              </button>
            </div>
          </section>

          {/* ── Orçamento (se existir) ── */}
          {lead.orcamento && (
            <section className="modal__secao">
              <h3 className="modal__secao-titulo">
                Orçamento {lead.orcamento.numero}
                <span className="modal__orcamento-validade">
                  válido até {new Date(lead.orcamento.validade + 'T12:00').toLocaleDateString('pt-BR')}
                </span>
              </h3>
              <p className="modal__orcamento-descricao">{lead.orcamento.descricao}</p>
            </section>
          )}

          {/* ── Observações ── */}
          <section className="modal__secao">
            <h3 className="modal__secao-titulo">Observações</h3>
            <textarea
              className="modal__textarea"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações internas sobre este lead..."
            />
          </section>

          {/* ── Próximo Follow-up ── */}
          <section className="modal__secao modal__secao--followup">
            <h3 className="modal__secao-titulo">
              Próximo Follow-up
              {followUpAssuntos.length > 0 && (
                <span className="modal__followup-badge">{followUpAssuntos.length} assunto{followUpAssuntos.length > 1 ? 's' : ''}</span>
              )}
            </h3>

            {/* Assuntos — ações reais primeiro, "só lembrete" separado */}
            <div className="modal__followup-assuntos">
              {FOLLOWUP_ASSUNTOS.filter((a) => a.tipo === 'acao').map((a) => {
                const ativo = followUpAssuntos.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`modal__followup-pill ${ativo ? 'modal__followup-pill--ativo' : ''}`}
                    onClick={() => toggleAssunto(a.id)}
                  >
                    <span>{a.icone}</span>
                    {a.label}
                  </button>
                );
              })}
              {FOLLOWUP_ASSUNTOS.filter((a) => a.tipo === 'lembrete').map((a) => {
                const ativo = followUpAssuntos.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`modal__followup-pill modal__followup-pill--lembrete ${ativo ? 'modal__followup-pill--ativo' : ''}`}
                    onClick={() => toggleAssunto(a.id)}
                    title="Marque quando o follow-up é só um lembrete de data, sem ação pendente"
                  >
                    <span>{a.icone}</span>
                    {a.label}
                  </button>
                );
              })}
            </div>

            {/* Data + limpar */}
            <div className="modal__followup-data-row">
              <label className="modal__label" style={{ flexShrink: 0 }}>Data</label>
              <input
                type="date"
                className="modal__input"
                value={proximoFollowUp}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFollowUp(e.target.value)}
                style={{ flex: 1 }}
              />
              {proximoFollowUp && (
                <button
                  type="button"
                  className="modal__followup-limpar"
                  onClick={() => { setFollowUp(''); setFUAssuntos([]); setFUNota(''); }}
                >
                  Limpar tudo
                </button>
              )}
            </div>

            {proximoFollowUp && (
              <p className="modal__followup-aviso">
                🔔 Agendado para {new Date(proximoFollowUp + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
            )}

            {/* Nota opcional */}
            <div className="modal__campo-editavel">
              <label className="modal__label" htmlFor="followup-nota">Nota rápida <span className="modal__label-opc">(opcional)</span></label>
              <input
                id="followup-nota"
                className="modal__input"
                value={followUpNota}
                onChange={(e) => setFUNota(e.target.value)}
                placeholder="Ex: aguardando retorno do financeiro..."
                maxLength={120}
              />
            </div>
          </section>

          {/* ── Checklist do Orçamento ── */}
          {fluxo && ['orcamento_pendente', 'orcamento_enviado'].includes(estagioId) && (
            <section className="modal__secao modal__secao--fluxo">
              <h3 className="modal__secao-titulo">
                📋 Checklist do Orçamento
                {fluxo.urgente && <span className="modal__fluxo-badge modal__fluxo-badge--urgente">⚠ URGENTE</span>}
                {fluxo.aguardandoResposta && <span className="modal__fluxo-badge modal__fluxo-badge--aguardando">⏳ Aguardando Resposta</span>}
              </h3>

              {/* T1 — Preencher Orçamento */}
              <div className={`modal__fluxo-tarefa ${fluxo.etapaAtual === 't1' ? 'modal__fluxo-tarefa--ativa' : ''} ${fluxo.t1.status === 'concluida' ? 'modal__fluxo-tarefa--concluida' : ''} ${['nao_cumprida', 'prorrogada'].includes(fluxo.t1.status) ? 'modal__fluxo-tarefa--problema' : ''}`}>
                <div className="modal__fluxo-tarefa-header">
                  <div className="modal__fluxo-tarefa-titulo">
                    <span className="modal__fluxo-icone">
                      {fluxo.t1.status === 'concluida' ? '✅' : fluxo.t1.status === 'prorrogada' ? '📅' : fluxo.t1.status === 'arquivada' ? '🗂️' : '1️⃣'}
                    </span>
                    <span>Preencher Orçamento</span>
                  </div>
                  <div className="modal__fluxo-tarefa-prazo" data-status={statusPrazoFluxo(fluxo.t1.prazoData)}>
                    Prazo: {formatarDataFluxo(fluxo.t1.prazoData)}
                  </div>
                </div>

                {fluxo.t1.status === 'concluida' && (
                  <p className="modal__fluxo-concluida-em">Concluída em {formatarDataFluxo(fluxo.t1.concluidaEm)}</p>
                )}

                {fluxo.etapaAtual === 't1' && fluxo.t1.status !== 'concluida' && !t1NaoCumprido && (
                  <div className="modal__fluxo-acoes">
                    <button className="modal__fluxo-btn modal__fluxo-btn--ok" onClick={concluirT1}>✅ Concluir</button>
                    <button className="modal__fluxo-btn modal__fluxo-btn--fail" onClick={() => setT1NaoCumprido(true)}>❌ Não cumprido</button>
                  </div>
                )}

                {t1NaoCumprido && (
                  <div className="modal__fluxo-nao-cumprido">
                    <p className="modal__fluxo-nao-cumprido-aviso">⚠ O prazo não foi cumprido. O que deseja fazer?</p>
                    {!t1Prorrogando ? (
                      <div className="modal__fluxo-acoes">
                        <button className="modal__fluxo-btn modal__fluxo-btn--prorrogar" onClick={() => setT1Prorrogando(true)}>📅 Prorrogar</button>
                        <button className="modal__fluxo-btn modal__fluxo-btn--arquivar" onClick={arquivarLeadFluxo}>🗂️ Arquivar Lead</button>
                        <button className="modal__fluxo-btn modal__fluxo-btn--cancelar" onClick={() => setT1NaoCumprido(false)}>Voltar</button>
                      </div>
                    ) : (
                      <div className="modal__fluxo-prorrogar-form">
                        <label className="modal__label">Nova data limite</label>
                        <div className="modal__fluxo-acoes">
                          <input type="date" className="modal__input" value={t1NovoPrazo}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setT1NovoPrazo(e.target.value)} />
                          <button className="modal__fluxo-btn modal__fluxo-btn--ok" onClick={prorrogarT1}>Confirmar</button>
                          <button className="modal__fluxo-btn modal__fluxo-btn--cancelar" onClick={() => setT1Prorrogando(false)}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* T2 — Elaborar e Enviar Orçamento */}
              <div className={`modal__fluxo-tarefa ${fluxo.etapaAtual === 't2' ? 'modal__fluxo-tarefa--ativa' : ''} ${fluxo.t2.status === 'concluida' ? 'modal__fluxo-tarefa--concluida' : ''} ${fluxo.t2.status === 'urgente' ? 'modal__fluxo-tarefa--urgente' : ''} ${!['t2','t3','ciclo_aprovacao','concluido'].includes(fluxo.etapaAtual) && fluxo.t2.status !== 'concluida' ? 'modal__fluxo-tarefa--bloqueada' : ''}`}>
                <div className="modal__fluxo-tarefa-header">
                  <div className="modal__fluxo-tarefa-titulo">
                    <span className="modal__fluxo-icone">
                      {fluxo.t2.status === 'concluida' ? '✅' : fluxo.t2.status === 'urgente' ? '🚨' : '2️⃣'}
                    </span>
                    <span>Elaborar e Enviar Orçamento</span>
                  </div>
                  <div className="modal__fluxo-tarefa-prazo" data-status={statusPrazoFluxo(fluxo.t2.prazoData)}>
                    Prazo: {formatarDataFluxo(fluxo.t2.prazoData)}
                  </div>
                </div>

                {fluxo.t2.status === 'concluida' && (
                  <p className="modal__fluxo-concluida-em">Enviado em {formatarDataFluxo(fluxo.t2.enviadoEm)}</p>
                )}

                {fluxo.etapaAtual === 't2' && fluxo.t2.status !== 'concluida' && (
                  <>
                    <div className="modal__fluxo-envio-checks">
                      <label className="modal__fluxo-check">
                        <input type="checkbox" checked={fluxo.t2.envioWhatsapp}
                          onChange={() => toggleEnvioT2('envioWhatsapp')} />
                        <span>💬 WhatsApp enviado</span>
                      </label>
                      <label className="modal__fluxo-check">
                        <input type="checkbox" checked={fluxo.t2.envioEmail}
                          onChange={() => toggleEnvioT2('envioEmail')} />
                        <span>✉️ E-mail enviado</span>
                      </label>
                    </div>
                    <div className="modal__fluxo-acoes">
                      <button
                        className={`modal__fluxo-btn modal__fluxo-btn--ok ${!fluxo.t2.envioWhatsapp && !fluxo.t2.envioEmail ? 'modal__fluxo-btn--disabled' : ''}`}
                        onClick={confirmarEnvioT2}
                        disabled={!fluxo.t2.envioWhatsapp && !fluxo.t2.envioEmail}
                      >
                        📤 Confirmar Envio
                      </button>
                      {!fluxo.urgente && (
                        <button className="modal__fluxo-btn modal__fluxo-btn--urgente" onClick={marcarUrgenteT2}>⚠ Marcar URGENTE</button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* T3 — Confirmar Recebimento */}
              <div className={`modal__fluxo-tarefa ${fluxo.etapaAtual === 't3' ? 'modal__fluxo-tarefa--ativa' : ''} ${fluxo.t3.status === 'concluida' ? 'modal__fluxo-tarefa--concluida' : ''} ${!['t3','ciclo_aprovacao','concluido'].includes(fluxo.etapaAtual) && fluxo.t3.status !== 'concluida' ? 'modal__fluxo-tarefa--bloqueada' : ''}`}>
                <div className="modal__fluxo-tarefa-header">
                  <div className="modal__fluxo-tarefa-titulo">
                    <span className="modal__fluxo-icone">
                      {fluxo.t3.status === 'concluida' ? '✅' : '3️⃣'}
                    </span>
                    <span>Confirmar Recebimento pelo Cliente</span>
                  </div>
                  <div className="modal__fluxo-tarefa-prazo" data-status={statusPrazoFluxo(fluxo.t3.prazoData)}>
                    Prazo: {formatarDataFluxo(fluxo.t3.prazoData)}
                  </div>
                </div>

                {fluxo.t3.status === 'concluida' && (
                  <p className="modal__fluxo-concluida-em">Confirmado em {formatarDataFluxo(fluxo.t3.confirmadoEm)}</p>
                )}

                {fluxo.etapaAtual === 't3' && fluxo.t3.status !== 'concluida' && (
                  <div className="modal__fluxo-acoes">
                    <button className="modal__fluxo-btn modal__fluxo-btn--ok" onClick={confirmarRecebimentoT3}>✅ Cliente Recebeu</button>
                  </div>
                )}
              </div>

              {/* Ciclo de Aprovação */}
              {(fluxo.etapaAtual === 'ciclo_aprovacao' || fluxo.cicloAprovacao.historico.length > 0) && (
                <div className="modal__fluxo-ciclo">
                  <div className="modal__fluxo-ciclo-header">
                    <span className="modal__fluxo-ciclo-titulo">⏳ Ciclo de Aprovação</span>
                    {fluxo.etapaAtual === 'ciclo_aprovacao' && (
                      <div className="modal__fluxo-ciclo-prazo">
                        <span className="modal__label" style={{ fontSize: '11px' }}>Prazo (dias):</span>
                        <input type="number" min={1} max={60} className="modal__input modal__fluxo-prazo-input"
                          value={fluxo.cicloAprovacao.prazoDias}
                          onChange={(e) => salvarFluxo({ ...fluxo, cicloAprovacao: { ...fluxo.cicloAprovacao, prazoDias: Number(e.target.value) } })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Histórico de tentativas */}
                  {fluxo.cicloAprovacao.historico.map((t, i) => (
                    <div key={i} className={`modal__fluxo-tentativa ${t.resultado === null ? 'modal__fluxo-tentativa--ativa' : ''}`}>
                      <div className="modal__fluxo-tentativa-info">
                        <span className="modal__fluxo-tentativa-num">Tentativa {t.tentativa}</span>
                        <span className="modal__fluxo-tentativa-data">
                          {formatarDataFluxo(t.dataInicio)} → limite: {formatarDataFluxo(t.dataLimite)}
                        </span>
                        {t.resultado && (
                          <span className={`modal__fluxo-resultado modal__fluxo-resultado--${t.resultado}`}>
                            {t.resultado === 'aprovado' ? '✅ Aprovado' : t.resultado === 'nao_aprovado' ? '❌ Não Aprovado' : '⏰ Sem Resposta'}
                            {t.motivoPerda && ` · ${t.motivoPerda}`}
                          </span>
                        )}
                      </div>

                      {t.resultado === null && fluxo.etapaAtual === 'ciclo_aprovacao' && (
                        <>
                          <div className="modal__fluxo-acoes modal__fluxo-acoes--ciclo">
                            <button className="modal__fluxo-btn modal__fluxo-btn--aprovado" onClick={registrarAprovado}>✅ Aprovado!</button>
                            <button className="modal__fluxo-btn modal__fluxo-btn--nao-aprovado" onClick={registrarNaoAprovado}>❌ Não Aprovado</button>
                            <button className="modal__fluxo-btn modal__fluxo-btn--sem-resposta" onClick={registrarSemResposta}>⏰ Sem Resposta</button>
                          </div>
                          {mostrarMotivoCiclo && (
                            <div className="modal__fluxo-motivo-form">
                              <select className="modal__select" value={motivoCiclo} onChange={(e) => setMotivoCiclo(e.target.value)}>
                                <option value="">Selecione o motivo...</option>
                                {MOTIVOS_PERDA.map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                              <button className="modal__fluxo-btn modal__fluxo-btn--nao-aprovado" onClick={registrarNaoAprovado} disabled={!motivoCiclo}>Confirmar</button>
                              <button className="modal__fluxo-btn modal__fluxo-btn--cancelar" onClick={() => setMostrarMotivo(false)}>Cancelar</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Status do Lead ── */}
          <section className="modal__secao">
            <h3 className="modal__secao-titulo">Status do Lead</h3>
            <div className="modal__status-grid">
              {ESTAGIOS.map((est) => (
                <label
                  key={est.id}
                  className={`modal__status-opcao ${estagioId === est.id ? 'modal__status-opcao--ativo' : ''}`}
                  style={{ '--est-cor': est.cor }}
                >
                  <input
                    type="radio"
                    name="estagio"
                    value={est.id}
                    checked={estagioId === est.id}
                    onChange={() => {
                      setEstagioId(est.id);
                      setErrMotivo(false);
                      if (est.id !== 'orcamento_nao_aprovado') setMotivoPerda('');
                    }}
                  />
                  {est.label}
                </label>
              ))}
            </div>
            {mudouParaNaoAprovado && (
              <div className={`modal__motivo-perda ${errMotivo ? 'modal__motivo-perda--erro' : ''}`}>
                <label className="modal__label" htmlFor="motivo-perda">
                  Motivo da Perda <span className="modal__obrigatorio">*</span>
                </label>
                <select
                  id="motivo-perda"
                  className="modal__select"
                  value={motivoPerda}
                  onChange={(e) => { setMotivoPerda(e.target.value); setErrMotivo(false); }}
                >
                  <option value="">Selecione o motivo...</option>
                  {MOTIVOS_PERDA.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {errMotivo && <p className="modal__erro-msg">⚠ Informe o motivo antes de salvar.</p>}
              </div>
            )}
          </section>

          {/* ── Anexo de Orçamento ── */}
          {(estagioId === 'contato_recebido' || estagioId === 'orcamento_pendente') && (
            <section className="modal__secao modal__secao--anexo" data-modal-secao="anexo">
              <h3 className="modal__secao-titulo">📎 Arquivo do Orçamento</h3>
              <div className="modal__anexo-acoes-topo">
                <button
                  type="button"
                  className="modal__btn-gerar-orc"
                  onClick={() => abrirGeradorOrcamento(lead)}
                  title="Abrir a ferramenta de geração de orçamento com os dados do lead pré-preenchidos"
                >
                  🛠 Gerar orçamento
                </button>
                <span className="modal__anexo-ou">ou</span>
              </div>
              <label className="modal__anexo-drop">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleAnexoInicial}
                  style={{ display: 'none' }}
                />
                <span className="modal__anexo-drop-icon">📎</span>
                <span className="modal__anexo-drop-texto">Clique para anexar o orçamento</span>
                <span className="modal__anexo-drop-hint modal__anexo-drop-hint--destaque">
                  Ao anexar, este card avançará automaticamente para Orçamento Enviado
                </span>
                <span className="modal__anexo-drop-hint">PDF, Word, Excel ou imagem · máx. 4 MB</span>
              </label>
              {erroAnexo && <p className="modal__anexo-erro">{erroAnexo}</p>}
            </section>
          )}

          {estagioId === 'orcamento_enviado' && (
            <section className="modal__secao modal__secao--anexo" data-modal-secao="anexo">
              <h3 className="modal__secao-titulo">
                📎 Arquivo do Orçamento
                {anexos.length > 0 && (
                  <span className="modal__anexo-badge">{anexos.length === 1 ? 'Anexado' : `${anexos.length} anexos`}</span>
                )}
              </h3>

              {/* Lista de arquivos anexados */}
              {anexos.map((arq, i) => (
                <div key={i} className="modal__anexo-arquivo">
                  <div className="modal__anexo-icone-wrap">
                    {arq.tipo?.startsWith('image/') ? (
                      <img src={arq.dados} alt={arq.nome} className="modal__anexo-preview-img" />
                    ) : (
                      iconeArquivo(arq.tipo)
                    )}
                  </div>
                  <div className="modal__anexo-info">
                    <span className="modal__anexo-nome">{arq.nome}</span>
                    <span className="modal__anexo-tamanho">{formatarTamanho(arq.tamanho)}</span>
                  </div>
                  <button
                    className="modal__anexo-btn modal__anexo-btn--visualizar"
                    onClick={() => visualizarAnexo(arq)}
                    title="Visualizar arquivo"
                  >
                    👁 Ver
                  </button>
                  <a
                    className="modal__anexo-btn modal__anexo-btn--baixar"
                    href={arq.dados}
                    download={arq.nome}
                    title="Baixar arquivo"
                  >
                    ↓ Baixar
                  </a>
                  <button
                    className="modal__anexo-btn modal__anexo-btn--remover"
                    onClick={() => removerAnexo(i)}
                    title="Remover anexo"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Diálogo de escolha após selecionar novo arquivo */}
              {mostrarEscolha && pendingFile && (
                <div className="modal__anexo-escolha">
                  <div className="modal__anexo-escolha-info">
                    <span className="modal__anexo-drop-icon">{iconeArquivo(pendingFile.tipo)}</span>
                    <div>
                      <span className="modal__anexo-nome">{pendingFile.nome}</span>
                      <span className="modal__anexo-tamanho">{formatarTamanho(pendingFile.tamanho)}</span>
                    </div>
                  </div>
                  <p className="modal__anexo-escolha-pergunta">O que deseja fazer com este arquivo?</p>
                  <div className="modal__anexo-escolha-btns">
                    <button className="modal__anexo-btn modal__anexo-btn--adicionar" onClick={() => handleEscolha('adicionar')}>
                      + Adicionar ao existente
                    </button>
                    <button className="modal__anexo-btn modal__anexo-btn--substituir" onClick={() => handleEscolha('substituir')}>
                      ↺ Substituir tudo
                    </button>
                    <button className="modal__anexo-btn modal__anexo-btn--cancelar-escolha" onClick={() => { setPendingFile(null); setMostrarEscolha(false); }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Botão para adicionar mais + gerar orçamento */}
              {!mostrarEscolha && (
                <div className="modal__anexo-acoes-linha">
                  <button
                    type="button"
                    className="modal__btn-gerar-orc modal__btn-gerar-orc--secundario"
                    onClick={() => abrirGeradorOrcamento(lead)}
                    title="Abrir a ferramenta de geração de orçamento"
                  >
                    🛠 Gerar novo
                  </button>
                  <label className="modal__anexo-add-btn">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={handleAnexoAdicional}
                      style={{ display: 'none' }}
                    />
                    {anexos.length === 0 ? '📎 Anexar orçamento' : '+ Adicionar outro orçamento'}
                  </label>
                </div>
              )}

              {erroAnexo && <p className="modal__anexo-erro">{erroAnexo}</p>}
            </section>
          )}

          {/* ── Contrato (quando aprovado) ── */}
          {isAprovado && (
            <section className="modal__secao modal__secao--contrato">
              <h3 className="modal__secao-titulo">
                📋 Dados do Contrato
                {isRecorrenteAprovado && <span className="modal__contrato-badge">Recorrente</span>}
              </h3>
              <div className="modal__grid">
                <div className="modal__campo-editavel">
                  <label className="modal__label" htmlFor="dataInicio">Data de Início</label>
                  <input id="dataInicio" type="date" className="modal__input" value={contrato.dataInicio}
                    onChange={(e) => setContrato((c) => ({ ...c, dataInicio: e.target.value }))} />
                </div>
                <div className="modal__campo-editavel">
                  <label className="modal__label" htmlFor="vigencia">Vigência (meses)</label>
                  <input id="vigencia" type="number" min={1} max={60} className="modal__input" value={contrato.vigenciaMeses}
                    onChange={(e) => setContrato((c) => ({ ...c, vigenciaMeses: Number(e.target.value) }))} />
                </div>
                <div className="modal__campo-editavel">
                  <label className="modal__label" htmlFor="indiceReajuste">Índice de Reajuste Anual</label>
                  <select id="indiceReajuste" className="modal__select modal__select--contrato" value={contrato.indiceReajuste}
                    onChange={(e) => setContrato((c) => ({ ...c, indiceReajuste: e.target.value }))}>
                    {INDICES_REAJUSTE.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div className="modal__campo-editavel">
                  <label className="modal__label" htmlFor="diaFaturamento">Dia de Faturamento Técnico</label>
                  <input id="diaFaturamento" type="number" min={1} max={28} className="modal__input" value={contrato.diaFaturamento}
                    onChange={(e) => setContrato((c) => ({ ...c, diaFaturamento: Number(e.target.value) }))} />
                </div>
              </div>
            </section>
          )}

          {/* ── Informações Extras ── */}
          <section className="modal__secao modal__secao--reposicao">
            <button
              className="modal__reposicao-toggle"
              onClick={() => { setExtrasAberto((v) => !v); setRelatorio(null); }}
            >
              🌿 Informações Extras
              <span className="modal__reposicao-chevron">{extrasAberto ? '▲' : '▼'}</span>
            </button>

            {extrasAberto && (
              <div className="modal__reposicao-corpo">
                <div className="modal__campo-editavel">
                  <label className="modal__label" htmlFor="infoExtras">Informações</label>
                  <textarea
                    id="infoExtras"
                    className="modal__textarea"
                    rows={3}
                    value={infoExtras}
                    placeholder="Preencher"
                    onChange={(e) => setInfoExtras(e.target.value)}
                  />
                </div>

                <div className="modal__reposicao-acoes">
                  <button className="modal__btn-gerar" onClick={gerarRelatorio}>
                    📄 Gerar Relatório
                  </button>
                </div>

                {relatorio && (
                  <div className="modal__relatorio">
                    <pre className="modal__relatorio-texto">{relatorio}</pre>
                    <button className="modal__btn-copiar" onClick={copiarRelatorio}>
                      📋 Copiar
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Histórico de Atividades ── */}
          <SecaoHistorico historico={lead.historico} />

        </div>

        {/* ── Gerador de Mensagem ── */}
        <section className="modal__secao modal__secao--msg">
          <button
            className={`modal__msg-toggle ${msgAberto ? 'modal__msg-toggle--aberto' : ''}`}
            onClick={() => setMsgAberto((v) => !v)}
          >
            📤 Gerar Mensagem de Contato
            <span className="modal__msg-chevron">{msgAberto ? '▲' : '▼'}</span>
          </button>

          {msgAberto && (
            <div className="modal__msg-corpo">
              <div className="modal__msg-tipo-row">
                <button
                  className={`modal__msg-tipo-btn ${msgTipo === 'whatsapp' ? 'modal__msg-tipo-btn--ativo' : ''}`}
                  onClick={() => setMsgTipo('whatsapp')}
                >
                  💬 WhatsApp
                </button>
                <button
                  className={`modal__msg-tipo-btn ${msgTipo === 'email' ? 'modal__msg-tipo-btn--ativo' : ''}`}
                  onClick={() => setMsgTipo('email')}
                >
                  ✉️ E-mail
                </button>
              </div>

              <pre className="modal__msg-preview">{gerarMensagem()}</pre>

              <div className="modal__msg-acoes">
                <button className={`modal__msg-copiar ${msgCopiado ? 'modal__msg-copiar--ok' : ''}`} onClick={copiarMensagem}>
                  {msgCopiado ? '✓ Copiado!' : '📋 Copiar mensagem'}
                </button>
                {lead.telefone && msgTipo === 'whatsapp' && (
                  <a
                    className="modal__msg-wa-link"
                    href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(gerarMensagem())}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir no WhatsApp ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Rodapé ── */}
        <footer className="modal__footer">
          <button className="modal__btn modal__btn--cancelar" onClick={fecharModal}>
            Cancelar
          </button>
          <button
            className={`modal__btn modal__btn--salvar ${salvo ? 'modal__btn--salvo' : ''}`}
            onClick={handleSalvar}
          >
            {salvo ? '✓ Salvo!' : 'Salvar Alterações'}
          </button>
        </footer>

      </div>
    </div>
  );
}
