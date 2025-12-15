const db = require('../db');
const bcrypt = require('bcryptjs');

/**
 * Autentica usuário por CPF ou email + senha.
 * Retorna objeto normalizado do usuário sem o campo `password` em caso de sucesso,
 * ou null se usuário não encontrado / senha inválida.
 */
async function authenticate(login, senha) {
  try {
    // Normalizar o input: remover espaços e comparar email de forma case-insensitive
    const loginNorm = String(login || '').trim();
    const loginLower = loginNorm.toLowerCase();

    // Usar LOWER(TRIM(u.email)) = ? para garantir comparação case-insensitive e sem espaços
    const [rows] = await db.execute(`
      SELECT u.id, u.first_name, u.last_name, u.password, ut.id as user_type_id, ut.name as user_type,
             p.can_create_event, p.can_view_all_events, p.can_receive_notifications, p.can_create_user, p.can_manage_groups
      FROM users u
      LEFT JOIN user_types ut ON u.user_type_id = ut.id
      LEFT JOIN permissions p ON ut.id = p.user_type_id
      WHERE u.cpf = ? OR LOWER(TRIM(u.email)) = ?
      LIMIT 1
    `, [loginNorm, loginLower]);

    // Debug: log quando não encontrar (ajuda a diagnosticar problemas de collation/format)
    if ((!rows || rows.length === 0)) {
      try {
        console.log('authenticate: no user found for login=', loginNorm);
        const [check] = await db.execute('SELECT id, email, cpf FROM users WHERE LOWER(TRIM(email)) = ? OR cpf = ? LIMIT 5', [loginLower, loginNorm]);
        console.log('authenticate: check rows for normalized login:', check && check.length ? check : []);
      } catch (e) {
        // ignore additional check errors
      }
    }

    if (!rows || rows.length === 0) {
      console.log('authenticate: no user found for login=', login);
      return null;
    }

    const u = rows[0];
    let valid = false;
    try {
      valid = await bcrypt.compare(senha, u.password);
    } catch (bcryptErr) {
      console.error('authenticate: bcrypt.compare error', bcryptErr && bcryptErr.message);
      throw bcryptErr;
    }

    if (!valid) {
      console.log('authenticate: invalid password for user id=', u.id);
      return null;
    }

    return {
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      user_type_id: u.user_type_id,
      user_type: u.user_type,
      permissions: {
        canCreateEvent: Boolean(u.can_create_event),
        canViewAllEvents: Boolean(u.can_view_all_events),
        canReceiveNotifications: Boolean(u.can_receive_notifications),
        canCreateUser: Boolean(u.can_create_user),
        canManageGroups: Boolean(u.can_manage_groups)
      }
    };
  } catch (err) {
    console.error('userModel.authenticate: DB/query error', err && err.message);
    throw err;
  }
}

async function getProfileById(userId) {
  const [rows] = await db.execute('SELECT id, first_name, last_name, email, phone FROM users WHERE id = ?', [userId]);
  return (rows && rows.length) ? rows[0] : null;
}

async function updateProfile(userId, { first_name, last_name, email, phone }) {
  await db.execute('UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE id = ?', [first_name, last_name, email, phone, userId]);
  return getProfileById(userId);
}

async function changePassword(userId, currentPassword, newPassword) {
  const [rows] = await db.execute('SELECT password FROM users WHERE id = ?', [userId]);
  if (!rows || rows.length === 0) {
    const err = new Error('Usuário não encontrado');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const valid = await bcrypt.compare(currentPassword, rows[0].password);
  if (!valid) {
    const err = new Error('Senha atual incorreta');
    err.code = 'INVALID_CURRENT_PASSWORD';
    throw err;
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
  return true;
}

module.exports = {
  authenticate,
  getProfileById,
  updateProfile,
  changePassword
};

// --- Funções adicionais: subscriptions e criação de usuário ---

async function addSubscription(endpoint, p256dh, auth, user_id) {
  try {
    // Tentar inserir nova subscription
    await db.execute('INSERT INTO subscriptions (endpoint, keys_p256dh, keys_auth, user_id) VALUES (?, ?, ?, ?)', [endpoint, p256dh, auth, user_id]);
  } catch (err) {
    // Se já existe (duplicate key), atualizar
    if (err.code === 'ER_DUP_ENTRY') {
      await db.execute('UPDATE subscriptions SET keys_p256dh = ?, keys_auth = ?, user_id = ? WHERE endpoint = ?', [p256dh, auth, user_id, endpoint]);
    } else {
      throw err;
    }
  }
}

async function removeSubscription(endpoint) {
  const [result] = await db.execute('DELETE FROM subscriptions WHERE endpoint = ?', [endpoint]);
  return result;
}

async function listSubscriptions({ httpOnly = false } = {}) {
  if (httpOnly) {
    const [rows] = await db.execute("SELECT * FROM subscriptions WHERE endpoint LIKE 'http%'");
    return rows;
  }
  const [rows] = await db.execute('SELECT * FROM subscriptions');
  return rows;
}

async function createUser(data) {
  // Espera um objeto com fields: first_name,last_name,email,phone,birth_date,password,cpf,userType,registration_number,className,courses,relationship,student_cpf,selectedGroups,createdBy
  const {
    first_name,
    last_name,
    email,
    phone,
    birth_date,
    password,
    cpf,
    userType,
    registration_number,
    className,
    courses,
    relationship,
    student_cpf,
    selectedGroups,
    createdBy
  } = data;

  const hashedPassword = await bcrypt.hash(password, 10);

  // Checar duplicidade
  const [existingUsers] = await db.execute('SELECT * FROM users WHERE email = ? OR cpf = ?', [email, cpf]);
  if (existingUsers.length > 0) {
    const err = new Error('Email ou CPF já cadastrado(s)'); err.code = 'DUPLICATE_USER'; throw err;
  }

  if ((userType || '').toString().toLowerCase() === 'aluno') {
    const [existingStudent] = await db.execute('SELECT * FROM students WHERE registration_number = ?', [registration_number]);
    if (existingStudent.length > 0) { const err = new Error('Matricula já cadastrada'); err.code = 'DUPLICATE_MATRICULA'; throw err; }
  }

  // Determinar user_type_id (tentar buscar na tabela)
  let user_type_id = null;
  try {
    const normalized = (userType || '').toString().toLowerCase();
    const [rows] = await db.execute('SELECT id FROM user_types WHERE LOWER(name) = ? LIMIT 1', [normalized]);
    if (rows && rows.length > 0) user_type_id = rows[0].id;
  } catch (err) {
    console.warn('Erro ao buscar user_type no banco:', err && err.message);
  }

  if (!user_type_id) {
    const fallbackMap = { 'aluno': 3, 'student': 3, 'professor': 2, 'teacher': 2, 'responsavel': 4, 'guardian': 4, 'admin': 1 };
    const key = (userType || '').toString().toLowerCase();
    user_type_id = fallbackMap[key];
  }
  if (!user_type_id) { const err = new Error('Tipo de usuário inválido'); err.code = 'INVALID_USER_TYPE'; throw err; }

  const query = 'INSERT INTO users (first_name, last_name, email, phone, birth_date, password, cpf, user_type_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const params = [first_name, last_name, email, phone, birth_date, hashedPassword, cpf, user_type_id];

  const [result] = await db.execute(query, params);
  const userId = result.insertId;

  // associar grupos se houver
  if (selectedGroups && Array.isArray(selectedGroups) && selectedGroups.length > 0) {
    for (const gid of selectedGroups) {
      try { await db.execute('INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)', [userId, gid]); } catch (err) { console.warn('Erro ao inserir user_groups (não crítico):', err && err.message); }
    }
  }

  if ((userType || '').toString().toLowerCase() === 'aluno') {
    await db.execute('INSERT INTO students (student_id, class, registration_number) VALUES (?, ?, ?)', [userId, className, registration_number]);
  } else if ((userType || '').toString().toLowerCase() === 'professor') {
    await db.execute('INSERT INTO teachers (teacher_id, courses) VALUES (?, ?)', [userId, courses]);
  } else if ((userType || '').toString().toLowerCase() === 'responsavel') {
    const [student] = await db.execute('SELECT id FROM users WHERE cpf = ?', [student_cpf]);
    if (student.length > 0) {
      const studentId = student[0].id;
      await db.execute('INSERT INTO guardians (guardian_id, relationship, student_id) VALUES (?, ?, ?)', [userId, relationship, studentId]);
    } else {
      const err = new Error('Aluno não encontrado'); err.code = 'STUDENT_NOT_FOUND'; throw err;
    }
  }

  return { userId };
}

// export additions
module.exports.addSubscription = addSubscription;
module.exports.removeSubscription = removeSubscription;
module.exports.listSubscriptions = listSubscriptions;
module.exports.createUser = createUser;
