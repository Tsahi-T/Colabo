import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getRecents } from './identity.js';
import { ThemeToggle } from './theme.jsx';

const TYPE_ICON = { doc: '📄', board: '🗒️', timeline: '📅' };

export default function Home() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const recents = getRecents();

  async function createDoc(type) {
    setBusy(true);
    const res = await fetch('/api/docs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }),
    });
    const { editToken } = await res.json();
    nav(`/d/${editToken}`);
  }

  return (
    <div className="home">
      <span className="home-theme"><ThemeToggle /></span>
      <h1 className="logo">COLABO<span>📝</span></h1>
      <p className="tagline">עבודה משותפת בזמן אמת — פותחים, משתפים קישור, עובדים יחד.</p>
      <div className="create-row">
        <button className="create-card" onClick={() => createDoc('doc')} disabled={busy}>
          <span className="ico">📄</span>מסמך<small>מעבד תמלילים משותף</small>
        </button>
        <button className="create-card" onClick={() => createDoc('board')} disabled={busy}>
          <span className="ico">🗒️</span>לוח חשיבה<small>פתקים על קנבס משותף</small>
        </button>
        <button className="create-card" onClick={() => createDoc('timeline')} disabled={busy}>
          <span className="ico">📅</span>ציר זמן<small>אבני דרך על ציר תאריכים</small>
        </button>
      </div>
      {recents.length > 0 && (
        <div className="recents">
          <h2>מסמכים אחרונים</h2>
          {recents.map((r) => (
            <a key={r.token} href={`/d/${r.token}`} className="recent-item">
              <span className="recent-title">{TYPE_ICON[r.type] || '📄'} {r.title}</span>
              <span className="recent-meta">
                {r.mode === 'view' ? 'צפייה בלבד · ' : ''}
                {new Date(r.at).toLocaleDateString('he-IL')}
              </span>
            </a>
          ))}
        </div>
      )}
      <p className="home-foot"><Link to="/about">אודות המערכת · הוראות שימוש · נתוני שימוש</Link></p>
    </div>
  );
}
