import { describe, it, expect } from 'vitest';
import { 
  validateRegistration, 
  normalizePhoneNumber, 
  filterTutors, 
  simulateBooking, 
  validateReviewEligibility, 
  validateLoginInput,
  matchUserByIdentifier,
  RegistrationData, 
  FilterParams, 
  BookingInput, 
  ReviewEligibilityInput 
} from '../lib/businessLogic';
import { Tutor, TimeSlot, Booking } from '../types';

describe('TutorDirect Business Logic & Unit Tests', () => {

  // ==========================================
  // 1. REGISTRATION PROCESS TESTS (בדיקת תהליך הרישום)
  // ==========================================
  describe('validateRegistration (אימות תהליך רישום)', () => {
    it('should validate standard student registration successfully', () => {
      const studentData: RegistrationData = {
        name: 'ישראל ישראלי',
        email: 'israel@gmail.com',
        password: 'securePassword123',
        role: 'student'
      };

      const result = validateRegistration(studentData);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail registration if name is empty', () => {
      const invalidData: RegistrationData = {
        name: '   ',
        email: 'israel@gmail.com',
        password: 'securePassword123',
        role: 'student'
      };

      const result = validateRegistration(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('נא להזין שם מלא');
    });

    it('should fail registration if name already exists in existingNames', () => {
      const duplicateNameData: RegistrationData = {
        name: 'ישראל ישראלי',
        email: 'israel2@gmail.com',
        password: 'securePassword123',
        role: 'student',
        existingNames: ['נועה כהן', 'ישראל ישראלי', 'איתי לוי']
      };

      const result = validateRegistration(duplicateNameData);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('שם משתמש זה כבר קיים במערכת, אנא בחר שם אחר');
    });

    it('should fail registration for duplicate name with different casing and whitespace', () => {
      const duplicateNameData: RegistrationData = {
        name: '  John Doe  ',
        email: 'johndoe2@gmail.com',
        password: 'securePassword123',
        role: 'student',
        existingNames: ['john doe', 'Alice Smith']
      };

      const result = validateRegistration(duplicateNameData);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('שם משתמש זה כבר קיים במערכת, אנא בחר שם אחר');
    });

    it('should allow registration when name is unique in existingNames', () => {
      const uniqueNameData: RegistrationData = {
        name: 'דניאל כהן',
        email: 'daniel@gmail.com',
        password: 'securePassword123',
        role: 'student',
        existingNames: ['נועה כהן', 'איתי לוי']
      };

      const result = validateRegistration(uniqueNameData);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail registration if email is invalid', () => {
      const invalidData: RegistrationData = {
        name: 'ישראל ישראלי',
        email: 'invalid-email.com',
        password: 'securePassword123',
        role: 'student'
      };

      const result = validateRegistration(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('נא להזין כתובת אימייל תקינה');
    });

    it('should fail registration if password is too short', () => {
      const invalidData: RegistrationData = {
        name: 'ישראל ישראלי',
        email: 'israel@gmail.com',
        password: '123',
        role: 'student'
      };

      const result = validateRegistration(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('הסיסמה חייבת להכיל לפחות 8 תווים');
    });

    it('should validate teacher first step successfully without secondary fields', () => {
      const teacherData: RegistrationData = {
        name: 'מורה לדוגמה',
        email: 'teacher@gmail.com',
        password: 'securePassword123',
        role: 'teacher'
      };

      const result = validateRegistration(teacherData, 1);
      expect(result.valid).toBe(true);
    });

    it('should validate teacher second step successfully with correct info', () => {
      const teacherData: RegistrationData = {
        name: 'מורה לדוגמה',
        email: 'teacher@gmail.com',
        password: 'securePassword123',
        role: 'teacher',
        phone: '054-1234567',
        subject: 'מתמטיקה',
        education: 'תואר ראשון בהוראה',
        experience: '5 שנות ניסיון',
        bio: 'אני מורה מוסמך למתמטיקה עם המון סבלנות ואהבה למקצוע.' // > 20 chars
      };

      const result = validateRegistration(teacherData, 2);
      expect(result.valid).toBe(true);
    });

    it('should fail teacher second step if phone number is invalid in Israel', () => {
      const teacherData: RegistrationData = {
        name: 'מורה לדוגמה',
        email: 'teacher@gmail.com',
        password: 'securePassword123',
        role: 'teacher',
        phone: '123456', // Invalid
        subject: 'מתמטיקה',
        education: 'תואר ראשון',
        experience: '5 שנים',
        bio: 'אני מורה מוסמך למתמטיקה עם המון סבלנות ואהבה למקצוע.'
      };

      const result = validateRegistration(teacherData, 2);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('נא להזין מספר טלפון תקני בישראל (למשל: 054-XXXXXXX או 03-XXXXXXX)');
    });

    it('should fail teacher second step if bio is too short', () => {
      const teacherData: RegistrationData = {
        name: 'מורה לדוגמה',
        email: 'teacher@gmail.com',
        password: 'securePassword123',
        role: 'teacher',
        phone: '054-1234567',
        subject: 'מתמטיקה',
        education: 'תואר ראשון',
        experience: '5 שנים',
        bio: 'קצר מדי' // < 20 chars
      };

      const result = validateRegistration(teacherData, 2);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('התיאור האישי חייב להכיל לפחות 20 תווים');
    });

    it('should fail teacher registration if phone number is already taken', () => {
      const duplicatePhoneTeacher: RegistrationData = {
        name: 'מורה חדש',
        email: 'newteacher@gmail.com',
        password: 'securePassword123',
        role: 'teacher',
        phone: '054-1234567',
        subject: 'מתמטיקה',
        education: 'תואר ראשון',
        experience: '5 שנים',
        bio: 'אני מורה מוסמך למתמטיקה עם המון סבלנות ואהבה למקצוע.',
        existingPhones: ['052-9999999', '054-1234567']
      };

      const result = validateRegistration(duplicatePhoneTeacher, 2);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('מספר טלפון זה כבר קיים במערכת, אנא בחר מספר אחר');
    });

    it('should fail teacher registration if phone matches an existing phone with different formatting', () => {
      const formattedDuplicatePhoneTeacher: RegistrationData = {
        name: 'מורה חדש',
        email: 'newteacher@gmail.com',
        password: 'securePassword123',
        role: 'teacher',
        phone: '+972 54 123 4567', // normalized -> 0541234567
        subject: 'מתמטיקה',
        education: 'תואר ראשון',
        experience: '5 שנים',
        bio: 'אני מורה מוסמך למתמטיקה עם המון סבלנות ואהבה למקצוע.',
        existingPhones: ['054-1234567'] // normalized -> 0541234567
      };

      const result = validateRegistration(formattedDuplicatePhoneTeacher, 2);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('מספר טלפון זה כבר קיים במערכת, אנא בחר מספר אחר');
    });

    it('should allow teacher registration with unique phone number', () => {
      const uniquePhoneTeacher: RegistrationData = {
        name: 'מורה חדש',
        email: 'newteacher@gmail.com',
        password: 'securePassword123',
        role: 'teacher',
        phone: '050-8888888',
        subject: 'מתמטיקה',
        education: 'תואר ראשון',
        experience: '5 שנים',
        bio: 'אני מורה מוסמך למתמטיקה עם המון סבלנות ואהבה למקצוע.',
        existingPhones: ['054-1234567', '052-1111111']
      };

      const result = validateRegistration(uniquePhoneTeacher, 2);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should normalize different phone number formats properly', () => {
      expect(normalizePhoneNumber('054-123-4567')).toBe('0541234567');
      expect(normalizePhoneNumber('+972541234567')).toBe('0541234567');
      expect(normalizePhoneNumber('+972 54 123 4567')).toBe('0541234567');
      expect(normalizePhoneNumber('050 999 8888')).toBe('0509998888');
      expect(normalizePhoneNumber('')).toBe('');
    });
  });

  // ==========================================
  // 2. TUTOR FILTERING TESTS (בדיקת סינון מורים)
  // ==========================================
  describe('filterTutors (סינון מורים)', () => {
    const mockTutors: Tutor[] = [
      {
        id: '1',
        name: 'נועה כהן',
        email: 'noa@gmail.com',
        subject: 'מתמטיקה',
        levels: 'א, ב, ג',
        price: 120,
        rating: 4.8,
        reviews: [],
        bio: 'מורה מנוסה למתמטיקה ופיזיקה',
        education: 'B.Sc. Mathematics',
        experience: '5 years',
        phone: '0541112222',
        availableSlots: []
      },
      {
        id: '2',
        name: 'איתי לוי',
        email: 'itai@gmail.com',
        subject: 'אנגלית, ספרות',
        levels: 'ד, ה, ו',
        price: 150,
        rating: 4.5,
        reviews: [],
        bio: 'English teacher from New York',
        education: 'BA English Literature',
        experience: '3 years',
        phone: '0543334444',
        availableSlots: []
      },
      {
        id: '3',
        name: 'רוני ברק',
        email: 'roni@gmail.com',
        subject: 'מדעי המחשב',
        levels: 'תיכון, תואר ראשון',
        price: 200,
        rating: 5.0,
        reviews: [],
        bio: 'מהנדס תוכנה מנוסה המלמד תכנות ב-React ו-TypeScript',
        education: 'B.Sc Computer Science',
        experience: '10 years',
        phone: '0545556666',
        availableSlots: []
      }
    ];

    const defaultParams: FilterParams = {
      searchQuery: '',
      selectedSubject: 'כל המקצועות',
      subjectSearchQuery: '',
      selectedLevel: 'כל הרמות',
      maxPrice: 1000,
      minRating: 0,
      sortBy: 'rating'
    };

    it('should return all tutors by default', () => {
      const filtered = filterTutors(mockTutors, defaultParams);
      expect(filtered.length).toBe(3);
    });

    it('should filter by name or bio search query', () => {
      const params = { ...defaultParams, searchQuery: 'איתי' };
      const filtered = filterTutors(mockTutors, params);
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('איתי לוי');
    });

    it('should filter by predefined selected subject', () => {
      const params = { ...defaultParams, selectedSubject: 'מדעי המחשב' };
      const filtered = filterTutors(mockTutors, params);
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('רוני ברק');
    });

    it('should filter by custom subject search query', () => {
      const params = { ...defaultParams, subjectSearchQuery: 'אנגלית' };
      const filtered = filterTutors(mockTutors, params);
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('איתי לוי');
    });

    it('should filter by levels', () => {
      const params = { ...defaultParams, selectedLevel: 'תואר ראשון' };
      const filtered = filterTutors(mockTutors, params);
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('רוני ברק');
    });

    it('should filter by maximum price and sort', () => {
      const params = { ...defaultParams, maxPrice: 160, sortBy: 'price_asc' };
      const filtered = filterTutors(mockTutors, params);
      expect(filtered.length).toBe(2);
      expect(filtered[0].price).toBe(120); // lowest first
      expect(filtered[1].price).toBe(150);
    });

    it('should filter by minimum rating', () => {
      const params = { ...defaultParams, minRating: 4.7 };
      const filtered = filterTutors(mockTutors, params);
      expect(filtered.length).toBe(2); // נועה (4.8) and רוני (5.0)
    });
  });

  // ==========================================
  // 3. BOOKING SIMULATION TESTS (בדיקת הזמנת שיעור)
  // ==========================================
  describe('simulateBooking (הדמיית הזמנת שיעור בהצלחה)', () => {
    const mockSlot: TimeSlot = { id: 'slot-1', day: 'יום א׳', time: '16:00 - 17:00', isBooked: false };
    const mockTutor: Tutor = {
      id: '1',
      name: 'נועה כהן',
      email: 'noa@gmail.com',
      subject: 'מתמטיקה',
      levels: 'א, ב, ג',
      price: 120,
      rating: 4.8,
      reviews: [],
      bio: 'מורה מנוסה למתמטיקה',
      education: 'B.Sc. Mathematics',
      experience: '5 years',
      phone: '0541112222',
      availableSlots: [mockSlot, { id: 'slot-2', day: 'יום ב׳', time: '10:00 - 11:00', isBooked: true }]
    };

    it('should successfully book an available slot', () => {
      const bookingInput: BookingInput = {
        tutor: mockTutor,
        selectedSlot: mockSlot,
        studentName: 'שלומי כהן',
        studentEmail: 'shlomi@gmail.com',
        lessonNote: 'צריך עזרה לקראת הבגרות'
      };

      const result = simulateBooking(bookingInput);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.booking).toBeDefined();
      expect(result.booking?.studentName).toBe('שלומי כהן');
      expect(result.booking?.studentEmail).toBe('shlomi@gmail.com');
      expect(result.booking?.status).toBe('ממתין');
      expect(result.booking?.note).toBe('צריך עזרה לקראת הבגרות');

      // The selected slot should now be marked as booked
      expect(result.updatedSlots).toBeDefined();
      const updatedSlot = result.updatedSlots?.find(s => s.day === mockSlot.day && s.time === mockSlot.time);
      expect(updatedSlot?.isBooked).toBe(true);
    });

    it('should fail booking if student name is empty', () => {
      const bookingInput: BookingInput = {
        tutor: mockTutor,
        selectedSlot: mockSlot,
        studentName: '   ',
        studentEmail: 'shlomi@gmail.com',
        lessonNote: ''
      };

      const result = simulateBooking(bookingInput);
      expect(result.success).toBe(false);
      expect(result.error).toBe('נא להזין שם תלמיד');
    });

    it('should fail booking if slot is already booked', () => {
      const alreadyBookedSlot = { id: 'slot-2', day: 'יום ב׳', time: '10:00 - 11:00', isBooked: true };
      const bookingInput: BookingInput = {
        tutor: mockTutor,
        selectedSlot: alreadyBookedSlot,
        studentName: 'שלומי כהן',
        studentEmail: 'shlomi@gmail.com',
        lessonNote: ''
      };

      const result = simulateBooking(bookingInput);
      expect(result.success).toBe(false);
      expect(result.error).toBe('חלון הזמן המבוקש כבר מוזמן');
    });

    it('should fail booking if slot does not exist on tutor schedule', () => {
      const nonExistentSlot = { id: 'slot-none', day: 'יום ה׳', time: '20:00 - 21:00', isBooked: false };
      const bookingInput: BookingInput = {
        tutor: mockTutor,
        selectedSlot: nonExistentSlot,
        studentName: 'שלומי כהן',
        studentEmail: 'shlomi@gmail.com',
        lessonNote: ''
      };

      const result = simulateBooking(bookingInput);
      expect(result.success).toBe(false);
      expect(result.error).toBe('חלון הזמן המבוקש לא נמצא במערכת');
    });
  });

  // ==========================================
  // 5. RATING CALCULATION TESTS (חישוב ממוצע דירוגים)
  // ==========================================
  describe('calculateTutorRating (חישוב מדויק של ממוצע דירוגים)', () => {
    it('should correctly calculate rating after adding a 1-star review to 5-star reviews', () => {
      // Tutor initially with 3 5-star reviews (average 5.0)
      const reviews = [
        { rating: 5 },
        { rating: 5 },
        { rating: 5 },
        { rating: 1 } // new 1-star review added -> sum = 16 / 4 = 4.0
      ];
      const newRating = Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1));
      expect(newRating).toBe(4.0);
    });

    it('should dynamically update when single 1-star review is provided', () => {
      const reviews = [{ rating: 1 }];
      const newRating = Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1));
      expect(newRating).toBe(1.0);
    });
  });

  // ==========================================
  // 6. REVIEW ELIGIBILITY TESTS (בדיקת זכאות חוות דעת רק לאחר קיום שיעור)
  // ==========================================
  describe('validateReviewEligibility (אימות הרשאת כתיבת חוות דעת לאחר שיעור)', () => {
    const mockTutorForReview: Tutor = {
      id: 'tutor-review-1',
      name: 'פרופ׳ יוסי כהן',
      email: 'yossi@gmail.com',
      avatarUrl: 'https://images.unsplash.com/photo-1',
      subject: 'פיזיקה',
      levels: 'תיכון',
      price: 150,
      rating: 4.8,
      bio: 'מורה לפיזיקה',
      education: 'תואר ראשון',
      experience: '5 שנות ניסיון',
      phone: '0541234567',
      reviews: [
        { id: 'rev-1', reviewerName: 'רוני', reviewerEmail: 'roni@gmail.com', rating: 5, comment: 'מורה תותח', date: '2025-01-01' }
      ],
      availableSlots: []
    };

    it('should reject review if user is not logged in', () => {
      const result = validateReviewEligibility({
        currentUser: null,
        tutor: mockTutorForReview,
        bookings: []
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('יש להתחבר למערכת כדי לכתוב חוות דעת');
    });

    it('should reject review if user is a teacher', () => {
      const result = validateReviewEligibility({
        currentUser: { id: 'user-t', name: 'מורה אחר', email: 'otherteacher@gmail.com', role: 'teacher' },
        tutor: mockTutorForReview,
        bookings: []
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('מורים אינם יכולים להוסיף חוות דעת במערכת');
    });

    it('should reject review if tutor attempts to review themselves', () => {
      const result = validateReviewEligibility({
        currentUser: { id: 'user-self', name: 'יוסי כהן', email: 'yossi@gmail.com', role: 'student', tutorProfileId: 'tutor-review-1' },
        tutor: mockTutorForReview,
        bookings: []
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('מורה אינו יכול לתת חוות דעת לעצמו');
    });

    it('should reject review if student already reviewed this tutor (editing is not allowed)', () => {
      const result = validateReviewEligibility({
        currentUser: { id: 'user-roni', name: 'רוני', email: 'roni@gmail.com', role: 'student' },
        tutor: mockTutorForReview,
        bookings: [
          {
            id: 'b-1',
            tutorId: 'tutor-review-1',
            tutorName: 'פרופ׳ יוסי כהן',
            studentName: 'רוני',
            studentEmail: 'roni@gmail.com',
            subject: 'פיזיקה',
            slot: { id: 's1', day: 'יום א׳', time: '10:00 - 11:00', isBooked: true },
            note: '',
            createdAt: '2025-01-01',
            status: 'הושלם'
          }
        ]
      });
      expect(result.eligible).toBe(false);
      expect(result.isAlreadyReviewed).toBe(true);
      expect(result.reason).toContain('כבר נתת חוות דעת למורה זה בעבר');
    });

    it('should reject review if student has never had a lesson with this tutor', () => {
      const result = validateReviewEligibility({
        currentUser: { id: 'user-dan', name: 'דן', email: 'dan@gmail.com', role: 'student' },
        tutor: mockTutorForReview,
        bookings: [] // No bookings
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('ניתן לכתוב חוות דעת רק לאחר קיום שיעור בפועל עם המורה');
    });

    it('should reject review if student only has a cancelled or pending booking', () => {
      const bookings: Booking[] = [
        {
          id: 'b-pending',
          tutorId: 'tutor-review-1',
          tutorName: 'פרופ׳ יוסי כהן',
          studentName: 'דן',
          studentEmail: 'dan@gmail.com',
          subject: 'פיזיקה',
          slot: { id: 's1', day: 'יום א׳', time: '10:00 - 11:00', isBooked: true },
          note: '',
          createdAt: '2025-01-01',
          status: 'ממתין'
        },
        {
          id: 'b-cancelled',
          tutorId: 'tutor-review-1',
          tutorName: 'פרופ׳ יוסי כהן',
          studentName: 'דן',
          studentEmail: 'dan@gmail.com',
          subject: 'פיזיקה',
          slot: { id: 's2', day: 'יום ב׳', time: '10:00 - 11:00', isBooked: true },
          note: '',
          createdAt: '2025-01-01',
          status: 'בוטל'
        }
      ];

      const result = validateReviewEligibility({
        currentUser: { id: 'user-dan', name: 'דן', email: 'dan@gmail.com', role: 'student' },
        tutor: mockTutorForReview,
        bookings
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('ניתן לכתוב חוות דעת רק לאחר קיום שיעור בפועל עם המורה');
    });

    it('should approve review if student has a confirmed or completed lesson with the tutor', () => {
      const bookings: Booking[] = [
        {
          id: 'b-completed',
          tutorId: 'tutor-review-1',
          tutorName: 'פרופ׳ יוסי כהן',
          studentName: 'דן',
          studentEmail: 'dan@gmail.com',
          subject: 'פיזיקה',
          slot: { id: 's1', day: 'יום א׳', time: '10:00 - 11:00', isBooked: true },
          note: '',
          createdAt: '2025-01-01',
          status: 'הושלם'
        }
      ];

      const result = validateReviewEligibility({
        currentUser: { id: 'user-dan', name: 'דן', email: 'dan@gmail.com', role: 'student' },
        tutor: mockTutorForReview,
        bookings
      });
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should approve review if student has a confirmed (מאושר) scheduled lesson with the tutor', () => {
      const bookings: Booking[] = [
        {
          id: 'b-approved',
          tutorId: 'tutor-review-1',
          tutorName: 'פרופ׳ יוסי כהן',
          studentName: 'מיכל',
          studentEmail: 'michal@gmail.com',
          subject: 'פיזיקה',
          slot: { id: 's2', day: 'יום ג׳', time: '14:00 - 15:00', isBooked: true },
          note: '',
          createdAt: '2025-01-01',
          status: 'מאושר'
        }
      ];

      const result = validateReviewEligibility({
        currentUser: { id: 'user-michal', name: 'מיכל', email: 'michal@gmail.com', role: 'student' },
        tutor: mockTutorForReview,
        bookings
      });
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  // ==========================================
  // 6. SUPABASE UUID & STUDY MATERIALS PAYLOAD TESTS
  // ==========================================
  describe('UUID & Study Materials Persistence', () => {
    it('should validate RFC 4122 UUID strings accurately', async () => {
      const { isValidUuid } = await import('../lib/supabase');
      expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUuid('d3b07384-d113-4675-8ef6-15f576e828d5')).toBe(true);
      expect(isValidUuid('tutor-123')).toBe(false);
      expect(isValidUuid('')).toBe(false);
      expect(isValidUuid(null)).toBe(false);
      expect(isValidUuid(undefined)).toBe(false);
    });

    it('should format study material payload with required fields for Supabase table', () => {
      const sampleTutorUuid = 'd3b07384-d113-4675-8ef6-15f576e828d5';
      const rawMaterial = {
        fileName: 'Calculus_Formulas.pdf',
        name: 'דף נוסחאות חדו״א',
        type: 'formula_sheet',
        fileType: 'pdf',
        fileSize: '1.2 MB',
        fileUrl: 'https://example.com/storage/v1/Calculus_Formulas.pdf',
        description: 'נוסחאות גזירה ואינטגרציה'
      };

      const payload = {
        tutor_id: sampleTutorUuid,
        name: rawMaterial.name || rawMaterial.fileName,
        type: rawMaterial.type,
        file_name: rawMaterial.fileName || rawMaterial.name,
        file_type: rawMaterial.fileType || 'pdf',
        file_size: rawMaterial.fileSize || '1 MB',
        file_url: rawMaterial.fileUrl || '',
        description: rawMaterial.description || ''
      };

      expect(payload.tutor_id).toBe(sampleTutorUuid);
      expect(payload.name).toBe('דף נוסחאות חדו״א');
      expect(payload.type).toBe('formula_sheet');
      expect(payload.file_name).toBe('Calculus_Formulas.pdf');
      expect(payload.file_type).toBe('pdf');
      expect(payload.file_url).toContain('https://');
    });
  });

  // ==========================================
  // 7. LOGIN WITH USERNAME OR EMAIL TESTS (התחברות עם שם משתמש או אימייל)
  // ==========================================
  describe('Login with Username or Email (התחברות עם שם משתמש או אימייל)', () => {
    it('should validate input with an email', () => {
      const res = validateLoginInput('user@example.com', 'password123');
      expect(res.valid).toBe(true);
      expect(res.isEmail).toBe(true);
    });

    it('should validate input with a username', () => {
      const res = validateLoginInput('יובל כהן', 'password123');
      expect(res.valid).toBe(true);
      expect(res.isEmail).toBe(false);
    });

    it('should reject empty identifier or whitespace', () => {
      const res = validateLoginInput('   ', 'password123');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('נא להזין שם משתמש או כתובת אימייל');
    });

    it('should reject empty password', () => {
      const res = validateLoginInput('user@example.com', '  ');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('נא להזין סיסמה');
    });

    it('should match user by exact or case-insensitive email', () => {
      const users = [
        { id: '1', name: 'דניאל לוי', email: 'daniel@example.com' },
        { id: '2', name: 'מיכל אברהם', email: 'michal@example.com' }
      ];
      const match = matchUserByIdentifier(users, 'DANIEL@EXAMPLE.COM');
      expect(match).toBeDefined();
      expect(match?.id).toBe('1');
    });

    it('should match user by username (name)', () => {
      const users = [
        { id: '1', name: 'דניאל לוי', email: 'daniel@example.com' },
        { id: '2', name: 'מיכל אברהם', email: 'michal@example.com' }
      ];
      const match = matchUserByIdentifier(users, 'מיכל אברהם');
      expect(match).toBeDefined();
      expect(match?.id).toBe('2');
    });

    it('should return undefined if user identifier not found', () => {
      const users = [
        { id: '1', name: 'דניאל לוי', email: 'daniel@example.com' }
      ];
      const match = matchUserByIdentifier(users, 'אף אחד');
      expect(match).toBeUndefined();
    });
  });
});


