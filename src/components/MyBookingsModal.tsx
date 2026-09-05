import React, { useState, useEffect } from 'react';
import { Booking, Tutor, Review } from '../types';
import { X, Calendar, Clock, AlertCircle, Trash2, Check, User, Mail, Phone, CheckCircle2, Video, Star, Award, Send, ThumbsUp, MessageSquare } from 'lucide-react';
import { LiveLessonModal } from './LiveLessonModal';
import { Language, getTranslation, translateSubject } from '../lib/i18n';
import { deduplicateBookings } from '../lib/slotUtils';
import { supabase, isValidUuid } from '../lib/supabase';

interface MyBookingsModalProps {
  bookings: Booking[];
  tutors?: Tutor[];
  currentUser: { id: string; name: string; email: string; role: 'student' | 'teacher'; tutorProfileId?: string; avatarUrl?: string };
  onClose: () => void;
  onCancelBooking: (bookingId: string) => void;
  onApproveBooking: (bookingId: string) => void;
  onCompleteBooking?: (bookingId: string) => void;
  onConfirmLessonOccurrence?: (bookingId: string, role?: 'student' | 'teacher') => void;
  onAddReview?: (tutorId: string, review: Omit<Review, 'id' | 'date'>) => void;
  onOpenTutorReview?: (tutorId: string) => void;
  onStartLiveLesson?: (booking: Booking) => void;
  onRefresh?: () => Promise<void>;
  language?: Language;
}

export const MyBookingsModal: React.FC<MyBookingsModalProps> = ({
  bookings,
  tutors = [],
  currentUser,
  onClose,
  onCancelBooking,
  onApproveBooking,
  onCompleteBooking,
  onConfirmLessonOccurrence,
  onAddReview,
  onOpenTutorReview,
  onStartLiveLesson,
  onRefresh,
  language = 'he'
}) => {
  const t = getTranslation(language);
  const isRtl = language === 'he';
  const [activeLiveLesson, setActiveLiveLesson] = useState<Booking | null>(null);

  // In-card Review writing state
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string>('');
  const [reviewSuccessMap, setReviewSuccessMap] = useState<Record<string, { rating: number; comment: string; reviewerName: string }>>({});

  // Reload fresh data from Supabase on mount
  useEffect(() => {
    if (onRefresh) {
      onRefresh().catch(err => console.warn('Failed to refresh data on opening MyBookingsModal:', err));
    }
  }, [onRefresh]);

  // Load previously submitted reviews from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tutordirect_reviewed_bookings');
      if (stored) {
        setReviewSuccessMap(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  // Filter and deduplicate bookings based on user role and true database slot status
  const filteredBookings = deduplicateBookings(bookings.filter(booking => {
    if (currentUser.role === 'teacher') {
      const curId = currentUser.id?.toLowerCase();
      const curProfileId = currentUser.tutorProfileId?.toLowerCase();
      const curEmail = currentUser.email?.trim().toLowerCase();
      const curName = currentUser.name?.trim().toLowerCase();

      const bTutorId = booking.tutorId?.toLowerCase();
      const bTutorEmail = (booking as any).tutorEmail?.trim().toLowerCase();
      const bTutorName = booking.tutorName?.trim().toLowerCase();

      const matchId = Boolean(curId && (bTutorId === curId || bTutorId?.includes(curId)));
      const matchProfileId = Boolean(curProfileId && (bTutorId === curProfileId || (booking as any).tutorProfileId === curProfileId));
      const matchEmail = Boolean(curEmail && (bTutorEmail === curEmail || bTutorId === curEmail));
      const matchName = Boolean(curName && bTutorName && (bTutorName === curName || bTutorName.includes(curName) || curName.includes(bTutorName)));

      const isForTeacher = Boolean(matchId || matchProfileId || matchEmail || matchName);
      if (!isForTeacher) return false;

      // Pending lesson displayed ONLY IF slot.is_booked === true && slot.student_id !== null
      // If is_booked is false or student_id is null, lesson is cancelled and must NOT be shown as pending
      if (booking.status === 'ממתין') {
        if (booking.slot && booking.slot.isBooked === false) {
          return false;
        }
        if (!(booking as any).studentId && !booking.studentEmail) {
          return false;
        }
      }

      return true;
    } else {
      // Student view: filter by student email, student ID, or student name
      const curId = currentUser.id?.toLowerCase();
      const curEmail = currentUser.email?.trim().toLowerCase();
      const curName = currentUser.name?.trim().toLowerCase();

      const bStudentId = (booking as any).studentId?.toLowerCase() || '';
      const bStudentEmail = booking.studentEmail?.trim().toLowerCase() || '';
      const bStudentName = booking.studentName?.trim().toLowerCase() || '';

      const matchEmail = Boolean(curEmail && (bStudentEmail === curEmail || bStudentId === curEmail));
      const matchId = Boolean(curId && (bStudentId === curId || bStudentEmail === curId || booking.id.includes(curId)));
      const matchName = Boolean(curName && bStudentName && (bStudentName === curName || bStudentName.includes(curName) || curName.includes(bStudentName)));

      const isForStudent = Boolean(matchEmail || matchId || matchName);
      if (!isForStudent) return false;

      // Student view: pending lesson is displayed ONLY IF slot.is_booked === true
      // If teacher declined/cancelled (and slot was reset in DB), do not show as active pending lesson
      if (booking.status === 'ממתין') {
        if (booking.slot && booking.slot.isBooked === false) {
          return false;
        }
      }

      return true;
    }
  }));

  const handleCancelOrDecline = async (booking: Booking) => {
    const slotId = isValidUuid(booking.slot?.id) ? booking.slot.id : (isValidUuid(booking.id) ? booking.id : null);
    if (slotId) {
      const { error } = await supabase
        .from('slots')
        .update({
          is_booked: false,
          student_id: null
        })
        .eq('id', slotId);

      if (error) {
        console.error("Failed to cancel slot:", error);
        alert("שגיאה בעדכון מסד הנתונים: " + error.message);
        return;
      }
    }
    onCancelBooking(booking.id);
  };

  const getStatusColor = (status: Booking['status']) => {
    switch (status) {
      case 'הושלם':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'מאושר':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'בוטל':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getStatusLabel = (status: Booking['status']) => {
    if (language === 'en') {
      switch (status) {
        case 'הושלם': return 'Completed';
        case 'מאושר': return 'Confirmed';
        case 'בוטל': return 'Cancelled';
        default: return 'Pending Approval';
      }
    }
    switch (status) {
      case 'הושלם': return 'התקיים';
      case 'מאושר': return 'מאושר';
      case 'בוטל': return 'בוטל';
      default: return 'ממתין';
    }
  };

  const handleConfirmOccurrence = (bookingId: string) => {
    if (onConfirmLessonOccurrence) {
      onConfirmLessonOccurrence(bookingId, currentUser.role);
    } else if (onCompleteBooking) {
      onCompleteBooking(bookingId);
    }
  };

  const handleOpenReviewForm = (booking: Booking) => {
    // Verify not already reviewed when creating a new review
    const bTutorEmail = ((booking as any).tutorEmail || '').trim().toLowerCase();
    const bTutorName = (booking.tutorName || '').trim().toLowerCase();
    const bTutorId = (booking.tutorId || '').trim().toLowerCase();

    const targetTutor = tutors.find(t => 
      t.id.toLowerCase() === bTutorId || 
      (t.email && t.email.trim().toLowerCase() === bTutorEmail) ||
      t.name.trim().toLowerCase() === bTutorName
    );

    const curEmail = (currentUser?.email || '').trim().toLowerCase();
    const hasAlreadyReviewed = Boolean(
      (targetTutor?.reviews || []).some(
        r => r.reviewerEmail && curEmail && r.reviewerEmail.trim().toLowerCase() === curEmail
      )
    );

    if (hasAlreadyReviewed) {
      return;
    }

    setReviewingBookingId(booking.id);
    setSelectedRating(5);
    setHoverRating(0);
    setReviewComment('');
    setReviewerName(currentUser.name || booking.studentName || 'תלמיד');
    setIsAnonymous(false);
    setReviewError('');
  };

  const handleCancelReviewForm = () => {
    setReviewingBookingId(null);
    setReviewError('');
  };

  const handleSubmitReview = async (booking: Booking, e: React.FormEvent) => {
    e.preventDefault();
    setReviewError('');

    if (!reviewComment.trim()) {
      setReviewError(language === 'he' ? 'אנא כתוב טקסט עבור חוות הדעת על המורה' : 'Please enter your review text');
      return;
    }

    // Find matching tutor
    const bTutorEmail = ((booking as any).tutorEmail || '').trim().toLowerCase();
    const bTutorName = (booking.tutorName || '').trim().toLowerCase();
    const bTutorId = (booking.tutorId || '').trim().toLowerCase();

    const targetTutor = tutors.find(t => 
      t.id.toLowerCase() === bTutorId || 
      (t.email && t.email.trim().toLowerCase() === bTutorEmail) ||
      t.name.trim().toLowerCase() === bTutorName
    );

    const curEmail = (currentUser?.email || '').trim().toLowerCase();
    const hasAlreadyReviewed = Boolean(
      (targetTutor?.reviews || []).some(
        r => r.reviewerEmail && curEmail && r.reviewerEmail.trim().toLowerCase() === curEmail
      )
    );

    if (hasAlreadyReviewed) {
      setReviewError(language === 'he' ? 'כבר כתבת חוות דעת למורה זה בעבר (מתאפשרת חוות דעת אחת בלבד לכל מורה)' : 'You have already reviewed this tutor');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const tutorIdToUse = targetTutor?.id || booking.tutorId;
      const finalName = isAnonymous 
        ? (language === 'he' ? 'תלמיד אנונימי' : 'Anonymous Student') 
        : (reviewerName.trim() || currentUser.name || 'תלמיד');

      if (onAddReview) {
        onAddReview(tutorIdToUse, {
          reviewerName: finalName,
          reviewerEmail: currentUser.email,
          rating: selectedRating,
          comment: reviewComment.trim(),
          isVerifiedLesson: true
        });
      }

      setReviewingBookingId(null);
    } catch (err) {
      console.error('Failed to submit review:', err);
      setReviewError(language === 'he' ? 'שגיאה בשמירת חוות הדעת, נסה שנית' : 'Error saving review, please try again');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getRatingDescriptor = (rating: number) => {
    if (language === 'he') {
      switch (rating) {
        case 5: return '⭐⭐⭐⭐⭐ 5 כוכבים - מעולה ביותר! מורה מצוין';
        case 4: return '⭐⭐⭐⭐ 4 כוכבים - טוב מאוד ומקצועי';
        case 3: return '⭐⭐⭐ 3 כוכבים - שיעור סביר וטוב';
        case 2: return '⭐⭐ 2 כוכבים - טעון שיפור';
        case 1: return '⭐ 1 כוכב - לא מרוצה';
        default: return `${rating} כוכבים`;
      }
    }
    switch (rating) {
      case 5: return '⭐⭐⭐⭐⭐ 5 Stars - Excellent tutor! Highly recommended';
      case 4: return '⭐⭐⭐⭐ 4 Stars - Very Good & Professional';
      case 3: return '⭐⭐⭐ 3 Stars - Good lesson';
      case 2: return '⭐⭐ 2 Stars - Needs improvement';
      case 1: return '⭐ 1 Star - Unsatisfied';
      default: return `${rating} Stars`;
    }
  };

  const handleJoinVideo = (booking: Booking) => {
    if (onStartLiveLesson) {
      onStartLiveLesson(booking);
    } else {
      setActiveLiveLesson(booking);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        {/* Overlay Background */}
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs" onClick={onClose} />

        {/* Modal Container */}
        <div 
          id="my-bookings-modal"
          className="relative bg-white rounded-lg w-full max-w-xl overflow-hidden shadow-xl z-10 border border-slate-200 flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className={`sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {currentUser.role === 'teacher' 
                  ? (language === 'he' ? 'שיעורים שהוזמנו אצלי' : 'Lessons Booked with Me') 
                  : (language === 'he' ? 'השיעורים המוזמנים שלי' : 'My Scheduled Lessons')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentUser.role === 'teacher' 
                  ? (language === 'he' ? 'צפייה ואישור של שיעורים פרטיים שתלמידים תיאמו איתך' : 'Review and approve private lessons booked by students') 
                  : (language === 'he' ? 'צפייה וניהול השיעורים הפרטיים שתיאמת במערכת' : 'View and manage your upcoming private lessons')}
              </p>
            </div>
            <button 
              id="close-bookings-btn"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className={`flex-grow p-6 overflow-y-auto space-y-4 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
            {filteredBookings.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto stroke-[1.5]" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">{t.noBookingsYet}</p>
                  <p className="text-xs text-slate-400">
                    {currentUser.role === 'teacher' 
                      ? (language === 'he' ? 'כשתלמידים יתאמו איתך שיעור בשעות הפעילות, ההזמנות יופיעו כאן לאישור.' : 'When students book a slot with you, lesson requests will appear here for approval.') 
                      : (language === 'he' ? 'חפש מורה פרטי מתאים ברשימה ותאם שיעור בשעות הפנויות שלו.' : 'Search for a tutor from the catalog and book a lesson in chat.')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBookings.map((booking) => (
                  <div 
                    key={booking.id}
                    id={`booking-card-${booking.id}`}
                    className="bg-white border border-slate-200 rounded-lg p-4.5 shadow-xs space-y-3"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {currentUser.role === 'teacher' ? (
                            <span className="font-bold text-slate-800 text-sm">{language === 'he' ? 'התלמיד:' : 'Student:'} {booking.studentName}</span>
                          ) : (
                            <span className="font-bold text-slate-800 text-sm">{language === 'he' ? 'המורה:' : 'Tutor:'} {booking.tutorName}</span>
                          )}
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium border border-slate-200">
                            {translateSubject(booking.subject, language)}
                          </span>
                        </div>
                        
                        {currentUser.role === 'teacher' ? (
                          <div className="text-xs text-slate-500 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{language === 'he' ? 'אימייל ליצירת קשר:' : 'Contact email:'} {booking.studentEmail}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{language === 'he' ? 'מוזמן עבור:' : 'Booked for:'} {booking.studentName} ({booking.studentEmail})</span>
                          </div>
                        )}
                      </div>

                      <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded border ${getStatusColor(booking.status)}`}>
                        {getStatusLabel(booking.status)}
                      </span>
                    </div>

                    {/* Slot Details */}
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-md flex items-center gap-4 text-xs text-slate-700">
                      <div className="flex items-center gap-1 font-bold text-slate-800">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{booking.slot.day}</span>
                      </div>
                      <div className="w-px h-3 bg-slate-300" />
                      <div className="flex items-center gap-1 text-slate-600 font-medium">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{booking.slot.time}</span>
                      </div>
                    </div>

                    {booking.note && (
                      <p className="text-xs text-slate-500 italic bg-slate-50/50 p-2 rounded border border-slate-100/50">
                        {language === 'he' ? 'הערה:' : 'Note:'} {booking.note}
                      </p>
                    )}

                    {/* Actions for Teacher vs Student (Pending status) */}
                    {booking.status === 'ממתין' && (
                      <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 mt-2">
                        {currentUser.role === 'teacher' ? (
                          <>
                            <button
                              id={`approve-booking-btn-${booking.id}`}
                              onClick={() => onApproveBooking(booking.id)}
                              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded transition-all duration-200 flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{language === 'he' ? 'אשר שיעור' : 'Approve Lesson'}</span>
                            </button>
                            <button
                              id={`cancel-booking-btn-${booking.id}`}
                              onClick={() => handleCancelOrDecline(booking)}
                              className="text-xs text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 px-3 py-1.5 rounded transition-all duration-200 flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>{language === 'he' ? 'סרב ודחה' : 'Decline'}</span>
                            </button>
                          </>
                        ) : (
                          <button
                            id={`cancel-booking-btn-${booking.id}`}
                            onClick={() => handleCancelOrDecline(booking)}
                            className="text-xs text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 px-3 py-1.5 rounded transition-all duration-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{t.cancelBooking}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Actions for Confirmed Lessons (Live Video Button & Dual Confirmation) */}
                    {booking.status === 'מאושר' && (
                      <div className="pt-2 border-t border-slate-100 mt-2 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-emerald-50/60 border border-emerald-200/80 p-2.5 rounded-lg">
                          <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{language === 'he' ? 'השיעור מאושר ומתוזמן!' : 'Lesson confirmed and scheduled!'}</span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              id={`join-live-lesson-btn-${booking.id}`}
                              onClick={() => handleJoinVideo(booking)}
                              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold px-3.5 py-1.5 rounded-md text-xs flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer group"
                            >
                              <Video className="w-3.5 h-3.5 text-indigo-200 group-hover:text-white transition-colors" />
                              <span>{language === 'he' ? 'היכנס לשיעור וידאו' : 'Join Video Lesson'}</span>
                            </button>

                            {/* Dual Confirmation: Student confirmation button / indicator */}
                            {currentUser.role === 'student' && (
                              booking.studentConfirmed ? (
                                <div className="bg-emerald-100/90 text-emerald-800 border border-emerald-300 font-bold px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 shadow-2xs">
                                  <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                                  <span>{language === 'he' ? 'אישרת שהשיעור התקיים' : 'You confirmed lesson'}</span>
                                </div>
                              ) : (
                                <button
                                  id={`student-confirm-occurrence-btn-${booking.id}`}
                                  onClick={() => handleConfirmOccurrence(booking.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-3.5 py-1.5 rounded-md text-xs flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                                  title={language === 'he' ? 'אישור תלמיד שהשיעור התקיים' : 'Student confirmation that lesson took place'}
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>{language === 'he' ? 'אישור שהשיעור התקיים' : 'Confirm Lesson Occurred'}</span>
                                </button>
                              )
                            )}

                            {/* Dual Confirmation: Teacher confirmation button / indicator */}
                            {currentUser.role === 'teacher' && (
                              booking.teacherConfirmed ? (
                                <div className="bg-emerald-100/90 text-emerald-800 border border-emerald-300 font-bold px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 shadow-2xs">
                                  <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                                  <span>{language === 'he' ? 'אישרת שהשיעור התקיים' : 'You confirmed lesson'}</span>
                                </div>
                              ) : (
                                <button
                                  id={`teacher-confirm-occurrence-btn-${booking.id}`}
                                  onClick={() => handleConfirmOccurrence(booking.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-3.5 py-1.5 rounded-md text-xs flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                                  title={language === 'he' ? 'אישור מורה שהשיעור התקיים' : 'Teacher confirmation that lesson took place'}
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>{language === 'he' ? 'אישור שהשיעור התקיים' : 'Confirm Lesson Occurred'}</span>
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Mutual Confirmation Progress & Feedback */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-700 text-[11px]">
                                {language === 'he' ? 'אישור קיום השיעור:' : 'Lesson occurrence status:'}
                              </span>

                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                booking.studentConfirmed
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-white text-slate-600 border-slate-300'
                              }`}>
                                {booking.studentConfirmed ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-slate-400" />}
                                <span>{language === 'he' ? 'אישור תלמיד:' : 'Student:'} {booking.studentConfirmed ? (language === 'he' ? 'אושר ✓' : 'Confirmed ✓') : (language === 'he' ? 'טרם אושר' : 'Pending')}</span>
                              </span>

                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                booking.teacherConfirmed
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-white text-slate-600 border-slate-300'
                              }`}>
                                {booking.teacherConfirmed ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-slate-400" />}
                                <span>{language === 'he' ? 'אישור מורה:' : 'Teacher:'} {booking.teacherConfirmed ? (language === 'he' ? 'אושר ✓' : 'Confirmed ✓') : (language === 'he' ? 'טרם אושר' : 'Pending')}</span>
                              </span>
                            </div>

                            <div className="flex justify-end">
                              <button
                                id={`cancel-booking-btn-${booking.id}`}
                                onClick={() => handleCancelOrDecline(booking)}
                                className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{t.cancelBooking}</span>
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-500 font-medium">
                            {currentUser.role === 'student' ? (
                              booking.studentConfirmed && !booking.teacherConfirmed ? (
                                <span className="text-amber-700 font-bold">
                                  {language === 'he' ? '⏳ אישרת שהשיעור התקיים. ממתין לאישור המורה - כשהמורה יאשר גם כן, השיעור יסומן כ"התקיים" ותוכל לכתוב חוות דעת.' : '⏳ You confirmed. Waiting for teacher confirmation to mark lesson as completed and leave a review.'}
                                </span>
                              ) : !booking.studentConfirmed && booking.teacherConfirmed ? (
                                <span className="text-emerald-700 font-bold">
                                  {language === 'he' ? '🔔 המורה כבר אישר שהשיעור התקיים! לחץ על "אישור שהשיעור התקיים" כדי להשלים את השיעור ולכתוב חוות דעת.' : '🔔 The teacher already confirmed! Click "Confirm Lesson Occurred" to complete the lesson and write a review.'}
                                </span>
                              ) : (
                                <span>
                                  {language === 'he' ? '💡 כפתור אישור יסמן את הסכמתך לקיום השיעור. השיעור יסומן כ"התקיים" ואפשרות חוות הדעת תופיע לאחר ששני הצדדים יאשרו.' : '💡 Both student and teacher must confirm before the lesson is marked as completed and reviewed.'}
                                </span>
                              )
                            ) : (
                              booking.teacherConfirmed && !booking.studentConfirmed ? (
                                <span className="text-amber-700 font-bold">
                                  {language === 'he' ? '⏳ אישרת שהשיעור התקיים. ממתין לאישור התלמיד לסיום התהליך.' : '⏳ You confirmed. Waiting for student confirmation to complete.'}
                                </span>
                              ) : !booking.teacherConfirmed && booking.studentConfirmed ? (
                                <span className="text-emerald-700 font-bold">
                                  {language === 'he' ? '🔔 התלמיד כבר אישר שהשיעור התקיים! לחץ על "אישור שהשיעור התקיים" כדי להשלים את השיעור.' : '🔔 The student already confirmed! Click "Confirm Lesson Occurred" to complete.'}
                                </span>
                              ) : (
                                <span>
                                  {language === 'he' ? '💡 כפתור אישור יסמן את הסכמתך לקיום השיעור. השיעור יסומן כ"התקיים" לאחר ששני הצדדים יאשרו.' : '💡 Both student and teacher must confirm before the lesson is marked as completed.'}
                                </span>
                              )
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions for Completed Lessons */}
                    {booking.status === 'הושלם' && (() => {
                      const bTutorEmail = ((booking as any).tutorEmail || '').trim().toLowerCase();
                      const bTutorName = (booking.tutorName || '').trim().toLowerCase();
                      const bTutorId = (booking.tutorId || '').trim().toLowerCase();

                      const targetTutor = tutors.find(t => 
                        t.id.toLowerCase() === bTutorId || 
                        (t.email && t.email.trim().toLowerCase() === bTutorEmail) ||
                        t.name.trim().toLowerCase() === bTutorName
                      );

                      const curEmail = (currentUser?.email || '').trim().toLowerCase();
                      const existingTutorReview = targetTutor?.reviews?.find(
                        r => r.reviewerEmail && curEmail && r.reviewerEmail.trim().toLowerCase() === curEmail
                      );

                      const submittedReview = existingTutorReview ? {
                        rating: existingTutorReview.rating,
                        comment: existingTutorReview.comment,
                        reviewerName: existingTutorReview.reviewerName
                      } : null;

                      const isAlreadyReviewedForTutor = Boolean(existingTutorReview);

                      return (
                        <div className="pt-2 border-t border-slate-100 mt-2 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-blue-50/60 border border-blue-200/80 p-2.5 rounded-lg">
                            <div className="flex items-center gap-1.5 text-xs text-blue-800 font-bold">
                              <Award className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>{language === 'he' ? 'השיעור התקיים והושלם בהצלחה! (אושר ע"י התלמיד והמורה)' : 'Lesson took place successfully! (Confirmed by student & teacher)'}</span>
                            </div>

                            {currentUser.role === 'student' && !isAlreadyReviewedForTutor && reviewingBookingId !== booking.id && (
                              <button
                                id={`review-completed-tutor-btn-${booking.id}`}
                                onClick={() => handleOpenReviewForm(booking)}
                                className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold px-3.5 py-1.5 rounded-md text-xs flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                              >
                                <Star className="w-3.5 h-3.5 fill-current" />
                                <span>{language === 'he' ? 'כתוב חוות דעת על המורה' : 'Review Tutor'}</span>
                              </button>
                            )}
                          </div>

                          {/* Already Submitted Review Box */}
                          {currentUser.role === 'student' && submittedReview && reviewingBookingId !== booking.id && (
                            <div className="bg-emerald-50/90 border border-emerald-200 rounded-lg p-3.5 space-y-2 text-right">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>{language === 'he' ? 'חוות הדעת שלך נשמרה ופורסמה בהצלחה בפרופיל המורה!' : 'Your review was published to tutor profile!'}</span>
                                </div>
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                                  {language === 'he' ? 'חוות דעת פעילה ✓' : 'Active review ✓'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((starIdx) => (
                                    <Star
                                      key={starIdx}
                                      className={`w-3.5 h-3.5 ${
                                        starIdx <= submittedReview.rating
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-slate-200'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs font-bold text-slate-700">
                                  ({submittedReview.rating} / 5 כוכבים)
                                </span>
                              </div>

                              {submittedReview.comment && (
                                <p className="text-xs text-slate-700 bg-white/90 p-2.5 rounded border border-emerald-100 italic">
                                  "{submittedReview.comment}"
                                </p>
                              )}
                            </div>
                          )}

                          {/* Notice if student already reviewed this tutor in another booking */}
                          {currentUser.role === 'student' && !submittedReview && isAlreadyReviewedForTutor && reviewingBookingId !== booking.id && (
                            <div className="bg-slate-100/90 border border-slate-200 rounded-lg p-3 text-right flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                              <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0" />
                              <span>{language === 'he' ? 'כבר כתבת חוות דעת למורה זה בעבר (מתאפשרת חוות דעת אחת בלבד לכל מורה)' : 'You have already reviewed this tutor (1 review allowed per tutor)'}</span>
                            </div>
                          )}

                          {/* Interactive Review Writing Form */}
                          {currentUser.role === 'student' && reviewingBookingId === booking.id && (
                            <form
                              onSubmit={(e) => handleSubmitReview(booking, e)}
                              className="bg-slate-50/90 border-2 border-indigo-200 rounded-xl p-4 space-y-3.5 shadow-sm text-right"
                              dir={isRtl ? 'rtl' : 'ltr'}
                            >
                              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                  <span>
                                    {language === 'he' ? `כתיבת חוות דעת ודירוג עבור ${booking.tutorName}` : `Write Review for ${booking.tutorName}`}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleCancelReviewForm}
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              {reviewError && (
                                <div className="bg-rose-50 text-rose-700 p-2 rounded text-xs border border-rose-200 font-medium">
                                  {reviewError}
                                </div>
                              )}

                              {/* Rating Stars Selector */}
                              <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200">
                                <label className="block text-xs font-bold text-slate-700">
                                  {language === 'he' ? 'בחר מספר כוכבים למורה:' : 'Select Star Rating:'}
                                </label>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((starValue) => {
                                      const isFilled = starValue <= (hoverRating || selectedRating);
                                      return (
                                        <button
                                          key={starValue}
                                          type="button"
                                          id={`modal-star-btn-${booking.id}-${starValue}`}
                                          onMouseEnter={() => setHoverRating(starValue)}
                                          onMouseLeave={() => setHoverRating(0)}
                                          onClick={() => setSelectedRating(starValue)}
                                          className="p-1 hover:scale-125 transition-transform cursor-pointer focus:outline-none"
                                          title={`${starValue} כוכבים`}
                                        >
                                          <Star
                                            className={`w-6 h-6 transition-colors ${
                                              isFilled
                                                ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                                                : 'text-slate-300 hover:text-amber-200'
                                            }`}
                                          />
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    {getRatingDescriptor(hoverRating || selectedRating)}
                                  </span>
                                </div>
                              </div>

                              {/* Review Textarea */}
                              <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-700">
                                  {language === 'he' ? 'טקסט חוות הדעת:' : 'Review Text:'}
                                </label>
                                <textarea
                                  id={`review-textarea-${booking.id}`}
                                  rows={3}
                                  required
                                  value={reviewComment}
                                  onChange={(e) => setReviewComment(e.target.value)}
                                  placeholder={
                                    language === 'he'
                                      ? 'ספר על חוויית הלימוד שלך עם המורה (איכות ההסברים, סבלנות, מקצועיות, הבנת החומר וכו\')...'
                                      : 'Share your learning experience with this tutor (clarity of explanations, patience, professionalism)...'
                                  }
                                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white placeholder-slate-400"
                                />
                              </div>

                              {/* Reviewer Name / Anonymous */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                                <div className="flex-1 space-y-1">
                                  <input
                                    type="text"
                                    placeholder={language === 'he' ? 'השם שלך' : 'Your name'}
                                    value={isAnonymous ? (language === 'he' ? 'תלמיד אנונימי' : 'Anonymous Student') : reviewerName}
                                    onChange={(e) => setReviewerName(e.target.value)}
                                    disabled={isAnonymous}
                                    className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                      isAnonymous ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'bg-white border-slate-300 text-slate-800'
                                    }`}
                                  />
                                  <label className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={isAnonymous}
                                      onChange={(e) => setIsAnonymous(e.target.checked)}
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                                    />
                                    <span>{language === 'he' ? 'פרסם כחוות דעת אנונימית' : 'Post anonymously'}</span>
                                  </label>
                                </div>

                                <div className="flex items-center gap-2 justify-end shrink-0 pt-2 sm:pt-0">
                                  <button
                                    type="button"
                                    onClick={handleCancelReviewForm}
                                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                  >
                                    {language === 'he' ? 'ביטול' : 'Cancel'}
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={isSubmittingReview || !reviewComment.trim()}
                                    id={`submit-booking-review-btn-${booking.id}`}
                                    className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-300 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>
                                      {isSubmittingReview
                                        ? (language === 'he' ? 'מפרסם חוות דעת...' : 'Publishing...')
                                        : (language === 'he' ? 'פרסם חוות דעת ועדכן דירוג ⭐' : 'Submit Review & Update Rating')}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </form>
                          )}
                        </div>
                      );
                    })()}
                    {/* Actions for Cancelled Lessons */}
                    {booking.status === 'בוטל' && (
                      <div className="pt-2 border-t border-slate-100 mt-2">
                        <div className="flex items-center gap-2.5 bg-rose-50/80 border border-rose-200 text-rose-800 p-2.5 rounded-lg text-xs font-medium">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            {currentUser.role === 'teacher'
                              ? (language === 'he' ? 'שיעור זה בוטל על ידי התלמיד והמועד התפנה ביומן שלך לקביעה מחדש.' : 'This lesson was cancelled by the student and the slot is now open in your calendar.')
                              : (language === 'he' ? 'שיעור זה בוטל והמועד שוחרר. באפשרותך לתאם שיעור מחדש במידת הצורך.' : 'This lesson was cancelled. You can book a new lesson if needed.')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer inside modal */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex justify-end z-20">
            <button
              onClick={onClose}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded transition-colors cursor-pointer shadow-sm"
            >
              {t.close}
            </button>
          </div>
        </div>
      </div>

      {/* Live Video Lesson Modal */}
      {activeLiveLesson && (
        <LiveLessonModal
          booking={activeLiveLesson}
          currentUser={currentUser}
          onClose={() => setActiveLiveLesson(null)}
          language={language}
        />
      )}
    </>
  );
};

