import { requirePermission } from "@/server/auth/permissions";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { createVehicleAction } from "../actions";

export default async function NewVehiclePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePermission("vehicles:write");
  const { error } = await searchParams;
  return (
    <div>
      <h1 className="mb-6 page-title">Nuevo vehículo</h1>
      {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <VehicleForm action={createVehicleAction} submitLabel="Guardar vehículo" />
    </div>
  );
}
