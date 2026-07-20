// User identity (name + color) persisted in the browser.
const KEY = 'colabo.identity';
export const COLORS = ['#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#c026d3'];

export function getIdentity() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
export function setIdentity(name, color) {
  localStorage.setItem(KEY, JSON.stringify({ name, color }));
}

// Recent documents list (browser-local).
const RECENTS = 'colabo.recents';
const DEFAULT_TITLE = {
  doc: 'מסמך ללא שם', board: 'לוח ללא שם', timeline: 'ציר זמן ללא שם', risks: 'ניהול סיכונים',
  swot: 'ניתוח SWOT', chat: "צ'אט ללא שם", tasks: 'ניהול משימות', sun: 'שמש אסוציאציות',
};
export function getRecents() {
  try { return JSON.parse(localStorage.getItem(RECENTS)) || []; } catch { return []; }
}
export function touchRecent(token, title, mode, type = 'doc') {
  const list = getRecents().filter((r) => r.token !== token);
  list.unshift({ token, title: title || DEFAULT_TITLE[type] || 'ללא שם', mode, type, at: Date.now() });
  localStorage.setItem(RECENTS, JSON.stringify(list.slice(0, 30)));
}
