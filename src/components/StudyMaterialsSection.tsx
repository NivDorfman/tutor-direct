import React, { useState, useEffect, useRef } from 'react';
import { StudyMaterial } from '../types';
import { 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  Image as ImageIcon, 
  File, 
  Download, 
  ExternalLink, 
  Trash2, 
  Layers, 
  Plus, 
  Upload, 
  Check, 
  Loader2, 
  X,
  FileUp,
  AlertCircle
} from 'lucide-react';
import { Language, getTranslation } from '../lib/i18n';
import { supabase, isValidUuid, resolveUserUuid } from '../lib/supabase';
import { uploadStudyMaterial, formatFileSize } from '../lib/storageUtils';

interface StudyMaterialsSectionProps {
  materials?: StudyMaterial[];
  canManage?: boolean;
  onDeleteMaterial?: (materialId: string) => void;
  onMaterialUploaded?: (newMaterial: StudyMaterial) => void;
  tutorId?: string;
  tutorEmail?: string;
  tutorName?: string;
  language?: Language;
}

export const StudyMaterialsSection: React.FC<StudyMaterialsSectionProps> = ({
  materials = [],
  canManage = false,
  onDeleteMaterial,
  onMaterialUploaded,
  tutorId,
  tutorEmail,
  tutorName,
  language = 'he'
}) => {
  const t = getTranslation(language);
  const isRtl = language === 'he';

  // Local state for immediate responsiveness and sync
  const [materialsList, setMaterialsList] = useState<StudyMaterial[]>(materials);

  useEffect(() => {
    setMaterialsList(materials || []);
  }, [materials]);

  // Upload Form State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialType, setMaterialType] = useState<StudyMaterial['type']>('formula_sheet');
  const [materialDescription, setMaterialDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTypeBadge = (type: StudyMaterial['type']) => {
    switch (type) {
      case 'formula_sheet':
        return { label: t.formulaSheet, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'summary':
        return { label: t.summaryDoc, color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'presentation':
        return { label: t.presentationDoc, color: 'bg-violet-50 text-violet-700 border-violet-200' };
      case 'worksheet':
        return { label: t.worksheetDoc, color: 'bg-amber-50 text-amber-700 border-amber-200' };
      default:
        return { label: t.otherDoc, color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  const getFileIcon = (fileType: string) => {
    const lower = fileType.toLowerCase();
    if (lower.includes('pdf')) {
      return <FileText className="w-5 h-5 text-rose-500 shrink-0" />;
    }
    if (lower.includes('ppt') || lower.includes('keynote')) {
      return <Presentation className="w-5 h-5 text-orange-500 shrink-0" />;
    }
    if (lower.includes('doc') || lower.includes('word') || lower.includes('txt')) {
      return <FileText className="w-5 h-5 text-blue-500 shrink-0" />;
    }
    if (lower.includes('xls') || lower.includes('sheet') || lower.includes('csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />;
    }
    if (lower.includes('png') || lower.includes('jpg') || lower.includes('jpeg') || lower.includes('webp')) {
      return <ImageIcon className="w-5 h-5 text-purple-500 shrink-0" />;
    }
    return <File className="w-5 h-5 text-slate-500 shrink-0" />;
  };

  const handleDownload = (material: StudyMaterial) => {
    const link = document.createElement('a');
    link.href = material.fileUrl;
    link.download = material.fileName || `${material.name}.${material.fileType}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Direct upload to Supabase storage and study_materials table
  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    if (!selectedFile) {
      setUploadError(language === 'he' ? 'אנא בחר קובץ להעלאה' : 'Please select a file to upload');
      return;
    }

    if (!materialTitle.trim()) {
      setUploadError(language === 'he' ? 'אנא הזן כותרת לחומר הלימוד' : 'Please enter a title for the material');
      return;
    }

    setIsUploading(true);

    try {
      // 1. Resolve tutor UUID
      let tutorUuid = isValidUuid(tutorId) ? tutorId : null;
      if (!tutorUuid && (tutorEmail || tutorId)) {
        tutorUuid = await resolveUserUuid({
          id: tutorId,
          email: tutorEmail,
          name: tutorName,
          role: 'teacher'
        });
      }

      // 2. Upload file to Supabase storage
      const uploadedFile = await uploadStudyMaterial(
        tutorUuid || tutorId || 'tutor',
        selectedFile,
        materialTitle,
        materialType,
        materialDescription
      );

      let savedMaterial: StudyMaterial = uploadedFile;

      // 3. Direct insert to Supabase 'study_materials' table
      if (tutorUuid) {
        const { data, error } = await supabase
          .from('study_materials')
          .insert([
            {
              tutor_id: tutorUuid, // ה-UUID של המורה
              name: uploadedFile.name || uploadedFile.fileName || 'חומר לימוד חדש',
              type: uploadedFile.type || 'summary',
              file_name: uploadedFile.fileName || uploadedFile.name,
              file_type: uploadedFile.fileType || 'pdf',
              file_size: uploadedFile.fileSize || '1 MB',
              file_url: uploadedFile.fileUrl || '',
              description: uploadedFile.description || ''
            }
          ])
          .select()
          .maybeSingle();

        if (error) {
          console.error('Error inserting study material:', error.message);
        } else if (data) {
          savedMaterial = {
            id: data.id,
            name: data.name || uploadedFile.name,
            type: (data.type as StudyMaterial['type']) || uploadedFile.type,
            fileUrl: data.file_url || uploadedFile.fileUrl,
            fileName: data.file_name || uploadedFile.fileName,
            fileType: data.file_type || uploadedFile.fileType,
            fileSize: data.file_size || uploadedFile.fileSize,
            description: data.description || uploadedFile.description,
            uploadedAt: data.uploaded_at ? new Date(data.uploaded_at).toISOString().split('T')[0] : uploadedFile.uploadedAt
          };
        }
      }

      // 4. Update local state with the newly created row
      setMaterialsList(prev => [savedMaterial, ...prev]);

      if (onMaterialUploaded) {
        onMaterialUploaded(savedMaterial);
      }

      setUploadSuccess(t.uploadSuccess);
      setSelectedFile(null);
      setMaterialTitle('');
      setMaterialDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadSuccess('');
      }, 1500);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err?.message || (language === 'he' ? 'אירעה שגיאה בהעלאת הקובץ' : 'Upload failed'));
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Material Handler
  const handleDeleteItem = async (id: string) => {
    try {
      if (isValidUuid(id)) {
        await supabase.from('study_materials').delete().eq('id', id);
      }
    } catch (err) {
      console.warn('Failed to delete study material from Supabase:', err);
    }

    setMaterialsList(prev => prev.filter(m => m.id !== id));

    if (onDeleteMaterial) {
      onDeleteMaterial(id);
    }
  };

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
      if (!materialTitle) {
        const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setMaterialTitle(cleanName);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!materialTitle) {
        const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setMaterialTitle(cleanName);
      }
    }
  };

  return (
    <div className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Management & Direct Upload Section for Teachers */}
      {canManage && (
        <div>
          {!isUploadOpen ? (
            <button
              type="button"
              id="open-upload-material-btn"
              onClick={() => setIsUploadOpen(true)}
              className="w-full border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-lg p-3 text-center cursor-pointer transition-colors flex items-center justify-center gap-2 text-indigo-700 text-xs font-bold"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>{t.addStudyMaterial}</span>
            </button>
          ) : (
            <form onSubmit={handleUploadMaterial} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <FileUp className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    {t.addStudyMaterial}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadOpen(false);
                    setUploadError('');
                    setUploadSuccess('');
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {uploadError && (
                <div className="p-2 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="p-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded flex items-center gap-1.5 font-medium">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {/* Drag & Drop File Zone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.uploadFileLabel} *
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
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
                    id="section-material-file-input"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"
                  />

                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-emerald-800 font-bold">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>{selectedFile.name} ({formatFileSize(selectedFile.size)})</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-5 h-5 text-indigo-500 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">
                        {t.dragFileNotice}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        PDF, Word, PPT, Excel, Images (Max 25MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Material Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.materialName} *
                  </label>
                  <input
                    type="text"
                    id="section-material-title-input"
                    value={materialTitle}
                    onChange={(e) => setMaterialTitle(e.target.value)}
                    placeholder={t.materialNamePlaceholder}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 font-medium"
                  />
                </div>

                {/* Material Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.materialType} *
                  </label>
                  <select
                    id="section-material-type-select"
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value as StudyMaterial['type'])}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 font-medium cursor-pointer"
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
                  id="section-material-desc-input"
                  value={materialDescription}
                  onChange={(e) => setMaterialDescription(e.target.value)}
                  placeholder={t.descriptionPlaceholder}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 leading-relaxed"
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                >
                  {language === 'he' ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  id="section-submit-upload-btn"
                  disabled={isUploading || !selectedFile}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-1.5 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t.uploading}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>{t.uploadBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* List of Study Materials */}
      {(!materialsList || materialsList.length === 0) ? (
        <div className="bg-slate-50 border border-slate-200 rounded p-6 text-center space-y-2">
          <Layers className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-semibold text-slate-600">
            {canManage ? t.noMaterialsYetTeacher : t.noMaterialsYet}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {materialsList.map((mat) => {
            const badge = getTypeBadge(mat.type);
            return (
              <div
                key={mat.id}
                id={`study-material-${mat.id}`}
                className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                {/* Left/Main info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {getFileIcon(mat.fileType)}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${badge.color}`}>
                        {badge.label}
                      </span>
                      {mat.fileSize && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          {mat.fileSize}
                        </span>
                      )}
                      {mat.uploadedAt && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          • {mat.uploadedAt}
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm leading-snug break-words">
                      {mat.name}
                    </h4>

                    {mat.description && (
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {mat.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <a
                    href={mat.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                    title={t.viewFile}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t.viewFile}</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleDownload(mat)}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                    title={t.downloadFile}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.downloadFile}</span>
                  </button>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(mat.id)}
                      className="p-1.5 rounded text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                      title={t.deleteMaterial}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
