import { test } from "node:test";
import assert from "node:assert/strict";
import { whatsappLink } from "./whatsapp.ts";
import { daysUntil, licenseProblem } from "./alerts.ts";

test("WhatsApp: número dominicano de 10 dígitos recibe prefijo 1", () => {
  assert.equal(whatsappLink("(809) 555-1234"), "https://wa.me/18095551234");
});
test("WhatsApp: número con código de país se respeta y el texto se codifica", () => {
  assert.equal(whatsappLink("+1 829 555 9999", "Hola, ¿hay disponibilidad?"), "https://wa.me/18295559999?text=Hola%2C%20%C2%BFhay%20disponibilidad%3F");
});
test("WhatsApp: sin número no hay enlace", () => { assert.equal(whatsappLink(""), null); assert.equal(whatsappLink(null), null); assert.equal(whatsappLink("abc"), null); });

test("daysUntil", () => {
  assert.equal(daysUntil("2026-12-31", "2026-12-01"), 30);
  assert.equal(daysUntil("2026-12-01", "2026-12-01"), 0);
  assert.equal(daysUntil("2026-11-30", "2026-12-01"), -1);
  assert.equal(daysUntil("2027-01-01", "2026-12-31"), 1);
});
test("licencia vencida antes de devolver", () => {
  assert.equal(licenseProblem("2026-12-01", "2026-12-10"), "expired");
  assert.equal(licenseProblem("2026-12-10", "2026-12-10"), "expires_during");
  assert.equal(licenseProblem("2027-01-01", "2026-12-10"), null);
  assert.equal(licenseProblem(null, "2026-12-10"), null);
});
