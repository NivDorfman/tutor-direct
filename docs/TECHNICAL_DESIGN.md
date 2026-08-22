# מסמך תכנון טכני וארכיטקטורה - TECHNICAL DESIGN
## פלטפורמת TutorDirect - Full-Stack Next.js Application Architecture

---

## 1. ארכיטקטורת המערכת (Full-Stack Next.js Architecture)

המערכת בנויה בארכיטקטורת **Full-Stack** מודרנית מבוססת **Next.js (App Router)** ו-**TypeScript**, המפרידה באופן מוחלט בין תצוגת הלקוח הריאקטיבית לבין לוגיקת השרת ואבטחת המידע:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    CLIENT-SIDE (Next.js Client Components)                │
│       React 19 + TypeScript + Tailwind CSS v4 + Lucide React + Motion     │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                 HTTPS / REST API / Supabase Client SDK
                                      │
┌─────────────────────────────────────▼─────────────────────────────────────┐
│                    SERVER-SIDE (Next.js Route Handlers)                   │
│      Stateless Serverless Execution Environment (Vercel / Cloud Run)      │
│                                                                           │
│   ├── POST /api/ai-consult ──> Google GenAI SDK (Gemini 3.5 Flash)        │
│   └── POST /api/send-otp   ──> Nodemailer (Secure SMTP Email Delivery)    │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                   PostgreSQL Connection / REST / RLS
                                      │
┌─────────────────────────────────────▼─────────────────────────────────────┐
│                      DATABASE & PERSISTENCE LAYER                         │
│         Supabase Cloud (PostgreSQL) + Client LocalStorage (Offline Cache) │
└───────────────────────────────────────────────────────────────────────────┘
```

### החלטות טכנולוגיות מרכזיות (Tech Stack):

1. **Client-Side Framework (צד לקוח):**
   * **Next.js App Router & React 19:** שימוש ברכיבי לקוח (`'use client'`) עבור אינטראקטיביות וניהול State מקומי, לצד טעינה ראשונית אופטימלית.
   * **Tailwind CSS v4:** עיצוב מודרני מבוסס Utility Classes בלבד, ללא קובצי CSS נפרדים או ספריות UI כבדות.
   * **Lucide React:** ספריית אייקונים וקטוריים אחידה.
   * **Motion:** אנימציות עדינות ומעברי מסכים.

2. **Server-Side & Route Handlers (צד שרת):**
   * **Next.js Route Handlers (`app/api/*`):** שרת Stateless מאובטח שאינו חושף מפתחות סודיים לצד הלקוח.
   * **Google GenAI SDK (`@google/genai`):** ממשק רשמי ומודרני לחיבור אל מודל **Gemini 3.5 Flash**.
   * **Nodemailer:** שירות מאובטח לשליחת קודי OTP במייל דרך שרתי SMTP מוגדרים.

3. **שכבת מסד הנתונים והשמירה (Data & Persistence Layer):**
   * **Supabase (PostgreSQL):** מסד נתונים רלציוני ענן מאובטח עם מנגנון Row Level Security (RLS).
   * **Hybrid Persistence Model:** סנכרון דו-כיווני חכם בין Supabase ל-LocalStorage, המאפשר לאפליקציה לעבוד בצורה רציפה (Offline-First Resilience) גם אם יש ניתוק זמני או שמשתני הסביבה טרם הוגדרו.

---

## 2. סכמת בסיס הנתונים (Database Schema - PostgreSQL)

בסיס הנתונים ב-Supabase מורכב מ-7 טבלאות רלציוניות עם קשרי גומלין (Foreign Keys) ואינדקסים מותאמים לביצועים:

### א. טבלת משתמשים (`users`)
מחזיקה את כל המשתמשים הרשומים במערכת (תלמידים ומורים).

| עמודה | טיפוס נתונים | הגבלות / ברירת מחדל | תיאור |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | מזהה ייחודי של המשתמש |
| `name` | `VARCHAR(120)` | Not Null | שם מלא של המשתמש |
| `email` | `VARCHAR(180)` | Not Null, Unique, Lowercase | כתובת אימייל ייחודית |
| `role` | `VARCHAR(20)` | Not Null, Check (`role` in ('student', 'teacher')) | סוג התפקיד |
| `phone` | `VARCHAR(30)` | Nullable | מספר טלפון ליצירת קשר |
| `avatar_url`| `TEXT` | Nullable | קישור לתמונת הפרופיל |
| `created_at`| `TIMESTAMPTZ`| Default: `NOW()` | תאריך יצירת החשבון |

---

### ב. טבלת מורים (`tutors`)
מרחיבה את נתוני הפרופיל עבור משתמשים בעלי תפקיד מורה (`role = 'teacher'`). קשר 1:1 מול טבלת `users`.

| עמודה | טיפוס נתונים | הגבלות / ברירת מחדל | תיאור |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, FK (`users.id` ON DELETE CASCADE) | מזהה המורה (זהה ל-`users.id`) |
| `subject` | `VARCHAR(100)` | Not Null | תחום הוראה עיקרי (למשל: מתמטיקה) |
| `price` | `INTEGER` | Not Null, Check (`price` >= 0) | מחיר לשעה בש"ח |
| `rating` | `NUMERIC(3,2)` | Not Null, Default: `5.0` | דירוג משוקלל ממוצע |
| `bio` | `TEXT` | Not Null | ביוגרפיה ותיאור אישי |
| `education` | `VARCHAR(255)` | Not Null | רקע אקדמי והשכלה |
| `experience`| `VARCHAR(255)` | Not Null | שנות ניסיון בהוראה |
| `levels` | `TEXT[]` | Not Null, Default: `'{}'` | מערך רמות לימוד (חטיבה, תיכון וכו') |
| `created_at`| `TIMESTAMPTZ`| Default: `NOW()` | תאריך פתיחת כרטיס מורה |

---

### ג. טבלת חלונות זמן (`slots` / `time_slots`)
ניהול זמינות המורה לשיעורים פרטיים. קשר 1:N מול מורה.

| עמודה | טיפוס נתונים | הגבלות / ברירת מחדל | תיאור |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | מזהה חלון הזמן |
| `tutor_id` | `UUID` | Not Null, FK (`tutors.id` ON DELETE CASCADE) | המורה בעל חלון הזמן |
| `day` | `VARCHAR(50)` | Not Null | יום בשבוע (למשל: 'יום א׳') |
| `time` | `VARCHAR(50)` | Not Null | טווח שעות (למשל: '16:00 - 17:00') |
| `is_booked` | `BOOLEAN` | Not Null, Default: `FALSE` | האם השיעור מוזמן |

---

### ד. טבלת ביקורות ודירוגים (`reviews`)
חוות דעת ודירוגים שכתבו תלמידים על מורים. קשר N:1 מול מורה.

| עמודה | טיפוס נתונים | הגבלות / ברירת מחדל | תיאור |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | מזהה הביקורת |
| `tutor_id` | `UUID` | Not Null, FK (`tutors.id` ON DELETE CASCADE) | המורה שקיבל את הביקורת |
| `student_id`| `UUID` | Nullable, FK (`users.id` ON DELETE SET NULL) | התלמיד שכתב את הביקורת |
| `student_name`| `VARCHAR(100)`| Not Null | שם הכותב (או 'תלמיד אנונימי') |
| `rating` | `INTEGER` | Not Null, Check (`rating` BETWEEN 1 AND 5) | דירוג בכוכבים (1-5) |
| `comment` | `TEXT` | Not Null | תוכן חוות הדעת |
| `date` | `VARCHAR(30)` | Not Null | תאריך כתיבת הביקורת |
| `is_anonymous`| `BOOLEAN` | Not Null, Default: `FALSE` | האם פורסם כאנונימי |

---

### ה. טבלת שיעורים מוזמנים (`bookings`)
תיעוד שיעורים שנקבעו בין תלמידים למורים.

| עמודה | טיפוס נתונים | הגבלות / ברירת מחדל | תיאור |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | מזהה ההזמנה |
| `tutor_id` | `UUID` | Not Null, FK (`tutors.id`) | מזהה המורה |
| `tutor_name`| `VARCHAR(120)` | Not Null | שם המורה |
| `student_name`| `VARCHAR(120)`| Not Null | שם התלמיד |
| `student_email`| `VARCHAR(180)`| Not Null | אימייל התלמיד |
| `subject` | `VARCHAR(100)` | Not Null | מקצוע השיעור |
| `slot_id` | `UUID` | Nullable, FK (`slots.id`) | חלון הזמן שנבחר |
| `note` | `TEXT` | Nullable | הערות ובקשות מיוחדות מהתלמיד |
| `status` | `VARCHAR(30)` | Not Null, Default: `'ממתין'` | סטטוס ('ממתין', 'אושר', 'בוטל') |
| `created_at`| `TIMESTAMPTZ`| Default: `NOW()` | מועד ביצוע ההזמנה |

---

### ו. טבלאות שיחות והודעות צ'אט (`conversations`, `messages`)
ניהול תקשורת ישירה בין תלמיד למורה.

* **`conversations`**:
  * `id`: `UUID` (PK)
  * `tutor_id`: `UUID` (FK `users.id`)
  * `student_id`: `UUID` (FK `users.id`)
  * `updated_at`: `TIMESTAMPTZ`
* **`messages`**:
  * `id`: `UUID` (PK)
  * `conversation_id`: `UUID` (FK `conversations.id` ON DELETE CASCADE)
  * `sender_id`: `UUID` (FK `users.id`)
  * `sender_role`: `VARCHAR(20)` ('student' / 'teacher')
  * `text`: `TEXT` (תוכן ההודעה)
  * `created_at`: `TIMESTAMPTZ`

---

## 3. פירוט ה-API ו-Route Handlers

כל נקודות הקצה ממומשות כ-**Next.js Route Handlers** ומאובטחות בצד השרת:

### 1. `POST /api/ai-consult`
מנהל את התקשורת מול מודל **Gemini 3.5 Flash** של Google GenAI עבור יועץ הלימודים "איידן".

* **כתובת:** `/api/ai-consult`
* **מתודה:** `POST`
* **משתני סביבה בשימוש:** `GEMINI_API_KEY` (סודי, צד שרת בלבד)
* **מבנה גוף הבקשה (Request Body):**
```json
{
  "messages": [
    { "sender": "user", "text": "אני צריך עזרה לקראת בגרות 5 יחידות במתמטיקה" }
  ],
  "studentName": "דניאל",
  "tutorsList": [
    {
      "id": "tutor-123",
      "name": "שירה כהן",
      "subject": "מתמטיקה",
      "price": 140,
      "rating": 4.9,
      "levels": ["תיכון", "5 יח״ל"],
      "bio": "סטודנטית להנדסת חשמל בטכניון..."
    }
  ],
  "subjects": ["מתמטיקה", "פיזיקה", "מדעי המחשב"]
}
```

* **מבנה התשובה (Response Body - 200 OK):**
```json
{
  "text": "שלום דניאל! להכנה מצוינת לבגרות 5 יחידות במתמטיקה, אני ממליץ בחום על **שירה כהן**..."
}
```

---

### 2. `POST /api/send-otp`
שולח קוד אימות חד-פעמי (OTP) לדוא"ל של המשתמש לצורך שחזור סיסמה מאובטח.

* **כתובת:** `/api/send-otp`
* **מתודה:** `POST`
* **משתני סביבה בשימוש:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
* **מבנה גוף הבקשה (Request Body):**
```json
{
  "email": "student@example.com",
  "code": "849201",
  "name": "דניאל ישראלי"
}
```

* **מבנה התשובה (Response Body - 200 OK):**
```json
{
  "success": true,
  "smtpConfigured": true
}
```
*(במידה ומשתני ה-SMTP אינם מוגדרים בסביבה, הנתיב מבצע Fallback חלק למצב סימולציה מבוקר ומחזיר `smtpConfigured: false` כדי לאפשר בדיקה חלקה).*

---

## 4. ארגון קוד ומבנה התיקיות (Project Directory Tree)

```
tutor-direct/
├── docs/                               # מסמכי תיעוד ותכנון מלאים
│   ├── PRD.md                          # אפיון מוצר ודרישות עסקיות
│   ├── TECHNICAL_DESIGN.md             # מסמך תכנון טכני וארכיטקטורה
│   ├── SECURITY.md                     # מדיניות אבטחה, RBAC ו-RLS
│   ├── TESTING.md                      # תוכנית בדיקות, מקרי קצה ו-Vitest
│   └── SCALABILITY.md                  # אסטרטגיית סקייל וביצועים
├── src/
│   ├── app/                            # Next.js App Router (App Directory)
│   │   ├── api/
│   │   │   ├── ai-consult/
│   │   │   │   └── route.ts            # שרת AI עם Google GenAI SDK
│   │   │   └── send-otp/
│   │   │       └── route.ts            # שרת שליחת קוד OTP במייל
│   │   ├── layout.tsx                  # Root Layout עם תמיכה מלאה ב-RTL
│   │   └── page.tsx                    # עמוד הבית המרכזי
│   ├── components/                     # קומפוננטות React מודולריות
│   │   ├── AiConsultantModal.tsx       # מודל יועץ ה-AI ("איידן")
│   │   ├── AuthScreen.tsx              # מסך הזדהות, הרשמה בשני שלבים ואיפוס סיסמה
│   │   ├── BecomeTutorModal.tsx        # מודל הצטרפות מורה חדש
│   │   ├── ChatWidget.tsx              # ווידג'ט צ'אט חי בין תלמידים ומורים
│   │   ├── ForceCompleteProfileModal.tsx # השלמת פרופיל מורה חובה
│   │   ├── ManageSlotsModal.tsx        # יומן ניהול מועדים פנויים למורים
│   │   ├── MyBookingsModal.tsx         # מסוף מעקב שיעורים והזמנות
│   │   ├── TeacherSettingsModal.tsx    # הגדרות מורה, שינוי מחיר ופרטים
│   │   ├── TutorCard.tsx               # כרטיס מורה ברשימת המורים
│   │   ├── TutorDetailDrawer.tsx       # תפריט צד מפורט למורה (תיאום, ביקורות)
│   │   └── UserProfileModal.tsx        # עדכון פרופיל משתמש ואוואטר
│   ├── lib/                            # לוגיקה עסקית ואינטגרציות
│   │   ├── businessLogic.ts            # ולידציות, אלגוריתמי סינון והזמנות
│   │   └── supabase.ts                 # אתחול קליינט Supabase מאובטח
│   ├── __tests__/                      # בדיקות יחידה ואינטגרציה אוטומטיות
│   │   └── businessLogic.test.ts       # סוויטת בדיקות מלאה ב-Vitest
│   ├── initialData.ts                  # נתוני מורים ומקצועות התחלתיים
│   ├── types.ts                        # הגדרות טיפוסים קשיחות (TypeScript Interfaces)
│   └── index.css                       # ייבוא Tailwind CSS v4
├── .env.example                        # דוגמת משתני סביבה
├── next.config.mjs                     # קונפיגורציית Next.js
├── package.json                        # תלויות וסקריפטים
└── tsconfig.json                       # הגדרות TypeScript קשיחות
```
