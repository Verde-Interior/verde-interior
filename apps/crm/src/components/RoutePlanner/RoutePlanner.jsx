// src/components/RoutePlanner/RoutePlanner.jsx
import { useState, useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import './RoutePlanner.css';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Gera os dias de visita do mês atual para uma frequência
function gerarDiasVisita(frequencia) {
  const hoje = new Date();
  const ano  = hoje.getFullYear();
  const mes  = hoje.getMonth();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const dias = [];

  if (frequencia === 'Semanal') {
    // Toda segunda-feira do mês
    for (let d = 1; d <= totalDias; d++) {
      const dt = new Date(ano, mes, d);
      if (dt.getDay() === 1) dias.push(d);
    }
  } else if (frequencia === 'Quinzenal') {
    // Dia 1 e dia 15
    dias.push(1, 15);
  } else {
    // Mensal: dia 1
    dias.push(1);
  }
  return dias;
}

export default function RoutePlanner() {
  const { clientesAtivos, TIPOS_SERVICO, FREQUENCIAS_VISITA } = useCRM();

  const [filtroBairro, setFiltroBairro]         = useState('Todos');
  const [filtroFrequencia, setFiltroFrequencia] = useState('Todas');

  // Lista de bairros únicos dos clientes ativos
  const bairros = useMemo(() => {
    const set = new Set(clientesAtivos.map((c) => c.bairro).filter(Boolean));
    return ['Todos', ...Array.from(set).sort()];
  }, [clientesAtivos]);

  // Clientes filtrados
  const clientesFiltrados = useMemo(() => {
    return clientesAtivos.filter((c) => {
      const okBairro = filtroBairro === 'Todos' || c.bairro === filtroBairro;
      const okFreq   = filtroFrequencia === 'Todas' || c.frequenciaVisita === filtroFrequencia;
      return okBairro && okFreq;
    });
  }, [clientesAtivos, filtroBairro, filtroFrequencia]);

  // Agrupa por bairro
  const grupos = useMemo(() => {
    const map = {};
    clientesFiltrados.forEach((c) => {
      const b = c.bairro ?? 'Sem bairro';
      if (!map[b]) map[b] = [];
      map[b].push(c);
    });
    // Ordena cada grupo por frequência (Semanal primeiro)
    const ordem = { Semanal: 0, Quinzenal: 1, Mensal: 2 };
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (ordem[a.frequenciaVisita] ?? 9) - (ordem[b.frequenciaVisita] ?? 9))
    );
    return map;
  }, [clientesFiltrados]);

  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  function exportarRoteiro() {
    const cabecalho = `📋 *ROTEIRO DE VISITAS — ${mesAtual.toUpperCase()}*\n`;
    const separador = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    let texto = cabecalho + separador + '\n';

    Object.entries(grupos).forEach(([bairro, clientes]) => {
      texto += `📍 *${bairro}* (${clientes.length} cliente${clientes.length !== 1 ? 's' : ''})\n`;
      clientes.forEach((c) => {
        const dias = gerarDiasVisita(c.frequenciaVisita);
        texto += `• *${c.empresa}* — ${c.frequenciaVisita}\n`;
        texto += `  Dias: ${dias.join(', ')} | 🪴 ${c.quantidadeVasos} vasos\n`;
        if (c.endereco) texto += `  ${c.endereco}\n`;
        texto += `  📞 ${c.telefone}\n`;
      });
      texto += '\n';
    });

    texto += separador;
    texto += `_Gerado em ${new Date().toLocaleDateString('pt-BR')} via Verde Interior CRM_`;
    navigator.clipboard.writeText(texto).then(() => alert('Roteiro copiado! Cole no WhatsApp da equipe.'));
  }

  function imprimirPDF() {
    window.print();
  }

  const COR_FREQ = { Semanal: '#8B5CF6', Quinzenal: '#3B82F6', Mensal: '#10B981' };

  return (
    <div className="route-planner">
      {/* ── Cabeçalho ── */}
      <header className="route-planner__header">
        <div>
          <h2 className="route-planner__titulo">Roteirizador de Visitas</h2>
          <p className="route-planner__subtitulo">
            Escala de campo · {mesAtual} · {clientesFiltrados.length} cliente
            {clientesFiltrados.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Exportar */}
        <div className="route-planner__export-group">
          <button className="route-planner__btn-export" onClick={exportarRoteiro}>
            📋 Copiar para WhatsApp
          </button>
          <button className="route-planner__btn-print" onClick={imprimirPDF}>
            🖨️ Imprimir PDF
          </button>
        </div>

        {/* Filtros */}
        <div className="route-planner__filtros">
          <div className="route-planner__filtro-grupo">
            <label className="route-planner__filtro-label">Bairro</label>
            <select
              className="route-planner__select"
              value={filtroBairro}
              onChange={(e) => setFiltroBairro(e.target.value)}
            >
              {bairros.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>

          <div className="route-planner__filtro-grupo">
            <label className="route-planner__filtro-label">Frequência</label>
            <select
              className="route-planner__select"
              value={filtroFrequencia}
              onChange={(e) => setFiltroFrequencia(e.target.value)}
            >
              <option>Todas</option>
              {FREQUENCIAS_VISITA.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* ── Conteúdo ── */}
      <div className="route-planner__corpo">
        {Object.keys(grupos).length === 0 ? (
          <p className="route-planner__vazio">
            Nenhum cliente ativo encontrado para os filtros selecionados.
          </p>
        ) : (
          Object.entries(grupos).map(([bairro, clientes]) => (
            <section key={bairro} className="route-planner__grupo">
              <h3 className="route-planner__grupo-titulo">
                📍 {bairro}
                <span className="route-planner__grupo-count">{clientes.length}</span>
              </h3>

              <div className="route-planner__cards">
                {clientes.map((cliente) => {
                  const servico   = TIPOS_SERVICO[cliente.tipoServico];
                  const diasVisita = gerarDiasVisita(cliente.frequenciaVisita);
                  const corFreq   = COR_FREQ[cliente.frequenciaVisita] ?? '#6B7280';

                  return (
                    <div key={cliente.id} className="route-card">
                      {/* Frequência badge */}
                      <span
                        className="route-card__freq"
                        style={{ '--freq-cor': corFreq }}
                      >
                        {cliente.frequenciaVisita}
                      </span>

                      {/* Info principal */}
                      <p className="route-card__empresa">{cliente.empresa}</p>
                      <p className="route-card__contato">{cliente.contato}</p>
                      <p className="route-card__endereco">{cliente.endereco}</p>

                      {/* Serviço */}
                      <span
                        className="route-card__servico"
                        style={{ '--svc-cor': servico?.cor ?? '#6B7280' }}
                      >
                        {servico?.label}
                      </span>

                      {/* Vasos */}
                      <p className="route-card__vasos">🪴 {cliente.quantidadeVasos} vasos</p>

                      {/* Dias de visita do mês */}
                      <div className="route-card__calendario">
                        <p className="route-card__calendario-titulo">Dias de visita este mês:</p>
                        <div className="route-card__dias">
                          {diasVisita.map((dia) => {
                            const dt      = new Date(new Date().getFullYear(), new Date().getMonth(), dia);
                            const semana  = DIAS_SEMANA[dt.getDay()];
                            const isHoje  = dia === new Date().getDate();
                            return (
                              <span
                                key={dia}
                                className={`route-card__dia ${isHoje ? 'route-card__dia--hoje' : ''}`}
                                title={`${semana}, dia ${dia}`}
                                style={isHoje ? { '--freq-cor': corFreq } : {}}
                              >
                                {dia}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Contato rápido */}
                      <a
                        href={`tel:${cliente.telefone}`}
                        className="route-card__telefone"
                      >
                        📞 {cliente.telefone}
                      </a>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
