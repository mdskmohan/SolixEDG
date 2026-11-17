import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../src/pm3/engine.js";
import { seedState, CATALOGUE, TEMPLATES } from "../src/pm3/seed.js";

const assets = [
  { name: "orders", type: "Table", service: "snowflake", db: "snowflake_prod / COMMERCE / orders", domain: "Commerce", owners: ["maya.chen"], stewards: ["dev.patel"], tags: ["PII"], rows: "48.2M", description: "Core transactional orders table.", cert: "Approved", quality: 94 },
  { name: "users", type: "Table", service: "postgres", db: "postgresql_prod / auth / users", domain: "Product", owners: ["alex.wu"], stewards: [], tags: [], rows: "12.7M", description: "", cert: "Draft", quality: 70 },
  { name: "events.parquet", type: "Object", service: "s3", db: "lake / raw / events.parquet", domain: "Product", owners: ["james.oh"], tags: ["raw"] },
  { name: "lake_orders", type: "Iceberg Table", service: "s3", db: "glue / lake / lake_orders", domain: "Commerce", owners: ["maya.chen"], tags: ["PII"] },
  { name: "dash", type: "Dashboard", service: "tableau", owners: ["x"], tags: ["PII"] },
  { name: "archive", type: "Table", service: "cdp", owners: ["x"], tags: ["PII"] },
];
const cols = { users: [{ name: "user_id" }, { name: "email", pii: true }, { name: "created_at" }], orders: [{ name: "order_id" }, { name: "order_date" }, { name: "updated_at" }] };
const ctx = { assets, columnsOf: (n) => cols[n] || [], maskedOf: (n) => n === "orders", retainedOf: () => false, exceptions: {}, today: "2026-11-17" };

test("scope: classification includes PII found in columns, not only tags", () => {
  assert.equal(P.inScope(assets[1], { mode: "class", tags: ["PII"] }, cols.users), true);
  assert.equal(P.inScope(assets[2], { mode: "class", tags: ["PII"] }, []), false);
  assert.equal(P.inScope(assets[2], { mode: "object", objects: ["events.parquet"] }, []), true);
  assert.equal(P.inScope(assets[0], { mode: "class", tags: [], services: ["postgres"] }, []), false);
});

test("lifecycle: only supported sources and data containers; CDP and BI are out", () => {
  assert.deepEqual(assets.filter(P.lifecycleCapable).map((a) => a.name), ["orders", "users", "events.parquet", "lake_orders"]);
});

test("policy evaluation finds failures and honours exceptions", () => {
  const p = { id: "p1", appliesTo: { mode: "class", tags: ["PII"] }, checks: [{ id: "c1", field: "steward", op: "set" }, { id: "c2", field: "masked", op: "set" }] };
  const ev = P.evaluatePolicy(p, ctx);
  assert.deepEqual(ev.assets.map((a) => a.name).sort(), ["archive", "dash", "lake_orders", "orders", "users"]);
  assert.ok(ev.findings.some((f) => f.asset === "users" && f.checkId === "c1"));
  assert.ok(ev.findings.some((f) => f.asset === "users" && f.checkId === "c2"));
  assert.ok(!ev.findings.some((f) => f.asset === "orders"));
  const ev2 = P.evaluatePolicy(p, { ...ctx, exceptions: { "p1|c1|users": { until: "2027-01-01" } } });
  assert.equal(ev2.findings.find((f) => f.key === "p1|c1|users").status, "Exception");
  assert.equal(ev2.open, ev.open - 1);
});

test("expired exceptions count again", () => {
  const p = { id: "p1", appliesTo: { mode: "object", objects: ["users"] }, checks: [{ id: "c1", field: "steward", op: "set" }] };
  assert.equal(P.evaluatePolicy(p, { ...ctx, exceptions: { "p1|c1|users": { until: "2026-01-01" } } }).open, 1);
});

test("date column comes from the table's own schema", () => {
  assert.equal(P.pickDateColumn(cols.users, "created"), "created_at");
  assert.equal(P.pickDateColumn(cols.orders, "created"), "order_date");
  assert.equal(P.pickDateColumn(cols.orders, "modified"), "updated_at");
});

test("native retention code per source", () => {
  const s = { id: "rs1", keep: { n: 7, unit: "years" }, review: false, dateCols: {} };
  const sf = P.retentionCode(s, assets[0], { dateCol: "order_date", exclusions: ["customer_id = 48213"] });
  assert.match(sf.code, /CREATE OR REPLACE TASK/);
  assert.match(sf.code, /DELETE FROM SNOWFLAKE_PROD\.COMMERCE\.ORDERS/);
  assert.match(sf.code, /DATEADD\(day, -2555/);
  assert.match(sf.code, /NOT \(customer_id = 48213\)/);
  assert.match(P.retentionCode(s, assets[1], { dateCol: "created_at" }).code, /cron\.schedule[\s\S]*auth\.users/);
  const s3 = P.retentionCode(s, assets[2]);
  assert.equal(s3.lang, "json"); assert.match(s3.code, /"Days": 2555/); assert.match(s3.code, /--bucket lake/);
  assert.match(P.retentionCode(s, assets[3]).code, /expire_snapshots/);
  assert.equal(P.retentionCode(s, assets[5]), null);
});

test("review stages candidates before any delete", () => {
  const code = P.retentionCode({ id: "rs1", keep: { n: 3, unit: "years" }, review: true }, assets[0], { dateCol: "order_date" }).code;
  assert.ok(code.indexOf("DISPOSITION_QUEUE") < code.indexOf("DELETE FROM"));
});

test("native hold code per source", () => {
  const h = { id: "h1", matterId: "MATTER-1", criteria: { users: { col: "user_id", op: "=", val: "42" } } };
  assert.match(P.holdCode(h, assets[1]).code, /BEFORE DELETE OR UPDATE ON auth\.users[\s\S]*/);
  assert.match(P.holdCode(h, assets[1]).code, /OLD\.user_id = 42/);
  assert.match(P.holdCode(h, assets[2]).code, /put-object-legal-hold[\s\S]*Status=ON/);
  assert.match(P.holdCode(h, assets[0]).code, /REVOKE DELETE, TRUNCATE/);
  assert.match(P.holdCode(h, assets[3]).code, /CREATE TAG legal_hold_matter_1/);
});

test("precedence: hold beats retention, longest schedule wins", () => {
  const S = { schedules: [
      { id: "a", status: "Active", keep: { n: 3, unit: "years" }, _targets: ["orders"] },
      { id: "b", status: "Active", keep: { n: 7, unit: "years" }, _targets: ["orders"] },
      { id: "c", status: "Draft", keep: { n: 9, unit: "years" }, _targets: ["orders"] }],
    holds: [{ id: "h", status: "Active", _targets: ["orders"], criteria: {} }] };
  const L = P.lifecycleOf("orders", S);
  assert.equal(L.winner.id, "b");
  assert.deepEqual(L.overridden.map((s) => s.id), ["a"]);
  assert.equal(L.held, true); assert.equal(L.paused, true);
  const L2 = P.lifecycleOf("orders", { ...S, holds: [{ id: "h", status: "Active", _targets: ["orders"], criteria: { orders: { col: "x", op: "=", val: "1" } } }] });
  assert.equal(L2.held, true); assert.equal(L2.paused, false);
  assert.equal(P.lifecycleOf("orders", { ...S, holds: [{ ...S.holds[0], status: "Released" }] }).held, false);
});

test("regulation score: floors, approvals and evidence", () => {
  const S = { policies: [{ id: "p", status: "Active" }], evalOf: () => ({ open: 0 }),
    schedules: [{ id: "r", status: "Active", keep: { n: 3, unit: "years" }, _targets: ["orders"], approvals: { orders: "approved" } }],
    holds: [], evidence: [{ id: "e", submissions: [{ status: "Accepted" }] }] };
  const reg = { articles: [
    { items: [{ kind: "policy", id: "p" }] },
    { items: [{ kind: "retention", id: "r" }], req: { minDays: 7 * 365 } },
    { items: [{ kind: "evidence", id: "e" }] },
    { items: [] }] };
  const sc = P.regulationScore(reg, S);
  assert.deepEqual([sc.met, sc.gaps, sc.unmapped, sc.pct], [2, 1, 1, 50]);
  assert.match(P.itemStatus({ kind: "retention", id: "r" }, reg.articles[1], S).l, /Below 7-year/);
  const S2 = { ...S, schedules: [{ ...S.schedules[0], approvals: {} }] };
  assert.equal(P.itemStatus({ kind: "retention", id: "r" }, {}, S2).l, "1 awaiting owner");
});

test("seed is coherent: every mapping points at something that exists", () => {
  const s = seedState();
  for (const r of s.regulations) {
    const cat = CATALOGUE.find((c) => c.id === r.id); assert.ok(cat, r.id);
    for (const [aid, items] of Object.entries(r.articles)) {
      assert.ok(cat.articles.some((a) => a.id === aid), `${r.id} ${aid}`);
      for (const it of items) {
        const list = { policy: s.policies, retention: s.schedules, hold: s.holds, evidence: s.evidence }[it.kind];
        assert.ok(list.some((x) => x.id === it.id), `${it.kind} ${it.id}`);
      }
    }
  }
  for (const c of CATALOGUE) for (const a of c.articles) if (a.req.kind === "policy") assert.ok(TEMPLATES.some((t) => t.key === a.req.template), a.req.template);
});
