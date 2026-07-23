// src/components/Estoque/qr/QRTab.jsx
// Aba de patrimônios QR: gerar códigos, imprimir, ver histórico, registrar evento
import { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/Toast';
import ModalHistorico from '../plantas/ModalHistorico';
import ModalEventoPatrimonio from '../plantas/ModalEventoPatrimonio';

const CRM_URL = 'https://verde-interior-crm.vercel.app';
const LAYOUT_KEY = 'estoque-qr-layout';

function urlPatrimonio(qr) { return `${CRM_URL}/?patrimonio=${qr}`; }

const STATUS_LABEL = {
  disponivel:    'Disponível',
  em_cliente:    'No cliente',
  em_evento:     'Em evento',
  em_manutencao: 'Em recuperação',
  descartado:    'Descartado',
};

const STATUS_COR = {
  disponivel:    'verde',
  em_cliente:    'azul',
  em_evento:     'roxo',
  em_manutencao: 'amarelo',
  descartado:    'cinza',
};

function QRCard({ p, layout, onAbrir }) {
  const semEspecie = !p.especie_nome;
  return (
    <div
      className={`ep-card ep-card--${layout} qr-card ${semEspecie ? 'qr-card--sem-especie' : ''}`}
      onClick={() => onAbrir(p)}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onAbrir(p)}
    >
      <div className="qr-card__mini">
        <QRCodeSVG value={urlPatrimonio(p.qr_codigo)} size={layout === 'grid' ? 72 : 52} />
      </div>
      <div className="qr-card__corpo">
        <div className="qr-card__codigo">{p.qr_codigo}</div>
        <div className="qr-card__especie">{p.especie_nome ?? '— sem espécie —'}</div>
        <span className={`ep-status ep-status--${STATUS_COR[p.status] ?? 'cinza'}`}>
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
        {p.cliente_nome && <div className="qr-card__cliente">📍 {p.cliente_nome}</div>}
      </div>
    </div>
  );
}

function ModalAcoes({ patrimonio, onFechar, onHistorico, onEvento, onAtribuir, onImprimir }) {
  const semEspecie = !patrimonio.especie_nome;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">{patrimonio.qr_codigo}</h2>
            <p className="modal__subinfo">{patrimonio.especie_nome ?? 'sem espécie atribuída'}</p>
          </div>
          <button className="modal__fechar" onClick={onFechar}>✕</button>
        </header>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <QRCodeSVG value={urlPatrimonio(patrimonio.qr_codigo)} size={140} />
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <span className={`ep-status ep-status--${STATUS_COR[patrimonio.status] ?? 'cinza'}`}>
                {STATUS_LABEL[patrimonio.status] ?? patrimonio.status}
              </span>
            </div>
          </div>

          {semEspecie && (
            <button className="modal__btn modal__btn--salvar" onClick={() => onAtribuir(patrimonio)}>
              🌱 Atribuir espécie
            </button>
          )}
          <button className="modal__btn modal__btn--cancelar" onClick={() => onHistorico(patrimonio)}>
            📜 Ver histórico completo
          </button>
          {!semEspecie && (
            <button className="modal__btn modal__btn--cancelar" onClick={() => onEvento(patrimonio)}>
              ✏ Registrar evento
            </button>
          )}
          <button className="modal__btn modal__btn--cancelar" onClick={() => onImprimir(patrimonio)}>
            🖨 Imprimir etiqueta
          </button>
        </div>
        <footer className="modal__footer">
          <button className="modal__btn modal__btn--cancelar" onClick={onFechar}>Fechar</button>
        </footer>
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
            <p className="modal__subinfo">{patrimonio.qr_codigo}</p>
          </div>
          <button className="modal__fechar" onClick={onFechar}>✕</button>
        </header>
        <div className="modal__body">
          <div className="mm__campo">
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
  const [filtro,      setFiltro]      = useState('todos');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [gerando,     setGerando]     = useState(false);
  const [layout,      setLayout]      = useState(() => localStorage.getItem(LAYOUT_KEY) ?? 'lista');
  const [modalAcoes,    setModalAcoes]    = useState(null);
  const [modalHistorico,setModalHistorico]= useState(null);
  const [modalEvento,   setModalEvento]   = useState(null);
  const [modalAtribuir, setModalAtribuir] = useState(null);
  const [modalImprimir, setModalImprimir] = useState(null);

  useEffect(() => { localStorage.setItem(LAYOUT_KEY, layout); }, [layout]);

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
      if (filtro === 'sem_especie'   && p.especie_id) return false;
      if (filtro === 'disponivel'    && p.status !== 'disponivel') return false;
      if (filtro === 'em_cliente'    && p.status !== 'em_cliente') return false;
      if (filtro === 'em_evento'     && p.status !== 'em_evento') return false;
      if (filtro === 'em_manutencao' && p.status !== 'em_manutencao') return false;
      if (filtro === 'descartados'   && p.status !== 'descartado') return false;
      if (filtro !== 'descartados'   && filtro !== 'todos' && p.status === 'descartado') return false;
      if (filtro === 'todos'         && p.status === 'descartado') return false;
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
      total:         ativos.length,
      sem_especie:   ativos.filter(p => !p.especie_id).length,
      em_cliente:    ativos.filter(p => p.status === 'em_cliente').length,
      em_evento:     ativos.filter(p => p.status === 'em_evento').length,
      em_manutencao: ativos.filter(p => p.status === 'em_manutencao').length,
    };
  }, [patrimonios]);

  const filtrosDisponiveis = [
    { id: 'todos',         label: 'Todos ativos' },
    { id: 'disponivel',    label: '🟢 Disponíveis (Lapa)' },
    { id: 'em_cliente',    label: '📍 No cliente' },
    { id: 'em_evento',     label: '🎉 Em evento' },
    { id: 'em_manutencao', label: '🔧 Em recuperação' },
    { id: 'sem_especie',   label: '⚠ Sem espécie' },
    { id: 'descartados',   label: '🗑 Descartados' },
  ];

  function abrirAcoes(p) { setModalAcoes(p); }

  return (
    <>
      <div className="es__kpis">
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.total}</span>
          <span className="es__kpi-label">QR ativos</span>
        </div>
        <div className={`es__kpi ${kpis.sem_especie > 0 ? 'es__kpi--warn' : ''}`}>
          <span className="es__kpi-valor">{kpis.sem_especie}</span>
          <span className="es__kpi-label">Sem espécie</span>
        </div>
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.em_cliente}</span>
          <span className="es__kpi-label">No cliente</span>
        </div>
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.em_evento}</span>
          <span className="es__kpi-label">Em evento</span>
        </div>
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.em_manutencao}</span>
          <span className="es__kpi-label">Recuperação</span>
        </div>
      </div>

      <div className="es__filtros">
        <div className="es__busca-wrap">
          <span className="es__busca-icon">⌕</span>
          <input className="es__busca" placeholder="Código, espécie, cliente..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          {busca && <button className="es__busca-clear" onClick={() => setBusca('')}>✕</button>}
        </div>

        <button
          className={`es__btn-sec ${filtro !== 'todos' ? 'es__btn-sec--ativo' : ''}`}
          onClick={() => setFiltrosAbertos(v => !v)}
        >⚗ Filtros{filtro !== 'todos' ? ' •' : ''}</button>

        <div className="es__layout-toggle" role="group">
          <button className={`es__layout-btn ${layout === 'lista' ? 'es__layout-btn--ativo' : ''}`} onClick={() => setLayout('lista')} aria-label="Lista">☰</button>
          <button className={`es__layout-btn ${layout === 'grid' ? 'es__layout-btn--ativo' : ''}`} onClick={() => setLayout('grid')} aria-label="Grade">▦</button>
        </div>

        <span className="es__count">{filtrados.length}</span>
        <button className="es__btn-pri" onClick={gerarNovoQR} disabled={gerando}>
          {gerando ? 'Gerando...' : '+ QR'}
        </button>
      </div>

      {filtrosAbertos && (
        <div className="es__filtros-painel">
          <div className="es__filtros-grupo">
            <span className="es__filtros-titulo">Estado</span>
            <div className="es__filtros-pills">
              {filtrosDisponiveis.map(f => (
                <button key={f.id}
                  className={`es__pill ${filtro === f.id ? 'es__pill--ativo' : ''}`}
                  onClick={() => setFiltro(f.id)}
                >{f.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="es__estado"><div className="es__spinner" /></div>
      ) : filtrados.length === 0 ? (
        <div className="es__estado">
          <p className="es__estado-msg">
            {patrimonios.length === 0 ? 'Nenhum QR gerado ainda.' : 'Nenhum resultado.'}
          </p>
        </div>
      ) : (
        <div className={`es__lista es__lista--${layout}`}>
          {filtrados.map(p => (
            <QRCard key={p.id} p={p} layout={layout} onAbrir={abrirAcoes} />
          ))}
        </div>
      )}

      {modalAcoes && (
        <ModalAcoes
          patrimonio={modalAcoes}
          onFechar={() => setModalAcoes(null)}
          onHistorico={p => { setModalAcoes(null); setModalHistorico(p); }}
          onEvento={p => { setModalAcoes(null); setModalEvento(p); }}
          onAtribuir={p => { setModalAcoes(null); setModalAtribuir(p); }}
          onImprimir={p => { setModalAcoes(null); setModalImprimir(p); }}
        />
      )}
      {modalHistorico && (
        <ModalHistorico patrimonio={modalHistorico} onFechar={() => setModalHistorico(null)} />
      )}
      {modalEvento && (
        <ModalEventoPatrimonio
          patrimonio={modalEvento}
          especies={especies}
          onFechar={() => setModalEvento(null)}
          onSalvo={() => { setModalEvento(null); carregar(); }}
        />
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
