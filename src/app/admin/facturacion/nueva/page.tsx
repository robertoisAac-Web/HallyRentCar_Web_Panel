import { requirePermission } from "@/server/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { businessYmd } from "@/lib/dates";
import { ErrorBox, PageHeader } from "@/components/admin/ui";
import { ManualInvoiceForm, type CustomerOption, type VehicleOption } from "@/components/admin/ManualInvoiceForm";
import { createManualInvoiceAction } from "../actions";

export default async function NuevaFacturaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePermission("payments:write");
  const { error } = await searchParams;
  const sb = await createClient();

  const [{ data: customers }, { data: vehicles }] = await Promise.all([
    sb.from("customers").select("id,full_name,phone,email,id_number").order("full_name"),
    sb.from("vehicles").select("id,make,model,year,plate,daily_rate,currency").eq("is_active", true).order("make"),
  ]);

  const customerOptions: CustomerOption[] = (customers ?? []).map((c) => ({
    id: c.id as string,
    full_name: c.full_name as string,
    phone: (c.phone as string | null) ?? null,
    email: (c.email as string | null) ?? null,
    id_number: (c.id_number as string | null) ?? null,
  }));

  const vehicleOptions: VehicleOption[] = (vehicles ?? []).map((v) => ({
    id: v.id as string,
    label: `${v.make} ${v.model} ${v.year} (${v.plate})`,
    daily_rate: String(v.daily_rate),
    currency: (v.currency as "DOP" | "USD") ?? "DOP",
  }));

  const today = businessYmd(new Date());
  const dueDefault = businessYmd(new Date(Date.now() + 7 * 86400_000));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Nueva Factura Manual"
        subtitle="Crea una factura calculando automáticamente días de alquiler, descuentos, ITBIS y abonos."
      />
      <ErrorBox error={error} />
      <ManualInvoiceForm
        action={createManualInvoiceAction}
        customers={customerOptions}
        vehicles={vehicleOptions}
        defaultIssueDate={today}
        defaultDueDate={dueDefault}
      />
    </div>
  );
}
