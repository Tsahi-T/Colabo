import { useState } from 'react';

const KEY = 'colabo.theme';
export function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem(KEY, t);
}
export function initTheme() {
  applyTheme(localStorage.getItem(KEY) || 'light');
}
export function ThemeToggle() {
  const [t, setT] = useState(() => localStorage.getItem(KEY) || 'light');
  const next = t === 'light' ? 'dark' : 'light';
  return (
    <button className="btn theme-btn" title={next === 'dark' ? 'מצב כהה' : 'מצב בהיר'}
      onClick={() => { applyTheme(next); setT(next); }}>
      {t === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
