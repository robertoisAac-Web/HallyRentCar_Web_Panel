import Link from "next/link";
import { DateRangeFields } from "@/components/ui/DateRangeFields";
import { requirePermission } from "@/server/auth/permissions";
import { findAvailableVehicles, getCompanySettings } from "@/server/services/reservations";
import { listCustomers } from "@/server/services/customers";
import { parseBusinessLocal, isBusinessLocal } from "@/lib/dates";
import { billableDays } from "@/lib/pricing";
import { ErrorBox } from "@/components/admin/ui";
import { ReservationFormWithTabs } from "@/components/admin/ReservationFormWithTabs"; // 👈 Aquí importamos el formulario con pestañas

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ pickup?: string; return?: string; error?: string }>;
}) {
  const ctx = await requirePermission("reservations:write");
  const sp = await searchParams;
  const hasDates = sp.pickup && sp.return && isBusinessLocal(sp.pickup) && isBusinessLocal(sp.return);

  if (!hasDates) {
    return (
      <div>
        <h1 className="mb-2 page-title">Nueva reserva</h1>
        <p className="mb-6 text-sm text-slate-600">Paso 1 de 2: indica las fechas para ver los vehículos disponibles.</p>
        <ErrorBox error={sp.error} />
        <form className="max-w-md space-y-4">
          <DateRangeFields startName="pickup" endName="return" startLabel="Recogida" endLabel="Devolución" lang="es" />
          <button className="btn btn-primary">Ver disponibilidad</button>
        </form>
      </div>
    );
  }

  const pickup = parseBusinessLocal(sp.pickup!), ret = parseBusinessLocal(sp.return!);
  if (!(ret.getTime() > pickup.getTime()))
    return (
      <div>
        <ErrorBox error="La devolución debe ser posterior a la recogida." />
        <Link href="/admin/reservas/nueva" className="underline">Volver</Link>
      </div>
    );

  const [vehicles, customers, settings] = await Promise.all([
    findAvailableVehicles(pickup, ret),
    listCustomers(),
    getCompanySettings(),
  ]);
  const days = billableDays(pickup, ret, settings.grace_minutes);
  const canConfirm = ctx.permissions.has("reservations:confirm");

  return (
    <div>
      <h1 className="mb-2 page-title">Nueva reserva</h1>
      <p className="mb-6 text-sm text-slate-600">
        Paso 2 de 2 · {sp.pickup!.replace("T", " ")} → {sp.return!.replace("T", " ")} · {days} día(s) facturable(s) ·{" "}
        <Link href="/admin/reservas/nueva" className="underline">cambiar fechas</Link>
      </p>
      <ErrorBox error={sp.error} />

      {vehicles.length === 0 ? (
        <p className="empty">No hay vehículos disponibles en esas fechas.</p>
      ) : (
        <ReservationFormWithTabs
          sp={sp}
          vehicles={vehicles}
          customers={customers}
          days={days}
          canConfirm={canConfirm}
        />
      )}
    </div>
  );
}