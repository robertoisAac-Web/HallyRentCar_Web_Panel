/** Días enteros desde `nowYmd` hasta `ymd` (negativo = ya venció). Ambos YYYY-MM-DD. */
export function daysUntil(ymd: string, nowYmd: string): number {
  const a = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
  const b = Date.UTC(+nowYmd.slice(0, 4), +nowYmd.slice(5, 7) - 1, +nowYmd.slice(8, 10));
  return Math.round((a - b) / 86_400_000);
}

/** Una licencia es problema si vence antes (o el mismo día) de la devolución. */
export function licenseProblem(licenseExpiresOn: string | null, returnYmd: string): "expired" | "expires_during" | null {
  if (!licenseExpiresOn) return null;
  return licenseExpiresOn < returnYmd ? "expired" : licenseExpiresOn === returnYmd ? "expires_during" : null;
}
export const DOC_TYPE_LABEL: Record<string, string> = { insurance: "Seguro", registration: "Matrícula", inspection: "Inspección", other: "Otro" };
