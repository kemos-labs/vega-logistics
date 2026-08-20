'use client';

import { useState, useCallback } from 'react';

/**
 * Drop-in replacement for useState that persists the value to localStorage.
 * Uses lazy initialization so the stored value is available on the first render.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`useLocalStorage: error reading key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch (error) {
          console.warn(`useLocalStorage: error saving key "${key}":`, error);
        }
        return next;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
