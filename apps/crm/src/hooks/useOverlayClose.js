import { useRef } from 'react';

// Retorna props { onMouseDown, onClick } para o div de overlay de um modal.
// Evita fechar o modal quando o usuário seleciona texto dentro e solta o mouse fora:
// só fecha se o clique COMEÇOU no overlay (não foi um arrastar de dentro pra fora).
export function useOverlayClose(onClose) {
  const startedOnOverlay = useRef(false);
  return {
    onMouseDown: (e) => { startedOnOverlay.current = e.target === e.currentTarget; },
    onClick:     (e) => { if (startedOnOverlay.current && e.target === e.currentTarget) onClose?.(); },
  };
}
