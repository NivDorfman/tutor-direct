# מסמך אבטחה והגנת מידע - SECURITY SPECIFICATION
## פלטפורמת TutorDirect - מודל אבטחה, בקרת הרשאות (RBAC) והגנה על מפתחות

---

## 1. עקרון בידוד המפתחות והסודות (API Key Security & Isolation)

הפלטפורמה פועלת על פי עקרון ה-**Zero Trust Client**. כל מפתחות ה-API ופרטי ההתחברות לשירותי צד שלישי שמורים ומעובדים אך ורק בצד השרת:

```
┌──────────────────────────────────────┐
│       דפדפן / צד לקוח (Browser)      │
│  - אין גישה למפתחות API סודיים       │
│  - שולח בקשות ל-Route Handlers פנימיים│
└──────────────────┬───────────────────┘
                   │
         HTTPS / Internal API
                   │
┌──────────────────▼───────────────────┐
│     Next.js Server (Route Handlers)  │
│  - טוען `process.env.GEMINI_API_KEY` │
│  - טוען `process.env.SMTP_*`         │
│  - מבצע ולידציה וסניטציה של קלט      │
└──────────────────┬───────────────────┘
                   │
         Private API Requests
                   │
┌──────────────────▼───────────────────┐
│     Google GenAI API (Gemini Cloud)  │
└──────────────────────────────────────┘
```

### כללי אבטחת מפתחות שיושמו בקוד:
1. **מפתח ה-Gemini API (`GEMINI_API_KEY`):**
   * מוגדר ללא הקידומת `NEXT_PUBLIC_`.
   * נגיש אך ורק בתוך נתיב השרת המאובטח `src/app/api/ai-consult/route.ts`.
   * אינו נחשף לעולם לחבילת ה-JavaScript (Bundle) הנשלחת לדפדפן.
2. **משתני סביבה ל-Supabase:**
   * השימוש ב-`NEXT_PUBLIC_SUPABASE_URL` ו-`NEXT_PUBLIC_SUPABASE_ANON_KEY` מיועד למפתח הציבורי (Anon Key) בלבד, אשר פעולותיו מוגבלות ונאכפות ישירות על ידי מנגנון ה-RLS (Row Level Security) של בסיס הנתונים PostgreSQL.
   * קוד האתחול ב-`src/lib/supabase.ts` אינו מחזיק שום מפתחות קבועים בקוד (No Hardcoded Secrets) ומטפל בהיעדר משתנים בצורה אלגנטית ומאובטחת.

---

## 2. מודל בקרת גישה מבוסס תפקידים (Role-Based Access Control - RBAC)

המערכת מבדילה באופן חד בין שני סוגי תפקידים: **תלמיד (`student`)** ו-**מורה (`teacher`)**.

| פעולה / מסך במערכת | תלמיד (`student`) | מורה (`teacher`) | מנגנון אכיפה |
| :--- | :---: | :---: | :--- |
| **חיפוש וצפייה במורים** | ✅ מורשה | ✅ מורשה | פתוח לכל המשתמשים |
| **תיאום שיעור פרטי (Booking)** | ✅ מורשה | ❌ **חסום לחלוטין** | אלמנט התיאום מוסתר ב-Drawer ונחסם בלוגיקת ה-Booking |
| **כתיבת חוות דעת ודירוג** | ✅ מורשה | ❌ **חסום לחלוטין** | טופס הדירוג מוסתר ב-Drawer ונחסם ברמת הלוגיקה העסקית |
| **שימוש ביועץ ה-AI ("איידן")** | ✅ מורשה | ❌ **חסום** | כפתור היועץ והמודל זמינים לתלמידים בלבד |
| **ניהול חלונות זמן (Slots)** | ❌ חסום | ✅ **מורשה (רק לחלונות שלו)** | מורה יכול לערוך רק רשומות שבהן `tutor_id === user.id` |
| **עריכת תמחור ופרופיל מורה** | ❌ חסום | ✅ **מורשה (רק לפרופיל שלו)** | מודל הגדרות מורה נגיש אך ורק למורה המחובר |
| **מעקב אחר שיעורים והזמנות** | צפייה בשיעוריו | צפייה בשיעורים שהוזמנו אצלו | סינון מותאם לפי תפקיד ומזהה משתמש ב-`MyBookingsModal` |

---

## 3. חוקי אבטחה במסד הנתונים (Supabase Row Level Security - RLS)

בבסיס הנתונים PostgreSQL ב-Supabase הוגדרו חוקי RLS המבטיחים בידוד נתונים מוחלט גם ברמת ה-Database Engine:

```sql
-- הפעלת RLS על כלל הטבלאות
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 1. חוק משתמשים: כל אחד יכול לקרוא פרופילים בסיסיים, אך רק המשתמש יכול לעדכן את הפרופיל שלו
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- 2. חוק מורים: כולם יכולים לצפות ברשימת המורים, אך רק המורה יכול לערוך את כרטיס המורה שלו
CREATE POLICY "Anyone can view tutors" ON tutors FOR SELECT USING (true);
CREATE POLICY "Tutors can update own record" ON tutors
  FOR UPDATE USING (auth.uid() = id);

-- 3. חוק חלונות זמן: כולם יכולים לקרוא זמינות, רק המורה יכול להוסיף/למחוק את החלונות שלו
CREATE POLICY "Anyone can view slots" ON slots FOR SELECT USING (true);
CREATE POLICY "Tutors manage own slots" ON slots
  FOR ALL USING (auth.uid() = tutor_id);

-- 4. חוק ביקורות: כולם יכולים לקרוא, רק תלמיד מורשה להוסיף (ובתנאי שאינו המורה עצמו)
CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Students insert reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = student_id AND auth.uid() != tutor_id);

-- 5. חוק שיעורים מוזמנים: רק המורה הרלוונטי או התלמיד שהזמין יכולים לצפות בפרטי ההזמנה
CREATE POLICY "Booking participants access" ON bookings
  FOR SELECT USING (auth.uid() = tutor_id OR auth.uid()::text = student_email);

-- 6. חוק צ'אט: רק שולח או מקבל ההודעה יכולים לקרוא אותה (מניעת זליגת שיחות)
CREATE POLICY "Message participants access" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
```

---

## 4. מנגנון איפוס סיסמה מאובטח (Secure OTP Flow)

תהליך שחזור הסיסמה מיישם אמצעי הגנה מפני ניסיונות פריצה:
1. **קוד חד-פעמי אקראי:** יצירת קוד בן 6 ספרות אקראיות בעלות אנטרופיה גבוהה.
2. **תוקף מוגבל בזמן:** הקוד תקף ל-10 דקות בלבד.
3. **הגבלת ניסיונות (Rate Limiting):** מניעת שליחה חוזרת מרובה של קודים בפרק זמן קצר.
4. **ערוץ שרת מאובטח:** שליחת הקוד מתבצעת אך ורק דרך ה-Route Handler של השרת (`/api/send-otp`) באמצעות חיבור SMTP מוצפן (TLS/SSL).

---

## 5. ולידציית קלטים ומניעת התקפות נפוצות (Input Sanitization & Attack Prevention)

* **מניעת XSS (Cross-Site Scripting):** כל שדות הטקסט המוזנים (הערות שיעור, ביקורות, ביוגרפיה, הודעות צ'אט) מרונדרים דרך מנגנון ה-Escaping האוטומטי של React ונבדקים בקוד הלוגיקה העסקית (`src/lib/businessLogic.ts`).
* **מניעת Prompt Injection ב-AI:** פניות ליועץ ה-AI עוברות עיבוד בתוך שרת ה-Route Handler, כאשר הקונטקסט של המורים מוזרק בצורה מובנית (Structured JSON Prompt) וההוראות ליועץ ("איידן") מוגדרות כ-System Instructions קשיחות שלא ניתנות לדריסה על ידי הודעת המשתמש.
* **ולידציה קפדנית של מספרים וטווחי ערכים:** מחירי שיעורים מחויבים להיות מספרים שלמים חיוביים (`price >= 0`), מספרי טלפון נבדקים במבנה ישראלי תקין, ואורכי טקסט מוגבלים למניעת מתקפות DoS מבוססות Payload כבד.
