// src/components/EscalaCampo/ModalRevisarSemana.jsx
// Revisão consolidada da semana (Fase C) — junta tudo que está em rascunho
// no período (rega gerada pela Fase B + trocas criadas pelo Planejador do
// Mapa + qualquer coisa adicionada manualmente) numa lista só, agrupada por
// tipo, com um botão único pra publicar tudo de uma vez.
import { useMemo } from 'react';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import { formatarDataCurta } from '../../utils/dateUtils';

const GRUPOS = [
  { id: 'rega',   label: 'Rega',   teste: tipos => !tipos?.length || tipos.every(t => t === 'manutencao') },
  { id: 'troca',  label: 'Troca',  teste: tipos => tipos?.includes('troca') },
  { id: 'outro',  label: 'Outros (reforma/evento/avulso)', teste: () => true }, // catch-all
];

function grupoDe(tiposTarefa) {
  return GRUPOS.find(g => g.teste(tiposTarefa))?.id ?? 'outro';
}

export default function ModalRevisarSemana({ visitas, employees, clientes, semana, onFechar, onPublicar, publicando }) {
  const empPorId = useMemo(() => new Map(employees.map(e => [String(e.id), e.name])), [employees]);
  const clientesPorId = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);

  const rascunhos = useMemo(() => visitas.filter(v => v.status === 'rascunho'), [visitas]);

  const porGrupo = useMemo(() => {
    const mapa = { rega: [], troca: [], outro: [] };
    rascunhos.forEach(v => mapa[grupoDe(v.tipos_tarefa)].push(v));
    return mapa;
  }, [rascunhos]);

  function nomeCliente(v) {
    return clientesPorId.get(v.cliente_id)?.nome_empresa ?? v.clientes?.nome_empresa ?? v.nome_cliente ?? '—';
  }

  const overlayClose = useOverlayClose(onFechar);

  return (
    <div className="ec-overlay" {...overlayClose}>
      <div className="ec-modal ec-modal--copiar">
        <header className="ec-modal__header">
          <h3 className="ec-modal__titulo">🔍 Revisar semana</h3>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">
          <p className="ec-copiar__hint">
            Tudo em rascunho entre <strong>{formatarDataCurta(semana[0])}</strong> e <strong>{formatarDataCurta(semana[6])}</strong> — de onde quer que tenha vindo (Gerar Rega, Planejador de Troca, ou adicionado manualmente).
          </p>

          {rascunhos.length === 0 ? (
            <p className="ec-copiar__msg">Nenhum rascunho nessa semana — nada pra publicar.</p>
          ) : (
            GRUPOS.map(g => porGrupo[g.id].length > 0 && (
              <section className="ec-copiar__sec" key={g.id}>
                <h4 className="ec-copiar__sec-titulo">
                  {g.label}
                  <span className="ec-copiar__count">{porGrupo[g.id].length}</span>
                </h4>
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
                      {porGrupo[g.id].map(v => (
                        <tr key={v.id}>
                          <td>{nomeCliente(v)}</td>
                          <td>{empPorId.get(String(v.funcionario_id)) ?? '—'}</td>
                          <td>{formatarDataCurta(v.data_agendada)}</td>
                          <td>{v.hora_estimada_chegada?.slice(0, 5) ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )}
        </div>

        <footer className="ec-modal__footer">
          <button className="ec-btn" onClick={onFechar} disabled={publicando}>Fechar</button>
          <button
            className="ec-btn ec-btn--primario"
            onClick={onPublicar}
            disabled={publicando || rascunhos.length === 0}
          >
            {publicando ? 'Publicando...' : `Publicar semana (${rascunhos.length})`}
          </button>
        </footer>
      </div>
    </div>
  );
}
