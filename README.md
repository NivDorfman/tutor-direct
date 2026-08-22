# TutorDirect - פלטפורמת תיאום מורים פרטיים חכמה 🚀
**פרויקט סיום בקורס טכנולוגיות אינטרנט | RUNI CS 2026**

---

### 🌐 קישורים מרכזיים (Live Links)
* **🔗 קישור לאתר החי (Live Demo):** [https://tutor-direct.vercel.app](https://tutor-direct.vercel.app)
* **💻 קישור למאגר הקוד (GitHub Repository):** [https://github.com/NivDorfman/tutor-direct](https://github.com/NivDorfman/tutor-direct)

---

## 🎯 סקירה כללית וערך עסקי
פלטפורמת **TutorDirect** היא פלטפורמת Marketplace מודרנית ואינטואיטיבית שנועדה לחבר באופן ישיר, מהיר ושקוף בין מורים פרטיים לבין תלמידים וסטודנטים:
* **לתלמידים:** מאפשרת סינון מתקדם (לפי מקצוע, מחיר מקסימלי, דירוג ורמת לימוד), תיאום שיעור מיידי מתוך לוח הזמנים של המורה, צ'אט ישיר, ושימוש ב**איידן (Aiden)** - יועץ לימודים חכם מבוסס בינה מלאכותית (Gemini 3.5 Flash) שעוזר למפות קשיים ולהמליץ על מורים מתאימים.
* **למורים:** מאפשרת ניהול פרופיל מקצועי מורחב, קביעת מחיר עצמאית, ניהול חלונות זמן פנויים (Time Slots), צפייה בשיעורים שהוזמנו ומענה לתלמידים.

---

## 🛠️ ארכיטקטורה וטכנולוגיות (Tech Stack)
האפליקציה בנויה בארכיטקטורת **Full-Stack** מודרנית:
1. **Frontend:** React 19, Next.js (App Router), TypeScript, Tailwind CSS v4, Lucide React, Motion.
2. **Backend & APIs:** Next.js Route Handlers (`/api/ai-consult`, `/api/send-otp`) ללא מצב (Stateless Serverless) המאובטחים בצד השרת.
3. **AI Integration:** ה-SDK הרשמי `@google/genai` עם מודל **Gemini 3.5 Flash** לשיחות ייעוץ אקדמיות מותאמות אישית בזמן אמת.
4. **Database & Storage:** מסד נתונים רלציוני **Supabase (PostgreSQL)** עם חוקי אבטחה קשיחים ברמת השורה (Row Level Security - RLS), בשילוב מנגנון סנכרון ו-State מקומי (LocalStorage) לעבודה אמינה ב-Offline-First.
5. **Testing & QA:** סוויטת בדיקות אוטומטית מלאה באמצעות **Vitest**.

---

## 📁 מסמכי התיעוד והתכנון (Documentation Suite)
כלל מסמכי האפיון, התכנון, האבטחה והבדיקות מרוכזים ומפורטים בתיקיית `docs/`:

| מסמך | תוכן עיקרי | קישור |
| :--- | :--- | :--- |
| **`docs/PRD.md`** | הגדרת המוצר, צורך עסקי, קהלי יעד (תלמיד ומורה), תרשימי זרימה ופיצ'רים מרכזיים. | [למסמך PRD](./docs/PRD.md) |
| **`docs/TECHNICAL_DESIGN.md`** | ארכיטקטורת Full-Stack ב-Next.js, סכמת בסיס הנתונים (טבלאות users, tutors, slots וכו'), פירוט Route Handlers. | [למסמך Technical Design](./docs/TECHNICAL_DESIGN.md) |
| **`docs/SECURITY.md`** | מודל אבטחה, שמירת מפתחות API בצד השרת, בקרת הרשאות (RBAC), חוקי RLS ב-Supabase ומניעת חשיפת מידע. | [למסמך Security](./docs/SECURITY.md) |
| **`docs/TESTING.md`** | תוכנית הבדיקות המלאה, בדיקות יחידה ואינטגרציה ב-Vitest (`businessLogic.test.ts`), מקרי קצה ואימות הרשאות. | [למסמך Testing](./docs/TESTING.md) |
| **`docs/SCALABILITY.md`** | אסטרטגיית סקייל וביצועים, אינדקסים במסד הנתונים, Stateless API ב-Vercel וחיסכון ב-Tokens מול ה-AI. | [למסמך Scalability](./docs/SCALABILITY.md) |

---

## 📁 מבנה התיקיות של הפרויקט (Project Structure)
```
tutor-direct/
├── docs/                               # מסמכי אפיון ותכנון מפורטים (5 מסמכי חובה)
│   ├── PRD.md                          # אפיון מוצר וצרכים עסקיים
│   ├── TECHNICAL_DESIGN.md             # תכנון טכני וארכיטקטורת Next.js
│   ├── SECURITY.md                     # מדיניות אבטחה, RBAC ו-RLS
│   ├── TESTING.md                      # תוכנית בדיקות וסוויטת Vitest
│   └── SCALABILITY.md                  # אסטרטגיית סקייל וביצועים
├── src/
│   ├── app/                            # Next.js App Router (Full-Stack Routes)
│   │   ├── api/
│   │   │   ├── ai-consult/
│   │   │   │   └── route.ts            # קריאות שרת מאובטחות ל-Gemini API
│   │   │   └── send-otp/
│   │   │       └── route.ts            # שרת שליחת קוד אימות חד-פעמי במייל
│   │   ├── layout.tsx                  # Root Layout של האפליקציה (RTL Support)
│   │   └── page.tsx                    # עמוד הבית הראשי של הפלטפורמה
│   ├── components/                     # קומפוננטות React רב-פעמיות ומודלים
│   │   ├── AiConsultantModal.tsx       # מודל יועץ ה-AI החכם ("איידן")
│   │   ├── AuthScreen.tsx              # מסך הרשמה/התחברות, בחירת תפקיד ושחזור סיסמה
│   │   ├── BecomeTutorModal.tsx        # רישום מורה חדש
│   │   ├── ChatWidget.tsx              # מערכת צ'אט והודעות ישירות בזמן אמת
│   │   ├── ForceCompleteProfileModal.tsx # השלמת פרטי מורה חובה
│   │   ├── ManageSlotsModal.tsx        # ניהול חלונות זמן פנויים (למורים)
│   │   ├── MyBookingsModal.tsx         # ניהול שיעורים והזמנות קרובות
│   │   ├── TeacherSettingsModal.tsx    # הגדרות מורה (שינוי מחיר, מקצוע ורמות)
│   │   ├── TutorCard.tsx               # כרטיס תצוגת מורה
│   │   ├── TutorDetailDrawer.tsx       # תפריט צד מפורט (תיאום שיעור וביקורות)
│   │   └── UserProfileModal.tsx        # עדכון פרופיל ותמונת משתמש
│   ├── lib/                            # לוגיקה עסקית ואינטגרציות
│   │   ├── businessLogic.ts            # ולידציות, אלגוריתמי סינון ותיאום
│   │   └── supabase.ts                 # קליינט Supabase מאובטח
│   ├── __tests__/                      # בדיקות אוטומטיות
│   │   └── businessLogic.test.ts       # סוויטת בדיקות מלאה ב-Vitest
│   ├── initialData.ts                  # נתוני מורים ראשוניים לדוגמה
│   ├── types.ts                        # הגדרות טיפוסים קשיחות (TypeScript Interfaces)
│   └── index.css                       # הגדרות עיצוב ו-Tailwind CSS v4
├── .env.example                        # דוגמת משתני סביבה
├── next.config.mjs                     # קונפיגורציית Next.js
├── package.json                        # תלויות, ספריות וסקריפטים
└── tsconfig.json                       # הגדרות TypeScript
```

---

## 🚀 הוראות הרצה מקומיות (Local Setup)

1. **התקנת תלויות וספריות:**
   ```bash
   npm install
   ```

2. **הגדרת משתני סביבה:**
   צרו קובץ `.env` בתיקיית השורש לפי הדוגמה ב-`.env.example`:
   ```env
   # Supabase Configurations
   NEXT_PUBLIC_SUPABASE_URL=https://xkijcicyjzdrnruoasyy.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Gemini API Key (Server-side secret)
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

3. **הרצה במצב פיתוח (Next.js Dev Server):**
   ```bash
   npm run dev
   ```
   האפליקציה תהיה זמינה בכתובת: `http://localhost:3000`

4. **הרצת סוויטת הבדיקות (Vitest):**
   ```bash
   npm run test
   ```

5. **בנייה לריצה בייצור (Production Build):**
   ```bash
   npm run build
   npm run start
   ```

---

## 📈 מיפוי דרישות הפרויקט (מענה ל-12 שלבי התרגיל)

| # | דרישת הקורס | מימוש בפועל ב-TutorDirect | מיקום בקוד ובתיעוד |
|:---:|:---|:---|:---|
| **1** | **ערך עסקי ופתרון בעיה** | מערכת Marketplace לחיבור מורים ותלמידים, מונעת סרבול וחוסכת זמן. | [`docs/PRD.md`](./docs/PRD.md) |
| **2** | **מסמך אפיון מוצר** | הגדרת הבעיה, קהלי יעד (תלמיד ומורה), ותרשימי זרימה מלאים. | [`docs/PRD.md`](./docs/PRD.md) |
| **3** | **תכנון ארכיטקטורה** | ארכיטקטורת Full-Stack מבוססת Next.js App Router, Route Handlers ו-Supabase. | [`docs/TECHNICAL_DESIGN.md`](./docs/TECHNICAL_DESIGN.md) |
| **4** | **תכנון טכני מפורט** | פירוט מלא של Database Schema (7 טבלאות רלציוניות), API וקוד. | [`docs/TECHNICAL_DESIGN.md`](./docs/TECHNICAL_DESIGN.md) |
| **5** | **מימוש ב-Next.js ו-TypeScript** | פותח ב-**Next.js App Router**, טיפוסים קשיחים ב-**TypeScript**, ועיצוב ב-**Tailwind CSS**. | `/src/app/`, `/src/components/` |
| **6** | **אפיון בדיקות ומקרי קצה** | תוכנית בדיקות לכללי העסק, ולידציות קלט, מקרי קצה והרשאות. | [`docs/TESTING.md`](./docs/TESTING.md) |
| **7** | **מימוש בדיקות אוטומטיות** | סוויטת בדיקות יחידה ואינטגרציה מלאה ב-Vitest המכסה 100% מהלוגיקה העסקית. | [`src/__tests__/businessLogic.test.ts`](./src/__tests__/businessLogic.test.ts) |
| **8** | **אסטרטגיית סקייל וביצועים** | ארכיטקטורת Stateless API, אינדקסים ב-PostgreSQL, ואופטימיזציית Tokens מול Gemini. | [`docs/SCALABILITY.md`](./docs/SCALABILITY.md) |
| **9** | **אבטחה והגנת מידע** | אבטחת מפתח ה-Gemini בצד שרת בלבד, RBAC, חוקי RLS ב-Supabase וקוד OTP מאובטח. | [`docs/SECURITY.md`](./docs/SECURITY.md) |
| **10** | **העלאה לאוויר וייצור** | פריסה חיה פעילה ב-Vercel עם חיבור ענן למסד נתונים Supabase. | [Live Demo](https://tutor-direct.vercel.app) |
| **11** | **שימוש בסוכני קידוד** | הפרויקט תוכנן ונבנה בסיוע סוכן קידוד איטרטיבי, מונחה בדיקות וארכיטקטורה. | `docs/`, `src/` |
| **12** | **הכנה להצגת המוצר** | מסמכי אפיון עשירים, מבנה ברור ומענה מקיף להצגה אקדמית ומקצועית. | כלל מסמכי `docs/` |
