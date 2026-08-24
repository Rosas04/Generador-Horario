/**
 * usePersistence.js
 * Hook personalizado para guardar/cargar datos en LocalStorage.
 */
import { useState, useEffect } from 'react';

export const usePersistence = (key, initialValue) => {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // silencioso si no hay espacio
    }
  }, [key, state]);

  return [state, setState];
};
