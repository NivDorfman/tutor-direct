import React, { useState } from 'react';
import { Tutor } from '../types';
import { SUBJECTS_LIST } from '../initialData';
import { Check, Plus, BookOpen, DollarSign, AlertCircle, Trash2, GraduationCap, Sparkles } from 'lucide-react';

export const AVAILABLE_LEVELS = [
  'כיתה א', 'כיתה ב', 'כיתה ג', 'כיתה ד', 'כיתה ה', 'כיתה ו',
  'כיתה ז', 'כיתה ח', 'כיתה ט', 'כיתה י', 'כיתה י"א', 'כיתה י"ב',
  'תואר ראשון'
];

interface ForceCompleteProfileModalProps {
  tutor: Tutor;
  onUpdateProfile: (updatedFields: Partial<Tutor>) => void;
}

export const ForceCompleteProfileModal: React.FC<ForceCompleteProfileModalProps> = ({ 
  tutor, 
  onUpdateProfile 
}) => {
  // Parsing currently taught subjects
  const initialSubjects = tutor.subject ? tutor.subject.split(',').map(s => s.trim()).filter(Boolean) : [];
  // Parsing currently taught levels
  const initialLevels = tutor.levels ? tutor.levels.split(',').map(l => l.trim()).filter(Boolean) : [];
  
  // State variables
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(initialSubjects);
  const [selectedLevels, setSelectedLevels] = useState<string[]>(initialLevels);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [price, setPrice] = useState<number>(tutor.price || 100);
  
  const [error, setError] = useState('');

  // Toggle subject selection
  const handleToggleSubject = (subjectName: string) => {
    setError('');
    if (selectedSubjects.includes(subjectName)) {
      setSelectedSubjects(selectedSubjects.filter(s => s !== subjectName));
    } else {
      setSelectedSubjects([...selectedSubjects, subjectName]);
    }
  };

  // Toggle level selection
  const handleToggleLevel = (levelName: string) => {
    setError('');
    if (selectedLevels.includes(levelName)) {
      setSelectedLevels(selectedLevels.filter(l => l !== levelName));
    } else {
      setSelectedLevels([...selectedLevels, levelName]);
    }
  };

  // Add custom subject
  const handleAddCustomSubject = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = customSubjectInput.trim();
    
    if (!trimmed) {
      setError('אנא הקלד שם מקצוע חוקי');
      return;
    }
    
    if (selectedSubjects.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setError('מקצוע זה כבר נבחר');
      return;
    }

    setSelectedSubjects([...selectedSubjects, trimmed]);
    setCustomSubjectInput('');
  };

  // Remove selected subject
  const handleRemoveSubject = (subjectName: string) => {
    setSelectedSubjects(selectedSubjects.filter(s => s !== subjectName));
  };

  // Save changes
  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedSubjects.length === 0) {
      setError('עליך לבחור לפחות מקצוע אחד שאתה מלמד');
      return;
    }

    if (selectedLevels.length === 0) {
      setError('עליך לבחור לפחות כיתה או רמת לימוד אחת שאתה מלמד');
      return;
    }

    if (price < 20 || price > 1000) {
      setError('עלות השיעור צריכה להיות בין 20 ל-1000 ש"ח לשעה');
      return;
    }

    // Merge into comma-separated strings
    const finalSubjectString = selectedSubjects.join(', ');
    const finalLevelsString = selectedLevels.join(', ');

    // Invoke update handler
    onUpdateProfile({
      subject: finalSubjectString,
      levels: finalLevelsString,
      price
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Non-clickable Overlay Background */}
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md" />

      {/* Modal Container */}
      <div 
        id="force-complete-profile-modal"
        className="relative bg-white rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl z-10 border border-indigo-100 flex flex-col max-h-[95vh] text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight">
              השלמת פרטי פרופיל מורה
            </h2>
            <p className="text-[11px] text-indigo-100 mt-0.5 font-medium">
              נרשמת בהצלחה! על מנת שנוכל להציג אותך לתלמידים, יש להשלים את הגדרת המקצועות והכיתות שברצונך ללמד.
            </p>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSaveChanges} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-600 flex items-start gap-2 animate-pulse">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: PRICE */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
              <DollarSign className="w-4 h-4 text-indigo-600" />
              <span>מחיר מבוקש לשיעור (לשעה)</span>
            </h3>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-[200px]">
                <input
                  type="number"
                  min="20"
                  max="1000"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 pr-8 text-xs font-bold border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs font-extrabold text-slate-400">₪</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                טווח מותר: 20 ₪ עד 1000 ₪ לשיעור.
              </span>
            </div>
          </div>

          {/* SECTION 2: SUBJECTS TAUGHT */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>מקצועות לימוד שאתה מעביר *</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              בחר את כל המקצועות שתרצה ללמד. ניתן לבחור מספר מקצועות בו-זמנית:
            </p>

            {/* Default subjects list selectors */}
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS_LIST.map((subj) => {
                const isSelected = selectedSubjects.includes(subj);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => handleToggleSubject(subj)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{subj}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom subject adder */}
            <div className="pt-2">
              <div className="flex gap-2 max-w-md">
                <input
                  type="text"
                  placeholder="הקלד מקצוע מותאם אישית (למשל: ספרדית, ביולוגיה)"
                  value={customSubjectInput}
                  onChange={(e) => setCustomSubjectInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSubject}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>הוסף מקצוע</span>
                </button>
              </div>
            </div>

            {/* Currently selected subjects listing */}
            {selectedSubjects.length > 0 && (
              <div className="bg-indigo-50/50 rounded-lg p-3 border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-800 block mb-1.5">המקצועות שבחרת ללמד:</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSubjects.map((subj) => (
                    <div
                      key={subj}
                      className="bg-white border border-indigo-200 text-indigo-700 rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1.5"
                    >
                      <span>{subj}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubject(subj)}
                        className="text-indigo-400 hover:text-indigo-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: LEVELS/CLASSES TAUGHT */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>רמות לימוד וכיתות יעד *</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              סמן את כל הכיתות שאתה מוכן ומנוסה ללמד:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {AVAILABLE_LEVELS.map((level) => {
                const isSelected = selectedLevels.includes(level);
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleToggleLevel(level)}
                    className={`px-3 py-2.5 rounded border text-right text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-700 ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>{level}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-lg text-xs transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>שמור הגדרות והמשך לאתר</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
