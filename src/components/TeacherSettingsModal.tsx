import React, { useState, useRef } from 'react';
import { Tutor, StudyMaterial } from '../types';
import { 
  X, 
  Settings, 
  Check, 
  Plus, 
  Sparkles, 
  BookOpen, 
  DollarSign, 
  AlertCircle, 
  Trash2, 
  GraduationCap, 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  Layers, 
  Loader2, 
  FileUp,
  FolderOpen,
  Camera,
  User
} from 'lucide-react';
import { SUBJECTS_LIST } from '../initialData';
import { Language, getTranslation, translateSubject, translateLevel } from '../lib/i18n';
import { uploadStudyMaterial, formatFileSize, uploadAvatarImage, saveUserAvatarInSupabase } from '../lib/storageUtils';
import { StudyMaterialsSection } from './StudyMaterialsSection';
import { supabase, isValidUuid, resolveUserUuid } from '../lib/supabase';

// Presets for quick selection
const AVATAR_PRESETS = [
  { id: 'p1', emoji: '👨‍🏫', bg: 'from-blue-500 to-indigo-600', label: 'מורה' },
  { id: 'p2', emoji: '👩‍🏫', bg: 'from-pink-500 to-rose-600', label: 'מורה' },
  { id: 'p3', emoji: '🧑‍💻', bg: 'from-emerald-500 to-teal-600', label: 'מתכנת' },
  { id: 'p4', emoji: '📐', bg: 'from-amber-500 to-orange-600', label: 'מתמטיקה' },
  { id: 'p5', emoji: '🧪', bg: 'from-purple-500 to-indigo-600', label: 'מדעים' },
  { id: 'p6', emoji: '📚', bg: 'from-sky-500 to-blue-600', label: 'ספרים' },
];

export const AVAILABLE_LEVELS = [
  'כיתה א', 'כיתה ב', 'כיתה ג', 'כיתה ד', 'כיתה ה', 'כיתה ו',
  'כיתה ז', 'כיתה ח', 'כיתה ט', 'כיתה י', 'כיתה י"א', 'כיתה י"ב',
  'תואר ראשון'
];

interface TeacherSettingsModalProps {
  tutor: Tutor;
  onUpdateTutorProfile: (tutorId: string, updatedFields: Partial<Tutor>) => void;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
  language?: Language;
}

export const TeacherSettingsModal: React.FC<TeacherSettingsModalProps> = ({ 
  tutor, 
  onUpdateTutorProfile, 
  onClose,
  onRefresh,
  language = 'he'
}) => {
  const t = getTranslation(language);
  const isRtl = language === 'he';

  // Refresh data from Supabase on mount
  React.useEffect(() => {
    if (onRefresh) {
      onRefresh().catch(err => console.warn('Failed to refresh data on opening TeacherSettingsModal:', err));
    }
  }, [onRefresh]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'profile' | 'materials'>('profile');

  // Parsing currently taught subjects & levels
  const initialSubjects = tutor.subject ? tutor.subject.split(',').map(s => s.trim()).filter(Boolean) : [];
  const initialLevels = tutor.levels ? tutor.levels.split(',').map(l => l.trim()).filter(Boolean) : [];
  
  // Profile State variables
  const [avatarUrl, setAvatarUrl] = useState<string>(tutor.avatarUrl || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(initialSubjects);
  const [selectedLevels, setSelectedLevels] = useState<string[]>(initialLevels);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [price, setPrice] = useState<number>(tutor.price);
  const [bio, setBio] = useState<string>(tutor.bio || '');
  const [education, setEducation] = useState<string>(tutor.education || '');
  const [experience, setExperience] = useState<string>(tutor.experience || '');
  
  // Materials Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialType, setMaterialType] = useState<StudyMaterial['type']>('formula_sheet');
  const [materialDescription, setMaterialDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Toggle subject selection
  const handleToggleSubject = (subjectName: string) => {
    setError('');
    if (selectedSubjects.includes(subjectName)) {
      setSelectedSubjects(selectedSubjects.filter(s => s !== subjectName));
    } else {
      setSelectedSubjects([...selectedSubjects, subjectName]);
    }
  };

  // Toggle level selection
  const handleToggleLevel = (levelName: string) => {
    setError('');
    if (selectedLevels.includes(levelName)) {
      setSelectedLevels(selectedLevels.filter(l => l !== levelName));
    } else {
      setSelectedLevels([...selectedLevels, levelName]);
    }
  };

  // Add custom subject
  const handleAddCustomSubject = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = customSubjectInput.trim();
    
    if (!trimmed) {
      setError(language === 'he' ? 'אנא הקלד שם מקצוע חוקי' : 'Please enter a valid subject name');
      return;
    }
    
    if (selectedSubjects.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setError(language === 'he' ? 'מקצוע זה כבר מוגדר בפרופיל שלך' : 'This subject is already in your profile');
      return;
    }

    setSelectedSubjects([...selectedSubjects, trimmed]);
    setCustomSubjectInput('');
  };

  // Remove selected subject
  const handleRemoveSubject = (subjectName: string) => {
    setSelectedSubjects(selectedSubjects.filter(s => s !== subjectName));
  };

  // Save profile changes
  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (selectedSubjects.length === 0) {
      setError(language === 'he' ? 'עליך לבחור לפחות מקצוע אחד שאתה מלמד' : 'Please select at least one subject you teach');
      return;
    }

    if (selectedLevels.length === 0) {
      setError(language === 'he' ? 'עליך לבחור לפחות כיתה או רמת לימוד אחת שאתה מלמד' : 'Please select at least one grade/level you teach');
      return;
    }

    if (price < 40 || price > 1000) {
      setError(language === 'he' ? 'עלות השיעור צריכה להיות בין 40 ל-1,000 ש"ח לשעה' : 'Hourly price must be between 40 and 1,000');
      return;
    }

    if (!bio.trim()) {
      setError(language === 'he' ? 'אנא כתוב תיאור קצר על עצמך (Bio)' : 'Please write a brief bio');
      return;
    }

    // Merge into comma-separated string
    const finalSubjectString = selectedSubjects.join(', ');
    const finalLevelsString = selectedLevels.join(', ');

    // Invoke update handler
    onUpdateTutorProfile(tutor.id, {
      subject: finalSubjectString,
      levels: finalLevelsString,
      price,
      bio: bio.trim(),
      education: education.trim(),
      experience: experience.trim(),
      avatarUrl: avatarUrl
    });

    if (avatarUrl) {
      // Direct Supabase update with 'avatar' column
      (async () => {
        try {
          if (tutor.id) {
            await supabase
              .from('users')
              .update({ avatar: avatarUrl, avatar_url: avatarUrl } as any)
              .eq('id', tutor.id);
            await supabase
              .from('tutors')
              .update({ avatar: avatarUrl, avatar_url: avatarUrl } as any)
              .eq('id', tutor.id);
          }
          if (tutor.email) {
            await supabase
              .from('users')
              .update({ avatar: avatarUrl, avatar_url: avatarUrl } as any)
              .ilike('email', tutor.email.trim());
          }
        } catch (e) {}
      })();

      saveUserAvatarInSupabase({
        id: tutor.id,
        email: tutor.email,
        name: tutor.name,
        role: 'teacher',
        tutorProfileId: tutor.id
      }, avatarUrl).catch(err => console.warn('Sync avatar to Supabase in settings:', err));
    }

    setSuccess(language === 'he' ? 'הגדרות הפרופיל שלך עודכנו בהצלחה!' : 'Profile updated successfully!');
    setTimeout(() => {
      setSuccess('');
      onClose();
    }, 1500);
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!materialTitle.trim()) {
        // Auto-fill title with file name without extension
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setMaterialTitle(nameWithoutExt);
      }
    }
  };

  // Handle File Upload to Supabase Storage & study_materials Table
  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedFile) {
      setError(language === 'he' ? 'אנא בחר קובץ להעלאה' : 'Please select a file to upload');
      return;
    }

    if (!materialTitle.trim()) {
      setError(language === 'he' ? 'אנא הזן כותרת לחומר הלימוד' : 'Please enter a title for the material');
      return;
    }

    setIsUploading(true);

    try {
      // 1. Upload the physical file to Supabase Storage (or Data URL fallback)
      const newMaterial = await uploadStudyMaterial(
        tutor.id,
        selectedFile,
        materialTitle,
        materialType,
        materialDescription
      );

      // 2. Resolve the teacher's UUID in Supabase
      let tutorUuid = isValidUuid(tutor.id) ? tutor.id : null;
      if (!tutorUuid) {
        tutorUuid = await resolveUserUuid({
          id: tutor.id,
          email: tutor.email,
          name: tutor.name,
          role: 'teacher'
        });
      }

      let savedMaterial = newMaterial;

      // 3. Insert directly into Supabase 'study_materials' table
      if (tutorUuid) {
        const { data, error: insertError } = await supabase
          .from('study_materials')
          .insert([
            {
              tutor_id: tutorUuid, // ה-UUID של המורה
              name: newMaterial.name || newMaterial.fileName || 'חומר לימוד חדש',
              type: newMaterial.type || 'summary',
              file_name: newMaterial.fileName || newMaterial.name,
              file_type: newMaterial.fileType || 'pdf',
              file_size: newMaterial.fileSize || '1 MB',
              file_url: newMaterial.fileUrl || '',
              description: newMaterial.description || ''
            }
          ])
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('Error inserting study material:', insertError.message);
        } else if (data) {
          savedMaterial = {
            id: data.id,
            name: data.name || newMaterial.name,
            type: (data.type as StudyMaterial['type']) || newMaterial.type,
            fileUrl: data.file_url || newMaterial.fileUrl,
            fileName: data.file_name || newMaterial.fileName,
            fileType: data.file_type || newMaterial.fileType,
            fileSize: data.file_size || newMaterial.fileSize,
            description: data.description || newMaterial.description,
            uploadedAt: data.uploaded_at ? new Date(data.uploaded_at).toISOString().split('T')[0] : newMaterial.uploadedAt
          };
        }
      }

      // 4. Update the local state & React tutor profile
      const existingMaterials = tutor.studyMaterials || [];
      const updatedMaterials = [savedMaterial, ...existingMaterials];

      onUpdateTutorProfile(tutor.id, {
        studyMaterials: updatedMaterials
      });

      if (onRefresh) {
        onRefresh().catch(err => console.warn('Background refresh after material upload:', err));
      }

      setSuccess(t.uploadSuccess);
      setSelectedFile(null);
      setMaterialTitle('');
      setMaterialDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Failed to upload material:', err);
      setError(err?.message || (language === 'he' ? 'אירעה שגיאה בעת העלאת הקובץ' : 'Error uploading file'));
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Material Deletion
  const handleDeleteMaterial = async (materialId: string) => {
    try {
      if (isValidUuid(materialId)) {
        await supabase.from('study_materials').delete().eq('id', materialId);
      }
    } catch (e) {
      console.warn('Error deleting study material from Supabase:', e);
    }
    const existingMaterials = tutor.studyMaterials || [];
    const updated = existingMaterials.filter(m => m.id !== materialId);
    onUpdateTutorProfile(tutor.id, {
      studyMaterials: updated
    });
    if (onRefresh) {
      onRefresh().catch(err => console.warn('Background refresh after material deletion:', err));
    }
    setSuccess(language === 'he' ? 'חומר הלימוד נמחק בהצלחה' : 'Material deleted successfully');
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (!materialTitle.trim()) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setMaterialTitle(nameWithoutExt);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Overlay Background */}
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-fade-in" onClick={onClose} />

      {/* Modal Container */}
      <div 
        id="teacher-settings-modal"
        className="relative bg-white rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl z-10 border border-slate-200 flex flex-col max-h-[90vh]"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              <span>{language === 'he' ? 'ניהול פרופיל מורה וחומרי לימוד' : 'Teacher Profile & Materials'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'he' 
                ? 'עדכן את מקצועות הלימוד, המחיר, והעלה דפי נוסחאות וסיכומים ישירות ל-Supabase Storage' 
                : 'Update subjects, rates, and upload formula sheets and lesson summaries directly to Supabase Storage'}
            </p>
          </div>
          <button 
            id="close-settings-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-2 gap-2">
          <button
            type="button"
            id="tab-btn-profile-details"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{t.profileDetailsTab}</span>
          </button>

          <button
            type="button"
            id="tab-btn-study-materials"
            onClick={() => setActiveTab('materials')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'materials'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>{t.manageMaterialsTab}</span>
            {tutor.studyMaterials && tutor.studyMaterials.length > 0 && (
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full font-extrabold">
                {tutor.studyMaterials.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-grow p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="bg-rose-50 text-rose-700 p-3 rounded text-xs border border-rose-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 text-emerald-800 p-3 rounded text-xs border border-emerald-100 flex items-center gap-2 font-bold animate-pulse">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* TAB 1: Profile Details */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveChanges} className="space-y-6">
              {/* Profile Image & Avatar Customization */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {language === 'he' ? 'תמונת פרופיל או אווטאר אישי:' : 'Profile Picture or Avatar:'}
                  </h3>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Current Avatar Preview */}
                  <div className="relative group shrink-0">
                    {avatarUrl ? (
                      avatarUrl.startsWith('preset:') ? (
                        (() => {
                          const parts = avatarUrl.split(':');
                          const emoji = parts[1] || '👨‍🏫';
                          const bg = parts[2] || 'from-indigo-500 to-purple-600';
                          return (
                            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${bg} flex items-center justify-center text-3xl shadow-md border-2 border-white`}>
                              {emoji}
                            </div>
                          );
                        })()
                      ) : (
                        <img
                          src={avatarUrl}
                          alt={tutor.name}
                          className="w-20 h-20 rounded-full object-cover shadow-md border-2 border-white"
                        />
                      )
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-md border-2 border-white">
                        {tutor.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}

                    {isUploadingAvatar && (
                      <div className="absolute inset-0 bg-slate-900/60 rounded-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-right">
                    <p className="text-xs text-slate-600">
                      {language === 'he' 
                        ? 'תמונת הפרופיל שלך מוצגת בכרטיס המורה ובחיפוש לכל התלמידים.' 
                        : 'Your profile picture appears on your teacher card and in search results.'}
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <input
                        type="file"
                        ref={avatarFileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploadingAvatar(true);
                          setError('');
                          try {
                            const uploadedUrl = await uploadAvatarImage(tutor.email || tutor.id, file);
                            setAvatarUrl(uploadedUrl);
                          } catch (err) {
                            setError(language === 'he' ? 'שגיאה בהעלאת התמונה' : 'Error uploading image');
                          } finally {
                            setIsUploadingAvatar(false);
                          }
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => avatarFileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{language === 'he' ? 'העלה תמונה מהמחשב' : 'Upload Photo'}</span>
                      </button>

                      {/* Presets */}
                      <div className="flex items-center gap-1">
                        {AVATAR_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setAvatarUrl(`preset:${preset.emoji}:${preset.bg}`)}
                            title={preset.label}
                            className={`w-7 h-7 rounded-full bg-gradient-to-br ${preset.bg} flex items-center justify-center text-sm transition-transform hover:scale-110 cursor-pointer ${
                              avatarUrl === `preset:${preset.emoji}:${preset.bg}` ? 'ring-2 ring-indigo-600 scale-110' : 'opacity-80'
                            }`}
                          >
                            {preset.emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Notice Panel */}
              <div className="bg-indigo-50/60 border border-indigo-100 rounded p-4 flex gap-3 text-xs text-indigo-800 leading-relaxed">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{language === 'he' ? 'הגדרת תחומי הלימוד שלך במערכת' : 'Define your teaching fields'}</p>
                  <p className="mt-1">
                    {language === 'he' 
                      ? 'בחר מספר מקצועות מתוך הרשימה או הוסף מקצוע מותאם אישית. תלמידים יראו את כל המקצועות שבחרת בפרופיל שלך.'
                      : 'Choose multiple subjects from the list or add custom ones. Students will see all chosen subjects on your profile.'}
                  </p>
                </div>
              </div>

              {/* Section 1: Choose Subjects */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <BookOpen className="w-4 h-4 text-slate-500" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{language === 'he' ? 'המקצועות אותם אני מלמד:' : 'Subjects I teach:'}</h3>
                </div>

                {/* Predefined checkboxes */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SUBJECTS_LIST.map((subjectName) => {
                    const isChecked = selectedSubjects.includes(subjectName);
                    return (
                      <label 
                        key={subjectName}
                        className={`flex items-center gap-2.5 p-3 rounded border text-xs font-semibold cursor-pointer transition-all select-none ${
                          isChecked 
                            ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900 shadow-xs' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSubject(subjectName)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                        <span>{translateSubject(subjectName, language)}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Custom Subject Addition Form */}
                <div className="bg-slate-50 border border-slate-200 rounded p-3.5 space-y-3">
                  <label className="block text-xs font-bold text-slate-600">{language === 'he' ? 'הוספת מקצוע מותאם אישית משלך (שאינו ברשימה):' : 'Add custom subject:'}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={language === 'he' ? 'למשל: היסטוריה, אזרחות, ערבית...' : 'e.g. History, Arabic, Python...'}
                      value={customSubjectInput}
                      onChange={(e) => setCustomSubjectInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomSubject}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-1.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{language === 'he' ? 'הוסף' : 'Add'}</span>
                    </button>
                  </div>
                </div>

                {/* Selected Subjects list */}
                {selectedSubjects.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{language === 'he' ? `המקצועות שבחרת שיוצגו בפרופיל שלך (${selectedSubjects.length}):` : `Selected subjects (${selectedSubjects.length}):`}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSubjects.map((subj) => (
                        <span 
                          key={subj}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-xs font-bold"
                        >
                          <span>{translateSubject(subj, language)}</span>
                          <button 
                            type="button"
                            onClick={() => handleRemoveSubject(subj)}
                            className="hover:text-rose-500 transition-colors p-0.5"
                            title={language === 'he' ? "הסר מקצוע" : "Remove subject"}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Choose Levels */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <GraduationCap className="w-4 h-4 text-slate-500" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{language === 'he' ? 'כיתות ורמות לימוד שאני מלמד:' : 'Target Grades & Levels:'}</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {AVAILABLE_LEVELS.map((lvl) => {
                    const isChecked = selectedLevels.includes(lvl);
                    return (
                      <label 
                        key={lvl}
                        className={`flex items-center gap-2 p-2.5 rounded border text-xs font-semibold cursor-pointer transition-all select-none ${
                          isChecked 
                            ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900 shadow-xs' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleLevel(lvl)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                        <span>{translateLevel(lvl, language)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Hourly Rate */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{language === 'he' ? 'מחיר לשעת לימוד (בש"ח):' : 'Hourly Rate (NIS):'}</h3>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="40"
                    max="1000"
                    step="5"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-32 px-3 py-2 text-sm font-bold border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 text-slate-800"
                  />
                  <span className="text-xs text-slate-400">{language === 'he' ? 'ש"ח עבור שיעור פרטי של 60 דקות' : 'NIS per 60-minute lesson'}</span>
                </div>
              </div>

              {/* Section 4: Bio, Education, Experience */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{language === 'he' ? 'תיאור קצר אודותיך (Bio):' : 'About me (Bio):'}</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={language === 'he' ? 'ספר על שיטת הלימוד שלך, הגישה והייחודיות שלך כמורה...' : 'Tell students about your teaching method...'}
                    className="w-full p-3 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{language === 'he' ? 'השכלה אקדמית:' : 'Education:'}</label>
                    <input
                      type="text"
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                      placeholder={language === 'he' ? 'למשל: תואר ראשון במתמטיקה, הטכניון' : 'e.g. B.Sc in Computer Science'}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{language === 'he' ? 'ניסיון בהוראה:' : 'Teaching Experience:'}</label>
                    <input
                      type="text"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder={language === 'he' ? 'למשל: 5 שנות ניסיון בהכנה לבגרות' : 'e.g. 5 years tutoring high school'}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center bg-white sticky bottom-0 py-2">
                <span className="text-[10px] text-slate-400 font-bold">
                  {language === 'he' ? 'השינויים יופיעו מיידית לכל התלמידים במערכת' : 'Changes update immediately'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded transition-colors cursor-pointer"
                  >
                    {language === 'he' ? 'ביטול' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    id="save-settings-btn"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{language === 'he' ? 'שמור שינויים' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: Study Materials Upload & Management */}
          {activeTab === 'materials' && (
            <div className="space-y-6">
              {/* Upload Form */}
              <form onSubmit={handleUploadMaterial} className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                  <FileUp className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    {t.addStudyMaterial}
                  </h3>
                </div>

                {/* Drag & Drop File Zone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.uploadFileLabel} *
                  </label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                      isDraggingFile
                        ? 'border-indigo-500 bg-indigo-50/50'
                        : selectedFile
                        ? 'border-emerald-400 bg-emerald-50/30'
                        : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50/60'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="study-material-file-input"
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"
                    />

                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-3 text-xs text-emerald-800 font-bold">
                        <Check className="w-5 h-5 text-emerald-600" />
                        <span>{selectedFile.name} ({formatFileSize(selectedFile.size)})</span>
                        <span className="text-[10px] text-slate-400 font-normal underline">
                          {language === 'he' ? '(לחץ להחלפה)' : '(click to change)'}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-7 h-7 text-indigo-500 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">
                          {t.dragFileNotice}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          PDF, Word, PowerPoint, Excel, PNG, JPG (Max 25MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Material Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.materialName} *
                    </label>
                    <input
                      type="text"
                      id="material-title-input"
                      value={materialTitle}
                      onChange={(e) => setMaterialTitle(e.target.value)}
                      placeholder={t.materialNamePlaceholder}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 font-medium"
                    />
                  </div>

                  {/* Material Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.materialType} *
                    </label>
                    <select
                      id="material-type-select"
                      value={materialType}
                      onChange={(e) => setMaterialType(e.target.value as StudyMaterial['type'])}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 font-medium cursor-pointer"
                    >
                      <option value="formula_sheet">{t.formulaSheet}</option>
                      <option value="summary">{t.summaryDoc}</option>
                      <option value="presentation">{t.presentationDoc}</option>
                      <option value="worksheet">{t.worksheetDoc}</option>
                      <option value="other">{t.otherDoc}</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.descriptionOptional}
                  </label>
                  <textarea
                    rows={2}
                    id="material-desc-input"
                    value={materialDescription}
                    onChange={(e) => setMaterialDescription(e.target.value)}
                    placeholder={t.descriptionPlaceholder}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 leading-relaxed"
                  />
                </div>

                {/* Upload Button */}
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    id="submit-upload-material-btn"
                    disabled={isUploading || !selectedFile}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t.uploading}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>{t.uploadBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Uploaded Materials List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-500" />
                    <span>{t.studyMaterials} ({tutor.studyMaterials?.length || 0})</span>
                  </h3>
                </div>

                <StudyMaterialsSection 
                  materials={tutor.studyMaterials || []}
                  canManage={true}
                  tutorId={tutor.id}
                  tutorEmail={tutor.email}
                  tutorName={tutor.name}
                  onDeleteMaterial={handleDeleteMaterial}
                  onMaterialUploaded={(newMat) => {
                    const existingMaterials = tutor.studyMaterials || [];
                    onUpdateTutorProfile(tutor.id, {
                      studyMaterials: [newMat, ...existingMaterials]
                    });
                  }}
                  language={language}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
