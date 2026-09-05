'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  GraduationCap,
  Home
} from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  // 1. On page mount, check existing session or listen to onAuthStateChange (PASSWORD_RECOVERY event)
  useEffect(() => {
    let isMounted = true;

    const checkAuthStatus = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (session?.user && isMounted) {
          setIsSessionActive(true);
          setUserEmail(session.user.email || '');
        }
      } catch (err) {
        console.error('Error checking session on reset-password page:', err);
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    };

    checkAuthStatus();

    // Listen to Auth State Changes (specifically PASSWORD_RECOVERY or SIGNED_IN)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[ResetPasswordPage] Auth Event:', event);
      if (session?.user && isMounted) {
        setIsSessionActive(true);
        setUserEmail(session.user.email || '');
        setIsCheckingSession(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Countdown timer when success is true
  useEffect(() => {
    if (!success) return;

    if (redirectCountdown <= 0) {
      router.push('/');
      return;
    }

    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [success, redirectCountdown, router]);

  // 2. Handle Password Update Form Submit
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPass = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPass) {
      setError('אנא הזן סיסמה חדשה.');
      return;
    }

    if (cleanPass.length < 8) {
      setError('הסיסמה החדשה חייבת להכיל לפחות 8 תווים.');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setError('הסיסמאות אינן תואמות. אנא ודא שהסיסמה זהה בשני השדות.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Call supabase.auth.updateUser with new password
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: cleanPass,
      });

      if (updateError) {
        console.error('supabase.auth.updateUser error:', updateError);
        setError(`שגיאה בעדכון הסיסמה: ${updateError.message}. אם פג תוקף הקישור, אנא בקש קישור חדש.`);
        setIsLoading(false);
        return;
      }

      const activeEmail = (userEmail || data?.user?.email || '').trim().toLowerCase();

      // 2. Synchronize password in 'users' table
      if (activeEmail) {
        try {
          await supabase
            .from('users')
            .update({ password: cleanPass })
            .ilike('email', activeEmail);
        } catch (dbErr) {
          console.warn('Could not sync password to users table:', dbErr);
        }
      }

      // 3. Update localStorage registered_users & current_user so user remains logged in
      try {
        const storedUsers = localStorage.getItem('registered_users');
        if (storedUsers) {
          const users = JSON.parse(storedUsers);
          const idx = users.findIndex((u: any) => activeEmail && u.email?.toLowerCase() === activeEmail);
          if (idx !== -1) {
            users[idx].password = cleanPass;
            localStorage.setItem('registered_users', JSON.stringify(users));

            // Set current_user session for immediate seamless access on home page
            const currentUserObj = {
              id: users[idx].id || data?.user?.id || 'usr_' + Date.now(),
              name: users[idx].name || data?.user?.user_metadata?.name || activeEmail.split('@')[0],
              email: activeEmail,
              role: users[idx].role || 'student',
              tutorProfileId: users[idx].tutorProfileId,
              avatarUrl: users[idx].avatarUrl,
            };
            localStorage.setItem('current_user', JSON.stringify(currentUserObj));
          }
        }
      } catch (storageErr) {
        console.warn('LocalStorage sync warning:', storageErr);
      }

      // 4. Send confirmation email notification
      if (activeEmail) {
        try {
          await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: activeEmail,
              type: 'password_changed',
            }),
          });
        } catch (emailErr) {}
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Unexpected error in reset-password page:', err);
      setError('ארעה שגיאה בלתי צפויה בעת עדכון הסיסמה. אנא נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans antialiased text-slate-800" dir="rtl">
      {/* Background visual accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200/50 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-200/50 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-200/80 mb-4">
            <div className="bg-indigo-600 text-white p-1.5 rounded-xl shadow-xs">
              <GraduationCap className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-violet-700 bg-clip-text text-transparent">
              TutorDirect
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            איפוס והגדרת סיסמה חדשה
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            הגדר סיסמה חדשה ומאובטחת עבור החשבון שלך
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden">
          {/* Top colored highlight */}
          <div className="h-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600" />

          <div className="p-6 sm:p-8">
            {isCheckingSession ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-slate-600 font-medium">מאמת את קישור האיפוס...</p>
              </div>
            ) : success ? (
              /* Success State */
              <div className="text-center py-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-emerald-200 animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-slate-900">
                    הסיסמה עודכנה בהצלחה!
                  </h2>
                  <p className="text-sm text-slate-600">
                    הסיסמה החדשה נשמרה בחשבונך. הנך מועבר כעת לעמוד הראשי...
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => router.push('/')}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>מעבר לעמוד הראשי כעת ({redirectCountdown})</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </div>
            ) : (
              /* Form State */
              <form onSubmit={handleUpdatePassword} className="space-y-5">
                {userEmail && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-slate-700">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <span className="text-slate-400 font-medium block text-[11px]">כתובת החשבון המאומתת</span>
                      <strong className="text-slate-800 font-bold">{userEmail}</strong>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed font-medium">{error}</span>
                  </div>
                )}

                {/* New Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    סיסמה חדשה (מינימום 8 תווים)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pr-10 pl-10 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white text-slate-800 transition-all"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    אימות סיסמה חדשה
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pr-10 pl-10 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white text-slate-800 transition-all"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title={showConfirmPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>עדכן סיסמה</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer Navigation Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-bold transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>חזרה לעמוד הראשי</span>
          </button>
        </div>
      </div>
    </main>
  );
}
