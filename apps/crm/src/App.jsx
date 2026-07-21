// src/App.jsx
import { useState, useEffect } from 'react';
import { CRMProvider, useCRM } from './context/CRMContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast/Toast';
import Login from './components/Login/Login';
import LogoMarca from './components/LogoMarca/LogoMarca';
import KanbanBoard from './components/KanbanBoard/KanbanBoard';
import ModalOrcamento from './components/ModalOrcamento/ModalOrcamento';
import Dashboard from './components/Dashboard/Dashboard';
import GlobalSearch from './components/GlobalSearch/GlobalSearch';
import Tarefas from './components/Tarefas/Tarefas';
import Configuracoes from './components/Configuracoes/Configuracoes';
import FunilExecucao from './components/FunilExecucao/FunilExecucao';
import SidebarCalendario from './components/SidebarCalendario/SidebarCalendario';
import Agenda from './components/Agenda/Agenda';
import Clientes from './components/Clientes/Clientes';
import EscalaCampo from './components/EscalaCampo/EscalaCampo';
import Relatorios from './components/Relatorios/Relatorios';
import Estoque from './components/Estoque/Estoque';
import OrdensServico from './components/OrdensServico/OrdensServico';
import './App.css';

const IconDashboard = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
    <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
    <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
    <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
  </svg>
);

const IconPipeline = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1"  y="2" width="4" height="12" rx="1.5" fill="currentColor"/>
    <rect x="6"  y="2" width="4" height="8"  rx="1.5" fill="currentColor"/>
    <rect x="11" y="2" width="4" height="10" rx="1.5" fill="currentColor"/>
  </svg>
);

const IconTarefas = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="2" width="14" height="2" rx="1" fill="currentColor" opacity="0.4"/>
    <rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor"/>
    <rect x="1" y="12" width="9" height="2" rx="1" fill="currentColor" opacity="0.7"/>
    <circle cx="13.5" cy="13" r="2" fill="currentColor"/>
    <path d="M12.5 13L13.2 13.8L14.8 12.2" stroke="white" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconConfig = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 1.5V3M8 13v1.5M14.5 8H13M3 8H1.5M12.36 3.64l-1.06 1.06M4.7 11.3l-1.06 1.06M12.36 12.36l-1.06-1.06M4.7 4.7 3.64 3.64" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconAgenda = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M5 1v3M11 1v3M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="5.5" cy="10.5" r="1" fill="currentColor"/>
    <circle cx="8"   cy="10.5" r="1" fill="currentColor"/>
    <circle cx="10.5" cy="10.5" r="1" fill="currentColor"/>
  </svg>
);

const IconExecucao = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="3" width="3" height="10" rx="1" fill="currentColor"/>
    <rect x="5.5" y="5" width="3" height="8" rx="1" fill="currentColor"/>
    <rect x="10" y="2" width="3" height="11" rx="1" fill="currentColor" opacity="0.5"/>
    <path d="M13.5 4.5L15 3l-1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconClientes = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="5" width="10" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <rect x="3" y="7.5" width="2" height="2" rx="0.5" fill="currentColor"/>
    <rect x="7" y="7.5" width="2" height="2" rx="0.5" fill="currentColor"/>
    <rect x="3" y="10.5" width="2" height="2" rx="0.5" fill="currentColor"/>
    <rect x="7" y="10.5" width="2" height="2" rx="0.5" fill="currentColor"/>
    <path d="M11 7h3V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    <path d="M1 14h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconEscala = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="3" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M1 7h14" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="3" y="9.5" width="3" height="2" rx="0.5" fill="currentColor" opacity="0.8"/>
    <rect x="6.5" y="9.5" width="3" height="2" rx="0.5" fill="currentColor" opacity="0.5"/>
    <rect x="10" y="9.5" width="3" height="2" rx="0.5" fill="currentColor" opacity="0.3"/>
    <path d="M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconRelatorios = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 1.5h7l3 3V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M10 1.5V4.5H13" stroke="currentColor" strokeWidth="1.4" fill="none"/>
    <path d="M4.5 8h7M4.5 10.5h7M4.5 13h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IconEstoque = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <path d="M2 5l6 3 6-3M8 8v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IconOS = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M5 5h6M5 7.5h6M5 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="13" cy="12" r="2.5" fill="currentColor"/>
    <path d="M12.2 12l.6.7 1.2-1.2" stroke="white" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const NAV_ITEMS_TOP = [
  { id: 'dashboard',  Icon: IconDashboard, label: 'Dashboard' },
  { id: 'kanban',     Icon: IconPipeline,  label: 'Pipeline'  },
  { id: 'execucao',   Icon: IconExecucao,  label: 'Execução'  },
  { id: 'os',         Icon: IconOS,        label: 'Ordens OS' },
  { id: 'clientes',   Icon: IconClientes,  label: 'Clientes'  },
  { id: 'escala',     Icon: IconEscala,    label: 'Escala'    },
  { id: 'relatorios', Icon: IconRelatorios,label: 'Relatórios'},
  { id: 'estoque',    Icon: IconEstoque,   label: 'Estoque'   },
  { id: 'agenda',     Icon: IconAgenda,    label: 'Agenda'    },
  { id: 'tarefas',    Icon: IconTarefas,   label: 'Tarefas'   },
];

const NAV_ITEM_CONFIG = { id: 'configuracoes', Icon: IconConfig, label: 'Configurações' };

function AppLayout() {
  const [tela, setTela]               = useState('dashboard');
  const [buscaAberta, setBuscaAberta] = useState(false);
  const { leads, tarefas } = useCRM();
  const { usuario, sair } = useAuth();

  const hoje = new Date().toISOString().split('T')[0];
  const followUpCount = leads.filter((l) => l.proximoFollowUp && l.proximoFollowUp <= hoje).length;
  const tarefasAtrasadas = tarefas.filter(
    (t) => t.status !== 'concluida' && t.dataVencimento && t.dataVencimento < hoje
  ).length;

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setBuscaAberta((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function NavItem({ item }) {
    const ativo = tela === item.id;
    return (
      <button
        className={`app__nav-item ${ativo ? 'app__nav-item--ativo' : ''}`}
        onClick={() => setTela(item.id)}
      >
        <span className="app__nav-icon"><item.Icon /></span>
        {item.label}
        {item.id === 'kanban' && followUpCount > 0 && (
          <span className="app__nav-badge">{followUpCount}</span>
        )}
        {item.id === 'tarefas' && tarefasAtrasadas > 0 && (
          <span className="app__nav-badge app__nav-badge--perigo">{tarefasAtrasadas}</span>
        )}
      </button>
    );
  }

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="app__sidebar">
        <div className="app__sidebar-logo">
          <LogoMarca size={34} variant="full" />
        </div>

        {/* Zona rolável: nav + calendário */}
        <div className="app__sidebar-scroll">
          <nav className="app__nav">
            <span className="app__nav-section">Menu</span>
            {NAV_ITEMS_TOP.map((item) => <NavItem key={item.id} item={item} />)}
          </nav>

          {/* Busca global */}
          <div className="app__sidebar-busca">
            <button className="app__busca-btn" onClick={() => setBuscaAberta(true)}>
              <span className="app__busca-icon">⌕</span>
              <span className="app__busca-texto">Buscar lead</span>
              <kbd className="app__busca-kbd">⌘K</kbd>
            </button>
          </div>

          {/* Calendário lateral */}
          <SidebarCalendario />
        </div>

        {/* Configurações — sempre no rodapé */}
        <div className="app__sidebar-footer">
          <NavItem item={NAV_ITEM_CONFIG} />
          {usuario && (
            <div className="app__usuario">
              <span className="app__usuario-nome">👤 {usuario.nome}</span>
              <button className="app__logout" onClick={sair} title="Sair">
                ↪ Sair
              </button>
            </div>
          )}
          <p className="app__sidebar-empresa">CRM Interno · v1.0</p>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="app__main" key={tela}>
        {tela === 'dashboard'     && <Dashboard onNavegar={setTela} />}
        {tela === 'kanban'        && <KanbanBoard />}
        {tela === 'execucao'      && <FunilExecucao />}
        {tela === 'os'            && <OrdensServico />}
        {tela === 'clientes'      && <Clientes />}
        {tela === 'escala'        && <EscalaCampo />}
        {tela === 'relatorios'    && <Relatorios />}
        {tela === 'estoque'       && <Estoque />}
        {tela === 'agenda'        && <Agenda />}
        {tela === 'tarefas'       && <Tarefas />}
        {tela === 'configuracoes' && <Configuracoes />}
      </main>

      <ModalOrcamento />
      {buscaAberta && (
        <GlobalSearch onFechar={() => setBuscaAberta(false)} onNavegar={setTela} />
      )}
    </div>
  );
}

function AppGate({ fontScale }) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#6B7280', fontSize: 14 }}>
        Carregando...
      </div>
    );
  }

  if (!usuario) return <Login />;

  return (
    <CRMProvider>
      <div style={{ zoom: fontScale }}>
        <AppLayout />
      </div>
    </CRMProvider>
  );
}

export default function App() {
  const [fontScale, setFontScale] = useState(() =>
    parseFloat(localStorage.getItem('crm-font-scale') || '1')
  );

  useEffect(() => {
    function onScale(e) { setFontScale(e.detail); }
    window.addEventListener('crm-font-scale-change', onScale);
    return () => window.removeEventListener('crm-font-scale-change', onScale);
  }, []);

  return (
    <ToastProvider>
      <AuthProvider>
        <AppGate fontScale={fontScale} />
      </AuthProvider>
    </ToastProvider>
  );
}
