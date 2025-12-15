const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || (req.cookies && req.cookies.token);

  if (!token) {
    return res.status(401).json({ message: 'Token de acesso requerido' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (verifyErr) {
      console.warn('authenticateToken: falha ao verificar JWT:', verifyErr && verifyErr.message ? verifyErr.message : verifyErr);
      // Repropagar para o handler externo abaixo que retornará 403
      throw verifyErr;
    }

    // Token válido - prosseguir

    req.user = decoded;
    // Logar informações mínimas do token decodificado (evitar imprimir segredos)
    console.log('authenticateToken: usuário decodificado do token:', { userId: decoded.userId, userTypeId: decoded.userTypeId, userType: decoded.userType });
    next();
  } catch (error) {
    console.warn('authenticateToken: verificação do token falhou:', error && error.message ? error.message : error);
    return res.status(403).json({ message: 'Token inválido' });
  }
};

const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({ message: 'Permissões não encontradas' });
    }

  // Suporta chaves de permissão tanto em snake_case quanto em camelCase
    const altKey = permission.replace(/([A-Z])/g, '_$1').toLowerCase();
    const hasPermission = req.user.permissions[permission] || req.user.permissions[altKey];

    if (!hasPermission) {
      return res.status(403).json({ message: 'Acesso negado: permissão insuficiente' });
    }

    next();
  };
};

// Exigir que o usuário seja administrador (com base em userType do token)
const requireAdmin = (req, res, next) => {
  // Verificar exclusivamente se é admin: user_type_id === 1
  const userTypeId = req.user?.userTypeId;
  const userType = req.user?.userType;

  if (!userType && !userTypeId) return res.status(403).json({ message: 'Tipo de usuário não encontrado' });

  // Admin deve ter user_type_id === 1 (apenas admins verdadeiros)
  if (userTypeId && Number(userTypeId) === 1) return next();
  if (userType && String(userType).toLowerCase() === 'admin') return next();

  console.warn('requireAdmin denied, req.user:', { userTypeId, userType, user: req.user });
  return res.status(403).json({ message: 'Acesso negado: administrador requerido' });
};

// Observação: para permitir expansão futura para tipos de usuário arbitrários que possam
// criar eventos, o sistema usa um objeto de permissões no token (req.user.permissions).
// Use `checkPermission('canCreateEvent')` ao proteger rotas para que cada tipo de usuário
// possa ser configurado com essa permissão no banco sem alterar o código.

module.exports = {
  authenticateJWT: authenticateToken, // Alias para compatibilidade
  authenticateToken,
  checkPermission,
  requireAdmin
};
