"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

const MODULE_TITLES: Record<string, string> = {
  "/admin/dashboard": "Panel Principal",
  "/admin/calendario": "Calendario de Flota",
  "/admin/reservas": "Gestión de Reservas",
  "/admin/reservas/nueva": "Nueva Reserva",
  "/admin/vehiculos": "Flota de Vehículos",
  "/admin/vehiculos/nuevo": "Nuevo Vehículo",
  "/admin/clientes": "Directorio de Clientes",
  "/admin/clientes/nuevo": "Nuevo Cliente",
  "/admin/gastos": "Control de Gastos",
  "/admin/gastos/nuevo": "Registrar Gasto",
  "/admin/reportes": "Reportes Financieros",
  "/admin/usuarios": "Usuarios y Permisos",
  "/admin/configuracion": "Configuración del Sistema",
};

function resolveModuleTitle(pathname: string): string {
  if (MODULE_TITLES[pathname]) return MODULE_TITLES[pathname];
  for (const [key, title] of Object.entries(MODULE_TITLES)) {
    if (pathname.startsWith(key)) return title;
  }
  return "Panel Administrativo";
}

export function PwaInitializer() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Error registrando Service Worker:", err);
      });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      notifyListeners();
    };

    const handleAppInstalled = () => {
      globalDeferredPrompt = null;
      notifyListeners();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Si se abre en modo standalone (App de Escritorio) en la ruta pública "/",
    // redirigimos automáticamente al panel administrativo / login para ocultar la web pública.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: window-controls-overlay)").matches;

    if (isStandalone && pathname === "/") {
      router.replace("/admin/dashboard");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [pathname, router]);

  return null;
}

export function InstallDesktopButton({ variant = "sidebar" }: { variant?: "sidebar" | "login" }) {
  const [canPrompt, setCanPrompt] = useState<boolean>(Boolean(globalDeferredPrompt));
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  useEffect(() => {
    const checkState = () => {
      setCanPrompt(Boolean(globalDeferredPrompt));
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: window-controls-overlay)").matches;
      setIsStandalone(standalone);
    };

    checkState();
    listeners.add(checkState);

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    mediaQuery.addEventListener("change", checkState);

    return () => {
      listeners.delete(checkState);
      mediaQuery.removeEventListener("change", checkState);
    };
  }, []);

  async function handleInstallClick() {
    if (globalDeferredPrompt) {
      await globalDeferredPrompt.prompt();
      const choice = await globalDeferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        globalDeferredPrompt = null;
        notifyListeners();
      }
    } else {
      setShowHelpModal(true);
    }
  }

  if (isStandalone) {
    if (variant === "login") {
      return (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-2xs">
          <span className="inline-block h-2 w-2 rounded-full bg-[#76e012]" />
          <span className="font-medium">Aplicación de Escritorio · Sincronización en tiempo real</span>
        </div>
      );
    }
    return (
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-300">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#76e012] shadow-[0_0_6px_#76e012]" />
        <span className="truncate font-medium">App de Escritorio Activa</span>
      </div>
    );
  }

  return (
    <>
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="mb-3 flex w-full items-center justify-between gap-2 rounded-lg border border-[#76e012]/40 bg-[#76e012]/10 px-3 py-2.5 text-left text-xs font-semibold text-[#76e012] transition-all hover:bg-[#76e012]/20 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Instalar App en PC</span>
          </span>
          <span className="rounded bg-[#76e012] px-1.5 py-0.5 text-[10px] font-bold text-[#0a1926]">
            {canPrompt ? "1 clic" : "PC"}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#0a1926]">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span>Instalar aplicación en Windows / Escritorio</span>
        </button>
      )}

      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <img src="/icons/icon-192.png" alt="HallyRentCar" className="h-9 w-9 rounded-lg" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Instalar HallyRentCar en tu PC</h3>
                  <p className="text-xs text-slate-500">Acceso directo en Escritorio y Barra de Tareas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80">
                <p className="font-semibold text-slate-900 mb-1">En Microsoft Edge o Google Chrome:</p>
                <ol className="list-decimal pl-4 space-y-1.5 text-xs leading-relaxed">
                  <li>
                    Mira la parte derecha de la <strong>barra de direcciones</strong> (arriba a la derecha del navegador).
                  </li>
                  <li>
                    Haz clic en el ícono de <strong>Instalar aplicación</strong>{" "}
                    <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
                      🖥️ +
                    </span>{" "}
                    o abre el menú <strong>⋮</strong> y selecciona <strong>Aplicaciones → Instalar este sitio como una aplicación</strong>.
                  </li>
                  <li>
                    Marca las casillas <em>Crear acceso directo en el escritorio</em> y <em>Anclar a la barra de tareas</em>.
                  </li>
                </ol>
              </div>
              <p className="text-xs text-slate-500">
                Una vez instalada, abrirá siempre en su propia ventana limpia directamente en el Panel Administrativo y se actualizará automáticamente en tiempo real.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="btn btn-primary px-5 py-2 text-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DesktopTitleBar({ companyName }: { companyName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function handleRefresh() {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  }

  const moduleTitle = resolveModuleTitle(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-13 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-xs md:px-8">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => router.back()}
            title="Atrás"
            className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-2xs cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => router.forward()}
            title="Adelante"
            className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-2xs cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            title="Sincronizar datos ahora"
            className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-2xs cursor-pointer"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isRefreshing ? "animate-spin text-[#0a1926]" : ""}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </button>
        </div>

        <div className="ml-2 flex items-center gap-2 text-xs text-slate-400">
          <span className="hidden font-medium text-slate-500 sm:inline">{companyName}</span>
          <span className="hidden sm:inline">/</span>
          <span className="font-semibold text-slate-800 text-sm">{moduleTitle}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            isOnline
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isOnline ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          <span>{isOnline ? "Sincronizado en tiempo real" : "Sin conexión"}</span>
        </div>

        <Link
          href="/admin/reservas/nueva"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a1926] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          <span className="text-[#76e012] font-bold">+</span>
          <span>Nueva reserva</span>
        </Link>
      </div>
    </header>
  );
}
