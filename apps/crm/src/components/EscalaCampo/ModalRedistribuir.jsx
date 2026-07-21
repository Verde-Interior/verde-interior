// src/components/EscalaCampo/ModalRedistribuir.jsx
// Modal de redistribuição de visitas de funcionários ausentes — extraído de EscalaCampo.jsx (Fase 3.3)
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { distanciaKm } from '../../utils/geoUtils';
import { bloqueioNoDia } from '../../utils/escalaHelpers';

export default function ModalRedistribuir({ visitas, employees, agendaOrg, bloqueios, onFechar, onMudou }) {
  const [salvando, setSalvando] = useState(false);
  const [escolhas, setEscolhas] = useState({});

  const cards = visitas.map(v => {
    const empAtualId = String(v.funcionario_id);
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
    candidatos.sort((a, b) => {
      if (a.n !== b.n) return a.n - b.n;
      const dA = a.distMin ?? 9999;
      const dB = b.distMin ?? 9999;
      return dA - dB;
    });
    const sugerido = candidatos[0]?.emp;
    return { visita: v, candidatos, sugerido };
  });

  useEffect(() => {
    const init = {};
    cards.forEach(c => { if (c.sugerido) init[c.visita.id] = String(c.sugerido.id); });
    setEscolhas(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitas.length]);

  async function aplicar() {
    setSalvando(true);
    try {
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
