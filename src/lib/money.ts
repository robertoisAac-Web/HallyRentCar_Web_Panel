// numeric(12,2) de Postgres llega como string ("3500.00"). Se convierte a centavos sin usar float.
export function toCents(value: string | number): number {
  const s = typeof value === "number" ? value.toFixed(2) : value.trim();
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new Error(`Importe inválido: ${s}`);
  const cents = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || "0");
  return m[1] ? -cents : cents;
}
export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
export function formatMoney(cents: number, currency: "DOP" | "USD" = "DOP"): string {
  const [int, dec] = fromCents(Math.abs(cents)).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const prefix = currency === "DOP" ? "RD$" : "US$";
  return `${cents < 0 ? "-" : ""}${prefix} ${grouped}.${dec}`;
}
