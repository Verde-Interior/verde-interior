// src/components/Estoque/qr/ModalAtribuirQR.jsx
// Abre automaticamente quando a URL tem ?patrimonio=VI-xxxx (scan de QR)
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/Toast';

export default function ModalAtribuirQR({ codigoQR, onFechar }) {
  const toast = useToast();
  const [patrimonio, setPatrimonio] = useState(null);  // dados do QR
  const [especies,   setEspecies]   = useState([]);
  const [especieId,  setEspecieId]  = useState('');
  const [loading,    setLoading]    = useState(true);
  const [salvando,   setSalvando]   = useState(false);
  const [notFound,   setNotFound]   = useState(false);

  useEffect(() => {
    async function buscar() {
      setLoading(true);
      const [{ data: pats }, { data: esps }] = await Promise.all([
        supabase.from('estoque_patrimonios_view').select('*').eq('qr_codigo', codigoQR).maybeSingle(),
        supabase.from('estoque_especies').select('id, nome').eq('ativo', true).order('nome'),
      ]);
      setLoading(false);
      if (!pats) { setNotFound(true); return; }
      setPatrimonio(pats);
      setEspecies(esps ?? []);
      if (pats.especie_id) setEspecieId(pats.especie_id);
    }
    buscar();
  }, [codigoQR]);

  async function salvar() {
    if (!especieId) { toast.erro('Selecione a espécie.'); return; }
    setSalvando(true);
    const anteriorId = patrimonio.especie_id;
    const { error } = await supabase.from('estoque_patrimonios')
      .update({ especie_id: especieId })
      .eq('id', patrimonio.id);
    if (error) { toast.erro('Erro: ' + error.message); setSalvando(false); return; }
    await supabase.from('estoque_eventos').insert({
      patrimonio_id:       patrimonio.id,
      tipo:                'troca_especie',
      especie_anterior_id: anteriorId ?? null,
      especie_nova_id:     especieId,
      observacoes:         'Atribuído via scan de QR code',
    });
    const nomeEsp = especies.find(e => e.id === especieId)?.nome ?? '';
    toast.ok(`${codigoQR} → ${nomeEsp}`);
    setSalvando(false);
    onFechar();
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">QR Escaneado</h2>
            <p className="modal__subinfo">{codigoQR}</p>
          </div>
          <button className="modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="modal__body">
          {loading ? (
            <div className="es__estado"><div className="es__spinner" /></div>
          ) : notFound ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: 32 }}>❓</p>
              <p>Código <strong>{codigoQR}</strong> não encontrado no sistema.</p>
              <p style={{ fontSize: 12, marginTop: 8 }}>Gere este QR na aba Estoque → QR Codes.</p>
            </div>
          ) : (
            <>
              {patrimonio.especie_nome && (
                <div style={{ background: 'var(--forest-100)', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                  Espécie atual: <strong>{patrimonio.especie_nome}</strong>
                  {patrimonio.cliente_nome && <> · 📍 {patrimonio.cliente_nome}</>}
                </div>
              )}
              <div className="mm__campo">
                <label className="modal__label">
                  {patrimonio.especie_nome ? 'Trocar para a espécie:' : 'Qual planta está nesta etiqueta?'}
                  {!patrimonio.especie_nome && <span className="modal__obrigatorio"> *</span>}
                </label>
                <select className="modal__select" value={especieId} onChange={e => setEspecieId(e.target.value)}>
                  <option value="">Selecione a espécie...</option>
                  {especies.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        {!loading && !notFound && (
          <footer className="modal__footer">
            <button className="modal__btn modal__btn--cancelar" onClick={onFechar} disabled={salvando}>Cancelar</button>
            <button className="modal__btn modal__btn--salvar" onClick={salvar} disabled={salvando || !especieId}>
              {salvando ? 'Salvando...' : 'Confirmar'}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
