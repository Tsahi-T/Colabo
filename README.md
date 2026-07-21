# טורבו 🏎️

סביבת עבודה משותפת בזמן אמת לרשתות סגורות — פותחים כלי, משתפים קישור, עובדים יחד.

**הכלים**: מסמך (מעבד תמלילים), לוח חשיבה, ציר זמן, ניהול סיכונים, ניתוח SWOT, ניהול משימות, שמש אסוציאציות, צ'אט.

**יכולות**: עריכה משותפת חיה (CRDT), סמנים צבעוניים של משתתפים, RTL מלא, מצב כהה, תמיכת מגע, קישורי עריכה/צפייה נפרדים, ייצוא ל-Word/PDF/CSV/TXT וטעינה חוזרת, שמירה אוטומטית. ללא תלות באינטרנט בזמן ריצה.

**סטאק**: React + TipTap + Yjs · Node.js + Hocuspocus · PostgreSQL (או קבצים מקומיים בפיתוח).

## הרצה מקומית (פיתוח)

```bash
npm install && cd client && npm install && cd ..
npm run dev              # שרת על 3001
cd client && npm run dev # קליינט על 5173 (טרמינל שני)
```

פותחים http://localhost:5173 — בלי DATABASE_URL הנתונים נשמרים ב-`./data`.

## הרצה כ-container

```bash
docker build -t colabo .
docker run -p 3001:3001 -e DATABASE_URL='postgres://...' colabo
```

## פריסה ל-Render

הריפו כולל `render.yaml` (Blueprint): ב-Render בוחרים **New → Blueprint**, מחברים את הריפו — נוצרים אוטומטית שירות ווב + Postgres.

## פריסה ל-OpenShift (רשת סגורה)

1. בונים את התמונה בצד עם אינטרנט: `docker build -t colabo .`
2. מעבירים פנימה: `docker save colabo | gzip > colabo.tar.gz` → ברשת הסגורה `podman load` ודחיפה ל-registry הפנימי.
3. יוצרים secret עם פרטי ה-Postgres ומחילים את `openshift.yaml` (הוראות בראש הקובץ).

## משתני סביבה

| משתנה | ברירת מחדל | תיאור |
|---|---|---|
| `PORT` | 3001 | פורט השרת |
| `DATABASE_URL` | — | חיבור Postgres; בהיעדרו — אחסון קבצים מקומי |
| `PGSSL` | `require` | `false` לביטול SSL (למשל Postgres פנימי ב-OpenShift) |
