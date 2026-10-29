import type { Lang } from "./i18n.ts";

// Valores "ingenuos" en hora local del negocio: "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm" (mismo formato que usa el servidor).
export const pad = (n: number) => String(n).padStart(2, "0");
const RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

export interface Parts { y: number; m: number; d: number; hh: number | null; mm: number | null }
export function parseValue(v: string | undefined | null): Parts | null {
  const x = v ? RE.exec(v) : null;
  if (!x) return null;
  const p = { y: +x[1], m: +x[2], d: +x[3], hh: x[4] !== undefined ? +x[4] : null, mm: x[5] !== undefined ? +x[5] : null };
  if (p.m < 1 || p.m > 12 || p.d < 1 || p.d > new Date(Date.UTC(p.y, p.m, 0)).getUTCDate()) return null;
  if (p.hh !== null && (p.hh > 23 || (p.mm ?? 0) > 59)) return null;
  return p;
}
export const ymdOf = (p: { y: number; m: number; d: number }) => `${p.y}-${pad(p.m)}-${pad(p.d)}`;
export function compose(ymd: string, hh?: number | null, mm?: number | null): string {
  return hh === null || hh === undefined ? ymd : `${ymd}T${pad(hh)}:${pad(mm ?? 0)}`;
}

/** Semanas del mes (lunes primero). Cada celda es "YYYY-MM-DD" o null. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`)];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
export function shiftMonthView(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function to12h(h24: number): { h12: number; pm: boolean } { return { h12: h24 % 12 === 0 ? 12 : h24 % 12, pm: h24 >= 12 }; }
export function from12h(h12: number, pm: boolean): number { return (h12 % 12) + (pm ? 12 : 0); }

/** Suma días calendario conservando la hora. */
export function addDays(value: string, n: number): string {
  const p = parseValue(value);
  if (!p) return value;
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return compose(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, p.hh, p.mm);
}
/** Compara solo el día (ignora la hora): negativo si a < b. */
export const compareDay = (a: string, b: string) => (a.slice(0, 10) < b.slice(0, 10) ? -1 : a.slice(0, 10) > b.slice(0, 10) ? 1 : 0);

export const PICKER_TEXT = {
  es: {
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    monthsShort: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    weekdays: ["lu", "ma", "mi", "ju", "vi", "sá", "do"], weekdaysShort: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
    placeholder: "Selecciona fecha", placeholderTime: "Selecciona fecha y hora", today: "Hoy", clear: "Limpiar", done: "Listo",
    hour: "Hora", minutes: "Minutos", prev: "Mes anterior", next: "Mes siguiente", quick: "Duración rápida",
    d1: "+1 día", d3: "+3 días", w1: "+1 semana", open: "Abrir calendario",
  },
  en: {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    placeholder: "Select date", placeholderTime: "Select date and time", today: "Today", clear: "Clear", done: "Done",
    hour: "Hour", minutes: "Minutes", prev: "Previous month", next: "Next month", quick: "Quick duration",
    d1: "+1 day", d3: "+3 days", w1: "+1 week", open: "Open calendar",
  },
} as const satisfies Record<Lang, unknown>;

export function formatDisplay(value: string | undefined | null, lang: Lang, mode: "date" | "datetime"): string {
  const p = parseValue(value);
  if (!p) return "";
  const T = PICKER_TEXT[lang];
  const wd = T.weekdaysShort[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  const day = lang === "es" ? `${wd} ${p.d} ${T.monthsShort[p.m - 1]} ${p.y}` : `${wd}, ${T.monthsShort[p.m - 1]} ${p.d}, ${p.y}`;
  if (mode === "date" || p.hh === null) return day;
  const { h12, pm } = to12h(p.hh);
  return `${day} · ${h12}:${pad(p.mm ?? 0)} ${pm ? "PM" : "AM"}`;
}
