// src/components/EscalaCampo/ModalRelatorioVisita.jsx
// Abre o relatório de uma visita a partir da Escala. Busca o relatório pelo
// agendamento e delega a visualização pro mesmo DetalheRelatorio usado em
// Relatórios — antes essa tela tinha sua própria versão simplificada, que
// foi divergindo (sem resumo, sem endereço/localização, sem "remover
// relatório"). Agora é a mesma visualização nos dois lugares.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import DetalheRelatorio, { SELECT_RELATORIO } from '../Relatorios/DetalheRelatorio';
import '../Relatorios/Relatorios.css';

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00');
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ModalRelatorioVisita({ visita, funcNome, onFechar, onRemovido }) {
  const [relatorio, setRelatorio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const overlayClose = useOverlayClose(onFechar);

  useEffect(() => {
    if (!visita?.id) return;
    let cancelado = false;
    (async () => {
      setLoading(true);
      setErro(null);
      const { data, error } = await supabase
        .from('relatorios')
        .select(SELECT_RELATORIO)
        .eq('agendamento_id', visita.id)
        .order('checkin_at', { ascending: false })
        .limit(1);
      if (cancelado) return;
      if (error) setErro(error.message);
      else setRelatorio(data?.[0] ?? null);
      setLoading(false);
    })();
    return () => { cancelado = true; };
  }, [visita?.id]);

  if (!loading && !erro && relatorio) {
    return (
      <DetalheRelatorio
        relatorio={relatorio}
        funcNome={funcNome}
        onFechar={onFechar}
        onRemovido={onRemovido}
      />
    );
  }

  const nomeCliente = visita.clientes?.nome_empresa ?? '—';

  return (
    <div className="rel-overlay" {...overlayClose}>
      <div className="rel-modal">
        <header className="rel-modal__header">
          <div>
            <h3 className="rel-modal__titulo">{nomeCliente}</h3>
            <p className="rel-modal__sub">{formatarData(visita.data_agendada)} · {funcNome}</p>
          </div>
          <button className="rel-modal__fechar" onClick={onFechar}>✕</button>
        </header>
        <div className="rel-modal__corpo">
          {loading && <p className="rel-hint">Carregando relatório...</p>}
          {erro && <p className="rel-hint">Erro ao carregar: {erro}</p>}
          {!loading && !erro && !relatorio && (
            <div className="rel-sec">
              <p>⏳ Este relatório ainda não foi iniciado pelo colaborador em campo.</p>
              <p className="rel-hint">Assim que ele fizer check-in no App Ponto, o relatório aparece aqui.</p>
            </div>
          )}
        </div>
        <footer className="rel-modal__footer">
          <button className="rel-btn" onClick={onFechar}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
