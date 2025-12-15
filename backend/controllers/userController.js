const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const userModel = require('../models/userModel');
const crypto = require('crypto');

// Registrar subscription do navegador (salvar endpoint + chaves no DB)
const subscribe = async (req, res) => {
  const { endpoint, keys, user_id } = req.body;
  
  console.log('Subscribe request body:', { hasEndpoint: !!endpoint, hasKeys: !!keys, user_id });
  
  if (!endpoint) {
    return res.status(400).json({ message: 'endpoint é obrigatório' });
  }
  
  if (!keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ message: 'keys.p256dh e keys.auth são obrigatórios' });
  }
  
  const { p256dh, auth } = keys;

  try {
    await userModel.addSubscription(endpoint, p256dh, auth, user_id);
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    console.error('Error saving subscription:', error && error.message);
    res.status(500).json({ message: 'Failed to subscribe', error: error && error.message });
  }
};

// Remover subscription pelo endpoint (usado no logout ou quando o cliente cancela)
const unsubscribe = async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ message: 'endpoint requerido' });

  try {
    await userModel.removeSubscription(endpoint);
    return res.status(200).json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Erro ao remover subscription:', error && error.message);
    return res.status(500).json({ message: 'Failed to unsubscribe', error: error && error.message });
  }
};

// Envio seguro de push para uma subscription (tratamento de erros comum)
// Recebe um objeto `subscription` no formato { endpoint, keys: { p256dh, auth } }
// e um payload (string) já serializado.
const sendPushNotification = async (subscription, payload) => {
  try {
    const response = await webpush.sendNotification(subscription, payload);
    console.log('Notificação push enviada com sucesso:', response);
  } catch (error) {
    console.error('Erro ao enviar notificação push:', error);
    // Se endpoint expirou (410), remover do DB
    if (error.statusCode === 410) {
      await removeInvalidSubscription(subscription);
    } 
  }
};

// Percorre subscriptions e tenta enviar uma mensagem de teste; remove as inválidas (410).
// Observação: percorre TODAS as subscriptions e pode ser custoso — rodar em manutenção/cron.
const removeInvalidSubscription = async (subscription) => {
  try {
    const subscriptions = await userModel.listSubscriptions();
    for (const sub of subscriptions) {
      const subSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth
        }
      };

      try {
        await webpush.sendNotification(subSubscription, 'Teste');
      } catch (error) {
        if (error.statusCode === 410) {
          await userModel.removeSubscription(sub.endpoint);
          console.log('Subscription inválida removida:', sub.endpoint);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao remover subscriptions erradas:', error && error.message);
  }
};

// Versão similar com filtro por endpoint HTTP; utilizada como health-check/limpeza periódica
const removeInvalidSubscriptions = async () => {
  try {
    const subscriptions = await userModel.listSubscriptions({ httpOnly: true });
    for (const sub of subscriptions) {
      const subSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth
        }
      };

      try {
        await webpush.sendNotification(subSubscription, 'health-check');
      } catch (error) {
        if (error.statusCode === 410) {
          await userModel.removeSubscription(sub.endpoint);
          console.log('Subscription inválida removida:', sub.endpoint);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao remover subscriptions inválidas:', error && error.message);
  }
};

module.exports.removeInvalidSubscriptions = removeInvalidSubscriptions;

// Obter perfil do usuário autenticado
const getProfile = async (req, res) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) return res.status(401).json({ message: 'Usuário não autenticado' });
    const profile = await userModel.getProfileById(userId);
    if (!profile) return res.status(404).json({ message: 'Perfil não encontrado' });
    return res.status(200).json(profile);
  } catch (err) {
    console.error('Erro em getProfile:', err && err.message);
    return res.status(500).json({ message: 'Erro ao buscar perfil', error: err && err.message });
  }
};

// Atualizar perfil do usuário autenticado
const updateProfile = async (req, res) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) return res.status(401).json({ message: 'Usuário não autenticado' });
    const { first_name, last_name, email, phone } = req.body;
    const updated = await userModel.updateProfile(userId, { first_name, last_name, email, phone });
    return res.status(200).json(updated);
  } catch (err) {
    console.error('Erro em updateProfile:', err && err.message);
    return res.status(500).json({ message: 'Erro ao atualizar perfil', error: err && err.message });
  }
};

// Alterar senha do usuário autenticado
const changePassword = async (req, res) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) return res.status(401).json({ message: 'Usuário não autenticado' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Senha atual e nova senha são obrigatórias' });
    try {
      await userModel.changePassword(userId, currentPassword, newPassword);
      return res.status(200).json({ message: 'Senha atualizada' });
    } catch (errInner) {
      if (errInner && errInner.code === 'USER_NOT_FOUND') return res.status(404).json({ message: 'Usuário não encontrado' });
      if (errInner && errInner.code === 'INVALID_CURRENT_PASSWORD') return res.status(403).json({ message: 'Senha atual incorreta' });
      throw errInner;
    }
  } catch (err) {
    console.error('Erro em changePassword:', err && err.message);
    return res.status(500).json({ message: 'Erro ao alterar senha', error: err && err.message });
  }
};

module.exports.getProfile = getProfile;
module.exports.updateProfile = updateProfile;
module.exports.changePassword = changePassword;

const registerUser = async (req, res) => {
  const { nome: first_name, sobrenome: last_name, email, telefone: phone, dataNascimento: birth_date, senha: password, cpf, tipo: userType, matricula: registration_number, turma: className, cursos: courses, parentesco: relationship, cpfAluno: student_cpf, selectedGroups } = req.body;

  try {
    const { userId } = await userModel.createUser({
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
      createdBy: req.user && req.user.userId
    });

    // Envio de notificação desativado: comentar/disabilitar para evitar notificações automáticas
    /*
    // Enviar notificação push para todos os inscritos (endpoints válidos que começam com http)
    const subscriptions = await userModel.listSubscriptions({ httpOnly: true });
    const payload = JSON.stringify({ title: 'Novo usuário cadastrado', body: `O usuário ${first_name} foi cadastrado` });

    subscriptions.forEach(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth
        }
      };
      await sendPushNotification(subscription, payload);
    });
    */

    res.status(201).json({ message: 'Usuário registrado com sucesso', userId });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error && error.message);
    if (error && (error.code === 'DUPLICATE_USER' || error.code === 'DUPLICATE_MATRICULA')) return res.status(400).json({ message: error.message });
    if (error && error.code === 'STUDENT_NOT_FOUND') return res.status(400).json({ message: error.message });
    if (error && error.code === 'INVALID_USER_TYPE') return res.status(400).json({ message: error.message });
    res.status(500).json({ message: 'Erro ao registrar usuário', error: error && error.message });
  }
};

const loginUser = async (req, res) => {
  const { login, senha, remember } = req.body;

  if (!senha) {
    return res.status(400).json({ message: 'Senha não fornecida' });
  }

  try {
    const user = await userModel.authenticate(login, senha);
    if (!user) return res.status(401).json({ message: 'Usuário não encontrado ou senha inválida' });

    const tokenPayload = {
      userId: user.id,
      userTypeId: user.user_type_id,
      userType: user.user_type,
      permissions: user.permissions
    };

    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';
    // Gerar um jti para permitir revogação de tokens por dispositivo
    const jti = crypto.randomBytes(16).toString('hex');
    const expiresIn = remember ? '30d' : '1h';
    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn, jwtid: jti });
    console.log('loginUser: issuing token', { userId: user.id, jti, expiresIn });

    const cookieOptions = {
      httpOnly: true,
      // Em produção usamos secure + sameSite='none' para permitir cookies cross-site via HTTPS
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: remember ? (30 * 24 * 60 * 60 * 1000) : (60 * 60 * 1000)
    };

    res.cookie('token', token, cookieOptions);
    res.status(200).json({
      message: 'Login bem-sucedido',
      user_id: user.id,
      user_type_id: user.user_type_id,
      user_type: user.user_type,
      user_first_name: user.first_name,
      user_last_name: user.last_name,
      permissions: user.permissions,
      token
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error && error.message);
    res.status(500).json({ message: 'Erro ao fazer login', error: error && error.message });
  }
};

const logoutUser = async (req, res) => {
  console.log('logoutUser: chamada recebida', { ip: req.ip, origin: req.headers.origin, userAgent: req.headers['user-agent'] });
  console.log('logoutUser: body recebido:', req.body);

  // se for enviado endpoint no corpo, remover subscription relacionada
  try {
    const { endpoint } = req.body || {};
    if (endpoint) {
      try { await userModel.removeSubscription(endpoint); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }

  res.clearCookie('token');
  res.status(200).json({ message: 'Logout bem-sucedido' });
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  subscribe,
  unsubscribe,
  getProfile,
  updateProfile,
  changePassword,
  removeInvalidSubscriptions
};