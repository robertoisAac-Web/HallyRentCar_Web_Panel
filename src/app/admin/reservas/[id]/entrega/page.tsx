import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/server/auth/permissions";
import { getReservation } from "@/server/services/reservations";
import { ChecklistForm } from "@/components/admin/ChecklistForm";
import { ErrorBox, PageHeader } from "@/components/admin/ui";
import { handoverAction } from "../../finance-actions";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requirePermission("checklists:write");
  const { id } = await params;
  const { error } = await searchParams;
  const r = await getReservation(id);
  if (!r) notFound();
  return (
    <div>
      <Link href={`/admin/reservas/${id}`} className="text-sm underline">← {r.code}</Link>
      <div className="mt-2"><PageHeader title="Registrar entrega" subtitle={`${r.customer_name} · ${r.vehicle_label}`} /></div>
      <ErrorBox error={error} />
      <ChecklistForm action={handoverAction.bind(null, id, "pickup")} kind="pickup" lastOdometer={undefined} />
    </div>
  );
}
