import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  User, 
  Camera, 
  Check, 
  AlertCircle, 
  Upload, 
  Globe, 
  Lock, 
  Loader2, 
  LogOut, 
  Mail, 
  Send, 
  KeyRound, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles,
  GraduationCap,
  Briefcase,
  BookOpen,
  FileText,
  DollarSign
} from 'lucide-react';
import { Tutor } from '../types';
import { supabase, isValidUuid } from '../lib/supabase';
import { Language, getTranslation, translateLevel } from '../lib/i18n';
import { uploadAvatarImage, saveUserAvatarInSupabase } from '../lib/storageUtils';
import { AVAILABLE_LEVELS } from './TeacherSettingsModal';

// Beautiful pre-defined avatar backgrounds and emojis
const AVATAR_PRESETS = [
  { emoji: '👨‍🏫', bg: 'from-blue-500 to-indigo-600' },
  { emoji: '👩‍🏫', bg: 'from-purple-500 to-pink-600' },
  { emoji: '🎓', bg: 'from-emerald-500 to-teal-600' },
  { emoji: '💻', bg: 'from-slate-700 to-slate-900' },
  { emoji: '🧠', bg: 'from-amber-500 to-orange-600' },
  { emoji: '📚', bg: 'from-rose-500 to-red-600' }
];

interface UserProfileModalProps {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: 'student' | 'teacher';
    tutorProfileId?: string;
    avatarUrl?: string;
    language?: Language;
  };
  currentLanguage?: Language;
  onChangeLanguage?: (newLang: Language) => void;
  onUpdateCurrentUser: (updated: any) => void;
  onClose: () => void;
  onLogout?: () => void;
  tutors: Tutor[];
  onUpdateTutors: (updatedTutors: Tutor[], specificTutorToSave?: Tutor) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  currentUser,
  currentLanguage = 'he',
  onChangeLanguage,
  onUpdateCurrentUser,
  onClose,
  onLogout,
  tutors,
  onUpdateTutors
}) => {
  const t = getTranslation(currentLanguage);
  const isRtl = currentLanguage === 'he';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [username, setUsername] = useState(currentUser.name);
  const [currentPasswordForUsername, setCurrentPasswordForUsername] = useState('');

  // Password change states
  const [currentPasswordForChange, setCurrentPasswordForChange] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswordChangeForm, setShowPasswordChangeForm] = useState(false);
  const [passwordChangeMethod, setPasswordChangeMethod] = useState<'current_pass' | 'email_link'>('current_pass');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);

  // Status/Error messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Teacher verification: ONLY users with role === 'teacher' can view or edit teacher profile details
  const isTeacherUser = currentUser.role === 'teacher';

  // Match current user to tutor record (strictly only if user is a teacher)
  const currentTutor = isTeacherUser ? tutors.find(t => 
    (currentUser.tutorProfileId && t.id === currentUser.tutorProfileId) || 
    t.id === currentUser.id || 
    (t.email && currentUser.email && t.email.toLowerCase() === currentUser.email.toLowerCase())
  ) : undefined;

  // Helper to parse levels
  const parseLevels = (lvlVal?: string | string[]): string[] => {
    if (!lvlVal) return [];
    if (Array.isArray(lvlVal)) return lvlVal.map(l => String(l).trim()).filter(Boolean);
    return String(lvlVal).split(',').map(l => l.trim()).filter(Boolean);
  };

  // Teacher Profile Form States
  const [teacherBio, setTeacherBio] = useState(currentTutor?.bio || '');
  const [teacherExperience, setTeacherExperience] = useState(currentTutor?.experience || '');
  const [teacherEducation, setTeacherEducation] = useState(currentTutor?.education || '');
  const [teacherPrice, setTeacherPrice] = useState<number | string>(currentTutor?.price ?? 100);
  const [teacherLevels, setTeacherLevels] = useState<string[]>(parseLevels(currentTutor?.levels));
  const [updatingTeacherProfile, setUpdatingTeacherProfile] = useState(false);
  const [teacherProfileSuccess, setTeacherProfileSuccess] = useState('');
  const [teacherProfileError, setTeacherProfileError] = useState('');

  // Level selection handlers
  const handleToggleTeacherLevel = (lvl: string) => {
    setTeacherProfileError('');
    setTeacherLevels(prev => 
      prev.includes(lvl) 
        ? prev.filter(l => l !== lvl) 
        : [...prev, lvl]
    );
  };

  const handleSelectAllTeacherLevels = () => {
    setTeacherProfileError('');
    setTeacherLevels([...AVAILABLE_LEVELS]);
  };

  const handleClearAllTeacherLevels = () => {
    setTeacherProfileError('');
    setTeacherLevels([]);
  };

  const handleSelectLevelGroup = (group: 'elementary' | 'middle' | 'high' | 'academic') => {
    setTeacherProfileError('');
    let groupLevels: string[] = [];
    if (group === 'elementary') {
      groupLevels = ['כיתה א', 'כיתה ב', 'כיתה ג', 'כיתה ד', 'כיתה ה', 'כיתה ו'];
    } else if (group === 'middle') {
      groupLevels = ['כיתה ז', 'כיתה ח', 'כיתה ט'];
    } else if (group === 'high') {
      groupLevels = ['כיתה י', 'כיתה י"א', 'כיתה י"ב'];
    } else if (group === 'academic') {
      groupLevels = ['תואר ראשון'];
    }

    setTeacherLevels(prev => {
      const allSelected = groupLevels.every(l => prev.includes(l));
      if (allSelected) {
        return prev.filter(l => !groupLevels.includes(l));
      } else {
        const set = new Set([...prev, ...groupLevels]);
        return Array.from(set);
      }
    });
  };

  // Async query Supabase on mount to check if user has tutor record in DB (only for teachers)
  useEffect(() => {
    let isMounted = true;
    const checkDbTutor = async () => {
      // Students can never have or edit a tutor profile
      if (!isTeacherUser) return;
      if (!currentUser.email && !currentUser.id) return;

      try {
        // Check tutors table directly
        const cleanEmail = currentUser.email?.toLowerCase().trim();
        const { data: tutorRows } = await supabase
          .from('tutors')
          .select('*');

        if (tutorRows && isMounted) {
          const matchedDbTutor = tutorRows.find((t: any) => 
            t.id === currentUser.id || 
            t.id === currentUser.tutorProfileId || 
            (cleanEmail && t.email && t.email.toLowerCase() === cleanEmail)
          );

          if (matchedDbTutor) {
            if (matchedDbTutor.bio) setTeacherBio(matchedDbTutor.bio);
            if (matchedDbTutor.experience) setTeacherExperience(matchedDbTutor.experience);
            if (matchedDbTutor.education) setTeacherEducation(matchedDbTutor.education);
            if (matchedDbTutor.price !== undefined && matchedDbTutor.price !== null) {
              setTeacherPrice(Number(matchedDbTutor.price));
            }
            if (matchedDbTutor.levels) {
              const parsed = parseLevels(matchedDbTutor.levels);
              if (parsed.length > 0) setTeacherLevels(parsed);
            }
          }
        }
      } catch (err) {
        console.warn('Error checking tutor record in DB:', err);
      }
    };

    checkDbTutor();
    return () => { isMounted = false; };
  }, [currentUser.email, currentUser.id, isTeacherUser, currentUser.tutorProfileId]);

  // Sync teacher form state if tutor data prop changes (teachers only)
  useEffect(() => {
    if (isTeacherUser && currentTutor) {
      if (currentTutor.bio !== undefined) setTeacherBio(currentTutor.bio || '');
      if (currentTutor.experience !== undefined) setTeacherExperience(currentTutor.experience || '');
      if (currentTutor.education !== undefined) setTeacherEducation(currentTutor.education || '');
      if (currentTutor.price !== undefined && currentTutor.price !== null) setTeacherPrice(currentTutor.price);
      if (currentTutor.levels !== undefined && currentTutor.levels !== null) {
        setTeacherLevels(parseLevels(currentTutor.levels));
      }
    }
  }, [isTeacherUser, currentTutor?.id, currentTutor?.bio, currentTutor?.experience, currentTutor?.education, currentTutor?.price, currentTutor?.levels]);

  // Profile picture state (can be presets or custom base64)
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser.avatarUrl || '');

  // Helper to get initials
  const initials = currentUser.name.split(' ').map(n => n[0]).join('');

  // Local helper to fetch the user's password from Supabase or local storage
  const getStoredPassword = async (): Promise<string | null> => {
    // 1. Try Supabase first
    try {
      const { data, error } = await supabase
        .from('users')
        .select('password')
        .eq('email', currentUser.email.toLowerCase())
        .maybeSingle();
      if (!error && data && data.password) {
        return data.password;
      }
    } catch (err) {}

    // 2. Try local storage
    const storedUsers = localStorage.getItem('registered_users');
    if (storedUsers) {
      try {
        const users = JSON.parse(storedUsers);
        const matched = users.find((u: any) => u.email.toLowerCase() === currentUser.email.toLowerCase());
        if (matched && matched.password) {
          return matched.password;
        }
      } catch (e) {}
    }

    // 3. Fallback for demo users
    if (currentUser.email === 'noa.math@gmail.com') return '123456';
    return '123456'; // Default fallback
  };

  // Profile image upload handler (compresses or uploads to storage)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError(currentLanguage === 'he' ? 'גודל התמונה מוגבל לעד 10MB' : 'Image size is limited to 10MB');
      return;
    }

    setLoading(true);
    try {
      const processedUrl = await uploadAvatarImage(currentUser.email || currentUser.id, file);
      setAvatarUrl(processedUrl);
      await handleSaveAvatar(processedUrl);
    } catch (err: any) {
      console.error('Error processing avatar:', err);
      setError(currentLanguage === 'he' ? 'שגיאה בעיבוד התמונה' : 'Error processing image');
      setLoading(false);
    }
  };

  // Quick preset selection
  const handleSelectPreset = (preset: { emoji: string; bg: string }) => {
    setError('');
    setSuccess('');
    const presetUrl = `preset:${preset.emoji}:${preset.bg}`;
    setAvatarUrl(presetUrl);
    handleSaveAvatar(presetUrl);
  };

  // Directly save avatar changes
  const handleSaveAvatar = async (newUrl: string) => {
    setLoading(true);
    try {
      // 1. Update in local storage current_user
      const updatedUser = { ...currentUser, avatarUrl: newUrl };
      onUpdateCurrentUser(updatedUser);

      // 2. Update in registered_users local storage
      const storedUsers = localStorage.getItem('registered_users');
      if (storedUsers) {
        try {
          const users = JSON.parse(storedUsers);
          const idx = users.findIndex((u: any) => 
            (u.email && currentUser.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            (u.id && u.id === currentUser.id)
          );
          if (idx !== -1) {
            users[idx].avatarUrl = newUrl;
            users[idx].avatar = newUrl;
            localStorage.setItem('registered_users', JSON.stringify(users));
          }
        } catch (e) {}
      }

      // 3. Direct UPDATE to Supabase users table with 'avatar' column
      if (currentUser.id) {
        try {
          await supabase
            .from('users')
            .update({ avatar: newUrl, avatar_url: newUrl } as any)
            .eq('id', currentUser.id);
        } catch (e) {}
      }
      if (currentUser.email) {
        try {
          await supabase
            .from('users')
            .update({ avatar: newUrl, avatar_url: newUrl } as any)
            .ilike('email', currentUser.email.trim());
        } catch (e) {}
      }

      // 4. Update Supabase users and tutors tables reliably
      await saveUserAvatarInSupabase(updatedUser, newUrl);

      // 5. Update in tutors list if current user is a teacher
      if (currentUser.role === 'teacher') {
        let matchedTutor: Tutor | undefined;
        const updatedTutors = tutors.map(t => {
          const isMatch = (
            (t.email && currentUser.email && t.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            (currentUser.tutorProfileId && t.id === currentUser.tutorProfileId) ||
            t.id === currentUser.id ||
            (t.name && currentUser.name && t.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
          );
          if (isMatch) {
            matchedTutor = { ...t, avatarUrl: newUrl };
            return matchedTutor;
          }
          return t;
        });

        if (matchedTutor) {
          onUpdateTutors(updatedTutors, matchedTutor);
        } else {
          onUpdateTutors(updatedTutors);
        }
      }

      setSuccess(currentLanguage === 'he' ? 'תמונת הפרופיל עודכנה בהצלחה!' : 'Profile picture updated successfully!');
    } catch (err) {
      console.error('Error in handleSaveAvatar:', err);
      setError(currentLanguage === 'he' ? 'ארעה שגיאה בעדכון תמונת הפרופיל' : 'Error updating profile picture');
    } finally {
      setLoading(false);
    }
  };

  // Update Username (Name) with Password Verification
  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim()) {
      setError(currentLanguage === 'he' ? 'אנא הזן שם משתמש תקין' : 'Please enter a valid user name');
      return;
    }

    if (username.trim() === currentUser.name) {
      setError(currentLanguage === 'he' ? 'שם המשתמש החדש זהה לשם הנוכחי' : 'New name is identical to current name');
      return;
    }

    const cleanNewName = username.trim().toLowerCase();
    const storedUsers = localStorage.getItem('registered_users');
    const registered = storedUsers ? JSON.parse(storedUsers) : [];
    const nameTakenLocally = registered.some((u: any) => 
      u.email.toLowerCase() !== currentUser.email.toLowerCase() && 
      u.name && u.name.trim().toLowerCase() === cleanNewName
    ) || tutors.some(t => 
      t.email.toLowerCase() !== currentUser.email.toLowerCase() && 
      t.id !== currentUser.tutorProfileId &&
      t.name && t.name.trim().toLowerCase() === cleanNewName
    );

    if (nameTakenLocally) {
      setError(currentLanguage === 'he' ? 'שם משתמש זה כבר קיים במערכת, אנא בחר שם אחר' : 'This user name is already taken. Please choose a different name.');
      return;
    }

    if (!currentPasswordForUsername) {
      setError(currentLanguage === 'he' ? 'אנא הקלד את סיסמתך הנוכחית על מנת לאשר את שינוי שם המשתמש' : 'Please enter your password to confirm username change');
      return;
    }

    setLoading(true);
    try {
      // Check Supabase if another user has this name
      try {
        const { data: dbUserWithSameName } = await supabase
          .from('users')
          .select('id, name, email')
          .ilike('name', username.trim())
          .neq('email', currentUser.email.toLowerCase())
          .maybeSingle();

        if (dbUserWithSameName) {
          setError(currentLanguage === 'he' ? 'שם משתמש זה כבר קיים במערכת, אנא בחר שם אחר' : 'This user name is already taken. Please choose a different name.');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Supabase name uniqueness check skipped:', err);
      }

      const correctPassword = await getStoredPassword();
      if (currentPasswordForUsername !== correctPassword) {
        setError(currentLanguage === 'he' ? 'הסיסמה שהוקלדה שגויה' : 'Incorrect password entered');
        setLoading(false);
        return;
      }

      // Update current user state and local storage
      const updatedUser = { ...currentUser, name: username.trim() };
      onUpdateCurrentUser(updatedUser);

      // Update in registered_users
      const storedUsers = localStorage.getItem('registered_users');
      if (storedUsers) {
        const users = JSON.parse(storedUsers);
        const idx = users.findIndex((u: any) => u.email.toLowerCase() === currentUser.email.toLowerCase());
        if (idx !== -1) {
          users[idx].name = username.trim();
          localStorage.setItem('registered_users', JSON.stringify(users));
        }
      }

      // Update Supabase users table
      if (currentUser.id) {
        try {
          await supabase
            .from('users')
            .update({ name: username.trim() })
            .eq('id', currentUser.id);
        } catch (e) {}
      }
      if (currentUser.email) {
        try {
          await supabase
            .from('users')
            .update({ name: username.trim() })
            .ilike('email', currentUser.email.trim());
        } catch (e) {}
      }

      // Update all reviews authored by this user across all tutors and in localStorage
      const cleanCurEmail = (currentUser.email || '').trim().toLowerCase();
      const cleanCurName = (currentUser.name || '').trim();
      const newCleanName = username.trim();

      // 1. Update local storage 'tutordirect_all_reviews'
      try {
        let allReviewsMap: Record<string, any[]> = {};
        const rawReviews = localStorage.getItem('tutordirect_all_reviews');
        if (rawReviews) allReviewsMap = JSON.parse(rawReviews);
        let changedReviews = false;
        Object.keys(allReviewsMap).forEach(key => {
          allReviewsMap[key] = (allReviewsMap[key] || []).map(r => {
            const rEmail = (r.reviewerEmail || '').trim().toLowerCase();
            const isAnon = r.reviewerName === 'תלמיד אנונימי' || r.reviewerName === 'Anonymous Student';
            if (!isAnon && ((cleanCurEmail && rEmail === cleanCurEmail) || (!rEmail && r.reviewerName === cleanCurName))) {
              changedReviews = true;
              return {
                ...r,
                reviewerName: newCleanName,
                reviewerEmail: r.reviewerEmail || currentUser.email
              };
            }
            return r;
          });
        });
        if (changedReviews) {
          localStorage.setItem('tutordirect_all_reviews', JSON.stringify(allReviewsMap));
        }
      } catch (e) {}

      // 2. Update in tutors list (both teacher profile name if applicable, and all reviews authored by this user)
      let teacherTutorToSave: Tutor | undefined;
      const updatedTutors = tutors.map(t => {
        let isModified = false;
        let updatedTutorName = t.name;

        // If current user is a teacher, update their tutor profile name
        if (currentUser.role === 'teacher' && (
          (t.email && t.email.trim().toLowerCase() === cleanCurEmail) || 
          t.id === currentUser.tutorProfileId ||
          t.id === currentUser.id
        )) {
          updatedTutorName = newCleanName;
          isModified = true;
        }

        // Update all reviews authored by this user on this tutor
        const updatedReviews = (t.reviews || []).map(r => {
          const rEmail = (r.reviewerEmail || '').trim().toLowerCase();
          const isAnon = r.reviewerName === 'תלמיד אנונימי' || r.reviewerName === 'Anonymous Student';
          if (!isAnon && ((cleanCurEmail && rEmail === cleanCurEmail) || (!rEmail && r.reviewerName === cleanCurName))) {
            isModified = true;
            return {
              ...r,
              reviewerName: newCleanName,
              reviewerEmail: r.reviewerEmail || currentUser.email
            };
          }
          return r;
        });

        if (isModified) {
          const modTutor = {
            ...t,
            name: updatedTutorName,
            reviews: updatedReviews
          };
          if (currentUser.role === 'teacher' && (
            (t.email && t.email.trim().toLowerCase() === cleanCurEmail) || 
            t.id === currentUser.tutorProfileId ||
            t.id === currentUser.id
          )) {
            teacherTutorToSave = modTutor;
          }
          return modTutor;
        }
        return t;
      });

      onUpdateTutors(updatedTutors, teacherTutorToSave);

      setSuccess(currentLanguage === 'he' ? 'שם המשתמש עודכן בהצלחה!' : 'User name updated successfully!');
      setCurrentPasswordForUsername('');
    } catch (err) {
      setError(currentLanguage === 'he' ? 'ארעה שגיאה בעדכון שם המשתמש' : 'Error updating user name');
    } finally {
      setLoading(false);
    }
  };

  // Send Password Reset Link to user's email
  const handleSendResetEmail = async () => {
    setError('');
    setSuccess('');
    setSendingResetEmail(true);

    try {
      const cleanEmail = currentUser.email.trim().toLowerCase();
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : undefined;

      // 1. Send Supabase auth reset password email link
      const { error: supaErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (supaErr) {
        console.warn('Supabase resetPasswordForEmail error:', supaErr);
      }

      // 2. Dispatch email notification via /api/send-otp (type: 'reset') as fallback / templating
      try {
        await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            name: currentUser.name,
            type: 'reset',
            resetUrl: redirectUrl,
          }),
        });
      } catch (e) {
        console.warn('API send-otp invocation error:', e);
      }

      setResetEmailSent(true);
      setSuccess(
        currentLanguage === 'he'
          ? 'קישור לאיפוס סיסמה נשלח למייל שלך! לחיצה על הקישור תפתח את הטופס להזנת הסיסמה החדשה.'
          : 'Password reset link sent to your email! Clicking the link will open the form to enter a new password.'
      );
    } catch (err: any) {
      setError(
        currentLanguage === 'he'
          ? 'שגיאה בשליחת קישור איפוס למייל. אנא נסה שוב.'
          : 'Error sending password reset link to email. Please try again.'
      );
    } finally {
      setSendingResetEmail(false);
    }
  };

  // Update Password directly in Supabase using current password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPasswordForChange) {
      setError(currentLanguage === 'he' ? 'נא להזין סיסמה נוכחית' : 'Please enter current password');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError(currentLanguage === 'he' ? 'הסיסמה החדשה חייבת להכיל לפחות 8 תווים' : 'New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(currentLanguage === 'he' ? 'הסיסמאות החדשות אינן תואמות' : 'New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // 1. Verify current password
      const correctPassword = await getStoredPassword();
      if (currentPasswordForChange !== correctPassword) {
        setError(currentLanguage === 'he' ? 'הסיסמה הנוכחית שהוקלדה שגויה' : 'Incorrect current password');
        setLoading(false);
        return;
      }

      // 2. Update Supabase Auth user password
      try {
        await supabase.auth.updateUser({ password: newPassword.trim() });
      } catch (authErr) {
        console.warn('Supabase auth updateUser error:', authErr);
      }

      // 2.5. Update in Supabase users table
      const { error: dbError } = await supabase
        .from('users')
        .update({ password: newPassword.trim() })
        .eq('email', currentUser.email.toLowerCase());

      if (dbError) {
        console.error('Supabase password update error:', dbError);
      }

      // 3. Update in local storage registered_users
      const storedUsers = localStorage.getItem('registered_users');
      if (storedUsers) {
        const users = JSON.parse(storedUsers);
        const idx = users.findIndex((u: any) => u.email.toLowerCase() === currentUser.email.toLowerCase());
        if (idx !== -1) {
          users[idx].password = newPassword.trim();
          localStorage.setItem('registered_users', JSON.stringify(users));
        }
      }

      // 4. Send email notification about successful password change
      try {
        await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: currentUser.email.toLowerCase(),
            name: currentUser.name,
            type: 'password_changed'
          })
        });
      } catch (e) {}

      setSuccess(currentLanguage === 'he' ? 'הסיסמה עודכנה בהצלחה! הודעת אישור נשלחה למייל שלך.' : 'Password successfully updated! Confirmation email sent.');
      setCurrentPasswordForChange('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowPasswordChangeForm(false);
    } catch (err: any) {
      setError(currentLanguage === 'he' ? 'ארעה שגיאה בעדכון הסיסמה' : 'Error updating password');
    } finally {
      setLoading(false);
    }
  };

  // Save Teacher Profile Updates directly to Supabase
  const handleSaveTeacherProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherProfileError('');
    setTeacherProfileSuccess('');

    // Strict authorization guard: only teachers can save teacher profiles
    if (!isTeacherUser) {
      setTeacherProfileError(
        currentLanguage === 'he'
          ? 'פעולה זו מיועדת למורים בלבד.'
          : 'This feature is only available for teachers.'
      );
      return;
    }

    // Price validation
    const numericPrice = Number(teacherPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setTeacherProfileError(
        currentLanguage === 'he' 
          ? 'נא להזין מחיר חוקי לשיעור (למשל: 100 ₪)' 
          : 'Please enter a valid hourly rate (e.g. 100 NIS)'
      );
      return;
    }
    const finalPrice = Math.round(numericPrice);

    // Levels validation
    if (teacherLevels.length === 0) {
      setTeacherProfileError(
        currentLanguage === 'he'
          ? 'נא לבחור לפחות כיתה או רמת לימוד אחת אותה הנך מלמד'
          : 'Please select at least one teaching grade/level'
      );
      return;
    }
    const finalLevelsArray = [...teacherLevels];
    const finalLevelsString = teacherLevels.join(', ');

    setUpdatingTeacherProfile(true);

    try {
      const targetTutorId = currentTutor?.id || currentUser.tutorProfileId || currentUser.id;
      let resolvedTutorUuid = isValidUuid(targetTutorId) ? targetTutorId : null;

      // If not a direct UUID, resolve via email in Supabase users table
      if (!resolvedTutorUuid && currentUser.email) {
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('email', currentUser.email.toLowerCase())
            .maybeSingle();
          if (userData?.id && isValidUuid(userData.id)) {
            resolvedTutorUuid = userData.id;
          }
        } catch (e) {
          console.warn('Error resolving user UUID:', e);
        }
      }

      // 1. Direct update to Supabase 'tutors' table
      if (resolvedTutorUuid) {
        const { error: dbError } = await supabase
          .from('tutors')
          .update({
            bio: teacherBio.trim(),
            experience: teacherExperience.trim(),
            education: teacherEducation.trim(),
            price: finalPrice,
            levels: finalLevelsArray
          })
          .eq('id', resolvedTutorUuid);

        if (dbError) {
          console.warn('Supabase tutors update warning, attempting upsert:', dbError.message);
          const { error: upsertErr } = await supabase
            .from('tutors')
            .upsert({
              id: resolvedTutorUuid,
              subject: currentTutor?.subject || 'שיעור פרטי',
              price: finalPrice,
              bio: teacherBio.trim(),
              experience: teacherExperience.trim(),
              education: teacherEducation.trim(),
              levels: finalLevelsArray
            });

          if (upsertErr) {
            throw new Error(upsertErr.message);
          }
        }
      } else if (targetTutorId) {
        const { error: dbError } = await supabase
          .from('tutors')
          .update({
            bio: teacherBio.trim(),
            experience: teacherExperience.trim(),
            education: teacherEducation.trim(),
            price: finalPrice,
            levels: finalLevelsArray
          })
          .eq('id', targetTutorId);

        if (dbError) {
          console.warn('Direct update by tutor id failed:', dbError.message);
        }
      }

      // 2. Immediately update the global state of tutors in the app
      const updatedTutorObj: Tutor = currentTutor 
        ? {
            ...currentTutor,
            bio: teacherBio.trim(),
            experience: teacherExperience.trim(),
            education: teacherEducation.trim(),
            price: finalPrice,
            levels: finalLevelsString
          }
        : {
            id: resolvedTutorUuid || targetTutorId || 'teacher-' + Date.now(),
            name: currentUser.name,
            email: currentUser.email,
            subject: 'שיעור פרטי',
            price: finalPrice,
            rating: 5,
            reviews: [],
            bio: teacherBio.trim(),
            experience: teacherExperience.trim(),
            education: teacherEducation.trim(),
            levels: finalLevelsString,
            availableSlots: [],
            phone: ''
          };

      const updatedTutorsList = tutors.some(t => t.id === updatedTutorObj.id || (t.email && updatedTutorObj.email && t.email.toLowerCase() === updatedTutorObj.email.toLowerCase()))
        ? tutors.map(t => (t.id === updatedTutorObj.id || (t.email && updatedTutorObj.email && t.email.toLowerCase() === updatedTutorObj.email.toLowerCase())) ? updatedTutorObj : t)
        : [...tutors, updatedTutorObj];

      onUpdateTutors(updatedTutorsList, updatedTutorObj);

      // 3. Ensure user object links properly to tutor profile ID if not already set
      if (!currentUser.tutorProfileId && updatedTutorObj.id) {
        const updatedUser = {
          ...currentUser,
          tutorProfileId: updatedTutorObj.id
        };
        onUpdateCurrentUser(updatedUser);

        try {
          if (resolvedTutorUuid) {
            await supabase.from('users').update({ tutor_profile_id: resolvedTutorUuid }).eq('id', resolvedTutorUuid);
          }
        } catch (uErr) {
          console.warn('Error updating user tutor_profile_id in DB:', uErr);
        }
      }

      setTeacherProfileSuccess(
        currentLanguage === 'he' 
          ? 'פרטי הפרופיל עודכנו בהצלחה!' 
          : 'Teacher profile updated successfully!'
      );
    } catch (err: any) {
      console.error('Error saving teacher profile:', err);
      setTeacherProfileError(
        (currentLanguage === 'he' ? 'שגיאה בעדכון פרטי מורה: ' : 'Error updating teacher profile: ') + (err?.message || 'אנא נסה שוב')
      );
    } finally {
      setUpdatingTeacherProfile(false);
    }
  };

  // Helper to parse base64 / preset avatar to CSS
  const renderAvatarPreview = () => {
    if (!avatarUrl) {
      return (
        <div className="w-24 h-24 rounded-full bg-indigo-100 border-2 border-indigo-200 flex items-center justify-center text-indigo-700 font-extrabold text-2xl uppercase">
          {initials}
        </div>
      );
    }

    if (avatarUrl.startsWith('preset:')) {
      const parts = avatarUrl.split(':');
      const emoji = parts[1] || '👨‍🏫';
      const bg = parts[2] || 'from-indigo-500 to-purple-600';
      return (
        <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${bg} border-2 border-indigo-200 flex items-center justify-center text-4xl shadow-md`}>
          {emoji}
        </div>
      );
    }

    // Otherwise base64 or URL
    return (
      <img
        src={avatarUrl}
        alt="Profile Avatar"
        className="w-24 h-24 rounded-full object-cover border-2 border-indigo-200 shadow-md"
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Clickable Overlay to close */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs animate-fade-in" onClick={onClose} />

      {/* Profile Card Container */}
      <div 
        id="user-profile-modal"
        className="relative bg-white rounded-lg w-full max-w-lg overflow-hidden shadow-2xl z-10 border border-slate-100 flex flex-col max-h-[92vh]"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-200" />
            <h2 className="text-sm font-extrabold">
              {currentLanguage === 'he' ? 'פרופיל המשתמש שלי' : 'My User Profile'}
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-white hover:bg-white/10 p-1.5 rounded transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded text-xs flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* User Email & Role Badge */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3 flex items-center justify-between text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">
                {currentLanguage === 'he' ? 'כתובת מייל:' : 'Email Address:'}
              </span>
              <span className="font-mono text-indigo-700 font-bold">{currentUser.email}</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isTeacherUser 
                ? 'bg-purple-100 text-purple-800 border-purple-200' 
                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
            }`}>
              {isTeacherUser 
                ? (currentLanguage === 'he' ? '👨‍🏫 מורה' : 'Teacher') 
                : (currentLanguage === 'he' ? '👨‍🎓 תלמיד' : 'Student')}
            </span>
          </div>

          {/* SECTION 1: AVATAR / PROFILE PHOTO */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-indigo-600" />
              <span>{currentLanguage === 'he' ? 'תמונת פרופיל' : 'Profile Picture'}</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Profile Avatar Frame */}
              <div className="relative shrink-0 group">
                {renderAvatarPreview()}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-full border-2 border-white shadow hover:scale-105 transition-all cursor-pointer"
                  title={currentLanguage === 'he' ? 'העלה תמונה מותאמת אישית' : 'Upload custom image'}
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />

              {/* Presets and text */}
              <div className="flex-1 space-y-2 text-center sm:text-start">
                <span className="text-[10px] font-bold text-slate-500 block">
                  {currentLanguage === 'he' ? 'בחר אווטאר מעוצב או העלה תמונה משלך:' : 'Select avatar preset or upload your own:'}
                </span>
                <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                  {AVATAR_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${p.bg} flex items-center justify-center text-lg hover:scale-110 hover:shadow transition-all cursor-pointer`}
                    >
                      {p.emoji}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400">
                  {currentLanguage === 'he' ? 'קבצים נתמכים: JPG, PNG. מקסימום 2MB.' : 'Supported formats: JPG, PNG. Max 2MB.'}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: UPDATE USERNAME (WITH PASSWORD CONFIRMATION) */}
          <form onSubmit={handleUpdateUsername} className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <User className="w-4 h-4 text-indigo-600" />
              <span>{currentLanguage === 'he' ? 'שינוי שם משתמש' : 'Change User Name'}</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">
                  {currentLanguage === 'he' ? 'שם משתמש חדש *' : 'New User Name *'}
                </label>
                <input
                  type="text"
                  id="profile-new-username-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white text-slate-800 font-medium"
                  placeholder={currentLanguage === 'he' ? 'הקלד שם משתמש חדש' : 'Enter new user name'}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">
                  {currentLanguage === 'he' ? 'הקלד את סיסמתך הנוכחית לאישור השינוי *' : 'Enter your password to confirm change *'}
                </label>
                <div className="relative">
                  <span className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-2.5 text-slate-400 pointer-events-none`}>
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    id="profile-confirm-password-input"
                    value={currentPasswordForUsername}
                    onChange={(e) => setCurrentPasswordForUsername(e.target.value)}
                    className={`w-full ${isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white text-slate-800`}
                    placeholder={currentLanguage === 'he' ? 'סיסמה נוכחית' : 'Current password'}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-submit-username-update"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2 rounded text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {loading 
                  ? (currentLanguage === 'he' ? 'מעדכן...' : 'Updating...') 
                  : (currentLanguage === 'he' ? 'עדכן שם משתמש' : 'Update User Name')}
              </button>
            </div>
          </form>

          {/* SECTION 2.5: CHANGE PASSWORD */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>{currentLanguage === 'he' ? 'שינוי סיסמה' : 'Change Password'}</span>
              </h3>
              <button
                type="button"
                id="btn-toggle-password-form"
                onClick={() => {
                  setShowPasswordChangeForm(!showPasswordChangeForm);
                  setError('');
                  setSuccess('');
                }}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
              >
                {showPasswordChangeForm 
                  ? (currentLanguage === 'he' ? 'ביטול' : 'Cancel')
                  : (currentLanguage === 'he' ? 'שנה סיסמה לחשבון' : 'Change account password')}
              </button>
            </div>

            {showPasswordChangeForm && (
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Method selector tabs */}
                <div className="flex rounded-lg bg-slate-200/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordChangeMethod('current_pass');
                      setError('');
                      setSuccess('');
                    }}
                    className={`flex-1 py-2 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      passwordChangeMethod === 'current_pass'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{currentLanguage === 'he' ? 'באמצעות סיסמה נוכחית' : 'With current password'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordChangeMethod('email_link');
                      setError('');
                      setSuccess('');
                    }}
                    className={`flex-1 py-2 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      passwordChangeMethod === 'email_link'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{currentLanguage === 'he' ? 'שליחת קישור למייל' : 'Send link to email'}</span>
                  </button>
                </div>

                {passwordChangeMethod === 'email_link' ? (
                  <div className="space-y-3.5 bg-white p-4 rounded-xl border border-slate-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5 border border-indigo-100">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 font-medium block">
                          {currentLanguage === 'he' ? 'כתובת המייל של החשבון:' : 'Account email address:'}
                        </span>
                        <span className="text-xs font-bold text-slate-800 break-all font-mono">
                          {currentUser.email}
                        </span>
                        <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                          {currentLanguage === 'he'
                            ? 'יישלח אליך קישור מאובטח לאיפוס סיסמה. לחיצה עליו תפתח מיד את הטופס להזנת הסיסמה החדשה.'
                            : 'A secure password reset link will be sent to your email. Clicking it will open the form to enter a new password.'}
                        </p>
                      </div>
                    </div>

                    {resetEmailSent ? (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center gap-2 font-bold text-emerald-900">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {currentLanguage === 'he' 
                              ? 'קישור לאיפוס סיסמה נשלח למייל שלך!' 
                              : 'Password reset link sent to your email!'}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                          {currentLanguage === 'he'
                            ? 'אנא בדוק את תיבת הדואר הנכנס (או הספאם). לחיצה על הקישור במייל תאפשר לך להגדיר סיסמה חדשה לחשבונך.'
                            : 'Please check your inbox (and spam folder). Clicking the email link will allow you to set a new password.'}
                        </p>
                        <div className="pt-1 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={handleSendResetEmail}
                            disabled={sendingResetEmail}
                            className="text-[11px] text-emerald-800 hover:text-emerald-950 font-bold underline cursor-pointer disabled:opacity-50"
                          >
                            {sendingResetEmail 
                              ? (currentLanguage === 'he' ? 'שולח שוב...' : 'Resending...') 
                              : (currentLanguage === 'he' ? 'שלח שוב קישור לאיפוס' : 'Resend reset link')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id="btn-send-profile-reset-link"
                        onClick={handleSendResetEmail}
                        disabled={sendingResetEmail}
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-sm hover:shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {sendingResetEmail ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>{currentLanguage === 'he' ? 'שולח קישור לאיפוס למייל...' : 'Sending reset link...'}</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 text-white" />
                            <span>{currentLanguage === 'he' ? 'שלח קישור לאיפוס סיסמה למייל' : 'Send password reset link to email'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">
                        {currentLanguage === 'he' ? 'סיסמה נוכחית *' : 'Current Password *'}
                      </label>
                      <input
                        type="password"
                        id="profile-current-pass-input"
                        value={currentPasswordForChange}
                        onChange={(e) => setCurrentPasswordForChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                        placeholder="••••••••"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">
                        {currentLanguage === 'he' ? 'סיסמה חדשה (מינימום 8 תווים) *' : 'New Password (min 8 chars) *'}
                      </label>
                      <input
                        type="password"
                        id="profile-new-pass-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                        placeholder="••••••••"
                        required
                        minLength={8}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">
                        {currentLanguage === 'he' ? 'אימות סיסמה חדשה *' : 'Confirm New Password *'}
                      </label>
                      <input
                        type="password"
                        id="profile-confirm-new-pass-input"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                        placeholder="••••••••"
                        required
                        minLength={8}
                      />
                    </div>

                    <button
                      type="submit"
                      id="btn-submit-password-change"
                      disabled={loading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{currentLanguage === 'he' ? 'מעדכן סיסמה...' : 'Updating password...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{currentLanguage === 'he' ? 'שמור סיסמה חדשה' : 'Save New Password'}</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2.7: TEACHER PROFILE DETAILS - ONLY VISIBLE TO TEACHERS */}
          {isTeacherUser && (
            <div className="pt-4 border-t border-slate-100 space-y-3" id="section-teacher-profile-edit">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <span>{currentLanguage === 'he' ? 'עריכת פרטי מורה' : 'Edit Teacher Profile'}</span>
                </h3>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                  {currentLanguage === 'he' ? 'פרופיל הוראה פעיל' : 'Active Tutor Profile'}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                {currentLanguage === 'he'
                  ? 'עדכן את פרטי הרקע, הניסיון וההשכלה שיוצגו לתלמידים בכרטיס המורה ובדף הפרופיל שלך.'
                  : 'Update your background, experience, and education shown to students on your profile card.'}
              </p>

              {teacherProfileError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{teacherProfileError}</span>
                </div>
              )}

              {teacherProfileSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg text-xs flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{teacherProfileSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSaveTeacherProfile} className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* מחיר לשיעור (Price per lesson) */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="teacher-profile-price-input" className="text-[11px] text-slate-800 font-bold flex items-center gap-1.5 cursor-pointer">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{currentLanguage === 'he' ? 'מחיר לשיעור (בש"ח לשעה)' : 'Lesson Rate (NIS / hr)'}</span>
                    </label>
                    <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ₪{teacherPrice || 0} {currentLanguage === 'he' ? 'לשעה' : '/hr'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        id="teacher-profile-price-input"
                        type="number"
                        min={20}
                        max={1000}
                        step={5}
                        value={teacherPrice}
                        onChange={(e) => setTeacherPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-slate-50/50 text-slate-800 font-bold"
                        placeholder="100"
                        required
                      />
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">
                        ₪
                      </span>
                    </div>

                    {/* Quick price presets */}
                    <div className="flex items-center gap-1">
                      {[80, 100, 120, 150].map((quickP) => (
                        <button
                          key={quickP}
                          type="button"
                          onClick={() => setTeacherPrice(quickP)}
                          className={`px-2 py-1.5 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                            Number(teacherPrice) === quickP
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          ₪{quickP}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* כיתות ורמות לימוד (Target Grades & Levels) */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-800 font-bold flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{currentLanguage === 'he' ? 'כיתות ורמות לימוד שאני מלמד' : 'Teaching Grades & Levels'}</span>
                    </label>
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                      {currentLanguage === 'he' ? `נבחרו ${teacherLevels.length}` : `${teacherLevels.length} selected`}
                    </span>
                  </div>

                  {/* Quick group filter buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleSelectLevelGroup('elementary')}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        ['כיתה א', 'כיתה ב', 'כיתה ג', 'כיתה ד', 'כיתה ה', 'כיתה ו'].every(l => teacherLevels.includes(l))
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-extrabold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {currentLanguage === 'he' ? 'יסודי (א׳-ו׳)' : 'Elementary'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectLevelGroup('middle')}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        ['כיתה ז', 'כיתה ח', 'כיתה ט'].every(l => teacherLevels.includes(l))
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-extrabold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {currentLanguage === 'he' ? 'חטיבה (ז׳-ט׳)' : 'Middle School'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectLevelGroup('high')}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        ['כיתה י', 'כיתה י"א', 'כיתה י"ב'].every(l => teacherLevels.includes(l))
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-extrabold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {currentLanguage === 'he' ? 'תיכון (י׳-י״ב)' : 'High School'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectLevelGroup('academic')}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        teacherLevels.includes('תואר ראשון')
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-extrabold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {currentLanguage === 'he' ? 'תואר ראשון' : 'University'}
                    </button>

                    <div className="ms-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllTeacherLevels}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-semibold px-1 cursor-pointer"
                      >
                        {currentLanguage === 'he' ? 'בחר הכל' : 'All'}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleClearAllTeacherLevels}
                        className="text-[10px] text-slate-500 hover:text-rose-600 underline font-semibold px-1 cursor-pointer"
                      >
                        {currentLanguage === 'he' ? 'נקה' : 'Clear'}
                      </button>
                    </div>
                  </div>

                  {/* Levels Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {AVAILABLE_LEVELS.map((lvl) => {
                      const isChecked = teacherLevels.includes(lvl);
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => handleToggleTeacherLevel(lvl)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all text-start ${
                            isChecked
                              ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-2xs font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{translateLevel(lvl, currentLanguage || 'he')}</span>
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] shrink-0 ${
                            isChecked ? 'bg-indigo-600 text-white' : 'border border-slate-300'
                          }`}>
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* אודות המורה (Bio / About) */}
                <div>
                  <label className="block text-[11px] text-slate-700 font-bold mb-1 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{currentLanguage === 'he' ? 'אודות המורה (Bio / About)' : 'About Tutor (Bio)'}</span>
                  </label>
                  <textarea
                    id="teacher-profile-bio-input"
                    rows={3}
                    value={teacherBio}
                    onChange={(e) => setTeacherBio(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white text-slate-800 leading-relaxed resize-y"
                    placeholder={currentLanguage === 'he' ? 'ספר בקצרה על עצמך, גישת ההוראה שלך ומה מייחד את השיעורים שלך...' : 'Tell students about yourself and your teaching approach...'}
                  />
                </div>

                {/* ניסיון מקצועי (Experience) */}
                <div>
                  <label className="block text-[11px] text-slate-700 font-bold mb-1 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{currentLanguage === 'he' ? 'ניסיון מקצועי (Experience)' : 'Teaching Experience'}</span>
                  </label>
                  <textarea
                    id="teacher-profile-experience-input"
                    rows={2}
                    value={teacherExperience}
                    onChange={(e) => setTeacherExperience(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white text-slate-800 leading-relaxed resize-y"
                    placeholder={currentLanguage === 'he' ? 'פירוט שנות ניסיון בהוראה, מסגרות לימוד, בתי ספר או הישגים...' : 'Years of teaching experience, schools, achievements...'}
                  />
                </div>

                {/* השכלה והכשרה (Education) */}
                <div>
                  <label className="block text-[11px] text-slate-700 font-bold mb-1 flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{currentLanguage === 'he' ? 'השכלה והכשרה (Education)' : 'Education & Qualifications'}</span>
                  </label>
                  <textarea
                    id="teacher-profile-education-input"
                    rows={2}
                    value={teacherEducation}
                    onChange={(e) => setTeacherEducation(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white text-slate-800 leading-relaxed resize-y"
                    placeholder={currentLanguage === 'he' ? 'תארים אקדמיים, מוסדות לימוד, תעודת הוראה או הכשרות רלוונטיות...' : 'Academic degrees, university, teaching certificates...'}
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  id="btn-save-teacher-profile"
                  disabled={updatingTeacherProfile}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {updatingTeacherProfile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{currentLanguage === 'he' ? 'שומר שינויים בשרת...' : 'Saving updates...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{currentLanguage === 'he' ? 'שמור עדכוני פרופיל מורה' : 'Save Teacher Profile Updates'}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* SECTION 3: LANGUAGE SETTINGS */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span>{t.languageSettings}</span>
            </h3>

            <p className="text-[10px] text-slate-500 font-medium">
              {t.interfaceLanguageDesc}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                id="lang-btn-he"
                onClick={() => onChangeLanguage && onChangeLanguage('he')}
                className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  currentLanguage === 'he'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200'
                }`}
              >
                <span>🇮🇱</span>
                <span>{t.hebrew}</span>
                {currentLanguage === 'he' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                id="lang-btn-en"
                onClick={() => onChangeLanguage && onChangeLanguage('en')}
                className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  currentLanguage === 'en'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200'
                }`}
              >
                <span>🇺🇸</span>
                <span>{t.english}</span>
                {currentLanguage === 'en' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          {onLogout ? (
            <button
              type="button"
              id="profile-modal-logout-btn"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3.5 py-2 rounded text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'he' ? 'התנתק מהחשבון' : 'Sign Out'}</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2 rounded text-xs font-bold cursor-pointer"
          >
            {currentLanguage === 'he' ? 'סגור' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
