/**
 * Supabase browser client — lazily created singleton.
 *
 * Enabled only when both public env vars are present. Without them the app
 * keeps running entirely on localStorage (see repositories.ts factory).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Minimal structural surface of a Supabase client used by VEGA repositories. */
export interface SupabaseQueryClient {
  auth: {
    getSession(): Promise<{ data: { session: { user: { id: string } } | null } | null; error: { message: string } | null }>;
    onAuthStateChange(callback: () => void): { data: { subscription: { unsubscribe(): void } } };
  };
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
    upsert(payload: unknown): PromiseLike<{ error: { message: string } | null }>;
    delete(): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
      };
    };
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let client: SupabaseQueryClient | null = null;

/**
 * Returns the shared client, or null when Supabase is not configured.
 * The dynamic import keeps the SDK out of bundles until actually needed.
 */
export async function getSupabaseClient(): Promise<SupabaseQueryClient | null> {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!) as unknown as SupabaseQueryClient;
  return client;
}
