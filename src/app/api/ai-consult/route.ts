import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../../../lib/supabase';

let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });
  }
  return aiClient;
}

function getTutorPrice(t: any): number {
  return Number(t.pricePerHour ?? t.price ?? 0);
}

function getTutorRating(t: any): number {
  return Number(t.rating ?? 0);
}

// חילוץ מדויק של שנות הניסיון כמספר
function getTutorExperienceYears(t: any): number {
  const text = `${t.experience || ''} ${t.bio || ''}`;
  const match = text.match(/(\d+)\s*(?:שנות|שנים|שנה|years|yrs)/i);
  return match ? parseInt(match[1], 10) : 0;
}

export interface CanonicalGradeDef {
  id: string;
  name: string;
  category: 'primary' | 'middle' | 'high' | 'academic';
  numericGrade?: number;
  aliases: string[];
}

export const CANONICAL_GRADES: CanonicalGradeDef[] = [
  { id: 'grade_1', name: 'כיתה א', category: 'primary', numericGrade: 1, aliases: ['כיתה א', 'כיתה א\'', 'כיתה 1', 'א\'', 'כיתה א׳'] },
  { id: 'grade_2', name: 'כיתה ב', category: 'primary', numericGrade: 2, aliases: ['כיתה ב', 'כיתה ב\'', 'כיתה 2', 'ב\'', 'כיתה ב׳'] },
  { id: 'grade_3', name: 'כיתה ג', category: 'primary', numericGrade: 3, aliases: ['כיתה ג', 'כיתה ג\'', 'כיתה 3', 'ג\'', 'כיתה ג׳'] },
  { id: 'grade_4', name: 'כיתה ד', category: 'primary', numericGrade: 4, aliases: ['כיתה ד', 'כיתה ד\'', 'כיתה 4', 'ד\'', 'כיתה ד׳'] },
  { id: 'grade_5', name: 'כיתה ה', category: 'primary', numericGrade: 5, aliases: ['כיתה ה', 'כיתה ה\'', 'כיתה 5', 'ה\'', 'כיתה ה׳'] },
  { id: 'grade_6', name: 'כיתה ו', category: 'primary', numericGrade: 6, aliases: ['כיתה ו', 'כיתה ו\'', 'כיתה 6', 'ו\'', 'כיתה ו׳'] },
  { id: 'grade_7', name: 'כיתה ז', category: 'middle', numericGrade: 7, aliases: ['כיתה ז', 'כיתה ז\'', 'כיתה 7', 'ז\'', 'כיתה ז׳'] },
  { id: 'grade_8', name: 'כיתה ח', category: 'middle', numericGrade: 8, aliases: ['כיתה ח', 'כיתה ח\'', 'כיתה 8', 'ח\'', 'כיתה ח׳'] },
  { id: 'grade_9', name: 'כיתה ט', category: 'middle', numericGrade: 9, aliases: ['כיתה ט', 'כיתה ט\'', 'כיתה 9', 'ט\'', 'כיתה ט׳'] },
  { id: 'grade_10', name: 'כיתה י', category: 'high', numericGrade: 10, aliases: ['כיתה י', 'כיתה י\'', 'כיתה 10', 'י\'', 'כיתה י׳'] },
  { id: 'grade_11', name: 'כיתה י"א', category: 'high', numericGrade: 11, aliases: ['כיתה י"א', 'כיתה יא', 'כיתה יא\'', 'כיתה 11', 'י"א', 'יא\'', 'כיתה י״א'] },
  { id: 'grade_12', name: 'כיתה י"ב', category: 'high', numericGrade: 12, aliases: ['כיתה י"ב', 'כיתה יב', 'כיתה יב\'', 'כיתה 12', 'י"ב', 'יב\'', 'כיתה י״ב'] },
  { id: 'grade_academic', name: 'תואר ראשון', category: 'academic', aliases: ['תואר ראשון', 'אקדמיה', 'אקדמי', 'סטודנטים', 'סטודנט', 'university', 'college'] },
];

// זיהוי ובדיקת התאמה לכיתת לימוד / רמת לימוד
export interface GradeLevelMatch {
  label: string;
  canonicalGradeId?: string;
  category?: 'primary' | 'middle' | 'high' | 'academic';
  searchTokens: string[];
}

export interface TutorNameMatch {
  extractedName: string;
  matchingTutors: any[];
}

export function detectRequestedTutorName(query: string, tutors: any[]): TutorNameMatch | null {
  const q = (query || '').trim();
  if (!q) return null;

  const stopWords = new Set([
    'פרטי', 'פרטית', 'טוב', 'טובה', 'מעולה', 'מומלץ', 'מומלצת', 'תותח', 'זול', 'יקר',
    'היקר', 'היקרה', 'היקרים', 'היקרות', 'הזול', 'הזולה', 'הזולים', 'הזולות',
    'הטוב', 'הטובה', 'הטובים', 'הטובות', 'הכי', 'ביותר', 'גבוה', 'הגבוה', 'נמוך', 'הנמוך',
    'מוביל', 'המוביל', 'ותיק', 'הותיק', 'הוותיק', 'מנוסה', 'המנוסה', 'משתלם', 'המשתלם',
    'מתמטיקה', 'למתמטיקה', 'במתמטיקה', 'ממתמטיקה', 'חשבון', 'לחשבון', 'בחשבון',
    'אלגברה', 'לאלגברה', 'באלגברה', 'חדוא', 'לחדוא', 'אינפי', 'math',
    'אנגלית', 'לאנגלית', 'באנגלית', 'מאנגלית', 'english',
    'פיזיקה', 'לפיזיקה', 'בפיזיקה', 'physics',
    'כימיה', 'לכימיה', 'בכימיה', 'chemistry',
    'לשון', 'ללשון', 'בלשון', 'עברית', 'לעברית', 'בעברית', 'דקדוק',
    'מחשבים', 'למחשבים', 'במחשבים', 'מדעי המחשב', 'למדעי המחשב', 'במדעי המחשב',
    'תכנות', 'לתכנות', 'בתכנות', 'קוד', 'לקוד', 'סייבר', 'לסייבר',
    'היסטוריה', 'להיסטוריה', 'אזרחות', 'לאזרחות', 'תנך', 'לתנך', 'ספרות', 'לספרות', 'ביולוגיה', 'לביולוגיה',
    'תיכון', 'לתיכון', 'יסודי', 'ליסודי', 'חטיבה', 'לחטיבה', 'בגרות', 'לבגרות',
    'תואר', 'לתואר', 'אקדמיה', 'לאקדמיה', 'סטודנט', 'לסטודנט', 'סטודנטים',
    'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת', 'בוקר', 'צהריים', 'ערב', 'לילה',
    'שעה', 'שעות', 'שיעור', 'שיעורים', 'מורה', 'המורה', 'מורים', 'המורים',
    'מדריך', 'המדריך', 'מדריכה', 'המדריכה', 'מרצה', 'המרצה',
    'עזרה', 'הכנה', 'מבחן', 'מבחנים',
    'שלמד', 'שמלמד', 'שלמדה', 'שמלמדת', 'למד', 'למדה', 'מלמד', 'מלמדת',
    'שעולה', 'עולה', 'מחיר', 'תעריף', 'דירוג', 'כוכבים', 'כוכב', 'ציון',
    'שלי', 'שלנו', 'שלו', 'שלה', 'הזה', 'הזאת', 'האלה', 'אחד', 'אחת', 'מישהו', 'מישהי'
  ]);

  let extractedName: string | null = null;

  // 1. תבניות מפורשות של שמות (למשל: "ששמו הוא ניב", "ששמו ניב", "מורה בשם שרה", "שקוראים לו יוסי")
  const explicitNamingPatterns = [
    /(?:ששמו\s+הוא|ששמו|ששמה\s+הוא|ששמה|ששמם|בשם|שנקרא\s+בשם|שנקראת\s+בשם|שנקרא|שנקראת|שקוראים\s+לו|שקוראים\s+לה|שקוראים\s+להם)\s+["״׳']?([א-תa-zA-Z\s]{2,25}?)["״׳']?(?:[\s,."':;?]|$)/i,
    /(?:named|name\s+is|called)\s+["']?([a-zA-Z]{2,20})["']?/i
  ];

  for (const pat of explicitNamingPatterns) {
    const m = q.match(pat);
    if (m && m[1]) {
      const candidate = m[1].trim();
      const candLower = candidate.toLowerCase();
      if (!stopWords.has(candLower) && !candLower.startsWith('למתמטיק') && !candLower.startsWith('לאנגל') && !candLower.startsWith('לפיזיק') && !candLower.startsWith('למדעי')) {
        extractedName = candidate;
        break;
      }
    }
  }

  // 2. תבניות כלליות כמו "המורה X" או "מחפש את X" - מתקבל אך ורק אם X תואם למורה אמיתי ברשימת המורים!
  if (!extractedName) {
    const contextualPatterns = [
      /(?:המורה|מדריך|מדריכה|מרצה)\s+["״׳']?([א-תa-zA-Z]{2,20})["״׳']?(?:[\s,."':;?]|$)/i,
      /(?:מחפש\s+את|מחפשת\s+את|תמצא\s+לי\s+את|תמצאי\s+לי\s+את)\s+["״׳']?([א-תa-zA-Z]{2,20})["״׳']?(?:[\s,."':;?]|$)/i
    ];

    for (const pat of contextualPatterns) {
      const m = q.match(pat);
      if (m && m[1]) {
        const candidate = m[1].trim();
        const candLower = candidate.toLowerCase();
        // מילים עם תחילית ל/ב או מילות עצירה או תארים אינן שמות
        if (stopWords.has(candLower) || candLower.startsWith('ל') || candLower.startsWith('ב') || candLower.startsWith('ה')) {
          continue;
        }
        // אימות שאכן קיים מורה במערכת עם שם זה (פרטי או מלא)
        const matchesExistingTutor = tutors.some(t => {
          if (!t.name || typeof t.name !== 'string') return false;
          const tName = t.name.toLowerCase();
          const tFirst = tName.split(/\s+/)[0];
          return tName.includes(candLower) || candLower.includes(tName) || tFirst === candLower;
        });

        if (matchesExistingTutor) {
          extractedName = candidate;
          break;
        }
      }
    }
  }

  // 3. בדיקה אם שם של מורה קיים מהרשימה הוזכר ישירות בשאילתה
  if (!extractedName && tutors.length > 0) {
    for (const t of tutors) {
      if (!t.name || typeof t.name !== 'string') continue;
      const fullName = t.name.trim();
      const firstName = fullName.split(/\s+/)[0];

      if (firstName.length >= 2 && !stopWords.has(firstName.toLowerCase())) {
        const wordRegex = new RegExp(`(?:^|[\\s,."':;?פרטי])${firstName}(?:[\\s,."':;?]|$)`, 'i');
        if (wordRegex.test(q)) {
          extractedName = firstName;
          break;
        }
      }
    }
  }

  if (!extractedName) return null;

  const target = extractedName.toLowerCase();
  const matchingTutors = tutors.filter(t => {
    if (!t.name || typeof t.name !== 'string') return false;
    const tName = t.name.toLowerCase();
    const tFirst = tName.split(/\s+/)[0];
    return tName.includes(target) || target.includes(tName) || tFirst === target || target.startsWith(tFirst);
  });

  return {
    extractedName,
    matchingTutors
  };
}

export interface SuperlativeMatch {
  type: 'highest_price' | 'lowest_price' | 'highest_rating' | 'highest_experience';
  label: string;
  matchedSubject: string | null;
  sortedTutors: any[];
  topTutors: any[];
  extremeValueDisplay: string;
  isAllEqual: boolean;
}

export function detectRequestedSuperlative(query: string, tutors: any[]): SuperlativeMatch | null {
  const q = (query || '').toLowerCase().trim();
  if (!q || tutors.length === 0) return null;

  // 1. בדיקת סוג הסופרלטיב
  let type: 'highest_price' | 'lowest_price' | 'highest_rating' | 'highest_experience' | null = null;
  let label = '';

  if (/(?:היקר\s+ביותר|היקרה\s+ביותר|הכי\s+יקר|הכי\s+יקרה|הכי\s+יקרים|הכי\s+יקרות|עולה\s+הכי\s+הרבה|שעולה\s+הכי\s+הרבה|שלוקח\s+הכי\s+הרבה|מחיר\s+הכי\s+גבוה|המחיר\s+הכי\s+גבוה|תעריף\s+הכי\s+גבוה|התעריף\s+הכי\s+גבוה|התעריף\s+הגבוה\s+ביותר|המחיר\s+הגבוה\s+ביותר|most\s+expensive|highest\s+price)/i.test(q)) {
    type = 'highest_price';
    label = 'היקר ביותר (תעריף שעתי מרבי)';
  } else if (/(?:הזול\s+ביותר|הזולה\s+ביותר|הכי\s+זול|הכי\s+זולה|הכי\s+זולים|הכי\s+זולות|עולה\s+הכי\s+פחות|שעולה\s+הכי\s+פחות|שלוקח\s+הכי\s+פחות|מחיר\s+הכי\s+נמוך|המחיר\s+הכי\s+נמוך|תעריף\s+הכי\s+נמוך|התעריף\s+הכי\s+נמוך|התעריף\s+הנמוך\s+ביותר|המחיר\s+הנמוך\s+ביותר|הכי\s+משתלם|המשתלם\s+ביותר|הכי\s+חסכוני|cheapest|lowest\s+price)/i.test(q)) {
    type = 'lowest_price';
    label = 'הזול ביותר (תעריף שעתי מינימלי)';
  } else if (/(?:הטוב\s+ביותר|הטובה\s+ביותר|הכי\s+טוב|הכי\s+טובה|הכי\s+טובים|הכי\s+מומלץ|הכי\s+מומלצת|המומלץ\s+ביותר|המומלצת\s+ביותר|הדירוג\s+הכי\s+גבוה|דירוג\s+הכי\s+גבוה|הדירוג\s+הגבוה\s+ביותר|הכי\s+מדורג|הציון\s+הכי\s+גבוה|ציון\s+הכי\s+גבוה|הכי\s+הרבה\s+כוכבים|best\s+rated|highest\s+rated|top\s+rated)/i.test(q)) {
    type = 'highest_rating';
    label = 'בעל הדירוג הגבוה ביותר';
  } else if (/(?:הכי\s+מנוסה|המנוסה\s+ביותר|הכי\s+ותיק|הוותיק\s+ביותר|הותיק\s+ביותר|בעל\s+הניסיון\s+הרב\s+ביותר|בעלת\s+הניסיון\s+הרב\s+ביותר|הכי\s+הרבה\s+ניסיון|הכי\s+הרבה\s+שנות\s+ניסיון|most\s+experienced)/i.test(q)) {
    type = 'highest_experience';
    label = 'בעל הניסיון הרב ביותר';
  }

  if (!type) return null;

  // 2. זיהוי מקצוע אם הוזכר
  let matchedSubject: string | null = null;
  if (q.includes('מתמטיקה') || q.includes('חשבון') || q.includes('אלגברה') || q.includes('חדוא') || q.includes('math')) {
    matchedSubject = 'מתמטיקה';
  } else if (q.includes('מדעי המחשב') || q.includes('מחשב') || q.includes('תכנות') || q.includes('קוד') || q.includes('python') || q.includes('cs')) {
    matchedSubject = 'מדעי המחשב';
  } else if (q.includes('אנגלית') || q.includes('english')) {
    matchedSubject = 'אנגלית';
  } else if (q.includes('פיזיקה') || q.includes('physics')) {
    matchedSubject = 'פיזיקה';
  } else if (q.includes('כימיה') || q.includes('chemistry')) {
    matchedSubject = 'כימיה';
  } else if (q.includes('לשון') || q.includes('עברית')) {
    matchedSubject = 'לשון ועברית';
  }

  // 3. סינון מורים לפי המקצוע אם קיים
  const candidateTutors = matchedSubject
    ? tutors.filter(t => (t.subject || '').toLowerCase().includes(matchedSubject!.toLowerCase()))
    : tutors;

  if (candidateTutors.length === 0) {
    return {
      type,
      label,
      matchedSubject,
      sortedTutors: [],
      topTutors: [],
      extremeValueDisplay: '',
      isAllEqual: false
    };
  }

  let sortedTutors: any[] = [];
  let topTutors: any[] = [];
  let extremeValueDisplay = '';
  let isAllEqual = false;

  if (type === 'highest_price') {
    const prices = candidateTutors.map(t => getTutorPrice(t));
    const maxVal = Math.max(...prices);
    isAllEqual = candidateTutors.every(t => getTutorPrice(t) === maxVal);
    sortedTutors = [...candidateTutors].sort((a, b) => {
      const pDiff = getTutorPrice(b) - getTutorPrice(a);
      if (pDiff !== 0) return pDiff;
      return getTutorRating(b) - getTutorRating(a);
    });
    topTutors = sortedTutors.filter(t => getTutorPrice(t) === maxVal);
    extremeValueDisplay = `₪${maxVal} לשעה`;
  } else if (type === 'lowest_price') {
    const prices = candidateTutors.map(t => getTutorPrice(t));
    const minVal = Math.min(...prices);
    isAllEqual = candidateTutors.every(t => getTutorPrice(t) === minVal);
    sortedTutors = [...candidateTutors].sort((a, b) => {
      const pDiff = getTutorPrice(a) - getTutorPrice(b);
      if (pDiff !== 0) return pDiff;
      return getTutorRating(b) - getTutorRating(a);
    });
    topTutors = sortedTutors.filter(t => getTutorPrice(t) === minVal);
    extremeValueDisplay = `₪${minVal} לשעה`;
  } else if (type === 'highest_rating') {
    const ratings = candidateTutors.map(t => getTutorRating(t));
    const maxVal = Math.max(...ratings);
    isAllEqual = candidateTutors.every(t => Math.abs(getTutorRating(t) - maxVal) < 0.05);
    sortedTutors = [...candidateTutors].sort((a, b) => {
      const rDiff = getTutorRating(b) - getTutorRating(a);
      if (Math.abs(rDiff) > 0.05) return rDiff;
      return getTutorPrice(a) - getTutorPrice(b);
    });
    topTutors = sortedTutors.filter(t => Math.abs(getTutorRating(t) - maxVal) < 0.05);
    extremeValueDisplay = `⭐ ${maxVal.toFixed(1)} / 5.0`;
  } else if (type === 'highest_experience') {
    const exps = candidateTutors.map(t => getTutorExperienceYears(t));
    const maxVal = Math.max(...exps);
    isAllEqual = candidateTutors.every(t => getTutorExperienceYears(t) === maxVal);
    sortedTutors = [...candidateTutors].sort((a, b) => {
      const eDiff = getTutorExperienceYears(b) - getTutorExperienceYears(a);
      if (eDiff !== 0) return eDiff;
      return getTutorRating(b) - getTutorRating(a);
    });
    topTutors = sortedTutors.filter(t => getTutorExperienceYears(t) === maxVal);
    extremeValueDisplay = maxVal > 0 ? `${maxVal} שנות ניסיון` : 'בעל ניסיון רב';
  }

  return {
    type,
    label,
    matchedSubject,
    sortedTutors,
    topTutors,
    extremeValueDisplay,
    isAllEqual
  };
}

export interface PriceMatch {
  rawPrice: number;
  operator: 'exact' | 'max' | 'min';
  label: string;
  matchingTutors: any[];
  minPriceInSystem: number;
  maxPriceInSystem: number;
  closestTutors: any[];
}

export interface RatingMatch {
  rawRating: number;
  operator: 'exact' | 'max' | 'min';
  label: string;
  matchingTutors: any[];
  minRatingInSystem: number;
  maxRatingInSystem: number;
  closestTutors: any[];
}

export interface EducationMatch {
  degreeType: 'bachelor' | 'master' | 'doctorate' | 'any_degree';
  label: string;
  matchingTutors: any[];
  allTutorsWithEducation: any[];
}

export function detectRequestedEducation(query: string, tutors: any[]): EducationMatch | null {
  const q = (query || '').toLowerCase().trim();
  if (!q) return null;

  // אם השאילתה משתמשת אך ורק במילה "שמלמד" / "מלמד" / "מלמדת" בהקשר של מקצוע או כיתה ולא בהקשר השכלתי
  // (למשל: "מורה שמלמד מתמטיקה", "מי שמלמד כיתה י") - אין לפרש זאת כהשכלת המורה
  const isExplicitTeachingVerb = /(?:שמלמד|שמלמדת|מלמד|מלמדת|מלמדים|מלמדות)\s+(?:מתמטיקה|פיזיקה|מדעי המחשב|תכנות|אנגלית|כימיה|לשון|כיתה|יסודי|חטיבה|תיכון|בגרות)/i.test(q);
  const isExplicitEducationVerb = /(?:שלמד|שלמדה|למד|למדה|למדו|בוגר|בוגרת|בעל\s*תואר|בעלת\s*תואר|שיש\s*לו\s*תואר|שיש\s*לה\s*תואר|השכלה|תואר\s*אקדמי|לימודים\s*אקדמיים|תואר\s*ראשון|תואר\s*שני|דוקטור)/i.test(q);

  if (isExplicitTeachingVerb && !isExplicitEducationVerb) {
    return null;
  }

  // 1. בדיקת דוקטורט / דוקטור / Ph.D
  const isDoctorate = /(?:דוקטורט|דוקטור|ph\.?d|תואר\s*שלישי|dr\b)/i.test(q);
  // 2. בדיקת תואר שני / מאסטר / M.Sc / M.A
  const isMaster = /(?:תואר\s*שני|תואר\s*2|מאסטר|m\.?sc|m\.?a|מוסמך\s*למדעים|מוסמך)/i.test(q);
  // 3. בדיקת תואר ראשון / בוגר / B.Sc / B.A / לימודי תואר
  const isBachelor = /(?:תואר\s*ראשון|תואר\s*1|בוגר\s*תואר|b\.?sc|b\.?a|b\.?ed|בוגר\s*אוניברסיטה|בוגר\s*טכניון|בוגר\s*מכללה|שלמד\s*תואר\s*ראשון|שלמדה\s*תואר\s*ראשון|למד\s*תואר\s*ראשון|למדה\s*תואר\s*ראשון|עם\s*תואר\s*ראשון|בעל\s*תואר\s*ראשון|בעלת\s*תואר\s*ראשון|שיש\s*לו\s*תואר\s*ראשון|שיש\s*לה\s*תואר\s*ראשון|סטודנט\s*לתואר\s*ראשון|סטודנטית\s*לתואר\s*ראשון)/i.test(q);
  // 4. בדיקת מוסד לימודים או תחום לימודים שלמד המורה: "שלמד בטכניון", "שלמד מדעי המחשב", "שלמד הנדסה"
  const studiedFieldMatch = q.match(/(?:שלמד|שלמדה|למד|למדה|בוגר|בוגרת|תואר\s*ב)\s+(?:ב|את\s+)?([א-ת\w\s]+)/i);
  // 5. בדיקת תואר כללי / השכלה אקדמית
  const isGeneralDegree = /(?:שלמד\s*תואר|שלמדה\s*תואר|למד\s*תואר|למדה\s*תואר|עם\s*תואר|בעל\s*תואר|בעלת\s*תואר|שיש\s*לו\s*תואר|שיש\s*לה\s*תואר|תואר\s*אקדמי|השכלה\s*אקדמית|בוגר\s*תואר|אקדמאי|משכיל|שלמד\s*באוניברסיטה|שלמד\s*בטכניון|שלמד\s*במכללה)/i.test(q);

  if (!isDoctorate && !isMaster && !isBachelor && !isGeneralDegree && !studiedFieldMatch && !isExplicitEducationVerb) {
    return null;
  }

  let degreeType: 'bachelor' | 'master' | 'doctorate' | 'any_degree' = 'any_degree';
  let label = 'תואר אקדמי / השכלה';

  if (isDoctorate) {
    degreeType = 'doctorate';
    label = 'דוקטורט (Ph.D)';
  } else if (isMaster) {
    degreeType = 'master';
    label = 'תואר שני (M.Sc / M.A)';
  } else if (isBachelor) {
    degreeType = 'bachelor';
    label = 'תואר ראשון (B.Sc / B.A / בוגר אוניברסיטה)';
  } else if (studiedFieldMatch && studiedFieldMatch[1]) {
    const rawTarget = studiedFieldMatch[1].trim();
    if (rawTarget.includes('טכניון')) {
      label = 'לימודים בטכניון';
    } else if (rawTarget.includes('אוניברסיט')) {
      label = 'לימודים באוניברסיטה';
    } else if (rawTarget.length > 2 && !rawTarget.includes('מורה')) {
      label = `לימודים והשכלה ב-${rawTarget}`;
    } else {
      label = 'תואר אקדמי';
    }
  } else {
    degreeType = 'any_degree';
    label = 'תואר אקדמי';
  }

  const matchingTutors = tutors.filter(t => {
    const eduText = `${t.education || t.degrees_and_education || ''} ${t.bio || t.short_bio || ''}`.toLowerCase();
    
    if (degreeType === 'doctorate') {
      return (
        eduText.includes('דוקטור') ||
        eduText.includes('ph.d') ||
        eduText.includes('phd') ||
        eduText.includes('תואר שלישי') ||
        eduText.includes('ד״ר') ||
        eduText.includes('ד"ר')
      );
    }
    
    if (degreeType === 'master') {
      const eduField = (t.education || t.degrees_and_education || '').toLowerCase().trim();
      const bioField = (t.bio || t.short_bio || '').toLowerCase().trim();
      return (
        eduField.includes('תואר שני') || 
        eduField.includes('m.sc') || 
        eduField.includes('m.a') || 
        eduField.includes('מאסטר') || 
        eduField.includes('מוסמך') ||
        bioField.includes('תואר שני') ||
        bioField.includes('בוגר תואר שני') ||
        bioField.includes('m.sc') ||
        bioField.includes('m.a') ||
        bioField.includes('מאסטר')
      );
    }

    if (degreeType === 'bachelor') {
      const eduField = (t.education || t.degrees_and_education || '').toLowerCase().trim();
      const bioField = (t.bio || t.short_bio || '').toLowerCase().trim();

      // אם המורה מוגדר כבעל תואר שני או דוקטורט ואינו כולל תואר ראשון במפורש - אל תציג אותו כמענה לבקשת תואר ראשון!
      const isMasterOnly = (
        (eduField.includes('תואר שני') || eduField.includes('m.sc') || eduField.includes('m.a') || eduField.includes('מאסטר') || eduField.includes('מוסמך') || bioField.includes('בוגר תואר שני')) &&
        !eduField.includes('תואר ראשון') && !eduField.includes('b.sc') && !eduField.includes('b.a')
      );
      const isDoctorOnly = (
        (eduField.includes('דוקטור') || eduField.includes('ph.d') || eduField.includes('phd') || eduField.includes('תואר שלישי')) &&
        !eduField.includes('תואר ראשון') && !eduField.includes('b.sc') && !eduField.includes('b.a')
      );

      if (isMasterOnly || isDoctorOnly) {
        return false;
      }

      // בדיקה חיובית עבור תואר ראשון
      return (
        eduField.includes('תואר ראשון') ||
        eduField.includes('b.sc') ||
        eduField.includes('bsc') ||
        eduField.includes('b.a') ||
        eduField.includes('ba') ||
        eduField.includes('b.ed') ||
        bioField.includes('תואר ראשון') ||
        bioField.includes('b.sc') ||
        bioField.includes('b.a') ||
        (eduField.includes('בוגר') && !eduField.includes('תואר שני') && !bioField.includes('תואר שני')) ||
        (eduField.includes('מהנדס') && !eduField.includes('תואר שני') && !bioField.includes('תואר שני')) ||
        (eduField.includes('סטודנט') && !eduField.includes('תואר שני'))
      );
    }
    
    if (degreeType === 'any_degree') {
      // אם המשתמש חיפש מוסד ספציפי או תחום שהמורה למד
      if (studiedFieldMatch && studiedFieldMatch[1]) {
        const target = studiedFieldMatch[1].toLowerCase().trim();
        if (target.includes('טכניון') && (eduText.includes('טכניון') || eduText.includes('technion'))) return true;
        if (target.includes('אוניברסיט') && (eduText.includes('אוניברסיט') || eduText.includes('university'))) return true;
        if (target.includes('מתמטיקה') && eduText.includes('מתמטיקה')) return true;
        if (target.includes('פיזיקה') && eduText.includes('פיזיקה')) return true;
        if ((target.includes('מחשב') || target.includes('תכנות')) && (eduText.includes('מדעי המחשב') || eduText.includes('תוכנה') || eduText.includes('הנדס'))) return true;
      }

      // כל מי שיש לו תואר ראשון, תואר שני, דוקטורט, B.Sc, B.A, בוגר, מהנדס, סטודנט לתואר, או מוסד אקדמי
      return (
        eduText.includes('תואר ראשון') ||
        eduText.includes('b.sc') ||
        eduText.includes('bsc') ||
        eduText.includes('b.a') ||
        eduText.includes('ba') ||
        eduText.includes('b.ed') ||
        eduText.includes('בוגר') ||
        eduText.includes('מהנדס') ||
        eduText.includes('הנדס') ||
        eduText.includes('תואר שני') ||
        eduText.includes('m.sc') ||
        eduText.includes('m.a') ||
        eduText.includes('דוקטור') ||
        eduText.includes('ph.d') ||
        eduText.includes('phd') ||
        eduText.includes('סטודנט') ||
        eduText.includes('לומד לתואר') ||
        eduText.includes('לימודי תואר') ||
        eduText.includes('תואר ב') ||
        eduText.includes('אוניברסיט') ||
        eduText.includes('טכניון') ||
        eduText.includes('מכלל') ||
        (t.education && t.education.trim().length > 3) ||
        (t.degrees_and_education && t.degrees_and_education.trim().length > 3)
      );
    }

    return false;
  });

  const allTutorsWithEducation = tutors.filter(t => (t.education || t.degrees_and_education || '').trim().length > 0);

  return {
    degreeType,
    label,
    matchingTutors,
    allTutorsWithEducation
  };
}

// זיהוי יום בשבוע בצורה נקייה ומדויקת ללא בלבול עם תארים אקדמיים כגון "תואר שני" או "תואר ראשון"
export function detectRequestedDay(query: string): string | null {
  const rawQ = (query || '').toLowerCase().trim();
  if (!rawQ) return null;

  // שלב 1: סינון וניקוי ביטויים שכוללים את המילים ראשון / שני / שלישי אך אינם ימי שבוע כלל:
  // "תואר שני", "שלמד תואר שני", "תואר ראשון", "תואר שלישי", "ראשון לציון", "שני מורים", "שנייה" וכו'
  const cleanQ = rawQ
    // תארים אקדמיים
    .replace(/(?:תואר|שלמד|שלמדה|למד|למדה|בוגר|בוגרת|בעל|בעלת|מחזיק|עושה|לומד|לומדת|במסלול)\s+(?:תואר\s+)?(?:ראשון|שני|שלישי|1|2|3)\b/gi, ' ')
    .replace(/(?:תואר\s+)(?:ראשון|שני|שלישי|1|2|3)\b/gi, ' ')
    // ערים וביטויים נפוצים
    .replace(/ראשון\s+לציון|בראשון\s+לציון|ראשל["״׳]?צ/gi, ' ')
    .replace(/בראש\s+ובראשונה|ראש\s+בראש/gi, ' ')
    .replace(/(?:ב?פעם|הפעם)\s+(?:ראשונה|שנייה|שלישית)/gi, ' ')
    .replace(/שניי?ה(?:\s+אחת)?|שניות/gi, ' ')
    // "שני X" שמשמעותו כמות (two): "שני מורים", "שני שיעורים", "שני תלמידים"
    .replace(/(?:בשני|שני)\s+(?:מורים|מורות|אנשים|תלמידים|תלמידות|שיעורים|קורסים|ספרים|מקרים|חלקים|שלבים|נושאים)/gi, ' ')
    // "מורה שני", "מורה ראשון"
    .replace(/(?:מורה|מדריך|מתרגל)\s+(?:ראשון|שני|שלישי)/gi, ' ');

  // 1. יום ראשון / Sunday
  if (
    /(?:^|[^\wא-ת])(?:ביום|ליום|ימי|בימי|יום)\s*ראשון(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:ביום|ליום|יום)\s*א['׳]?(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:בראשון|לראשון)(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:פנוי|זמין|שיעור|יומן|מפגש)\s+(?:ב|ל)?ראשון(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])sunday(?:[^\wא-ת]|$)/i.test(cleanQ)
  ) {
    return 'יום ראשון';
  }

  // 2. יום שני / Monday - חייב להיות הקשר של יום (יום שני, ביום שני, בשני, פנוי בשני, וכו') ולא "תואר שני"!
  if (
    /(?:^|[^\wא-ת])(?:ביום|ליום|ימי|בימי|יום)\s*שני(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:ביום|ליום|יום)\s*ב['׳]?(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:בשני|לשני)(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:פנוי|זמין|שיעור|יומן|מפגש)\s+(?:ב|ל)?שני(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])monday(?:[^\wא-ת]|$)/i.test(cleanQ)
  ) {
    return 'יום שני';
  }

  // 3. יום שלישי / Tuesday
  if (
    /(?:^|[^\wא-ת])(?:ביום|ליום|ימי|בימי|יום)\s*שלישי(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:ביום|ליום|יום)\s*ג['׳]?(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:בשלישי|לשלישי)(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:פנוי|זמין|שיעור|יומן|מפגש)\s+(?:ב|ל)?שלישי(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])tuesday(?:[^\wא-ת]|$)/i.test(cleanQ)
  ) {
    return 'יום שלישי';
  }

  // 4. יום רביעי / Wednesday
  if (
    /(?:^|[^\wא-ת])(?:ביום|ליום|ימי|בימי|יום)\s*רביעי(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:ביום|ליום|יום)\s*ד['׳]?(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:ברביעי|לרביעי)(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:פנוי|זמין|שיעור|יומן|מפגש)\s+(?:ב|ל)?רביעי(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])wednesday(?:[^\wא-ת]|$)/i.test(cleanQ)
  ) {
    return 'יום רביעי';
  }

  // 5. יום חמישי / Thursday
  if (
    /(?:^|[^\wא-ת])(?:ביום|ליום|ימי|בימי|יום)\s*חמישי(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:ביום|ליום|יום)\s*ה['׳]?(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:בחמישי|לחמישי)(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:פנוי|זמין|שיעור|יומן|מפגש)\s+(?:ב|ל)?חמישי(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])thursday(?:[^\wא-ת]|$)/i.test(cleanQ)
  ) {
    return 'יום חמישי';
  }

  // 6. יום שישי / Friday
  if (
    /(?:^|[^\wא-ת])(?:ביום|ליום|ימי|בימי|יום)\s*שישי(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:ביום|ליום|יום)\s*ו['׳]?(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:בשישי|לשישי)(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])(?:פנוי|זמין|שיעור|יומן|מפגש)\s+(?:ב|ל)?שישי(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])friday(?:[^\wא-ת]|$)/i.test(cleanQ)
  ) {
    return 'יום שישי';
  }

  // 7. מוצ״ש / שבת / Saturday
  if (
    /(?:^|[^\wא-ת])(?:שבת|במוצש|מוצש|במוצ״ש|מוצ״ש|במוצ"ש|מוצ"ש|ביום\s*שבת|ליום\s*שבת|בשבת)(?:[^\wא-ת]|$)/.test(cleanQ) ||
    /(?:^|[^\wא-ת])saturday(?:[^\wא-ת]|$)/i.test(cleanQ)
  ) {
    return 'מוצ״ש';
  }

  return null;
}

// זיהוי שעה ופרק זמן
export function detectRequestedHourAndPeriod(query: string): { requestedHour: number | null; requestedPeriod: 'morning' | 'afternoon' | 'evening' | null } {
  const q = (query || '').toLowerCase().trim();
  let requestedPeriod: 'morning' | 'afternoon' | 'evening' | null = null;

  if (q.includes('בוקר') || q.includes('morning')) requestedPeriod = 'morning';
  else if (q.includes('צהריים') || q.includes('אחה״צ') || q.includes('אחה"צ') || q.includes('אחר הצהריים') || q.includes('afternoon')) requestedPeriod = 'afternoon';
  else if (q.includes('ערב') || q.includes('evening') || q.includes('לילה')) requestedPeriod = 'evening';

  let requestedHour: number | null = null;
  // ניקוי ביטויי מחיר כגון ב-80 שקל, ב-77 שח כדי למנוע בלבול עם שעה
  const cleanQ = q.replace(/ב-?\s*\d+\s*(?:שקל|שקלים|ש"ח|ש״ח|₪)/gi, ' ');

  const timeMatch = cleanQ.match(/(?:בשעה|שעה|בשעות)\s*(\d{1,2})(?::(\d{2}))?|(\d{1,2}):(\d{2})|(?:ב-)(\d{1,2})(?::(\d{2}))?(?:\s*(?:בבוקר|בערב|בצהריים|אחה"צ|אחה״צ|בלילה))?/i);
  if (timeMatch) {
    const rawH = parseInt(timeMatch[1] || timeMatch[3] || timeMatch[5], 10);
    if (!isNaN(rawH) && rawH >= 0 && rawH <= 24) {
      if (rawH <= 12 && (requestedPeriod === 'afternoon' || requestedPeriod === 'evening' || q.includes('בערב') || q.includes('אחה"צ') || q.includes('אחה״צ'))) {
        requestedHour = rawH < 12 ? rawH + 12 : rawH;
      } else {
        requestedHour = rawH;
      }
    }
  }

  return { requestedHour, requestedPeriod };
}

export function detectRequestedRating(query: string, tutors: any[]): RatingMatch | null {
  const q = (query || '').toLowerCase().trim();
  if (!q) return null;

  // 1. תבניות דירוג מקסימום / עד: "עד דירוג של 3 כוכבים", "עד 3 כוכבים", "דירוג מקסימום 3", "לא יותר מ-3 כוכבים", "עד ציון 3"
  const maxPatterns = [
    /(?:עד\s+דירוג\s+(?:של\s+)?|עד\s+|מקסימום\s+דירוג\s+(?:של\s+)?|מקסימום\s+|לא\s+יותר\s+מ-|לא\s+מעל\s+)\s*([1-5](?:\.\d+)?)\s*(?:כוכבים|כוכב|דירוג|ציון|stars|star)?/i,
    /([1-5](?:\.\d+)?)\s*(?:כוכבים|כוכב|stars|star)\s*(?:לכל\s+היותר|גג|מקסימום|ומטה)/i
  ];

  // 2. תבניות דירוג מינימום / לפחות: "לפחות 4 כוכבים", "מעל דירוג 4", "דירוג 4.5 ומעלה", "החל מ-4 כוכבים"
  const minPatterns = [
    /(?:לפחות\s+דירוג\s+(?:של\s+)?|לפחות\s+|מעל\s+דירוג\s+(?:של\s+)?|מעל\s+|מינימום\s+דירוג\s+(?:של\s+)?|מינימום\s+|החל\s+מ-|מ-)\s*([1-5](?:\.\d+)?)\s*(?:כוכבים|כוכב|דירוג|ציון|stars|star)?\s*(?:ומעלה)?/i,
    /([1-5](?:\.\d+)?)\s*(?:כוכבים|כוכב|stars|star)\s*(?:לפחות|ומעלה|מינימום)/i
  ];

  // 3. תבניות דירוג מפורש / מדויק: "עם דירוג 3", "בדירוג של 3 כוכבים", "דירוג 3 כוכבים", "בדיוק 3 כוכבים"
  const exactPatterns = [
    /(?:בדירוג\s+(?:של\s+)?|עם\s+דירוג\s+(?:של\s+)?|דירוג\s+(?:של\s+)?|ציון\s+(?:של\s+)?|בציון\s+(?:של\s+)?|בדיוק\s+)\s*([1-5](?:\.\d+)?)\s*(?:כוכבים|כוכב|stars|star)/i
  ];

  let rawRating: number | null = null;
  let operator: 'exact' | 'max' | 'min' = 'exact';

  // בדיקה אם המילה "כוכב" או "דירוג" או "ציון" קיימת בשאילתה
  const hasRatingKeyword = /כוכב|כוכבים|דירוג|ציון|stars|star|rating/.test(q);
  if (!hasRatingKeyword) return null;

  for (const pat of maxPatterns) {
    const m = q.match(pat);
    if (m && m[1]) {
      const num = parseFloat(m[1]);
      if (!isNaN(num) && num >= 1 && num <= 5) {
        rawRating = num;
        operator = 'max';
        break;
      }
    }
  }

  if (rawRating === null) {
    for (const pat of minPatterns) {
      const m = q.match(pat);
      if (m && m[1]) {
        const num = parseFloat(m[1]);
        if (!isNaN(num) && num >= 1 && num <= 5) {
          rawRating = num;
          operator = 'min';
          break;
        }
      }
    }
  }

  if (rawRating === null) {
    for (const pat of exactPatterns) {
      const m = q.match(pat);
      if (m && m[1]) {
        const num = parseFloat(m[1]);
        if (!isNaN(num) && num >= 1 && num <= 5) {
          rawRating = num;
          operator = 'exact';
          break;
        }
      }
    }
  }

  if (rawRating === null) return null;

  const allRatings = tutors.map(t => getTutorRating(t));
  const minRatingInSystem = allRatings.length > 0 ? Math.min(...allRatings) : 4.0;
  const maxRatingInSystem = allRatings.length > 0 ? Math.max(...allRatings) : 5.0;

  let matchingTutors: any[] = [];
  if (operator === 'exact') {
    matchingTutors = tutors.filter(t => Math.abs(getTutorRating(t) - rawRating!) < 0.15);
  } else if (operator === 'max') {
    matchingTutors = tutors.filter(t => getTutorRating(t) <= rawRating! + 0.05);
  } else if (operator === 'min') {
    matchingTutors = tutors.filter(t => getTutorRating(t) >= rawRating! - 0.05);
  }

  // מציאת המורים עם הדירוגים הקרובים ביותר
  const sortedByDistance = [...tutors].sort((a, b) => {
    const distA = Math.abs(getTutorRating(a) - rawRating!);
    const distB = Math.abs(getTutorRating(b) - rawRating!);
    return distA - distB;
  });

  let label = '';
  if (operator === 'exact') label = `בדירוג של ⭐ ${rawRating}`;
  else if (operator === 'max') label = `עד דירוג של ⭐ ${rawRating}`;
  else if (operator === 'min') label = `מדירוג של ⭐ ${rawRating} ומעלה`;

  return {
    rawRating,
    operator,
    label,
    matchingTutors,
    minRatingInSystem,
    maxRatingInSystem,
    closestTutors: sortedByDistance.slice(0, 3)
  };
}

export function detectRequestedPrice(query: string, tutors: any[]): PriceMatch | null {
  const q = (query || '').toLowerCase().trim();
  if (!q) return null;

  // 1. תבניות מקסימום / עד: "עד 77 שקלים", "מקסימום 77", "לא יותר מ-77 שח", "בתקציב של עד 77"
  const maxPatterns = [
    /(?:עד|מקסימום|לא\s+יותר\s+מ-|לא\s+מעל|בתקציב\s+של\s+עד|בתקציב\s+עד|גג|תקציב\s+מקסימלי\s+של|תקציב\s+עד)\s*(\d{2,4})\s*(?:ש"ח|שח|שקלים|שקל|₪|ils)?/i,
    /(\d{2,4})\s*(?:ש"ח|שח|שקלים|שקל|₪|ils)?\s*(?:לכל\s+היותר|גג|מקסימום)/i
  ];

  // 2. תבניות מינימום / החל מ: "לפחות 77 שקלים", "מעל 77", "החל מ-77 שח"
  const minPatterns = [
    /(?:לפחות|מעל|מינימום|מ-|החל\s+מ-|תקציב\s+מינימלי\s+של)\s*(\d{2,4})\s*(?:ש"ח|שח|שקלים|שקל|₪|ils)?\s*(?:ומעלה)?/i,
    /(\d{2,4})\s*(?:ש"ח|שח|שקלים|שקל|₪|ils)?\s*(?:לפחות|ומעלה|מינימום)/i
  ];

  // 3. תבניות מחיר מפורש / מדויק: "שעולה 77 שקלים", "עולה 77 שח", "במחיר 77 שקל", "ב-77 שקלים", "של 77 שקלים", "שעולה 77"
  const exactPatterns = [
    /(?:שעולה|עולה|במחיר\s+של|במחיר|בתעריף\s+של|בתעריף|תעריף\s+של|תעריף|בדיוק\s+ב-|בדיוק|עלות\s+של|עלות)\s*(\d{2,4})\s*(?:ש"ח|שח|שקלים|שקל|₪|ils)?/i,
    /(?:ב-|ב\s*)(\d{2,4})\s*(?:ש"ח|שח|שקלים|שקל|₪|ils)/i,
    /(?:של\s*)(\d{2,4})\s*(?:ש"ח|שח|שקלים|שקל|₪|ils)/i,
    /(\d{2,4})\s*(?:ש"ח|שח|שקלים|שקל|₪)\s*(?:לשעה|לשיעור|שעה)/i,
    /(\d{2,4})\s*(?:ש"ח|שח|שקלים|שקל|₪)/i
  ];

  let rawPrice: number | null = null;
  let operator: 'exact' | 'max' | 'min' = 'exact';

  for (const pat of maxPatterns) {
    const m = q.match(pat);
    if (m && m[1]) {
      const num = parseInt(m[1], 10);
      if (!isNaN(num) && num > 0 && num < 2500) {
        rawPrice = num;
        operator = 'max';
        break;
      }
    }
  }

  if (rawPrice === null) {
    for (const pat of minPatterns) {
      const m = q.match(pat);
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > 0 && num < 2500) {
          rawPrice = num;
          operator = 'min';
          break;
        }
      }
    }
  }

  if (rawPrice === null) {
    for (const pat of exactPatterns) {
      const m = q.match(pat);
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        // בדיקה שהמספר הוא מחיר הגיוני (30 עד 2000 ₪) ושאינו שעה או כיתה
        if (!isNaN(num) && num >= 30 && num <= 2000) {
          rawPrice = num;
          operator = 'exact';
          break;
        }
      }
    }
  }

  if (rawPrice === null) return null;

  const allPrices = tutors.map(t => getTutorPrice(t)).filter(p => p > 0);
  const minPriceInSystem = allPrices.length > 0 ? Math.min(...allPrices) : 100;
  const maxPriceInSystem = allPrices.length > 0 ? Math.max(...allPrices) : 300;

  let matchingTutors: any[] = [];
  if (operator === 'exact') {
    matchingTutors = tutors.filter(t => getTutorPrice(t) === rawPrice);
  } else if (operator === 'max') {
    matchingTutors = tutors.filter(t => getTutorPrice(t) <= rawPrice);
  } else if (operator === 'min') {
    matchingTutors = tutors.filter(t => getTutorPrice(t) >= rawPrice);
  }

  // מציאת המורים עם התעריפים הקרובים ביותר
  const sortedByDistance = [...tutors].sort((a, b) => {
    const distA = Math.abs(getTutorPrice(a) - rawPrice!);
    const distB = Math.abs(getTutorPrice(b) - rawPrice!);
    return distA - distB;
  });

  let label = '';
  if (operator === 'exact') label = `שעולה בדיוק ₪${rawPrice} לשעה`;
  else if (operator === 'max') label = `עד ₪${rawPrice} לשעה`;
  else if (operator === 'min') label = `החל מ-₪${rawPrice} לשעה`;

  return {
    rawPrice,
    operator,
    label,
    matchingTutors,
    minPriceInSystem,
    maxPriceInSystem,
    closestTutors: sortedByDistance.slice(0, 3)
  };
}

export function detectRequestedGradeLevel(query: string): GradeLevelMatch | null {
  const q = (query || '').toLowerCase().trim();

  // 1. כיתה י"ב / 12
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:י["״׳']?ב|12)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:י["״׳']ב|12th\s*grade|grade\s*12)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה י"ב', canonicalGradeId: 'grade_12', category: 'high', searchTokens: ['כיתה י"ב', 'כיתה יב', 'תיכון', 'בגרות'] };
  }
  // 2. כיתה י"א / 11
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:י["״׳']?א|11)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:י["״׳']א|11th\s*grade|grade\s*11)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה י"א', canonicalGradeId: 'grade_11', category: 'high', searchTokens: ['כיתה י"א', 'כיתה יא', 'תיכון', 'בגרות'] };
  }
  // 3. כיתה י' / 10
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:י['׳]?|10)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:10th\s*grade|grade\s*10)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה י\'', canonicalGradeId: 'grade_10', category: 'high', searchTokens: ['כיתה י', 'כיתה י\'', 'תיכון', 'בגרות'] };
  }
  // 4. כיתה ט' / 9
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:ט['׳]?|9)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:ט['׳]|9th\s*grade|grade\s*9)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה ט\'', canonicalGradeId: 'grade_9', category: 'middle', searchTokens: ['כיתה ט', 'כיתה ט\'', 'חטיבה', 'חטיבת ביניים'] };
  }
  // 5. כיתה ח' / 8
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:ח['׳]?|8)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:ח['׳]|8th\s*grade|grade\s*8)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה ח\'', canonicalGradeId: 'grade_8', category: 'middle', searchTokens: ['כיתה ח', 'כיתה ח\'', 'חטיבה', 'חטיבת ביניים'] };
  }
  // 6. כיתה ז' / 7
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:ז['׳]?|7)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:ז['׳]|7th\s*grade|grade\s*7)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה ז\'', canonicalGradeId: 'grade_7', category: 'middle', searchTokens: ['כיתה ז', 'כיתה ז\'', 'חטיבה', 'חטיבת ביניים'] };
  }
  // 7. כיתה ו' / 6
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:ו['׳]?|6)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:ו['׳]|6th\s*grade|grade\s*6)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה ו\'', canonicalGradeId: 'grade_6', category: 'primary', searchTokens: ['כיתה ו', 'כיתה ו\'', 'יסודי'] };
  }
  // 8. כיתה ה' / 5
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:ה['׳]?|5)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:ה['׳]|5th\s*grade|grade\s*5)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה ה\'', canonicalGradeId: 'grade_5', category: 'primary', searchTokens: ['כיתה ה', 'כיתה ה\'', 'יסודי'] };
  }
  // 9. כיתה ד' / 4
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:ד['׳]?|4)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:ד['׳]|4th\s*grade|grade\s*4)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה ד\'', canonicalGradeId: 'grade_4', category: 'primary', searchTokens: ['כיתה ד', 'כיתה ד\'', 'יסודי'] };
  }
  // 10. כיתה ג' / 3
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:ג['׳]?|3)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:ג['׳]|3rd\s*grade|grade\s*3)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה ג\'', canonicalGradeId: 'grade_3', category: 'primary', searchTokens: ['כיתה ג', 'כיתה ג\'', 'יסודי'] };
  }
  // 11. כיתה ב' / 2
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:ב['׳]?|2)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:ב['׳]|2nd\s*grade|grade\s*2)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה ב\'', canonicalGradeId: 'grade_2', category: 'primary', searchTokens: ['כיתה ב', 'כיתה ב\'', 'יסודי'] };
  }
  // 12. כיתה א' / 1
  if (q.match(/(?:כית[הת]|כיתות|לכית[הת]|לכיתות|בכית[הת]|בכיתות|שכבת|לשכבת|רמת|לרמת|עבור|של|grade|grades)\s*(?:א['׳]?|1)(?![א-תa-zA-Z0-9])|(?:^|\s)(?:א['׳]|1st\s*grade|grade\s*1)(?![א-תa-zA-Z0-9])/i)) {
    return { label: 'כיתה א\'', canonicalGradeId: 'grade_1', category: 'primary', searchTokens: ['כיתה א', 'כיתה א\'', 'יסודי'] };
  }

  // 13. קטגוריות כוללות
  if (q.includes('חטיב') || q.includes('middle school')) {
    return { label: 'חטיבת ביניים (כיתות ז-ט)', category: 'middle', searchTokens: ['חטיבה', 'חטיבת ביניים', 'כיתה ז', 'כיתה ח', 'כיתה ט'] };
  }
  if (q.includes('תיכון') || q.includes('בגרות') || q.includes('high school')) {
    return { label: 'תיכון והכנה לבגרות (כיתות י-י"ב)', category: 'high', searchTokens: ['תיכון', 'בגרות', 'הכנה לבגרות', 'כיתה י', 'כיתה י"א', 'כיתה י"ב'] };
  }
  if (q.includes('יסודי') || q.includes('elementary')) {
    return { label: 'יסודי (כיתות א-ו)', category: 'primary', searchTokens: ['יסודי', 'כיתה א', 'כיתה ב', 'כיתה ג', 'כיתה ד', 'כיתה ה', 'כיתה ו'] };
  }
  
  // הבחנה מפורשת בין "למד" (השכלת המורה האישית) ל"מלמד" (רמת הוראה שהמורה מעביר לתלמיד):
  // אם מופיע "שמלמד תואר ראשון", "מלמד תואר ראשון", "מלמד סטודנטים" -> רמת לימוד אקדמית לתלמיד (grade_academic)
  if (q.match(/(?:שמלמד|שמלמדת|מלמד|מלמדת|מלמדים|מלמדות)\s+(?:תואר\s*ראשון|סטודנטים|באקדמיה|רמה\s*אקדמית|חומר\s*אקדמי|קורסים\s*אקדמיים)/i)) {
    return { label: 'תואר ראשון / אקדמיה', canonicalGradeId: 'grade_academic', category: 'academic', searchTokens: ['תואר ראשון', 'אקדמי', 'אקדמיה', 'סטודנט'] };
  }

  // בדיקה אם הבקשה מתייחסת להשכלת המורה (למשל: "מורה שלמד תואר ראשון", "עם תואר ראשון", "בעל תואר", "איפה למד")
  // במקרה כזה, אין לפרש זאת כרמת לימוד לתלמיד אלא להשאיר לטיפול סינון ההשכלה!
  const isTeacherEducationQuery = /(?:שלמד|שלמדה|למד|למדה|שלומד|שלומדת|עם\s+תואר|בעל\s+תואר|בעלת\s+תואר|שיש\s+לו\s+תואר|שיש\s+לה\s+תואר|בוגר\s+תואר|בוגרת\s+תואר|מורה\s+עם\s+תואר|מורה\s+שלמד|מורה\s+שלמדה|השכלה|תואר\s*ראשון|תואר\s*שני|דוקטור)/i.test(q);

  if (!isTeacherEducationQuery) {
    if (q.includes('חומר של תואר ראשון') || q.includes('עזרה בתואר ראשון') || q.includes('שיעורים לסטודנטים') || q.includes('רמה אקדמית') || q.includes('חומר אקדמי') || q.includes('קורס אקדמי') || q.includes('קורסים באוניברסיטה') || q.includes('לסטודנטים לתואר')) {
      return { label: 'תואר ראשון / אקדמיה', canonicalGradeId: 'grade_academic', category: 'academic', searchTokens: ['תואר ראשון', 'אקדמי', 'אקדמיה', 'סטודנט'] };
    }
  }

  return null;
}

// ניתוח מלא ומדויק של כל הכיתות והרמות שהמורה מלמד
export function getTutorSupportedGrades(t: any): { gradeLabels: string[]; gradeIds: string[]; summary: string; raw: string } {
  const supportedGradeIds: Set<string> = new Set();
  const supportedLabels: Set<string> = new Set();

  const rawLevels = t.levels;
  let levelTokens: string[] = [];

  if (Array.isArray(rawLevels)) {
    levelTokens = rawLevels.map(item => String(item).trim()).filter(Boolean);
  } else if (typeof rawLevels === 'string' && rawLevels.trim()) {
    levelTokens = rawLevels.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  }

  const raw = levelTokens.join(', ') || (typeof rawLevels === 'string' ? rawLevels : '');

  // אם יש למורה רמות מוגדרות בשדה levels - זהו המקור הבלעדי והמדויק ביותר!
  if (levelTokens.length > 0) {
    levelTokens.forEach(token => {
      const lower = token.toLowerCase();

      // בדיקת טווחים נפוצים
      if (lower.includes('ז-ט') || lower.includes('ז׳-ט׳') || lower.includes('ז\'-ט\'') || lower.includes('חטיב')) {
        supportedGradeIds.add('grade_7');
        supportedGradeIds.add('grade_8');
        supportedGradeIds.add('grade_9');
        supportedLabels.add('כיתה ז');
        supportedLabels.add('כיתה ח');
        supportedLabels.add('כיתה ט');
      }
      if (lower.includes('י-יב') || lower.includes('י-י"ב') || lower.includes('י׳-י״ב') || lower.includes('י\'-י"ב') || lower.includes('תיכון') || lower.includes('בגרות')) {
        supportedGradeIds.add('grade_10');
        supportedGradeIds.add('grade_11');
        supportedGradeIds.add('grade_12');
        supportedLabels.add('כיתה י');
        supportedLabels.add('כיתה י"א');
        supportedLabels.add('כיתה י"ב');
      }
      if (lower.includes('א-ו') || lower.includes('א׳-ו׳') || lower.includes('א\'-ו\'') || lower.includes('יסודי')) {
        ['grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6'].forEach(id => supportedGradeIds.add(id));
        ['כיתה א', 'כיתה ב', 'כיתה ג', 'כיתה ד', 'כיתה ה', 'כיתה ו'].forEach(l => supportedLabels.add(l));
      }
      if (lower.includes('תואר') || lower.includes('אקדמ')) {
        supportedGradeIds.add('grade_academic');
        supportedLabels.add('תואר ראשון');
      }

      // התאמת כיתה קנונית פרטנית
      CANONICAL_GRADES.forEach(cg => {
        // בדיקת שוויון מלאה או האם הטוקן מכיל את שם הכיתה
        const exactMatch = cg.aliases.some(alias => {
          const a = alias.toLowerCase();
          return lower === a || lower.includes(a);
        });
        if (exactMatch) {
          supportedGradeIds.add(cg.id);
          supportedLabels.add(cg.name);
        }
      });
    });
  }

  const gradeList = Array.from(supportedLabels);
  const gradeIdsList = Array.from(supportedGradeIds);
  const summary = raw.trim() || (gradeList.length > 0 ? gradeList.join(', ') : 'לא הוגדרו רמות לימוד');

  return {
    gradeLabels: gradeList,
    gradeIds: gradeIdsList,
    summary,
    raw
  };
}

export function tutorTeachesGradeLevel(t: any, gradeMatch: GradeLevelMatch): boolean {
  const { gradeIds } = getTutorSupportedGrades(t);

  // אם למורה אין שום כיתות/רמות מוגדרות - לא משייכים אותו אוטומטית לרמה ספציפית
  if (gradeIds.length === 0) {
    return false;
  }

  if (gradeMatch.canonicalGradeId) {
    return gradeIds.includes(gradeMatch.canonicalGradeId);
  }

  if (gradeMatch.category) {
    if (gradeMatch.category === 'primary') {
      return ['grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6'].some(id => gradeIds.includes(id));
    }
    if (gradeMatch.category === 'middle') {
      return ['grade_7', 'grade_8', 'grade_9'].some(id => gradeIds.includes(id));
    }
    if (gradeMatch.category === 'high') {
      return ['grade_10', 'grade_11', 'grade_12'].some(id => gradeIds.includes(id));
    }
    if (gradeMatch.category === 'academic') {
      return gradeIds.includes('grade_academic');
    }
  }

  return false;
}

// חילוץ רשימת משבצות פנויות בלבד
function getFreeSlots(t: any): Array<{ id?: string; day: string; time: string }> {
  const rawSlots = Array.isArray(t.availableSlots) ? t.availableSlots : [];
  return rawSlots.filter((s: any) => !s.isBooked).map((s: any) => ({
    id: s.id,
    day: s.day || '',
    time: s.time || ''
  }));
}

// בדיקת התאמת שעה למשבצת
function isSlotMatchingTime(slotTime: string, targetHour: number | null, period: 'morning' | 'afternoon' | 'evening' | null): boolean {
  if (targetHour === null && !period) return true;

  const matches = slotTime.match(/(\d{1,2})(?::(\d{2}))?/g);
  if (!matches || matches.length === 0) return true;

  const startHour = parseInt(matches[0].split(':')[0], 10);
  const endHour = matches.length > 1 ? parseInt(matches[1].split(':')[0], 10) : startHour + 1;

  if (targetHour !== null) {
    return (targetHour >= startHour && targetHour < endHour) || (targetHour === startHour);
  }

  if (period === 'morning') return startHour >= 8 && startHour < 12;
  if (period === 'afternoon') return startHour >= 12 && startHour < 17;
  if (period === 'evening') return startHour >= 17 && startHour < 22;

  return true;
}

/**
 * מנוע גיבוי חכם התומך בסינון ימים ושעות פנויות, ותק, השכלה, מחיר ומקצוע
 */
function generateFallbackResponse(
  userQuery: string,
  studentName: string,
  tutorsList: any[],
  subjects: string[],
  isHebrew: boolean
): string {
  const query = (userQuery || '').toLowerCase();
  const tutors = Array.isArray(tutorsList) ? [...tutorsList] : [];

  if (tutors.length === 0) {
    return isHebrew
      ? `שלום ${studentName || 'תלמיד/ה'}, כרגע אין מורים רשומים במערכת.`
      : `Hello ${studentName || 'student'}, there are currently no tutors registered.`;
  }

  let pool = [...tutors];
  const appliedFilters: string[] = [];

  // 0.0 זיהוי בקשת מורה מוביל / סופרלטיב (למשל: "המורה למתמטיקה היקר ביותר", "הכי זול", "הכי טוב", "הכי מנוסה")
  const superlativeMatch = detectRequestedSuperlative(query, tutors);
  if (superlativeMatch) {
    const { type, matchedSubject, sortedTutors, topTutors, extremeValueDisplay, isAllEqual } = superlativeMatch;

    if (sortedTutors.length === 0) {
      return isHebrew
        ? `⚠️ **לא נמצאו במערכת מורים${matchedSubject ? ` למקצוע "${matchedSubject}"` : ''}.**`
        : `⚠️ **No tutors found${matchedSubject ? ` for "${matchedSubject}"` : ''} in the system.**`;
    }

    let resp = '';
    if (isHebrew) {
      if (type === 'highest_price') {
        if (isAllEqual) {
          resp += `שלום **${studentName || 'תלמיד/ה'}**! בדקתי את מורי ${matchedSubject ? `ה**${matchedSubject}** ` : ''}במערכת:\n\n`;
          resp += `💰 **נתוני מחירים:** כל המורים ${matchedSubject ? `ל${matchedSubject} ` : ''}במערכת גובים כרגע תעריף אחיד של **${extremeValueDisplay}** (זהו התעריף המרבי הקיים כרגע במערכת למקצוע זה).\n\n`;
          resp += `להלן מורי ${matchedSubject ? `${matchedSubject} ` : ''}המובילים במערכת בתעריף זה, מדורגים לפי דירוג ואיכות הוראה:\n\n`;
        } else {
          resp += `שלום **${studentName || 'תלמיד/ה'}**! המורה ${matchedSubject ? `ל**${matchedSubject}** ` : ''}בעל התעריף הגבוה ביותר הוא **${topTutors[0].name}** (גובה **${extremeValueDisplay}**):\n\n`;
        }
      } else if (type === 'lowest_price') {
        if (isAllEqual) {
          resp += `שלום **${studentName || 'תלמיד/ה'}**! בדקתי את מורי ${matchedSubject ? `ה**${matchedSubject}** ` : ''}במערכת:\n\n`;
          resp += `💰 **נתוני מחירים:** כל המורים ${matchedSubject ? `ל${matchedSubject} ` : ''}במערכת גובים כרגע תעריף אחיד של **${extremeValueDisplay}** (זהו התעריף המשתלם ביותר הקיים במערכת).\n\n`;
          resp += `להלן מורי ${matchedSubject ? `${matchedSubject} ` : ''}המובילים במערכת בתעריף זה, מדורגים לפי דירוג ואיכות הוראה:\n\n`;
        } else {
          resp += `שלום **${studentName || 'תלמיד/ה'}**! המורה ${matchedSubject ? `ל**${matchedSubject}** ` : ''}המשתלם והזול ביותר הוא **${topTutors[0].name}** (גובה **${extremeValueDisplay}**):\n\n`;
        }
      } else if (type === 'highest_rating') {
        resp += `שלום **${studentName || 'תלמיד/ה'}**! הנה המורים ${matchedSubject ? `ל**${matchedSubject}** ` : ''}בעלי הדירוג הגבוה ביותר במערכת (**${extremeValueDisplay}**):\n\n`;
      } else if (type === 'highest_experience') {
        resp += `שלום **${studentName || 'תלמיד/ה'}**! הנה המורים ${matchedSubject ? `ל**${matchedSubject}** ` : ''}בעלי הניסיון והוותק הרב ביותר (**${extremeValueDisplay}**):\n\n`;
      }

      sortedTutors.slice(0, 3).forEach((t, idx) => {
        const freeSlots = getFreeSlots(t);
        const { summary: gradeSummary } = getTutorSupportedGrades(t);
        const slotsSummary = freeSlots.length > 0
          ? freeSlots.map(s => `${s.day}: ${s.time}`).join(' | ')
          : 'בתיאום אישי';

        resp += `${idx + 1}. 👨‍🏫 **${t.name}**\n`;
        resp += `   • 📖 **מקצוע:** ${t.subject}\n`;
        resp += `   • 💰 **מחיר:** ₪${getTutorPrice(t)} / שעה\n`;
        resp += `   • ⭐ **דירוג:** ${getTutorRating(t).toFixed(1)} / 5.0\n`;
        if (gradeSummary) resp += `   • 📚 **רמות לימוד:** ${gradeSummary}\n`;
        if (t.experience) resp += `   • 🎖️ **ניסיון:** ${t.experience}\n`;
        if (t.education) resp += `   • 🎓 **השכלה:** ${t.education}\n`;
        resp += `   • 🗓️ **זמינות ביומן:** ${slotsSummary}\n\n`;
      });

      resp += `💡 ניתן ללחוץ על כפתור **"צפה בפרופיל"** או **"הזמן שיעור"** בכרטיס המורה כדי לתאם שיעור.`;
      return resp;
    } else {
      let resp = `Hello **${studentName || 'Student'}**! Here are the requested tutors ranked by ${superlativeMatch.label}:\n\n`;
      sortedTutors.slice(0, 3).forEach((t, idx) => {
        resp += `${idx + 1}. **${t.name}** (${t.subject}) - ₪${getTutorPrice(t)}/hr (⭐ ${getTutorRating(t).toFixed(1)})\n`;
      });
      return resp;
    }
  }

  // 0. זיהוי בקשה ספציפית לפי שם מורה (למשל: "אני רוצה מורה ששמו ניב", "מורה בשם שרה", "מחפש את יוסי")
  const nameMatch = detectRequestedTutorName(query, tutors);
  if (nameMatch) {
    if (nameMatch.matchingTutors.length > 0) {
      let resp = isHebrew
        ? `שלום ${studentName || 'תלמיד/ה'}! הנה המורה שנמצא לפי השם שביקשת (**${nameMatch.extractedName}**):\n\n`
        : `Hello ${studentName || 'student'}! Here is the tutor found matching the name (**${nameMatch.extractedName}**):\n\n`;

      nameMatch.matchingTutors.forEach((t, idx) => {
        const freeSlots = getFreeSlots(t);
        const { summary: gradeSummary } = getTutorSupportedGrades(t);
        const slotsSummary = freeSlots.length > 0
          ? freeSlots.map(s => `${s.day}: ${s.time}`).join(' | ')
          : (isHebrew ? 'אין כרגע שעות פנויות' : 'No open slots right now');

        resp += `${idx + 1}. 👨‍🏫 **${t.name}**\n`;
        resp += `   • 📖 **${isHebrew ? 'מקצוע' : 'Subject'}:** ${t.subject}\n`;
        resp += `   • 💰 **${isHebrew ? 'מחיר' : 'Price'}:** ₪${getTutorPrice(t)} / ${isHebrew ? 'שעה' : 'hr'}\n`;
        resp += `   • ⭐ **${isHebrew ? 'דירוג' : 'Rating'}:** ${getTutorRating(t).toFixed(1)} / 5.0\n`;
        if (gradeSummary) resp += `   • 📚 **${isHebrew ? 'רמות לימוד' : 'Teaching Levels'}:** ${gradeSummary}\n`;
        if (t.experience) resp += `   • 🎖️ **${isHebrew ? 'ניסיון' : 'Experience'}:** ${t.experience}\n`;
        if (t.education) resp += `   • 🎓 **${isHebrew ? 'השכלה' : 'Education'}:** ${t.education}\n`;
        resp += `   • 🗓️ **${isHebrew ? 'זמינות ביומן' : 'Available Slots'}:** ${slotsSummary}\n\n`;
      });

      if (isHebrew) {
        resp += `💡 ניתן ללחוץ על כפתור **"הזמן שיעור"** או **"שלח הודעה"** בכרטיס המורה כדי לתאם שיעור.`;
      }
      return resp;
    } else {
      let resp = isHebrew
        ? `⚠️ **לא נמצא במערכת מורה בשם "${nameMatch.extractedName}".**\n\nלהלן מורים מובילים הזמינים כרגע במערכת:\n\n`
        : `⚠️ **No tutor named "${nameMatch.extractedName}" was found in the system.**\n\nHere are top available tutors:\n\n`;

      tutors.slice(0, 3).forEach((t, idx) => {
        const { summary: gradeSummary } = getTutorSupportedGrades(t);
        resp += `${idx + 1}. **${t.name}** (${t.subject}) - ₪${getTutorPrice(t)}/${isHebrew ? 'שעה' : 'hr'} (⭐ ${getTutorRating(t).toFixed(1)})\n`;
        if (gradeSummary) resp += `   • 📚 **${isHebrew ? 'רמות לימוד' : 'Teaching Levels'}:** ${gradeSummary}\n`;
      });
      return resp;
    }
  }

  // 0.1 זיהוי בקשת מחיר מפורשת (למשל: "שעולה 77 שקלים", "עד 100 שח", "ב-80 שקל")
  const priceMatch = detectRequestedPrice(query, pool);
  if (priceMatch) {
    if (priceMatch.matchingTutors.length > 0) {
      pool = priceMatch.matchingTutors;
      appliedFilters.push(`מחיר: **${priceMatch.label}**`);
    } else {
      if (isHebrew) {
        let resp = `⚠️ **לא נמצא במערכת מורה ${priceMatch.label}.**\n\n`;
        resp += `טווח התעריפים של המורים במערכת נע בין ₪${priceMatch.minPriceInSystem} ל-₪${priceMatch.maxPriceInSystem} לשעה.\n\n`;
        resp += `להלן המורים בעלי התעריפים הקרובים ביותר הזמינים כרגע:\n\n`;
        priceMatch.closestTutors.forEach((t, idx) => {
          const { summary: gradeSummary } = getTutorSupportedGrades(t);
          resp += `${idx + 1}. **${t.name}** (${t.subject})\n`;
          resp += `   • 💰 **תעריף:** ₪${getTutorPrice(t)} / שעה | ⭐ **דירוג:** ${getTutorRating(t).toFixed(1)}\n`;
          if (gradeSummary) resp += `   • 📚 **רמות לימוד:** ${gradeSummary}\n`;
        });
        return resp;
      } else {
        return `⚠️ **No tutor found charging ₪${priceMatch.rawPrice}/hr.** The price range in the system is ₪${priceMatch.minPriceInSystem} - ₪${priceMatch.maxPriceInSystem}/hr.`;
      }
    }
  }

  // 0.2 זיהוי בקשת דירוג (למשל: "עד דירוג של 3 כוכבים", "מורה עם דירוג 3", "דירוג 4 ומעלה")
  const ratingMatch = detectRequestedRating(query, pool);
  if (ratingMatch) {
    if (ratingMatch.matchingTutors.length > 0) {
      pool = ratingMatch.matchingTutors;
      appliedFilters.push(`דירוג: **${ratingMatch.label}**`);
    } else {
      if (isHebrew) {
        let resp = `⚠️ **לא נמצא במערכת מורה העונה על הקריטריון "${ratingMatch.label}".**\n\n`;
        resp += `כל המורים במערכת מדורגים בין ⭐ ${ratingMatch.minRatingInSystem.toFixed(1)} ל-⭐ ${ratingMatch.maxRatingInSystem.toFixed(1)} כוכבים.\n\n`;
        resp += `להלן מורים מובילים הזמינים במערכת בעלי הדירוגים הקרובים ביותר:\n\n`;
        ratingMatch.closestTutors.forEach((t, idx) => {
          const { summary: gradeSummary } = getTutorSupportedGrades(t);
          resp += `${idx + 1}. **${t.name}** (${t.subject})\n`;
          resp += `   • ⭐ **דירוג:** ${getTutorRating(t).toFixed(1)} / 5.0 | 💰 **תעריף:** ₪${getTutorPrice(t)} / שעה\n`;
          if (gradeSummary) resp += `   • 📚 **רמות לימוד:** ${gradeSummary}\n`;
        });
        return resp;
      } else {
        return `⚠️ **No tutor found matching rating "${ratingMatch.label}".** Tutor ratings in the system range from ⭐ ${ratingMatch.minRatingInSystem.toFixed(1)} to ⭐ ${ratingMatch.maxRatingInSystem.toFixed(1)}.`;
      }
    }
  }

  // 1. זיהוי מקצוע
  let matchedSubject = '';
  if (query.includes('מתמטיקה') || query.includes('חשבון') || query.includes('אלגברה') || query.includes('חדוא') || query.includes('math')) {
    matchedSubject = 'מתמטיקה';
  } else if (query.includes('מחשב') || query.includes('תכנות') || query.includes('קוד') || query.includes('python') || query.includes('react') || query.includes('מדעי המחשב') || query.includes('cs')) {
    matchedSubject = 'מדעי המחשב';
  } else if (query.includes('אנגלית') || query.includes('english')) {
    matchedSubject = 'אנגלית';
  } else if (query.includes('פיזיקה') || query.includes('physics')) {
    matchedSubject = 'פיזיקה';
  } else if (query.includes('כימיה') || query.includes('chemistry')) {
    matchedSubject = 'כימיה';
  } else if (query.includes('לשון') || query.includes('עברית')) {
    matchedSubject = 'לשון ועברית';
  } else {
    const found = subjects.find(s => query.includes(s.toLowerCase()));
    if (found) matchedSubject = found;
  }

  if (matchedSubject) {
    const subFiltered = pool.filter(t => (t.subject || '').toLowerCase().includes(matchedSubject.toLowerCase()));
    if (subFiltered.length > 0) {
      pool = subFiltered;
      appliedFilters.push(`מקצוע: **${matchedSubject}**`);
    }
  }

  // 2. זיהוי כיתת לימוד / רמת לימוד (למשל: "כיתה ט", "כיתה י", "יסודי", "חטיבה", "תיכון")
  const gradeLevelMatch = detectRequestedGradeLevel(query);
  if (gradeLevelMatch) {
    const gradeFiltered = pool.filter(t => tutorTeachesGradeLevel(t, gradeLevelMatch));
    if (gradeFiltered.length > 0) {
      pool = gradeFiltered;
      appliedFilters.push(`רמת לימוד: **${gradeLevelMatch.label}**`);
    } else {
      if (isHebrew) {
        let resp = `⚠️ **לא נמצא במערכת מורה המלמד את ${gradeLevelMatch.label}${matchedSubject ? ` במקצוע ${matchedSubject}` : ''}.**\n\n`;
        resp += `להלן מורים מובילים במערכת ברמות לימוד קרובות:\n\n`;
        tutors.slice(0, 3).forEach((t, idx) => {
          const { summary: gradeSummary } = getTutorSupportedGrades(t);
          resp += `${idx + 1}. **${t.name}** (${t.subject}) - ₪${getTutorPrice(t)}/שעה (⭐ ${getTutorRating(t).toFixed(1)})\n`;
          if (gradeSummary) resp += `   • 📚 **רמות לימוד:** ${gradeSummary}\n`;
        });
        return resp;
      } else {
        return `⚠️ **No tutors found teaching ${gradeLevelMatch.label}${matchedSubject ? ` for ${matchedSubject}` : ''}.**`;
      }
    }
  }

  // 3. זיהוי יום מבוקש (ראשון, שני, שלישי, רביעי, חמישי, שישי, מוצ"ש) בצורה נקייה ומדויקת
  const requestedDay = detectRequestedDay(query);

  // 4. זיהוי שעה או טווח זמן מבוקש
  const { requestedHour, requestedPeriod } = detectRequestedHourAndPeriod(query);

  // סינון לפי זמינות ימים ושעות
  let dayFilteredTutors: any[] = [];
  if (requestedDay) {
    dayFilteredTutors = pool.filter(t => {
      const freeSlots = getFreeSlots(t);
      return freeSlots.some(s => {
        const matchesDay = (s.day || '').toLowerCase().includes(requestedDay!.toLowerCase()) || requestedDay!.includes(s.day || '');
        if (!matchesDay) return false;
        return isSlotMatchingTime(s.time, requestedHour, requestedPeriod);
      });
    });

    if (dayFilteredTutors.length > 0) {
      pool = dayFilteredTutors;
      const timeStr = requestedHour !== null ? ` בשעה ${requestedHour}:00` : requestedPeriod ? ` ב${requestedPeriod === 'morning' ? 'בוקר' : requestedPeriod === 'afternoon' ? 'צהריים/אחה"צ' : 'ערב'}` : '';
      appliedFilters.push(`זמינות: **${requestedDay}${timeStr}**`);
    } else {
      // אם לא נמצא מורה פנוי ביום ובשעה המבוקשים
      const timeDesc = requestedHour !== null ? ` בשעה ${requestedHour}:00` : requestedPeriod ? ` ב${requestedPeriod === 'morning' ? 'בוקר' : requestedPeriod === 'afternoon' ? 'אחה"צ' : 'ערב'}` : '';
      
      if (isHebrew) {
        let resp = `⚠️ **לא נמצא במערכת מורה שפנוי ב${requestedDay}${timeDesc}${matchedSubject ? ` ב${matchedSubject}` : ''}.**\n\n`;
        resp += `להלן מועדים פנויים אצל מורים מובילים במערכת:\n\n`;
        tutors.slice(0, 3).forEach((t, idx) => {
          const freeSlots = getFreeSlots(t);
          const slotsSummary = freeSlots.length > 0
            ? freeSlots.map(s => `${s.day}: ${s.time}`).join(' | ')
            : 'אין כרגע שעות פנויות';
          resp += `${idx + 1}. **${t.name}** (${t.subject}) - ₪${getTutorPrice(t)}/שעה (⭐ ${getTutorRating(t).toFixed(1)})\n`;
          resp += `   • 🗓️ **זמינות ביומן:** ${slotsSummary}\n`;
        });
        return resp;
      } else {
        return `⚠️ **No tutors found available on ${requestedDay}${timeDesc}${matchedSubject ? ` in ${matchedSubject}` : ''}.**`;
      }
    }
  }

  // 4. זיהוי שנות ניסיון (למשל: "8 שנים לפחות", "מעל 5 שנות ניסיון")
  const expMatch = query.match(/(?:לפחות|מעל|מינימום|של)?\s*(\d+)\s*(?:שנות|שנים|שנה|years)\s*(?:ניסיון|לפחות)?/);
  if (expMatch) {
    const requiredYears = parseInt(expMatch[1], 10);
    const expFiltered = pool.filter(t => getTutorExperienceYears(t) >= requiredYears);
    if (expFiltered.length > 0) {
      pool = expFiltered;
      appliedFilters.push(`ניסיון: **${requiredYears} שנות ותק לפחות**`);
    } else {
      appliedFilters.push(`ניסיון מבוקש: **${requiredYears} שנים ומעלה (לא נמצא מורה שעונה על כך במלואו, מציג את בעלי הניסיון הקרוב ביותר)**`);
      pool.sort((a, b) => getTutorExperienceYears(b) - getTutorExperienceYears(a));
    }
  }

  // 5. זיהוי השכלה (תואר ראשון / שני / דוקטורט / אקדמי)
  const educationMatch = detectRequestedEducation(query, pool);
  if (educationMatch) {
    if (educationMatch.matchingTutors.length > 0) {
      pool = educationMatch.matchingTutors;
      appliedFilters.push(`השכלה: **${educationMatch.label}**`);
    } else {
      if (isHebrew) {
        let resp = `⚠️ **לא נמצא במערכת מורה בעל השכלה של ${educationMatch.label}.**\n\n`;
        resp += `להלן מורים מובילים הזמינים במערכת והשכלתם:\n\n`;
        tutors.slice(0, 3).forEach((t, idx) => {
          resp += `${idx + 1}. **${t.name}** (${t.subject})\n`;
          resp += `   • 🎓 **השכלה:** ${t.education || t.degrees_and_education || 'בעל השכלה אקדמית'}\n`;
          resp += `   • ⭐ **דירוג:** ${getTutorRating(t).toFixed(1)} / 5.0 | 💰 **תעריף:** ₪${getTutorPrice(t)} / שעה\n`;
        });
        return resp;
      } else {
        return `⚠️ **No tutor found with education matching "${educationMatch.label}".**`;
      }
    }
  }

  // 6. מיון תוצאות: ניסיון יורד, דירוג או מחיר
  if (expMatch) {
    pool.sort((a, b) => getTutorExperienceYears(b) - getTutorExperienceYears(a));
  } else if (query.includes('יקר')) {
    pool.sort((a, b) => getTutorPrice(b) - getTutorPrice(a));
  } else if (query.includes('זול')) {
    pool.sort((a, b) => getTutorPrice(a) - getTutorPrice(b));
  } else {
    pool.sort((a, b) => getTutorRating(b) - getTutorRating(a));
  }

  if (isHebrew) {
    let text = `שלום **${studentName || 'תלמיד/ה'}**! בדקתי את מאגר המורים שלנו`;
    if (appliedFilters.length > 0) {
      text += ` לפי הקריטריונים שבחרת:\n` + appliedFilters.map(f => `• ${f}`).join('\n');
    }
    text += `:\n\n`;

    if (pool.length === 0) {
      return text + `לא נמצא מורה העונה על כל התנאים במדויק. נשמח להמליץ לך על מורים מובילים נוספים.`;
    }

    pool.slice(0, 3).forEach((t, idx) => {
      const years = getTutorExperienceYears(t);
      const freeSlots = getFreeSlots(t);
      const matchingDaySlots = requestedDay
        ? freeSlots.filter(s => (s.day || '').toLowerCase().includes(requestedDay!.toLowerCase()) || requestedDay!.includes(s.day || ''))
        : freeSlots;
      
      const slotsDisplay = matchingDaySlots.length > 0
        ? matchingDaySlots.map(s => `${s.day}: ${s.time}`).join(' | ')
        : (freeSlots.length > 0 ? freeSlots.map(s => `${s.day}: ${s.time}`).join(' | ') : 'בתיאום אישי');

      const { summary: gradeSummary } = getTutorSupportedGrades(t);
      text += `${idx + 1}. **${t.name}** (${t.subject})\n`;
      text += `   • 🗓️ **שעות פנויות:** ${slotsDisplay}\n`;
      text += `   • **תעריף:** ${getTutorPrice(t)} ₪ לשעה | **דירוג:** ⭐ ${getTutorRating(t).toFixed(1)}\n`;
      text += `   • **ניסיון:** ${t.experience || (years > 0 ? `${years} שנות ניסיון` : 'מורה מוסמך')}\n`;
      if (gradeSummary) text += `   • 📚 **רמות לימוד:** ${gradeSummary}\n`;
      if (t.education) text += `   • **השכלה:** ${t.education}\n`;
      if (t.bio) text += `   • **אודות:** ${t.bio.slice(0, 90)}...\n\n`;
    });

    return text;
  } else {
    let text = `Hello **${studentName || 'Student'}**! Here are the matched tutors:\n\n`;
    pool.slice(0, 3).forEach((t, idx) => {
      text += `${idx + 1}. **${t.name}** (${t.subject}) - Experience: ${t.experience || `${getTutorExperienceYears(t)} years`} (Rating: ⭐ ${getTutorRating(t).toFixed(1)})\n`;
    });
    return text;
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

    // משיכת נתונים חיים מ-Supabase ואיחוד עם רשימת המורים מהלקוח
    let combinedTutorsList: any[] = Array.isArray(tutorsList) ? [...tutorsList] : [];
    try {
      const [tutorsRes, usersRes, slotsRes] = await Promise.all([
        supabase.from('tutors').select('*'),
        supabase.from('users').select('*'),
        supabase.from('slots').select('*')
      ]);

      if (tutorsRes.data && tutorsRes.data.length > 0) {
        const rawTutors = tutorsRes.data;
        const rawUsers = usersRes.data || [];
        const rawSlots = slotsRes.data || [];

        const dbTutors = rawTutors.map((t: any) => {
          const userMatch = rawUsers.find((u: any) => u.id === t.id || u.tutor_profile_id === t.id || (t.email && u.email && u.email.toLowerCase() === t.email.toLowerCase()));
          const tutorSlots = rawSlots.filter((s: any) => s.tutor_id === t.id || (userMatch && s.tutor_id === userMatch.id));

          return {
            id: t.id,
            name: userMatch?.name || t.name,
            email: userMatch?.email || t.email,
            phone: userMatch?.phone || t.phone,
            subject: t.subject,
            price: Number(t.price) || 100,
            pricePerHour: Number(t.price) || 100,
            rating: Number(t.rating) || 5.0,
            bio: t.bio,
            education: t.education,
            experience: t.experience,
            levels: t.levels,
            availableSlots: tutorSlots.map((s: any) => ({
              id: s.id,
              day: s.day,
              time: s.time,
              isBooked: Boolean(s.is_booked)
            }))
          };
        });

        // עדכון או הוספת מורים ממסד הנתונים
        dbTutors.forEach((dbT: any) => {
          const idx = combinedTutorsList.findIndex((t: any) => 
            (t.id && dbT.id && t.id === dbT.id) || 
            (t.email && dbT.email && t.email.toLowerCase() === dbT.email.toLowerCase())
          );
          if (idx >= 0) {
            // שילוב שדות מה-DB עם עדיפות ל-levels העדכניים ממסד הנתונים
            combinedTutorsList[idx] = {
              ...combinedTutorsList[idx],
              ...dbT,
              levels: dbT.levels || combinedTutorsList[idx].levels,
              bio: dbT.bio || combinedTutorsList[idx].bio,
              experience: dbT.experience || combinedTutorsList[idx].experience,
              education: dbT.education || combinedTutorsList[idx].education,
              availableSlots: (dbT.availableSlots && dbT.availableSlots.length > 0) ? dbT.availableSlots : combinedTutorsList[idx].availableSlots
            };
          } else {
            combinedTutorsList.push(dbT);
          }
        });
      }
    } catch (dbErr) {
      console.warn("Supabase fetch inside AI consult failed, relying on request payload:", dbErr);
    }

    // נרמול מקדים של כל מורה למבנה נתונים חד-משמעי הכולל שעות פנויות, זמינות יומן וכיתות לימוד מנותחות
    const normalizedTutors = combinedTutorsList.map((t: any) => {
      const freeSlots = getFreeSlots(t);
      const availableDays = Array.from(new Set(freeSlots.map((s: any) => s.day)));
      const scheduleSummary = freeSlots.length > 0
        ? freeSlots.map((s: any) => `${s.day} (${s.time})`).join(', ')
        : 'אין כרגע שעות פנויות';

      const { gradeLabels, summary: levelsSummary, raw: levelsRaw } = getTutorSupportedGrades(t);

      return {
        id: t.id,
        name: t.name,
        subject: t.subject,
        price_per_hour_ils: getTutorPrice(t),
        rating_stars: getTutorRating(t),
        experience_text: t.experience || '',
        experience_years_numeric: getTutorExperienceYears(t),
        degrees_and_education: t.education || '',
        teaching_levels_raw: levelsRaw,
        teaching_levels_summary: levelsSummary,
        supported_grades_and_levels: gradeLabels.length > 0 ? gradeLabels : ['לא הוגדרו רמות לימוד'],
        available_slots: freeSlots,
        available_days: availableDays,
        available_schedule_summary: scheduleSummary,
        short_bio: (t.bio || '').slice(0, 150)
      };
    });

    // זיהוי מקדים של חיפוש מורה ספציפי לפי שם (למשל: "אני רוצה מורה ששמו ניב", "מורה בשם שרה")
    const detectedName = detectRequestedTutorName(lastUserMessage, normalizedTutors);

    // זיהוי מקדים של בקשת מורה מוביל / סופרלטיב (למשל: "המורה למתמטיקה היקר ביותר", "הכי זול", "הכי טוב", "הכי מנוסה")
    const detectedSuperlative = detectRequestedSuperlative(lastUserMessage, normalizedTutors);

    // זיהוי מקדים של בקשת מחיר מפורשת או תקרת תקציב (למשל: "אני רוצה מורה שעולה 77 שקלים", "עד 120 ₪")
    const detectedPrice = detectRequestedPrice(lastUserMessage, normalizedTutors);

    // זיהוי מקדים של בקשת דירוג (למשל: "עד דירוג של 3 כוכבים", "מורה עם דירוג 3", "דירוג 4 ומעלה")
    const detectedRating = detectRequestedRating(lastUserMessage, normalizedTutors);

    // זיהוי מקדים של בקשת השכלה / תואר של המורה (למשל: "מורה שלמד תואר ראשון", "עם תואר שני", "דוקטורט")
    const detectedEducation = detectRequestedEducation(lastUserMessage, normalizedTutors);

    // זיהוי מקדים של בקשת יום ושעה ביומן (למשל: "ביום שני", "ביום ראשון", "בשלישי ב-16:00")
    const detectedDay = detectRequestedDay(lastUserMessage);
    const { requestedHour: detectedHour, requestedPeriod: detectedPeriod } = detectRequestedHourAndPeriod(lastUserMessage);

    // זיהוי מקדים של כיתת לימוד מבוקשת עבור הנחיית AI מוחלטת
    const detectedGrade = detectRequestedGradeLevel(lastUserMessage);
    const matchingGradeTutors = detectedGrade
      ? normalizedTutors.filter(t => tutorTeachesGradeLevel(t, detectedGrade))
      : normalizedTutors;
    const nonMatchingGradeTutors = detectedGrade
      ? normalizedTutors.filter(t => !tutorTeachesGradeLevel(t, detectedGrade))
      : [];

    const client = getAiClient();

    if (client) {
      const systemInstruction = `
אתה "איידן" (Aiden), יועץ הלימודים החכם של פלטפורמת TutorDirect.
התלמיד שפונה אליך: ${studentName || "תלמיד"}.

רשימת המורים המלאה והמעודכנת במערכת:
${JSON.stringify(normalizedTutors, null, 2)}

${detectedName ? `
=====================================================
🎯 זיהוי חיפוש מורה ספציפי לפי שם: "${detectedName.extractedName}"
- מורים במערכת שנמצאו תואמים לשם זה:
${detectedName.matchingTutors.length > 0 
  ? detectedName.matchingTutors.map((t: any) => `  ✅ ${t.name} (מקצוע: ${t.subject}, רמות: ${t.teaching_levels_summary}, מחיר: ₪${t.price_per_hour_ils}/שעה, דירוג: ${t.rating_stars}, שעות פנויות: ${t.available_schedule_summary})`).join('\n') 
  : '  ❌ לא נמצא במערכת אף מורה בשם ' + detectedName.extractedName + '!'}

חוקי ברזל למענה לפי שם:
1. אם נמצא מורה תואם: הצג את פרופיל המורה במלואו (שם, מקצוע, רמות לימוד, תעריף, שעות פנויות ביומן, ניסיון והשכלה) בצורה מזמינה ומפורטת.
2. אם לא נמצא מורה בשם זה: פתח בהצהרה המפורשת:
   "⚠️ **לא נמצא במערכת מורה בשם ${detectedName.extractedName}.**"
   ורק לאחר מכן הצע מורים מובילים אחרים הזמינים במערכת.
=====================================================
` : ''}

${detectedSuperlative ? `
=====================================================
🎯 אימות והתאמה מדויקת לבקשת מורה מוביל / סופרלטיב: "${detectedSuperlative.label}"
- מקצוע מבוקש: ${detectedSuperlative.matchedSubject ? detectedSuperlative.matchedSubject : 'כללי'}
- ערך קיצוני / מרבי שנמצא: ${detectedSuperlative.extremeValueDisplay}
- האם כל המורים במקצוע גובים/בעלי אותו ערך: ${detectedSuperlative.isAllEqual ? 'כן (ערך אחיד לכולם)' : 'לא (יש מורה בעל הערך הגבוה/הנמוך ביותר)'}
- המורים המובילים/המתאימים ביותר שנמצאו במערכת:
${detectedSuperlative.topTutors.map((t: any) => `  👑 ${t.name} (מקצוע: ${t.subject}, מחיר: ₪${t.price_per_hour_ils}/שעה, דירוג: ⭐ ${t.rating_stars}, ניסיון: ${t.experience_years_numeric} שנים)`).join('\n')}

חוקי ברזל למענה לסופרלטיב:
1. מענה לבקשת "היקר ביותר" / "שעולה הכי הרבה" / "המחיר הכי גבוה":
   ${detectedSuperlative.isAllEqual 
     ? `- ציין במפורש: כל המורים ${detectedSuperlative.matchedSubject ? `ל${detectedSuperlative.matchedSubject} ` : ''}במערכת גובים כרגע תעריף אחיד של ${detectedSuperlative.extremeValueDisplay} (זהו התעריף המרבי הקיים כרגע במערכת למקצוע זה)! הצג אותם מדורגים לפי הדירוג ואיכות ההוראה הגבוהים ביותר.`
     : `- הצג במפורש את המורה/המורים בעלי התעריף הגבוה ביותר (${detectedSuperlative.extremeValueDisplay}) כמענה ישיר ומדויק לשאלה!`}
2. מענה לבקשת "הזול ביותר" / "שעולה הכי פחות" / "הכי משתלם":
   ${detectedSuperlative.isAllEqual 
     ? `- ציין במפורש: כל המורים ${detectedSuperlative.matchedSubject ? `ל${detectedSuperlative.matchedSubject} ` : ''}במערכת גובים תעריף אחיד של ${detectedSuperlative.extremeValueDisplay} (זהו התעריף המשתלם ביותר במערכת)!`
     : `- הצג במפורש את המורה/המורים בעלי התעריף הזול והמשתלם ביותר (${detectedSuperlative.extremeValueDisplay}).`}
3. מענה לבקשת "הכי טוב" / "דירוג הכי גבוה": הצג את המורים בעלי הדירוג הגבוה ביותר (${detectedSuperlative.extremeValueDisplay}).
4. מענה לבקשת "הכי מנוסה" / "הוותיק ביותר": הצג את המורים בעלי שנות הוותק והניסיון הרבות ביותר.
5. איסור מוחלט על בלבול: לעולם אל תפרש מילים כגון "למתמטיקה", "היקר", "הכי יקר", "שעולה הכי הרבה" כשם של מורה! בשום אופן אל תאמר "לא נמצא מורה בשם למתמטיקה".
=====================================================
` : ''}

${detectedPrice ? `
=====================================================
🎯 אימות והתאמה חד-משמעית לדרישת מחיר / תקציב: "${detectedPrice.label}" (מחיר מבוקש: ₪${detectedPrice.rawPrice})
- מורים במערכת שעונים על תנאי מחיר זה (${detectedPrice.label}):
${detectedPrice.matchingTutors.length > 0 
  ? detectedPrice.matchingTutors.map(t => `  ✅ ${t.name} (מקצוע: ${t.subject}, מחיר: ₪${t.price_per_hour_ils}/שעה, דירוג: ${t.rating_stars}, רמות: ${t.teaching_levels_summary})`).join('\n') 
  : `  ❌ לא נמצא במערכת אף מורה שעולה ${detectedPrice.rawPrice} ₪ לשעה!`}

- נתוני מחירים במערכת:
  * תעריף מינימום במערכת: ₪${detectedPrice.minPriceInSystem} לשעה.
  * תעריף מקסימום במערכת: ₪${detectedPrice.maxPriceInSystem} לשעה.
  * מורים עם התעריפים הקרובים ביותר במערכת:
${detectedPrice.closestTutors.map(t => `  • ${t.name} (מקצוע: ${t.subject}, תעריף: ₪${t.price_per_hour_ils}/שעה, דירוג: ${t.rating_stars})`).join('\n')}

חוקי ברזל למענה למחיר:
1. אם קיימים מורים ברשימת ה-✅: הצג אותם כמורים העונים על דרישת המחיר המבוקשת.
2. אם רשימת ה-✅ ריקה (לא קיים מורה במחיר זה):
   חובה עליך לפתוח את התשובה בהצהרה המפורשת והמדויקת:
   "⚠️ **לא קיים במערכת מורה שעולה ${detectedPrice.rawPrice} ₪ לשעה.**"
   הסבר שתעריפי המורים במערכת מתחילים מ-₪${detectedPrice.minPriceInSystem} ומגיעים עד ₪${detectedPrice.maxPriceInSystem} לשעה.
   לאחר מכן הצע את המורים בעלי התעריפים הקרובים ביותר הזמינים במערכת, תוך ציון המחיר המדויק של כל אחד מהם.
=====================================================
` : ''}

${detectedRating ? `
=====================================================
🎯 אימות והתאמה חד-משמעית לדרישת דירוג / כוכבים: "${detectedRating.label}" (דירוג מבוקש: ${detectedRating.rawRating})
- מורים במערכת שעונים על דרישת דירוג זו (${detectedRating.label}):
${detectedRating.matchingTutors.length > 0 
  ? detectedRating.matchingTutors.map(t => `  ✅ ${t.name} (מקצוע: ${t.subject}, דירוג: ⭐ ${t.rating_stars}, מחיר: ₪${t.price_per_hour_ils}/שעה, רמות: ${t.teaching_levels_summary})`).join('\n') 
  : `  ❌ לא נמצא במערכת אף מורה העונה על הקריטריון "${detectedRating.label}"!`}

- נתוני דירוגים במערכת:
  * דירוג מינימום במערכת: ⭐ ${detectedRating.minRatingInSystem.toFixed(1)}
  * דירוג מקסימום במערכת: ⭐ ${detectedRating.maxRatingInSystem.toFixed(1)}
  * מורים עם הדירוגים הקרובים ביותר:
${detectedRating.closestTutors.map(t => `  • ${t.name} (מקצוע: ${t.subject}, דירוג: ⭐ ${t.rating_stars}, מחיר: ₪${t.price_per_hour_ils}/שעה)`).join('\n')}

חוקי ברזל למענה לדירוג:
1. אם קיימים מורים ברשימת ה-✅: הצג אותם כמורים העונים על דרישת הדירוג.
2. אם רשימת ה-✅ ריקה (למשל: ביקש "עד דירוג של 3 כוכבים" או דירוג שאינו קיים):
   חובה עליך לפתוח את התשובה בהצהרה המפורשת והברורה:
   "⚠️ **לא נמצא במערכת מורה העונה על הקריטריון "${detectedRating.label}".**"
   ציין שכל המורים במערכת מדורגים בין ⭐ ${detectedRating.minRatingInSystem.toFixed(1)} ל-⭐ ${detectedRating.maxRatingInSystem.toFixed(1)} כוכבים.
   לאחר מכן הצע את המורים הזמינים במערכת בעלי הדירוגים הקרובים ביותר, תוך ציון הדירוג המדויק שלהם.
=====================================================
` : ''}

${detectedEducation ? `
=====================================================
🎯 אימות והתאמה חד-משמעית לדרישת השכלה / תואר של המורה: "${detectedEducation.label}"
- מורים במערכת העונים בדיוק על דרישת השכלה זו (${detectedEducation.label}):
${detectedEducation.matchingTutors.length > 0 
  ? detectedEducation.matchingTutors.map((t: any) => `  ✅ ${t.name} (מקצוע: ${t.subject}, השכלה: "${t.degrees_and_education || 'תואר ראשון'}", מחיר: ₪${t.price_per_hour_ils}/שעה, דירוג: ⭐ ${t.rating_stars}, רמות: ${t.teaching_levels_summary})`).join('\n') 
  : `  ❌ לא נמצא במערכת אף מורה בעל השכלה של ${detectedEducation.label}!`}

${normalizedTutors.filter((t: any) => !detectedEducation.matchingTutors.some((m: any) => m.id === t.id)).length > 0 ? `
- מורים במערכת שאינם עונים על דרישת ההשכלה הספציפית (${detectedEducation.label}) (איסור מוחלט להציע אותם כמענה ישיר לדרישה זו!):
${normalizedTutors.filter((t: any) => !detectedEducation.matchingTutors.some((m: any) => m.id === t.id)).map((t: any) => `  ⛔ ${t.name} (השכלה בפועל: "${t.degrees_and_education}", מקצוע: ${t.subject})`).join('\n')}
` : ''}

חוקי ברזל למענה להשכלה/תואר:
1. אם קיימים מורים ברשימת ה-✅: הצג אך ורק אותם כמורים מתאימים העונים על דרישת ההשכלה! איסור מוחלט להציע אף מורה מרשימת ה-⛔!
2. הפרדה מוחלטת ומדויקת בין דרגות התארים:
   - כאשר התלמיד מבקש מורה בעל "תואר ראשון" (B.Sc / B.A / בוגר): הצג אך ורק מורים שמוגדרים כבעלי תואר ראשון מרשימת ה-✅ (כגון יוסי וניב)! איסור מוחלט להציג מורה שמוגדר כבעל תואר שני (כגון שי) או דוקטורט כמענה לבקשת תואר ראשון!
   - כאשר התלמיד מבקש "תואר שני" (M.Sc / M.A / מאסטר): הצג אך ורק מורים בעלי תואר שני מרשימת ה-✅ (כגון שי), ואל תציג מורים בעלי תואר ראשון בלבד!
   - כאשר התלמיד מבקש "דוקטורט" (Ph.D): הצג אך ורק מורים בעלי דוקטורט.
3. ציין במפורש בכל מורה מוצג: "🎓 **השכלה:** [פרטי ההשכלה המדויקים מתוך degrees_and_education]".
4. אם רשימת ה-✅ ריקה: חובה עליך להצהיר מיידית "⚠️ **לא נמצא במערכת מורה בעל השכלה של ${detectedEducation.label}.**", ורק לאחר מכן להציע מורים מובילים זמינים.
5. איסור מוחלט על בלבול עם ימי השבוע: "תואר שני" (Master's degree) הוא תואר אקדמי של המורה, ואין לו שום קשר ל"יום שני"! "תואר ראשון" (Bachelor's degree) אינו קשור ל"יום ראשון"! לעולם אל תציג סינון זמינות של "יום שני" ואל תסנן מורים לפי יום שני כאשר התלמיד ביקש תואר שני!
=====================================================
` : ''}

${detectedDay ? `
=====================================================
🎯 אימות והתאמה לבקשת יום בשבוע: "${detectedDay}" ${detectedHour !== null ? `בשעה ${detectedHour}:00` : ''}
- סנן מורים שפנויים בפועל ביום זה מתוך available_slots ו-available_schedule_summary.
=====================================================
` : `
=====================================================
ℹ️ לא צוין יום מבוקש בשאילתה.
איסור מוחלט: אל תניח ואל תוסיף דרישת יום (כגון "יום שני" או "יום ראשון") כאשר מדובר בתואר אקדמי ("תואר שני" / "תואר ראשון")!
=====================================================
`}

${detectedGrade ? `
=====================================================
🎯 אימות והתאמה חד-משמעית לרמת לימוד מבוקשת: "${detectedGrade.label}"
- מורים במערכת שמוסמכים ומלמדים את ${detectedGrade.label}:
${matchingGradeTutors.length > 0 
  ? matchingGradeTutors.map(t => `  ✅ ${t.name} (מקצוע: ${t.subject}, רמות: ${t.teaching_levels_summary}, מחיר: ₪${t.price_per_hour_ils}/שעה, דירוג: ${t.rating_stars})`).join('\n') 
  : '  ❌ אין במערכת אף מורה שמלמד את ' + detectedGrade.label + '!'}

- מורים במערכת שאינם מלמדים את ${detectedGrade.label} (איסור מוחלט להציע אותם כמענה ישיר לכיתה זו!):
${nonMatchingGradeTutors.length > 0 
  ? nonMatchingGradeTutors.map(t => `  ⛔ ${t.name} (מלמד רק: ${t.teaching_levels_summary})`).join('\n')
  : '  (אין)'}

חוקי ברזל למענה:
1. אם קיימים מורים ברשימת ה-✅: הצג אך ורק אותם כמורים מתאימים לכיתה זו! אל תציע אף מורה מרשימת ה-⛔.
2. אם רשימת ה-✅ ריקה: חובה עליך לפתוח את התשובה בהצהרה המפורשת:
   "⚠️ **לא נמצא במערכת מורה המלמד את ${detectedGrade.label}.**"
   ורק לאחר מכן לציין מורים ברמות לימוד קרובות תוך הדגשה מפורשת שהם מלמדים רמות אחרות.
=====================================================
` : ''}

הנחיות חובה להתאמה מדויקת:
1. **חיפוש מורה לפי שם (למשל: "אני רוצה מורה ששמו ניב", "מורה בשם שרה", "מחפש את יוסי"):**
   - חפש את שם המורה המבוקש ברשימת המורים (שם פרטי או שם מלא).
   - אם קיים מורה תואם: הצג את כל פרטיו (שם, מקצוע, תעריף, רמות לימוד, זמינות ביומן, ניסיון, השכלה).
   - אם לא קיים מורה בשם זה: הצהר מיידית "⚠️ **לא נמצא במערכת מורה בשם [שם המורה].**" והצע מורים חלופיים.
2. **דרישת מחיר ותקציב (למשל: "אני רוצה מורה שעולה 77 שקלים", "עד 120 ₪", "ב-80 שקל"):**
   - בדוק את השדה price_per_hour_ils של כל מורה ברשימה.
   - אם לא קיים מורה במחיר המבוקש: הצהר מיידית "⚠️ **לא קיים במערכת מורה שעולה [מחיר] ₪ לשעה.**", ציין את טווח המחירים (מ-₪${detectedPrice ? detectedPrice.minPriceInSystem : '100'} לשעה) והצע מורים עם תעריפים קרובים.
3. **דרישת דירוג וכוכבים (למשל: "עד דירוג של 3 כוכבים", "מורה עם דירוג 3", "דירוג 4.5 ומעלה"):**
   - בדוק את השדה rating_stars של כל מורה ברשימה.
   - אם לא קיים מורה העונה על דרישת הדירוג: חובה עליך להצהיר מיידית ובבירור: "⚠️ **לא נמצא במערכת מורה העונה על דרישת הדירוג המבוקשת.**", לציין את טווח הדירוגים הקיים במערכת ולהציע מורים עם דירוגים קרובים.
4. **כלל ברזל גורף עבור אי-התאמה או חוסר תוצאות (No Match Rule):**
   - בכל מקרה שבו דרישה או סינון של התלמיד אינם נענים במלואם (לפי שם, מחיר, דירוג, שעות, ימים, כיתה, ניסיון, השכלה או מקצוע) - חובה עליך לציין זאת במפורש בראש התשובה (באמצעות הדגשה או אייקון ⚠️), להסביר מה חסר או לא קיים, ורק לאחר מכן להציע חלופות קרובות.
5. **התאמה קפדנית לפי כיתת לימוד ורמת לימוד:**
   - בדוק את השדות "supported_grades_and_levels" ו-"teaching_levels_summary" של כל מורה ברשימה.
   - אם התלמיד מבקש כיתה מסוימת (למשל: "כיתה ט", "כיתה י", "כיתה ד"): הצג אך ורק מורים שמלמדים בפועל את הכיתה הזו.
   - בכל הצגת מורה שהותאם, ציין במפורש: "📚 **רמות לימוד:** [מתוך teaching_levels_summary]".
6. **חיפוש לפי זמינות ימים ושעות:**
   - בדוק את שדות "available_slots" ו-"available_schedule_summary" של כל מורה ברשימה.
   - אם התלמיד מציין יום או שעה (למשל: יום שלישי בשעה 16:00, בוקר, ערב): וודא התאמה מדויקת לשעות הפנויות.
   - אם לא נמצא מורה פנוי במועד זה, הצהר בבירור שאין מורה פנוי במועד המבוקש.
   - **איסור מוחלט על בלבול בין ימי שבוע לתארים אקדמיים:** "תואר שני" (Master's degree) ו"תואר ראשון" (Bachelor's degree) הם השכלה אקדמית בלבד, ולא ימי שבוע! אל תפרש "תואר שני" כבקשה ליום שני, ואל תציג סינון זמינות לפי יום שני אלא אם התלמיד ביקש זאת במפורש!
7. **סינון לפי שנות ותק וניסיון (למשל: "8 שנים לפחות", "מעל 5 שנים"):**
   - סנן אך ורק מורים שהשדה experience_years_numeric אצלם גדול או שווה למספר המבוקש.
8. **הבחנה לשונית ומהותית קריטית בין "לָמַד" לבין "מְלַמֵּד":**
   - **"לָמַד / שָׁלָמַד / לָמְדָה / שָׁלָמְדָה / השכלה / תואר":**
     מתייחס להשכלה האישית, לתואר ולרקע האקדמי של המורה עצמו (למשל: "מורה שלמד תואר ראשון" -> מורה בעל תואר ראשון / בוגר אוניברסיטה בלבד, ולא מורה בעל תואר שני או דוקטורט; "מורה שלמד תואר שני" -> מורה בעל תואר שני / M.Sc בלבד; "מורה שלמד בטכניון" -> מורה שהמוסד האקדמי שלו הוא הטכניון; "מורה שלמד מדעי המחשב" -> מורה שתואר הלימודים שלו הוא מדעי המחשב; "איפה שרה למדה?"). יש לבדוק תמיד את השדה degrees_and_education.
   - **"מְלַמֵּד / שֶׁמְּלַמֵּד / מְלַמֶּדֶת / שֶׁמְּלַמֶּדֶת / רמת הוראה / מקצוע":**
     מתייחס למקצועות ולתלמידים שהמורה מעביר להם שיעורים בפועל בהווה (למשל: "מורה שמלמד תואר ראשון" -> מורה שמעביר שיעורים לסטודנטים אקדמיים; "מורה שמלמד מתמטיקה" -> מקצוע ההוראה הוא מתמטיקה; "מורה שמלמד כיתה י" -> מלמד תלמידי כיתה י'). יש לבדוק את השדות subject ו-supported_grades_and_levels.
   - **איסור מוחלט על בלבול:** אם התלמיד אומר "מורה שלמד תואר ראשון", אל תטען שהוא אינו מלמד סטודנטים - הוא שאל מה המורה *למד* בעצמו (השכלה)!
9. **סינון לפי השכלה ותארים (תואר ראשון, תואר שני, דוקטורט, בוגר טכניון / אוניברסיטה):**
   - בדוק את השדה degrees_and_education.
   - **הפרדה מדויקת בין רמות תואר:**
     * כאשר מתבקש מורה שלמד "תואר ראשון": הצג אך ורק מורים שהשכלתם היא תואר ראשון (B.Sc, B.A, בוגר). איסור מוחלט להציע מורה שהשכלתו היא תואר שני (כגון שי) או דוקטורט כמענה לבקשת תואר ראשון!
     * כאשר מתבקש מורה שלמד "תואר שני": הצג אך ורק מורים שהשכלתם היא תואר שני (M.Sc, M.A, מאסטר כגון שי). אל תציג מורים שלמדו תואר ראשון בלבד!
     * כאשר מתבקש מורה עם "תואר אקדמי" כללי: כל מורה בעל תואר אקדמי עונה על כך.
   - ציין בכל מורה מוצג: "🎓 **השכלה:** [מתוך degrees_and_education]".
10. **איסור מוחלט על המצאת נתונים:**
   - אל תמציא מורים, שעות, כיתות לימוד או ימים פנויים שאינם מופיעים בנתוני המורה.
11. **מענה לבקשות מורה יקר/זול/מוביל/סופרלטיב (היקר ביותר, שעולה הכי הרבה, הזול ביותר, הכי טוב, הכי מנוסה):**
   - בדוק את התעריפים או הדירוגים של המורים במקצוע המבוקש.
   - אם כל המורים למקצוע גובים תעריף זהה (למשל כולם 100 ₪ לשעה), הסבר זאת במפורש: "כל המורים למתמטיקה במערכת גובים כרגע תעריף של 100 ₪ לשעה (זהו התעריף המרבי כרגע למקצוע זה במערכת)", ודרג אותם לפי דירוג ואיכות.
   - לעולם אל תפרש שמות מקצועות (כגון "למתמטיקה", "לאנגלית") או מילות סופרלטיב כשמות פרטיים של מורים.
12. **שפה וסגנון:**
   - ${isHebrew ? 'עברית רהוטה, מאירת פנים, מסודרת עם כותרות, נקודות והדגשות ב-Markdown.' : 'Clear, professional, and friendly English with Markdown.'}
`.trim();

      const contents = messages.map((m: any) => ({
        role: (m.sender === 'user' || m.role === 'user') ? 'user' : 'model',
        parts: [{ text: m.text || '' }]
      }));

      try {
        const response = await client.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.1,
          }
        });

        if (response && response.text) {
          return NextResponse.json({ text: response.text });
        }
      } catch (geminiErr: any) {
        console.error("Gemini API error, switching to fallback:", geminiErr?.message || geminiErr);
      }
    }

    const fallbackText = generateFallbackResponse(
      lastUserMessage,
      studentName,
      combinedTutorsList,
      subjects || [],
      isHebrew
    );

    return NextResponse.json({ text: fallbackText });

  } catch (error: any) {
    console.error("AI Consult error:", error);
    return NextResponse.json({
      text: "שלום! אשמח לסייע לך. אנא ציין מקצוע מבוקש, יום ושעה רצויים, או טווח מחיר."
    });
  }
}

