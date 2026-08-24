import { supabase } from './client';

/**
 * Venues and membership.
 *
 * Scope is deliberately create / join / leave — VISION defers venue profile
 * pages, so nothing here reads or writes a public-facing venue page.
 *
 * RLS does the authorisation: `user_venues` insert/delete allow acting on your
 * own row or, via the is_venue_owner() SECURITY DEFINER helper, on any row in a
 * venue you own. None of that is re-implemented client-side.
 */

export type Venue = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  country: string;
  bio: string | null;
  created_by: string;
  verified: boolean;
  created_at: string;
};

export type VenueRole = 'owner' | 'bartender' | 'guest';

export type VenueMembership = {
  venue_id: string;
  role: VenueRole;
  joined_at: string;
  venues?: Venue | null;
};

export type VenueInput = {
  name: string;
  city?: string | null;
  country?: string;
  bio?: string | null;
};

async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

/** URL-safe handle. Uniqueness is enforced by the column, not by this. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60);
}

/** Venues the signed-in user belongs to, with the venue row joined. */
export async function listMyVenues(): Promise<VenueMembership[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('user_venues')
    .select('venue_id, role, joined_at, venues(*)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as VenueMembership[];
}

/** Every venue is readable by any authenticated user — this is the join list. */
export async function searchVenues(q: string): Promise<Venue[]> {
  let query = supabase.from('venues').select('*');
  if (q.trim()) query = query.ilike('name', `%${q}%`);
  const { data, error } = await query.order('name').limit(30);
  if (error) throw error;
  return (data ?? []) as Venue[];
}

/**
 * Create a venue and take ownership of it in one go.
 *
 * The membership row is a separate insert because the table has no trigger to
 * add it; if that second insert fails the venue would exist with no owner and
 * no way to reach it, so the venue is rolled back by hand.
 */
export async function createVenue(input: VenueInput): Promise<Venue> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('venues')
    .insert({
      name: input.name,
      slug: slugify(input.name) || null,
      city: input.city ?? null,
      country: input.country ?? 'GB',
      bio: input.bio ?? null,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;

  const venue = data as Venue;
  const { error: memberError } = await supabase
    .from('user_venues')
    .insert({ user_id: user.id, venue_id: venue.id, role: 'owner' });
  if (memberError) {
    await supabase.from('venues').delete().eq('id', venue.id);
    throw memberError;
  }
  return venue;
}

export async function joinVenue(venueId: string, role: VenueRole = 'bartender'): Promise<void> {
  const user = await currentUser();
  const { error } = await supabase
    .from('user_venues')
    .insert({ user_id: user.id, venue_id: venueId, role });
  if (error) throw error;
}

/**
 * Leave a venue.
 *
 * The last owner is blocked from leaving: `venues.created_by` is ON DELETE
 * RESTRICT and only owners can update or delete the venue, so an ownerless
 * venue is unreachable forever. Checked here because RLS permits the delete.
 */
export async function leaveVenue(venueId: string): Promise<void> {
  const user = await currentUser();

  const { data: mine, error: mineError } = await supabase
    .from('user_venues')
    .select('role')
    .eq('user_id', user.id)
    .eq('venue_id', venueId)
    .maybeSingle();
  if (mineError) throw mineError;
  if (!mine) return;

  if (mine.role === 'owner') {
    const { data: owners, error: ownerError } = await supabase
      .from('user_venues')
      .select('user_id')
      .eq('venue_id', venueId)
      .eq('role', 'owner');
    if (ownerError) throw ownerError;
    if ((owners?.length ?? 0) <= 1) {
      throw new Error('You are the only owner. Make someone else an owner before you leave.');
    }
  }

  const { error } = await supabase
    .from('user_venues')
    .delete()
    .eq('user_id', user.id)
    .eq('venue_id', venueId);
  if (error) throw error;
}
