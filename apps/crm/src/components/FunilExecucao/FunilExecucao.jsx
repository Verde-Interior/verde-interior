// src/components/FunilExecucao/FunilExecucao.jsx
import { useEffect, useMemo, useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import { supabase } from '../../lib/supabase';
import './FunilExecucao.css';

const ICONE_SERVICO = {
  venda: '🛒', manutencao: '🔧', reforma: '🔨', locacao: '🌿', locacao_evento: '🎪',
};

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v ?? 0);
}

function formatarData(iso) {
  if (!iso) return null;
  return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function FunilExecucao() {
  const { leads, ESTAGIOS_EXECUCAO, TIPOS_SERVICO, moverFunilExecucao, abrirModal, dragLeadId, setDragLeadId, atualizarLead, getTiposServico } = useCRM();

  const [saldos, setSaldos] = useState([]); // [{ material_id, nome, categoria, saldo_total, controla_posse }]
  const [employees, setEmployees] = useState([]);
  const [osMap, setOsMap] = useState(new Map()); // Map<lead_id, os_id>
  const [modalMateriais, setModalMateriais] = useState(null); // lead
  const [modalAgendar, setModalAgendar] = useState(null);     // lead
  const [copiadoId, setCopiadoId] = useState(null);           // lead.id com feedback "copiado"

  useEffect(() => {
    (async () => {
      const [saldosRes, empRes] = await Promise.all([
        supabase.from('estoque_saldos_totais').select('material_id, nome, categoria, saldo_total, controla_posse'),
        supabase.from('employees').select('id, name, cargo').in('cargo', ['Campo', 'Facilities', 'TI']).order('name'),
      ]);
      setSaldos(saldosRes.data ?? []);
      setEmployees(empRes.data ?? []);
    })();
  }, []);

  const leadsAprovados = useMemo(
    () => leads.filter((l) => l.estagioId === 'orcamento_aprovado'),
    [leads]
  );

  // Fetch os_id from ordens_servico whenever approved leads change
  useEffect(() => {
    if (!leadsAprovados.length) return;
    const ids = leadsAprovados.map(l => l.id);
    supabase
      .from('ordens_servico')
      .select('lead_id, os_id')
      .in('lead_id', ids)
      .then(({ data }) => {
        if (!data) return;
        setOsMap(new Map(data.map(r => [r.lead_id, r.os_id])));
      });
  }, [leadsAprovados]);

  const total = leadsAprovados.length;
  const valorTotal = leadsAprovados.reduce((s, l) => s + (l.valorEstimado ?? 0), 0);

  function handleDragStart(e, leadId) {
    setDragLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('leadId', leadId);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e, etapaId) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    if (leadId) moverFunilExecucao(leadId, etapaId);
    setDragLeadId(null);
  }

  function handleDragEnd() {
    setDragLeadId(null);
  }

  // ── Link da OS pré-preenchido com dados do lead ──────────────────────────
  function gerarLinkOS(lead) {
    const osId = osMap.get(lead.id) ?? `OS-${String(lead.id).slice(0, 8).toUpperCase()}`;
    const params = new URLSearchParams({
      cliente:  lead.empresa ?? '',
      os:       osId,
      bairro:   lead.bairro ?? '',
      contato:  lead.contato ?? '',
      telefone: lead.telefone ?? '',
      modo:     'execucao',
    });
    return `/os.html?${params.toString()}`;
  }

  function copiarLinkOS(lead, e) {
    e.stopPropagation();
    const url = window.location.origin + gerarLinkOS(lead);
    navigator.clipboard.writeText(url).then(() => {
      setCopiadoId(lead.id);
      setTimeout(() => setCopiadoId(null), 2000);
    });
  }

  // ── Materiais faltantes de um lead ────────────────────────────────────────
  function faltantes(lead) {
    const materiais = lead.funilExecucao?.materiais ?? [];
    if (!materiais.length) return [];
    const map = new Map(saldos.map(s => [s.material_id, s]));
    return materiais.reduce((acc, m) => {
      const s = map.get(m.material_id);
      const disponivel = s ? Number(s.saldo_total) : 0;
      const necessario = Number(m.quantidade) || 0;
      if (necessario > disponivel) {
        acc.push({ nome: s?.nome ?? m.nome ?? 'material', necessario, disponivel, falta: necessario - disponivel });
      }
      return acc;
    }, []);
  }

  return (
    <div className="funil-exec">
      {/* Header */}
      <header className="funil-exec__header">
        <div>
          <h1 className="funil-exec__titulo">Funil de Execução</h1>
          <p className="funil-exec__subtitulo">
            {total} projeto{total !== 1 ? 's' : ''} em andamento · {formatarValor(valorTotal)} em contratos
          </p>
        </div>
      </header>

      {/* Kanban */}
      <div className="funil-exec__kanban">
        {ESTAGIOS_EXECUCAO.map((etapa) => {
          const cards = leadsAprovados.filter((l) => (l.funilExecucao?.etapa ?? 'materiais') === etapa.id);

          return (
            <div
              key={etapa.id}
              className="funil-exec__coluna"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, etapa.id)}
            >
              {/* Cabeçalho da coluna */}
              <div className="funil-exec__col-header" style={{ '--etapa-cor': etapa.cor }}>
                <span className="funil-exec__col-titulo">{etapa.label}</span>
                <span className="funil-exec__col-count">{cards.length}</span>
              </div>

              {/* Cards */}
              <div className="funil-exec__cards">
                {cards.length === 0 && (
                  <div className="funil-exec__vazio">Nenhum projeto nesta etapa</div>
                )}
                {cards.map((lead) => {
                  const tipos = getTiposServico(lead);
                  const svcs = tipos.map((t) => ({ id: t, ...TIPOS_SERVICO[t] })).filter((s) => s.label);
                  const iconePrimario = ICONE_SERVICO[tipos[0]] ?? '🌿';
                  const isDragging = dragLeadId === lead.id;
                  const materiais = lead.funilExecucao?.materiais ?? [];
                  const faltas = etapa.id === 'materiais' ? faltantes(lead) : [];
                  const agendamento = lead.funilExecucao?.agendamento;

                  return (
                    <article
                      key={lead.id}
                      className={`funil-exec__card ${isDragging ? 'funil-exec__card--dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => abrirModal(lead)}
                    >
                      <header className="funil-exec__card-header">
                        <span className="funil-exec__card-empresa">{lead.empresa}</span>
                        <span className="funil-exec__card-icone">{iconePrimario}</span>
                      </header>
                      <p className="funil-exec__card-contato">{lead.contato}</p>
                      <div className="funil-exec__card-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {svcs.length === 0 ? (
                          <span className="funil-exec__card-badge" style={{ '--badge-cor': '#6B7280' }}>—</span>
                        ) : (
                          svcs.map((s) => (
                            <span key={s.id} className="funil-exec__card-badge" style={{ '--badge-cor': s.cor }}>
                              {s.label}
                            </span>
                          ))
                        )}
                      </div>
                      <footer className="funil-exec__card-footer">
                        <span className="funil-exec__card-bairro">📍 {lead.bairro}</span>
                        <span className="funil-exec__card-valor">{formatarValor(lead.valorEstimado)}</span>
                      </footer>

                      {/* ── Bloco de MATERIAIS (etapa "materiais") ── */}
                      {etapa.id === 'materiais' && (
                        <div className="funil-exec__card-materiais" onClick={(e) => e.stopPropagation()}>
                          {materiais.length === 0 ? (
                            <button
                              className="funil-exec__card-btn-materiais"
                              onClick={() => setModalMateriais(lead)}
                            >
                              🧾 Definir materiais
                            </button>
                          ) : (
                            <>
                              <div className="funil-exec__mat-resumo">
                                🧾 {materiais.length} material{materiais.length !== 1 ? 'is' : ''}
                                <button
                                  className="funil-exec__mat-editar"
                                  onClick={() => setModalMateriais(lead)}
                                >
                                  editar
                                </button>
                              </div>
                              {faltas.length > 0 && (
                                <div className="funil-exec__mat-alerta">
                                  ⚠ Falta{faltas.length !== 1 ? 'm' : ''} no estoque:
                                  <ul>
                                    {faltas.map((f, i) => (
                                      <li key={i}>{f.nome}: <strong>{f.falta}</strong> ({f.disponivel} de {f.necessario})</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {faltas.length === 0 && (
                                <div className="funil-exec__mat-ok">✓ Estoque suficiente</div>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Bloco de AGENDAMENTO (etapa "agendamento") ── */}
                      {etapa.id === 'agendamento' && (
                        <div className="funil-exec__card-agendar" onClick={(e) => e.stopPropagation()}>
                          {agendamento ? (
                            <div className="funil-exec__ag-info">
                              📅 <strong>{formatarData(agendamento.data)}</strong> {agendamento.hora?.slice(0, 5)}
                              <span className="funil-exec__ag-func">
                                · {employees.find(e => String(e.id) === String(agendamento.funcionario_id))?.name ?? '—'}
                              </span>
                              <button className="funil-exec__ag-editar" onClick={() => setModalAgendar(lead)}>editar</button>
                            </div>
                          ) : (
                            <button
                              className="funil-exec__card-btn-agendar"
                              onClick={() => setModalAgendar(lead)}
                            >
                              📅 Agendar
                            </button>
                          )}
                        </div>
                      )}

                      {lead.visitas?.length > 0 && (
                        <div className="funil-exec__card-visitas">
                          {lead.visitas.filter((v) => v.data).map((v, i) => (
                            <span key={i} className="funil-exec__card-visita-data">
                              🗓 {formatarData(v.data)}{v.obs ? ` · ${v.obs}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      {lead.funilExecucao?.dataInicio && (
                        <p className="funil-exec__card-inicio">
                          Iniciou execução: {formatarData(lead.funilExecucao.dataInicio)}
                        </p>
                      )}

                      {/* ── Link/QR da OS (útil para compartilhar com colaborador em campo) ── */}
                      <div className="funil-exec__card-os" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="funil-exec__btn-os"
                          onClick={(e) => copiarLinkOS(lead, e)}
                          title="Copiar link da OS para o clipboard"
                        >
                          {copiadoId === lead.id ? '✅ Copiado!' : '🔗 Link OS'}
                        </button>
                        <a
                          className="funil-exec__btn-os funil-exec__btn-os--open"
                          href={gerarLinkOS(lead)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Abrir OS em nova aba"
                        >
                          ↗
                        </a>
                      </div>

                      {/* Ações rápidas de avanço */}
                      <div className="funil-exec__card-acoes" onClick={(e) => e.stopPropagation()}>
                        {ESTAGIOS_EXECUCAO.findIndex((e) => e.id === etapa.id) < ESTAGIOS_EXECUCAO.length - 1 && (
                          <button
                            className="funil-exec__card-btn-avancar"
                            onClick={() => {
                              const idx = ESTAGIOS_EXECUCAO.findIndex((e) => e.id === etapa.id);
                              if (idx < ESTAGIOS_EXECUCAO.length - 1) {
                                moverFunilExecucao(lead.id, ESTAGIOS_EXECUCAO[idx + 1].id);
                              }
                            }}
                          >
                            Avançar →
                          </button>
                        )}
                        {etapa.id === 'pos_venda' && (
                          <span className="funil-exec__card-final">✅ Projeto concluído</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal de Materiais ── */}
      {modalMateriais && (
        <ModalMateriais
          lead={modalMateriais}
          saldos={saldos}
          onFechar={() => setModalMateriais(null)}
          onSalvar={(materiais) => {
            atualizarLead(modalMateriais.id, {
              funilExecucao: { ...(modalMateriais.funilExecucao ?? {}), materiais },
            });
            setModalMateriais(null);
          }}
        />
      )}

      {/* ── Modal de Agendar ── */}
      {modalAgendar && (
        <ModalAgendarServico
          lead={modalAgendar}
          employees={employees}
          onFechar={() => setModalAgendar(null)}
          onSalvo={(agendamento, avancar) => {
            atualizarLead(modalAgendar.id, {
              funilExecucao: { ...(modalAgendar.funilExecucao ?? {}), agendamento },
            });
            setModalAgendar(null);
            if (avancar) moverFunilExecucao(modalAgendar.id, 'execucao');
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  ModalMateriais — lista editável de materiais com check em estoque
// ────────────────────────────────────────────────────────────────────────────
function ModalMateriais({ lead, saldos, onFechar, onSalvar }) {
  const [itens, setItens] = useState(() => lead.funilExecucao?.materiais ?? []);
  const [novoId, setNovoId] = useState('');
  const [novaQtd, setNovaQtd] = useState('1');

  const saldoMap = useMemo(() => new Map(saldos.map(s => [s.material_id, s])), [saldos]);
  const disponiveis = useMemo(
    () => saldos.filter(s => !s.controla_posse).sort((a, b) => a.nome.localeCompare(b.nome)),
    [saldos]
  );

  function adicionar() {
    if (!novoId || !novaQtd) return;
    const s = saldoMap.get(novoId);
    if (!s) return;
    if (itens.some(i => i.material_id === novoId)) {
      alert('Esse material já está na lista. Edite a quantidade.');
      return;
    }
    setItens([...itens, { material_id: novoId, nome: s.nome, quantidade: Number(novaQtd) }]);
    setNovoId('');
    setNovaQtd('1');
  }

  function alterarQtd(idx, qtd) {
    const copia = [...itens];
    copia[idx] = { ...copia[idx], quantidade: Number(qtd) || 0 };
    setItens(copia);
  }

  function remover(idx) {
    setItens(itens.filter((_, i) => i !== idx));
  }

  const totalFalta = itens.reduce((s, i) => {
    const saldo = Number(saldoMap.get(i.material_id)?.saldo_total ?? 0);
    return s + Math.max(0, Number(i.quantidade) - saldo);
  }, 0);

  return (
    <div className="fe-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="fe-modal">
        <header className="fe-modal__header">
          <div>
            <h3 className="fe-modal__titulo">🧾 Materiais — {lead.empresa}</h3>
            <p className="fe-modal__sub">Confira o estoque antes de avançar para agendamento</p>
          </div>
          <button className="fe-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="fe-modal__corpo">
          {/* Adicionar */}
          <div className="fe-mat__add">
            <select value={novoId} onChange={e => setNovoId(e.target.value)}>
              <option value="">— Escolha um material —</option>
              {disponiveis.map(s => (
                <option key={s.material_id} value={s.material_id}>
                  {s.nome} · saldo: {Number(s.saldo_total)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={novaQtd}
              onChange={e => setNovaQtd(e.target.value)}
              className="fe-mat__qtd"
            />
            <button className="fe-btn fe-btn--primario" onClick={adicionar} disabled={!novoId}>+ Adicionar</button>
          </div>

          {/* Lista */}
          {itens.length === 0 ? (
            <p className="fe-mat__vazio">Nenhum material adicionado ainda.</p>
          ) : (
            <table className="fe-mat__tabela">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Necessário</th>
                  <th>Disponível</th>
                  <th>Situação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => {
                  const s = saldoMap.get(it.material_id);
                  const saldo = Number(s?.saldo_total ?? 0);
                  const nec = Number(it.quantidade) || 0;
                  const ok = saldo >= nec;
                  const falta = ok ? 0 : nec - saldo;
                  return (
                    <tr key={it.material_id} className={ok ? '' : 'fe-mat__linha--faltando'}>
                      <td>{s?.nome ?? it.nome}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={it.quantidade}
                          onChange={e => alterarQtd(idx, e.target.value)}
                          className="fe-mat__qtd fe-mat__qtd--sm"
                        />
                      </td>
                      <td>{saldo}</td>
                      <td>
                        {ok
                          ? <span className="fe-mat__ok">✓ OK</span>
                          : <span className="fe-mat__falta">⚠ Falta {falta}</span>}
                      </td>
                      <td>
                        <button className="fe-mat__remover" onClick={() => remover(idx)} title="Remover">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {totalFalta > 0 && (
            <div className="fe-mat__aviso">
              ⚠ Faltam {totalFalta} unidade{totalFalta !== 1 ? 's' : ''} no estoque. Antes de avançar, registre a entrada no módulo Estoque.
            </div>
          )}
        </div>

        <footer className="fe-modal__footer">
          <button className="fe-btn" onClick={onFechar}>Cancelar</button>
          <button className="fe-btn fe-btn--primario" onClick={() => onSalvar(itens)}>Salvar</button>
        </footer>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  ModalAgendarServico — agenda o serviço e insere em `agenda` do funcionário
// ────────────────────────────────────────────────────────────────────────────
function ModalAgendarServico({ lead, employees, onFechar, onSalvo }) {
  const hoje = new Date().toISOString().split('T')[0];
  const ag = lead.funilExecucao?.agendamento ?? {};
  const [funcionarioId, setFuncionarioId] = useState(ag.funcionario_id ? String(ag.funcionario_id) : (employees[0]?.id ? String(employees[0].id) : ''));
  const [data, setData] = useState(ag.data ?? hoje);
  const [hora, setHora] = useState(ag.hora ?? '08:00');
  const [duracao, setDuracao] = useState(ag.duracao_estimada_min ?? 120);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(avancar) {
    if (!funcionarioId || !data || !hora) { setErro('Preencha funcionário, data e hora.'); return; }
    setSalvando(true);
    setErro('');
    try {
      const clienteId = lead.clienteSupabaseId ?? null;
      const obs = `Execução do orçamento — ${lead.empresa}${lead.contato ? ' (' + lead.contato + ')' : ''}`;

      let agendaId = ag.agenda_id ?? null;
      if (clienteId) {
        // Cliente já promovido — criamos/atualizamos linha em `agenda`
        if (agendaId) {
          const { error } = await supabase.from('agenda').update({
            funcionario_id: funcionarioId,
            data_agendada: data,
            hora_estimada_chegada: hora,
            duracao_estimada_min: duracao,
            observacoes_gestor: obs,
          }).eq('id', agendaId);
          if (error) throw error;
        } else {
          const { data: novo, error } = await supabase.from('agenda').insert({
            cliente_id: clienteId,
            funcionario_id: funcionarioId,
            data_agendada: data,
            hora_estimada_chegada: hora,
            duracao_estimada_min: duracao,
            observacoes_gestor: obs,
            status: 'rascunho',
          }).select('id').single();
          if (error) throw error;
          agendaId = novo?.id ?? null;
        }
      }

      const agendamento = {
        funcionario_id: funcionarioId,
        data,
        hora,
        duracao_estimada_min: duracao,
        agenda_id: agendaId,
        criado_em: new Date().toISOString(),
      };
      onSalvo(agendamento, avancar);
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fe-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="fe-modal fe-modal--sm">
        <header className="fe-modal__header">
          <div>
            <h3 className="fe-modal__titulo">📅 Agendar serviço — {lead.empresa}</h3>
            <p className="fe-modal__sub">Adiciona uma visita rascunho na agenda do funcionário</p>
          </div>
          <button className="fe-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="fe-modal__corpo">
          <label className="fe-campo">
            <span>Funcionário</span>
            <select value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)}>
              {employees.map(e => (
                <option key={e.id} value={String(e.id)}>{e.name}</option>
              ))}
            </select>
          </label>
          <div className="fe-linha">
            <label className="fe-campo">
              <span>Data</span>
              <input type="date" value={data} min={hoje} onChange={e => setData(e.target.value)} />
            </label>
            <label className="fe-campo">
              <span>Hora</span>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} />
            </label>
            <label className="fe-campo">
              <span>Duração (min)</span>
              <input type="number" min="30" step="15" value={duracao} onChange={e => setDuracao(Number(e.target.value) || 60)} />
            </label>
          </div>

          {!lead.clienteSupabaseId && (
            <div className="fe-agendar__aviso">
              ⚠ Este lead ainda não foi promovido a Cliente. O agendamento vai ficar salvo aqui no funil, mas <strong>não vai aparecer na agenda do funcionário</strong> até você promover a Cliente (Kanban → botão "Virar cliente").
            </div>
          )}

          {erro && <div className="fe-mat__aviso">{erro}</div>}
        </div>

        <footer className="fe-modal__footer">
          <button className="fe-btn" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="fe-btn" onClick={() => salvar(false)} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button className="fe-btn fe-btn--primario" onClick={() => salvar(true)} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar e avançar →'}
          </button>
        </footer>
      </div>
    </div>
  );
}
