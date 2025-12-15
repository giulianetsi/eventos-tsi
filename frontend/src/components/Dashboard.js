import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-modal';
import { ReactComponent as IfsulLogoWhite } from '../assets/ifsul-logo-white.svg';
import '../App.css';
import { FaEdit, FaTrashAlt, FaPlus, FaSearch, FaCalendarPlus, FaUserPlus, FaUsers, FaUserShield, FaSignOutAlt, FaThLarge } from 'react-icons/fa';
import { Event } from './Event';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    borderRadius: '15px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    maxWidth: '600px',
    width: '80%',
  },
};

const Dashboard = ({ username, eventos: eventosProp = [], isAdmin: isAdminProp }) => {
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [eventsPerPage, setEventsPerPage] = useState(16);
  const [filtroAtivo, setFiltroAtivo] = useState('todos'); 
  const [eventos, setEventos] = useState(eventosProp); // Estado para eventos carregados do banco
  const [viewingAs, setViewingAs] = useState(null);
  const [loading, setLoading] = useState(true);
  // Estado do filtro de datas
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterTick, setFilterTick] = useState(0); // alternado quando "Aplicar" é clicado para garantir re-render
  const dateFilterRef = useRef(null);
  const startInputRef = useRef(null);
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();

  // Preferir permissões explícitas para decidir poderes de interface de administrador. Como fallback, usar user_type textual ou id numérico.
  const getIsAdmin = () => {
    try {
      const permissions = localStorage.getItem('permissions');
      if (permissions) {
        const perms = JSON.parse(permissions);
        return Boolean(perms.canCreateUser || perms.can_create_user || perms.canViewAllEvents || perms.can_view_all_events);
      }
    } catch (e) {
      console.log('Erro ao verificar permissões:', e);
    }
    const userTypeId = localStorage.getItem('user_type_id');
    const userType = localStorage.getItem('user_type');
    if (userType === 'admin') return true;
    if (userTypeId && Number(userTypeId) === 1) return true;
    return Boolean(isAdminProp);
  };

  const isAdmin = getIsAdmin();

  // Detectar se o usuário atual é um 'responsável' (guardian)
  const getIsResponsavel = () => {
    try {
      const userTypeId = localStorage.getItem('user_type_id');
      const userType = localStorage.getItem('user_type');
      if (userType === 'responsavel' || userType === 'guardian') return true;
      if (userTypeId && Number(userTypeId) === 4) return true;
      } catch (e) {
      // ignorar erros de leitura de localStorage
    }
    return false;
  };

  const isResponsavel = getIsResponsavel();

  // Derivação do nome de usuário local: ler diretamente do localStorage para atualizar após login/logout
  const [localUsername, setLocalUsername] = useState(username || 'Usuário');

  const computeUsername = () => {
    const firstName = localStorage.getItem('user_first_name');
    const lastName = localStorage.getItem('user_last_name');
    const userTypeId = localStorage.getItem('user_type_id');
    const userType = localStorage.getItem('user_type');

    if (firstName) return `${firstName}${lastName ? ` ${lastName}` : ''}`;

    if (userTypeId) {
      switch (Number(userTypeId)) {
        case 1:
          return 'Administrador';
        case 2:
          return 'Professor';
        case 3:
          return 'Estudante';
        case 4:
          return 'Responsável';
        default:
          return 'Usuário';
      }
    }

    switch (userType) {
      case 'admin':
        return 'Administrador';
      case 'teacher':
        return 'Professor';
      case 'student':
        return 'Estudante';
      case 'guardian':
        return 'Responsável';
      default:
        return 'Usuário';
    }
  };

  useEffect(() => {
    setLocalUsername(computeUsername());
  }, [isAuthenticated]);

  // Função para carregar eventos do banco de dados
  const carregarEventos = async () => {
    try {
      setLoading(true);
  // O backend armazena o token de autenticação em cookie httpOnly; usar a instância api comCredentials
      const response = await api.get('/events');

      console.log('Eventos carregados:', response.data);
      // Novo formato proposto: { events: [...], viewingAs?: { id, first_name, last_name } }
      if (response.data && Array.isArray(response.data.events)) {
        setEventos(response.data.events);
        setViewingAs(response.data.viewingAs || null);
      } else if (Array.isArray(response.data)) {
        // compatibilidade retroativa
        setEventos(response.data);
        setViewingAs(null);
      } else {
        setEventos([]);
        setViewingAs(null);
      }
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      const status = error.response?.status;
      // Se não autorizado ou proibido -> limpar sessão e redirecionar para login
      if (status === 401 || status === 403) {
        try { logout(); } catch (e) {}
        try { navigate('/login'); } catch (e) {}
      } else {
        setEventos([]); // Retorno padrão para array vazio
      }
    } finally {
      setLoading(false);
    }
  };

  // Carregar eventos quando o componente monta
  useEffect(() => {
    carregarEventos();
    const onDeleted = (e) => { console.log('Evento deletado, atualizando lista', e.detail); carregarEventos(); };
    const onCreated = (e) => { console.log('Evento criado, atualizando lista', e.detail); carregarEventos(); };
    const onUpdated = (e) => { console.log('Evento atualizado, atualizando lista', e.detail); carregarEventos(); };
    window.addEventListener('evento-deleted', onDeleted);
    window.addEventListener('evento-created', onCreated);
    window.addEventListener('evento-updated', onUpdated);
    return () => {
      window.removeEventListener('evento-deleted', onDeleted);
      window.removeEventListener('evento-created', onCreated);
      window.removeEventListener('evento-updated', onUpdated);
    };
  }, []); // Executar apenas uma vez ao montar

  // Fechar o painel de filtro de datas ao clicar fora ou pressionar Escape
  useEffect(() => {
    if (!dateFilterOpen) return;
    const handleDocClick = (e) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(e.target)) {
        setDateFilterOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setDateFilterOpen(false);
    };
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('touchstart', handleDocClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('touchstart', handleDocClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [dateFilterOpen]);

  // Ao abrir o filtro de datas, focar o campo de data inicial para interação mais rápida
  useEffect(() => {
    if (dateFilterOpen) {
  // pequeno timeout para aguardar a renderização do painel
      const t = setTimeout(() => {
        try { startInputRef.current && startInputRef.current.focus(); } catch {}
      }, 80);
      return () => clearTimeout(t);
    }
  }, [dateFilterOpen]);

  // Derivar a lista de tipos disponíveis a partir dos eventos para que o select mostre tipos reais
  const eventTypes = useMemo(() => {
    try {
      const s = new Set();
      (eventos || []).forEach(ev => {
        if (!ev) return;
        const t = ev.tipo || ev.type || ev.tipo_evento;
        if (t && typeof t === 'string') s.add(t.trim());
      });
      return Array.from(s).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    } catch (err) {
      return [];
    }
  }, [eventos]);

  const openModal = (evento) => {
    setSelectedEvento(evento);
    setModalIsOpen(true);
  };

  // Lista derivada: aplicar filtroAtivo e o filtro de data
  // Auxiliar: parsear robustamente strings de data de eventos (suporta 'YYYY-MM-DD' e timestamps ISO)
  const parseEventDate = (dateStr) => {
    if (!dateStr) return null;
  // Se a data já estiver em formato YYYY-MM-DD ou similar, new Date(...) funciona nos navegadores modernos
  // Tentar normalizar: se contiver espaço, substituir por 'T' para parsear como ISO; se contiver apenas a data, anexar T00:00:00
    try {
      if (typeof dateStr !== 'string') return null;
      const s = dateStr.trim();
  // Se tiver o formato YYYY-MM-DD (opcionalmente com horário)
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return new Date(s + 'T00:00:00');
      }
  // Se tiver o formato DD/MM/YYYY ou DD/MM/YYYY HH:MM (formato pt-BR possivelmente vindo do backend)
      if (/^\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2})?$/.test(s)) {
        const parts = s.split(' ');
        const dateParts = parts[0].split('/'); // DD/MM/YYYY
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        let hours = 0, minutes = 0;
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          hours = parseInt(timeParts[0], 10) || 0;
          minutes = parseInt(timeParts[1], 10) || 0;
        }
        return new Date(year, month, day, hours, minutes);
      }
  // Aceitar também formato DD-MM-YYYY
      if (/^\d{2}-\d{2}-\d{4}(?:\s+\d{2}:\d{2})?$/.test(s)) {
        const parts = s.split(' ');
        const dateParts = parts[0].split('-'); // DD-MM-YYYY
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        let hours = 0, minutes = 0;
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          hours = parseInt(timeParts[0], 10) || 0;
          minutes = parseInt(timeParts[1], 10) || 0;
        }
        return new Date(year, month, day, hours, minutes);
      }
  // Se contiver espaço entre data e hora, substituir por 'T'
      if (/^\d{4}-\d{2}-\d{2} /.test(s)) {
        return new Date(s.replace(' ', 'T'));
      }
  // Caso contrário, tentar parse direto
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    } catch (err) {
      console.warn('parseEventDate error for', dateStr, err);
    }
    return null;
  };
  const eventosFiltradosPorTipoEData = () => {
  // Primeiro filtrar por tipo (filtroAtivo)
    let list = eventos || [];
    if (filtroAtivo && filtroAtivo !== 'todos') {
      const fa = String(filtroAtivo).toLowerCase();
      list = list.filter(e => {
        const tipoRaw = e?.tipo || e?.type || '';
        const tipo = String(tipoRaw || '').toLowerCase();
        if (!tipo) return false;
  // Manter categorias compatíveis com versões anteriores
        if (fa === 'eventos') return tipo.includes('evento') || tipo === 'tipo' || tipo === 'tipo1';
        if (fa === 'reunioes') return tipo.includes('reun');
        if (fa === 'avisos') return tipo.includes('aviso');
  // Caso contrário, comparar por igualdade ou substring do tipo do evento
        return tipo === fa || tipo.includes(fa) || fa.includes(tipo);
      });
    }

  // Em seguida, filtrar por data
  // Se startDate e endDate estiverem vazios -> comportamento padrão: apenas eventos futuros
    const hasDateRange = startDate || endDate;
    const isTodayInEvent = (ev) => {
      if (!ev) return false;
  // Se for data única (possivelmente com horário)
        if (ev.event_datetime_raw) {
          const evDate = parseEventDate(ev.event_datetime_raw);
          if (!evDate) return false;
          const now = new Date();
          // Se o evento incluir horário, considerar uma janela de datetime exata: mostrar quando now >= início do evento e <= início + 60 minutos
          const hasTime = /T/.test(ev.event_datetime_raw) || /:\d{2}$/.test(ev.hora || '') || (ev.hora && ev.hora.includes(':'));
          if (hasTime) {
            const windowStart = evDate.getTime();
            const windowEnd = windowStart + (60 * 60 * 1000); // janela de 1 hora
            return now.getTime() >= windowStart && now.getTime() <= windowEnd;
          }
          // Se não houver horário explícito, mostrar no mesmo dia
          const evDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return evDay.getTime() === today.getTime();
        }
  // Se for um período
      const ps = ev.data_period_start || ev.period_start || ev.data_periodo_inicio || '';
      const pe = ev.data_period_end || ev.period_end || ev.data_periodo_fim || '';
      if (ps || pe) {
        const start = parseEventDate(ps) || null;
        const end = parseEventDate(pe) || null;
        const now = new Date();
  // Se o período incluir horários, comparar datetimes completos; caso contrário comparar por dia.
        const startHasTime = ps && /T|:\d{2}/.test(String(ps));
        const endHasTime = pe && /T|:\d{2}/.test(String(pe));
        if (startHasTime || endHasTime) {
          const sTime = start ? start.getTime() : -8640000000000000;
          const eTime = end ? end.getTime() : 8640000000000000;
          return now.getTime() >= sTime && now.getTime() <= eTime;
        }
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startDay = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() : -8640000000000000;
        const endDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() : 8640000000000000;
        return today.getTime() >= startDay && today.getTime() <= endDay;
      }
      return false;
    };

    if (!hasDateRange) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return list.filter(ev => {
  // Se o evento estiver marcado 'mostrar_apenas_na_data' -> mostrar somente quando hoje estiver dentro da data/período
        if (typeof ev?.mostrar_apenas_na_data !== 'undefined' && ev.mostrar_apenas_na_data) {
          return isTodayInEvent(ev);
        }

  // Suportar eventos de data única (ev.data) e eventos por período (data_period_start/data_period_end)
        if (ev.data) {
          const evDate = parseEventDate(ev.data);
          if (!evDate) return false;
          const evDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
          return evDay >= today;
        }

  // Suporte a períodos: incluir se o fim do período for hoje ou no futuro
        const ps = ev.data_period_start || ev.period_start || ev.data_periodo_inicio || '';
        const pe = ev.data_period_end || ev.period_end || ev.data_periodo_fim || '';
        if (ps || pe) {
          const start = parseEventDate(ps) || null;
          const end = parseEventDate(pe) || null;
          // Se tivermos uma data de fim, verificar end >= hoje; caso contrário, se somente start, verificar start >= hoje
          if (end && !isNaN(end.getTime())) {
            const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
            return endDay >= today;
          }
          if (start && !isNaN(start.getTime())) {
            const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            return startDay >= today;
          }
        }

        return false;
      });
    }

  // Se ao menos uma data for fornecida, interpretar startDate ausente como -infinito e endDate ausente como +infinito
    const start = startDate ? new Date(startDate + 'T00:00:00') : new Date(-8640000000000000);
    const end = endDate ? new Date(endDate + 'T23:59:59') : new Date(8640000000000000);

    return list.filter(ev => {
  // Se o evento for um período, incluir quando o período sobrepor o intervalo [start, end]
  // Se o evento estiver marcado 'mostrar_apenas_na_data', incluir somente se sua data/período sobrepor o intervalo
      if (typeof ev?.mostrar_apenas_na_data !== 'undefined' && ev.mostrar_apenas_na_data) {
        const ps = ev.data_period_start || ev.period_start || ev.data_periodo_inicio || '';
        const pe = ev.data_period_end || ev.period_end || ev.data_periodo_fim || '';
        if (ps || pe) {
          const s = parseEventDate(ps) || null;
          const e = parseEventDate(pe) || null;
          const sTime = s ? s.getTime() : -8640000000000000;
          const eTime = e ? e.getTime() : 8640000000000000;
          return eTime >= start.getTime() && sTime <= end.getTime();
        }
        if (ev.data) {
          const evDate = parseEventDate(ev.data);
          if (!evDate) return false;
          return evDate.getTime() >= start.getTime() && evDate.getTime() <= end.getTime();
        }
        return false;
      }

  // Se não for restrito a apenas-na-data, eventos por período também devem ser incluídos quando sobreporem o intervalo
      const ps = ev.data_period_start || ev.period_start || ev.data_periodo_inicio || '';
      const pe = ev.data_period_end || ev.period_end || ev.data_periodo_fim || '';
      if (ps || pe) {
        const s = parseEventDate(ps) || null;
        const e = parseEventDate(pe) || null;
        const sTime = s ? s.getTime() : -8640000000000000;
        const eTime = e ? e.getTime() : 8640000000000000;
        return eTime >= start.getTime() && sTime <= end.getTime();
      }

  // Caso contrário, retornar à lógica de data única
      if (!ev.data) return false;
      const evDate = parseEventDate(ev.data);
      if (!evDate) return false;
      return evDate >= start && evDate <= end;
    });
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedEvento(null);
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleLogout = async () => {
    try {
      console.log('Iniciando processo de logout...');
  // Delegar ações reais de logout (limpeza local + chamada ao servidor) para AuthContext.logout
      await logout();
      console.log('Logout local realizado via AuthContext, redirecionando para login...');
      navigate('/login', { replace: true });
      
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      
      // Mesmo com erro no servidor, limpar estado local
      try { await logout(); } catch {};
      navigate('/login', { replace: true });
    }
  };

  const filtrarEventos = (tipo) => {
    setFiltroAtivo(tipo);
    setCurrentPage(1); // Reiniciar para a primeira página ao filtrar
  };

  const updateEventsPerPage = () => {
    const width = window.innerWidth;
    const height = window.innerHeight - 160;
    const eventsPerRow = Math.floor(width / 288);
    const eventsPerColumn = Math.floor(height / 132);
    setEventsPerPage(eventsPerRow * eventsPerColumn);
  };

  useEffect(() => {
    updateEventsPerPage();
    window.addEventListener('resize', updateEventsPerPage);
    return () => window.removeEventListener('resize', updateEventsPerPage);
  }, []);

  // Filtrar eventos baseado no filtro ativo E no filtro de data (se houver)
  const eventosFiltrados = eventosFiltradosPorTipoEData();

  const totalPages = Math.max(1, Math.ceil(eventosFiltrados.length / eventsPerPage));

  const currentEventos = eventosFiltrados.slice(
    (currentPage - 1) * eventsPerPage,
    currentPage * eventsPerPage
  );

  // Garantir que currentPage permaneça dentro do intervalo válido quando filtros ou tamanho da página mudam
  useEffect(() => {
    const newTotal = Math.max(1, Math.ceil(eventosFiltrados.length / eventsPerPage));
    if (currentPage > newTotal) {
      setCurrentPage(newTotal);
    }
    if (currentPage < 1) {
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventosFiltrados.length, eventsPerPage]);

  // Preencher a grade com espaços reservados até completar eventsPerPage.
  // Comportamento desejado: para estudantes/responsáveis mostrar a mesma grade de cartões (cartões coloridos para eventos; se não houver eventos, mostrar espaços reservados limpos).
  const shouldShowPlaceholders = () => {
  // Mostrar espaços reservados para manter uma grade consistente quando não há eventos.
  // Usuários admin veem espaços reservados para o layout também; não-admins também veem quando não há eventos.
    return true;
  };

  return (
    <div>
      <div className={`container ${isResponsavel ? 'responsavel-dashboard' : ''}`}>
        <h1 className="text-center mb-4">Bem-vindo, {localUsername}</h1>
        {viewingAs && (
          <div className="viewing-as text-center">
            Visualizando eventos do aluno: <strong>{viewingAs.first_name} {viewingAs.last_name}</strong>
          </div>
        )}

        {/* Wrapper for toggle + panel so outside-click detection includes both areas */}
        <div className="date-filter-wrapper" ref={dateFilterRef}>
          <div className="date-filter-row">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setDateFilterOpen(d => !d)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDateFilterOpen(d => !d); }}
            className="filter-toggle-text"
            aria-expanded={dateFilterOpen}
            aria-controls="date-filter-panel"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#333', fontWeight: 600 }}
          >
            <span>Filtrar</span>
            <span className={`filter-arrow ${dateFilterOpen ? 'open' : ''}`} aria-hidden="true">{dateFilterOpen ? '▴' : '▾'}</span>
          </div>

          {/* Compact summary when panel is closed */}
          {!dateFilterOpen && (startDate || endDate) && (
            <div className="date-filter-summary" aria-hidden="false">
              <>
                {startDate ? `De ${startDate}` : ''}
                {startDate && endDate ? ' até ' : ''}
                {endDate ? `${endDate}` : ''}
              </>
            </div>
          )}
          </div>
          
          {/* When open, render the panel as a normal block (static) above the event grid so it pushes content down */}
          {dateFilterOpen && (
            <div id="date-filter-panel" className="date-filter-panel static" role="region" aria-label="Filtro de datas e tipo" aria-hidden="false">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', width: '100%' }}>
              <label style={{ fontSize: '0.9em', marginRight: 6 }}>Tipo:</label>
              <select
                value={filtroAtivo}
                onChange={(e) => { filtrarEventos(e.target.value); }}
                className="form-select cadastro-evento-input filter-input"
                style={{ minWidth: 180 }}
              >
                <option value="todos">Todos</option>
                <option value="eventos">Eventos</option>
                <option value="reunioes">Reuniões</option>
                <option value="avisos">Avisos</option>
                <option value="outros">Outros</option>
                {eventTypes.map((t, i) => (
                  // Adicionar tipos personalizados apenas se não entrarem em conflito com as categorias conhecidas
                  (['eventos','reunioes','avisos','todos'].includes(t.toLowerCase()) ? null : (
                    <option key={`custom-type-${i}`} value={t}>{t}</option>
                  ))
                ))}
              </select>

              <label style={{ fontSize: '0.9em' }}>De:</label>
              <input ref={startInputRef} className="filter-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <span>até</span>
              <input className="filter-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-sm btn-light" onClick={() => { setCurrentPage(1); setFilterTick(t => t + 1); setDateFilterOpen(false); }}>
                  Aplicar
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setStartDate(''); setEndDate(''); filtrarEventos('todos'); setCurrentPage(1); setFilterTick(t => t + 1); setDateFilterOpen(false); }}>
                  Limpar
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
        <div className="event-grid">
          {loading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
              <p>Carregando eventos...</p>
            </div>
          ) : (
            <>
              {/* Removido bloco duplicado de Adicionar Evento */}
              {(() => {
                // Sempre renderizar o botão grande (admin)
                let blocos = [];
                // Exibir apenas UM bloco de adicionar evento para quem tem permissão
                let canAddEvent = false;
                try {
                  const permsStr = localStorage.getItem('permissions');
                  if (permsStr) {
                    const perms = JSON.parse(permsStr);
                    canAddEvent = Boolean(perms.canCreateEvent || perms.can_create_event);
                  }
                } catch {}
                if (canAddEvent) {
                    blocos.push(
                      <div
                        key="add-event"
                        className="event-card event-card-add event-card-add-large"
                        onClick={() => navigate('/add-event')}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="add-event-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <FaPlus size={40} />
                          <span style={{ fontSize: 14, fontWeight: 600 }}>Adicionar evento</span>
                        </div>
                      </div>
                    );
                }
                // Renderizar eventos reais
                if (currentEventos && currentEventos.length > 0) {
                  blocos = blocos.concat(currentEventos
                    .filter(evento => evento.titulo !== 'Placeholder')
                    .map((evento, index) => (
                      <Event key={`evento-${index}`} evento={evento} isAdmin={isAdmin} openModal={openModal} />
                    )));
                }
                // Preencher a grade com espaços reservados para manter o layout
                let totalBlocos = eventsPerPage;
                let usados = blocos.length;
                let placeholders = Math.max(0, totalBlocos - usados);
                for (let i = 0; i < placeholders; i++) {
                  blocos.push(<div key={`placeholder-${i}`} className="event-card event-card-placeholder" />);
                }
                return blocos;
              })()}
            </>
          )}
        </div>

        <div className="pagination">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </button>
          <span style={{ 
            margin: '0 15px', 
            color: '#6BA82C', 
            fontWeight: 'bold' 
          }}>
            {eventosFiltrados.length > 0 ? 
              `Página ${currentPage} de ${totalPages} (${eventosFiltrados.length} evento${eventosFiltrados.length !== 1 ? 's' : ''})` :
              'Nenhum evento encontrado'
            }
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || eventosFiltrados.length === 0}
          >
            Próxima
          </button>
        </div>

        <Modal
          isOpen={modalIsOpen}
          onRequestClose={closeModal}
          style={customStyles}
          contentLabel="Detalhes do Evento"
        >
          {selectedEvento && (
            <>
              <h2>{selectedEvento.titulo}</h2>
              <p>{selectedEvento.texto}</p>
              <p>
                {selectedEvento.data} - {selectedEvento.hora}
              </p>
              <p>{selectedEvento.local}</p>
              <button onClick={closeModal} className="btn btn-secondary">
                Fechar
              </button>
            </>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default Dashboard;
