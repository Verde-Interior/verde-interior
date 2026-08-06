// src/components/ModalDetalhesCliente/ModalDetalhesCliente.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import { formatarMoeda } from '../../utils/formatUtils';
import { geocodeEndereco } from '../../utils/geoUtils';
import { useToast } from '../Toast/Toast';
import { DIAS_SEMANA, TIPO_LABEL, FREQ_LABEL, FREQ_VISITA_LABEL } from '../../utils/clienteConstants';
import './ModalDetalhesCliente.css';

function telefoneLimpo(tel) {
  return (tel ?? '').replace(/\D/g, '');
}

// Visão somente-leitura do cadastro completo de um cliente, usada em telas
// que não podem navegar pra fora de si mesmas pra mostrar o cadastro (ex:
// Mapa, que perderia os markers/estado do Leaflet numa troca de tela).
// Edição de verdade continua só em Clientes — o botão "Editar" navega pra lá.
export default function ModalDetalhesCliente({ clienteId, onFechar, onEditar }) {
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);
  const [recalculando, setRecalculando] = useState(false);
  const toast = useToast();

  async function recalcularCoordenadas() {
    if (!cliente?.endereco?.trim()) {
      toast.erro('Cliente sem endereço cadastrado');
      return;
    }
    setRecalculando(true);
    try {
      const r = await geocodeEndereco({ endereco: cliente.endereco, bairro: cliente.bairro });
      if (!r) {
        toast.erro('Endereço não encontrado na geocodificação');
        return;
      }
      const { error } = await supabase
        .from('clientes')
        .update({ lat: r.lat, lng: r.lng })
        .eq('id', clienteId);
      if (error) throw error;
      setCliente((prev) => ({ ...prev, lat: r.lat, lng: r.lng }));
      toast.ok('Coordenadas recalculadas');
    } catch (e) {
      toast.erro('Erro ao recalcular: ' + e.message);
    } finally {
      setRecalculando(false);
    }
  }

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      setErro(null);
      const { data, error } = await supabase
        .from('clientes')
        .select('*, cliente_servicos(*)')
        .eq('id', clienteId)
        .single();
      if (cancelado) return;
      if (error) setErro(error.message);
      else setCliente(data);
      setLoading(false);
    })();
    return () => { cancelado = true; };
  }, [clienteId]);

  const overlayClose = useOverlayClose(onFechar);
  const tel = telefoneLimpo(cliente?.contato_telefone);
  const diasLabels = (cliente?.dias_disponiveis ?? []).map((d) => DIAS_SEMANA.find((x) => x.id === d)?.label ?? d);
  const servicosAtivos = (cliente?.cliente_servicos ?? []).filter((s) => s.ativo);

  return (
    <div className="mdc-overlay" {...overlayClose}>
      <div className="mdc-modal">
        <header className="mdc-modal__header">
          <div>
            <h3 className="mdc-modal__titulo">{cliente?.nome_empresa ?? 'Cliente'}</h3>
            {cliente?.grupo_servico && <p className="mdc-modal__sub">{cliente.grupo_servico}</p>}
          </div>
          <button className="mdc-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="mdc-modal__corpo">
          {loading ? (
            <div className="mdc-estado">Carregando...</div>
          ) : erro ? (
            <div className="mdc-estado mdc-estado--erro">Erro ao carregar: {erro}</div>
          ) : (
            <>
              <section className="mdc-sec">
                <h4 className="mdc-sec__titulo">Contato</h4>
                <div className="mdc-info">
                  {cliente.contato_nome && <div><strong>{cliente.contato_nome}</strong></div>}
                  {cliente.contato_telefone && <div className="mdc-hint">{cliente.contato_telefone}</div>}
                  {cliente.contato_email && <div className="mdc-hint">{cliente.contato_email}</div>}
                  {!cliente.contato_nome && !cliente.contato_telefone && !cliente.contato_email && (
                    <div className="mdc-hint">Nenhum contato cadastrado.</div>
                  )}
                  {tel && (
                    <div className="mdc-acoes">
                      <a href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
                      <a href={`tel:${tel}`}>📞 Ligar</a>
                    </div>
                  )}
                </div>
              </section>

              <section className="mdc-sec">
                <div className="mdc-sec__titulo-row">
                  <h4 className="mdc-sec__titulo">Endereço</h4>
                  <button
                    className="mdc-sec__pin"
                    onClick={recalcularCoordenadas}
                    disabled={recalculando}
                    title="Recalcular coordenadas a partir do endereço"
                  >
                    {recalculando ? '...' : '📍'}
                  </button>
                </div>
                <div className="mdc-info">
                  <div>{cliente.endereco || '—'}{cliente.complemento ? ` — ${cliente.complemento}` : ''}</div>
                  {(cliente.bairro || cliente.regiao) && (
                    <div className="mdc-hint">
                      {[cliente.bairro, cliente.regiao].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </section>

              <section className="mdc-sec">
                <h4 className="mdc-sec__titulo">Cadastro</h4>
                <div className="mdc-grid">
                  <div className="mdc-mc"><div className="mdc-mc__lbl">CNPJ</div><div className="mdc-mc__val">{cliente.cnpj || '—'}</div></div>
                  <div className="mdc-mc"><div className="mdc-mc__lbl">Razão Social</div><div className="mdc-mc__val">{cliente.razao_social || '—'}</div></div>
                  <div className="mdc-mc"><div className="mdc-mc__lbl">Status</div><div className="mdc-mc__val">{cliente.ativo ? 'Ativo' : 'Inativo'}</div></div>
                  <div className="mdc-mc"><div className="mdc-mc__lbl">Orquídea</div><div className="mdc-mc__val">{cliente.tem_orquidea ? '🌸 Sim' : 'Não'}</div></div>
                </div>
              </section>

              <section className="mdc-sec">
                <h4 className="mdc-sec__titulo">Disponibilidade</h4>
                <div className="mdc-grid">
                  <div className="mdc-mc"><div className="mdc-mc__lbl">Dias</div><div className="mdc-mc__val">{diasLabels.length ? diasLabels.join(', ') : '—'}</div></div>
                  <div className="mdc-mc">
                    <div className="mdc-mc__lbl">Janela</div>
                    <div className="mdc-mc__val">
                      {cliente.janela_entrada_inicio ? `${cliente.janela_entrada_inicio.slice(0, 5)}–${cliente.janela_entrada_fim?.slice(0, 5) ?? '?'}` : '—'}
                    </div>
                  </div>
                  <div className="mdc-mc"><div className="mdc-mc__lbl">Duração</div><div className="mdc-mc__val">{cliente.duracao_estimada_min ? `${cliente.duracao_estimada_min} min` : '—'}</div></div>
                  <div className="mdc-mc"><div className="mdc-mc__lbl">Frequência</div><div className="mdc-mc__val">{FREQ_VISITA_LABEL[cliente.frequencia_visita] ?? cliente.frequencia_visita ?? '—'}</div></div>
                </div>
              </section>

              <section className="mdc-sec">
                <h4 className="mdc-sec__titulo">
                  Contratos de Serviço{servicosAtivos.length > 0 && ` (${servicosAtivos.length} ativo${servicosAtivos.length !== 1 ? 's' : ''})`}
                </h4>
                {servicosAtivos.length === 0 ? (
                  <p className="mdc-hint">Nenhum contrato ativo.</p>
                ) : (
                  <ul className="mdc-servicos">
                    {servicosAtivos.map((s) => (
                      <li key={s.id} className="mdc-servico">
                        <span className="mdc-servico__tipo">{TIPO_LABEL[s.tipo_servico] ?? s.tipo_servico}</span>
                        <span className="mdc-servico__freq">{FREQ_LABEL[s.frequencia] ?? s.frequencia}</span>
                        {s.quantidade_vasos && <span className="mdc-servico__info">{s.quantidade_vasos} vasos</span>}
                        {s.valor_mensal && <span className="mdc-servico__info">{formatarMoeda(s.valor_mensal)}/mês</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {(cliente.observacoes || cliente.observacoes_internas) && (
                <section className="mdc-sec">
                  <h4 className="mdc-sec__titulo">Observações</h4>
                  {cliente.observacoes && <p className="mdc-relato">{cliente.observacoes}</p>}
                  {cliente.observacoes_internas && <p className="mdc-relato mdc-relato--interna">🔒 {cliente.observacoes_internas}</p>}
                </section>
              )}
            </>
          )}
        </div>

        <footer className="mdc-modal__footer">
          <button className="mdc-btn mdc-btn--sec" onClick={onFechar}>Fechar</button>
          <button className="mdc-btn" onClick={onEditar} disabled={!cliente}>✏️ Editar cadastro completo</button>
        </footer>
      </div>
    </div>
  );
}
