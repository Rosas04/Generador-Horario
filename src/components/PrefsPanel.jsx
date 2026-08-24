import React from 'react';

const PREF_SECTIONS = [
  {
    label: 'Días de clase',
    key: 'maxDays',
    options: [
      { value: 'any', label: 'Sin restricción' },
      { value: 4, label: 'Máximo 4 días' },
      { value: 5, label: 'Máximo 5 días' },
    ],
  },
  {
    label: 'Turno horario',
    key: 'shift',
    options: [
      { value: 'any', label: 'Cualquier turno' },
      { value: 'morning', label: 'Solo Mañana', hint: '07:00 – 14:00' },
      { value: 'afternoon', label: 'Solo Tarde', hint: '14:00 – 21:35' },
    ],
  },
  {
    label: 'Teo-Práctica-Lab',
    key: 'tplDistribution',
    options: [
      { value: 'any', label: 'Sin preferencia' },
      { value: 'continuous', label: 'Corrido (seguido)' },
      { value: 'spread', label: 'Intercalado' },
    ],
  },
  {
    label: 'Huecos entre clases',
    key: 'minGaps',
    options: [
      { value: false, label: 'Sin preferencia' },
      { value: true, label: 'Minimizar huecos' },
    ],
  },
];

export default function PrefsPanel({ prefs, onChange }) {
  return (
    <aside className="prefs-panel">
      <div className="prefs-title">
         Preferencias
      </div>

      {PREF_SECTIONS.map((section) => (
        <div key={section.key} className="pref-group">
          <div className="pref-label">{section.label}</div>
          <div className="pref-options">
            {section.options.map((opt) => (
              <div
                key={String(opt.value)}
                className={`pref-option ${prefs[section.key] === opt.value ? 'selected' : ''}`}
                onClick={() => onChange(section.key, opt.value)}
              >
                <div className="pref-dot" />
                <div>
                  <div>{opt.label}</div>
                  {opt.hint && (
                    <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 1 }}>{opt.hint}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="pref-divider" />
        </div>
      ))}

      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>¿Cómo funciona?</strong><br />
        El generador crea todas las combinaciones posibles sin cruces y las ordena
        por puntaje según tus preferencias. Aparecerán primero los horarios que mejor
        cumplan tus criterios.
      </div>
    </aside>
  );
}
