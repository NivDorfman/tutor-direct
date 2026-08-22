import React from 'react';
import { Language } from '../lib/i18n';

interface TutorDirectLogoProps {
  className?: string;
  showText?: boolean;
  language?: Language;
  subtitle?: string;
  isDark?: boolean;
}

export function TutorDirectLogo({ 
  className = "w-10 h-10", 
  showText = true, 
  language = 'he',
  subtitle,
  isDark = false
}: TutorDirectLogoProps) {
  const isRtl = language === 'he';
  const defaultSubtitle = language === 'he' ? 'הפלטפורמה המובילה למציאת מורים פרטיים איכותיים' : 'Direct Connection to Private Tutors';

  return (
    <div className="inline-flex items-center gap-3 select-none" dir="ltr">
      {/* Icon */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} shrink-0 drop-shadow-sm`}
      >
        <defs>
          {/* Gradient for the background container */}
          <linearGradient id="logoBg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>

          {/* Accent glow for the arrow/spark */}
          <linearGradient id="accentGlow" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>

        {/* Rounded Modern Squircle Container */}
        <rect width="100" height="100" rx="26" fill="url(#logoBg)" />

        {/* Academic Cap Base Line */}
        <path
          d="M26 50 C 26 62, 74 62, 74 50"
          stroke="#ffffff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />

        {/* Graduation Diamond / Compass Arrow */}
        <path
          d="M50 24 L78 38 L50 52 L22 38 Z"
          fill="#ffffff"
        />

        {/* Direct Pointer / Forward Arrow */}
        <path
          d="M44 43 L60 38 L48 56 L47 48 Z"
          fill="url(#accentGlow)"
        />

        {/* Smart AI Sparkle */}
        <path
          d="M74 20 C74 24 78 26 80 26 C78 26 74 28 74 32 C74 28 70 26 68 26 C70 26 74 24 74 20 Z"
          fill="#38bdf8"
        />
      </svg>

      {showText && (
        <div className={`flex flex-col min-w-0 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div dir="ltr" className="inline-flex items-center">
            <span className={`text-lg sm:text-xl font-black tracking-tight leading-none whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Tutor<span className="text-indigo-600">Direct</span>
            </span>
          </div>
          <span className={`text-[9px] sm:text-[10px] font-bold tracking-wider mt-0.5 sm:mt-1 truncate max-w-[130px] sm:max-w-[260px] md:max-w-none ${isDark ? 'text-slate-300' : 'text-slate-400'}`}>
            {subtitle || defaultSubtitle}
          </span>
        </div>
      )}
    </div>
  );
}
export default TutorDirectLogo;
