import { listVehiclePhotos } from "@/server/services/vehicle-photos";
import { addPhotosAction, primaryPhotoAction, deletePhotoAction } from "@/app/admin/vehiculos/foto-actions";

export async function PhotosSection({ vehicleId, canWrite }: { vehicleId: string; canWrite: boolean }) {
  const photos = await listVehiclePhotos(vehicleId);
  return (
    <section className="panel max-w-2xl space-y-3">
      <h2>Fotografías</h2>
      <p className="text-sm text-[var(--color-muted)]">La foto principal aparece en las listas y en la web pública.</p>
      {photos.length === 0 ? <p className="text-sm text-[var(--color-muted)]">Todavía no hay fotos.</p> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{photos.map((p) => (
          <figure key={p.id} className="space-y-1">
            <img src={p.url} alt="Foto del vehículo" className="h-28 w-full rounded-lg object-cover" />
            <figcaption className="flex items-center justify-between text-xs">
              {p.is_primary ? <span className="font-semibold">Principal</span> : canWrite ? (
                <form action={primaryPhotoAction.bind(null, vehicleId, p.id)}><button className="underline">Hacer principal</button></form>) : <span />}
              {canWrite && (
                <details><summary className="cursor-pointer underline">Eliminar…</summary>
                  <form action={deletePhotoAction.bind(null, vehicleId, p.id)} className="mt-1"><button className="btn btn-danger btn-sm">Confirmar</button></form></details>)}
            </figcaption>
          </figure>))}</div>)}
      {canWrite && (
        <form action={addPhotosAction.bind(null, vehicleId)} className="space-y-2">
          <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required />
          <p className="text-xs text-[var(--color-muted)]">Hasta 6 por vez, 8 MB cada una, máximo 12 por vehículo. Mejor horizontales y con buena luz.</p>
          <button className="btn btn-secondary">Subir fotos</button>
        </form>)}
    </section>
  );
}
