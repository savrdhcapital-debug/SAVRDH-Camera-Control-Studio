"use client";

import { useCallback, useEffect, useState } from "react";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** localStorage-backed state. Loads after mount (SSR-safe) and syncs across tabs/windows. */
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return;
        const parsed: unknown = JSON.parse(raw);
        setValue(isObj(initial) && isObj(parsed) ? ({ ...initial, ...parsed } as T) : (parsed as T));
      } catch {
        /* corrupt value: keep default */
      }
    };
    read();
    setLoaded(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage full/blocked */
        }
        return next;
      });
    },
    [key],
  );

  return [value, set, loaded];
}
