import React, { useState, useCallback } from 'react';
import { usePersistence } from '../hooks/usePersistence';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SESSION_TYPES = ['T', 'P', 'L'];
const TYPE_LABELS = { T: 'Teoría', P: 'Práctica', L: 'Laboratorio' };

const COURSE_COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399',
  '#22d3ee', '#60a5fa', '#818cf8', '#c084fc', '#f472b6',
  '#94a3b8', '#e2e8f0',
];

const emptySection = () => ({
  id: crypto.randomUUID(),
  type: 'T',
  liga: '',
  day: 'Lunes',
  start: '',
  end: '',
  teacher: '',
  nrc: '',
  room: '',
});

const parsePastedText = (text) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections = [];
  
  let currentSection = null;
  let expecting = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === 'NRC:') {
      if (currentSection && currentSection.day && currentSection.start) {
        sections.push(currentSection);
      }
      currentSection = { id: crypto.randomUUID(), type: 'T', liga: '', day: '', start: '', end: '', teacher: '', nrc: '', room: '' };
      expecting = 'nrc';
      continue;
    }

    if (!currentSection) continue;

    if (expecting === 'nrc') {
      currentSection.nrc = line.split('\t')[0].trim();
      expecting = null;
      continue;
    }

    if (line === 'ID LIGA:') {
      expecting = 'id_liga';
      continue;
    }
    if (expecting === 'id_liga') {
      const val = line.split('\t')[0].trim();
      const match = val.match(/([TPL])(\d+)?/i);
      if (match) {
        if (match[2]) currentSection.liga = match[2];
        if (['T', 'P', 'L'].includes(match[1].toUpperCase())) {
          currentSection.type = match[1].toUpperCase();
        }
      }
      expecting = null;
      continue;
    }

    if (line === 'LIGA:') {
      expecting = 'liga';
      continue;
    }
    if (expecting === 'liga') {
      const val = line.split('\t')[0].trim();
      const match = val.match(/([TPL])(\d+)?/i);
      if (match) {
        // Extraemos el número de liga por si acaso, pero NO sobreescribimos el 'type'
        // ya que el 'type' real viene de 'ID LIGA'
        if (match[2] && !currentSection.liga) currentSection.liga = match[2];
      }
      expecting = null;
      continue;
    }

    if (line.includes('PABE\tAULA\tDIA\tHORA') || line.includes('PABE AULA DIA HORA')) {
      expecting = 'data_row';
      continue;
    }
    
    if (expecting === 'data_row') {
      const timeRegex = /(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i;
      const timeMatch = line.match(timeRegex);
      
      if (timeMatch) {
        // Si la currentSection ya tiene un día/hora llenado, significa que esta fila es otro día (otra sesión) para el mismo NRC
        if (currentSection.start !== '') {
           sections.push({...currentSection});
           currentSection = { ...currentSection, id: crypto.randomUUID(), day: '', start: '', end: '', room: '' };
        }

        const parseTime = (t) => {
          const [time, modifier] = t.trim().split(/\s+/);
          let [hours, minutes] = time.split(':');
          if (hours === '12') hours = '00';
          if (modifier.toUpperCase() === 'PM') hours = (parseInt(hours, 10) + 12).toString();
          return `${hours.padStart(2, '0')}:${minutes}`;
        };
        currentSection.start = parseTime(timeMatch[1]);
        currentSection.end = parseTime(timeMatch[2]);
        
        const daysMap = { 'LUN': 'Lunes', 'MAR': 'Martes', 'MIE': 'Miércoles', 'JUE': 'Jueves', 'VIE': 'Viernes', 'SAB': 'Sábado', 'DOM': 'Domingo' };
        for (const [abbr, full] of Object.entries(daysMap)) {
          if (line.toUpperCase().includes(abbr + ',')) {
            currentSection.day = full;
            break;
          }
        }

        const parts = line.split('\t');
        let dayIndex = -1;
        for (let j = 0; j < parts.length; j++) {
          if (parts[j].includes(',')) {
            dayIndex = j;
            break;
          }
        }
        if (dayIndex >= 1) {
          currentSection.room = parts[dayIndex - 1].trim();
        }

        let timeIndex = -1;
        for (let j = 0; j < parts.length; j++) {
          if (timeRegex.test(parts[j])) {
            timeIndex = j;
            break;
          }
        }
        if (timeIndex !== -1 && timeIndex + 2 < parts.length) {
          currentSection.teacher = parts.slice(timeIndex + 2).join(' ').trim();
        }
      }
      // NOTA: NO reseteamos `expecting = null` para que siga buscando más filas de datos (múltiples días) hasta que encuentre un nuevo NRC
    }
  }

  if (currentSection && currentSection.day && currentSection.start) {
    sections.push(currentSection);
  }

  // Fallback para formato antiguo
  if (sections.length === 0) {
    for (const line of lines) {
      const parts = line.includes('|')
        ? line.split('|').map((p) => p.trim())
        : line.split(/\t|\s{2,}/).map((p) => p.trim());

      if (parts.length >= 4) {
        const typeRaw = (parts[0] || '').toUpperCase();
        const type = SESSION_TYPES.includes(typeRaw) ? typeRaw : 'T';
        const dayMatch = DAYS.find((d) => d.toLowerCase().startsWith((parts[1] || '').toLowerCase().slice(0, 3)));
        if (dayMatch && parts[2]?.includes(':') && parts[3]?.includes(':')) {
           sections.push({
             id: crypto.randomUUID(),
             type,
             day: dayMatch,
             start: parts[2] || '',
             end: parts[3] || '',
             liga: parts[4] || '',
             teacher: parts[5] || '',
             nrc: parts[6] || '',
             room: parts[7] || '',
           });
        }
      }
    }
  }
  
  return sections;
};

export default function CourseModal({ onClose, onSave, editCourse = null }) {
  const [tab, setTab] = useState('manual');
  const [name, setName] = useState(editCourse?.name || '');
  const [color, setColor] = useState(editCourse?.color || COURSE_COLORS[6]);
  const [sections, setSections] = useState(
    editCourse?.sections?.length ? editCourse.sections : [emptySection()]
  );
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');

  const addSection = () => setSections((s) => [...s, emptySection()]);
  const removeSection = (id) => setSections((s) => s.filter((sec) => sec.id !== id));

  const updateSection = (id, field, value) => {
    setSections((s) => s.map((sec) => (sec.id === id ? { ...sec, [field]: value } : sec)));
  };

  const handleParse = () => {
    const parsed = parsePastedText(pasteText);
    if (parsed.length === 0) {
      setError('No se pudieron parsear sesiones. Revisa el formato.');
      return;
    }
    setSections(parsed);
    setError('');
    setTab('manual');
  };

  const handleSave = () => {
    if (!name.trim()) { setError('El nombre del curso es obligatorio.'); return; }
    if (sections.length === 0) { setError('Agrega al menos una sesión.'); return; }
    const invalidSections = sections.filter((s) => !s.day || !s.start || !s.end);
    if (invalidSections.length > 0) { setError('Completa el día, hora inicio y hora fin de todas las sesiones.'); return; }

    onSave({
      id: editCourse?.id || crypto.randomUUID(),
      name: name.trim(),
      color,
      sections,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2 className="modal-title">{editCourse ? 'Editar clase' : 'Añadir clase'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Tabs */}
          <div className="modal-tabs">
            <button className={`modal-tab ${tab === 'manual' ? 'active' : ''}`} onClick={() => setTab('manual')}>
               Manualmente
            </button>
            <button className={`modal-tab ${tab === 'paste' ? 'active' : ''}`} onClick={() => setTab('paste')}>
               Copiando texto
            </button>
          </div>

          {tab === 'paste' && (
            <div>
              <p className="paste-hint" style={{ marginBottom: 8 }}>
                Pega el texto con los turnos. Formato por línea:<br />
                <code>TIPO | DÍA | INICIO | FIN | LIGA | DOCENTE | NRC | AULA</code><br />
                Ejemplo: <code>T | Lunes | 08:00 | 10:00 | 1 | García M. | 1234 | A-101</code>
              </p>
              <textarea
                className="paste-area"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Pega aquí el texto con los turnos del curso..."
              />
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleParse}>
                  ⚡ Parsear turnos
                </button>
                <span className="paste-hint" style={{ alignSelf: 'center' }}>
                  Se importarán como sesiones editables
                </span>
              </div>
            </div>
          )}

          {tab === 'manual' && (
            <>
              {/* Datos del curso */}
              <p className="form-section-title">Datos del curso</p>
              <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Nombre del curso *</label>
                  <input
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Cálculo Diferencial"
                  />
                </div>
              </div>

              {/* Color */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Color del curso</label>
                <div className="color-picker-grid">
                  {COURSE_COLORS.map((c) => (
                    <div
                      key={c}
                      className={`color-swatch ${color === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>

              {/* Sesiones */}
              <p className="form-section-title">Turnos / Sesiones</p>
              <div className="sessions-list">
                {sections.map((sec, idx) => (
                  <div key={sec.id} className="session-form-card">
                    <div className="session-form-header">
                      <span className="session-form-label">Sesión {idx + 1}</span>
                      {sections.length > 1 && (
                        <button className="btn btn-ghost btn-sm" onClick={() => removeSection(sec.id)}>
                           Eliminar
                        </button>
                      )}
                    </div>
                    <div className="form-grid form-grid-3">
                      <div className="form-group">
                        <label className="form-label">Tipo</label>
                        <select
                          className="form-select"
                          value={sec.type}
                          onChange={(e) => updateSection(sec.id, 'type', e.target.value)}
                        >
                          {SESSION_TYPES.map((t) => (
                            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Liga</label>
                        <input
                          className="form-input"
                          value={sec.liga}
                          onChange={(e) => updateSection(sec.id, 'liga', e.target.value)}
                          placeholder="Ej: 1"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Día *</label>
                        <select
                          className="form-select"
                          value={sec.day}
                          onChange={(e) => updateSection(sec.id, 'day', e.target.value)}
                        >
                          {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Hora inicio *</label>
                        <input
                          type="time"
                          className="form-input"
                          value={sec.start}
                          onChange={(e) => updateSection(sec.id, 'start', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Hora fin *</label>
                        <input
                          type="time"
                          className="form-input"
                          value={sec.end}
                          onChange={(e) => updateSection(sec.id, 'end', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">NRC</label>
                        <input
                          className="form-input"
                          value={sec.nrc}
                          onChange={(e) => updateSection(sec.id, 'nrc', e.target.value)}
                          placeholder="Código"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Docente</label>
                        <input
                          className="form-input"
                          value={sec.teacher}
                          onChange={(e) => updateSection(sec.id, 'teacher', e.target.value)}
                          placeholder="Nombre"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Aula</label>
                        <input
                          className="form-input"
                          value={sec.room}
                          onChange={(e) => updateSection(sec.id, 'room', e.target.value)}
                          placeholder="Ej: A-101"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-secondary btn-sm" onClick={addSection} style={{ marginTop: 4 }}>
                + Añadir sesión
              </button>
            </>
          )}

          {error && (
            <p style={{ color: 'var(--accent-danger)', fontSize: '0.8rem', marginTop: 12 }}>
               {error}
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>
             {editCourse ? 'Guardar cambios' : 'Añadir clase'}
          </button>
        </div>
      </div>
    </div>
  );
}
