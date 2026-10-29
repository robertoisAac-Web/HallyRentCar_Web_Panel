export const BUSINESS_TZ = "America/Santo_Domingo";
// República Dominicana no usa horario de verano: UTC-4 todo el año.
const OFFSET_HOURS = 4;
const LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function formatBusinessDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat("es-DO", { timeZone: BUSINESS_TZ, dateStyle: "medium", timeStyle: "short" })
    .format(typeof d === "string" ? new Date(d) : d);
}

/** "2026-12-01T10:00" (hora de Santo Domingo, como la envía <input type=datetime-local>) -> Date UTC. */
export function parseBusinessLocal(s: string): Date {
  if (!LOCAL_RE.test(s)) throw new Error("Fecha y hora inválidas");
  const d = new Date(`${s}:00-0${OFFSET_HOURS}:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Fecha y hora inválidas");
  return d;
}
export const isBusinessLocal = (s: string) => LOCAL_RE.test(s);

/** Date UTC -> "YYYY-MM-DDTHH:mm" en hora de Santo Domingo. */
export function toBusinessLocalInput(d: Date): string {
  return new Date(d.getTime() - OFFSET_HOURS * 3600_000).toISOString().slice(0, 16);
}
export const businessYmd = (d: Date) => toBusinessLocalInput(d).slice(0, 10);
export const businessDayStart = (ymd: string) => parseBusinessLocal(`${ymd}T00:00`);
export const businessMonth = (d: Date) => toBusinessLocalInput(d).slice(0, 7);
