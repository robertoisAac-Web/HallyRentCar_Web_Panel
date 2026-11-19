"use client";

import { useEffect, useState } from "react";

export function WhatsAppAutoRedirect({ waUrl }: { waUrl: string }) {
  const [secondsLeft, setSecondsLeft] = useState(2);
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    if (!waUrl) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setLaunched(true);
          window.location.href = waUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 900);

    return () => clearInterval(interval);
  }, [waUrl]);

  return (
    <p className="text-xs font-medium text-emerald-700">
      {launched
        ? "✓ Abriendo WhatsApp con los datos de tu reserva…"
        : `Redirigiendo automáticamente a nuestro WhatsApp en ${secondsLeft}s para atención inmediata…`}
    </p>
  );
}
