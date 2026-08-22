import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

/**
 * Intelligent rule-based fallback advisor when Gemini API key is missing or unavailable.
 */
function generateFallbackResponse(
  userQuery: string,
  studentName: string,
  tutorsList: any[],
  subjects: string[],
  isHebrew: boolean
): string {
  const query = userQuery.toLowerCase();

  // Find if a specific subject was requested
  const matchedSubject = subjects.find(s => 
    query.includes(s.toLowerCase()) || 
    (s === 'מדעי המחשב וסייבר' && (query.includes('תכנות') || query.includes('פייתון') || query.includes('python') || query.includes('סייבר') || query.includes('מחשבים'))) ||
    (s === 'מתמטיקה' && (query.includes('חשבון') || query.includes('אלגברה') || query.includes('חדוא') || query.includes('גיאומטריה') || query.includes('בגרות במתמטיקה') || query.includes('5 יחידות') || query.includes('4 יחידות'))) ||
    (s === 'אנגלית' && (query.includes('english') || query.includes('דקדוק') || query.includes('אוצר מילים') || query.includes('בגרות באנגלית'))) ||
    (s === 'פיזיקה' && (query.includes('מכניקה') || query.includes('חשמל') || query.includes('קרינה וחומר')))
  );

  const greeting = isHebrew
    ? `שלום ${studentName ? studentName : ''}! נעים להכיר, אני **איידן** - יועץ הלימודים החכם שלכם ב-TutorDirect.`
    : `Hello ${studentName ? studentName : ''}! Nice to meet you, I'm **Aiden** - your smart academic advisor at TutorDirect.`;

  if (matchedSubject) {
    const matchingTutors = (tutorsList || []).filter(t => 
      t.subject === matchedSubject || 
      (t.subject && t.subject.toLowerCase().includes(matchedSubject.toLowerCase()))
    );

    matchingTutors.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    if (isHebrew) {
      let resp = `${greeting}\n\n`;
      resp += `### מורים מומלצים ב**${matchedSubject}**:\n`;
      
      if (matchingTutors.length > 0) {
        resp += `מצאתי עבורך **${matchingTutors.length} מורים מעולים** הזמינים לשיעורים פרטיים:\n\n`;
        matchingTutors.slice(0, 3).forEach((t, i) => {
          resp += `${i + 1}. **${t.name}** - ⭐ **${t.rating || '5.0'}** (${t.reviewsCount || 0} חוות דעת)\n`;
          resp += `   • **תעריף:** ₪${t.pricePerHour || t.price || 120} לשעה\n`;
          if (t.education) resp += `   • **השכלה ורקע:** ${t.education}\n`;
          if (t.bio) resp += `   • **על המורה:** ${t.bio.slice(0, 110)}...\n`;
        });
        resp += `\n💡 **טיפ להצלחה בשיעור הראשון:** כדאי להכין מראש 2-3 תרגילים או שאלות שנתקלת בהם בקריאת החומר, כך המורה יוכל לאבחן מיד את נקודות החוזק והחיזוק שלך.`;
      } else {
        resp += `כרגע אין מורה רשום בדיוק במקצוע זה, אך ניתן לחפש במקצועות משיקים בלוח המורים הראשי או לקבוע שיעור התאמה אישי.`;
      }
      return resp;
    } else {
      let resp = `${greeting}\n\n`;
      resp += `### Recommended Tutors for **${matchedSubject}**:\n`;
      if (matchingTutors.length > 0) {
        resp += `Found **${matchingTutors.length} excellent tutors** available:\n\n`;
        matchingTutors.slice(0, 3).forEach((t, i) => {
          resp += `${i + 1}. **${t.name}** - ⭐ **${t.rating || '5.0'}** (${t.reviewsCount || 0} reviews)\n`;
          resp += `   • **Rate:** ₪${t.pricePerHour || t.price || 120}/hour\n`;
          if (t.education) resp += `   • **Background:** ${t.education}\n`;
        });
      }
      return resp;
    }
  }

  // Price inquiry
  if (query.includes('מחיר') || query.includes('עולה') || query.includes('כמה') || query.includes('תעריף') || query.includes('price') || query.includes('cost')) {
    if (isHebrew) {
      return `${greeting}\n\n### מידע על מחירי שיעורים פרטיים ב-TutorDirect:\n
• **טווח המחירים:** המורים במערכת גובים בדרך כלל בין **₪80 ל-₪250 לשעה**, בהתאם לרמת הלימוד, הניסיון והתואר האקדמי.
• **ממוצע מערכתי:** כ-**₪130 לשעה**.
• **שיעור היכרות:** מורים רבים מאפשרים שיעור ראשון ממוקד לבניית תוכנית עבודה.

בסרגל הסינון העליון תוכל להגדיר את **התקציב המקסימלי לשעה** כדי לראות רק מורים בטווח הרצוי לך!`;
    }
  }

  // General advice or greetings
  if (isHebrew) {
    const topTutors = [...(tutorsList || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);
    return `${greeting}\n\nאשמח לעזור לך בכל מה שקשור ללימודים:
1. **התאמת מורה פרטי אידיאלי** - ספר לי באיזה מקצוע ורמת כיתה אתה לומד (למשל: "אני מחפש מורה למתמטיקה 5 יח\"ל" או "מורה לאנגלית").
2. **אסטרטגיות למידה ומוטיבציה** - איך להתכונן לבחינות, ניהול זמן ועמידה ביעדים.
3. **בניית תוכנית לימודים שבועית**.

🌟 **מורים מובילים במערכת כרגע:**
${topTutors.map((t, idx) => `${idx + 1}. **${t.name}** (${t.subject}) - דירוג ⭐ **${t.rating}** (₪${t.pricePerHour || t.price}/שעה)`).join('\n')}

באיזה נושא ותרצה שנתמקד היום?`;
  } else {
    return `${greeting}\n\nHow can I help you today?
1. **Find a private tutor** - tell me your subject and level (e.g. Math, English, Physics, Programming).
2. **Study tips & Exam prep** - strategies for effective learning.
3. **Budget planning** - filter by price and availability.`;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, studentName, tutorsList, subjects, language = 'he' } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const isHebrew = language !== 'en';
    const lastUserMessage = [...messages].reverse().find((m: any) => m.sender === 'user' || m.role === 'user')?.text || '';

    // Check if Gemini Client is initialized and API Key exists
    const client = getAiClient();

    if (!client) {
      // Fallback seamlessly to Aiden smart logic
      const fallbackText = generateFallbackResponse(
        lastUserMessage,
        studentName,
        tutorsList,
        subjects || [],
        isHebrew
      );
      return NextResponse.json({ text: fallbackText });
    }

    const systemInstruction = isHebrew ? `
אתה יועץ לימודים חכם בשם "איידן" (Aiden) עבור פלטפורמת השיעורים הפרטיים "TutorDirect".
התפקיד שלך הוא לעזור לתלמיד (או לתלמידה) בשם ${studentName || "תלמיד/ה"} למצוא את המורה הפרטי המתאים ביותר עבורם, לייעץ להם איך ללמוד נכון, להסביר מושגים או לעזור להם לבנות תוכנית לימודים אישית לשיעורים פרטיים ולהכנה למבחנים.

יש לפנות למשתמש בטון תומך, מקצועי, מעודד וסבלני בעברית.

רשימת המורים הפרטיים הזמינים כרגע במערכת:
${JSON.stringify(tutorsList || [])}

רשימת המקצועות הנלמדים:
${JSON.stringify(subjects || [])}

הנחיות לפעולה:
1. אם התלמיד מחפש מורה מסוים, נתח את רשימת המורים והמלץ על המורים המתאימים ביותר לפי נושא, מחיר לשעה, דירוג וזמינות. ציין את שמם ואת המומחיות שלהם.
2. תן טיפים מעשיים ללמידה אפקטיבית בשיעורים פרטיים (כגון הכנת שאלות מראש, הגדרת מטרות, חזרה על החומר).
3. ענה על שאלות לגבי נושאי הלימוד ואיך לבחור מורה.
4. אל תמציא מורים שאינם קיימים ברשימה! אם אין מורה מתאים, הצע להם לחפש מורה במקצועות דומים או לכתוב הודעה לתמיכה.
5. שמור על תשובות מעוצבות יפה עם כותרות מודגשות, נקודות בולטות (bullet points) ורווחים נוחים לקריאה.
`.trim() : `
You are "Aiden", an intelligent academic advisor for the "TutorDirect" private tutoring platform.
Your role is to help ${studentName || "the student"} find the best-matched private tutor, provide effective study strategies, explain academic concepts, and help plan study schedules for exams.

Available Tutors:
${JSON.stringify(tutorsList || [])}

Subjects:
${JSON.stringify(subjects || [])}

Instructions:
1. Recommend matching tutors based on subject, hourly rate, rating, and availability.
2. Provide practical study tips and exam preparation guidance.
3. Use a supportive, professional, and clear tone with readable formatting.
`.trim();

    const contents = messages.map((m: any) => ({
      role: (m.sender === 'user' || m.role === 'user') ? 'user' : 'model',
      parts: [{ text: m.text || '' }]
    }));

    try {
      const response = await client.models.generateContent({
        model: "gemini-3.7-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      if (response && response.text) {
        return NextResponse.json({ text: response.text });
      }
    } catch (genError: any) {
      console.warn("Gemini generation failed, using intelligent fallback:", genError?.message);
    }

    // Fallback if model fails or returns empty
    const fallbackText = generateFallbackResponse(
      lastUserMessage,
      studentName,
      tutorsList,
      subjects || [],
      isHebrew
    );
    return NextResponse.json({ text: fallbackText });

  } catch (error: any) {
    console.error("AI Consult route error:", error);
    return NextResponse.json(
      { error: error.message || "שגיאה בפנייה ליועץ ה-AI." },
      { status: 500 }
    );
  }
}
