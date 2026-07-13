import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRecents } from './identity.js';

export default function Home() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const recents = getRecents();

  async function createDoc() {
    setBusy(true);
    const res = await fetch('/api/docs', { method: 'POST' });
    const { editToken } = await res.json();
    nav(`/d/${editToken}`);
  }

  return (
    <div className="home">
      <h1 className="logo">COLABO<span>📝</span></h1>
      <p className="tagline">מעבד תמלילים שיתופי — פותחים מסמך, משתפים קישור, עובדים יחד.</p>
      <button className="btn-primary" onClick={createDoc} disabled={busy}>+ מסמך חדש</button>
      {recents.length > 0 && (
        <div className="recents">
          <h2>מסמכים אחרונים</h2>
          {recents.map((r) => (
            <a key={r.token} href={`/d/${r.token}`} className="recent-item">
              <span className="recent-title">{r.title}</span>
              <span className="recent-meta">
                {r.mode === 'view' ? 'צפייה בלבד · ' : ''}
                {new Date(r.at).toLocaleDateString('he-IL')}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
