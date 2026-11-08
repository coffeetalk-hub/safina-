import type { ReactNode } from "react";

// Root layout is a pass-through; the [locale] layout renders <html>/<body>.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
