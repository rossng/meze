import { useEffect, useState } from 'preact/hooks';

export interface JoinedNight {
  code: string;
  name: string;
}

const NIGHTS_KEY = 'meze:nights';
const ACTIVE_KEY = 'meze:activeNight';

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getJoinedNights(): JoinedNight[] {
  return read<JoinedNight[]>(NIGHTS_KEY, []);
}

export function rememberNight(n: JoinedNight) {
  const list = getJoinedNights().filter((x) => x.code !== n.code);
  list.unshift(n);
  localStorage.setItem(NIGHTS_KEY, JSON.stringify(list.slice(0, 30)));
  emit();
}

/** Add tables joined on another device, keeping whatever this one already knows. */
export function rememberNights(nights: JoinedNight[]) {
  const existing = getJoinedNights();
  const merged = [...nights, ...existing.filter((x) => !nights.some((n) => n.code === x.code))];
  localStorage.setItem(NIGHTS_KEY, JSON.stringify(merged.slice(0, 30)));
  emit();
}

export function forgetNight(code: string) {
  localStorage.setItem(NIGHTS_KEY, JSON.stringify(getJoinedNights().filter((x) => x.code !== code)));
  if (getActiveNight() === code) setActiveNight(null);
  emit();
}

export function getActiveNight(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveNight(code: string | null) {
  if (code) localStorage.setItem(ACTIVE_KEY, code);
  else localStorage.removeItem(ACTIVE_KEY);
  emit();
}

/** Subscribe a component to the local store. */
export function useStore() {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    window.addEventListener('storage', l);
    return () => {
      listeners.delete(l);
      window.removeEventListener('storage', l);
    };
  }, []);
  return {
    nights: getJoinedNights(),
    active: getActiveNight(),
  };
}
