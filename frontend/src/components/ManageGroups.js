import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
// usando overlay/card customizado em vez de react-modal para consistência visual

const ManageGroups = () => {
	const [grupos, setGrupos] = useState([]);
	const [loading, setLoading] = useState(true);
	const [message, setMessage] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [modalIsOpen, setModalIsOpen] = useState(false);
	const [membrosModalIsOpen, setMembrosModalIsOpen] = useState(false);
	const [editModalIsOpen, setEditModalIsOpen] = useState(false);
	const [selectedGroup, setSelectedGroup] = useState(null);
	const [membros, setMembros] = useState([]);
	const [usuariosDisponiveis, setUsuariosDisponiveis] = useState([]);
  
	// Estados do formulário
	const [novoGrupo, setNovoGrupo] = useState({
		name: '',
		description: '',
		group_type: 'custom',
		parent_course_id: null // opcional: quando tipo === 'turma' podemos vincular a um curso
	});
  
	const navigate = useNavigate();

	// Tipos de grupo disponíveis
	const tiposGrupo = [
		{ value: 'turma', label: 'Turma' },
		{ value: 'turno', label: 'Turno' },
		{ value: 'area_ensino', label: 'Área de Ensino' },
		{ value: 'curso', label: 'Curso' },
		{ value: 'custom', label: 'Personalizado' }
	];

    // filtros de busca
    const [searchName, setSearchName] = useState('');
    const [filterType, setFilterType] = useState('all');

	// Paginação
	const [currentPage, setCurrentPage] = useState(1);
	const groupsPerPage = 20;

	useEffect(() => {
		carregarGrupos();
	}, []);

	// reset page when filters or groups change
	useEffect(() => {
		setCurrentPage(1);
	}, [searchName, filterType, grupos]);

	const carregarGrupos = async () => {
		try {
			setLoading(true);
			const response = await api.get('/groups');

			setGrupos(response.data);
			console.log('carregarGrupos: received', Array.isArray(response.data) ? response.data.length : 0, 'groups');
			if (Array.isArray(response.data)) console.log('carregarGrupos sample names:', response.data.slice(0,8).map(g => `${g.id}:${g.name}`));
			return Array.isArray(response.data) ? response.data : [];
		} catch (error) {
			console.error('Erro ao carregar grupos:', error);
			// Se a requisição autenticada falhar (401/403), tentar o endpoint público como fallback
			if (error.response?.status === 401) {
				// tentar endpoint público
				try {
					const pub = await api.get('/groups/public');
					setGrupos(pub.data);
					return Array.isArray(pub.data) ? pub.data : [];
				} catch (e) {
					console.error('Erro ao carregar grupos publicos:', e);
					navigate('/login');
					return null;
				}
			} else if (error.response?.status === 403) {
				// tentar endpoint público também
				try {
					const pub = await api.get('/groups/public');
					setGrupos(pub.data);
					return Array.isArray(pub.data) ? pub.data : [];
				} catch (e) {
					console.error('Erro ao carregar grupos publicos:', e);
					setMessage('Sem permissão para ver grupos');
					return null;
				}
			} else {
				setMessage('Erro ao carregar grupos');
				return null;
			}
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
    
		if (!novoGrupo.name.trim()) {
			setMessage('Nome do grupo é obrigatório');
			return;
		}

			try {
				if (submitting) return;
				setSubmitting(true);
				const resp = await api.post('/groups/create', novoGrupo);
				console.log('Resposta create group:', resp.status, resp.data);

				// Se o backend retornou o grupo criado, inseri-lo de forma otimista para que a UI mostre imediatamente
				const created = resp.data && resp.data.group ? resp.data.group : null;
				if (created) {
					// atualização otimista
					setGrupos(prev => [created, ...prev]);
					// close modal immediately for better UX
					setModalIsOpen(false);
					setNovoGrupo({ name: '', description: '', group_type: 'custom', parent_course_id: null });
				}

				// Refresh full list to ensure UI matches DB (keeps behavior simple and deterministic)
				const fetched = await carregarGrupos();
				// If fetched list did not include the created group, ensure it stays visible
				if (created && Array.isArray(fetched) && !fetched.find(g => Number(g.id) === Number(created.id))) {
					setGrupos(prev => [created, ...prev.filter(g => Number(g.id) !== Number(created.id))]);
				}
				setMessage('Grupo criado com sucesso!');
			} catch (error) {
				console.error('Erro ao criar grupo:', error);
				setMessage(`${error.response?.data?.message || 'Erro ao criar grupo'}`);
			} finally {
				setSubmitting(false);
			}
	};

	const handleEdit = async (e) => {
		e.preventDefault();
    
		try {
			await api.put(`/groups/${selectedGroup.id}`, selectedGroup);

			setMessage('Grupo atualizado com sucesso!');
			setEditModalIsOpen(false);
			carregarGrupos();
		} catch (error) {
			console.error('Erro ao atualizar grupo:', error);
			setMessage(`${error.response?.data?.message || 'Erro ao atualizar grupo'}`);
		}
	};

	const handleDelete = async (groupId) => {
		if (!window.confirm('Tem certeza que deseja deletar este grupo?')) {
			return;
		}

		try {
			await api.delete(`/groups/${groupId}`);

			setMessage('Grupo deletado com sucesso!');
			carregarGrupos();
		} catch (error) {
			console.error('Erro ao deletar grupo:', error);
			// Prefer structured server message, then fallback to error.message
			let serverMsg = error?.response?.data?.message || error?.response?.data?.error;
			if (!serverMsg && error?.response && typeof error.response.data === 'string') serverMsg = error.response.data;
			if (!serverMsg) serverMsg = error.message || 'Erro ao deletar grupo';
			setMessage(`${serverMsg}`);
		}
	};

	const verMembros = (group) => {
		// navigate to a dedicated members page for this group
		navigate(`/gerenciar-grupos/${group.id}/membros`);
	};

	const adicionarMembro = async (userId) => {
		try {
					await api.post('/groups/assign-user', {
				groupId: selectedGroup.id,
				userId: userId
			});

			// Recarregar membros
			verMembros(selectedGroup);
			setMessage('Usuário adicionado ao grupo!');
		} catch (error) {
			console.error('Erro ao adicionar membro:', error);
			setMessage(`${error.response?.data?.message || 'Erro ao adicionar membro'}`);
		}
	};

	const removerMembro = async (userId) => {
		if (!window.confirm('Tem certeza que deseja remover este usuário do grupo?')) {
			return;
		}

		try {
			await api.delete(`/groups/${selectedGroup.id}/members/${userId}`);

			// Recarregar membros
			verMembros(selectedGroup);
			setMessage('Usuário removido do grupo!');
		} catch (error) {
			console.error('Erro ao remover membro:', error);
			setMessage(`${error.response?.data?.message || 'Erro ao remover membro'}`);
		}
	};

	const formatDate = (dateString) => {
		return new Date(dateString).toLocaleDateString('pt-BR');
	};

	const getTipoLabel = (tipo) => {
		const tipoObj = tiposGrupo.find(t => t.value === tipo);
		return tipoObj ? tipoObj.label : tipo;
	};

    if (loading) {
		return (
			<div className="container mt-4">
				<div className="text-center">
					<div className="spinner-border text-primary" role="status">
						<span className="visually-hidden">Carregando...</span>
					</div>
					<p className="mt-2">Carregando grupos...</p>
				</div>
			</div>
		);
	}

    const filteredGrupos = grupos.filter(g => {
		const q = searchName.trim().toLowerCase();
		if (q && !(g.name || '').toLowerCase().includes(q)) return false;
		if (filterType !== 'all' && String(g.group_type) !== String(filterType)) return false;
		return true;
	});

	

	const totalPages = Math.max(1, Math.ceil(filteredGrupos.length / groupsPerPage));
	const startIndex = (currentPage - 1) * groupsPerPage;
	const displayedGrupos = filteredGrupos.slice(startIndex, startIndex + groupsPerPage);

	return (
		<div className="container mt-4">
			{/* Cabeçalho */}
	            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap">
				<div className="d-flex align-items-center">
					{/* Botão Voltar */}
					<Button as="button" variant="secondary" size="md" className="app-btn--fixed app-btn--primary-shape me-3" onClick={() => navigate(-1)}>Voltar</Button>
					<div>
						<h2 className="mb-1">Gerenciar Grupos</h2>
						<p className="text-muted">Organize usuários em grupos para controle de acesso a eventos</p>
					</div>
				</div>
				<div className="d-flex align-items-center gap-2 mt-3 mt-md-0 filters-row">
					<input type="search" className="form-control form-control-sm" placeholder="Buscar por nome..." value={searchName} onChange={e => setSearchName(e.target.value)} style={{minWidth:220}} />
					<select className="form-select form-select-sm" value={filterType} onChange={e => setFilterType(e.target.value)} style={{width:160}}>
						<option value="all">Todos os tipos</option>
						{tiposGrupo.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
					</select>
					<button 
					className="btn btn-custom-primary"
					onClick={() => setModalIsOpen(true)}
					>
						<i className="fas fa-plus me-2"></i>
						Novo Grupo
					</button>
				</div>
			</div>

			{/* Mensagem */}
			{message && (
				<div className={`alert border-0 ${message.includes('sucesso') ? 'alert-success' : 'alert-danger'}`} role="alert">
					{message}
				</div>
			)}

			{/* Lista de Grupos */}
			{grupos.length === 0 ? (
				<div className="text-center py-5">
					<i className="fas fa-users fa-3x text-muted mb-3"></i>
					<h4 className="text-muted">Nenhum grupo cadastrado</h4>
					<p className="text-muted">Clique em "Novo Grupo" para começar</p>
				</div>
			) : (
				<div className="row">
					{filteredGrupos.length === 0 ? (
						<div className="col-12 text-center py-4">
							<p className="text-muted">Nenhum grupo corresponde aos filtros.</p>
						</div>
					) : (
						displayedGrupos.map((grupo) => {
							return (
								<div key={grupo.id} className="col-md-6 col-lg-4 mb-4">
									<div className="card h-100 group-card shadow-sm">
										<div className="card-body">
											<div className="d-flex justify-content-between align-items-start mb-3">
												<h5 className="card-title mb-0">{grupo.name}</h5>
												<span className={`badge badge-group-type`}>
													{getTipoLabel(grupo.group_type)}
												</span>
											</div>
											{grupo.description && (
												<p className="card-text text-muted small">{grupo.description}</p>
											)}
											<div className="mb-3">
												<small className="text-muted">
													<i className="fas fa-user me-1"></i>
													{grupo.member_count} membro(s)
												</small>
												<br />
												<small className="text-muted">
													<i className="fas fa-calendar me-1"></i>
													Criado em {formatDate(grupo.created_at)}
												</small>
												{grupo.created_by_name && (
													<>
														<br />
														<small className="text-muted">
															<i className="fas fa-user-plus me-1"></i>
															Por {grupo.created_by_name} {grupo.created_by_lastname}
														</small>
													</>
												)}
											</div>
										</div>
										<div className="card-footer bg-transparent">
											<div className="btn-group w-100" role="group">
												<button 
													className="btn btn-outline-primary btn-sm"
													onClick={() => verMembros(grupo)}
												>
													<i className="fas fa-users"></i> Membros
												</button>
												<button 
													className="btn btn-outline-secondary btn-sm"
													onClick={() => { setSelectedGroup(grupo); setEditModalIsOpen(true); }}
												>
													<i className="fas fa-edit"></i>
												</button>
												<button 
													className="btn btn-outline-danger btn-sm"
													onClick={() => handleDelete(grupo.id)}
												>
													<i className="fas fa-trash"></i>
												</button>
												</div>
											</div>
										</div>
									</div>
								);
							})
						)}
					</div>
			)}

				{/* Paginação */}
				{filteredGrupos.length > groupsPerPage && (
					<div className="pagination mt-3 d-flex align-items-center justify-content-center">
						<button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn btn-sm btn-light me-2">Anterior</button>
						<span style={{ margin: '0 12px', color: '#6BA82C', fontWeight: 'bold' }}>{`Página ${currentPage} de ${totalPages} (${filteredGrupos.length} grupo${filteredGrupos.length !== 1 ? 's' : ''})`}</span>
						<button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn btn-sm btn-light ms-2">Próxima</button>
					</div>
				)}

					{/* Modal Criar Grupo - Card overlay (melhor contraste) */}
					{modalIsOpen && (
						<div
							onClick={(e) => { if (e.target === e.currentTarget) setModalIsOpen(false); }}
							style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}
						>
							<div style={{ width: '92%', maxWidth: 800 }}>
								<div className="card shadow modal-content-custom">
											  <div className="card-header d-flex justify-content-between align-items-center modal-header-custom">
										<div>
											<h5 className="mb-0"><i className="fas fa-plus-circle me-2"></i> Criar Novo Grupo</h5>
										</div>
										<button type="button" className="btn-close" aria-label="Fechar" onClick={() => setModalIsOpen(false)}></button>
									</div>
									<div className="card-body">
										<form onSubmit={handleSubmit}>
											<div className="mb-3">
																								<label className="form-label">Nome do Grupo *</label>
																								<input
																									type="text"
																									className="form-control form-control-custom"
																									value={novoGrupo.name}
																									onChange={(e) => setNovoGrupo({...novoGrupo, name: e.target.value})}
																									placeholder="Ex: 3º Ano A, Turno Manhã..."
																									required
																								/>
											</div>
											<div className="mb-3">
												<label className="form-label">Tipo de Grupo</label>
													<select
																									className="form-select form-control-custom"
																									value={novoGrupo.group_type}
														onChange={(e) => setNovoGrupo({...novoGrupo, group_type: e.target.value})}
																								>
													{tiposGrupo.map(tipo => (
														<option key={tipo.value} value={tipo.value}>
															{tipo.label}
														</option>
													))}
												</select>
											</div>

											{/* Se for Turma, permitir selecionar o Curso pai (lista de grupos do tipo 'curso') */}
											{novoGrupo.group_type === 'turma' && (
												<div className="mb-3">
													<label className="form-label">Curso</label>
													<select
														className="form-select form-control-custom"
														value={novoGrupo.parent_course_id || ''}
														onChange={(e) => setNovoGrupo({...novoGrupo, parent_course_id: e.target.value || null})}
													>
														<option value="">(Nenhum)</option>
														{grupos.filter(g => String(g.group_type).toLowerCase() === 'curso').map(g => (
															<option key={g.id} value={g.id}>{g.name}</option>
														))}
													</select>
												</div>
											)}
											<div className="mb-3">
												<label className="form-label">Descrição</label>
																								<textarea
																									className="form-control form-control-custom"
																									rows="3"
																									value={novoGrupo.description}
																									onChange={(e) => setNovoGrupo({...novoGrupo, description: e.target.value})}
																									placeholder="Descrição opcional do grupo..."
																								/>
											</div>
																		<div className="d-flex justify-content-end">
																		<Button as="button" variant="secondary" className="me-2" onClick={() => setModalIsOpen(false)}>Cancelar</Button>
																		<Button as="button" type="submit" variant="primary">Criar Grupo</Button>
																	</div>
										</form>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Modal Editar Grupo - Card overlay (melhor contraste) */}
										{editModalIsOpen && (
											<div
												onClick={(e) => { if (e.target === e.currentTarget) setEditModalIsOpen(false); }}
												style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}
											>
												<div style={{ width: '92%', maxWidth: 800 }}>
													<div className="card shadow modal-content-custom">
														<div className="card-header d-flex justify-content-between align-items-center modal-header-custom">
															<div>
																<h5 className="mb-0"><i className="fas fa-edit me-2"></i> Editar Grupo</h5>
															</div>
															<button type="button" className="close-x" aria-label="Fechar" onClick={() => setEditModalIsOpen(false)}>×</button>
														</div>
														<div className="card-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
															<form onSubmit={handleEdit}>
																{selectedGroup && (
																	<>
																												<div className="mb-3">
																													<label className="form-label">Nome do Grupo *</label>
																													<input
																														type="text"
																														className="form-control form-control-custom"
																														value={selectedGroup.name}
																														onChange={(e) => setSelectedGroup({...selectedGroup, name: e.target.value})}
																														required
																													/>
																												</div>
																												<div className="mb-3">
																													<label className="form-label">Tipo de Grupo</label>
																													<select
																														className="form-select form-control-custom"
																														value={selectedGroup.group_type}
																														onChange={(e) => setSelectedGroup({...selectedGroup, group_type: e.target.value})}
																													>
																				{tiposGrupo.map(tipo => (
																					<option key={tipo.value} value={tipo.value}>
																						{tipo.label}
																					</option>
																				))}
																			</select>
																		</div>

																												{/* Se for Turma, permitir selecionar o Curso pai (lista de grupos do tipo 'curso') */}
																												{selectedGroup?.group_type === 'turma' && (
																													<div className="mb-3">
																														<label className="form-label">Curso</label>
																														<select
																															className="form-select form-control-custom"
																															value={selectedGroup.parent_course_id || ''}
																															onChange={(e) => setSelectedGroup({...selectedGroup, parent_course_id: e.target.value || null})}
																														>
																															<option value="">(Nenhum)</option>
																															{grupos.filter(g => String(g.group_type).toLowerCase() === 'curso').map(g => (
																																<option key={g.id} value={g.id}>{g.name}</option>
																															))}
																														</select>
																													</div>
																												)}
																												<div className="mb-3">
																													<label className="form-label">Descrição</label>
																													<textarea
																														className="form-control form-control-custom"
																														rows="3"
																														value={selectedGroup.description || ''}
																														onChange={(e) => setSelectedGroup({...selectedGroup, description: e.target.value})}
																													/>
																												</div>
																	</>
																)}
																								<div className="d-flex justify-content-end">
																									<Button as="button" variant="secondary" className="me-2" onClick={() => setEditModalIsOpen(false)}>Cancelar</Button>
																									<Button as="button" type="submit" variant="primary">Salvar Alterações</Button>
																								</div>
															</form>
														</div>
													</div>
												</div>
											</div>
										)}

						{/* Modal Membros - Card overlay consistente */}
						{membrosModalIsOpen && (
							<div
								onClick={(e) => { if (e.target === e.currentTarget) setMembrosModalIsOpen(false); }}
								style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}
							>
								<div style={{ width: '96%', maxWidth: 1000 }}>
													<div className="card shadow modal-content-custom">
										<div className="card-header d-flex justify-content-between align-items-center bg-white">
											<div>
												<h5 className="mb-0"><i className="fas fa-users me-2"></i> Membros do Grupo: {selectedGroup?.name}</h5>
											</div>
											<button type="button" className="btn-close" aria-label="Fechar" onClick={() => setMembrosModalIsOpen(false)}></button>
										</div>
										<div className="card-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
											{/* Membros Atuais */}
											<div className="mb-4">
												<h6 className="mb-3">
													<i className="fas fa-user-check me-2 text-success"></i>
													Membros Atuais ({membros.length})
												</h6>
												{membros.length === 0 ? (
													<p className="text-muted">Nenhum membro no grupo</p>
												) : (
													<div className="list-group">
														{membros.map(membro => (
															<div key={membro.id} className="list-group-item d-flex justify-content-between align-items-center">
																<div>
																	<strong>{membro.first_name} {membro.last_name}</strong>
																	<br />
																	<small className="text-muted">{membro.email} | {getTipoLabel(membro.user_type)}</small>
																	<br />
																	<small className="text-muted">Entrou em: {formatDate(membro.joined_at)}</small>
																</div>
																<button 
																	className="btn btn-outline-danger btn-sm"
																	onClick={() => removerMembro(membro.id)}
																>
																	<i className="fas fa-times"></i> Remover
																</button>
															</div>
														))}
													</div>
												)}
											</div>

											{/* Usuários Disponíveis */}
											<div>
												<h6 className="mb-3">
													<i className="fas fa-user-plus me-2 text-primary"></i>
													Adicionar Membros ({usuariosDisponiveis.length} disponíveis)
												</h6>
												{usuariosDisponiveis.length === 0 ? (
													<p className="text-muted">Todos os usuários já estão no grupo</p>
												) : (
													<div className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
														{usuariosDisponiveis.map(usuario => (
															<div key={usuario.id} className="list-group-item d-flex justify-content-between align-items-center">
																<div>
																	<strong>{usuario.first_name} {usuario.last_name}</strong>
																	<br />
																	<small className="text-muted">{usuario.email} | {getTipoLabel(usuario.user_type)}</small>
																</div>
																<button 
																	className="btn btn-outline-primary btn-sm"
																	onClick={() => adicionarMembro(usuario.id)}
																>
																	<i className="fas fa-plus"></i> Adicionar
																</button>
															</div>
														))}
													</div>
												)}
											</div>
										</div>
										<div className="card-footer bg-white d-flex justify-content-end">
											<button 
												type="button" 
												className="btn btn-secondary"
												onClick={() => setMembrosModalIsOpen(false)}
											>
												Fechar
											</button>
										</div>
									</div>
								</div>
							</div>
						)}
		</div>
	);
};

export default ManageGroups;
