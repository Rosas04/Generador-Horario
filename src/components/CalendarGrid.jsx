import React, { useMemo } from 'react';
import { DAYS_ORDER, timeToMinutes } from '../utils/scheduler';
import calendarImg from '../assets/calendar.png';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am a 9pm

const minutesSinceStart = (time) => timeToMinutes(time) - timeToMinutes('07:00');
const TOTAL_MINUTES = 14 * 60 + 35; // 07:00 a 21:35 (875 minutos en total)

const darkenColor = (hex, amount = 0.15) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
};

const TYPE_LABELS = { T: 'Teoría', P: 'Práctica', L: 'Lab' };

export default function CalendarGrid({ schedule }) {
  const sessionsByDay = useMemo(() => {
    const map = {};
    DAYS_ORDER.forEach((d) => (map[d] = []));
    if (!schedule) return map;

    schedule.flat().forEach((session) => {
      if (map[session.day]) {
        map[session.day].push(session);
      }
    });
    return map;
  }, [schedule]);

  if (!schedule) {
    return (
      <div className="calendar-grid" style={{ minHeight: '400px', flex: 1 }}>
        <div className="calendar-empty">
          <div className="calendar-empty-icon">
            <img src={calendarImg} alt="Calendario" style={{ width: '120px', opacity: 0.9 }} />
          </div>
          <div className="calendar-empty-title">No hay horario generado</div>
          <div className="calendar-empty-sub">
            Define tus cursos y preferencias para ver tu horario.
          </div>
        </div>
      </div>
    );
  }

  const headerColors = {
    'Lunes': 'rgba(224, 242, 254, 0.1)',
    'Martes': 'rgba(220, 252, 231, 0.1)',
    'Miércoles': 'rgba(255, 237, 213, 0.1)',
    'Jueves': 'rgba(252, 231, 243, 0.1)',
    'Viernes': 'rgba(243, 232, 255, 0.1)',
    'Sábado': 'rgba(254, 249, 195, 0.1)',
  };

  return (
    <div className="calendar-grid" style={{ 
      boxShadow: 'var(--shadow-md)', 
      border: '1px solid var(--border-color)', 
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      flex: 1, // Ocupa todo el alto disponible en main-area
      minHeight: '500px', // Para que no se aplaste demasiado en pantallas muy chicas
      overflow: 'hidden',
      background: 'var(--bg-primary)'
    }}>
      {/* Header con días */}
      <div className="calendar-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="calendar-day-header" style={{ fontSize: '0.8rem', padding: '10px 8px' }}>Hora</div>
        {DAYS_ORDER.map((day) => (
          <div key={day} className="calendar-day-header" style={{ 
            background: headerColors[day], 
            fontSize: '1rem', 
            padding: '10px 8px',
            color: 'var(--text-primary)',
            borderRight: '1px solid var(--border-color)'
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Body dinámico al 100% del espacio */}
      <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(6, 1fr)', background: 'var(--bg-primary)', flex: 1, position: 'relative' }}>
        {/* Columna de horas */}
        <div style={{ borderRight: '1px solid var(--border-color)', position: 'relative' }}>
          {HOURS.map((h) => {
            const topPercent = (((h - 7) * 60) / TOTAL_MINUTES) * 100;
            return (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  top: `${topPercent}%`,
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  borderTop: '1px solid var(--border-color)', // Usar borderTop para alinear la línea con la hora
                }}
              >
                {/* El texto va desplazado hacia arriba para quedar centrado en la línea */}
                <span style={{ transform: 'translateY(-50%)', background: 'var(--bg-primary)', padding: '0 4px' }}>
                  {`${h.toString().padStart(2, '0')}:00`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Columnas por día */}
        {DAYS_ORDER.map((day) => (
          <div
            key={day}
            style={{
              borderRight: '1px solid var(--border-color)',
              position: 'relative',
              height: '100%',
            }}
          >
            {/* Líneas de hora */}
            {HOURS.map((h) => {
              const topPercent = (((h - 7) * 60) / TOTAL_MINUTES) * 100;
              return (
                <div
                  key={h}
                  style={{
                    position: 'absolute',
                    top: `${topPercent}%`,
                    width: '100%',
                    borderTop: '1px solid var(--border-color)',
                    zIndex: 1
                  }}
                />
              );
            })}

            {/* Sesiones */}
            {sessionsByDay[day].map((session, idx) => {
              const duration = timeToMinutes(session.end) - timeToMinutes(session.start);
              const topPercent = (minutesSinceStart(session.start) / TOTAL_MINUTES) * 100;
              const heightPercent = (duration / TOTAL_MINUTES) * 100;
              
              const bg = session.courseColor || '#60a5fa';
              const border = darkenColor(bg, 0.2);

              const isShort = duration <= 60;

              return (
                <div
                  key={`${session.id || idx}-${session.type}`}
                  className="session-block"
                  style={{
                    top: `calc(${topPercent}% + 2px)`,
                    height: `calc(${heightPercent}% - 4px)`,
                    background: `${bg}33`,
                    border: `2px solid ${border}`,
                    color: border,
                    borderRadius: '6px',
                    boxShadow: '1px 1px 0px rgba(0,0,0,0.1)',
                    padding: isShort ? '2px' : '6px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    textAlign: 'center',
                    zIndex: 5
                  }}
                  title={`${session.courseName}\n${session.start} - ${session.end}\n${TYPE_LABELS[session.type] || session.type}${session.liga ? ` L${session.liga}` : ''}\n${session.teacher || ''}\n${session.room ? ` ${session.room}` : ''}`}
                >
                  <div className="session-name" style={{ 
                    fontWeight: 700, 
                    fontFamily: 'Kalam, cursive', 
                    fontSize: isShort ? '0.7rem' : '0.8rem', 
                    lineHeight: 1.05,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    display: '-webkit-box',
                    WebkitLineClamp: isShort ? 2 : 4,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {session.courseName} {isShort && <span style={{ opacity: 0.8, fontFamily: 'Outfit, sans-serif', fontSize: '0.65rem' }}>({session.type})</span>}
                  </div>
                  {!isShort && (
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.65rem', fontWeight: 600, marginTop: '2px', opacity: 0.8 }}>
                      ({session.type})
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
