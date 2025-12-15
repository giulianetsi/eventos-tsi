const groupModel = require('../models/groupModel');

// Criar um novo grupo. Toda a lógica de BD delegada ao model.
const createGroup = async (req, res) => {
  const { name, description, group_type, parent_course_id } = req.body;

  if (!name) return res.status(400).json({ message: 'Nome do grupo requerido' });

  try {
    const { groupId, group } = await groupModel.createGroup({ name, description, group_type, parent_course_id });
    res.status(201).json({ message: 'Grupo criado', groupId, group });
  } catch (error) {
    console.error('Erro ao criar grupo:', error && error.message);
    res.status(500).json({ message: 'Erro ao criar grupo', error: error && error.message });
  }
};
 
const listGroups = async (req, res) => {
  try {
    const groups = await groupModel.listGroups();
    return res.status(200).json(groups);
  } catch (error) {
    console.error('Erro ao listar grupos:', error && error.message);
    res.status(500).json({ message: 'Erro ao listar grupos', error: error && error.message });
  }
};

const listCourses = async (req, res) => {
  try {
    const courses = await groupModel.listCourses();
    res.status(200).json(courses);
  } catch (error) {
    console.error('Erro ao listar cursos:', error && error.message);
    res.status(500).json({ message: 'Erro ao listar cursos', error: error && error.message });
  }
};

const reassignCourseTurmas = async (req, res) => {
  const { from_course_id, to_course_id } = req.body;
  if (!from_course_id) return res.status(400).json({ message: 'from_course_id requerido' });

  try {
    const result = await groupModel.reassignCourseTurmas(from_course_id, to_course_id);
    res.status(200).json({ message: 'Turmas reatribuídas', affectedRows: result.affectedRows });
  } catch (error) {
    console.error('Erro ao reatribuir turmas:', error && error.message);
    res.status(500).json({ message: 'Erro ao reatribuir turmas', error: error && error.message });
  }
};

const addUserToGroups = async (req, res) => {
  const { user_id, group_ids, groupId, userId } = req.body;

  try {
    if (user_id && Array.isArray(group_ids)) {
      await groupModel.setUserGroups(user_id, group_ids);
      return res.status(200).json({ message: 'Associações atualizadas' });
    }

    if (groupId && userId) {
      await groupModel.addUserToGroup(userId, groupId);
      return res.status(200).json({ message: 'Usuário adicionado ao grupo' });
    }

    return res.status(400).json({ message: 'Parâmetros inválidos para atribuir usuário' });
  } catch (error) {
    console.error('Erro ao atualizar user_groups:', error && error.message);
    res.status(500).json({ message: 'Erro ao atualizar grupos do usuário', error: error && error.message });
  }
};

// Retornar membros de um grupo específico
const getGroupMembers = async (req, res) => {
  const { id } = req.params;
  try {
    const members = await groupModel.getGroupMembers(id);
    res.status(200).json(members);
  } catch (error) {
    console.error('Erro ao buscar membros do grupo:', error && error.message);
    res.status(500).json({ message: 'Erro ao buscar membros do grupo', error: error && error.message });
  }
};

// Retornar usuários que não estão no grupo (disponíveis para adicionar)
const getAvailableUsersForGroup = async (req, res) => {
  const { id } = req.params;
  try {
    const available = await groupModel.getAvailableUsersForGroup(id);
    res.status(200).json(available);
  } catch (error) {
    console.error('Erro ao buscar usuários disponíveis:', error && error.message);
    res.status(500).json({ message: 'Erro ao buscar usuários disponíveis', error: error && error.message });
  }
};

// Remover um usuário específico de um grupo
const removeMemberFromGroup = async (req, res) => {
  const { id, userId } = req.params;
  try {
    await groupModel.removeUserFromGroup(id, userId);
    res.status(200).json({ message: 'Usuário removido do grupo' });
  } catch (error) {
    console.error('Erro ao remover membro do grupo:', error && error.message);
    res.status(500).json({ message: 'Erro ao remover membro do grupo', error: error && error.message });
  }
};

const deleteGroup = async (req, res) => {
  const { id } = req.params;
  try {
    await groupModel.deleteGroup(id);
    res.status(200).json({ message: 'Grupo removido' });
  } catch (error) {
    console.error('Erro ao remover grupo:', error && error.message);
    if (error && error.code === 'NOT_FOUND') return res.status(404).json({ message: 'Grupo não encontrado' });
    if (error && error.code === 'HAS_DEPENDENTS') return res.status(400).json({ message: error.message });
    res.status(500).json({ message: 'Erro ao remover grupo', error: error && error.message });
  }
};

// Atualizar um grupo (permite alterar parent_course_id, nome, descrição e tipo)
const updateGroup = async (req, res) => {
  const { id } = req.params;
  const { name, description, group_type, parent_course_id } = req.body;

  if (!name) return res.status(400).json({ message: 'Nome do grupo requerido' });

  try {
    await groupModel.updateGroup(id, { name, description, group_type, parent_course_id });
    res.status(200).json({ message: 'Grupo atualizado' });
  } catch (error) {
    console.error('Erro ao atualizar grupo:', error && error.message);
    if (error && (error.code === 'PARENT_INVALID' || error.code === 'PARENT_NOT_COURSE')) return res.status(400).json({ message: error.message });
    res.status(500).json({ message: 'Erro ao atualizar grupo', error: error && error.message });
  }
};

module.exports = {
  createGroup,
  listGroups,
  listCourses,
  reassignCourseTurmas,
  addUserToGroups,
  getGroupMembers,
  getAvailableUsersForGroup,
  removeMemberFromGroup,
  deleteGroup,
  updateGroup
};
