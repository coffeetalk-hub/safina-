import { notFound } from "next/navigation";

/** Unknown URLs land here so they render the 404 inside the app shell instead of a bare page. */
export default function CatchAll() {
  notFound();
}
