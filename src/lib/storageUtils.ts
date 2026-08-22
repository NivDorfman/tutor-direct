import { supabase, isValidUuid } from './supabase';
import { StudyMaterial } from '../types';

/**
 * Format bytes to readable size (e.g., 1.2 MB)
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Extract file extension from filename or mime type
 */
export const getFileExtension = (fileName: string): string => {
  const parts = fileName.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return 'file';
};

/**
 * Resize and compress an image (max 512x512, JPEG/WEBP, ~40KB).
 * Ensures instant loading across different devices and prevents oversized storage payloads.
 */
export const compressImage = async (
  file: File,
  maxWidth = 512,
  maxHeight = 512,
  quality = 0.85
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(event.target?.result as string);
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Upload avatar to Supabase storage or fallback to optimized compressed Base64 data URL.
 */
export const uploadAvatarImage = async (userIdOrEmail: string, file: File): Promise<string> => {
  const cleanId = userIdOrEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = getFileExtension(file.name) || 'jpg';
  const filePath = `avatars/${cleanId}-${Date.now()}.${ext}`;

  try {
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (!error && data) {
      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (publicData?.publicUrl) {
        return publicData.publicUrl;
      }
    }
  } catch (err) {
    console.warn('Supabase avatars storage upload notice, using optimized format:', err);
  }

  // Fallback to high-performance compressed base64
  return compressImage(file, 512, 512, 0.85);
};

/**
 * Saves user avatar reliably to Supabase users table (and tutors table if teacher).
 */
export const saveUserAvatarInSupabase = async (
  user: { id?: string; email: string; name?: string; role?: 'student' | 'teacher'; tutorProfileId?: string },
  newAvatarUrl: string
): Promise<boolean> => {
  if (!user || (!user.email && !user.id && !user.name)) return false;
  const cleanEmail = (user.email || '').trim().toLowerCase();
  const cleanName = (user.name || '').trim();

  try {
    // 1. Check if user exists in Supabase 'users' table by ID, email, or name
    let matchedUser: any = null;

    if (user.id && isValidUuid(user.id)) {
      const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
      if (data) matchedUser = data;
    }

    if (!matchedUser && cleanEmail) {
      const { data } = await supabase.from('users').select('*').ilike('email', cleanEmail).maybeSingle();
      if (data) matchedUser = data;
    }

    if (!matchedUser && cleanName) {
      const { data } = await supabase.from('users').select('*').ilike('name', cleanName).maybeSingle();
      if (data) matchedUser = data;
    }

    let targetUserId = matchedUser?.id;

    if (matchedUser?.id) {
      targetUserId = matchedUser.id;
      // Direct UPDATE to users table setting both 'avatar' and 'avatar_url'
      try {
        const { error: updateErr } = await supabase
          .from('users')
          .update({ 
            avatar: newAvatarUrl, 
            avatar_url: newAvatarUrl 
          } as any)
          .eq('id', matchedUser.id);

        if (updateErr) {
          console.warn('Attempting update on avatar column only in users table:', updateErr);
          await supabase.from('users').update({ avatar: newAvatarUrl } as any).eq('id', matchedUser.id);
        }
      } catch (e) {
        console.warn('Error updating users table avatar by id:', e);
      }

      if (cleanEmail) {
        try {
          await supabase.from('users').update({ avatar: newAvatarUrl, avatar_url: newAvatarUrl } as any).ilike('email', cleanEmail);
        } catch (e) {}
      }
    } else if (cleanEmail) {
      const insertPayload: any = {
        name: user.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        role: user.role || 'teacher',
        avatar: newAvatarUrl,
        avatar_url: newAvatarUrl,
        password: 'demo'
      };
      if (user.id && isValidUuid(user.id)) {
        insertPayload.id = user.id;
      }
      const { data: insertedUser, error: insertErr } = await supabase.from('users').insert([insertPayload]).select('id').maybeSingle();
      if (insertErr) {
        // Retry with just avatar column
        const fallbackPayload = { ...insertPayload };
        delete fallbackPayload.avatar_url;
        const { data: retryUser } = await supabase.from('users').insert([fallbackPayload]).select('id').maybeSingle();
        if (retryUser?.id) {
          targetUserId = retryUser.id;
        }
      } else if (insertedUser?.id) {
        targetUserId = insertedUser.id;
      }
    }

    // 2. If user is a teacher, sync to 'tutors' table as well
    const effectiveTutorUuid = (user.tutorProfileId && isValidUuid(user.tutorProfileId))
      ? user.tutorProfileId
      : (user.id && isValidUuid(user.id))
        ? user.id
        : (targetUserId && isValidUuid(targetUserId))
          ? targetUserId
          : null;

    if (user.role === 'teacher' && effectiveTutorUuid) {
      try {
        const { error: tutorUpdateErr } = await supabase
          .from('tutors')
          .update({ avatar: newAvatarUrl, avatar_url: newAvatarUrl } as any)
          .eq('id', effectiveTutorUuid);

        if (tutorUpdateErr) {
          // Fallback if one column exists
          try {
            await supabase.from('tutors').update({ avatar_url: newAvatarUrl } as any).eq('id', effectiveTutorUuid);
          } catch (e) {}
          try {
            await supabase.from('tutors').update({ avatar: newAvatarUrl } as any).eq('id', effectiveTutorUuid);
          } catch (e) {}
        }
      } catch (e) {}
    }

    return true;
  } catch (err) {
    console.error('Error saving user avatar to Supabase:', err);
    return false;
  }
};

/**
 * Upload a file for a teacher using Supabase Storage
 * Falls back to Data URL if Supabase bucket or network is not available
 */
export const uploadStudyMaterial = async (
  tutorId: string,
  file: File,
  title: string,
  type: StudyMaterial['type'],
  description?: string
): Promise<StudyMaterial> => {
  const ext = getFileExtension(file.name);
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniqueId = `mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const filePath = `${tutorId}/${uniqueId}-${cleanFileName}`;
  const fileSizeStr = formatFileSize(file.size);

  let fileUrl = '';

  try {
    // Attempt Supabase Storage upload
    const { data, error } = await supabase.storage
      .from('study-materials')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (!error && data) {
      const { data: publicData } = supabase.storage
        .from('study-materials')
        .getPublicUrl(filePath);

      if (publicData?.publicUrl) {
        fileUrl = publicData.publicUrl;
      }
    }
  } catch (err) {
    console.warn('Supabase storage upload failed or not configured, falling back to client storage:', err);
  }

  // Fallback to Base64 Data URL if Supabase Storage is offline or unconfigured
  if (!fileUrl) {
    fileUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const newMaterial: StudyMaterial = {
    id: uniqueId,
    name: title.trim() || file.name,
    type,
    fileUrl,
    fileName: file.name,
    fileType: ext,
    fileSize: fileSizeStr,
    description: description?.trim(),
    uploadedAt: new Date().toISOString().split('T')[0]
  };

  return newMaterial;
};
