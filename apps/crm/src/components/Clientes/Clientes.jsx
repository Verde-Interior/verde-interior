// src/components/Clientes/Clientes.jsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import './Clientes.css';

const DIAS_SEMANA = [
  { id: 'segunda', label: 'Seg' },
  { id: 'terca',   label: 'Ter' },
  { id: 'quarta',  label: 'Qua' },
  { id: 'quinta',  label: 'Qui' },
  { id: 'sexta',   label: 'Sex' },
  { id: 'sabado',  label: 'Sáb' },
];

const TIPO_LABEL = {
  manutencao: 'Manutenção',
  locacao:    'Locação',
  flores:     'Flores',
  reforma:    'Reforma',
  venda:      'Venda',
  evento:     'Evento',
};

const FREQ_LABEL = {
  semanal:    'Semanal',
  quinzenal:  'Quinzenal',
  mensal:     'Mensal',
  pontual:    'Pontual',
};

const GRUPO_OPTIONS = [
  { value: '',                          label: '— Selecionar —'              },
  { value: 'Grupo 1 - troca + orquidea', label: 'Grupo 1 - troca + orquídea' },
  { value: 'Grupo 2 - troca',            label: 'Grupo 2 - troca'             },
  { value: 'Grupo 3 - sem troca',        label: 'Grupo 3 - sem troca'         },
  { value: 'Grupo 4 - Flores',           label: 'Grupo 4 - Flores'            },
];

const FREQ_VISITA_OPTIONS = [
  { value: '',          label: '— Selecionar —' },
  { value: 'semanal',   label: 'Semanal'        },
  { value: 'quinzenal', label: 'Quinzenal'      },
  { value: 'mensal',    label: 'Mensal'         },
];

function calcCompletude(c) {
  const checks = [
    (c.dias_disponiveis?.length ?? 0) > 0,
    !!c.duracao_estimada_min,
    !!c.janela_entrada_inicio,
    !!c.contato_nome,
  ];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}

function formatarData(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatarMoeda(v) {
  if (!v) return null;
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const FORM_VAZIO = {
  nome_empresa: '',
  cnpj: '',
  razao_social: '',
  contato_nome: '',
  contato_telefone: '',
  contato_email: '',
  endereco: '',
  complemento: '',
  bairro: '',
  lat: '',
  lng: '',
  dias_disponiveis: [],
  janela_entrada_inicio: '',
  janela_entrada_fim: '',
  duracao_estimada_min: '',
  grupo_servico: '',
  frequencia_visita: '',
  observacoes: '',
  observacoes_internas: '',
  ativo: true,
  data_inicio_contrato: '',
};

const FORM_SERVICO_VAZIO = {
  tipo_servico: 'manutencao',
  frequencia: 'mensal',
  quantidade_vasos: '',
  valor_mensal: '',
};

export default function Clientes() {
  const [clientes,    setClientes]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [erro,        setErro]        = useState(null);
  const [busca,       setBusca]       = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [filtroGrupo, setFiltroGrupo] = useState('todos');

  const [modal,         setModal]         = useState(null); // null | { modo: 'editar'|'novo', cliente?: obj }
  const [form,          setForm]          = useState(null);
  const [salvando,      setSalvando]      = useState(false);
  const [addServico,    setAddServico]    = useState(false);
  const [formServico,   setFormServico]   = useState(FORM_SERVICO_VAZIO);
  const [salvandoServ,  setSalvandoServ]  = useState(false);

  // ── Dados ──────────────────────────────────────────────────────

  async function carregar() {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase
      .from('clientes')
      .select('*, cliente_servicos(*)')
      .order('nome_empresa');
    setLoading(false);
    if (error) { setErro(error.message); return; }
    setClientes(data ?? []);
  }

  useEffect(() => { carregar(); }, []);

  const clientesFiltrados = useMemo(() => {
    const q = busca.toLowerCase();
    return clientes.filter(c => {
      if (filtroAtivo === 'ativos'   &&  !c.ativo) return false;
      if (filtroAtivo === 'inativos' &&   c.ativo) return false;
      if (filtroGrupo !== 'todos'    && c.grupo_servico !== filtroGrupo) return false;
      if (q && !c.nome_empresa.toLowerCase().includes(q) && !(c.bairro?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [clientes, busca, filtroAtivo, filtroGrupo]);

  const metricas = useMemo(() => ({
    total:       clientes.length,
    ativos:      clientes.filter(c => c.ativo).length,
    inativos:    clientes.filter(c => !c.ativo).length,
    incompletos: clientes.filter(c => calcCompletude(c) < 100).length,
  }), [clientes]);

  // ── Modal ──────────────────────────────────────────────────────

  function abrirEditar(c) {
    setForm({
      nome_empresa:          c.nome_empresa          ?? '',
      cnpj:                  c.cnpj                  ?? '',
      razao_social:          c.razao_social          ?? '',
      contato_nome:          c.contato_nome          ?? '',
      contato_telefone:      c.contato_telefone      ?? '',
      contato_email:         c.contato_email         ?? '',
      endereco:              c.endereco              ?? '',
      complemento:           c.complemento           ?? '',
      bairro:                c.bairro                ?? '',
      lat:                   c.lat                   ?? '',
      lng:                   c.lng                   ?? '',
      dias_disponiveis:      c.dias_disponiveis      ?? [],
      janela_entrada_inicio: c.janela_entrada_inicio ?? '',
      janela_entrada_fim:    c.janela_entrada_fim    ?? '',
      duracao_estimada_min:  c.duracao_estimada_min  ?? '',
      grupo_servico:         c.grupo_servico         ?? '',
      frequencia_visita:     c.frequencia_visita     ?? '',
      observacoes:           c.observacoes           ?? '',
      observacoes_internas:  c.observacoes_internas  ?? '',
      ativo:                 c.ativo,
      data_inicio_contrato:  c.data_inicio_contrato  ?? '',
      _servicos:             c.cliente_servicos      ?? [],
    });
    setModal({ modo: 'editar', cliente: c });
    setAddServico(false);
  }

  function abrirNovo() {
    setForm({ ...FORM_VAZIO, _servicos: [] });
    setModal({ modo: 'novo' });
    setAddServico(false);
  }

  function fecharModal() {
    setModal(null);
    setForm(null);
    setAddServico(false);
  }

  function setF(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function toggleDia(dia) {
    setForm(f => ({
      ...f,
      dias_disponiveis: f.dias_disponiveis.includes(dia)
        ? f.dias_disponiveis.filter(d => d !== dia)
        : [...f.dias_disponiveis, dia],
    }));
  }

  async function salvar() {
    if (!form.nome_empresa.trim()) return;
    setSalvando(true);
    try {
      const { _servicos, ...dados } = form;
      const payload = {
        ...dados,
        lat:                   dados.lat                   !== '' ? Number(dados.lat)                   : 0,
        lng:                   dados.lng                   !== '' ? Number(dados.lng)                   : 0,
        duracao_estimada_min:  dados.duracao_estimada_min  !== '' ? Number(dados.duracao_estimada_min)  : null,
        janela_entrada_inicio: dados.janela_entrada_inicio  || null,
        janela_entrada_fim:    dados.janela_entrada_fim     || null,
        data_inicio_contrato:  dados.data_inicio_contrato   || null,
        cnpj:                  dados.cnpj                   || null,
        grupo_servico:         dados.grupo_servico          || null,
        frequencia_visita:     dados.frequencia_visita      || null,
      };

      if (modal.modo === 'editar') {
        const { error } = await supabase.from('clientes').update(payload).eq('id', modal.cliente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clientes').insert(payload);
        if (error) throw error;
      }

      await carregar();
      fecharModal();
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function salvarServico() {
    setSalvandoServ(true);
    try {
      const { error } = await supabase.from('cliente_servicos').insert({
        cliente_id:      modal.cliente.id,
        tipo_servico:    formServico.tipo_servico,
        frequencia:      formServico.frequencia,
        quantidade_vasos: formServico.quantidade_vasos ? Number(formServico.quantidade_vasos) : null,
        valor_mensal:    formServico.valor_mensal    ? Number(formServico.valor_mensal)    : null,
        ativo:           true,
      });
      if (error) throw error;

      const { data } = await supabase
        .from('cliente_servicos').select('*').eq('cliente_id', modal.cliente.id);
      setForm(f => ({ ...f, _servicos: data ?? [] }));
      setAddServico(false);
      setFormServico(FORM_SERVICO_VAZIO);
      carregar();
    } catch (e) {
      alert('Erro ao adicionar contrato: ' + e.message);
    } finally {
      setSalvandoServ(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="clientes">

      {/* ── Cabeçalho ── */}
      <header className="clientes__header">
        <div className="clientes__header-topo">
          <div>
            <h2 className="clientes__titulo">Clientes</h2>
            <p className="clientes__subtitulo">Base de clientes ativos · Sistema de Campo</p>
          </div>
          <button className="clientes__btn-novo" onClick={abrirNovo}>+ Novo Cliente</button>
        </div>

        <div className="clientes__kpis">
          <div className="clientes__kpi">
            <span className="clientes__kpi-valor">{metricas.total}</span>
            <span className="clientes__kpi-label">Total</span>
          </div>
          <div className="clientes__kpi clientes__kpi--verde">
            <span className="clientes__kpi-valor">{metricas.ativos}</span>
            <span className="clientes__kpi-label">Ativos</span>
          </div>
          <div className="clientes__kpi clientes__kpi--muted">
            <span className="clientes__kpi-valor">{metricas.inativos}</span>
            <span className="clientes__kpi-label">Inativos</span>
          </div>
          <div className={`clientes__kpi ${metricas.incompletos > 0 ? 'clientes__kpi--alerta' : 'clientes__kpi--ok'}`}>
            <span className="clientes__kpi-valor">{metricas.incompletos}</span>
            <span className="clientes__kpi-label">Incompletos</span>
            <span className="clientes__kpi-sub">faltam dias / duração</span>
          </div>
        </div>
      </header>

      {/* ── Filtros ── */}
      <div className="clientes__filtros">
        <div className="clientes__busca-wrap">
          <span className="clientes__busca-icon">⌕</span>
          <input
            className="clientes__busca"
            placeholder="Buscar por nome ou bairro..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && (
            <button className="clientes__busca-clear" onClick={() => setBusca('')}>✕</button>
          )}
        </div>

        <div className="clientes__filtros-pills">
          {[
            { id: 'todos',   label: 'Todos'    },
            { id: 'ativos',  label: 'Ativos'   },
            { id: 'inativos',label: 'Inativos' },
          ].map(f => (
            <button
              key={f.id}
              className={`clientes__pill ${filtroAtivo === f.id ? 'clientes__pill--ativo' : ''}`}
              onClick={() => setFiltroAtivo(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          className="clientes__select"
          value={filtroGrupo}
          onChange={e => setFiltroGrupo(e.target.value)}
        >
          <option value="todos">Todos os grupos</option>
          {GRUPO_OPTIONS.filter(o => o.value).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <span className="clientes__count">
          {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Conteúdo ── */}
      {loading ? (
        <div className="clientes__estado">
          <div className="clientes__spinner" />
          <p>Carregando clientes...</p>
        </div>
      ) : erro ? (
        <div className="clientes__estado clientes__estado--erro">
          <p>Erro ao carregar: {erro}</p>
          <button className="clientes__btn-retry" onClick={carregar}>Tentar novamente</button>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="clientes__estado">
          <p className="clientes__estado-msg">
            {busca || filtroAtivo !== 'todos' || filtroGrupo !== 'todos'
              ? 'Nenhum cliente encontrado com esse filtro.'
              : 'Nenhum cliente cadastrado.'}
          </p>
          {!busca && filtroAtivo === 'todos' && filtroGrupo === 'todos' && (
            <button className="clientes__btn-novo clientes__btn-novo--outline" onClick={abrirNovo}>
              + Cadastrar primeiro cliente
            </button>
          )}
        </div>
      ) : (
        <div className="clientes__tabela-wrap">
          <table className="clientes__tabela">
            <thead>
              <tr>
                <th>Nome / Bairro</th>
                <th>Grupo</th>
                <th>Dias disponíveis</th>
                <th>Duração</th>
                <th>Última visita</th>
                <th>Contratos</th>
                <th>Status</th>
                <th title="Completude do cadastro">%</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map(c => {
                const comp = calcCompletude(c);
                const diasLabel = (c.dias_disponiveis?.length ?? 0) > 0
                  ? c.dias_disponiveis.map(d => DIAS_SEMANA.find(x => x.id === d)?.label ?? d).join(' · ')
                  : null;
                const servicosAtivos = (c.cliente_servicos ?? []).filter(s => s.ativo).length;

                return (
                  <tr
                    key={c.id}
                    className={`clientes__row ${!c.ativo ? 'clientes__row--inativo' : ''}`}
                    onClick={() => abrirEditar(c)}
                  >
                    <td>
                      <span className="clientes__row-nome">{c.nome_empresa}</span>
                      {c.bairro && <span className="clientes__row-bairro">{c.bairro}</span>}
                    </td>
                    <td>
                      {c.grupo_servico
                        ? <span className="clientes__badge clientes__badge--grupo">{c.grupo_servico}</span>
                        : <span className="clientes__dash">—</span>}
                    </td>
                    <td>
                      {diasLabel
                        ? <span className="clientes__dias-str">{diasLabel}</span>
                        : <span className="clientes__aviso">⚠ não definido</span>}
                    </td>
                    <td>
                      {c.duracao_estimada_min
                        ? <span>{c.duracao_estimada_min} min</span>
                        : <span className="clientes__aviso">⚠ —</span>}
                    </td>
                    <td>{formatarData(c.ultima_visita)}</td>
                    <td>
                      {servicosAtivos > 0
                        ? <span className="clientes__badge clientes__badge--servico">{servicosAtivos}</span>
                        : <span className="clientes__dash">—</span>}
                    </td>
                    <td>
                      <span className={`clientes__badge ${c.ativo ? 'clientes__badge--ativo' : 'clientes__badge--inativo'}`}>
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`clientes__comp clientes__comp--${comp < 50 ? 'baixo' : comp < 100 ? 'medio' : 'ok'}`}
                        title={`${comp}% do cadastro preenchido`}
                      >
                        {comp}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal de edição ── */}
      {modal && form && (
        <div className="cl-modal-overlay" onClick={e => e.target === e.currentTarget && fecharModal()}>
          <div className="cl-modal">

            <header className="cl-modal__header">
              <div>
                <h3 className="cl-modal__titulo">
                  {modal.modo === 'novo' ? 'Novo Cliente' : form.nome_empresa}
                </h3>
                {modal.modo === 'editar' && (form.bairro || form.endereco) && (
                  <p className="cl-modal__sub">{form.bairro || form.endereco}</p>
                )}
              </div>
              <button className="cl-modal__fechar" onClick={fecharModal}>✕</button>
            </header>

            <div className="cl-modal__corpo">

              {/* ── Identificação ── */}
              <section className="cl-sec">
                <h4 className="cl-sec__titulo">Identificação</h4>
                <div className="cl-grid">
                  <div className="cl-campo cl-campo--wide">
                    <label>Nome da Empresa <span className="cl-req">*</span></label>
                    <input
                      value={form.nome_empresa}
                      onChange={e => setF('nome_empresa', e.target.value)}
                      placeholder="Como aparece nos relatórios"
                    />
                  </div>
                  <div className="cl-campo">
                    <label>CNPJ</label>
                    <input
                      value={form.cnpj}
                      onChange={e => setF('cnpj', e.target.value)}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="cl-campo">
                    <label>Razão Social</label>
                    <input value={form.razao_social} onChange={e => setF('razao_social', e.target.value)} />
                  </div>
                  <div className="cl-campo">
                    <label>Grupo de Serviço</label>
                    <select
                      value={form.grupo_servico}
                      onChange={e => setF('grupo_servico', e.target.value)}
                    >
                      {GRUPO_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="cl-campo">
                    <label>Status</label>
                    <select
                      value={form.ativo ? 'true' : 'false'}
                      onChange={e => setF('ativo', e.target.value === 'true')}
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* ── Contato ── */}
              <section className="cl-sec">
                <h4 className="cl-sec__titulo">Contato (responsável na empresa)</h4>
                <div className="cl-grid">
                  <div className="cl-campo">
                    <label>Falar com</label>
                    <input
                      value={form.contato_nome}
                      onChange={e => setF('contato_nome', e.target.value)}
                      placeholder="Quem assina o relatório"
                    />
                  </div>
                  <div className="cl-campo">
                    <label>Telefone</label>
                    <input
                      value={form.contato_telefone}
                      onChange={e => setF('contato_telefone', e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="cl-campo">
                    <label>E-mail</label>
                    <input
                      type="email"
                      value={form.contato_email}
                      onChange={e => setF('contato_email', e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* ── Endereço ── */}
              <section className="cl-sec">
                <h4 className="cl-sec__titulo">Endereço</h4>
                <div className="cl-grid">
                  <div className="cl-campo cl-campo--wide">
                    <label>Endereço <span className="cl-req">*</span></label>
                    <input value={form.endereco} onChange={e => setF('endereco', e.target.value)} />
                  </div>
                  <div className="cl-campo">
                    <label>Complemento</label>
                    <input
                      value={form.complemento}
                      onChange={e => setF('complemento', e.target.value)}
                      placeholder="Andar, sala, conjunto..."
                    />
                  </div>
                  <div className="cl-campo">
                    <label>Bairro</label>
                    <input value={form.bairro} onChange={e => setF('bairro', e.target.value)} />
                  </div>
                  <div className="cl-campo">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.lat}
                      onChange={e => setF('lat', e.target.value)}
                      placeholder="-23.5489"
                    />
                  </div>
                  <div className="cl-campo">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.lng}
                      onChange={e => setF('lng', e.target.value)}
                      placeholder="-46.6388"
                    />
                  </div>
                </div>
              </section>

              {/* ── Disponibilidade ── */}
              <section className="cl-sec cl-sec--destaque">
                <h4 className="cl-sec__titulo">Disponibilidade para Visita</h4>
                <div className="cl-grid">
                  <div className="cl-campo cl-campo--wide">
                    <label>Dias disponíveis</label>
                    <div className="cl-dias">
                      {DIAS_SEMANA.map(d => (
                        <button
                          key={d.id}
                          type="button"
                          className={`cl-dia ${form.dias_disponiveis.includes(d.id) ? 'cl-dia--ativo' : ''}`}
                          onClick={() => toggleDia(d.id)}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="cl-campo">
                    <label>Horário — chegada a partir de</label>
                    <input
                      type="time"
                      value={form.janela_entrada_inicio}
                      onChange={e => setF('janela_entrada_inicio', e.target.value)}
                    />
                  </div>
                  <div className="cl-campo">
                    <label>Horário — deve ter chegado até</label>
                    <input
                      type="time"
                      value={form.janela_entrada_fim}
                      onChange={e => setF('janela_entrada_fim', e.target.value)}
                    />
                  </div>
                  <div className="cl-campo">
                    <label>Duração estimada (min)</label>
                    <input
                      type="number"
                      min="15"
                      step="15"
                      value={form.duracao_estimada_min}
                      onChange={e => setF('duracao_estimada_min', e.target.value)}
                      placeholder="Ex: 90"
                    />
                  </div>
                  <div className="cl-campo">
                    <label>Frequência de visita</label>
                    <select
                      value={form.frequencia_visita}
                      onChange={e => setF('frequencia_visita', e.target.value)}
                    >
                      {FREQ_VISITA_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="cl-campo">
                    <label>Início do contrato</label>
                    <input
                      type="date"
                      value={form.data_inicio_contrato}
                      onChange={e => setF('data_inicio_contrato', e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* ── Observações ── */}
              <section className="cl-sec">
                <h4 className="cl-sec__titulo">Observações</h4>
                <div className="cl-grid">
                  <div className="cl-campo cl-campo--wide">
                    <label>
                      Obs. para o funcionário no campo
                      <span className="cl-label-hint">visível no celular</span>
                    </label>
                    <textarea
                      rows={3}
                      value={form.observacoes}
                      onChange={e => setF('observacoes', e.target.value)}
                      placeholder="Instruções especiais, cuidados com plantas, acesso ao prédio..."
                    />
                  </div>
                  <div className="cl-campo cl-campo--wide">
                    <label>
                      Observações internas
                      <span className="cl-label-hint cl-label-hint--priv">só gestor</span>
                    </label>
                    <textarea
                      rows={3}
                      value={form.observacoes_internas}
                      onChange={e => setF('observacoes_internas', e.target.value)}
                      placeholder="Histórico, acordos especiais, notas de gestão..."
                    />
                  </div>
                </div>
              </section>

              {/* ── Contratos ── */}
              {modal.modo === 'editar' && (
                <section className="cl-sec">
                  <h4 className="cl-sec__titulo">
                    Contratos de Serviço
                    <button
                      className="cl-sec__btn-add"
                      onClick={() => { setAddServico(v => !v); setFormServico(FORM_SERVICO_VAZIO); }}
                    >
                      {addServico ? '— Cancelar' : '+ Adicionar'}
                    </button>
                  </h4>

                  {form._servicos.length === 0 && !addServico && (
                    <p className="cl-vazio">Nenhum contrato cadastrado.</p>
                  )}

                  <div className="cl-servicos-lista">
                    {form._servicos.map(s => (
                      <div key={s.id} className={`cl-servico ${!s.ativo ? 'cl-servico--inativo' : ''}`}>
                        <span className="cl-servico__tipo">{TIPO_LABEL[s.tipo_servico] ?? s.tipo_servico}</span>
                        <span className="cl-servico__freq">{FREQ_LABEL[s.frequencia] ?? s.frequencia}</span>
                        {s.quantidade_vasos && (
                          <span className="cl-servico__info">{s.quantidade_vasos} vasos</span>
                        )}
                        {s.valor_mensal && (
                          <span className="cl-servico__info">{formatarMoeda(s.valor_mensal)}/mês</span>
                        )}
                        {!s.ativo && <span className="cl-servico__badge-inativo">Inativo</span>}
                      </div>
                    ))}
                  </div>

                  {addServico && (
                    <div className="cl-novo-servico">
                      <div className="cl-grid">
                        <div className="cl-campo">
                          <label>Tipo de Serviço</label>
                          <select
                            value={formServico.tipo_servico}
                            onChange={e => setFormServico(f => ({ ...f, tipo_servico: e.target.value }))}
                          >
                            {Object.entries(TIPO_LABEL).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div className="cl-campo">
                          <label>Frequência</label>
                          <select
                            value={formServico.frequencia}
                            onChange={e => setFormServico(f => ({ ...f, frequencia: e.target.value }))}
                          >
                            {Object.entries(FREQ_LABEL).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div className="cl-campo">
                          <label>Qtd. Vasos</label>
                          <input
                            type="number"
                            min="1"
                            value={formServico.quantidade_vasos}
                            onChange={e => setFormServico(f => ({ ...f, quantidade_vasos: e.target.value }))}
                            placeholder="—"
                          />
                        </div>
                        <div className="cl-campo">
                          <label>Valor Mensal (R$)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formServico.valor_mensal}
                            onChange={e => setFormServico(f => ({ ...f, valor_mensal: e.target.value }))}
                            placeholder="—"
                          />
                        </div>
                      </div>
                      <button
                        className="cl-btn-salvar-servico"
                        onClick={salvarServico}
                        disabled={salvandoServ}
                      >
                        {salvandoServ ? 'Salvando...' : 'Salvar Contrato'}
                      </button>
                    </div>
                  )}
                </section>
              )}
            </div>

            <footer className="cl-modal__footer">
              <button className="cl-btn cl-btn--cancelar" onClick={fecharModal}>Cancelar</button>
              <button
                className="cl-btn cl-btn--salvar"
                onClick={salvar}
                disabled={salvando || !form.nome_empresa.trim()}
              >
                {salvando ? 'Salvando...' : modal.modo === 'novo' ? 'Criar Cliente' : 'Salvar'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
