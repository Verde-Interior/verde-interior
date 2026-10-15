// src/components/Ponto/Ponto.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import ModalEditarPonto from './ModalEditarPonto';
import ModalNovoColaborador from './ModalNovoColaborador';
import ModalEditarColaborador from './ModalEditarColaborador';
import { buildExportDataset, exportCSV, exportXLSX } from './pontoExport';
import {
  F, HM, HMh, MESES, hojeISO, diaLabel, diaAnterior, diaSeguinte,
  calcTrabalhado, statusNoDia, diasUteisDoMes,
} from './pontoCalc';
import './Ponto.css';

export default function Ponto() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [todosEmp, setEmployees] = useState([]);      // ativos + desativados
  const [mesRecs, setMesRecs] = useState({});       // employee_id -> { data: records[] } (mês inteiro até hoje)
  const [bloqueios, setBloqueios] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [aprovando, setAprovando] = useState(null);
  const [edicao, setEdicao] = useState(null);        // { emp, dia, recs } | null
  const [novoColab, setNovoColab] = useState(false);
  const [editColab, setEditColab] = useState(null);   // employee | null
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [aviso, setAviso] = useState(null);

  const employees = useMemo(() => todosEmp.filter((e) => e.ativo !== false), [todosEmp]);
  const inativos  = useMemo(() => todosEmp.filter((e) => e.ativo === false), [todosEmp]);

  const hoje = hojeISO();
  const inicioMes = hoje.slice(0, 8) + '01';
  const [diaSelecionado, setDiaSelecionado] = useState(hoje);
  const ehHoje = diaSelecionado === hoje;

  const carregar = useCallback(async () => {
    const [empRes, mesRes, bloqRes, justRes] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('punch_records').select('id,employee_id,date,type,time,obs').gte('date', inicioMes).lte('date', hoje),
      supabase.from('employee_bloqueios').select('funcionario_id,data_inicio,data_fim,motivo'),
      supabase.from('justifications').select('*').eq('status', 'pendente').order('date', { ascending: false }),
    ]);

    if (empRes.error) { setErro(empRes.error.message); setCarregando(false); return; }

    setEmployees(empRes.data ?? []);
    setBloqueios(bloqRes.data ?? []);
    setPendentes(justRes.data ?? []);

    const porMes = {};
    (mesRes.data ?? []).forEach((r) => {
      if (!porMes[r.employee_id]) porMes[r.employee_id] = {};
      if (!porMes[r.employee_id][r.date]) porMes[r.employee_id][r.date] = [];
      porMes[r.employee_id][r.date].push(r);
    });
    Object.values(porMes).forEach((porData) => {
      Object.values(porData).forEach((arr) => arr.sort((a, b) => a.time.localeCompare(b.time)));
    });
    setMesRecs(porMes);

    setErro(null);
    setCarregando(false);
  }, [hoje, inicioMes]);

  useEffect(() => { carregar(); }, [carregar]);
  useRealtimeRefresh('punch_records', carregar);
  useRealtimeRefresh('justifications', carregar);

  const linhas = useMemo(() => employees.map((e) => {
    const recs = mesRecs[e.id]?.[diaSelecionado] || [];
    const entrada = recs.find((r) => r.type === 'entry');
    const saida   = [...recs].reverse().find((r) => r.type === 'exit');
    const status  = statusNoDia(recs, ehHoje);
    const trabalhadoMin = calcTrabalhado(recs, ehHoje);
    const saldoMin = trabalhadoMin - e.daily_hours * 60;
    return { emp: e, entrada, saida, status, trabalhadoMin, saldoMin, temRegistro: recs.length > 0, recs };
  }), [employees, mesRecs, diaSelecionado, ehHoje]);

  const kpis = useMemo(() => {
    let presentes = 0, encerrados = 0, atrasados = 0, intervalo = 0;
    linhas.forEach(({ status, entrada }) => {
      if (status.label === 'Presente') presentes++;
      if (status.label === 'Intervalo') { presentes++; intervalo++; }
      if (status.label === 'Encerrado') encerrados++;
      if (entrada) {
        const [h, m] = entrada.time.split(':').map(Number);
        if (h * 60 + m > 8 * 60 + 10) atrasados++;
      }
    });
    const ausentes = employees.length - presentes - encerrados;
    return { presentes, encerrados, ausentes, atrasados, intervalo };
  }, [linhas, employees.length]);

  const ritmo = useMemo(() => employees.map((e) => {
    const dias = diasUteisDoMes(bloqueios, e.id, hoje);
    const metaAteAgora = Math.max(1, e.daily_hours * dias.length);
    const trabalhado = Number(e.worked_hours) || 0;
    const pct = Math.round((trabalhado / metaAteAgora) * 100);
    return { emp: e, trabalhado, metaAteAgora, pct, diasEsperados: dias.length };
  }).sort((a, b) => a.pct - b.pct), [employees, bloqueios, hoje]);

  const frequencia = useMemo(() => employees.map((e) => {
    const dias = diasUteisDoMes(bloqueios, e.id, hoje);
    const porData = mesRecs[e.id] || {};
    let faltas = 0, atrasos = 0, saidasAntes = 0;
    dias.forEach((iso) => {
      const recs = porData[iso];
      if (!recs || !recs.length) { faltas++; return; }
      const ent = recs.find((r) => r.type === 'entry');
      if (ent) {
        const [h, m] = ent.time.split(':').map(Number);
        if (h * 60 + m > 8 * 60 + 20) atrasos++;
      }
      const sai = [...recs].reverse().find((r) => r.type === 'exit');
      if (sai) {
        const [h, m] = sai.time.split(':').map(Number);
        if (h * 60 + m < 17 * 60 + 40) saidasAntes++;
      }
    });
    const adesao = dias.length ? Math.round(((dias.length - faltas) / dias.length) * 100) : 100;
    return { emp: e, previstos: dias.length, faltas, atrasos, saidasAntes, adesao };
  }), [employees, bloqueios, mesRecs, hoje]);

  // Empresa toda sem nenhum registro hoje, já passado das 9h e com gente
  // cadastrada — mais provável ser bloqueio de permissão (RLS) do que
  // ninguém ter comparecido. Aviso brando, não trava a tela.
  const suspeitaDePermissao = useMemo(() => {
    const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
    const temAlgumRegistroHoje = Object.values(mesRecs).some((porData) => (porData[hoje] || []).length > 0);
    return !carregando && !erro && employees.length > 0 && !temAlgumRegistroHoje && agoraMin > 9 * 60;
  }, [carregando, erro, employees.length, mesRecs, hoje]);

  async function aprovar(just, status) {
    setAprovando(just.id);
    const { error } = await supabase.from('justifications').update({ status }).eq('id', just.id);
    if (!error) setPendentes((prev) => prev.filter((j) => j.id !== just.id));
    setAprovando(null);
  }

  async function reativar(emp) {
    const { error } = await supabase.from('employees').update({ ativo: true }).eq('id', emp.id);
    if (error) { setAviso('Erro ao reativar: ' + error.message); return; }
    await carregar();
    setAviso(`✓ ${emp.name} reativado(a)`);
    setTimeout(() => setAviso(null), 6000);
  }

  const agora = new Date();
  const mesLabel = `${MESES[agora.getMonth()]} ${agora.getFullYear()}`;

  if (carregando) {
    return <div className="ponto ponto--carregando">Carregando ponto da equipe…</div>;
  }

  if (erro) {
    return (
      <div className="ponto">
        <div className="ponto__erro">Não foi possível carregar os dados de ponto: {erro}</div>
      </div>
    );
  }

  return (
    <div className="ponto">
      <header className="ponto__header">
        <div>
          <h1 className="ponto__titulo">Ponto</h1>
          <p className="ponto__subtitulo">Presença e horas da equipe — registrado no app Ponto pelos colaboradores</p>
        </div>
        <div className="ponto__header-dir">
          <button type="button" className="ponto__btn ponto__btn--ok" onClick={() => setNovoColab(true)}>
            + Novo colaborador
          </button>
          <div className="ponto__data">
            {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>
        </div>
      </header>

      {aviso && <div className="ponto__aviso">{aviso}</div>}

      {suspeitaDePermissao && (
        <div className="ponto__aviso">
          Nenhum registro de ponto apareceu para hoje, para ninguém da equipe. Se o pessoal já bateu ponto,
          este login pode não ter permissão de gestor liberada para ler os registros — vale confirmar.
        </div>
      )}

      {ehHoje && (
        <section className="ponto__kpis">
          <div className="ponto__kpi">
            <span className="ponto__kpi-valor ponto__kpi-valor--forest">{kpis.presentes}</span>
            <span className="ponto__kpi-label">Presentes</span>
          </div>
          <div className="ponto__kpi">
            <span className="ponto__kpi-valor">{kpis.encerrados}</span>
            <span className="ponto__kpi-label">Encerrados</span>
          </div>
          <div className="ponto__kpi">
            <span className="ponto__kpi-valor ponto__kpi-valor--vinho">{kpis.ausentes}</span>
            <span className="ponto__kpi-label">Ausentes</span>
          </div>
          <div className="ponto__kpi">
            <span className="ponto__kpi-valor ponto__kpi-valor--warn">{kpis.atrasados}</span>
            <span className="ponto__kpi-label">Atrasados</span>
          </div>
          <div className="ponto__kpi">
            <span className="ponto__kpi-valor ponto__kpi-valor--warn">{kpis.intervalo}</span>
            <span className="ponto__kpi-label">Intervalo</span>
          </div>
        </section>
      )}

      <section className="ponto__card">
        <div className="ponto__card-topo">
          <h2 className="ponto__card-titulo">
            {ehHoje ? 'Hoje' : diaLabel(diaSelecionado)}
          </h2>
          <div className="ponto__dia-nav">
            <button
              type="button"
              className="ponto__dia-btn"
              onClick={() => setDiaSelecionado(diaAnterior(diaSelecionado, inicioMes))}
              disabled={diaSelecionado <= inicioMes}
              aria-label="Dia anterior"
            >←</button>
            <input
              type="date"
              className="ponto__dia-input"
              value={diaSelecionado}
              min={inicioMes}
              max={hoje}
              onChange={(e) => e.target.value && setDiaSelecionado(e.target.value)}
            />
            <button
              type="button"
              className="ponto__dia-btn"
              onClick={() => setDiaSelecionado(diaSeguinte(diaSelecionado, hoje))}
              disabled={diaSelecionado >= hoje}
              aria-label="Próximo dia"
            >→</button>
            {!ehHoje && (
              <button type="button" className="ponto__dia-hoje" onClick={() => setDiaSelecionado(hoje)}>Hoje</button>
            )}
          </div>
        </div>
        <p className="ponto__card-sub">Clique numa pessoa pra editar os registros de ponto dela nesse dia</p>
        <div className="ponto__tabela-wrap">
          <table className="ponto__tabela">
            <thead>
              <tr>
                <th>Nome</th><th>Contrato</th><th>Entrada</th><th>Saída</th>
                <th>Status</th><th>Trabalhado</th><th>Saldo</th><th></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ emp, entrada, saida, status, trabalhadoMin, saldoMin, temRegistro, recs }) => (
                <tr
                  key={emp.id}
                  className="ponto__linha-clicavel"
                  onClick={() => setEdicao({ emp, dia: diaSelecionado, recs })}
                >
                  <td className="ponto__nome">{emp.name}</td>
                  <td><span className="ponto__badge">{emp.contract_type}</span></td>
                  <td>{entrada ? entrada.time : '--:--'}</td>
                  <td>{saida ? saida.time : '--:--'}</td>
                  <td>
                    <span className={`ponto-dot ${status.dot}`} />
                    {status.label}
                  </td>
                  <td>{HM(trabalhadoMin)}</td>
                  <td className={saldoMin >= 0 ? 'ponto__pos' : 'ponto__neg'}>
                    {temRegistro ? `${saldoMin >= 0 ? '+' : ''}${HM(saldoMin)}` : '--'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ponto__icone-btn"
                      title="Editar colaborador"
                      aria-label={`Editar ${emp.name}`}
                      onClick={(ev) => { ev.stopPropagation(); setEditColab(emp); }}
                    >✎</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ponto__card">
        <h2 className="ponto__card-titulo">Ritmo do mês</h2>
        <p className="ponto__card-sub">
          Trabalhado vs. esperado até hoje — feriados e ausências aprovadas já descontados da meta
        </p>
        <div className="ponto__ritmo-lista">
          {ritmo.map(({ emp, trabalhado, metaAteAgora, pct }) => (
            <div className="ponto__ritmo-linha" key={emp.id}>
              <span className="ponto__ritmo-nome">{emp.name}</span>
              <div className="ponto__ritmo-barra">
                <div
                  className={`ponto__ritmo-fill ${pct >= 100 ? 'ponto__ritmo-fill--ok' : pct >= 80 ? 'ponto__ritmo-fill--alerta' : 'ponto__ritmo-fill--perigo'}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <span className="ponto__ritmo-valor">{HMh(trabalhado)} de {HMh(metaAteAgora)} ({pct}%)</span>
            </div>
          ))}
        </div>
      </section>

      <div className="ponto__grid2">
        <section className="ponto__card">
          <h2 className="ponto__card-titulo">Frequência — {mesLabel}</h2>
          <div className="ponto__tabela-wrap">
            <table className="ponto__tabela">
              <thead>
                <tr>
                  <th>Nome</th><th>Previstos</th><th>Faltas</th><th>Atrasos</th><th>Saídas antec.</th><th>Adesão</th>
                </tr>
              </thead>
              <tbody>
                {frequencia.map(({ emp, previstos, faltas, atrasos, saidasAntes, adesao }) => (
                  <tr key={emp.id}>
                    <td className="ponto__nome">{emp.name}</td>
                    <td>{previstos}</td>
                    <td className={faltas > 0 ? 'ponto__neg' : ''}>{faltas}</td>
                    <td className={atrasos > 0 ? 'ponto__warn' : ''}>{atrasos}</td>
                    <td className={saidasAntes > 0 ? 'ponto__warn' : ''}>{saidasAntes}</td>
                    <td className={adesao >= 95 ? 'ponto__pos' : adesao >= 80 ? 'ponto__warn' : 'ponto__neg'}>{adesao}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ponto__card">
          <h2 className="ponto__card-titulo">
            Justificativas pendentes
            {pendentes.length > 0 && <span className="ponto__contador">{pendentes.length}</span>}
          </h2>
          {pendentes.length === 0 ? (
            <p className="ponto__vazio">Nenhuma pendente.</p>
          ) : (
            <div className="ponto__just-lista">
              {pendentes.map((j) => {
                const emp = todosEmp.find((e) => e.id === j.employee_id);
                return (
                  <div className="ponto__just" key={j.id}>
                    <div className="ponto__just-info">
                      <span className="ponto__just-nome">{emp ? emp.name : '—'}</span>
                      <span className="ponto__just-meta">{j.date?.split('-').reverse().join('/')} · {j.type}</span>
                      <span className="ponto__just-desc">{j.description}</span>
                    </div>
                    <div className="ponto__just-acoes">
                      <button
                        className="ponto__btn ponto__btn--ok"
                        disabled={aprovando === j.id}
                        onClick={() => aprovar(j, 'aprovado')}
                      >✓ Aprovar</button>
                      <button
                        className="ponto__btn ponto__btn--rec"
                        disabled={aprovando === j.id}
                        onClick={() => aprovar(j, 'recusado')}
                      >✕ Recusar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {inativos.length > 0 && (
        <section className="ponto__card">
          <button
            type="button"
            className="ponto__inativos-toggle"
            onClick={() => setMostrarInativos((v) => !v)}
          >
            {mostrarInativos ? '▾' : '▸'} Colaboradores desativados ({inativos.length})
          </button>
          {mostrarInativos && (
            <div className="ponto__just-lista">
              {inativos.map((e) => (
                <div className="ponto__just" key={e.id}>
                  <div className="ponto__just-info">
                    <span className="ponto__just-nome">{e.name}</span>
                    <span className="ponto__just-meta">{e.cargo} · {e.contract_type}</span>
                  </div>
                  <div className="ponto__just-acoes">
                    <button className="ponto__btn ponto__btn--ok" onClick={() => reativar(e)}>Reativar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <ExportarRelatorio employees={todosEmp} inicioMes={inicioMes} hoje={hoje} />

      {novoColab && (
        <ModalNovoColaborador
          employees={todosEmp}
          onFechar={() => setNovoColab(false)}
          onCriado={async ({ fechar, nome, usuario }) => {
            await carregar();
            if (fechar) {
              setNovoColab(false);
              setAviso(`✓ ${nome} cadastrado(a) com login "${usuario}"`);
              setTimeout(() => setAviso(null), 6000);
            }
          }}
        />
      )}

      {editColab && (
        <ModalEditarColaborador
          emp={editColab}
          employees={todosEmp}
          onFechar={() => setEditColab(null)}
          onMudou={async (msg) => {
            await carregar();
            setEditColab(null);
            if (msg) { setAviso(msg); setTimeout(() => setAviso(null), 6000); }
          }}
        />
      )}

      {edicao && (
        <ModalEditarPonto
          emp={edicao.emp}
          dia={edicao.dia}
          recs={edicao.recs}
          onFechar={() => setEdicao(null)}
          onMudou={async () => { await carregar(); setEdicao(null); }}
        />
      )}
    </div>
  );
}

function ExportarRelatorio({ employees, inicioMes, hoje }) {
  const fimMes = useMemo(() => {
    const [y, m] = hoje.split('-').map(Number);
    return `${y}-${F(m)}-${F(new Date(y, m, 0).getDate())}`;
  }, [hoje]);

  const [rs, setRs] = useState(inicioMes);
  const [re, setRe] = useState(fimMes);
  const [colaboradorId, setColaboradorId] = useState('all');
  const [exportando, setExportando] = useState(null);

  async function exportar(mode, formato) {
    const chave = `${mode}-${formato}`;
    setExportando(chave);
    try {
      const dataset = await buildExportDataset(mode, { rs, re, colaboradorId });
      if (formato === 'csv') exportCSV(dataset);
      else await exportXLSX(dataset, mode === 'espelho' ? 'Espelho' : mode === 'resumo' ? 'Resumo' : 'Banco');
    } catch (e) {
      alert('Erro ao exportar: ' + e.message);
    } finally {
      setExportando(null);
    }
  }

  return (
    <section className="ponto__card">
      <h2 className="ponto__card-titulo">Exportar relatório</h2>
      <div className="ponto__export-filtros">
        <div className="ponto__campo">
          <label>Início</label>
          <input type="date" value={rs} max={re} onChange={(e) => setRs(e.target.value)} />
        </div>
        <div className="ponto__campo">
          <label>Fim</label>
          <input type="date" value={re} min={rs} onChange={(e) => setRe(e.target.value)} />
        </div>
        <div className="ponto__campo ponto__campo--largo">
          <label>Colaborador</label>
          <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
            <option value="all">Todos</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>
      <div className="ponto__export-botoes">
        <span className="ponto__export-label">CSV</span>
        <button className="ponto__export-btn" disabled={exportando === 'espelho-csv'} onClick={() => exportar('espelho', 'csv')}>Espelho</button>
        <button className="ponto__export-btn" disabled={exportando === 'resumo-csv'} onClick={() => exportar('resumo', 'csv')}>Resumo</button>
        <button className="ponto__export-btn" disabled={exportando === 'banco-csv'} onClick={() => exportar('banco', 'csv')}>Banco</button>
        <span className="ponto__export-label">XLSX</span>
        <button className="ponto__export-btn ponto__export-btn--forte" disabled={exportando === 'espelho-xlsx'} onClick={() => exportar('espelho', 'xlsx')}>Espelho</button>
        <button className="ponto__export-btn" disabled={exportando === 'resumo-xlsx'} onClick={() => exportar('resumo', 'xlsx')}>Resumo</button>
        <button className="ponto__export-btn" disabled={exportando === 'banco-xlsx'} onClick={() => exportar('banco', 'xlsx')}>Banco</button>
      </div>
    </section>
  );
}
