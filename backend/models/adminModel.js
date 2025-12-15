const db = require('../db');

async function listPermissions() {
  const [rows] = await db.execute(`
    SELECT ut.id as user_type_id, ut.name as user_type, p.can_create_event, p.can_view_all_events, p.can_receive_notifications, p.can_create_user, p.can_manage_groups
    FROM user_types ut
    LEFT JOIN permissions p ON ut.id = p.user_type_id
    ORDER BY ut.id
  `);
  return rows;
}

async function updatePermissions(user_type_id, flags) {
  const { can_create_event, can_view_all_events, can_receive_notifications, can_create_user, can_manage_groups } = flags;

  const [existing] = await db.execute('SELECT * FROM permissions WHERE user_type_id = ?', [user_type_id]);
  const newValues = {
    can_create_event: can_create_event ? 1 : 0,
    can_view_all_events: can_view_all_events ? 1 : 0,
    can_receive_notifications: can_receive_notifications ? 1 : 0,
    can_create_user: can_create_user ? 1 : 0,
    can_manage_groups: can_manage_groups ? 1 : 0
  };

  if (existing.length > 0) {
    const before = existing[0];
    const changes = {};
    for (const k of Object.keys(newValues)) {
      if (before[k] !== newValues[k]) changes[k] = { before: before[k], after: newValues[k] };
    }

    await db.execute(
      `UPDATE permissions SET can_create_event = ?, can_view_all_events = ?, can_receive_notifications = ?, can_create_user = ?, can_manage_groups = ? WHERE user_type_id = ?`,
      [newValues.can_create_event, newValues.can_view_all_events, newValues.can_receive_notifications, newValues.can_create_user, newValues.can_manage_groups, user_type_id]
    );

    return { updated: true, changes };
  } else {
    await db.execute(
      `INSERT INTO permissions (user_type_id, can_create_event, can_view_all_events, can_receive_notifications, can_create_user, can_manage_groups) VALUES (?, ?, ?, ?, ?, ?)` ,
      [user_type_id, newValues.can_create_event, newValues.can_view_all_events, newValues.can_receive_notifications, newValues.can_create_user, newValues.can_manage_groups]
    );
    return { inserted: true };
  }
}

async function listScheduledNotifications(limit = 200) {
  const [rows] = await db.execute(
    'SELECT id, event_id, payload, scheduled_at, sent FROM scheduled_notifications WHERE sent = 0 ORDER BY scheduled_at ASC LIMIT ?',
    [Number(limit) || 200]
  );
  return rows;
}

module.exports = {
  listPermissions,
  updatePermissions,
  listScheduledNotifications
};
