import { Tutor } from './types';

export const calculateTutorRating = (tutor: { rating?: number; reviews?: { rating: number }[] }): number => {
  if (tutor.reviews && tutor.reviews.length > 0) {
    const total = tutor.reviews.reduce((sum, r) => sum + (typeof r.rating === 'number' ? r.rating : 5), 0);
    return Number((total / tutor.reviews.length).toFixed(1));
  }
  return typeof tutor.rating === 'number' ? tutor.rating : 5.0;
};

export const INITIAL_TUTORS: Tutor[] = [
  {
    id: 'tutor-1',
    name: 'נועה לוי',
    subject: 'מתמטיקה',
    price: 120,
    rating: 5.0,
    email: 'noa.math@gmail.com',
    phone: '054-1234567',
    levels: 'כיתה י, כיתה י"א, כיתה י"ב',
    bio: 'סטודנטית מצטיינת להנדסת חשמל בטכניון עם תשוקה עזה להוראה. מאמינה שכל אחד יכול להצליח במתמטיקה בעזרת ההסבר הנכון והסבלנות המתאימה. מעבירה שיעורים אינטראקטיביים בגובה העיניים.',
    education: 'תואר ראשון בהנדסת חשמל, הטכניון (שנה ג\')',
    experience: '4 שנות ניסיון בהוראה פרטית, הכנה לבגרויות ברמת 3, 4, ו-5 יחידות לימוד עם 100% הצלחה.',
    availableSlots: [
      { id: 't1-s1', day: 'יום ראשון', time: '16:00 - 17:00', isBooked: false },
      { id: 't1-s2', day: 'יום ראשון', time: '17:30 - 18:30', isBooked: false },
      { id: 't1-s3', day: 'יום שלישי', time: '15:00 - 16:00', isBooked: false },
      { id: 't1-s4', day: 'יום חמישי', time: '18:00 - 19:00', isBooked: false }
    ],
    reviews: [
      { id: 'r1-1', reviewerName: 'גיא שגב', rating: 5, comment: 'מורה מדהימה! בזכות נועה עברתי מ-3 יח״ל ל-4 יח״ל וקיבלתי 95 בבגרות. היא לא מוותרת ומסבירה בצורה סבלנית ביותר.', date: '2026-06-15' },
      { id: 'r1-2', reviewerName: 'רוני כהן', rating: 5, comment: 'סבלנית, מקצועית ומסבירה את החומר בצורה פשוטה וברורה. מומלצת בחום לכל מי שמתקשה.', date: '2026-06-10' },
      { id: 'r1-3', reviewerName: 'אילן לוין', rating: 5, comment: 'שיעורים מעולים, ממוקדת מאוד בחומר של הבגרות. עזרה לי לעשות סדר בבלאגן.', date: '2026-05-28' }
    ],
    studyMaterials: [
      {
        id: 'mat-1-1',
        name: 'דף נוסחאות מורחב - חדו"א וטריגונומטריה לבגרות 5 יח"ל',
        type: 'formula_sheet',
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        fileName: 'math_5_formulas_calculus.pdf',
        fileType: 'pdf',
        fileSize: '1.2 MB',
        description: 'סיכום מקיף של כל כללי הגזירה, אינטגרלים, זהויות טריגונומטריות ונוסחאות שטח ונפח.',
        uploadedAt: '2026-08-10'
      },
      {
        id: 'mat-1-2',
        name: 'סיכום שיעור - חקירת פונקציות מעריכיות ולוגריתמיות',
        type: 'summary',
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        fileName: 'exponential_log_functions_summary.pdf',
        fileType: 'pdf',
        fileSize: '840 KB',
        description: 'דגשים לחקירה מלאה, תחום הגדרה, אסימפטוטות אנכיות ואופקיות ונקודות קיצון.',
        uploadedAt: '2026-08-14'
      }
    ]
  },
  {
    id: 'tutor-2',
    name: 'איתי כהן',
    subject: 'אנגלית',
    price: 100,
    rating: 4.7,
    email: 'itai.english@yahoo.com',
    phone: '052-7654321',
    levels: 'כיתה ז, כיתה ח, כיתה ט, כיתה י, כיתה י"א, כיתה י"ב, תואר ראשון',
    bio: 'דובר אנגלית כשפת אם שגר בארה״ב במשך 8 שנים. מומחה בשיפור הביטחון העצמי בדיבור, הכנה למבחני אמיר״ם, אנגלית עסקית והכנה לבגרות (4 ו-5 יחידות). השיעורים מתנהלים ברובם באנגלית כדי להבטיח תרגול מקסימלי.',
    education: 'תואר ראשון בספרות אנגלית, אוניברסיטת תל אביב',
    experience: '6 שנות ניסיון כמורה פרטי ומנחה קבוצות שיח באנגלית. עבד עם חברות הייטק ועם תלמידי תיכון וחטיבות ביניים.',
    availableSlots: [
      { id: 't2-s1', day: 'יום שני', time: '14:00 - 15:00', isBooked: false },
      { id: 't2-s2', day: 'יום שני', time: '16:00 - 17:00', isBooked: false },
      { id: 't2-s3', day: 'יום רביעי', time: '17:00 - 18:00', isBooked: false }
    ],
    reviews: [
      { id: 'r2-1', reviewerName: 'דנה מילר', rating: 5, comment: 'איתי מורה פשוט פנומנלי! הגעתי אליו בלי שום ביטחון לדבר אנגלית, והיום אני מנהלת שיחות שלמות בעבודה בלי להתבלבל.', date: '2026-06-20' },
      { id: 'r2-2', reviewerName: 'ניר גל', rating: 5, comment: 'מורה מצוין, קשוב מאוד לצרכים של התלמיד. מכין שיעורים מותאמים אישית עם חומרי עזר מעולים.', date: '2026-06-02' },
      { id: 'r2-3', reviewerName: 'שרון לוי', rating: 4, comment: 'שיעורים ברמה גבוהה מאוד, עזר לי רבות בהכנה למבחן אמיר״ם.', date: '2026-05-18' }
    ],
    studyMaterials: [
      {
        id: 'mat-2-1',
        name: 'טבלת זמנים מושלמת באנגלית (English Tenses Master Sheet)',
        type: 'formula_sheet',
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        fileName: 'english_tenses_mastery.pdf',
        fileType: 'pdf',
        fileSize: '650 KB',
        description: 'כל 12 הזמנים באנגלית עם מילות רמז, דוגמאות וטבלת פעלים יוצאי דופן (Irregular Verbs).',
        uploadedAt: '2026-08-05'
      }
    ]
  },
  {
    id: 'tutor-3',
    name: 'רוני מזרחי',
    subject: 'מדעי המחשב',
    price: 150,
    rating: 5.0,
    email: 'roni.code@gmail.com',
    phone: '050-9876543',
    levels: 'כיתה י, כיתה י"א, כיתה י"ב, תואר ראשון',
    bio: 'מהנדס תוכנה בכיר בחברת הייטק גלובלית, בוגר יחידה טכנולוגית בצבא. מתמחה בלימוד תכנות בסיסי ומתקדם ב-Python, Java, C++ ופיתוח אתרים (React, Node.js). מכין לבגרות במדעי המחשב ומסייע לסטודנטים באוניברסיטה עם עבודות ופרויקטים.',
    education: 'תואר ראשון במדעי המחשב, אוניברסיטת בן גוריון (בהצטיינות)',
    experience: '5 שנות ניסיון בלימוד קורסי תכנות ופיתוח. ליווה מעל 50 סטודנטים ותלמידי תיכון בהצלחה מרובה.',
    availableSlots: [
      { id: 't3-s1', day: 'יום שלישי', time: '18:00 - 19:00', isBooked: false },
      { id: 't3-s2', day: 'יום שלישי', time: '19:30 - 20:30', isBooked: false },
      { id: 't3-s3', day: 'יום חמישי', time: '19:00 - 20:00', isBooked: false }
    ],
    reviews: [
      { id: 'r3-1', reviewerName: 'אלון ברק', rating: 5, comment: 'הסברי הקוד שלו מדהימים. חומר של סמסטר שלם שלמדתי באוניברסיטה ולא הבנתי, רוני הצליח להסביר לי בשלושה שיעורים בלבד. שווה כל שקל!', date: '2026-06-25' },
      { id: 'r3-2', reviewerName: 'מיכל אטיאס', rating: 5, comment: 'מעולה מעולה מעולה! עזר לי מאוד בפרויקט הגמר של 5 יחידות במדעי המחשב. מקצוען אמיתי שמכיר את התעשייה.', date: '2026-06-18' }
    ]
  },
  {
    id: 'tutor-4',
    name: 'עדי שגב',
    subject: 'פיזיקה',
    price: 130,
    rating: 4.5,
    email: 'adi.physics@outlook.com',
    phone: '053-4567890',
    levels: 'כיתה ט, כיתה י, כיתה י"א, כיתה י"ב',
    bio: 'בוגר תואר שני בפיזיקה עם אהבה אדירה למדע. אני מאמין שפיזיקה היא לא רק נוסחאות מתמטיות, אלא הדרך שבה העולם עובד. בשיעורים שלי נבין את ההיגיון שמאחורי התופעות, מה שהופך את פתרון התרגילים לקל וטבעי הרבה יותר.',
    education: 'תואר שני בפיזיקה, האוניברסיטה העברית',
    experience: 'מורה לפיזיקה בתיכון לשעבר, מעל 7 שנות ניסיון בשיעורים פרטיים והכנה לבגרות (פיזיקה 5 יח״ל ומכניקה של שנה א\').',
    availableSlots: [
      { id: 't4-s1', day: 'יום ראשון', time: '14:00 - 15:00', isBooked: false },
      { id: 't4-s2', day: 'יום רביעי', time: '15:30 - 16:30', isBooked: false },
      { id: 't4-s3', day: 'יום רביעי', time: '17:00 - 18:00', isBooked: false }
    ],
    reviews: [
      { id: 'r4-1', reviewerName: 'יובל רז', rating: 5, comment: 'מורה מעולה לפיזיקה. מסביר את החומר בצורה מעניינת ומחבר את זה למציאות. מומלץ מאוד!', date: '2026-06-11' },
      { id: 'r4-2', reviewerName: 'אורן שלם', rating: 4, comment: 'עזר לי מאוד להתכונן למבחן בגרות במכניקה. שיעורים מסודרים ומאורגנים היטב.', date: '2026-05-14' }
    ]
  },
  {
    id: 'tutor-5',
    name: 'מיכל דוד',
    subject: 'כימיה',
    price: 110,
    rating: 4.5,
    email: 'michal.chem@gmail.com',
    phone: '054-9876543',
    levels: 'כיתה י, כיתה י"א, כיתה י"ב',
    bio: 'כימאית ומדריכת מעבדות מנוסה. מלמדת כימיה תיכונית, אקדמית והכנה למבחנים. שיעורים מותאמים אישית לצרכי התלמיד תוך שימוש באמצעי המחשה דיגיטליים מתקדמים להבנת מבנה האטום והתגובות הכימיות.',
    education: 'תואר ראשון בכימיה תרופתית, אוניברסיטת בר אילן',
    experience: '3 שנות הוראה פרטית וסיוע בהגשת דוחות מעבדה ותרגילים לסטודנטים ולתלמידי תיכון.',
    availableSlots: [
      { id: 't5-s1', day: 'יום שני', time: '18:00 - 19:00', isBooked: false },
      { id: 't5-s2', day: 'יום חמישי', time: '16:00 - 17:00', isBooked: false }
    ],
    reviews: [
      { id: 'r5-1', reviewerName: 'תמר שקד', rating: 5, comment: 'מיכל מקסימה וסבלנית. פשטה עבורי את כל המושגים המורכבים בכימיה אורגנית.', date: '2026-06-05' },
      { id: 'r5-2', reviewerName: 'יונתן אביב', rating: 4, comment: 'מורה נהדרת, עשתה לי סדר בנושא סטוכיומטריה.', date: '2026-05-22' }
    ]
  },
  {
    id: 'tutor-6',
    name: 'דניאל גולדברג',
    subject: 'כימיה',
    price: 90,
    rating: 4.7,
    email: 'daniel.med@gmail.com',
    phone: '058-2223334',
    levels: 'כיתה ז, כיתה ח, כיתה ט, כיתה י, כיתה י"א, כיתה י"ב',
    bio: 'סטודנט לרפואה בשנה ד\'. מציע שיעורים פרטיים בביולוגיה וכימיה במחיר הוגן במיוחד כדי לסייע לתלמידים. בעל שיטות זיכרון ייחודיות וטכניקות לפתרון שאלות אמריקאיות קשות.',
    education: 'סטודנט לרפואה, אוניברסיטת תל אביב (מסלול ישיר)',
    experience: 'שנתיים ניסיון בהוראה פרטית והכנה למבחנים פסיכוטכניים ולבגרויות במקצועות המדעים.',
    availableSlots: [
      { id: 't6-s1', day: 'יום שלישי', time: '16:00 - 17:00', isBooked: false },
      { id: 't6-s2', day: 'יום חמישי', time: '15:00 - 16:00', isBooked: false },
      { id: 't6-s3', day: 'יום חמישי', time: '16:30 - 17:30', isBooked: false }
    ],
    reviews: [
      { id: 'r6-1', reviewerName: 'יסמין גור', rating: 5, comment: 'מורה מעולה ומחיר מנצח! הוא עוזר להבין את הבסיס בצורה מעולה ולא רק לשנן.', date: '2026-06-22' },
      { id: 'r6-2', reviewerName: 'רועי סלע', rating: 4, comment: 'אחלה מורה, נעים מאוד וקשוב. שיפרתי את הציון שלי בכימיה באופן משמעותי.', date: '2026-06-12' },
      { id: 'r6-3', reviewerName: 'עמית כהן', rating: 5, comment: 'עזר לי מאוד בפתרון מבחנים ומודלים מורכבים.', date: '2026-05-30' }
    ]
  },
  {
    id: 'tutor-7',
    name: 'שירה אלבז',
    subject: 'לשון ועברית',
    price: 95,
    rating: 4.7,
    email: 'shira.hebrew@gmail.com',
    phone: '052-1112223',
    levels: 'כיתה ה, כיתה ו, כיתה ז, כיתה ח, כיתה ט, כיתה י, כיתה י"א, כיתה י"ב',
    bio: 'מורה מוסמכת ללשון והבעה עברית עם ניסיון עשיר בבתי ספר תיכוניים. מתמחה בהכנה ממוקדת לבחינת הבגרות בלשון, שיפור הדקדוק, הבנת הנקרא ומיומנויות כתיבה טיעונית ואקדמית.',
    education: 'תואר ראשון בחינוך ולשון עברית, מכללת לוינסקי לחינוך',
    experience: 'מעל 8 שנות הוראה במערכת החינוך ובאופן פרטני. מומחית בליקויי למידה והתאמות בדרכי הלימוד.',
    availableSlots: [
      { id: 't7-s1', day: 'יום ראשון', time: '15:00 - 16:00', isBooked: false },
      { id: 't7-s2', day: 'יום שלישי', time: '17:00 - 18:00', isBooked: false },
      { id: 't7-s3', day: 'יום רביעי', time: '16:00 - 17:00', isBooked: false }
    ],
    reviews: [
      { id: 'r7-1', reviewerName: 'נועם אריאלי', rating: 5, comment: 'המורה הכי טובה ללשון בארץ! הגעתי אליה בלי לדעת כלום בתחביר, ובזכותה הוצאתי 97 בבגרות. היא מסבירה הכל עם המון חום וסבלנות.', date: '2026-06-24' },
      { id: 'r7-2', reviewerName: 'מעיין זאב', rating: 5, comment: 'מורה מעולה, מאוד מקצועית ומסודרת. נתנה לי טיפים מעולים למבחן הבגרות.', date: '2026-06-14' },
      { id: 'r7-3', reviewerName: 'איתן גולן', rating: 4, comment: 'סבלנית מאוד, עזרה לי מאוד בכתיבה טיעונית.', date: '2026-05-19' }
    ]
  }
];

export const SUBJECTS_LIST = [
  'מתמטיקה',
  'אנגלית',
  'מדעי המחשב',
  'פיזיקה',
  'כימיה',
  'לשון ועברית'
];
