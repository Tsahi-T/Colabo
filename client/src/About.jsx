import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from './theme.jsx';
import { Logo, IconDoc, IconBoard, IconTimeline, IconRisk, IconSwot, IconChat, IconTasks, IconSun, IconProject } from './icons.jsx';

const RANGES = { week: { days: 7, label: 'שבוע' }, month: { days: 30, label: 'חודש' }, year: { days: 365, label: 'שנה' } };
const fmtDay = (iso) => new Date(iso + 'T00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });

const TOOLS = [
  { type: 'doc', icon: <IconDoc />, cls: 'doc', name: 'מסמך', desc: 'מעבד תמלילים משותף — עיצוב מלא, כותרות, טבלאות ותמונות.' },
  { type: 'board', icon: <IconBoard />, cls: 'board', name: 'לוח חשיבה', desc: 'פתקים צבעוניים על קנבס אינסופי, עם קווי קשר וגרירה חופשית.' },
  { type: 'timeline', icon: <IconTimeline />, cls: 'timeline', name: 'ציר זמן', desc: 'אבני דרך על ציר תאריכים יחסי — לתכנון וסקירה.' },
  { type: 'risks', icon: <IconRisk />, cls: 'risks', name: 'ניהול סיכונים', desc: 'טבלת סיכונים ומטריצת חומרה × הסתברות שנצבעת מעצמה.' },
  { type: 'swot', icon: <IconSwot />, cls: 'swot', name: 'ניתוח SWOT', desc: 'ארבעה רבעים — חוזקות, חולשות, הזדמנויות ואיומים.' },
  { type: 'tasks', icon: <IconTasks />, cls: 'tasks', name: 'ניהול משימות', desc: 'לוח קנבן וטבלה — אחראי, יעדים, עדיפות ומעקב איחורים.' },
  { type: 'sun', icon: <IconSun />, cls: 'sun', name: 'תרשים שמש', desc: 'נושא מרכזי ומילים סביבו — אסוציאציות, שותפים ומחשבות.' },
  { type: 'project', icon: <IconProject />, cls: 'project', name: 'ניהול פרויקטים', desc: 'כרטיס פרויקט — מטרה, תכולה, בעלי עניין, אבני דרך ומדדים.' },
  { type: 'chat', icon: <IconChat />, cls: 'chat', name: 'צ\'אט', desc: 'התכתבות חיה עם כל מי שמחובר, כולל תגובות וסימון "מקליד".' },
];

const IO = [
  { name: 'מסמך', out: 'Word · PDF · HTML', in: 'Word · HTML · טקסט' },
  { name: 'ניהול משימות', out: 'Excel (CSV)', in: 'Excel (CSV)' },
  { name: 'ציר זמן · סיכונים · SWOT · תרשים שמש · פרויקט', out: 'PDF · TXT', in: 'TXT' },
  { name: 'לוח חשיבה', out: 'TXT', in: 'TXT' },
  { name: 'צ\'אט', out: 'TXT', in: '—' },
];

// Two-series area chart (SVG, self-contained, hover crosshair + tooltip).
// series: [{ key, label, daily }] — the first one is drawn filled, as the primary.
function UsageChart({ series, days }) {
  const [hover, setHover] = useState(null);
  const W = 720, H = 220, PAD = { t: 14, r: 14, b: 26, l: 34 };
  const axis = useMemo(() => {
    const out = [];
    for (let i = days - 1; i >= 0; i--) out.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
    return out;
  }, [days]);
  const sets = useMemo(() => series.map((s) => {
    const byDay = Object.fromEntries((s.daily || []).map((d) => [d.day, d.count]));
    return { ...s, data: axis.map((day) => byDay[day] || 0) };
  }), [series, axis]);
  const max = Math.max(4, ...sets.flatMap((s) => s.data));
  const x = (i) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, axis.length - 1);
  const y = (v) => H - PAD.b - (v * (H - PAD.t - PAD.b)) / max;
  const pts = (data) => data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const ticksY = [0, Math.round(max / 2), max];
  const tickEvery = Math.ceil(axis.length / 6);
  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (axis.length - 1));
    setHover(i >= 0 && i < axis.length ? i : null);
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
        {axis.map((day, i) => i % tickEvery === 0 && (
          <text key={day} x={x(i)} y={H - 8} className="tick" textAnchor="middle">{fmtDay(day)}</text>
        ))}
        {sets.map((s, si) => (
          <g key={s.key}>
            {si === 0 && <polygon points={`${PAD.l},${y(0)} ${pts(s.data)} ${x(axis.length - 1)},${y(0)}`} className="area" />}
            <polyline points={pts(s.data)} className={'line s-' + s.key} />
          </g>
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="crosshair" />
            {sets.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.data[hover])} r="4.5" className={'dot s-' + s.key} />)}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ insetInlineStart: `${(x(hover) / W) * 100}%` }} dir="rtl">
          {fmtDay(axis[hover])}
          {sets.map((s) => <span key={s.key} className="tip-row"><i className={'s-' + s.key} /><b>{s.data[hover]}</b> {s.label}</span>)}
        </div>
      )}
    </div>
  );
}

// Per-tool open counts, as a leaderboard of bars scaled to the busiest tool.
function OpensBreakdown({ opens }) {
  const byType = Object.fromEntries((opens || []).map((o) => [o.type, o.count]));
  const total = (opens || []).reduce((a, o) => a + o.count, 0);
  const rows = TOOLS.map((t) => ({ ...t, count: byType[t.type] || 0 })).sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!total) return <p className="ab-fine">עוד לא נפתחו מסכים מאז שהמונה הופעל.</p>;
  return (
    <div className="ab-brk">
      {rows.map((r) => (
        <div key={r.type} className={'brk-row brk-' + r.cls}>
          <span className={'ico ' + r.cls}>{r.icon}</span>
          <div className="brk-main">
            <div className="brk-head">
              <b>{r.name}</b>
              <span className="brk-n">{r.count.toLocaleString('he-IL')}<small>({total ? Math.round((r.count / total) * 100) : 0}%)</small></span>
            </div>
            <div className="brk-bar"><i style={{ width: `${(r.count / max) * 100}%` }} /></div>
          </div>
        </div>
      ))}
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
                <div className="stat-tile"><span className="stat-num">{(stats.total || 0).toLocaleString('he-IL')}</span>משתמשים ייחודיים</div>
                <div className="stat-tile"><span className="stat-num live">{stats.online || 0}<i /></span>מחוברים עכשיו</div>
                <div className="stat-tile"><span className="stat-num">{(stats.visitsTotal || 0).toLocaleString('he-IL')}</span>סה״כ כניסות לאתר</div>
                <div className="stat-tile">
                  <span className="stat-num">{(stats.opens || []).reduce((a, o) => a + o.count, 0).toLocaleString('he-IL')}</span>
                  סה״כ פתיחות מסכים
                </div>
              </div>
              <div className="chart-head">
                <h3>פעילות יומית</h3>
                <div className="range-btns">
                  {Object.entries(RANGES).map(([k, r]) => (
                    <button key={k} className={range === k ? 'act' : ''} onClick={() => setRange(k)}>{r.label}</button>
                  ))}
                </div>
              </div>
              <UsageChart days={RANGES[range].days} series={[
                { key: 'users', label: 'משתמשים ייחודיים', daily: stats.daily },
                { key: 'visits', label: 'כניסות', daily: stats.visitsDaily },
              ]} />
              <div className="chart-legend">
                <span><i className="s-users" />משתמשים ייחודיים</span>
                <span><i className="s-visits" />כניסות</span>
              </div>

              <div className="chart-head"><h3>פילוח פתיחות מסכים לפי כלי</h3></div>
              <OpensBreakdown opens={stats.opens} />

              <p className="ab-fine">
                הספירה אנונימית לחלוטין — לפי דפדפן ייחודי, בלי חשבונות ובלי מידע מזהה.
                המונים נספרים מרגע הפעלתם, כך שנתוני עבר שקדמו להם אינם מופיעים כאן.
              </p>
            </>
          )}
        </section>

        <footer className="about-foot"><Link to="/">← חזרה לדף הבית</Link></footer>
      </main>
    </div>
  );
}
