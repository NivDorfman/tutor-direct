import React, { useState } from 'react';
import { Tutor, Review, TimeSlot, Booking } from '../types';
import { X, Star, Calendar, Clock, BookOpen, GraduationCap, Award, MessageSquare, Send, Phone, Mail, ShieldAlert, Heart, FolderOpen, ShieldCheck, CheckCircle2, Edit3 } from 'lucide-react';
import { Language, getTranslation, translateSubject, translateLevel } from '../lib/i18n';
import { StudyMaterialsSection } from './StudyMaterialsSection';
import { calculateTutorRating } from '../initialData';
import { validateReviewEligibility } from '../lib/businessLogic';

interface TutorDetailDrawerProps {
  tutor: Tutor;
  currentUser: { id: string; name: string; email: string; role: 'student' | 'teacher'; tutorProfileId?: string; avatarUrl?: string };
  bookings?: Booking[];
  onClose: () => void;
  onAddReview: (tutorId: string, review: Omit<Review, 'id' | 'date'>) => void;
  onBookLesson?: (tutorId: string, slot: TimeSlot, studentName: string, studentEmail: string, note: string) => void;
  onStartChat: (tutor: Tutor) => void;
  language?: Language;
  isFavorite?: boolean;
  onToggleFavorite?: (tutorId: string) => void;
}

export const TutorDetailDrawer: React.FC<TutorDetailDrawerProps> = ({
  tutor,
  currentUser,
  bookings = [],
  onClose,
  onAddReview,
  onBookLesson,
  onStartChat,
  language = 'he',
  isFavorite = false,
  onToggleFavorite,
}) => {
  const t = getTranslation(language);
  const isRtl = language === 'he';

  // Review Form State
  const [newReviewerName, setNewReviewerName] = useState(currentUser?.name || '');
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Synchronize state when currentUser changes
  React.useEffect(() => {
    if (currentUser) {
      setNewReviewerName(currentUser.name || '');
    }
  }, [currentUser]);

  // Check if current user is a teacher
  const isTeacher = currentUser?.role === 'teacher';

  // Check if current user is the tutor themselves
  const isSelf = currentUser && (
    tutor.email.toLowerCase() === currentUser.email.toLowerCase() ||
    currentUser.tutorProfileId === tutor.id
  );

  // Check if teacher is viewing another teacher (restricted)
  const isRestrictedForTeacher = isTeacher && !isSelf;

  // Check if current user already submitted a review for this tutor
  const existingUserReview = currentUser ? (tutor.reviews || []).find(
    r => r.reviewerEmail && r.reviewerEmail.toLowerCase() === currentUser.email.toLowerCase()
  ) : null;
  const alreadyReviewed = Boolean(existingUserReview);

  // Edit mode state for existing review
  const [isEditingReview, setIsEditingReview] = useState(false);

  // Check eligibility to write a review
  const reviewEligibility = validateReviewEligibility({
    currentUser,
    tutor,
    bookings
  });

  const handleStartEditReview = () => {
    if (existingUserReview) {
      setNewReviewerName(existingUserReview.reviewerName || currentUser?.name || '');
      setNewRating(existingUserReview.rating || 5);
      setNewComment(existingUserReview.comment || '');
      setIsAnonymous(existingUserReview.reviewerName === 'תלמיד אנונימי' || existingUserReview.reviewerName === 'Anonymous Student');
      setIsEditingReview(true);
    }
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTeacher) {
      setReviewError(language === 'he' ? 'מורים אינם יכולים להוסיף חוות דעת במערכת' : 'Teachers cannot post reviews');
      return;
    }
    if (isSelf) {
      setReviewError(language === 'he' ? 'מורה אינו יכול לתת חוות דעת לעצמו' : 'You cannot review yourself');
      return;
    }
    if (!reviewEligibility.eligible) {
      setReviewError(
        language === 'he'
          ? (reviewEligibility.reason || 'יש להתחבר כתלמיד כדי לכתוב חוות דעת')
          : 'You must be logged in as a student to leave a review'
      );
      return;
    }
    if (!isAnonymous && !newReviewerName.trim()) {
      setReviewError(language === 'he' ? 'אנא הכנס את שמך' : 'Please enter your name');
      return;
    }
    if (!newComment.trim()) {
      setReviewError(language === 'he' ? 'אנא כתוב חוות דעת קצרה' : 'Please write a review comment');
      return;
    }

    onAddReview(tutor.id, {
      reviewerName: isAnonymous ? (language === 'he' ? 'תלמיד אנונימי' : 'Anonymous Student') : newReviewerName.trim(),
      reviewerEmail: currentUser.email,
      rating: newRating,
      comment: newComment.trim(),
      isVerifiedLesson: reviewEligibility.isVerifiedLesson
    });

    setReviewSuccess(true);
    setReviewError('');
    setIsEditingReview(false);
    setNewReviewerName(currentUser?.name || '');
    setNewRating(5);
    setNewComment('');
    setIsAnonymous(false);

    setTimeout(() => setReviewSuccess(false), 4000);
  };

  const getGradient = (name: string) => {
    const colors = [
      'from-emerald-500 to-teal-600',
      'from-blue-500 to-indigo-600',
      'from-indigo-500 to-purple-600',
      'from-amber-500 to-orange-600',
      'from-pink-500 to-rose-600',
      'from-sky-500 to-cyan-600'
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const initials = tutor.name.split(' ').map(n => n[0]).join('');

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
      {/* Overlay Background */}
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300" 
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div 
        id="tutor-detail-drawer"
        className={`relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 transition-transform duration-300 overflow-y-auto ${
          isRtl ? 'border-r border-slate-200' : 'border-l border-slate-200'
        }`}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            {tutor.avatarUrl ? (
              tutor.avatarUrl.startsWith('preset:') ? (
                (() => {
                  const parts = tutor.avatarUrl.split(':');
                  const emoji = parts[1] || '👨‍🏫';
                  const bg = parts[2] || 'from-indigo-500 to-purple-600';
                  return (
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${bg} flex items-center justify-center text-xl shrink-0 border border-slate-100`}>
                      {emoji}
                    </div>
                  );
                })()
              ) : (
                <img
                  src={tutor.avatarUrl}
                  alt={tutor.name}
                  className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-100"
                />
              )
            ) : (
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getGradient(tutor.name)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                {initials}
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">{tutor.name}</h2>
              <div className="flex flex-wrap gap-1 mt-1 justify-start">
                {tutor.subject.split(',').map((subj) => (
                  <span key={subj} className="bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {translateSubject(subj.trim(), language)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onToggleFavorite && !isRestrictedForTeacher && (
              <button
                type="button"
                id={`drawer-btn-favorite-${tutor.id}`}
                onClick={() => onToggleFavorite(tutor.id)}
                title={isFavorite ? t.removeFromFavorites : t.addToFavorites}
                className={`p-2 rounded-full border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                  isFavorite
                    ? 'bg-rose-50 border-rose-200 text-rose-500 shadow-xs hover:bg-rose-100'
                    : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50/50'
                }`}
              >
                <Heart className={`w-5 h-5 transition-transform duration-200 active:scale-125 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>
            )}
            <button 
              id="close-drawer-btn"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title={t.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Restricted View for Teachers viewing Other Teachers */}
        {isRestrictedForTeacher ? (
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-lg font-bold text-slate-800">
                {language === 'he' ? 'הגישה לפרטי מורה זה חסומה' : 'Access to this Teacher Profile is Restricted'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {language === 'he'
                  ? 'מטעמי פרטיות, אבטחת מידע ומניעת חשיפת נתונים מסחריים בין אנשי הוראה, מורים אינם מורשים לצפות בפרטים האישיים, ביומני השעות, בפרטי הקשר או בביקורות של מורים אחרים במערכת.'
                  : 'For privacy, data protection, and commercial policies between educators, teachers are not authorized to view the personal details, teaching slots, contact information, or reviews of other teachers.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded shadow-xs cursor-pointer transition-colors"
            >
              {language === 'he' ? 'סגור חלון' : 'Close'}
            </button>
          </div>
        ) : (
          /* Normal Content Body */
          <div className={`flex-1 p-6 space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
            {/* Main Info Card */}
            <div className="bg-slate-50 rounded border border-slate-200 p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-400 block mb-1 font-bold uppercase tracking-wider">{t.pricePerLesson}</span>
                <span className="text-base font-extrabold text-slate-800">{tutor.price} ₪ <span className="text-xs font-normal text-slate-400">/ {t.perHour}</span></span>
              </div>
              <div className="bg-white p-3 rounded border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-400 block mb-1 font-bold uppercase tracking-wider">{t.averageRating}</span>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-base font-extrabold text-slate-800">{calculateTutorRating(tutor).toFixed(1)}</span>
                  <span className="text-[10px] text-slate-400 font-medium">({tutor.reviews.length} {t.reviews})</span>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-white p-3 rounded border border-slate-200 shadow-xs flex flex-col justify-center">
                <span className="text-[10px] text-slate-400 block mb-1 font-bold uppercase tracking-wider">{t.contactDetails}</span>
                <div className="text-xs text-slate-700 space-y-0.5 font-medium">
                  <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400 shrink-0" /> <span className="ltr truncate">{tutor.phone}</span></div>
                  <div className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400 shrink-0" /> <span className="truncate">{tutor.email}</span></div>
                </div>
              </div>
            </div>

            {/* About & Bio */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-400" />
                <span>{t.aboutTutor}</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed bg-white border border-slate-200 p-4 rounded">
                {tutor.bio}
              </p>
            </div>

            {/* Classes & Levels Taught */}
            {tutor.levels && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-slate-400" />
                  <span>{t.levelsTaught}</span>
                </h3>
                <div className="bg-white border border-slate-200 p-4 rounded flex flex-wrap gap-2">
                  {tutor.levels.split(',').map((lvl) => (
                    <span key={lvl} className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs px-2.5 py-1 rounded font-bold shadow-xs">
                      {translateLevel(lvl.trim(), language)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Education & Experience */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-slate-400" />
                  <span>{t.education}</span>
                </h3>
                <div className="bg-white border border-slate-200 p-3.5 rounded text-xs text-slate-600 shadow-xs min-h-[70px]">
                  {tutor.education}
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Award className="w-4 h-4 text-slate-400" />
                  <span>{t.experience}</span>
                </h3>
                <div className="bg-white border border-slate-200 p-3.5 rounded text-xs text-slate-600 shadow-xs min-h-[70px]">
                  {tutor.experience}
                </div>
              </div>
            </div>

            {/* Study Materials & Formula Sheets (Supabase Storage) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-indigo-600" />
                  <span>{t.studyMaterials}</span>
                </h3>
                {tutor.studyMaterials && tutor.studyMaterials.length > 0 && (
                  <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                    {tutor.studyMaterials.length} {t.materialsCountBadge}
                  </span>
                )}
              </div>
              
              <StudyMaterialsSection 
                materials={tutor.studyMaterials || []}
                canManage={false}
                language={language}
              />
            </div>

            {/* Available Teaching Hours Overview */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>{t.availableHours}</span>
              </h3>
              
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                {(!tutor.availableSlots || tutor.availableSlots.filter(s => !s.isBooked).length === 0) ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{language === 'he' ? 'המורה עדיין לא הגדיר שעות פנויות קבועות. ניתן לתאם מועד מותאם אישית בצ\'אט.' : 'The tutor has not set recurring open slots yet. You can arrange a custom time via chat.'}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 font-medium">
                      {language === 'he' ? 'מועדים פנויים אליהם ניתן להירשם אצל המורה:' : 'Available time slots with this tutor:'}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {tutor.availableSlots.filter(s => !s.isBooked).map((slot) => (
                        <div
                          key={slot.id}
                          className="bg-white border border-slate-200 px-3 py-2 rounded text-xs font-medium text-right flex items-center gap-2.5 shadow-2xs hover:border-indigo-200 transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-indigo-600" />
                              <span>{slot.day}</span>
                            </div>
                            <div className="text-slate-500 flex items-center gap-1 text-[11px] mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{slot.time}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Booking & Chat Callout - Directs exclusively to Chat for booking and introduction */}
            {!isTeacher && !isSelf && (
              <div className="border-t border-slate-200 pt-6">
                <div className="bg-gradient-to-br from-indigo-50/80 via-white to-indigo-50/40 border-2 border-indigo-200/80 rounded-xl p-5 shadow-xs space-y-4 text-right">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {language === 'he' ? `מעוניין לתאם שיעור עם ${tutor.name}?` : `Interested in scheduling a lesson with ${tutor.name}?`}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {language === 'he' ? (
                          <>כדי שתוכל להכיר את המורה, לשאול שאלות מקדימות ולתאם ציפיות בנוגע לחומרי הלימוד, <strong className="text-indigo-900 font-bold">הזמנת השיעור מתבצעת ישירות מתוך הצ'אט האישי</strong>.</>
                        ) : (
                          <>To get to know the tutor, ask questions, and coordinate your learning goals, <strong className="text-indigo-900 font-bold">lesson booking is done directly inside the personal chat</strong>.</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      id="drawer-start-chat-booking-btn"
                      onClick={() => onStartChat(tutor)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md active:scale-[0.99]"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{language === 'he' ? `שוחח עם ${tutor.name} ותאם שיעור בצ'אט` : `Chat with ${tutor.name} & Book Lesson`}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reviews List & Add Review */}
            <div className="border-t border-slate-200 pt-6 space-y-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                <span>{t.reviews} ({tutor.reviews.length})</span>
              </h3>

              {/* Write a Review Form - Only for Students */}
              {!isTeacher && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded space-y-4">
                  <h4 className="text-xs font-bold text-slate-700">{t.addReview}:</h4>
                  
                  {isSelf ? (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs text-amber-800 font-bold">
                      🔒 {language === 'he' ? 'אינך יכול לכתוב חוות דעת על עצמך במערכת.' : 'You cannot review your own profile.'}
                    </div>
                  ) : alreadyReviewed && !isEditingReview ? (
                    <div className="bg-indigo-50/80 border border-indigo-200 p-3.5 rounded-lg flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{language === 'he' ? 'כתבת חוות דעת למורה זה' : 'You have reviewed this tutor'}</span>
                        </div>
                        <p className="text-xs text-indigo-700">
                          {language === 'he' ? 'חוות הדעת שלך פורסמה ומשוקללת בדירוג המורה.' : 'Your review is published and included in the tutor rating.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartEditReview}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-200 rounded transition-colors shrink-0 cursor-pointer shadow-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{language === 'he' ? 'ערוך חוות דעת' : 'Edit Review'}</span>
                      </button>
                    </div>
                  ) : !reviewEligibility.eligible ? (
                    <div className="bg-amber-50/80 border border-amber-200/90 p-3.5 rounded-lg flex items-start gap-2.5">
                      <div className="p-1.5 bg-amber-100 rounded-full text-amber-800 shrink-0 mt-0.5">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-amber-900">
                          {language === 'he' ? 'כתיבת חוות דעת' : 'Write a Review'}
                        </p>
                        <p className="text-xs text-amber-800/90 leading-relaxed">
                          {reviewEligibility.reason || (language === 'he' ? 'יש להתחבר כתלמיד כדי לדרג ולכתוב חוות דעת.' : 'Please sign in as a student to review.')}
                        </p>
                      </div>
                    </div>
                  ) : reviewSuccess ? (
                    <div className="bg-emerald-50 text-emerald-700 p-3 rounded text-xs border border-emerald-100 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{language === 'he' ? 'חוות הדעת נשמרה בהצלחה ודירוג המורה עודכן! תודה על השיתוף.' : 'Review saved successfully and tutor rating updated! Thank you.'}</span>
                    </div>
                  ) : (
                    <form onSubmit={handleReviewSubmit} className="space-y-3">
                      {reviewEligibility.isVerifiedLesson && (
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{language === 'he' ? 'תלמיד מאומת: שיעור עם המורה אושר / תואם' : 'Verified Student: Lesson coordinated with tutor'}</span>
                        </div>
                      )}

                      {reviewError && (
                        <div className="bg-rose-50 text-rose-700 p-2 rounded text-xs border border-rose-100">
                          {reviewError}
                        </div>
                      )}
                      
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            placeholder={language === 'he' ? 'השם שלך' : 'Your name'}
                            value={isAnonymous ? (language === 'he' ? 'תלמיד אנונימי' : 'Anonymous Student') : newReviewerName}
                            onChange={(e) => setNewReviewerName(e.target.value)}
                            disabled={isAnonymous}
                            className={`w-full px-3 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors ${
                              isAnonymous ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'bg-white text-slate-800'
                            }`}
                            required={!isAnonymous}
                          />
                          <label className="flex items-center gap-2 text-[11px] text-slate-500 font-bold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isAnonymous}
                              onChange={(e) => setIsAnonymous(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                            <span>{language === 'he' ? 'פרסם כחוות דעת אנונימית (שמך לא יוצג לתלמידים אחרים)' : 'Post anonymously (your name will not be shown to others)'}</span>
                          </label>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200 shrink-0 self-start">
                          <span className="text-xs font-medium text-slate-500">{language === 'he' ? 'דירוג:' : 'Rating:'}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((starValue) => (
                              <button
                                key={starValue}
                                type="button"
                                id={`star-select-${starValue}`}
                                onClick={() => setNewRating(starValue)}
                                className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
                              >
                                <Star 
                                  className={`w-4 h-4 ${
                                    starValue <= newRating 
                                      ? 'fill-amber-400 text-amber-400' 
                                      : 'text-slate-300'
                                  }`} 
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <textarea
                          placeholder={language === 'he' ? 'שתף את חוויית הלימוד שלך עם המורה...' : 'Share your learning experience with this tutor...'}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 min-h-[60px] bg-white"
                          required
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        {isEditingReview && (
                          <button
                            type="button"
                            onClick={() => setIsEditingReview(false)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs px-3 py-2 rounded transition-colors cursor-pointer"
                          >
                            {language === 'he' ? 'ביטול' : 'Cancel'}
                          </button>
                        )}
                        <button
                          type="submit"
                          id="submit-review-btn"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isEditingReview ? (language === 'he' ? 'עדכן חוות דעת' : 'Update Review') : t.sendReview}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* List of existing reviews */}
              <div className="space-y-3.5">
                {tutor.reviews.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">{language === 'he' ? 'אין עדיין חוות דעת למורה זה. היה הראשון לכתוב!' : 'No reviews yet for this tutor. Be the first to leave one!'}</p>
                ) : (
                  tutor.reviews.map((review) => (
                    <div key={review.id} className="bg-white border border-slate-200 p-4 rounded shadow-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-xs">{review.reviewerName}</span>
                          {review.isVerifiedLesson && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{language === 'he' ? 'תלמיד מאומת' : 'Verified Student'}</span>
                            </span>
                          )}
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((starIndex) => (
                              <Star 
                                key={starIndex} 
                                className={`w-3.5 h-3.5 ${
                                  starIndex <= review.rating 
                                    ? 'fill-amber-400 text-amber-400' 
                                    : 'text-slate-200'
                                }`} 
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400">{review.date}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {review.comment}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
