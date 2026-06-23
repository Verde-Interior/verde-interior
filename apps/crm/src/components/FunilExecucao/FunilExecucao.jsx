// src/components/FunilExecucao/FunilExecucao.jsx
import { useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import './FunilExecucao.css';

const ICONE_SERVICO = {
  venda: '🛒', manutencao: '🔧', reforma: '🔨', locacao: '🌿', locacao_evento: '🎪',
};

function formatarValor(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v ?? 0);
}

function formatarData(iso) {
  if (!iso) return null;
  return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function FunilExecucao() {
  const { leads, ESTAGIOS_EXECUCAO, TIPOS_SERVICO, moverFunilExecucao, abrirModal, dragLeadId, setDragLeadId } = useCRM();

  const leadsAprovados = useMemo(
    () => leads.filter((l) => l.estagioId === 'orcamento_aprovado'),
    [leads]
  );

  const total = leadsAprovados.length;
  const valorTotal = leadsAprovados.reduce((s, l) => s + (l.valorEstimado ?? 0), 0);

  function handleDragStart(e, leadId) {
    setDragLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('leadId', leadId);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e, etapaId) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    if (leadId) moverFunilExecucao(leadId, etapaId);
    setDragLeadId(null);
  }

  function handleDragEnd() {
    setDragLeadId(null);
  }

  return (
    <div className="funil-exec">
      {/* Header */}
      <header className="funil-exec__header">
        <div>
          <h1 className="funil-exec__titulo">Funil de Execução</h1>
          <p className="funil-exec__subtitulo">
            {total} projeto{total !== 1 ? 's' : ''} em andamento · {formatarValor(valorTotal)} em contratos
          </p>
        </div>
      </header>

      {/* Kanban */}
      <div className="funil-exec__kanban">
        {ESTAGIOS_EXECUCAO.map((etapa) => {
          const cards = leadsAprovados.filter((l) => (l.funilExecucao?.etapa ?? 'materiais') === etapa.id);

          return (
            <div
              key={etapa.id}
              className="funil-exec__coluna"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, etapa.id)}
            >
              {/* Cabeçalho da coluna */}
              <div className="funil-exec__col-header" style={{ '--etapa-cor': etapa.cor }}>
                <span className="funil-exec__col-titulo">{etapa.label}</span>
                <span className="funil-exec__col-count">{cards.length}</span>
              </div>

              {/* Cards */}
              <div className="funil-exec__cards">
                {cards.length === 0 && (
                  <div className="funil-exec__vazio">Nenhum projeto nesta etapa</div>
                )}
                {cards.map((lead) => {
                  const servico = TIPOS_SERVICO[lead.tipoServico];
                  const isDragging = dragLeadId === lead.id;

                  return (
                    <article
                      key={lead.id}
                      className={`funil-exec__card ${isDragging ? 'funil-exec__card--dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => abrirModal(lead)}
                    >
                      <header className="funil-exec__card-header">
                        <span className="funil-exec__card-empresa">{lead.empresa}</span>
                        <span className="funil-exec__card-icone">{ICONE_SERVICO[lead.tipoServico] ?? '🌿'}</span>
                      </header>
                      <p className="funil-exec__card-contato">{lead.contato}</p>
                      <div className="funil-exec__card-meta">
                        <span className="funil-exec__card-badge" style={{ '--badge-cor': servico?.cor ?? '#6B7280' }}>
                          {servico?.label ?? lead.tipoServico}
                        </span>
                      </div>
                      <footer className="funil-exec__card-footer">
                        <span className="funil-exec__card-bairro">📍 {lead.bairro}</span>
                        <span className="funil-exec__card-valor">{formatarValor(lead.valorEstimado)}</span>
                      </footer>
                      {lead.visitas?.length > 0 && (
                        <div className="funil-exec__card-visitas">
                          {lead.visitas.filter((v) => v.data).map((v, i) => (
                            <span key={i} className="funil-exec__card-visita-data">
                              🗓 {formatarData(v.data)}{v.obs ? ` · ${v.obs}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      {lead.funilExecucao?.dataInicio && (
                        <p className="funil-exec__card-inicio">
                          Iniciou execução: {formatarData(lead.funilExecucao.dataInicio)}
                        </p>
                      )}

                      {/* Ações rápidas de avanço */}
                      <div className="funil-exec__card-acoes" onClick={(e) => e.stopPropagation()}>
                        {ESTAGIOS_EXECUCAO.findIndex((e) => e.id === etapa.id) < ESTAGIOS_EXECUCAO.length - 1 && (
                          <button
                            className="funil-exec__card-btn-avancar"
                            onClick={() => {
                              const idx = ESTAGIOS_EXECUCAO.findIndex((e) => e.id === etapa.id);
                              if (idx < ESTAGIOS_EXECUCAO.length - 1) {
                                moverFunilExecucao(lead.id, ESTAGIOS_EXECUCAO[idx + 1].id);
                              }
                            }}
                          >
                            Avançar →
                          </button>
                        )}
                        {etapa.id === 'pos_venda' && (
                          <span className="funil-exec__card-final">✅ Projeto concluído</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
