// src/components/EscalaCampo/ModalGerarRega.jsx
// Gerador de agenda de rega da semana (Fase B) — copia a agenda real da
// semana anterior pra semana atualmente selecionada na Escala, removendo
// troca/reforma/evento/avulsas, quinzenais (não repetem semana seguinte) e
// pontuais já atendidas no mês. Ver src/utils/regaHelpers.js pra lógica.
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import { addDias, formatarDataCurta } from '../../utils/dateUtils';
import { gerarRegaDaSemana } from '../../utils/regaHelpers';

export default function ModalGerarRega({ employees, clientes, semana, onFechar, onGerado }) {
  const [carregando, setCarregando] = useState(true);
  const [resultado,  setResultado]  = useState(null); // { linhas, excluidos, jaExistentes }
  const [gerando,    setGerando]    = useState(false);
  const [msg,         setMsg]       = useState('');

  const semanaAnteriorBase = addDias(semana[0], -7);
  const semanaAnteriorFim  = addDias(semana[6], -7);

  const empPorId = useMemo(() => new Map(employees.map(e => [String(e.id), e.name])), [employees]);
  const clientesPorId = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregando(true);
      const primeiroDiaMes = semana[0].slice(0, 8) + '01';
      const [ano, mes] = semana[0].split('-').map(Number);
      const ultimoDiaMes = new Date(ano, mes, 0).getDate();
      const ultimoDiaMesIso = `${semana[0].slice(0, 8)}${String(ultimoDiaMes).padStart(2, '0')}`;

      const [semAnteriorRes, mesRes, semNovaRes] = await Promise.all([
        supabase.from('agenda')
          .select('id, cliente_id, funcionario_id, cliente_servico_id, data_agendada, hora_estimada_chegada, duracao_estimada_min, tipos_tarefa, observacoes_gestor, ordem_rota, status')
          .gte('data_agendada', semanaAnteriorBase).lte('data_agendada', semanaAnteriorFim)
          .neq('status', 'cancelado'),
        supabase.from('agenda')
          .select('cliente_id')
          .gte('data_agendada', primeiroDiaMes).lte('data_agendada', ultimoDiaMesIso)
          .not('cliente_id', 'is', null)
          .not('status', 'in', '(cancelado,faltou)'),
        supabase.from('agenda')
          .select('cliente_id')
          .gte('data_agendada', semana[0]).lte('data_agendada', semana[6])
          .not('cliente_id', 'is', null)
          .neq('status', 'cancelado'),
      ]);
      if (cancelado) return;

      const visitasDoMesPorCliente = new Map();
      (mesRes.data ?? []).forEach(v => {
        visitasDoMesPorCliente.set(v.cliente_id, (visitasDoMesPorCliente.get(v.cliente_id) ?? 0) + 1);
      });
      const jaNaSemanaNova = new Set((semNovaRes.data ?? []).map(v => v.cliente_id));

      const { linhas, excluidos } = gerarRegaDaSemana({
        agendaSemanaAnterior: semAnteriorRes.data ?? [],
        clientesPorId,
        visitasDoMesPorCliente,
        semanaAnteriorBase, semanaNovaBase: semana[0],
      });

      // Segurança extra: não duplica quem já tem alguma visita nessa semana
      // nova (ex: gestor já adicionou manualmente, ou rodou isso 2x).
      const jaExistentes = linhas.filter(l => jaNaSemanaNova.has(l.cliente_id));
      const finais = linhas.filter(l => !jaNaSemanaNova.has(l.cliente_id));

      setResultado({ linhas: finais, excluidos, jaExistentes });
      setCarregando(false);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semana[0]]);

  async function gerar() {
    if (!resultado?.linhas.length) return;
    setGerando(true);
    setMsg('');
    try {
      const linhas = resultado.linhas.map(({ _origem, ...linha }) => linha);
      const { error } = await supabase.from('agenda').insert(linhas);
      if (error) throw error;
      onGerado(linhas.length);
    } catch (e) {
      setMsg('Erro ao gerar: ' + e.message);
    } finally {
      setGerando(false);
    }
  }

  const overlayClose = useOverlayClose(onFechar);
  const totalExcluidos = resultado
    ? resultado.excluidos.avulsa.length + resultado.excluidos.troca.length
      + resultado.excluidos.quinzenal.length + resultado.excluidos.pontual.length
    : 0;

  return (
    <div className="ec-overlay" {...overlayClose}>
      <div className="ec-modal ec-modal--copiar">
        <header className="ec-modal__header">
          <h3 className="ec-modal__titulo">📋 Gerar rega da semana</h3>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">
          <p className="ec-copiar__hint">
            Copia a agenda de rega de <strong>{formatarDataCurta(semanaAnteriorBase)} – {formatarDataCurta(semanaAnteriorFim)}</strong> para
            {' '}<strong>{formatarDataCurta(semana[0])} – {formatarDataCurta(semana[6])}</strong>, removendo trocas/eventos,
            quinzenais (não repetem semana seguinte) e pontuais já atendidas esse mês.
          </p>

          {carregando ? (
            <p className="ec-copiar__msg">Calculando...</p>
          ) : (
            <>
              <section className="ec-copiar__sec">
                <h4 className="ec-copiar__sec-titulo">
                  Vai criar
                  <span className="ec-copiar__count">{resultado.linhas.length} visita{resultado.linhas.length !== 1 ? 's' : ''}</span>
                </h4>
                {resultado.linhas.length > 0 && (
                  <div className="ec-copiar__preview">
                    <table className="ec-copiar__tabela">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Funcionário</th>
                          <th>Dia</th>
                          <th>Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.linhas.map((l, i) => (
                          <tr key={i}>
                            <td>{clientesPorId.get(l.cliente_id)?.nome_empresa ?? '—'}</td>
                            <td>{empPorId.get(String(l.funcionario_id)) ?? '—'}</td>
                            <td>{formatarDataCurta(l.data_agendada)}</td>
                            <td>{l.hora_estimada_chegada?.slice(0, 5) ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="ec-copiar__sec">
                <h4 className="ec-copiar__sec-titulo">
                  Excluídas automaticamente
                  <span className="ec-copiar__count">{totalExcluidos}</span>
                </h4>
                <ul className="ec-hint" style={{ listStyle: 'disc', paddingLeft: 18 }}>
                  {resultado.excluidos.quinzenal.length > 0 && <li>{resultado.excluidos.quinzenal.length} quinzenal(is) — atendida(s) na semana anterior, só voltam daqui a 2 semanas</li>}
                  {resultado.excluidos.pontual.length > 0 && <li>{resultado.excluidos.pontual.length} pontual(is) — já atendida(s) esse mês</li>}
                  {resultado.excluidos.troca.length > 0 && <li>{resultado.excluidos.troca.length} troca/reforma/evento — não repetem sozinhas (use o Planejador de Troca no Mapa)</li>}
                  {resultado.excluidos.avulsa.length > 0 && <li>{resultado.excluidos.avulsa.length} tarefa(s) avulsa(s)/lead — sem cadastro de cliente</li>}
                  {resultado.jaExistentes.length > 0 && <li>{resultado.jaExistentes.length} já tinha(m) visita nessa semana — não duplicado</li>}
                </ul>
              </section>

              {msg && <p className="ec-copiar__msg">{msg}</p>}
            </>
          )}
        </div>

        <footer className="ec-modal__footer">
          <button className="ec-btn" onClick={onFechar} disabled={gerando}>Cancelar</button>
          <button
            className="ec-btn ec-btn--primario"
            onClick={gerar}
            disabled={carregando || gerando || !resultado?.linhas.length}
          >
            {gerando ? 'Gerando...' : `📋 Gerar ${resultado?.linhas.length ?? ''} rascunho${resultado?.linhas.length !== 1 ? 's' : ''}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
