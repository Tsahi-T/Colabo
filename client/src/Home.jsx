import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getRecents } from './identity.js';
import { ThemeToggle } from './theme.jsx';
import { Logo, IconDoc, IconBoard, IconTimeline, IconRisk, IconSwot, IconChat, IconTasks, IconSun, IconProject } from './icons.jsx';

const TYPE_ICON = {
  doc: <span className="ricon doc"><IconDoc /></span>,
  board: <span className="ricon board"><IconBoard /></span>,
  timeline: <span className="ricon timeline"><IconTimeline /></span>,
  risks: <span className="ricon risks"><IconRisk /></span>,
  swot: <span className="ricon swot"><IconSwot /></span>,
  chat: <span className="ricon chat"><IconChat /></span>,
  tasks: <span className="ricon tasks"><IconTasks /></span>,
  sun: <span className="ricon sun"><IconSun /></span>,
  project: <span className="ricon project"><IconProject /></span>,
};

const GROUPS = [
  {
    name: 'יום־יומי',
    tools: [
      { type: 'doc', cls: 'doc', icon: <IconDoc />, name: 'מסמך', desc: 'מעבד תמלילים משותף' },
      { type: 'chat', cls: 'chat', icon: <IconChat />, name: "צ'אט", desc: 'התכתבות חיה עם כל מי שמחובר' },
      { type: 'tasks', cls: 'tasks', icon: <IconTasks />, name: 'ניהול משימות', desc: 'מי אחראי, מה תקוע, מה באיחור' },
    ],
  },
  {
    name: 'ניהול',
    tools: [
      { type: 'risks', cls: 'risks', icon: <IconRisk />, name: 'ניהול סיכונים', desc: 'טבלה ומטריצת חומרה/הסתברות' },
      { type: 'timeline', cls: 'timeline', icon: <IconTimeline />, name: 'ציר זמן', desc: 'אבני דרך על ציר תאריכים' },
      { type: 'project', cls: 'project', icon: <IconProject />, name: 'ניהול פרויקט', desc: 'מטרה, תכולה, בעלי עניין ומדדים' },
    ],
  },
  {
    name: 'ארגוני',
    tools: [
      { type: 'board', cls: 'board', icon: <IconBoard />, name: 'לוח חשיבה', desc: 'פתקים על קנבס משותף' },
      { type: 'swot', cls: 'swot', icon: <IconSwot />, name: 'ניתוח SWOT', desc: 'חוזקות, חולשות, הזדמנויות, איומים' },
      { type: 'sun', cls: 'sun', icon: <IconSun />, name: 'תרשים שמש', desc: 'נושא מרכזי ומילים סביבו' },
    ],
  },
];

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
      <div className="hero"><Logo size={58} /><h1 className="logo">טורבו</h1></div>
      <p className="tagline">עבודה משותפת בזמן אמת — פותחים, משתפים קישור, עובדים יחד.</p>
      <p className="home-note">
        המערכת מיועדת לעבודה משותפת בזמן אמת — מסמך שאין בו פעילות 30 יום נמחק אוטומטית.
        מומלץ לייצא ולשמור עותק מקומי של תוכן חשוב; ניתן בכל עת לטעון קובץ ולהמשיך לעבוד.{' '}
        <Link to="/about">פרטים נוספים</Link>
      </p>
      {GROUPS.map((g) => (
        <section key={g.name} className="create-group">
          <h2 className="group-title"><span>{g.name}</span></h2>
          <div className="create-row">
            {g.tools.map((t) => (
              <button key={t.type} className="create-card" onClick={() => createDoc(t.type)} disabled={busy}>
                <span className={'ico ' + t.cls}>{t.icon}</span>{t.name}<small>{t.desc}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
      {recents.length > 0 && (
        <div className="recents">
          <h2>מסמכים אחרונים</h2>
          {recents.map((r) => (
            <a key={r.token} href={`/d/${r.token}`} className="recent-item">
              <span className="recent-title">{TYPE_ICON[r.type] || TYPE_ICON.doc} {r.title}</span>
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
