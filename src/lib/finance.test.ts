import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBalance, depositSummary } from "./finance.ts";
import { toCsv } from "./csv.ts";
import { occupiedMs, fleetOccupancyPercent, addMoney } from "./reports.ts";

const P = (kind: "advance" | "payment" | "refund", amountCents: number, voided = false) => ({ kind, amountCents, voided });

test("saldo: total - anticipo", () => {
  const b = computeBalance(1050000, [], [P("advance", 300000)]);
  assert.equal(b.balance, 750000); assert.equal(b.netReceived, 300000);
});
test("saldo: cargos adicionales suben lo adeudado", () => {
  const b = computeBalance(1000000, [{ amountCents: 50000, voided: false }], [P("payment", 1000000)]);
  assert.equal(b.due, 1050000); assert.equal(b.balance, 50000);
});
test("saldo: pagos y cargos anulados no cuentan", () => {
  const b = computeBalance(1000000, [{ amountCents: 50000, voided: true }], [P("payment", 1000000, true), P("advance", 200000)]);
  assert.equal(b.due, 1000000); assert.equal(b.balance, 800000);
});
test("saldo: reembolso reduce lo recibido neto", () => {
  const b = computeBalance(1000000, [], [P("payment", 1000000), P("refund", 400000)]);
  assert.equal(b.netReceived, 600000); assert.equal(b.balance, 400000);
});
test("saldo negativo = pagó de más", () => assert.equal(computeBalance(100000, [], [P("payment", 150000)]).balance, -50000));

const M = (kind: "received" | "returned" | "applied", amountCents: number, voided = false) => ({ kind, amountCents, voided });
test("depósito: sin depósito requerido ni recibido", () => assert.equal(depositSummary(0, []).status, "none"));
test("depósito: requerido pero no recibido = pendiente", () => assert.equal(depositSummary(500000, []).status, "pending"));
test("depósito: recibido = retenido", () => {
  const d = depositSummary(500000, [M("received", 500000)]);
  assert.equal(d.status, "held"); assert.equal(d.held, 500000);
});
test("depósito: devolución parcial", () => {
  const d = depositSummary(500000, [M("received", 500000), M("returned", 200000)]);
  assert.equal(d.status, "partially_returned"); assert.equal(d.held, 300000);
});
test("depósito: devuelto por completo", () => assert.equal(depositSummary(500000, [M("received", 500000), M("returned", 500000)]).status, "returned"));
test("depósito: aplicado y devuelto el resto = devuelto", () => {
  const d = depositSummary(500000, [M("received", 500000), M("applied", 100000), M("returned", 400000)]);
  assert.equal(d.status, "returned"); assert.equal(d.held, 0);
});
test("depósito: todo aplicado a cargos", () => assert.equal(depositSummary(500000, [M("received", 500000), M("applied", 500000)]).status, "applied"));
test("depósito: movimientos anulados no cuentan", () => assert.equal(depositSummary(500000, [M("received", 500000, true)]).status, "pending"));

test("CSV: comas, comillas y saltos de línea", () => {
  assert.equal(toCsv(["a", "b"], [["x,y", 'di "hola"'], ["l1\nl2", 5]]), 'a,b\r\n"x,y","di ""hola"""\r\n"l1\nl2",5');
});
test("CSV: neutraliza fórmulas pero respeta números", () => {
  assert.equal(toCsv(["v"], [["=1+1"], ["@x"], [-5]]), "v\r\n'=1+1\r\n'@x\r\n-5");
});
test("CSV: nulos vacíos", () => assert.equal(toCsv(["a"], [[null], [undefined]]), "a\r\n\r\n"));

const D = (s: string) => new Date(s);
test("ocupación: une solapes y recorta", () => {
  const ms = occupiedMs([{ start: D("2026-12-01T00:00Z"), end: D("2026-12-03T00:00Z") }, { start: D("2026-12-02T00:00Z"), end: D("2026-12-05T00:00Z") }],
    D("2026-12-01T00:00Z"), D("2026-12-04T00:00Z"));
  assert.equal(ms, 3 * 24 * 3600_000);
});
test("ocupación de flota: 1 de 2 vehículos todo el rango = 50%", () =>
  assert.equal(fleetOccupancyPercent([[{ start: D("2026-12-01T00:00Z"), end: D("2026-12-11T00:00Z") }], []], D("2026-12-01T00:00Z"), D("2026-12-11T00:00Z")), 50));
test("ocupación: sin vehículos = 0", () => assert.equal(fleetOccupancyPercent([], D("2026-12-01T00:00Z"), D("2026-12-02T00:00Z")), 0));
test("addMoney agrupa por moneda", () => { const m = {}; addMoney(m, "DOP", 100); addMoney(m, "USD", 5); addMoney(m, "DOP", 50); assert.deepEqual(m, { DOP: 150, USD: 5 }); });
