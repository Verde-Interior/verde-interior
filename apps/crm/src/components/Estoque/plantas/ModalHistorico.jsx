// src/components/Estoque/plantas/ModalHistorico.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

const TIPO_LABEL = {
  cadastro:         'Cadastro',
  entrada:          'Entrada',
  saida:            'Saída',
  instalacao:       'Instalação',
  retirada:         'Retirada',
  evento_inicio:    'Saída para evento',
  evento_fim:       'Retorno de evento',
  troca_especie:    'Troca de espécie',
  manutencao_inicio:'Início de recuperação',
  manutencao_fim:   'Fim de recuperação',
  descarte:         'Descarte',
  transferencia:    'Transferência',
  observacao:       'Observação',
};

const TIPO_ICON = {
  cadastro:         '🌱',
  instalacao:       '📍',
  retirada:         '↩',
  evento_inicio:    '🎉',
  evento_fim:       '↩',
  troca_especie:    '🔄',
  manutencao_inicio:'🔧',
  manutencao_fim:   '✅',
  descarte:         '🗑',
  observacao:       '💬',
  entrada:          '⬇',
  saida:            '⬆',
  transferencia:    '➡',
};

function formatData(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ModalHistorico({ patrimonio, onFechar }) {
  const [eventos,  setEventos]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('estoque_eventos')
      .select(`
        id, tipo, observacoes, criado_em, dados_extra,
        employees:funcionario_id ( name ),
        clientes:cliente_id ( nome_empresa ),
        especie_anterior:especie_anterior_id ( nome ),
        especie_nova:especie_nova_id ( nome )
      `)
      .eq('patrimonio_id', patrimonio.id)
      .order('criado_em', { ascending: false })
      .then(({ data }) => { setEventos(data ?? []); setLoading(false); });
  }, [patrimonio.id]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal modal--largo">
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">Histórico — {patrimonio.qr_codigo}</h2>
            <p className="modal__subinfo">{patrimonio.especie_nome}</p>
          </div>
          <button className="modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="modal__body">
          {loading ? (
            <div className="es__estado"><div className="es__spinner" /></div>
          ) : eventos.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
              Nenhum evento registrado.
            </p>
          ) : (
            <div className="ep-timeline">
              {eventos.map(ev => (
                <div key={ev.id} className="ep-timeline__item">
                  <div className="ep-timeline__icon">{TIPO_ICON[ev.tipo] ?? '•'}</div>
                  <div className="ep-timeline__corpo">
                    <div className="ep-timeline__topo">
                      <span className="ep-timeline__tipo">{TIPO_LABEL[ev.tipo] ?? ev.tipo}</span>
                      <span className="ep-timeline__data">{formatData(ev.criado_em)}</span>
                    </div>
                    {ev.clientes?.nome_empresa && (
                      <div className="ep-timeline__detalhe">📍 {ev.clientes.nome_empresa}</div>
                    )}
                    {ev.especie_anterior?.nome && ev.especie_nova?.nome && (
                      <div className="ep-timeline__detalhe">
                        {ev.especie_anterior.nome} → {ev.especie_nova.nome}
                      </div>
                    )}
                    {ev.dados_extra?.tipo_manutencao && (
                      <div className="ep-timeline__detalhe">Tipo: {ev.dados_extra.tipo_manutencao}</div>
                    )}
                    {ev.observacoes && (
                      <div className="ep-timeline__obs">{ev.observacoes}</div>
                    )}
                    {ev.employees?.name && (
                      <div className="ep-timeline__func">por {ev.employees.name}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="modal__footer" style={{ justifyContent: 'flex-end' }}>
          <button className="modal__btn modal__btn--cancelar" onClick={onFechar}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
