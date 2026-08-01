// Ready-made phrases offered for פגישה אישית's line sections.
// `background`'s presets are a function, not a plain array — each phrase re-composes with the
// person's name from chapter 1's "פתיח" field, so the manager doesn't have to retype it into
// every background line ("ישראל בן/בת ___", "ישראל הצטרף/ה לארגון לפני ___", …).
export function backgroundPresets(name) {
  const n = (name || '').trim() || 'שם';
  return [
    `${n} בן/בת `,
    `${n} הצטרף/ה לארגון לפני `,
    `${n} משרת/ת בתת ארגון `,
    `${n} בתפקיד הנוכחי מזה `,
    `${n} מתגורר/ת ב`,
  ];
}
export const PRESETS = {
  needs: [
    'נדרשת התאמת שעות עבודה',
    'נדרש ציוד או תמיכה נוספת',
    'רגישות למועדים אישיים',
  ],
  issues: [
    'מתמודד/ת עם אתגר אישי המשפיע על העבודה',
    'יחסים בצוות שדורשים תשומת לב',
    'עומס או שחיקה בתקופה האחרונה',
  ],
  requests: [
    'בקשה לגמישות בשעות העבודה',
    'בקשה להכשרה או פיתוח מקצועי',
    'בקשה למעבר תפקיד או צוות',
  ],
  hobbies: [
    'ספורט',
    'קריאה',
    'מוזיקה',
    'טיולים',
  ],
  goals: [
    'בתקופה הקרובה מיקוד בהסמכה מהירה',
    'כניסה לעולמות התוכן',
    'ציפיות - הגדלת ראש, גיבוש חברתי, הובלת נושא',
    'התפתחות אישית מקצועית, התפתחות ניהולית',
    'מדד להצלחה - עמידה ב-___ תוך זמן מסוים',
  ],
};
