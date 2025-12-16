import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

const GroupMembers = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Rastrear alterações pendentes localmente
  const [toAdd, setToAdd] = useState(new Set());
  const [toRemove, setToRemove] = useState(new Set());
  // Guardar temporariamente objetos de usuário marcados para adicionar
  const pendingAddedRef = useRef(new Map());
  const [membersQuery, setMembersQuery] = useState('');
  const [availableQuery, setAvailableQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // tentar obter informações básicas do grupo se disponível; como fallback, listar grupos e buscar pelo id
      try {
        const g = await api.get(`/groups/${groupId}`);
        setGroup(g.data);
      } catch (e) {
        // fallback: se o backend não expõe GET /groups/:id, tentar GET /groups e localizar o grupo
        try {
          const all = await api.get('/groups');
          const found = (all.data || []).find(gr => String(gr.id) === String(groupId));
          if (found) setGroup(found);
        } catch (err2) {
          // ainda ignorar; o grupo permanecerá null e a UI exibirá um título padrão
        }
      }

      const [mResp, aResp] = await Promise.all([
        api.get(`/groups/${groupId}/members`),
        api.get(`/groups/${groupId}/available-users`),
      ]);

      const normalizeArray = (resp) => {
        if (!resp) return [];
        const d = resp.data;
        if (Array.isArray(d)) return d;
        if (d && Array.isArray(d.members)) return d.members;
        if (d && Array.isArray(d.users)) return d.users;
        if (d && typeof d === 'object') return Object.values(d);
        return [];
      };

      setMembers(normalizeArray(mResp));
      setAvailable(normalizeArray(aResp));
      setToAdd(new Set());
      setToRemove(new Set());
    } catch (err) {
      console.error('Erro ao carregar membros:', err);
      setMessage('Erro ao carregar membros do grupo');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const markAdd = (userId) => {
    setToAdd(prev => new Set(prev).add(userId));
    // remover da lista de disponíveis e adicionar imediatamente aos membros
    setAvailable(prev => {
      if (!Array.isArray(prev)) return [];
      const userObj = prev.find(u => Number(u.id) === Number(userId));
      const next = prev.filter(u => Number(u.id) !== Number(userId));
      if (userObj) {
        // guardar para possível desfazer antes do save
        pendingAddedRef.current.set(Number(userId), userObj);
        setMembers(curr => [userObj, ...curr]);
      }
      return next;
    });
  };

  const unmarkAdd = (userId) => {
    setToAdd(prev => {
      const s = new Set(prev);
      s.delete(userId);
      return s;
    });
    // Restaurar a lista de disponíveis se tivermos o objeto em pendingAddedRef
    const stored = pendingAddedRef.current.get(Number(userId));
    if (stored) {
      setMembers(prev => prev.filter(m => Number(m.id) !== Number(userId)));
      setAvailable(prev => [stored, ...(Array.isArray(prev) ? prev : [])]);
      pendingAddedRef.current.delete(Number(userId));
      return;
    }
    // fallback: recarregar dados do servidor
    fetchData();
  };

  const markRemove = (userId) => {
    setToRemove(prev => new Set(prev).add(userId));
  };

  const unmarkRemove = (userId) => {
    setToRemove(prev => {
      const s = new Set(prev);
      s.delete(userId);
      return s;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
  // Aplicar remoções primeiro
      for (const userId of Array.from(toRemove)) {
        try {
          await api.delete(`/groups/${groupId}/members/${userId}`);
        } catch (e) {
          console.warn('Erro ao remover membro', userId, e);
        }
      }
  // Aplicar adições
      for (const userId of Array.from(toAdd)) {
        try {
          await api.post('/groups/assign-user', { groupId: Number(groupId), userId: Number(userId) });
        } catch (e) {
          console.warn('Erro ao adicionar membro', userId, e);
        }
      }

  setMessage('Alterações salvas com sucesso');
  // recarregar dados
  await fetchData();
    } catch (err) {
      console.error('Erro ao salvar alterações de membros:', err);
      setMessage('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container mt-4">Carregando membros...</div>;

  return (
    <div className="container mt-4 user-members-page">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="mb-0">{group ? group.name : 'Membros do Grupo'}</h3>
          <p className="text-muted">Gerencie os membros deste grupo</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>Voltar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="row">
        <div className="col-md-6 mb-3">
          <div className="members-block card">
            <div className="card-body">
              <div className="d-flex justify-content-start align-items-center mb-2">
                <h5 className="mb-0">Membros atuais: <span className="count text-muted">{members.length}</span></h5>
              </div>
              <div className="mb-2">
                <input type="search" className="form-control" placeholder="Buscar membros..." value={membersQuery} onChange={e => setMembersQuery(e.target.value)} />
              </div>
              {members.length === 0 ? <p className="text-muted">Nenhum membro.</p> : (
                <div className="list-group">
                  {members
                    .filter(m => {
                      const q = membersQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (`${m.first_name} ${m.last_name}`.toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q));
                    })
                    .map(m => (
                      <div key={m.id} className="list-group-item d-flex justify-content-between align-items-center">
                        <div className="member-info">
                          <strong>{m.first_name} {m.last_name}</strong>
                          <br />
                          <small className="text-muted">{m.email}</small>
                        </div>
                        <div className="member-action">
                          {toRemove.has(m.id) ? (
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => unmarkRemove(m.id)}>Desfazer</button>
                          ) : (
                            <button className="btn btn-sm btn-outline-danger" onClick={() => markRemove(m.id)}>Remover</button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-3">
          <div className="members-block card">
            <div className="card-body">
              <div className="d-flex justify-content-start align-items-center mb-2">
                <h5 className="mb-0">Usuários disponíveis: <span className="count text-muted">{available.length}</span></h5>
              </div>
              <div className="mb-2">
                <input type="search" className="form-control" placeholder="Buscar usuários..." value={availableQuery} onChange={e => setAvailableQuery(e.target.value)} />
              </div>
              {available.length === 0 ? <p className="text-muted">Nenhum usuário disponível.</p> : (
                <div className="list-group">
                  {available
                    .filter(u => {
                      const q = availableQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (`${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
                    })
                    .map(u => (
                      <div key={u.id} className="list-group-item d-flex justify-content-between align-items-center">
                        <div className="member-info">
                          <strong>{u.first_name} {u.last_name}</strong>
                          <br />
                          <small className="text-muted">{u.email}</small>
                        </div>
                        <div className="member-action">
                          {toAdd.has(u.id) ? (
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => unmarkAdd(u.id)}>Desfazer</button>
                          ) : (
                            <button className="btn btn-sm btn-outline-primary" onClick={() => markAdd(u.id)}>Adicionar</button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupMembers;
