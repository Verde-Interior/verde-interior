// src/components/EscalaCampo/ModalCopiarAgenda.jsx
// Modal de copiar agenda — extraído de EscalaCampo.jsx (Fase 3.3)
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function ModalCopiarAgenda({ employees, clientes, diaSel, onFechar, onCopiado }) {
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

  const [preview, setPreview] = useState([]);
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
