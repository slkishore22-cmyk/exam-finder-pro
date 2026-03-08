import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface HallRecord {
  roll_number: string;
  hall_number: string;
}

interface CachedResult {
  hall_number: string;
  timestamp: number;
}

const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MEMORY_REFRESH_MS = 30 * 60 * 1000; // 30 minutes
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// ── Request deduplication ──
const inflightRequests = new Map<string, Promise<HallRecord | null>>();

function deduplicatedFetch(roll: string): Promise<HallRecord | null> {
  const key = roll.toUpperCase().trim();
  if (inflightRequests.has(key)) return inflightRequests.get(key)!;

  const promise = (async () => {
    try {
      const { data } = await supabase
        .from("hall_assignments")
        .select("roll_number, hall_number")
        .eq("roll_number", key)
        .limit(1)
        .maybeSingle();
      return data ? { roll_number: data.roll_number, hall_number: data.hall_number } : null;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, promise);
  return promise;
}

// ── localStorage helpers ──
function getLocalCache(roll: string): CachedResult | null {
  try {
    const raw = localStorage.getItem(`roll_${roll}`);
    if (!raw) return null;
    const parsed: CachedResult = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(`roll_${roll}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setLocalCache(roll: string, hall_number: string) {
  try {
    localStorage.setItem(`roll_${roll}`, JSON.stringify({ hall_number, timestamp: Date.now() }));
  } catch { /* quota exceeded – ignore */ }
}

export type SearchSource = "local" | "memory" | "db" | null;

export function useHallCache() {
  const memoryCache = useRef<Map<string, HallRecord>>(new Map());
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheProgress, setCacheProgress] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setInterval>>();
  const rateBucket = useRef<number[]>([]);

  // ── Preload all assignments into memory ──
  const loadMemoryCache = useCallback(async () => {
    setCacheProgress(10);
    try {
      // Fetch in pages of 1000 to handle large datasets
      let allData: HallRecord[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        setCacheProgress(Math.min(10 + (from / 100), 80));
        const { data, error } = await supabase
          .from("hall_assignments")
          .select("roll_number, hall_number")
          .range(from, from + pageSize - 1);

        if (error || !data) break;
        allData = allData.concat(data.map(d => ({ roll_number: d.roll_number, hall_number: d.hall_number })));
        hasMore = data.length === pageSize;
        from += pageSize;
      }

      const newMap = new Map<string, HallRecord>();
      for (const r of allData) {
        newMap.set(r.roll_number.toUpperCase(), r);
      }
      memoryCache.current = newMap;
      setCacheProgress(100);
      setCacheReady(true);
    } catch {
      // Silently fail – individual lookups will hit DB
      setCacheReady(true);
      setCacheProgress(100);
    }
  }, []);

  useEffect(() => {
    loadMemoryCache();
    refreshTimer.current = setInterval(loadMemoryCache, MEMORY_REFRESH_MS);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [loadMemoryCache]);

  // ── Rate limiting ──
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    rateBucket.current = rateBucket.current.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (rateBucket.current.length >= RATE_LIMIT_MAX) return false;
    rateBucket.current.push(now);
    return true;
  }, []);

  // ── Multi-layer search ──
  const search = useCallback(async (
    rollNumber: string
  ): Promise<{ result: HallRecord | null; source: SearchSource; rateLimited?: boolean; offline?: boolean }> => {
    const roll = rollNumber.trim().toUpperCase();
    if (!roll) return { result: null, source: null };

    // Level 1: localStorage (no rate limit count)
    const local = getLocalCache(roll);
    if (local) {
      return { result: { roll_number: roll, hall_number: local.hall_number }, source: "local" };
    }

    // Level 2: Memory cache (no rate limit count)
    const memHit = memoryCache.current.get(roll);
    if (memHit) {
      setLocalCache(roll, memHit.hall_number);
      return { result: memHit, source: "memory" };
    }

    // Only count as rate-limited request when hitting the database (new roll number)
    if (!checkRateLimit()) {
      return { result: null, source: null, rateLimited: true };
    }

    // Level 3: Database (with dedup)
    try {
      const dbResult = await deduplicatedFetch(roll);
      if (dbResult) {
        setLocalCache(roll, dbResult.hall_number);
        memoryCache.current.set(roll, dbResult);
      }
      return { result: dbResult, source: "db" };
    } catch {
      // Offline fallback – check localStorage one more time with expired entries
      try {
        const raw = localStorage.getItem(`roll_${roll}`);
        if (raw) {
          const parsed: CachedResult = JSON.parse(raw);
          return {
            result: { roll_number: roll, hall_number: parsed.hall_number },
            source: "local",
            offline: true,
          };
        }
      } catch { /* ignore */ }
      return { result: null, source: null, offline: true };
    }
  }, [checkRateLimit]);

  return { search, cacheReady, cacheProgress };
}
