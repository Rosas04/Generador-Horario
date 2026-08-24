/**
 * scheduler.js
 * Motor principal del generador de horarios.
 * Maneja: detección de cruces, sistema de ligas, generación de combinaciones y scoring.
 */

// ─── Utilidades de tiempo ────────────────────────────────────────────────────

/** Convierte "HH:MM" a minutos desde medianoche */
export const timeToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Convierte minutos a "HH:MM" */
export const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

// Rangos de turno (en minutos)
export const MORNING_START = timeToMinutes('07:00');
export const MORNING_END   = timeToMinutes('14:00');
export const AFTERNOON_START = timeToMinutes('14:00');
export const AFTERNOON_END   = timeToMinutes('21:35');

export const DAYS_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ─── Detección de cruces ─────────────────────────────────────────────────────

/**
 * Devuelve true si dos sesiones se solapan en el mismo día.
 * @param {object} a - sesión { day, start, end }
 * @param {object} b - sesión { day, start, end }
 */
export const sessionsOverlap = (a, b) => {
  if (a.day !== b.day) return false;
  const aStart = timeToMinutes(a.start);
  const aEnd   = timeToMinutes(a.end);
  const bStart = timeToMinutes(b.start);
  const bEnd   = timeToMinutes(b.end);
  return aStart < bEnd && bStart < aEnd;
};

/**
 * Verifica si un conjunto de sesiones (el horario parcial) choca con una sesión nueva.
 * @param {Array} placed - sesiones ya colocadas
 * @param {Array} incoming - nuevas sesiones a agregar
 * @returns {object|null} la sesión conflictiva si hay cruce, null si no hay
 */
export const getConflict = (placed, incoming) => {
  for (const s of incoming) {
    for (const p of placed) {
      if (sessionsOverlap(s, p)) return { placed: p, incoming: s };
    }
  }
  return null;
};

// ─── Sistema de Ligas ────────────────────────────────────────────────────────

/**
 * Filtra los turnos de un curso para que la liga sea consistente y solo se elija
 * UNA sesión por cada tipo (T, P, L) dentro de la liga.
 */
export const getCourseOptions = (course) => {
  const sections = course.sections || [];
  if (sections.length === 0) return [];

  const byLiga = {};
  const noLiga = [];

  sections.forEach((sec) => {
    const secWithMeta = { ...sec, courseId: course.id, courseName: course.name, courseColor: course.color };
    const liga = sec.liga ? sec.liga.trim() : null;
    if (liga) {
      if (!byLiga[liga]) byLiga[liga] = [];
      byLiga[liga].push(secWithMeta);
    } else {
      noLiga.push(secWithMeta);
    }
  });

  const cartesian = (arrays) => arrays.reduce((a, b) => a.flatMap(d => b.map(e => [...d, ...e])), [[]]);

  const processSections = (sectionList) => {
    const byType = {};
    sectionList.forEach(sec => {
      const type = sec.type || 'T';
      if (!byType[type]) byType[type] = [];
      byType[type].push(sec);
    });

    const typeChoices = [];
    for (const typeSections of Object.values(byType)) {
      const byNrc = {};
      typeSections.forEach(sec => {
        // Agrupamos por NRC para que sesiones con mismo NRC (ej. 2 días a la semana) se tomen juntas.
        // Si no tiene NRC, las agrupamos todas juntas para que no las divida como alternativas
        const key = sec.nrc ? sec.nrc.trim() : 'MANUAL_GROUP';
        if (!byNrc[key]) byNrc[key] = [];
        byNrc[key].push(sec);
      });
      typeChoices.push(Object.values(byNrc));
    }
    return cartesian(typeChoices);
  };

  const ligaOptions = [];
  for (const ligaSections of Object.values(byLiga)) {
    const combinations = processSections(ligaSections);
    combinations.forEach(comb => ligaOptions.push(comb));
  }

  let finalOptions = ligaOptions;

  if (noLiga.length > 0) {
    const noLigaCombinations = processSections(noLiga);
    if (ligaOptions.length === 0) {
      finalOptions = noLigaCombinations;
    } else {
      const combined = [];
      for (const lo of ligaOptions) {
        for (const nlc of noLigaCombinations) {
          combined.push([...lo, ...nlc]);
        }
      }
      finalOptions = combined;
    }
  }

  return finalOptions;
};

// ─── Generador de Combinaciones ──────────────────────────────────────────────

/**
 * Genera todas las combinaciones válidas (sin cruce) de horarios.
 * @param {Array} courses - lista de cursos del estado
 * @param {number} maxResults - límite de resultados para no bloquear el hilo
 * @returns {{ results: Array<Array>, errors: Array<string> }} 
 */
export const generateCombinations = (courses, maxResults = 500) => {
  const courseOptions = courses
    .filter((c) => c.sections && c.sections.length > 0)
    .map((c) => ({ courseName: c.name, courseColor: c.color, courseId: c.id, options: getCourseOptions(c) }));

  if (courseOptions.length === 0) return { results: [], errors: [] };

  const results = [];
  const errorsMap = new Map(); // Para guardar errores únicos

  const backtrack = (idx, current, placed) => {
    if (results.length >= maxResults) return;
    if (idx === courseOptions.length) {
      results.push([...current]);
      return;
    }

    const { options, courseName } = courseOptions[idx];

    for (const option of options) {
      const conflict = getConflict(placed, option);
      if (!conflict) {
        current.push(option);
        backtrack(idx + 1, current, [...placed, ...option]);
        current.pop();
      } else {
        const { placed: p, incoming: inc } = conflict;
        // Evitamos guardar cruces duplicados
        const key = [p.courseName, inc.courseName].sort().join('-');
        if (!errorsMap.has(key)) {
          errorsMap.set(key, `Cruce inevitable: ${p.courseName} y ${inc.courseName} el ${p.day} (${p.start} a ${p.end})`);
        }
      }
    }
  };

  backtrack(0, [], []);
  return { results, errors: Array.from(errorsMap.values()) };
};

// ─── Sistema de Scoring y Filtrado ──────────────────────────────────────────

/**
 * Clasifica una sesión según su turno.
 * @returns {'morning'|'afternoon'|'mixed'}
 */
const getSessionShift = (session) => {
  const start = timeToMinutes(session.start);
  const end   = timeToMinutes(session.end);
  if (end <= MORNING_END) return 'morning';
  if (start >= AFTERNOON_START) return 'afternoon';
  return 'mixed';
};

const DAY_INDEX = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5, 'Domingo': 6 };

/**
 * Calcula un score para un horario según las preferencias del usuario.
 * Mayor score = mejor horario.
 *
 * @param {Array} schedule - array de opciones (cada opción = array de sesiones)
 * @param {object} prefs - preferencias del usuario
 * @returns {{ score: number, valid: boolean, reasons: string[] }}
 */
export const scoreSchedule = (schedule, prefs) => {
  const allSessions = schedule.flat();
  const reasons = [];
  let score = 1000;
  let valid = true;

  // ─── Regla estricta: Orden Cronológico T -> P -> L ─────────────────────────────────────
  const byCourse = {};
  allSessions.forEach((s) => {
    if (!byCourse[s.courseId]) byCourse[s.courseId] = [];
    byCourse[s.courseId].push(s);
  });

  for (const group of Object.values(byCourse)) {
    const getMinAbs = (type) => {
      const filtered = group.filter(s => s.type === type);
      if (filtered.length === 0) return null;
      return Math.min(...filtered.map(s => DAY_INDEX[s.day] * 24 * 60 + timeToMinutes(s.start)));
    };
    
    const tMin = getMinAbs('T');
    const pMin = getMinAbs('P');
    const lMin = getMinAbs('L');

    if (tMin !== null && pMin !== null) {
      if (tMin > pMin) {
        score -= 500;
        reasons.push(`Práctica antes que Teoría (Penalización)`);
      } else {
        score += 200;
      }
    }

    if (pMin !== null && lMin !== null) {
      if (pMin > lMin) {
        score -= 500;
        reasons.push(`Laboratorio antes que Práctica (Penalización)`);
      } else {
        score += 200;
      }
    }

    if (tMin !== null && lMin !== null) {
      if (tMin > lMin) {
        score -= 500;
        reasons.push(`Laboratorio antes que Teoría (Penalización)`);
      } else {
        score += 200;
      }
    }
  }

  if (!valid) return { score: 0, valid, reasons };

  // ── Días únicos usados ───────────────────────────────────────────────────
  const daysUsed = new Set(allSessions.map((s) => s.day));
  const numDays = daysUsed.size;

  if (prefs.maxDays && numDays > prefs.maxDays) {
    valid = false;
    reasons.push(`Usa ${numDays} días (máximo ${prefs.maxDays})`);
  }
  // Premiar menor cantidad de días
  score -= numDays * 10;

  // ── Filtro de turno ───────────────────────────────────────────────────────
  if (prefs.shift && prefs.shift !== 'any') {
    for (const session of allSessions) {
      const shift = getSessionShift(session);
      if (prefs.shift === 'morning' && shift !== 'morning') {
        valid = false;
        reasons.push(`Sesión fuera del turno mañana: ${session.courseName} ${session.day}`);
        break;
      }
      if (prefs.shift === 'afternoon' && shift !== 'afternoon') {
        valid = false;
        reasons.push(`Sesión fuera del turno tarde: ${session.courseName} ${session.day}`);
        break;
      }
    }
  }

  // ── Huecos (gaps) entre sesiones del mismo día ────────────────────────────
  const byDay = {};
  allSessions.forEach((s) => {
    if (!byDay[s.day]) byDay[s.day] = [];
    byDay[s.day].push({ start: timeToMinutes(s.start), end: timeToMinutes(s.end) });
  });

  let totalGap = 0;
  Object.values(byDay).forEach((daySessions) => {
    daySessions.sort((a, b) => a.start - b.start);
    for (let i = 1; i < daySessions.length; i++) {
      const gap = daySessions[i].start - daySessions[i - 1].end;
      if (gap > 0) totalGap += gap;
    }
  });

  if (prefs.minGaps) {
    score -= totalGap; // penalizar huecos
  }

  // ── Distribución Teo-Prac-Lab: corrido vs intercalado ───────────────────
  if (prefs.tplDistribution) {
    // Para cada día, revisar si las sesiones T,P,L de un mismo curso están contiguas o intercaladas
    for (const daySessions of Object.values(byDay)) {
      daySessions.sort((a, b) => a.start - b.start);
    }

    // Agrupamos por curso + día
    const byCourseDay = {};
    allSessions.forEach((s) => {
      const key = `${s.courseId}_${s.day}`;
      if (!byCourseDay[key]) byCourseDay[key] = [];
      byCourseDay[key].push(s);
    });

    for (const group of Object.values(byCourseDay)) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
      let isContiguous = true;
      for (let i = 1; i < sorted.length; i++) {
        if (timeToMinutes(sorted[i].start) !== timeToMinutes(sorted[i - 1].end)) {
          isContiguous = false;
          break;
        }
      }

      if (prefs.tplDistribution === 'continuous' && isContiguous) score += 50;
      if (prefs.tplDistribution === 'continuous' && !isContiguous) score -= 50;
      if (prefs.tplDistribution === 'spread' && !isContiguous) score += 50;
      if (prefs.tplDistribution === 'spread' && isContiguous) score -= 50;
    }
  }

  return { score, valid, reasons };
};

/**
 * Filtra y ordena una lista de horarios según las preferencias del usuario.
 * @param {Array} schedules
 * @param {object} prefs
 * @returns {Array} horarios válidos ordenados por score desc
 */
export const filterAndRank = (schedules, prefs) => {
  const scored = schedules.map((s) => ({ schedule: s, ...scoreSchedule(s, prefs) }));
  return scored
    .filter((s) => s.valid)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.schedule);
};
