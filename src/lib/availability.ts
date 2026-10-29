// Períodos semiabiertos [inicio, fin): una devolución a las 10:00 y una recogida a las 10:00 NO chocan.
export interface Busy { start: Date; end: Date }

export function periodsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** `busy` ya debe incluir el margen propio de cada reserva (fin + buffer). El margen solicitado se suma al fin pedido. */
export function isVehicleFree(reqStart: Date, reqEnd: Date, bufferMinutes: number, busy: Busy[]): boolean {
  if (!(reqEnd.getTime() > reqStart.getTime())) throw new Error("La devolución debe ser posterior a la recogida");
  const end = new Date(reqEnd.getTime() + bufferMinutes * 60_000);
  return !busy.some((b) => periodsOverlap(reqStart, end, b.start, b.end));
}
