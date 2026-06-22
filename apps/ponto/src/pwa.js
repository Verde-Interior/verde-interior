import { toast } from './utils.js';

let deferredPrompt = null;
let newWorker = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            document.getElementById('pwa-update').classList.add('show');
          }
        });
      });
    }).catch(err => console.warn('SW error:', err));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (!localStorage.getItem('vi-pwa-dismissed')) {
    setTimeout(() => document.getElementById('pwa-banner').classList.add('show'), 2000);
  }
});

window.addEventListener('appinstalled', () => {
  document.getElementById('pwa-banner').classList.remove('show');
  deferredPrompt = null;
  toast('✓ App instalado com sucesso!');
});

export function installPWA() {
  if (!deferredPrompt) { toast('Use o menu do navegador para instalar', false); return; }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(choice => {
    deferredPrompt = null;
    document.getElementById('pwa-banner').classList.remove('show');
    if (choice.outcome === 'accepted') toast('✓ Instalando...');
  });
}

export function dismissInstall() {
  document.getElementById('pwa-banner').classList.remove('show');
  localStorage.setItem('vi-pwa-dismissed', '1');
}

export function applyUpdate() {
  if (newWorker) newWorker.postMessage('SKIP_WAITING');
  document.getElementById('pwa-update').classList.remove('show');
}

function updateOnlineStatus() {
  const bar = document.getElementById('offline-bar');
  if (!navigator.onLine) {
    bar.classList.add('show');
    document.getElementById('pwa-banner').classList.remove('show');
  } else {
    bar.classList.remove('show');
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();
