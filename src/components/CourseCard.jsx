import React from 'react';

const TYPE_LABELS = { T: 'Teoría', P: 'Práctica', L: 'Lab' };

export default function CourseCard({ course, onEdit, onDelete }) {
  // Agrupar secciones por liga para mostrar las opciones disponibles
  const ligaGroups = {};
  const noLiga = [];
  (course.sections || []).forEach((sec) => {
    if (sec.liga) {
      if (!ligaGroups[sec.liga]) ligaGroups[sec.liga] = [];
      ligaGroups[sec.liga].push(sec);
    } else {
      noLiga.push(sec);
    }
  });

  const ligaKeys = Object.keys(ligaGroups).sort();

  return (
    <div
      className="course-card"
      style={{ '--course-color': course.color }}
      onClick={() => onEdit(course)}
    >
      <div className="course-card-header">
        <span className="course-name">{course.name}</span>
        <div className="course-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(course)} title="Editar"></button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onDelete(course.id)} title="Eliminar"></button>
        </div>
      </div>

      <div className="course-meta">
        {ligaKeys.length > 0 && ligaKeys.map((liga) => (
          <span key={liga} className="course-badge" style={{ background: `${course.color}18`, color: course.color, borderColor: `${course.color}40` }}>
            Liga {liga}: {ligaGroups[liga].map((s) => TYPE_LABELS[s.type] || s.type).join(' + ')}
          </span>
        ))}
        {noLiga.map((sec) => (
          <span key={sec.id} className={`course-badge type-${sec.type}`}>
            {TYPE_LABELS[sec.type] || sec.type} · {sec.day} {sec.start}
          </span>
        ))}
        {course.sections?.length === 0 && (
          <span className="course-badge">Sin sesiones</span>
        )}
      </div>
    </div>
  );
}
