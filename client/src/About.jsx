import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from './theme.jsx';
import { Logo, IconDoc, IconBoard, IconTimeline, IconRisk, IconSwot, IconChat, IconTasks, IconSun, IconProject } from './icons.jsx';

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

// Same category grouping as the home page, for the per-type creation breakdown.
const TOOL_BY_TYPE = Object.fromEntries(TOOLS.map((t) => [t.type, t]));
const CATEGORIES = [
  { name: 'יום־יומי', types: ['doc', 'chat', 'tasks'] },
  { name: 'ניהול', types: ['risks', 'timeline', 'project'] },
  { name: 'ארגוני', types: ['board', 'swot', 'sun'] },
];

export default function About() {
  const [stats, setStats] = useState(null);

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
          {!stats ? <p>טוען…</p> : stats.error ? <p>הנתונים אינם זמינים כרגע.</p> : (() => {
            const c = stats.counters || {};
            const totalCreated = CATEGORIES.flatMap((g) => g.types).reduce((a, t) => a + (c['create:' + t] || 0), 0);
            return (
              <>
                <div className="stat-row">
                  <div className="stat-tile"><span className="stat-num">{(c['visit'] || 0).toLocaleString('he-IL')}</span>כניסות לאתר</div>
                  <div className="stat-tile"><span className="stat-num live">{stats.online || 0}<i /></span>מחוברים עכשיו</div>
                  <div className="stat-tile"><span className="stat-num">{(c['share:edit'] || 0).toLocaleString('he-IL')}</span>שיתופים לעריכה</div>
                  <div className="stat-tile"><span className="stat-num">{(c['share:view'] || 0).toLocaleString('he-IL')}</span>שיתופים לצפייה בלבד</div>
                </div>

                <div className="chart-head"><h3>פריטים שנוצרו לפי סוג מסך</h3><span className="ab-total">סה״כ {totalCreated.toLocaleString('he-IL')}</span></div>
                <div className="ab-usage">
                  {CATEGORIES.map((g) => (
                    <div key={g.name} className="ab-usage-group">
                      <h4 className="group-title"><span>{g.name}</span></h4>
                      <div className="ab-usage-row">
                        {g.types.map((type) => {
                          const t = TOOL_BY_TYPE[type];
                          return (
                            <div key={type} className="ab-usage-card">
                              <span className={'ico ' + t.cls}>{t.icon}</span>
                              <b>{t.name}</b>
                              <span className={'ab-usage-n ab-n-' + t.cls}>{(c['create:' + type] || 0).toLocaleString('he-IL')}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="ab-fine">
                  הספירה אנונימית לחלוטין — מונים צוברים בלבד, בלי חשבונות ובלי מידע מזהה. נספרים מרגע הפעלתם.
                </p>
              </>
            );
          })()}
        </section>

        <footer className="about-foot"><Link to="/">← חזרה לדף הבית</Link></footer>
      </main>
    </div>
  );
}
