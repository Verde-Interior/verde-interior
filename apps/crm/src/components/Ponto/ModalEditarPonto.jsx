// src/components/Ponto/ModalEditarPonto.jsx
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import { TIPO_LABEL, diaLabel, validarNovoRegistro, calcularDeltaAcumulado } from './pontoCalc';

const TIPOS = ['entry', 'break', 'return', 'exit'];

export default function ModalEditarPonto({ emp, dia, recs, onFechar, onMudou }) {
  const [tipo, setTipo] = useState('entry');
  const [horario, setHorario] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(null);
  const [erro, setErro] = useState(null);

  const overlayClose = useOverlayClose(onFechar);

  async function aplicarDelta(recsAntes, recsDepois) {
    const delta = calcularDeltaAcumulado(emp, recsAntes, recsDepois);
    const { error } = await supabase.from('employees').update(delta).eq('id', emp.id);
    if (error) console.error('Falha ao recalcular acumulado:', error.message);
  }

  async function remover(rec) {
    if (!confirm('Remover este registro?')) return;
    setRemovendo(rec.id);
    const { error } = await supabase.from('punch_records').delete().eq('id', rec.id);
    if (error) { alert('Erro ao remover: ' + error.message); setRemovendo(null); return; }
    const recsDepois = recs.filter((r) => r.id !== rec.id);
    await aplicarDelta(recs, recsDepois);
    setRemovendo(null);
    await onMudou();
  }

  async function adicionar() {
    setErro(null);
    if (!horario) { setErro('Informe o horário'); return; }
    const problema = validarNovoRegistro(recs, tipo, horario);
    if (problema) { setErro(problema); return; }

    setSalvando(true);
    const { data, error } = await supabase.from('punch_records').insert({
      employee_id: emp.id,
      date: dia,
      type: tipo,
      time: horario,
      obs: obs.trim() || null,
    }).select().single();
    setSalvando(false);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }

    const recsDepois = [...recs, data].sort((a, b) => a.time.localeCompare(b.time));
    await aplicarDelta(recs, recsDepois);
    setHorario('');
    setObs('');
    await onMudou();
  }

  const ordenados = [...recs].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="ponto-modal-overlay" {...overlayClose}>
      <div className="ponto-modal">
        <header className="ponto-modal__header">
          <div>
            <h3 className="ponto-modal__titulo">{emp.name}</h3>
            <p className="ponto-modal__sub">{diaLabel(dia)}</p>
          </div>
          <button className="ponto-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ponto-modal__corpo">
          <div className="ponto-modal__lista">
            {ordenados.length === 0 ? (
              <p className="ponto__vazio">Nenhum registro nesse dia.</p>
            ) : ordenados.map((r) => (
              <div className="ponto-modal__item" key={r.id}>
                <div>
                  <span className="ponto-modal__item-tipo">{TIPO_LABEL[r.type] || r.type}</span>
                  {r.obs && <span className="ponto-modal__item-obs"> · {r.obs}</span>}
                </div>
                <div className="ponto-modal__item-acao">
                  <span className="ponto-modal__item-hora">{r.time}</span>
                  <button
                    className="ponto-modal__del"
                    disabled={removendo === r.id}
                    onClick={() => remover(r)}
                    aria-label="Remover"
                  >🗑</button>
                </div>
              </div>
            ))}
          </div>

          <div className="ponto-modal__add">
            <div className="ponto-modal__add-linha">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
              <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
            <input
              type="text"
              className="ponto-modal__obs-input"
              placeholder="Observação (opcional)"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
            {erro && <p className="ponto-modal__erro">{erro}</p>}
            <button className="ponto__btn ponto__btn--ok" disabled={salvando} onClick={adicionar}>
              {salvando ? 'Adicionando...' : '+ Adicionar registro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
