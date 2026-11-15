import { THEME_BOOT_SCRIPT } from "./theme";

/** Inline boot script: applies the saved theme before the page paints (no flash of the wrong colours). */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />;
}
