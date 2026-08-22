import React from 'react';
import { StudyMaterial } from '../types';
import { FileText, FileSpreadsheet, Presentation, Image as ImageIcon, File, Download, ExternalLink, Trash2, BookOpen, Sparkles, Layers } from 'lucide-react';
import { Language, getTranslation } from '../lib/i18n';

interface StudyMaterialsSectionProps {
  materials?: StudyMaterial[];
  canManage?: boolean;
  onDeleteMaterial?: (materialId: string) => void;
  language?: Language;
}

export const StudyMaterialsSection: React.FC<StudyMaterialsSectionProps> = ({
  materials = [],
  canManage = false,
  onDeleteMaterial,
  language = 'he'
}) => {
  const t = getTranslation(language);
  const isRtl = language === 'he';

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

  if (!materials || materials.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded p-6 text-center space-y-2">
        <Layers className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="text-xs font-semibold text-slate-600">
          {canManage ? t.noMaterialsYetTeacher : t.noMaterialsYet}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
      {materials.map((mat) => {
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

              {canManage && onDeleteMaterial && (
                <button
                  type="button"
                  onClick={() => onDeleteMaterial(mat.id)}
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
  );
};
