# מסמך סקייל, ביצועים ואופטימיזציה - SCALABILITY STRATEGY
## פלטפורמת TutorDirect - ארכיטקטורת עומסים, אינדקסים ואופטימיזציית AI

---

## 1. ארכיטקטורת שרת ללא מצב (Stateless Serverless Execution)

פלטפורמת **TutorDirect** בנויה להתמודד עם עומסי תנועה משתנים וריבוי משתמשים במקביל באמצעות ארכיטקטורת **Stateless Next.js Route Handlers** המתאימה לפריסה מיידית ב-**Vercel Serverless Functions** או ב-**Google Cloud Run**:

```
                                 ┌───────────────────────┐
                                 │   Global CDN / Edge   │
                                 │  (Static Assets & UI) │
                                 └───────────┬───────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │                                           │
             ┌─────────▼─────────┐                       ┌─────────▼─────────┐
             │ Next.js Instance  │                       │ Next.js Instance  │
             │   (Auto-scaled)   │                       │   (Auto-scaled)   │
             └─────────┬─────────┘                       └─────────┬─────────┘
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             │
                                   ┌─────────▼─────────┐
                                   │  Supabase Cloud   │
                                   │ (Connection Pool) │
                                   └───────────────────┘
```

### יתרונות הארכיטקטורה לעמידה בעומסים:
1. **סקייל אופקי אוטומטי (Auto-Scaling):** כל בקשה ל-Route Handler (`/api/ai-consult`, `/api/send-otp`) מעובדת כיחידה עצמאית ללא תלות בזיכרון פנימי של השרת (No in-memory session locks).
2. **זמני תגובה מהירים (Low Latency):** רכיבי ממשק המשתמש והנכסים הסטטיים מוגשים ישירות מ-Edge CDN קרוב למשתמש.
3. **ניהול חיבורי מסד נתונים (Connection Pooling):** עבודה עם Supabase PgBouncer המאפשרת לאלפי מופעי Serverless לתקשר עם מסד הנתונים ללא חריגה ממגבלת ה-Connections.

---

## 2. אסטרטגיית אינדקסים במסד הנתונים (Database Indexing Strategy)

כדי להבטיח ששאילתות הסינון, החיפוש והתיאום ירוצו בזמן של **O(log N)** או **O(1)** גם עם מאגר של מאות אלפי מורים ושיעורים, הוגדרו האינדקסים הבאים:

| טבלה | עמודות האינדקס | סוג אינדקס | מטרה ואופטימיזציה |
| :--- | :--- | :--- | :--- |
| `tutors` | `subject` | `B-Tree` | שליפה מיידית של מורים לפי תחום הוראה (שאילתת הסינון הנפוצה ביותר) |
| `tutors` | `price` | `B-Tree` | סינון מהיר לפי מחיר מקסימלי ומיון לפי מחיר עולה/יורד |
| `tutors` | `rating` | `B-Tree (DESC)` | מיון מהיר של המורים המומלצים ביותר |
| `slots` | `tutor_id, is_booked` | `Composite B-Tree` | איתור חלונות זמן פנויים למורה ספציפי ללא סריקת כל הטבלה |
| `reviews` | `tutor_id` | `B-Tree` | טעינה מהירה של כל חוות הדעת השייכות למורה הנבחר |
| `bookings`| `tutor_id, status` | `Composite B-Tree` | שליפה יעילה של השיעורים הפעילים עבור לוח הבקרה של המורה |
| `messages`| `conversation_id, created_at` | `Composite B-Tree` | טעינת היסטוריית שיחה ממוינת כרונולוגית בצ'אט בזמן אמת |

```sql
-- יצירת אינדקסים מומלצת ב-PostgreSQL / Supabase:
CREATE INDEX idx_tutors_subject ON tutors(subject);
CREATE INDEX idx_tutors_price ON tutors(price);
CREATE INDEX idx_tutors_rating ON tutors(rating DESC);
CREATE INDEX idx_slots_tutor_booked ON slots(tutor_id, is_booked);
CREATE INDEX idx_reviews_tutor ON reviews(tutor_id);
CREATE INDEX idx_bookings_tutor_status ON bookings(tutor_id, status);
CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at ASC);
```

---

## 3. אופטימיזציית AI וחיסכון ב-Tokens (AI Token Budget & Latency)

פניות למודלים של בינה מלאכותית (LLMs) עלולות להוות צוואר בקבוק הן מבחינת זמני השהייה (Latency) והן מבחינת עלויות כספיות (Token Costs). ב-TutorDirect יושמה אסטרטגיה קפדנית לאופטימיזציה:

```
┌────────────────────────────────────────────────────────┐
│             הזרקת מידע קומפקטית ל-Gemini               │
├────────────────────────────────────────────────────────┤
│ ❌ גישה לא יעילה: שליחת כל טבלאות ה-DB, הביקורות,      │
│    וההיסטוריה המלאה (10,000+ Tokens לכל שאלה)         │
│                                                        │
│ ✅ המימוש ב-TutorDirect: מיפוי קומפקטי ומזוקק          │
│    (מזהה, שם, מקצוע, מחיר, דירוג, רמות לימוד)         │
│    עד 80% חיסכון ב-Tokens וזמן מענה של כ-0.5s!        │
└────────────────────────────────────────────────────────┘
```

### עקרונות האופטימיזציה ב-Route Handler של ה-AI:
1. **Data Pruning (זיקוק נתוני מורים):** לפני העברת רשימת המורים למודל Gemini, מוסרים שדות כבדים שאינם נחוצים לקבלת ההחלטה (כמו תמונות פרופיל, רשימת חלונות זמן מפורטת, היסטוריית שיעורים).
2. **System Prompt Tuning:** הנחיות המערכת מוגדרות בצורה תמציתית וברורה, המחייבת את המודל להחזיר תשובות ממוקדות בעברית עשירה ללא מלל מיותר.
3. **בחירת מודל אופטימלי (Gemini 3.5 Flash):** המודל מספק את האיזון הטוב ביותר בין הבנה סמנטית עמוקה לבין מהירות תגובה קיצונית (Sub-second Response Time) ועלויות מינימליות.

---

## 4. ביצועי צד לקוח ורינדור (Client-Side Performance)

1. **ניהול מבוקר של ה-DOM:** חלונות הזמן והביקורות ב-`TutorDetailDrawer` נטענים בצורה מודולרית לפי דרישה (On-Demand), מה ששומר על מספר צמתי DOM נמוך ומבטיח רינדור חלק בקצב של 60fps.
2. **סנכרון מקומי מהיר (Client Cache):** שימוש ב-LocalStorage כ-Cache מקומי מאפשר פתיחה מיידית של מודלים והצגת נתונים ללא המתנה לקריאות רשת חוזרות.
3. **Debounced Search:** הקלדת טקסט בתיבת החיפוש אינה מייצרת חישובים חוזרים בכל תו, אלא מעבדת את הסינון ביעילות ומעדכנת את ה-State באופן ממוטב.
