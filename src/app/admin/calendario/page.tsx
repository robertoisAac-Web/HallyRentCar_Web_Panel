import Link from "next/link";
import { requirePermission } from "@/server/auth/permissions";
import { getCalendarData } from "@/server/services/dashboard";
import { businessDayStart, businessMonth, businessYmd } from "@/lib/dates";
import { daysOfMonth, itemsForDay, shiftMonth, type CalKind } from "@/lib/calendar";
import { PageHeader, Plate } from "@/components/admin/ui";

const LEGEND: { kind: CalKind; label: string; dot: string; pill: string }[] = [
  { kind: "in_progress", label: "Alquiler en curso", dot: "bg-amber-500", pill: "bg-amber-50 border-amber-200 text-amber-800" },
  { kind: "confirmed", label: "Confirmada", dot: "bg-blue-600", pill: "bg-blue-50 border-blue-200 text-blue-800" },
  { kind: "in_review", label: "En revisión", dot: "bg-indigo-500", pill: "bg-indigo-50 border-indigo-200 text-indigo-800" },
  { kind: "pending", label: "Pendiente", dot: "bg-sky-400", pill: "bg-sky-50 border-sky-200 text-sky-800" },
  { kind: "maintenance", label: "Mantenimiento", dot: "bg-rose-500", pill: "bg-rose-50 border-rose-200 text-rose-800" },
  { kind: "blocked", label: "Bloqueo manual", dot: "bg-slate-600", pill: "bg-slate-100 border-slate-200 text-slate-800" },
];

const RIBBON_STYLE: Record<CalKind, string> = {
  in_progress: "bg-amber-500 text-white shadow-xs shadow-amber-500/25",
  confirmed: "bg-blue-600 text-white shadow-xs shadow-blue-600/25",
  in_review: "bg-indigo-500 text-white shadow-xs shadow-indigo-500/25",
  pending: "bg-sky-100 text-sky-800 border border-sky-300 border-dashed font-semibold",
  maintenance: "bg-rose-500 text-white shadow-xs shadow-rose-500/25",
  blocked: "bg-slate-600 text-white shadow-xs shadow-slate-600/25",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requirePermission("reservations:read");
  const sp = await searchParams;
  const todayYmd = businessYmd(new Date());
  const currentMonth = businessMonth(new Date());
  const month = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : currentMonth;
  const days = daysOfMonth(month);
  const monthStart = businessDayStart(days[0]);
  const monthEnd = new Date(businessDayStart(days[days.length - 1]).getTime() + 24 * 3600_000);
  const { vehicles, items } = await getCalendarData(monthStart, monthEnd);

  const monthLabel = new Intl.DateTimeFormat("es-DO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Calendario · ${monthLabel}`}
        subtitle="Cronograma visual de ocupación, reservas confirmadas y disponibilidad de la flota."
        action={
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <Link
              href={`/admin/calendario?month=${shiftMonth(month, -1)}`}
              className="btn btn-secondary btn-sm py-1 px-2.5 text-xs text-slate-600 hover:text-slate-900 border-none shadow-none"
              title="Mes anterior"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
              <span className="hidden sm:inline">Anterior</span>
            </Link>
            <Link
              href="/admin/calendario"
              className={`btn btn-sm py-1 px-3 text-xs font-semibold ${
                month === currentMonth
                  ? "bg-slate-100 text-slate-900 shadow-none border-none"
                  : "btn-secondary border-none shadow-none text-slate-600"
              }`}
            >
              Hoy
            </Link>
            <Link
              href={`/admin/calendario?month=${shiftMonth(month, 1)}`}
              className="btn btn-secondary btn-sm py-1 px-2.5 text-xs text-slate-600 hover:text-slate-900 border-none shadow-none"
              title="Mes siguiente"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
          </div>
        }
      />

      {/* Leyenda limpia y ordenada */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {LEGEND.map((l) => (
          <span
            key={l.kind}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${l.pill}`}
          >
            <span className={`h-2 w-2 rounded-full ${l.dot}`} />
            {l.label}
          </span>
        ))}
      </div>

      {vehicles.length === 0 ? (
        <p className="empty">No hay vehículos registrados en la flota.</p>
      ) : (
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80">
                  {/* Columna fija de vehículos */}
                  <th className="sticky left-0 z-20 bg-slate-50/95 backdrop-blur-xs py-3 px-4 font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200 min-w-[210px] shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    Vehículo
                  </th>

                  {/* Encabezados de días */}
                  {days.map((d) => {
                    const dateObj = new Date(`${d}T12:00:00Z`);
                    const weekday = new Intl.DateTimeFormat("es-DO", { weekday: "narrow", timeZone: "UTC" }).format(dateObj);
                    const isWeekend = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;
                    const isToday = d === todayYmd;
                    const dayNum = Number(d.slice(8));

                    return (
                      <th
                        key={d}
                        className={`min-w-[42px] py-2 px-1 text-center font-normal transition-colors border-r border-slate-100/60 ${
                          isToday
                            ? "bg-sky-50/80 font-bold"
                            : isWeekend
                            ? "bg-slate-100/40 text-slate-400"
                            : "text-slate-500"
                        }`}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-0.5">
                          {weekday}
                        </div>
                        <div
                          className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs transition-transform ${
                            isToday
                              ? "bg-[#0c1e2e] font-bold text-[#76e012] border border-[#76e012]/50 shadow-xs"
                              : "font-medium"
                          }`}
                        >
                          {dayNum}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {vehicles.map((v, vIndex) => {
                  const isEven = vIndex % 2 === 0;

                  return (
                    <tr
                      key={v.id}
                      className={`group transition-colors ${
                        isEven ? "bg-white" : "bg-slate-50/30"
                      } hover:bg-sky-50/20`}
                    >
                      {/* Vehículo - Sticky a la izquierda */}
                      <td
                        className={`sticky left-0 z-10 py-3 px-4 border-r border-slate-200/90 border-b border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)] ${
                          isEven ? "bg-white" : "bg-slate-50/40"
                        } group-hover:bg-slate-50/90 transition-colors`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/admin/vehiculos/${v.id}`}
                              className="font-bold text-slate-900 hover:text-[var(--color-brand)] truncate block transition-colors"
                            >
                              {v.make} {v.model}
                            </Link>
                            <p className="text-[11px] text-slate-400">
                              {v.year} {!v.is_active && <span className="text-red-500 font-semibold">(Inactivo)</span>}
                            </p>
                          </div>
                          <Plate>{v.plate}</Plate>
                        </div>
                      </td>

                      {/* Días del mes en timeline */}
                      {days.map((d, dIdx) => {
                        const dateObj = new Date(`${d}T12:00:00Z`);
                        const isWeekend = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;
                        const isToday = d === todayYmd;

                        const hit = itemsForDay(items, v.id, businessDayStart(d))[0];
                        const prevD = dIdx > 0 ? days[dIdx - 1] : null;
                        const nextD = dIdx < days.length - 1 ? days[dIdx + 1] : null;

                        const prevHit = prevD ? itemsForDay(items, v.id, businessDayStart(prevD))[0] : null;
                        const nextHit = nextD ? itemsForDay(items, v.id, businessDayStart(nextD))[0] : null;

                        const isSameAsPrev = prevHit && hit && prevHit.label === hit.label && prevHit.kind === hit.kind;
                        const isSameAsNext = nextHit && hit && nextHit.label === hit.label && nextHit.kind === hit.kind;

                        let ribbonRounding = "rounded-lg mx-1";
                        if (isSameAsPrev && isSameAsNext) {
                          ribbonRounding = "rounded-none mx-0";
                        } else if (isSameAsPrev && !isSameAsNext) {
                          ribbonRounding = "rounded-r-lg ml-0 mr-1";
                        } else if (!isSameAsPrev && isSameAsNext) {
                          ribbonRounding = "rounded-l-lg ml-1 mr-0";
                        }

                        const showLabel = !isSameAsPrev;

                        return (
                          <td
                            key={d}
                            className={`h-12 p-0 border-b border-slate-100 border-r border-slate-100/50 relative transition-colors ${
                              isToday
                                ? "bg-sky-50/30"
                                : isWeekend
                                ? "bg-slate-50/40"
                                : ""
                            }`}
                          >
                            {hit ? (
                              <div
                                title={`${hit.label} (${hit.kind})`}
                                className={`h-7 flex items-center justify-center text-[10px] tracking-tight transition-transform ${ribbonRounding} ${RIBBON_STYLE[hit.kind]}`}
                              >
                                {showLabel && (
                                  <span className="truncate px-1.5 font-bold uppercase tracking-wider text-[10px]">
                                    {hit.label}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="h-full w-full group-hover:bg-slate-50/30 transition-colors" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        * Las barras continuas representan la duración de las reservas y estados de cada auto en el mes seleccionado.
      </p>
    </div>
  );
}
