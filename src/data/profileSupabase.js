import { getSupabase } from '../lib/supabaseClient.js';
import { normalizeColorScheme } from '../utils/colorScheme.js';
import { normalizeLabel } from '../utils/noteLabels.js';

/**
 * @returns {Promise<{ defaultLabelId: string | null, defaultLabelName: string | null }>}
 */
export async function fetchProfileDefaultLabel(userId) {
  const supabase = getSupabase();
  if (!supabase) {
    return { defaultLabelId: null, defaultLabelName: null };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('default_label_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[db] fetchProfileDefaultLabel profile', error);
    throw error;
  }

  const id = profile?.default_label_id ?? null;
  if (!id) {
    return { defaultLabelId: null, defaultLabelName: null };
  }

  const { data: label, error: labelErr } = await supabase
    .from('labels')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (labelErr) {
    console.error('[db] fetchProfileDefaultLabel label', labelErr);
    throw labelErr;
  }

  if (!label?.name) {
    return { defaultLabelId: null, defaultLabelName: null };
  }

  return { defaultLabelId: label.id, defaultLabelName: label.name };
}

/**
 * @param {string} userId
 * @param {string | null} labelId — `null` clears the default
 */
/**
 * @param {string} userId
 * @returns {Promise<'light' | 'dark' | null>}
 */
export async function fetchProfileColorScheme(userId) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('color_scheme')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[db] fetchProfileColorScheme', error);
    throw error;
  }

  return normalizeColorScheme(profile?.color_scheme);
}

/**
 * @param {string} userId
 * @param {'light' | 'dark'} scheme
 */
export async function updateProfileColorScheme(userId, scheme) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase.from('profiles').update({ color_scheme: scheme }).eq('id', userId);

  if (error) {
    console.error('[db] updateProfileColorScheme', error);
    throw error;
  }
}

export async function updateDefaultLabelId(userId, labelId) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('profiles')
    .update({ default_label_id: labelId })
    .eq('id', userId);

  if (error) {
    console.error('[db] updateDefaultLabelId', error);
    throw error;
  }
}

/**
 * @param {string} userId
 * @param {string} name
 * @returns {Promise<string | null>}
 */
export async function fetchLabelIdByUserAndName(userId, name) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const n = normalizeLabel(name);
  if (!n) return null;

  const { data, error } = await supabase
    .from('labels')
    .select('id')
    .eq('user_id', userId)
    .eq('name', n)
    .maybeSingle();

  if (error) {
    console.error('[db] fetchLabelIdByUserAndName', error);
    throw error;
  }
  return data?.id ?? null;
}
