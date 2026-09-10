'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LTSyncSummary } from '@/lib/logestechs/types';
import { buildDemoSummary } from '@/lib/logestechs/mock';

// GitHub Pages serves a static export (no /api routes — the deploy workflow
// strips src/app/api). On static hosting every /api fetch 404s, so the hook
// transparently falls back to the client-side demo snapshot. On a server
// deployment the live API is used. NEXT_PUBLIC_BASE_PATH covers the
// /<repo> basePath on Pages.
const API_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/logestechs`;

interface Status {
  mode: 'live' | 'demo';
  baseUrl: string;
  hasKey: boolean;
  setupHint: string;
  staticFallback?: boolean;
}

interface State {
  status: Status | null;
  summary: LTSyncSummary | null;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  lastSync: Date | null;
  autoSync: boolean;
  staticFallback: boolean;
}

async function getJson(path: string, init?: RequestInit) {
  const r = await fetch(`${API_BASE}/${path}`, { cache: 'no-store', ...init });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function useLogestechs(pollSec = 300) {
  const [s, setS] = useState<State>({
    status: null, summary: null, loading: true, syncing: false,
    error: null, lastSync: null, autoSync: true, staticFallback: false,
  });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const j = await getJson('status');
      setS((p) => ({ ...p, status: j }));
    } catch {
      setS((p) => ({
        ...p,
        staticFallback: true,
        status: {
          mode: 'demo',
          baseUrl: '(static demo — GitHub Pages has no API server)',
          hasKey: false,
          setupHint: 'Static hosting: showing built-in demo data. Run your own server (or Vercel) with LOGESTECHS_* env for live data.',
          staticFallback: true,
        },
      }));
    }
  }, []);

  const sync = useCallback(async (force = false) => {
    setS((p) => ({ ...p, syncing: true, error: null }));
    try {
      const j = await getJson(force ? 'sync?force=1' : 'sync', force ? { method: 'POST' } : undefined);
      if (!j.ok) throw new Error(j.error ?? 'sync failed');
      setS((p) => ({ ...p, summary: j, lastSync: new Date(), syncing: false, loading: false }));
      return j as LTSyncSummary;
    } catch {
      // Static host (or offline API): serve the client-side demo snapshot.
      const demo = buildDemoSummary();
      setS((p) => ({ ...p, summary: demo, lastSync: new Date(), syncing: false, loading: false, staticFallback: true, error: null }));
      return demo;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch: async callbacks set state
    loadStatus();
    sync(false);
    if (s.autoSync) {
      timer.current = setInterval(() => sync(false), Math.max(60, pollSec) * 1000);
      return () => { if (timer.current) clearInterval(timer.current); };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAutoSync = useCallback((v: boolean) => setS((p) => ({ ...p, autoSync: v })), []);

  return { ...s, sync, resync: () => sync(true), setAutoSync, pollSec };
}
