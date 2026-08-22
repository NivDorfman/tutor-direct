import React, { useState, useEffect } from 'react';
import { Tutor, TimeSlot } from '../types';
import { SUBJECTS_LIST } from '../initialData';
import { supabase } from '../lib/supabase';
import { dayTimeToIso } from '../lib/slotUtils';
import { validateRegistration, normalizePhoneNumber } from '../lib/businessLogic';
import { TutorDirectLogo } from './TutorDirectLogo';
import { 
  GraduationCap, 
  BookOpen, 
  Lock, 
  Mail, 
  User, 
  Phone, 
  Plus, 
  Trash2, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Send,
  ExternalLink
} from 'lucide-react';

interface AuthScreenProps {
  onLogin: (user: { id: string; name: string; email: string; role: 'student' | 'teacher'; tutorProfileId?: string; avatarUrl?: string }) => void;
  existingTutors: Tutor[];
  onRegisterTutor: (tutorData: Omit<Tutor, 'id' | 'rating' | 'reviews'>, forceId?: string) => string; // returns newly created tutor id
  initialMode?: 'login' | 'register' | 'forgot_password';
  initialResetStep?: 'email' | 'link_sent' | 'new_password' | 'done';
  recoveryUserEmail?: string;
  onResetSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ 
  onLogin, 
  existingTutors, 
  onRegisterTutor,
  initialMode,
  initialResetStep,
  recoveryUserEmail,
  onResetSuccess
}) => {
  const isUrlRecovery = typeof window !== 'undefined' && (
    window.location.hash.includes('type=recovery') || 
    window.location.search.includes('type=recovery')
  );

  // Main view modes: 'login' | 'register' | 'forgot_password'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>(
    initialMode || (isUrlRecovery ? 'forgot_password' : 'login')
  );
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMagicLink, setIsLoadingMagicLink] = useState(false);

  // Registration state
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [teacherStep, setTeacherStep] = useState(1); // 1 = credentials, 2 = profile details

  // Teacher registration fields
  const [subject, setSubject] = useState(SUBJECTS_LIST[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [price, setPrice] = useState<number>(100);
  const [phone, setPhone] = useState('');
  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [bio, setBio] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [newDay, setNewDay] = useState('יום ראשון');
  const [newTime, setNewTime] = useState('16:00 - 17:00');

  // Password Reset state (Link-based verification)
  const [resetStep, setResetStep] = useState<'email' | 'link_sent' | 'new_password' | 'done'>(
    initialResetStep || (isUrlRecovery ? 'new_password' : 'email')
  );
  const [resetEmail, setResetEmail] = useState(recoveryUserEmail || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Sync props if they change
  useEffect(() => {
    if (initialMode) setAuthMode(initialMode);
    if (initialResetStep) setResetStep(initialResetStep);
    if (recoveryUserEmail) setResetEmail(recoveryUserEmail);
  }, [initialMode, initialResetStep, recoveryUserEmail]);

  // Auto-detect password recovery from link click in email
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes('type=recovery') || search.includes('type=recovery')) {
        setAuthMode('forgot_password');
        setResetStep('new_password');
        setSuccessMsg('קישור האימות אומת בהצלחה! אנא הזן את הסיסמה החדשה לחשבונך.');
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user?.email) {
            setResetEmail(session.user.email);
          }
        });
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('forgot_password');
        setResetStep('new_password');
        if (session?.user?.email) {
          setResetEmail(session.user.email);
        }
        setSuccessMsg('קישור האימות אומת בהצלחה! אנא הזן את הסיסמה החדשה לחשבונך.');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Notifications
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const daysOfWeek = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'מוצ״ש'];

  // Add Time Slot
  const addSlot = () => {
    if (!newTime.trim()) return;
    const newSlot: TimeSlot = {
      id: `slot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      day: newDay,
      time: newTime,
      isBooked: false
    };
    setSlots([...slots, newSlot]);
    setNewTime('');
  };

  // Remove Time Slot
  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  // ==========================================
  // 1. MAGIC LINK & OTP SUBMIT (Supabase signInWithOtp)
  // ==========================================
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const handleSendMagicLink = async () => {
    const userEmail = email.trim().toLowerCase();
    if (!userEmail) {
      setError('נא להזין כתובת אימייל כדי לקבל קישור התחברות');
      alert('נא להזין כתובת אימייל כדי לקבל קישור התחברות');
      return;
    }

    setError('');
    setSuccessMsg('');
    setIsLoadingMagicLink(true);

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
          shouldCreateUser: true,
        },
      });

      if (error) {
        console.error("Supabase OTP error:", error);
        setError("שגיאה בשליחת המייל: " + error.message);
        alert("שגיאה בשליחת המייל: " + error.message);
        return;
      }

      setMagicLinkSent(true);
      setSuccessMsg("קישור התחברות נשלח בהצלחה לכתובת המייל! אנא בדוק גם בתיקיית הספאם (Spam).");
      alert("קישור התחברות נשלח בהצלחה לכתובת המייל!");
    } catch (err: any) {
      console.error("Supabase OTP error:", err);
      const errMsg = err?.message || 'שגיאה בלתי צפויה';
      setError("שגיאה בשליחת המייל: " + errMsg);
      alert("שגיאה בשליחת המייל: " + errMsg);
    } finally {
      setIsLoadingMagicLink(false);
    }
  };

  const handleVerifyOtpToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const userEmail = email.trim().toLowerCase();
    const cleanToken = otpToken.trim();

    if (!userEmail || !cleanToken) {
      setError('נא להזין את קוד האימות שנשלח למייל');
      return;
    }

    setError('');
    setSuccessMsg('');
    setIsVerifyingOtp(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: cleanToken,
        type: 'email',
      });

      if (error) {
        console.error("Supabase verifyOtp error:", error);
        setError("קוד האימות שגוי או פג תוקף: " + error.message);
        return;
      }

      if (data?.user) {
        setSuccessMsg("האימות הצליח! מתחבר למערכת...");
      }
    } catch (err: any) {
      console.error("verifyOtp error:", err);
      setError("שגיאה באימות הקוד: " + (err?.message || 'אנא נסה שוב'));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ==========================================
  // 2. LOGIN SUBMIT (Supabase Authentication)
  // ==========================================
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('אימייל או סיסמה שגויים');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Direct query against Supabase 'users' table
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (userRow) {
        const dbPassword = userRow.password;

        // Verify password
        let isPasswordCorrect = false;

        if (dbPassword) {
          // Compare password directly
          isPasswordCorrect = (dbPassword === cleanPassword);
        } else {
          // If the user in DB had an empty password column, check local fallback or default demo password
          const stored = localStorage.getItem('registered_users');
          let localMatchPassword: string | null = null;
          if (stored) {
            try {
              const users = JSON.parse(stored);
              const foundLocal = users.find((u: any) => u.email.toLowerCase() === cleanEmail);
              if (foundLocal && foundLocal.password) {
                localMatchPassword = foundLocal.password;
              }
            } catch (e) {}
          }
          const expectedPassword = localMatchPassword || '123456';
          isPasswordCorrect = (cleanPassword === expectedPassword);
        }

        if (!isPasswordCorrect) {
          setError('אימייל או סיסמה שגויים');
          setIsLoading(false);
          return;
        }

        // Authentication successful! Check tutor profile if teacher
        let tutorProfileId = userRow.tutor_profile_id || userRow.tutorProfileId;
        if (userRow.role === 'teacher') {
          const { data: tutorRow } = await supabase
            .from('tutors')
            .select('id')
            .eq('id', userRow.id)
            .maybeSingle();
          if (tutorRow) {
            tutorProfileId = tutorRow.id;
          } else {
            tutorProfileId = userRow.id;
          }
        }

        const authenticatedUser = {
          id: userRow.id,
          name: userRow.name || cleanEmail.split('@')[0],
          email: userRow.email,
          role: userRow.role as 'student' | 'teacher',
          avatarUrl: userRow.avatar_url || userRow.avatarUrl,
          tutorProfileId
        };

        // Cache in local storage
        localStorage.setItem('current_user', JSON.stringify(authenticatedUser));
        onLogin(authenticatedUser);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Supabase login error:', err);
    }

    // 2. Local fallback for offline / demo users
    const storedUsers = localStorage.getItem('registered_users');
    if (storedUsers) {
      try {
        const users = JSON.parse(storedUsers);
        const matchedLocalUser = users.find((u: any) => u.email.toLowerCase() === cleanEmail);
        if (matchedLocalUser) {
          if (matchedLocalUser.password !== cleanPassword) {
            setError('אימייל או סיסמה שגויים');
            setIsLoading(false);
            return;
          }

          const localAuth = {
            id: matchedLocalUser.id,
            name: matchedLocalUser.name,
            email: matchedLocalUser.email,
            role: matchedLocalUser.role,
            avatarUrl: matchedLocalUser.avatarUrl,
            tutorProfileId: matchedLocalUser.tutorProfileId
          };
          localStorage.setItem('current_user', JSON.stringify(localAuth));
          onLogin(localAuth);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    // 3. Check pre-seeded demo tutors in existingTutors
    const matchedTutor = existingTutors.find(t => t.email.toLowerCase() === cleanEmail);
    if (matchedTutor) {
      if (cleanPassword !== '123456') {
        setError('אימייל או סיסמה שגויים');
        setIsLoading(false);
        return;
      }

      const tutorAuth = {
        id: `user-${matchedTutor.id}`,
        name: matchedTutor.name,
        email: matchedTutor.email,
        role: 'teacher' as const,
        avatarUrl: matchedTutor.avatarUrl,
        tutorProfileId: matchedTutor.id
      };
      localStorage.setItem('current_user', JSON.stringify(tutorAuth));
      onLogin(tutorAuth);
      setIsLoading(false);
      return;
    }

    // 4. Not found
    setError('אימייל או סיסמה שגויים');
    setIsLoading(false);
  };

  // ==========================================
  // 2. REGISTRATION SUBMIT (Supabase Sync)
  // ==========================================
  const handleRegisterNextOrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const finalSubject = isCustomSubject ? customSubject : subject;
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Gather existing names and phones
    const storedUsers = localStorage.getItem('registered_users');
    const registered = storedUsers ? JSON.parse(storedUsers) : [];
    const allExistingNames = [
      ...existingTutors.map(t => t.name),
      ...registered.map((u: any) => u.name)
    ].filter(Boolean);
    const allExistingPhones = [
      ...existingTutors.map(t => t.phone),
      ...registered.map((u: any) => u.phone)
    ].filter(Boolean);

    const validation = validateRegistration({
      name: cleanName,
      email: cleanEmail,
      password,
      confirmPassword,
      role,
      phone,
      bio,
      education,
      experience,
      subject: finalSubject,
      existingNames: allExistingNames,
      existingPhones: role === 'teacher' ? allExistingPhones : undefined
    }, role === 'teacher' && teacherStep === 1 ? 1 : 2);

    if (!validation.valid) {
      setError(validation.error || 'שגיאה באימות הפרטים');
      return;
    }

    if (!confirmPassword) {
      setError('נא להקליד את הסיסמה בשנית לאימות');
      return;
    }

    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות. אנא ודא שהסיסמאות בשתי התיבות זהות');
      return;
    }

    // Local existence checks
    const nameExistsLocal = registered.some((u: any) => u.name && u.name.trim().toLowerCase() === cleanName.toLowerCase()) || 
                            existingTutors.some(t => t.name && t.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (nameExistsLocal) {
      setError('שם משתמש זה כבר קיים במערכת, אנא בחר שם אחר');
      return;
    }

    const emailExistsLocal = registered.some((u: any) => u.email.toLowerCase() === cleanEmail) || 
                             existingTutors.some(t => t.email.toLowerCase() === cleanEmail);
    if (emailExistsLocal) {
      setError('כתובת אימייל זו כבר רשומה במערכת');
      return;
    }

    // Teacher Phone uniqueness locally
    if (role === 'teacher' && phone && teacherStep === 2) {
      const normInputPhone = normalizePhoneNumber(phone);
      const phoneExistsLocal = registered.some((u: any) => u.phone && normalizePhoneNumber(u.phone) === normInputPhone) ||
                               existingTutors.some(t => t.phone && normalizePhoneNumber(t.phone) === normInputPhone);
      if (phoneExistsLocal) {
        setError('מספר טלפון זה כבר קיים במערכת, אנא בחר מספר אחר');
        return;
      }
    }

    // Supabase existence checks
    try {
      // 1. Name check
      const { data: dbNameCheck } = await supabase
        .from('users')
        .select('id, name')
        .ilike('name', cleanName)
        .maybeSingle();
      if (dbNameCheck) {
        setError('שם משתמש זה כבר קיים במערכת, אנא בחר שם אחר');
        return;
      }

      // 2. Email check
      const { data: dbUserCheck } = await supabase
        .from('users')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();
      if (dbUserCheck) {
        setError('כתובת אימייל זו כבר רשומה במערכת');
        return;
      }

      // 3. Phone check
      if (role === 'teacher' && phone && teacherStep === 2) {
        const normInputPhone = normalizePhoneNumber(phone);
        const { data: dbUsersWithPhone } = await supabase
          .from('users')
          .select('id, phone')
          .not('phone', 'is', null);

        if (dbUsersWithPhone && dbUsersWithPhone.some((u: any) => u.phone && normalizePhoneNumber(u.phone) === normInputPhone)) {
          setError('מספר טלפון זה כבר קיים במערכת, אנא בחר מספר אחר');
          return;
        }
      }
    } catch (err) {
      console.warn('Supabase validation check skipped:', err);
    }

    if (role === 'teacher' && teacherStep === 1) {
      // Advance to step 2 for teachers
      setTeacherStep(2);
      return;
    }

    setIsLoading(true);
    let createdUserId = `user-${Date.now()}`;
    let tutorProfileId: string | undefined = undefined;

    // 1. Create row in Supabase 'users' table with password column
    try {
      const userPayload: any = {
        name: cleanName,
        email: cleanEmail,
        role,
        password: password.trim()
      };
      if (role === 'teacher') {
        userPayload.phone = phone;
      }

      const userInsertResult = await supabase
        .from('users')
        .insert(userPayload)
        .select()
        .single();

      if (userInsertResult.error) {
        console.error('Supabase user insert error:', userInsertResult.error);
        // If there's an error inserting, try without custom id if auto-gen
        setError('שגיאה ברישום המשתמש בשרת: ' + userInsertResult.error.message);
        setIsLoading(false);
        return;
      }

      if (userInsertResult.data) {
        createdUserId = userInsertResult.data.id;
      }
    } catch (err: any) {
      console.error('Supabase user creation error:', err);
    }

    // 2. If teacher, create matching row in 'tutors' table and 'slots' table
    if (role === 'teacher') {
      try {
        const { error: dbTutorError } = await supabase
          .from('tutors')
          .insert({
            id: createdUserId,
            subject: finalSubject,
            price: Number(price),
            education,
            experience,
            bio,
            levels: ['תיכון']
          });

        if (dbTutorError) {
          console.error('Supabase tutor insert error:', dbTutorError);
          setError('שגיאה ברישום פרופיל המורה בשרת: ' + dbTutorError.message);
          setIsLoading(false);
          return;
        }

        // Insert slots
        if (slots.length > 0) {
          const slotsToInsert = slots.map(s => ({
            tutor_id: createdUserId,
            datetime: dayTimeToIso(s.day, s.time),
            is_booked: Boolean(s.isBooked)
          }));
          await supabase.from('slots').insert(slotsToInsert);
        }

        tutorProfileId = createdUserId;
      } catch (err) {
        console.error('Supabase tutor registration error:', err);
      }

      // Register tutor in parent app state
      onRegisterTutor({
        name: cleanName,
        subject: finalSubject,
        price,
        phone,
        email: cleanEmail,
        education,
        experience,
        bio,
        availableSlots: slots
      }, createdUserId);
    }

    // 3. Save user locally for fallback
    const newUser = {
      id: createdUserId,
      name: cleanName,
      email: cleanEmail,
      password: password.trim(),
      role,
      tutorProfileId: tutorProfileId
    };

    registered.push(newUser);
    localStorage.setItem('registered_users', JSON.stringify(registered));
    localStorage.setItem('current_user', JSON.stringify(newUser));

    setSuccessMsg('נרשמת בהצלחה למערכת!');
    setIsLoading(false);
    
    setTimeout(() => {
      onLogin(newUser);
    }, 800);
  };

  // ==========================================
  // 3. PASSWORD RESET VIA EMAIL LINK (Supabase Auth)
  // ==========================================
  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    const cleanEmail = resetEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('אנא הזן כתובת אימייל תקינה');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Direct call to Supabase Auth to send Password Recovery Link directed to /reset-password
      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/reset-password` 
        : undefined;

      const { error: supaErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (supaErr) {
        console.error("Supabase resetPasswordForEmail error:", supaErr);
        setError("שגיאה בשליחת קישור איפוס הסיסמה: " + supaErr.message);
        setIsLoading(false);
        return;
      }

      // 2. Dispatch custom notification email if available
      try {
        await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            type: 'reset_link'
          })
        });
      } catch (errApi) {}

      setSuccessMsg(`קישור לאיפוס סיסמה נשלח בהצלחה לכתובת ${cleanEmail}! לחץ על הקישור במייל כדי לשנות סיסמה.`);
      setResetStep('link_sent');
    } catch (err: any) {
      console.error('Error during password reset link request:', err);
      setError('ארעה שגיאה בשליחת קישור האיפוס למייל: ' + (err?.message || 'אנא נסה שוב'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!newPassword || newPassword.length < 8) {
      setError('הסיסמה החדשה חייבת להכיל לפחות 8 תווים');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('הסיסמאות אינן תואמות, אנא הזן סיסמה זהה בשני השדות');
      return;
    }

    setIsLoading(true);
    const cleanEmail = resetEmail.trim().toLowerCase();

    try {
      // 1. Update Supabase Auth user password
      const { data: updateData, error: updateAuthErr } = await supabase.auth.updateUser({
        password: newPassword.trim(),
      });

      if (updateAuthErr) {
        console.error("Supabase updateUser error:", updateAuthErr);
        setError("שגיאה בעדכון הסיסמה ב-Supabase: " + updateAuthErr.message);
        setIsLoading(false);
        return;
      }

      const finalEmail = cleanEmail || updateData?.user?.email || '';

      // 2. Update Supabase 'users' table password column
      if (finalEmail) {
        const { error: dbUpdateError } = await supabase
          .from('users')
          .update({ password: newPassword.trim() })
          .eq('email', finalEmail);

        if (dbUpdateError) {
          console.error('Supabase users table password update error:', dbUpdateError);
        }
      }

      // 3. Update local storage registered_users
      const storedUsers = localStorage.getItem('registered_users');
      if (storedUsers) {
        try {
          const users = JSON.parse(storedUsers);
          const idx = users.findIndex((u: any) => finalEmail ? u.email?.toLowerCase() === finalEmail : false);
          if (idx !== -1) {
            users[idx].password = newPassword.trim();
            localStorage.setItem('registered_users', JSON.stringify(users));
          }
        } catch (e) {}
      }

      // 4. Send confirmation email to user's email address
      if (finalEmail) {
        try {
          await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: finalEmail,
              type: 'password_changed'
            })
          });
        } catch (e) {}
      }

      setSuccessMsg('הסיסמה עודכנה בהצלחה! כעת תוכל להתחבר לחשבונך עם הסיסמה החדשה.');
      setResetStep('done');

      // Clean URL hash
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      // Auto redirect to login after 1.5s
      setTimeout(() => {
        onResetSuccess?.();
        if (finalEmail) {
          setEmail(finalEmail);
        }
        setPassword(newPassword.trim());
        setAuthMode('login');
        setResetStep('email');
        setNewPassword('');
        setConfirmNewPassword('');
      }, 1500);

    } catch (err: any) {
      setError('שגיאה בעדכון הסיסמה: ' + (err.message || 'נסה שוב מאוחר יותר'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-right" dir="rtl">
      
      {/* Decorative branding header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center justify-center text-center mb-8">
        <TutorDirectLogo className="w-14 h-14" subtitle="רשת מורים פרטיים חכמה" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 sm:px-10 border border-slate-200 rounded shadow-sm space-y-6">
          
          {/* Header Switch Tabs (Shown only when not in forgot_password mode) */}
          {authMode !== 'forgot_password' ? (
            <div className="flex border-b border-slate-200 pb-1">
              <button
                type="button"
                id="tab-login"
                onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); setConfirmPassword(''); }}
                className={`w-1/2 pb-3 text-center font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  authMode === 'login' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                התחברות לחשבון
              </button>
              <button
                type="button"
                id="tab-register"
                onClick={() => { setAuthMode('register'); setError(''); setSuccessMsg(''); setTeacherStep(1); setConfirmPassword(''); }}
                className={`w-1/2 pb-3 text-center font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  authMode === 'register' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                הרשמה למשתמש חדש
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-800">איפוס סיסמה לחשבון</h3>
              </div>
              <button
                type="button"
                id="btn-back-to-login"
                onClick={() => {
                  setAuthMode('login');
                  setError('');
                  setSuccessMsg('');
                  setResetStep('email');
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>חזרה להתחברות</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {error && (
            <div id="auth-error-banner" className="bg-rose-50 text-rose-700 p-3.5 rounded text-xs border border-rose-100 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div id="auth-success-banner" className="bg-emerald-50 text-emerald-800 p-3.5 rounded text-xs border border-emerald-200 flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ================= MODE: LOGIN ================= */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4" id="login-form">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">כתובת אימייל</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    id="login-email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pr-10 pl-4 py-2.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">סיסמה</label>
                  <button
                    type="button"
                    id="btn-forgot-password-link"
                    onClick={() => {
                      setAuthMode('forgot_password');
                      setResetEmail(email);
                      setError('');
                      setSuccessMsg('');
                      setResetStep('email');
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                  >
                    שכחת סיסמה?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="login-password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-10 py-2.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-submit-login"
                disabled={isLoading || isLoadingMagicLink}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-4 rounded text-xs transition-colors cursor-pointer shadow-sm mt-2 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>מתחבר למערכת...</span>
                  </>
                ) : (
                  <span>התחבר למערכת</span>
                )}
              </button>

              {/* Magic Link Section */}
              <div className="relative my-3 pt-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="bg-white px-3 text-slate-400 font-medium">או התחברות מהירה באמצעות מייל</span>
                </div>
              </div>

              {!magicLinkSent ? (
                <button
                  type="button"
                  id="btn-magic-link-login"
                  onClick={handleSendMagicLink}
                  disabled={isLoadingMagicLink || isLoading}
                  className="w-full bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-indigo-700 font-bold py-2.5 px-4 rounded text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {isLoadingMagicLink ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span>שולח קישור התחברות למייל...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>שלח קישור התחברות / OTP למייל</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-lg space-y-3">
                  <div className="text-center">
                    <p className="text-[11px] font-bold text-indigo-900">קישור אימות נשלח אל {email}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">באפשרותך ללחוץ על הקישור במייל, או להזין את קוד האימות בן 6 ספרות:</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={8}
                      value={otpToken}
                      onChange={(e) => setOtpToken(e.target.value)}
                      placeholder="קוד בן 6 ספרות"
                      className="flex-1 px-3 py-2 text-center font-mono font-bold tracking-widest text-xs border border-indigo-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtpToken}
                      disabled={isVerifyingOtp || !otpToken.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded transition cursor-pointer"
                    >
                      {isVerifyingOtp ? 'מאמת...' : 'אמת קוד'}
                    </button>
                  </div>
                  <div className="flex justify-between items-center text-[10px] pt-1">
                    <button
                      type="button"
                      onClick={handleSendMagicLink}
                      disabled={isLoadingMagicLink}
                      className="text-indigo-600 hover:underline font-bold cursor-pointer"
                    >
                      שלח קישור שוב
                    </button>
                    <button
                      type="button"
                      onClick={() => setMagicLinkSent(false)}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      חזור
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* ================= MODE: REGISTER ================= */}
          {authMode === 'register' && (
            <form onSubmit={handleRegisterNextOrSubmit} className="space-y-5" id="register-form">
              
              {role === 'teacher' && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded border border-slate-200 text-xs text-slate-600 font-bold mb-2">
                  <span>רישום מורה: שלב {teacherStep} מתוך 2</span>
                  <div className="flex gap-1">
                    <span className={`w-2 h-2 rounded-full ${teacherStep >= 1 ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                    <span className={`w-2 h-2 rounded-full ${teacherStep >= 2 ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                  </div>
                </div>
              )}

              {teacherStep === 1 ? (
                /* Step 1: Base Credentials & Role Selection */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">שם מלא</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        id="reg-name-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="למשל: יובל כהן"
                        className="w-full pr-10 pl-4 py-2.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">כתובת אימייל</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        id="reg-email-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yourname@domain.com"
                        className="w-full pr-10 pl-4 py-2.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">סיסמה לחשבון</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="reg-password-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="מינימום 8 תווים"
                        className="w-full pr-10 pl-10 py-2.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">אימות סיסמה</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        id="reg-confirm-password-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="הקלד שוב את הסיסמה"
                        className={`w-full pr-10 pl-10 py-2.5 text-xs border rounded focus:outline-none focus:ring-1 bg-white ${
                          confirmPassword && confirmPassword !== password
                            ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                            : confirmPassword && confirmPassword === password
                            ? 'border-emerald-400 focus:ring-emerald-500 focus:border-emerald-500'
                            : 'border-slate-200 focus:ring-indigo-600 focus:border-indigo-600'
                        }`}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showConfirmPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>הסיסמאות אינן תואמות</span>
                      </p>
                    )}
                    {confirmPassword && confirmPassword === password && (
                      <p className="text-[11px] text-emerald-600 mt-1 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>הסיסמאות זהות</span>
                      </p>
                    )}
                  </div>

                  {/* Visual Role Selector */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-bold text-slate-700">סוג החשבון המבוקש *</label>
                    <div className="grid grid-cols-2 gap-4">
                      
                      {/* Student Option */}
                      <button
                        type="button"
                        id="role-btn-student"
                        onClick={() => setRole('student')}
                        className={`p-4 rounded border text-right transition-all flex flex-col gap-2 cursor-pointer ${
                          role === 'student'
                            ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${role === 'student' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-xs text-slate-800 block">תלמיד / הורה</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block leading-tight">אני מעוניין לחפש מורים ולתאם שיעורים פרטיים</span>
                        </div>
                      </button>

                      {/* Teacher Option */}
                      <button
                        type="button"
                        id="role-btn-teacher"
                        onClick={() => setRole('teacher')}
                        className={`p-4 rounded border text-right transition-all flex flex-col gap-2 cursor-pointer ${
                          role === 'teacher'
                            ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${role === 'teacher' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-xs text-slate-800 block">מורה פרטי</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block leading-tight">אני מעוניין לפרסם את הפרופיל שלי וללמד</span>
                        </div>
                      </button>

                    </div>
                  </div>

                  <button
                    type="submit"
                    id="btn-register-step1-submit"
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-4 rounded text-xs transition-colors cursor-pointer shadow-sm mt-3 flex items-center justify-center gap-1.5"
                  >
                    <span>{role === 'student' ? 'השלם הרשמה כתלמיד' : 'המשך להגדרת פרופיל מורה'}</span>
                    {role === 'teacher' && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                /* Step 2: Teacher Profile details */
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 rounded p-3 text-[11px] text-indigo-800 leading-relaxed">
                    🌟 <strong>מעולה!</strong> כעת הגדר את פרטי הפרופיל המקצועי שלך. הפרטים יישמרו ב-Supabase ויאפשרו לתלמידים לתאם איתך שיעורים.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">מקצוע לימוד ראשי *</label>
                      <select
                        value={isCustomSubject ? 'אחר' : subject}
                        onChange={(e) => {
                          if (e.target.value === 'אחר') {
                            setIsCustomSubject(true);
                          } else {
                            setIsCustomSubject(false);
                            setSubject(e.target.value);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                      >
                        {SUBJECTS_LIST.map((subj) => (
                          <option key={subj} value={subj}>{subj}</option>
                        ))}
                        <option value="אחר">אחר (הקלדה חופשית)...</option>
                      </select>
                    </div>

                    {isCustomSubject && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">הזן מקצוע מותאם אישית *</label>
                        <input
                          type="text"
                          placeholder="למשל: ספרדית, ביולוגיה"
                          value={customSubject}
                          onChange={(e) => setCustomSubject(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">מחיר מבוקש לשעה (₪) *</label>
                      <input
                        type="number"
                        min="20"
                        max="500"
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
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
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white text-right"
                        dir="ltr"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">השכלה אקדמית והסמכות *</label>
                    <input
                      type="text"
                      placeholder="למשל: תואר ראשון במתמטיקה מאוניברסיטת בן גוריון"
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ניסיון מקצועי בהוראה *</label>
                    <input
                      type="text"
                      placeholder="למשל: 3 שנות ניסיון כמורה פרטי והכנה לבחינות בגרות"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">על עצמי וגישת הלימוד (מינימום 20 תווים) *</label>
                    <textarea
                      placeholder="ספר קצת על עצמך, הסגנון שלך ואיך אתה עוזר לתלמידים להצליח..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded min-h-[80px]"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setTeacherStep(1)}
                      className="w-1/3 py-2.5 border border-slate-200 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer text-center"
                    >
                      חזור
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-2/3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-2.5 rounded text-xs transition-colors cursor-pointer shadow-sm text-center"
                    >
                      {isLoading ? 'רושם בשרת...' : 'השלם רישום ופרסם פרופיל'}
                    </button>
                  </div>

                </div>
              )}

            </form>
          )}

          {/* ================= MODE: FORGOT PASSWORD (LINK-BASED) ================= */}
          {authMode === 'forgot_password' && (
            <div className="space-y-5" id="forgot-password-container">
              
              {/* STEP 1: Enter Email to receive Reset Link */}
              {resetStep === 'email' && (
                <form onSubmit={handleSendResetLink} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    הזן את כתובת האימייל שלך. נשלח אליך קישור מאובטח לאיפוס סיסמה ישירות למייל.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">כתובת אימייל</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        id="reset-email-input"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="yourname@example.com"
                        className="w-full pr-10 pl-4 py-2.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="btn-send-reset-link"
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-4 rounded text-xs transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>שולח קישור למייל...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>שלח קישור לאיפוס סיסמה למייל</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: Link Sent Confirmation Screen */}
              {resetStep === 'link_sent' && (
                <div className="space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <Mail className="w-6 h-6" />
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-sm text-slate-800">קישור איפוס נשלח למייל!</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      שלחנו קישור מאובטח לאיפוס סיסמה אל:
                    </p>
                    <div className="inline-block bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-mono font-semibold px-3 py-1.5 rounded-md">
                      {resetEmail}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-slate-600 text-xs text-right space-y-1.5">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                      <span>מה עליך לעשות עכשיו?</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px]">
                      <li>היכנס לתיבת הדואר של <strong>{resetEmail}</strong></li>
                      <li>פתח את ההודעה מ-Supabase / המערכת (בדוק גם בתיקיית הספאם / Spam)</li>
                      <li>לחץ על כפתור או קישור האיפוס בהודעה</li>
                      <li>תועבר ישירות למסך הגדרת הסיסמה החדשה</li>
                    </ol>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setResetStep('email')}
                      className="w-1/2 py-2.5 border border-slate-200 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer text-center"
                    >
                      שנה כתובת מייל
                    </button>
                    <button
                      type="button"
                      onClick={handleSendResetLink}
                      disabled={isLoading}
                      className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded text-xs transition cursor-pointer text-center flex items-center justify-center gap-1"
                    >
                      {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>שלח קישור שוב</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Enter New Password (Triggered after clicking link) */}
              {resetStep === 'new_password' && (
                <form onSubmit={handleUpdateNewPassword} className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>קישור האיפוס אומת בהצלחה! אנא בחר סיסמה חדשה לחשבונך.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">סיסמה חדשה</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        id="new-password-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="מינימום 8 תווים"
                        className="w-full pr-10 pl-10 py-2.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">אימות סיסמה חדשה</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        id="confirm-new-password-input"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="הקלד שוב את הסיסמה החדשה"
                        className="w-full pr-10 pl-4 py-2.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
                        required
                        minLength={8}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="btn-save-new-password"
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-4 rounded text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>מעדכן סיסמה ב-Supabase...</span>
                      </>
                    ) : (
                      <span>שמור סיסמה חדשה והתחבר</span>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 4: Done */}
              {resetStep === 'done' && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-800">הסיסמה עודכנה בהצלחה!</h4>
                  <p className="text-xs text-slate-500">מעביר אותך למסך ההתחברות...</p>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
