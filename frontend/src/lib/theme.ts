import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const KEY = "civiclens_theme";

/** The saved choice, or dark (the app's original look) when nothing is saved. */
const readSaved = (): Theme => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* private mode / blocked storage: fall through */
  }
  return "dark";
};

let current: Theme =
  typeof document !== "undefined" && document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "light"
      ? "light"
      : "dark"
    : readSaved();

const listeners = new Set<() => void>();

const apply = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
};

if (typeof document !== "undefined") apply(current);

export const setTheme = (theme: Theme) => {
  if (theme === current) return;
  current = theme;
  apply(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* choice just won't persist */
  }
  listeners.forEach((l) => l());
};

export const toggleTheme = () => setTheme(current === "dark" ? "light" : "dark");

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => "dark" as Theme);
  return { theme, setTheme, toggle: toggleTheme };
}