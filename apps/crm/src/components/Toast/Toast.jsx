// src/components/Toast/Toast.jsx
// Sistema de toast simples e reutilizável em qualquer tela do CRM.
// Uso: const toast = useToast(); toast.show('Salvo!', 'ok');
import { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './Toast.css';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa de <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((msg, tipo = 'ok', duracao = 2800) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, tipo }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duracao);
  }, []);

  const ok    = useCallback((msg) => show(msg, 'ok'),    [show]);
  const erro  = useCallback((msg) => show(msg, 'erro'),  [show]);
  const info  = useCallback((msg) => show(msg, 'info'),  [show]);

  return (
    <ToastContext.Provider value={{ show, ok, erro, info }}>
      {children}
      {createPortal(
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast--${t.tipo}`}>
              <span className="toast__icon">
                {t.tipo === 'ok' && '✓'}
                {t.tipo === 'erro' && '✕'}
                {t.tipo === 'info' && 'ℹ'}
              </span>
              <span className="toast__msg">{t.msg}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
