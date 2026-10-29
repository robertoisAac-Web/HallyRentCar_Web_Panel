import { test } from "node:test";
import assert from "node:assert/strict";
import { DICT, t, fmt, resolveLang, labelsFor } from "./i18n.ts";

test("español e inglés tienen exactamente las mismas claves", () => {
  assert.deepEqual(Object.keys(DICT.es).sort(), Object.keys(DICT.en).sort());
});
test("ninguna traducción está vacía", () => {
  for (const lang of ["es", "en"] as const) for (const [k, v] of Object.entries(DICT[lang])) assert.ok(v.trim().length > 0, `${lang}:${k}`);
});
test("las variables {x} coinciden entre idiomas", () => {
  const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
  for (const k of Object.keys(DICT.es) as (keyof typeof DICT.es)[]) assert.equal(vars(DICT.es[k]), vars(DICT.en[k]), k);
});
test("resolveLang: solo 'en' cambia; todo lo demás es español", () => {
  assert.equal(resolveLang("en"), "en"); assert.equal(resolveLang("es"), "es");
  assert.equal(resolveLang("fr"), "es"); assert.equal(resolveLang(undefined), "es"); assert.equal(resolveLang(null), "es");
});
test("fmt reemplaza variables y deja las no provistas", () => {
  assert.equal(fmt("{n} días", { n: 3 }), "3 días");
  assert.equal(fmt("hola {x}", {}), "hola {x}");
  assert.equal(t("en", "veh.seats", { n: 5 }), "5 seats");
});
test("labelsFor filtra por prefijo", () => {
  const l = labelsFor("en", "cat.");
  assert.ok(Object.keys(l).length > 5 && Object.keys(l).every((k) => k.startsWith("cat.")));
});
