import React, { useState, useEffect } from 'react';

export default function Toast({ message, type = 'info', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`toast toast-${type}`}>
      {type === 'success' && ''}
      {type === 'error' && ''}
      {type === 'info' && ''}
      {message}
    </div>
  );
}

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onDone={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
  };

  const removeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  return { toasts, addToast, removeToast };
}
