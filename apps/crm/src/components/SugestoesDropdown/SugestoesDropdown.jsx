// src/components/SugestoesDropdown/SugestoesDropdown.jsx
import './SugestoesDropdown.css';

// Menu de sugestões usado nos campos de busca "digite e apareça" (Clientes,
// Mapa, Pipeline, Relatórios). onMouseDown (não onClick) pra selecionar antes
// do blur do input fechar o menu.
export default function SugestoesDropdown({ itens, indiceAtivo, onSelecionar, onHover }) {
  return (
    <ul className="sugestoes-dropdown" role="listbox">
      {itens.length === 0 ? (
        <li className="sugestoes-dropdown__vazio">Nenhum resultado encontrado</li>
      ) : (
        itens.map((item, i) => (
          <li
            key={item.id}
            role="option"
            aria-selected={i === indiceAtivo}
            className={`sugestoes-dropdown__item ${i === indiceAtivo ? 'sugestoes-dropdown__item--ativo' : ''}`}
            onMouseDown={() => onSelecionar(item)}
            onMouseEnter={() => onHover?.(i)}
          >
            <span className="sugestoes-dropdown__label">{item.label}</span>
            {item.sublabel && <span className="sugestoes-dropdown__sublabel">{item.sublabel}</span>}
          </li>
        ))
      )}
    </ul>
  );
}
