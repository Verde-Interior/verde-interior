// src/components/Estoque/Estoque.jsx
import { useState } from 'react';
import PlantasTab  from './plantas/PlantasTab';
import ItensTab    from './itens/ItensTab';
import QRTab       from './qr/QRTab';
import './Estoque.css';

const ABAS = [
  { id: 'plantas',   label: 'Plantas',   icon: '🌿' },
  { id: 'insumos',   label: 'Insumos',   icon: '🧪' },
  { id: 'vasos',     label: 'Vasos',     icon: '📦' },
  { id: 'materiais', label: 'Materiais', icon: '🔧' },
  { id: 'qr',        label: 'QR Codes',  icon: '⬛' },
];

export default function Estoque() {
  const [aba, setAba] = useState('plantas');

  return (
    <div className="es">
      <header className="es__header">
        <div className="es__header-topo">
          <div>
            <h2 className="es__titulo">Estoque</h2>
            <p className="es__subtitulo">Plantas, insumos, vasos e materiais</p>
          </div>
        </div>
        <div className="es__subabas">
          {ABAS.map(a => (
            <button
              key={a.id}
              className={`es__subaba ${aba === a.id ? 'es__subaba--ativa' : ''}`}
              onClick={() => setAba(a.id)}
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      </header>

      <div className="es__conteudo">
        {aba === 'plantas'   && <PlantasTab />}
        {aba === 'insumos'   && <ItensTab categoria="insumo"   titulo="Insumos"   />}
        {aba === 'vasos'     && <ItensTab categoria="vaso"     titulo="Vasos"     />}
        {aba === 'materiais' && <ItensTab categoria="material" titulo="Materiais" />}
        {aba === 'qr'        && <QRTab />}
      </div>
    </div>
  );
}
