// src/components/Orcamentos/OrcamentoPreview/OrcamentoPreview.jsx
import { useRef, useEffect, useState } from 'react';
import { gerarTituloAutomatico } from '../../../lib/orcamento-titulo';
import { carregarTemplates, montarBullets } from '../../../lib/orcamento-templates';
import './OrcamentoPreview.css';

const CATS_MENSAIS = new Set(['locacao', 'manut-rec']);
const PAGAMENTO_LABEL = { boleto: 'Boleto Bancário', pix: 'PIX', transferencia: 'Transferência Bancária' };

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);
}

function fmtData(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDataExtenso(date = new Date()) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function calcularTotal(opcao) {
  return (opcao?.itens ?? []).reduce((s, it) => s + (Number(it.preco_unitario) * Number(it.quantidade)), 0);
}

// ── Campo editável (contenteditable) ─────────────────────────────────────────
function CampoEditavel({ chave, valor, className, tag: Tag = 'div', overrides, onSalvar }) {
  const ref = useRef(null);
  const valorAtual = overrides?.[chave] ?? valor;

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current && ref.current.innerText !== valorAtual) {
      ref.current.innerText = valorAtual ?? '';
    }
  }, [valorAtual]);

  function handleBlur() {
    const novo = ref.current?.innerText?.trim() ?? '';
    if (novo !== (valorAtual ?? '').trim()) onSalvar?.(chave, novo);
  }

  return (
    <Tag
      ref={ref}
      className={`${className ?? ''} prev__editavel`}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      title="Clique para editar"
    />
  );
}

// ── Título automático editável ────────────────────────────────────────────────
function TituloDoc({ tiposArr, overrides, onSalvar }) {
  const ref  = useRef(null);
  const auto = gerarTituloAutomatico(tiposArr);
  const valor = overrides?.tituloDocumento ?? auto;

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.innerText = valor;
    }
  }, [valor]);

  function handleBlur() {
    const novo = ref.current?.innerText?.trim() ?? '';
    if (!novo || novo === auto) {
      onSalvar?.('tituloDocumento', null);
      if (ref.current) ref.current.innerText = auto;
    } else if (novo !== valor) {
      onSalvar?.('tituloDocumento', novo);
    }
  }

  function handleDblClick() {
    onSalvar?.('tituloDocumento', null);
    if (ref.current) ref.current.innerText = auto;
  }

  return (
    <h1
      ref={ref}
      className="prev__doc-titulo-principal prev__editavel"
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onDoubleClick={handleDblClick}
      title="Clique para editar · Duplo-clique para título automático"
    />
  );
}

// ── Bloco "Serviços a serem executados" ──────────────────────────────────────
function BlocoServicos({ tiposArr, dadosServico }) {
  const [dbTemplates, setDbTemplates] = useState({});

  useEffect(() => {
    if (!tiposArr?.length) return;
    carregarTemplates(tiposArr).then(setDbTemplates);
  }, [tiposArr.join(',')]);

  const bullets = montarBullets(tiposArr, dbTemplates, dadosServico);
  if (!bullets.length) return null;

  return (
    <div className="prev__bloco prev__bloco--servicos">
      <div className="prev__bloco-tit">Serviços a serem executados</div>
      <ul className="prev__servicos-lista">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    </div>
  );
}

// ── Bloco de investimento (tabela de itens) ───────────────────────────────────
function BlocoInvestimento({ titulo, cor, secoes, pct, mensal }) {
  // Flatten rows: section headers + product rows
  const linhas = [];
  let cont = 0;
  secoes.forEach((secao, sIdx) => {
    const prods = (secao.itens ?? []).filter(it => it.tipo !== 'extra' && it.tipo !== 'imagem' && it.nome?.trim());
    if (secao.titulo && prods.length > 0) {
      linhas.push({ tipo: 'header', key: `h${sIdx}`, titulo: secao.titulo });
    }
    prods.forEach((it, iIdx) => {
      cont++;
      linhas.push({ tipo: 'item', key: it._id ?? `${sIdx}-${iIdx}`, it, num: cont });
    });
  });

  const extras = secoes.flatMap(s => (s.itens ?? []).filter(it => it.tipo === 'extra' && it.nome?.trim()));
  if (!linhas.length && !extras.length) return null;

  const subtotal = secoes.reduce((s, op) => s + calcularTotal(op), 0);
  const desconto = subtotal * (pct || 0) / 100;
  const total    = subtotal - desconto;

  return (
    <div className={`prev__bloco-invest prev__bloco-invest--${cor}`}>
      <div className="prev__bloco-invest-tit">{titulo}</div>

      {linhas.length > 0 && (
        <table className="prev__tabela">
          <thead>
            <tr>
              <th className="prev__th-n">#</th>
              <th>Produto / Serviço</th>
              <th className="prev__th-espec">Especificações</th>
              <th className="prev__th-n">Qtd</th>
              <th className="prev__th-v">Unit.</th>
              <th className="prev__th-v">Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(linha => {
              if (linha.tipo === 'header') {
                return (
                  <tr key={linha.key} className="prev__tr-secao">
                    <td colSpan={6}>{linha.titulo}</td>
                  </tr>
                );
              }
              const { it, num } = linha;
              const espec = [it.modelo_vaso, it.cor_vaso, it.tamanho_vaso].filter(Boolean).join(' · ');
              const total = Number(it.preco_unitario) * Number(it.quantidade);
              return (
                <tr key={linha.key}>
                  <td className="prev__td-n">{num}</td>
                  <td>
                    <div className="prev__td-prod">
                      {it.foto_url && <img src={it.foto_url} alt="" className="prev__thumb" />}
                      <div>
                        <div className="prev__td-nome">{it.nome_planta || it.nome}</div>
                        {it.descricao && <div className="prev__td-desc">{it.descricao}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="prev__td-espec">{espec}</td>
                  <td className="prev__td-n">{it.quantidade}</td>
                  <td className="prev__td-v">{fmt(Number(it.preco_unitario))}</td>
                  <td className="prev__td-v prev__td-bold">{fmt(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {extras.length > 0 && (
        <div className="prev__extras">
          <div className="prev__extras-tit">Custos adicionais</div>
          {extras.map((it, i) => (
            <div key={i} className="prev__extra-linha">
              <span>{it.nome}</span>
              <span>{fmt(Number(it.preco_unitario))}</span>
            </div>
          ))}
        </div>
      )}

      <div className="prev__invest-total">
        {pct > 0 && (
          <>
            <div className="prev__total-linha">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="prev__total-linha prev__total-desc">
              <span>Desconto ({pct}%)</span>
              <span>− {fmt(desconto)}</span>
            </div>
          </>
        )}
        <div className="prev__total-linha prev__total-final">
          <span>Total {mensal ? 'mensal' : 'da proposta'}</span>
          <strong>{fmt(total)}{mensal ? '/mês' : ''}</strong>
        </div>
      </div>
    </div>
  );
}

// ── Card de valor total consolidado ──────────────────────────────────────────
function CardValorTotal({ totalUnico, totalMensal, pct, totalUnicoBruto, totalMensalBruto }) {
  const temUnico  = totalUnico  > 0;
  const temMensal = totalMensal > 0;
  if (!temUnico && !temMensal) return null;

  return (
    <div className="prev__card-total">
      <div className="prev__card-total-tit">Valor Total da Proposta</div>
      <div className="prev__card-total-corpo">
        {temUnico && (
          <div className="prev__card-total-item">
            <div className="prev__card-total-label">Investimento único</div>
            <div className="prev__card-total-valor">{fmt(totalUnico)}</div>
            {pct > 0 && <div className="prev__card-total-sub">de {fmt(totalUnicoBruto)}</div>}
          </div>
        )}
        {temUnico && temMensal && <div className="prev__card-total-sep">+</div>}
        {temMensal && (
          <div className="prev__card-total-item">
            <div className="prev__card-total-label">Recorrente mensal</div>
            <div className="prev__card-total-valor">{fmt(totalMensal)}<small>/mês</small></div>
            {pct > 0 && <div className="prev__card-total-sub">de {fmt(totalMensalBruto)}/mês</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Condições comerciais ──────────────────────────────────────────────────────
function BlocoCondicoes({ formaPagamento, validadeDias, dadosServico, tiposArr }) {
  const linhas = [];
  if (formaPagamento?.length) {
    linhas.push(['Formas de pagamento', formaPagamento.map(m => PAGAMENTO_LABEL[m] ?? m).join(' · ')]);
  }
  if (validadeDias) {
    linhas.push(['Validade da proposta', `${validadeDias} dias corridos`]);
  }
  if (tiposArr.includes('locacao') && dadosServico?.prazoMeses) {
    linhas.push(['Fidelidade mínima', `${dadosServico.prazoMeses} meses`]);
  }
  if (dadosServico?.frequencia && (tiposArr.includes('locacao') || tiposArr.includes('manut-rec'))) {
    linhas.push(['Frequência de visita', dadosServico.frequencia]);
  }
  if (tiposArr.includes('eventos') && dadosServico?.dataEntrega) {
    const hora = dadosServico.horaEntrega ? ` às ${dadosServico.horaEntrega}` : '';
    linhas.push(['Entrega do evento', `${fmtData(dadosServico.dataEntrega)}${hora}`]);
  }
  if (tiposArr.includes('eventos') && dadosServico?.dataRetirada) {
    const hora = dadosServico.horaRetirada ? ` às ${dadosServico.horaRetirada}` : '';
    linhas.push(['Retirada do evento', `${fmtData(dadosServico.dataRetirada)}${hora}`]);
  }
  if (!linhas.length) return null;

  return (
    <div className="prev__bloco prev__bloco--condicoes">
      <div className="prev__bloco-tit">Condições Comerciais</div>
      <div className="prev__cond-grid">
        {linhas.map(([k, v]) => (
          <div key={k} className="prev__cond-item">
            <span className="prev__cond-label">{k}:</span>
            <span className="prev__cond-valor">{v}</span>
          </div>
        ))}
      </div>
      <div className="prev__incluso">
        <strong>Incluso no orçamento:</strong> Compra de todos os materiais para execução dos serviços e mão de obra. Frete e impostos inclusos.
      </div>
    </div>
  );
}

// ── Assinaturas ───────────────────────────────────────────────────────────────
function BlocoAssinaturas({ dadosCliente }) {
  return (
    <div className="prev__assinaturas">
      <div className="prev__assinatura">
        <div className="prev__assinatura-linha" />
        <div className="prev__assinatura-nome">Verde Interior Paisagismo LTDA</div>
        <div className="prev__assinatura-detalhe">CNPJ: 22.846.244/0001-22</div>
      </div>
      <div className="prev__assinatura">
        <div className="prev__assinatura-linha" />
        <div className="prev__assinatura-nome">{dadosCliente?.contato || 'Cliente'}</div>
        {dadosCliente?.empresa && <div className="prev__assinatura-detalhe">{dadosCliente.empresa}</div>}
      </div>
    </div>
  );
}

// ── Galeria de fotos (página 2) ───────────────────────────────────────────────
function PaginaGaleria({ fotos, config }) {
  if (!fotos?.length) return null;
  const colunas = config?.colunas ?? 2;
  const altura  = config?.altura  ?? 200;

  return (
    <div className="prev__pagina-2">
      <div className="prev__documento">
        <header className="prev__doc-header">
          <img
            src="/brand/simbolo-verde-interior.png"
            alt="Verde Interior"
            className="prev__logo-img"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="prev__doc-cliente-topo">
            <div className="prev__doc-cliente-linha">Galeria de Fotos do Projeto</div>
            <div className="prev__doc-data">São Paulo, {fmtDataExtenso()}</div>
          </div>
        </header>

        <div
          className="prev__galeria-grid"
          style={{ gridTemplateColumns: `repeat(${colunas}, 1fr)` }}
        >
          {fotos.map((foto, i) => (
            <div key={i} className="prev__galeria-item">
              <img
                src={foto.foto_url}
                alt={foto.legenda || ''}
                className="prev__galeria-foto"
                style={{ height: altura }}
              />
              {foto.legenda    && <div className="prev__galeria-legenda">{foto.legenda}</div>}
              {foto.referencia && <div className="prev__galeria-ref">{foto.referencia}</div>}
            </div>
          ))}
        </div>

        <footer className="prev__rodape">
          <div className="prev__rodape-empresa">
            <strong>VERDE INTERIOR PAISAGISMO LTDA</strong>
            <div>CNPJ: 22.846.244/0001-22</div>
          </div>
          <div className="prev__rodape-contato">
            <div>🌐 verdeinterior.com.br</div>
            <div>✉ contato@verdeinterior.com.br</div>
            <div>📞 (11) 4106-1266 · (11) 96577-7677</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── Preview principal ─────────────────────────────────────────────────────────
export default function OrcamentoPreview({ dados, previewOverrides = {}, onOverrideChange, onFechar }) {
  const {
    tiposServico, tipoServico,
    dadosCliente, dadosServico,
    formaPagamento, validadeDias, observacoes,
    principal, adicionais,
    descontoPct, numeroOrc,
    galeriaFotos, galeriaConfig,
  } = dados;

  const tiposArr = tiposServico?.length ? tiposServico : [tipoServico ?? 'outros'];
  const or = previewOverrides;
  const sv = onOverrideChange;

  // Separar seções: mensais vs únicas
  const todasSecoes = [principal, ...(adicionais ?? [])].filter(Boolean);
  const algumTemCat = todasSecoes.some(s => s.categoria_servico);

  const secoesUnico  = algumTemCat
    ? todasSecoes.filter(s => !CATS_MENSAIS.has(s.categoria_servico))
    : todasSecoes;
  const secoesMensal = algumTemCat
    ? todasSecoes.filter(s => CATS_MENSAIS.has(s.categoria_servico))
    : [];

  const pct              = Number(descontoPct) || 0;
  const totalUnicoBruto  = secoesUnico.reduce((s, op) => s + calcularTotal(op), 0);
  const totalMensalBruto = secoesMensal.reduce((s, op) => s + calcularTotal(op), 0);
  const totalUnicoLiq    = totalUnicoBruto  * (1 - pct / 100);
  const totalMensalLiq   = totalMensalBruto * (1 - pct / 100);
  const temMensal        = secoesMensal.length > 0 && totalMensalBruto > 0;

  const tituloCabecalho = [
    dadosCliente?.contato && `AC ${dadosCliente.contato}`,
    dadosCliente?.empresa,
  ].filter(Boolean).join(' — ');

  return (
    <div className="prev__tela">
      {/* barra de controle */}
      <div className="prev__controles no-print">
        <button className="prev__btn-voltar" onClick={onFechar}>← Voltar ao editor</button>
        <span className="prev__hint-editar">Clique nos textos para editar · Duplo-clique no título para modo automático</span>
        <button className="prev__btn-imprimir" onClick={() => window.print()}>🖨 Imprimir / Salvar PDF</button>
      </div>

      {/* documento principal */}
      <div className="prev__documento">

        {/* cabeçalho: logo + cliente + ORC */}
        <header className="prev__doc-header">
          <img
            src="/brand/simbolo-verde-interior.png"
            alt="Verde Interior"
            className="prev__logo-img"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="prev__doc-cliente-topo">
            {tituloCabecalho && (
              <CampoEditavel
                chave="hdr-cliente"
                valor={tituloCabecalho}
                className="prev__doc-cliente-linha"
                overrides={or}
                onSalvar={sv}
              />
            )}
            {(dadosCliente?.email || dadosCliente?.telefone || dadosCliente?.bairro) && (
              <div className="prev__doc-cliente-contato">
                {dadosCliente.email    && <CampoEditavel chave="cli-email"  valor={dadosCliente.email}    className="prev__doc-cliente-detalhe" overrides={or} onSalvar={sv} />}
                {dadosCliente.telefone && <CampoEditavel chave="cli-tel"    valor={dadosCliente.telefone} className="prev__doc-cliente-detalhe" overrides={or} onSalvar={sv} />}
                {dadosCliente.bairro   && <CampoEditavel chave="cli-bairro" valor={dadosCliente.bairro}   className="prev__doc-cliente-detalhe" overrides={or} onSalvar={sv} />}
              </div>
            )}
            <div className="prev__doc-data">
              {numeroOrc && <span className="prev__numero-orc">{numeroOrc} · </span>}
              São Paulo, {fmtDataExtenso()}
            </div>
          </div>
        </header>

        {/* título editável */}
        <TituloDoc tiposArr={tiposArr} overrides={or} onSalvar={sv} />

        {/* serviços a serem executados */}
        <BlocoServicos tiposArr={tiposArr} dadosServico={dadosServico} />

        {/* investimento único */}
        <BlocoInvestimento
          titulo="Proposta Comercial — Investimento Único"
          cor="verde"
          secoes={secoesUnico}
          pct={pct}
          mensal={false}
        />

        {/* investimento mensal */}
        {temMensal && (
          <BlocoInvestimento
            titulo="Proposta Comercial — Investimento Mensal"
            cor="teal"
            secoes={secoesMensal}
            pct={pct}
            mensal={true}
          />
        )}

        {/* card de valor total (desconto ou misto) */}
        {(temMensal || pct > 0) && (
          <CardValorTotal
            totalUnico={totalUnicoLiq}
            totalMensal={totalMensalLiq}
            pct={pct}
            totalUnicoBruto={totalUnicoBruto}
            totalMensalBruto={totalMensalBruto}
          />
        )}

        {/* condições comerciais + incluso */}
        <BlocoCondicoes
          formaPagamento={formaPagamento}
          validadeDias={validadeDias}
          dadosServico={dadosServico}
          tiposArr={tiposArr}
        />

        {/* observações */}
        {observacoes && (
          <div className="prev__observacoes">
            <div className="prev__secao-tit">Observações</div>
            <CampoEditavel chave="obs" valor={observacoes} tag="p" overrides={or} onSalvar={sv} />
          </div>
        )}

        {/* assinaturas */}
        <BlocoAssinaturas dadosCliente={dadosCliente} />

        {/* rodapé */}
        <footer className="prev__rodape">
          <div className="prev__rodape-empresa">
            <strong>VERDE INTERIOR PAISAGISMO LTDA</strong>
            <div>CNPJ: 22.846.244/0001-22</div>
          </div>
          <div className="prev__rodape-contato">
            <div>🌐 verdeinterior.com.br</div>
            <div>✉ contato@verdeinterior.com.br</div>
            <div>📞 (11) 4106-1266 · (11) 96577-7677</div>
          </div>
        </footer>
      </div>

      {/* página 2: galeria */}
      <PaginaGaleria fotos={galeriaFotos} config={galeriaConfig} />
    </div>
  );
}
