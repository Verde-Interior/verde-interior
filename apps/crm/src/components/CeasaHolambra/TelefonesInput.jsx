// src/components/CeasaHolambra/TelefonesInput.jsx
// Lista editável de telefones com rótulo personalizado (Financeiro, Vendas...)
// e marcação de qual número é WhatsApp — substitui os antigos campos fixos
// "Telefone" e "WhatsApp" de ceasa_prospects.
const VAZIO_TEL = { numero: '', rotulo: '', whatsapp: false };

export default function TelefonesInput({ value, onChange }) {
  const telefones = value ?? [];

  function atualizar(i, campo, val) {
    onChange(telefones.map((t, idx) => (idx === i ? { ...t, [campo]: val } : t)));
  }

  function adicionar() {
    onChange([...telefones, { ...VAZIO_TEL }]);
  }

  function remover(i) {
    onChange(telefones.filter((_, idx) => idx !== i));
  }

  return (
    <div className="ceasa__telefones">
      {telefones.length === 0 && (
        <p className="ceasa__telefones-vazio">Nenhum telefone cadastrado.</p>
      )}
      {telefones.map((t, i) => (
        <div key={i} className="ceasa__telefone-linha">
          <input
            className="ceasa__telefone-numero"
            value={t.numero}
            onChange={(e) => atualizar(i, 'numero', e.target.value)}
            placeholder="(11) 9999-9999"
          />
          <input
            className="ceasa__telefone-rotulo"
            value={t.rotulo}
            onChange={(e) => atualizar(i, 'rotulo', e.target.value)}
            placeholder="Rótulo (Financeiro, Vendas...)"
          />
          <label className="ceasa__telefone-wpp">
            <input
              type="checkbox"
              checked={!!t.whatsapp}
              onChange={(e) => atualizar(i, 'whatsapp', e.target.checked)}
            />
            WhatsApp
          </label>
          <button type="button" className="ceasa__telefone-remover" onClick={() => remover(i)} title="Remover número">✕</button>
        </div>
      ))}
      <button type="button" className="ceasa__telefone-adicionar" onClick={adicionar}>+ Adicionar número</button>
    </div>
  );
}
