import { Tutor, TimeSlot, Booking } from '../types';
import { isSameSlot, dayTimeToIso } from './slotUtils';
import { supabase, isValidUuid } from './supabase';

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

/**
 * Validates login input supporting either username or email.
 */
export function validateLoginInput(identifier: string, password?: string): { valid: boolean; error?: string; isEmail: boolean } {
  if (!identifier || !identifier.trim()) {
    return { valid: false, error: 'נא להזין שם משתמש או כתובת אימייל', isEmail: false };
  }

  const clean = identifier.trim();
  const isEmail = clean.includes('@');

  if (password !== undefined) {
    if (!password || !password.trim()) {
      return { valid: false, error: 'נא להזין סיסמה', isEmail };
    }
  }

  return { valid: true, isEmail };
}

/**
 * Match a user by username (name) or email (case-insensitive & trimmed).
 */
export function matchUserByIdentifier<T extends { name?: string; email?: string }>(users: T[], identifier: string): T | undefined {
  if (!identifier || !identifier.trim() || !users || users.length === 0) {
    return undefined;
  }
  const clean = identifier.trim().toLowerCase();
  return users.find(u => 
    (u.email && u.email.trim().toLowerCase() === clean) ||
    (u.name && u.name.trim().toLowerCase() === clean)
  );
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
  existingBookings?: Booking[];
}

/**
 * Checks if a specific slot is available for booking with a tutor.
 * A slot is considered available if:
 * 1) The slot's `isBooked` is false (or slot was released), AND
 * 2) There are no ACTIVE bookings ('ממתין', 'מאושר') for this slot on this tutor.
 * Cancelled bookings ('בוטל') do NOT block availability.
 */
export function isSlotAvailable(
  slot: TimeSlot, 
  tutor: Tutor, 
  existingBookings: Booking[] = []
): boolean {
  // If slot is marked as unbooked, check if there's any active non-cancelled booking on it
  const hasActiveBooking = existingBookings.some(b => {
    if (b.status === 'בוטל') return false; // Cancelled bookings don't block
    const isSameTutor = (b.tutorId && b.tutorId === tutor.id) || 
      (b.tutorEmail && tutor.email && b.tutorEmail.toLowerCase() === tutor.email.toLowerCase());
    if (!isSameTutor) return false;
    
    return (b.slot?.id && slot.id && b.slot.id === slot.id) || isSameSlot(b.slot, slot);
  });

  if (hasActiveBooking) return false;
  return !slot.isBooked;
}

/**
 * Simulates a successful lesson booking process.
 * Released (previously cancelled) slots are fully available to book.
 */
export function simulateBooking(input: BookingInput): { success: boolean; error?: string; booking?: Booking; updatedSlots?: TimeSlot[] } {
  const { tutor, selectedSlot, studentName, studentEmail, lessonNote, existingBookings = [] } = input;

  if (!studentName || !studentName.trim()) {
    return { success: false, error: 'נא להזין שם תלמיד' };
  }

  if (!studentEmail || !studentEmail.trim() || !studentEmail.includes('@')) {
    return { success: false, error: 'נא להזין כתובת אימייל תקינה' };
  }

  // Find slot index
  const slotIndex = tutor.availableSlots.findIndex(
    slot => (slot.id && selectedSlot.id && slot.id === selectedSlot.id) || isSameSlot(slot, selectedSlot)
  );

  if (slotIndex === -1) {
    return { success: false, error: 'חלון הזמן המבוקש לא נמצא במערכת' };
  }

  const targetSlot = tutor.availableSlots[slotIndex];

  // Check if there is an active (non-cancelled) booking blocking this slot
  const hasActiveBooking = existingBookings.some(b => {
    if (b.status === 'בוטל') return false;
    const isSameTutor = (b.tutorId && b.tutorId === tutor.id) || 
      (b.tutorEmail && tutor.email && b.tutorEmail.toLowerCase() === tutor.email.toLowerCase());
    if (!isSameTutor) return false;
    return (b.slot?.id && targetSlot.id && b.slot.id === targetSlot.id) || isSameSlot(b.slot, targetSlot);
  });

  if (targetSlot.isBooked && (hasActiveBooking || existingBookings.length === 0)) {
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

/**
 * Direct update of the Slot row in Supabase when cancelling a lesson.
 * Sets is_booked: false, student_id: null according to the Supabase schema:
 * (id, tutor_id, datetime, is_booked, student_id).
 */
export async function cancelSlotBookingInSupabase(
  slotId?: string,
  options?: { tutorId?: string; day?: string; time?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const updatePayload = {
      is_booked: false,
      student_id: null
    };

    if (slotId && isValidUuid(slotId)) {
      const { data, error } = await supabase
        .from('slots')
        .update(updatePayload)
        .eq('id', slotId);

      if (error) {
        console.error("Error cancelling slot in Supabase:", error);
        return { success: false, error: error.message };
      }
    }

    if (options?.tutorId) {
      if (options.day && options.time) {
        const iso = dayTimeToIso(options.day, options.time);
        const { error } = await supabase
          .from('slots')
          .update(updatePayload)
          .eq('tutor_id', options.tutorId)
          .eq('datetime', iso);
        if (error) {
          console.error("Error cancelling slot in Supabase by datetime:", error);
          return { success: false, error: error.message };
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error cancelling slot in Supabase:', err);
    return { success: false, error: err?.message || 'Error updating slot in Supabase' };
  }
}

/**
 * Direct cancellation helper for student cancelling a booking.
 * Updates the slot directly in Supabase:
 * is_booked: false, student_id: null
 */
export async function cancelBooking(
  slotId: string,
  options?: { tutorId?: string; day?: string; time?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('slots')
      .update({
        is_booked: false,
        student_id: null
      })
      .eq('id', slotId);

    if (error) {
      console.error("Error cancelling slot in Supabase:", error);
      if (typeof window !== 'undefined') {
        alert("שגיאה בביטול השיעור במסד הנתונים: " + error.message);
      }
      return { success: false, error: error.message };
    }

    if (options?.tutorId && options.day && options.time) {
      const iso = dayTimeToIso(options.day, options.time);
      await supabase
        .from('slots')
        .update({
          is_booked: false,
          student_id: null
        })
        .eq('tutor_id', options.tutorId)
        .eq('datetime', iso);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error cancelling slot in Supabase:", err);
    if (typeof window !== 'undefined') {
      alert("שגיאה בביטול השיעור במסד הנתונים: " + (err?.message || 'שגיאת רשת'));
    }
    return { success: false, error: err?.message };
  }
}

/**
 * Cancels a booking locally, releasing the slot for both student and teacher views.
 */
export function simulateCancelBooking(
  bookingId: string,
  currentBookings: Booking[],
  currentTutors: Tutor[]
): {
  updatedBookings: Booking[];
  updatedTutors: Tutor[];
} {
  const targetBooking = currentBookings.find(b => b.id === bookingId);
  const updatedBookings = currentBookings.map(b => {
    if (b.id === bookingId || (targetBooking && isSameSlot(b.slot, targetBooking.slot) && b.tutorId === targetBooking.tutorId)) {
      return {
        ...b,
        status: 'בוטל' as const,
        slot: { ...b.slot, isBooked: false }
      };
    }
    return b;
  });

  const updatedTutors = currentTutors.map(t => {
    if (targetBooking && (t.id === targetBooking.tutorId || (t.email && targetBooking.tutorEmail && t.email.toLowerCase() === targetBooking.tutorEmail.toLowerCase()))) {
      return {
        ...t,
        availableSlots: t.availableSlots.map(s => {
          if (isSameSlot(s, targetBooking.slot)) {
            return { ...s, isBooked: false };
          }
          return s;
        })
      };
    }
    return t;
  });

  return { updatedBookings, updatedTutors };
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
 * Students can submit one review per tutor after completing a lesson.
 * Editing reviews is disabled.
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
    return { eligible: false, hasCompletedLesson: false, isAlreadyReviewed: false, reason: 'יש להתחבר למערכת כדי לכתוב חוות דעת' };
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
    const rEmail = (r.reviewerEmail || (r as any).studentEmail || '').trim().toLowerCase();
    const rId = ((r as any).studentId || (r as any).userId || '').trim().toLowerCase();
    return Boolean(
      (rEmail && curEmail && rEmail === curEmail) ||
      (rId && curId && rId === curId) ||
      (!r.reviewerEmail && r.reviewerName && curName && r.reviewerName.trim().toLowerCase() === curName)
    );
  });

  // Check if current student has completed or approved a lesson with this tutor
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

    return isMatchTutor && isMatchStudent && (b.status === 'הושלם' || b.status === 'מאושר');
  });

  if (alreadyReviewed) {
    return {
      eligible: false,
      isVerifiedLesson: true,
      hasCompletedLesson: true,
      isAlreadyReviewed: true,
      reason: 'כבר נתת חוות דעת למורה זה בעבר (מתאפשרת חוות דעת אחת בלבד לכל מורה)'
    };
  }

  if (!hasCompletedLesson) {
    return {
      eligible: false,
      isVerifiedLesson: false,
      hasCompletedLesson: false,
      isAlreadyReviewed: Boolean(alreadyReviewed),
      reason: 'ניתן לכתוב חוות דעת רק לאחר קיום שיעור בפועל עם המורה'
    };
  }

  return { 
    eligible: true, 
    hasCompletedLesson: true,
    isAlreadyReviewed: false, 
    isVerifiedLesson: true
  };
}
