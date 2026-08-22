import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xkijcicyjzdrnruoasyy.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_aYZYK_C6HjK4vAwslLkXug_8_T1pJ3H';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Resolves a valid Supabase UUID for a given user email or ID.
 * If user exists in 'users' table, returns their real UUID.
 * If not found and createIfMissing is true, registers a minimal record to obtain a UUID.
 */
export async function resolveUserUuid(
  identifier: { id?: string; email?: string; name?: string; role?: 'student' | 'teacher' },
  createIfMissing = true
): Promise<string | null> {
  const cleanId = identifier.id?.trim();
  const cleanEmail = identifier.email?.trim().toLowerCase();

  // If already a valid UUID, verify or return
  if (cleanId && isValidUuid(cleanId)) {
    return cleanId;
  }

  try {
    if (cleanEmail) {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (!error && data && data.id) {
        return data.id;
      }

      if (createIfMissing) {
        const { data: inserted, error: insertErr } = await supabase
          .from('users')
          .insert([{
            name: identifier.name || cleanEmail.split('@')[0],
            email: cleanEmail,
            role: identifier.role || 'student',
            phone: '',
            password: 'demo'
          }])
          .select('id')
          .maybeSingle();

        if (!insertErr && inserted && inserted.id) {
          return inserted.id;
        }
      }
    }
  } catch (err) {
    console.error('Error resolving user UUID in Supabase:', err);
  }

  return null;
}

