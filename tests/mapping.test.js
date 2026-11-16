import { test } from "node:test";
import assert from "node:assert/strict";
import * as MAP from "../src/ontology/mapping.js";
import * as ONT from "../src/ontology/engine.js";

const SCHEMA = {
  orders: [{ name: "order_id", type: "BIGINT", pk: true }, { name: "customer_id", type: "BIGINT" }, { name: "status", type: "ENUM" }, { name: "amount", type: "DECIMAL(12,2)" }, { name: "created_at", type: "TIMESTAMP" }],
  users: [{ name: "user_id", type: "BIGINT", pk: true }, { name: "email", type: "VARCHAR" }, { name: "last_login", type: "TIMESTAMPTZ" }],
  stores: [{ name: "store_id", type: "BIGINT", pk: true }, { name: "store_name", type: "VARCHAR" }],
};
const ctx = (over = {}) => ({
  entities: [{ id: "eO", name: "Order", table: "orders", key: "order_id", concept: "tO" }, { id: "eC", name: "Customer", table: "users", key: "user_id" }],
  joins: [{ id: "j1", from: "eO", to: "eC", fromKey: "customer_id", toKey: "user_id", cardinality: "many_to_one" }],
  dims: [{ id: "d1", entity: "eO", name: "Order Status", column: "status" }], facts: [{ id: "f1", entity: "eO", name: "Order Amount", column: "amount" }],
  metrics: [{ id: "m1", name: "Revenue", model: "mdl", entity: "eO", agg: "sum", col: "amount", status: "Approved" }],
  models: [{ id: "mdl", name: "Commerce", entityIds: ["eO", "eC"] }],
  assets: [{ id: 9, name: "stores", db: "x / stores" }],
  schemaOf: (t) => SCHEMA[t] || [], profileOf: () => ({ nullPct: 0 }), ...over,
});
const ont = () => ({ id: "o", name: "Commerce", classes: [
  { id: "cO", name: "Order", termId: "tO", props: [{ id: "pS", name: "Order Status", datatype: "string" }, { id: "pA", name: "Amount", datatype: "decimal" }] },
  { id: "cC", name: "Customer", synonyms: ["Client"], props: [{ id: "pE", name: "Email", datatype: "string" }, { id: "pL", name: "Last Login", datatype: "dateTime" }] },
  { id: "cS", name: "Store", props: [] }, { id: "cX", name: "Warehouse", props: [] }],
  rels: [{ id: "r1", from: "cO", to: "cC", name: "placed by", cardinality: "many_to_one" }], constraints: [], mappings: [] });

const accept = (o, sugs, kinds) => ({ ...o, mappings: [...o.mappings, ...sugs.filter((s) => kinds.includes(s.kind)).map((s) => MAP.toMapping(s, "me"))] });

test("datasets first: concept link beats name; catalog table for a gap; nothing for the rest", () => {
  const s = MAP.suggestMappings(ont(), ctx());
  const o = s.find((x) => x.kind === "dataset" && x.classId === "cO");
  assert.equal(o.target.entityId, "eO"); assert.ok(o.conf >= 0.95); assert.deepEqual(o.target.keys, ["order_id"]);
  assert.equal(s.find((x) => x.kind === "dataset" && x.classId === "cC").target.entityId, "eC");
  assert.equal(s.find((x) => x.classId === "cS").kind, "table");
  assert.equal(s.find((x) => x.classId === "cX").kind, "gap");
  assert.ok(!s.some((x) => x.kind === "field"), "fields wait for an accepted dataset");
});

test("after datasets: fields by name with type check, join for the relationship, metric measures class", () => {
  let o = ont(); o = accept(o, MAP.suggestMappings(o, ctx()), ["dataset"]);
  const s = MAP.suggestMappings(o, ctx());
  assert.equal(s.find((x) => x.kind === "field" && x.propId === "pS").target.fieldId, "d1");
  assert.equal(s.find((x) => x.kind === "field" && x.propId === "pA").target.column, "amount");
  assert.equal(s.find((x) => x.kind === "field" && x.propId === "pE").target.column, "email");
  assert.equal(s.find((x) => x.kind === "join").target.joinId, "j1");
  assert.equal(s.find((x) => x.kind === "metric").classId, "cO");
});

test("coverage counts what is mapped", () => {
  let o = ont(); o = accept(o, MAP.suggestMappings(o, ctx()), ["dataset", "table"]);
  o = accept(o, MAP.suggestMappings(o, ctx()), ["field", "join", "metric"]);
  const c = MAP.coverage(o, ctx());
  assert.deepEqual([c.classes.mapped, c.classes.total], [3, 4]);
  assert.equal(c.rels.pct, 100); assert.equal(c.metrics.pct, 100);
  assert.ok(c.props.mapped >= 3);
});

test("drift: renamed column re-pointed, removed join and dataset flagged, fixes apply", () => {
  let o = ont(); o = accept(o, MAP.suggestMappings(o, ctx()), ["dataset"]);
  o = accept(o, MAP.suggestMappings(o, ctx()), ["field", "join"]);
  // A column mapped under its old name.
  o = { ...o, mappings: o.mappings.map((m) => m.propId === "pL" ? { ...m, target: { ...m.target, column: "last_login_at" } } : m) };
  const d = MAP.drift(o, ctx({ joins: [] }));
  const col = d.find((x) => /last_login_at/.test(x.title));
  assert.equal(col.fix.patch.column, "last_login");
  assert.ok(d.some((x) => /join behind/.test(x.title)));
  const fixed = MAP.applyFix(o, col.fix);
  assert.ok(!MAP.drift(fixed, ctx()).some((x) => /last_login_at/.test(x.title)));
  const gone = MAP.drift(o, ctx({ entities: [ctx().entities[0]] }));
  assert.ok(gone.some((x) => /Customer's dataset was removed/.test(x.title)));
});

test("mappings are versioned with the ontology", () => {
  let o = { ...ont(), versions: [] };
  const v1 = ONT.publish(o, "me").ontology;
  const next = accept(v1, MAP.suggestMappings(v1, ctx()), ["dataset"]);
  assert.equal(ONT.isDirty(next), true);
  assert.ok(ONT.diff(v1.versions[0].snapshot, ONT.snapshot(next)).some((l) => /Added mapping dataset for Order/.test(l.text)));
});
