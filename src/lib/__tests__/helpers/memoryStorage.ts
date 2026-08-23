/** Minimal Storage double with inspectable contents (shared by test files). */
export function memoryStorage(seed: Record<string, string> = {}): Storage & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key: (index: number) => [...map.keys()][index] ?? null,
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  } as Storage & { dump(): Record<string, string> };
}
