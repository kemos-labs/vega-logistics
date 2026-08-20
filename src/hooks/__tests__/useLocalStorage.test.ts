import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "../useLocalStorage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;
function key(): string {
  return `ut-${++counter}`;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("useLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── Initialisation ─────────────────────────────────────────────────────

  it("returns the initial value when no value exists in localStorage", () => {
    const { result } = renderHook(() => useLocalStorage(key(), "default"));
    expect(result.current[0]).toBe("default");
  });

  it("reads an existing value from localStorage", () => {
    const k = key();
    localStorage.setItem(k, JSON.stringify("stored"));
    const { result } = renderHook(() => useLocalStorage(k, "default"));
    expect(result.current[0]).toBe("stored");
  });

  it("accepts complex objects as initial and stored values", () => {
    const k = key();
    const obj = { a: 1, b: [2, 3], nested: { x: true } };
    localStorage.setItem(k, JSON.stringify(obj));
    const { result } = renderHook(() =>
      useLocalStorage(k, { a: 0, b: [], nested: { x: false } }),
    );
    expect(result.current[0]).toEqual(obj);
  });

  it("does not write to localStorage on initialisation when the key is absent", () => {
    const k = key();
    renderHook(() => useLocalStorage(k, "fresh"));
    expect(localStorage.getItem(k)).toBeNull();
  });

  // ── Setting values ─────────────────────────────────────────────────────

  it("persists a new value to localStorage when setValue is called", () => {
    const k = key();
    const { result } = renderHook(() => useLocalStorage(k, "before"));
    act(() => {
      result.current[1]("after");
    });
    expect(result.current[0]).toBe("after");
    expect(localStorage.getItem(k)).toBe(JSON.stringify("after"));
  });

  it("persists complex objects when setValue is called", () => {
    const k = key();
    const { result } = renderHook(() =>
      useLocalStorage<{ count: number; label: string }>(k, {
        count: 0,
        label: "",
      }),
    );
    act(() => {
      result.current[1]({ count: 42, label: "answer" });
    });
    expect(result.current[0]).toEqual({ count: 42, label: "answer" });
    expect(localStorage.getItem(k)).toBe(
      JSON.stringify({ count: 42, label: "answer" }),
    );
  });

  it("supports functional updates (prev => next)", () => {
    const k = key();
    localStorage.setItem(k, JSON.stringify(0));
    const { result } = renderHook(() => useLocalStorage(k, 0));
    act(() => {
      result.current[1]((prev) => prev + 1);
    });
    expect(result.current[0]).toBe(1);
    expect(localStorage.getItem(k)).toBe(JSON.stringify(1));
  });

  it("supports functional updates on arrays", () => {
    const k = key();
    localStorage.setItem(k, JSON.stringify(["a"]));
    const { result } = renderHook(() => useLocalStorage<string[]>(k, ["a"]));
    act(() => {
      result.current[1]((prev) => [...prev, "b"]);
    });
    expect(result.current[0]).toEqual(["a", "b"]);
    expect(localStorage.getItem(k)).toBe(JSON.stringify(["a", "b"]));
  });

  // ── Multiple hooks, same component ───────────────────────────────────

  it("treats different keys independently", () => {
    const kA = key();
    const kB = key();

    // Single renderHook with two useLocalStorage calls in the same component
    const { result } = renderHook(() => ({
      a: useLocalStorage(kA, "alpha"),
      b: useLocalStorage(kB, "beta"),
    }));

    expect(result.current.a[0]).toBe("alpha");
    expect(result.current.b[0]).toBe("beta");

    act(() => {
      result.current.a[1]("updated-a");
    });

    expect(result.current.a[0]).toBe("updated-a");
    expect(result.current.b[0]).toBe("beta");
    expect(localStorage.getItem(kA)).toBe(JSON.stringify("updated-a"));
    expect(localStorage.getItem(kB)).toBeNull();
  });

  // ── Resilience ─────────────────────────────────────────────────────────

  it("does not throw when localStorage.setItem throws", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const k = key();

    try {
      const { result } = renderHook(() => useLocalStorage(k, "initial"));
      act(() => {
        result.current[1]("new-value");
      });
      expect(result.current[0]).toBe("new-value");
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      setItem.mockRestore();
      warn.mockRestore();
    }
  });

  // ── Corrupt data ───────────────────────────────────────────────────────

  it("falls back to the initial value when localStorage contains invalid JSON", () => {
    const k = key();
    localStorage.setItem(k, "not-json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useLocalStorage(k, "fallback"));
    expect(result.current[0]).toBe("fallback");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("falls back when JSON.parse fails on malformed JSON", () => {
    const k = key();
    localStorage.setItem(k, "{'bad-json': true}");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useLocalStorage(k, { safe: true }));
    expect(result.current[0]).toEqual({ safe: true });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  it("handles numeric zero correctly (falsy but valid)", () => {
    const k = key();
    localStorage.setItem(k, JSON.stringify(0));
    const { result } = renderHook(() => useLocalStorage(k, 99));
    expect(result.current[0]).toBe(0);
  });

  it("handles boolean false correctly (falsy but valid)", () => {
    const k = key();
    localStorage.setItem(k, JSON.stringify(false));
    const { result } = renderHook(() => useLocalStorage(k, true));
    expect(result.current[0]).toBe(false);
  });

  it("handles null via JSON serialisation", () => {
    const k = key();
    localStorage.setItem(k, JSON.stringify(null));
    const { result } = renderHook(() =>
      useLocalStorage<null | string>(k, "fallback"),
    );
    expect(result.current[0]).toBeNull();
  });

  it("handles empty string", () => {
    const k = key();
    localStorage.setItem(k, JSON.stringify(""));
    const { result } = renderHook(() => useLocalStorage(k, "full"));
    expect(result.current[0]).toBe("");
  });

  it("is stable across re-renders (setter identity)", () => {
    const k = key();
    const { result, rerender } = renderHook(() => useLocalStorage(k, "value"));
    const setterA = result.current[1];
    rerender();
    expect(result.current[1]).toBe(setterA);
  });

  // ── Degraded environment (runs last to avoid side-effects) ───────────

  it("handles missing localStorage gracefully (degraded client)", () => {
    vi.stubGlobal("localStorage", undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const k = key();

    const { result } = renderHook(() => useLocalStorage(k, "degraded-default"));
    expect(result.current[0]).toBe("degraded-default");

    act(() => {
      result.current[1]("degraded-updated");
    });
    expect(result.current[0]).toBe("degraded-updated");
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});
