import { Tutor, TimeSlot, Booking } from '../types';

export interface RegistrationData {
  name: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  role: 'student' | 'teacher';
  phone?: string;
  bio?: string;
  education?: string;
  experience?: string;
  subject?: string;
  existingNames?: string[];
  existingPhones?: string[];
}

/**
 * Normalizes phone numbers for duplicate comparisons (e.g. 054-1234567, +972541234567 -> 0541234567).
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('972')) {
    cleaned = '0' + cleaned.slice(3);
  }
  return cleaned;
}

/**
 * Validates registration details for students and teachers.
 * Supporting step-by-step validation.
 */
export function validateRegistration(data: RegistrationData, teacherStep: number = 1): { valid: boolean; error?: string } {
  const { name, email, password, confirmPassword, role, phone, bio, education, experience, subject, existingNames, existingPhones } = data;

  if (!name || !name.trim()) {
    return { valid: false, error: 'נא להזין שם מלא' };
  }

  // Check if name is already taken by another user (case-insensitive & trimmed)
  if (existingNames && existingNames.length > 0) {
    const cleanName = name.trim().toLowerCase();
    const isTaken = existingNames.some(existing => existing && existing.trim().toLowerCase() === cleanName);
    if (isTaken) {
      return { valid: false, error: 'שם משתמש זה כבר קיים במערכת, אנא בחר שם אחר' };
    }
  }

  if (!email || !email.trim()) {
    return { valid: false, error: 'נא להזין כתובת אימייל' };
  }

  if (!email.includes('@') || email.length < 5) {
    return { valid: false, error: 'נא להזין כתובת אימייל תקינה' };
  }

  if (!password) {
    return { valid: false, error: 'נא להזין סיסמה' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'הסיסמה חייבת להכיל לפחות 8 תווים' };
  }

  if (confirmPassword !== undefined) {
    if (!confirmPassword) {
      return { valid: false, error: 'נא להקליד את הסיסמה בשנית לאימות' };
    }
    if (password !== confirmPassword) {
      return { valid: false, error: 'הסיסמאות אינן תואמות. אנא ודא שהסיסמאות בשתי התיבות זהות' };
    }
  }

  if (role === 'teacher' && teacherStep === 2) {
    if (!subject || !subject.trim()) {
      return { valid: false, error: 'נא להזין מקצוע לימוד' };
    }
    if (!phone || !phone.trim()) {
      return { valid: false, error: 'נא להזין מספר טלפון ליצירת קשר' };
    }
    const cleanPhone = phone.replace(/[- ]/g, '');
    const israelPhoneRegex = /^(?:0|\+?972)(?:5\d|7\d|[23489])\d{7}$/;
    if (!israelPhoneRegex.test(cleanPhone)) {
      return { valid: false, error: 'נא להזין מספר טלפון תקני בישראל (למשל: 054-XXXXXXX או 03-XXXXXXX)' };
    }

    // Check if phone number is already taken by another teacher
    if (existingPhones && existingPhones.length > 0) {
      const normInputPhone = normalizePhoneNumber(phone);
      const isPhoneTaken = existingPhones.some(existing => existing && normalizePhoneNumber(existing) === normInputPhone);
      if (isPhoneTaken) {
        return { valid: false, error: 'מספר טלפון זה כבר קיים במערכת, אנא בחר מספר אחר' };
      }
    }

    if (!education || !education.trim() || !experience || !experience.trim() || !bio || !bio.trim()) {
      return { valid: false, error: 'נא למלא את כל פרטי ההשכלה, הניסיון והתיאור' };
    }
    if (bio.trim().length < 20) {
      return { valid: false, error: 'התיאור האישי חייב להכיל לפחות 20 תווים' };
    }
  }

  return { valid: true };
}

export interface FilterParams {
  searchQuery: string;
  selectedSubject: string;
  subjectSearchQuery: string;
  selectedLevel: string;
  maxPrice: number;
  minRating: number;
  sortBy: string;
}

/**
 * Filters and sorts tutors based on user inputs.
 */
export function filterTutors(tutors: Tutor[], params: FilterParams): Tutor[] {
  const { searchQuery, selectedSubject, subjectSearchQuery, selectedLevel, maxPrice, minRating, sortBy } = params;

  return tutors
    .filter(tutor => {
      // Search matches name, bio, subject, or levels
      const matchSearch = !searchQuery.trim() ||
        tutor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tutor.bio && tutor.bio.toLowerCase().includes(searchQuery.toLowerCase()));

      // Subject match (Exact or Comma-separated list match)
      const matchSubject = selectedSubject === 'כל המקצועות' ||
        tutor.subject === selectedSubject ||
        (tutor.subject && tutor.subject.split(',').map(s => s.trim()).includes(selectedSubject));

      // Free-text subject search match
      const matchSubjectSearch = !subjectSearchQuery.trim() ||
        (tutor.subject && tutor.subject.toLowerCase().includes(subjectSearchQuery.toLowerCase()));

      // Level match (Class/Grade level)
      const matchLevel = selectedLevel === 'כל הרמות' ||
        (tutor.levels && tutor.levels.split(',').map(l => l.trim()).includes(selectedLevel)) ||
        (tutor.levels && tutor.levels.toLowerCase().includes(selectedLevel.toLowerCase()));

      // Price match (<= maxPrice)
      const matchPrice = tutor.price <= maxPrice;

      // Min rating
      const matchRating = tutor.rating >= minRating;

      return matchSearch && matchSubject && matchSubjectSearch && matchLevel && matchPrice && matchRating;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      if (sortBy === 'price_asc') {
        return a.price - b.price;
      }
      if (sortBy === 'price_desc') {
        return b.price - a.price;
      }
      if (sortBy === 'reviews_count') {
        return (b.reviews?.length || 0) - (a.reviews?.length || 0);
      }
      return 0;
    });
}

export interface BookingInput {
  tutor: Tutor;
  selectedSlot: TimeSlot;
  studentName: string;
  studentEmail: string;
  lessonNote: string;
}

/**
 * Simulates a successful lesson booking process.
 */
export function simulateBooking(input: BookingInput): { success: boolean; error?: string; booking?: Booking; updatedSlots?: TimeSlot[] } {
  const { tutor, selectedSlot, studentName, studentEmail, lessonNote } = input;

  if (!studentName || !studentName.trim()) {
    return { success: false, error: 'נא להזין שם תלמיד' };
  }

  if (!studentEmail || !studentEmail.trim() || !studentEmail.includes('@')) {
    return { success: false, error: 'נא להזין כתובת אימייל תקינה' };
  }

  // Find slot index
  const slotIndex = tutor.availableSlots.findIndex(
    slot => slot.day === selectedSlot.day && slot.time === selectedSlot.time
  );

  if (slotIndex === -1) {
    return { success: false, error: 'חלון הזמן המבוקש לא נמצא במערכת' };
  }

  if (tutor.availableSlots[slotIndex].isBooked) {
    return { success: false, error: 'חלון הזמן המבוקש כבר מוזמן' };
  }

  // Generate simulated booking object
  const bookingId = `booking-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const booking: Booking = {
    id: bookingId,
    tutorId: tutor.id,
    tutorName: tutor.name,
    studentName: studentName.trim(),
    studentEmail: studentEmail.trim().toLowerCase(),
    subject: tutor.subject || '',
    slot: { ...selectedSlot, isBooked: true },
    note: lessonNote || '',
    createdAt: new Date().toISOString(),
    status: 'ממתין'
  };

  // Create updated slots list
  const updatedSlots = tutor.availableSlots.map((slot, idx) => {
    if (idx === slotIndex) {
      return { ...slot, isBooked: true };
    }
    return slot;
  });

  return {
    success: true,
    booking,
    updatedSlots
  };
}

export interface ReviewEligibilityInput {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: 'student' | 'teacher';
    tutorProfileId?: string;
  } | null;
  tutor: Tutor;
  bookings: Booking[];
}

/**
 * Validates whether a student is eligible to write a review for a tutor.
 * Students can review tutors (one review per tutor, teachers cannot review, cannot review self).
 */
export function validateReviewEligibility(input: ReviewEligibilityInput): { 
  eligible: boolean; 
  isVerifiedLesson?: boolean; 
  isAlreadyReviewed?: boolean; 
  hasCompletedLesson?: boolean;
  reason?: string 
} {
  const { currentUser, tutor, bookings } = input;

  if (!currentUser) {
    return { eligible: false, hasCompletedLesson: false, isAlreadyReviewed: false, reason: 'יש להתחבר למערכת כתלמיד כדי לכתוב חוות דעת' };
  }

  if (currentUser.role === 'teacher') {
    return { eligible: false, hasCompletedLesson: false, isAlreadyReviewed: false, reason: 'מורים אינם יכולים להוסיף חוות דעת במערכת' };
  }

  const curEmail = (currentUser.email || '').trim().toLowerCase();
  const tutorEmail = (tutor.email || '').trim().toLowerCase();
  const curName = (currentUser.name || '').trim().toLowerCase();
  const tutorName = (tutor.name || '').trim().toLowerCase();
  const curId = (currentUser.id || '').trim().toLowerCase();
  const tutorId = (tutor.id || '').trim().toLowerCase();

  if (
    (curEmail && tutorEmail && curEmail === tutorEmail) ||
    (currentUser.tutorProfileId && currentUser.tutorProfileId.toLowerCase() === tutorId) ||
    curId === tutorId ||
    (curName && tutorName && curName === tutorName)
  ) {
    return { eligible: false, hasCompletedLesson: false, isAlreadyReviewed: false, reason: 'מורה אינו יכול לתת חוות דעת לעצמו' };
  }

  // Check if current student has already reviewed this tutor
  const alreadyReviewed = (tutor.reviews || []).some(r => {
    const rEmail = (r.reviewerEmail || '').trim().toLowerCase();
    return Boolean(rEmail && curEmail && rEmail === curEmail);
  });

  // Check if current student has completed a lesson with this tutor (status: 'הושלם')
  const hasCompletedLesson = (bookings || []).some(b => {
    const bTutorId = (b.tutorId || '').trim().toLowerCase();
    const bTutorName = (b.tutorName || '').trim().toLowerCase();
    const bTutorEmail = ((b as any).tutorEmail || '').trim().toLowerCase();
    const bStudentEmail = (b.studentEmail || '').trim().toLowerCase();
    const bStudentId = ((b as any).studentId || '').trim().toLowerCase();
    const bStudentName = (b.studentName || '').trim().toLowerCase();

    const isMatchTutor = 
      bTutorId === tutorId || 
      (tutorEmail && bTutorEmail === tutorEmail) ||
      (tutorName && bTutorName === tutorName);

    const isMatchStudent = 
      (curEmail && bStudentEmail === curEmail) ||
      (curId && bStudentId === curId) ||
      (curName && bStudentName === curName);

    return isMatchTutor && isMatchStudent && b.status === 'הושלם';
  });

  if (!hasCompletedLesson) {
    return {
      eligible: false,
      isVerifiedLesson: false,
      hasCompletedLesson: false,
      isAlreadyReviewed: Boolean(alreadyReviewed),
      reason: 'כתיבת חוות דעת מתאפשרת רק לאחר ששיעור עם המורה התקיים ואושר בהצלחה במערכת (סטטוס: הושלם)'
    };
  }

  if (alreadyReviewed) {
    return {
      eligible: false,
      isVerifiedLesson: true,
      hasCompletedLesson: true,
      isAlreadyReviewed: true,
      reason: 'כבר כתבת חוות דעת למורה זה בעבר (מתאפשרת חוות דעת אחת בלבד לכל מורה)'
    };
  }

  return { 
    eligible: true, 
    hasCompletedLesson: true,
    isAlreadyReviewed: false, 
    isVerifiedLesson: true 
  };
}
