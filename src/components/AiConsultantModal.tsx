import React, { useState, useEffect, useRef } from 'react';
import { Tutor } from '../types';
import { SUBJECTS_LIST } from '../initialData';
import { Language, getTranslation } from '../lib/i18n';
import { 
  X, 
  Send, 
  Sparkles, 
  BookOpen, 
  TrendingUp, 
  HelpCircle, 
  MessageSquare,
  User,
  ArrowLeft,
  DollarSign,
  Star,
  RotateCcw,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface AiConsultantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { id: string; name: string; email: string; role: 'student' | 'teacher'; tutorProfileId?: string; avatarUrl?: string } | null;
  tutors: Tutor[];
  onSelectTutor: (tutor: Tutor) => void;
  language?: Language;
}

export function AiConsultantModal({ 
  isOpen, 
  onClose, 
  currentUser, 
  tutors, 
  onSelectTutor,
  language = 'he'
}: AiConsultantModalProps) {
  const t = getTranslation(language);
  const isRtl = language === 'he';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getUserStorageKey = (user: { id?: string; email?: string } | null) => {
    if (!user) return 'tutor_ai_consult_messages_guest';
    const identifier = (user.email || user.id || 'default').toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    return `tutor_ai_consult_messages_${identifier}`;
  };

  const getInitialMessages = (): Message[] => {
    const storageKey = getUserStorageKey(currentUser);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
        }
      } catch (e) {
        console.error("Error parsing stored AI messages:", e);
      }
    }
    
    return [
      {
        sender: 'ai',
        text: isRtl
          ? `שלום **${currentUser?.name || 'תלמיד/ה'}**! אני **איידן (Aiden)**, יועץ הלימודים החכם של TutorDirect. \n\nאני כאן כדי לעזור לך למצוא את המורה הפרטי המושלם ביותר עבורך, להמליץ על שיטות למידה אפקטיביות, או לסייע לך לבנות תוכנית לימודים מסודרת למבחנים הקרובים.\n\nעל מה תרצה להתייעץ היום?`
          : `Hello **${currentUser?.name || 'Student'}**! I am **Aiden**, your smart academic advisor on TutorDirect. \n\nI am here to help you find the best private tutor, recommend effective learning strategies, or help you plan your study schedule for upcoming exams.\n\nHow can I help you today?`,
        timestamp: new Date()
      }
    ];
  };

  useEffect(() => {
    if (isOpen) {
      setMessages(getInitialMessages());
    }
  }, [isOpen, currentUser?.id, currentUser?.email, language]);

  useEffect(() => {
    if (messages.length > 0) {
      try {
        const storageKey = getUserStorageKey(currentUser);
        localStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (e) {
        console.error("Storage error:", e);
      }
    }
  }, [messages, currentUser?.id, currentUser?.email]);

  const handleNewChat = () => {
    setShowResetConfirm(true);
  };

  const confirmNewChat = () => {
    const initial: Message[] = [
      {
        sender: 'ai',
        text: isRtl
          ? `שלום **${currentUser?.name || 'תלמיד/ה'}**! אני **איידן (Aiden)**, יועץ הלימודים החכם של TutorDirect. \n\nאני כאן כדי לעזור לך למצוא את המורה הפרטי המושלם ביותר עבורך, להמליץ על שיטות למידה אפקטיביות, או לסייע לך לבנות תוכנית לימודים מסודרת למבחנים הקרובים.\n\nעל מה תרצה להתייעץ היום?`
          : `Hello **${currentUser?.name || 'Student'}**! I am **Aiden**, your smart academic advisor on TutorDirect. \n\nI am here to help you find the best private tutor, recommend effective learning strategies, or help you plan your study schedule for upcoming exams.\n\nHow can I help you today?`,
        timestamp: new Date()
      }
    ];
    setMessages(initial);
    const storageKey = getUserStorageKey(currentUser);
    localStorage.setItem(storageKey, JSON.stringify(initial));
    setError(null);
    setShowResetConfirm(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen, isLoading]);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageIndex(index);
    setTimeout(() => setCopiedMessageIndex(null), 2500);
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    setError(null);

    const apiMessages = [...messages, userMsg].map(m => ({
      sender: m.sender === 'user' ? 'user' : 'ai',
      text: m.text
    }));

    const cleanTutorsList = tutors.map(t => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      pricePerHour: t.price,
      rating: t.rating,
      reviewsCount: t.reviews.length,
      levels: t.levels,
      bio: t.bio,
      education: t.education,
      experience: t.experience
    }));

    try {
      const response = await fetch('/api/ai-consult', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          studentName: currentUser?.name || (isRtl ? 'תלמיד' : 'Student'),
          tutorsList: cleanTutorsList,
          subjects: SUBJECTS_LIST,
          language
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data) {
        const errorMsg = data?.error || (isRtl ? 'לא ניתן היה לקבל מענה מהשרת. נסה שנית בעוד רגע.' : 'Could not retrieve response from server. Please try again.');
        setError(errorMsg);
        return;
      }

      if (data.error && !data.text) {
        setError(data.error);
        return;
      }

      setMessages(prev => [...prev, {
        sender: 'ai',
        text: data.text || (isRtl ? 'סליחה, לא התקבלה תשובה תקינה.' : 'Sorry, no valid response was returned.'),
        timestamp: new Date()
      }]);
    } catch (err: any) {
      console.warn("AI Consultant Error:", err);
      setError(isRtl ? 'שגיאה בחיבור ליועץ ה-AI. אנא נסה שנית.' : 'Error connecting to AI advisor. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const findMentionedTutors = (text: string) => {
    return tutors.filter(t => {
      const tutorName = t.name.toLowerCase();
      const firstName = tutorName.split(' ')[0];
      return text.toLowerCase().includes(tutorName) || (firstName.length > 2 && text.toLowerCase().includes(firstName));
    });
  };

  const lastMessage = messages[messages.length - 1];
  const mentionedTutors = lastMessage && lastMessage.sender === 'ai' ? findMentionedTutors(lastMessage.text) : [];

  if (!isOpen) return null;

  const renderMessageText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('### ') || trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
        const title = trimmed.replace(/^#+\s*/, '');
        return (
          <h4 key={i} className="text-xs font-black text-indigo-950 mt-3 mb-1.5 pb-1 border-b border-indigo-100">
            {title}
          </h4>
        );
      }

      if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        const bulletContent = trimmed.substring(2);
        return (
          <div key={i} className="flex items-start gap-1.5 my-1 text-slate-800 pr-1">
            <span className="text-indigo-600 font-bold shrink-0 mt-0.5">•</span>
            <div className="flex-1">{formatInlineStyles(bulletContent)}</div>
          </div>
        );
      }

      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        return (
          <div key={i} className="flex items-start gap-2 my-1 text-slate-800 pr-1">
            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
              {numMatch[1]}
            </span>
            <div className="flex-1">{formatInlineStyles(numMatch[2])}</div>
          </div>
        );
      }

      if (!trimmed) {
        return <div key={i} className="h-2" />;
      }

      return (
        <p key={i} className="leading-relaxed mb-1.5 last:mb-0 text-slate-800">
          {formatInlineStyles(line)}
        </p>
      );
    });
  };

  const formatInlineStyles = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="font-extrabold text-indigo-950">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={j} className="text-slate-700 italic">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={j} className="bg-indigo-50 text-indigo-800 font-mono px-1 py-0.5 rounded text-[11px] font-semibold">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const quickPrompts = isRtl ? [
    { text: "איזה מורה מומלץ למתמטיקה 5 יחידות?", icon: BookOpen },
    { text: "יש לכם מורים לאנגלית בפחות מ-130 ש״ח לשעה?", icon: DollarSign },
    { text: "איך כדאי לי להתכונן לשיעור פרטי ראשון?", icon: HelpCircle },
    { text: "איך לבנות תוכנית לימודים למבחן בפיזיקה?", icon: TrendingUp },
  ] : [
    { text: "Which tutor is recommended for high school Math?", icon: BookOpen },
    { text: "Are there English tutors under 130 ₪/hour?", icon: DollarSign },
    { text: "How should I prepare for my first private lesson?", icon: HelpCircle },
    { text: "How to build an effective study plan for exams?", icon: TrendingUp },
  ];

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 font-sans" 
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div 
        id="ai-consultant-modal"
        className="relative bg-slate-50 rounded-2xl max-w-3xl w-full h-[90vh] sm:h-[84vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight">{t.aiConsultantTitle}</h2>
                <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300/30 uppercase tracking-wider">
                  Gemini AI
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-indigo-200 truncate max-w-[280px] sm:max-w-md">
                {t.aiConsultantSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-ai-new-chat"
              onClick={handleNewChat}
              className="px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title={isRtl ? "שיחה חדשה" : "New Chat"}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRtl ? "שיחה חדשה" : "New Chat"}</span>
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer"
              title={t.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5 bg-slate-50/50">
          {messages.map((m, idx) => (
            <div 
              key={idx} 
              className={`flex gap-3 max-w-[90%] sm:max-w-[85%] ${
                m.sender === 'user' 
                  ? (isRtl ? 'mr-auto flex-row-reverse text-left' : 'ml-auto text-right') 
                  : (isRtl ? 'ml-auto text-right' : 'mr-auto text-left')
              }`}
            >
              <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border shadow-xs ${
                m.sender === 'user' 
                  ? 'bg-indigo-600 text-white border-indigo-700' 
                  : 'bg-white border-slate-200 text-indigo-600'
              }`}>
                {m.sender === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>

              <div className={`rounded-2xl p-4 shadow-sm text-xs leading-relaxed transition-all ${
                m.sender === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-none'
              }`}>
                {m.sender === 'user' ? (
                  <p className="whitespace-pre-wrap font-medium">{m.text}</p>
                ) : (
                  <div className="select-text space-y-1">
                    {renderMessageText(m.text)}
                  </div>
                )}

                <div className={`flex items-center justify-between pt-2 mt-2 border-t text-[10px] ${
                  m.sender === 'user' ? 'border-white/15 text-indigo-100' : 'border-slate-100 text-slate-400'
                }`}>
                  <span>
                    {m.timestamp.toLocaleTimeString(isRtl ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {m.sender === 'ai' && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(m.text, idx)}
                      className="hover:text-indigo-600 text-slate-500 font-bold flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      {copiedMessageIndex === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-extrabold">{isRtl ? 'הועתק!' : 'Copied!'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{isRtl ? 'העתק' : 'Copy'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Mentions Helper Cards */}
          {mentionedTutors.length > 0 && !isLoading && (
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3.5 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h4 className="text-[11px] font-extrabold text-indigo-900 flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isRtl ? 'מורים מומלצים שהוזכרו בשיחה:' : 'Recommended tutors mentioned:'}</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {mentionedTutors.map(tutor => (
                  <div key={tutor.id} className="bg-white p-3 rounded-xl border border-indigo-100 flex items-center justify-between gap-3 shadow-xs">
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">{tutor.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold">{tutor.subject} • {tutor.price} ₪/{t.perHour}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span className="text-[10px] font-extrabold text-slate-700">{tutor.rating.toFixed(1)}</span>
                        <span className="text-[9px] text-slate-400">({tutor.reviews.length} {t.reviews})</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTutor(tutor);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <span>{isRtl ? 'צפה בפרופיל' : 'View Profile'}</span>
                      <ArrowLeft className={`w-3 h-3 ${!isRtl && 'rotate-180'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className={`flex gap-3 max-w-[85%] ${isRtl ? 'ml-auto text-right' : 'mr-auto text-left'}`}>
              <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border bg-white border-slate-200 shadow-xs">
                <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
              </div>
              <div className="bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm text-xs flex items-center gap-3">
                <span className="font-extrabold text-indigo-700 animate-pulse">{t.aiThinking}</span>
                <span className="flex gap-1">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></span>
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold">{isRtl ? 'שגיאה בעיבוד הבקשה' : 'Request Error'}</p>
                <p className="mt-0.5 text-slate-600">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Question Prompts */}
        {messages.length <= 2 && !isLoading && (
          <div className="px-4 py-2.5 bg-slate-100/80 border-t border-slate-200 shrink-0 overflow-x-auto">
            <p className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>{isRtl ? 'שאלות נפוצות להתחלה:' : 'Suggested questions:'}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt, pIdx) => {
                const IconComponent = prompt.icon;
                return (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => handleSendMessage(prompt.text)}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer text-right"
                  >
                    <IconComponent className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span>{prompt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input Footer */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              id="ai-chat-input-field"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t.aiPlaceholder}
              className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white px-4 py-2.5 rounded-xl text-xs outline-none transition-all"
              disabled={isLoading}
            />

            <button
              type="submit"
              id="btn-ai-send"
              disabled={!inputText.trim() || isLoading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer shadow-md font-bold text-xs gap-1.5 hover:scale-105 active:scale-95"
            >
              <span>{t.send}</span>
              <Send className={`w-4 h-4 ${isRtl ? 'transform rotate-180' : ''}`} />
            </button>
          </form>

          <div className="mt-2 text-center">
            <span className="text-[10px] text-slate-400 font-medium">
              {isRtl ? 'היועץ החכם מבוסס על Gemini ומתאים מורים ומסייע בלמידה.' : 'Intelligent academic advisor powered by Gemini.'}
            </span>
          </div>
        </div>

        {/* Reset / New Chat Dialog */}
        {showResetConfirm && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 font-sans">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200 text-right">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 text-center mb-2">
                {isRtl ? 'התחלת שיחה חדשה' : 'Start New Chat'}
              </h3>
              <p className="text-xs text-slate-500 text-center mb-6 leading-relaxed">
                {isRtl 
                  ? 'האם אתה בטוח שברצונך להתחיל שיחה חדשה ולנקות את היסטוריית השיחה עם ה-AI?' 
                  : 'Are you sure you want to start a new chat and clear the conversation history?'}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={confirmNewChat}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer text-center shadow-sm"
                >
                  {isRtl ? 'כן, התחל מחדש' : 'Yes, Start New'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
