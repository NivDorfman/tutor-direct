export type Language = 'he' | 'en';

export interface Translations {
  // Navigation & Header
  appTitle: string;
  appSubtitle: string;
  searchPlaceholder: string;
  allSubjects: string;
  minRating: string;
  maxPrice: string;
  allLevels: string;
  clearFilters: string;
  filterBy: string;
  sortBy: string;
  sortRecommended: string;
  sortPriceLow: string;
  sortPriceHigh: string;
  sortRating: string;
  
  // User Menu & Actions
  myProfile: string;
  myBookings: string;
  teacherDashboard: string;
  logout: string;
  chat: string;
  aiConsultant: string;
  becomeTeacher: string;
  welcomeUser: string;
  language: string;
  languageSettings: string;
  selectLanguage: string;
  hebrew: string;
  english: string;

  // Tutor Cards & Catalog
  foundTutorsCount: string;
  perHour: string;
  availableSlotsCount: string;
  availableSlots: string;
  viewProfileAndSchedule: string;
  detailsAndSchedule: string;
  verifiedTutor: string;
  noTutorsFound: string;
  noTutorsFoundDesc: string;
  reviews: string;

  // Tutor Detail Drawer
  aboutTutor: string;
  educationAndExperience: string;
  education: string;
  experience: string;
  levelsTaught: string;
  pricePerLesson: string;
  averageRating: string;
  contactDetails: string;
  availableHours: string;
  availableTeachingHours: string;
  noFixedSlotsAvailable: string;
  slotsAvailableIntro: string;
  chatBookingTitle: string;
  chatBookingDesc: string;
  startChatAndBookBtn: string;
  reviewsTitle: string;
  addReview: string;
  addReviewBtn: string;
  sendReview: string;
  anonymousReview: string;
  yourName: string;
  yourRating: string;
  reviewComment: string;
  submitReview: string;
  reviewSuccess: string;
  reviewsCount: string;
  contactInfo: string;

  // Chat & In-Chat Booking
  chatTitle: string;
  chatWithTeacher: string;
  chatWithStudent: string;
  onlineNow: string;
  scheduleLesson: string;
  deleteChat: string;
  typeMessagePlaceholder: string;
  send: string;
  chatIntroTitle: string;
  chatIntroDesc: string;
  noMessagesYet: string;
  selectConversation: string;
  selectConversationDesc: string;
  inChatBookingTitle: string;
  selectAvailableSlot: string;
  lessonTopicOptional: string;
  confirmBookingBtn: string;
  lessonBookedSuccess: string;
  confirmDeleteChatTitle: string;
  confirmDeleteChatDesc: string;
  yesDelete: string;
  cancel: string;
  close: string;

  // Profile & Settings Modal
  userProfileTitle: string;
  profilePhoto: string;
  uploadCustomPhoto: string;
  choosePresetAvatar: string;
  changeUsername: string;
  newUsername: string;
  currentPasswordConfirm: string;
  updateUsernameBtn: string;
  changePassword: string;
  sendOtpToEmail: string;
  enterOtpCode: string;
  newPasswordPlaceholder: string;
  updatePasswordBtn: string;
  interfaceLanguage: string;
  interfaceLanguageDesc: string;

  // Bookings Modal
  myLessonsTitle: string;
  studentBookingsSubtitle: string;
  teacherBookingsSubtitle: string;
  noBookingsYet: string;
  noBookingsYetDesc: string;
  upcomingLessons: string;
  lessonWith: string;
  dateAndTime: string;
  status: string;
  statusConfirmed: string;
  statusPending: string;
  cancelBooking: string;

  // AI Consultant
  aiConsultantTitle: string;
  aiConsultantSubtitle: string;
  aiPlaceholder: string;
  aiAskBtn: string;
  aiThinking: string;

  // Favorites / Wishlist
  favorites: string;
  myFavorites: string;
  showFavoritesOnly: string;
  addToFavorites: string;
  removeFromFavorites: string;
  noFavoritesYet: string;
  noFavoritesYetDesc: string;
  allTutors: string;

  // Study Materials & Uploads
  studyMaterials: string;
  studyMaterialsSubtitle: string;
  addStudyMaterial: string;
  materialName: string;
  materialNamePlaceholder: string;
  materialType: string;
  formulaSheet: string;
  summaryDoc: string;
  presentationDoc: string;
  worksheetDoc: string;
  otherDoc: string;
  uploadFileLabel: string;
  dragFileNotice: string;
  descriptionOptional: string;
  descriptionPlaceholder: string;
  uploadBtn: string;
  uploading: string;
  uploadSuccess: string;
  downloadFile: string;
  viewFile: string;
  deleteMaterial: string;
  noMaterialsYet: string;
  noMaterialsYetTeacher: string;
  materialsCountBadge: string;
  manageMaterialsTab: string;
  profileDetailsTab: string;
}

export const translations: Record<Language, Translations> = {
  he: {
    // Navigation & Header
    appTitle: 'TutorDirect',
    appSubtitle: 'הפלטפורמה המובילה למציאת מורים פרטיים איכותיים',
    searchPlaceholder: 'חיפוש לפי שם מורה או מילת מפתח...',
    allSubjects: 'כל המקצועות',
    minRating: 'דירוג מינימלי',
    maxPrice: 'מחיר מקסימלי לשעה',
    allLevels: 'כל הרמות',
    clearFilters: 'נקה סינונים',
    filterBy: 'סינון',
    sortBy: 'מיון לפי',
    sortRecommended: 'מומלצים ביותר',
    sortPriceLow: 'מחיר: מהנמוך לגבוה',
    sortPriceHigh: 'מחיר: מהגבוה לנמוך',
    sortRating: 'דירוג: הגבוה ביותר',

    // User Menu & Actions
    myProfile: 'הגדרות ופרופיל',
    myBookings: 'השיעורים שלי',
    teacherDashboard: 'אזור מורה וניהול יומן',
    logout: 'התנתקות',
    chat: 'הודעות וצ\'אט',
    aiConsultant: 'יועץ לימודי AI',
    becomeTeacher: 'הצטרף כמורה פרטי',
    welcomeUser: 'שלום',
    language: 'שפה',
    languageSettings: 'הגדרות שפה',
    selectLanguage: 'בחר שפת ממשק',
    hebrew: 'עברית (Hebrew)',
    english: 'English (אנגלית)',

    // Tutor Cards & Catalog
    foundTutorsCount: 'מורים פרטיים זמינים',
    perHour: 'שעה',
    availableSlotsCount: 'מועדים פנויים',
    availableSlots: 'מועדים פנויים',
    viewProfileAndSchedule: 'פרטים ותיאום שיעור',
    detailsAndSchedule: 'פרטים ותיאום שיעור',
    verifiedTutor: 'מורה מאומת',
    noTutorsFound: 'לא נמצאו מורים התואמים לחיפוש',
    noTutorsFoundDesc: 'נסה לשנות את הסינון או מילות החיפוש כדי לראות תוצאות נוספות.',
    reviews: 'ביקורות',

    // Tutor Detail Drawer
    aboutTutor: 'אודות המורה',
    educationAndExperience: 'השכלה וניסיון',
    education: 'השכלה והכשרה',
    experience: 'ניסיון מקצועי',
    levelsTaught: 'כיתות ורמות לימוד אותן המורה מלמד',
    pricePerLesson: 'מחיר לשיעור',
    averageRating: 'דירוג ממוצע',
    contactDetails: 'פרטי קשר לשאלות',
    availableHours: 'שעות ומועדי לימוד פנויים',
    availableTeachingHours: 'שעות ומועדי לימוד פנויים',
    noFixedSlotsAvailable: 'המורה עדיין לא הגדיר שעות פנויות קבועות. ניתן לתאם מועד מותאם אישית בצ\'אט.',
    slotsAvailableIntro: 'מועדים פנויים אליהם ניתן להירשם אצל המורה:',
    chatBookingTitle: 'מעוניין לתאם שיעור?',
    chatBookingDesc: 'כדי שתוכל להכיר את המורה, לשאול שאלות מקדימות ולתאם ציפיות בנוגע לחומרי הלימוד, הזמנת השיעור מתבצעת ישירות מתוך הצ\'אט האישי.',
    startChatAndBookBtn: 'שוחח עם המורה ותאם שיעור בצ\'אט',
    reviewsTitle: 'חוות דעת והמלצות תלמידים',
    addReview: 'הוסף חוות דעת משלך',
    addReviewBtn: 'הוסף חוות דעת',
    sendReview: 'פרסם חוות דעת',
    anonymousReview: 'פרסם כאנונימי',
    yourName: 'שמך',
    yourRating: 'דירוג',
    reviewComment: 'תוכן חוות הדעת',
    submitReview: 'פרסם ביקורת',
    reviewSuccess: 'חוות הדעת נוספה בהצלחה!',
    reviewsCount: 'ביקורות',
    contactInfo: 'פרטי יצירת קשר',

    // Chat & In-Chat Booking
    chatTitle: 'הודעות וצ\'אט',
    chatWithTeacher: 'שיח עם המורה',
    chatWithStudent: 'שיח עם התלמיד',
    onlineNow: 'מחובר/ת במערכת',
    scheduleLesson: 'תיאום שיעור',
    deleteChat: 'מחק שיחה',
    typeMessagePlaceholder: 'הקלד הודעה כאן...',
    send: 'שלח',
    chatIntroTitle: 'ערוץ צ\'אט מאובטח לתאום וקביעת שיעורים',
    chatIntroDesc: 'תוכלו לדבר כאן על חומרי הלימוד, הציפיות מהשיעור ומועד פגישה סופי.',
    noMessagesYet: 'אין הודעות קודמות. שלח הודעה כדי להתחיל את השיחה!',
    selectConversation: 'בחר שיחה מתוך הרשימה',
    selectConversationDesc: 'בחר את אחד המורים או התלמידים ברשימה כדי לפתוח את חלון השיח ולתאם את השיעור הפרטי שלכם.',
    inChatBookingTitle: 'תיאום שיעור עם המורה',
    selectAvailableSlot: 'בחר שעה פנויה לשיעור:',
    lessonTopicOptional: 'נושא השיעור / חומרי לימוד (אופציונלי):',
    confirmBookingBtn: 'אישור והזמנת שיעור',
    lessonBookedSuccess: 'השיעור תואם בהצלחה!',
    confirmDeleteChatTitle: 'מחיקת שיחה לצמיתות',
    confirmDeleteChatDesc: 'האם אתה בטוח שברצונך למחוק את השיחה לצמיתות מהרשימה? לא ניתן יהיה לשחזר את ההודעות.',
    yesDelete: 'כן, למחוק',
    cancel: 'ביטול',
    close: 'סגור',

    // Profile & Settings Modal
    userProfileTitle: 'פרופיל והגדרות משתמש',
    profilePhoto: 'תמונת פרופיל',
    uploadCustomPhoto: 'העלה תמונה מותאמת אישית',
    choosePresetAvatar: 'בחר אווטאר מעוצב או העלה תמונה משלך:',
    changeUsername: 'שינוי שם משתמש',
    newUsername: 'שם משתמש חדש',
    currentPasswordConfirm: 'הקלד את סיסמתך הנוכחית לאישור',
    updateUsernameBtn: 'עדכן שם משתמש',
    changePassword: 'שינוי סיסמה',
    sendOtpToEmail: 'שלח קוד אימות למייל',
    enterOtpCode: 'הזן את קוד האימות בן 6 הספרות',
    newPasswordPlaceholder: 'סיסמה חדשה (מינימום 8 תווים)',
    updatePasswordBtn: 'עדכן סיסמה',
    interfaceLanguage: 'שפת ממשק',
    interfaceLanguageDesc: 'בחר את שפת התצוגה המועדפת עליך באפליקציה:',

    // Bookings Modal
    myLessonsTitle: 'לוח השיעורים שלי',
    studentBookingsSubtitle: 'שיעורים שתיאמת עם מורים פרטיים',
    teacherBookingsSubtitle: 'שיעורים שהוזמנו אצלך על ידי תלמידים',
    noBookingsYet: 'אין שיעורים מוזמנים כרגע',
    noBookingsYetDesc: 'כאשר תתאם שיעורים מול מורים או תלמידים, הם יופיעו כאן בצורה מסודרת.',
    upcomingLessons: 'שיעורים קרובים',
    lessonWith: 'שיעור עם',
    dateAndTime: 'מועד ושעה',
    status: 'סטטוס',
    statusConfirmed: 'מאושר',
    statusPending: 'ממתין',
    cancelBooking: 'בטל שיעור',

    // AI Consultant
    aiConsultantTitle: 'יועץ אקדמי חכם (AI)',
    aiConsultantSubtitle: 'שאל כל שאלה בנוגע לבחירת מורה, תוכניות לימוד והכנה למבחנים',
    aiPlaceholder: 'למשל: איזה מורה מתאים להכנה לבגרות במתמטיקה 5 יחידות?',
    aiAskBtn: 'שאל יועץ',
    aiThinking: 'היועץ מעבד את בקשתך...',

    // Favorites / Wishlist
    favorites: 'מועדפים',
    myFavorites: 'המורים המועדפים שלי',
    showFavoritesOnly: 'מועדפים בלבד',
    addToFavorites: 'הוסף למועדפים',
    removeFromFavorites: 'הסר ממועדפים',
    noFavoritesYet: 'אין מורים מועדפים עדיין',
    noFavoritesYetDesc: 'לחצו על אייקון הלב בכרטיסי המורים שאהבתם כדי לשמור אותם כאן ולחזור אליהם במהירות!',
    allTutors: 'כל המורים',

    // Study Materials & Uploads
    studyMaterials: 'חומרי לימוד ודפי נוסחאות',
    studyMaterialsSubtitle: 'דפי נוסחאות, סיכומי שיעור, מצגות ודפי תרגול שהמורה הכין',
    addStudyMaterial: 'העלאת חומר לימוד חדש',
    materialName: 'שם הקובץ / כותרת',
    materialNamePlaceholder: 'למשל: דף נוסחאות בגרות 5 יח"ל - מתמטיקה',
    materialType: 'סוג החומר',
    formulaSheet: 'דף נוסחאות',
    summaryDoc: 'סיכום שיעור',
    presentationDoc: 'מצגת לימודית',
    worksheetDoc: 'דף עבודה ותרגול',
    otherDoc: 'קובץ אחר',
    uploadFileLabel: 'בחירת קובץ להעלאה',
    dragFileNotice: 'גרור ושחרר קובץ לכאן (PDF, PPTX, Word, תמונות) או לחץ לבחירה',
    descriptionOptional: 'תיאור קצר (אופציונלי)',
    descriptionPlaceholder: 'פרט בקצרה מה כולל הקובץ ואיך הוא מסייע לתלמידים...',
    uploadBtn: 'העלה ל-Supabase Storage',
    uploading: 'מעלה קובץ לשרת...',
    uploadSuccess: 'חומר הלימוד הועלה ונשמר בפרופיל בהצלחה!',
    downloadFile: 'הורדה',
    viewFile: 'צפייה בקובץ',
    deleteMaterial: 'מחק חומר לימוד',
    noMaterialsYet: 'המורה טרם העלה חומרי לימוד לפרופיל.',
    noMaterialsYetTeacher: 'טרם העלית חומרי לימוד. תוכל להעלות דפי נוסחאות, סיכומים ומצגות שיופיעו בפרופיל שלך עבור התלמידים.',
    materialsCountBadge: 'חומרי לימוד',
    manageMaterialsTab: 'חומרי לימוד וקבצים',
    profileDetailsTab: 'פרטי פרופיל ומקצועות'
  },
  en: {
    // Navigation & Header
    appTitle: 'TutorDirect',
    appSubtitle: 'The leading platform for finding top-quality private tutors',
    searchPlaceholder: 'Search by tutor name or keyword...',
    allSubjects: 'All Subjects',
    minRating: 'Minimum Rating',
    maxPrice: 'Max Hourly Rate',
    allLevels: 'All Levels',
    clearFilters: 'Clear Filters',
    filterBy: 'Filters',
    sortBy: 'Sort by',
    sortRecommended: 'Most Recommended',
    sortPriceLow: 'Price: Low to High',
    sortPriceHigh: 'Price: High to Low',
    sortRating: 'Rating: Highest',

    // User Menu & Actions
    myProfile: 'Settings & Profile',
    myBookings: 'My Lessons',
    teacherDashboard: 'Teacher Dashboard & Slots',
    logout: 'Log Out',
    chat: 'Messages & Chat',
    aiConsultant: 'AI Academic Advisor',
    becomeTeacher: 'Become a Tutor',
    welcomeUser: 'Hello',
    language: 'Language',
    languageSettings: 'Language Settings',
    selectLanguage: 'Choose Interface Language',
    hebrew: 'עברית (Hebrew)',
    english: 'English',

    // Tutor Cards & Catalog
    foundTutorsCount: 'Available Private Tutors',
    perHour: 'hr',
    availableSlotsCount: 'available slots',
    availableSlots: 'available slots',
    viewProfileAndSchedule: 'View Profile & Book',
    detailsAndSchedule: 'Details & Book Lesson',
    verifiedTutor: 'Verified Tutor',
    noTutorsFound: 'No tutors found matching your criteria',
    noTutorsFoundDesc: 'Try adjusting your filters or search keywords to see more tutors.',
    reviews: 'reviews',

    // Tutor Detail Drawer
    aboutTutor: 'About the Tutor',
    educationAndExperience: 'Education & Experience',
    education: 'Education & Training',
    experience: 'Professional Experience',
    levelsTaught: 'Levels & Grades Taught',
    pricePerLesson: 'Price per Lesson',
    averageRating: 'Average Rating',
    contactDetails: 'Contact Details',
    availableHours: 'Available Teaching Schedule',
    availableTeachingHours: 'Available Teaching Schedule',
    noFixedSlotsAvailable: 'The tutor has not set fixed hours yet. You can coordinate a custom time in chat.',
    slotsAvailableIntro: 'Available slots for registration:',
    chatBookingTitle: 'Ready to book a lesson?',
    chatBookingDesc: 'To get to know the tutor, ask preparation questions, and align expectations, lesson booking is completed directly inside the personal chat.',
    startChatAndBookBtn: 'Chat with Tutor & Schedule Lesson',
    reviewsTitle: 'Student Reviews & Ratings',
    addReview: 'Add Your Review',
    addReviewBtn: 'Add a Review',
    sendReview: 'Post Review',
    anonymousReview: 'Post Anonymously',
    yourName: 'Your Name',
    yourRating: 'Rating',
    reviewComment: 'Review Comments',
    submitReview: 'Post Review',
    reviewSuccess: 'Review submitted successfully!',
    reviewsCount: 'reviews',
    contactInfo: 'Contact Information',

    // Chat & In-Chat Booking
    chatTitle: 'Messages & Chat',
    chatWithTeacher: 'Chat with Tutor',
    chatWithStudent: 'Chat with Student',
    onlineNow: 'Online',
    scheduleLesson: 'Book Lesson',
    deleteChat: 'Delete Chat',
    typeMessagePlaceholder: 'Type a message here...',
    send: 'Send',
    chatIntroTitle: 'Secure messaging for lesson coordination and booking',
    chatIntroDesc: 'Discuss study materials, lesson expectations, and confirm your meeting time.',
    noMessagesYet: 'No previous messages. Send a message to start the conversation!',
    selectConversation: 'Select a conversation',
    selectConversationDesc: 'Choose a tutor or student from the list to open the chat and coordinate your private lesson.',
    inChatBookingTitle: 'Schedule a Lesson with Tutor',
    selectAvailableSlot: 'Select an available slot:',
    lessonTopicOptional: 'Lesson Topic / Notes (Optional):',
    confirmBookingBtn: 'Confirm & Book Lesson',
    lessonBookedSuccess: 'Lesson scheduled successfully!',
    confirmDeleteChatTitle: 'Delete Conversation',
    confirmDeleteChatDesc: 'Are you sure you want to delete this conversation? Sent messages cannot be recovered.',
    yesDelete: 'Yes, Delete',
    cancel: 'Cancel',
    close: 'Close',

    // Profile & Settings Modal
    userProfileTitle: 'User Profile & Settings',
    profilePhoto: 'Profile Photo',
    uploadCustomPhoto: 'Upload Custom Photo',
    choosePresetAvatar: 'Select a designed avatar or upload your own photo:',
    changeUsername: 'Change Username',
    newUsername: 'New Username',
    currentPasswordConfirm: 'Enter your current password to confirm',
    updateUsernameBtn: 'Update Username',
    changePassword: 'Change Password',
    sendOtpToEmail: 'Send Verification Code to Email',
    enterOtpCode: 'Enter the 6-digit verification code',
    newPasswordPlaceholder: 'New Password (min 8 chars)',
    updatePasswordBtn: 'Update Password',
    interfaceLanguage: 'Interface Language',
    interfaceLanguageDesc: 'Choose your preferred display language for the application:',

    // Bookings Modal
    myLessonsTitle: 'My Scheduled Lessons',
    studentBookingsSubtitle: 'Lessons you scheduled with private tutors',
    teacherBookingsSubtitle: 'Lessons booked by students with you',
    noBookingsYet: 'No scheduled lessons yet',
    noBookingsYetDesc: 'When you book lessons with tutors or students, they will appear here.',
    upcomingLessons: 'Upcoming Lessons',
    lessonWith: 'Lesson with',
    dateAndTime: 'Date & Time',
    status: 'Status',
    statusConfirmed: 'Confirmed',
    statusPending: 'Pending',
    cancelBooking: 'Cancel Lesson',

    // AI Consultant
    aiConsultantTitle: 'AI Academic Advisor',
    aiConsultantSubtitle: 'Ask any question regarding tutor selection, study plans, and exam prep',
    aiPlaceholder: 'e.g., Which tutor is best suited for 5-unit high school math prep?',
    aiAskBtn: 'Ask Advisor',
    aiThinking: 'Advisor is thinking...',

    // Favorites / Wishlist
    favorites: 'Favorites',
    myFavorites: 'My Favorite Tutors',
    showFavoritesOnly: 'Favorites Only',
    addToFavorites: 'Add to Favorites',
    removeFromFavorites: 'Remove from Favorites',
    noFavoritesYet: 'No favorite tutors yet',
    noFavoritesYetDesc: 'Click the heart icon on any tutor card you like to save them here for quick access!',
    allTutors: 'All Tutors',

    // Study Materials & Uploads
    studyMaterials: 'Study Materials & Formula Sheets',
    studyMaterialsSubtitle: 'Formula sheets, summaries, presentations, and practice worksheets prepared by the tutor',
    addStudyMaterial: 'Upload Study Material',
    materialName: 'File Name / Title',
    materialNamePlaceholder: 'e.g., High School Math 5-Unit Formula Sheet',
    materialType: 'Material Type',
    formulaSheet: 'Formula Sheet',
    summaryDoc: 'Lesson Summary',
    presentationDoc: 'Presentation',
    worksheetDoc: 'Worksheet / Exercises',
    otherDoc: 'Other File',
    uploadFileLabel: 'Select File to Upload',
    dragFileNotice: 'Drag & drop file here (PDF, PPTX, Word, Images) or click to browse',
    descriptionOptional: 'Brief Description (Optional)',
    descriptionPlaceholder: 'Briefly explain what this file includes and how it helps students...',
    uploadBtn: 'Upload to Supabase Storage',
    uploading: 'Uploading file to storage...',
    uploadSuccess: 'Study material uploaded and saved to profile successfully!',
    downloadFile: 'Download',
    viewFile: 'View File',
    deleteMaterial: 'Delete Material',
    noMaterialsYet: 'This tutor has not uploaded study materials yet.',
    noMaterialsYetTeacher: 'You have not uploaded study materials yet. Upload formula sheets, summaries, or presentations to display on your profile.',
    materialsCountBadge: 'Study Materials',
    manageMaterialsTab: 'Study Materials & Files',
    profileDetailsTab: 'Profile Details & Subjects'
  }
};

export const getTranslation = (lang: Language): Translations => {
  return translations[lang] || translations.he;
};

// ================= SUBJECTS TRANSLATIONS =================
export const SUBJECT_TRANSLATIONS: Record<string, { he: string; en: string }> = {
  'מתמטיקה': { he: 'מתמטיקה', en: 'Mathematics' },
  'אנגלית': { he: 'אנגלית', en: 'English' },
  'מדעי המחשב': { he: 'מדעי המחשב', en: 'Computer Science' },
  'פיזיקה': { he: 'פיזיקה', en: 'Physics' },
  'כימיה': { he: 'כימיה', en: 'Chemistry' },
  'לשון ועברית': { he: 'לשון ועברית', en: 'Hebrew & Linguistics' },
  'ביולוגיה': { he: 'ביולוגיה', en: 'Biology' },
  'היסטוריה': { he: 'היסטוריה', en: 'History' },
  'אזרחות': { he: 'אזרחות', en: 'Civics' },
  'ספרות': { he: 'ספרות', en: 'Literature' },
  'תנ"ך': { he: 'תנ"ך', en: 'Bible Studies' },
  'תנך': { he: 'תנ"ך', en: 'Bible Studies' },
  'ערבית': { he: 'ערבית', en: 'Arabic' },
  'צרפתית': { he: 'צרפתית', en: 'French' },
  'ספרדית': { he: 'ספרדית', en: 'Spanish' },
  'כלכלה': { he: 'כלכלה', en: 'Economics' },
  'פסיכולוגיה': { he: 'פסיכולוגיה', en: 'Psychology' },
  'סטטיסטיקה': { he: 'סטטיסטיקה', en: 'Statistics' },
  'חשבונאות': { he: 'חשבונאות', en: 'Accounting' },
  'פילוסופיה': { he: 'פילוסופיה', en: 'Philosophy' },
  'מדעי החברה': { he: 'מדעי החברה', en: 'Social Sciences' },
  'גיטרה': { he: 'גיטרה', en: 'Guitar' },
  'פסנתר': { he: 'פסנתר', en: 'Piano' },
  'פיתוח קול': { he: 'פיתוח קול', en: 'Vocal Coaching' },
  'ציור': { he: 'ציור', en: 'Art & Drawing' },
  'שחמט': { he: 'שחמט', en: 'Chess' },
  'רובוטיקה': { he: 'רובוטיקה', en: 'Robotics' },
  'סייבר': { he: 'סייבר', en: 'Cyber Security' },
  'אלקטרוניקה': { he: 'אלקטרוניקה', en: 'Electronics' },
  'כל המקצועות': { he: 'כל המקצועות', en: 'All Subjects' }
};

export const translateSubject = (subject: string, lang: Language): string => {
  if (!subject) return '';
  const trimmed = subject.trim();
  if (lang === 'he') {
    // If it is in English, find corresponding Hebrew
    for (const [hebKey, val] of Object.entries(SUBJECT_TRANSLATIONS)) {
      if (val.en.toLowerCase() === trimmed.toLowerCase()) {
        return val.he;
      }
    }
    return trimmed;
  } else {
    // lang === 'en'
    if (SUBJECT_TRANSLATIONS[trimmed]) {
      return SUBJECT_TRANSLATIONS[trimmed].en;
    }
    for (const [hebKey, val] of Object.entries(SUBJECT_TRANSLATIONS)) {
      if (hebKey.toLowerCase() === trimmed.toLowerCase()) {
        return val.en;
      }
    }
    return trimmed;
  }
};

export const translateSubjectList = (subjectsString: string, lang: Language): string => {
  if (!subjectsString) return '';
  return subjectsString
    .split(',')
    .map(s => translateSubject(s.trim(), lang))
    .join(', ');
};

// ================= LEVELS TRANSLATIONS =================
export const LEVEL_TRANSLATIONS: Record<string, { he: string; en: string }> = {
  'יסודי': { he: 'יסודי', en: 'Elementary' },
  'חטיבת ביניים': { he: 'חטיבת ביניים', en: 'Middle School' },
  'תיכון': { he: 'תיכון', en: 'High School' },
  'כיתה א': { he: 'כיתה א', en: '1st Grade' },
  'כיתה ב': { he: 'כיתה ב', en: '2nd Grade' },
  'כיתה ג': { he: 'כיתה ג', en: '3rd Grade' },
  'כיתה ד': { he: 'כיתה ד', en: '4th Grade' },
  'כיתה ה': { he: 'כיתה ה', en: '5th Grade' },
  'כיתה ו': { he: 'כיתה ו', en: '6th Grade' },
  'כיתה ז': { he: 'כיתה ז', en: '7th Grade' },
  'כיתה ח': { he: 'כיתה ח', en: '8th Grade' },
  'כיתה ט': { he: 'כיתה ט', en: '9th Grade' },
  'כיתה י': { he: 'כיתה י', en: '10th Grade' },
  'כיתה י"א': { he: 'כיתה י"א', en: '11th Grade' },
  'כיתה יא': { he: 'כיתה י"א', en: '11th Grade' },
  'כיתה י"ב': { he: 'כיתה י"ב', en: '12th Grade' },
  'כיתה יב': { he: 'כיתה י"ב', en: '12th Grade' },
  'הכנה לבגרות': { he: 'הכנה לבגרות', en: 'Bagrut Prep' },
  'הכנה לפסיכומטרי': { he: 'הכנה לפסיכומטרי', en: 'Psychometric Prep' },
  'תואר ראשון': { he: 'תואר ראשון', en: 'Undergraduate / B.Sc.' },
  'אקדמי': { he: 'אקדמי', en: 'Academic' },
  'מבוגרים': { he: 'מבוגרים', en: 'Adults' },
  'כל הרמות': { he: 'כל הרמות', en: 'All Levels' }
};

export const translateLevel = (level: string, lang: Language): string => {
  if (!level) return '';
  const trimmed = level.trim();
  if (lang === 'he') {
    for (const [hebKey, val] of Object.entries(LEVEL_TRANSLATIONS)) {
      if (val.en.toLowerCase() === trimmed.toLowerCase()) {
        return val.he;
      }
    }
    return trimmed;
  } else {
    if (LEVEL_TRANSLATIONS[trimmed]) {
      return LEVEL_TRANSLATIONS[trimmed].en;
    }
    for (const [hebKey, val] of Object.entries(LEVEL_TRANSLATIONS)) {
      if (hebKey.toLowerCase() === trimmed.toLowerCase()) {
        return val.en;
      }
    }
    return trimmed;
  }
};

export const translateLevelList = (levelsString: string, lang: Language): string => {
  if (!levelsString) return '';
  return levelsString
    .split(',')
    .map(l => translateLevel(l.trim(), lang))
    .join(', ');
};

