import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBusinessLocal, toBusinessLocalInput, businessYmd, businessDayStart, businessMonth } from "./dates.ts";
import { isVehicleFree, periodsOverlap } from "./availability.ts";
import { daysOfMonth, shiftMonth, itemsForDay, type CalItem } from "./calendar.ts";
import { canTransition, allowedNext, permissionForTransition } from "./reservation-rules.ts";

const D = (s: string) => new Date(s);

test("hora local de Santo Domingo -> UTC (+4h)", () => {
  assert.equal(parseBusinessLocal("2026-12-01T10:00").toISOString(), "2026-12-01T14:00:00.000Z");
});
test("ida y vuelta a hora local", () => {
  assert.equal(toBusinessLocalInput(D("2026-12-01T14:00:00Z")), "2026-12-01T10:00");
  assert.equal(toBusinessLocalInput(D("2026-12-01T02:00:00Z")), "2026-11-30T22:00");
});
test("día de negocio cerca de medianoche", () => {
  assert.equal(businessYmd(D("2026-12-01T03:59:00Z")), "2026-11-30");
  assert.equal(businessYmd(D("2026-12-01T04:00:00Z")), "2026-12-01");
  assert.equal(businessMonth(D("2026-12-01T03:00:00Z")), "2026-11");
  assert.equal(businessDayStart("2026-12-01").toISOString(), "2026-12-01T04:00:00.000Z");
});
test("formato inválido lanza error", () => {
  assert.throws(() => parseBusinessLocal("01/12/2026"));
  assert.throws(() => parseBusinessLocal("2026-13-45T10:00"));
});

const busy = [{ start: D("2026-12-01T14:00Z"), end: D("2026-12-04T14:00Z") }];
test("solape dentro del período ocupado", () => assert.equal(isVehicleFree(D("2026-12-03T14:00Z"), D("2026-12-05T14:00Z"), 0, busy), false));
test("recogida exactamente a la hora de devolución = libre", () => assert.equal(isVehicleFree(D("2026-12-04T14:00Z"), D("2026-12-06T14:00Z"), 0, busy), true));
test("devolución exactamente a la recogida de otra = libre", () => assert.equal(isVehicleFree(D("2026-11-29T14:00Z"), D("2026-12-01T14:00Z"), 0, busy), true));
test("margen de limpieza hace chocar alquileres pegados", () => assert.equal(isVehicleFree(D("2026-11-29T14:00Z"), D("2026-12-01T14:00Z"), 120, busy), false));
test("margen propio de la reserva ocupada se respeta (busy ya lo trae)", () => {
  const b = [{ start: D("2026-12-01T14:00Z"), end: new Date(D("2026-12-04T14:00Z").getTime() + 120 * 60000) }];
  assert.equal(isVehicleFree(D("2026-12-04T14:00Z"), D("2026-12-05T14:00Z"), 0, b), false);
  assert.equal(isVehicleFree(D("2026-12-04T16:00Z"), D("2026-12-05T14:00Z"), 0, b), true);
});
test("rango inválido lanza error", () => assert.throws(() => isVehicleFree(D("2026-12-02T00:00Z"), D("2026-12-01T00:00Z"), 0, [])));
test("periodsOverlap es semiabierto", () => assert.equal(periodsOverlap(D("2026-01-01T00:00Z"), D("2026-01-02T00:00Z"), D("2026-01-02T00:00Z"), D("2026-01-03T00:00Z")), false));

test("días del mes (feb bisiesto y normal, dic)", () => {
  assert.equal(daysOfMonth("2028-02").length, 29);
  assert.equal(daysOfMonth("2026-02").length, 28);
  assert.equal(daysOfMonth("2026-12").length, 31);
  assert.equal(daysOfMonth("2026-12")[0], "2026-12-01");
  assert.throws(() => daysOfMonth("2026-13"));
});
test("cambio de mes cruza años", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
test("calendario: elementos por día y prioridad", () => {
  const items: CalItem[] = [
    { vehicle_id: "v1", kind: "pending", start: D("2026-12-02T14:00Z"), end: D("2026-12-03T14:00Z"), label: "p" },
    { vehicle_id: "v1", kind: "confirmed", start: D("2026-12-02T14:00Z"), end: D("2026-12-04T14:00Z"), label: "c" },
    { vehicle_id: "v2", kind: "confirmed", start: D("2026-12-02T14:00Z"), end: D("2026-12-04T14:00Z"), label: "otro" },
  ];
  const day2 = itemsForDay(items, "v1", businessDayStart("2026-12-02"));
  assert.deepEqual(day2.map((i) => i.kind), ["confirmed", "pending"]);
  assert.equal(itemsForDay(items, "v1", businessDayStart("2026-12-05")).length, 0);
  assert.equal(itemsForDay(items, "v1", businessDayStart("2026-12-01")).length, 0);
});

test("transiciones válidas e inválidas", () => {
  assert.equal(canTransition("pending", "confirmed"), true);
  assert.equal(canTransition("pending", "in_progress"), false);
  assert.equal(canTransition("confirmed", "in_progress"), true);
  assert.equal(canTransition("completed", "cancelled"), false);
  assert.deepEqual(allowedNext("in_progress"), ["completed"]);
});
test("permisos por transición", () => {
  assert.equal(permissionForTransition("confirmed"), "reservations:confirm");
  assert.equal(permissionForTransition("rejected"), "reservations:confirm");
  assert.equal(permissionForTransition("in_progress"), "reservations:write");
  assert.equal(permissionForTransition("cancelled"), "reservations:write");
});

import { resolveRange } from "./ranges.ts";
test("rango por defecto: mes actual hasta hoy (hora local)", () => {
  assert.deepEqual(resolveRange(undefined, undefined, D("2026-12-15T16:00:00Z")), { from: "2026-12-01", to: "2026-12-15" });
});
test("rango: valores inválidos vuelven al defecto y fechas invertidas se ordenan", () => {
  assert.deepEqual(resolveRange("abc", "2026-12-10", D("2026-12-15T16:00:00Z")), { from: "2026-12-01", to: "2026-12-10" });
  assert.deepEqual(resolveRange("2026-12-20", "2026-12-05"), { from: "2026-12-05", to: "2026-12-20" });
});
