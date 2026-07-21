// src/components/EscalaCampo/ModalBloqueios.jsx
// Modal de bloqueios (férias/folga) — extraído de EscalaCampo.jsx (Fase 3.3)
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ModalBloqueios({ funcionarioId, funcionarioNome, bloqueios, onFechar, onMudou }) {
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
