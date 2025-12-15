const adminModel = require('../models/adminModel');

// Listar permissões por tipo de usuário
const listPermissions = async (req, res) => {
  try {
    const rows = await adminModel.listPermissions();
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro listPermissions:', error && error.message);
    res.status(500).json({ message: 'Erro ao listar permissões' });
  }
};

// Atualizar (ou inserir) permissões para um dado user_type_id
// Recebe flags no body como canCreateEvent, canViewAllEvents, canReceiveNotifications, canCreateUser, canManageGroups
const updatePermissions = async (req, res) => {
  const { user_type_id } = req.params;
  const { canCreateEvent, canViewAllEvents, canReceiveNotifications, canCreateUser, canManageGroups } = req.body;

  try {
    const result = await adminModel.updatePermissions(user_type_id, {
      can_create_event: canCreateEvent,
      can_view_all_events: canViewAllEvents,
      can_receive_notifications: canReceiveNotifications,
      can_create_user: canCreateUser,
      can_manage_groups: canManageGroups
    });

    if (result && result.changes && Object.keys(result.changes).length > 0) {
      console.log('Permissions changed for user_type_id', user_type_id, result.changes);
    }

    // Retornar sucesso ao cliente
    res.status(200).json({ message: 'Permissões atualizadas' });
  } catch (error) {
    console.error('Erro updatePermissions:', error && error.message);
    res.status(500).json({ message: 'Erro ao atualizar permissões' });
  }
};

// Listar notificações agendadas pendentes (não enviadas)
// Útil para debug (mostra payload e horário agendado)
const listScheduledNotifications = async (req, res) => {
  try {
    const rows = await adminModel.listScheduledNotifications(200);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro listScheduledNotifications:', error && error.message);
    res.status(500).json({ message: 'Erro ao listar agendamentos' });
  }
};

// Trigger the scheduled notifications processor once (admin only)
const triggerScheduledNotifications = async (req, res) => {
  try {
    const worker = require('../cron/scheduledNotificationsWorker');
    const result = await worker.processDue();
    res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error('Erro triggerScheduledNotifications:', error && error.message);
    res.status(500).json({ message: 'Erro ao executar envio de agendadas' });
  }
};

// Endpoint de debug para retornar horário do servidor e TZ do Node
const debugTime = async (req, res) => {
  try {
    res.status(200).json({
      serverTime: new Date().toString(),
      serverTimeISO: new Date().toISOString(),
      nodeTZ: process.env.TZ || null
    });
  } catch (error) {
    console.error('Erro debugTime:', error && error.message);
    res.status(500).json({ message: 'Erro ao obter horário do servidor' });
  }
};

module.exports = {
  listPermissions,
  updatePermissions,
  listScheduledNotifications
  , triggerScheduledNotifications
  , debugTime
};
