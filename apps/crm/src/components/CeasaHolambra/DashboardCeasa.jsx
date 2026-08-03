// src/components/CeasaHolambra/DashboardCeasa.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './DashboardCeasa.css';

const ETAPAS = [
  { id: 'prospecto',        label: 'Prospecto',             cor: '#6B7280' },
  { id: 'contato_feito',    label: 'Contato Feito',         cor: '#F59E0B' },
  { id: 'interesse',        label: 'Interesse Demonstrado', cor: '#3B82F6' },
  { id: 'proposta_enviada', label: 'Proposta Enviada',      cor: '#8B5CF6' },
  { id: 'fechado',          label: 'Fechado',               cor: '#10B981' },
  { id: 'sem_interesse',    label: 'Sem Interesse',         cor: '#EF4444' },
];

const TIPOS = ['atacadista', 'varejista', 'floricultura', 'outros'];

export default function DashboardCeasa() {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    supabase.from('ceasa_prospects').select('*').then(({ data }) => {
      setProspects(data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="dceasa__loading">Carregando...</div>;

  const total    = prospects.length;
  const fechados = prospects.filter(p => p.etapa === 'fechado').length;
  const ativos   = prospects.filter(p => !['fechado','sem_interesse'].includes(p.etapa)).length;
  const conversao = total > 0 ? Math.round((fechados / total) * 100) : 0;

  const porEtapa = ETAPAS.map(e => ({
    ...e,
    count: prospects.filter(p => p.etapa === e.id).length,
  }));

  const porTipo = TIPOS.map(t => ({
    label: t.charAt(0).toUpperCase() + t.slice(1),
    count: prospects.filter(p => p.tipo === t).length,
  })).filter(t => t.count > 0);

  return (
    <div className="dceasa">
      <div className="dceasa__header">
        <h2 className="dceasa__titulo">🌱 Ceasa / Holambra</h2>
        <p className="dceasa__sub">Visão geral da prospecção de lojas e distribuidores</p>
      </div>

      {/* KPIs */}
      <div className="dceasa__kpis">
        <div className="dceasa__kpi">
          <span className="dceasa__kpi-valor">{total}</span>
          <span className="dceasa__kpi-label">Total de Prospects</span>
        </div>
        <div className="dceasa__kpi">
          <span className="dceasa__kpi-valor">{ativos}</span>
          <span className="dceasa__kpi-label">Em Negociação</span>
        </div>
        <div className="dceasa__kpi dceasa__kpi--destaque">
          <span className="dceasa__kpi-valor">{fechados}</span>
          <span className="dceasa__kpi-label">Fechados</span>
        </div>
        <div className="dceasa__kpi">
          <span className="dceasa__kpi-valor">{conversao}%</span>
          <span className="dceasa__kpi-label">Taxa de Conversão</span>
        </div>
      </div>

      <div className="dceasa__grid">
        {/* Funil por etapa */}
        <div className="dceasa__card">
          <h3 className="dceasa__card-titulo">Funil de Prospecção</h3>
          <div className="dceasa__funil">
            {porEtapa.map(e => (
              <div key={e.id} className="dceasa__funil-linha">
                <div className="dceasa__funil-info">
                  <span className="dceasa__funil-dot" style={{ background: e.cor }} />
                  <span className="dceasa__funil-label">{e.label}</span>
                </div>
                <div className="dceasa__funil-barra-wrap">
                  <div
                    className="dceasa__funil-barra"
                    style={{
                      width: total > 0 ? `${(e.count / total) * 100}%` : '0%',
                      background: e.cor,
                    }}
                  />
                </div>
                <span className="dceasa__funil-count">{e.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Por tipo */}
        <div className="dceasa__card">
          <h3 className="dceasa__card-titulo">Por Tipo de Loja</h3>
          {porTipo.length === 0 ? (
            <p className="dceasa__vazio">Nenhum prospect cadastrado ainda.</p>
          ) : (
            <div className="dceasa__tipos">
              {porTipo.map(t => (
                <div key={t.label} className="dceasa__tipo-linha">
                  <span className="dceasa__tipo-label">{t.label}</span>
                  <span className="dceasa__tipo-count">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
