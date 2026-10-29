export type ReservationStatus =
  | "pending" | "in_review" | "confirmed" | "in_progress" | "completed" | "rejected" | "cancelled";

// Debe coincidir con app.reservations_check_transition() en la base de datos.
const NEXT: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ["in_review", "confirmed", "rejected", "cancelled"],
  in_review: ["confirmed", "rejected", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [], rejected: [], cancelled: [],
};
export const allowedNext = (from: ReservationStatus) => NEXT[from];
export const canTransition = (from: ReservationStatus, to: ReservationStatus) => NEXT[from].includes(to);

/** SUPUESTO S6: confirmar o rechazar exige reservations:confirm (admin por defecto); el resto, reservations:write. */
export function permissionForTransition(to: ReservationStatus): "reservations:confirm" | "reservations:write" {
  return to === "confirmed" || to === "rejected" ? "reservations:confirm" : "reservations:write";
}

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Pendiente", in_review: "En revisión", confirmed: "Confirmada",
  in_progress: "En curso", completed: "Finalizada", rejected: "Rechazada", cancelled: "Cancelada",
};
export const CHANNELS = ["website", "whatsapp", "instagram", "phone", "referral", "other_rental", "other"] as const;
export const CHANNEL_LABEL: Record<(typeof CHANNELS)[number], string> = {
  website: "Sitio web", whatsapp: "WhatsApp", instagram: "Instagram", phone: "Teléfono",
  referral: "Referido", other_rental: "Otra rent a car", other: "Otro",
};
export const TRANSITION_LABEL: Partial<Record<ReservationStatus, string>> = {
  in_review: "Pasar a revisión", confirmed: "Confirmar", in_progress: "Marcar entrega (en curso)",
  completed: "Marcar devolución (finalizar)", rejected: "Rechazar", cancelled: "Cancelar",
};
