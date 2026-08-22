import React, { useState } from 'react';
import { Tutor, TimeSlot } from '../types';
import { X, Calendar, Clock, Plus, Trash2, AlertTriangle, Sparkles, Check } from 'lucide-react';

interface ManageSlotsModalProps {
  tutor: Tutor;
  onUpdateSlots: (tutorId: string, updatedSlots: TimeSlot[]) => void;
  onClose: () => void;
}

export const ManageSlotsModal: React.FC<ManageSlotsModalProps> = ({ tutor, onUpdateSlots, onClose }) => {
  const [newDay, setNewDay] = useState('יום ראשון');
  const [newTime, setNewTime] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const daysOfWeek = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'מוצ״ש'];

  const timePresets = [
    '09:00 - 10:00',
    '10:00 - 11:00',
    '11:00 - 12:00',
    '14:00 - 15:00',
    '15:00 - 16:00',
    '16:00 - 17:00',
    '17:00 - 18:00',
    '18:00 - 19:00',
    '19:00 - 20:00',
  ];

  const handleAddSlot = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    if (!newTime.trim()) {
      setError('נא להזין או לבחור שעה לפעילות');
      return;
    }

    const currentSlots = tutor.availableSlots || [];

    // Check for duplicate slot in this tutor's profile
    const isDuplicate = currentSlots.some(
      (slot) => slot.day === newDay && slot.time.trim() === newTime.trim()
    );

    if (isDuplicate) {
      setError('כבר קיים מועד פנוי ביום ובשעה הזו ביומן שלך');
      return;
    }

    const newSlot: TimeSlot = {
      id: `slot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      day: newDay,
      time: newTime.trim(),
      isBooked: false,
    };

    const updatedSlots = [...currentSlots, newSlot];
    
    // Sort slots by day and then by time approximately
    const sortedSlots = sortSlots(updatedSlots);

    onUpdateSlots(tutor.id, sortedSlots);
    setNewTime('');
    setSuccess('השעה הפנויה נוספה בהצלחה ליומן שלך!');
    setTimeout(() => setSuccess(''), 2500);
  };

  const handleRemoveSlot = (slotId: string, isBooked: boolean) => {
    setError('');
    setSuccess('');

    if (isBooked) {
      const confirmCancel = window.confirm(
        'שים לב! מועד זה כבר הוזמן על ידי תלמיד. הסרת המועד תבטל את השיעור המוזמן במערכת. האם אתה בטוח שברצונך לבטל ולהסיר שעה זו?'
      );
      if (!confirmCancel) return;
    }

    const updatedSlots = (tutor.availableSlots || []).filter((slot) => slot.id !== slotId);
    onUpdateSlots(tutor.id, updatedSlots);
    setSuccess('השעה הוסרה בהצלחה מהיומן שלך.');
    setTimeout(() => setSuccess(''), 2500);
  };

  // Quick helper to sort slots Sunday-Saturday and then by hour
  const sortSlots = (slots: TimeSlot[]): TimeSlot[] => {
    const dayOrder = daysOfWeek.reduce((acc, day, index) => {
      acc[day] = index;
      return acc;
    }, {} as Record<string, number>);

    return [...slots].sort((a, b) => {
      const dayDiff = (dayOrder[a.day] ?? 99) - (dayOrder[b.day] ?? 99);
      if (dayDiff !== 0) return dayDiff;
      return a.time.localeCompare(b.time);
    });
  };

  // Group current slots by day for a beautiful visual layout
  const groupedSlots = daysOfWeek.reduce((acc, day) => {
    const daySlots = (tutor.availableSlots || []).filter((slot) => slot.day === day);
    if (daySlots.length > 0) {
      acc[day] = daySlots;
    }
    return acc;
  }, {} as Record<string, TimeSlot[]>);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Overlay Background */}
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-fade-in" onClick={onClose} />

      {/* Modal Container */}
      <div 
        id="manage-slots-modal"
        className="relative bg-white rounded w-full max-w-2xl overflow-hidden shadow-2xl z-10 border border-slate-200 flex flex-col max-h-[90vh] text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span>ניהול יומן השעות שלי</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              הוספה או הסרה של שעות פעילות פנויות בתיאום השיעורים שלך
            </p>
          </div>
          <button 
            id="close-slots-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-grow p-6 overflow-y-auto space-y-6">
          
          {/* Quick Stats/Notice Panel */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded p-4 flex gap-3 text-xs text-indigo-800 leading-relaxed">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">איך זה עובד?</p>
              <p className="mt-1">
                השעות שתגדיר כאן יופיעו לתלמידים בפרופיל שלך. הם יוכלו לשריין איתך שיעור בשעה הזו בלחיצת כפתור.
                כשתלמיד מזמין שעה, היא תינעל במערכת ותופיע בסטטוס <span className="font-bold">״מוזמן״</span>.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-700 p-3 rounded text-xs border border-rose-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 text-emerald-800 p-3 rounded text-xs border border-emerald-100 flex items-center gap-2 font-bold animate-pulse">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Section 1: Add New Hour Form */}
          <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">הוספת שעה פנויה חדשה</h3>
            
            <form onSubmit={handleAddSlot} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">יום בשבוע</label>
                <select
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
                >
                  {daysOfWeek.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">שעה / טווח שעות</label>
                <input
                  type="text"
                  placeholder="למשל: 16:00 - 17:00"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>

              <button
                type="submit"
                id="add-slot-btn"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm h-[34px]"
              >
                <Plus className="w-4 h-4" />
                <span>הוסף שעה ליומן</span>
              </button>
            </form>

            {/* Quick Hour Presets */}
            <div className="space-y-1.5 pt-1.5">
              <span className="text-[10px] font-bold text-slate-400 block">בחירה מהירה של שעה נפוצה:</span>
              <div className="flex flex-wrap gap-1.5">
                {timePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewTime(preset)}
                    className="px-2 py-1 text-[10px] font-medium bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Active Slots View */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>השעות הפעילות ביומן שלי ({tutor.availableSlots.length})</span>
            </h3>

            {tutor.availableSlots.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded text-slate-400 space-y-1">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold">אין לך שעות פנויות ביומן כרגע</p>
                <p className="text-[10px]">השתמש בטופס למעלה כדי להוסיף את ימי ושעות הזמינות שלך.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {daysOfWeek.map((day) => {
                  const slotsForDay = groupedSlots[day];
                  if (!slotsForDay) return null;

                  return (
                    <div key={day} className="bg-slate-50/50 border border-slate-200/80 rounded p-3.5 space-y-2">
                      <span className="text-xs font-extrabold text-indigo-600 block bg-indigo-50/50 px-2 py-0.5 rounded-sm inline-block">
                        {day}
                      </span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {slotsForDay.map((slot) => (
                          <div
                            key={slot.id}
                            className={`flex items-center justify-between p-2.5 rounded bg-white border transition-all text-xs font-medium ${
                              slot.isBooked
                                ? 'border-amber-200 bg-amber-50/20'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-bold text-slate-700">{slot.time}</span>
                              {slot.isBooked && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                  מוזמן!
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveSlot(slot.id, slot.isBooked)}
                              className={`p-1 rounded cursor-pointer transition-colors ${
                                slot.isBooked 
                                  ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' 
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-slate-100'
                              }`}
                              title={slot.isBooked ? 'בטל והסר שיעור מוזמן' : 'הסר שעה פנויה'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex justify-between items-center z-20">
          <span className="text-[10px] text-slate-400 font-bold">
            כל השינויים נשמרים במערכת באופן מיידי
          </span>
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded transition-colors cursor-pointer shadow-sm"
          >
            סיום וסגירה
          </button>
        </div>
      </div>
    </div>
  );
};
