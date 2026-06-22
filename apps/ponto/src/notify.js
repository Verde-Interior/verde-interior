import { state } from './store.js';
import { AUTH } from './auth.js';
import { TKEY } from './utils.js';

export function requestNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/icon-192.svg' });
}

let _notifiedEntry = '';
let _notifiedExit  = '';

export function startNotifyChecker() {
  setInterval(() => {
    const ses = AUTH.getSession();
    if (!ses || ses.role === 'gestor') return;

    const now  = new Date();
    const h    = now.getHours();
    const m    = now.getMinutes();

    const recs     = state.PS[state.cu] || [];
    const hasEntry = recs.some(p => p.type === 'entry');
    const hasExit  = recs.some(p => p.type === 'exit');

    // Lembrete de entrada às 8h05 se ainda não registrou
    if (h === 8 && m === 5 && !hasEntry && _notifiedEntry !== TKEY) {
      notify('Lembrete — Verde Interior', 'Você ainda não registrou sua entrada hoje.');
      _notifiedEntry = TKEY;
    }

    // Lembrete de saída às 18h05 se já entrou mas não saiu
    if (h === 18 && m === 5 && hasEntry && !hasExit && _notifiedExit !== TKEY) {
      notify('Lembrete — Verde Interior', 'Não esqueça de registrar sua saída!');
      _notifiedExit = TKEY;
    }
  }, 60000);
}
