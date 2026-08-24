import React, { useState, useCallback } from 'react';
import './index.css';
import { usePersistence } from './hooks/usePersistence';
import { generateCombinations, filterAndRank } from './utils/scheduler';
import CourseModal from './components/CourseModal';
import CourseCard from './components/CourseCard';
import CalendarGrid from './components/CalendarGrid';
import PrefsPanel from './components/PrefsPanel';
import { ToastContainer, useToast } from './components/Toast';

const DEFAULT_PREFS = {
  maxDays: 'any',
  shift: 'any',
  tplDistribution: 'any',
  minGaps: false,
};

export default function App() {
  const [courses, setCourses] = usePersistence('horario-courses', []);
  const [prefs, setPrefs] = usePersistence('horario-prefs', DEFAULT_PREFS);

  const [showModal, setShowModal] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [schedules, setSchedules] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [conflicts, setConflicts] = useState([]);

  const { toasts, addToast, removeToast } = useToast();

  // ── Handlers de cursos ──────────────────────────────────────────────────────
  const handleOpenAdd = () => { setEditCourse(null); setShowModal(true); };
  const handleOpenEdit = (course) => { setEditCourse(course); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setEditCourse(null); };

  const handleSaveCourse = useCallback((course) => {
    setCourses((prev) => {
      const exists = prev.find((c) => c.id === course.id);
      return exists
        ? prev.map((c) => (c.id === course.id ? course : c))
        : [...prev, course];
    });
    addToast(editCourse ? 'Curso actualizado' : 'Curso añadido correctamente', 'success');
  }, [editCourse, setCourses, addToast]);

  const handleDeleteCourse = useCallback((id) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
    setSchedules([]);
    setConflicts([]);
    addToast('Curso eliminado', 'info');
  }, [setCourses, addToast]);

  // ── Handler de preferencias ─────────────────────────────────────────────────
  const handlePrefChange = (key, value) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  // ── Generación ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (courses.length === 0) {
      addToast('Añade al menos un curso para generar horarios', 'error');
      return;
    }
    setIsGenerating(true);
    setConflicts([]);

    // Usar setTimeout para no bloquear el render
    setTimeout(() => {
      try {
        const prefsForAlgo = {
          maxDays: prefs.maxDays === 'any' ? null : prefs.maxDays,
          shift: prefs.shift,
          tplDistribution: prefs.tplDistribution === 'any' ? null : prefs.tplDistribution,
          minGaps: prefs.minGaps,
        };

        const { results, errors } = generateCombinations(courses);
        const ranked = filterAndRank(results, prefsForAlgo);

        setSchedules(ranked);
        setCurrentIdx(0);
        setIsGenerating(false);

        if (ranked.length === 0) {
          if (results.length > 0) {
            addToast('No se encontraron horarios que cumplan con tus preferencias. Prueba relajando los filtros.', 'error');
          } else {
            setConflicts(errors);
            addToast('No hay combinaciones válidas. Revisa los cruces de horarios detectados.', 'error');
          }
        } else {
          addToast(` ${ranked.length} horario${ranked.length !== 1 ? 's' : ''} generado${ranked.length !== 1 ? 's' : ''}`, 'success');
        }
      } catch (e) {
        console.error(e);
        addToast('Error al generar horarios: ' + e.message, 'error');
        setIsGenerating(false);
      }
    }, 50);
  }, [courses, prefs, addToast]);

  // ── Navegación de horarios ──────────────────────────────────────────────────
  const goTo = (idx) => setCurrentIdx(Math.max(0, Math.min(schedules.length - 1, idx)));

  const currentSchedule = schedules.length > 0 ? schedules[currentIdx] : null;

  // ── Estadísticas del horario actual ──────────────────────────────────────────
  const getScheduleStats = (schedule) => {
    if (!schedule) return null;
    const sessions = schedule.flat();
    const days = new Set(sessions.map((s) => s.day));
    return { days: days.size, sessions: sessions.length };
  };
  const stats = getScheduleStats(currentSchedule);

  return (
    <div className="app-layout">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo"></div>
          <div>
            <div className="header-title">Generador de Horarios</div>
            <div className="header-subtitle">Planifica tu semestre sin conflictos</div>
          </div>
        </div>

        <div className="header-actions">
          {schedules.length > 0 && stats && (
            <div className="header-stats">
              Horario {currentIdx + 1}/{schedules.length} · {stats.days} días · {stats.sessions} sesiones
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={isGenerating || courses.length === 0}
          >
            {isGenerating ? <><div className="spinner" /> Generando...</> : ' Generar horarios'}
          </button>
        </div>
      </header>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title"> Cursos ({courses.length})</span>
          <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
            + Añadir
          </button>
        </div>

        <div className="courses-list">
          {courses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📖</div>
              <div className="empty-state-text">
                No hay cursos registrados.<br />
                Presiona <strong>+ Añadir</strong> para comenzar.
              </div>
            </div>
          ) : (
            courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteCourse}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="main-area">
        {/* Navegador de horarios */}
        {schedules.length > 0 && (
          <div className="schedule-nav">
            <div className="schedule-nav-info">
              <strong>{schedules.length}</strong> combinación{schedules.length !== 1 ? 'es' : ''} válida{schedules.length !== 1 ? 's' : ''} encontrada{schedules.length !== 1 ? 's' : ''} · ordenadas por mejor ajuste a tus preferencias
            </div>
            <div className="schedule-nav-controls">
              <button className="btn btn-secondary btn-sm" onClick={() => goTo(0)} disabled={currentIdx === 0}>⏮</button>
              <button className="btn btn-secondary btn-sm" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0}>◀</button>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '0 8px' }}>
                {currentIdx + 1} / {schedules.length}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => goTo(currentIdx + 1)} disabled={currentIdx >= schedules.length - 1}>▶</button>
              <button className="btn btn-secondary btn-sm" onClick={() => goTo(schedules.length - 1)} disabled={currentIdx >= schedules.length - 1}>⏭</button>
            </div>
          </div>
        )}

        {/* Mensaje de Cruces Inevitables */}
        {schedules.length === 0 && conflicts.length > 0 && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <h3 style={{ color: '#ef4444', fontSize: '1rem', marginBottom: '12px' }}>
               Imposible generar horario
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Los cursos que seleccionaste tienen cruces de horario. Aquí tienes el detalle de los choques:
            </p>
            <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {conflicts.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        {/* Calendario */}
        <CalendarGrid schedule={currentSchedule} />

        {/* Detalles Completos (NUEVO) */}
        {currentSchedule && (
          <div className="schedule-details-section" style={{
            background: 'var(--bg-primary)',
            border: '2px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontFamily: 'Kalam, cursive', fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>
              Detalles de tu horario ({currentIdx + 1}/{schedules.length})
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {Object.values(
                currentSchedule.flat().reduce((acc, s) => {
                  if (!acc[s.courseId]) acc[s.courseId] = { name: s.courseName, color: s.courseColor, sessions: [] };
                  acc[s.courseId].sessions.push(s);
                  return acc;
                }, {})
              ).map((course, i) => (
                <div key={i} style={{ 
                  background: 'var(--bg-secondary)', 
                  border: `2px solid ${course.color}`, 
                  borderRadius: 'var(--radius-md)', 
                  padding: '12px' 
                }}>
                  <h4 style={{ fontFamily: 'Kalam, cursive', fontSize: '1.1rem', marginBottom: '8px', color: course.color, borderBottom: `1px dashed ${course.color}`, paddingBottom: '4px' }}>
                    {course.name}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {course.sessions.map((s, j) => (
                      <div key={j} style={{ fontSize: '0.8rem', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {s.type === 'T' ? 'Teoría' : s.type === 'P' ? 'Práctica' : 'Lab'}
                          {s.liga ? ` (Liga ${s.liga})` : ''} 
                          {s.nrc ? ` · NRC: ${s.nrc}` : ''}
                        </div>
                        <div> {s.day} {s.start} - {s.end}</div>
                        {s.teacher && <div> {s.teacher}</div>}
                        {s.room && <div> Aula: {s.room}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Panel de Preferencias ──────────────────────────────────────────── */}
      <PrefsPanel prefs={prefs} onChange={handlePrefChange} />

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <CourseModal
          onClose={handleCloseModal}
          onSave={handleSaveCourse}
          editCourse={editCourse}
        />
      )}

      {/* ── Toasts ────────────────────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
