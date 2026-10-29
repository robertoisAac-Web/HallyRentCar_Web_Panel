import { businessMonth, businessYmd, businessDayStart } from "./dates.ts";
export interface Range { from: string; to: string }
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Rango de reportes: por defecto el mes actual (hora de Santo Domingo). Valida el formato. */
export function resolveRange(from?: string, to?: string, now = new Date()): Range {
  const month = businessMonth(now);
  const defFrom = `${month}-01`;
  const defTo = businessYmd(now);
  const f = from && YMD.test(from) ? from : defFrom;
  const t = to && YMD.test(to) ? to : defTo;
  if (Number.isNaN(businessDayStart(f).getTime()) || Number.isNaN(businessDayStart(t).getTime())) return { from: defFrom, to: defTo };
  return f <= t ? { from: f, to: t } : { from: t, to: f };
}
