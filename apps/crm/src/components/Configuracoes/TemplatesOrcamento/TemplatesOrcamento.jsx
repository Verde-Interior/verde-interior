// src/components/Configuracoes/TemplatesOrcamento/TemplatesOrcamento.jsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import './TemplatesOrcamento.css';

const TIPOS = [
  { value: 'venda',      label: 'Venda',         icone: '🛒' },
  { value: 'reforma',    label: 'Reforma',        icone: '🔧' },
  { value: 'locacao',    label: 'Locação',        icone: '📋' },
  { value: 'manut-rec',  label: 'Manutenção',     icone: '🌿' },
  { value: 'manut-pont', label: 'Manut. Pontual', icone: '🔍' },
  { value: 'eventos',    label: 'Eventos',        icone: '🎪' },
  { value: 'outros',     label: 'Outros',         icone: '📦' },
];

const FALLBACK = {
  venda: [
    'Fornecimento e instalação das espécies ornamentais selecionadas',
    'Vasos com manta de bidim, argila expandida e casca de pinus polida',
    'Substratos, vitaminas e aminoácidos para desenvolvimento das espécies',
    'Prato coletor de água incluso em todos os vasos de chão',
    'Aplicação de fertilizantes e estabilizantes nas plantas',
    'Frete e instalação inclusos',
  ],
  reforma: [
    'Remoção das espécies antigas e do substrato',
    'Preenchimento interno com manta de bidim e argila expandida',
    'Instalação das novas espécies em potes individuais para cada muda',
    'Utilização do vaso do cliente como cachepô (não será plantado)',
    'Forração e acabamento com casca de pinus polida e tratada',
    'Frete e mão de obra inclusos',
  ],
  locacao: [
    'Locação de vasos e plantas ornamentais em regime mensal',
    'Manutenção recorrente inclusa (rega, poda, adubação, limpeza)',
    'Reposição ilimitada de espécies em caso de morte ou dano',
    'Retirada dos vasos ao final do contrato sem custo adicional',
    'Frete inclusos',
  ],
  'manut-rec': [
    'Visitas técnicas recorrentes conforme frequência contratada',
    'Rega, poda e limpeza das folhagens',
    'Adubação e aplicação de fertilizantes',
    'Verificação de pragas e doenças, com tratamento fitossanitário',
    'Substituição do substrato quando necessário',
    'Aplicação de vitaminas e aminoácidos',
    'Relatório fotográfico das visitas',
    'Comunicação direta com responsável do cliente',
    'Frete e mão de obra inclusos',
  ],
  'manut-pont': [
    'Visita técnica única para diagnóstico e cuidado das plantas',
    'Rega, poda, limpeza e adubação',
    'Aplicação de fertilizantes e vitaminas',
    'Verificação e tratamento fitossanitário',
    'Relatório fotográfico da visita',
    'Frete inclusos',
  ],
  eventos: [
    'Locação de vasos e plantas ornamentais para o período do evento',
    'Entrega, montagem no local e retirada ao final',
    'Frete de entrega e retirada inclusos',
    'Suporte durante o evento (mediante contratação)',
  ],
  outros: [],
};

export default function TemplatesOrcamento() {
  const [tipoAtivo, setTipoAtivo]   = useState('venda');
  const [templates, setTemplates]   = useState({});
  const [texto, setTexto]           = useState('');
  const [salvando, setSalvando]     = useState(false);
  const [statusMsg, setStatusMsg]   = useState('');
  const [carregando, setCarregando] = useState(true);
  const textareaRef = useRef(null);

  useEffect(() => {
    carregarTodos();
  }, []);

  useEffect(() => {
    const descricoes = templates[tipoAtivo] ?? FALLBACK[tipoAtivo] ?? [];
    setTexto(descricoes.join('\n'));
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [tipoAtivo, templates]);

  async function carregarTodos() {
    setCarregando(true);
    try {
      const { data } = await supabase.from('orcamento_templates_servico').select('tipo_servico, descricoes');
      if (data?.length) {
        const map = {};
        data.forEach(row => { map[row.tipo_servico] = row.descricoes ?? []; });
        setTemplates(map);
      }
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    } finally {
      setCarregando(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setStatusMsg('');
    try {
      const descricoes = texto
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from('orcamento_templates_servico')
        .upsert({ tipo_servico: tipoAtivo, descricoes }, { onConflict: 'tipo_servico' });

      if (error) throw error;

      setTemplates(prev => ({ ...prev, [tipoAtivo]: descricoes }));
      setStatusMsg('salvo');
    } catch (err) {
      console.error('Erro ao salvar template:', err);
      setStatusMsg('erro');
    } finally {
      setSalvando(false);
      setTimeout(() => setStatusMsg(''), 2500);
    }
  }

  async function restaurarPadrao() {
    const padrao = FALLBACK[tipoAtivo] ?? [];
    setTexto(padrao.join('\n'));

    setSalvando(true);
    try {
      const { error } = await supabase
        .from('orcamento_templates_servico')
        .upsert({ tipo_servico: tipoAtivo, descricoes: padrao }, { onConflict: 'tipo_servico' });

      if (error) throw error;
      setTemplates(prev => ({ ...prev, [tipoAtivo]: padrao }));
      setStatusMsg('salvo');
    } catch (err) {
      console.error('Erro ao restaurar padrão:', err);
      setStatusMsg('erro');
    } finally {
      setSalvando(false);
      setTimeout(() => setStatusMsg(''), 2500);
    }
  }

  const tipoInfo = TIPOS.find(t => t.value === tipoAtivo);
  const totalLinhas = texto.split('\n').filter(l => l.trim()).length;

  return (
    <div className="tmpl">
      <div className="tmpl__tipos">
        {TIPOS.map(t => (
          <button
            key={t.value}
            className={`tmpl__tipo-btn ${tipoAtivo === t.value ? 'tmpl__tipo-btn--ativo' : ''}`}
            onClick={() => setTipoAtivo(t.value)}
          >
            <span>{t.icone}</span>
            <span>{t.label}</span>
            {templates[t.value] !== undefined && (
              <span className="tmpl__tipo-badge">{(templates[t.value] ?? []).length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="tmpl__editor">
        <div className="tmpl__editor-header">
          <span className="tmpl__editor-titulo">
            {tipoInfo?.icone} {tipoInfo?.label}
          </span>
          <span className="tmpl__editor-hint">Uma descrição por linha · {totalLinhas} itens</span>
        </div>

        {carregando ? (
          <div className="tmpl__loading">Carregando...</div>
        ) : (
          <textarea
            ref={textareaRef}
            className="tmpl__textarea"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder={`Digite uma descrição por linha...\nEx: Fornecimento e instalação das espécies\nFrete e instalação inclusos`}
            rows={12}
          />
        )}

        <div className="tmpl__acoes">
          <button
            className="tmpl__btn-restaurar"
            onClick={restaurarPadrao}
            disabled={salvando}
            title="Volta para as descrições padrão do sistema"
          >
            ↺ Restaurar padrão
          </button>
          <div className="tmpl__acoes-dir">
            {statusMsg === 'salvo' && <span className="tmpl__status tmpl__status--ok">✓ Salvo</span>}
            {statusMsg === 'erro' && <span className="tmpl__status tmpl__status--erro">✗ Erro ao salvar</span>}
            <button
              className="tmpl__btn-salvar"
              onClick={salvar}
              disabled={salvando || carregando}
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
