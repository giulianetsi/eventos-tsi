// Camada de regras de evento: visibilidade, CRUD e notificações.
const db = require('../db');
const webpush = require('web-push');
const notificationModel = require('./notificationModel');
const { DateTime } = require('luxon');

// Converte um input (string ou Date) para DATETIME em UTC para o MySQL.
// Regras resumidas: respeita offset se existir; caso contrário, assume America/Sao_Paulo e converte para UTC.
function toUtcSqlDatetime(input) {
  try {
    if (!input && input !== 0) return null;
    // Date nativo -> transformar para UTC
    if (input instanceof Date) {
      const dt = DateTime.fromJSDate(input, { zone: 'UTC' });
      if (!dt.isValid) return null;
      return dt.toFormat('yyyy-LL-dd HH:mm:ss');
    }
    const s = String(input).trim();
    const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
    const slashDateOnly = /^\d{2}\/\d{2}\/\d{4}$/.test(s);
    const slashDateTime = /^\d{2}\/\d{2}\/\d{4}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s);

    let dt;
    if (hasOffset) {
      dt = DateTime.fromISO(s, { setZone: true }).toUTC();
    } else if (slashDateOnly || slashDateTime) {
      // formatos DD/MM/YYYY [HH:mm[:ss]] interpretados como horário de Brasília
      if (slashDateOnly) {
        dt = DateTime.fromFormat(s, 'dd/LL/yyyy', { zone: 'America/Sao_Paulo' }).toUTC();
      } else {
        // ajustar formatos com HH:mm ou HH:mm:ss
        const parts = s.split(/[ T]/);
        const timePart = parts[1] || '00:00:00';
        const fmt = timePart.split(':').length === 2 ? 'dd/LL/yyyy HH:mm' : 'dd/LL/yyyy HH:mm:ss';
        dt = DateTime.fromFormat(s, fmt, { zone: 'America/Sao_Paulo' }).toUTC();
      }
    } else {
      // tentar ISO/ YYYY-MM-DD [HH:mm[:ss]] interpretando sem offset como horário de Brasília
      dt = DateTime.fromISO(s, { zone: 'America/Sao_Paulo' });
      if (!dt.isValid) {
        const localDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
        const localDateTime = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s);
        if (localDateOnly) dt = DateTime.fromFormat(s, 'yyyy-LL-dd', { zone: 'America/Sao_Paulo' });
        else if (localDateTime) {
          const timeParts = s.split(/[ T]/)[1].split(':');
          const fmt = timeParts.length === 2 ? 'yyyy-LL-dd HH:mm' : 'yyyy-LL-dd HH:mm:ss';
          dt = DateTime.fromFormat(s, fmt, { zone: 'America/Sao_Paulo' });
        } else if (/^\d+$/.test(s)) {
          dt = DateTime.fromMillis(Number(s)).toUTC();
        } else {
          // fallback para tentar com Date do JS (interpreta em UTC quando possível)
          const parsed = new Date(s);
          if (isNaN(parsed.getTime())) return null;
          dt = DateTime.fromJSDate(parsed, { zone: 'UTC' });
        }
      }
      dt = dt.toUTC();
    }

    if (!dt || !dt.isValid) return null;
    return dt.toFormat('yyyy-LL-dd HH:mm:ss');
  } catch (e) {
    return null;
  }
}

// Converte variações de boolean para true/false (1, '1', true, 'true').
const normalizeBool = (val) => (val === 1 || val === '1' || val === true || String(val).toLowerCase() === 'true');

// Trecho SELECT base reutilizado em listagens de eventos.
const selectBase = (includeTarget = true) => `
  SELECT DISTINCT e.*, 
         CONCAT(u.first_name, ' ', u.last_name) as created_by,
         ut.name as creator_type,
         GROUP_CONCAT(DISTINCT g.name) as grupos
         ${includeTarget ? ', e.target_user_types' : ''}
  FROM events e
  LEFT JOIN users u ON e.user_id = u.id
  LEFT JOIN user_types ut ON u.user_type_id = ut.id
  LEFT JOIN event_groups eg ON e.id = eg.event_id
  LEFT JOIN \`groups\` g ON eg.group_id = g.id
`;

// Filtra eventos por grupos: OR quando groups_combined=0, AND quando groups_combined=1.
const groupsFilter = `(
  (
    (e.groups_combined = 0 
     AND (
       NOT EXISTS (
         SELECT 1 FROM event_groups eg0 WHERE eg0.event_id = e.id
       )
       OR e.id IN (
         SELECT DISTINCT eg2.event_id 
         FROM event_groups eg2
         JOIN user_groups ug ON eg2.group_id = ug.group_id
         WHERE ug.user_id = ?
       )
     ))
    OR
    (e.groups_combined = 1
     AND e.id IN (
       SELECT eg3.event_id
       FROM event_groups eg3
       WHERE eg3.event_id NOT IN (
         SELECT DISTINCT eg4.event_id
         FROM event_groups eg4
         WHERE eg4.group_id NOT IN (
           SELECT ug2.group_id
           FROM user_groups ug2
           WHERE ug2.user_id = ?
         )
       )
     ))
  )
)`;

// Resolve usuário efetivo (responsável vira aluno) e permissões mínimas.
async function resolveEffectiveUser(reqUser) {
  const userId = reqUser?.userId || reqUser;

  const [userInfo] = await db.execute(`
    SELECT ut.name as user_type, p.can_view_all_events
    FROM users u 
    JOIN user_types ut ON u.user_type_id = ut.id
    JOIN permissions p ON ut.id = p.user_type_id
    WHERE u.id = ?
  `, [userId]);

  if (!userInfo.length) {
    const err = new Error('Usuário não encontrado');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  let effectiveUserId = userId;
  let effectiveUserType = userInfo[0].user_type;
  try {
    const typeLower = String(effectiveUserType).toLowerCase();
    if (typeLower === 'responsavel' || typeLower === 'guardian') {
      const [guardRows] = await db.execute('SELECT student_id FROM guardians WHERE guardian_id = ?', [userId]);
      if (guardRows && guardRows.length > 0) {
        effectiveUserId = guardRows[0].student_id;
        const [stuRows] = await db.execute('SELECT ut.name as user_type FROM users u JOIN user_types ut ON u.user_type_id = ut.id WHERE u.id = ?', [effectiveUserId]);
        if (stuRows && stuRows.length > 0) effectiveUserType = stuRows[0].user_type;
      }
    }
  } catch (e) { /* manter original se falhar */ }

  return {
    effectiveUserId,
    effectiveUserType,
    canViewAll: normalizeBool(userInfo[0].can_view_all_events)
  };
}

// Monta o filtro de tipos de usuário para target_user_types (aceita variantes em português/inglês).
function buildTypeFilter(effectiveUserType) {
  const typeMap = {
    'aluno': ['aluno', 'student'],
    'professor': ['professor', 'teacher'],
    'responsavel': ['responsavel', 'guardian'],
    'admin': ['admin']
  };
  // Lista de nomes aceitos para o tipo atual.
  const variants = typeMap[effectiveUserType] || [effectiveUserType];
  // Parâmetros LIKE com lowercase para bind na query.
  const likeParams = variants.map(v => `%${String(v).toLowerCase()}%`);
  // Monta cláusulas OR dinâmicas para cada variante.
  const containsClauses = variants.map(() => "LOWER(COALESCE(e.target_user_types,'')) LIKE ?").join(' OR ');
  return { variants, likeParams, containsClauses };
}

/**
 * Retorna linhas brutas de eventos visíveis para o usuário fornecido.
 * Recebe o objeto decodificado do token (req.user) ou um userId numérico.
 * Retorna um objeto: { events: Array, effectiveUserId }
 */
async function getEventsForUser(reqUser) {
  // Lista eventos visíveis considerando tipo, grupos e exceções de esquema.
  const { effectiveUserId, effectiveUserType } = await resolveEffectiveUser(reqUser);
  let query;
  let params = [];

  const isAdmin = String(effectiveUserType || '').toLowerCase() === 'admin';

  if (isAdmin) {
    // Admin: sem filtros extras.
    query = `${selectBase(true)}
      GROUP BY e.id
      ORDER BY e.event_datetime ASC`;
  } else {
    // Filtros de tipo de usuário (target_user_types).
    const { likeParams, containsClauses } = buildTypeFilter(effectiveUserType);

    const visibleToUserType = `(
      e.target_user_types IS NULL
      OR e.target_user_types = ''
      OR e.target_user_types = '[]'
      OR (${containsClauses})
    )`;

    const whereParts = [visibleToUserType, groupsFilter];

    query = `${selectBase(true)}
      WHERE ${whereParts.join(' AND ')}
      GROUP BY e.id
      ORDER BY e.event_datetime ASC`;

    // Parâmetros: primeiro tipos, depois userId (duas vezes para o filtro de grupos OR/AND).
    params = [...likeParams, effectiveUserId, effectiveUserId];
  }

  try {
    const result = await db.execute(query, params);
    const events = result[0];

    const debugEvents = process.env.DEBUG_EVENTS_MODEL === 'true';
    if (debugEvents) {
      console.log('[eventModel] debug: getEventsForUser debug', { effectiveUserId, effectiveUserType, isAdmin, eventsCount: events.length });
      const typeMap = {
        'aluno': ['aluno','student'],
        'professor': ['professor','teacher'],
        'responsavel': ['responsavel','guardian'],
        'admin': ['admin']
      };
      for (const ev of events) {
        let ttypes = null;
        try { ttypes = ev.target_user_types ? JSON.parse(ev.target_user_types) : null; } catch (e) { ttypes = ev.target_user_types; }
        const variantes = typeMap[effectiveUserType] || [effectiveUserType];
        const matchesType = Array.isArray(ttypes) ? variantes.some(v => ttypes.includes(v) || ttypes.includes(String(v).toLowerCase())) : (ttypes === null);
        console.log('[eventModel] debug: eventIncluded', { eventId: ev.id, title: ev.title || ev.titulo || '(no title)', target_user_types: ttypes, grupos: ev.grupos, matchesType });
      }
    }

    return { events, effectiveUserId };
  } catch (queryErr) {
    if (queryErr && queryErr.code === 'ER_BAD_FIELD_ERROR' && /target_user_types/.test(queryErr.message)) {
      // Schema sem coluna target_user_types: refaz consulta sem o campo.
      if (isAdmin) {
        query = `${selectBase(false)}
          GROUP BY e.id
          ORDER BY e.event_datetime ASC`;
        params = [];
      } else {
        query = `${selectBase(false)}
          WHERE ${groupsFilter}
          GROUP BY e.id
          ORDER BY e.event_datetime ASC`;
        params = [effectiveUserId, effectiveUserId];
      }

      const resultAlt = await db.execute(query, params);
      return { events: resultAlt[0], effectiveUserId };
    }
    throw queryErr;
  }
}

/**
 * Cria um evento com dados fornecidos e opcionalmente associa grupos e agenda/ envia notificações.
 * @param {Object} data - campos do formulário / payload
 * @param {Object} reqUser - objeto decodificado do token (req.user)
 * @returns {Object} { id }
 */
async function createEvent(data, reqUser) {
  // Cria evento, associa grupos e agenda/envia notificações.
  const user_id = reqUser?.userId || data.user_id || null;
  let connection;
  try {
    connection = await db.getConnection();
    // Descobre colunas existentes em events para evitar ER_BAD_FIELD_ERROR.
    const [colsInfo] = await connection.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events'");
    const availableCols = new Set((colsInfo || []).map(r => r.COLUMN_NAME));
    // Monta INSERT apenas com colunas disponíveis e presentes nos dados.
    const columns = [];
    const placeholders = [];
    const values = [];
    // Mapeia campos básicos recebidos para colunas se existirem.
    if ((data.titulo || data.title) && availableCols.has('title')) { columns.push('title'); placeholders.push('?'); values.push(data.titulo || data.title); }
    if ((data.descricao || data.description) && availableCols.has('description')) { columns.push('description'); placeholders.push('?'); values.push(data.descricao || data.description); }
    if ((data.tipo || data.type) && availableCols.has('type')) { columns.push('type'); placeholders.push('?'); values.push(data.tipo || data.type); }
    if (user_id && availableCols.has('user_id')) { columns.push('user_id'); placeholders.push('?'); values.push(user_id); }
    let isPublicValue = null;
    const is_public = data.publico || data.is_public;
    if (typeof is_public === 'string') {
      if (is_public.toLowerCase() === 'publico') isPublicValue = 1;
      else if (is_public.toLowerCase() === 'privado') isPublicValue = 0;
    } else if (typeof is_public === 'number') {
      isPublicValue = is_public;
    }
    // Salva flag de público se enviada.
    if (isPublicValue !== null) { columns.push('is_public'); placeholders.push('?'); values.push(isPublicValue); }
    const event_datetime = data.data_horario_evento || data.event_datetime || data.event_datetime_raw;
    if (event_datetime && availableCols.has('event_datetime')) { columns.push('event_datetime'); placeholders.push('?'); values.push(event_datetime); }
    if (data.data_period_start && availableCols.has('data_period_start')) { columns.push('data_period_start'); placeholders.push('?'); values.push(data.data_period_start); }
    if (data.data_period_end && availableCols.has('data_period_end')) { columns.push('data_period_end'); placeholders.push('?'); values.push(data.data_period_end); }
    if (typeof data.mostrar_data !== 'undefined' && availableCols.has('mostrar_data')) { columns.push('mostrar_data'); placeholders.push('?'); values.push(data.mostrar_data ? 1 : 0); }
    if (typeof data.mostrar_apenas_na_data !== 'undefined' && availableCols.has('mostrar_apenas_na_data')) { columns.push('mostrar_apenas_na_data'); placeholders.push('?'); values.push(data.mostrar_apenas_na_data ? 1 : 0); }
    if ((data.local_evento || data.event_location) && availableCols.has('event_location')) { columns.push('event_location'); placeholders.push('?'); values.push(data.local_evento || data.event_location); }

    const insertSql = `INSERT INTO events (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
    let result;
    try {
      [result] = await connection.execute(insertSql, values);
    } catch (insErr) {
      // Se o schema não tiver alguma coluna, remove e tenta de novo.
      if (insErr && insErr.code === 'ER_BAD_FIELD_ERROR' && /Unknown column/.test(insErr.message)) {
        const missingMatch = insErr.message.match(/Unknown column '([^']+)' in 'field list'/);
        if (missingMatch && missingMatch[1]) {
          const missing = missingMatch[1];
          const idx = columns.indexOf(missing);
          if (idx !== -1) {
            columns.splice(idx, 1);
            placeholders.splice(idx, 1);
            values.splice(idx, 1);
            const retrySql = `INSERT INTO events (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
            try { [result] = await connection.execute(retrySql, values); } catch (retryErr) { throw retryErr; }
          } else {
            throw insErr;
          }
        } else { throw insErr; }
      } else { throw insErr; }
    }
    const eventId = result.insertId;

    // Persiste públicos-alvo (array -> JSON), se a coluna existir.
    const target_user_types = data.target_user_types || data.targetUserTypes;
      if (target_user_types && Array.isArray(target_user_types)) {
      try {
        await connection.execute('UPDATE events SET target_user_types = ? WHERE id = ?', [JSON.stringify(target_user_types), eventId]);
      } catch (updateError) {
        // Coluna pode não existir; ignora se falhar.
      }
    }

    // Associa grupos criando linhas em event_groups.
    const selectedGroups = data.selectedGroups || data.grupos || data.selected_groups;
    if (Array.isArray(selectedGroups) && selectedGroups.length > 0) {
      for (const groupId of selectedGroups) {
        await connection.execute('INSERT INTO event_groups (event_id, group_id) VALUES (?, ?)', [eventId, groupId]);
      }
    }

    await connection.commit();

    // Dispara notificações sem bloquear a criação.
    const sendNotification = data.sendNotification === true || data.sendNotification === 'true' || data.sendNotification === 1 || data.sendNotification === '1';
    const sendNotificationMode = data.sendNotificationMode || data.send_notification_mode || 'scheduled';
    const scheduledNotificationDatetime = data.scheduledNotificationDatetime || data.scheduled_notification_datetime;

    console.log('[eventModel] createEvent notification flags:', { sendNotification, sendNotificationMode, scheduledNotificationDatetime, event_datetime });

    if (sendNotification) {
      (async () => {
        const payload = JSON.stringify({ title: 'Novo evento', body: `Um novo evento foi criado: ${data.titulo || data.title}`, data: { eventId } });
        const containsTime = (s) => { if (!s) return false; return /T|\s+\d{2}:\d{2}|:\d{2}/.test(String(s)); };
        const DEFAULT_NOTIFICATION_TIME = process.env.DEFAULT_EVENT_NOTIFICATION_TIME || '09:00:00';
        try {
          if (String(sendNotificationMode).toLowerCase() === 'immediate' || String(sendNotificationMode).toLowerCase() === 'now') {
              // Carrega subscriptions elegíveis (aplica filtros de público/grupos).
              let uniqueSubscriptions = [];
              try {
                const subs = await notificationModel.getEligibleSubscriptionsForEvent(eventId);
                uniqueSubscriptions = subs || [];
              } catch (subErr) {
                console.warn('[eventModel] could not load eligible subscriptions via notificationModel', subErr && subErr.message ? subErr.message : subErr);
              }

              console.log('[eventModel] immediate send eligible uniqueSubscriptions count:', uniqueSubscriptions.length);
              for (const sub of uniqueSubscriptions) {
                const pushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } };
                try {
                  await webpush.sendNotification(pushSubscription, payload);
                  console.log('[eventModel] SUCCESS for user:', sub.user_id);
                } catch (err) {
                  if (err && err.statusCode === 410) {
                    console.log('[eventModel] 410 expired, removing for user:', sub.user_id);
                    try { await db.execute('DELETE FROM subscriptions WHERE endpoint = ?', [sub.endpoint]); } catch (delErr) { /* ignore */ }
                  } else {
                    console.error('[eventModel] ERROR for user:', sub.user_id);
                    console.error('  statusCode:', err.statusCode);
                    console.error('  body:', err.body);
                    console.error('  message:', err.message);
                  }
                }
              }
          } else {
            let scheduledAt = null;
            // Loga inputs brutos e calcula horário alvo em UTC.
            console.log('[eventModel] scheduling inputs:', { eventId, scheduledNotificationDatetime, event_datetime, data_period_start: data.data_period_start, data_period_end: data.data_period_end });

            if (scheduledNotificationDatetime) {
              const parsed = toUtcSqlDatetime(scheduledNotificationDatetime);
              if (parsed) scheduledAt = parsed;
            } else if (event_datetime && containsTime(event_datetime)) {
              const parsed = toUtcSqlDatetime(event_datetime);
              if (parsed) scheduledAt = parsed;
            } else if (event_datetime) {
              // Data sem hora: compõe com horário padrão.
              const composedEv = `${event_datetime} ${DEFAULT_NOTIFICATION_TIME}`;
              const parsedEv = toUtcSqlDatetime(composedEv);
              if (parsedEv) scheduledAt = parsedEv;
            } else if (data.data_period_start) {
              // Período: usa início + horário padrão.
              const composed = `${data.data_period_start} ${DEFAULT_NOTIFICATION_TIME}`;
              const parsedPeriod = toUtcSqlDatetime(composed);
              if (parsedPeriod) scheduledAt = parsedPeriod;
            }

            try {
              if (!scheduledAt) {
                console.warn('[eventModel] scheduledAt is null or unparsable — skipping scheduling for event', eventId, { scheduledNotificationDatetime, event_datetime, data_period_start: data.data_period_start });
              } else {
                // Garante que seja futuro em UTC para não disparar imediatamente.
                const scheduledDate = new Date(scheduledAt.replace(' ', 'T') + 'Z');
                const nowUtc = new Date();
                if (scheduledDate.getTime() <= nowUtc.getTime()) {
                  console.warn('[eventModel] computed scheduledAt is not in the future — skipping scheduling to avoid immediate send', { eventId, scheduledAt, nowUtc: nowUtc.toISOString() });
                } else {
                  console.log('[eventModel] scheduling notification (will insert):', { eventId, scheduledAt, payloadLen: payload && payload.length });
                  try {
                    // Evita duplicar agendamento para mesma data/evento.
                    try {
                      const [existingRows] = await db.execute('SELECT id FROM scheduled_notifications WHERE event_id = ? AND scheduled_at = ? AND sent = 0 LIMIT 1', [eventId, scheduledAt]);
                      if (existingRows && existingRows.length > 0) {
                        console.log('[eventModel] scheduled notification already exists for event, skipping insert', { eventId, scheduledAt });
                      } else {
                        const [insRes] = await db.execute('INSERT INTO scheduled_notifications (event_id, payload, scheduled_at) VALUES (?, ?, ?)', [eventId, payload, scheduledAt]);
                        console.log('[eventModel] inserted scheduled_notifications', { eventId, insertId: insRes && insRes.insertId });
                      }
                    } catch (chkErr) {
                      // se a checagem falhar (por exemplo tabela não existir), tentar inserir na mesma hora
                      const [insRes] = await db.execute('INSERT INTO scheduled_notifications (event_id, payload, scheduled_at) VALUES (?, ?, ?)', [eventId, payload, scheduledAt]);
                      console.log('[eventModel] inserted scheduled_notifications (fallback check failed)', { eventId, insertId: insRes && insRes.insertId, chkErr: chkErr && chkErr.message });
                    }
                  } catch (insErr) {
                    console.error('[eventModel] failed inserting scheduled_notifications', insErr && insErr.message ? insErr.message : insErr);
                  }
                }
              }
            } catch (schedErr) { console.error('[eventModel] unexpected error during scheduling logic', schedErr && schedErr.message ? schedErr.message : schedErr); }
          }
        } catch (pushErr) { console.error('[eventModel] background notification task error', pushErr && pushErr.message ? pushErr.message : pushErr); }
      })();
    }

    if (connection) try { connection.release(); } catch (e) {}
    return { id: eventId };
  } catch (err) {
    try { if (connection) await connection.rollback(); } catch (rbErr) {}
    try { if (connection) connection.release(); } catch (relErr) {}
    throw err;
  }
}

/**
 * Atualiza um evento. Faz verificação de propriedade/permissão.
 * @param {number} eventId
 * @param {Object} data
 * @param {Object} reqUser
 */
async function updateEvent(eventId, data, reqUser) {
  // Atualiza evento apenas se criador ou quem tenha permissão equivalente.
  const [rows] = await db.execute('SELECT user_id FROM events WHERE id = ?', [eventId]);
  if (!rows || rows.length === 0) throw Object.assign(new Error('Evento não encontrado'), { status: 404 });
  const ownerId = rows[0].user_id;
  const userId = reqUser?.userId;
  // Considerar admin se: user_type_id === 1 OU possui permissão canCreateEvent (pode ser equivalente a admin)
  const isAdmin = (reqUser?.userTypeId === 1) || (reqUser?.permissions && (reqUser.permissions.canCreateEvent || reqUser.permissions.can_create_event));
  if (Number(ownerId) !== Number(userId) && !isAdmin) throw Object.assign(new Error('Apenas o criador ou administrador pode editar este evento'), { status: 403 });

  // Monta SET dinamicamente para evitar colunas inexistentes.
  const candidates = [];
  if (data.titulo || data.title) candidates.push({ col: 'title', val: data.titulo || data.title });
  if (data.descricao || data.description) candidates.push({ col: 'description', val: data.descricao || data.description });
  if (data.tipo || data.type) candidates.push({ col: 'type', val: data.tipo || data.type });
  if (typeof data.publico !== 'undefined' || typeof data.is_public !== 'undefined') {
    const is_public_val = (typeof data.publico !== 'undefined') ? (data.publico === 'publico' ? 1 : 0) : (data.is_public ? 1 : 0);
    candidates.push({ col: 'is_public', val: is_public_val });
  }
  if (data.data_horario_evento || data.event_datetime) candidates.push({ col: 'event_datetime', val: data.data_horario_evento || data.event_datetime });
  if (typeof data.data_period_start !== 'undefined') candidates.push({ col: 'data_period_start', val: data.data_period_start });
  if (typeof data.data_period_end !== 'undefined') candidates.push({ col: 'data_period_end', val: data.data_period_end });
  if (typeof data.mostrar_data !== 'undefined') candidates.push({ col: 'mostrar_data', val: data.mostrar_data ? 1 : 0 });
  if (typeof data.mostrar_apenas_na_data !== 'undefined') candidates.push({ col: 'mostrar_apenas_na_data', val: data.mostrar_apenas_na_data ? 1 : 0 });
  if (data.local_evento || data.event_location) candidates.push({ col: 'event_location', val: data.local_evento || data.event_location });
  if (typeof data.isGroupsCombined !== 'undefined') candidates.push({ col: 'groups_combined', val: data.isGroupsCombined ? 1 : 0 });

  if (candidates.length > 0) {
    // Consulta colunas existentes para evitar erros de schema.
    const [colsInfo] = await db.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events'");
    const availableCols = new Set((colsInfo || []).map(r => r.COLUMN_NAME));
    const setClauses = [];
    const values = [];
    for (const c of candidates) {
      if (availableCols.has(c.col)) {
        setClauses.push(`${c.col} = ?`);
        values.push(c.val);
      }
    }
    if (setClauses.length > 0) {
      const updateSql = `UPDATE events SET ${setClauses.join(', ')} WHERE id = ?`;
      values.push(eventId);
      await db.execute(updateSql, values);
    }
  }

  // Atualiza públicos-alvo se vierem no payload.
  const target_user_types = data.target_user_types || data.targetUserTypes;
  if (target_user_types && Array.isArray(target_user_types)) {
    try { await db.execute('UPDATE events SET target_user_types = ? WHERE id = ?', [JSON.stringify(target_user_types), eventId]); } catch (err) {}
  }

  // Grupos: remove vínculos antigos e recria os novos.
  const selectedGroups = data.selectedGroups || data.grupos || data.selected_groups;
  if (Array.isArray(selectedGroups)) {
    await db.execute('DELETE FROM event_groups WHERE event_id = ?', [eventId]);
    for (const gid of selectedGroups) {
      await db.execute('INSERT INTO event_groups (event_id, group_id) VALUES (?, ?)', [eventId, gid]);
    }
  }

  // Notificações: igual à criação (imediato ou agendado).
  const sendNotification = data.sendNotification === true || data.sendNotification === 'true' || data.sendNotification === 1 || data.sendNotification === '1';
  const sendNotificationMode = data.sendNotificationMode || data.send_notification_mode || 'scheduled';
  const scheduledNotificationDatetime = data.scheduledNotificationDatetime || data.scheduled_notification_datetime;
  if (sendNotification) {
    (async () => {
      const payload = JSON.stringify({ title: 'Evento atualizado', body: `Evento atualizado: ${data.titulo || data.title || 'Sem título'}`, data: { eventId: eventId } });
      try {
        if (String(sendNotificationMode).toLowerCase() === 'immediate' || String(sendNotificationMode).toLowerCase() === 'now') {
          // Carrega subscriptions elegíveis e envia push agora.
          let uniqueSubscriptions = [];
          try {
            const subs = await notificationModel.getEligibleSubscriptionsForEvent(eventId);
            uniqueSubscriptions = subs || [];
          } catch (subErr) {
            console.warn('[eventModel] could not load eligible subscriptions via notificationModel (update)', subErr && subErr.message ? subErr.message : subErr);
          }

          console.log('[eventModel] immediate update eligible uniqueSubscriptions count:', uniqueSubscriptions.length);
          for (const sub of uniqueSubscriptions) {
            const pushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } };
            try {
              await webpush.sendNotification(pushSubscription, payload);
              console.log('[eventModel] UPDATE SUCCESS for user:', sub.user_id);
            } catch (err) {
              if (err && err.statusCode === 410) {
                console.log('[eventModel] UPDATE 410 expired, removing for user:', sub.user_id);
                try { await db.execute('DELETE FROM subscriptions WHERE endpoint = ?', [sub.endpoint]); } catch(e){}
              } else {
                console.error('[eventModel] UPDATE ERROR for user:', sub.user_id);
                console.error('  statusCode:', err.statusCode);
                console.error('  body:', err.body);
                console.error('  message:', err.message);
              }
            }
          }
        } else {
          const DEFAULT_NOTIFICATION_TIME = process.env.DEFAULT_EVENT_NOTIFICATION_TIME || '09:00:00';
          const containsTime = (s) => { if (!s) return false; return /T|\s+\d{2}:\d{2}|:\d{2}/.test(String(s)); };
          let scheduledAt = null;
          const event_datetime = data.data_horario_evento || data.event_datetime;
          // Reusa conversão para UTC.
          const toUtcSqlDatetime2 = toUtcSqlDatetime;
          if (scheduledNotificationDatetime) {
            const parsed = toUtcSqlDatetime2(scheduledNotificationDatetime);
            if (parsed) scheduledAt = parsed;
          } else if (event_datetime && containsTime(event_datetime)) {
            const parsed = toUtcSqlDatetime2(event_datetime);
            if (parsed) scheduledAt = parsed;
          } else if (event_datetime) {
            // Se veio apenas a data em event_datetime (sem hora), compor com DEFAULT_NOTIFICATION_TIME
            const composedEvU = `${event_datetime} ${DEFAULT_NOTIFICATION_TIME}`;
            const parsedEvU = toUtcSqlDatetime2(composedEvU);
            if (parsedEvU) scheduledAt = parsedEvU;
          } else if (data && data.data_period_start) {
            // Se veio data_period_start, usa ela + hora padrão.
            const composed2 = `${data.data_period_start} ${DEFAULT_NOTIFICATION_TIME}`;
            const parsedPeriod2 = toUtcSqlDatetime2(composed2);
            if (parsedPeriod2) scheduledAt = parsedPeriod2;
          }

          try {
            console.log('[eventModel] scheduling notification (update) inputs:', { eventId, scheduledNotificationDatetime, event_datetime, data_period_start: data && data.data_period_start });
            if (!scheduledAt) {
              console.warn('[eventModel] scheduledAt is null for update — parse failed, skipping scheduling for event', eventId);
            } else {
              // Só agenda se estiver no futuro em UTC.
              const scheduledDate = new Date(scheduledAt.replace(' ', 'T') + 'Z');
              const nowUtc = new Date();
              if (scheduledDate.getTime() <= nowUtc.getTime()) {
                console.warn('[eventModel] computed scheduledAt (update) is not in the future — skipping scheduling to avoid immediate send', { eventId, scheduledAt, nowUtc: nowUtc.toISOString() });
              } else {
                // Atualiza agendamento pendente ou insere se não houver.
                try {
                  const [updateRes] = await db.execute('UPDATE scheduled_notifications SET payload = ?, scheduled_at = ? WHERE event_id = ? AND sent = 0', [payload, scheduledAt, eventId]);
                  if (!updateRes || updateRes.affectedRows === 0) {
                    const [insRes] = await db.execute('INSERT INTO scheduled_notifications (event_id, payload, scheduled_at) VALUES (?, ?, ?)', [eventId, payload, scheduledAt]);
                    console.log('[eventModel] inserted scheduled_notifications (update)', { eventId, insertId: insRes && insRes.insertId });
                  } else {
                    console.log('[eventModel] updated existing scheduled_notifications for event', eventId, 'affectedRows=', updateRes.affectedRows);
                  }
                } catch (uErr) {
                  // Se update falhar por algum motivo, tentar inserir como fallback
                  try { const [insRes2] = await db.execute('INSERT INTO scheduled_notifications (event_id, payload, scheduled_at) VALUES (?, ?, ?)', [eventId, payload, scheduledAt]); console.log('[eventModel] inserted scheduled_notifications (update fallback)', { eventId, insertId: insRes2 && insRes2.insertId }); } catch (insErr) { throw insErr; }
                }
              }
            }
          } catch (err) { console.error('[eventModel] failed inserting/updating scheduled_notifications (update)', err && err.message ? err.message : err); }
        }
      } catch (err) { }
    })();
  }

  return { message: 'Evento atualizado com sucesso' };
}

// Deletar evento (apenas criador ou usuário com permissão)
async function deleteEvent(eventId, reqUser) {
  const userId = reqUser?.userId || null;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // verificar existência e autor
    const [evRows] = await connection.execute('SELECT id, user_id FROM events WHERE id = ? LIMIT 1', [eventId]);
    if (!evRows || evRows.length === 0) {
      const err = new Error('Evento não encontrado');
      err.status = 404;
      throw err;
    }
    const event = evRows[0];

    // Permitir delete se: 1) é o criador OU 2) tem canCreateEvent (equivalente a permissão)
    const isCreator = Number(event.user_id) === Number(userId);
    const hasCreateEventPerm = reqUser?.permissions && (reqUser.permissions.canCreateEvent || reqUser.permissions.can_create_event);
    const isAdmin = reqUser?.userTypeId === 1;
    
    const allowed = isCreator || hasCreateEventPerm || isAdmin;

    if (!allowed) {
      const err = new Error('Permissão negada para deletar o evento');
      err.status = 403;
      throw err;
    }

    // remover dados relacionados e o evento
    try {
      await connection.execute('DELETE FROM event_groups WHERE event_id = ?', [eventId]);
      await connection.execute('DELETE FROM scheduled_notifications WHERE event_id = ?', [eventId]);
      await connection.execute('DELETE FROM events WHERE id = ?', [eventId]);
      await connection.commit();
      return { message: 'Evento deletado com sucesso' };
    } catch (delErr) {
      await connection.rollback();
      throw delErr;
    }
  } catch (err) {
    if (connection) try { await connection.rollback(); } catch (e) {}
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getEventsForUser,
  createEvent,
  updateEvent,
  deleteEvent
};
