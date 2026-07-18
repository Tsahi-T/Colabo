import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from './theme.jsx';
import { Logo } from './icons.jsx';

const RANGES = { week: { days: 7, label: 'שבוע' }, month: { days: 30, label: 'חודש' }, year: { days: 365, label: 'שנה' } };
const fmtDay = (iso) => new Date(iso + 'T00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });

// Single-series area chart (SVG, self-contained, hover crosshair + tooltip).
function UsageChart({ daily, days }) {
  const [hover, setHover] = useState(null); // index
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
        <b style={{ flex: 1 }}>אודות COLABO</b>
        <ThemeToggle />
      </header>
      <main className="about-main">

        <section>
          <h1>עבודה משותפת, בזמן אמת</h1>
          <p>COLABO היא מערכת פנים-ארגונית לעבודה משותפת: מסמכים ולוחות חשיבה שכולם עורכים יחד, בו-זמנית, בלי לשלוח קבצים הלוך ושוב.</p>
        </section>

        <section>
          <h2>איך משתמשים</h2>
          <div className="how-grid">
            <div className="how-card"><span>📄</span><b>יוצרים</b>בדף הבית בוחרים מסמך או לוח חשיבה — ומתחילים לעבוד. הכל נשמר אוטומטית, אין כפתור שמירה.</div>
            <div className="how-card"><span>🔗</span><b>משתפים</b>בתפריט "שיתוף" מעתיקים קישור לעריכה או קישור לצפייה בלבד, ושולחים למי שרוצים. מי שנכנס בוחר שם וצבע — ורואים אותו חי.</div>
            <div className="how-card"><span>✍️</span><b>עורכים יחד</b>במסמך: עיצוב מלא, טבלאות ותמונות. בלוח: לחיצה כפולה יוצרת פתק, גוררים, מחברים בקווים.</div>
            <div className="how-card"><span>💾</span><b>מייצאים</b>בתפריט "הורדה": מסמך ל-Word / PDF / HTML, לוח לקובץ טקסט קריא. אפשר גם לטעון קבצים קיימים.</div>
          </div>
        </section>

        <section className="disclaimer">
          <h2>⚠️ הסתייגות ותנאי שימוש</h2>
          <p>COLABO היא כלי לעבודה משותפת <b>בזמן אמת</b> — היא נועדה לחשיבה, טיוט וכתיבה משותפים, ולא לשמש ארכיון או מאגר רשומות מחייב. שמירת מידע לאורך זמן אינה מובטחת: כל מי שמחזיק קישור עריכה יכול לשנות או למחוק תוכן, ותקלה טכנית עלולה לגרום לאובדן נתונים. <b>תוכן חשוב יש לייצא ולשמור עותק מחוץ למערכת</b> (Word / PDF / TXT — בתפריט ההורדה). השימוש במערכת הוא באחריות המשתמש בלבד, והמערכת מסופקת כפי שהיא (As-Is) ללא כל התחייבות או אחריות, לרבות לזמינות, לשלמות המידע או לנזק הנובע מהשימוש.</p>
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
            </>
          )}
        </section>

        <footer className="about-foot"><Link to="/">← חזרה לדף הבית</Link></footer>
      </main>
    </div>
  );
}
