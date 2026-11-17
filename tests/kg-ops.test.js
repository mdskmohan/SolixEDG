import { test } from "node:test";
import assert from "node:assert/strict";
import * as OPS from "../src/kg/ops.js";

const SCHEMA = { users: [{ name: "user_id", pk: true }, { name: "email" }], orders: [{ name: "order_id", pk: true }, { name: "customer_id" }] };
const PROF = { "users.email": { nullPct: 2.3, nullCount: "71,397", distinctPct: 95.1 }, "orders.customer_id": { nullPct: 0.4, nullCount: "190K" } };
const ctx = { schemaOf: (t) => SCHEMA[t] || [], profileOf: (t, c) => PROF[`${t}.${c}`] || {},
  entities: [{ id: "eO", table: "orders" }, { id: "eU", table: "users" }], joins: [{ id: "j1", from: "eO", to: "eU", fromKey: "customer_id", toKey: "user_id" }] };
const ont = {
  classes: [{ id: "cC", name: "Customer", props: [{ id: "pE", name: "Email" }, { id: "pL", name: "Last login" }] }, { id: "cO", name: "Order" }, { id: "cS", name: "Shipment" }],
  rels: [{ id: "r1", from: "cO", to: "cC", name: "placed by" }, { id: "r2", from: "cS", to: "cO", name: "ships" }],
  constraints: [{ id: "k1", classId: "cC", prop: "Email", kind: "required", severity: "violation" }, { id: "k2", classId: "cC", prop: "Email", kind: "unique", severity: "warning" }],
  mappings: [
    { id: "f1", kind: "field", classId: "cC", propId: "pE", target: { table: "users", column: "email" } },
    { id: "f2", kind: "field", classId: "cC", propId: "pL", target: { table: "users", column: "last_login_at" } },
    { id: "j", kind: "join", classId: "cO", relId: "r1", target: { joinId: "j1" } }],
};
const eg = { classes: [{ classId: "cC", sources: [{ table: "users" }], total: 100 }, { classId: "cO", sources: [{ table: "orders" }], total: 400 }, { classId: "cS", sources: [], total: null }],
  stats: { classes: 3, withData: 2, entities: 500, relationships: 2, linked: 1 } };

test("quality checks find missing columns, unlinked relationships, orphans and constraint breaks", () => {
  const c = OPS.qualityChecks(ont, eg, ctx);
  const kinds = c.map((x) => x.kind);
  assert.equal(c[0].severity, "error");
  assert.ok(c.some((x) => x.kind === "column" && x.title.includes("last_login_at")));
  assert.ok(c.some((x) => x.kind === "source" && x.classId === "cS"));
  assert.ok(c.some((x) => x.kind === "link" && x.title.includes("Shipment")));
  assert.ok(c.some((x) => x.kind === "orphan" && x.title.startsWith("0.4%")));
  assert.ok(kinds.includes("required") && kinds.includes("unique"));
  assert.equal(c.find((x) => x.kind === "unique").severity, "warning");
});

test("a build with broken parts succeeds with warnings; one without data fails", () => {
  const c = OPS.qualityChecks(ont, eg, ctx);
  const b = OPS.runBuild(eg, c, { n: 3, at: "2026-11-17T10:00:00Z", trigger: "Manual" });
  assert.equal(b.status, "Warnings");
  assert.equal(b.steps.find((s) => s.k === "read").status, "warning");
  assert.equal(b.steps.find((s) => s.k === "links").status, "warning");
  assert.equal(b.entities, 500);
  const none = OPS.runBuild({ classes: [], stats: { withData: 0 } }, [], { n: 1 });
  assert.equal(none.status, "Failed");
  assert.ok(none.steps.slice(1).every((s) => s.status === "skipped"));
});

test("status follows the latest build, pause and missing data", () => {
  assert.equal(OPS.statusOf({ builds: [] }, eg), "Not built");
  assert.equal(OPS.statusOf({ builds: [{ status: "Succeeded" }] }, eg), "Active");
  assert.equal(OPS.statusOf({ builds: [{ status: "Failed" }, { status: "Succeeded" }] }, eg), "Failed");
  assert.equal(OPS.statusOf({ paused: true, builds: [{ status: "Succeeded" }] }, eg), "Paused");
  assert.equal(OPS.statusOf({ builds: [] }, { stats: { withData: 0 } }), "Needs data");
});
