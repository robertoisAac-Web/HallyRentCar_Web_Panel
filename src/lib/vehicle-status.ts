// Estado operativo derivado. El único dato manual es is_active; el resto sale de reservas y bloqueos.
export type VehicleStatus = "available" | "reserved" | "rented" | "maintenance" | "blocked" | "inactive";

export interface ReservationLite { vehicle_id: string; status: string; pickup_at: string; return_at: string }
export interface BlockLite { vehicle_id: string; kind: "maintenance" | "manual"; starts_at: string; ends_at: string }

export function deriveVehicleStatus(
  vehicle: { id: string; is_active: boolean },
  reservations: ReservationLite[],
  blocks: BlockLite[],
  now: Date = new Date(),
): VehicleStatus {
  if (!vehicle.is_active) return "inactive";
  const t = now.getTime();
  const mine = reservations.filter((r) => r.vehicle_id === vehicle.id);

  if (mine.some((r) => r.status === "in_progress")) return "rented";

  const covering = blocks.find(
    (b) => b.vehicle_id === vehicle.id && new Date(b.starts_at).getTime() <= t && t < new Date(b.ends_at).getTime(),
  );
  if (covering) return covering.kind === "maintenance" ? "maintenance" : "blocked";

  if (mine.some((r) => r.status === "confirmed" && new Date(r.return_at).getTime() > t)) return "reserved";
  return "available";
}

export const STATUS_LABEL: Record<VehicleStatus, string> = {
  available: "Disponible", reserved: "Reservado", rented: "Alquilado",
  maintenance: "En mantenimiento", blocked: "Bloqueado", inactive: "Inactivo",
};
