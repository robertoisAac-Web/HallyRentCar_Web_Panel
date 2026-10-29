import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/permissions";
import { getVehicle } from "@/server/services/vehicles";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { BlocksSection } from "@/components/admin/BlocksSection";
import { PhotosSection } from "@/components/admin/PhotosSection";
import { DocumentsSection } from "@/components/admin/DocumentsSection";
import { updateVehicleAction, setVehicleActiveAction } from "../actions";
import { VehicleTabs } from "@/components/admin/VehicleTabs";

export default async function EditVehiclePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const ctx = await requirePermission("vehicles:read");
  const { id } = await params;
  const { error, ok } = await searchParams;
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();
  const canWrite = ctx.permissions.has("vehicles:write");

  return (
    <div className="space-y-8">
      <h1 className="page-title">{vehicle.make} {vehicle.model} {vehicle.year}</h1>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && !error && <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-700">Cambios guardados.</p>}
      {canWrite ? (
        <VehicleTabs
          vehicleId={id}
          vehicle={vehicle}
          photosSection={<PhotosSection vehicleId={id} canWrite={canWrite} />}
          vehicleForm={<VehicleForm action={updateVehicleAction.bind(null, id)} vehicle={vehicle} submitLabel="Guardar cambios" />}
          documentsSection={<DocumentsSection vehicleId={id} canWrite={canWrite} />}
          blocksSection={<BlocksSection vehicleId={id} canWrite={ctx.permissions.has("availability:write")} />}
          deactivateSection={
            <section className="panel max-w-2xl">
              <h2 className="mb-2 font-medium">{vehicle.is_active ? "Desactivar vehículo" : "Reactivar vehículo"}</h2>
              <p className="mb-3 text-sm text-slate-600">
                {vehicle.is_active
                  ? "El vehículo dejará de aparecer como disponible. Su historial se conserva."
                  : "El vehículo volverá a estar disponible para reservas."}
              </p>
              <details>
                <summary className="cursor-pointer text-sm underline">{vehicle.is_active ? "Desactivar…" : "Reactivar…"}</summary>
                <form action={setVehicleActiveAction.bind(null, id, !vehicle.is_active)} className="mt-3">
                  <button className="btn btn-danger">
                    Confirmar: {vehicle.is_active ? "desactivar" : "reactivar"}
                  </button>
                </form>
              </details>
            </section>
          }
        />
      ) : (<p className="text-sm text-slate-600">Solo lectura: no tienes permiso para editar vehículos.</p>)}
    </div>
  );
}