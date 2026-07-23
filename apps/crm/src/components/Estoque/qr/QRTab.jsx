// src/components/Estoque/qr/QRTab.jsx
// Aba de patrimônios QR: gerar códigos, imprimir, atribuir espécie
import { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/Toast';

const CRM_URL = 'https://verde-interior-crm.vercel.app';

function urlPatrimonio(qr) {
  return `${CRM_URL}/?patrimonio=${qr}`;
}

function QRCard({ p, onAtribuir, onImprimir }) {
  const semEspecie = !p.especie_nome;
  return (
    <div className={`es-card qr-card ${semEspecie ? 'qr-card--sem-especie' : ''}`}>
      <div className="qr-card__codigo">{semEspecie ? '⬛ sem espécie' : null}{p.qr_codigo}</div>
      <div className="qr-card__info">
        <div className="qr-card__especie">{p.especie_nome ?? '— não atribuída —'}</div>
        {p.status !== 'disponivel' && (
          <div className="qr-card__status">{p.status === 'em_cliente' ? `📍 ${p.cliente_nome}` : p.status}</div>
        )}
      </div>
      <div className="qr-card__qr">
        <QRCodeSVG value={urlPatrimonio(p.qr_codigo)} size={56} />
      </div>
      <div className="ep-card__acoes">
        {semEspecie && (
          <button className="es-card__editar es-card__editar--pri" onClick={() => onAtribuir(p)} title="Atribuir espécie">
            Atribuir
          </button>
        )}
        <button className="es-card__editar" onClick={() => onImprimir(p)} title="Imprimir etiqueta">🖨</button>
      </div>
    </div>
  );
}

function ModalAtribuir({ patrimonio, especies, onFechar, onSalvo }) {
  const toast = useToast();
  const [especieId, setEspecieId] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!especieId) { toast.erro('Selecione a espécie.'); return; }
    setSalvando(true);
    const { error: ePat } = await supabase.from('estoque_patrimonios')
      .update({ especie_id: especieId })
      .eq('id', patrimonio.id);
    if (ePat) { toast.erro('Erro: ' + ePat.message); setSalvando(false); return; }
    await supabase.from('estoque_eventos').insert({
      patrimonio_id: patrimonio.id,
      tipo: 'troca_especie',
      especie_nova_id: especieId,
      observacoes: 'Espécie atribuída via QR',
    });
    toast.ok(`Espécie atribuída a ${patrimonio.qr_codigo}`);
    setSalvando(false);
    onSalvo?.();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvando && onFechar()}>
      <div className="modal">
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">Atribuir espécie</h2>
            <p className="modal__subinfo">{patrimonio.qr_codigo} · etiqueta física</p>
          </div>
          <button className="modal__fechar" onClick={onFechar}>✕</button>
        </header>
        <div className="modal__body">
          <div className="qr-atribuir__qr">
            <QRCodeSVG value={urlPatrimonio(patrimonio.qr_codigo)} size={120} />
            <p className="qr-atribuir__url">{urlPatrimonio(patrimonio.qr_codigo)}</p>
          </div>
          <div className="mm__campo" style={{ marginTop: 16 }}>
            <label className="modal__label">Qual planta está nesta etiqueta? <span className="modal__obrigatorio">*</span></label>
            <select className="modal__select" value={especieId} onChange={e => setEspecieId(e.target.value)}>
              <option value="">Selecione a espécie...</option>
              {especies.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        </div>
        <footer className="modal__footer">
          <button className="modal__btn modal__btn--cancelar" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="modal__btn modal__btn--salvar" onClick={salvar} disabled={salvando || !especieId}>
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ModalImprimir({ patrimonio, onFechar }) {
  const printRef = useRef();

  function imprimir() {
    const conteudo = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=400,height=300');
    win.document.write(`
      <html><head><title>Etiqueta ${patrimonio.qr_codigo}</title>
      <style>
        body { font-family: sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; }
        .etiqueta { text-align:center; border:1px solid #ccc; padding:16px; border-radius:8px; display:inline-block; }
        .etiqueta svg { display:block; margin:0 auto 8px; }
        .codigo { font-weight:700; font-size:18px; letter-spacing:0.08em; }
        .especie { font-size:13px; color:#666; margin-top:4px; }
        @media print { body { height:auto; } }
      </style></head><body>${conteudo}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal" style={{ maxWidth: 340 }}>
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">Imprimir etiqueta</h2>
            <p className="modal__subinfo">{patrimonio.qr_codigo}</p>
          </div>
          <button className="modal__fechar" onClick={onFechar}>✕</button>
        </header>
        <div className="modal__body" style={{ display:'flex', justifyContent:'center' }}>
          <div ref={printRef} className="etiqueta" style={{ textAlign:'center', border:'1px solid #ddd', padding:20, borderRadius:8, display:'inline-block' }}>
            <QRCodeSVG value={urlPatrimonio(patrimonio.qr_codigo)} size={160} />
            <div style={{ fontWeight:700, fontSize:18, marginTop:8, letterSpacing:'0.08em' }}>{patrimonio.qr_codigo}</div>
            {patrimonio.especie_nome && (
              <div style={{ fontSize:13, color:'#666', marginTop:4 }}>{patrimonio.especie_nome}</div>
            )}
          </div>
        </div>
        <footer className="modal__footer">
          <button className="modal__btn modal__btn--cancelar" onClick={onFechar}>Fechar</button>
          <button className="modal__btn modal__btn--salvar" onClick={imprimir}>🖨 Imprimir</button>
        </footer>
      </div>
    </div>
  );
}

export default function QRTab() {
  const toast = useToast();
  const [patrimonios, setPatrimonios] = useState([]);
  const [especies,    setEspecies]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [busca,       setBusca]       = useState('');
  const [filtro,      setFiltro]      = useState('todos'); // todos | sem_especie | com_especie
  const [gerando,     setGerando]     = useState(false);
  const [modalAtribuir, setModalAtribuir] = useState(null);
  const [modalImprimir, setModalImprimir] = useState(null);

  async function carregar() {
    setLoading(true);
    const [{ data: pats }, { data: esps }] = await Promise.all([
      supabase.from('estoque_patrimonios_view').select('*').order('qr_codigo'),
      supabase.from('estoque_especies').select('id, nome').eq('ativo', true).order('nome'),
    ]);
    setPatrimonios(pats ?? []);
    setEspecies(esps ?? []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function gerarNovoQR() {
    setGerando(true);
    const { data: qr, error: eQr } = await supabase.rpc('gerar_qr_codigo_patrimonio');
    if (eQr) { toast.erro('Erro ao gerar QR: ' + eQr.message); setGerando(false); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from('estoque_patrimonios').insert({
      id, qr_codigo: qr, status: 'disponivel',
    });
    if (error) { toast.erro('Erro: ' + error.message); setGerando(false); return; }
    await supabase.from('estoque_eventos').insert({ patrimonio_id: id, tipo: 'cadastro', observacoes: 'QR gerado sem espécie' });
    toast.ok(`Código ${qr} gerado`);
    setGerando(false);
    carregar();
  }

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return patrimonios.filter(p => {
      if (filtro === 'sem_especie'  && p.especie_id) return false;
      if (filtro === 'com_especie'  && !p.especie_id) return false;
      if (filtro === 'descartados'  && p.status !== 'descartado') return false;
      if (filtro !== 'descartados'  && p.status === 'descartado') return false;
      if (q) {
        const txt = `${p.qr_codigo} ${p.especie_nome ?? ''} ${p.cliente_nome ?? ''}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [patrimonios, busca, filtro]);

  const kpis = useMemo(() => {
    const ativos = patrimonios.filter(p => p.status !== 'descartado');
    return {
      total:       ativos.length,
      sem_especie: ativos.filter(p => !p.especie_id).length,
      em_cliente:  ativos.filter(p => p.status === 'em_cliente').length,
    };
  }, [patrimonios]);

  return (
    <>
      <div className="es__kpis">
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.total}</span>
          <span className="es__kpi-label">QR codes ativos</span>
        </div>
        <div className={`es__kpi ${kpis.sem_especie > 0 ? 'es__kpi--warn' : ''}`}>
          <span className="es__kpi-valor">{kpis.sem_especie}</span>
          <span className="es__kpi-label">Sem espécie</span>
        </div>
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.em_cliente}</span>
          <span className="es__kpi-label">No cliente</span>
        </div>
      </div>

      <div className="es__filtros">
        <div className="es__busca-wrap">
          <span className="es__busca-icon">⌕</span>
          <input className="es__busca" placeholder="Buscar código, espécie..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          {busca && <button className="es__busca-clear" onClick={() => setBusca('')}>✕</button>}
        </div>
        <div className="es__filtros-pills">
          {[
            { id: 'todos',       label: 'Todos' },
            { id: 'sem_especie', label: '⚠ Sem espécie' },
            { id: 'com_especie', label: 'Atribuídos' },
            { id: 'descartados', label: 'Descartados' },
          ].map(f => (
            <button key={f.id}
              className={`es__pill ${filtro === f.id ? 'es__pill--ativo' : ''}`}
              onClick={() => setFiltro(f.id)}
            >{f.label}</button>
          ))}
        </div>
        <span className="es__count">{filtrados.length} código{filtrados.length !== 1 ? 's' : ''}</span>
        <button className="es__btn-pri" onClick={gerarNovoQR} disabled={gerando}>
          {gerando ? 'Gerando...' : '+ Gerar QR'}
        </button>
      </div>

      {loading ? (
        <div className="es__estado"><div className="es__spinner" /></div>
      ) : filtrados.length === 0 ? (
        <div className="es__estado">
          <p className="es__estado-msg">
            {patrimonios.length === 0 ? 'Nenhum QR code gerado ainda. Clique em "+ Gerar QR" para começar.' : 'Nenhum resultado.'}
          </p>
        </div>
      ) : (
        <div className="es__lista">
          {filtrados.map(p => (
            <QRCard key={p.id} p={p}
              onAtribuir={setModalAtribuir}
              onImprimir={setModalImprimir}
            />
          ))}
        </div>
      )}

      {modalAtribuir && (
        <ModalAtribuir
          patrimonio={modalAtribuir}
          especies={especies}
          onFechar={() => setModalAtribuir(null)}
          onSalvo={() => { setModalAtribuir(null); carregar(); }}
        />
      )}
      {modalImprimir && (
        <ModalImprimir
          patrimonio={modalImprimir}
          onFechar={() => setModalImprimir(null)}
        />
      )}
    </>
  );
}
