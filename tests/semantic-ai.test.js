import { test } from "node:test";
import assert from "node:assert/strict";
import * as AI from "../src/semantic/ai.js";
import { SL_USAGE } from "../src/semantic/usage-seed.js";

const SCHEMA = {
  orders: [
    { name: "order_id", type: "BIGINT", pk: true },
    { name: "customer_id", type: "BIGINT", desc: "Reference to customers.customer_id", pii: true },
    { name: "email", type: "VARCHAR(255)", pii: true },
    { name: "amount", type: "DECIMAL(12,2)" },
    { name: "unit_price", type: "DECIMAL(12,2)" },
    { name: "status", type: "ENUM" },
    { name: "shipping_address", type: "JSONB", pii: true },
    { name: "created_at", type: "TIMESTAMP" },
  ],
  customers: [
    { name: "customer_id", type: "BIGINT", pk: true },
    { name: "first_name", type: "VARCHAR" },
    { name: "country", type: "CHAR(2)" },
    { name: "region", type: "VARCHAR" },
    { name: "city", type: "VARCHAR" },
    { name: "segment", type: "VARCHAR" },
    { name: "lifetime_value", type: "DECIMAL(12,2)" },
    { name: "created_at", type: "TIMESTAMP" },
  ],
  nokey: [{ name: "thing", type: "VARCHAR" }, { name: "nokey_id", type: "BIGINT" }],
};
const PROF = { status: { distinctPct: 0.001, distinctCount: "5", topValues: ["completed (62%)", "pending (18%)"] }, customer_id: { distinctPct: 8.2, nullPct: 0 } };
const ctx = (over = {}) => ({
  schemaOf: (t) => SCHEMA[t] || [], profileOf: (t, c) => PROF[c] || {},
  glossary: [{ id: "t1", name: "Customer Lifetime Value", synonyms: ["CLV", "LTV"] }, { id: "t2", name: "Net Revenue", synonyms: ["revenue"] }],
  metrics: [], entities: [], usage: SL_USAGE, ...over,
});
const E = { orders: { id: "e1", name: "Order", table: "orders", key: "order_id", timeDims: ["created_at"] },
            customers: { id: "e2", name: "Customer", table: "customers", key: "customer_id", timeDims: ["created_at"] } };

test("grain: declared key, then weak name guess", () => {
  assert.deepEqual(AI.suggestGrain("orders", ctx()).keys, ["order_id"]);
  const g = AI.suggestGrain("nokey", ctx());
  assert.deepEqual(g.keys, ["nokey_id"]);
  assert.ok(g.conf < 0.7, "a name-only guess is low confidence");
});

test("joins: FK description + query history give a safe many-to-one with evidence", () => {
  const js = AI.suggestJoins([E.orders, E.customers], ctx());
  const j = js.find((x) => x.from === "e1" && x.to === "e2");
  assert.ok(j);
  assert.equal(j.fromKey, "customer_id"); assert.equal(j.toKey, "customer_id");
  assert.equal(j.cardinality, "many_to_one");
  assert.equal(j.fanOutSafe, true);
  assert.equal(j.by, "ai"); assert.equal(j.state, "suggested");
  assert.ok(j.evidence.some((e) => /queries/.test(e)));
  assert.ok(!js.some((x) => x.from === "e2" && x.to === "e1"), "no reverse join onto the many side");
});

test("joins: turning query history off lowers confidence and drops that evidence", () => {
  const off = AI.suggestJoins([E.orders, E.customers], ctx({ settings: { inputs: { usage: false } } })).find((x) => x.from === "e1");
  const onj = AI.suggestJoins([E.orders, E.customers], ctx()).find((x) => x.from === "e1");
  assert.ok(off.conf < onj.conf);
  assert.ok(!off.evidence.some((e) => /queries/.test(e)));
});

test("fields: key, time, measure (sum vs avg), skip JSON, flag PII", () => {
  const fs = AI.classifyFields(E.orders, ctx());
  const by = Object.fromEntries(fs.map((f) => [f.column, f]));
  assert.equal(by.order_id.role, "key");
  assert.equal(by.created_at.dimType, "time");
  assert.equal(by.amount.role, "measure"); assert.equal(by.amount.defaultAgg, "sum");
  assert.equal(by.unit_price.defaultAgg, "avg"); assert.equal(by.unit_price.additive, false);
  assert.equal(by.shipping_address.role, "");
  assert.equal(by.customer_id.dimType, "identifier");
  assert.equal(by.status.role, "dimension");
  assert.equal(by.email.sensitive.kind, "Email address");
});

test("hierarchies: geography found in one dataset", () => {
  const hs = AI.suggestHierarchies([E.customers], ctx());
  const g = hs.find((h) => h.name === "Geography");
  assert.deepEqual(g.levels.map((l) => l.column), ["region", "country", "city"]);
});

test("metrics: grouped from usage across sources, ratio kept, duplicate flagged", () => {
  const fields = AI.classifyFields(E.orders, ctx());
  const existing = [{ id: "m_rev", name: "Daily Revenue", model: "mdl_commerce", entity: "e1", agg: "sum", col: "amount", filters: [{ col: "status", op: "is not", val: "cancelled" }] }];
  const ms = AI.suggestMetrics([E.orders], fields, ctx({ metrics: existing, entities: [E.orders] }));
  const rev = ms.find((m) => m.agg === "sum" && m.col === "amount");
  assert.ok(rev.origin.includes("query") && rev.origin.includes("bi") && rev.origin.includes("dbt"));
  assert.equal(rev.duplicate.kind, "exact"); assert.equal(rev.duplicate.id, "m_rev");
  const aov = ms.find((m) => m.type === "ratio");
  assert.equal(aov.numerator.col, "amount"); assert.equal(aov.denominator.agg, "count distinct");
  const price = ms.find((m) => m.col === "unit_price");
  assert.equal(price.agg, "avg"); assert.ok(price.conf < rev.conf);
});

test("glossary: synonym match", () => {
  const t = AI.suggestTerm("lifetime_value", ctx());
  assert.equal(t.termId, "t1");
});

test("validation: fan-out, summed price, no grain — each with a fix", () => {
  const issues = AI.validateModel({
    entities: [E.orders, E.customers, { id: "e3", name: "No Key", table: "nokey" }],
    joins: [{ id: "j1", from: "e1", to: "e2", fromKey: "customer_id", toKey: "customer_id", fanOutSafe: false }],
    dims: [], facts: [],
    metrics: [{ id: "m1", name: "Price Total", entity: "e1", agg: "sum", col: "unit_price", timeDim: "created_at" }],
  }, ctx());
  const fix = (k) => issues.find((i) => i.fix && i.fix.kind === k);
  assert.equal(fix("setKey").fix.keys[0], "nokey_id");
  assert.ok(issues.some((i) => /can double-count/.test(i.title)));
  assert.equal(fix("setAgg").fix.agg, "avg");
  assert.equal(issues[0].severity, "error");
});

test("test questions: SQL walks the declared join", () => {
  const qs = AI.generateTestQuestions({
    entities: [E.orders, E.customers],
    joins: [{ id: "j1", from: "e1", to: "e2", fromKey: "customer_id", toKey: "customer_id" }],
    dims: [{ id: "d1", entity: "e2", column: "segment", name: "Segment", type: "categorical" }],
    metrics: [{ id: "m1", name: "Revenue", entity: "e1", agg: "sum", col: "amount", filters: [{ col: "status", op: "is not", val: "cancelled" }], timeDim: "created_at" }],
  }, ctx());
  const by = qs.find((q) => /by segment/.test(q.q));
  assert.match(by.sql, /JOIN customers ON orders\.customer_id = customers\.customer_id/);
  assert.match(by.sql, /orders.status <> 'cancelled'/);
  assert.match(by.sql, /SUM\(orders\.amount\)/);
});

test("version summary: added, removed, changed and impact", () => {
  const prev = { entities: [E.orders], rels: [], dims: [], facts: [{ id: "f1", entity: "e1", column: "amount", name: "Amount" }],
    metrics: [{ id: "m1", name: "Revenue", entity: "e1", col: "amount" }, { id: "m2", name: "Old", entity: "e1" }] };
  const next = { entities: [E.orders], rels: [], dims: [], facts: [{ id: "f1", entity: "e1", column: "amount", name: "Amount", additive: false }],
    metrics: [{ id: "m1", name: "Revenue", entity: "e1", col: "amount" }, { id: "m3", name: "New", entity: "e1" }] };
  const s = AI.summarizeChanges(prev, next);
  assert.ok(s.lines.some((l) => l.text === "Added metric New"));
  assert.ok(s.lines.some((l) => l.text === "Removed metric Old"));
  assert.ok(s.lines.some((l) => /Changed measure Amount: additive/.test(l.text)));
  assert.deepEqual(s.impact, ["Revenue"]);
});

test("plain-language edits", () => {
  const metrics = [{ id: "a", name: "Net Revenue", entity: "e1", agg: "sum", col: "amount", type: "simple" },
                   { id: "b", name: "Orders", entity: "e1", agg: "count distinct", col: "order_id", type: "simple" }];
  const r = AI.parseEdit("Add metric Average Order Value = Net Revenue / Orders", { metrics });
  assert.equal(r.ok, true); assert.equal(r.metric.type, "ratio"); assert.equal(r.metric.denominator.col, "order_id");
  const s = AI.parseEdit("add metric Total Cost = sum of amount", { metrics, entities: [E.orders], facts: [{ entity: "e1", column: "amount" }] });
  assert.equal(s.metric.agg, "sum"); assert.equal(s.metric.entity, "e1");
  assert.equal(AI.parseEdit("rename metric Orders to Order Count", { metrics }).name, "Order Count");
  assert.equal(AI.parseEdit("make it nice", { metrics }).ok, false);
  const cross = AI.parseEdit("add metric X = Net Revenue / Spend", { metrics: [...metrics, { id: "c", name: "Spend", entity: "e9", agg: "sum", col: "cost", type: "simple" }] });
  assert.equal(cross.ok, false); assert.match(cross.error, /different datasets/);
});

test("import: dbt, LookML and Snowflake, with the grain filled in", () => {
  const dbt = `semantic_models:\n  - name: orders\n    model: ref('orders')\n    measures:\n      - name: revenue\n        agg: sum\n        expr: amount\nmetrics:\n  - name: revenue_total\n    type: simple\n    type_params:\n      measure: revenue\n`;
  const r = AI.importDefinition("dbt", dbt, ctx());
  assert.equal(r.ok, true);
  assert.deepEqual(r.datasets[0].keys, ["order_id"]);
  assert.ok(r.filled.length === 1);
  assert.equal(r.metrics[0].col, "amount");
  const lk = AI.importDefinition("lookml", `view: orders {\n  sql_table_name: prod.orders ;;\n  dimension: order_id { primary_key: yes }\n  measure: total_amount { type: sum sql: \${TABLE}.amount ;; }\n}`, ctx());
  assert.equal(lk.datasets[0].keys[0], "order_id"); assert.equal(lk.metrics[0].col, "amount");
  const sf = AI.importDefinition("snowflake", `CREATE SEMANTIC VIEW s TABLES ( o AS DB.S.orders PRIMARY KEY (order_id) ) METRICS ( o.revenue AS SUM(o.amount) )`, ctx());
  assert.equal(sf.metrics[0].agg, "sum"); assert.equal(sf.datasets[0].table, "orders");
});

test("generateModel: respects feature switches and the confidence floor", () => {
  const all = AI.generateModel({ entities: [E.orders, E.customers], domain: "Commerce" }, ctx());
  assert.ok(all.joins.length && all.fields.length && all.metrics.length && all.identity);
  const some = AI.generateModel({ entities: [E.orders, E.customers], domain: "Commerce" },
    ctx({ settings: { minConfidence: 0.9, features: { joins: false, hierarchies: false } } }));
  assert.equal(some.joins.length, 0); assert.equal(some.hierarchies.length, 0);
  assert.ok(some.metrics.every((m) => m.conf >= 0.9));
});

test("test questions: never slice a metric through the one-to-many side", () => {
  const qs = AI.generateTestQuestions({
    entities: [E.orders, E.customers],
    joins: [{ id: "j1", from: "e1", to: "e2", fromKey: "customer_id", toKey: "customer_id", cardinality: "many_to_one" }],
    dims: [{ id: "d1", entity: "e1", column: "status", name: "Status", type: "categorical" }],
    metrics: [{ id: "m1", name: "Customers", entity: "e2", agg: "count distinct", col: "customer_id", timeDim: "created_at" }],
  }, ctx());
  assert.ok(!qs.some((q) => /JOIN orders/.test(q.sql)), "customers must not be joined out to orders");
});

test("validation: deliberate modelling is not flagged", () => {
  const issues = AI.validateModel({
    entities: [{ id: "l", name: "Line", table: "orders", key: "order_id" }, { id: "d", name: "Date", table: "customers", key: "customer_id" }],
    joins: [{ id: "a", from: "l", to: "d", fromKey: "created_at", toKey: "customer_id", role: "Order date", fanOutSafe: true },
            { id: "b", from: "l", to: "d", fromKey: "customer_id", toKey: "customer_id", role: "Ship date", fanOutSafe: true }],
    dims: [], facts: [{ id: "x", entity: "l", column: "extended_price", additive: true, expr: "a*b" }],
    metrics: [{ id: "m1", name: "Gross", entity: "l", agg: "sum", col: "extended_price", timeDim: "created_at" },
              { id: "m2", name: "On Hand", entity: "l", agg: "sum", col: "amount", additive: false, timeDim: "created_at" }],
  }, ctx());
  assert.ok(!issues.some((i) => /Two join paths/.test(i.title)), "role-playing joins are deliberate");
  assert.ok(!issues.some((i) => /does not exist/.test(i.title)), "a calculated field is a column");
  assert.ok(!issues.some((i) => /should not be summed/.test(i.title)), "extended_price adds up; declared semi-additive is fine");
});
