import React from 'react';
import { Tutor } from '../types';
import { Star, GraduationCap, ChevronLeft, ChevronRight, Clock, ShieldAlert, Heart, FolderOpen } from 'lucide-react';
import { Language, getTranslation, translateSubject, translateLevel } from '../lib/i18n';
import { calculateTutorRating } from '../initialData';

interface TutorCardProps {
  tutor: Tutor;
  onSelect: (tutor: Tutor) => void;
  language?: Language;
  currentUser?: { id: string; name: string; email: string; role: 'student' | 'teacher'; tutorProfileId?: string };
  isFavorite?: boolean;
  onToggleFavorite?: (tutorId: string) => void;
}

export const TutorCard: React.FC<TutorCardProps> = ({ 
  tutor, 
  onSelect, 
  language = 'he', 
  currentUser,
  isFavorite = false,
  onToggleFavorite 
}) => {
  const t = getTranslation(language);
  const isRtl = language === 'he';

  const isTeacher = currentUser?.role === 'teacher';
  const isSelf = currentUser && (
    tutor.email.toLowerCase() === currentUser.email.toLowerCase() ||
    currentUser.tutorProfileId === tutor.id
  );
  const isBlockedForTeacher = isTeacher && !isSelf;

  const getSubjectColor = (subject: string) => {
    const norm = translateSubject(subject, 'he');
    switch (norm) {
      case 'מתמטיקה':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'אנגלית':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'מדעי המחשב':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'פיזיקה':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'כימיה':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'לשון ועברית':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
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

  const renderCardAvatar = () => {
    if (tutor.avatarUrl) {
      if (tutor.avatarUrl.startsWith('preset:')) {
        const parts = tutor.avatarUrl.split(':');
        const emoji = parts[1] || '👨‍🏫';
        const bg = parts[2] || 'from-indigo-500 to-purple-600';
        return (
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${bg} flex items-center justify-center text-2xl shadow-xs shrink-0 border border-slate-100`}>
            {emoji}
          </div>
        );
      } else {
        return (
          <img
            src={tutor.avatarUrl}
            alt={tutor.name}
            className="w-12 h-12 rounded-full object-cover shadow-xs shrink-0 border border-slate-100"
          />
        );
      }
    }

    return (
      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getGradient(tutor.name)} flex items-center justify-center text-white font-bold text-base shadow-xs shrink-0 border border-slate-100`}>
        {initials}
      </div>
    );
  };

  return (
    <div 
      id={`tutor-card-${tutor.id}`}
      className={`bg-white border border-slate-200 rounded p-5 flex flex-col gap-4 shadow-xs hover:border-indigo-400 hover:shadow transition-all duration-200 relative group ${isRtl ? 'text-right' : 'text-left'}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top row: Avatar, Info & Price + Favorite */}
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {renderCardAvatar()}
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1 max-w-[180px] sm:max-w-[200px]">
              {tutor.subject.split(',').map((subj) => (
                <span key={subj} className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getSubjectColor(subj.trim())}`}>
                  {translateSubject(subj.trim(), language)}
                </span>
              ))}
            </div>
            <h4 className="font-bold text-slate-800 text-base mt-1.5 leading-tight truncate">{tutor.name}</h4>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleFavorite && (
            <button
              type="button"
              id={`btn-favorite-${tutor.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(tutor.id);
              }}
              title={isFavorite ? t.removeFromFavorites : t.addToFavorites}
              className={`p-2 rounded-full border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                isFavorite
                  ? 'bg-rose-50 border-rose-200 text-rose-500 shadow-xs scale-105 hover:bg-rose-100'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50/50'
              }`}
            >
              <Heart className={`w-4 h-4 transition-transform duration-200 active:scale-125 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          )}

          <div className="bg-green-50 text-green-700 text-xs font-extrabold px-2.5 py-1.5 rounded border border-green-100 shrink-0">
            ₪{tutor.price} / {t.perHour}
          </div>
        </div>
      </div>

      {/* Subtitles & details */}
      <div className="space-y-1">
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{tutor.education}</span>
        </p>
        
        <div className="flex items-center justify-between text-xs pt-0.5">
          <div className="flex items-center gap-1 text-amber-500 font-bold">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{calculateTutorRating(tutor).toFixed(1)}</span>
            <span className="text-slate-400 font-normal">({tutor.reviews.length} {t.reviews})</span>
          </div>

          {tutor.availableSlots && tutor.availableSlots.filter(s => !s.isBooked).length > 0 && (
            <div className="flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[10px] font-bold">
              <Clock className="w-3 h-3 text-indigo-600" />
              <span>{tutor.availableSlots.filter(s => !s.isBooked).length} {t.availableSlots}</span>
            </div>
          )}
        </div>

        {/* Badges: Levels and Study Materials */}
        <div className="flex flex-wrap gap-1.5 items-center pt-1">
          {tutor.studyMaterials && tutor.studyMaterials.length > 0 && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 shadow-2xs">
              <FolderOpen className="w-3 h-3 text-emerald-600" />
              <span>{tutor.studyMaterials.length} {t.materialsCountBadge}</span>
            </span>
          )}

          {tutor.levels && (
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[10px] text-slate-400 font-bold shrink-0">{language === 'he' ? 'מלמד:' : 'Teaches:'}</span>
              {tutor.levels.split(',').map((lvl) => (
                <span key={lvl} className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] px-1.5 py-0.5 rounded-sm font-semibold">
                  {translateLevel(lvl.trim(), language)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bio excerpt */}
      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed min-h-[32px]">
        {tutor.bio}
      </p>

      {/* Action button */}
      {isBlockedForTeacher ? (
        <button
          id={`btn-view-${tutor.id}`}
          onClick={() => onSelect(tutor)}
          className="w-full mt-1 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold py-2 rounded text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>{language === 'he' ? 'פרטי מורה (חסום למורים)' : 'Teacher Details (Restricted)'}</span>
        </button>
      ) : (
        <button
          id={`btn-view-${tutor.id}`}
          onClick={() => onSelect(tutor)}
          className="w-full mt-1 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold py-2 rounded text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
        >
          <span>{t.detailsAndSchedule}</span>
          {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
};
