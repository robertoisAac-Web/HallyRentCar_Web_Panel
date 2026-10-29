export interface Period { start: Date; end: Date }

/** Milisegundos ocupados dentro de [rangeStart, rangeEnd): une períodos solapados y recorta al rango. */
export function occupiedMs(periods: Period[], rangeStart: Date, rangeEnd: Date): number {
  const rs = rangeStart.getTime(), re = rangeEnd.getTime();
  const clipped = periods
    .map((p) => [Math.max(p.start.getTime(), rs), Math.min(p.end.getTime(), re)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0, curStart = -1, curEnd = -1;
  for (const [a, b] of clipped) {
    if (curEnd < 0 || a > curEnd) { if (curEnd >= 0) total += curEnd - curStart; curStart = a; curEnd = b; }
    else curEnd = Math.max(curEnd, b);
  }
  if (curEnd >= 0) total += curEnd - curStart;
  return total;
}

/** Porcentaje (0-100, 1 decimal) de ocupación de la flota. periodsByVehicle: uno por vehículo activo. */
export function fleetOccupancyPercent(periodsByVehicle: Period[][], rangeStart: Date, rangeEnd: Date): number {
  const capacity = periodsByVehicle.length * (rangeEnd.getTime() - rangeStart.getTime());
  if (capacity <= 0) return 0;
  const used = periodsByVehicle.reduce((s, p) => s + occupiedMs(p, rangeStart, rangeEnd), 0);
  return Math.round((used / capacity) * 1000) / 10;
}

export type MoneyMap = Record<string, number>;
export function addMoney(m: MoneyMap, currency: string, cents: number) { m[currency] = (m[currency] ?? 0) + cents; }
