// src/components/Estoque/plantas/ModalNovoPatrimonio.jsx
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/Toast';

export default function ModalNovoPatrimonio({ especies, onFechar, onSalvo }) {
  const toast = useToast();
  const [form, setForm] = useState({ especie_id: '', localizacao: '', obs: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); setErro(''); }

  async function salvar() {
    if (!form.especie_id) { setErro('Selecione a espécie.'); return; }
    setSalvando(true);

    // Gera QR code via função do banco
    const { data: qr, error: eQr } = await supabase.rpc('gerar_qr_codigo_patrimonio');
    if (eQr) { toast.erro('Erro ao gerar código: ' + eQr.message); setSalvando(false); return; }

    const id = crypto.randomUUID();
    const { error: ePat } = await supabase.from('estoque_patrimonios').insert({
      id,
      qr_codigo:           qr,
      especie_id:          form.especie_id,
      status:              'disponivel',
      localizacao_interna: form.localizacao.trim() || null,
      observacoes:         form.obs.trim() || null,
    });
    if (ePat) { toast.erro('Erro ao cadastrar: ' + ePat.message); setSalvando(false); return; }

    await supabase.from('estoque_eventos').insert({
      patrimonio_id: id,
      tipo:          'cadastro',
      observacoes:   form.obs.trim() || null,
    });

    toast.ok(`Planta cadastrada — ${qr}`);
    setSalvando(false);
    onSalvo?.();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvando && onFechar()}>
      <div className="modal">
        <header className="modal__header">
          <div className="modal__header-info">
            <h2 className="modal__empresa">Nova planta</h2>
            <p className="modal__subinfo">Um código QR será gerado automaticamente</p>
          </div>
          <button className="modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="modal__body">
          <div className="mm__campo">
            <label className="modal__label">Espécie <span className="modal__obrigatorio">*</span></label>
            <select className="modal__select" value={form.especie_id} onChange={e => setF('especie_id', e.target.value)}>
              <option value="">Selecione a espécie...</option>
              {especies.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            {erro && <p className="modal__erro-msg">{erro}</p>}
          </div>

          <div className="mm__campo">
            <label className="modal__label">Localização interna</label>
            <input
              className="modal__input"
              placeholder="Ex: Estufa A, Prateleira 2"
              value={form.localizacao}
              onChange={e => setF('localizacao', e.target.value)}
            />
          </div>

          <div className="mm__campo">
            <label className="modal__label">Observações</label>
            <textarea
              className="modal__textarea"
              rows={3}
              placeholder="Condição da planta, origem, etc."
              value={form.obs}
              onChange={e => setF('obs', e.target.value)}
            />
          </div>
        </div>

        <footer className="modal__footer">
          <button className="modal__btn modal__btn--cancelar" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="modal__btn modal__btn--salvar" onClick={salvar} disabled={salvando || !form.especie_id}>
            {salvando ? 'Cadastrando...' : 'Cadastrar planta'}
          </button>
        </footer>
      </div>
    </div>
  );
}
