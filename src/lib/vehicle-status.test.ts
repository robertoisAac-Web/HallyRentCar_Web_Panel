import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveVehicleStatus } from "./vehicle-status.ts";

const v = { id: "v1", is_active: true };
const now = new Date("2026-12-10T12:00:00Z");
const res = (status: string, a: string, b: string, vehicle_id = "v1") => ({ vehicle_id, status, pickup_at: a, return_at: b });
const blk = (kind: "maintenance" | "manual", a: string, b: string, vehicle_id = "v1") => ({ vehicle_id, kind, starts_at: a, ends_at: b });

test("sin nada = disponible", () => assert.equal(deriveVehicleStatus(v, [], [], now), "available"));
test("inactivo gana sobre todo", () =>
  assert.equal(deriveVehicleStatus({ ...v, is_active: false }, [res("in_progress", "2026-12-09T00:00:00Z", "2026-12-11T00:00:00Z")], [], now), "inactive"));
test("reserva en curso = alquilado", () =>
  assert.equal(deriveVehicleStatus(v, [res("in_progress", "2026-12-09T00:00:00Z", "2026-12-11T00:00:00Z")], [], now), "rented"));
test("reserva confirmada futura = reservado", () =>
  assert.equal(deriveVehicleStatus(v, [res("confirmed", "2026-12-20T00:00:00Z", "2026-12-22T00:00:00Z")], [], now), "reserved"));
test("reserva confirmada ya vencida = disponible", () =>
  assert.equal(deriveVehicleStatus(v, [res("confirmed", "2026-12-01T00:00:00Z", "2026-12-03T00:00:00Z")], [], now), "available"));
test("solicitud pendiente NO cambia el estado", () =>
  assert.equal(deriveVehicleStatus(v, [res("pending", "2026-12-09T00:00:00Z", "2026-12-11T00:00:00Z")], [], now), "available"));
test("mantenimiento vigente = en mantenimiento", () =>
  assert.equal(deriveVehicleStatus(v, [], [blk("maintenance", "2026-12-10T00:00:00Z", "2026-12-12T00:00:00Z")], now), "maintenance"));
test("mantenimiento futuro no afecta hoy", () =>
  assert.equal(deriveVehicleStatus(v, [], [blk("maintenance", "2026-12-15T00:00:00Z", "2026-12-16T00:00:00Z")], now), "available"));
test("bloqueo manual vigente = bloqueado", () =>
  assert.equal(deriveVehicleStatus(v, [], [blk("manual", "2026-12-10T00:00:00Z", "2026-12-12T00:00:00Z")], now), "blocked"));
test("fin del bloqueo es exclusivo", () =>
  assert.equal(deriveVehicleStatus(v, [], [blk("maintenance", "2026-12-09T00:00:00Z", "2026-12-10T12:00:00Z")], now), "available"));
test("datos de otro vehículo se ignoran", () =>
  assert.equal(deriveVehicleStatus(v, [res("in_progress", "2026-12-09T00:00:00Z", "2026-12-11T00:00:00Z", "v2")], [], now), "available"));
