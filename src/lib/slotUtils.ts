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
  const clean = timeStr.replace(/[^\d:\-]/g, ' ').trim();
  const parts = clean.split('-').map(s => s.trim()).filter(Boolean);
  
  const parseMins = (t: string) => {
    const [h = '16', m = '00'] = t.split(':');
    const numH = isNaN(parseInt(h, 10)) ? 16 : parseInt(h, 10);
    const numM = isNaN(parseInt(m, 10)) ? 0 : parseInt(m, 10);
    return numH * 60 + numM;
  };
  
  const formatMins = (totalMins: number) => {
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  if (parts.length >= 2) {
    const m1 = parseMins(parts[0]);
    const m2 = parseMins(parts[1]);
    const startMins = Math.min(m1, m2);
    const endMins = Math.max(m1, m2);
    return `${formatMins(startMins)} - ${formatMins(endMins)}`;
  } else if (parts.length === 1) {
    const m1 = parseMins(parts[0]);
    return `${formatMins(m1)} - ${formatMins(m1 + 60)}`;
  }
  return '16:00 - 17:00';
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
 * When a slot is re-booked after cancellation, the new active booking takes precedence.
 */
export function deduplicateBookings(bookingsList: Booking[]): Booking[] {
  const result: Booking[] = [];

  for (const item of bookingsList) {
    if (!item) continue;

    const existingIndex = result.findIndex(b => {
      // 1. Direct ID exact match
      if (b.id === item.id) return true;
      if (b.slot?.id && item.slot?.id && b.slot.id === item.slot.id) {
        return true;
      }

      const sameSlot = isSameSlot(b.slot, item.slot);
      if (!sameSlot) return false;

      const sameTutor = Boolean(
        (b.tutorId && item.tutorId && b.tutorId === item.tutorId) ||
        (b.tutorEmail && item.tutorEmail && b.tutorEmail.toLowerCase() === item.tutorEmail.toLowerCase()) ||
        (b.tutorName && item.tutorName && b.tutorName !== 'מורה פרטי' && b.tutorName.toLowerCase() === item.tutorName.toLowerCase()) ||
        (!b.tutorId && !item.tutorId)
      );

      const sameStudent = Boolean(
        (b.studentId && item.studentId && b.studentId === item.studentId) ||
        (b.studentEmail && item.studentEmail && b.studentEmail.toLowerCase() === item.studentEmail.toLowerCase()) ||
        (b.studentName && item.studentName && b.studentName !== 'תלמיד' && b.studentName.toLowerCase() === item.studentName.toLowerCase()) ||
        (!b.studentEmail && !item.studentEmail)
      );

      return sameTutor && sameStudent;
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
      
      let finalStatus: Booking['status'];
      if (isCompleted) {
        finalStatus = 'הושלם';
      } else if (item.status === 'בוטל' || existing.status === 'בוטל') {
        // If either record was explicitly cancelled, maintain cancelled status unless a distinctly new active booking replaced it
        if (isApproved) {
          finalStatus = 'מאושר';
        } else if (item.status === 'ממתין' && existing.status === 'בוטל' && item.id !== existing.id) {
          finalStatus = 'ממתין';
        } else {
          finalStatus = 'בוטל';
        }
      } else if (isApproved) {
        finalStatus = 'מאושר';
      } else {
        finalStatus = item.status || existing.status || 'ממתין';
      }

      let finalSubject = existing.subject;
      if ((!finalSubject || finalSubject === 'שיעור פרטי') && item.subject && item.subject !== 'שיעור פרטי') {
        finalSubject = item.subject;
      }

      const finalStudentName = (item.studentName && item.studentName !== 'תלמיד') 
        ? item.studentName 
        : ((existing.studentName && existing.studentName !== 'תלמיד') ? existing.studentName : (item.studentName || existing.studentName));
      const finalStudentEmail = item.studentEmail || existing.studentEmail;
      const finalStudentId = (item as any).studentId || (existing as any).studentId;
      const finalTutorEmail = existing.tutorEmail || item.tutorEmail;
      const finalTutorId = existing.tutorId || item.tutorId;
      const finalNote = item.note || existing.note;
      const finalId = (item.id && !item.id.startsWith('booking-')) ? item.id : (existing.id || item.id);

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
        slot: {
          ...existing.slot,
          isBooked: finalStatus !== 'בוטל'
        },
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
 * Always formats as UTC ISO timestamp deterministically without timezone skew.
 */
export function dayTimeToIso(dayStr: string, timeStr: string): string {
  const dayIdx = normalizeDay(dayStr);
  const normalized = normalizeTime(timeStr);
  const timeParts = normalized.split('-').map(s => s.trim());
  const [startHourStr = '16', startMinStr = '00'] = (timeParts[0] || '16:00').split(':');
  const [endHourStr = '17', endMinStr = '00'] = (timeParts[1] || '17:00').split(':');

  const startHour = Math.min(23, Math.max(0, parseInt(startHourStr, 10) || 16));
  const startMin = Math.min(59, Math.max(0, parseInt(startMinStr, 10) || 0));
  const endHour = Math.min(23, Math.max(0, parseInt(endHourStr, 10) || (startHour + 1) % 24));
  const endMin = Math.min(59, Math.max(0, parseInt(endMinStr, 10) || 0));

  const pad = (n: number) => String(n).padStart(2, '0');
  const dayNum = 23 + dayIdx;
  
  // Format: 2026-08-DDTHH:MM:SSZ where seconds optionally stores endHour
  return `2026-08-${pad(dayNum)}T${pad(startHour)}:${pad(startMin)}:${pad(endHour)}Z`;
}

/**
 * Converts an ISO timestamp from PostgreSQL datetime column
 * back into { day: string, time: string } for UI presentation.
 * Parses string directly to prevent browser timezone shifts.
 */
export function isoToDayTime(isoStr: string): { day: string; time: string } {
  if (!isoStr) return { day: 'יום ראשון', time: '16:00 - 17:00' };
  try {
    const pad = (n: number) => String(n).padStart(2, '0');
    // Match date, hours, minutes, and optional seconds
    const match = isoStr.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const startH = parseInt(match[4], 10);
      const startM = parseInt(match[5], 10);
      const rawSec = match[6] !== undefined ? parseInt(match[6], 10) : undefined;

      const d = new Date(Date.UTC(year, month, day));
      const dayIdx = d.getUTCDay();
      const dayName = HEBREW_DAYS[dayIdx] || 'יום ראשון';

      let endH = (startH + 1) % 24;
      let endM = startM;
      if (rawSec !== undefined && rawSec >= 0 && rawSec < 24 && rawSec !== startH) {
        endH = rawSec;
      }

      const time = `${pad(startH)}:${pad(startM)} - ${pad(endH)}:${pad(endM)}`;
      return { day: dayName, time: normalizeTime(time) };
    }
  } catch (e) {}

  return { day: 'יום ראשון', time: '16:00 - 17:00' };
}

/**
 * Generates initial default slots for a tutor if none exist.
 * Returns an empty array so new teachers start with a clean calendar without fixed hours.
 */
export function generateDefaultSlots(_tutorId?: string): TimeSlot[] {
  return [];
}

