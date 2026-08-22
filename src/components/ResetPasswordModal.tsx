import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound, Sparkles, X, ShieldCheck } from 'lucide-react';
import { Language, getTranslation } from '../lib/i18n';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  language?: Language;
  onPasswordUpdated?: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  userEmail = '',
  language = 'he',
  onPasswordUpdated,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isRtl = language === 'he';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPass = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPass) {
      setError(language === 'he' ? 'נא להזין סיסמה חדשה' : 'Please enter a new password');
      return;
    }

    if (cleanPass.length < 8) {
      setError(language === 'he' ? 'הסיסמה החדשה חייבת להכיל לפחות 8 תווים' : 'Password must be at least 8 characters');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setError(language === 'he' ? 'הסיסמאות אינן תואמות. אנא ודא שהסיסמה זהה בשני השדות' : 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Update Supabase Auth user password
      const { data: updateData, error: authError } = await supabase.auth.updateUser({
        password: cleanPass,
      });

      if (authError) {
        console.error('Supabase updateUser error:', authError);
        // If authError happens because of expired link, provide clear guidance
        setError(
          language === 'he'
            ? `שגיאה בעדכון הסיסמה: ${authError.message}. אם פג תוקף הקישור, אנא בקש קישור איפוס חדש.`
            : `Error updating password: ${authError.message}`
        );
        setIsLoading(false);
        return;
      }

      const targetEmail = (userEmail || updateData?.user?.email || '').trim().toLowerCase();

      // 2. Update Supabase 'users' table
      if (targetEmail) {
        try {
          await supabase
            .from('users')
            .update({ password: cleanPass })
            .ilike('email', targetEmail);
        } catch (dbErr) {
          console.warn('Error updating password in users table:', dbErr);
        }
      }

      // 3. Update localStorage registered_users
      try {
        const storedUsers = localStorage.getItem('registered_users');
        if (storedUsers) {
          const users = JSON.parse(storedUsers);
          const idx = users.findIndex((u: any) => targetEmail && u.email?.toLowerCase() === targetEmail);
          if (idx !== -1) {
            users[idx].password = cleanPass;
            localStorage.setItem('registered_users', JSON.stringify(users));
          }
        }
      } catch (e) {}

      // 4. Send confirmation email
      if (targetEmail) {
        try {
          await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: targetEmail,
              type: 'password_changed',
            }),
          });
        } catch (e) {}
      }

      setSuccess(true);
      if (onPasswordUpdated) {
        onPasswordUpdated();
      }

      // Auto close after 2.5 seconds
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      console.error('Unexpected error updating password:', err);
      setError(
        language === 'he'
          ? 'ארעה שגיאה בלתי צפויה בעדכון הסיסמה. אנא נסה שוב.'
          : 'An unexpected error occurred while updating password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200">
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-6 text-white text-center relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 p-1.5 rounded-full text-indigo-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={language === 'he' ? 'סגור' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner border border-white/20">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-xl font-black tracking-tight">
            {language === 'he' ? 'הגדרת סיסמה חדשה' : 'Set New Password'}
          </h3>
          <p className="text-xs text-indigo-100/90 mt-1 max-w-xs mx-auto">
            {language === 'he'
              ? 'קישור האימות מהאימייל זוהה בהצלחה! הזן כעת סיסמה חדשה לחשבונך'
              : 'Password reset link verified! Please enter your new password below'}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7">
          {success ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-slate-800">
                {language === 'he' ? 'הסיסמה עודכנה בהצלחה!' : 'Password Updated Successfully!'}
              </h4>
              <p className="text-xs text-slate-600">
                {language === 'he'
                  ? 'הסיסמה החדשה נשמרה בבטחה. הנך מחובר כעת לחשבונך!'
                  : 'Your new password has been securely saved. You are now logged in!'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {userEmail && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div className="truncate">
                    <span className="text-slate-400 font-medium block text-[10px]">
                      {language === 'he' ? 'כתובת החשבון המאומתת' : 'Account Email'}
                    </span>
                    <strong className="text-slate-800 font-semibold">{userEmail}</strong>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{error}</span>
                </div>
              )}

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  {language === 'he' ? 'סיסמה חדשה (מינימום 8 תווים)' : 'New Password (min 8 chars)'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white text-slate-800 ${
                      isRtl ? 'pr-10 pl-10' : 'pl-10 pr-10'
                    }`}
                  />
                  <Lock className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'}`} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer ${
                      isRtl ? 'left-2.5' : 'right-2.5'
                    }`}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  {language === 'he' ? 'אימות סיסמה חדשה' : 'Confirm New Password'}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white text-slate-800 ${
                      isRtl ? 'pr-10 pl-10' : 'pl-10 pr-10'
                    }`}
                  />
                  <Lock className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'}`} />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer ${
                      isRtl ? 'left-2.5' : 'right-2.5'
                    }`}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

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
                      <span>{language === 'he' ? 'עדכן סיסמה' : 'Update Password'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
