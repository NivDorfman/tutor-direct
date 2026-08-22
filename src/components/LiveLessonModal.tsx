'use client';

import React, { useState, useEffect } from 'react';
import { Booking } from '../types';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { Video, Maximize2, Minimize2, Loader2, Calendar, PhoneOff } from 'lucide-react';
import { Language, getTranslation, translateSubject } from '../lib/i18n';

interface LiveLessonModalProps {
  booking: Booking;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: 'student' | 'teacher';
    tutorProfileId?: string;
    avatarUrl?: string;
  };
  onClose: () => void;
  onCompleteLesson?: (bookingId: string) => void;
  language?: Language;
}

const CustomSpinner: React.FC<{ language?: Language }> = ({ language = 'he' }) => (
  <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300 p-8" dir={language === 'he' ? 'rtl' : 'ltr'}>
    <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
    <p className="text-sm font-bold text-white">
      {language === 'he' ? 'מתחבר לחדר הווידאו של השיעור...' : 'Connecting to the live lesson video room...'}
    </p>
    <p className="text-xs text-slate-400">
      {language === 'he' ? 'אנא אשר גישה למצלמה ולמיקרופון בדפדפן במידת הצורך' : 'Please allow camera and microphone access if prompted'}
    </p>
  </div>
);

export const LiveLessonModal: React.FC<LiveLessonModalProps> = ({
  booking,
  currentUser,
  onClose,
  onCompleteLesson,
  language = 'he'
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const isRtl = language === 'he';

  useEffect(() => {
    setIsClient(true);
  }, []);

  const roomSeed = `${booking.tutorId || ''}-${booking.slot?.day || ''}-${booking.slot?.time || ''}`.replace(/[^a-zA-Z0-9]/g, '');
  const roomName = `TutorDirect-${roomSeed || booking.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  const isTeacher = currentUser.role === 'teacher';
  const partnerName = isTeacher ? booking.studentName : booking.tutorName;

  const handleClose = () => {
    if (onCompleteLesson) {
      onCompleteLesson(booking.id);
    }
    onClose();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      {/* Modal Container */}
      <div 
        id="live-lesson-modal"
        className={`relative bg-slate-900 rounded-xl overflow-hidden shadow-2xl z-10 border border-slate-700 flex flex-col transition-all duration-300 ${
          isFullscreen 
            ? 'w-full h-full max-w-none max-h-none rounded-none' 
            : 'w-full max-w-5xl h-[88vh]'
        }`}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between z-20 shrink-0 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Video className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  {language === 'he' ? 'שיעור וידאו חי:' : 'Live Video Lesson:'} {translateSubject(booking.subject, language)}
                </h2>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>{language === 'he' ? 'בשידור חי' : 'Live Now'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate flex items-center gap-2">
                <span>{isTeacher ? `${language === 'he' ? 'תלמיד:' : 'Student:'} ${partnerName}` : `${language === 'he' ? 'מורה:' : 'Tutor:'} ${partnerName}`}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {booking.slot.day} ({booking.slot.time})
                </span>
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="live-lesson-fullscreen-btn"
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? (language === 'he' ? "צא ממסך מלא" : "Exit Fullscreen") : (language === 'he' ? "מסך מלא" : "Fullscreen")}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              id="live-lesson-end-btn"
              onClick={handleClose}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              title={language === 'he' ? "סיום שיעור ויציאה" : "End lesson and exit"}
            >
              <PhoneOff className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'he' ? 'סיום שיעור' : 'End Lesson'}</span>
            </button>
          </div>
        </div>

        {/* Video Area (Jitsi Meeting) */}
        <div className="flex-1 relative bg-slate-950 overflow-hidden min-h-0 w-full" dir="ltr">
          {isClient ? (
            <JitsiMeeting
              domain="meet.jit.si"
              roomName={roomName}
              configOverwrite={{
                startWithAudioMuted: false,
                disableModeratorIndicator: true,
                startScreenSharing: false,
                enableEmailInStats: false,
                prejoinPageEnabled: false,
                disableDeepLinking: true,
                toolbarButtons: [
                  'camera',
                  'chat',
                  'closedcaptions',
                  'desktop',
                  'fullscreen',
                  'hangup',
                  'microphone',
                  'participants-pane',
                  'profile',
                  'raisehand',
                  'settings',
                  'tileview',
                  'toggle-camera',
                  'videoquality',
                  'whiteboard'
                ]
              }}
              interfaceConfigOverwrite={{
                DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                TOOLBAR_ALWAYS_VISIBLE: true,
                SHOW_BRAND_WATERMARK: false
              }}
              userInfo={{
                displayName: currentUser.name,
                email: currentUser.email
              }}
              onReadyToClose={handleClose}
              getIFrameRef={(parentNode) => {
                if (parentNode) {
                  parentNode.style.height = '100%';
                  parentNode.style.width = '100%';
                }
              }}
              spinner={() => <CustomSpinner language={language} />}
            />
          ) : (
            <CustomSpinner language={language} />
          )}
        </div>
      </div>
    </div>
  );
};
