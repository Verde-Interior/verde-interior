import { supabase } from './supabase.js';
import { state } from './store.js';
import { AUTH } from './auth.js';
import { getHoje } from './utils.js';

export function requestNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/icon-192.svg' });
}

let _notifiedEntry    = '';
let _notifiedExit     = '';
let _notifiedCheckout = '';

export function startNotifyChecker() {
  setInterval(async () => {
    const ses = AUTH.getSession();
    if (!ses || ses.role === 'gestor') return;

    const now    = new Date();
    const h      = now.getHours();
    const m      = now.getMinutes();
    const nowMin = h * 60 + m;
    const hoje   = getHoje();

    const empIdx = state.EMP.findIndex(e => e.id === ses.employee_id);
    const idx    = empIdx >= 0 ? empIdx : state.cu;
    const recs   = state.PS[idx] || [];
    const hasEntry = recs.some(p => p.type === 'entry');
    const hasExit  = recs.some(p => p.type === 'exit');

    // Lembrete de entrada às 8h05 se ainda não registrou
    if (h === 8 && m === 5 && !hasEntry && _notifiedEntry !== hoje) {
      notify('Lembrete — Verde Interior', 'Você ainda não registrou sua entrada hoje.');
      _notifiedEntry = hoje;
    }

    // Lembrete de saída: entrada + jornada + 5 min de tolerância
    if (hasEntry && !hasExit && _notifiedExit !== hoje) {
      const entryRec = recs.find(p => p.type === 'entry');
      const emp      = state.EMP[idx];
      if (entryRec && emp) {
        const [eh, em]     = entryRec.time.split(':').map(Number);
        const expectedExit = eh * 60 + em + emp.j * 60 + 5;
        if (nowMin >= expectedExit) {
          notify('Lembrete — Verde Interior', 'Não esqueça de registrar sua saída!');
          _notifiedExit = hoje;
        }
      }
    }

    // Lembrete de checkout de campo: após 17h, se tem relatorio aberto (checkin sem checkout)
    if (h >= 17 && _notifiedCheckout !== hoje) {
      const emp = state.EMP[idx];
      if (emp?.id) {
        const { data: agendas } = await supabase
          .from('agenda')
          .select('id')
          .eq('funcionario_id', emp.id)
          .eq('data_agendada', hoje);

        if (agendas?.length) {
          const { data: openRels } = await supabase
            .from('relatorios')
            .select('id')
            .in('agendamento_id', agendas.map(a => a.id))
            .not('checkin_at', 'is', null)
            .is('checkout_at', null);

          if (openRels?.length) {
            notify('Checkout pendente — Verde Interior', 'Você tem um atendimento sem finalizar. Abra o app e registre o checkout.');
            _notifiedCheckout = hoje;
          }
        }
      }
    }
  }, 60000);
}
