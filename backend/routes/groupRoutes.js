const express = require('express');
const { authenticateToken, requireAdmin, checkPermission } = require('../middleware/auth');
const { createGroup, listGroups, listCourses, reassignCourseTurmas, addUserToGroups, deleteGroup, getGroupMembers, getAvailableUsersForGroup, removeMemberFromGroup, updateGroup } = require('../controllers/groupController');

const router = express.Router();

// Requer permissão canManageGroups para criar/deletar/atribuir grupos
router.post('/create', authenticateToken, checkPermission('canManageGroups'), createGroup);
router.get('/', authenticateToken, listGroups);
// Listagem pública (sem autenticação) para clientes que não enviam token (útil em selects)
router.get('/public', listGroups);
// Auxiliar público: retornar apenas os cursos
router.get('/courses', listCourses);
router.post('/assign-user', authenticateToken, checkPermission('canManageGroups'), addUserToGroups);
// Reatribuir turmas de um curso para outro (requer canManageGroups)
router.post('/reassign-turmas', authenticateToken, checkPermission('canManageGroups'), reassignCourseTurmas);
// Atualizar grupo (requer canManageGroups)
router.put('/:id', authenticateToken, checkPermission('canManageGroups'), updateGroup);
// Gerenciamento de membros
router.get('/:id/members', authenticateToken, getGroupMembers);
router.get('/:id/available-users', authenticateToken, getAvailableUsersForGroup);
router.delete('/:id/members/:userId', authenticateToken, checkPermission('canManageGroups'), removeMemberFromGroup);

// Excluir grupo (requer canManageGroups)
router.delete('/:id', authenticateToken, checkPermission('canManageGroups'), deleteGroup);

module.exports = router;
