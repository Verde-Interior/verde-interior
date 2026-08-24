// src/components/Orcamentos/GeradorOrcamento/GeradorOrcamento.jsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useCRM } from '../../../context/CRMContext';
import CatalogoModal from '../CatalogoModal/CatalogoModal';
import OrcamentoPreview from '../OrcamentoPreview/OrcamentoPreview';
import { normalizarTiposServico } from '../../../lib/orcamento-titulo';
import './GeradorOrcamento.css';

const TIPOS_SERVICO = [
  { value: 'venda',      label: 'Venda' },
  { value: 'reforma',    label: 'Reforma' },
  { value: 'locacao',    label: 'Locação' },
  { value: 'manut-rec',  label: 'Manutenção Recorrente' },
  { value: 'manut-pont', label: 'Manutenção Pontual' },
  { value: 'eventos',    label: 'Eventos' },
  { value: 'outros',     label: 'Outros' },
];

const MODELOS_SERVICO = [
  { value: 'venda',      label: 'Venda',         sub: 'Faturamento único',       icone: '🛒' },
  { value: 'reforma',    label: 'Reforma',        sub: 'Faturamento único',       icone: '🔧' },
  { value: 'locacao',    label: 'Locação',        sub: 'Recorrente + manutenção', icone: '📋' },
  { value: 'manut-rec',  label: 'Manutenção',     sub: 'Visitas recorrentes',     icone: '🌿' },
  { value: 'manut-pont', label: 'Manut. Pontual', sub: 'Visita única',            icone: '🔍' },
  { value: 'eventos',    label: 'Eventos',        sub: 'Locação para eventos',    icone: '🎪' },
  { value: 'outros',     label: 'Outros',         sub: 'Serviços diversos',       icone: '📦' },
];

const ORIGENS_ORCAMENTO = ['Indicação','Google Ads','LinkedIn','Instagram','Prospecção ativa','Site','Evento','Outro'];

const STATUS_OPCOES = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'enviado',  label: 'Enviado' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'recusado', label: 'Recusado' },
];

const MODELOS_VASO = ['Cônico', 'Floreira', 'Bowl/Bacia', 'Outro'];
const TAMANHOS_VASO = ['Pequeno', 'Médio', 'Grande'];
const CORES_POR_MODELO = {
  'Cônico':     ['Azul marmorato', 'Bege marmorato', 'Cinza marmorato', 'Preto marmorato',
                 'Bege texturizado', 'Cinza texturizado', 'Preto texturizado',
                 'Marrom texturizado', 'Branco texturizado'],
  'Floreira':   ['Cinza texturizada', 'Bege texturizada', 'Preta texturizada'],
  'Bowl/Bacia': ['Vidro', 'Polietileno'],
  'Outro':      null,  // livre — usa input de texto
};
const FREQUENCIAS = ['Mensal', 'Quinzenal', '1x por semana', '2x por semana', '3x por semana'];

// Categorias cujo valor é recorrente mensal — as demais entram como investimento único.
const CATS_MENSAIS = new Set(['locacao', 'manut-rec']);

// normalizarTiposServico importado de orcamento-titulo.js (alias local)
const normalizarTipos = normalizarTiposServico;

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);
}

function novoItem(ordem = 0) {
  return {
    _id: crypto.randomUUID(), id: null,
    catalogo_item_id: null, nome: '', descricao: '', foto_url: '',
    tipo: 'produto', preco_unitario: 0, quantidade: 1, unidade: 'un',
    cor_vaso: '', tamanho_vaso: '', modelo_vaso: '', nome_planta: '', ordem,
  };
}

function novoItemImagem(ordem = 0) {
  return {
    _id: crypto.randomUUID(), id: null,
    catalogo_item_id: null, nome: '', descricao: '', foto_url: '',
    tipo: 'imagem', preco_unitario: 0, quantidade: 1, unidade: 'un',
    cor_vaso: '', tamanho_vaso: '', modelo_vaso: '', nome_planta: '', ordem,
  };
}

function extrairNomePlanta(nomeCompleto) {
  const sepIdx = nomeCompleto?.indexOf(' — ');
  if (sepIdx > 0) return nomeCompleto.slice(0, sepIdx).trim();
  return nomeCompleto?.trim() ?? '';
}

function extrairModeloVaso(nomeCompleto) {
  const sepIdx = nomeCompleto?.indexOf(' — ');
  const parteVaso = sepIdx > 0 ? nomeCompleto.slice(sepIdx + 3).toLowerCase() : (nomeCompleto ?? '').toLowerCase();
  if (parteVaso.includes('floreira'))            return 'Floreira';
  if (parteVaso.includes('bowl') || parteVaso.includes('bacia')) return 'Bowl/Bacia';
  if (parteVaso.includes('cônic') || parteVaso.includes('conic')) return 'Cônico';
  return 'Outro';
}

function novaOpcao(numero, isPrincipal = false, tipo_secao = 'normal', categoria_servico = null) {
  return {
    _id: crypto.randomUUID(), id: null,
    numero_opcao: numero, titulo: '', descricao: '',
    total_unico: 0, total_mensal: 0, ordem: numero - 1,
    is_principal: isPrincipal, tipo_secao, categoria_servico,
    itens: tipo_secao === 'sugestoes' ? [] : [novoItem(0)],
  };
}

function calcularTotal(opcao) {
  return opcao.itens.reduce((s, i) => s + (Number(i.preco_unitario) * Number(i.quantidade)), 0);
}

function gerarNome(tipos, empresa, data) {
  const d = data ?? new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aa = String(d.getFullYear()).slice(-2);
  const tiposArr = Array.isArray(tipos) ? tipos : [tipos];
  const labels = tiposArr.map(t => TIPOS_SERVICO.find(x => x.value === t)?.label ?? t);
  const label = labels.join(' + ');
  return `${dd}${mm}.${aa} Orçamento de ${label} - ${empresa?.trim() || 'Lead'}`;
}

// ── Painel de campos específicos por tipo de serviço ──────────────────────────
function PainelServico({ tipos, dados, onChange }) {
  function set(campo, valor) { onChange({ ...dados, [campo]: valor }); }
  const hasLocacao  = tipos.includes('locacao');
  const hasManutRec = tipos.includes('manut-rec') && !hasLocacao;
  const hasManutPont= tipos.includes('manut-pont');
  const hasEventos  = tipos.includes('eventos');

  if (!hasLocacao && !hasManutRec && !hasManutPont && !hasEventos) return null;

  return (
    <section className="gerador__secao gerador__secao--servico">
      <h3 className="gerador__secao-titulo">Detalhes do Serviço</h3>

      {hasLocacao && (
        <div className="gerador__servico-bloco">
          <div className="gerador__servico-bloco-titulo">📋 Locação</div>
          <div className="gerador__campo-grupo">
            <label className="gerador__label">Prazo Contratual (meses)</label>
            <input className="gerador__input" type="number" min="1" value={dados.prazoMeses ?? ''} onChange={e => set('prazoMeses', e.target.value)} placeholder="Ex: 12" />
          </div>
          <div className="gerador__campo-grupo">
            <label className="gerador__label">Frequência de Manutenção Inclusa</label>
            <select className="gerador__select" value={dados.frequencia ?? ''} onChange={e => set('frequencia', e.target.value)}>
              <option value="">Selecione a frequência...</option>
              {FREQUENCIAS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="gerador__campo-grupo">
            <label className="gerador__label">Vasos Contemplados</label>
            <textarea className="gerador__textarea" rows={2} value={dados.vasosContemplados ?? ''} onChange={e => set('vasosContemplados', e.target.value)} placeholder="Ex: 4 vasos de chão + 2 jardineiras" />
          </div>
          <div className="gerador__campo-grupo">
            <label className="gerador__label gerador__label--info">🌱 Reposição ilimitada inclusa na locação</label>
          </div>
        </div>
      )}

      {hasManutRec && (
        <div className="gerador__servico-bloco">
          <div className="gerador__servico-bloco-titulo">🌿 Manutenção Recorrente</div>
          <div className="gerador__campo-grupo">
            <label className="gerador__label">Frequência de Visita</label>
            <select className="gerador__select" value={dados.frequencia ?? ''} onChange={e => set('frequencia', e.target.value)}>
              <option value="">Selecione a frequência...</option>
              {FREQUENCIAS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="gerador__campo-grupo">
            <label className="gerador__label">Vasos Contemplados</label>
            <textarea className="gerador__textarea" rows={3} value={dados.vasosContemplados ?? ''} onChange={e => set('vasosContemplados', e.target.value)} placeholder="Ex: 4 vasos de chão + 2 jardineiras de mesa" />
          </div>
          {/* Reposição estruturada — suporte a legado (comReposicao) e novo formato (reposicao) */}
          {(() => {
            const rep = dados.reposicao ?? { ativa: !!dados.comReposicao, tipo: dados.limiteMensalReposicao ? 'quantidade' : 'ilimitada', quantidadeMensal: dados.limiteMensalReposicao ?? '' };
            function setRep(campo, valor) {
              const nova = { ...rep, [campo]: valor };
              onChange({ ...dados, reposicao: nova, comReposicao: nova.ativa });
            }
            return (
              <>
                <div className="gerador__campo-grupo">
                  <label className="gerador__checkbox-label">
                    <input type="checkbox" checked={!!rep.ativa} onChange={e => setRep('ativa', e.target.checked)} />
                    Inclui reposição de plantas
                  </label>
                </div>
                {rep.ativa && (
                  <div className="gerador__campo-grupo">
                    <label className="gerador__label">Tipo de reposição</label>
                    <div className="gerador__reposicao-opcoes">
                      <label className="gerador__checkbox-label">
                        <input type="radio" name="rep-tipo" value="ilimitada" checked={rep.tipo !== 'quantidade'} onChange={() => setRep('tipo', 'ilimitada')} />
                        Ilimitada
                      </label>
                      <label className="gerador__checkbox-label">
                        <input type="radio" name="rep-tipo" value="quantidade" checked={rep.tipo === 'quantidade'} onChange={() => setRep('tipo', 'quantidade')} />
                        Até
                        <input
                          className="gerador__input gerador__input--num gerador__input--sm"
                          type="number" min="1"
                          value={rep.tipo === 'quantidade' ? (rep.quantidadeMensal ?? '') : ''}
                          onChange={e => setRep('quantidadeMensal', Number(e.target.value))}
                          disabled={rep.tipo !== 'quantidade'}
                          placeholder="Qtd"
                          style={{ width: 52 }}
                        />
                        por mês
                      </label>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          <div className="gerador__campo-grupo">
            <label className="gerador__checkbox-label">
              <input type="checkbox" checked={!!dados.descontoLocalizacao} onChange={e => set('descontoLocalizacao', e.target.checked)} />
              Desconto de localização (mesmo prédio)
            </label>
          </div>
        </div>
      )}

      {hasManutPont && (
        <div className="gerador__servico-bloco">
          <div className="gerador__servico-bloco-titulo">🔍 Manutenção Pontual</div>
          <div className="gerador__campo-grupo">
            <label className="gerador__label">Vasos Contemplados</label>
            <textarea className="gerador__textarea" rows={2} value={dados.vasosContemplados ?? ''} onChange={e => set('vasosContemplados', e.target.value)} placeholder="Ex: todos os vasos do andar" />
          </div>
        </div>
      )}

      {hasEventos && (
        <div className="gerador__servico-bloco">
          <div className="gerador__servico-bloco-titulo">🎪 Evento</div>
          <div className="gerador__linha-dupla">
            <div className="gerador__campo-grupo">
              <label className="gerador__label">Data de Entrega</label>
              <input className="gerador__input" type="date" value={dados.dataEntrega ?? ''} onChange={e => set('dataEntrega', e.target.value)} />
            </div>
            <div className="gerador__campo-grupo">
              <label className="gerador__label">Hora de Entrega</label>
              <input className="gerador__input" type="time" value={dados.horaEntrega ?? ''} onChange={e => set('horaEntrega', e.target.value)} />
            </div>
          </div>
          <div className="gerador__linha-dupla">
            <div className="gerador__campo-grupo">
              <label className="gerador__label">Data de Retirada</label>
              <input className="gerador__input" type="date" value={dados.dataRetirada ?? ''} onChange={e => set('dataRetirada', e.target.value)} />
            </div>
            <div className="gerador__campo-grupo">
              <label className="gerador__label">Hora de Retirada</label>
              <input className="gerador__input" type="time" value={dados.horaRetirada ?? ''} onChange={e => set('horaRetirada', e.target.value)} />
            </div>
          </div>
          <div className="gerador__campo-grupo">
            <label className="gerador__checkbox-label">
              <input type="checkbox" checked={!!dados.estacionamento} onChange={e => set('estacionamento', e.target.checked)} />
              Custo de estacionamento
            </label>
          </div>
          {dados.estacionamento && (
            <div className="gerador__extra-calc">
              <span>R$</span>
              <input className="gerador__input gerador__input--num gerador__input--sm" type="number" min="0" value={dados.estacionamentoValorHora ?? ''} onChange={e => set('estacionamentoValorHora', Number(e.target.value))} placeholder="Valor/h" />
              <span>/h ×</span>
              <input className="gerador__input gerador__input--num gerador__input--sm" type="number" min="0" value={dados.estacionamentoHoras ?? ''} onChange={e => set('estacionamentoHoras', Number(e.target.value))} placeholder="Horas" />
              <span>horas =</span>
              <strong>{fmt((dados.estacionamentoValorHora ?? 0) * (dados.estacionamentoHoras ?? 0))}</strong>
            </div>
          )}
          <div className="gerador__campo-grupo">
            <label className="gerador__checkbox-label">
              <input type="checkbox" checked={!!dados.trabalhoNoturno} onChange={e => set('trabalhoNoturno', e.target.checked)} />
              Trabalho noturno
            </label>
          </div>
          {dados.trabalhoNoturno && (
            <div className="gerador__extra-calc">
              <input className="gerador__input gerador__input--num gerador__input--sm" type="number" min="1" value={dados.trabalhoNoturnoFuncionarios ?? 1} onChange={e => set('trabalhoNoturnoFuncionarios', Number(e.target.value))} />
              <span>func. × R$</span>
              <input className="gerador__input gerador__input--num gerador__input--sm" type="number" min="0" step="10" value={dados.trabalhoNoturnoCusto ?? 150} onChange={e => set('trabalhoNoturnoCusto', Number(e.target.value))} />
              <span>/func. =</span>
              <strong>{fmt((dados.trabalhoNoturnoFuncionarios ?? 1) * (dados.trabalhoNoturnoCusto ?? 150))}</strong>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Bloco de imagem ───────────────────────────────────────────────────────────
function BlocoImagem({ item, onAtualizar, onRemover }) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput]   = useState('');
  const fileRef = useRef(null);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('orcamentos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('orcamentos').getPublicUrl(path);
      onAtualizar('foto_url', publicUrl);
      onAtualizar('nome', file.name.replace(/\.[^.]+$/, ''));
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
    } finally {
      setUploading(false);
    }
  }

  function handleUrl() {
    if (urlInput.trim()) {
      onAtualizar('foto_url', urlInput.trim());
      onAtualizar('nome', 'Imagem');
    }
  }

  return (
    <div className="gerador__bloco-imagem">
      <button className="gerador__btn-remover-item" onClick={onRemover} title="Remover imagem">✕</button>
      {item.foto_url ? (
        <div className="gerador__bloco-imagem-preview">
          <img src={item.foto_url} alt={item.nome} />
          <input
            className="gerador__input"
            value={item.nome}
            onChange={e => onAtualizar('nome', e.target.value)}
            placeholder="Legenda da imagem (opcional)"
          />
          <button className="gerador__btn-add-item gerador__btn-add-item--secundario" onClick={() => { onAtualizar('foto_url', ''); setUrlInput(''); }}>
            Trocar imagem
          </button>
        </div>
      ) : (
        <div className="gerador__bloco-imagem-vazio">
          <div className="gerador__bloco-imagem-acoes">
            <button className="gerador__btn-add-item" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Enviando...' : '📁 Upload do computador'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
          </div>
          <div className="gerador__bloco-imagem-ou">ou cole uma URL</div>
          <div className="gerador__bloco-imagem-url">
            <input
              className="gerador__input"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://..."
              onKeyDown={e => e.key === 'Enter' && handleUrl()}
            />
            <button className="gerador__btn-add-item" onClick={handleUrl}>Usar URL</button>
          </div>
        </div>
      )}
    </div>
  );
}

async function buscarFotoPorCorTamanho(nomePlanta, modeloVaso, cor, tamanho) {
  if (!nomePlanta) return null;

  let query = supabase
    .from('catalogo_itens')
    .select('nome, foto_url')
    .ilike('nome', `${nomePlanta}%`)
    .eq('ativo', true);

  if (modeloVaso && modeloVaso !== 'Outro') query = query.ilike('nome', `%${modeloVaso}%`);
  if (cor)     query = query.ilike('nome', `%${cor}%`);
  if (tamanho) query = query.ilike('nome', `%${tamanho}%`);

  const { data } = await query.limit(3);
  if (!data?.length) return null;
  return data[0];
}

function construirNomeItem(nomePlanta, nomeOriginal, cor, tamanho) {
  const sepIdx = nomeOriginal?.indexOf(' — ');
  const parteVaso = sepIdx > 0 ? nomeOriginal.slice(sepIdx + 3) : '';

  if (!cor && !tamanho) return nomeOriginal;

  if (parteVaso) {
    const palavrasVaso = parteVaso.split(' ');
    const CORES_PALAVRAS = ['Azul', 'Bege', 'Branco', 'Preto', 'Madeira', 'Creme', 'Texturizado', 'Mármore', 'Natural', 'Outro'];
    const idxCor = palavrasVaso.findIndex(p => CORES_PALAVRAS.some(c => p.includes(c)));
    const vasoBase = idxCor > 0 ? palavrasVaso.slice(0, idxCor).join(' ') : parteVaso;
    const partes = [nomePlanta || parteVaso, vasoBase, cor, tamanho].filter(Boolean);
    return `${nomePlanta} — ${[vasoBase, cor, tamanho].filter(Boolean).join(' ')}`;
  }

  return [nomeOriginal, cor, tamanho].filter(Boolean).join(' ');
}

// ── Card de sugestão (seções sem preço) ──────────────────────────────────────
function CardSugestao({ item, onRemover }) {
  return (
    <div className="gerador__card-sugestao">
      {item.foto_url
        ? <img src={item.foto_url} alt={item.nome} className="gerador__card-sugestao-foto" />
        : <div className="gerador__card-sugestao-sem-foto">🌿</div>
      }
      <div className="gerador__card-sugestao-nome">{item.nome || 'Item sem nome'}</div>
      <button className="gerador__card-sugestao-remover" onClick={onRemover} title="Remover">✕</button>
    </div>
  );
}

// ── Linha de item ─────────────────────────────────────────────────────────────
function LinhaItem({ item, onAtualizar, onRemover, onAbrirCatalogo }) {
  const isExtra = item.tipo === 'extra';

  async function handleCorTamanho(campo, valor) {
    const cor     = campo === 'cor_vaso'     ? valor : item.cor_vaso;
    const tamanho = campo === 'tamanho_vaso' ? valor : item.tamanho_vaso;
    const modelo  = item.modelo_vaso;

    onAtualizar(campo, valor);

    const novoNome = construirNomeItem(item.nome_planta, item.nome, cor, tamanho);
    if (novoNome !== item.nome) onAtualizar('nome', novoNome);

    if (item.nome_planta && (cor || tamanho)) {
      const encontrado = await buscarFotoPorCorTamanho(item.nome_planta, modelo, cor, tamanho);
      // só troca a foto quando houver variante exata no catálogo
      if (encontrado?.foto_url) onAtualizar('foto_url', encontrado.foto_url);
    }
  }
  return (
    <div className="gerador__item">
      {!isExtra && (
        <div className="gerador__item-foto-col">
          {item.foto_url
            ? <img src={item.foto_url} alt={item.nome} className="gerador__item-foto" onClick={onAbrirCatalogo} title="Trocar foto" />
            : <button className="gerador__btn-catalogo" onClick={onAbrirCatalogo} title="Selecionar do catálogo">📷</button>
          }
        </div>
      )}

      <div className="gerador__item-corpo">
        <div className="gerador__item-linha1">
          <input
            className="gerador__input gerador__item-nome"
            value={item.nome}
            onChange={e => onAtualizar('nome', e.target.value)}
            placeholder={isExtra ? 'Ex: Frete, Taxa de montagem...' : 'Nome do item'}
          />
          <select className="gerador__select gerador__item-tipo-select" value={item.tipo} onChange={e => onAtualizar('tipo', e.target.value)}>
            <option value="produto">Produto</option>
            <option value="extra">Custo Adicional</option>
          </select>
        </div>

        {!isExtra && (
          <div className="gerador__item-linha2">
            <input
              className="gerador__input gerador__item-desc"
              value={item.descricao ?? ''}
              onChange={e => onAtualizar('descricao', e.target.value)}
              placeholder="Descrição (opcional)"
            />
          </div>
        )}

        {!isExtra && (
          <div className="gerador__item-vaso">
            <select
              className="gerador__select gerador__select--sm"
              value={item.modelo_vaso ?? ''}
              onChange={e => {
                onAtualizar('modelo_vaso', e.target.value);
                onAtualizar('cor_vaso', '');  // reseta cor ao mudar modelo
              }}
              title="Modelo do vaso"
            >
              <option value="">Modelo…</option>
              {MODELOS_VASO.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            {item.modelo_vaso === 'Outro' ? (
              <input
                className="gerador__input gerador__input--sm"
                value={item.cor_vaso ?? ''}
                onChange={e => handleCorTamanho('cor_vaso', e.target.value)}
                placeholder="Cor / modelo (livre)"
              />
            ) : (
              <select
                className="gerador__select gerador__select--sm"
                value={item.cor_vaso ?? ''}
                onChange={e => handleCorTamanho('cor_vaso', e.target.value)}
                disabled={!item.modelo_vaso}
              >
                <option value="">Cor do vaso</option>
                {(CORES_POR_MODELO[item.modelo_vaso] ?? []).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            <select
              className="gerador__select gerador__select--sm"
              value={item.tamanho_vaso ?? ''}
              onChange={e => handleCorTamanho('tamanho_vaso', e.target.value)}
            >
              <option value="">Tamanho</option>
              {TAMANHOS_VASO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="gerador__item-numeros">
        {!isExtra && (
          <div className="gerador__item-num-grupo">
            <label className="gerador__label">Qtd</label>
            <input className="gerador__input gerador__input--num" type="number" min="1" value={item.quantidade} onChange={e => onAtualizar('quantidade', e.target.value)} />
          </div>
        )}
        <div className="gerador__item-num-grupo">
          <label className="gerador__label">{isExtra ? 'Valor' : 'Preço unit.'}</label>
          <input className="gerador__input gerador__input--num" type="number" step="0.01" min="0" value={item.preco_unitario} onChange={e => onAtualizar('preco_unitario', e.target.value)} />
        </div>
        {!isExtra && (
          <div className="gerador__item-num-grupo">
            <label className="gerador__label">Total</label>
            <span className="gerador__item-total">{fmt(Number(item.preco_unitario) * Number(item.quantidade))}</span>
          </div>
        )}
        {isExtra && (
          <div className="gerador__item-num-grupo">
            <label className="gerador__label">Total</label>
            <span className="gerador__item-total">{fmt(Number(item.preco_unitario))}</span>
          </div>
        )}
      </div>

      <button className="gerador__btn-remover-item" onClick={onRemover} title="Remover item">✕</button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GeradorOrcamento({ orcamentoId, leadInicial, onVoltar }) {
  const { usuario } = useAuth();
  const { leads } = useCRM();

  const [salvando, setSalvando]       = useState(false);
  const [statusSalvo, setStatusSalvo] = useState('');
  const [preview, setPreview]         = useState(false);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [catalogoAlvo, setCatalogoAlvo]     = useState(null);

  const [id, setId]                     = useState(orcamentoId ?? null);
  const [nome, setNome]                 = useState('');
  const [tiposServico, setTiposServico] = useState(['manut-rec']);
  const [origemOrcamento, setOrigemOrcamento] = useState('');
  const [descontoPct, setDescontoPct]   = useState(0);
  const [numeroOrc, setNumeroOrc]       = useState(null);
  const [status, setStatus]             = useState('rascunho');
  const [leadId, setLeadId]             = useState(leadInicial?.id ?? null);
  const [dadosCliente, setDadosCliente] = useState({});
  const [dadosServico, setDadosServico] = useState({});
  const [formaPagamento, setFormaPagamento] = useState(['boleto', 'pix']);
  const [validadeDias, setValidadeDias] = useState('');
  const [observacoes, setObservacoes]   = useState('');
  const [previewOverrides, setPreviewOverrides] = useState({});
  const [galeriaFotos, setGaleriaFotos]         = useState([]);
  const [galeriaConfig, setGaleriaConfig]       = useState({ colunas: 2, altura: 200 });

  // proposta principal (sempre presente) + opções adicionais (eventuais)
  const [principal, setPrincipal]   = useState(() => novaOpcao(1, true));
  const [adicionais, setAdicionais] = useState([]);

  const autoSaveTimer = useRef(null);
  const primeiroLoad  = useRef(true);

  // ── preencher com lead inicial (ao abrir pelo Pipeline) ──────────────────
  useEffect(() => {
    if (!leadInicial || orcamentoId) return;
    const dc = {
      empresa: leadInicial.empresa ?? '',
      contato: leadInicial.contato ?? '',
      email:   leadInicial.email   ?? '',
      telefone:leadInicial.telefone?? '',
      bairro:  leadInicial.bairro  ?? '',
    };
    const tipos = normalizarTipos(leadInicial.tiposServico?.length ? leadInicial.tiposServico : ['manut-rec']);
    setDadosCliente(dc);
    setLeadId(leadInicial.id ?? null);
    setTiposServico(tipos);
    setNome(gerarNome(tipos, leadInicial.empresa));
  }, [leadInicial]);

  // ── carregar orçamento existente ─────────────────────────────────────────
  useEffect(() => {
    if (!orcamentoId) {
      primeiroLoad.current = false;
      return;
    }

    (async () => {
      const { data: orc } = await supabase.from('orcamentos').select('*').eq('id', orcamentoId).single();
      if (!orc) { onVoltar(); return; }

      const { data: ops } = await supabase
        .from('orcamento_opcoes')
        .select('*, orcamento_itens(*)')
        .eq('orcamento_id', orcamentoId)
        .order('ordem');

      setId(orc.id);
      setNome(orc.nome);
      setTiposServico(normalizarTipos(orc.tipos_servico?.length ? orc.tipos_servico : [orc.tipo_servico ?? 'manut-rec']));
      setOrigemOrcamento(orc.origem_orcamento ?? '');
      setDescontoPct(orc.desconto_pct ?? 0);
      setNumeroOrc(orc.numero_orc ?? null);
      setStatus(orc.status);
      setLeadId(orc.lead_id);
      setDadosCliente(orc.dados_cliente ?? {});
      setDadosServico(orc.dados_servico ?? {});
      setFormaPagamento(orc.forma_pagamento ?? ['boleto', 'pix']);
      setValidadeDias(orc.validade_dias ?? '');
      setObservacoes(orc.observacoes ?? '');
      setPreviewOverrides(orc.preview_overrides ?? {});
      setGaleriaFotos(orc.galeria_fotos ?? []);
      setGaleriaConfig(orc.galeria_config ?? { colunas: 2, altura: 200 });

      const mapOp = op => ({
        ...op, _id: op.id,
        tipo_secao: op.tipo_secao ?? 'normal',
        categoria_servico: op.categoria_servico ?? null,
        itens: (op.orcamento_itens ?? []).map(it => ({ ...it, _id: it.id })).sort((a, b) => a.ordem - b.ordem),
      });

      const princ = ops?.find(o => o.is_principal) ?? ops?.[0];
      const adds  = ops?.filter(o => !o.is_principal && o.id !== princ?.id) ?? [];

      if (princ) setPrincipal(mapOp(princ));
      setAdicionais(adds.map(mapOp));
      primeiroLoad.current = false;
    })();
  }, [orcamentoId]);

  // ── categoria da proposta principal ───────────────────────────────────────
  // A categoria decide se a seção entra em "investimento único" ou "recorrente
  // mensal" (CATS_MENSAIS_SET no salvar). Sem categoria, uma manutenção
  // recorrente cairia como valor único no documento e na listagem — por isso a
  // principal sempre acompanha os tipos marcados, a menos que o usuário escolha
  // outra explicitamente.
  useEffect(() => {
    if (!tiposServico.length) return;
    setPrincipal(p => (
      p.categoria_servico && tiposServico.includes(p.categoria_servico)
        ? p
        : { ...p, categoria_servico: tiposServico[0] }
    ));
  }, [tiposServico]);

  // ── auto-save ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (primeiroLoad.current) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => salvar(false), 2000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [nome, tiposServico, status, leadId, dadosCliente, dadosServico, formaPagamento, validadeDias, observacoes, previewOverrides, origemOrcamento, descontoPct, principal, adicionais, galeriaFotos, galeriaConfig]);

  // ── salvar ────────────────────────────────────────────────────────────────
  async function salvar(manual = true) {
    if (!nome.trim()) return;
    setSalvando(true);
    setStatusSalvo('salvando');
    try {
      const payload = {
        nome: nome.trim(),
        tipo_servico: tiposServico[0] ?? 'outros',
        tipos_servico: tiposServico,
        status,
        lead_id: leadId || null,
        dados_cliente: dadosCliente,
        dados_servico: dadosServico,
        forma_pagamento: formaPagamento,
        validade_dias: validadeDias ? Number(validadeDias) : null,
        observacoes: observacoes.trim() || null,
        criado_por: usuario?.nome ?? null,
        preview_overrides: previewOverrides,
        origem_orcamento: origemOrcamento || null,
        desconto_pct: Number(descontoPct) || 0,
        galeria_fotos: galeriaFotos,
        galeria_config: galeriaConfig,
        titulo_documento: previewOverrides.tituloDocumento ?? null,
      };

      let orcId = id;
      if (!orcId) {
        const { data, error } = await supabase.from('orcamentos').insert(payload).select('id').single();
        if (error) throw error;
        orcId = data.id;
        setId(orcId);
      } else {
        const { error } = await supabase.from('orcamentos').update(payload).eq('id', orcId);
        if (error) throw error;
      }

      const salvarOpcao = async (op, isPrincipal) => {
        const ehMensal = CATS_MENSAIS.has(op.categoria_servico);
        const opPayload = {
          orcamento_id: orcId, numero_opcao: op.numero_opcao,
          titulo: op.titulo?.trim() || null, descricao: op.descricao?.trim() || null,
          total_unico:  ehMensal ? 0 : calcularTotal(op),
          total_mensal: ehMensal ? calcularTotal(op) : 0,
          ordem: op.ordem, is_principal: isPrincipal,
          tipo_secao: op.tipo_secao ?? 'normal',
          categoria_servico: op.categoria_servico || null,
        };
        let opId = op.id;
        if (!opId) {
          const { data, error } = await supabase.from('orcamento_opcoes').insert(opPayload).select('id').single();
          if (error) throw error;
          opId = data.id;
        } else {
          const { error: eOp } = await supabase.from('orcamento_opcoes').update(opPayload).eq('id', opId);
          if (eOp) throw eOp;
        }

        for (let i = 0; i < op.itens.length; i++) {
          const it = op.itens[i];
          const itPayload = {
            opcao_id: opId,
            catalogo_item_id: it.catalogo_item_id || null,
            nome: it.nome.trim() || '—', descricao: it.descricao?.trim() || null,
            foto_url: it.foto_url || null, tipo: it.tipo,
            preco_unitario: Number(it.preco_unitario) || 0,
            quantidade: Number(it.quantidade) || 1,
            unidade: it.unidade || 'un',
            cor_vaso: it.cor_vaso || null,
            tamanho_vaso: it.tamanho_vaso || null,
            modelo_vaso: it.modelo_vaso || null,
            nome_planta: it.nome_planta || null,
            ordem: i,
          };
          if (!it.id) {
            const { data, error: eIns } = await supabase.from('orcamento_itens').insert(itPayload).select('id').single();
            if (eIns) throw eIns;
            it.id = data?.id;
          } else {
            const { error: eIt } = await supabase.from('orcamento_itens').update(itPayload).eq('id', it.id);
            if (eIt) throw eIt;
          }
        }

        // Reconciliar: apagar do banco itens que foram removidos do estado
        const idsItensAtuais = op.itens.map(it => it.id).filter(Boolean);
        if (idsItensAtuais.length > 0) {
          await supabase.from('orcamento_itens').delete()
            .eq('opcao_id', opId)
            .not('id', 'in', `(${idsItensAtuais.join(',')})`);
        } else {
          await supabase.from('orcamento_itens').delete().eq('opcao_id', opId);
        }

        return opId;
      };

      const savedOpIds = [];
      const prinId = await salvarOpcao(principal, true);
      if (prinId) savedOpIds.push(prinId);
      for (const ad of adicionais) {
        const adId = await salvarOpcao(ad, false);
        if (adId) savedOpIds.push(adId);
      }

      // Reconciliar: apagar do banco seções que foram removidas do estado
      if (savedOpIds.length > 0) {
        await supabase.from('orcamento_opcoes').delete()
          .eq('orcamento_id', orcId)
          .not('id', 'in', `(${savedOpIds.join(',')})`);
      }

      setStatusSalvo('salvo');
      setTimeout(() => setStatusSalvo(''), 2500);
      return orcId;
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setStatusSalvo('erro');
    } finally {
      setSalvando(false);
    }
  }

  // ── validar e enviar ──────────────────────────────────────────────────────
  function validarOrcamento() {
    const erros = [];
    if (!nome?.trim()) erros.push('Nome do orçamento');
    if (!tiposServico?.length) erros.push('Tipo de serviço');
    if (!dadosCliente?.empresa?.trim()) erros.push('Empresa do cliente');
    if (!dadosCliente?.contato?.trim()) erros.push('Contato do cliente');
    if (tiposServico.includes('locacao') && !dadosServico?.prazoMeses) erros.push('Prazo de locação');
    if (tiposServico.includes('eventos') && !dadosServico?.dataEntrega) erros.push('Data de entrega do evento');
    if (tiposServico.includes('eventos') && !dadosServico?.dataRetirada) erros.push('Data de retirada do evento');
    const todosProdutos = [principal, ...adicionais].flatMap(s => s.itens.filter(i => i.tipo === 'produto' && i.nome?.trim()));
    if (!todosProdutos.length) erros.push('Ao menos 1 produto');
    return erros;
  }

  async function enviarOrcamento() {
    const erros = validarOrcamento();
    if (erros.length) {
      alert('Preencha os campos obrigatórios:\n• ' + erros.join('\n• '));
      return;
    }
    const prevStatus = status;
    setSalvando(true);
    setStatusSalvo('salvando');
    try {
      // Garantir que o registro existe antes do UPDATE (trigger numero_orc é BEFORE UPDATE)
      let orcIdAtual = id;
      if (!orcIdAtual) {
        orcIdAtual = await salvar(false);
        if (!orcIdAtual) { setStatusSalvo('erro'); return; }
      }

      setStatus('enviado');
      const payload = {
        nome: nome.trim(),
        tipo_servico: tiposServico[0] ?? 'outros',
        tipos_servico: tiposServico,
        status: 'enviado',
        lead_id: leadId || null,
        dados_cliente: dadosCliente,
        dados_servico: dadosServico,
        forma_pagamento: formaPagamento,
        validade_dias: validadeDias ? Number(validadeDias) : null,
        observacoes: observacoes.trim() || null,
        criado_por: usuario?.nome ?? null,
        preview_overrides: previewOverrides,
        origem_orcamento: origemOrcamento || null,
        desconto_pct: Number(descontoPct) || 0,
        galeria_fotos: galeriaFotos,
        galeria_config: galeriaConfig,
        titulo_documento: previewOverrides.tituloDocumento ?? null,
      };

      const { error } = await supabase.from('orcamentos').update(payload).eq('id', orcIdAtual);
      if (error) throw error;

      const { data: orcAtual } = await supabase.from('orcamentos').select('numero_orc').eq('id', orcIdAtual).single();
      if (orcAtual?.numero_orc) setNumeroOrc(orcAtual.numero_orc);

      setStatusSalvo('salvo');
      setTimeout(() => setStatusSalvo(''), 2500);
    } catch (err) {
      console.error('Erro ao enviar:', err);
      setStatusSalvo('erro');
      setStatus(prevStatus);
    } finally {
      setSalvando(false);
    }
  }

  // ── helpers principal ────────────────────────────────────────────────────
  function atualizarItemPrincipal(idx, campo, valor) {
    setPrincipal(p => ({ ...p, itens: p.itens.map((it, i) => i === idx ? { ...it, [campo]: valor } : it) }));
  }
  function removerItemPrincipal(idx) {
    const it = principal.itens[idx];
    if (it.id) supabase.from('orcamento_itens').delete().eq('id', it.id);
    setPrincipal(p => ({ ...p, itens: p.itens.filter((_, i) => i !== idx) }));
  }
  function adicionarItemPrincipal() {
    setPrincipal(p => ({ ...p, itens: [...p.itens, novoItem(p.itens.length)] }));
  }

  // ── helpers adicionais ────────────────────────────────────────────────────
  function adicionarOpcaoAdicional() {
    setAdicionais(prev => [...prev, novaOpcao(prev.length + 1, false)]);
  }
  function removerOpcaoAdicional(idx) {
    const op = adicionais[idx];
    if (op.id) supabase.from('orcamento_opcoes').delete().eq('id', op.id);
    setAdicionais(prev => prev.filter((_, i) => i !== idx));
  }
  function atualizarOpcaoAdicional(idx, campo, valor) {
    setAdicionais(prev => prev.map((o, i) => {
      if (i !== idx) return o;
      const atualizada = { ...o, [campo]: valor };
      if (campo === 'tipo_secao' && valor === 'sugestoes') {
        o.itens.filter(it => it.id).forEach(it => {
          supabase.from('orcamento_itens').delete().eq('id', it.id);
        });
        atualizada.itens = [];
      }
      return atualizada;
    }));
  }
  function atualizarItemAdicional(opIdx, itemIdx, campo, valor) {
    setAdicionais(prev => prev.map((o, i) => i === opIdx
      ? { ...o, itens: o.itens.map((it, ii) => ii === itemIdx ? { ...it, [campo]: valor } : it) }
      : o));
  }
  function removerItemAdicional(opIdx, itemIdx) {
    const it = adicionais[opIdx].itens[itemIdx];
    if (it.id) supabase.from('orcamento_itens').delete().eq('id', it.id);
    setAdicionais(prev => prev.map((o, i) => i === opIdx
      ? { ...o, itens: o.itens.filter((_, ii) => ii !== itemIdx) }
      : o));
  }
  function adicionarItemAdicional(opIdx) {
    setAdicionais(prev => prev.map((o, i) => i === opIdx
      ? { ...o, itens: [...o.itens, novoItem(o.itens.length)] }
      : o));
  }

  // ── catálogo ─────────────────────────────────────────────────────────────
  function abrirCatalogo(alvo) { setCatalogoAlvo(alvo); setCatalogoAberto(true); }
  function inserirCatalogo(item) {
    const patch = {
      catalogo_item_id: item.id, nome: item.nome,
      nome_planta: extrairNomePlanta(item.nome),
      modelo_vaso: extrairModeloVaso(item.nome),
      descricao: item.descricao ?? '', foto_url: item.foto_url ?? '',
      preco_unitario: item.preco_referencia ?? 0,
      cor_vaso: '', tamanho_vaso: '',
    };
    if (catalogoAlvo.tipo === 'principal') {
      setPrincipal(p => ({ ...p, itens: p.itens.map((it, i) => i === catalogoAlvo.idx ? { ...it, ...patch } : it) }));
    } else {
      setAdicionais(prev => prev.map((o, oi) => oi === catalogoAlvo.opIdx
        ? { ...o, itens: o.itens.map((it, ii) => ii === catalogoAlvo.idx ? { ...it, ...patch } : it) }
        : o));
    }
    setCatalogoAberto(false);
  }

  async function excluirOrcamento() {
    // Se ainda não salvou no banco, só descarta e volta.
    if (!id) { onVoltar(); return; }

    const confirma = window.confirm(
      `Excluir permanentemente o orçamento "${nome}"?\n\nEsta ação apaga o orçamento, todas as seções, itens e imagens enviadas. Não pode ser desfeita.`
    );
    if (!confirma) return;

    setSalvando(true);
    try {
      // 1. Coletar caminhos de imagens que estão no nosso Storage 'orcamentos'.
      const todasOpcoes = [principal, ...(adicionais ?? [])];
      const paths = [];
      for (const op of todasOpcoes) {
        for (const it of (op?.itens ?? [])) {
          const url = it.foto_url;
          if (typeof url === 'string' && url.includes('/storage/v1/object/public/orcamentos/')) {
            const path = url.split('/storage/v1/object/public/orcamentos/')[1]?.split('?')[0];
            if (path) paths.push(decodeURIComponent(path));
          }
        }
      }

      // Também remover fotos da galeria
      for (const foto of (galeriaFotos ?? [])) {
        const url = foto.foto_url;
        if (typeof url === 'string' && url.includes('/storage/v1/object/public/orcamentos/')) {
          const path = url.split('/storage/v1/object/public/orcamentos/')[1]?.split('?')[0];
          if (path) paths.push(decodeURIComponent(path));
        }
      }

      // 2. Remover imagens do storage (não bloquear se falhar — arquivo órfão é aceitável).
      if (paths.length > 0) {
        const { error: eStorage } = await supabase.storage.from('orcamentos').remove(paths);
        if (eStorage) console.warn('Falha ao remover imagens do storage:', eStorage);
      }

      // 3. Apagar o orçamento (FK cascade remove opcoes + itens automaticamente).
      const { error } = await supabase.from('orcamentos').delete().eq('id', id);
      if (error) throw error;

      // Cancela auto-save pendente e volta para a lista.
      clearTimeout(autoSaveTimer.current);
      primeiroLoad.current = true;
      onVoltar();
    } catch (err) {
      console.error('Erro ao excluir orçamento:', err);
      alert('Erro ao excluir: ' + (err.message ?? err));
      setSalvando(false);
    }
  }

  async function salvarOverride(chave, valor) {
    const novasOverrides = { ...previewOverrides, [chave]: valor };
    setPreviewOverrides(novasOverrides);
    if (id) {
      await supabase.from('orcamentos').update({ preview_overrides: novasOverrides }).eq('id', id);
    }
  }

  // ── galeria de fotos ─────────────────────────────────────────────────────
  const galeriaFileRef = useRef(null);
  const [galeriaUploading, setGaleriaUploading] = useState(false);

  async function handleGaleriaUpload(e) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setGaleriaUploading(true);
    try {
      const novas = [];
      for (const file of files) {
        const ext  = file.name.split('.').pop();
        const path = `galeria/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('orcamentos').upload(path, file, { upsert: true });
        if (error) { console.error('Erro upload galeria:', error); continue; }
        const { data: { publicUrl } } = supabase.storage.from('orcamentos').getPublicUrl(path);
        novas.push({ foto_url: publicUrl, legenda: '', referencia: '' });
      }
      setGaleriaFotos(prev => [...prev, ...novas]);
    } finally {
      setGaleriaUploading(false);
      if (galeriaFileRef.current) galeriaFileRef.current.value = '';
    }
  }

  function atualizarGaleriaFoto(idx, campo, valor) {
    setGaleriaFotos(prev => prev.map((f, i) => i === idx ? { ...f, [campo]: valor } : f));
  }

  function moverGaleriaFoto(idx, dir) {
    setGaleriaFotos(prev => {
      const arr = [...prev];
      const to = idx + dir;
      if (to < 0 || to >= arr.length) return arr;
      [arr[idx], arr[to]] = [arr[to], arr[idx]];
      return arr;
    });
  }

  function removerGaleriaFoto(idx) {
    const foto = galeriaFotos[idx];
    if (foto?.foto_url?.includes('/storage/v1/object/public/orcamentos/')) {
      const path = foto.foto_url.split('/storage/v1/object/public/orcamentos/')[1]?.split('?')[0];
      if (path) supabase.storage.from('orcamentos').remove([decodeURIComponent(path)]);
    }
    setGaleriaFotos(prev => prev.filter((_, i) => i !== idx));
  }

  function togglePagamento(m) {
    setFormaPagamento(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  function atualizarLead(lId) {
    setLeadId(lId || null);
    const lead = leads.find(l => l.id === lId);
    if (lead) {
      const dc = { empresa: lead.empresa ?? '', contato: lead.contato ?? '', email: lead.email ?? '', telefone: lead.telefone ?? '', bairro: lead.bairro ?? '' };
      setDadosCliente(dc);
      setNome(gerarNome(tiposServico, lead.empresa));
    }
  }

  if (preview) {
    return (
      <OrcamentoPreview
        dados={{ nome, tiposServico, tipoServico: tiposServico[0] ?? 'outros', dadosCliente, dadosServico, formaPagamento, validadeDias, observacoes, principal, adicionais, descontoPct, numeroOrc, galeriaFotos, galeriaConfig }}
        previewOverrides={previewOverrides}
        onOverrideChange={salvarOverride}
        onFechar={() => setPreview(false)}
      />
    );
  }

  const totalPrincipal = calcularTotal(principal);

  return (
    <div className="gerador">
      {/* topbar */}
      <div className="gerador__topbar">
        <button className="gerador__btn-voltar" onClick={onVoltar}>← Voltar</button>
        <div className="gerador__topbar-centro">
          {numeroOrc && <span className="gerador__numero-orc">{numeroOrc}</span>}
          <input className="gerador__nome-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do orçamento (ex: 1308.26 Orçamento de Manutenção - Empresa)" />
        </div>
        <div className="gerador__topbar-acoes">
          <span className={`gerador__status-salvo gerador__status-salvo--${statusSalvo}`}>
            {statusSalvo === 'salvando' ? 'Salvando...' : statusSalvo === 'salvo' ? '✓ Salvo' : statusSalvo === 'erro' ? '✗ Erro' : ''}
          </span>
          <button className="gerador__btn-excluir" onClick={excluirOrcamento} disabled={salvando} title="Excluir orçamento permanentemente">
            🗑 Excluir
          </button>
          <button className="gerador__btn-preview" onClick={() => setPreview(true)}>Pré-visualizar</button>
          {status !== 'enviado' && status !== 'aprovado' && (
            <button className="gerador__btn-enviar" onClick={enviarOrcamento} disabled={salvando}>
              📤 Enviar
            </button>
          )}
          <button className="gerador__btn-salvar" onClick={() => salvar(true)} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>

      <div className="gerador__corpo">
        {/* painel esquerdo */}
        <div className="gerador__cabecalho-painel">
          <section className="gerador__secao">
            <h3 className="gerador__secao-titulo">Dados da Proposta</h3>
            <div className="gerador__campo-grupo">
              <label className="gerador__label">Modelos de Serviço</label>
              <div className="gerador__modelos-grid">
                {MODELOS_SERVICO.map(m => {
                  const ativo = tiposServico.includes(m.value);
                  const bloqueado = m.value === 'manut-rec' && tiposServico.includes('locacao');
                  return (
                    <label
                      key={m.value}
                      className={`gerador__modelo-card ${ativo ? 'gerador__modelo-card--ativo' : ''} ${bloqueado ? 'gerador__modelo-card--bloqueado' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={ativo}
                        disabled={bloqueado}
                        onChange={() => {
                          if (bloqueado) return;
                          let novos;
                          if (ativo) {
                            novos = tiposServico.filter(t => t !== m.value);
                          } else {
                            novos = [...tiposServico, m.value];
                            if (m.value === 'locacao' && !novos.includes('manut-rec')) {
                              novos = [...novos, 'manut-rec'];
                            }
                          }
                          setTiposServico(novos);
                          if (dadosCliente.empresa?.trim()) setNome(gerarNome(novos, dadosCliente.empresa));
                        }}
                      />
                      <span className="gerador__modelo-icone">{m.icone}</span>
                      <div className="gerador__modelo-info">
                        <strong>{m.label}</strong>
                        <span>{bloqueado ? 'Inclusa na locação' : m.sub}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="gerador__campo-grupo">
              <label className="gerador__label">Status</label>
              <select className="gerador__select" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPCOES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="gerador__campo-grupo">
              <label className="gerador__label">Vincular Lead</label>
              <select className="gerador__select" value={leadId ?? ''} onChange={e => atualizarLead(e.target.value)}>
                <option value="">— Nenhum lead —</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.empresa} ({l.bairro})</option>)}
              </select>
            </div>
            <div className="gerador__campo-grupo">
              <label className="gerador__label">Origem do Orçamento</label>
              <select className="gerador__select" value={origemOrcamento} onChange={e => setOrigemOrcamento(e.target.value)}>
                <option value="">— Não informado —</option>
                {ORIGENS_ORCAMENTO.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="gerador__campo-grupo">
              <label className="gerador__label">Validade (dias)</label>
              <input className="gerador__input" type="number" min="1" value={validadeDias} onChange={e => setValidadeDias(e.target.value)} placeholder="Ex: 15" />
            </div>
          </section>

          <section className="gerador__secao">
            <h3 className="gerador__secao-titulo">Cliente</h3>
            {['empresa', 'contato', 'email', 'telefone', 'bairro'].map(campo => (
              <div key={campo} className="gerador__campo-grupo">
                <label className="gerador__label">{campo.charAt(0).toUpperCase() + campo.slice(1)}</label>
                <input className="gerador__input" value={dadosCliente[campo] ?? ''} onChange={e => setDadosCliente(p => ({ ...p, [campo]: e.target.value }))} />
              </div>
            ))}
          </section>

          {/* campos específicos do tipo de serviço */}
          <PainelServico tipos={tiposServico} dados={dadosServico} onChange={setDadosServico} />

          <section className="gerador__secao">
            <h3 className="gerador__secao-titulo">Condições Comerciais</h3>
            <div className="gerador__campo-grupo">
              <label className="gerador__label">Desconto (%)</label>
              <input className="gerador__input" type="number" min="0" max="100" step="0.1" value={descontoPct} onChange={e => setDescontoPct(e.target.value)} placeholder="0" />
            </div>
            <div className="gerador__campo-grupo">
              <label className="gerador__label">Formas de Pagamento</label>
              <div className="gerador__checkboxes">
                {['boleto', 'pix', 'transferencia'].map(m => (
                  <label key={m} className="gerador__checkbox-label">
                    <input type="checkbox" checked={formaPagamento.includes(m)} onChange={() => togglePagamento(m)} />
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div className="gerador__campo-grupo">
              <label className="gerador__label">Observações</label>
              <textarea className="gerador__textarea" rows={4} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Condições especiais, notas, etc." />
            </div>
          </section>
        </div>

        {/* painel direito */}
        <div className="gerador__opcoes-painel">

          {/* ── Proposta Principal ── */}
          <div className="gerador__opcao gerador__opcao--principal">
            <div className="gerador__opcao-header">
              <span className="gerador__opcao-numero gerador__opcao-numero--principal">Proposta</span>
              <input className="gerador__input gerador__opcao-titulo" value={principal.titulo ?? ''} onChange={e => setPrincipal(p => ({ ...p, titulo: e.target.value }))} placeholder="Título (opcional)" />
              <select
                className="gerador__select gerador__opcao-categoria-select"
                value={principal.categoria_servico ?? ''}
                onChange={e => setPrincipal(p => ({ ...p, categoria_servico: e.target.value || null }))}
                title="Categoria desta proposta — define se o valor é único ou mensal"
              >
                <option value="">Categoria...</option>
                {tiposServico.map(t => {
                  const modelo = MODELOS_SERVICO.find(m => m.value === t);
                  return <option key={t} value={t}>{modelo?.label ?? t}</option>;
                })}
                {!tiposServico.includes('outros') && <option value="outros">Outros</option>}
              </select>
              <span className="gerador__opcao-total-badge">
                {fmt(totalPrincipal)}{CATS_MENSAIS.has(principal.categoria_servico) ? '/mês' : ''}
              </span>
            </div>

            <div className="gerador__itens">
              {principal.itens.map((it, idx) => (
                it.tipo === 'imagem'
                  ? <BlocoImagem key={it._id} item={it} onAtualizar={(c, v) => atualizarItemPrincipal(idx, c, v)} onRemover={() => removerItemPrincipal(idx)} />
                  : <LinhaItem key={it._id} item={it} onAtualizar={(c, v) => atualizarItemPrincipal(idx, c, v)} onRemover={() => removerItemPrincipal(idx)} onAbrirCatalogo={() => abrirCatalogo({ tipo: 'principal', idx })} />
              ))}

              <div className="gerador__itens-acoes">
                <button className="gerador__btn-add-item" onClick={() => { adicionarItemPrincipal(); abrirCatalogo({ tipo: 'principal', idx: principal.itens.length }); }}>
                  + Do catálogo
                </button>
                <button className="gerador__btn-add-item gerador__btn-add-item--secundario" onClick={adicionarItemPrincipal}>
                  + Item avulso
                </button>
                <button className="gerador__btn-add-item gerador__btn-add-item--secundario" onClick={() => setPrincipal(p => ({ ...p, itens: [...p.itens, novoItemImagem(p.itens.length)] }))}>
                  🖼 Imagem
                </button>
              </div>

              <div className="gerador__opcao-total-linha">
                <span>{CATS_MENSAIS.has(principal.categoria_servico) ? 'Total mensal da proposta:' : 'Total da proposta:'}</span>
                <strong>{fmt(totalPrincipal)}{CATS_MENSAIS.has(principal.categoria_servico) ? '/mês' : ''}</strong>
              </div>
            </div>
          </div>

          {/* ── Seções Adicionais ── */}
          {adicionais.map((op, oIdx) => (
            <div key={op._id} className={`gerador__opcao gerador__opcao--adicional ${op.tipo_secao === 'sugestoes' ? 'gerador__opcao--sugestoes' : ''}`}>
              <div className="gerador__opcao-header">
                <input
                  className="gerador__input gerador__opcao-titulo gerador__opcao-titulo--destaque"
                  value={op.titulo ?? ''}
                  onChange={e => atualizarOpcaoAdicional(oIdx, 'titulo', e.target.value)}
                  placeholder="Nome da seção (ex: Recepção, Sugestões de Espécies...)"
                />
                <select
                  className="gerador__select gerador__opcao-tipo-select"
                  value={op.tipo_secao ?? 'normal'}
                  onChange={e => atualizarOpcaoAdicional(oIdx, 'tipo_secao', e.target.value)}
                  title="Tipo de seção"
                >
                  <option value="normal">Com preço</option>
                  <option value="sugestoes">Sugestões (sem preço)</option>
                </select>
                <select
                  className="gerador__select gerador__opcao-categoria-select"
                  value={op.categoria_servico ?? ''}
                  onChange={e => atualizarOpcaoAdicional(oIdx, 'categoria_servico', e.target.value)}
                  title="Categoria desta seção"
                >
                  <option value="">Categoria...</option>
                  {tiposServico.map(t => {
                    const modelo = MODELOS_SERVICO.find(m => m.value === t);
                    return <option key={t} value={t}>{modelo?.label ?? t}</option>;
                  })}
                  {!tiposServico.includes('outros') && <option value="outros">Outros</option>}
                </select>
                {op.tipo_secao !== 'sugestoes' && (
                  <span className="gerador__opcao-total-badge">{fmt(calcularTotal(op))}</span>
                )}
                <button className="gerador__btn-remover-opcao" onClick={() => removerOpcaoAdicional(oIdx)} title="Remover seção">✕</button>
              </div>

              {op.tipo_secao === 'sugestoes' ? (
                <div className="gerador__sugestoes-wrap">
                  <div className="gerador__sugestoes-grid">
                    {op.itens.map((it, iIdx) => (
                      <CardSugestao key={it._id} item={it} onRemover={() => removerItemAdicional(oIdx, iIdx)} />
                    ))}
                  </div>
                  <div className="gerador__itens-acoes">
                    <button className="gerador__btn-add-item" onClick={() => { adicionarItemAdicional(oIdx); abrirCatalogo({ tipo: 'adicional', opIdx: oIdx, idx: op.itens.length }); }}>
                      + Selecionar do catálogo
                    </button>
                  </div>
                </div>
              ) : (
              <div className="gerador__itens">
                {op.itens.map((it, iIdx) => (
                  it.tipo === 'imagem'
                    ? <BlocoImagem key={it._id} item={it} onAtualizar={(c, v) => atualizarItemAdicional(oIdx, iIdx, c, v)} onRemover={() => removerItemAdicional(oIdx, iIdx)} />
                    : <LinhaItem key={it._id} item={it} onAtualizar={(c, v) => atualizarItemAdicional(oIdx, iIdx, c, v)} onRemover={() => removerItemAdicional(oIdx, iIdx)} onAbrirCatalogo={() => abrirCatalogo({ tipo: 'adicional', opIdx: oIdx, idx: iIdx })} />
                ))}

                <div className="gerador__itens-acoes">
                  <button className="gerador__btn-add-item" onClick={() => { adicionarItemAdicional(oIdx); abrirCatalogo({ tipo: 'adicional', opIdx: oIdx, idx: op.itens.length }); }}>
                    + Do catálogo
                  </button>
                  <button className="gerador__btn-add-item gerador__btn-add-item--secundario" onClick={() => adicionarItemAdicional(oIdx)}>
                    + Item avulso
                  </button>
                  <button className="gerador__btn-add-item gerador__btn-add-item--secundario" onClick={() => setAdicionais(prev => prev.map((o, i) => i === oIdx ? { ...o, itens: [...o.itens, novoItemImagem(o.itens.length)] } : o))}>
                    🖼 Imagem
                  </button>
                </div>

                {op.tipo_secao !== 'sugestoes' && (
                  <div className="gerador__opcao-total-linha">
                    <span>Total desta seção:</span>
                    <strong>{fmt(calcularTotal(op))}</strong>
                  </div>
                )}
              </div>
              )}
            </div>
          ))}

          <button className="gerador__btn-add-opcao" onClick={adicionarOpcaoAdicional}>
            + Nova Seção
          </button>

          {/* ── Galeria de Fotos (página 2) ── */}
          <div className="gerador__opcao gerador__opcao--galeria">
            <div className="gerador__opcao-header">
              <span className="gerador__opcao-numero gerador__opcao-numero--principal">🖼 Galeria de Fotos</span>
              <span className="gerador__label--info">Página 2 do PDF</span>
            </div>

            <div className="gerador__galeria-config">
              <div className="gerador__campo-grupo">
                <label className="gerador__label">Colunas</label>
                <select className="gerador__select gerador__select--sm" value={galeriaConfig.colunas} onChange={e => setGaleriaConfig(c => ({ ...c, colunas: Number(e.target.value) }))}>
                  {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="gerador__campo-grupo">
                <label className="gerador__label">Altura (px)</label>
                <select className="gerador__select gerador__select--sm" value={galeriaConfig.altura} onChange={e => setGaleriaConfig(c => ({ ...c, altura: Number(e.target.value) }))}>
                  {[150, 200, 250, 300].map(n => <option key={n} value={n}>{n}px</option>)}
                </select>
              </div>
            </div>

            <div className="gerador__galeria-itens">
              {galeriaFotos.map((foto, idx) => (
                <div key={idx} className="gerador__galeria-item-ed">
                  <img src={foto.foto_url} alt={foto.legenda || ''} className="gerador__galeria-thumb" />
                  <div className="gerador__galeria-item-campos">
                    <input className="gerador__input" value={foto.legenda} onChange={e => atualizarGaleriaFoto(idx, 'legenda', e.target.value)} placeholder="Legenda" />
                    <input className="gerador__input" value={foto.referencia} onChange={e => atualizarGaleriaFoto(idx, 'referencia', e.target.value)} placeholder="Referência botânica (opcional)" />
                  </div>
                  <div className="gerador__galeria-item-acoes">
                    <button onClick={() => moverGaleriaFoto(idx, -1)} disabled={idx === 0} title="Mover para cima">↑</button>
                    <button onClick={() => moverGaleriaFoto(idx, 1)} disabled={idx === galeriaFotos.length - 1} title="Mover para baixo">↓</button>
                    <button onClick={() => removerGaleriaFoto(idx)} title="Remover">✕</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="gerador__itens-acoes">
              <button className="gerador__btn-add-item" onClick={() => galeriaFileRef.current?.click()} disabled={galeriaUploading}>
                {galeriaUploading ? 'Enviando...' : '+ Adicionar fotos'}
              </button>
              <input ref={galeriaFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleGaleriaUpload} />
            </div>
          </div>
        </div>
      </div>

      {catalogoAberto && (
        <CatalogoModal onSelecionar={inserirCatalogo} onFechar={() => { setCatalogoAberto(false); setCatalogoAlvo(null); }} />
      )}
    </div>
  );
}
