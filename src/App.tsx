'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tutor, Booking, Review, TimeSlot } from './types';
import { INITIAL_TUTORS, SUBJECTS_LIST, calculateTutorRating } from './initialData';
import { TutorCard } from './components/TutorCard';
import { TutorDetailDrawer } from './components/TutorDetailDrawer';
import { BecomeTutorModal } from './components/BecomeTutorModal';
import { MyBookingsModal } from './components/MyBookingsModal';
import { AuthScreen } from './components/AuthScreen';
import { ManageSlotsModal } from './components/ManageSlotsModal';
import { TeacherSettingsModal, AVAILABLE_LEVELS } from './components/TeacherSettingsModal';
import { ForceCompleteProfileModal } from './components/ForceCompleteProfileModal';
import { UserProfileModal } from './components/UserProfileModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { ChatWidget } from './components/ChatWidget';
import { AiConsultantModal } from './components/AiConsultantModal';
import { LiveLessonModal } from './components/LiveLessonModal';
import { TutorDirectLogo } from './components/TutorDirectLogo';
import { supabase, isValidUuid, resolveUserUuid } from './lib/supabase';
import { dayTimeToIso, isoToDayTime, generateDefaultSlots, deduplicateBookings, isSameSlot, normalizeDay, normalizeTime } from './lib/slotUtils';
import { Language, getTranslation, translateSubject, translateSubjectList, translateLevel, translateLevelList } from './lib/i18n';
import { 
  Search, 
  SlidersHorizontal, 
  Star, 
  Plus, 
  Calendar, 
  RotateCcw, 
  GraduationCap, 
  BookOpen, 
  Sparkles, 
  TrendingUp,
  AlertCircle,
  LogOut,
  Clock,
  Settings,
  MessageSquare,
  Globe,
  Heart,
  Menu,
  X,
  Filter,
  User,
  KeyRound,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function App() {
  // --- Language State (i18n) ---
  const [language, setLanguage] = useState<Language>('he');
  const t = getTranslation(language);
  const isRtl = language === 'he';

  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: 'student' | 'teacher'; tutorProfileId?: string; avatarUrl?: string; language?: Language } | null>(null);
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');

  // --- Persistent State ---
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // --- Filtering & Sorting States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('כל המקצועות');
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('כל הרמות');
  const [maxPrice, setMaxPrice] = useState(1000);
  const [minRating, setMinRating] = useState(0); // 0 = all ratings
  const [sortBy, setSortBy] = useState('rating'); // 'rating' | 'price_asc' | 'price_desc' | 'reviews_count'
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // --- Favorites / Wishlist State ---
  const [favorites, setFavorites] = useState<string[]>([]);

  // --- Modal/Drawer UI States ---
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [isBecomeModalOpen, setIsBecomeModalOpen] = useState(false);
  const [isMyBookingsOpen, setIsMyBookingsOpen] = useState(false);
  const [isManageSlotsOpen, setIsManageSlotsOpen] = useState(false);
  const [isTeacherSettingsOpen, setIsTeacherSettingsOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [forceCompleteTutorId, setForceCompleteTutorId] = useState<string | null>(null);
  
  // Mobile UI States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Chat States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [tutorToChatWith, setTutorToChatWith] = useState<Tutor | null>(null);
  const [unreadConversationsCount, setUnreadConversationsCount] = useState(0);
  const [isAiConsultantOpen, setIsAiConsultantOpen] = useState(false);
  const [activeLiveLessonBooking, setActiveLiveLessonBooking] = useState<Booking | null>(null);

  // --- Initialize App States ---
  useEffect(() => {
    // Purge old mock default tutors from localStorage if present
    try {
      const storedTutors = localStorage.getItem('private_tutors');
      if (storedTutors) {
        const parsed = JSON.parse(storedTutors);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((t: any) => t.id && !t.id.startsWith('tutor-') && !['noa.math@gmail.com', 'itai.english@yahoo.com', 'roni.code@gmail.com', 'adi.physics@outlook.com', 'michal.chem@gmail.com', 'daniel.med@gmail.com', 'shira.hebrew@gmail.com'].includes(t.email));
          const sanitized = cleaned.map(({ studyMaterials, ...rest }: any) => rest);
          localStorage.setItem('private_tutors', JSON.stringify(sanitized));
        }
      }
    } catch (e) {}

    // Load saved language preference
    const savedLang = localStorage.getItem('app_language') as Language;
    if (savedLang === 'he' || savedLang === 'en') {
      setLanguage(savedLang);
    }

    // Helper to check for password recovery url
    const checkIsRecoveryFlow = () => {
      if (typeof window === 'undefined') return false;
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      return (
        hash.includes('type=recovery') || 
        search.includes('type=recovery') ||
        search.includes('reset=true') ||
        hash.includes('type=invite') ||
        search.includes('type=invite') ||
        hash.includes('type=magiclink') ||
        search.includes('type=magiclink') ||
        (hash.includes('access_token=') && hash.includes('recovery'))
      );
    };

    const isPasswordRecoveryFlow = checkIsRecoveryFlow();

    if (isPasswordRecoveryFlow) {
      setIsRecoveryFlow(true);
      setIsResetPasswordModalOpen(true);
      // Also check session user email for prefilling
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email) {
          setRecoveryEmail(session.user.email);
        }
      });
    }

    // Load current user session from localStorage if available
    const storedUser = localStorage.getItem('current_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setCurrentUser(parsedUser);
        if (parsedUser.language && (parsedUser.language === 'he' || parsedUser.language === 'en')) {
          setLanguage(parsedUser.language);
        }
        
        // Load user favorites
        const userFavKey = `tutordirect_favorites_${parsedUser.email ? parsedUser.email.toLowerCase() : 'guest'}`;
        const storedFavs = localStorage.getItem(userFavKey);
        if (storedFavs) {
          setFavorites(JSON.parse(storedFavs) || []);
        }
      } catch (e) {
        setCurrentUser(null);
      }
    } else {
      // Fallback guest favorites
      const guestFavs = localStorage.getItem('tutordirect_favorites_guest');
      if (guestFavs) {
        try {
          setFavorites(JSON.parse(guestFavs) || []);
        } catch (e) {
          setFavorites([]);
        }
      }
    }

    // Helper: synchronize session user with Supabase 'users' table and local state
    const syncUserWithDatabase = async (sessionUser: any) => {
      if (!sessionUser?.email) return;
      const userEmail = sessionUser.email.toLowerCase().trim();
      try {
        // 1. Check if user exists in Supabase DB 'users' table
        const { data: userRow, error: fetchErr } = await supabase
          .from('users')
          .select('*')
          .eq('email', userEmail)
          .maybeSingle();

        if (fetchErr) {
          console.warn('Error querying users table during auth sync:', fetchErr);
        }

        let authenticatedUser: any;
        if (userRow) {
          authenticatedUser = {
            id: userRow.id,
            name: userRow.name || sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || userEmail.split('@')[0],
            email: userRow.email,
            role: userRow.role || 'student',
            tutorProfileId: userRow.tutor_profile_id,
            avatarUrl: userRow.avatar || userRow.avatar_url || userRow.avatarUrl,
            phone: userRow.phone,
          };
        } else {
          // 2. User does not exist in DB yet: Insert new user record
          const userName = sessionUser.user_metadata?.full_name || 
                           sessionUser.user_metadata?.name || 
                           userEmail.split('@')[0];

          const userInsertPayload: any = {
            name: userName,
            email: userEmail,
            role: 'student',
            password: 'magic-link-authenticated',
            phone: '',
          };

          if (isValidUuid(sessionUser.id)) {
            userInsertPayload.id = sessionUser.id;
          }

          const { data: insertedUser, error: insertErr } = await supabase
            .from('users')
            .insert([userInsertPayload])
            .select()
            .maybeSingle();

          if (insertErr) {
            console.error('Error inserting new user into DB upon Magic Link login:', insertErr);
          }

          authenticatedUser = {
            id: insertedUser?.id || sessionUser.id,
            name: userName,
            email: userEmail,
            role: 'student',
          };
        }

        setCurrentUser(authenticatedUser);
        localStorage.setItem('current_user', JSON.stringify(authenticatedUser));

        // Load favorites for user
        const userFavKey = `tutordirect_favorites_${userEmail}`;
        const storedFavs = localStorage.getItem(userFavKey);
        if (storedFavs) {
          try {
            setFavorites(JSON.parse(storedFavs) || []);
          } catch (e) {}
        }
      } catch (err) {
        console.error('Error synchronizing auth user with database:', err);
      }
    };

    // Retrieve existing Session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        if (isPasswordRecoveryFlow) {
          setRecoveryEmail(session.user.email || '');
        }
        syncUserWithDatabase(session.user);
      }
    });

    // Listen for Supabase Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const isRecovery = (
        event === 'PASSWORD_RECOVERY' ||
        checkIsRecoveryFlow()
      );

      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem('current_user');
      } else if (isRecovery) {
        // Recovery flow: open the ResetPasswordModal and prefill recovery email
        setIsRecoveryFlow(true);
        setIsResetPasswordModalOpen(true);
        if (session?.user?.email) {
          setRecoveryEmail(session.user.email);
        }
        if (session?.user) {
          syncUserWithDatabase(session.user);
        }
      } else if (session?.user) {
        syncUserWithDatabase(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadDataFromSupabase = useCallback(async () => {
      try {
        // Fetch in parallel with graceful per-query handling
        const [tutorsRes, usersRes, slotsRes, msgsRes, materialsRes] = await Promise.all([
          supabase.from('tutors').select('*'),
          supabase.from('users').select('*'),
          supabase.from('slots').select('*'),
          supabase.from('messages').select('*').order('created_at', { ascending: false }),
          supabase.from('study_materials').select('*').order('uploaded_at', { ascending: false })
        ]);

        const tutorsData = tutorsRes.data || [];
        const usersData = usersRes.data || [];
        const slotsData = slotsRes.data || [];
        const msgsData = msgsRes.data || [];
        const materialsData = materialsRes.data || [];

        if (usersData.length > 0) {
          try {
            localStorage.setItem('cached_db_users', JSON.stringify(usersData));
          } catch (e) {}
        }

        // Parse review logs from Supabase messages for cross-device synchronization
        const remoteReviewLogs: { tutorId: string; rating: number; comment: string; reviewerName: string; reviewerEmail?: string; date?: string; isVerifiedLesson?: boolean }[] = [];
        msgsData.forEach((m: any) => {
          if (m.text && m.text.includes('[REVIEW_LOG:')) {
            const match = m.text.match(/\[REVIEW_LOG:([^:]+):([^:]+):([^:]+):([^:]+)(?::([^\]]+))?\]/);
            if (match) {
              try {
                const tId = match[1];
                const rating = Number(match[2]) || 5;
                const comment = decodeURIComponent(match[3]);
                const rName = decodeURIComponent(match[4]);
                const rEmail = match[5] ? decodeURIComponent(match[5]) : undefined;
                const msgDate = m.created_at ? new Date(m.created_at).toISOString().split('T')[0] : undefined;
                remoteReviewLogs.push({
                  tutorId: tId,
                  rating,
                  comment,
                  reviewerName: rName,
                  reviewerEmail: rEmail,
                  date: msgDate,
                  isVerifiedLesson: true
                });
              } catch (e) {}
            }
          }
        });

        // Helper to resolve reviews from localStorage + remote logs
        let storedReviewsMap: Record<string, Review[]> = {};
        try {
          const rawReviews = localStorage.getItem('tutordirect_all_reviews');
          if (rawReviews) storedReviewsMap = JSON.parse(rawReviews);
        } catch (e) {}

        // User lookup map for latest reviewer names
        const userEmailToLatestName = new Map<string, string>();
        const userIdToLatestName = new Map<string, string>();

        (usersData || []).forEach((u: any) => {
          if (u.email && u.name) userEmailToLatestName.set(u.email.trim().toLowerCase(), u.name.trim());
          if (u.id && u.name) userIdToLatestName.set(u.id.trim().toLowerCase(), u.name.trim());
        });

        try {
          const regUsers = JSON.parse(localStorage.getItem('registered_users') || '[]');
          regUsers.forEach((u: any) => {
            if (u.email && u.name) userEmailToLatestName.set(u.email.trim().toLowerCase(), u.name.trim());
            if (u.id && u.name) userIdToLatestName.set(u.id.trim().toLowerCase(), u.name.trim());
          });
        } catch (e) {}

        try {
          const curU = JSON.parse(localStorage.getItem('current_user') || 'null');
          if (curU?.email && curU?.name) {
            userEmailToLatestName.set(curU.email.trim().toLowerCase(), curU.name.trim());
          }
          if (curU?.id && curU?.name) {
            userIdToLatestName.set(curU.id.trim().toLowerCase(), curU.name.trim());
          }
        } catch (e) {}

        const formatReviewWithLatestAuthorName = (rev: Review): Review => {
          const rEmail = (rev.reviewerEmail || '').trim().toLowerCase();
          const isAnon = rev.reviewerName === 'תלמיד אנונימי' || rev.reviewerName === 'Anonymous Student';
          if (!isAnon && rEmail && userEmailToLatestName.has(rEmail)) {
            const latestName = userEmailToLatestName.get(rEmail)!;
            return {
              ...rev,
              reviewerName: latestName
            };
          }
          return rev;
        };

        const resolveReviewsForTutor = (
          tId?: string,
          tEmail?: string,
          tName?: string,
          initialList: Review[] = []
        ): { reviews: Review[]; rating: number } => {
          const cleanId = (tId || '').trim().toLowerCase();
          const cleanEmail = (tEmail || '').trim().toLowerCase();
          const cleanName = (tName || '').trim().toLowerCase();

          const fromStorage: Review[] = 
            (tId && storedReviewsMap[tId]) ||
            (cleanId && storedReviewsMap[cleanId]) ||
            (cleanEmail && storedReviewsMap[cleanEmail]) ||
            (cleanName && storedReviewsMap[cleanName]) ||
            [];

          const fromLogs: Review[] = remoteReviewLogs
            .filter(l => {
              const lId = (l.tutorId || '').trim().toLowerCase();
              return (
                (cleanId && lId === cleanId) ||
                (cleanEmail && lId === cleanEmail) ||
                (cleanName && lId === cleanName)
              );
            })
            .map((l, idx) => ({
              id: `review-remote-${idx}-${l.reviewerName}`,
              reviewerName: l.reviewerName,
              reviewerEmail: l.reviewerEmail,
              rating: l.rating,
              comment: l.comment,
              date: l.date || new Date().toISOString().split('T')[0],
              isVerifiedLesson: true
            }));

          const merged: Review[] = [];

          const isDuplicateReview = (existing: Review, candidate: Review) => {
            if (existing.id && candidate.id && existing.id === candidate.id) return true;
            if (existing.reviewerEmail && candidate.reviewerEmail && existing.reviewerEmail.trim().toLowerCase() === candidate.reviewerEmail.trim().toLowerCase()) {
              return true;
            }
            return existing.reviewerName === candidate.reviewerName && existing.comment === candidate.comment;
          };

          fromStorage.forEach(r => {
            const formatted = formatReviewWithLatestAuthorName(r);
            const idx = merged.findIndex(m => isDuplicateReview(m, formatted));
            if (idx >= 0) {
              merged[idx] = formatted;
            } else {
              merged.push(formatted);
            }
          });

          fromLogs.forEach(r => {
            const formatted = formatReviewWithLatestAuthorName(r);
            const idx = merged.findIndex(m => isDuplicateReview(m, formatted));
            if (idx >= 0) {
              merged[idx] = formatted;
            } else {
              merged.push(formatted);
            }
          });

          initialList.forEach(ir => {
            const formatted = formatReviewWithLatestAuthorName(ir);
            if (!merged.some(m => isDuplicateReview(m, formatted))) {
              merged.push(formatted);
            }
          });

          const finalizedReviews = merged.map(formatReviewWithLatestAuthorName);
          const calculatedRating = calculateTutorRating({ reviews: finalizedReviews });
          return { reviews: finalizedReviews, rating: calculatedRating };
        };

        const combinedTutors: Tutor[] = [];
        const seenEmails = new Set<string>();
        const seenIds = new Set<string>();
        const seenNames = new Set<string>();

        // 1. Process tutors from Supabase 'tutors' table (Real DB Tutors)
        tutorsData.forEach((t: any) => {
          if (seenIds.has(t.id)) return;
          const userMatch = usersData.find((u: any) => u.id === t.id || u.tutor_profile_id === t.id || (t.email && u.email && u.email.toLowerCase() === t.email.toLowerCase()));
          const tEmail = (userMatch?.email || t.email || '').toLowerCase().trim();
          const tName = (userMatch?.name || t.name || '').trim();

          if (tEmail && seenEmails.has(tEmail)) return;

          const resolvedAvatar = 
            userMatch?.avatar ||
            userMatch?.avatar_url || 
            userMatch?.avatarUrl || 
            t.avatar ||
            t.avatar_url || 
            t.avatarUrl;

          const tutorSlots = slotsData
            .filter((s: any) => s.tutor_id === t.id || (userMatch && s.tutor_id === userMatch.id))
            .map((s: any) => {
              const parsed = s.datetime ? isoToDayTime(s.datetime) : { day: s.day || 'יום ראשון', time: s.time || '16:00 - 17:00' };
              return {
                id: s.id,
                day: s.day || parsed.day,
                time: s.time || parsed.time,
                isBooked: Boolean(s.is_booked)
              };
            });

          // Check if cached slots exist in local storage for this tutor
          let resolvedSlots = tutorSlots;
          if (resolvedSlots.length === 0) {
            try {
              const cached = localStorage.getItem(`tutordirect_slots_${t.id}`) || 
                             (tEmail ? localStorage.getItem(`tutordirect_slots_${tEmail}`) : null);
              if (cached) {
                const parsedCached = JSON.parse(cached);
                if (Array.isArray(parsedCached)) {
                  resolvedSlots = parsedCached;
                }
              }
            } catch (e) {}
          }

          const resolvedReviews = resolveReviewsForTutor(t.id, tEmail, tName, []);

          // Study materials for this tutor
          const tutorMaterials = materialsData
            .filter((m: any) => m.tutor_id === t.id || (userMatch && m.tutor_id === userMatch.id))
            .map((m: any) => ({
              id: m.id,
              name: m.name || m.file_name,
              type: m.type || 'summary',
              fileUrl: m.file_url,
              fileName: m.file_name,
              fileType: m.file_type || 'pdf',
              fileSize: m.file_size || '1 MB',
              description: m.description || '',
              uploadedAt: m.uploaded_at ? new Date(m.uploaded_at).toISOString().split('T')[0] : ''
            }));

          const customTutor: Tutor = {
            id: t.id,
            name: userMatch?.name || t.name || 'מורה מוסמך',
            email: tEmail,
            phone: userMatch?.phone || t.phone || '',
            subject: t.subject || 'מקצוע כללי',
            price: Number(t.price) || 100,
            bio: t.bio || 'מורה פרטי מוסמך באתר TutorDirect',
            education: t.education || 'השכלה אקדמית',
            experience: t.experience || 'ניסיון בהוראה פרטית',
            levels: t.levels ? (Array.isArray(t.levels) ? t.levels.join(', ') : String(t.levels)) : (userMatch?.levels ? (Array.isArray(userMatch.levels) ? userMatch.levels.join(', ') : String(userMatch.levels)) : ''),
            avatarUrl: resolvedAvatar,
            availableSlots: resolvedSlots,
            rating: resolvedReviews.rating || (Number(t.rating) || 5.0),
            reviews: resolvedReviews.reviews,
            studyMaterials: tutorMaterials
          };

          combinedTutors.push(customTutor);
          seenIds.add(t.id);
          if (userMatch?.id) seenIds.add(userMatch.id);
          if (tEmail) seenEmails.add(tEmail);
          if (tName) seenNames.add(tName.toLowerCase());
        });

        // 2. Process any users with role === 'teacher' not yet in combinedTutors
        const teacherUsers = usersData.filter((u: any) => u.role === 'teacher');
        teacherUsers.forEach((u: any) => {
          const uEmail = (u.email || '').toLowerCase().trim();
          const uName = (u.name || '').trim();
          if (seenIds.has(u.id)) return;
          if (uEmail && seenEmails.has(uEmail)) return;

          const resolvedAvatar = u.avatar || u.avatar_url || u.avatarUrl;
          const tutorSlots = slotsData
            .filter((s: any) => s.tutor_id === u.id)
            .map((s: any) => {
              const parsed = s.datetime ? isoToDayTime(s.datetime) : { day: s.day || 'יום ראשון', time: s.time || '16:00 - 17:00' };
              return {
                id: s.id,
                day: s.day || parsed.day,
                time: s.time || parsed.time,
                isBooked: Boolean(s.is_booked)
              };
            });

          // Check if cached slots exist in local storage for this teacher user
          let resolvedSlots = tutorSlots;
          if (resolvedSlots.length === 0) {
            try {
              const cached = localStorage.getItem(`tutordirect_slots_${u.id}`) || 
                             (uEmail ? localStorage.getItem(`tutordirect_slots_${uEmail}`) : null);
              if (cached) {
                const parsedCached = JSON.parse(cached);
                if (Array.isArray(parsedCached)) {
                  resolvedSlots = parsedCached;
                }
              }
            } catch (e) {}
          }

          const resolvedReviews = resolveReviewsForTutor(u.id, uEmail, uName, []);

          const tutorMaterials = materialsData
            .filter((m: any) => m.tutor_id === u.id)
            .map((m: any) => ({
              id: m.id,
              name: m.name || m.file_name,
              type: m.type || 'summary',
              fileUrl: m.file_url,
              fileName: m.file_name,
              fileType: m.file_type || 'pdf',
              fileSize: m.file_size || '1 MB',
              description: m.description || '',
              uploadedAt: m.uploaded_at ? new Date(m.uploaded_at).toISOString().split('T')[0] : ''
            }));

          const customTutor: Tutor = {
            id: u.id,
            name: u.name || 'מורה מוסמך',
            email: uEmail,
            phone: u.phone || '',
            subject: 'מקצוע כללי',
            price: 100,
            bio: 'מורה פרטי מוסמך באתר TutorDirect',
            education: 'השכלה אקדמית',
            experience: 'ניסיון בהוראה פרטית',
            levels: u.levels ? (Array.isArray(u.levels) ? u.levels.join(', ') : String(u.levels)) : '',
            avatarUrl: resolvedAvatar,
            availableSlots: resolvedSlots,
            rating: resolvedReviews.rating || 5.0,
            reviews: resolvedReviews.reviews,
            studyMaterials: tutorMaterials
          };

          combinedTutors.push(customTutor);
          seenIds.add(u.id);
          if (uEmail) seenEmails.add(uEmail);
          if (uName) seenNames.add(uName.toLowerCase());
        });

        // Set real DB tutors in state & cache
        setTutors(combinedTutors);
        try {
          const sanitizedTutors = combinedTutors.map(({ studyMaterials, ...rest }) => rest);
          localStorage.setItem('private_tutors', JSON.stringify(sanitizedTutors));
        } catch (e) {
          console.warn('Could not save tutors to localStorage:', e);
        }

        // Also keep open drawer and chat tutor synchronized with updated avatars
        setSelectedTutor(prev => {
          if (!prev) return null;
          const updated = combinedTutors.find(m => m.id === prev.id || (prev.email && m.email && m.email.toLowerCase() === prev.email.toLowerCase()) || (prev.name && m.name && m.name.trim().toLowerCase() === prev.name.trim().toLowerCase()));
          return updated || prev;
        });

        setTutorToChatWith(prev => {
          if (!prev) return null;
          const updated = combinedTutors.find(m => m.id === prev.id || (prev.email && m.email && m.email.toLowerCase() === prev.email.toLowerCase()) || (prev.name && m.name && m.name.trim().toLowerCase() === prev.name.trim().toLowerCase()));
          return updated || prev;
        });

        // Map bookings from Supabase 'slots' table (Source of Truth)
        // A slot is an active booking ONLY IF is_booked === true AND student_id is set
        const mappedBookings: Booking[] = [];
        const bookedSlots = slotsData.filter((s: any) => Boolean(s.is_booked) && s.student_id !== null && s.student_id !== undefined && s.student_id !== '');
        const bookingMsgs = msgsData.filter((m: any) => m.text && (m.text.includes('תואם שיעור') || m.text.includes('מועד:')));

        bookedSlots.forEach((row: any) => {
          const tutorUser = usersData.find((u: any) => u.id === row.tutor_id);
          const tutorInfo = tutorsData.find((t: any) => t.id === row.tutor_id);
          let studentUser = usersData.find((u: any) => u.id === row.student_id);
          const dt = row.datetime ? isoToDayTime(row.datetime) : { day: 'יום ראשון', time: '16:00 - 17:00' };

          // Check if there is a matching booking message to get rich student details & notes
          const matchingMsg = bookingMsgs.find((m: any) => {
            const dayMatch = m.text.match(/מועד:\s*([^,\n]+)/);
            const timeMatch = m.text.match(/שעה\s*([^\n]+)/);
            const mDay = dayMatch ? dayMatch[1].trim() : '';
            const mTime = timeMatch ? timeMatch[1].trim() : '';
            const isSameTutor = m.receiver_id === row.tutor_id || m.sender_id === row.tutor_id;
            const isSameStudent = row.student_id ? (m.sender_id === row.student_id || m.receiver_id === row.student_id) : false;
            return isSameTutor && (isSameStudent || (mDay === dt.day && mTime === dt.time));
          });

          let studentName = '';
          let studentEmail = '';
          let note = '';

          if (matchingMsg) {
            const nameMatch = matchingMsg.text.match(/תלמיד:\s*([^\n]+)/);
            const emailMatch = matchingMsg.text.match(/אימייל:\s*([^\n]+)/);
            const noteMatch = matchingMsg.text.match(/הערה:\s*([^\n]+)/);
            if (nameMatch) studentName = nameMatch[1].trim();
            if (emailMatch) studentEmail = emailMatch[1].trim();
            if (noteMatch) note = noteMatch[1].trim();

            if (!studentUser) {
              const msgStudentId = matchingMsg.sender_id === row.tutor_id ? matchingMsg.receiver_id : matchingMsg.sender_id;
              studentUser = usersData.find((u: any) => u.id === msgStudentId);
            }
          }

          if (!studentName && studentUser?.name && studentUser.name.trim() !== '' && studentUser.name !== 'תלמיד') {
            studentName = studentUser.name;
          }
          if (!studentEmail && studentUser?.email) {
            studentEmail = studentUser.email;
          }

          mappedBookings.push({
            id: row.id,
            tutorId: row.tutor_id || '',
            tutorName: tutorUser?.name || 'מורה פרטי',
            tutorEmail: tutorUser?.email || '',
            studentName: studentName || (studentUser?.name ? studentUser.name : (studentUser?.email ? studentUser.email.split('@')[0] : 'תלמיד')),
            studentEmail: studentEmail || studentUser?.email || row.student_id || '',
            studentId: row.student_id || studentUser?.id || '',
            subject: tutorInfo?.subject || 'שיעור פרטי',
            slot: {
              id: row.id,
              day: dt.day,
              time: dt.time,
              isBooked: true
            },
            note,
            createdAt: row.created_at ? new Date(row.created_at).toLocaleDateString('he-IL') : new Date().toLocaleDateString('he-IL'),
            status: 'ממתין'
          });
        });

        // 2) Enrich mapped bookings with chat message details (without inventing phantom bookings for unbooked slots)
        bookingMsgs.forEach((msg: any) => {
          const dayMatch = msg.text.match(/מועד:\s*([^,\n]+)/);
          const timeMatch = msg.text.match(/שעה\s*([^\n]+)/);
          const noteMatch = msg.text.match(/הערה:\s*([^\n]+)/);
          const nameMatch = msg.text.match(/תלמיד:\s*([^\n]+)/);
          const emailMatch = msg.text.match(/אימייל:\s*([^\n]+)/);

          const day = dayMatch ? dayMatch[1].trim() : '';
          const time = timeMatch ? timeMatch[1].trim() : '';
          const note = noteMatch ? noteMatch[1].trim() : '';
          const studentName = nameMatch ? nameMatch[1].trim() : '';
          const studentEmail = emailMatch ? emailMatch[1].trim() : '';

          const matched = mappedBookings.find(b => 
            b.id === msg.id ||
            b.slot.id === msg.id ||
            (day && time && isSameSlot(b.slot, { day, time }) && (
              (msg.receiver_id && b.tutorId === msg.receiver_id) ||
              (msg.sender_id && b.tutorId === msg.sender_id) ||
              (studentEmail && b.studentEmail && b.studentEmail.toLowerCase() === studentEmail.toLowerCase())
            ))
          );

          if (matched) {
            if (studentName && (!matched.studentName || matched.studentName === 'תלמיד')) {
              matched.studentName = studentName;
            }
            if (studentEmail && !matched.studentEmail) {
              matched.studentEmail = studentEmail;
            }
            if (note && !matched.note) {
              matched.note = note;
            }
          }
        });

        // 3) Parse and apply real-time status updates from chat messages across all devices in chronological order
        const sortedMsgs = [...msgsData].sort((a: any, b: any) => 
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        );

        sortedMsgs.forEach((m: any) => {
          if (!m.text) return;
          const isApproved = m.text.includes('השיעור אושר') || m.text.includes('STATUS_UPDATE:APPROVED') || m.text.includes('אושר על ידי המורה');
          const isCompleted = m.text.includes('סומן כהושלם') || m.text.includes('STATUS_UPDATE:COMPLETED') || m.text.includes('השיעור הסתיים') || m.text.includes('סומן כהתקיים בהצלחה');
          const isStudentConfirmed = m.text.includes('STATUS_UPDATE:STUDENT_CONFIRMED') || m.text.includes('התלמיד אישר שהשיעור התקיים');
          const isTeacherConfirmed = m.text.includes('STATUS_UPDATE:TEACHER_CONFIRMED') || m.text.includes('המורה אישר שהשיעור התקיים');
          const isCancelled = m.text.includes('השיעור בוטל') || m.text.includes('STATUS_UPDATE:CANCELLED') || m.text.includes('בוטל על ידי') || m.text.includes('בוטל במערכת');
          const isNewBooking = m.text.includes('STATUS_UPDATE:NEW_BOOKING') || m.text.includes('תואם שיעור חדש') || m.text.includes('בקשה לשיעור פרטי');

          if (!isApproved && !isCompleted && !isCancelled && !isStudentConfirmed && !isTeacherConfirmed && !isNewBooking) return;

          const dayMatch = m.text.match(/מועד:\s*([^,\n]+)/);
          const timeMatch = m.text.match(/שעה\s*([^\n]+)/);
          const emailMatch = m.text.match(/(?:אימייל|email|studentEmail):\s*([^\n]+)/i);
          const nameMatch = m.text.match(/(?:תלמיד|student|studentName):\s*([^\n]+)/i);
          const day = dayMatch ? dayMatch[1].trim() : '';
          const time = timeMatch ? timeMatch[1].trim() : '';
          const msgEmail = emailMatch ? emailMatch[1].trim().toLowerCase() : '';
          const msgName = nameMatch ? nameMatch[1].trim().toLowerCase() : '';
          const idMatch = m.text.match(/STATUS_UPDATE:[A-Z_]+:([^\s\]]+)/);
          const targetId = idMatch ? idMatch[1].trim() : '';

          const p1 = m.sender_id;
          const p2 = m.receiver_id;

          mappedBookings.forEach(mb => {
            const matchById = Boolean(targetId && (mb.id === targetId || mb.slot?.id === targetId));
            const sameSlot = (!day || normalizeDay(mb.slot.day) === normalizeDay(day)) && (!time || normalizeTime(mb.slot.time) === normalizeTime(time));
            
            const matchByParticipants = Boolean(
              (p1 && (mb.tutorId === p1 || (mb as any).studentId === p1)) ||
              (p2 && (mb.tutorId === p2 || (mb as any).studentId === p2)) ||
              (currentUser?.id && (mb.tutorId === currentUser.id || (mb as any).studentId === currentUser.id))
            );

            const matchByEmail = Boolean(msgEmail && mb.studentEmail && mb.studentEmail.toLowerCase() === msgEmail);
            const matchByName = Boolean(msgName && mb.studentName && mb.studentName.toLowerCase() === msgName);

            const isMatch = matchById || (sameSlot && (matchByParticipants || matchByEmail || matchByName || (!p1 && !p2)));

            if (isMatch) {
              if (isNewBooking) {
                mb.status = 'ממתין';
                mb.slot.isBooked = true;
                mb.studentConfirmed = false;
                mb.teacherConfirmed = false;
              } else if (isCancelled) {
                mb.status = 'בוטל';
                mb.slot.isBooked = false;
              } else if (isCompleted) {
                mb.status = 'הושלם';
                mb.studentConfirmed = true;
                mb.teacherConfirmed = true;
              } else if (isApproved) {
                if (mb.status === 'ממתין') mb.status = 'מאושר';
              }
              if (isStudentConfirmed) {
                mb.studentConfirmed = true;
              }
              if (isTeacherConfirmed) {
                mb.teacherConfirmed = true;
              }
              if (mb.studentConfirmed && mb.teacherConfirmed) {
                mb.status = 'הושלם';
              }
            }
          });
        });

        // Merge with local confirmed/completed bookings without resurrecting stale unbooked slots
        let combinedBookings: Booking[] = [...mappedBookings];
        try {
          const localBookingsRaw = localStorage.getItem('tutor_bookings');
          if (localBookingsRaw) {
            const localList: Booking[] = JSON.parse(localBookingsRaw);
            if (Array.isArray(localList) && localList.length > 0) {
              localList.forEach(lb => {
                if (lb.status === 'הושלם' || lb.status === 'מאושר') {
                  if (!combinedBookings.some(cb => cb.id === lb.id || (isSameSlot(cb.slot, lb.slot) && cb.tutorId === lb.tutorId))) {
                    combinedBookings.push(lb);
                  }
                }
              });
            }
          }
        } catch (e) {}

        const finalBookings = deduplicateBookings(combinedBookings);
        setBookings(finalBookings);
        try {
          localStorage.setItem('tutor_bookings', JSON.stringify(finalBookings));
        } catch (e) {}

      } catch (err) {
        console.error('Could not load data from Supabase, falling back to local storage:', err);
        // Fallback for tutors
        const storedTutors = localStorage.getItem('private_tutors');
        if (storedTutors) {
          try {
            const parsed: Tutor[] = JSON.parse(storedTutors);
            const filtered = parsed.filter(tut => tut.id && !tut.id.startsWith('tutor-') && !['noa.math@gmail.com', 'itai.english@yahoo.com', 'roni.code@gmail.com', 'adi.physics@outlook.com', 'michal.chem@gmail.com', 'daniel.med@gmail.com', 'shira.hebrew@gmail.com'].includes(tut.email));
            setTutors(filtered.map(tut => ({
              ...tut,
              rating: calculateTutorRating(tut)
            })));
          } catch (e) {
            setTutors([]);
          }
        } else {
          setTutors([]);
        }

        // Fallback for bookings
        const storedBookings = localStorage.getItem('tutor_bookings');
        if (storedBookings) {
          try {
            setBookings(JSON.parse(storedBookings));
          } catch (e) {
            setBookings([]);
          }
        }
      }
    }, []);

    useEffect(() => {
      loadDataFromSupabase();
      
      const channel = supabase
        .channel('public:slots_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => {
          loadDataFromSupabase();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
          loadDataFromSupabase();
        })
        .subscribe();

      const interval = setInterval(loadDataFromSupabase, 4000);
      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }, [loadDataFromSupabase]);

  // --- Save helpers ---
  const saveTutors = async (updatedTutors: Tutor[], specificTutorToSave?: Tutor) => {
    setTutors(updatedTutors);
    try {
      const sanitizedTutors = updatedTutors.map(({ studyMaterials, ...rest }) => rest);
      localStorage.setItem('private_tutors', JSON.stringify(sanitizedTutors));
    } catch (e) {
      console.warn('Could not save tutors to localStorage:', e);
    }
    try {
      // Determine which tutor to save to Supabase
      let tutorToSave: Tutor | undefined = specificTutorToSave;

      if (!tutorToSave) {
        // 1. Check if a new tutor was just registered (exists in updatedTutors but not in current tutors state)
        const newlyRegistered = updatedTutors.find(ut => !tutors.some(t => t.id === ut.id));
        if (newlyRegistered) {
          tutorToSave = newlyRegistered;
        } else if (currentUser && currentUser.role === 'teacher') {
          // 2. Otherwise, check if the logged-in user is a teacher
          const matchedId = currentUser.tutorProfileId || currentUser.id;
          tutorToSave = updatedTutors.find(t => t.id === matchedId || (t.email && t.email.toLowerCase() === currentUser.email.toLowerCase()));
        }
      }

      // If we don't have a specific tutor to save, do not write to the server
      if (!tutorToSave) return;

      const cleanEmail = (tutorToSave.email || currentUser?.email || '').trim().toLowerCase();
      const tutorName = tutorToSave.name || currentUser?.name || 'מורה מוסמך';
      const tutorPhone = tutorToSave.phone || (currentUser as any)?.phone || '';
      const avatarToPersist = tutorToSave.avatarUrl || currentUser?.avatarUrl;

      let resolvedTutorUuid = tutorToSave.id;

      // Update / Upsert user fields (name, email, phone, avatar_url) in 'users' table
      if (cleanEmail || isValidUuid(tutorToSave.id) || (tutorName && tutorName !== 'מורה מוסמך')) {
        let existingUser: any = null;

        if (isValidUuid(tutorToSave.id)) {
          const { data } = await supabase.from('users').select('id, email, name').eq('id', tutorToSave.id).maybeSingle();
          if (data) existingUser = data;
        }

        if (!existingUser && cleanEmail) {
          const { data } = await supabase.from('users').select('id, email, name').ilike('email', cleanEmail).maybeSingle();
          if (data) existingUser = data;
        }

        if (!existingUser && tutorName && tutorName !== 'מורה מוסמך') {
          const { data } = await supabase.from('users').select('id, email, name').ilike('name', tutorName).maybeSingle();
          if (data) existingUser = data;
        }

        if (existingUser?.id) {
          resolvedTutorUuid = existingUser.id;
          const userUpdate: any = {
            name: tutorName,
            phone: tutorPhone,
            role: 'teacher'
          };
          if (avatarToPersist) {
            userUpdate.avatar = avatarToPersist;
          }
          const { error: uErr } = await supabase.from('users').update(userUpdate).eq('id', existingUser.id);
          if (uErr && uErr.message.includes('avatar')) {
            // Fallback if column is named avatar_url or avatar doesn't exist
            await supabase.from('users').update({ name: tutorName, phone: tutorPhone, role: 'teacher' }).eq('id', existingUser.id);
          }
        } else if (cleanEmail) {
          const userInsert: any = {
            name: tutorName,
            email: cleanEmail,
            phone: tutorPhone,
            role: 'teacher',
            password: 'demo'
          };
          if (isValidUuid(tutorToSave.id)) {
            userInsert.id = tutorToSave.id;
          }
          if (avatarToPersist) {
            userInsert.avatar = avatarToPersist;
          }
          const { data: insertedUser, error: insErr } = await supabase.from('users').insert([userInsert]).select('id').maybeSingle();
          if (insErr && insErr.message.includes('avatar')) {
            const { avatar, ...cleanInsert } = userInsert;
            const { data: fallbackUser } = await supabase.from('users').insert([cleanInsert]).select('id').maybeSingle();
            if (fallbackUser?.id) {
              resolvedTutorUuid = fallbackUser.id;
            }
          } else if (insertedUser?.id) {
            resolvedTutorUuid = insertedUser.id;
          }
        }
      }

      // Map tutor to match database columns for 'tutors' table (id, subject, price, education, experience, bio, levels)
      const tutorLevels = typeof tutorToSave.levels === 'string'
        ? tutorToSave.levels.split(',').map(s => s.trim()).filter(Boolean)
        : (tutorToSave.levels || ['תיכון']);

      if (isValidUuid(resolvedTutorUuid)) {
        const tutorRow = {
          id: resolvedTutorUuid,
          subject: tutorToSave.subject,
          price: Number(tutorToSave.price) || 100,
          education: tutorToSave.education || '',
          experience: tutorToSave.experience || '',
          bio: tutorToSave.bio || '',
          levels: tutorLevels
        };

        const { error: tutorErr } = await supabase.from('tutors').upsert(tutorRow);
        if (tutorErr) {
          console.warn('Upsert to tutors table:', tutorErr.message);
        }
      }

      // Also sync slots of this specific tutor to 'slots' table
      if (tutorToSave.availableSlots && tutorToSave.availableSlots.length > 0) {
        const slotTutorId = isValidUuid(resolvedTutorUuid) ? resolvedTutorUuid : tutorToSave.id;
        // Clean previous slots for this tutor
        await supabase.from('slots').delete().or(`tutor_id.eq.${slotTutorId},tutor_id.eq.${tutorToSave.id}`);

        const slotsToInsert = tutorToSave.availableSlots.map(s => ({
          tutor_id: slotTutorId,
          datetime: dayTimeToIso(s.day, s.time),
          is_booked: Boolean(s.isBooked)
        }));

        await supabase.from('slots').insert(slotsToInsert);
      }

    } catch (err) {
      console.error('Failed to save tutors to Supabase:', err);
    }
  };

  const saveBookings = async (updatedBookings: Booking[]) => {
    setBookings(updatedBookings);
    localStorage.setItem('tutor_bookings', JSON.stringify(updatedBookings));
  };


  // --- Actions ---

  // Login handler
  const handleLogin = (user: { id: string; name: string; email: string; role: 'student' | 'teacher'; tutorProfileId?: string; language?: Language }) => {
    setCurrentUser(user);
    localStorage.setItem('current_user', JSON.stringify(user));

    if (user.language && (user.language === 'he' || user.language === 'en')) {
      setLanguage(user.language);
      localStorage.setItem('app_language', user.language);
    }
    
    // Load favorites for this logged in user
    const userFavKey = `tutordirect_favorites_${user.email ? user.email.toLowerCase() : 'guest'}`;
    const storedFavs = localStorage.getItem(userFavKey);
    if (storedFavs) {
      try {
        setFavorites(JSON.parse(storedFavs) || []);
      } catch (e) {
        setFavorites([]);
      }
    } else {
      setFavorites([]);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      // 1. ניקוי ה-Session בשרת Supabase ובדפדפן
      await supabase.auth.signOut();

      // 2. איפוס ה-State המקומי של המשתמש באפליקציה
      setCurrentUser(null);
      setFavorites([]);

      // 3. ניקוי כל מידע מקומי נוסף (אם קיים)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('current_user');
        localStorage.removeItem('user');
        localStorage.removeItem('tutor_direct_session');
        sessionStorage.clear();
      }

      // 4. ניתוב מחדש / רענון נקי
      window.location.href = '/';
    } catch (error) {
      console.error("Error signing out:", error);
      // Fallback in case of network issue: clear local state and redirect
      setCurrentUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('current_user');
        localStorage.removeItem('user');
        localStorage.removeItem('tutor_direct_session');
        window.location.href = '/';
      }
    }
  };

  // Load total unread messages count periodically from Supabase and LocalStorage
  useEffect(() => {
    if (!currentUser) {
      setUnreadConversationsCount(0);
      return;
    }

    let userUuid = isValidUuid(currentUser.id) ? currentUser.id : null;

    const handleUpdateUnread = async () => {
      if (!userUuid) {
        userUuid = await resolveUserUuid(currentUser);
      }

      // 1. Check local storage
      let localUnread = 0;
      const stored = localStorage.getItem('tutor_conversations');
      if (stored) {
        try {
          const convs = JSON.parse(stored);
          if (Array.isArray(convs)) {
            localUnread = convs.filter(c => {
              return (c.unreadCount?.[currentUser.email] || 0) > 0;
            }).length;
          }
        } catch (e) {}
      }

      // 2. Check Supabase for unread messages directed to this user's UUID
      try {
        if (userUuid && isValidUuid(userUuid)) {
          const { data, error } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('receiver_id', userUuid)
            .eq('is_read', false);

          if (!error && data) {
            // Count unique senders
            const uniqueSenders = new Set(data.map((m: any) => m.sender_id));
            const remoteUnread = uniqueSenders.size;
            setUnreadConversationsCount(Math.max(localUnread, remoteUnread));
            return;
          }
        }
      } catch (err) {}

      setUnreadConversationsCount(localUnread);
    };

    handleUpdateUnread();
    const interval = setInterval(handleUpdateUnread, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // 1. Register a new Tutor
  const handleRegisterTutor = (newTutorData: Omit<Tutor, 'id' | 'rating' | 'reviews'>, forceId?: string): string => {
    const newId = forceId || `tutor-new-${Date.now()}`;
    const newTutor: Tutor = {
      ...newTutorData,
      id: newId,
      rating: 5.0, // Initial perfect rating for a new tutor
      reviews: []
    };

    const updated = [newTutor, ...tutors];
    saveTutors(updated);
    setForceCompleteTutorId(newId);
    return newId;
  };

  // 1.1 Force Complete Profile for new Tutors
  const handleForceCompleteProfile = (updatedFields: Partial<Tutor>) => {
    if (!forceCompleteTutorId) return;
    const updatedTutors = tutors.map(t => {
      if (t.id === forceCompleteTutorId) {
        return { ...t, ...updatedFields };
      }
      return t;
    });
    saveTutors(updatedTutors);
    setForceCompleteTutorId(null);
  };

  // 1b. Approve a pending booking (Teacher only)
  const handleApproveBooking = async (bookingId: string) => {
    const targetBooking = bookings.find(b => b.id === bookingId);
    
    // Update local state and storage
    const updatedBookings = deduplicateBookings(bookings.map(b => {
      if (b.id === bookingId || (targetBooking && isSameSlot(b.slot, targetBooking.slot))) {
        return { ...b, status: 'מאושר' as const };
      }
      return b;
    }));
    setBookings(updatedBookings);
    try {
      localStorage.setItem('tutor_bookings', JSON.stringify(updatedBookings));
    } catch (e) {}

    if (targetBooking) {
      try {
        // 1. Ensure slot is marked as booked in Supabase slots table if UUID
        if (isValidUuid(targetBooking.slot.id)) {
          await supabase
            .from('slots')
            .update({ is_booked: true })
            .eq('id', targetBooking.slot.id);
        }

        // 2. Resolve sender (teacher) and receiver (student) UUIDs
        let teacherId = currentUser?.id || targetBooking.tutorId;
        let studentId = (targetBooking as any).studentId || '';

        if (!isValidUuid(studentId)) {
          const { data: userMatches } = await supabase
            .from('users')
            .select('id, email, name')
            .or(`email.eq.${targetBooking.studentEmail},name.eq.${targetBooking.studentName}`);
          if (userMatches && userMatches.length > 0) {
            studentId = userMatches[0].id;
          }
        }

        if (!isValidUuid(teacherId) && currentUser?.email) {
          const { data: teacherMatches } = await supabase
            .from('users')
            .select('id')
            .eq('email', currentUser.email);
          if (teacherMatches && teacherMatches.length > 0) {
            teacherId = teacherMatches[0].id;
          }
        }

        // 3. Post confirmation message to Supabase messages table
        const approvalText = `🎉 *השיעור אושר על ידי המורה!*\n📌 מועד: ${targetBooking.slot.day}, שעה ${targetBooking.slot.time}\n💰 נושא: ${targetBooking.subject || 'שיעור פרטי'}\n\nהשיעור מאושר ומתוזמן! ניתן להיכנס לשיעור וידאו ישירות דרך כפתור "היכנס לשיעור וידאו" בחלון השיעורים שלי או בצ'אט.\n[STATUS_UPDATE:APPROVED:${targetBooking.id}]`;

        if (isValidUuid(teacherId) && isValidUuid(studentId)) {
          await supabase.from('messages').insert({
            sender_id: teacherId,
            receiver_id: studentId,
            text: approvalText,
            is_read: false
          });
        }

        // 4. Trigger sync
        await loadDataFromSupabase();
      } catch (err) {
        console.error('Error approving booking in Supabase:', err);
      }
    }
  };

  // 1c. Update tutor slots (Calendar/Diary)
  const handleUpdateSlots = async (tutorId: string, updatedSlots: TimeSlot[]) => {
    const targetEmail = currentUser?.email?.toLowerCase().trim();

    // 1. Update the tutor's slots in the state and local storage immediately
    const updatedTutors = tutors.map(t => {
      if (t.id === tutorId || (targetEmail && t.email && t.email.toLowerCase().trim() === targetEmail)) {
        return { ...t, availableSlots: updatedSlots };
      }
      return t;
    });
    setTutors(updatedTutors);
    saveTutors(updatedTutors);

    // Save dedicated local caches for instant resilience across page navigation
    try {
      localStorage.setItem(`tutordirect_slots_${tutorId}`, JSON.stringify(updatedSlots));
      if (targetEmail) {
        localStorage.setItem(`tutordirect_slots_${targetEmail}`, JSON.stringify(updatedSlots));
      }
    } catch (e) {}

    // Cancel any bookings that were tied to deleted slots
    const originalTutor = tutors.find(t => t.id === tutorId || (targetEmail && t.email && t.email.toLowerCase().trim() === targetEmail));
    if (originalTutor) {
      const removedSlots = (originalTutor.availableSlots || []).filter(
        origSlot => !updatedSlots.some(newSlot => newSlot.id === origSlot.id || (newSlot.day === origSlot.day && newSlot.time === origSlot.time))
      );
      
      if (removedSlots.length > 0) {
        const updatedBookings = bookings.map(b => {
          if ((b.tutorId === tutorId || (targetEmail && (b as any).tutorEmail && (b as any).tutorEmail.toLowerCase().trim() === targetEmail)) && 
              b.status !== 'בוטל' && 
              removedSlots.some(s => s.day === b.slot.day && s.time === b.slot.time)) {
            return { ...b, status: 'בוטל' as const };
          }
          return b;
        });
        saveBookings(updatedBookings);
      }
    }

    // 2. Resolve database UUID and sync to Supabase 'slots' table
    try {
      let resolvedTutorUuid = tutorId;
      if (!isValidUuid(resolvedTutorUuid)) {
        if (currentUser?.id && isValidUuid(currentUser.id)) {
          resolvedTutorUuid = currentUser.id;
        } else if (currentUser?.tutorProfileId && isValidUuid(currentUser.tutorProfileId)) {
          resolvedTutorUuid = currentUser.tutorProfileId;
        } else if (targetEmail) {
          const userUuid = await resolveUserUuid({ email: targetEmail }, false);
          if (userUuid && isValidUuid(userUuid)) {
            resolvedTutorUuid = userUuid;
          }
        }
      }

      if (isValidUuid(resolvedTutorUuid)) {
        await supabase.from('slots').delete().eq('tutor_id', resolvedTutorUuid);
        if (updatedSlots && updatedSlots.length > 0) {
          const slotsToInsert = updatedSlots.map(s => ({
            tutor_id: resolvedTutorUuid,
            datetime: dayTimeToIso(s.day, s.time),
            is_booked: Boolean(s.isBooked)
          }));
          await supabase.from('slots').insert(slotsToInsert);
        }
      }
    } catch (e) {
      console.error('Error syncing slots to Supabase:', e);
    }
  };

  // 1d. Update tutor profile (Settings: subjects, price, avatar, etc.)
  const handleUpdateTutorProfile = (tutorId: string, updatedFields: Partial<Tutor>) => {
    let specificUpdatedTutor: Tutor | undefined;
    const updatedTutors = tutors.map(t => {
      if (t.id === tutorId) {
        specificUpdatedTutor = { ...t, ...updatedFields };
        return specificUpdatedTutor;
      }
      return t;
    });

    if (specificUpdatedTutor) {
      saveTutors(updatedTutors, specificUpdatedTutor);
    } else {
      saveTutors(updatedTutors);
    }

    // If current logged-in user is this teacher and avatar changed, update currentUser
    if (updatedFields.avatarUrl && currentUser && currentUser.role === 'teacher') {
      const matchEmail = specificUpdatedTutor?.email && currentUser.email && specificUpdatedTutor.email.toLowerCase() === currentUser.email.toLowerCase();
      const matchId = currentUser.tutorProfileId === tutorId || currentUser.id === tutorId;
      if (matchEmail || matchId) {
        const updatedUser = { ...currentUser, avatarUrl: updatedFields.avatarUrl };
        setCurrentUser(updatedUser);
        localStorage.setItem('current_user', JSON.stringify(updatedUser));
      }
    }

    // If the selected tutor is currently open in the detail drawer, sync it as well
    if (selectedTutor && selectedTutor.id === tutorId) {
      setSelectedTutor(prev => prev ? { ...prev, ...updatedFields } : null);
    }
  };

  // 2. Submit a lesson booking
  const handleBookLesson = async (
    tutorId: string, 
    slot: TimeSlot, 
    studentName: string, 
    studentEmail: string, 
    note: string
  ) => {
    const tutorToBook = tutors.find(t => t.id === tutorId);
    const tutorName = tutorToBook?.name || 'מורה פרטי';
    const tutorEmail = tutorToBook?.email || '';
    const subject = tutorToBook?.subject || 'שיעור פרטי';

    // Create the booking record
    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
      tutorId,
      tutorName,
      tutorEmail,
      studentName: studentName || currentUser?.name || 'תלמיד',
      studentEmail: studentEmail || currentUser?.email || '',
      studentId: currentUser && isValidUuid(currentUser.id) ? currentUser.id : undefined,
      subject,
      slot: { ...slot, isBooked: true },
      note,
      createdAt: new Date().toLocaleDateString('he-IL'),
      status: 'ממתין'
    };

    // Save Booking in React state & local storage - removing any stale cancelled booking for the same slot
    const filteredExistingBookings = bookings.filter(b => {
      const isSameTutor = b.tutorId === tutorId || (tutorEmail && b.tutorEmail && b.tutorEmail.toLowerCase() === tutorEmail.toLowerCase());
      const isThisSlot = (b.slot?.id && slot.id && b.slot.id === slot.id) || isSameSlot(b.slot, slot);
      if (isSameTutor && isThisSlot && b.status === 'בוטל') {
        return false;
      }
      return true;
    });
    const updatedBookings = deduplicateBookings([newBooking, ...filteredExistingBookings]);
    setBookings(updatedBookings);
    try {
      localStorage.setItem('tutor_bookings', JSON.stringify(updatedBookings));
    } catch (e) {}

    // Update the tutor's specific slot to be marked as booked in local state
    const updatedTutors = tutors.map(t => {
      if (t.id === tutorId) {
        return {
          ...t,
          availableSlots: t.availableSlots.map(s => {
            if (s.id === slot.id || (s.day === slot.day && s.time === slot.time)) {
              return { ...s, isBooked: true };
            }
            return s;
          })
        };
      }
      return t;
    });
    setTutors(updatedTutors);
    try {
      const sanitizedTutors = updatedTutors.map(({ studyMaterials, ...rest }) => rest);
      localStorage.setItem('private_tutors', JSON.stringify(sanitizedTutors));
    } catch (e) {}

    // Update active details overlay if currently opened
    if (selectedTutor && selectedTutor.id === tutorId) {
      setSelectedTutor(prev => {
        if (!prev) return null;
        return {
          ...prev,
          availableSlots: prev.availableSlots.map(s => {
            if (s.id === slot.id || (s.day === slot.day && s.time === slot.time)) {
              return { ...s, isBooked: true };
            }
            return s;
          })
        };
      });
    }

    // Persist to Supabase 'slots' table so the teacher on another machine sees it instantly
    try {
      let studentUuid = currentUser && isValidUuid(currentUser.id) ? currentUser.id : null;
      if (!studentUuid && studentEmail) {
        const { data: foundUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', studentEmail.toLowerCase())
          .maybeSingle();
        if (foundUser?.id) {
          studentUuid = foundUser.id;
        } else {
          const { data: newUser } = await supabase
            .from('users')
            .upsert({
              name: studentName || 'תלמיד',
              email: studentEmail.toLowerCase(),
              role: 'student'
            })
            .select('id')
            .maybeSingle();
          if (newUser?.id) studentUuid = newUser.id;
        }
      }

      let targetTutorUuid = isValidUuid(tutorId) ? tutorId : null;
      if (!targetTutorUuid && tutorEmail) {
        const { data: foundTutor } = await supabase
          .from('users')
          .select('id')
          .eq('email', tutorEmail.toLowerCase())
          .maybeSingle();
        if (foundTutor?.id) targetTutorUuid = foundTutor.id;
      }

      if (targetTutorUuid) {
        const iso = dayTimeToIso(slot.day, slot.time);
        let slotUpdated = false;

        const slotBookPayload = {
          is_booked: true,
          student_id: studentUuid
        };

        if (isValidUuid(slot.id)) {
          const { data: updated } = await supabase
            .from('slots')
            .update(slotBookPayload)
            .eq('id', slot.id)
            .select();
          if (updated && updated.length > 0) {
            slotUpdated = true;
          }
        }

        if (!slotUpdated) {
          const { data: existingSlot } = await supabase
            .from('slots')
            .select('id')
            .eq('tutor_id', targetTutorUuid)
            .eq('datetime', iso)
            .maybeSingle();

          if (existingSlot?.id) {
            await supabase
              .from('slots')
              .update(slotBookPayload)
              .eq('id', existingSlot.id);
          } else {
            await supabase
              .from('slots')
              .insert({
                tutor_id: targetTutorUuid,
                datetime: iso,
                is_booked: true,
                student_id: studentUuid
              });
          }
        }
      }

      // Also send an automated notification message to the tutor so they receive real-time notification
      if (studentUuid && targetTutorUuid && studentUuid !== targetTutorUuid) {
        try {
          await supabase.from('messages').insert({
            sender_id: studentUuid,
            receiver_id: targetTutorUuid,
            text: `📅 *תואם שיעור חדש!*
👤 תלמיד: ${studentName || 'תלמיד'}
📧 אימייל: ${studentEmail}
📌 מועד: ${slot.day}, שעה ${slot.time}
${note ? `📝 נושא / הערה: ${note}\n` : ''}[STATUS_UPDATE:NEW_BOOKING:${newBooking.id}]`,
            is_read: false
          });
        } catch (msgErr) {
          console.error('Error sending booking notification message:', msgErr);
        }
      }

      await loadDataFromSupabase();
    } catch (err) {
      console.error('Failed to sync booked slot to Supabase:', err);
    }
  };

  // 3. Cancel a Booking
  const handleCancelBooking = async (bookingId: string) => {
    const targetBooking = bookings.find(b => b.id === bookingId);
    if (!targetBooking) return;

    // Update booking status to 'בוטל'
    const updatedBookings = deduplicateBookings(bookings.map(b => {
      if (b.id === bookingId || (targetBooking && isSameSlot(b.slot, targetBooking.slot))) {
        return { ...b, status: 'בוטל' as const };
      }
      return b;
    }));
    setBookings(updatedBookings);
    try {
      localStorage.setItem('tutor_bookings', JSON.stringify(updatedBookings));
    } catch (e) {}

    // Release the tutor's slot so other students can book it
    const updatedTutors = tutors.map(t => {
      if (t.id === targetBooking.tutorId) {
        return {
          ...t,
          availableSlots: t.availableSlots.map(s => {
            if (s.day === targetBooking.slot.day && s.time === targetBooking.slot.time) {
              return { ...s, isBooked: false };
            }
            return s;
          })
        };
      }
      return t;
    });
    setTutors(updatedTutors);
    try {
      const sanitizedTutors = updatedTutors.map(({ studyMaterials, ...rest }) => rest);
      localStorage.setItem('private_tutors', JSON.stringify(sanitizedTutors));
    } catch (e) {}

    // Update active details overlay if currently opened
    if (selectedTutor && selectedTutor.id === targetBooking.tutorId) {
      setSelectedTutor(prev => {
        if (!prev) return null;
        return {
          ...prev,
          availableSlots: prev.availableSlots.map(s => {
            if (s.day === targetBooking.slot.day && s.time === targetBooking.slot.time) {
              return { ...s, isBooked: false };
            }
            return s;
          })
        };
      });
    }

    // Release slot in Supabase and notify participant
    try {
      let targetTutorUuid = isValidUuid(targetBooking.tutorId) ? targetBooking.tutorId : null;
      if (!targetTutorUuid && targetBooking.tutorEmail) {
        const { data: tutorMatches } = await supabase
          .from('users')
          .select('id')
          .ilike('email', targetBooking.tutorEmail.trim().toLowerCase())
          .maybeSingle();
        if (tutorMatches?.id) targetTutorUuid = tutorMatches.id;
      }
      if (!targetTutorUuid && targetBooking.tutorName && targetBooking.tutorName !== 'מורה פרטי') {
        const { data: tutorMatchesByName } = await supabase
          .from('users')
          .select('id')
          .ilike('name', targetBooking.tutorName.trim())
          .maybeSingle();
        if (tutorMatchesByName?.id) targetTutorUuid = tutorMatchesByName.id;
      }
      if (!targetTutorUuid && currentUser?.role === 'teacher' && isValidUuid(currentUser.id)) {
        targetTutorUuid = currentUser.id;
      }

      let studentUuid = (currentUser?.role === 'student' && isValidUuid(currentUser.id))
        ? currentUser.id
        : ((targetBooking as any).studentId && isValidUuid((targetBooking as any).studentId) ? (targetBooking as any).studentId : null);

      if (!studentUuid && targetBooking.studentEmail) {
        const { data: userMatches } = await supabase
          .from('users')
          .select('id')
          .ilike('email', targetBooking.studentEmail.trim().toLowerCase())
          .maybeSingle();
        if (userMatches?.id) studentUuid = userMatches.id;
      }
      if (!studentUuid && targetBooking.studentName && targetBooking.studentName !== 'תלמיד') {
        const { data: userMatchesByName } = await supabase
          .from('users')
          .select('id')
          .ilike('name', targetBooking.studentName.trim())
          .maybeSingle();
        if (userMatchesByName?.id) studentUuid = userMatchesByName.id;
      }

      const slotCancelPayload = {
        is_booked: false,
        student_id: null
      };

      if (isValidUuid(targetBooking.slot.id)) {
        const { data, error } = await supabase
          .from('slots')
          .update(slotCancelPayload)
          .eq('id', targetBooking.slot.id);

        if (error) {
          console.error("Error cancelling slot in Supabase:", error);
          alert("שגיאה בביטול השיעור במסד הנתונים: " + error.message);
          return;
        }
      }
      if (targetTutorUuid) {
        const iso = dayTimeToIso(targetBooking.slot.day, targetBooking.slot.time);
        await supabase
          .from('slots')
          .update(slotCancelPayload)
          .eq('tutor_id', targetTutorUuid)
          .eq('datetime', iso);
      }

      // Update bookings table status in Supabase if table exists
      try {
        await supabase
          .from('bookings')
          .update({ status: 'cancelled' })
          .eq('id', targetBooking.id);
      } catch (be) {}

      const senderId = currentUser?.id && isValidUuid(currentUser.id) 
        ? currentUser.id 
        : (currentUser?.role === 'teacher' ? targetTutorUuid : studentUuid);
      const receiverId = senderId === targetTutorUuid ? studentUuid : targetTutorUuid;

      if (senderId && receiverId && isValidUuid(senderId) && isValidUuid(receiverId) && senderId !== receiverId) {
        await supabase.from('messages').insert({
          sender_id: senderId,
          receiver_id: receiverId,
          text: `❌ *השיעור בוטל*\n📌 מועד: ${targetBooking.slot.day}, שעה ${targetBooking.slot.time}\n👤 תלמיד: ${targetBooking.studentName || 'תלמיד'}\n✉️ אימייל: ${targetBooking.studentEmail}\n\nהשיעור בוטל במערכת והמועד התפנה ביומן.\n[STATUS_UPDATE:CANCELLED:${targetBooking.id}]`,
          is_read: false
        });
      }

      await loadDataFromSupabase();
    } catch (err) {
      console.error('Error releasing slot in Supabase:', err);
    }
  };

  // 3c. Confirm Lesson Occurrence (Mutual Confirmation by Student & Teacher)
  const handleConfirmLessonOccurrence = async (bookingId: string, role?: 'student' | 'teacher') => {
    const targetBooking = bookings.find(b => b.id === bookingId);
    if (!targetBooking) return;

    const userRole = role || currentUser?.role || 'student';
    const isStudent = userRole === 'student';
    const isTeacher = userRole === 'teacher';

    const newStudentConfirmed = isStudent ? true : Boolean(targetBooking.studentConfirmed);
    const newTeacherConfirmed = isTeacher ? true : Boolean(targetBooking.teacherConfirmed);
    const bothConfirmed = newStudentConfirmed && newTeacherConfirmed;

    const newStatus = bothConfirmed ? ('הושלם' as const) : (targetBooking.status === 'הושלם' ? 'הושלם' : targetBooking.status);

    const updatedBookings = deduplicateBookings(bookings.map(b => {
      if (b.id === bookingId || isSameSlot(b.slot, targetBooking.slot)) {
        return {
          ...b,
          studentConfirmed: newStudentConfirmed,
          teacherConfirmed: newTeacherConfirmed,
          status: newStatus
        };
      }
      return b;
    }));
    setBookings(updatedBookings);
    try {
      localStorage.setItem('tutor_bookings', JSON.stringify(updatedBookings));
    } catch (e) {}

    try {
      let teacherId = currentUser?.id || targetBooking.tutorId;
      let studentId = (targetBooking as any).studentId || '';

      if (!isValidUuid(studentId)) {
        const { data: userMatches } = await supabase
          .from('users')
          .select('id, email, name')
          .or(`email.eq.${targetBooking.studentEmail},name.eq.${targetBooking.studentName}`);
        if (userMatches && userMatches.length > 0) {
          studentId = userMatches[0].id;
        }
      }

      if (!isValidUuid(teacherId) && currentUser?.email) {
        const { data: teacherMatches } = await supabase
          .from('users')
          .select('id')
          .eq('email', currentUser.email);
        if (teacherMatches && teacherMatches.length > 0) {
          teacherId = teacherMatches[0].id;
        }
      }

      const senderId = currentUser?.id && isValidUuid(currentUser.id) 
        ? currentUser.id 
        : (userRole === 'teacher' ? teacherId : studentId);
      const receiverId = senderId === teacherId ? studentId : teacherId;

      if (isValidUuid(senderId) && isValidUuid(receiverId)) {
        if (bothConfirmed) {
          await supabase.from('messages').insert({
            sender_id: senderId,
            receiver_id: receiverId,
            text: `🏅 *השיעור סומן כהתקיים בהצלחה!*\n📌 מועד: ${targetBooking.slot.day}, שעה ${targetBooking.slot.time}\n\nהשיעור אושר על ידי שני הצדדים (התלמיד והמורה).\n[STATUS_UPDATE:COMPLETED:${targetBooking.id}]`,
            is_read: false
          });
        } else if (isStudent) {
          await supabase.from('messages').insert({
            sender_id: senderId,
            receiver_id: receiverId,
            text: `👍 *התלמיד אישר שהשיעור התקיים!*\n📌 מועד: ${targetBooking.slot.day}, שעה ${targetBooking.slot.time}\n\nממתין לאישור המורה להשלמת השיעור.\n[STATUS_UPDATE:STUDENT_CONFIRMED:${targetBooking.id}]`,
            is_read: false
          });
        } else if (isTeacher) {
          await supabase.from('messages').insert({
            sender_id: senderId,
            receiver_id: receiverId,
            text: `👍 *המורה אישר שהשיעור התקיים!*\n📌 מועד: ${targetBooking.slot.day}, שעה ${targetBooking.slot.time}\n\nממתין לאישור התלמיד להשלמת השיעור.\n[STATUS_UPDATE:TEACHER_CONFIRMED:${targetBooking.id}]`,
            is_read: false
          });
        }
      }

      await loadDataFromSupabase();
    } catch (err) {
      console.error('Error confirming lesson occurrence in Supabase:', err);
    }
  };

  // Backwards compatible complete handler
  const handleCompleteBooking = async (bookingId: string) => {
    await handleConfirmLessonOccurrence(bookingId);
  };

  // 4. Add or Update a Review for a Tutor
  const handleAddReview = async (tutorId: string, rawReview: Omit<Review, 'id' | 'date'>) => {
    if (currentUser?.role === 'teacher') {
      console.warn('Teachers are not allowed to submit reviews for tutors');
      return;
    }

    const cleanTutorId = (tutorId || '').trim().toLowerCase();
    const targetTutor = tutors.find(t => 
      t.id === tutorId || 
      t.id.toLowerCase() === cleanTutorId ||
      (t.email && t.email.toLowerCase() === cleanTutorId) ||
      (t.name && t.name.toLowerCase() === cleanTutorId)
    );
    if (!targetTutor) return;

    const existingReviews = targetTutor.reviews || [];
    
    // Check if student already submitted a review for this tutor
    const existingIndex = existingReviews.findIndex(
      r => r.reviewerEmail && rawReview.reviewerEmail && r.reviewerEmail.toLowerCase() === rawReview.reviewerEmail.toLowerCase()
    );

    let updatedReviews: Review[];
    let newReview: Review;

    if (existingIndex >= 0) {
      newReview = {
        ...existingReviews[existingIndex],
        ...rawReview,
        date: new Date().toISOString().split('T')[0]
      };
      updatedReviews = existingReviews.map((r, i) => i === existingIndex ? newReview : r);
    } else {
      newReview = {
        ...rawReview,
        id: `review-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        date: new Date().toISOString().split('T')[0]
      };
      updatedReviews = [newReview, ...existingReviews];
    }
    
    // Calculate new average rating
    const totalRating = updatedReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
    const newAverageRating = Number((totalRating / updatedReviews.length).toFixed(1));

    const updatedTutor: Tutor = {
      ...targetTutor,
      reviews: updatedReviews,
      rating: newAverageRating
    };

    const updatedTutors = tutors.map(t => {
      if (t.id === targetTutor.id) {
        return updatedTutor;
      }
      return t;
    });

    setTutors(updatedTutors);
    try {
      const sanitizedTutors = updatedTutors.map(({ studyMaterials, ...rest }) => rest);
      localStorage.setItem('private_tutors', JSON.stringify(sanitizedTutors));
    } catch (e) {}

    // Save standalone reviews map to localStorage under targetTutor.id, email, and name
    try {
      let allReviewsMap: Record<string, Review[]> = {};
      const rawMap = localStorage.getItem('tutordirect_all_reviews');
      if (rawMap) allReviewsMap = JSON.parse(rawMap);

      allReviewsMap[targetTutor.id] = updatedReviews;
      if (targetTutor.id) {
        allReviewsMap[targetTutor.id.toLowerCase()] = updatedReviews;
      }
      if (targetTutor.email) {
        allReviewsMap[targetTutor.email.toLowerCase()] = updatedReviews;
      }
      if (targetTutor.name) {
        allReviewsMap[targetTutor.name.trim().toLowerCase()] = updatedReviews;
      }
      localStorage.setItem('tutordirect_all_reviews', JSON.stringify(allReviewsMap));
    } catch (e) {}

    // Sync active view drawer state immediately
    if (selectedTutor && (
      selectedTutor.id === targetTutor.id || 
      (selectedTutor.email && targetTutor.email && selectedTutor.email.toLowerCase() === targetTutor.email.toLowerCase()) ||
      (selectedTutor.name && targetTutor.name && selectedTutor.name.toLowerCase() === targetTutor.name.toLowerCase())
    )) {
      setSelectedTutor(updatedTutor);
    }

    // Sync tutorToChatWith state if open
    if (tutorToChatWith && (
      tutorToChatWith.id === targetTutor.id ||
      (tutorToChatWith.email && targetTutor.email && tutorToChatWith.email.toLowerCase() === targetTutor.email.toLowerCase())
    )) {
      setTutorToChatWith(updatedTutor);
    }

    // Persist rating & review to Supabase
    try {
      if (isValidUuid(targetTutor.id)) {
        await supabase
          .from('tutors')
          .update({ rating: newAverageRating })
          .eq('id', targetTutor.id);
      }

      // Try inserting into Supabase reviews table (if available)
      let tutorUuid = isValidUuid(targetTutor.id) ? targetTutor.id : null;
      if (!tutorUuid && targetTutor.email) {
        const { data: uMatch } = await supabase.from('users').select('id').eq('email', targetTutor.email.toLowerCase()).maybeSingle();
        if (uMatch?.id) tutorUuid = uMatch.id;
      }

      let studentUuid = currentUser && isValidUuid(currentUser.id) ? currentUser.id : null;
      if (!studentUuid && rawReview.reviewerEmail) {
        const { data: sMatch } = await supabase.from('users').select('id').eq('email', rawReview.reviewerEmail.toLowerCase()).maybeSingle();
        if (sMatch?.id) studentUuid = sMatch.id;
      }

      if (tutorUuid) {
        try {
          await supabase.from('reviews').insert([{
            tutor_id: tutorUuid,
            reviewer_id: studentUuid,
            reviewer_name: newReview.reviewerName,
            rating: newReview.rating,
            comment: newReview.comment
          }]);
        } catch (rErr) {}
      }

      // Broadcast to messages so all devices and live tabs update seamlessly in real time
      if (tutorUuid && studentUuid) {
        try {
          await supabase.from('messages').insert({
            sender_id: studentUuid,
            receiver_id: tutorUuid,
            text: `⭐ *חוות דעת חדשה נכתבה!*\n📌 דירוג: ${newReview.rating} כוכבים\n💬 "${newReview.comment}"\n[REVIEW_LOG:${targetTutor.id}:${newReview.rating}:${encodeURIComponent(newReview.comment)}:${encodeURIComponent(newReview.reviewerName)}:${encodeURIComponent(newReview.reviewerEmail || '')}]`,
            is_read: false
          });
        } catch (mErr) {}
      }
    } catch (err) {
      console.error('Error updating tutor review in Supabase:', err);
    }
  };

  // --- Favorites Handler ---
  const handleToggleFavorite = (tutorId: string) => {
    setFavorites(prev => {
      const isFav = prev.includes(tutorId);
      const updated = isFav ? prev.filter(id => id !== tutorId) : [...prev, tutorId];
      const storageKey = `tutordirect_favorites_${currentUser?.email ? currentUser.email.toLowerCase() : 'guest'}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save favorites to localStorage:', e);
      }
      return updated;
    });
  };

  // --- Filter and Sort Logic ---
  const filteredTutors = useMemo(() => {
    return tutors
      .filter(tutor => {
        // Wishlist / Favorites Filter
        if (showOnlyFavorites && !favorites.includes(tutor.id)) {
          return false;
        }

        // Name / Bio / Subject Match
        const matchSearch = 
          tutor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tutor.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tutor.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          translateSubjectList(tutor.subject, 'en').toLowerCase().includes(searchQuery.toLowerCase()) ||
          translateSubjectList(tutor.subject, 'he').toLowerCase().includes(searchQuery.toLowerCase());
        
        // Subject match (handles Hebrew and English subject matching)
        const normSelectedSubject = translateSubject(selectedSubject, 'he');
        const matchSubject = !selectedSubject || selectedSubject === 'כל המקצועות' || selectedSubject === t.allSubjects ||
          tutor.subject.split(',').some(s => {
            const normTutorSubj = translateSubject(s.trim(), 'he');
            return normTutorSubj === normSelectedSubject;
          });

        // Free-text subject search match (handles English & Hebrew)
        const searchSubjLower = subjectSearchQuery.trim().toLowerCase();
        const matchSubjectSearch = !searchSubjLower ||
          tutor.subject.toLowerCase().includes(searchSubjLower) ||
          translateSubjectList(tutor.subject, 'en').toLowerCase().includes(searchSubjLower) ||
          translateSubjectList(tutor.subject, 'he').toLowerCase().includes(searchSubjLower);

        // Level match (Class/Grade level)
        const normSelectedLevel = translateLevel(selectedLevel, 'he');
        const matchLevel = !selectedLevel || selectedLevel === 'כל הרמות' || selectedLevel === t.allLevels ||
          (tutor.levels && tutor.levels.split(',').some(l => translateLevel(l.trim(), 'he') === normSelectedLevel));

        // Price limit
        const matchPrice = tutor.price <= maxPrice;

        // Min rating calculated dynamically
        const tutorRating = calculateTutorRating(tutor);
        const matchRating = tutorRating >= minRating;

        return matchSearch && matchSubject && matchSubjectSearch && matchLevel && matchPrice && matchRating;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') {
          return calculateTutorRating(b) - calculateTutorRating(a);
        }
        if (sortBy === 'price_asc') {
          return a.price - b.price;
        }
        if (sortBy === 'price_desc') {
          return b.price - a.price;
        }
        if (sortBy === 'reviews_count') {
          return b.reviews.length - a.reviews.length;
        }
        return 0;
      });
  }, [tutors, searchQuery, selectedSubject, subjectSearchQuery, selectedLevel, maxPrice, minRating, sortBy, showOnlyFavorites, favorites, t]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedSubject('כל המקצועות');
    setSubjectSearchQuery('');
    setSelectedLevel('כל הרמות');
    setMaxPrice(1000);
    setMinRating(0);
    setSortBy('rating');
    setShowOnlyFavorites(false);
  };

  const activeBookingsCount = useMemo(() => {
    if (!currentUser) return 0;
    if (currentUser.role === 'teacher') {
      const curId = currentUser.id?.toLowerCase();
      const curProfileId = currentUser.tutorProfileId?.toLowerCase();
      const curEmail = currentUser.email?.trim().toLowerCase();
      const curName = currentUser.name?.trim().toLowerCase();

      return bookings.filter(b => {
        if (b.status !== 'ממתין') return false;
        const bTutorId = b.tutorId?.toLowerCase();
        const bTutorEmail = (b as any).tutorEmail?.trim().toLowerCase();
        const bTutorName = b.tutorName?.trim().toLowerCase();

        return Boolean(
          (curId && (bTutorId === curId || bTutorId?.includes(curId))) ||
          (curProfileId && (bTutorId === curProfileId || (b as any).tutorProfileId === curProfileId)) ||
          (curEmail && (bTutorEmail === curEmail || bTutorId === curEmail)) ||
          (curName && bTutorName && (bTutorName === curName || bTutorName.includes(curName) || curName.includes(bTutorName)))
        );
      }).length;
    } else {
      const curId = currentUser.id?.toLowerCase();
      const curEmail = currentUser.email?.trim().toLowerCase();
      const curName = currentUser.name?.trim().toLowerCase();

      return bookings.filter(b => {
        if (b.status !== 'ממתין' && b.status !== 'מאושר') return false;
        const bStudentId = (b as any).studentId?.toLowerCase() || '';
        const bStudentEmail = b.studentEmail?.trim().toLowerCase() || '';
        const bStudentName = b.studentName?.trim().toLowerCase() || '';

        return Boolean(
          (curEmail && (bStudentEmail === curEmail || bStudentId === curEmail)) ||
          (curId && (bStudentId === curId || bStudentEmail === curId || b.id.includes(curId))) ||
          (curName && bStudentName && (bStudentName === curName || bStudentName.includes(curName) || curName.includes(bStudentName)))
        );
      }).length;
    }
  }, [bookings, currentUser]);

  // Dynamic system average rating computed from all tutors
  const systemAverageRating = useMemo(() => {
    if (!tutors || tutors.length === 0) return 5.0;
    const validRatings = tutors.map(t => t.rating).filter(r => typeof r === 'number' && !isNaN(r));
    if (validRatings.length === 0) return 5.0;
    const avg = validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length;
    return Number(avg.toFixed(1));
  }, [tutors]);

  // Get matching tutor profile for current logged in teacher user
  const currentUserTutorProfile = useMemo(() => {
    if (!currentUser || currentUser.role !== 'teacher') return null;
    return tutors.find(t => t.id === currentUser.tutorProfileId || t.email.toLowerCase() === currentUser.email.toLowerCase()) || null;
  }, [tutors, currentUser]);

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    localStorage.setItem('app_language', newLang);
    if (currentUser) {
      const updated = { ...currentUser, language: newLang };
      setCurrentUser(updated);
      localStorage.setItem('current_user', JSON.stringify(updated));
    }
  };

  if (!currentUser || isRecoveryFlow) {
    return (
      <AuthScreen 
        onLogin={handleLogin} 
        existingTutors={tutors} 
        onRegisterTutor={handleRegisterTutor} 
        initialMode={isRecoveryFlow ? 'forgot_password' : 'login'}
        initialResetStep={isRecoveryFlow ? 'new_password' : 'email'}
        recoveryUserEmail={recoveryEmail}
        onResetSuccess={() => {
          setIsRecoveryFlow(false);
        }}
      />
    );
  }

  // Count active filters
  const activeFiltersCount = (
    (selectedSubject !== 'כל המקצועות' || subjectSearchQuery.trim() !== '' ? 1 : 0) +
    (selectedLevel !== 'כל הרמות' ? 1 : 0) +
    (maxPrice < 1000 ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (sortBy !== 'rating' ? 1 : 0)
  );

  const renderFiltersContent = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2 uppercase tracking-wider">
          <SlidersHorizontal className="w-4.5 h-4.5 text-slate-400" />
          <span>{t.filterBy}</span>
          {activeFiltersCount > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </h2>
        
        <button
          id="reset-filters-btn"
          onClick={resetFilters}
          className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 hover:underline transition-colors cursor-pointer font-bold"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t.clearFilters}</span>
        </button>
      </div>

      {/* Subject Select */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 block">{language === 'he' ? 'מקצוע לימוד' : 'Subject'}</label>
        
        {/* Free-text Subject Search */}
        <div className="relative">
          <input
            type="text"
            id="subject-search-input"
            placeholder={language === 'he' ? 'הקלד שם מקצוע (למשל: פיזיקה, אנגלית...)' : 'Type subject name (e.g., Math, Physics)...'}
            value={subjectSearchQuery}
            onChange={(e) => {
              setSubjectSearchQuery(e.target.value);
              if (e.target.value.trim() !== '') {
                setSelectedSubject('כל המקצועות');
              }
            }}
            className={`w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white text-slate-800 font-medium ${isRtl ? 'text-right' : 'text-left'}`}
            dir={isRtl ? 'rtl' : 'ltr'}
          />
          {subjectSearchQuery && (
            <button
              type="button"
              onClick={() => setSubjectSearchQuery('')}
              className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold w-5 h-5 flex items-center justify-center cursor-pointer ${isRtl ? 'left-2.5' : 'right-2.5'}`}
              title="Clear"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            id="subject-pill-all"
            onClick={() => {
              setSelectedSubject('כל המקצועות');
              setSubjectSearchQuery('');
            }}
            className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
              (selectedSubject === 'כל המקצועות' || selectedSubject === t.allSubjects) && !subjectSearchQuery
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
            }`}
          >
            {t.allSubjects}
          </button>
          {SUBJECTS_LIST.map((subj) => (
            <button
              key={subj}
              id={`subject-pill-${subj}`}
              onClick={() => {
                setSelectedSubject(subj);
                setSubjectSearchQuery('');
              }}
              className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
                selectedSubject === subj || translateSubject(selectedSubject, 'he') === translateSubject(subj, 'he')
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              {translateSubject(subj, language)}
            </button>
          ))}
        </div>
      </div>

      {/* Level Select (Class/Grade level) */}
      <div className="space-y-2 pt-3 border-t border-slate-100">
        <label className="text-xs font-bold text-slate-700 block">{language === 'he' ? 'כיתה / רמת לימוד' : 'Class / Grade Level'}</label>
        <select
          value={selectedLevel}
          id="level-select-dropdown"
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white text-slate-700 font-medium"
        >
          <option value="כל הרמות">{t.allLevels}</option>
          {AVAILABLE_LEVELS.map((level) => (
            <option key={level} value={level}>{translateLevel(level, language)}</option>
          ))}
        </select>
      </div>

      {/* Price Slider */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <div className="flex justify-between items-baseline">
          <label className="text-xs font-bold text-slate-700">{t.maxPrice}</label>
          <span className="text-sm font-bold text-indigo-600">{maxPrice} ₪</span>
        </div>
        <input
          type="range"
          id="price-range-slider"
          min="80"
          max="1000"
          step="10"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
          <span>80 ₪</span>
          <span>500 ₪</span>
          <span>1000 ₪</span>
        </div>
      </div>

      {/* Min Rating selector */}
      <div className="space-y-2 pt-3 border-t border-slate-100">
        <label className="text-xs font-bold text-slate-700 block">{t.minRating}</label>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 3, 4, 4.5].map((stars) => (
            <button
              key={stars}
              id={`rating-filter-btn-${stars}`}
              onClick={() => setMinRating(stars)}
              className={`py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer flex flex-col items-center justify-center ${
                minRating === stars
                  ? 'bg-indigo-600 border-indigo-600 text-white font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{stars === 0 ? (language === 'he' ? 'הכל' : 'All') : `${stars}+`}</span>
              {stars > 0 && <Star className={`w-3 h-3 mt-0.5 ${minRating === stars ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />}
            </button>
          ))}
        </div>
      </div>

      {/* Sort selector */}
      <div className="space-y-2 pt-3 border-t border-slate-100">
        <label className="text-xs font-bold text-slate-700 block">{t.sortBy}</label>
        <select
          value={sortBy}
          id="sort-select-dropdown"
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white text-slate-700 font-medium"
        >
          <option value="rating">{t.sortRating}</option>
          <option value="price_asc">{t.sortPriceLow}</option>
          <option value="price_desc">{t.sortPriceHigh}</option>
          <option value="reviews_count">{language === 'he' ? 'מספר חוות דעת' : 'Most Reviews'}</option>
        </select>
      </div>

      {/* AI Consultant Helper Box */}
      {currentUser?.role === 'student' ? (
        <div className="p-4 bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-lg space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-200 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">{language === 'he' ? 'היועץ החכם שלכם ב-AI' : 'AI Academic Advisor'}</h4>
              <p className="text-[9px] text-indigo-600 font-bold">{language === 'he' ? 'זמין כעת להתייעצות' : 'Ready to help'}</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
            {language === 'he' 
              ? 'רוצים לדעת איזה מורה הכי מתאים עבורכם? צריכים טיפים להכנה לשיעור או בניית תוכנית לימודים אישית? לחצו על הכפתור והתחילו להתייעץ!' 
              : 'Looking for the best tutor match? Need study tips or personalized exam prep guidance? Click below to chat with your AI advisor!'}
          </p>
          <button
            type="button"
            onClick={() => {
              setIsAiConsultantOpen(true);
              setIsMobileFilterOpen(false);
            }}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.aiConsultant}</span>
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-indigo-600 selection:text-white pb-20 md:pb-10" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Recovery Banner */}
      {isRecoveryFlow && (
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold shadow-md z-40 sticky top-0">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-300 animate-bounce shrink-0" />
            <span>
              {language === 'he'
                ? 'זוהה קישור לאיפוס סיסמה! לחץ כאן להגדרת סיסמה חדשה לחשבונך.'
                : 'Password recovery link detected! Click here to set a new password for your account.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsResetPasswordModalOpen(true)}
              className="px-3 py-1 bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
            >
              {language === 'he' ? 'שנה סיסמה כעת' : 'Change Password Now'}
            </button>
            <button
              onClick={() => {
                setIsRecoveryFlow(false);
                if (typeof window !== 'undefined' && window.history?.replaceState) {
                  window.history.replaceState({}, document.title, window.location.pathname);
                }
              }}
              className="p-1 text-white/80 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
              title={language === 'he' ? 'סגור התראה' : 'Dismiss'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Banner & Header */}
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center shadow-2xs">
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Logo & Headline */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <TutorDirectLogo 
              language={language} 
              subtitle={t.appSubtitle} 
              className="w-8 h-8 sm:w-10 sm:h-10 shrink-0"
            />
          </div>

          {/* Desktop & Tablet CTAs */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
            {/* Quick Language Toggle Button in Header */}
            <button
              id="header-language-toggle-btn"
              onClick={() => handleLanguageChange(language === 'he' ? 'en' : 'he')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-slate-200 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50/50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title={language === 'he' ? 'Switch to English' : 'החלף לעברית'}
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>{language === 'he' ? 'English' : 'עברית'}</span>
            </button>

            <button
              onClick={() => setIsUserProfileOpen(true)}
              className="text-xs text-slate-600 hover:text-indigo-600 font-bold flex items-center gap-1.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 px-2.5 sm:px-3 py-1.5 rounded-full transition-all duration-200 shadow-2xs cursor-pointer"
              title={t.myProfile}
            >
              {currentUser.avatarUrl ? (
                currentUser.avatarUrl.startsWith('preset:') ? (
                  (() => {
                    const parts = currentUser.avatarUrl.split(':');
                    const emoji = parts[1] || '👨‍🏫';
                    const bg = parts[2] || 'from-indigo-500 to-purple-600';
                    return (
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${bg} flex items-center justify-center text-sm shadow-2xs shrink-0`}>
                        {emoji}
                      </div>
                    );
                  })()
                ) : (
                  <img
                    src={currentUser.avatarUrl}
                    alt="avatar"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                  />
                )
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center text-[10px] font-extrabold uppercase shrink-0">
                  {currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('') : 'U'}
                </div>
              )}
              <span className="hidden xl:inline">
                {t.welcomeUser}, <span className="underline decoration-indigo-300 underline-offset-2">{currentUser.name}</span> <span className="text-indigo-600 font-semibold">({currentUser.role === 'student' ? (language === 'he' ? 'תלמיד' : 'Student') : (language === 'he' ? 'מורה' : 'Tutor')})</span>
              </span>
              <span className="hidden md:inline xl:hidden max-w-[90px] truncate">
                {currentUser.name}
              </span>
            </button>

            {currentUser.role === 'teacher' && currentUserTutorProfile && (
              <>
                <button
                  id="teacher-settings-btn"
                  onClick={() => setIsTeacherSettingsOpen(true)}
                  className="relative border border-slate-200 hover:border-indigo-300 text-slate-700 hover:bg-indigo-50/30 bg-white px-2.5 sm:px-3 py-1.5 rounded font-bold text-xs transition-all duration-200 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="hidden lg:inline">{language === 'he' ? 'הגדרות' : 'Settings'}</span>
                </button>

                <button
                  id="manage-slots-btn"
                  onClick={() => setIsManageSlotsOpen(true)}
                  className="relative border border-slate-200 hover:border-indigo-300 text-slate-700 hover:bg-indigo-50/30 bg-white px-2.5 sm:px-3 py-1.5 rounded font-bold text-xs transition-all duration-200 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="hidden lg:inline">{language === 'he' ? 'יומן שעות' : 'Schedule'}</span>
                </button>
              </>
            )}
            
            {/* Favorites / Wishlist Button */}
            {currentUser?.role === 'student' && (
              <button
                id="header-favorites-btn"
                onClick={() => setShowOnlyFavorites(prev => !prev)}
                className={`relative px-2.5 sm:px-3 py-1.5 rounded font-bold text-xs transition-all duration-200 flex items-center gap-1.5 shadow-xs cursor-pointer ${
                  showOnlyFavorites
                    ? 'bg-rose-50 border-2 border-rose-400 text-rose-700 shadow-sm'
                    : 'border border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 text-slate-600 bg-white'
                }`}
                title={showOnlyFavorites ? t.allTutors : t.myFavorites}
              >
                <Heart className={`w-4 h-4 transition-transform duration-200 ${showOnlyFavorites ? 'fill-rose-500 text-rose-500 scale-110' : 'text-rose-400'}`} />
                <span className="hidden xl:inline">{t.favorites}</span>
                {favorites.length > 0 && (
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                    showOnlyFavorites ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {favorites.length}
                  </span>
                )}
              </button>
            )}

            {currentUser?.role === 'student' && (
              <button
                id="ai-consultant-btn"
                onClick={() => setIsAiConsultantOpen(true)}
                className="relative bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-3 py-1.5 rounded font-bold text-xs transition-all duration-200 flex items-center gap-1.5 shadow-md cursor-pointer group shrink-0"
              >
                <Sparkles className="w-4 h-4 text-indigo-200 shrink-0 group-hover:animate-bounce" />
                <span className="hidden lg:inline">{t.aiConsultant}</span>
                <span className="lg:hidden">AI</span>
              </button>
            )}

            <button
              id="global-messages-btn"
              onClick={() => {
                setTutorToChatWith(null);
                setIsChatOpen(true);
              }}
              className="relative border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 text-slate-600 hover:text-indigo-700 bg-white px-2.5 sm:px-3 py-1.5 rounded font-medium text-xs transition-all duration-200 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="hidden lg:inline">{t.chat}</span>
              {unreadConversationsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse shadow-sm">
                  {unreadConversationsCount}
                </span>
              )}
            </button>

            <button
              id="my-bookings-btn"
              onClick={() => setIsMyBookingsOpen(true)}
              className="relative border border-slate-200 hover:border-slate-300 text-slate-600 bg-white px-2.5 sm:px-3 py-1.5 rounded font-medium text-xs transition-all duration-200 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="hidden lg:inline">{currentUser.role === 'teacher' ? (language === 'he' ? 'ההזמנות שלי' : 'My Bookings') : t.myBookings}</span>
              {activeBookingsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                  {activeBookingsCount}
                </span>
              )}
            </button>

            <button
              id="logout-btn"
              onClick={handleLogout}
              className="border border-slate-200 hover:bg-slate-50 text-slate-600 p-1.5 rounded transition-colors shadow-xs cursor-pointer flex items-center justify-center"
              title={t.logout}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Quick Action Icons in Header */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            {/* Quick Language Toggle */}
            <button
              id="mobile-header-lang-btn"
              onClick={() => handleLanguageChange(language === 'he' ? 'en' : 'he')}
              className="px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              title={language === 'he' ? 'Switch to English' : 'החלף לעברית'}
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px]">{language === 'he' ? 'EN' : 'עב'}</span>
            </button>

            {/* Mobile Hamburger Menu Button */}
            <button
              id="mobile-hamburger-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-lg border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        
        {/* Statistics Bar - Compact & Responsive */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          <div className="bg-white border border-slate-200 p-2.5 sm:p-4 rounded-xl shadow-2xs flex flex-col sm:flex-row items-center text-center sm:text-right gap-1.5 sm:gap-4">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
              <GraduationCap className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block uppercase tracking-wider truncate">{language === 'he' ? 'מורים' : 'Tutors'}</span>
              <h3 className="text-xs sm:text-base font-bold text-slate-800 truncate">{tutors.length} {language === 'he' ? 'מורים' : 'tutors'}</h3>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-2.5 sm:p-4 rounded-xl shadow-2xs flex flex-col sm:flex-row items-center text-center sm:text-right gap-1.5 sm:gap-4">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
              <BookOpen className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block uppercase tracking-wider truncate">{language === 'he' ? 'מקצועות' : 'Subjects'}</span>
              <h3 className="text-xs sm:text-base font-bold text-slate-800 truncate">{SUBJECTS_LIST.length} {language === 'he' ? 'מקצועות' : 'subjects'}</h3>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-2.5 sm:p-4 rounded-xl shadow-2xs flex flex-col sm:flex-row items-center text-center sm:text-right gap-1.5 sm:gap-4">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-amber-500 shrink-0">
              <Star className="w-4 h-4 sm:w-6 sm:h-6 text-amber-500 fill-amber-500" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block uppercase tracking-wider truncate">{language === 'he' ? 'שביעות רצון' : 'Rating'}</span>
              <h3 className="text-xs sm:text-base font-bold text-slate-800 truncate">
                {systemAverageRating.toFixed(1)} ★
              </h3>
            </div>
          </div>
        </div>

        {/* Mobile-Only Quick Filter & Horizontal Subject Carousel */}
        <div className="lg:hidden space-y-3 mb-5">
          {/* Mobile search bar + Filter Drawer Trigger Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 ${isRtl ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 shadow-2xs text-slate-800 font-medium ${
                  isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
                }`}
                dir={isRtl ? 'rtl' : 'ltr'}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold w-5 h-5 flex items-center justify-center cursor-pointer ${isRtl ? 'left-2' : 'right-2'}`}
                >
                  ×
                </button>
              )}
            </div>

            <button
              id="mobile-open-filters-btn"
              onClick={() => setIsMobileFilterOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer ${
                activeFiltersCount > 0
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{t.filterBy}</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-indigo-700 text-[10px] font-extrabold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Horizontal scrollable subject chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => {
                setSelectedSubject('כל המקצועות');
                setSubjectSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedSubject === 'כל המקצועות' && !subjectSearchQuery
                  ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.allSubjects}
            </button>
            {SUBJECTS_LIST.map((subj) => (
              <button
                key={subj}
                onClick={() => {
                  setSelectedSubject(subj);
                  setSubjectSearchQuery('');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedSubject === subj
                    ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {translateSubject(subj, language)}
              </button>
            ))}
          </div>
        </div>

        {/* Bento Search and Filters Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Desktop Right Column - Filters Sidebar (Sticky) */}
          <aside className="hidden lg:block lg:col-span-1 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6 sticky top-20">
              {renderFiltersContent()}
            </div>
          </aside>

          {/* Left Column - Search Input & Tutor Cards Grid */}
          <section className="lg:col-span-3 space-y-5">
            
            {/* Desktop Search, Favorites Tab, and results count bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              
              {/* Desktop Search input field */}
              <div className="relative w-full sm:w-72 hidden lg:block">
                <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
                <input
                  type="text"
                  id="search-input-field"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-indigo-400 transition-all text-slate-800 font-medium ${
                    isRtl ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'
                  }`}
                  dir={isRtl ? 'rtl' : 'ltr'}
                />
              </div>

              {/* View Selector: All vs Favorites */}
              <div className="flex items-center gap-2">
                <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200/80">
                  <button
                    type="button"
                    id="tab-all-tutors"
                    onClick={() => setShowOnlyFavorites(false)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      !showOnlyFavorites
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t.allTutors}
                  </button>

                  <button
                    type="button"
                    id="tab-favorites-tutors"
                    onClick={() => setShowOnlyFavorites(true)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      showOnlyFavorites
                        ? 'bg-white text-rose-600 shadow-xs'
                        : 'text-slate-500 hover:text-rose-600'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${showOnlyFavorites ? 'fill-rose-500 text-rose-500' : 'text-rose-400'}`} />
                    <span>{t.favorites}</span>
                    {favorites.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-extrabold">
                        {favorites.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Results status */}
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider shrink-0">
                {language === 'he' ? (
                  <>נמצאו <span className="font-extrabold text-indigo-600">{filteredTutors.length}</span> {t.foundTutorsCount}</>
                ) : (
                  <>Found <span className="font-extrabold text-indigo-600">{filteredTutors.length}</span> {t.foundTutorsCount}</>
                )}
              </div>

            </div>

            {/* Tutors Grid */}
            {filteredTutors.length === 0 ? (
              showOnlyFavorites ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center space-y-4 shadow-sm animate-in fade-in duration-200">
                  <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-400 border border-rose-100 shadow-xs">
                    <Heart className="w-8 h-8 fill-rose-100 text-rose-500" />
                  </div>
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <h3 className="font-bold text-slate-800 text-base">{t.noFavoritesYet}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {t.noFavoritesYetDesc}
                    </p>
                  </div>
                  <button
                    id="view-all-from-fav-empty-btn"
                    onClick={() => setShowOnlyFavorites(false)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all duration-200 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <span>{t.allTutors}</span>
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center space-y-4 shadow-sm">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300 border border-slate-100">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <h3 className="font-bold text-slate-800 text-base">{t.noTutorsFound}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {t.noTutorsFoundDesc}
                    </p>
                  </div>
                  <button
                    id="no-results-reset-btn"
                    onClick={resetFilters}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all duration-200 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.clearFilters}</span>
                  </button>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {filteredTutors.map((tutor) => (
                  <TutorCard 
                    key={tutor.id} 
                    tutor={tutor} 
                    onSelect={(t) => setSelectedTutor(t)}
                    language={language}
                    currentUser={currentUser}
                    isFavorite={favorites.includes(tutor.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}

          </section>

        </div>
      </main>

      {/* --- Mobile & Tablet Filter Drawer / Modal --- */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-end sm:items-center justify-center p-0 sm:p-4 lg:hidden" dir={isRtl ? 'rtl' : 'ltr'}>
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileFilterOpen(false)} 
          />
          <div className="relative w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden animate-in fade-in sm:zoom-in-95 duration-200">
            {/* Filter Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">{t.filterBy}</h3>
              </div>
              <button 
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
                title="סגור חלונית סינון"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Body */}
            <div className="p-5 overflow-y-auto flex-1">
              {renderFiltersContent()}
            </div>

            {/* Filter Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={resetFilters}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {t.clearFilters}
              </button>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm text-center cursor-pointer"
              >
                {language === 'he' ? `צפה ב-${filteredTutors.length} תוצאות` : `Show ${filteredTutors.length} Results`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Mobile Navigation Drawer Menu --- */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex md:hidden" dir={isRtl ? 'rtl' : 'ltr'}>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)} 
          />
          
          {/* Drawer panel */}
          <div className={`relative ${isRtl ? 'mr-auto' : 'ml-auto'} w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 overflow-y-auto`}>
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <TutorDirectLogo language={language} className="w-8 h-8" />
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Card */}
            <div className="p-4 bg-indigo-50/50 border-b border-slate-200 flex items-center gap-3">
              {currentUser.avatarUrl ? (
                currentUser.avatarUrl.startsWith('preset:') ? (
                  (() => {
                    const parts = currentUser.avatarUrl.split(':');
                    const emoji = parts[1] || '👨‍🏫';
                    const bg = parts[2] || 'from-indigo-500 to-purple-600';
                    return (
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${bg} flex items-center justify-center text-lg shadow-xs shrink-0`}>
                        {emoji}
                      </div>
                    );
                  })()
                ) : (
                  <img
                    src={currentUser.avatarUrl}
                    alt="avatar"
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
                  />
                )
              ) : (
                <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center text-sm font-extrabold uppercase shrink-0">
                  {currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('') : 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-800 text-sm truncate">{currentUser.name}</h4>
                <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  {currentUser.role === 'student' ? (language === 'he' ? 'תלמיד' : 'Student') : (language === 'he' ? 'מורה' : 'Teacher')}
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="p-3 space-y-1 flex-1">
              <button
                onClick={() => {
                  setIsUserProfileOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
              >
                <User className="w-4 h-4 text-indigo-600" />
                <span>{t.myProfile}</span>
              </button>

              <button
                onClick={() => {
                  setIsResetPasswordModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
              >
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>{language === 'he' ? 'שינוי סיסמה' : 'Change Password'}</span>
              </button>

              {currentUser.role === 'teacher' && currentUserTutorProfile && (
                <>
                  <button
                    onClick={() => {
                      setIsTeacherSettingsOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
                  >
                    <Settings className="w-4 h-4 text-indigo-600" />
                    <span>{language === 'he' ? 'הגדרות פרופיל מורה' : 'Teacher Settings'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsManageSlotsOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
                  >
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>{language === 'he' ? 'ניהול יומן שעות' : 'Manage Schedule'}</span>
                  </button>
                </>
              )}

              {currentUser.role === 'student' && (
                <>
                  <button
                    onClick={() => {
                      setShowOnlyFavorites(prev => !prev);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Heart className={`w-4 h-4 ${showOnlyFavorites ? 'fill-rose-500 text-rose-500' : 'text-rose-400'}`} />
                      <span>{t.favorites}</span>
                    </div>
                    {favorites.length > 0 && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                        {favorites.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setIsAiConsultantOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>{t.aiConsultant}</span>
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setTutorToChatWith(null);
                  setIsChatOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>{t.chat}</span>
                </div>
                {unreadConversationsCount > 0 && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                    {unreadConversationsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setIsMyBookingsOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>{currentUser.role === 'teacher' ? (language === 'he' ? 'ההזמנות שלי' : 'My Bookings') : t.myBookings}</span>
                </div>
                {activeBookingsCount > 0 && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                    {activeBookingsCount}
                  </span>
                )}
              </button>

              <div className="pt-2 pb-1 border-t border-slate-100">
                <button
                  onClick={() => {
                    handleLanguageChange(language === 'he' ? 'en' : 'he');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
                >
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>{language === 'he' ? 'Switch to English' : 'החלף לעברית'}</span>
                </button>
              </div>
            </div>

            {/* Logout button in drawer footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.logout}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Mobile Bottom Navigation Bar --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 flex justify-around items-center shadow-lg" dir={isRtl ? 'rtl' : 'ltr'}>
        <button
          onClick={() => {
            setShowOnlyFavorites(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors cursor-pointer min-w-[48px] ${
            !showOnlyFavorites ? 'text-indigo-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] leading-tight">{t.allTutors}</span>
        </button>

        {currentUser.role === 'student' && (
          <button
            onClick={() => setShowOnlyFavorites(prev => !prev)}
            className={`relative flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors cursor-pointer min-w-[48px] ${
              showOnlyFavorites ? 'text-rose-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Heart className={`w-5 h-5 ${showOnlyFavorites ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span className="text-[10px] leading-tight">{t.favorites}</span>
            {favorites.length > 0 && (
              <span className="absolute top-0 right-1 bg-rose-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                {favorites.length}
              </span>
            )}
          </button>
        )}

        {currentUser.role === 'student' && (
          <button
            onClick={() => setIsAiConsultantOpen(true)}
            className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-indigo-600 transition-colors cursor-pointer min-w-[48px]"
          >
            <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
            <span className="text-[10px] leading-tight font-bold">AI</span>
          </button>
        )}

        <button
          onClick={() => {
            setTutorToChatWith(null);
            setIsChatOpen(true);
          }}
          className="relative flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer min-w-[48px]"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] leading-tight">{t.chat}</span>
          {unreadConversationsCount > 0 && (
            <span className="absolute top-0 right-1 bg-rose-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
              {unreadConversationsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setIsMyBookingsOpen(true)}
          className="relative flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer min-w-[48px]"
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] leading-tight">{currentUser.role === 'teacher' ? (language === 'he' ? 'שיעורים' : 'Lessons') : t.myBookings}</span>
          {activeBookingsCount > 0 && (
            <span className="absolute top-0 right-1 bg-indigo-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
              {activeBookingsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer min-w-[48px]"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] leading-tight">{language === 'he' ? 'תפריט' : 'Menu'}</span>
        </button>
      </nav>

      {/* --- Floating Overlays / Modals --- */}

      {/* Tutor Details & Booking Drawer */}
      {selectedTutor && (
        <TutorDetailDrawer
          tutor={tutors.find(t => t.id === selectedTutor.id) || selectedTutor}
          currentUser={currentUser}
          bookings={bookings}
          language={language}
          isFavorite={favorites.includes(selectedTutor.id)}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setSelectedTutor(null)}
          onAddReview={handleAddReview}
          onBookLesson={handleBookLesson}
          onStartChat={(t) => {
            if (currentUser?.role === 'teacher') {
              console.warn('Teachers are not allowed to start chats with other teachers');
              return;
            }
            setTutorToChatWith(t);
            setIsChatOpen(true);
            setSelectedTutor(null);
          }}
          onUpdateTutorProfile={handleUpdateTutorProfile}
        />
      )}

      {/* Become Tutor Registration Modal */}
      {isBecomeModalOpen && (
        <BecomeTutorModal
          onClose={() => setIsBecomeModalOpen(false)}
          onRegister={handleRegisterTutor}
          language={language}
          existingTutors={tutors}
        />
      )}

      {/* Student Bookings History Modal */}
      {isMyBookingsOpen && (
        <MyBookingsModal
          bookings={bookings}
          tutors={tutors}
          currentUser={currentUser}
          onClose={() => setIsMyBookingsOpen(false)}
          onCancelBooking={handleCancelBooking}
          onApproveBooking={handleApproveBooking}
          onCompleteBooking={handleCompleteBooking}
          onConfirmLessonOccurrence={handleConfirmLessonOccurrence}
          onAddReview={handleAddReview}
          onOpenTutorReview={(tutorId) => {
            const tutorToReview = tutors.find(t => t.id === tutorId);
            if (tutorToReview) {
              setSelectedTutor(tutorToReview);
              setIsMyBookingsOpen(false);
            }
          }}
          onStartLiveLesson={(booking) => {
            setActiveLiveLessonBooking(booking);
          }}
          onRefresh={loadDataFromSupabase}
          language={language}
        />
      )}

      {/* Live Video Lesson Modal (Jitsi Meet) */}
      {activeLiveLessonBooking && currentUser && (
        <LiveLessonModal
          booking={activeLiveLessonBooking}
          currentUser={currentUser}
          onClose={() => setActiveLiveLessonBooking(null)}
          onCompleteLesson={(bookingId) => {
            handleCompleteBooking(bookingId);
          }}
          language={language}
        />
      )}

      {/* Teacher Calendar Slots Management Modal */}
      {isManageSlotsOpen && currentUserTutorProfile && (
        <ManageSlotsModal
          tutor={currentUserTutorProfile}
          onUpdateSlots={handleUpdateSlots}
          onClose={() => setIsManageSlotsOpen(false)}
        />
      )}

      {/* Teacher Profile Settings Modal */}
      {isTeacherSettingsOpen && currentUserTutorProfile && (
        <TeacherSettingsModal
          tutor={currentUserTutorProfile}
          onUpdateTutorProfile={handleUpdateTutorProfile}
          onClose={() => setIsTeacherSettingsOpen(false)}
          onRefresh={loadDataFromSupabase}
          language={language}
        />
      )}

      {/* Force Complete Profile Modal */}
      {forceCompleteTutorId && (
        (() => {
          const tutorToSetup = tutors.find(t => t.id === forceCompleteTutorId);
          return tutorToSetup ? (
            <ForceCompleteProfileModal
              tutor={tutorToSetup}
              onUpdateProfile={handleForceCompleteProfile}
            />
          ) : null;
        })()
      )}

      {/* User Profile Modal */}
      {isUserProfileOpen && (
        <UserProfileModal
          currentUser={currentUser}
          currentLanguage={language}
          onChangeLanguage={handleLanguageChange}
          onUpdateCurrentUser={(updated) => {
            setCurrentUser(updated);
            localStorage.setItem('current_user', JSON.stringify(updated));
          }}
          onClose={() => setIsUserProfileOpen(false)}
          onLogout={handleLogout}
          tutors={tutors}
          onUpdateTutors={saveTutors}
        />
      )}

      {/* Real-time Interactive Chat System */}
      {isChatOpen && (
        <ChatWidget
          currentUser={currentUser}
          initialTutorToChat={tutorToChatWith}
          tutors={tutors}
          bookings={bookings}
          onBookLesson={handleBookLesson}
          onStartLiveLesson={(booking) => {
            setActiveLiveLessonBooking(booking);
          }}
          onOpenMyBookings={() => {
            setIsChatOpen(false);
            setIsMyBookingsOpen(true);
          }}
          onClose={() => {
            setIsChatOpen(false);
            setTutorToChatWith(null);
          }}
        />
      )}

      {/* AI Academic Consultant */}
      <AiConsultantModal
        isOpen={isAiConsultantOpen}
        onClose={() => setIsAiConsultantOpen(false)}
        currentUser={currentUser}
        tutors={tutors}
        onSelectTutor={(tutor) => setSelectedTutor(tutor)}
        language={language}
      />

      {/* Password Reset Modal (from Email Recovery link or Manual request) */}
      <ResetPasswordModal
        isOpen={isResetPasswordModalOpen}
        onClose={() => {
          setIsResetPasswordModalOpen(false);
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }}
        userEmail={recoveryEmail || currentUser?.email || ''}
        language={language}
        onPasswordUpdated={() => {
          setIsResetPasswordModalOpen(false);
          setIsRecoveryFlow(false);
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }}
      />
    </div>
  );
}
