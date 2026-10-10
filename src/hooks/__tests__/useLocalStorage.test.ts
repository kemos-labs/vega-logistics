import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

let counter = 0;
const key = () => `use-local-storage-${++counter}`;

describe('useLocalStorage durability', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('uses the initial value for a missing key without writing it', () => {
    const storageKey = key();
    const { result } = renderHook(() => useLocalStorage(storageKey, 'default'));
    expect(result.current[0]).toBe('default');
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(result.current[2].issue).toBeNull();
  });

  it.each([[0, 99], [false, true], [null, 'fallback'], ['', 'full']] as const)(
    'reads valid falsey JSON value %s', (saved, fallback) => {
      const storageKey = key();
      localStorage.setItem(storageKey, JSON.stringify(saved));
      const { result } = renderHook(() => useLocalStorage(storageKey, fallback));
      expect(result.current[0]).toBe(saved);
      expect(result.current[2].issue).toBeNull();
    },
  );

  it('retains malformed bytes and blocks ordinary writes', () => {
    const storageKey = key();
    const raw = "{'bad-json': true}";
    localStorage.setItem(storageKey, raw);
    const { result } = renderHook(() => useLocalStorage(storageKey, { safe: true }));
    expect(result.current[0]).toEqual({ safe: true });
    expect(result.current[2].issue).toEqual({ key: storageKey, stage: 'parse' });
    let save = { ok: true as const };
    act(() => { save = result.current[1]({ safe: false }) as typeof save; });
    expect(save).toEqual({ ok: false, issue: { key: storageKey, stage: 'blocked' } });
    expect(localStorage.getItem(storageKey)).toBe(raw);
  });

  it('does not advance displayed state after quota failure and retries from durable state', () => {
    const storageKey = key();
    localStorage.setItem(storageKey, JSON.stringify({ count: 4 }));
    const { result } = renderHook(() => useLocalStorage(storageKey, { count: 0 }));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('quota'); });
    let failed: unknown;
    act(() => { failed = result.current[1]((previous) => ({ count: previous.count + 1 })); });
    expect(failed).toMatchObject({ ok: false, issue: { stage: 'write' } });
    expect(result.current[0]).toEqual({ count: 4 });
    expect(localStorage.getItem(storageKey)).toBe(JSON.stringify({ count: 4 }));
    let retried: unknown;
    act(() => { retried = result.current[1]((previous) => ({ count: previous.count + 1 })); });
    expect(retried).toEqual({ ok: true });
    expect(result.current[0]).toEqual({ count: 5 });
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it('reports serialization failure without writing or advancing the value', () => {
    const storageKey = key();
    const { result } = renderHook(() => useLocalStorage(storageKey, 'safe'));
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    let save: unknown;
    act(() => { save = result.current[1](cyclic as unknown as string); });
    expect(save).toMatchObject({ ok: false, issue: { stage: 'serialize' } });
    expect(result.current[0]).toBe('safe');
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('performs synchronous functional writes in sequence', () => {
    const storageKey = key();
    const { result } = renderHook(() => useLocalStorage(storageKey, 0));
    act(() => {
      expect(result.current[1](value => value + 1)).toEqual({ ok: true });
      expect(result.current[1](value => value + 1)).toEqual({ ok: true });
    });
    expect(result.current[0]).toBe(2);
    expect(localStorage.getItem(storageKey)).toBe('2');
  });

  it('re-reads a changed key and never writes the old value into it', () => {
    const first = key();
    const second = key();
    localStorage.setItem(first, JSON.stringify('first'));
    localStorage.setItem(second, JSON.stringify('second'));
    const { result, rerender } = renderHook(({ storageKey }) => useLocalStorage(storageKey, 'fallback'), { initialProps: { storageKey: first } });
    expect(result.current[0]).toBe('first');
    rerender({ storageKey: second });
    expect(result.current[0]).toBe('second');
    act(() => { result.current[1]('changed'); });
    expect(localStorage.getItem(first)).toBe(JSON.stringify('first'));
    expect(localStorage.getItem(second)).toBe(JSON.stringify('changed'));
  });

  it('adopts a committed value without touching storage again', () => {
    const storageKey = key();
    const { result } = renderHook(() => useLocalStorage(storageKey, 'before'));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('should not write'); });
    act(() => { result.current[2].acceptPersisted('transactional'); });
    expect(result.current[0]).toBe('transactional');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('surfaces denied storage access as a read issue', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('denied'); } });
    try {
      const storageKey = key();
      const { result } = renderHook(() => useLocalStorage(storageKey, 'fallback'));
      expect(result.current[0]).toBe('fallback');
      expect(result.current[2].issue).toEqual({ key: storageKey, stage: 'read' });
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});
