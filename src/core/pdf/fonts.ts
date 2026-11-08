import path from "node:path";
import { Font } from "@react-pdf/renderer";

let registered = false;

/** Registers the bundled IBM Plex Sans Arabic (covers Arabic + Latin) once per process. Chosen over Noto because react-pdf drops the first base glyph of fonts that decompose dotted letters. */
export function registerPdfFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "public", "fonts");
  Font.register({
    family: "Plex",
    fonts: [
      { src: path.join(dir, "IBMPlexSansArabic-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "IBMPlexSansArabic-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Never split Arabic words (breaks shaping); allow long Latin tokens (emails, IBANs) to wrap.
  Font.registerHyphenationCallback((word) => (word.length > 16 && !/[؀-ۿ]/.test(word) ? (word.match(/.{1,12}/g) ?? [word]) : [word]));
  registered = true;
}
