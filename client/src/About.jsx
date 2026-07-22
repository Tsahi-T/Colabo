import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from './theme.jsx';
import { Logo, IconDoc, IconBoard, IconTimeline, IconRisk, IconSwot, IconChat, IconTasks, IconSun, IconProject } from './icons.jsx';

const RANGES = { week: { days: 7, label: 'שבוע' }, month: { days: 30, label: 'חודש' }, year: { days: 365, label: 'שנה' } };
const fmtDay = (iso) => new Date(iso + 'T00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });

const TOOLS = [
  { icon: <IconDoc />, cls: 'doc', name: 'מסמך', desc: 'מעבד תמלילים משותף — עיצוב מלא, כותרות, טבלאות ותמונות.' },
  { icon: <IconBoard />, cls: 'board', name: 'לוח חשיבה', desc: 'פתקים צבעוניים על קנבס אינסופי, עם קווי קשר וגרירה חופשית.' },
  { icon: <IconTimeline />, cls: 'timeline', name: 'ציר זמן', desc: 'אבני דרך על ציר תאריכים יחסי — לתכנון וסקירה.' },
  { icon: <IconRisk />, cls: 'risks', name: 'ניהול סיכונים', desc: 'טבלת סיכונים ומטריצת חומרה × הסתברות שנצבעת מעצמה.' },
  { icon: <IconSwot />, cls: 'swot', name: 'ניתוח SWOT', desc: 'ארבעה רבעים — חוזקות, חולשות, הזדמנויות ואיומים.' },
  { icon: <IconTasks />, cls: 'tasks', name: 'ניהול משימות', desc: 'לוח קנבן וטבלה — אחראי, יעדים, עדיפות ומעקב איחורים.' },
  { icon: <IconSun />, cls: 'sun', name: 'תרשים שמש', desc: 'נושא מרכזי ומילים סביבו — אסוציאציות, שותפים ומחשבות.' },
  { icon: <IconProject />, cls: 'project', name: 'ניהול פרויקטים', desc: 'כרטיס פרויקט — מטרה, תכולה, בעלי עניין, אבני דרך ומדדים.' },
  { icon: <IconChat />, cls: 'chat', name: 'צ\'אט', desc: 'התכתבות חיה עם כל מי שמחובר, כולל תגובות וסימון "מקליד".' },
];

const IO = [
  { name: 'מסמך', out: 'Word · PDF · HTML', in: 'Word · HTML · טקסט' },
  { name: 'ניהול משימות', out: 'Excel (CSV)', in: 'Excel (CSV)' },
  { name: 'ציר זמן · סיכונים · SWOT · תרשים שמש · פרויקט', out: 'PDF · TXT', in: 'TXT' },
  { name: 'לוח חשיבה', out: 'TXT', in: 'TXT' },
  { name: 'צ\'אט', out: 'TXT', in: '—' },
];

// Single-series area chart (SVG, self-contained, hover crosshair + tooltip).
function UsageChart({ daily, days }) {
  const [hover, setHover] = useState(null);
  const W = 720, H = 220, PAD = { t: 14, r: 14, b: 26, l: 34 };
  const data = useMemo(() => {
    const byDay = Object.fromEntries(daily.map((d) => [d.day, d.count]));
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      out.push({ day: d, count: byDay[d] || 0 });
    }
    return out;
  }, [daily, days]);
  const max = Math.max(4, ...data.map((d) => d.count));
  const x = (i) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, data.length - 1);
  const y = (v) => H - PAD.b - (v * (H - PAD.t - PAD.b)) / max;
  const line = data.map((d, i) => `${x(i)},${y(d.count)}`).join(' ');
  const ticksY = [0, Math.round(max / 2), max];
  const tickEvery = Math.ceil(data.length / 6);
  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (data.length - 1));
    setHover(i >= 0 && i < data.length ? i : null);
  }
  return (
    <div className="chart-box" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.l - 6} y={y(t) + 3} className="tick" textAnchor="end">{t}</text>
          </g>
        ))}
        {data.map((d, i) => i % tickEvery === 0 && (
          <text key={d.day} x={x(i)} y={H - 8} className="tick" textAnchor="middle">{fmtDay(d.day)}</text>
        ))}
        <polygon points={`${PAD.l},${y(0)} ${line} ${x(data.length - 1)},${y(0)}`} className="area" />
        <polyline points={line} className="line" />
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="crosshair" />
            <circle cx={x(hover)} cy={y(data[hover].count)} r="5" className="dot" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ insetInlineStart: `${(x(hover) / W) * 100}%` }} dir="rtl">
          <b>{data[hover].count}</b> משתמשים · {fmtDay(data[hover].day)}
        </div>
      )}
    </div>
  );
}

export default function About() {
  const [stats, setStats] = useState(null);
  const [range, setRange] = useState('month');

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then(setStats).catch(() => setStats({ error: true }));
  }, []);

  return (
    <div className="about">
      <header className="topbar">
        <Link to="/" className="logo-sm"><Logo size={24} /></Link>
        <b style={{ flex: 1 }}>אודות טורבו</b>
        <ThemeToggle />
      </header>
      <main className="about-main">

        <section className="ab-hero">
          <Logo size={64} />
          <h1>סביבת עבודה משותפת, בזמן אמת</h1>
          <p className="ab-lead">
            טורבו היא סביבה פנים-ארגונית שבה צוות עובד יחד על אותו תוכן בו-זמנית — מסמכים, לוחות,
            תרשימים ומעקבים — בלי לשלוח קבצים הלוך ושוב וגרסאות מתנגשות. פותחים כלי, משתפים קישור, וכל
            מי שנכנס רואה ועורך את אותו הדבר, ברגע זה ממש.
          </p>
        </section>

        <section>
          <h2>שלושה צעדים</h2>
          <div className="ab-steps">
            <div className="ab-step"><span className="ab-num">1</span><b>יוצרים</b><p>בדף הבית בוחרים את סוג הכלי. נפתח מיד, בלי הרשמה, והכל נשמר אוטומטית — אין כפתור שמירה.</p></div>
            <div className="ab-step"><span className="ab-num">2</span><b>משתפים</b><p>בתפריט "שיתוף" מעתיקים <b>קישור עריכה</b> או <b>קישור לצפייה בלבד</b>. מי שנכנס בוחר שם וצבע, ורואים אותו חי על המסך.</p></div>
            <div className="ab-step"><span className="ab-num">3</span><b>עובדים יחד</b><p>הקלדות, גרירות ושינויים של כולם מופיעים מיד אצל כל המשתתפים, כולל סמן חי ורשימת מי מחובר.</p></div>
          </div>
        </section>

        <section>
          <h2>הכלים שבמערכת</h2>
          <div className="ab-tools">
            {TOOLS.map((t) => (
              <div key={t.name} className="ab-tool">
                <span className={'ico ' + t.cls}>{t.icon}</span>
                <div><b>{t.name}</b><p>{t.desc}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>ייצוא וטעינה של קבצים</h2>
          <p className="ab-note">
            כל כלי מאפשר לשמור עותק מקומי דרך תפריט <b>הורדה</b>, ולטעון חזרה קובץ קיים דרך כפתור <b>טעינה</b>.
            הפורמטים נבחרו כדי להשתלב עם התוכנות שאתם כבר עובדים איתן: מסמכים ל-Word, משימות ל-Excel, ושאר הכלים לקובצי PDF להצגה ולקובצי טקסט לעבודה.
          </p>
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead><tr><th>כלי</th><th>ייצוא (הורדה)</th><th>טעינה חוזרת</th></tr></thead>
              <tbody>
                {IO.map((r) => (
                  <tr key={r.name}><td>{r.name}</td><td>{r.out}</td><td>{r.in}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="ab-points">
            <li><b>PDF הוא לייצוא בלבד</b> — הוא נועד להצגה, צילום מסך והדבקה במצגת, ואי אפשר לטעון אותו חזרה.</li>
            <li><b>טעינה חוזרת אפשרית רק מקובץ שיוצא מהמערכת</b> (TXT או CSV, לפי הכלי) — כדי שהמבנה יישמר במדויק.</li>
            <li>קובצי ה-TXT קריאים גם כטקסט רגיל, וה-CSV נפתח ונערך ישירות ב-Excel וחוזר פנימה.</li>
          </ul>
        </section>

        <section className="disclaimer">
          <h2>⚠️ תיאום ציפיות ותנאי שימוש</h2>
          <p>
            טורבו היא כלי לעבודה משותפת <b>בזמן אמת</b> — לחשיבה, טיוטה וכתיבה משותפת, ולא ארכיון או מאגר רשומות מחייב.
            <b> מסמך שאין בו שום עריכה במשך 30 יום נמחק אוטומטית</b>, לצמיתות ובלי שחזור (לוחות ניהול משימות פטורים ממחיקה זו).
            כל מי שמחזיק קישור עריכה יכול לשנות או למחוק תוכן בכל עת.
            <b> רשימת "מסמכים אחרונים" בדף הבית נשמרת רק בדפדפן המקומי שלכם ולא עוברת בין מחשבים</b> — המסמך עצמו כן
            שמור בשרת וזמין מכל מחשב, אך רק דרך הקישור עצמו (עריכה או צפייה) ובתוך חלון 30 הימים. לכן חשוב לשמור את
            הקישור בעצמו במקום נגיש (למשל בהודעה או במסמך חיצוני) ולא להסתמך על רשימת הקיצורים בלבד, ו<b>תוכן חשוב יש
            לייצא ולשמור עותק מחוץ למערכת</b>, וניתן תמיד לטעון אותו חזרה ולהמשיך. השימוש באחריות המשתמש בלבד, והמערכת
            מסופקת כפי שהיא (As-Is) ללא כל אחריות לזמינות, לשלמות המידע או לנזק הנובע מהשימוש.
          </p>
        </section>

        <section>
          <h2>נתוני שימוש</h2>
          {!stats ? <p>טוען…</p> : stats.error ? <p>הנתונים אינם זמינים כרגע.</p> : (
            <>
              <div className="stat-row">
                <div className="stat-tile"><span className="stat-num">{stats.total.toLocaleString('he-IL')}</span>משתמשים עד היום</div>
                <div className="stat-tile"><span className="stat-num live">{stats.online}<i /></span>מחוברים עכשיו</div>
              </div>
              <div className="chart-head">
                <h3>משתמשים פעילים ביום</h3>
                <div className="range-btns">
                  {Object.entries(RANGES).map(([k, r]) => (
                    <button key={k} className={range === k ? 'act' : ''} onClick={() => setRange(k)}>{r.label}</button>
                  ))}
                </div>
              </div>
              <UsageChart daily={stats.daily} days={RANGES[range].days} />
              <p className="ab-fine">הספירה אנונימית לחלוטין — לפי דפדפן ייחודי, בלי חשבונות ובלי מידע מזהה.</p>
            </>
          )}
        </section>

        <footer className="about-foot"><Link to="/">← חזרה לדף הבית</Link></footer>
      </main>
    </div>
  );
}
