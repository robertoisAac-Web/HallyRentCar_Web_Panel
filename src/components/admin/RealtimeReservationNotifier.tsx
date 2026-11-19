"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface PendingReservationItem {
  id: string;
  code: string;
  status: string;
  channel: string;
  pickup_at: string;
  return_at: string;
  pickup_location: string | null;
  return_location: string | null;
  total_amount: string;
  currency: "DOP" | "USD";
  created_at: string;
  customer?: { full_name?: string; phone?: string } | { full_name?: string; phone?: string }[] | null;
  vehicle?: { make?: string; model?: string; year?: number; plate?: string } | { make?: string; model?: string; year?: number; plate?: string }[] | null;
}

const STORAGE_KEY = "hally_notified_pending_reservations_v1";

function normalizeSingle<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? (val[0] ?? null) : val;
}

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [587.33, 880]; // D5 -> A5 chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.36);
    });
  } catch {
    // Ignore if browser blocks autoplay before user interaction
  }
}

function buildCustomerWhatsAppReply(item: PendingReservationItem): string | null {
  const customer = normalizeSingle(item.customer);
  const vehicle = normalizeSingle(item.vehicle);
  const rawPhone = (customer?.phone ?? "").replace(/\D/g, "");
  if (rawPhone.length < 7) return null;
  const fullPhone = rawPhone.length === 10 ? `1${rawPhone}` : rawPhone;

  const vehicleName = vehicle ? `${vehicle.make ?? ""} ${vehicle.model ?? ""} ${vehicle.year ?? ""}`.trim() : "vehículo solicitado";
  const pickupStr = new Date(item.pickup_at).toLocaleString("es-DO", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const returnStr = new Date(item.return_at).toLocaleString("es-DO", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const msg = [
    `¡Hola ${customer?.full_name ?? ""}! 👋`,
    `Te escribimos de *Hally Rent a Car* respecto a tu solicitud de reserva web *${item.code}*.`,
    "",
    `🚘 *Vehículo:* ${vehicleName}`,
    `📅 *Recogida:* ${pickupStr}`,
    `🏁 *Devolución:* ${returnStr}`,
    "",
    "Hemos recibido tu solicitud en nuestro sistema. ¿Deseas que procedamos a confirmarla?",
  ].join("\n");

  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
}

export function RealtimeReservationNotifier() {
  const [activeAlerts, setActiveAlerts] = useState<PendingReservationItem[]>([]);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");
  const initializedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPerm(Notification.permission);
    }
  }, []);

  const requestDesktopPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function checkPendingReservations() {
      try {
        const res = await fetch("/api/v1/notificaciones/reservas-pendientes", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { reservations?: PendingReservationItem[] };
        const list = json.reservations ?? [];
        if (!mounted) return;

        let seenIds: string[] = [];
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) seenIds = JSON.parse(raw) as string[];
        } catch {
          seenIds = [];
        }

        const seenSet = new Set(seenIds);
        const newItems = list.filter((r) => !seenSet.has(r.id));

        if (newItems.length > 0) {
          // Record seen IDs
          const updatedSeen = Array.from(new Set([...seenIds, ...newItems.map((r) => r.id)])).slice(-100);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSeen));
          } catch {
            // ignore storage errors
          }

          setActiveAlerts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            return [...newItems.filter((n) => !existingIds.has(n.id)), ...prev];
          });

          playNotificationChime();

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            for (const item of newItems) {
              const customer = normalizeSingle(item.customer);
              const vehicle = normalizeSingle(item.vehicle);
              const vehicleName = vehicle ? `${vehicle.make ?? ""} ${vehicle.model ?? ""} ${vehicle.year ?? ""}`.trim() : "Vehículo";
              try {
                new Notification(`🚗 Nueva Reserva Web: ${item.code}`, {
                  body: `${customer?.full_name ?? "Cliente"} (${customer?.phone ?? "Sin tel"}) • ${vehicleName}`,
                  icon: "/icon.png",
                });
              } catch {
                // ignore notification constructor errors
              }
            }
          }
        }

        initializedRef.current = true;
      } catch {
        // Ignore transient network errors
      }
    }

    checkPendingReservations();
    const timer = setInterval(checkPendingReservations, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const dismissAlert = (id: string) => {
    setActiveAlerts((prev) => prev.filter((item) => item.id !== id));
  };

  if (activeAlerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {activeAlerts.map((item) => {
        const customer = normalizeSingle(item.customer);
        const vehicle = normalizeSingle(item.vehicle);
        const vehicleName = vehicle
          ? `${vehicle.make ?? ""} ${vehicle.model ?? ""} ${vehicle.year ?? ""}`.trim()
          : "Vehículo";
        const waReplyUrl = buildCustomerWhatsAppReply(item);

        return (
          <div
            key={item.id}
            className="pointer-events-auto rounded-2xl border border-emerald-200 bg-white p-4 shadow-[0_16px_40px_rgb(15,23,42,0.14)] transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Nueva Reserva Recibida
                </span>
              </div>
              <button
                type="button"
                onClick={() => dismissAlert(item.id)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold px-1.5 py-0.5 rounded cursor-pointer"
                aria-label="Cerrar alerta"
              >
                ✕
              </button>
            </div>

            <div className="mt-2.5 space-y-1 text-xs text-slate-700">
              <p className="text-sm font-bold text-slate-900">
                {customer?.full_name ?? "Cliente Web"}{" "}
                <span className="font-mono text-xs font-semibold text-slate-500">
                  ({item.code})
                </span>
              </p>
              <p className="font-medium text-slate-600">🚘 {vehicleName}</p>
              {customer?.phone && (
                <p className="text-slate-500">📞 Tel: {customer.phone}</p>
              )}
              <p className="text-[11px] text-slate-400">
                📅 {new Date(item.pickup_at).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })} →{" "}
                {new Date(item.return_at).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {waReplyUrl && (
                <a
                  href={waReplyUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => dismissAlert(item.id)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#16a34a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#15803d] transition-colors"
                >
                  <span>📲 Responder por WhatsApp</span>
                </a>
              )}
              <Link
                href={`/admin/reservas/${item.id}`}
                onClick={() => dismissAlert(item.id)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
              >
                Ver reserva
              </Link>
            </div>

            {notifPerm === "default" && (
              <button
                type="button"
                onClick={requestDesktopPermission}
                className="mt-2.5 w-full text-left text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
              >
                🔔 Activar notificaciones emergentes de Windows
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
