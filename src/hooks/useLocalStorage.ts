'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type StorageIssue = {
  key: string;
  stage: 'read' | 'parse' | 'serialize' | 'write' | 'blocked';
};

export type StorageSaveResult = { ok: true } | { ok: false; issue: StorageIssue };

type Snapshot<T> = { key: string; value: T; issue: StorageIssue | null };

function readSnapshot<T>(key: string, initialValue: T): Snapshot<T> {
  if (typeof window === 'undefined') return { key, value: initialValue, issue: null };
  try {
    const item = window.localStorage.getItem(key);
    if (item === null) return { key, value: initialValue, issue: null };
    try {
      return { key, value: JSON.parse(item) as T, issue: null };
    } catch {
      return { key, value: initialValue, issue: { key, stage: 'parse' } };
    }
  } catch {
    return { key, value: initialValue, issue: { key, stage: 'read' } };
  }
}

/**
 * Browser-local state with explicit durability results. A failed write never
 * advances the displayed value, and unreadable bytes are never overwritten by
 * a normal edit. `acceptPersisted` is only for a caller that has already
 * completed and verified a multi-key transaction.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => StorageSaveResult, { issue: StorageIssue | null; acceptPersisted: (value: T) => void }] {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>(() => readSnapshot(key, initialValue));
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    if (snapshotRef.current.key !== key && snapshot.key === key) snapshotRef.current = snapshot;
  }, [key, snapshot]);

  // Keep a changing key coherent during the render that receives it. The
  // setter also verifies the key so an old callback cannot write into a new one.
  let current = snapshot;
  if (snapshot.key !== key) {
    current = readSnapshot(key, initialValue);
    setSnapshot(current);
  }

  const setValue = useCallback((value: T | ((prev: T) => T)): StorageSaveResult => {
    const previous = snapshotRef.current;
    if (previous.key !== key) {
      const issue: StorageIssue = { key, stage: 'blocked' };
      return { ok: false, issue };
    }
    if (previous.issue?.stage === 'read' || previous.issue?.stage === 'parse') {
      return { ok: false, issue: { key, stage: 'blocked' } };
    }

    let next: T;
    let serialized: string | undefined;
    try {
      next = typeof value === 'function' ? (value as (prev: T) => T)(previous.value) : value;
      serialized = JSON.stringify(next);
      if (serialized === undefined) throw new TypeError('Value cannot be serialized as JSON');
    } catch {
      const failed = { ...previous, issue: { key, stage: 'serialize' as const } };
      snapshotRef.current = failed;
      setSnapshot(failed);
      return { ok: false, issue: failed.issue };
    }

    try {
      window.localStorage.setItem(key, serialized);
    } catch {
      const failed = { ...previous, issue: { key, stage: 'write' as const } };
      snapshotRef.current = failed;
      setSnapshot(failed);
      return { ok: false, issue: failed.issue };
    }

    const saved = { key, value: next, issue: null };
    snapshotRef.current = saved;
    setSnapshot(saved);
    return { ok: true };
  }, [key]);

  const acceptPersisted = useCallback((value: T) => {
    const accepted = { key, value, issue: null };
    snapshotRef.current = accepted;
    setSnapshot(accepted);
  }, [key]);

  return [current.value, setValue, { issue: current.issue, acceptPersisted }];
}
