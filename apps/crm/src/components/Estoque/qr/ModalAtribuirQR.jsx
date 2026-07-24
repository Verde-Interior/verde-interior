// src/components/Estoque/qr/ModalAtribuirQR.jsx
// Abre automaticamente quando a URL tem ?patrimonio=VI-xxxx (scan de QR)
// Hub de ações: atribuir espécie, registrar evento, ver histórico
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/Toast';
import ModalHistorico from '../plantas/ModalHistorico';
import ModalEventoPatrimonio from '../plantas/ModalEventoPatrimonio';

const STATUS_LABEL = {
  disponivel:    '🟢 Disponível (Lapa)',
  em_cliente:    '📍 No cliente',
  em_evento:     '🎉 Em evento',
  em_manutencao: '🔧 Em recuperação',
  descartado:    '🗑 Descartado',
};

export default function ModalAtribuirQR({ codigoQR, onFechar }) {
  const toast = useToast();
  const [patrimonio, setPatrimonio] = useState(null);
  const [especies,   setEspecies]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [modo,       setModo]       = useState('menu'); // menu | trocar_especie
  const [especieId,  setEspecieId]  = useState('');
  const [salvando,   setSalvando]   = useState(false);
  const [subModal,   setSubModal]   = useState(null); // 'historico' | 'evento'

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
    // Se ainda não tem espécie, já vai direto para atribuição
    if (!pats.especie_id) setModo('trocar_especie');
  }

  useEffect(() => { buscar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [codigoQR]);

  async function salvarEspecie() {
    if (!especieId) { toast.erro('Selecione a espécie.'); return; }
    setSalvando(true);
    const anteriorId = patrimonio.especie_id;
    const { error } = await supabase.from('estoque_patrimonios')
      .update({ especie_id: especieId })
      .eq('id', patrimonio.id);
    if (error) { toast.erro('Erro: ' + error.message); setSalvando(false); return; }
    await supabase.from('estoque_eventos').insert({
      patrimonio_id:       patrimonio.id,
      tipo:                anteriorId ? 'troca_especie' : 'cadastro',
      especie_anterior_id: anteriorId ?? null,
      especie_nova_id:     especieId,
      observacoes:         anteriorId ? 'Trocado via scan de QR' : 'Espécie atribuída via scan de QR',
    });
    const nomeEsp = especies.find(e => e.id === especieId)?.nome ?? '';
    toast.ok(`${codigoQR} → ${nomeEsp}`);
    setSalvando(false);
    onFechar();
  }

  // Sub-modais: histórico ou evento
  if (patrimonio && subModal === 'historico') {
    return <ModalHistorico patrimonio={patrimonio} onFechar={() => setSubModal(null)} />;
  }
  if (patrimonio && subModal === 'evento') {
    return (
      <ModalEventoPatrimonio
        patrimonio={patrimonio}
        especies={especies}
        onFechar={() => setSubModal(null)}
        onSalvo={() => { setSubModal(null); buscar(); }}
      />
    );
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: 420 }}>
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
              <p>Código <strong>{codigoQR}</strong> não encontrado.</p>
              <p style={{ fontSize: 12, marginTop: 8 }}>Gere este QR na aba Estoque → QR Codes.</p>
            </div>
          ) : modo === 'trocar_especie' ? (
            <>
              {patrimonio.especie_nome ? (
                <div className="qr-scan__info">
                  Espécie atual: <strong>{patrimonio.especie_nome}</strong>
                </div>
              ) : (
                <div className="qr-scan__info qr-scan__info--warn">
                  Ainda sem espécie atribuída. Selecione a planta desta etiqueta:
                </div>
              )}
              <div className="mm__campo">
                <label className="modal__label">
                  {patrimonio.especie_nome ? 'Trocar para:' : 'Espécie:'}
                  {!patrimonio.especie_nome && <span className="modal__obrigatorio"> *</span>}
                </label>
                <select
                  className="modal__select"
                  value={especieId}
                  onChange={e => setEspecieId(e.target.value)}
                  style={{ fontSize: 16 }}
                >
                  <option value="">Selecione a espécie...</option>
                  {especies.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
            </>
          ) : (
            // menu principal
            <>
              <div className="qr-scan__info qr-scan__info--card">
                <div className="qr-scan__especie">{patrimonio.especie_nome ?? '— sem espécie —'}</div>
                <div className="qr-scan__status">{STATUS_LABEL[patrimonio.status] ?? patrimonio.status}</div>
                {patrimonio.cliente_nome && (
                  <div className="qr-scan__cliente">📍 {patrimonio.cliente_nome}</div>
                )}
              </div>

              <div className="qr-scan__acoes">
                <button className="qr-scan__btn qr-scan__btn--pri" onClick={() => setSubModal('evento')}>
                  ✏ Registrar evento
                </button>
                <button className="qr-scan__btn" onClick={() => setSubModal('historico')}>
                  📜 Ver histórico
                </button>
                <button className="qr-scan__btn" onClick={() => { setEspecieId(patrimonio.especie_id ?? ''); setModo('trocar_especie'); }}>
                  🔄 Trocar espécie
                </button>
              </div>
            </>
          )}
        </div>

        {!loading && !notFound && (
          <footer className="modal__footer">
            {modo === 'trocar_especie' ? (
              <>
                {patrimonio.especie_nome && (
                  <button className="modal__btn modal__btn--cancelar" onClick={() => setModo('menu')} disabled={salvando}>
                    Voltar
                  </button>
                )}
                {!patrimonio.especie_nome && (
                  <button className="modal__btn modal__btn--cancelar" onClick={onFechar} disabled={salvando}>
                    Cancelar
                  </button>
                )}
                <button className="modal__btn modal__btn--salvar" onClick={salvarEspecie} disabled={salvando || !especieId}>
                  {salvando ? 'Salvando...' : 'Confirmar'}
                </button>
              </>
            ) : (
              <button className="modal__btn modal__btn--cancelar" onClick={onFechar} style={{ width: '100%' }}>
                Fechar
              </button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}
