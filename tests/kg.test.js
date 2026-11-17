import { test } from "node:test";
import assert from "node:assert/strict";
import * as KG from "../src/kg/engine.js";

const SCHEMA = {
  users: [{ name: "user_id", type: "BIGINT", pk: true }, { name: "email", type: "VARCHAR", pii: true }, { name: "is_active", type: "BOOLEAN" }],
  stg_users: [{ name: "user_id", type: "BIGINT" }, { name: "email", type: "VARCHAR" }],
  dash: [{ name: "email", type: "VARCHAR" }],
  orders: [{ name: "order_id", type: "BIGINT", pk: true }, { name: "customer_id", type: "BIGINT" }, { name: "amount", type: "DECIMAL(12,2)" }],
};
const PROF = { user_id: { distinctCount: "12.7M" }, order_id: { distinctCount: "48.2M" }, amount: { avg: "$127.43" }, is_active: { topValues: ["true (80%)", "false (20%)"] } };
const input = () => ({
  assets: [
    { id: 1, name: "users", type: "Table", domain: "Commerce", owner: "maya.chen", tags: ["Customer Data"], rows: "12.7M" },
    { id: 2, name: "stg_users", type: "Table", domain: "Commerce", owner: "dev.patel" },
    { id: 3, name: "dash", type: "Dashboard", domain: "Marketing" },
    { id: 4, name: "orders", type: "Table", domain: "Commerce", rows: "48.2M" },
  ],
  schemaOf: (t) => SCHEMA[t] || [],
  lineage: [{ from: "users", to: "stg_users" }, { from: "stg_users", to: "dash" }],
  terms: [{ id: "t1", name: "Customer", termType: "Concept", linkedAssets: [{ name: "users" }] }],
  semantic: {
    models: [{ id: "m1", name: "Commerce Revenue", entityIds: ["eO", "eU"] }],
    entities: [{ id: "eO", table: "orders" }, { id: "eU", table: "users" }],
    rels: [{ id: "j1", from: "eO", to: "eU", fromKey: "customer_id", toKey: "user_id" }],
    metrics: [{ id: "mt1", model: "m1", name: "Revenue", entity: "eO", agg: "sum", col: "amount", termId: "t1" }],
  },
  ontologies: [{ id: "o1", name: "Commerce", classes: [
      { id: "cP", name: "Party" }, { id: "cC", name: "Customer", parent: "cP", termId: "t1", props: [{ id: "pE", name: "Email" }, { id: "pA", name: "Active" }] },
      { id: "cO", name: "Order", props: [{ id: "pAm", name: "Amount" }] }],
    rels: [{ id: "r1", from: "cO", to: "cC", name: "placed by" }],
    mappings: [
      { id: "s1", kind: "dataset", classId: "cC", target: { entityId: "eU", keys: ["user_id"] } },
      { id: "s2", kind: "dataset", classId: "cO", target: { entityId: "eO", keys: ["order_id"] } },
      { id: "f1", kind: "field", classId: "cC", propId: "pE", target: { table: "users", column: "email" } },
      { id: "f2", kind: "field", classId: "cC", propId: "pA", target: { table: "users", column: "is_active" } },
      { id: "f3", kind: "field", classId: "cO", propId: "pAm", target: { table: "orders", column: "amount" } },
      { id: "j", kind: "join", classId: "cO", relId: "r1", target: { joinId: "j1" } }] }],
});

test("metadata graph: catalog, lineage, glossary, semantic model and ontology all become nodes and edges", () => {
  const g = KG.buildMetadataGraph(input(), { rules: { domain_columns: false, pii_downstream: false, lineage_closure: false, class_pii: false } });
  const has = (from, type, to) => g.edges.some((e) => e.from === from && e.type === type && e.to === to);
  assert.ok(has("asset:users", "contains", "column:users.email"));
  assert.ok(has("column:users.email", "tagged", "tag:PII"));
  assert.ok(has("asset:users", "feeds", "asset:stg_users"));
  assert.ok(has("asset:users", "described_by", "term:t1"));
  assert.ok(has("asset:users", "in_domain", "domain:Commerce"));
  assert.ok(has("model:m1", "uses", "asset:orders"));
  assert.ok(has("asset:orders", "joins", "asset:users"));
  assert.ok(has("metric:mt1", "computed_from", "column:orders.amount"));
  assert.ok(has("class:o1:cC", "is_a", "class:o1:cP"));
  assert.ok(has("class:o1:cO", "relates", "class:o1:cC"));
  assert.ok(has("class:o1:cC", "realised_by", "asset:users"));
  assert.ok(has("class:o1:cC", "stored_in", "column:users.email"));
  assert.equal(g.stats.derived, 0);
});

test("inference: PII downstream, domain on columns, indirect dependencies, class PII — all marked derived with reasons", () => {
  const g = KG.buildMetadataGraph(input());
  const d = (from, type, to) => g.edges.find((e) => e.from === from && e.type === type && e.to === to && e.derived);
  const pii = d("column:stg_users.email", "tagged", "tag:PII");
  assert.equal(pii.rule, "pii_downstream"); assert.ok(pii.because.length);
  assert.ok(d("column:dash.email", "tagged", "tag:PII"), "PII keeps flowing to the dashboard");
  assert.equal(d("column:users.email", "in_domain", "domain:Commerce").rule, "domain_columns");
  assert.equal(d("asset:dash", "depends_on", "asset:users").because.length, 2);
  assert.equal(d("class:o1:cC", "tagged", "tag:PII").rule, "class_pii");
  assert.ok(g.stats.byRule.lineage_closure >= 1);
});

test("neighbourhood and search", () => {
  const g = KG.buildMetadataGraph(input());
  const n = KG.neighbourhood(g, "class:o1:cC", { depth: 1 });
  assert.ok(n.nodes.some((x) => x.id === "asset:users"));
  assert.ok(!n.nodes.some((x) => x.id === "asset:dash"));
  assert.ok(KG.neighbourhood(g, "class:o1:cC", { depth: 1, derived: false }).edges.every((e) => !e.derived));
  assert.equal(KG.search(g, "users")[0].label, "users");
});

test("entity graph: counts from keys, samples with mapped properties (PII masked), links along mapped joins", () => {
  const o = input().ontologies[0];
  const eg = KG.buildEntityGraph(o, { entities: input().semantic.entities, joins: input().semantic.rels, assets: input().assets, schemaOf: (t) => SCHEMA[t] || [], profileOf: (t, c) => PROF[c] || {} });
  const cust = eg.classes.find((c) => c.name === "Customer");
  assert.equal(cust.sources[0].rows, 12700000);
  assert.equal(eg.classes.find((c) => c.name === "Party").sources.length, 0);
  const s = eg.samples.cC[0];
  assert.equal(s.props.Email, "••••••");
  assert.equal(s.props.Active, "true");
  assert.ok(eg.links.length === 3 && eg.links.every((l) => l.name === "placed by" && l.from.startsWith("orders:") && l.to.startsWith("users:")));
  assert.equal(eg.stats.linked, 1);
});

test("export: Turtle and JSON-LD carry nodes, edges and the derived marker", () => {
  const g = KG.buildMetadataGraph(input());
  const ttl = KG.toTurtle(g);
  assert.match(ttl, /edg:Asset/); assert.match(ttl, /# derived · pii_downstream/);
  assert.ok(!/derived/.test(KG.toTurtle(g, { derived: false }).split("\n").slice(4).join("\n")));
  const j = JSON.parse(KG.toJsonLd(g)); assert.ok(j["@graph"].length === g.nodes.length + g.edges.length);
});
