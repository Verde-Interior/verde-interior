// src/components/Configuracoes/Configuracoes.jsx
import { useState, useEffect } from 'react';
import { useCRM } from '../../context/CRMContext';
import './Configuracoes.css';

const ESCALAS = [
  { id: 'pequena', label: 'Pequena', valor: 0.88, px: 11 },
  { id: 'media',   label: 'Média',   valor: 1.00, px: 14 },
  { id: 'grande',  label: 'Grande',  valor: 1.10, px: 17 },
  { id: 'xlarge',  label: 'Extra',   valor: 1.20, px: 20 },
];

const CANAIS = ['WhatsApp', 'E-mail', 'Telefone', 'Indicação'];

const ATALHOS = [
  { tecla: '⌘ K',    desc: 'Busca global de leads' },
  { tecla: 'Esc',    desc: 'Fechar modal / painel aberto' },
  { tecla: 'Enter',  desc: 'Confirmar formulário no modal' },
  { tecla: '← →',   desc: 'Navegar entre colunas do Pipeline' },
];

function Toggle({ ligado, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={ligado}
      className={`config__toggle ${ligado ? 'config__toggle--on' : ''}`}
      onClick={() => onChange(!ligado)}
    >
      <span className="config__toggle-thumb" />
    </button>
  );
}

export default function Configuracoes() {
  const { leads, tarefas } = useCRM();

  // ── Aparência ──────────────────────────────────────────────────────────────
  const [escalaId, setEscalaId] = useState(
    () => localStorage.getItem('crm-font-scale-id') || 'media'
  );

  function aplicarEscala(id) {
    const e = ESCALAS.find((x) => x.id === id);
    if (!e) return;
    setEscalaId(id);
    localStorage.setItem('crm-font-scale-id', id);
    localStorage.setItem('crm-font-scale', String(e.valor));
    window.dispatchEvent(new CustomEvent('crm-font-scale-change', { detail: e.valor }));
  }

  // ── Perfil ─────────────────────────────────────────────────────────────────
  const [nomeUsuario, setNomeUsuario] = useState(
    () => localStorage.getItem('crm-nome-usuario') || ''
  );
  const [nomeSalvo, setNomeSalvo] = useState(false);

  function salvarNome() {
    localStorage.setItem('crm-nome-usuario', nomeUsuario.trim());
    window.dispatchEvent(new CustomEvent('crm-nome-usuario-change', { detail: nomeUsuario.trim() }));
    setNomeSalvo(true);
    setTimeout(() => setNomeSalvo(false), 2000);
  }

  // ── Notificações ───────────────────────────────────────────────────────────
  const [notifFollowUp, setNotifFollowUp] = useState(
    () => localStorage.getItem('crm-notif-followup') !== 'false'
  );
  const [notifTarefas, setNotifTarefas] = useState(
    () => localStorage.getItem('crm-notif-tarefas') !== 'false'
  );

  useEffect(() => {
    localStorage.setItem('crm-notif-followup', String(notifFollowUp));
  }, [notifFollowUp]);

  useEffect(() => {
    localStorage.setItem('crm-notif-tarefas', String(notifTarefas));
  }, [notifTarefas]);

  // ── Metas por categoria ───────────────────────────────────────────────────
  const CATEGORIAS_META = [
    { id: 'carteira',          label: 'Contratos Recorrentes (Carteira)', desc: 'Manutenção e Locação recorrentes' },
    { id: 'manutencaoPontual', label: 'Manutenção Pontual',              desc: 'Serviços avulsos de manutenção' },
    { id: 'vendas',            label: 'Vendas',                          desc: 'Venda de vasos e plantas' },
    { id: 'reformas',          label: 'Reformas',                        desc: 'Reforma de vasos e plantas' },
    { id: 'eventos',           label: 'Eventos',                         desc: 'Locação para eventos' },
  ];

  const [metas, setMetas] = useState(() => {
    try {
      const s = localStorage.getItem('crm-metas');
      if (s) return JSON.parse(s);
    } catch {}
    return {};
  });
  const [metasSalvas, setMetasSalvas] = useState(false);

  function setMeta(id, valor) {
    setMetas((prev) => ({ ...prev, [id]: valor }));
  }

  function salvarMetas() {
    const parsed = {};
    for (const [k, v] of Object.entries(metas)) {
      parsed[k] = Number(v) || 0;
    }
    localStorage.setItem('crm-metas', JSON.stringify(parsed));
    window.dispatchEvent(new CustomEvent('crm-metas-change', { detail: parsed }));
    setMetasSalvas(true);
    setTimeout(() => setMetasSalvas(false), 2000);
  }

  // ── Pipeline ───────────────────────────────────────────────────────────────
  const [canalPadrao, setCanalPadrao] = useState(
    () => localStorage.getItem('crm-canal-padrao') || 'WhatsApp'
  );

  useEffect(() => {
    localStorage.setItem('crm-canal-padrao', canalPadrao);
  }, [canalPadrao]);

  // ── Dados ──────────────────────────────────────────────────────────────────
  const [confirmLimpar, setConfirmLimpar] = useState(false);

  function exportarDados() {
    const dados = { exportadoEm: new Date().toISOString(), versao: '1.0', leads, tarefas };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `crm-verde-interior-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetarDashboard() {
    localStorage.removeItem('crm-verde-dashboard-ordem');
    window.dispatchEvent(new CustomEvent('crm-dashboard-reset-ordem'));
  }

  return (
    <div className="config">
      <header className="config__header">
        <div>
          <h1 className="config__titulo">Configurações</h1>
          <p className="config__sub">Personalize sua experiência no CRM</p>
        </div>
        <div className="config__header-stats">
          <div className="config__stat">
            <span className="config__stat-valor">{leads.length}</span>
            <span className="config__stat-label">Leads</span>
          </div>
          <div className="config__stat">
            <span className="config__stat-valor">{tarefas.length}</span>
            <span className="config__stat-label">Tarefas</span>
          </div>
          <div className="config__stat">
            <span className="config__stat-valor">v1.0</span>
            <span className="config__stat-label">Versão</span>
          </div>
        </div>
      </header>

      <div className="config__corpo">
        <div className="config__grid">

          {/* ── COL ESQUERDA ── */}
          <div className="config__col">

            {/* Perfil */}
            <section className="config__card">
              <h2 className="config__card-titulo">Perfil</h2>

              <div className="config__linha">
                <div className="config__linha-info">
                  <span className="config__linha-label">Seu nome</span>
                  <span className="config__linha-desc">Exibido na saudação do Dashboard</span>
                </div>
                <div className="config__linha-controle config__linha-controle--row">
                  <input
                    className="config__input"
                    placeholder="Ex: Fernanda"
                    value={nomeUsuario}
                    onChange={(e) => setNomeUsuario(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && salvarNome()}
                    maxLength={40}
                  />
                  <button
                    className={`config__btn ${nomeSalvo ? 'config__btn--salvo' : 'config__btn--primary'}`}
                    onClick={salvarNome}
                  >
                    {nomeSalvo ? '✓ Salvo' : 'Salvar'}
                  </button>
                </div>
              </div>
            </section>

            {/* Aparência */}
            <section className="config__card">
              <h2 className="config__card-titulo">Aparência</h2>

              <div className="config__linha config__linha--col">
                <div className="config__linha-info">
                  <span className="config__linha-label">Tamanho da fonte</span>
                  <span className="config__linha-desc">Ajusta o zoom de toda a interface</span>
                </div>
                <div className="config__fonte-grid">
                  {ESCALAS.map((e) => (
                    <button
                      key={e.id}
                      className={`config__fonte-btn ${escalaId === e.id ? 'config__fonte-btn--ativo' : ''}`}
                      onClick={() => aplicarEscala(e.id)}
                    >
                      <span className="config__fonte-a" style={{ fontSize: e.px }}>A</span>
                      <span className="config__fonte-nome">{e.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Metas */}
            <section className="config__card">
              <h2 className="config__card-titulo">Metas Mensais</h2>
              <p className="config__card-desc">Exibidas como barras de progresso no Dashboard · Deixe em branco para não exibir</p>

              {CATEGORIAS_META.map((cat) => (
                <div key={cat.id} className="config__linha">
                  <div className="config__linha-info">
                    <span className="config__linha-label">{cat.label}</span>
                    <span className="config__linha-desc">{cat.desc}</span>
                  </div>
                  <div className="config__linha-controle config__linha-controle--row">
                    <span className="config__input-prefix">R$</span>
                    <input
                      className="config__input config__input--meta"
                      type="number"
                      min={0}
                      placeholder="0"
                      value={metas[cat.id] ?? ''}
                      onChange={(e) => setMeta(cat.id, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && salvarMetas()}
                    />
                  </div>
                </div>
              ))}

              <div className="config__metas-footer">
                <button
                  className={`config__btn ${metasSalvas ? 'config__btn--salvo' : 'config__btn--primary'}`}
                  onClick={salvarMetas}
                >
                  {metasSalvas ? '✓ Salvo' : 'Salvar Metas'}
                </button>
              </div>
            </section>

            {/* Notificações */}
            <section className="config__card">
              <h2 className="config__card-titulo">Notificações</h2>

              <div className="config__linha">
                <div className="config__linha-info">
                  <span className="config__linha-label">Alertas de Follow-up</span>
                  <span className="config__linha-desc">Badge e aviso no Pipeline quando há follow-ups vencidos</span>
                </div>
                <Toggle ligado={notifFollowUp} onChange={setNotifFollowUp} />
              </div>

              <div className="config__linha">
                <div className="config__linha-info">
                  <span className="config__linha-label">Alertas de Tarefas</span>
                  <span className="config__linha-desc">Badge vermelho em Tarefas quando há itens atrasados</span>
                </div>
                <Toggle ligado={notifTarefas} onChange={setNotifTarefas} />
              </div>
            </section>

          </div>

          {/* ── COL DIREITA ── */}
          <div className="config__col">

            {/* Pipeline */}
            <section className="config__card">
              <h2 className="config__card-titulo">Pipeline</h2>

              <div className="config__linha">
                <div className="config__linha-info">
                  <span className="config__linha-label">Canal de entrada padrão</span>
                  <span className="config__linha-desc">Pré-selecionado ao adicionar novo lead</span>
                </div>
                <div className="config__canais">
                  {CANAIS.map((c) => (
                    <button
                      key={c}
                      className={`config__canal-btn ${canalPadrao === c ? 'config__canal-btn--ativo' : ''}`}
                      onClick={() => setCanalPadrao(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Dashboard */}
            <section className="config__card">
              <h2 className="config__card-titulo">Dashboard</h2>

              <div className="config__linha">
                <div className="config__linha-info">
                  <span className="config__linha-label">Reorganizar painéis</span>
                  <span className="config__linha-desc">Arraste os painéis pelo ícone ⠿ para reordená-los</span>
                </div>
              </div>

              <div className="config__linha">
                <div className="config__linha-info">
                  <span className="config__linha-label">Restaurar ordem original</span>
                  <span className="config__linha-desc">Volta os painéis para a disposição padrão</span>
                </div>
                <button className="config__btn config__btn--outline" onClick={resetarDashboard}>
                  Restaurar
                </button>
              </div>
            </section>

            {/* Atalhos */}
            <section className="config__card">
              <h2 className="config__card-titulo">Atalhos de Teclado</h2>
              <div className="config__atalhos">
                {ATALHOS.map((a) => (
                  <div key={a.tecla} className="config__atalho">
                    <span className="config__atalho-desc">{a.desc}</span>
                    <kbd className="config__atalho-kbd">{a.tecla}</kbd>
                  </div>
                ))}
              </div>
            </section>

            {/* Dados */}
            <section className="config__card">
              <h2 className="config__card-titulo">Dados</h2>

              <div className="config__linha">
                <div className="config__linha-info">
                  <span className="config__linha-label">Exportar backup</span>
                  <span className="config__linha-desc">Todos os leads e tarefas em formato JSON</span>
                </div>
                <button className="config__btn config__btn--primary" onClick={exportarDados}>
                  ↓ Exportar
                </button>
              </div>

              <div className="config__linha">
                <div className="config__linha-info">
                  <span className="config__linha-label">Limpar todos os dados</span>
                  <span className="config__linha-desc config__linha-desc--perigo">
                    Remove permanentemente todos os leads e tarefas
                  </span>
                </div>
                {!confirmLimpar ? (
                  <button className="config__btn config__btn--danger-outline" onClick={() => setConfirmLimpar(true)}>
                    Limpar
                  </button>
                ) : (
                  <div className="config__confirm">
                    <span className="config__confirm-texto">Tem certeza?</span>
                    <button
                      className="config__btn config__btn--danger"
                      onClick={() => {
                        localStorage.clear();
                        window.location.reload();
                      }}
                    >
                      Confirmar
                    </button>
                    <button className="config__btn config__btn--outline" onClick={() => setConfirmLimpar(false)}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
