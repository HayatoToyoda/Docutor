"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { en, ja, interpolate, type DictionaryKey } from "./dictionaries";

export type Locale = "en" | "ja";

const LOCALE_STORAGE_KEY = "docutor:locale";

// Record<DictionaryKey, string> rather than `Dictionary` (whose values are
// string literal types, from `en`'s `as const`): `ja`'s values are plain
// `string` (see dictionaries.ts), so a literal-typed record here would
// reject it. The literal types on `Dictionary`/`en` still do their job at
// the definition site — this is only the runtime lookup table.
const dictionaries: Record<Locale, Record<DictionaryKey, string>> = {
  en,
  ja,
};

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: DictionaryKey, params?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === "en" || stored === "ja" ? stored : null;
  } catch {
    // localStorage may be unavailable (e.g. private browsing); fall back to
    // browser-language detection below.
    return null;
  }
}

function detectInitialLocale(): Locale {
  const stored = readStoredLocale();
  if (stored) {
    return stored;
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.language?.toLowerCase().startsWith("ja")
  ) {
    return "ja";
  }
  return "en";
}

// A minimal external store (read via useSyncExternalStore below) rather
// than a plain useState. This is the pattern React recommends for reading a
// value that only exists on the client (localStorage / navigator.language)
// without a client/server hydration mismatch: `getServerSnapshot` always
// returns "en" for the server-rendered and first-client-render markup, and
// `getSnapshot` — which can see the real browser locale — takes over right
// after hydration, without the app ever calling `setState` inside an
// effect (React now considers that an anti-pattern; see
// react-hooks/set-state-in-effect).
let currentLocale: Locale = "en";
let initialized = false;
const listeners = new Set<() => void>();

function ensureInitialized() {
  if (initialized || typeof window === "undefined") {
    return;
  }
  initialized = true;
  currentLocale = detectInitialLocale();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Locale {
  ensureInitialized();
  return currentLocale;
}

function getServerSnapshot(): Locale {
  return "en";
}

function setStoreLocale(next: Locale) {
  currentLocale = next;
  initialized = true;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // Persistence is best-effort; the in-memory store still updates.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Provides the active locale and the `t()` translation function to every
 * screen (mounted once in src/app/layout.tsx).
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setLocale = useCallback((next: Locale) => {
    setStoreLocale(next);
  }, []);

  const t = useCallback(
    (key: DictionaryKey, params?: Record<string, string | number>) => {
      const template = dictionaries[locale][key];
      return interpolate(template, params);
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useT() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useT must be used within a LocaleProvider");
  }
  return context;
}
