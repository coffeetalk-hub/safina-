/** Light / dark / system theme kept in localStorage; applied as the `dark` class on <html>. Client-safe, no React. */
export type Theme = "light" | "dark" | "system";
export const THEME_KEY = "safina-theme";
const EVENT = "safina-theme-change";

export function readTheme(): Theme {
  if (typeof document === "undefined") return "system";
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  el.dataset.theme = theme;
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(EVENT));
}

/** Re-renders subscribers when the user picks a theme or the OS scheme flips while on "system". */
export function subscribeTheme(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (readTheme() === "system") applyTheme("system");
    callback();
  };
  window.addEventListener(EVENT, callback);
  mq.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, callback);
    mq.removeEventListener("change", onSystem);
  };
}

/** Runs before paint (inline in <head>) so the first frame already has the right colours. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)})||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";e.dataset.theme=t;}catch(e){}})();`;
