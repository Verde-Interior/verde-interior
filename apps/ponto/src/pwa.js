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

// ── Detecção de plataforma / estado de instalação ─────────────────
export function isRunningAsPWA() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true; // iOS Safari
}

function isIOS() {
  const ua = navigator.userAgent || '';
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ se identifica como Mac — detectar via touch
  const iPadOSMac = ua.includes('Macintosh') && 'ontouchend' in document;
  return iOSDevice || iPadOSMac;
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent || '');
}

export function installPWA() {
  if (isRunningAsPWA()) { toast('✓ App já está instalado'); return; }

  // Android/Chromium: se o browser expôs o prompt nativo, usa ele.
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choice => {
      deferredPrompt = null;
      document.getElementById('pwa-banner')?.classList.remove('show');
      if (choice.outcome === 'accepted') toast('✓ Instalando...');
    });
    return;
  }

  // iOS Safari (ou fallback qualquer): abre modal com instruções visuais
  openInstallHelp();
}

function openInstallHelp() {
  const modal = document.getElementById('pwa-install-help');
  if (!modal) { toast('Use o menu do navegador para instalar', false); return; }
  // Mostrar seção certa conforme plataforma
  document.getElementById('pwa-help-ios')?.style.setProperty('display', isIOS()     ? 'block' : 'none');
  document.getElementById('pwa-help-and')?.style.setProperty('display', isAndroid() && !isIOS() ? 'block' : 'none');
  document.getElementById('pwa-help-oth')?.style.setProperty('display', !isIOS() && !isAndroid() ? 'block' : 'none');
  modal.classList.add('show');
}

export function closeInstallHelp() {
  document.getElementById('pwa-install-help')?.classList.remove('show');
}

export function dismissInstall() {
  document.getElementById('pwa-banner').classList.remove('show');
  localStorage.setItem('vi-pwa-dismissed', '1');
}

// Esconder botões de instalação se o app já estiver rodando como PWA
if (isRunningAsPWA()) {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-pwa-install-btn]').forEach(el => {
      el.style.display = 'none';
    });
  });
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
