import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getRecents } from './identity.js';
import { ThemeToggle } from './theme.jsx';
import {
  IconDoc, IconBoard, IconTimeline, IconRisk, IconSwot, IconChat, IconTasks, IconSun, IconProject, IconDebrief,
  IconTarget, IconFlag, IconCompass, IconGauge,
} from './icons.jsx';
import turboLogo from './assets/turbo-logo.png';

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
  debrief: <span className="ricon debrief"><IconDebrief /></span>,
  discussion: <span className="ricon discussion"><IconFlag /></span>,
  meeting1on1: <span className="ricon meeting1on1"><IconCompass /></span>,
  goals: <span className="ricon goals"><IconTarget /></span>,
  gauges: <span className="ricon gauges"><IconGauge /></span>,
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
      { type: 'project', cls: 'project', icon: <IconProject />, name: 'ניהול פרויקטים', desc: 'מטרה, תכולה, בעלי עניין ומדדים' },
      { type: 'goals', cls: 'goals', icon: <IconTarget />, name: 'בניית יעדים', desc: 'מטרות, יעדים מדידים ומשימות לעמידה בהם' },
      { type: 'gauges', cls: 'gauges', icon: <IconGauge />, name: 'דשבורד הערכת מצב', desc: 'שעוני מדידה - נושא, טווח ועמידה נוכחית' },
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
  {
    name: 'תבניות',
    tools: [
      { type: 'debrief', cls: 'debrief', icon: <IconDebrief />, name: 'תחקיר', desc: 'רקע, כרונולוגיה, ממצאים ולקחים' },
      { type: 'discussion', cls: 'discussion', icon: <IconFlag />, name: 'סיכום דיון', desc: 'סיכום, החלטות ומשתתפים' },
      { type: 'meeting1on1', cls: 'meeting1on1', icon: <IconCompass />, name: 'פגישה אישית', desc: 'רקע, דברי הפרט, יעדים ומשימות' },
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
      <div className="hero"><img src={turboLogo} alt="טורבו" className="hero-logo" /></div>
      <p className="tagline">עבודה משותפת בזמן אמת - פותחים, משתפים קישור, עובדים יחד.</p>
      <p className="home-note">
        המערכת מיועדת לעבודה משותפת בזמן אמת.<br />
        זו לא מערכת לניהול ידע, על כן המידע נמחק אחרי 30 ימים.<br />
        אופן השימוש הנכון במערכת - יצוא המידע לקבצים וטעינה מחדש אם נדרש.<br />
        <Link to="/about">פרטים ונתונים נוספים</Link>
      </p>
      {GROUPS.map((g) => (
        <section key={g.name} className="create-group">
          <h2 className="group-title"><span>{g.name}</span></h2>
          <div className="create-row">
            {g.tools.map((t) => (
              <button key={t.type} className={'create-card' + (t.soon ? ' soon' : '')}
                onClick={() => !t.soon && createDoc(t.type)} disabled={busy || t.soon}
                title={t.soon ? 'בקרוב' : undefined}>
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
