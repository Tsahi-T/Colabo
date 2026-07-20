import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { touchRecent } from './identity.js';
import { printDoc, esc } from './printExport.js';

const uid = () => crypto.randomUUID().slice(0, 8);
// Vibrant ray palette — cycled by petal index so every board looks lively.
const RAYS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#06b6d4', '#eab308', '#ef4444', '#14b8a6', '#8b5cf6'];
const download = (text, name, mime = 'text/plain;charset=utf-8') => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

export default function Sun({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const nodes = ydoc.getMap('nodes'); // id -> Y.Map{ text, ord }
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

  useEffect(() => { touchRecent(token, title, info.mode, 'sun'); }, [title]);

  const core = meta.get('core') || '';
  const petals = [...nodes.entries()]
    .map(([id, n]) => ({ id, text: n.get('text') || '', ord: n.get('ord') || 0 }))
    .sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id));

  function addPetal(text = '') {
    const id = uid(), n = new Y.Map();
    ydoc.transact(() => { n.set('text', text); n.set('ord', Math.max(0, ...petals.map((p) => p.ord)) + 1); nodes.set(id, n); });
  }
  const setPetal = (id, text) => nodes.get(id)?.set('text', text);
  const delPetal = (id) => nodes.delete(id);

  // Even radial layout — positions derive from index/count, so it always stays tidy.
  const n = petals.length;
  const R = 40; // % of stage from center
  const pos = (i) => {
    const a = (-90 + (360 * i) / Math.max(1, n)) * (Math.PI / 180);
    return { x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) };
  };

  const exportTxt = () => download(
    `שמש אסוציאציות: ${core || title || 'ללא שם'}\n\n` + petals.map((p) => `- ${p.text}`).join('\n') + '\n',
    `${title || 'שמש אסוציאציות'}.txt`);
  const exportPdf = () => printDoc(
    `<h1>${esc(title || 'שמש אסוציאציות')}</h1><div class="sun-core">${esc(core) || '—'}</div><ul>` +
    (petals.length ? petals.map((p) => `<li>${esc(p.text) || '—'}</li>`).join('') : '<li>—</li>') + '</ul>',
    title || 'שמש אסוציאציות',
    '.sun-core{font-size:1.3rem;font-weight:800;text-align:center;background:#2563eb;color:#fff;border-radius:99px;padding:.6rem 1rem;max-width:340px;margin:1rem auto}ul{max-width:420px;margin:1rem auto;font-size:1.05rem}li{margin-bottom:.4rem}');
  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const lines = (await f.text()).split(/\r?\n/);
    const coreLine = lines.find((l) => /^שמש אסוציאציות:/.test(l));
    const items = lines.map((l) => l.match(/^-\s*(.+)/)).filter(Boolean).map((m) => m[1]);
    if (!items.length && !coreLine) return alert('לא נמצא תוכן בקובץ');
    if ((nodes.size || core) && !confirm('הטעינה תחליף את התוכן הנוכחי. להמשיך?')) return;
    ydoc.transact(() => {
      if (coreLine) meta.set('core', coreLine.replace(/^שמש אסוציאציות:\s*/, '').trim());
      [...nodes.keys()].forEach((k) => nodes.delete(k));
      items.forEach((text, i) => { const nn = new Y.Map(); nn.set('text', text); nn.set('ord', i + 1); nodes.set(uid(), nn); });
    });
  }

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm"><Logo size={24} /></Link>
        <input className="title-input" placeholder="שמש אסוציאציות ללא שם" value={title} readOnly={!editable}
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
      {editable && (
        <div className="toolbar board-bar">
          <button className="btn-primary" onClick={() => addPetal()}>+ אסוציאציה</button>
          <span className="hint" style={{ marginInlineStart: 'auto' }}>לחיצה על מילה עורכת אותה · מוסיפים אסוציאציות והשמש מסתדרת מעצמה</span>
        </div>
      )}
      <div className="sun-wrap">
        <div className="sun-stage">
          <svg className="sun-rays" viewBox="0 0 100 100" preserveAspectRatio="none">
            {petals.map((p, i) => {
              const { x, y } = pos(i);
              return <line key={p.id} x1="50" y1="50" x2={x} y2={y} stroke={RAYS[i % RAYS.length]} strokeWidth="0.5" />;
            })}
          </svg>
          <div className="sun-core">
            {editable
              ? <textarea value={core} placeholder="הנושא המרכזי" rows={1} onChange={(e) => meta.set('core', e.target.value)} />
              : (core || <span className="sun-ph">הנושא המרכזי</span>)}
          </div>
          {petals.map((p, i) => {
            const { x, y } = pos(i);
            const color = RAYS[i % RAYS.length];
            return (
              <div key={p.id} className="sun-petal" style={{ left: x + '%', top: y + '%', '--pc': color }}>
                {editable ? (
                  <>
                    <textarea value={p.text} placeholder="אסוציאציה" rows={1} onChange={(e) => setPetal(p.id, e.target.value)} />
                    <button className="sun-petal-del" onClick={() => delPetal(p.id)}>✕</button>
                  </>
                ) : (
                  <span className="sun-petal-text">{p.text || '—'}</span>
                )}
              </div>
            );
          })}
          {!petals.length && !core && editable && (
            <div className="sun-empty">התחילו מהנושא המרכזי, והוסיפו אסוציאציות סביבו ☀️</div>
          )}
        </div>
      </div>
    </div>
  );
}
