import { useEffect, useMemo, useRef, useState, useReducer, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { PASTELS, boardToTxt, txtToBoard } from './board-io.js';
import { touchRecent } from './identity.js';

const NOTE_W = 190, NOTE_H = 170;
const uid = () => crypto.randomUUID().slice(0, 8);
const download = (text, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

export default function Board({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);       // [{user, cursor}]
  const [view, setView] = useState({ x: 0, y: 0, s: 1 });
  const [sel, setSel] = useState(null);         // {kind:'note'|'edge', id}
  const [editing, setEditing] = useState(null); // note id
  const [connect, setConnect] = useState(null); // {from, x, y}
  const [lastColor, setLastColor] = useState(PASTELS['צהוב']);
  const wrapRef = useRef();
  const drag = useRef(null);
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const notes = ydoc.getMap('notes');
  const edges = ydoc.getMap('edges');
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
      [...aw.getStates().entries()].filter(([id]) => id !== aw.clientID).map(([, s]) => s).filter((s) => s.user)
    );
    aw.on('change', syncPeers);
    return () => { ydoc.off('update', force); meta.unobserve(syncTitle); aw.off('change', syncPeers); provider.destroy(); };
  }, []);

  useEffect(() => { touchRecent(token, title, info.mode, 'board'); }, [title]);

  // ---- coordinates ----
  const toWorld = useCallback((e) => {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.s, y: (e.clientY - r.top - view.y) / view.s };
  }, [view]);

  useEffect(() => {  // non-passive wheel for zoom
    const el = wrapRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      setView((v) => {
        const s = Math.min(2.5, Math.max(0.2, v.s * (e.deltaY < 0 ? 1.1 : 0.9)));
        return { s, x: px - ((px - v.x) * s) / v.s, y: py - ((py - v.y) * s) / v.s };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---- mutations ----
  const maxZ = () => Math.max(0, ...[...notes.values()].map((n) => n.get('z') || 0));
  function addNote(x, y) {
    const id = uid(), n = new Y.Map();
    ydoc.transact(() => {
      n.set('x', x - NOTE_W / 2); n.set('y', y - NOTE_H / 2);
      n.set('w', NOTE_W); n.set('h', NOTE_H);
      n.set('color', lastColor); n.set('rot', +(Math.random() * 4 - 2).toFixed(1));
      n.set('title', ''); n.set('text', ''); n.set('z', maxZ() + 1);
      notes.set(id, n);
    });
    setSel({ kind: 'note', id });
    setEditing(id);
  }
  function deleteSel() {
    if (!sel) return;
    ydoc.transact(() => {
      if (sel.kind === 'note') {
        notes.delete(sel.id);
        [...edges.entries()].forEach(([eid, e]) => (e.a === sel.id || e.b === sel.id) && edges.delete(eid));
      } else edges.delete(sel.id);
    });
    setSel(null);
    setEditing(null);
  }
  useEffect(() => {
    const onKey = (e) => {
      if (!editable || editing || !sel) return;
      if (e.key === 'Delete') { e.preventDefault(); deleteSel(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- pointer interactions ----
  const capture = (e) => { try { wrapRef.current.setPointerCapture(e.pointerId); } catch { /* touch/pen edge cases */ } };
  function downBg(e) {
    if (e.target !== e.currentTarget) return;
    setSel(null);
    setEditing(null);
    drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, v: view };
    capture(e);
  }
  function downNote(e, id) {
    if (!editable || editing === id) return;
    e.stopPropagation();
    const n = notes.get(id);
    n.set('z', maxZ() + 1);
    const p = toWorld(e);
    drag.current = { mode: 'note', id, dx: p.x - n.get('x'), dy: p.y - n.get('y'), sx: e.clientX, sy: e.clientY, moved: false };
    capture(e);
  }
  function downResize(e, id) {
    e.stopPropagation();
    drag.current = { mode: 'resize', id };
    capture(e);
  }
  function downAnchor(e, id) {
    e.stopPropagation();
    const p = toWorld(e);
    setConnect({ from: id, x: p.x, y: p.y });
    drag.current = { mode: 'connect', from: id };
    capture(e);
  }
  function move(e) {
    const p = toWorld(e);
    provider.setAwarenessField('cursor', p);
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'pan') setView({ ...d.v, x: d.v.x + e.clientX - d.sx, y: d.v.y + e.clientY - d.sy });
    else if (d.mode === 'note') {
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      d.moved = true;
      const n = notes.get(d.id);
      if (n) ydoc.transact(() => { n.set('x', p.x - d.dx); n.set('y', p.y - d.dy); });
    } else if (d.mode === 'resize') {
      const n = notes.get(d.id);
      if (n) ydoc.transact(() => {
        n.set('w', Math.max(130, p.x - n.get('x')));
        n.set('h', Math.max(100, p.y - n.get('y')));
      });
    } else if (d.mode === 'connect') setConnect({ from: d.from, x: p.x, y: p.y });
  }
  function up(e) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.mode === 'note' && !d.moved) {
      // A tap (no drag): first tap selects, tap on the selected note opens editing. Touch-friendly.
      if (sel?.kind === 'note' && sel.id === d.id) setEditing(d.id);
      else setSel({ kind: 'note', id: d.id });
    }
    if (d.mode === 'connect') {
      setConnect(null);
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-note]');
      const to = el?.dataset.note;
      if (to && to !== d.from) {
        const dup = [...edges.values()].some((x) => (x.a === d.from && x.b === to) || (x.a === to && x.b === d.from));
        if (!dup) edges.set(uid(), { a: d.from, b: to });
      }
    }
  }

  function fitAll() {
    const ns = [...notes.values()];
    if (!ns.length) return setView({ x: 0, y: 0, s: 1 });
    const xs = ns.map((n) => n.get('x')), ys = ns.map((n) => n.get('y'));
    const x2 = ns.map((n) => n.get('x') + n.get('w')), y2 = ns.map((n) => n.get('y') + n.get('h'));
    const bx = Math.min(...xs) - 60, by = Math.min(...ys) - 60, bw = Math.max(...x2) - bx + 60, bh = Math.max(...y2) - by + 60;
    const r = wrapRef.current.getBoundingClientRect();
    const s = Math.min(1.5, r.width / bw, r.height / bh);
    setView({ s, x: (r.width - bw * s) / 2 - bx * s, y: (r.height - bh * s) / 2 - by * s });
  }

  // ---- TXT import/export ----
  const exportTxt = () => download(boardToTxt(title, notes, edges), `${title || 'לוח חשיבה'}.txt`);
  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const { notes: ns, edges: es } = txtToBoard(await f.text());
    if (!ns.length) return alert('לא נמצאו פתקים בקובץ');
    if (notes.size && !confirm('הטעינה תחליף את הלוח הנוכחי. להמשיך?')) return;
    ydoc.transact(() => {
      [...notes.keys()].forEach((k) => notes.delete(k));
      [...edges.keys()].forEach((k) => edges.delete(k));
      const byNum = new Map();
      ns.forEach((v, i) => {
        const id = uid(), n = new Y.Map();
        Object.entries({ x: v.x, y: v.y, w: v.w, h: v.h, color: v.color, rot: +(Math.random() * 4 - 2).toFixed(1), title: v.title || '', text: v.text, z: i + 1 }).forEach(([k, val]) => n.set(k, val));
        notes.set(id, n);
        byNum.set(v.num, id);
      });
      es.forEach(([a, b]) => byNum.has(a) && byNum.has(b) && edges.set(uid(), { a: byNum.get(a), b: byNum.get(b) }));
    });
    fitAll();
  }

  const center = (id) => {
    const n = notes.get(id);
    return n && { x: n.get('x') + n.get('w') / 2, y: n.get('y') + n.get('h') / 2 };
  };
  const closeEditIfLeft = (e) => {
    if (!e.relatedTarget || !e.currentTarget.closest('.note').contains(e.relatedTarget)) setEditing(null);
  };

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm"><Logo size={24} /></Link>
        <input className="title-input" placeholder="לוח ללא שם" value={title} readOnly={!editable}
          onChange={(e) => ydoc.getMap('meta').set('title', e.target.value)} />
        {!editable && <span className="badge">צפייה בלבד</span>}
        <span className={'conn ' + status} />
        <div className="peers">
          {peers.slice(0, 8).map((p, i) => (
            <span key={i} className="peer" style={{ background: p.user.color }} title={p.user.name}>{p.user.name[0]}</span>
          ))}
        </div>
        <div className="actions">
          <button className="btn" onClick={fitAll}>הצג הכל</button>
          {editable && <>
            <button className="btn" onClick={() => fileRef.current.click()}>טעינה</button>
            <input ref={fileRef} type="file" accept=".txt" hidden onChange={importTxt} />
          </>}
          <button className="btn" onClick={exportTxt}>הורדה</button>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>
      {editable && (
        <div className="toolbar board-bar">
          <button className="btn" onClick={() => {
            const r = wrapRef.current.getBoundingClientRect();
            addNote((r.width / 2 - view.x) / view.s, (r.height / 2 - view.y) / view.s);
          }}>+ פתק</button>
          <span className="sep" />
          {Object.entries(PASTELS).map(([name, hex]) => (
            <button key={hex} title={name} className={'swatch-sm' + (lastColor === hex && (!sel || sel.kind !== 'note') ? ' sel' : '')}
              style={{ background: hex }}
              onClick={() => { setLastColor(hex); if (sel?.kind === 'note') notes.get(sel.id)?.set('color', hex); }} />
          ))}
          {sel && <><span className="sep" /><button className="tb" title="מחיקה" onClick={deleteSel}>🗑</button></>}
          <span className="hint" style={{ marginInlineStart: 'auto' }}>לחיצה כפולה — פתק · לחיצה על פתק נבחר — עריכה · גרירה מנקודת עיגון — חיבור</span>
        </div>
      )}
      <div ref={wrapRef} className="board-wrap" onPointerDown={downBg} onPointerMove={move} onPointerUp={up}
        onDoubleClick={(e) => { if (editable && e.target === e.currentTarget) { const p = toWorld(e); addNote(p.x, p.y); } }}>
        <div className="board-layer" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.s})` }}>
          <svg className="edge-svg">
            {[...edges.entries()].map(([id, e]) => {
              const a = center(e.a), b = center(e.b);
              if (!a || !b) return null;
              return (
                <g key={id} onClick={(ev) => { ev.stopPropagation(); editable && setSel({ kind: 'edge', id }); }}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={'edge' + (sel?.kind === 'edge' && sel.id === id ? ' sel' : '')} />
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="edge-hit" />
                </g>
              );
            })}
            {connect && center(connect.from) && (
              <line x1={center(connect.from).x} y1={center(connect.from).y} x2={connect.x} y2={connect.y} className="edge temp" />
            )}
          </svg>
          {[...notes.entries()].map(([id, n]) => (
            <div key={id} data-note={id}
              className={'note' + (sel?.kind === 'note' && sel.id === id ? ' sel' : '') + (editing === id ? ' editing' : '')}
              style={{
                left: n.get('x'), top: n.get('y'), width: n.get('w'), height: n.get('h'),
                background: n.get('color'), transform: `rotate(${n.get('rot')}deg)`, zIndex: n.get('z'),
              }}
              onPointerDown={(e) => downNote(e, id)}
              onDoubleClick={(e) => { e.stopPropagation(); editable && setEditing(id); }}>
              {editing === id ? (
                <div className="note-edit" onPointerDown={(e) => e.stopPropagation()}>
                  <input className="note-title-in" autoFocus placeholder="כותרת" defaultValue={n.get('title')}
                    onInput={(e) => n.set('title', e.target.value)} onBlur={closeEditIfLeft}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); if (e.key === 'Enter') e.currentTarget.nextElementSibling?.focus(); }} />
                  <textarea placeholder="כותבים כאן…" defaultValue={n.get('text')}
                    onInput={(e) => n.set('text', e.target.value)} onBlur={closeEditIfLeft}
                    onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} />
                </div>
              ) : (
                <div className="note-body">
                  {n.get('title') && <div className="note-title">{n.get('title')}</div>}
                  <div className="note-text">{n.get('text')}</div>
                </div>
              )}
              {editable && editing !== id && sel?.kind === 'note' && sel.id === id && (
                <span className="note-actions" onPointerDown={(e) => e.stopPropagation()}>
                  <button title="עריכה" onClick={() => setEditing(id)}>✏️</button>
                  <button title="מחיקה" onClick={deleteSel}>🗑</button>
                </span>
              )}
              {editable && editing !== id && <>
                {['t', 'b', 'l', 'r'].map((side) => (
                  <span key={side} className={'anchor a-' + side} onPointerDown={(e) => downAnchor(e, id)} />
                ))}
                <span className="resizer" onPointerDown={(e) => downResize(e, id)} />
              </>}
            </div>
          ))}
          {peers.filter((p) => p.cursor).map((p, i) => (
            <div key={i} className="peer-cursor" style={{ left: p.cursor.x, top: p.cursor.y, transform: `scale(${1 / view.s})` }}>
              <span className="dot" style={{ background: p.user.color }} />
              <span className="name" style={{ background: p.user.color }}>{p.user.name}</span>
            </div>
          ))}
        </div>
        <div className="zoom-badge">{Math.round(view.s * 100)}%</div>
      </div>
    </div>
  );
}
