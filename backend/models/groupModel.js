const db = require('../db');

// Cria um grupo e retorna o registro criado (incluindo member_count)
async function createGroup({ name, description, group_type, parent_course_id }) {
  if (!name) throw new Error('Nome do grupo requerido');

  // verificar existência da coluna parent_course_id
  const [colCheck] = await db.execute("SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'parent_course_id'");
  const parentColExists = (colCheck && colCheck[0] && colCheck[0].cnt > 0) || false;

  let result;
  if (parentColExists) {
    [result] = await db.execute('INSERT INTO `groups` (name, description, group_type, parent_course_id) VALUES (?, ?, ?, ?)', [name, description || null, group_type || 'custom', parent_course_id || null]);
  } else {
    [result] = await db.execute('INSERT INTO `groups` (name, description, group_type) VALUES (?, ?, ?)', [name, description || null, group_type || 'custom']);
  }

  try {
    console.log('groupModel.createGroup: insertedId=', result && result.insertId);
  } catch (e) {}

  const [rows] = await db.execute('SELECT g.*, (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) AS member_count FROM `groups` g WHERE g.id = ? LIMIT 1', [result.insertId]);
  return { groupId: result.insertId, group: (rows && rows[0]) ? rows[0] : null };
}

async function listGroups() {
  const [colCheck] = await db.execute("SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'parent_course_id'");
  const parentColExists = (colCheck && colCheck[0] && colCheck[0].cnt > 0) || false;

  if (parentColExists) {
    const [groups] = await db.execute(
        `SELECT g.*, 
          pc.name AS parent_course_name,
          (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) AS member_count
        FROM \`groups\` g
        LEFT JOIN \`groups\` pc ON pc.id = g.parent_course_id
        ORDER BY g.name COLLATE utf8mb4_general_ci ASC`
    );
    try {
      console.log('groupModel.listGroups: parentColExists=true rows=', Array.isArray(groups) ? groups.length : 0);
      if (Array.isArray(groups) && groups.length > 0) console.log('groupModel.listGroups sample:', groups.slice(0,5).map(g => `${g.id}:${g.name}`));
    } catch (e) {}
    return groups;
  }

  const [groups] = await db.execute(
    `SELECT g.*, 
      (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) AS member_count
    FROM \`groups\` g
    ORDER BY g.name COLLATE utf8mb4_general_ci ASC`
  );
  try {
    console.log('groupModel.listGroups: parentColExists=false rows=', Array.isArray(groups) ? groups.length : 0);
    if (Array.isArray(groups) && groups.length > 0) console.log('groupModel.listGroups sample:', groups.slice(0,5).map(g => `${g.id}:${g.name}`));
  } catch (e) {}
  return groups;
}

async function listCourses() {
  const [colCheck] = await db.execute("SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'parent_course_id'");
  const parentColExists = (colCheck && colCheck[0] && colCheck[0].cnt > 0) || false;

  let sql;
  if (parentColExists) {
    sql = `SELECT g.id, g.name, g.description, g.group_type, g.parent_course_id, 
        (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) AS member_count
      FROM \`groups\` g
      WHERE LOWER(COALESCE(g.group_type, '')) = 'curso'
      ORDER BY g.name COLLATE utf8mb4_general_ci ASC`;
  } else {
    sql = `SELECT g.id, g.name, g.description, g.group_type, 
        (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) AS member_count
      FROM \`groups\` g
      WHERE LOWER(COALESCE(g.group_type, '')) = 'curso'
      ORDER BY g.name COLLATE utf8mb4_general_ci ASC`;
  }

  const [courses] = await db.execute(sql);
  return courses;
}

async function reassignCourseTurmas(from_course_id, to_course_id) {
  if (!from_course_id) throw new Error('from_course_id requerido');
  const [result] = await db.execute('UPDATE `groups` SET parent_course_id = ? WHERE parent_course_id = ?', [to_course_id || null, from_course_id]);
  return { affectedRows: result.affectedRows };
}

// Substitui associações de grupos para um usuário (transactional)
async function setUserGroups(user_id, group_ids) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM user_groups WHERE user_id = ?', [user_id]);
    for (const gid of group_ids) {
      await connection.execute('INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)', [user_id, gid]);
    }
    await connection.commit();
    return { message: 'Associações atualizadas' };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function addUserToGroup(userId, groupId) {
  const [result] = await db.execute('INSERT IGNORE INTO user_groups (user_id, group_id) VALUES (?, ?)', [userId, groupId]);
  return result;
}

async function getGroupMembers(groupId) {
  const [members] = await db.execute(
    `SELECT u.id, u.first_name, u.last_name, u.email, ut.name as user_type, ug.joined_at
      FROM user_groups ug
      JOIN users u ON ug.user_id = u.id
      LEFT JOIN user_types ut ON u.user_type_id = ut.id
      WHERE ug.group_id = ?`,
    [groupId]
  );
  return members;
}

async function getAvailableUsersForGroup(groupId) {
  const [available] = await db.execute(
    `SELECT u.id, u.first_name, u.last_name, u.email, ut.name as user_type
      FROM users u
      LEFT JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id NOT IN (SELECT user_id FROM user_groups WHERE group_id = ?)`,
    [groupId]
  );
  return available;
}

async function removeUserFromGroup(groupId, userId) {
  const [result] = await db.execute('DELETE FROM user_groups WHERE group_id = ? AND user_id = ?', [groupId, userId]);
  return result;
}

async function deleteGroup(id) {
  // Verifica tipo e referências quando aplicável
  const [grows] = await db.execute('SELECT id, group_type FROM `groups` WHERE id = ? LIMIT 1', [id]);
  if (!grows || grows.length === 0) {
    const err = new Error('Grupo não encontrado'); err.code = 'NOT_FOUND'; throw err;
  }
  const group = grows[0];
  if (String((group.group_type || '').toLowerCase()) === 'curso') {
    const [refs] = await db.execute('SELECT COUNT(*) as cnt FROM `groups` WHERE parent_course_id = ?', [id]);
    const cnt = refs && refs[0] ? refs[0].cnt : 0;
    if (cnt > 0) {
      const err = new Error(`Curso tem ${cnt} turmas vinculadas`); err.code = 'HAS_DEPENDENTS'; throw err;
    }
  }
  const [result] = await db.execute('DELETE FROM `groups` WHERE id = ?', [id]);
  return result;
}

async function updateGroup(id, { name, description, group_type, parent_course_id }) {
  if (!name) throw new Error('Nome do grupo requerido');
  const [colCheck] = await db.execute("SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'parent_course_id'");
  const parentColExists = (colCheck && colCheck[0] && colCheck[0].cnt > 0) || false;

  if (parentColExists && parent_course_id) {
    const [pc] = await db.execute('SELECT id, group_type FROM `groups` WHERE id = ? LIMIT 1', [parent_course_id]);
    if (!pc || pc.length === 0) {
      const err = new Error('parent_course_id inválido: curso não encontrado'); err.code = 'PARENT_INVALID'; throw err;
    }
    if (((pc[0].group_type || '').toString().toLowerCase()) !== 'curso') {
      const err = new Error('parent_course_id deve apontar para um grupo do tipo "curso"'); err.code = 'PARENT_NOT_COURSE'; throw err;
    }
  }

  if (parentColExists) {
    const [result] = await db.execute('UPDATE `groups` SET name = ?, description = ?, group_type = ?, parent_course_id = ? WHERE id = ?', [name, description || null, group_type || 'custom', parent_course_id || null, id]);
    return result;
  }

  const [result] = await db.execute('UPDATE `groups` SET name = ?, description = ?, group_type = ? WHERE id = ?', [name, description || null, group_type || 'custom', id]);
  return result;
}

module.exports = {
  createGroup,
  listGroups,
  listCourses,
  reassignCourseTurmas,
  setUserGroups,
  addUserToGroup,
  getGroupMembers,
  getAvailableUsersForGroup,
  removeUserFromGroup,
  deleteGroup,
  updateGroup
};
