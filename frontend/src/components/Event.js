import { FaEdit, FaTrashAlt } from "react-icons/fa";
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// Paleta de cores principal usada pelo produto
const COLORS = {
    event: '#FFCC33',      // Eventos
    reuniao: '#0FB9B1',    // Reuniões
    aviso: '#CC3333',      // Avisos
    palestra: '#F4A171',   // Palestra (novo)
    workshop: '#3884C7',   // Workshop
    cerimonia: '#C04D00',  // Cerimônia (atualizado)
    treinamento: '#8E7DBE',// Treinamento
    outros: '#6C737E',     // Outros
    default: '#607d45ff'
};

// Mapeamento de correspondência exata (usamos chaves em lowercase)
const exactMap = {
    evento: COLORS.event,
    event: COLORS.event,
    reuniao: COLORS.reuniao,
    reunião: COLORS.reuniao,
    reun: COLORS.reuniao,
    aviso: COLORS.aviso,
    alerta: COLORS.aviso,
    palestra: COLORS.palestra,
    workshop: COLORS.workshop,
    oficina: COLORS.workshop,
    cerimonia: COLORS.cerimonia,
    cerimônia: COLORS.cerimonia,
    treinamento: COLORS.treinamento,
    outros: COLORS.outros,
};


function getColorForType(tipo) {
    if (!tipo) return COLORS.default;
    // Preferir correspondência exata primeiro
    const key = String(tipo).toLowerCase();
    if (exactMap[key]) return exactMap[key];

    const t = String(tipo).toLowerCase();
    if (t.includes('evento') || t.includes('event')) return COLORS.event;
    if (t.includes('reun') || t.includes('reuni')) return COLORS.reuniao;
    if (t.includes('workshop') || t.includes('oficina')) return COLORS.workshop;
    if (t.includes('cerimon') || t.includes('cerimônia') || t.includes('cerim')) return COLORS.cerimonia;
    if (t.includes('trein') || t.includes('treinamento')) return COLORS.treinamento;
    if (t.includes('outro') || t.includes('outros')) return COLORS.outros;
    if (t.includes('palestr') || t.includes('palestra')) return COLORS.palestra;
    if (t.includes('aviso') || t.includes('avis')) return COLORS.aviso;
    return COLORS.default;
}


export function Event({ evento, isAdmin, openModal }) {
    const navigate = useNavigate();
    // Não renderizar cartões de espaço reservado (placeholders) — retornar null para não ocupar espaço
    if (evento.titulo === 'Placeholder') {
        return null;
    }
    const currentUserId = localStorage.getItem('user_id');
    const isCreator = currentUserId && evento.criado_por_id && Number(currentUserId) === Number(evento.criado_por_id);

    const formatDateTime = () => {
        // Respeitar flag explícita mostrar_data: se false, não exibir data/hora
        if (!evento) return '';
        if (typeof evento.mostrar_data !== 'undefined' && evento.mostrar_data === false) return '';

        // Se o evento usar período (range), preferir exibir o período
        const ps = evento.data_period_start || evento.period_start || evento.data_periodo_inicio || '';
        const pe = evento.data_period_end || evento.period_end || evento.data_periodo_fim || '';
        if (ps || pe) {
            if (ps && pe) return `${ps} — ${pe}`;
            return ps || pe || '';
        }

        // Caso contrário, fallback para data única + hora opcional
        const d = evento.data ? String(evento.data).trim() : '';
        const h = evento.hora ? String(evento.hora).trim() : '';
        if (d && h) return `${d} — ${h}`;
        return d || h || '';
    };

    return (
        <div
            key={evento.id}
            className="event-card"
            style={{ backgroundColor: getColorForType(evento.tipo) }}
            onClick={() => openModal(evento)}
        >
            <div className="event-content">
                <h5 className="card-title">{evento.titulo}</h5>
                {/* descrição intencionalmente omitida para manter os cartões compactos */}
                {formatDateTime() ? <p className="event-datetime">{formatDateTime()}</p> : null}
                {evento.local ? <p className="event-local">{evento.local}</p> : null}
            </div>
            {/* Ícones exibidos apenas para o criador OU para admin que é o criador */}
            {(isCreator || (isAdmin && isCreator)) ? (
                <div className="icon-buttons">
                    <button
                        className="icon-button"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate('/add-event', { state: { evento } });
                        }}
                        title="Editar evento"
                    >
                        <FaEdit />
                    </button>
                    <button
                        className="icon-button"
                        onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm('Tem certeza que deseja apagar este evento?')) return;
                            try {
                                await api.delete(`/events/${evento.id}`);
                                window.dispatchEvent(new CustomEvent('evento-deleted', { detail: { id: evento.id } }));
                            } catch (err) {
                                console.error('Erro ao deletar evento', err);
                                alert('Erro ao deletar evento');
                            }
                        }}
                        title="Apagar evento"
                    >
                        <FaTrashAlt />
                    </button>
                </div>
            ) : null}
        </div>
    );
}
