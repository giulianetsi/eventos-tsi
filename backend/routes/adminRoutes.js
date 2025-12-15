const express = require('express');
const { listPermissions, updatePermissions, listScheduledNotifications } = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Listar todos os tipos de usuário e suas permissões (apenas admin)
router.get('/permissions', authenticateToken, requireAdmin, listPermissions);

// Atualizar permissões para um user_type_id específico
router.put('/permissions/:user_type_id', authenticateToken, requireAdmin, updatePermissions);

// Listar notificações agendadas pendentes para debug/admin
router.get('/scheduled-notifications', authenticateToken, requireAdmin, listScheduledNotifications);
// Debug endpoint: retornar horário do servidor (apenas admin)
router.get('/debug-time', authenticateToken, requireAdmin, (req, res) => {
	try {
		const { debugTime } = require('../controllers/adminController');
		return debugTime(req, res);
	} catch (e) {
		console.error('adminRoutes debug-time error', e && e.message);
		res.status(500).json({ message: 'Erro interno' });
	}
});
// Endpoint para acionar manualmente o processamento de notificações agendadas (apenas admin)
router.post('/scheduled-notifications/trigger', authenticateToken, requireAdmin, (req, res) => {
	try {
		const { triggerScheduledNotifications } = require('../controllers/adminController');
		return triggerScheduledNotifications(req, res);
	} catch (e) {
		console.error('adminRoutes trigger error', e && e.message);
		res.status(500).json({ message: 'Erro interno' });
	}
});

module.exports = router;
