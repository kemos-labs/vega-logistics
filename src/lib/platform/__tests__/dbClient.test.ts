import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('explicit optional sync gate', () => {
  it.each([undefined, 'local', 'supabase'])('requires explicit sync flag: %s', async flag => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key');
    vi.stubEnv('NEXT_PUBLIC_SYNC', flag);
    const { isSupabaseConfigured, getSupabaseClient } = await import('../db/client');
    expect(isSupabaseConfigured()).toBe(flag === 'supabase');
    if (flag !== 'supabase') expect(await getSupabaseClient()).toBeNull();
  });

  it('requires configuration even with explicit opt-in', async () => {
    vi.stubEnv('NEXT_PUBLIC_SYNC', 'supabase');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const { getSupabaseClient } = await import('../db/client');
    expect(await getSupabaseClient()).toBeNull();
  });
});
