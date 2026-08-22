import React, { useState, useRef } from 'react';
import { X, User, Camera, Check, AlertCircle, Upload, Globe, Lock, Loader2, LogOut } from 'lucide-react';
import { Tutor } from '../types';
import { supabase, isValidUuid } from '../lib/supabase';
import { Language, getTranslation } from '../lib/i18n';
import { uploadAvatarImage, saveUserAvatarInSupabase } from '../lib/storageUtils';

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
  const [passwordChangeMethod, setPasswordChangeMethod] = useState<'current_pass' | 'email_otp'>('current_pass');
  const [profileOtpGenerated, setProfileOtpGenerated] = useState('');
  const [profileOtpEntered, setProfileOtpEntered] = useState('');
  const [profileOtpSent, setProfileOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  // Status/Error messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

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

  // Send OTP to user's email for password change
  const handleSendProfileResetOtp = async () => {
    setError('');
    setSuccess('');
    setSendingOtp(true);

    try {
      const cleanEmail = currentUser.email.trim().toLowerCase();
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setProfileOtpGenerated(code);

      // 1. Dispatch real email via /api/send-otp
      try {
        await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            code,
            name: currentUser.name,
            type: 'otp'
          })
        });
      } catch (e) {
        console.warn('API send-otp invocation error:', e);
      }

      // 2. Also trigger Supabase auth reset password email
      try {
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
        });
      } catch (e) {}

      setProfileOtpSent(true);
      setSuccess(
        currentLanguage === 'he'
          ? `קוד אימות נשלח לכתובת המייל ${cleanEmail}`
          : `Verification code was sent to ${cleanEmail}`
      );
    } catch (err) {
      setError(
        currentLanguage === 'he'
          ? 'שגיאה בשליחת קוד אימות למייל'
          : 'Error sending verification code to email'
      );
    } finally {
      setSendingOtp(false);
    }
  };

  // Update Password directly in Supabase
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordChangeMethod === 'current_pass' && !currentPasswordForChange) {
      setError(currentLanguage === 'he' ? 'נא להזין סיסמה נוכחית' : 'Please enter current password');
      return;
    }

    if (passwordChangeMethod === 'email_otp') {
      if (!profileOtpEntered.trim()) {
        setError(currentLanguage === 'he' ? 'נא להזין את קוד האימות שנשלח למייל' : 'Please enter the verification code sent to your email');
        return;
      }
      if (profileOtpEntered.trim() !== profileOtpGenerated.trim()) {
        setError(currentLanguage === 'he' ? 'קוד האימות שהוקלד שגוי, אנא נסה שוב' : 'The verification code entered is incorrect');
        return;
      }
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
      // 1. Verify current password if using current_pass method
      if (passwordChangeMethod === 'current_pass') {
        const correctPassword = await getStoredPassword();
        if (currentPasswordForChange !== correctPassword) {
          setError(currentLanguage === 'he' ? 'הסיסמה הנוכחית שהוקלדה שגויה' : 'Incorrect current password');
          setLoading(false);
          return;
        }
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
      setProfileOtpEntered('');
      setProfileOtpGenerated('');
      setProfileOtpSent(false);
      setShowPasswordChangeForm(false);
    } catch (err: any) {
      setError(currentLanguage === 'he' ? 'ארעה שגיאה בעדכון הסיסמה' : 'Error updating password');
    } finally {
      setLoading(false);
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

          {/* User Email Badge */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3 flex items-center justify-between text-xs text-indigo-900">
            <span className="font-bold text-slate-600">
              {currentLanguage === 'he' ? 'כתובת מייל:' : 'Email Address:'}
            </span>
            <span className="font-mono text-indigo-700 font-bold">{currentUser.email}</span>
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
              <form onSubmit={handleUpdatePassword} className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                {/* Method selector tabs */}
                <div className="flex rounded-md bg-slate-200/70 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordChangeMethod('current_pass');
                      setError('');
                      setSuccess('');
                    }}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded transition-all cursor-pointer ${
                      passwordChangeMethod === 'current_pass'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {currentLanguage === 'he' ? 'באמצעות סיסמה נוכחית' : 'With current password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordChangeMethod('email_otp');
                      setError('');
                      setSuccess('');
                    }}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded transition-all cursor-pointer ${
                      passwordChangeMethod === 'email_otp'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {currentLanguage === 'he' ? 'שליחת קוד למייל' : 'Send code to email'}
                  </button>
                </div>

                {passwordChangeMethod === 'current_pass' ? (
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">
                      {currentLanguage === 'he' ? 'סיסמה נוכחית *' : 'Current Password *'}
                    </label>
                    <input
                      type="password"
                      id="profile-current-pass-input"
                      value={currentPasswordForChange}
                      onChange={(e) => setCurrentPasswordForChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-3 bg-white p-3 rounded border border-slate-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">
                        {currentLanguage === 'he' ? 'אימייל לקבלת הקוד:' : 'Email for code:'} <strong>{currentUser.email}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleSendProfileResetOtp}
                        disabled={sendingOtp}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded text-[11px] border border-indigo-200 transition cursor-pointer disabled:opacity-50"
                      >
                        {sendingOtp 
                          ? (currentLanguage === 'he' ? 'שולח...' : 'Sending...') 
                          : profileOtpSent 
                          ? (currentLanguage === 'he' ? 'שלח שוב קוד' : 'Resend code') 
                          : (currentLanguage === 'he' ? 'שלח קוד למייל שלי' : 'Send code to my email')}
                      </button>
                    </div>

                    {profileOtpSent && (
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold mb-1">
                          {currentLanguage === 'he' ? 'קוד אימות בן 6 ספרות (שנשלח למייל) *' : '6-digit verification code (from email) *'}
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={profileOtpEntered}
                          onChange={(e) => setProfileOtpEntered(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-3 py-2 text-center tracking-widest font-mono text-sm font-bold border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                          placeholder="XXXXXX"
                          required
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-1">
                    {currentLanguage === 'he' ? 'סיסמה חדשה (מינימום 8 תווים) *' : 'New Password (min 8 chars) *'}
                  </label>
                  <input
                    type="password"
                    id="profile-new-pass-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
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
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                    placeholder="••••••••"
                    required
                    minLength={8}
                  />
                </div>

                <button
                  type="submit"
                  id="btn-submit-password-change"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2.5 rounded text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {loading 
                    ? (currentLanguage === 'he' ? 'מעדכן סיסמה ושולח אישור למייל...' : 'Updating password and sending email...') 
                    : (currentLanguage === 'he' ? 'שמור סיסמה חדשה ושלח אישור' : 'Save New Password & Send Confirmation')}
                </button>
              </form>
            )}
          </div>

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
