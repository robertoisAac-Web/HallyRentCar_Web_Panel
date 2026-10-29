import { test } from "node:test";
import assert from "node:assert/strict";
import { parseValue, compose, monthGrid, shiftMonthView, to12h, from12h, addDays, compareDay, formatDisplay } from "./datepicker.ts";

test("parseValue acepta fecha y fecha con hora, y rechaza inválidos", () => {
  assert.deepEqual(parseValue("2026-12-01"), { y: 2026, m: 12, d: 1, hh: null, mm: null });
  assert.deepEqual(parseValue("2026-12-01T14:30"), { y: 2026, m: 12, d: 1, hh: 14, mm: 30 });
  for (const bad of ["", "2026-13-01", "2026-02-30", "2026-12-01T25:00", "abc", "2026-12-01T10:75"]) assert.equal(parseValue(bad), null, bad);
  assert.equal(parseValue(undefined), null);
});
test("compose", () => {
  assert.equal(compose("2026-12-01"), "2026-12-01");
  assert.equal(compose("2026-12-01", 9, 5), "2026-12-01T09:05");
  assert.equal(compose("2026-12-01", 9), "2026-12-01T09:00");
});
test("monthGrid: diciembre 2026 empieza en martes (lunes primero)", () => {
  const g = monthGrid(2026, 12);
  assert.deepEqual(g[0], [null, "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"]);
  assert.ok(g.every((w) => w.length === 7));
  assert.equal(g.flat().filter(Boolean).length, 31);
  assert.equal(g.at(-1)!.filter(Boolean).at(-1), "2026-12-31");
});
test("monthGrid: febrero bisiesto y mes que empieza en lunes", () => {
  assert.equal(monthGrid(2028, 2).flat().filter(Boolean).length, 29);
  assert.equal(monthGrid(2026, 6)[0][0], "2026-06-01"); // 1 jun 2026 es lunes
});
test("shiftMonthView cruza años", () => {
  assert.deepEqual(shiftMonthView(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonthView(2026, 1, -1), { year: 2025, month: 12 });
});
test("12 horas <-> 24 horas", () => {
  assert.deepEqual(to12h(0), { h12: 12, pm: false }); assert.deepEqual(to12h(12), { h12: 12, pm: true });
  assert.deepEqual(to12h(13), { h12: 1, pm: true }); assert.deepEqual(to12h(23), { h12: 11, pm: true });
  for (let h = 0; h < 24; h++) { const { h12, pm } = to12h(h); assert.equal(from12h(h12, pm), h); }
});
test("addDays conserva la hora y cruza mes y año", () => {
  assert.equal(addDays("2026-12-30T10:00", 3), "2027-01-02T10:00");
  assert.equal(addDays("2026-02-27", 2), "2026-03-01");
  assert.equal(addDays("2026-12-01T10:30", 7), "2026-12-08T10:30");
});
test("compareDay ignora la hora", () => {
  assert.equal(compareDay("2026-12-01T23:00", "2026-12-01"), 0);
  assert.equal(compareDay("2026-11-30", "2026-12-01T00:00"), -1);
  assert.equal(compareDay("2026-12-02", "2026-12-01T23:59"), 1);
});
test("formatDisplay en español e inglés", () => {
  assert.equal(formatDisplay("2026-12-01T14:30", "es", "datetime"), "mar 1 dic 2026 · 2:30 PM");
  assert.equal(formatDisplay("2026-12-01T00:00", "en", "datetime"), "Tue, Dec 1, 2026 · 12:00 AM");
  assert.equal(formatDisplay("2026-12-01T14:30", "es", "date"), "mar 1 dic 2026");
  assert.equal(formatDisplay("", "es", "date"), "");
});
