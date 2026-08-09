// Shared "load example" content for every screen except doc/chat. One consistent story so a
// new user clicking "דוגמה" on any screen sees the same organization and the same four
// projects, tying the whole app together instead of showing disconnected sample data.
//
// The story: "מטה הטמעה וטכנולוגיה" (a generic implementation/technology HQ unit) running
// four concurrent projects:
//   - CRM חדש — new CRM system for sales/service (lead: רועי לוי)
//   - הטמעת תוכנה למשתמשים — org-wide rollout of an operational system (lead: מיכל אברהם)
//   - פיתוח מוצר — an internal product/app build (lead: אורי שגיא)
//   - פריסת הדרכה וידע — completing a training/knowledge-transfer program (lead: נועה ברק)
// Sponsor/PMO lead across all of them: דנה כהן.

export const BOARD_EXAMPLE_TXT = `לוח חשיבה: תהליך ניהול הטמעות - מטה הטמעה וטכנולוגיה

[1] מיקום: 40,40 | צבע: כחול | גודל: 190x170 | סיבוב: 0 | שכבה: 1
# 1. אפיון
הגדרת דרישות עסקיות וטכניות מול בעלי העניין, ומיפוי מערכות קיימות שיושפעו.

[2] מיקום: 270,40 | צבע: תכלת | גודל: 190x170 | סיבוב: 0 | שכבה: 2
# 2. תכנון
בניית תוכנית עבודה, לוחות זמנים, תקציב ותכולה. הגדרת אבני דרך ובעלי תפקידים.

[3] מיקום: 500,40 | צבע: ירוק | גודל: 190x170 | סיבוב: 0 | שכבה: 3
# 3. פיתוח / רכש
פיתוח בפועל או בחירת ספק ורכש הפתרון, בהתאם לתכולה שהוגדרה.

[4] מיקום: 730,40 | צבע: ליים | גודל: 190x170 | סיבוב: 0 | שכבה: 4
# 4. בדיקות
בדיקות קבלה (UAT) מול המשתמשים, איתור ותיקון תקלות לפני עלייה לאוויר.

[5] מיקום: 960,40 | צבע: צהוב | גודל: 190x170 | סיבוב: 0 | שכבה: 5
# 5. הטמעה
הדרכת המשתמשים והפעלה בשטח, כולל תמיכת חירום בשבועות הראשונים.

[6] מיקום: 1190,40 | צבע: כתום | גודל: 190x170 | סיבוב: 0 | שכבה: 6
# 6. תמיכה ומעקב
תמיכה שוטפת, מדידת אימוץ בפועל מול היעד, ושיפור מתמשך.

[7] מיקום: 40,270 | צבע: סגול | גודל: 190x170 | סיבוב: -1 | שכבה: 7
# CRM חדש
מוביל: רועי לוי
סטטוס: בביצוע - שלב פיתוח

[8] מיקום: 270,270 | צבע: ורוד | גודל: 190x170 | סיבוב: 1 | שכבה: 8
# הטמעת תוכנה למשתמשים
מובילה: מיכל אברהם
סטטוס: קרוב לסיום - שלב הטמעה

[9] מיקום: 500,270 | צבע: אדום | גודל: 190x170 | סיבוב: -1 | שכבה: 9
# פיתוח מוצר
מוביל: אורי שגיא
סטטוס: בתכנון מוקדם

[10] מיקום: 730,270 | צבע: אפור | גודל: 190x170 | סיבוב: 1 | שכבה: 10
# פריסת הדרכה וידע
מובילה: נועה ברק
סטטוס: בביצוע - פריסה ארגונית

חיבורים:
1 - 2
2 - 3
3 - 4
4 - 5
5 - 6
`;

export const TIMELINE_EXAMPLE_TXT = `ציר זמן: תוכניות המטה 2026

2026-03-01 | כחול | אישור תקציב לארבע התוכניות ע"י דנה כהן
2026-04-01 | סגול | CRM חדש - פתיחת הפרויקט ואפיון דרישות
2026-05-15 | ורוד | הטמעת תוכנה למשתמשים - תחילת פיילוט במחלקת המכירות
2026-06-15 | כתום | פריסת הדרכה וידע - השקת תוכנית ההדרכה הארגונית
2026-07-01 | ורוד | הטמעת תוכנה למשתמשים - סיום פיילוט, מעבר לפריסה ארצית
2026-08-01 | סגול | CRM חדש - סיום שלב פיתוח, תחילת בדיקות קבלה
2026-09-15 | כתום | פריסת הדרכה וידע - השלמת הדרכה למחצית מהעובדים
2026-10-01 | סגול | CRM חדש - עלייה לאוויר (Go-Live)
2026-11-01 | אדום | פיתוח מוצר - גרסת בטא למשתמשים נבחרים
2026-12-15 | ירוק | סקירת התקדמות שנתית מול דנה כהן
`;

export const RISKS_EXAMPLE_TXT = `ניהול סיכונים: סיכוני תוכניות המטה 2026

[1] עיכוב באפיון דרישות ה-CRM עקב עומס בצוות המכירות | חומרה: 4 | הסתברות: 3 | משוקלל: 12
פירוט: פגישות אפיון נדחות שוב ושוב בשל זמינות נמוכה של אנשי מכירות מרכזיים.
פעולות: קביעת חלונות זמן קבועים מראש; מעורבות מנהל המכירות באישור הזמינות.

[2] תלות בספק חיצוני להטמעת התוכנה למשתמשים | חומרה: 3 | הסתברות: 3 | משוקלל: 9
פירוט: עיכוב אצל הספק עלול לעכב את כל לוח הזמנים הארגוני של הפרויקט.
פעולות: הגדרת SLA חוזי; מעקב שבועי מול הספק; תוכנית מגירה חלופית.

[3] התנגדות משתמשים לאימוץ המערכת החדשה | חומרה: 4 | הסתברות: 4 | משוקלל: 16
פירוט: סקרי שביעות רצון מצביעים על חשש מהשינוי אצל חלק מהעובדים.
פעולות: תוכנית ניהול שינוי; שגרירי אימוץ בכל מחלקה; תקשורת שקופה ותדירה.

[4] חריגה מתקציב בפרויקט פיתוח המוצר | חומרה: 3 | הסתברות: 2 | משוקלל: 6
פירוט: עלויות תשתית ענן גבוהות מהתכנון המקורי בשלב הפיתוח.
פעולות: בקרת תקציב חודשית; מיטוב שימוש במשאבי ענן.

[5] זמינות מדריכים לפריסת ההדרכה הארצית | חומרה: 2 | הסתברות: 3 | משוקלל: 6
פירוט: מספר המדריכים המוסמכים אינו מספיק לפריסה בכל הסניפים בו-זמנית.
פעולות: הכשרת מדריכים נוספים; פריסה בגלים לפי אזור גאוגרפי.

[6] אבטחת מידע ותאימות רגולטורית ב-CRM החדש | חומרה: 5 | הסתברות: 2 | משוקלל: 10
פירוט: המערכת החדשה מכילה מידע רגיש של לקוחות ודורשת עמידה ברגולציה.
פעולות: סקר אבטחה מקדים; אישור קצין אבטחת מידע לפני עלייה לאוויר.
`;

export const SWOT_EXAMPLE_TXT = `SWOT: יכולת ניהול תוכניות המטה 2026

S - חוזקות / Strengths
- מתודולוגיה אחידה לניהול פרויקטים בכל ארבע התוכניות
- ליווי צמוד של דנה כהן כספונסרית לכלל הפרויקטים
- צוות מוביל מנוסה עם התמחות בתחומים משלימים (CRM, תפעול, פיתוח, הדרכה)

W - חולשות / Weaknesses
- תלות גבוהה במספר מצומצם של אנשי מפתח בכל פרויקט
- תיעוד לא אחיד בין הפרויקטים השונים
- עומס מקביל על צוות ה-IT התומך בכל התוכניות בו-זמנית

O - הזדמנויות / Opportunities
- הזדמנות ליצור תבנית עבודה אחידה שתשמש גם פרויקטים עתידיים
- שיפור שביעות רצון עובדים דרך תוכנית ההדרכה הארגונית
- מינוף ה-CRM החדש להעמקת הקשר עם לקוחות ולשיפור השירות

T - איומים / Threats
- עייפות שינוי אצל העובדים מול ריבוי תהליכי הטמעה במקביל
- סיכון לחריגות תקציב חוצות-פרויקטים
- תלות בספקים חיצוניים שעלולה לעכב את לוחות הזמנים
`;

// One module per HQ project (as a swimlane, matching the "hammock" grouping look), plus a
// general milestones lane. Tasks overlap on purpose within a few modules so the packing
// (sub-row stacking) has real work to do; a handful of diamonds and dependency links tie
// modules together. Range spans exactly one year, mid-year to mid-year (Jul 2026 - Jul
// 2027), and every color is a shade of blue for a calm, legible, single-family palette.
export const GANTT_EXAMPLE_TXT = `כותרת,לוח גאנט - פרויקט 2026-2027
טווח התחלה,2026-07-01
טווח סיום,2027-07-01
רמת פירוט,חודשים
הצגת היום,כן
הצגת קשרים,כן
הצגת אחוזים,כן

[G1] מודול,אבני דרך כלליות,#1e3a5f
[G2] מודול,CRM חדש,#2563eb
[G3] מודול,הטמעת תוכנה למשתמשים,#0ea5e9
[G4] מודול,פיתוח מוצר,#4f46e5
[G5] מודול,פריסת הדרכה וידע,#0891b2

[T1] משימה,1,אישור תקציב לתוכנית,2026-07-15,2026-07-15,0,,כן
[T2] משימה,1,סקירת אמצע שנה,2027-01-15,2027-01-15,0,,כן
[T3] משימה,1,סקירה שנתית מול ההנהלה,2027-06-15,2027-06-15,0,,כן
[T4] משימה,2,אפיון דרישות,2026-07-05,2026-08-20,100,,לא
[T5] משימה,2,פיתוח,2026-08-15,2026-12-31,70,,לא
[T6] משימה,2,בדיקות קבלה (UAT),2027-01-05,2027-02-28,0,#1d4ed8,לא
[T7] משימה,2,עלייה לאוויר,2027-03-15,2027-03-15,0,,כן
[T8] משימה,3,פיילוט - מחלקת מכירות,2026-07-10,2026-09-01,100,,לא
[T9] משימה,3,פריסה ארצית - גל 1,2026-09-05,2026-12-15,90,,לא
[T10] משימה,3,פריסה ארצית - גל 2,2026-12-01,2027-03-31,40,,לא
[T11] משימה,3,מעבר לתחזוקה שוטפת,2027-04-15,2027-04-15,0,,כן
[T12] משימה,4,גיבוש רעיון ואפיון,2026-08-01,2026-10-15,100,,לא
[T13] משימה,4,אישור תקציב תשתיות ענן,2026-10-25,2026-10-25,0,,כן
[T14] משימה,4,פיתוח גרסה ראשונה (MVP),2026-11-01,2027-04-30,35,#6366f1,לא
[T15] משימה,4,גרסת בטא,2027-05-01,2027-06-15,0,,לא
[T16] משימה,5,בניית תוכנית הדרכה,2026-07-15,2026-09-15,100,,לא
[T17] משימה,5,השקת ההדרכה הארגונית,2026-09-16,2026-12-31,85,,לא
[T18] משימה,5,הדרכת גל 2 - סניפים נוספים,2026-12-15,2027-03-15,50,,לא
[T19] משימה,5,השלמת הדרכה לכלל העובדים,2027-04-01,2027-04-01,0,,כן

קשר,4,5
קשר,5,6
קשר,6,7
קשר,8,9
קשר,9,10
קשר,12,13
קשר,13,14
קשר,16,17
קשר,1,4
קשר,1,12
`;

export const SUN_EXAMPLE_TXT = `תרשים שמש: תוכנית עבודה

- יעדים
- לוחות זמנים
- תקציב
- משאבים ואנשים
- סיכונים
- בעלי עניין
- תקשורת ועדכונים
- בקרה ומעקב
- איכות
- הדרכה והטמעה
`;

// One gauge per project (% complete), each in a different style so the variety of styles
// is visible right away — matching the same thresholds (behind/on-track/near-done) across all.
// 6 tasks spanning all 4 projects, varied status/priority/assignee — including one with an
// update-log entry, to show that feature too.
const daysAgo = (n) => Date.now() - n * 86400000;
const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
export const TASKS_EXAMPLE = [
  {
    title: 'השלמת אפיון מסך ניהול לידים', desc: 'סגירת מסמך אפיון מול צוות המכירות, כולל דוגמאות מסך.',
    status: 'in_progress', priority: 2, assignee: 'רועי לוי', due: daysFromNow(5), dueCurrent: daysFromNow(5),
    log: [{ at: daysAgo(2), by: 'רועי לוי', from: 'new', to: 'in_progress', note: 'התחלנו עבודה מול צוות המכירות' }],
  },
  {
    title: 'בדיקות קבלה (UAT) לפני עלייה לאוויר', desc: 'תיאום מול נציגי המחלקות לביצוע בדיקות קבלה מסודרות.',
    status: 'new', priority: 3, assignee: 'רועי לוי', due: daysFromNow(30), dueCurrent: daysFromNow(30), log: [],
  },
  {
    title: 'סיום פריסה למחלקת הכספים', desc: 'הפעלת המערכת החדשה במחלקת הכספים, כולל תמיכת חירום בשבוע הראשון.',
    status: 'in_progress', priority: 2, assignee: 'מיכל אברהם', due: daysFromNow(10), dueCurrent: daysFromNow(10), log: [],
  },
  {
    title: 'בניית מדריך שימוש למשתמש הקצה', desc: 'מדריך קצר ומצולם-מסך להפצה לכלל המשתמשים.',
    status: 'done', priority: 1, assignee: 'מיכל אברהם', due: daysFromNow(-3), dueCurrent: daysFromNow(-3), log: [],
  },
  {
    title: 'אפיון ארכיטקטורת המערכת', desc: 'ממתין לאישור תקציב נוסף לתשתיות ענן לפני שממשיכים.',
    status: 'waiting', priority: 2, assignee: 'אורי שגיא', due: daysFromNow(14), dueCurrent: daysFromNow(21), log: [],
  },
  {
    title: 'תיאום מועדי הדרכה עם כלל הסניפים', desc: 'בניית לוח זמנים לפריסת ההדרכות בגלים לפי אזור.',
    status: 'in_progress', priority: 1, assignee: 'נועה ברק', due: daysFromNow(7), dueCurrent: daysFromNow(7), log: [],
  },
];

// A "dashboard overview slide" feel: all 5 gauge styles, one row of 3 each, grouped by
// theme per row (schedule / project completion / budget-health / risk-safety / quarterly
// purpose KPIs) so the variety of looks is obvious at a glance.
export const GAUGES_EXAMPLE = [
  // classic (semicircle dial) — schedule countdowns
  { title: 'ימים שנותרו לבדיקות קבלה - CRM חדש', min: 0, max: 60, value: 18, th1: 10, th2: 30, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: 'ימים', style: 'classic' },
  { title: 'ימים לסיום פריסה ארצית', min: 0, max: 60, value: 25, th1: 10, th2: 30, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: 'ימים', style: 'classic' },
  { title: 'ימים להשלמת הכשרת כל העובדים', min: 0, max: 90, value: 40, th1: 15, th2: 40, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: 'ימים', style: 'classic' },
  // full dial — project completion percentage
  { title: 'התקדמות CRM חדש', min: 0, max: 100, value: 55, th1: 40, th2: 75, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%', style: 'full' },
  { title: 'התקדמות הטמעת תוכנה למשתמשים', min: 0, max: 100, value: 80, th1: 40, th2: 75, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%', style: 'full' },
  { title: 'התקדמות פריסת הדרכה וידע', min: 0, max: 100, value: 65, th1: 40, th2: 75, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%', style: 'full' },
  // status bar — budget and organizational health
  { title: 'ניצול תקציב מצטבר - כלל התוכנית', min: 0, max: 100, value: 93, th1: 70, th2: 95, c0: '#22c55e', c1: '#f59e0b', c2: '#ef4444', unit: '%', style: 'bar' },
  { title: 'שביעות רצון עובדים', min: 0, max: 5, value: 3.6, th1: 2.5, th2: 4, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '/5', style: 'bar' },
  { title: 'חוסן תוכנית העבודה הכוללת', min: 0, max: 100, value: 68, th1: 40, th2: 70, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%', style: 'bar' },
  // traffic light — risk and safety indicators
  { title: 'סיכון לוח זמנים - פיתוח מוצר', min: 0, max: 100, value: 78, th1: 40, th2: 70, c0: '#22c55e', c1: '#f59e0b', c2: '#ef4444', unit: '%', style: 'traffic' },
  { title: 'בטיחות ואבטחת מידע - CRM', min: 0, max: 100, value: 82, th1: 40, th2: 75, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%', style: 'traffic' },
  { title: 'מוכנות מדריכים לפריסה ארצית', min: 0, max: 100, value: 45, th1: 40, th2: 75, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%', style: 'traffic' },
  // ring — quarterly purpose KPIs
  { title: 'השלמת יעדי הרבעון', min: 0, max: 100, value: 75, th1: 40, th2: 75, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%', style: 'ring' },
  { title: 'אימוץ בפועל - מערכת תפעול', min: 0, max: 100, value: 88, th1: 40, th2: 75, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%', style: 'ring' },
  { title: 'מוכנות כללית לסקירת הנהלה', min: 0, max: 100, value: 60, th1: 40, th2: 75, c0: '#ef4444', c1: '#f59e0b', c2: '#22c55e', unit: '%', style: 'ring' },
];

// The full portfolio: all four projects, each with a different overall status (green/yellow/red
// mix), a different badge tone, and its own embedded tasks/risks — mirrors (and reuses text from)
// TASKS_EXAMPLE/RISKS_EXAMPLE_TXT above so the same items feel connected across screens.
const puid = () => crypto.randomUUID().slice(0, 8);
export const PROJECT_EXAMPLE = [
  {
    name: 'CRM חדש',
    purpose: 'פיתוח והטמעת מערכת CRM חדשה למחלקות המכירות והשירות, לשיפור מעקב הלידים ושירות הלקוחות.',
    phase: 'מימוש', status: 'yellow', badge: 'c1', manager: 'רועי לוי', updated: daysFromNow(-3),
    schedule: { st: 'yellow', trend: 'flat', text: 'אפיון הושלם ופיתוח בעיצומו. קיים סיכון קל ללוח הזמנים בשל עומס בצוות המכירות.' },
    scope: { st: 'green', trend: 'up', text: 'תכולת הפרויקט מוגדרת וסגורה מול כלל בעלי העניין.' },
    resources: { st: 'yellow', trend: 'down', text: 'תלות בזמינות אנשי מכירות לאישור מסכים ותהליכים, עלולה לעכב.' },
    milestones: [
      { name: 'אפיון דרישות', date: daysFromNow(-110), st: 'done' },
      { name: 'תחילת פיתוח', date: daysFromNow(-95), st: 'done' },
      { name: 'סיום פיתוח ותחילת בדיקות קבלה', date: daysFromNow(20), st: 'active' },
      { name: 'עלייה לאוויר (Go-Live)', date: daysFromNow(75), st: 'future' },
    ],
    gaps: [
      { title: 'עומס על צוות המכירות', desc: 'פוגע בזמינות לאפיון ואישורים בזמן.' },
      { title: 'סקר אבטחת מידע טרם בוצע', desc: 'נדרש לפני עלייה לאוויר, בשל מידע רגיש של לקוחות.' },
    ],
    decisions: ['אישור תקציב נוסף לרישוי המערכת.', 'החלטה סופית על מועד עלייה לאוויר.'],
    info: 'פרויקט זה חלק מתוכנית העבודה הרחבה של מטה הטמעה וטכנולוגיה לשנת 2026, לצד שלושה פרויקטים נוספים באותה תוכנית.',
    links: [
      { id: puid(), title: 'מסמך אפיון', url: 'https://example.com/crm-spec' },
      { id: puid(), title: 'לוח מעקב פרויקט', url: 'https://example.com/crm-tracker' },
    ],
    _tasks: [
      { title: 'השלמת אפיון מסך ניהול לידים', desc: 'סגירת מסמך אפיון מול צוות המכירות, כולל דוגמאות מסך.', status: 'in_progress', priority: 2, assignee: 'רועי לוי', due: daysFromNow(5), dueCurrent: daysFromNow(5), log: [{ at: daysAgo(2), by: 'רועי לוי', from: 'new', to: 'in_progress', note: 'התחלנו עבודה מול צוות המכירות' }] },
      { title: 'בדיקות קבלה (UAT) לפני עלייה לאוויר', desc: 'תיאום מול נציגי המחלקות לביצוע בדיקות קבלה מסודרות.', status: 'new', priority: 3, assignee: 'רועי לוי', due: daysFromNow(30), dueCurrent: daysFromNow(30), log: [] },
    ],
    _risks: [
      { name: 'עיכוב באפיון דרישות ה-CRM עקב עומס בצוות המכירות', sev: 4, prob: 3, detail: 'פגישות אפיון נדחות שוב ושוב בשל זמינות נמוכה של אנשי מכירות מרכזיים.', actions: 'קביעת חלונות זמן קבועים מראש; מעורבות מנהל המכירות באישור הזמינות.' },
      { name: 'אבטחת מידע ותאימות רגולטורית במערכת החדשה', sev: 5, prob: 2, detail: 'המערכת החדשה מכילה מידע רגיש של לקוחות ודורשת עמידה ברגולציה.', actions: 'סקר אבטחה מקדים; אישור קצין אבטחת מידע לפני עלייה לאוויר.' },
    ],
  },
  {
    name: 'הטמעת תוכנה למשתמשים',
    purpose: 'פריסה ארגונית של מערכת תפעולית חדשה לכלל העובדים, כולל הדרכה ותמיכה בשטח.',
    phase: 'הטמעה', status: 'green', badge: 'c2', manager: 'מיכל אברהם', updated: daysFromNow(-1),
    schedule: { st: 'green', trend: 'up', text: 'הפיילוט הצליח וההטמעה מתקדמת לפי התוכנית, בגלים לפי מחלקה.' },
    scope: { st: 'green', trend: 'flat', text: 'תכולת המערכת סגורה; אין שינויים מתוכננים עד סיום הפריסה.' },
    resources: { st: 'green', trend: 'flat', text: 'צוות התמיכה מאויש במלואו לתקופת ההרצה המקבילה.' },
    milestones: [
      { name: 'פיילוט במחלקת המכירות', date: daysFromNow(-85), st: 'done' },
      { name: 'מעבר לפריסה ארצית', date: daysFromNow(-38), st: 'done' },
      { name: 'סיום פריסה למחלקת הכספים', date: daysFromNow(10), st: 'active' },
      { name: 'סגירת פרויקט ומעבר לתחזוקה שוטפת', date: daysFromNow(45), st: 'future' },
    ],
    gaps: [{ title: 'מדריכי הפעלה חסרים לתרחישי קצה', desc: 'חלק מהתרחישים החריגים אינם מתועדים עדיין.' }],
    decisions: ['אישור העברת האחריות התפעולית לצוות התמיכה השוטף עם סיום הפריסה.'],
    info: 'הפרויקט מבוצע בגלים לפי מחלקה, בליווי צמוד של דנה כהן כספונסרית התוכנית.',
    links: [{ id: puid(), title: 'לוח פריסה לפי מחלקות', url: 'https://example.com/rollout-tracker' }],
    _tasks: [
      { title: 'סיום פריסה למחלקת הכספים', desc: 'הפעלת המערכת החדשה במחלקת הכספים, כולל תמיכת חירום בשבוע הראשון.', status: 'in_progress', priority: 2, assignee: 'מיכל אברהם', due: daysFromNow(10), dueCurrent: daysFromNow(10), log: [] },
      { title: 'בניית מדריך שימוש למשתמש הקצה', desc: 'מדריך קצר ומצולם-מסך להפצה לכלל המשתמשים.', status: 'done', priority: 1, assignee: 'מיכל אברהם', due: daysFromNow(-3), dueCurrent: daysFromNow(-3), log: [] },
    ],
    _risks: [
      { name: 'התנגדות משתמשים לאימוץ המערכת החדשה', sev: 4, prob: 4, detail: 'סקרי שביעות רצון מצביעים על חשש מהשינוי אצל חלק מהעובדים.', actions: 'תוכנית ניהול שינוי; שגרירי אימוץ בכל מחלקה; תקשורת שקופה ותדירה.' },
    ],
  },
  {
    name: 'פיתוח מוצר',
    purpose: 'פיתוח מוצר תוכנה פנים-ארגוני חדש, מרעיון ראשוני ועד גרסת בטא למשתמשים נבחרים.',
    phase: 'התנעה', status: 'red', badge: 'c3', manager: 'אורי שגיא', updated: daysFromNow(-6),
    schedule: { st: 'red', trend: 'down', text: 'עיכוב באישור התקציב הנוסף עוצר את תחילת שלב הפיתוח המלא.' },
    scope: { st: 'yellow', trend: 'flat', text: 'תכולת גרסה ראשונה (MVP) עדיין בגיבוש מול בעלי העניין.' },
    resources: { st: 'red', trend: 'down', text: 'חוסר בתקציב לתשתיות ענן מעכב את גיוס הצוות הטכני הנדרש.' },
    milestones: [
      { name: 'גיבוש רעיון ואפיון ראשוני', date: daysFromNow(-50), st: 'done' },
      { name: 'אישור תקציב תשתיות ענן', date: daysFromNow(5), st: 'gap' },
      { name: 'תחילת פיתוח גרסה ראשונה', date: daysFromNow(25), st: 'future' },
      { name: 'גרסת בטא למשתמשים נבחרים', date: daysFromNow(95), st: 'future' },
    ],
    gaps: [
      { title: 'חריגה מתקציב תשתיות הענן', desc: 'עלויות תשתית ענן גבוהות מהתכנון המקורי, מעכבות אישור המשך.' },
      { title: 'חוסר באנשי פיתוח', desc: 'טרם אויש תקן מפתח Backend נוסף שאושר.' },
    ],
    decisions: ['אישור תקציב תשתיות ענן מעודכן.', 'החלטה על גיוס מפתח נוסף או שכירת קבלן חיצוני.'],
    info: 'פרויקט זה נמצא בשלב מוקדם יחסית לשאר תוכניות המטה, ומדווח ישירות לדנה כהן.',
    links: [{ id: puid(), title: 'מסמך חזון מוצר', url: 'https://example.com/product-vision' }],
    _tasks: [
      { title: 'אפיון ארכיטקטורת המערכת', desc: 'ממתין לאישור תקציב נוסף לתשתיות ענן לפני שממשיכים.', status: 'waiting', priority: 2, assignee: 'אורי שגיא', due: daysFromNow(14), dueCurrent: daysFromNow(21), log: [] },
    ],
    _risks: [
      { name: 'חריגה מתקציב בפרויקט פיתוח המוצר', sev: 3, prob: 2, detail: 'עלויות תשתית ענן גבוהות מהתכנון המקורי בשלב הפיתוח.', actions: 'בקרת תקציב חודשית; מיטוב שימוש במשאבי ענן.' },
    ],
  },
  {
    name: 'פריסת הדרכה וידע',
    purpose: 'השלמת פריסת תוכנית הדרכה והעברת ידע ארגונית לכלל העובדים, בהמשך לפרויקטים הטכנולוגיים המקבילים.',
    phase: 'הטמעה', status: 'green', badge: 'c4', manager: 'נועה ברק', updated: daysFromNow(-2),
    schedule: { st: 'green', trend: 'up', text: 'ההדרכה מתקדמת בגלים לפי אזור, בהתאם ללוח הזמנים המתוכנן.' },
    scope: { st: 'green', trend: 'flat', text: 'תוכן ההדרכה סגור, כולל חומרים למערכת ה-CRM החדשה שיתווספו בהמשך.' },
    resources: { st: 'yellow', trend: 'flat', text: 'מספר המדריכים המוסמכים מצומצם ביחס לכמות הסניפים.' },
    milestones: [
      { name: 'השקת תוכנית ההדרכה הארגונית', date: daysFromNow(-55), st: 'done' },
      { name: 'השלמת הדרכה למחצית מהעובדים', date: daysFromNow(-20), st: 'done' },
      { name: 'סיום פריסה בכלל הסניפים', date: daysFromNow(40), st: 'active' },
      { name: 'הוספת מודול הדרכה למערכת ה-CRM החדשה', date: daysFromNow(80), st: 'future' },
    ],
    gaps: [{ title: 'זמינות מדריכים מוסמכים', desc: 'אינה מספיקה לפריסה בכל הסניפים בו-זמנית.' }],
    decisions: ['אישור הכשרת שני מדריכים נוספים.'],
    info: 'התוכנית מלווה את שלושת הפרויקטים הטכנולוגיים המקבילים, ותתעדכן עם השקת ה-CRM החדש.',
    links: [{ id: puid(), title: 'לוח פריסה לפי סניפים', url: 'https://example.com/training-tracker' }],
    _tasks: [
      { title: 'תיאום מועדי הדרכה עם כלל הסניפים', desc: 'בניית לוח זמנים לפריסת ההדרכות בגלים לפי אזור.', status: 'in_progress', priority: 1, assignee: 'נועה ברק', due: daysFromNow(7), dueCurrent: daysFromNow(7), log: [] },
    ],
    _risks: [
      { name: 'זמינות מדריכים לפריסת ההדרכה הארצית', sev: 2, prob: 3, detail: 'מספר המדריכים המוסמכים אינו מספיק לפריסה בכל הסניפים בו-זמנית.', actions: 'הכשרת מדריכים נוספים; פריסה בגלים לפי אזור גאוגרפי.' },
    ],
  },
];

// Organizational KPIs for the whole 2026 program (spans all four projects), not per-project.
export const GOALS_EXAMPLE = [
  {
    name: 'עמידה בלוחות הזמנים של ארבע התוכניות',
    purpose: 'לוודא שכל ארבע התוכניות עומדות באבני הדרך שנקבעו לשנת 2026, ולזהות סטיות מוקדם ככל האפשר.',
    status: 'שלוש מתוך ארבע התוכניות בלוח זמנים תקין; פרויקט פיתוח המוצר בפיגור עקב עיכוב באישור תקציב.',
    badge: 'c1', updated: daysFromNow(-2),
    metrics: [
      { metric: 'אחוז אבני דרך שהושלמו בזמן', target: '90%', current: '75%', due: daysFromNow(90), dod: 'כל אבני הדרך המתוכננות לרבעון סומנו "הושלם" במסך הפרויקט בתאריך היעד שנקבע להן.' },
      { metric: 'מספר תוכניות בלוח זמנים תקין', target: '4 מתוך 4', current: '3 מתוך 4', due: daysFromNow(90), dod: 'סטטוס הלו״ז בכל ארבעת הפרויקטים במסך "ניהול פרויקטים" מוצג כ"תקין" (ירוק).' },
    ],
    _tasks: [
      { title: 'סיכום סטטוס אבני דרך רבעוני', desc: 'ריכוז נתוני התקדמות מכל ארבע התוכניות לקראת דיווח לדנה כהן.', status: 'in_progress', priority: 2, assignee: 'דנה כהן', due: daysFromNow(6), dueCurrent: daysFromNow(6), log: [] },
    ],
  },
  {
    name: 'אימוץ בפועל של המערכות החדשות',
    purpose: 'מדידת שיעור השימוש בפועל במערכות החדשות (CRM ומערכת התפעול) מול היעד שנקבע.',
    status: 'אימוץ מערכת התפעול גבוה מהיעד; ה-CRM טרם עלה לאוויר כך שהמדידה תתחיל לאחר ההשקה.',
    badge: 'c2', updated: daysFromNow(-1),
    metrics: [
      { metric: 'שיעור שימוש פעיל במערכת התפעול', target: '85%', current: '88%', due: daysFromNow(60), dod: 'דוח שימוש חודשי מהמערכת מראה התחברות פעילה של 85% מהעובדים לפחות.' },
      { metric: 'שיעור עובדים שהושלמה עבורם הדרכה', target: '100%', current: '62%', due: daysFromNow(80), dod: 'כל עובד סימן "הושלם" במעקב ההדרכה של פריסת הדרכה וידע.' },
    ],
  },
  {
    name: 'עמידה בתקציב הכולל של התוכנית',
    purpose: 'מעקב אחר ניצול התקציב הכולל שאושר לארבע התוכניות מול התכנון.',
    status: 'חריגה קלה בתקציב פרויקט פיתוח המוצר בשל עלויות תשתיות ענן; שאר התוכניות בתקציב.',
    badge: 'c3', updated: daysFromNow(-5),
    metrics: [
      { metric: 'ניצול תקציב מצטבר', target: 'עד 100%', current: '93%', due: daysFromNow(120), dod: 'דוח כספים רבעוני מראה ניצול תקציב מצטבר שאינו עולה על 100% מהתקציב המאושר.' },
      { metric: 'מספר תוכניות בחריגת תקציב', target: '0', current: '1', due: daysFromNow(30), dod: 'אף פרויקט אינו מסומן "בחריגה" בדוח התקציב הרבעוני של דנה כהן.' },
    ],
  },
  {
    name: 'שביעות רצון משתמשים ולקוחות',
    purpose: 'מדידת שביעות רצון עובדים ולקוחות מהשינויים הארגוניים שמובילה התוכנית.',
    status: 'סקר שביעות רצון ראשוני מצביע על מגמה חיובית, עם חשש מסוים מקצב השינויים.',
    badge: 'c4', updated: daysFromNow(-4),
    metrics: [
      { metric: 'ציון שביעות רצון עובדים (1-5)', target: '4.0', current: '3.6', due: daysFromNow(100), dod: 'סקר שביעות רצון עובדים רבעוני מניב ציון ממוצע 4.0 ומעלה.' },
      { metric: 'ציון שביעות רצון לקוחות שירות (1-5)', target: '4.5', current: '-', due: daysFromNow(150), dod: 'סקר שביעות רצון לקוחות ראשון מבוצע לאחר עלייה לאוויר של ה-CRM, עם ציון 4.5 ומעלה.' },
    ],
  },
];

// Debrief on the pilot phase of the "הטמעת תוכנה למשתמשים" project — lessons/summary lines
// each auto-create a linked task (how Debrief.jsx actually works), plus one standalone task.
export const DEBRIEF_EXAMPLE = {
  title: 'תחקיר - פיילוט הטמעת התוכנה במחלקת המכירות',
  background: 'תחקיר זה מסכם את שלב הפיילוט של פרויקט הטמעת תוכנה למשתמשים במחלקת המכירות. מטרת הפיילוט הייתה לבחון את תהליך ההטמעה בקנה מידה קטן לפני מעבר לפריסה ארצית.',
  chronoNotes: 'הפיילוט התקיים על פני כחודשיים; להלן ציר הזמן המרכזי של האירועים הרלוונטיים.',
  chrono: [
    { date: daysFromNow(-95), time: '09:00:00', text: 'פתיחת הפיילוט במחלקת המכירות עם 15 משתמשים ראשונים' },
    { date: daysFromNow(-80), time: '14:30:00', text: 'תקלה בסנכרון נתונים מול מערכת ה-CRM הישנה; טופלה תוך יום' },
    { date: daysFromNow(-70), time: '10:00:00', text: 'ביצוע סקר שביעות רצון ראשוני בקרב המשתמשים בפיילוט' },
    { date: daysFromNow(-50), time: '11:00:00', text: 'החלטה על הרחבת הפיילוט לכלל אנשי המכירות לפני מעבר ארצי' },
    { date: daysFromNow(-38), time: '16:00:00', text: 'סיום הפיילוט ואישור המעבר לפריסה ארצית' },
  ],
  findings: [
    'רוב המשתמשים דיווחו על עקומת למידה קצרה יחסית בזכות ממשק פשוט',
    'תקלת הסנכרון מול המערכת הישנה חזרה על עצמה פעמיים נוספות במהלך הפיילוט',
    'משתמשים שקיבלו הדרכה פרונטלית הראו אימוץ מהיר יותר מאלו שקיבלו הדרכה מוקלטת בלבד',
  ],
  lessons: [
    { text: 'יש לבצע בדיקת עומסים מול מערכת ה-CRM הישנה לפני כל גל פריסה נוסף', status: 'in_progress', priority: 2, assignee: 'מיכל אברהם', due: daysFromNow(15), dueCurrent: daysFromNow(15), log: [] },
    { text: 'הדרכה פרונטלית עדיפה על פני הדרכה מוקלטת בשלבים הראשונים של כל גל', status: 'new', priority: 2, assignee: 'נועה ברק', due: daysFromNow(20), dueCurrent: daysFromNow(20), log: [] },
    { text: 'כדאי למנות אלוף אימוץ בכל מחלקה לפני תחילת הגל שלה', status: 'done', priority: 1, assignee: 'מיכל אברהם', due: daysFromNow(-10), dueCurrent: daysFromNow(-10), log: [{ at: daysAgo(60), by: 'מיכל אברהם', from: 'new', to: 'done', note: 'מונו אלופי אימוץ בשלוש המחלקות הראשונות' }] },
  ],
  summary: [
    { text: 'הפיילוט הצליח והוכיח כי ניתן להמשיך לפריסה ארצית בגלים לפי מחלקה', status: 'done', priority: 1, assignee: 'מיכל אברהם', due: daysFromNow(-38), dueCurrent: daysFromNow(-38), log: [] },
    { text: 'יש לשלב את בדיקת העומסים ואת מינוי אלופי האימוץ כשלב קבוע בפתיחת כל גל', status: 'new', priority: 2, assignee: 'מיכל אברהם', due: daysFromNow(25), dueCurrent: daysFromNow(25), log: [] },
  ],
  tasks: [
    { title: 'עדכון מדריך ההדרכה בהתאם ללקחי הפיילוט', desc: 'שילוב הדגשים על הדרכה פרונטלית ומינוי אלופי אימוץ.', status: 'waiting', priority: 1, assignee: 'נועה ברק', due: daysFromNow(30), dueCurrent: daysFromNow(30), log: [] },
  ],
};

// Steering-committee meeting reviewing all four projects together.
export const DISCUSSION_EXAMPLE = {
  title: 'סיכום ישיבת היגוי - תוכנית העבודה 2026',
  subject: 'סקירת התקדמות רבעונית לארבע התוכניות',
  chair: 'דנה כהן',
  date: daysFromNow(-2),
  proceedings: [
    { text: 'רועי לוי סקר את התקדמות פרויקט ה-CRM החדש; שלב הפיתוח בעיצומו עם סיכון קל ללוח הזמנים.', url: '' },
    { text: 'מיכל אברהם עדכנה כי הפיילוט להטמעת התוכנה למשתמשים הצליח והפרויקט עובר לפריסה ארצית.', url: '' },
    { text: 'אורי שגיא הציג את הבקשה לתקציב תשתיות ענן נוסף לפרויקט פיתוח המוצר.', url: 'https://example.com/product-budget-request' },
    { text: 'נועה ברק דיווחה על התקדמות פריסת ההדרכה וצורך בהכשרת מדריכים נוספים.', url: '' },
    { text: 'הוצג לוח הסיכונים המרכזי של כלל התוכניות לבחינת ההנהלה.', url: 'https://example.com/risk-dashboard' },
  ],
  decisions: [
    { text: 'אישור תקציב תשתיות ענן נוסף לפרויקט פיתוח המוצר, בכפוף להצגת פירוט עלויות מעודכן.', taskTitle: 'הכנת פירוט עלויות תשתיות ענן מעודכן', status: 'new', priority: 2, assignee: 'אורי שגיא', due: daysFromNow(10), dueCurrent: daysFromNow(10), log: [] },
    { text: 'אישור הכשרת שני מדריכים נוספים לפריסת ההדרכה הארצית.', taskTitle: 'גיוס והכשרת שני מדריכים נוספים', status: 'in_progress', priority: 1, assignee: 'נועה ברק', due: daysFromNow(20), dueCurrent: daysFromNow(20), log: [] },
    { text: 'הוחלט להעביר את האחריות התפעולית של מערכת התפעול לצוות התמיכה השוטף עם סיום הפריסה הארצית.', taskTitle: '' },
    { text: 'הוחלט לבצע סקר אבטחת מידע לפרויקט ה-CRM לפני עלייה לאוויר.', taskTitle: 'תיאום סקר אבטחת מידע ל-CRM', status: 'new', priority: 3, assignee: 'רועי לוי', due: daysFromNow(25), dueCurrent: daysFromNow(25), log: [] },
  ],
  participants: ['דנה כהן', 'רועי לוי', 'מיכל אברהם', 'אורי שגיא', 'נועה ברק'],
  distribution: ['מנכ"ל החברה', 'סמנכ"ל טכנולוגיות'],
  tasks: [
    { title: 'תיאום מועד ישיבת ההיגוי הבאה', desc: 'קביעת מועד לסקירה הרבעונית הבאה מול כלל מובילי הפרויקטים.', status: 'new', priority: 1, assignee: 'דנה כהן', due: daysFromNow(85), dueCurrent: daysFromNow(85), log: [] },
  ],
};

// Manager (דנה כהן) 1-on-1 with the CRM project lead (רועי לוי).
export const MEETING1ON1_EXAMPLE = {
  title: 'פגישה אישית - רועי לוי',
  personName: 'רועי לוי',
  meetingDate: daysFromNow(-1),
  background: [
    'רועי מוביל את פרויקט ה-CRM החדש כבר כחצי שנה, ומדווח ישירות לדנה.',
    'לאחרונה עבר לתפקיד ניהולי מורחב הכולל גם תיאום מול צוות המכירות.',
  ],
  needs: ['זקוק לתמיכה נוספת בניהול הזמן מול ריבוי הפגישות עם צוות המכירות.'],
  issues: ['הביע חשש מעומס לקראת שלב הבדיקות והעלייה לאוויר הקרובה.'],
  requests: ['ביקש להצטרף להכשרה מקצועית בניהול פרויקטים טכנולוגיים.'],
  hobbies: ['משחק כדורסל בליגת חובבים בסופי שבוע.'],
  goals: [
    { text: 'להוביל את פרויקט ה-CRM לעלייה לאוויר מוצלחת עד אוקטובר 2026', taskTitle: 'מעקב אישי אחר לוח הזמנים לעלייה לאוויר', status: 'in_progress', priority: 2, assignee: 'רועי לוי', due: daysFromNow(60), dueCurrent: daysFromNow(60), log: [] },
    { text: 'לשפר את תהליך העברת עדכונים שוטפים לדנה בין ישיבות ההיגוי', taskTitle: '' },
    { text: 'להשתתף בהכשרה מקצועית בניהול פרויקטים טכנולוגיים ברבעון הבא', taskTitle: 'תיאום הרשמה להכשרה בניהול פרויקטים', status: 'new', priority: 1, assignee: 'רועי לוי', due: daysFromNow(75), dueCurrent: daysFromNow(75), log: [] },
  ],
  closing: 'בברכה,',
  signerName: 'דנה כהן',
  tasks: [
    { title: 'תיאום פגישת מעקב הבאה', desc: 'קביעת מועד לפגישה האישית הבאה עם רועי.', status: 'new', priority: 1, assignee: 'דנה כהן', due: daysFromNow(45), dueCurrent: daysFromNow(45), log: [] },
  ],
};

// Impact/Effort prioritization of initiatives across all four HQ projects - a strategic
// planning tool distinct from Risks.jsx's severity/probability matrix.
export const MATRIX_EXAMPLE_TXT = `מטריצה: מטריצת תעדוף השפעה/מאמץ - יוזמות 2026
תווית עליונה: השפעה גבוהה
תווית תחתונה: השפעה נמוכה
תווית ימנית: מאמץ גבוה
תווית שמאלית: מאמץ נמוך
תצוגה: רבעים

[1] עלייה לאוויר של ה-CRM החדש | X: 35 | Y: 42 | משקל: 8 | צבע: סגול
תיאור: יוזמת הדגל של הרבעון - השפעה גבוהה על הארגון, אך דורשת מאמץ פיתוח ובדיקות נרחב.

[2] פריסה ארצית של מערכת התפעול | X: 20 | Y: 38 | משקל: 7 | צבע: ורוד
תיאור: השפעה גבוהה עם מאמץ בינוני, בזכות ההצלחה בפיילוט.

[3] מינוי אלופי אימוץ בכל מחלקה | X: -25 | Y: 20 | משקל: 4 | צבע: ירוק
תיאור: ניצחון קל - השפעה סבירה על קצב האימוץ במאמץ נמוך יחסית.

[4] הכשרת מדריכים נוספים | X: -15 | Y: 15 | משקל: 3 | צבע: כחול
תיאור: משפר את קצב פריסת ההדרכה במאמץ נמוך.

[5] גיוס תקציב תשתיות ענן לפיתוח המוצר | X: 30 | Y: -10 | משקל: 5 | צבע: כתום
תיאור: מאמץ בירוקרטי גבוה מול השפעה מוגבלת בטווח הקצר.

[6] עדכון מדריך המשתמש הקצה | X: -30 | Y: -15 | משקל: 2 | צבע: אפור
תיאור: שיפור נחמד אך לא קריטי - השפעה נמוכה ומאמץ נמוך.

[7] סקר אבטחת מידע ל-CRM | X: 15 | Y: 25 | משקל: 6 | צבע: אדום
תיאור: נדרש לפני עלייה לאוויר - השפעה משמעותית על סיכון הפרויקט.
`;
