import type { ESPNLeague } from './types';

export const LEAGUE_ID = 97124817;
export const SEASONS = [2020, 2021, 2022, 2023, 2024, 2025] as const;
export type Season = (typeof SEASONS)[number];

const CACHE_PREFIX = 'love-mahomies:season:';
const WEEK_CACHE_PREFIX = 'love-mahomies:week:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry<T = ESPNLeague> {
  fetchedAt: number;
  data: T;
}

function readCache<T = ESPNLeague>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T = ESPNLeague>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ fetchedAt: Date.now(), data } as CacheEntry<T>));
  } catch {
    // ignore quota errors
  }
}

export function clearCache(): void {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(CACHE_PREFIX) || k.startsWith(WEEK_CACHE_PREFIX)) {
      localStorage.removeItem(k);
    }
  }
}

// Build a URL that respects Vite's base path (e.g. /love-mahomies-oracle/
// when deployed under a GitHub Pages project subpath).
function dataUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/data/${path}`;
}

export async function fetchSeason(year: number, force = false): Promise<ESPNLeague> {
  const key = CACHE_PREFIX + year;
  if (!force) {
    const cached = readCache<ESPNLeague>(key);
    if (cached) return cached;
  }
  const res = await fetch(dataUrl(`${year}.json`));
  if (!res.ok) throw new Error(`Failed to fetch ${year}: HTTP ${res.status}`);
  const data: ESPNLeague = await res.json();
  writeCache(key, data);
  return data;
}

export async function fetchWeek(year: number, week: number): Promise<ESPNLeague> {
  const key = `${WEEK_CACHE_PREFIX}${year}-${week}`;
  const cached = readCache<ESPNLeague>(key);
  if (cached) return cached;
  const res = await fetch(dataUrl(`${year}/week-${week}.json`));
  if (!res.ok) throw new Error(`Failed to fetch ${year} wk${week}: HTTP ${res.status}`);
  const data: ESPNLeague = await res.json();
  writeCache(key, data);
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
    throw new Error('Could not load any season data. The data files may be missing — run `npm run fetch-data` to refresh.');
  }
  return out;
}
