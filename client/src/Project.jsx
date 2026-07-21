import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { touchRecent } from './identity.js';
import { printElementImage } from './imageExport.js';

// Project charter — the top-level "what is this project" record. Fields live in the
// shared Y.Map so every field is collaboratively editable like the rest of the app.
const FIELDS = [
  { k: 'goal', label: 'מטרת הפרויקט', ph: 'מה הפרויקט אמור להשיג?', rows: 3 },
  { k: 'scope', label: 'תכולה', ph: 'מה נכלל — ומה מפורשות לא נכלל', rows: 3 },
  { k: 'stakeholders', label: 'בעלי עניין', ph: 'מי מעורב, מי מאשר, מי מושפע', rows: 2 },
  { k: 'milestones', label: 'אבני דרך עיקריות', ph: 'השלבים המרכזיים ומועדיהם', rows: 3 },
  { k: 'budget', label: 'משאבים ותקציב', ph: 'כוח אדם, תקציב, תלויות', rows: 2 },
  { k: 'risks', label: 'סיכונים מרכזיים', ph: 'מה עלול להשתבש ומה עושים', rows: 2 },
  { k: 'success', label: 'מדדי הצלחה', ph: 'איך נדע שהפרויקט הצליח', rows: 2 },
  { k: 'notes', label: 'הערות', ph: 'כל מה שלא נכנס למקום אחר', rows: 2 },
];
const META = [
  { k: 'manager', label: 'מנהל הפרויקט', ph: 'שם' },
  { k: 'client', label: 'לקוח / גורם מזמין', ph: 'שם' },
  { k: 'start', label: 'תאריך התחלה', type: 'date' },
  { k: 'end', label: 'תאריך יעד', type: 'date' },
];
const STATUSES = { planning: 'בתכנון', active: 'פעיל', hold: 'מושהה', done: 'הושלם' };

const download = (text, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

export default function Project({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const data = ydoc.getMap('project');
  const meta = ydoc.getMap('meta');
  const provider = useMemo(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return new HocuspocusProvider({
      url: `${proto}://${location.host}/collab`, name: info.docId, token, document: ydoc,
      onStatus: ({ status }) => setStatus(status),
    });
  }, []);

  useEffect(() => {
    ydoc.on('update', force);
    const syncTitle = () => setTitle(meta.get('title') || '');
    meta.observe(syncTitle);
    syncTitle();
    provider.setAwarenessField('user', user);
    const aw = provider.awareness;
    const syncPeers = () => setPeers(
      [...aw.getStates().entries()].filter(([id]) => id !== aw.clientID).map(([, s]) => s.user).filter(Boolean)
    );
    aw.on('change', syncPeers);
    return () => { ydoc.off('update', force); meta.unobserve(syncTitle); aw.off('change', syncPeers); provider.destroy(); };
  }, []);

  useEffect(() => { touchRecent(token, title, info.mode, 'project'); }, [title]);

  const get = (k) => data.get(k) || '';
  const set = (k, v) => data.set(k, v);
  const projStatus = data.get('status') || 'planning';

  const exportTxt = () => {
    let out = `פרויקט: ${title || 'ללא שם'}\n`;
    out += `סטטוס: ${STATUSES[projStatus]}\n`;
    META.forEach((m) => { if (get(m.k)) out += `${m.label}: ${get(m.k)}\n`; });
    FIELDS.forEach((f) => { out += `\n## ${f.label}\n${get(f.k) || '—'}\n`; });
    download(out, `${title || 'פרויקט'}.txt`);
  };
  const exportPdf = () => printElementImage('.pj-sheet', { title: title || 'פרויקט' });

  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const text = await f.text();
    const lines = text.split(/\r?\n/);
    const parsed = {};
    let cur = null, buf = [];
    const flush = () => { if (cur) parsed[cur] = buf.join('\n').trim(); buf = []; };
    for (const line of lines) {
      const h = line.match(/^##\s*(.+)/);
      if (h) { flush(); cur = FIELDS.find((x) => x.label === h[1].trim())?.k || null; continue; }
      if (cur) { buf.push(line); continue; }
      const m = line.match(/^(.+?):\s*(.*)$/);
      if (m) {
        const mk = META.find((x) => x.label === m[1].trim());
        if (mk) parsed[mk.k] = m[2].trim();
        if (m[1].trim() === 'סטטוס') {
          const s = Object.entries(STATUSES).find(([, v]) => v === m[2].trim());
          if (s) parsed.status = s[0];
        }
      }
    }
    flush();
    if (!Object.keys(parsed).length) return alert('לא נמצא תוכן בקובץ');
    if (data.size && !confirm('הטעינה תחליף את התוכן הנוכחי. להמשיך?')) return;
    ydoc.transact(() => {
      [...data.keys()].forEach((k) => data.delete(k));
      Object.entries(parsed).forEach(([k, v]) => v && data.set(k, v === '—' ? '' : v));
    });
  }

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm"><Logo size={24} /></Link>
        <input className="title-input" placeholder="פרויקט ללא שם" value={title} readOnly={!editable}
          onChange={(e) => meta.set('title', e.target.value)} />
        {!editable && <span className="badge">צפייה בלבד</span>}
        <span className={'conn ' + status} />
        <div className="peers">
          {peers.slice(0, 8).map((p, i) => (
            <span key={i} className="peer" style={{ background: p.color }} title={p.name}>{p.name[0]}</span>
          ))}
        </div>
        <div className="actions">
          {editable && <>
            <button className="btn" title="ניתן לטעון קובץ TXT בפורמט שיוצא מהמערכת בלבד" onClick={() => fileRef.current.click()}>טעינה</button>
            <input ref={fileRef} type="file" accept=".txt" hidden onChange={importTxt} />
          </>}
          <Menu label="הורדה">
            <button onClick={exportPdf}>PDF (הדפסה)</button>
            <button onClick={exportTxt}>TXT — לטעינה חוזרת</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>

      <div className="pj-page">
        <div className="pj-sheet">
          <div className="pj-head">
            <h1>{title || 'פרויקט ללא שם'}</h1>
            <span className={'pj-status pj-s-' + projStatus}>
              {editable ? (
                <select value={projStatus} onChange={(e) => set('status', e.target.value)}>
                  {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : STATUSES[projStatus]}
            </span>
          </div>

          <div className="pj-meta">
            {META.map((m) => (
              <label key={m.k} className="pj-meta-item">
                <span>{m.label}</span>
                {editable
                  ? <input type={m.type || 'text'} placeholder={m.ph} value={get(m.k)} onChange={(e) => set(m.k, e.target.value)} />
                  : <b>{get(m.k) || '—'}</b>}
              </label>
            ))}
          </div>

          <div className="pj-fields">
            {FIELDS.map((f) => (
              <section key={f.k} className="pj-field">
                <h2>{f.label}</h2>
                {editable
                  ? <textarea rows={f.rows} placeholder={f.ph} value={get(f.k)} onChange={(e) => set(f.k, e.target.value)} />
                  : <p>{get(f.k) || '—'}</p>}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
