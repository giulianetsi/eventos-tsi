import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from './ui/Button';

const EventForm = () => {
  // Estados do formulário: campos principais
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('');

  // Público-alvo: tipos de usuário que verão o evento.
  // Por convenção inicial marcamos todos como true (público amplo).
  const [publicoAlvo, setPublicoAlvo] = useState({
    student: true,    // Alunos
    teacher: true,    // Professores
    guardian: true,   // Responsáveis
    admin: true       // Administradores
  });
  // Indica se a opção "Todos" está marcada (shortcut para selecionar/desmarcar todos)
  const [publicoTodos, setPublicoTodos] = useState(true);

  // Estados relacionados à data/hora do evento.
  // Suporta data única ou período.
  // removido estado não utilizado: dataHorarioEvento
  const [dateMode, setDateMode] = useState('single'); // 'single' ou 'period'
  const [singleDate, setSingleDate] = useState(''); // formato YYYY-MM-DD para input date
  const [singleTime, setSingleTime] = useState(''); // formato HH:MM para input time (opcional)
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  // Flags que controlam exibição do evento no painel
  const [mostrarData, setMostrarData] = useState(true);
  const [mostrarApenasNaData, setMostrarApenasNaData] = useState(false);

  // Local opcional
  const [localEvento, setLocalEvento] = useState('');

  // Notificações: ativação e modo (immediate | scheduled)
  const [sendNotificationChecked, setSendNotificationChecked] = useState(true);
  const [sendNotificationMode, setSendNotificationMode] = useState('immediate'); // 'immediate' | 'scheduled'
  // Data/hora para notificação agendada no formato ISO local (YYYY-MM-DDTHH:MM)
  const [scheduledNotificationDatetime, setScheduledNotificationDatetime] = useState('');

  // Mensagens de feedback para o usuário (sucesso/erro) e estado de loading
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' | 'error' | ''
  const [loading, setLoading] = useState(false);

  // Estados relacionados a grupos (opcionais): lista de grupos do backend, seleção e modo combinado
  const [grupos, setGrupos] = useState([]);
  const [gruposSelecionados, setGruposSelecionados] = useState([]);
  const [gruposCombinados, setGruposCombinados] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const editingEvento = location.state && location.state.evento;

  // Se estivermos no modo de edição (venho de outro lugar com `location.state.evento`),
  // preencher os campos iniciais com os valores existentes.
  useEffect(() => {
    if (editingEvento) {
      setTitulo(editingEvento.titulo || '');
      setDescricao(editingEvento.texto || '');
      setTipo(editingEvento.tipo || '');
  // Preferir datetime ISO bruto se fornecido pelo backend -> preencher singleDate/singleTime
      if (editingEvento.event_datetime_raw) {
  // tentar separar ISO em data e hora para os inputs
        const raw = editingEvento.event_datetime_raw;
        const m = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T?(\d{2}:\d{2}))?/);
        if (m) {
          setSingleDate(m[1]);
          setSingleTime(m[2] || '');
          setDateMode('single');
        } else {
          setSingleDate(editingEvento.data || '');
        }
      } else if (editingEvento.data) {
          // fallback: tentar parsear DD/MM/YYYY para YYYY-MM-DD e hora opcional
        const matchDateOnly = editingEvento.data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        const matchWithTime = editingEvento.data.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})$/);
        if (matchWithTime) {
          const [, day, month, year, time] = matchWithTime;
          setSingleDate(`${year}-${month}-${day}`);
          setSingleTime(time);
          setDateMode('single');
        } else if (matchDateOnly) {
          const [, day, month, year] = matchDateOnly;
          setSingleDate(`${year}-${month}-${day}`);
          setDateMode('single');
        } else {
          setSingleDate(editingEvento.data || '');
        }
      }
  // Se o backend fornecer campos de período, preencher o modo 'period'
      if (editingEvento.data_period_start || editingEvento.data_period_end) {
        setPeriodStart(editingEvento.data_period_start || '');
        setPeriodEnd(editingEvento.data_period_end || '');
        setDateMode('period');
      }
  // sinalizador mostrar_data
      if (typeof editingEvento.mostrar_data !== 'undefined') {
        setMostrarData(Boolean(editingEvento.mostrar_data));
      }
      if (typeof editingEvento.mostrar_apenas_na_data !== 'undefined') {
        setMostrarApenasNaData(Boolean(editingEvento.mostrar_apenas_na_data));
      }
  // preencher campos de agendamento de notificação se estiver editando
      if (typeof editingEvento.sendNotification !== 'undefined') {
        setSendNotificationChecked(Boolean(editingEvento.sendNotification));
      }
      if (editingEvento.event_datetime_raw) {
  // Preencher scheduledNotificationDatetime com a datetime do evento, se disponível
        const raw = editingEvento.event_datetime_raw;
        const isoWithTime = raw.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
        if (isoWithTime) {
          setScheduledNotificationDatetime(isoWithTime[0]);
        }
      } else if (editingEvento.data && editingEvento.hora) {
  // combinar data e hora se fornecidos separadamente
        const iso = `${editingEvento.data.split('/').reverse().join('-')}T${editingEvento.hora}`;
        setScheduledNotificationDatetime(iso);
      }
      setLocalEvento(editingEvento.local || '');
  // Se o backend fornecer target_user_types, preencher publicoAlvo
      if (editingEvento.target_user_types && Array.isArray(editingEvento.target_user_types)) {
        const map = { student: false, teacher: false, guardian: false, admin: false };
        editingEvento.target_user_types.forEach(t => {
          const key = String(t).toLowerCase();
          if (map.hasOwnProperty(key)) map[key] = true;
        });
        setPublicoAlvo(map);
        setPublicoTodos(Object.values(map).every(Boolean));
      }
    }
  }, [editingEvento]);

  // Helper: retorna string YYYY-MM-DD para a data local (não UTC)
  const getLocalDateString = (d = new Date()) => {
    const y = d.getFullYear();
    const m = (`0${d.getMonth() + 1}`).slice(-2);
    const day = (`0${d.getDate()}`).slice(-2);
    return `${y}-${m}-${day}`;
  };

  // Quando usuário altera data/hora do evento, preenche automaticamente
  // o campo de agendamento da notificação (se ainda não definido).
  useEffect(() => {
    if (!scheduledNotificationDatetime) {
      if (dateMode === 'single' && singleDate) {
        const dt = singleTime ? `${singleDate}T${singleTime}` : `${singleDate}T09:00`;
        setScheduledNotificationDatetime(dt);
      } else if (dateMode === 'period' && periodStart) {
        // usar horário padrão para periodStart
        setScheduledNotificationDatetime(`${periodStart}T09:00`);
      }
    }
  }, [singleDate, singleTime, periodStart, dateMode, scheduledNotificationDatetime]);

  // Carregar grupos disponíveis do backend para popular a seção "Grupos"
  useEffect(() => {
    const carregarGrupos = async () => {
      try {
        const res = await api.get('/groups');
        // o backend pode retornar { data: [...] } ou um array diretamente
        // Normalizamos para `res.data` quando possível.
        setGrupos(res.data || []);
      } catch (err) {
        console.error('Erro ao carregar grupos:', err);
      }
    };

    carregarGrupos();
  }, []);

  // Opções para tipo de evento
  // Tipos de evento usados no select de categoria
  const tiposEvento = [
    { value: 'evento', label: 'Evento' },
    { value: 'reuniao', label: 'Reunião' },
    { value: 'aviso', label: 'Aviso/Comunicado' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'palestra', label: 'Palestra' },
    { value: 'treinamento', label: 'Treinamento' },
    { value: 'cerimonia', label: 'Cerimônia' },
    { value: 'outros', label: 'Outros' }
  ];


  // Opções para público-alvo
  // Opções para definição de público (visibilidade)
  // removido opcoesPublico não utilizado

  const handlePublicoChange = (tipo) => {
    setPublicoAlvo(prev => {
      const next = { ...prev, [tipo]: !prev[tipo] };
      // Se algum tipo individual for desmarcado, atualizar 'Todos'
      const allSelected = Object.values(next).every(Boolean);
      setPublicoTodos(allSelected);
      return next;
    });
  };

  const handlePublicoTodosChange = () => {
    setPublicoTodos(prev => {
      const next = !prev;
      setPublicoAlvo({ student: next, teacher: next, guardian: next, admin: next });
      return next;
    });
  };

  const handleGrupoChange = (grupoId) => {
    setGruposSelecionados(prev => {
      if (prev.includes(grupoId)) {
        return prev.filter(id => id !== grupoId);
      } else {
        return [...prev, grupoId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Validação explícita mínima antes de qualquer processamento
    const hasDate = (dateMode === 'single' ? Boolean(singleDate) : Boolean(periodStart && periodEnd));
    if (!titulo || !hasDate) {
      setMessage('Campos obrigatórios não preenchidos');
      setMessageType('error');
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

      // 1) Estado local: ler checkbox de notificação
  const sendNotification = sendNotificationChecked;

  // 2) Validações básicas do formulário
    if (!titulo.trim() || !descricao.trim() || !tipo) {
      setMessage('Por favor, preencha todos os campos obrigatórios.');
      setMessageType('error');
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

  // 3) Validação e preparação de datas dependendo do modo (single / period)
    let payloadDate = {};
    if (dateMode === 'single') {
      if (!singleDate) {
        setMessage('Por favor, selecione a data do evento.');
        setMessageType('error');
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
  // Construir string parecida com ISO se o horário for fornecido
  const dtStr = singleTime ? `${singleDate}T${singleTime}` : `${singleDate}`;
  // Validação: permitir evento no dia atual quando não há hora específica;
  // se houver hora, garantir que seja posterior ao momento atual.
  const now = new Date();
  if (singleTime) {
    const eventDateTime = new Date(`${singleDate}T${singleTime}`);
    if (isNaN(eventDateTime.getTime()) || eventDateTime < now) {
      setMessage('A data/hora do evento não pode ser no passado.');
      setMessageType('error');
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
  } else {
    const todayStr = getLocalDateString();
    if (singleDate < todayStr) {
      setMessage('A data selecionada não pode ser anterior a hoje.');
      setMessageType('error');
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
  }
      // Adicionar ao payload a data/hora escolhida
      payloadDate.data_horario_evento = dtStr;
    } else {
  // período
      if (!periodStart || !periodEnd) {
        setMessage('Por favor, preencha o período (data inicial e final).');
        setMessageType('error');
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const start = new Date(periodStart + 'T00:00:00');
      const end = new Date(periodEnd + 'T23:59:59');
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        setMessage('Período inválido: a data final deve ser igual ou posterior à data inicial.');
        setMessageType('error');
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // Em modo period, adicionar início e fim ao payload
      payloadDate.data_period_start = periodStart;
      payloadDate.data_period_end = periodEnd;
    }

  // 4) Validação: garantir que ao menos um público-alvo foi selecionado
    const algumPublicoSelecionado = Object.values(publicoAlvo).some(selected => selected);
    if (!algumPublicoSelecionado) {
      setMessage('Por favor, selecione pelo menos um tipo de usuário como público alvo.');
      setMessageType('error');
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }


  // 5) Preparar payload: tipos de usuário selecionados
    const tiposUsuarioSelecionados = Object.keys(publicoAlvo).filter(tipo => publicoAlvo[tipo]);
    
  // 6) Determinar se é público (todos os tipos selecionados)
    const todosOsTipos = ['student', 'teacher', 'guardian', 'admin'];
    const ePublico = tiposUsuarioSelecionados.length === todosOsTipos.length && 
                     tiposUsuarioSelecionados.every(tipo => todosOsTipos.includes(tipo));

  // 7) Validação do agendamento de notificação: não aceitar datas passadas
    if (sendNotification && sendNotificationMode === 'scheduled') {
      if (!scheduledNotificationDatetime) {
        setMessage('Por favor, selecione data/hora para a notificação agendada.');
        setMessageType('error');
        setLoading(false);
        return;
      }
      const sched = new Date(scheduledNotificationDatetime);
      if (isNaN(sched.getTime())) {
        setMessage('Data/hora de notificação inválida.');
        setMessageType('error');
        setLoading(false);
        return;
      }
      const now = new Date();
      if (sched.getTime() <= now.getTime()) {
        setMessage('A data/hora da notificação deve ser posterior ao momento atual.');
        setMessageType('error');
        setLoading(false);
        return;
      }
    }

  // 8) Exibir no console os dados que serão enviados (ajuda em debug)
  console.log('Dados a serem enviados:', {
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      tipo,
      publico: ePublico ? 'publico' : 'privado',
      target_user_types: tiposUsuarioSelecionados,
      publicoAlvo,
      ...payloadDate,
      mostrar_data: mostrarData,
      mostrar_apenas_na_data: mostrarApenasNaData,
      local_evento: localEvento.trim(),
      selectedGroups: gruposSelecionados,
      isGroupsCombined: gruposCombinados
    });

    try {
  if (editingEvento && editingEvento.id) {
        // Confirmar antes de atualizar
        if (!window.confirm('Deseja realmente atualizar este evento com os novos dados?')) {
          setLoading(false);
          return;
        }
        await api.put(`/events/${editingEvento.id}`, {
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          tipo,
          publico: ePublico ? 'publico' : 'privado',
          target_user_types: tiposUsuarioSelecionados,
          ...payloadDate,
          mostrar_data: mostrarData,
          mostrar_apenas_na_data: mostrarApenasNaData,
          local_evento: localEvento.trim(),
          selectedGroups: gruposSelecionados,
          isGroupsCombined: gruposCombinados,
          sendNotification,
          sendNotificationMode,
          scheduledNotificationDatetime: sendNotificationMode === 'scheduled' ? scheduledNotificationDatetime : undefined
        });
    // Feedback de sucesso para o usuário e notificação ao painel
    setMessage('Evento atualizado com sucesso!');
    setMessageType('success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.dispatchEvent(new CustomEvent('evento-updated', { detail: { id: editingEvento.id } }));
      } else {
        await api.post('/events/add-event', {
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          tipo,
          publico: ePublico ? 'publico' : 'privado',
          target_user_types: tiposUsuarioSelecionados,
          ...payloadDate,
          mostrar_data: mostrarData,
          mostrar_apenas_na_data: mostrarApenasNaData,
          local_evento: localEvento.trim(),
          selectedGroups: gruposSelecionados,
          isGroupsCombined: gruposCombinados,
          sendNotification,
          sendNotificationMode,
          scheduledNotificationDatetime: sendNotificationMode === 'scheduled' ? scheduledNotificationDatetime : undefined
        });
    // Evento criado com sucesso: limpar formulário e notificar o painel
    setMessage('Evento adicionado com sucesso!');
    setMessageType('success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.dispatchEvent(new CustomEvent('evento-created', { detail: { /* payload opcional */ } }));

        // Limpar o formulário após o sucesso
  setTitulo('');
  setDescricao('');
  setTipo('');
  setPublicoAlvo({ student: false, teacher: false, guardian: false, admin: false });
  setSingleDate('');
  setSingleTime('');
  setPeriodStart('');
  setPeriodEnd('');
  setMostrarData(true);
  setLocalEvento('');
        setGruposSelecionados([]);
        setGruposCombinados(false);
      }
    } catch (error) {
      console.error('Erro ao enviar dados:', error);
      
      // Tratamento de erros: redirecionar ao login se 401 ou exibir mensagem do backend
      if (error.response?.status === 401) {
        setMessage('Sessão expirada. Redirecionando para login...');
        setMessageType('error');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setMessage(`${error.response?.data?.message || 'Erro ao adicionar/atualizar evento'}`);
        setMessageType('error');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cadastro-evento-container">
      <div className="cadastro-evento-page-header">
        <h1 className="fw-bold text-dark mb-1">Criar Novo Evento</h1>
        <p className="text-muted mb-0">Preencha as informações abaixo para criar um novo evento</p>
      </div>

      <div className="cadastro-evento-card card">
        <div className="card-body p-4">

          {/* Mensagem de status (sucesso / erro) - exibida acima do formulário */}
          {message && (
            <div className={`alert ${messageType === 'success' ? 'alert-success' : 'alert-danger'}`} role="alert" style={{ position: 'relative', borderRadius: '10px', marginBottom: '16px' }}>
              {/* Close X no canto superior direito */}
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => { setMessage(''); setMessageType(''); }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '12px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  lineHeight: '1',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ×
              </button>

              <div>
                <div>{message}</div>
                {messageType === 'success' && (
                  <div style={{ marginTop: '12px' }}>
                    <span role="button" onClick={() => navigate('/')} style={{ textDecoration: 'underline', cursor: 'pointer' }}>
                      Ir para o painel
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
                  
                  {/* Campo: Título do evento (obrigatório) */}
                  <div className="mb-4">
                    <label htmlFor="titulo" className="form-label fw-semibold text-dark mb-2">
                      <i className="fas fa-heading me-2 text-primary"></i>
                      Título *
                    </label>
                    <input
                      type="text"
                      id="titulo"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      className="form-control cadastro-evento-input"
                      placeholder="Digite o título do evento..."
                      maxLength="100"
                      required
                    />
                    <div className="form-text text-end text-muted small">
                      {titulo.length}/100
                    </div>
                  </div>

                  {/* Campo: Descrição do evento (obrigatório) */}
                  <div className="mb-4">
                    <label htmlFor="descricao" className="form-label fw-semibold text-dark mb-2">
                      <i className="fas fa-align-left me-2 text-primary"></i>
                      Descrição *
                    </label>
                    <textarea
                      id="descricao"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      className="form-control cadastro-evento-input cadastro-evento-textarea"
                      placeholder="Descreva os detalhes do evento..."
                      maxLength="500"
                      required
                    />
                    <div className="form-text text-end text-muted small">
                      {descricao.length}/500
                    </div>
                  </div>

                    {/* Seção: Data e horário do evento
                      - Permite escolher data única ou período.
                      - `dateMode` controla qual grupo de inputs é exibido.
                    */}
                  <div className="row mb-4">
                    <div className="col-12 mb-3"> 
                      <label className="form-label fw-semibold text-dark mb-2">
                          <i className="fas fa-calendar-alt me-2 text-primary"></i>
                          Data e Horário
                        </label>
                        <div className="cadastro-evento-box">
                          <div className="d-flex gap-2 mb-2">
                            <div className="form-check">
                              <input className="form-check-input" type="radio" name="dateMode" id="dateModeSingle" value="single" checked={dateMode === 'single'} onChange={() => setDateMode('single')} />
                              <label className="form-check-label" htmlFor="dateModeSingle">Data única</label>
                            </div>
                            <div className="form-check">
                              <input className="form-check-input" type="radio" name="dateMode" id="dateModePeriod" value="period" checked={dateMode === 'period'} onChange={() => setDateMode('period')} />
                              <label className="form-check-label" htmlFor="dateModePeriod">Período</label>
                            </div>
                          </div>

                          {dateMode === 'single' ? (
                            <div className="d-flex gap-2">
                              <input
                                type="date"
                                id="singleDate"
                                value={singleDate}
                                onChange={(e) => setSingleDate(e.target.value)}
                                className="form-control cadastro-evento-input"
                                min={getLocalDateString()}
                                required
                              />
                              <input
                                type="time"
                                id="singleTime"
                                value={singleTime}
                                onChange={(e) => setSingleTime(e.target.value)}
                                className="form-control cadastro-evento-input"
                                placeholder="Horário (opcional)"
                              />
                            </div>
                          ) : (
                            <div className="d-flex gap-2">
                              <input
                                type="date"
                                id="periodStart"
                                value={periodStart}
                                onChange={(e) => setPeriodStart(e.target.value)}
                                className="form-control cadastro-evento-input"
                                min={getLocalDateString()}
                                required
                              />
                              <input
                                type="date"
                                id="periodEnd"
                                value={periodEnd}
                                onChange={(e) => setPeriodEnd(e.target.value)}
                                className="form-control cadastro-evento-input"
                                min={periodStart || getLocalDateString()}
                                required
                              />
                            </div>
                          )}

                          {/* Opções de exibição do evento no painel */}
                          <div className="form-check mt-2">
                            <input className="form-check-input" type="checkbox" id="mostrarData" checked={mostrarData} onChange={(e) => setMostrarData(e.target.checked)} />
                            <label className="form-check-label text-muted" htmlFor="mostrarData">Mostrar data no card (visível no painel)</label>
                          </div>
                          <div className="form-check mt-2">
                            <input className="form-check-input" type="checkbox" id="mostrarApenasNaData" checked={mostrarApenasNaData} onChange={(e) => setMostrarApenasNaData(e.target.checked)} />
                            <label className="form-check-label text-muted" htmlFor="mostrarApenasNaData">Mostrar apenas na(s) data(s) (ocultar antes/depois)</label>
                          </div>
                        </div>
                    </div>
                  </div>

                  {/* Seção: Categoria / Tipo do evento */}
                  <div className="row mb-4">
                    <div className="col-12">
                      <label htmlFor="tipo" className="form-label fw-semibold text-dark mb-2">
                        <i className="fas fa-tag me-2 text-primary"></i>
                        Categoria *
                      </label>
                      <select
                        id="tipo"
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                        className="form-select cadastro-evento-input"
                        required
                      >
                        <option value="">Selecione uma categoria...</option>
                        {tiposEvento.map(opcao => (
                          <option key={opcao.value} value={opcao.value}>
                            {opcao.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Local do Evento (opcional) */}
                  <div className="mb-4">
                    <label htmlFor="localEvento" className="form-label fw-semibold text-dark mb-2">
                      <i className="fas fa-map-marker-alt me-2 text-primary"></i>
                      Local (Opcional)
                    </label>
                    <input
                      type="text"
                      id="localEvento"
                      value={localEvento}
                      onChange={(e) => setLocalEvento(e.target.value)}
                      className="form-control cadastro-evento-input"
                      placeholder="Ex: Auditório Principal, Sala 101, Online..."
                      maxLength="150"
                    />
                    <div className="form-text text-end text-muted small">
                      {localEvento.length}/150
                    </div>
                  </div>

                    {/* Seção: Público-alvo (tipos de usuário)
                      - Aqui o admin escolhe quais tipos de usuário poderão ver o evento.
                      - Existe uma opção rápida "Todos" para marcar/desmarcar todas as opções.
                    */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold text-dark mb-1">
                      <i className="fas fa-users me-2 text-primary"></i>
                      Público-alvo (Tipos de Usuário) *
                    </label>
                    <small className="text-muted d-block mb-2">
                      <i className="fas fa-info-circle me-1"></i>
                      Selecione os tipos de usuário que poderão visualizar este evento
                    </small>
                    <div className="cadastro-evento-checkbox-group">
                        <div className="row">
                          <div className="col-12 mb-2"> 
                            <div
                              className="form-check cadastro-evento-checkbox"
                              onClick={() => handlePublicoTodosChange()}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); handlePublicoTodosChange(); } }}
                              role="button"
                              tabIndex={0}
                            >
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="publico-todos"
                                checked={publicoTodos}
                                onChange={handlePublicoTodosChange}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <label className="form-check-label" htmlFor="publico-todos">
                                <i className="fas fa-globe me-2"></i>
                                Todos (Público)
                              </label>
                            </div>
                          </div>
                        <div className="col-sm-6 mb-2">
                          <div
                            className="form-check cadastro-evento-checkbox"
                            onClick={() => handlePublicoChange('student')}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); handlePublicoChange('student'); } }}
                            role="button"
                            tabIndex={0}
                          >
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="publico-student"
                              checked={publicoAlvo.student}
                              onChange={() => handlePublicoChange('student')}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <label className="form-check-label" htmlFor="publico-student">
                              <i className="fas fa-graduation-cap me-2"></i>
                              Alunos
                            </label>
                          </div>
                        </div>
                        <div className="col-sm-6 mb-2">
                          <div
                            className="form-check cadastro-evento-checkbox"
                            onClick={() => handlePublicoChange('teacher')}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); handlePublicoChange('teacher'); } }}
                            role="button"
                            tabIndex={0}
                          >
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="publico-teacher"
                              checked={publicoAlvo.teacher}
                              onChange={() => handlePublicoChange('teacher')}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <label className="form-check-label" htmlFor="publico-teacher">
                              <i className="fas fa-chalkboard-teacher me-2"></i>
                              Professores
                            </label>
                          </div>
                        </div>
                        <div className="col-sm-6 mb-2">
                          <div
                            className="form-check cadastro-evento-checkbox"
                            onClick={() => handlePublicoChange('guardian')}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); handlePublicoChange('guardian'); } }}
                            role="button"
                            tabIndex={0}
                          >
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="publico-guardian"
                              checked={publicoAlvo.guardian}
                              onChange={() => handlePublicoChange('guardian')}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <label className="form-check-label" htmlFor="publico-guardian">
                              <i className="fas fa-user-friends me-2"></i>
                              Responsáveis
                            </label>
                          </div>
                        </div>
                        <div className="col-sm-6 mb-2">
                          <div
                            className="form-check cadastro-evento-checkbox"
                            onClick={() => handlePublicoChange('admin')}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); handlePublicoChange('admin'); } }}
                            role="button"
                            tabIndex={0}
                          >
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="publico-admin"
                              checked={publicoAlvo.admin}
                              onChange={() => handlePublicoChange('admin')}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <label className="form-check-label" htmlFor="publico-admin">
                              <i className="fas fa-user-shield me-2"></i>
                              Administradores
                            </label>
                          </div>
                        </div>
                      </div>
                      
                    </div>
                  </div>

                    {/* Seção: Grupos (opcional)
                      - Permite restringir o evento a grupos específicos.
                      - Se nenhum grupo for selecionado e o evento não for privado, o evento é considerado público para os tipos selecionados.
                      - Modo "Grupos Combinados" altera a lógica para AND em vez de OR.
                    */}
                  {grupos.length > 0 && (
                    <div className="mb-4">
                      <label className="form-label fw-semibold text-dark mb-1">
                        <i className="fas fa-layer-group me-2 text-primary"></i>
                        Grupos (Opcional)
                      </label>
                      <small className="text-muted d-block mb-2">
                        <i className="fas fa-info-circle me-1"></i>
                        Deixe em branco para evento público geral. Selecione grupos específicos para restringir a visualização.
                      </small>
                      
                      {/* Opção de grupos combinados */}
                      {gruposSelecionados.length > 1 && (
                        <div className="mb-3">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="grupos-combinados"
                              checked={gruposCombinados}
                              onChange={(e) => setGruposCombinados(e.target.checked)}
                            />
                            <label className="form-check-label text-muted" htmlFor="grupos-combinados">
                              <i className="fas fa-link me-2 text-warning"></i>
                              <strong>Grupos Combinados (AND)</strong> - Usuário deve pertencer a TODOS os grupos selecionados
                            </label>
                          </div>
                          <small className="text-muted d-block mt-1">
                            {gruposCombinados 
                              ? '🔗 Modo AND: apenas usuários que pertencem a todos os grupos selecionados verão este evento'
                              : '👥 Modo OR (padrão): usuários que pertencem a pelo menos um dos grupos selecionados verão este evento'
                            }
                          </small>
                        </div>
                      )}

                      <div className="cadastro-evento-checkbox-group">
                        <div className="row">
                          {grupos.map((grupo) => (
                            <div key={grupo.id} className="col-sm-6 col-md-4 mb-2">
                              <div
                                className="form-check cadastro-evento-checkbox"
                                onClick={() => handleGrupoChange(grupo.id)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); handleGrupoChange(grupo.id); } }}
                                role="button"
                                tabIndex={0}
                              >
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`grupo-${grupo.id}`}
                                  checked={gruposSelecionados.includes(grupo.id)}
                                  onChange={() => handleGrupoChange(grupo.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <label className="form-check-label" htmlFor={`grupo-${grupo.id}`}>
                                  <i className={`fas ${getGroupIcon(grupo.group_type || grupo.type)} me-2`}></i>
                                  {grupo.name}
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                    </div>
                  )}

                  {/* Seção: Configurações de notificação */}
                  <div className="mb-4">
                    <div className="cadastro-evento-settings p-3">
                      <div className="mb-2">
                        <strong>Opção de notificação</strong>
                      </div>

                      <div className="form-check mb-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="notificacao"
                          checked={sendNotificationChecked}
                          onChange={(e) => setSendNotificationChecked(e.target.checked)}
                        />
                        <label className="form-check-label text-muted d-flex align-items-center" htmlFor="notificacao">
                          <i className="fas fa-bell me-2 text-primary"></i>
                          Enviar notificação por push
                        </label>
                      </div>

                      {sendNotificationChecked && (
                        <div className="pt-2">
                          <div className="d-flex gap-3 align-items-center">
                            <div className="form-check">
                              <input className="form-check-input" type="radio" name="sendNotificationMode" id="notifImmediate" value="immediate" checked={sendNotificationMode === 'immediate'} onChange={() => setSendNotificationMode('immediate')} />
                              <label className="form-check-label" htmlFor="notifImmediate">Enviar ao incluir</label>
                            </div>
                            <div className="form-check">
                              <input className="form-check-input" type="radio" name="sendNotificationMode" id="notifScheduled" value="scheduled" checked={sendNotificationMode === 'scheduled'} onChange={() => setSendNotificationMode('scheduled')} />
                              <label className="form-check-label" htmlFor="notifScheduled">Agendar notificação</label>
                            </div>
                          </div>
                            {sendNotificationMode === 'scheduled' && (
                            <div className="mt-2">
                              <input type="datetime-local" className="form-control form-control-sm" value={scheduledNotificationDatetime} onChange={(e) => setScheduledNotificationDatetime(e.target.value)} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botões de ação: Voltar e Criar/Atualizar Evento */}
                  <div className="row mt-4 buttons-row">
                    <div className="col-6 d-flex justify-content-start">
                      <Button as="button" variant="secondary" size="md" className="app-btn--fixed app-btn--primary-shape" onClick={() => navigate('/') }>
                          Voltar
                        </Button>
                    </div>
                    <div className="col-6 d-flex justify-content-end">
                      <Button as="button" type="submit" variant="primary" size="md" className={`${loading ? 'app-btn--disabled' : ''} app-btn--fixed app-btn--primary-shape`}>
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Criando...
                          </>
                        ) : (
                          <>
                            Criar Evento
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>

                {/* Mensagem final removida — mensagem já exibida no topo do formulário */}
        </div>
      </div>
    </div>
  );
};

// Função auxiliar para ícones dos grupos
// Retorna a classe do ícone FontAwesome baseada no tipo do grupo
const getGroupIcon = (type) => {
  switch(type?.toLowerCase()) {
    case 'turma':
      return 'fa-users';
    case 'turno':
      return 'fa-clock';
    case 'area':
      return 'fa-map-marker-alt';
    case 'curso':
      return 'fa-graduation-cap';
    case 'personalizado':
      return 'fa-cog';
    default:
      return 'fa-layer-group';
  }
};

export default EventForm;
