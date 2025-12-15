const express = require('express');
const { registerUser, loginUser, logoutUser, subscribe, unsubscribe, getProfile, updateProfile, changePassword } = require('../controllers/userController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

const router = express.Router();

// Requer permissão canCreateUser para registrar novos usuários
router.post('/register-user', authenticateToken, checkPermission('canCreateUser'), registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

// Rota de debug: retorna o conteúdo do token decodificado (req.user)
router.get('/debug/me', authenticateToken, (req, res) => {
	console.log('Debug /me chamado, req.user:', req.user);
	res.status(200).json({ user: req.user });
});

// Profile endpoints (require authentication)
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);

module.exports = router;
