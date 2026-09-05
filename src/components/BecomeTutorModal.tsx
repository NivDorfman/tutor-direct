import React, { useState } from 'react';
import { Tutor, TimeSlot } from '../types';
import { X, Save, AlertCircle, Plus, Trash2, GraduationCap } from 'lucide-react';
import { SUBJECTS_LIST } from '../initialData';
import { Language, getTranslation, translateSubject, translateLevel } from '../lib/i18n';
import { normalizePhoneNumber } from '../lib/businessLogic';

const AVAILABLE_LEVELS = [
  'כיתה א', 'כיתה ב', 'כיתה ג', 'כיתה ד', 'כיתה ה', 'כיתה ו',
  'כיתה ז', 'כיתה ח', 'כיתה ט', 'כיתה י', 'כיתה י"א', 'כיתה י"ב',
  'תואר ראשון'
];

interface BecomeTutorModalProps {
  onClose: () => void;
  onRegister: (tutor: Omit<Tutor, 'id' | 'rating' | 'reviews'>) => void;
  language?: Language;
  existingTutors?: Tutor[];
}

export const BecomeTutorModal: React.FC<BecomeTutorModalProps> = ({ onClose, onRegister, language = 'he', existingTutors = [] }) => {
  const isRtl = language === 'he';
  const [name, setName] = useState('');
  const [subject, setSubject] = useState(SUBJECTS_LIST[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [price, setPrice] = useState(100);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);

  // Custom Slots management
  const [slots, setSlots] = useState<{ day: string; time: string }[]>([]);
  const [newDay, setNewDay] = useState('יום ראשון');
  const [newTime, setNewTime] = useState('16:00 - 17:00');

  const [error, setError] = useState('');

  const daysOfWeek = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'מוצ״ש'];

  const addSlot = () => {
    // Check for duplicate
    const isDuplicate = slots.some(s => s.day === newDay && s.time === newTime);
    if (isDuplicate) {
      setError('מועד זה כבר קיים ברשימה');
      return;
    }
    setSlots([...slots, { day: newDay, time: newTime }]);
    setError('');
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!name.trim()) {
      setError(language === 'he' ? 'אנא הזן שם מלא' : 'Please enter a full name');
      return;
    }

    const cleanName = name.trim().toLowerCase();
    const storedUsers = localStorage.getItem('registered_users');
    const registered = storedUsers ? JSON.parse(storedUsers) : [];
    const nameExists = existingTutors.some(t => t.name && t.name.trim().toLowerCase() === cleanName) ||
                       registered.some((u: any) => u.name && u.name.trim().toLowerCase() === cleanName);
    if (nameExists) {
      setError(language === 'he' ? 'שם זה כבר קיים במערכת, אנא בחר שם אחר' : 'This name is already taken. Please choose a different name.');
      return;
    }
    const finalSubject = subject === 'אחר' ? customSubject.trim() : subject;
    if (!finalSubject) {
      setError('אנא הזן מקצוע לימוד');
      return;
    }
    if (price <= 0) {
      setError('המחיר לשעה חייב להיות גדול מ-0');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('אנא הזן כתובת אימייל תקינה');
      return;
    }
    if (!phone.trim()) {
      setError(language === 'he' ? 'אנא הזן מספר טלפון ליצירת קשר' : 'Please enter a contact phone number');
      return;
    }

    const cleanPhone = normalizePhoneNumber(phone);
    const phoneExists = existingTutors.some(t => t.phone && normalizePhoneNumber(t.phone) === cleanPhone) ||
                        registered.some((u: any) => u.phone && normalizePhoneNumber(u.phone) === cleanPhone);
    if (phoneExists) {
      setError(language === 'he' ? 'מספר טלפון זה כבר קיים במערכת, אנא בחר מספר אחר' : 'This phone number is already registered. Please choose a different one.');
      return;
    }
    if (!bio.trim() || bio.length < 20) {
      setError('אנא שתף לפחות כמה משפטים על עצמך ועל גישת הלימוד (מינימום 20 תווים)');
      return;
    }
    if (!education.trim()) {
      setError('אנא מלא פרטי השכלה');
      return;
    }
    if (!experience.trim()) {
      setError('אנא מלא פרטי ניסיון מקצועי');
      return;
    }
    if (slots.length === 0) {
      setError('אנא הוסף לפחות מועד פנוי אחד לשיעורים');
      return;
    }

    if (selectedLevels.length === 0) {
      setError('אנא בחר לפחות כיתה או רמת לימוד אחת שאתה מלמד (מכיתה א׳ עד י״ב או תואר ראשון)');
      return;
    }

    const availableSlots: TimeSlot[] = slots.map((s, idx) => ({
      id: `new-slot-${Date.now()}-${idx}`,
      day: s.day,
      time: s.time,
      isBooked: false
    }));

    onRegister({
      name,
      subject: finalSubject,
      levels: selectedLevels.join(', '),
      price,
      email,
      phone,
      bio,
      education,
      experience,
      availableSlots
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Overlay Background */}
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Container */}
      <div 
        id="become-tutor-modal"
        className="relative bg-white rounded w-full max-w-2xl overflow-hidden shadow-xl z-10 border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20">
          <h2 className="text-lg font-bold text-slate-800">הצטרפות כמורה פרטי במערכת</h2>
          <button 
            id="close-become-modal-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="bg-rose-50 text-rose-700 p-3.5 rounded text-xs border border-rose-100 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">שם מלא *</label>
              <input
                type="text"
                placeholder="למשל: ד״ר דוד כהן"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">מקצוע לימוד *</label>
              <div className="flex gap-2">
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                >
                  {SUBJECTS_LIST.map((subj) => (
                    <option key={subj} value={subj}>{translateSubject(subj, language)}</option>
                  ))}
                  <option value="אחר">{language === 'he' ? 'אחר (הקלד ידנית)' : 'Other (custom)'}</option>
                </select>
                
                {subject === 'אחר' && (
                  <input
                    type="text"
                    placeholder="הקלד מקצוע..."
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                    required
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">מחיר מבוקש לשעה (₪) *</label>
              <input
                type="number"
                min="1"
                placeholder="120"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">מספר טלפון ליצירת קשר *</label>
              <input
                type="tel"
                placeholder="054-XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white text-right"
                dir="ltr"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">כתובת אימייל לפניות *</label>
              <input
                type="email"
                placeholder="teacher@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white text-right"
                dir="ltr"
                required
              />
            </div>
          </div>

          {/* Classes/Levels selection */}
          <div className="space-y-3 pt-2 border-t border-slate-200 text-right" dir="rtl">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-indigo-600 animate-pulse" />
              <label className="block text-xs font-bold text-slate-700">כיתות ורמות לימוד אותן אתה מלמד *</label>
            </div>
            <p className="text-[11px] text-slate-400">בחר את כל הכיתות או רמות הלימוד (א' עד י"ב או תואר ראשון) שאתה מציע עבורן שיעורים פרטיים:</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AVAILABLE_LEVELS.map((levelName) => {
                const isChecked = selectedLevels.includes(levelName);
                return (
                  <label 
                    key={levelName}
                    className={`flex items-center gap-2 p-2 rounded border text-xs font-bold cursor-pointer transition-all select-none ${
                      isChecked 
                        ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900 shadow-xs' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <input 
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLevels([...selectedLevels, levelName]);
                        } else {
                          setSelectedLevels(selectedLevels.filter(l => l !== levelName));
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>{translateLevel(levelName, language)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Credentials */}
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">השכלה אקדמית והכשרה *</label>
              <input
                type="text"
                placeholder="למשל: תואר ראשון במתמטיקה מאוניברסיטת בן גוריון, תעודת הוראה"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ניסיון מקצועי בהוראה *</label>
              <input
                type="text"
                placeholder="למשל: 5 שנות ניסיון בהוראה פרטית, מתוכן 3 שנים בבית ספר תיכון"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">על עצמך ועל גישת הלימוד שלך (מינימום 20 תווים) *</label>
              <textarea
                placeholder="ספר קצת על עצמך, למה כדאי ללמוד איתך, ואיך נראה שיעור טיפוסי אצלך..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 min-h-[80px] bg-white"
                required
              />
            </div>
          </div>

          {/* Schedule / Time Slots Setup */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">הגדרת שעות פעילות פנויות לשיעורים</h3>
              <p className="text-[11px] text-slate-500 mb-3">הוסף מועדים (ימים ושעות) שבהם תלמידים יוכלו לתאם איתך שיעור באופן מיידי:</p>
              
              {/* Creator control */}
              <div className="flex gap-2 items-end bg-slate-50 p-3 rounded border border-slate-200">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">יום</label>
                  <select
                    value={newDay}
                    onChange={(e) => setNewDay(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded focus:outline-none bg-white"
                  >
                    {daysOfWeek.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">שעות פנויות</label>
                  <input
                    type="text"
                    placeholder="למשל: 16:00 - 17:00"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded focus:outline-none bg-white"
                  />
                </div>

                <button
                  type="button"
                  id="add-slot-btn"
                  onClick={addSlot}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-3 rounded text-xs font-bold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4.5 h-4.5" />
                  <span>הוסף מועד</span>
                </button>
              </div>
            </div>

            {/* Added Slots List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">מועדים שהתווספו ({slots.length}):</span>
              {slots.length === 0 ? (
                <p className="text-xs text-rose-500 italic font-semibold">יש להוסיף לפחות מועד אחד פנוי כדי להירשם!</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  {slots.map((slot, index) => (
                    <div 
                      key={index} 
                      className="bg-white border border-slate-200 px-3 py-2 rounded flex justify-between items-center text-xs shadow-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{slot.day}</span>
                        <span className="text-slate-400 mx-1.5">|</span>
                        <span className="text-slate-600">{slot.time}</span>
                      </div>
                      <button
                        type="button"
                        id={`remove-slot-btn-${index}`}
                        onClick={() => removeSlot(index)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Action buttons inside modal */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 py-4 flex items-center justify-end gap-3 z-20">
            <button
              type="button"
              id="cancel-become-btn"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ביטול
            </button>
            <button
              type="submit"
              id="submit-register-tutor-btn"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-5 py-2.5 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>פרסם פרופיל מורה</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
