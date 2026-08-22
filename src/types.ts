export interface Review {
  id: string;
  reviewerName: string;
  reviewerEmail?: string;
  rating: number; // 1 to 5
  comment: string;
  date: string;
  isVerifiedLesson?: boolean;
}

export interface TimeSlot {
  id: string;
  day: string; // e.g. "יום ראשון"
  time: string; // e.g. "16:00 - 17:00"
  isBooked: boolean;
}

export interface StudyMaterial {
  id: string;
  name: string; // e.g. "דף נוסחאות בגרות 5 יח"
  type: 'formula_sheet' | 'summary' | 'presentation' | 'worksheet' | 'other';
  fileUrl: string; // Supabase Storage public url or Data URL
  fileName: string;
  fileType: string; // e.g. "pdf", "docx", "pptx", "png", "jpg"
  fileSize?: string; // e.g. "1.4 MB"
  description?: string;
  uploadedAt: string; // YYYY-MM-DD
}

export interface Tutor {
  id: string;
  name: string;
  subject: string;
  price: number; // price per hour in NIS
  rating: number; // average rating
  reviews: Review[];
  bio: string;
  education: string;
  experience: string;
  availableSlots: TimeSlot[];
  email: string;
  phone: string;
  levels?: string; // Comma separated grades/levels taught (e.g. "א, ב, תואר ראשון")
  avatarUrl?: string;
  studyMaterials?: StudyMaterial[];
}

export interface Booking {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorEmail?: string;
  studentName: string;
  studentEmail: string;
  studentId?: string;
  subject: string;
  slot: TimeSlot;
  note: string;
  createdAt: string;
  status: 'ממתין' | 'מאושר' | 'הושלם' | 'בוטל';
  studentConfirmed?: boolean;
  teacherConfirmed?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string; // sender's email/id
  senderName: string;
  text: string;
  timestamp: string; // ISO string
}

export interface Conversation {
  id: string; // tutorId + "_" + studentEmail
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  studentEmail: string;
  studentName: string;
  messages: ChatMessage[];
  lastMessageAt: string;
  unreadCount?: {
    [email: string]: number; // maps user email to unread count
  };
}

