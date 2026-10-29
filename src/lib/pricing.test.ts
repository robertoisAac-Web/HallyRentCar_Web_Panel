import { test } from "node:test";
import assert from "node:assert/strict";
import { billableDays, percentOfCents, quoteTotalCents } from "./pricing.ts";
import { toCents, fromCents, formatMoney } from "./money.ts";

const d = (s: string) => new Date(s);

test("exactamente 24h = 1 día", () => assert.equal(billableDays(d("2026-12-01T14:00Z"), d("2026-12-02T14:00Z")), 1));
test("24h + 59 min (gracia) = 1 día", () => assert.equal(billableDays(d("2026-12-01T14:00Z"), d("2026-12-02T14:59Z")), 1));
test("24h + 60 min = 2 días", () => assert.equal(billableDays(d("2026-12-01T14:00Z"), d("2026-12-02T15:00Z")), 2));
test("menos de 24h = mínimo 1 día", () => assert.equal(billableDays(d("2026-12-01T14:00Z"), d("2026-12-01T18:00Z")), 1));
test("3 días exactos", () => assert.equal(billableDays(d("2026-12-01T14:00Z"), d("2026-12-04T14:00Z")), 3));
test("gracia 0: 24h+1min = 2 días", () => assert.equal(billableDays(d("2026-12-01T14:00Z"), d("2026-12-02T14:01Z"), 0), 2));
test("devolución anterior a recogida lanza error", () =>
  assert.throws(() => billableDays(d("2026-12-02T14:00Z"), d("2026-12-01T14:00Z"))));

test("total = tarifa*días - descuento + extras", () =>
  assert.equal(quoteTotalCents({ dailyRateCents: 350000, days: 3, discountCents: 50000, extrasCents: 20000 }), 1020000));
test("descuento mayor al subtotal lanza error", () =>
  assert.throws(() => quoteTotalCents({ dailyRateCents: 100, days: 1, discountCents: 200 })));
test("porcentaje half-up: 10% de 3333 centavos = 333", () => assert.equal(percentOfCents(3333, 1000), 333));
test("porcentaje half-up: 10% de 3335 centavos = 334 (333.5 sube)", () => assert.equal(percentOfCents(3335, 1000), 334));

test("toCents/fromCents sin float", () => {
  assert.equal(toCents("3500.00"), 350000);
  assert.equal(toCents("0.1"), 10);
  assert.equal(toCents("19.99"), 1999);
  assert.equal(fromCents(1999), "19.99");
  assert.equal(fromCents(5), "0.05");
  assert.throws(() => toCents("abc"));
});
test("formato RD$", () => {
  assert.equal(formatMoney(500000), "RD$ 5,000.00");
  assert.equal(formatMoney(123456789, "USD"), "US$ 1,234,567.89");
});
