const db = require('../db');
const eventModel = require('../models/eventModel');

// Criar um novo evento — delega toda a lógica de DB/notifications para o model
const addEvent = async (req, res) => {
  try {
    const result = await eventModel.createEvent(req.body, req.user);
    return res.status(201).json({ message: 'Evento criado', id: result.id });
  } catch (err) {
    console.error('addEvent error', err);
    const status = err.status || 500;
    return res.status(status).json({ message: status === 500 ? 'Erro ao criar evento' : err.message, error: err.message });
  }
};

// Buscar eventos visíveis ao usuário autenticado (usa model centralizado)
// O model encapsula a query complexa; o controller ainda formata o resultado para o frontend
const getEvents = async (req, res) => {
  try {
    const { events: eventsRaw, effectiveUserId } = await eventModel.getEventsForUser(req.user);

    const formattedEvents = eventsRaw.map(event => ({
      id: event.id,
      titulo: event.title,
      texto: event.description,
      data: event.event_datetime ? new Date(event.event_datetime).toLocaleDateString('pt-BR') : '',
      hora: event.event_datetime ? new Date(event.event_datetime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '',
      event_datetime_raw: event.event_datetime ? new Date(event.event_datetime).toISOString().slice(0,16) : '',
      data_period_start: event.data_period_start ? (typeof event.data_period_start === 'string' ? event.data_period_start : (new Date(event.data_period_start).toISOString().slice(0,10))) : '',
      data_period_end: event.data_period_end ? (typeof event.data_period_end === 'string' ? event.data_period_end : (new Date(event.data_period_end).toISOString().slice(0,10))) : '',
      mostrar_data: typeof event.mostrar_data !== 'undefined' ? Boolean(event.mostrar_data) : true,
      mostrar_apenas_na_data: Boolean(event.mostrar_apenas_na_data),
      local: event.event_location || '',
      tipo: event.type || 'default',
      publico: event.is_public ? 'publico' : 'privado',
      criado_por: event.created_by || 'Desconhecido',
      criado_por_id: event.user_id || null,
      tipo_criador: event.creator_type || 'N/A',
      grupos: event.grupos ? event.grupos.split(',') : [],
      grupos_combinados: event.groups_combined ? true : false,
      icone: getEventIcon(event.type)
    }));

    const responsePayload = { events: formattedEvents };
    try {
      if (typeof effectiveUserId !== 'undefined' && Number(effectiveUserId) !== Number(req.user?.userId)) {
        const [stu] = await db.execute('SELECT first_name, last_name, id FROM users WHERE id = ?', [effectiveUserId]);
        if (stu && stu.length > 0) {
          responsePayload.viewingAs = { id: stu[0].id, first_name: stu[0].first_name, last_name: stu[0].last_name };
        }
      }
    } catch (viewErr) {
      console.warn('Erro ao obter dados do estudante para viewingAs:', viewErr.message);
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    if (error && error.code === 'USER_NOT_FOUND') return res.status(404).json({ message: 'Usuário não encontrado' });
    res.status(500).json({ message: 'Erro ao buscar eventos', error: error.message });
  }
};

// Função auxiliar para determinar ícone do evento
const getEventIcon = (type) => {
  switch(type?.toLowerCase()) {
    case 'evento':
    case 'tipo2':
      return 'evento';
    case 'reuniao':
    case 'reunião':
    case 'tipo3':
      return 'reuniao';
    case 'aviso':
    case 'alerta':
    case 'tipo1':
      return 'aviso';
    default:
      return 'evento';
  }
};

// Atualizar evento (apenas criador ou admin) - delega ao model
const updateEvent = async (req, res) => {
  const eventId = req.params.id;
  try {
    const result = await eventModel.updateEvent(eventId, req.body, req.user);
    res.json(result);
  } catch (err) {
    console.error('updateEvent error', err);
    const status = err.status || 500;
    res.status(status).json({ message: status === 500 ? 'Erro ao atualizar evento' : err.message, error: err.message });
  }
};

// Deletar evento (apenas criador ou admin) - delega ao model
const deleteEvent = async (req, res) => {
  const eventId = req.params.id;
  try {
    const result = await eventModel.deleteEvent(eventId, req.user);
    res.json(result);
  } catch (err) {
    console.error('deleteEvento error', err);
    const status = err.status || 500;
    res.status(status).json({ message: status === 500 ? 'Erro ao deletar evento' : err.message, error: err.message });
  }
};

module.exports = {
  addEvent,
  getEvents,
  updateEvent,
  deleteEvent
};
