import React, { useEffect, useState } from 'react';
import Button from './ui/Button';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

const ManagePermissions = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // user_type_id saving
  const [message, setMessage] = useState('');
  const [originalRows, setOriginalRows] = useState([]);
  const navigate = useNavigate();

  // Proteger: apenas admin (user_type_id === 1) pode acessar
  useEffect(() => {
    const userTypeId = localStorage.getItem('user_type_id');
    const userType = localStorage.getItem('user_type');
    const isAdmin = (userTypeId && Number(userTypeId) === 1) || userType === 'admin';
    if (!isAdmin) {
      navigate('/');
      return;
    }
  }, [navigate]);

  // Mapear os valores de user_type do banco de dados para rótulos legíveis em português
  const USER_TYPE_LABELS = {
    // Portuguese
    aluno: 'Aluno',
    professor: 'Professor',
    responsavel: 'Responsável',
    admin: 'Administrador',
    servidor: 'Servidor',
    // English variants
    student: 'Aluno',
    teacher: 'Professor',
    guardian: 'Responsável',
    responsible: 'Responsável',
    server: 'Servidor',
    staff: 'Servidor'
  };

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/admin/permissions');
      const data = resp.data || [];
      setRows(data);
  // manter um snapshot imutável para detectar alterações
  setOriginalRows(JSON.parse(JSON.stringify(data)));
    } catch (err) {
      console.error('Erro ao buscar permissões:', err);
      setMessage('Erro ao buscar permissões');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  // Funções auxiliares
  const capitalize = (s) => typeof s === 'string' && s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  const getPermissionSummary = (r) => {
    const parts = [];
    if (r.can_create_event) parts.push('Criar eventos');
    if (r.can_view_all_events) parts.push('Ver todos os eventos');
    if (r.can_create_user) parts.push('Registrar usuários');
    if (r.can_manage_groups) parts.push('Gerenciar grupos');
    if (r.can_receive_notifications) parts.push('Receber notificações');
    if (parts.length === 0) return 'Nenhuma permissão ativa';
    return parts.join(' · ');
  };

  const toggle = (idx, key) => {
    setRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: copy[idx][key] ? 0 : 1 };
      return copy;
    });
  };

  const isRowChanged = (row) => {
    const orig = originalRows.find(o => o.user_type_id === row.user_type_id);
    if (!orig) return true; // unknown original -> treat as changed
    return (
      Number(orig.can_create_event) !== Number(row.can_create_event) ||
      Number(orig.can_view_all_events) !== Number(row.can_view_all_events) ||
      Number(orig.can_create_user) !== Number(row.can_create_user) ||
      Number(orig.can_manage_groups) !== Number(row.can_manage_groups)
    );
  };

  const save = async (row) => {
    // Confirmar antes de salvar
    const ok = window.confirm('Confirmar aplicação das alterações para este tipo de usuário?');
    if (!ok) return;

    try {
      setSaving(row.user_type_id);
    // preservar a configuração de notificação por usuário lendo o snapshot original
      const orig = originalRows.find(o => o.user_type_id === row.user_type_id) || {};
      const canReceiveNotifications = orig.can_receive_notifications || 0;

      await api.put(`/admin/permissions/${row.user_type_id}`, {
        canCreateEvent: !!row.can_create_event,
        canViewAllEvents: !!row.can_view_all_events,
        canReceiveNotifications: !!canReceiveNotifications,
        canCreateUser: !!row.can_create_user,
        canManageGroups: !!row.can_manage_groups
      });
      setMessage('Permissões salvas');
      // update original snapshot for this row so Save disables
      setOriginalRows(prev => prev.map(o => o.user_type_id === row.user_type_id ? JSON.parse(JSON.stringify(row)) : o));
    } catch (err) {
      console.error('Erro ao salvar permissões:', err);
      setMessage('Erro ao salvar permissões');
    } finally {
      setSaving(null);
    }
  };

  const cancelChanges = (user_type_id) => {
    // revert row to original
    setRows(prev => prev.map(r => r.user_type_id === user_type_id ? JSON.parse(JSON.stringify(originalRows.find(o => o.user_type_id === user_type_id) || r)) : r));
  };


  return (
    <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="m-0">Gerenciar Permissões por Tipo de Usuário</h2>
          <Button as="button" variant="secondary" size="md" className="app-btn--fixed app-btn--primary-shape" onClick={() => navigate('/')}>Voltar</Button>
        </div>

      {message && <div className="alert alert-info" role="status">{message}</div>}

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <>
          {/* Lista de permissões responsiva: linhas/cartões visualmente mais claros para todos os tamanhos de tela */}
          <div className="perm-list">
            {rows.map((r, idx) => {
              const changed = isRowChanged(r);
              return (
                <div className={`perm-row card ${changed ? 'border-warning' : ''}`} key={`perm-${r.user_type_id}`}>
                  <div className="card-body d-flex align-items-center gap-3 flex-column flex-md-row">
                    <div className="perm-content flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start gap-2 flex-column flex-md-row">
                        <div>
                          <div className="perm-title">{USER_TYPE_LABELS[r.user_type] || capitalize(r.user_type)}</div>
                          <div className="perm-summary text-muted small">{getPermissionSummary(r)}</div>
                        </div>
                        <div className="perm-switches d-flex gap-2 mt-2 mt-md-0">
                          <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" id={`cce-${r.user_type_id}`} checked={!!r.can_create_event} onChange={() => toggle(idx, 'can_create_event')} />
                            <label className="form-check-label small ms-2 d-none d-md-inline" htmlFor={`cce-${r.user_type_id}`}>Criar eventos</label>
                          </div>
                          <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" id={`cva-${r.user_type_id}`} checked={!!r.can_view_all_events} onChange={() => toggle(idx, 'can_view_all_events')} />
                            <label className="form-check-label small ms-2 d-none d-md-inline" htmlFor={`cva-${r.user_type_id}`}>Ver todos os eventos</label>
                          </div>
                          <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" id={`ccu-${r.user_type_id}`} checked={!!r.can_create_user} onChange={() => toggle(idx, 'can_create_user')} />
                            <label className="form-check-label small ms-2 d-none d-md-inline" htmlFor={`ccu-${r.user_type_id}`}>Registrar usuários</label>
                          </div>
                          <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" id={`cmg-${r.user_type_id}`} checked={!!r.can_manage_groups} onChange={() => toggle(idx, 'can_manage_groups')} />
                            <label className="form-check-label small ms-2 d-none d-md-inline" htmlFor={`cmg-${r.user_type_id}`}>Gerenciar grupos</label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="perm-actions text-end mt-3 mt-md-0">
                      <Button size="md" variant="primary" className={`app-btn--fixed me-2 ${saving === r.user_type_id ? 'app-btn--disabled' : ''}`} onClick={() => save(rows[idx])} disabled={saving === r.user_type_id || !changed}>{saving === r.user_type_id ? 'Salvando...' : 'Salvar'}</Button>
                      <Button size="md" variant="secondary" className="app-btn--fixed" onClick={() => cancelChanges(r.user_type_id)} disabled={!changed}>Cancelar</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3">
            <h6>Legenda</h6>
            <ul>
              <li><strong>Criar eventos</strong>: Permite criar novos eventos para o tipo de usuário.</li>
              <li><strong>Criar usuários</strong>: Permite que o tipo de usuário registre novos usuários no sistema.</li>
              <li><strong>Gerenciar grupos</strong>: Permite que o tipo de usuário gerencie grupos (criar, editar, atribuir membros).</li>
              <li><strong>Ver todos os eventos</strong>: Permite visualizar eventos de outros grupos/usuários.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default ManagePermissions;
