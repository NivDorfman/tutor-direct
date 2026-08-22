import { TimeSlot, Booking } from '../types';

export const HEBREW_DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'מוצ״ש'];

const DAY_MAP: Record<string, number> = {
  'יום ראשון': 0, 'ראשון': 0, 'א': 0, 'א׳': 0, 'יום א׳': 0,
  'יום שני': 1, 'שני': 1, 'ב': 1, 'ב׳': 1, 'יום ב׳': 1,
  'יום שלישי': 2, 'שלישי': 2, 'ג': 2, 'ג׳': 2, 'יום ג׳': 2,
  'יום רביעי': 3, 'רביעי': 3, 'ד': 3, 'ד׳': 3, 'יום ד׳': 3,
  'יום חמישי': 4, 'חמישי': 4, 'ה': 4, 'ה׳': 4, 'יום ה׳': 4,
  'יום שישי': 5, 'שישי': 5, 'ו': 5, 'ו׳': 5, 'יום ו׳': 5,
  'מוצ״ש': 6, 'מוצ"ש': 6, 'מוצאי שבת': 6, 'שבת': 6, 'יום שבת': 6, 'ש': 6, 'ז': 6, 'יום ז׳': 6
};

/**
 * Normalizes day representation to index 0-6
 */
export function normalizeDay(dayStr?: string): number {
  if (!dayStr) return 0;
  const trimmed = dayStr.trim();
  if (DAY_MAP[trimmed] !== undefined) return DAY_MAP[trimmed];
  const clean = trimmed.replace(/['"״׳]/g, '').replace(/מוצש/g, 'מוצ״ש');
  for (const [k, v] of Object.entries(DAY_MAP)) {
    if (k.replace(/['"״׳]/g, '') === clean) return v;
  }
  return 0;
}

/**
 * Normalizes time slot string to standard format "HH:MM - HH:MM"
 */
export function normalizeTime(timeStr?: string): string {
  if (!timeStr) return '16:00 - 17:00';
  const parts = timeStr.split('-').map(s => s.trim());
  const [h1 = '16', m1 = '00'] = (parts[0] || '16:00').split(':');
  const [h2 = '17', m2 = '00'] = (parts[1] || '17:00').split(':');
  return `${h1.padStart(2, '0')}:${m1.padStart(2, '0')} - ${h2.padStart(2, '0')}:${m2.padStart(2, '0')}`;
}

/**
 * Checks if two slots have identical day and time
 */
export function isSameSlot(slot1?: { day: string; time: string }, slot2?: { day: string; time: string }): boolean {
  if (!slot1 || !slot2) return false;
  return normalizeDay(slot1.day) === normalizeDay(slot2.day) && normalizeTime(slot1.time) === normalizeTime(slot2.time);
}

/**
 * Merges and deduplicates booking records so that duplicates are never shown or created.
 */
export function deduplicateBookings(bookingsList: Booking[]): Booking[] {
  const result: Booking[] = [];

  for (const item of bookingsList) {
    if (!item) continue;

    const existingIndex = result.findIndex(b => {
      if (b.id === item.id) return true;
      if (b.slot?.id && item.slot?.id && b.slot.id === item.slot.id) return true;

      const sameSlot = isSameSlot(b.slot, item.slot);
      if (!sameSlot) return false;

      const sameTutor = Boolean(
        (b.tutorId && item.tutorId && b.tutorId === item.tutorId) ||
        (b.tutorEmail && item.tutorEmail && b.tutorEmail.toLowerCase() === item.tutorEmail.toLowerCase()) ||
        (b.tutorName && item.tutorName && b.tutorName !== 'מורה פרטי' && b.tutorName.toLowerCase() === item.tutorName.toLowerCase())
      );

      const sameStudent = Boolean(
        (b.studentId && item.studentId && b.studentId === item.studentId) ||
        (b.studentEmail && item.studentEmail && b.studentEmail.toLowerCase() === item.studentEmail.toLowerCase()) ||
        (b.studentName && item.studentName && b.studentName !== 'תלמיד' && b.studentName.toLowerCase() === item.studentName.toLowerCase())
      );

      return sameTutor || sameStudent;
    });

    if (existingIndex === -1) {
      result.push({ ...item });
    } else {
      const existing = result[existingIndex];

      const isCompleted = 
        existing.status === 'הושלם' || 
        item.status === 'הושלם' || 
        ((existing.studentConfirmed || item.studentConfirmed) && (existing.teacherConfirmed || item.teacherConfirmed));
      const isApproved = !isCompleted && (existing.status === 'מאושר' || item.status === 'מאושר');
      const isCancelled = !isCompleted && !isApproved && (existing.status === 'בוטל' || item.status === 'בוטל');
      const finalStatus: Booking['status'] = isCompleted ? 'הושלם' : isApproved ? 'מאושר' : isCancelled ? 'בוטל' : 'ממתין';

      let finalSubject = existing.subject;
      if ((!finalSubject || finalSubject === 'שיעור פרטי') && item.subject && item.subject !== 'שיעור פרטי') {
        finalSubject = item.subject;
      }

      const finalStudentName = (existing.studentName && existing.studentName !== 'תלמיד') ? existing.studentName : (item.studentName || existing.studentName);
      const finalStudentEmail = existing.studentEmail || item.studentEmail;
      const finalStudentId = existing.studentId || item.studentId;
      const finalTutorEmail = existing.tutorEmail || item.tutorEmail;
      const finalTutorId = existing.tutorId || item.tutorId;
      const finalNote = existing.note || item.note;
      const finalId = (existing.id && !existing.id.startsWith('booking-')) ? existing.id : (item.id || existing.id);

      result[existingIndex] = {
        ...existing,
        id: finalId,
        tutorId: finalTutorId,
        tutorEmail: finalTutorEmail,
        studentName: finalStudentName,
        studentEmail: finalStudentEmail,
        studentId: finalStudentId,
        subject: finalSubject,
        note: finalNote,
        status: finalStatus,
        studentConfirmed: Boolean(existing.studentConfirmed || item.studentConfirmed || isCompleted),
        teacherConfirmed: Boolean(existing.teacherConfirmed || item.teacherConfirmed || isCompleted)
      };
    }
  }

  return result;
}

/**
 * Converts a human readable day & time (e.g. "יום ראשון", "16:00 - 17:00")
 * into a valid ISO timestamp for PostgreSQL timestamp column.
 */
export function dayTimeToIso(dayStr: string, timeStr: string): string {
  const dayIdx = normalizeDay(dayStr);
  const timeParts = (timeStr || '16:00').split('-').map(s => s.trim());
  const [startHourStr, startMinStr] = (timeParts[0] || '16:00').split(':').map(Number);
  const startHour = isNaN(startHourStr) ? 16 : Math.min(23, Math.max(0, startHourStr));
  const startMin = isNaN(startMinStr) ? 0 : Math.min(59, Math.max(0, startMinStr));

  // Reference base Sunday: 2026-08-23
  const d = new Date(Date.UTC(2026, 7, 23 + dayIdx, startHour, startMin, 0, 0));
  return d.toISOString();
}

/**
 * Converts an ISO timestamp from PostgreSQL datetime column
 * back into { day: string, time: string } for UI presentation.
 */
export function isoToDayTime(isoStr: string): { day: string; time: string } {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
      return { day: 'יום ראשון', time: '16:00 - 17:00' };
    }
    const dayIdx = d.getUTCDay();
    const day = HEBREW_DAYS[dayIdx] || 'יום ראשון';
    const startHour = String(d.getUTCHours()).padStart(2, '0');
    const startMin = String(d.getUTCMinutes()).padStart(2, '0');
    const endH = (d.getUTCHours() + 1) % 24;
    const endHour = String(endH).padStart(2, '0');
    const time = `${startHour}:${startMin} - ${endHour}:${startMin}`;
    return { day, time };
  } catch {
    return { day: 'יום ראשון', time: '16:00 - 17:00' };
  }
}

/**
 * Generates initial default slots for a tutor if none exist.
 */
export function generateDefaultSlots(tutorId: string): TimeSlot[] {
  return [
    { id: `slot-${tutorId}-1`, day: 'יום ראשון', time: '16:00 - 17:00', isBooked: false },
    { id: `slot-${tutorId}-2`, day: 'יום שלישי', time: '17:00 - 18:00', isBooked: false },
    { id: `slot-${tutorId}-3`, day: 'יום חמישי', time: '18:00 - 19:00', isBooked: false }
  ];
}
