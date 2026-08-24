import { supabase } from './client';

/**
 * Manual spec groups (migration 0008).
 *
 * Distinct from the derived lineage hulls in `utils/groups.ts`: those are
 * computed from `parent_spec_id` and store nothing. These are sets the user
 * gathered deliberately, so they persist.
 *
 * Every read is tolerant of the table not existing, so the app still runs
 * against a database where 0008 hasn't been applied yet.
 */

export type SpecGroup = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

/** True when the failure is "0008 hasn't been applied here". */
function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || /relation .* does not exist|column .* does not exist/i.test(error.message ?? '');
}

export async function listSpecGroups(): Promise<SpecGroup[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('spec_groups')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at');
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []) as SpecGroup[];
}

export async function createSpecGroup(name: string): Promise<SpecGroup> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('spec_groups')
    .insert({ user_id: user.id, name })
    .select()
    .single();
  if (error) {
    if (isMissingRelation(error) || error.code === 'PGRST205') {
      throw new Error('Groups need migration 0008 — run supabase/migrations/0008_spec_groups.sql.');
    }
    throw error;
  }
  return data as SpecGroup;
}

export async function renameSpecGroup(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('spec_groups').update({ name }).eq('id', id);
  if (error) throw error;
}

/** Removes the container, never the contents — group_id is ON DELETE SET NULL. */
export async function deleteSpecGroup(id: string): Promise<void> {
  const { error } = await supabase.from('spec_groups').delete().eq('id', id);
  if (error) throw error;
}

export async function setSpecGroup(specIds: string[], groupId: string | null): Promise<void> {
  if (!specIds.length) return;
  const { error } = await supabase.from('specs').update({ group_id: groupId }).in('id', specIds);
  if (error) throw error;
}
