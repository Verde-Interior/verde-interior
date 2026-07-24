// src/components/ModalConfirmar/ModalConfirmar.jsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ModalConfirmar.css';

export default function ModalConfirmar({
  titulo,
  mensagem,
  confirmLabel = 'Confirmar',
  cancelLabel  = 'Cancelar',
  variante     = 'normal',
  onConfirmar,
  onCancelar,
}) {
  const btnRef = useRef(null);

  useEffect(() => {
    btnRef.current?.focus();
    function handleKey(e) {
      if (e.key === 'Escape') onCancelar();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancelar]);

  return createPortal(
    <div className="mc-overlay" onClick={e => e.target === e.currentTarget && onCancelar()}>
      <div className="mc-modal" role="alertdialog" aria-modal="true" aria-labelledby="mc-titulo">
        <h3 className="mc-titulo" id="mc-titulo">{titulo}</h3>
        {mensagem && <p className="mc-mensagem">{mensagem}</p>}
        <div className="mc-acoes">
          <button className="mc-btn mc-btn--cancelar" onClick={onCancelar}>{cancelLabel}</button>
          <button
            ref={btnRef}
            className={`mc-btn mc-btn--confirmar mc-btn--${variante}`}
            onClick={onConfirmar}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
