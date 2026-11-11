// Service Worker para HallyRentCar Desktop PWA (Tiempo Real / Network-First)
const CACHE_NAME = "hally-desktop-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Estrategia 100% Tiempo Real (Network-First) para que todos los cambios del servidor
// y datos de Supabase se reflejen al instante sin necesidad de reinstalar.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>HallyRentCar · Sin conexión</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0a1926; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 24px; }
    .card { max-width: 420px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 32px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; background: #f59e0b; display: inline-block; margin-bottom: 12px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.5; margin: 0 0 24px; }
    button { background: #76e012; color: #0a1926; border: none; font-weight: 700; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="dot"></span>
    <h1>Sin conexión a internet</h1>
    <p>La aplicación de escritorio de HallyRentCar se sincroniza en tiempo real con la nube. Verifica tu conexión a internet e intenta nuevamente.</p>
    <button onclick="window.location.reload()">Reintentar conexión</button>
  </div>
</body>
</html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          )
      )
    );
  }
});
