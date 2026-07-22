import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link_ from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { getIdentity, setIdentity, touchRecent, COLORS } from './identity.js';
import Board from './Board.jsx';
import Timeline from './Timeline.jsx';
import Risks from './Risks.jsx';
import SWOT from './SWOT.jsx';
import Chat from './Chat.jsx';
import Tasks from './Tasks.jsx';
import Sun from './Sun.jsx';
import Project from './Project.jsx';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';
import Toolbar from './Toolbar.jsx';
import ShareExport from './ShareExport.jsx';
import { uploadImage } from './images.js';

function IdentityModal({ onDone }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);
  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>מי את/ה?</h2>
        <p>השם והצבע יזהו אותך בפני שאר המשתתפים.</p>
        <input autoFocus placeholder="השם שלך" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onDone(name.trim(), color)} />
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} className={'swatch' + (c === color ? ' sel' : '')} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <button className="btn-primary" disabled={!name.trim()} onClick={() => onDone(name.trim(), color)}>להתחיל</button>
      </div>
    </div>
  );
}

function EditorView({ info, user, token }) {
  const [status, setStatus] = useState('connecting');
  const [peers, setPeers] = useState([]);
  const [title, setTitle] = useState('');
  const editable = info.mode === 'edit';

  const ydoc = useMemo(() => new Y.Doc(), []);
  const provider = useMemo(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return new HocuspocusProvider({
      url: `${proto}://${location.host}/collab`,
      name: info.docId,
      token,
      document: ydoc,
      onStatus: ({ status }) => setStatus(status),
    });
  }, []);

  // Shared title lives in the Y.Doc meta map; presence from awareness.
  useEffect(() => {
    const meta = ydoc.getMap('meta');
    const syncTitle = () => setTitle(meta.get('title') || '');
    meta.observe(syncTitle);
    syncTitle();
    const aw = provider.awareness;
    const syncPeers = () => setPeers([...aw.getStates().values()].map((s) => s.user).filter(Boolean));
    aw.on('change', syncPeers);
    return () => { meta.unobserve(syncTitle); aw.off('change', syncPeers); provider.destroy(); };
  }, []);

  useEffect(() => { touchRecent(token, title, info.mode); }, [title]);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({ history: false }),
      Underline, TextStyle, Color,
      Highlight.configure({ multicolor: true }),
      Link_.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: editable }), TableRow, TableCell, TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList, TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'מתחילים לכתוב כאן…' }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({ provider, user }),
    ],
    editorProps: {
      handlePaste: (view, e) => handleFiles(e.clipboardData?.files),
      handleDrop: (view, e) => handleFiles(e.dataTransfer?.files),
    },
  });

  function handleFiles(files) {
    const img = files && [...files].find((f) => f.type.startsWith('image/'));
    if (!img || !editable) return false;
    uploadImage(img, token).then((url) => url && editor.chain().focus().setImage({ src: url }).run());
    return true;
  }

  if (!editor) return <div className="center-msg">טוען…</div>;

  return (
    <div className="doc-page">
      <header className="topbar">
        <Link to="/" className="logo-sm"><Logo size={24} /></Link>
        <input className="title-input" placeholder="מסמך ללא שם" value={title} readOnly={!editable}
          onChange={(e) => ydoc.getMap('meta').set('title', e.target.value)} />
        {!editable && <span className="badge">צפייה בלבד</span>}
        <span className={'conn ' + status} title={status === 'connected' ? 'מחובר' : 'מתחבר…'} />
        <div className="peers">
          {peers.slice(0, 8).map((p, i) => (
            <span key={i} className="peer" style={{ background: p.color }} title={p.name}>{p.name[0]}</span>
          ))}
        </div>
        <ShareExport info={info} editor={editor} title={title} />
        <ThemeToggle />
      </header>
      {editable && <Toolbar editor={editor} token={token} />}
      <main className="editor-wrap"><EditorContent editor={editor} /></main>
    </div>
  );
}

export default function DocPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [user, setUser] = useState(getIdentity());

  useEffect(() => {
    // Clear immediately: without this, a client-side nav to a new token (e.g. the chat
    // sidebar) briefly re-renders the type screen with the OLD info tied to the NEW key,
    // and its Y.Doc/provider (memoized once) would stay wired to the wrong document forever.
    setInfo(null);
    setNotFound(false);
    fetch(`/api/docs/${token}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => {
      setInfo(d);
      // anonymous per-tool open counter (see /api/open)
      fetch('/api/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: d.type }) }).catch(() => {});
    }).catch(() => setNotFound(true));
  }, [token]);

  if (notFound) return <div className="center-msg"><h2>המסמך לא נמצא</h2><Link to="/">← לדף הבית</Link></div>;
  if (!user) return <IdentityModal onDone={(n, c) => { setIdentity(n, c); setUser({ name: n, color: c }); }} />;
  if (!info) return <div className="center-msg">טוען…</div>;
  // key={token}: forces a full remount on navigation between two documents of the same
  // type (e.g. the chat sidebar) — otherwise React reuses the instance and the Y.Doc/
  // WebSocket provider (created once via useMemo(..., [])) would keep pointing at the old doc.
  if (info.type === 'board') return <Board key={token} info={info} user={user} token={token} />;
  if (info.type === 'timeline') return <Timeline key={token} info={info} user={user} token={token} />;
  if (info.type === 'risks') return <Risks key={token} info={info} user={user} token={token} />;
  if (info.type === 'swot') return <SWOT key={token} info={info} user={user} token={token} />;
  if (info.type === 'chat') return <Chat key={token} info={info} user={user} token={token} />;
  if (info.type === 'tasks') return <Tasks key={token} info={info} user={user} token={token} />;
  if (info.type === 'sun') return <Sun key={token} info={info} user={user} token={token} />;
  if (info.type === 'project') return <Project key={token} info={info} user={user} token={token} />;
  return <EditorView key={token} info={info} user={user} token={token} />;
}
