import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ShareMenu, Menu } from './ShareExport.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import { touchRecent, bumpDownload, bumpReimport } from './identity.js';
import { printElementImage } from './imageExport.js';

const uid = () => crypto.randomUUID().slice(0, 8);
const GOLDEN_ANGLE = (137.508 * Math.PI) / 180;
const download = (text, name, mime = 'text/plain;charset=utf-8') => {
  bumpDownload();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

// Font shrinks as the text grows, so a whole sentence still fits inside the node
// instead of being clipped. Values are rem.
const coreFont = (t) => { const n = (t || '').length; return n <= 14 ? 1.3 : n <= 30 ? 1.1 : n <= 60 ? .95 : n <= 110 ? .84 : .76; };
const petalFont = (t) => { const n = (t || '').length; return n <= 16 ? .95 : n <= 40 ? .87 : n <= 80 ? .8 : .74; };

// Auto-growing textarea: height follows the content so nothing is ever cut off.
// Module scope on purpose — an inline component would remount and drop focus per keystroke.
function AutoText({ value, onChange, placeholder, className }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return <textarea ref={ref} className={className} rows={1} value={value} placeholder={placeholder} onChange={onChange} />;
}

// Golden-angle spiral (elliptical to use wide screens) — evenly spreads nodes
// around the center, growing outward as the network gets denser. Ported from Socio.
function layoutNodes(count, w, h) {
  const cx = w / 2, cy = h / 2;
  const rMinX = Math.min(180, w / 2 - 90), rMinY = 130;
  const rMaxX = Math.max(w / 2 - 100, rMinX + 30), rMaxY = Math.max(h / 2 - 50, rMinY + 20);
  return Array.from({ length: count }, (_, i) => {
    const spread = count > 1 ? Math.pow(i / (count - 1), 0.65) : 0;
    const angle = -Math.PI / 2 + i * GOLDEN_ANGLE;
    return {
      x: cx + Math.cos(angle) * (rMinX + (rMaxX - rMinX) * spread),
      y: cy + Math.sin(angle) * (rMinY + (rMaxY - rMinY) * spread),
    };
  });
}

export default function Sun({ info, user, token }) {
  const editable = info.mode === 'edit';
  const [, force] = useReducer((c) => c + 1, 0);
  const [status, setStatus] = useState('connecting');
  const [title, setTitle] = useState('');
  const [peers, setPeers] = useState([]);
  const [size, setSize] = useState({ width: 900, height: 560 });
  const stageRef = useRef();
  const fileRef = useRef();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const nodes = ydoc.getMap('nodes');
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

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // Measure synchronously on mount so the layout is centred immediately — don't wait
    // for the first ResizeObserver tick (which can be delayed or, in some embedded
    // browsers, not fire at all), which would leave the diagram stuck at its seed size.
    const measure = () => el.clientWidth && setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { touchRecent(token, title, info.mode, 'sun'); }, [title]);

  const core = meta.get('core') || '';
  const petals = [...nodes.entries()]
    .map(([id, n]) => ({ id, text: n.get('text') || '', ord: n.get('ord') || 0 }))
    .sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id));

  const cx = size.width / 2, cy = size.height / 2;
  const positions = useMemo(() => layoutNodes(petals.length, size.width, size.height), [petals.length, size.width, size.height]);

  function addPetal(text = '') {
    const id = uid(), n = new Y.Map();
    ydoc.transact(() => { n.set('text', text); n.set('ord', Math.max(0, ...petals.map((p) => p.ord)) + 1); nodes.set(id, n); });
  }
  const setPetal = (id, text) => nodes.get(id)?.set('text', text);
  const delPetal = (id) => nodes.delete(id);

  const exportTxt = () => download(
    `תרשים שמש: ${(core || title || 'ללא שם').replace(/\n/g, ' ')}\n\n` +
    petals.map((p) => `- ${p.text.replace(/\n/g, ' ')}`).join('\n') + '\n',
    `${title || 'תרשים שמש'}.txt`);
  const exportPdf = () => printElementImage('.sun-stage', { title: title || 'תרשים שמש', landscape: true });
  async function importTxt(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    bumpReimport();
    const lines = (await f.text()).split(/\r?\n/);
    // accept both the current header and the older "שמש אסוציאציות" one
    const coreLine = lines.find((l) => /^(תרשים שמש|שמש אסוציאציות):/.test(l));
    const items = lines.map((l) => l.match(/^\s*[-*]\s*(.+)/)).filter(Boolean).map((m) => m[1]);
    if (!items.length && !coreLine) return alert('לא נמצא תוכן בקובץ');
    if ((nodes.size || core) && !confirm('הטעינה תחליף את התוכן הנוכחי. להמשיך?')) return;
    ydoc.transact(() => {
      if (coreLine) meta.set('core', coreLine.replace(/^(תרשים שמש|שמש אסוציאציות):\s*/, '').trim());
      [...nodes.keys()].forEach((k) => nodes.delete(k));
      items.forEach((text, i) => { const nn = new Y.Map(); nn.set('text', text); nn.set('ord', i + 1); nodes.set(uid(), nn); });
    });
  }

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm" title="חזרה לדף הבית"><Logo size={22} /><span className="logo-word">טורבו</span></Link>
        <input className="title-input" title={title || undefined} placeholder="תרשים שמש ללא שם" value={title} readOnly={!editable}
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
            <button onClick={exportTxt}>TXT - לטעינה חוזרת</button>
          </Menu>
          <ShareMenu info={info} />
          <ThemeToggle />
        </div>
      </header>
      {editable && (
        <div className="toolbar board-bar">
          <button className="btn-primary" onClick={() => addPetal()}>+ הוספה</button>
          {petals.length > 0 && <span className="sun-count">{petals.length === 1 ? 'פריט אחד' : `${petals.length} פריטים`}</span>}
          <span className="hint" style={{ marginInlineStart: 'auto' }}>תרשים שמש לפיתוח חשיבה - אסוציאציות, שותפים, מחשבות</span>
        </div>
      )}
      <div className="sun-wrap">
        <div className="sun-stage" ref={stageRef}>
          <svg className="sun-net" width={size.width} height={size.height} aria-hidden="true">
            {petals.map((p, i) => {
              const pos = positions[i];
              return pos && <line key={p.id} className="sna-line" x1={cx} y1={cy} x2={pos.x} y2={pos.y} />;
            })}
          </svg>

          <div className="sun-core-wrap" style={{ left: cx, top: cy }}>
            <span className="sun-halo" aria-hidden="true" />
            <div className="sun-core" style={{ fontSize: coreFont(core) + 'rem' }}>
              {editable
                ? <AutoText value={core} placeholder="הנושא המרכזי" onChange={(e) => meta.set('core', e.target.value)} />
                : (core || <span className="sun-ph">הנושא המרכזי</span>)}
            </div>
          </div>

          {petals.map((p, i) => {
            const pos = positions[i];
            if (!pos) return null;
            return (
              <div key={p.id} className="sun-petal" style={{ left: pos.x, top: pos.y, fontSize: petalFont(p.text) + 'rem' }}>
                {editable ? (
                  <>
                    <AutoText value={p.text} placeholder="כתוב כאן" onChange={(e) => setPetal(p.id, e.target.value)} />
                    <button className="sun-petal-del" title="מחיקה" onClick={() => delPetal(p.id)}>✕</button>
                  </>
                ) : (
                  <span className="sun-petal-text">{p.text || '-'}</span>
                )}
              </div>
            );
          })}

          {!petals.length && !core && (
            <div className="sun-empty">{editable ? 'מתחילים מהנושא המרכזי, ומוסיפים סביבו ☀️' : 'התרשים ריק עדיין'}</div>
          )}
        </div>
      </div>
    </div>
  );
}
