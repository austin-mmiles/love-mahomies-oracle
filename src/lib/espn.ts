import type { ESPNLeague } from './types';

export const LEAGUE_ID = 97124817;
export const SEASONS = [2020, 2021, 2022, 2023, 2024, 2025] as const;
export type Season = (typeof SEASONS)[number];

const CACHE_PREFIX = 'gridiron-oracle:season:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  fetchedAt: number;
  data: ESPNLeague;
}

function readCache(year: number): ESPNLeague | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + year);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(year: number, data: ESPNLeague): void {
  try {
    const entry: CacheEntry = { fetchedAt: Date.now(), data };
    localStorage.setItem(CACHE_PREFIX + year, JSON.stringify(entry));
  } catch {
    // quota exceeded or storage unavailable — ignore, we just won't cache
  }
}

export function clearCache(): void {
  for (const y of SEASONS) localStorage.removeItem(CACHE_PREFIX + y);
}

const WEEK_CACHE_PREFIX = 'gridiron-oracle:week:';

interface WeekCacheEntry {
  fetchedAt: number;
  data: ESPNLeague;
}

export async function fetchWeek(year: number, week: number): Promise<ESPNLeague> {
  const key = `${WEEK_CACHE_PREFIX}${year}-${week}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const entry: WeekCacheEntry = JSON.parse(raw);
      if (Date.now() - entry.fetchedAt < CACHE_TTL_MS) return entry.data;
    }
  } catch {
    // ignore
  }
  const res = await fetch(`/api/espn/${year}/week/${week}`);
  if (!res.ok) throw new Error(`Failed to fetch ${year} wk${week}: HTTP ${res.status}`);
  const data: ESPNLeague = await res.json();
  try {
    localStorage.setItem(key, JSON.stringify({ fetchedAt: Date.now(), data } as WeekCacheEntry));
  } catch {
    // ignore quota errors
  }
  return data;
}

export async function fetchSeason(year: number, force = false): Promise<ESPNLeague> {
  if (!force) {
    const cached = readCache(year);
    if (cached) return cached;
  }
  // Both dev and prod hit /api/espn/:year. In dev, Vite's proxy rewrites it to
  // ESPN's public read endpoint (see vite.config.ts). In prod, Vercel routes it
  // to api/espn/[year].ts which adds edge caching + optional cookie auth.
  const res = await fetch(`/api/espn/${year}`);
  if (!res.ok) throw new Error(`Failed to fetch ${year}: HTTP ${res.status}`);
  const data: ESPNLeague = await res.json();
  writeCache(year, data);
  return data;
}

export async function loadAllSeasons(
  onProgress?: (loaded: number, total: number, year: number) => void,
): Promise<Record<number, ESPNLeague>> {
  const out: Record<number, ESPNLeague> = {};
  let loaded = 0;
  for (const year of SEASONS) {
    onProgress?.(loaded, SEASONS.length, year);
    try {
      out[year] = await fetchSeason(year);
    } catch (e) {
      console.warn(`Skipping ${year}:`, e);
    }
    loaded++;
  }
  onProgress?.(loaded, SEASONS.length, SEASONS[SEASONS.length - 1]);
  if (Object.keys(out).length === 0) {
    throw new Error('Could not load any season data.');
  }
  return out;
}
