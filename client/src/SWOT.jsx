import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { PRESETS } from './swot-presets.js';
import { touchRecent } from './identity.js';
import { printDoc, esc } from './printExport.js';

const uid = () => crypto.randomUUID().slice(0, 8);
const QUADS = [
  { k: 'S', he: 'חוזקות', en: 'Strengths', cls: 'sw-s', color: '#22c55e' },
  { k: 'W', he: 'חולשות', en: 'Weaknesses', cls: 'sw-w', color: '#ef4444' },
  { k: 'O', he: 'הזדמנויות', en: 'Opportunities', cls: 'sw-o', color: '#3b82f6' },
  { k: 'T', he: 'איומים', en: 'Threats', cls: 'sw-t', color: '#f97316' },
];
const download = (text, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

function Quadrant({ q, items, editable, add, del, edit }) {
  const [showPresets, setShowPresets] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setShowPresets(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className={'sw-quad ' + q.cls}>
      <div className="sw-head">
        <span className="sw-letter">{q.k}</span>
        <span className="sw-names"><b>{q.he}</b><i>{q.en}</i></span>
      </div>
      <div className="sw-lines">
        {items.map((it) => (
          <div key={it.id} className="sw-line">
            <span className="sw-dot" />
            {editable ? (
              <input value={it.text} placeholder="הקלדה חופשית…" onChange={(e) => edit(it.id, e.target.value)} />
            ) : (
              <span className="sw-text">{it.text || '—'}</span>
            )}
            {editable && <button className="sw-del" onClick={() => del(it.id)}>✕</button>}
          </div>
        ))}
        {!items.length && <div className="sw-empty">אין עדיין שורות</div>}
      </div>
      {editable && (
        <div className="sw-add-row" ref={ref}>
          <button className="btn sw-add" onClick={() => add(q.k)}>+ שורה</button>
          <button className="btn sw-add" onClick={() => setShowPresets((v) => !v)}>הצעות ✦</button>
          {showPresets && (
            <div className="menu-items sw-presets">
              {PRESETS[q.k].map((p) => (
                <button key={p} onClick={() => { add(q.k, p); setShowPresets(false); }}>{p}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SWOT({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const items = ydoc.getMap('items');
  const provider = useMemo(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return new HocuspocusProvider({
      url: `${proto}://${location.host}/collab`, name: info.docId, token, document: ydoc,
      onStatus: ({ status }) => setStatus(status),
    });
  }, []);

  useEffect(() => {
    ydoc.on('update', force);
    const meta = ydoc.getMap('meta');
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

  useEffect(() => { touchRecent(token, title, info.mode, 'swot'); }, [title]);

  const all = [...items.entries()].map(([id, m]) => ({ id, q: m.get('q'), ord: m.get('ord') || 0, text: m.get('text') || '' }));
  const grouped = Object.fromEntries(QUADS.map((q) => [q.k, all.filter((it) => it.q === q.k).sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id))]));

  function add(qk, presetText = '') {
    const id = uid(), m = new Y.Map();
    const maxOrd = Math.max(0, ...grouped[qk].map((x) => x.ord));
    m.set('q', qk); m.set('ord', maxOrd + 1); m.set('text', presetText);
    items.set(id, m);
  }
  const del = (id) => items.delete(id);
  const edit = (id, text) => items.get(id)?.set('text', text);

  const exportTxt = () => {
    let out = `SWOT: ${title || 'ללא שם'}\n`;
    QUADS.forEach((q) => {
      out += `\n${q.k} — ${q.he} / ${q.en}\n`;
      const rows = grouped[q.k];
      out += rows.length ? rows.map((r) => `- ${r.text}`).join('\n') + '\n' : '(אין שורות)\n';
    });
    download(out, `${title || 'SWOT'}.txt`);
  };
  const exportPdf = () => printDoc(
    `<h1>${esc(title || 'ניתוח SWOT')}</h1><div class="pm-grid">` +
    QUADS.map((q) => `<div class="pm-q" style="border-color:${q.color}"><h2 style="color:${q.color}">${q.k} — ${esc(q.he)} / ${q.en}</h2><ul>` +
      (grouped[q.k].length ? grouped[q.k].map((r) => `<li>${esc(r.text) || '—'}</li>`).join('') : '<li>—</li>') + '</ul></div>').join('') +
    '</div>',
    title || 'ניתוח SWOT',
    '.pm-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem}.pm-q{border:2px solid #ccc;border-radius:8px;padding:.8rem 1.1rem;break-inside:avoid}.pm-q h2{margin:0 0 .5rem;font-size:1.05rem}.pm-q ul{margin:0;padding-inline-start:1.2rem}.pm-q li{margin-bottom:.3rem}');
  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const lines = (await f.text()).split(/\r?\n/);
    const parsed = { S: [], W: [], O: [], T: [] };
    let cur = null;
    for (const line of lines) {
      const h = QUADS.find((q) => line.startsWith(q.k + ' —') || line.startsWith(q.k + ' -'));
      if (h) { cur = h.k; continue; }
      const m = cur && line.match(/^-\s*(.+)/);
      if (m) parsed[cur].push(m[1]);
    }
    const total = Object.values(parsed).flat().length;
    if (!total) return alert('לא נמצאו שורות בקובץ (פורמט: כותרת רביע ואז שורות עם "-")');
    if (items.size && !confirm('הטעינה תחליף את הניתוח הנוכחי. להמשיך?')) return;
    ydoc.transact(() => {
      [...items.keys()].forEach((k) => items.delete(k));
      Object.entries(parsed).forEach(([qk, rows]) => rows.forEach((text, i) => {
        const m = new Y.Map();
        m.set('q', qk); m.set('ord', i + 1); m.set('text', text);
        items.set(uid(), m);
      }));
    });
  }

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm"><Logo size={24} /></Link>
        <input className="title-input" placeholder="ניתוח SWOT ללא שם" value={title} readOnly={!editable}
          onChange={(e) => ydoc.getMap('meta').set('title', e.target.value)} />
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
      <div className="sw-page">
        <div className="sw-grid">
          {QUADS.map((q) => (
            <Quadrant key={q.k} q={q} items={grouped[q.k]} editable={editable} add={add} del={del} edit={edit} />
          ))}
        </div>
      </div>
    </div>
  );
}
