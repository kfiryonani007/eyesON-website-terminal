# EYESON — אתר תדמית (עברית / RTL)

אתר סטטי נקי — HTML + CSS + JS בלבד, ללא תהליך build. אפשר להעלות לכל אחסון סטטי
(Netlify / Vercel / Cloudflare Pages / cPanel רגיל).

## הרצה מקומית

```bash
npx serve .
```

או פשוט לפתוח את `index.html` בדפדפן.

## מבנה העמודים

| קובץ | תוכן |
|---|---|
| `index.html` | בית — הירו, לקוחות מספרים, מי אנחנו, איך זה עובד, טיזרים, **טופס ניסיון חינם בתחתית** |
| `service.html` | השירות — מה כולל, הבעיה, טבלת השוואה, איך זה עובד |
| `screen.html` | EyesOn Screen — תכונות, callout, CTA |
| `clients.html` | לקוחות — המלצות, מקרה בוחן (case study) |
| `contact.html` | צור קשר — טופס מלא + פרטי קשר + שעות פעילות |
| `privacy.html` · `terms.html` · `accessibility.html` | עמודים משפטיים (שלד — ראו TODO) |

## מבנה קבצים

```
*.html                 — כל העמודים
css/styles.css         — עיצוב מלא, משתני מותג בראש הקובץ
js/main.js             — גלילה, מונים, תפריט מובייל, עינית עכבר, טופס
assets/logos/          — קבצי הלוגו המקוריים (SVG)
assets/images/         — תמונות סטוק (Unsplash, חינמיות)
assets/hero/frames/    — רצף פריימים להירו (frame-001…030.jpg), נשלט ע"י גלילה
assets/favicon.svg     — אייקון המותג
```

### תמונות (`assets/images/`)

תמונות סטוק חינמיות מ-Unsplash (רישיון חופשי לשימוש מסחרי). **כל התמונות נבדקו ויזואלית**
לאחר שהתגלו כמה תמונות שהכיתוב שלהן ב-Unsplash היה מטעה (מיצג אמנות, חדר מכונות של אונייה,
תחנת כוח ישנה) — אלה הוסרו.

| קובץ | שימוש |
|---|---|
| `control-room-team.jpg` | index — באנר "מי אנחנו" · screen.html — רקע הירו. **תמונה שסופקה ע"י הלקוח** (לא סטוק). |
| `store-counter.jpg` | index — טיזר הבעיה |
| `pos-terminal.jpg` | index — טיזר EyesOn Screen |
| `screen-camera-view.jpg` | screen.html — split (מצלמה עילית מעל הקופה). **תמונה שסופקה ע"י הלקוח.** |
| `screen-pos-compare.jpg` | screen.html — "כך זה נראה בפועל" (תצוגה משולבת קופה+מצלמה). **צילום מסך אמיתי מהמערכת, סופק ע"י הלקוח.** |
| `cameras-pair.jpg` | service.html — רקע הירו |
| `cameras-assorted.jpg` | clients.html — רקע הירו |
| `camera-night.jpg` | clients.html — רקע מסגרת מקרה הבוחן |
| `camera-wall.jpg` | contact.html — רקע הירו |

## מה הלקוח צריך להחליף (TODO)

מסומנים גם בהערות `TODO(client)` בתוך קבצי ה-HTML:

1. **וידאו ההירו** — `assets/hero/frames/` הם 30 פריימים שחולצו מקליפ הדגמה. ההירו
   **לא מנגן לבד**: הוא נעצר במקום (sticky) והגלילה היא שמריצה את הפריימים; כשהקליפ
   נגמר הגלילה משתחררת וממשיכה באתר. להחלפה בצילום אמיתי מהעסק:
   ```bash
   ffmpeg -y -i input.mp4 -vf "fps=3,scale=900:-1:flags=lanczos" -q:v 4 assets/hero/frames/frame-%03d.jpg
   ```
   ולעדכן את `data-frame-count` על `<div id="heroScrub">` ב-index.html.
2. **וידאו Case Study** (clients.html) — להחליף את `.case-frame` ב-`<video>` עם poster אמיתי.
3. **תמונות אמיתיות** — מומלץ להחליף את שאר תמונות הסטוק (מסומנות למעלה) בצילומים
   אמיתיים של החמ"ל/העסקים, כפי שכבר נעשה עבור עמוד EyesOn Screen.
4. **טופס** (js/main.js) — כרגע נפתחת תוכנת המייל של הגולש (`mailto:`) עם כל השדות ממולאים.
   **מומלץ לחבר endpoint אמיתי** (Formspree / Netlify Forms / פונקציית שרת).
5. **רשתות חברתיות** (footer) — הקישורים כרגע גנריים (Instagram / TikTok); להחליף לפרופילים האמיתיים.
6. **עמודים משפטיים** — `privacy.html`, `terms.html`, `accessibility.html` הם **שלד בלבד
   ואינם ייעוץ משפטי**. חובה להעביר לעורך/ת דין. הצהרת נגישות היא **חובה חוקית בישראל**.
7. **OG image** — מומלץ להחליף ב-PNG/JPG בגודל 1200×630.

## מותג ועיצוב

- צבעים (משתני CSS בראש `styles.css`): לבן `#FFFFFF`, אפור `#A8A8A7`, אדום `#D40F14`, שחור `#060500`.
- האדום מיושם כ**מערכת** ולא כצבע שטוח: גרדיאנט (`--grad-red`), זוהר (`--glow-red`)
  וטקסט גרדיאנטי (`.accent-grad`) — כדי לתת מראה פרימיום.
- פונטים: Montserrat (לטינית/לוגו) + Assistant (עברית) — מ-Google Fonts.
- **עינית עכבר**: עדשה אדומה שרודפת אחרי הסמן, האישון נוטה לכיוון התנועה
  (`js/main.js` → "eye cursor follower"). פעיל רק בדסקטופ, מכובה ב-`prefers-reduced-motion`.
