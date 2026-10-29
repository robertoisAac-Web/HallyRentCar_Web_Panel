import type { ReactNode } from "react";
import Link from "next/link";
import type { VehicleStatus } from "@/lib/vehicle-status";
import type { ReservationStatus } from "@/lib/reservation-rules";

export const inputCls = "input";

export function ErrorBox({ error }: { error?: string }) {
  return error ? (
    <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-800 shadow-xs">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <div><p className="font-semibold text-red-900">Atención</p><p className="mt-0.5 text-red-700">{error}</p></div>
    </div>
  ) : null;
}

export function OkBox({ ok, error }: { ok?: string; error?: string }) {
  return ok && !error ? (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-800 shadow-xs">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <div><p className="font-semibold text-emerald-900">Operación exitosa</p><p className="mt-0.5 text-emerald-700">Los cambios han sido guardados correctamente.</p></div>
    </div>
  ) : null;
}

export function PageHeader({
  title,
  subtitle,
  action,
  showHomeLink = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  showHomeLink?: boolean;
}) {
  const isHome = title === "Inicio";

  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-slate-200/70 pb-6 md:flex-row md:items-center md:justify-between">
      <div>
        {!isHome && showHomeLink && (
          <Link
            href="/admin/dashboard"
            className="group mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[var(--color-brand)] transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-hover:-translate-x-0.5"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span>Volver a Inicio</span>
          </Link>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {!isHome && showHomeLink && (
          <Link
            href="/admin/dashboard"
            className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-slate-700 shadow-xs hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
            title="Finalizar tarea y regresar a Inicio"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Terminar e ir a Inicio</span>
          </Link>
        )}
        {action}
      </div>
    </div>
  );
}

export function Plate({ children }: { children: ReactNode }) {
  return <span className="plate">{children}</span>;
}

const VEHICLE_TONE: Record<VehicleStatus, string> = {
  available: "green",
  reserved: "blue",
  rented: "amber",
  maintenance: "orange",
  blocked: "gray",
  inactive: "gray",
};

const RESERVATION_TONE: Record<ReservationStatus, string> = {
  pending: "sky",
  in_review: "violet",
  confirmed: "blue",
  in_progress: "amber",
  completed: "green",
  rejected: "red",
  cancelled: "gray",
};

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export const vehicleTone = (s: VehicleStatus) => VEHICLE_TONE[s];
export const reservationTone = (s: ReservationStatus) => RESERVATION_TONE[s];
