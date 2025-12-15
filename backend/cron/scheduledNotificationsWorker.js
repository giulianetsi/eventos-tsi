const cron = require('node-cron');
const db = require('../db');
const webpush = require('web-push');
const notificationModel = require('../models/notificationModel');

// Verifica a tabela scheduled_notifications a cada minuto e envia as
// notificações cujo horário já venceu.
function startScheduledNotificationsWorker() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('scheduledNotificationsWorker: pulando execução quando NODE_ENV != production');
    return;
  }

  cron.schedule('* * * * *', async () => {
    try {
      await processDue();
    } catch (err) {
      console.error('[scheduledNotificationsWorker] erro no worker', err);
    }
  });
}

async function processDue() {
  try {
    console.log('[scheduledNotificationsWorker] Verificando notificações agendadas vencidas...');
    const [updateRes] = await db.execute("UPDATE scheduled_notifications SET sent = 2 WHERE sent = 0 AND scheduled_at <= UTC_TIMESTAMP() LIMIT 50");
    const affectedRows = updateRes && (updateRes.affectedRows || updateRes.affectedRows === 0 ? updateRes.affectedRows : 0);
    console.log('[scheduledNotificationsWorker] linhas reservadas:', affectedRows);
    const [rows] = await db.execute(`SELECT id, event_id, payload, scheduled_at, attempts FROM scheduled_notifications WHERE sent = 2 AND scheduled_at <= UTC_TIMESTAMP() LIMIT 50`);
    if (!rows || rows.length === 0) {
      console.log('[scheduledNotificationsWorker] nenhuma notificação reservada para processar');
      return { reserved: 0 };
    }

    // Carregar todas as subscriptions com informações do usuário (tipo e grupos) e checar can_receive_notifications
  
    for (const notif of rows) {
      const rawPayload = notif.payload;
      let payload;
      try {
        payload = (typeof rawPayload === 'string' || Buffer.isBuffer(rawPayload)) ? rawPayload : JSON.stringify(rawPayload);
      } catch (e) {
        console.warn('[scheduledNotificationsWorker] não foi possível serializar o payload para a notificação', notif.id, e && e.message);
        payload = String(rawPayload);
      }
      console.log('[scheduledNotificationsWorker] tipo de payload para a notificação', notif.id, '=>', typeof payload, 'len=', (payload && payload.length) ? payload.length : 0);
      // Obter subscriptions elegíveis através do model (DB interaction encapsulada)
      let uniqueSubscriptions = [];
      try {
        uniqueSubscriptions = await notificationModel.getEligibleSubscriptionsForEvent(notif.event_id);
      } catch (e) {
        console.warn('[scheduledNotificationsWorker] falha ao obter inscrições elegíveis para o evento', notif.event_id, e && e.message);
        uniqueSubscriptions = [];
      }
      console.log('[scheduledNotificationsWorker] inscrições elegíveis para a notificação', notif.id, ':', uniqueSubscriptions.length);

      let successCount = 0;
      let failureCount = 0;
      for (const sub of uniqueSubscriptions) {
        const pushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } };
        try {
          await webpush.sendNotification(pushSubscription, payload);
          successCount++;
          console.log('[scheduledNotificationsWorker] push enviado para', sub.endpoint.slice(0,80));
        } catch (err) {
          failureCount++;
          console.error('[scheduledNotificationsWorker] erro ao enviar push para', sub.endpoint.slice(0,80), err && err.message ? err.message : err);
          if (err && err.statusCode === 410) {
            try { await db.execute('DELETE FROM subscriptions WHERE endpoint = ?', [sub.endpoint]); console.log('[scheduledNotificationsWorker] assinatura expirada removida', sub.endpoint.slice(0,80)); } catch(e){ console.warn('[scheduledNotificationsWorker] falha ao remover assinatura expirada', e && e.message); }
          }
        }
      }
      try {
        const nowSql = 'UTC_TIMESTAMP()';
        if (successCount > 0) {
          await db.execute('UPDATE scheduled_notifications SET sent = 1, attempts = COALESCE(attempts,0) + 1, last_attempt_at = ' + nowSql + ' WHERE id = ?', [notif.id]);
          console.log(`[scheduledNotificationsWorker] notificação ${notif.id} marcada como enviada (sucessos=${successCount}, falhas=${failureCount})`);
        } else {
          await db.execute('UPDATE scheduled_notifications SET sent = 0, attempts = COALESCE(attempts,0) + 1, last_attempt_at = ' + nowSql + ' WHERE id = ?', [notif.id]);
          console.warn(`[scheduledNotificationsWorker] nenhum envio bem-sucedido para a notificação ${notif.id} (sucessos=0, falhas=${failureCount}); voltando para pendente para nova tentativa`);
        }
      } catch (e) {
        console.error('[scheduledNotificationsWorker] erro ao atualizar status em scheduled_notifications', e && e.message ? e.message : e);
      }
    }

    // Limpeza: remover notificações enviadas há mais de 5 dias
    try {
      const [cleanRes] = await db.execute("DELETE FROM scheduled_notifications WHERE sent = 1 AND scheduled_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 DAY)");
      const deleted = cleanRes && cleanRes.affectedRows ? cleanRes.affectedRows : 0;
      if (deleted > 0) console.log('[scheduledNotificationsWorker] notificações enviadas antigas removidas:', deleted);
    } catch (e) {
      console.error('[scheduledNotificationsWorker] erro ao limpar notificações enviadas antigas', e && e.message ? e.message : e);
    }
    return { reserved: rows.length };
  } catch (err) {
    console.error('[scheduledNotificationsWorker] erro no worker', err);
    throw err;
  }
}

module.exports = { startScheduledNotificationsWorker, processDue };
