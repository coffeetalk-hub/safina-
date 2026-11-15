/*
 * Self-destructing service worker.
 *
 * Safina does not use a service worker. This file exists because another local project
 * (a Vite PWA that also runs on localhost:3000) registers one at /sw.js with scope "/",
 * and the browser keeps serving that project's cached app for this origin long after its
 * server is gone. On the next visit the browser fetches /sw.js, finds this replacement,
 * installs it, and this worker wipes every cache, unregisters itself and reloads open tabs
 * so they land on Safina. It intercepts nothing, so it is harmless in production too.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await self.registration.unregister();
      for (const client of windows) {
        try {
          await client.navigate(client.url);
        } catch {
          /* tab will pick up the real page on its next load */
        }
      }
    })(),
  );
});
