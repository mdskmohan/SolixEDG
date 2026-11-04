// node --test tests/
// Integration tests for the context engine: state, permissions, publication.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/context/engine.js";
import { createStorageAdapter, mergeSaved, resetSeeded, tombstonesOf } from "../src/context/persist.js";

const T0 = "2026-11-04T09:00:00.000Z";
const terms = () => [
  { id: "tRev", term: "Net Revenue", termType: "Metric", domain: "Commerce", status: "Approved", definition: "Revenue net of cancellations.", synonyms: ["Sales"], abbr: "—" },
  { id: "tMRR", term: "Monthly Recurring Revenue", termType: "Metric", domain: "Finance", status: "In Review", definition: "Normalised monthly subscription revenue.", synonyms: ["MRR"], abbr: "MRR" },
  { id: "cCust", term: "Customer", termType: "Concept", domain: "Commerce", status: "Approved", definition: "A buyer.", synonyms: ["Client"] },
  { id: "cParty", term: "Party", termType: "Concept", domain: "Commerce", status: "Approved", definition: "Any legal person.", synonyms: [] },
  { id: "cOrder", term: "Order", termType: "Concept", domain: "Commerce", status: "Approved", definition: "A commitment to buy.", synonyms: [] },
  { id: "dRegion", term: "Region", termType: "Dimension", domain: "Commerce", status: "Approved", definition: "Sales territory.", synonyms: [] },
  { id: "tOld", term: "Old Thing", termType: "Term", domain: "Commerce", status: "Deprecated", definition: "", synonyms: [] },
];
const schema = {
  orders: [{ name: "order_id" }, { name: "amount" }, { name: "created_at" }, { name: "region" }, { name: "email", pii: true }, { name: "customer_id" }],
  users: [{ name: "user_id" }, { name: "is_active" }],
  txns: [{ name: "txn_id" }, { name: "amount" }, { name: "txn_date" }, { name: "account_id" }],
};
const sl = () => ({
  models: [
    { id: "mC", name: "Commerce", domain: "Commerce", owner: "maya", entityIds: ["eO", "eU"] },
    { id: "mF", name: "Finance", domain: "Finance", owner: "sarah", entityIds: ["eT"] },
  ],
  entities: [
    { id: "eO", name: "Order", table: "orders", key: "order_id", concept: "cOrder", domain: "Commerce" },
    { id: "eU", name: "Customer", table: "users", key: "user_id", concept: "cCust", domain: "Commerce" },
    { id: "eT", name: "Transaction", table: "txns", key: "txn_id", domain: "Finance" },
  ],
  rels: [{ id: "r1", from: "eO", to: "eU", fromKey: "customer_id", toKey: "user_id", fanOutSafe: true }],
  dims: [{ id: "dReg", entity: "eO", name: "Region", column: "region", termId: null }, { id: "dEm", entity: "eO", name: "Email", column: "email" }],
  facts: [],
  metrics: [
    { id: "mRev", model: "mC", name: "Daily Revenue", type: "simple", status: "Approved", termId: null, entity: "eO", agg: "sum", col: "amount", timeDim: "created_at", timeGrain: "day", dims: ["region", "email"], definition: "Revenue per day.", bindings: [{ confirmed: true, object: "ORDERS", expr: "SUM(amount)" }], owner: "maya" },
    { id: "mYoY", model: "mC", name: "Revenue YoY Growth", type: "simple", status: "In Review", termId: null, entity: "eO", agg: "sum", col: "amount", timeDim: "created_at", definition: "Growth.", bindings: [], owner: "maya" },
    { id: "mMRR", model: "mF", name: "Monthly Recurring Revenue", type: "simple", status: "In Review", termId: "tMRR", entity: "eT", agg: "sum", col: "amount", timeDim: "txn_date", definition: "MRR.", bindings: [{ confirmed: true, object: "TXNS", expr: "SUM(amount)" }], owner: "sarah" },
  ],
});
const dq = () => [
  { id: "q1", table: "commerce.orders", name: "orders.amount range", status: "Success", observedAt: T0 },
  { id: "q2", table: "commerce.orders", name: "orders.status in set", status: "Failed", observedAt: T0 },
  { id: "q3", table: "commerce.orders", name: "orders freshness", defName: "Table Data Freshness", status: "Success", lastVal: "2 h", observedAt: T0 },
  { id: "q4", table: "commerce.orders", name: "orders.id unique", status: "Success", observedAt: T0 },
];

function world(over = {}) {
  let s = sl(); let versions = [];
  for (const id of ["mC"]) { const r = E.publishModel(s, versions, id, terms(), { schema }, "seed", "", T0); assert.ok(r.ok, r.error); s = r.sl; versions = r.versions; }
  return { sl: s, versions, terms: terms(), crels: [], linkRecords: [], dq: dq(), schema, profiles: E.SEED_PROFILES.map(p => ({ ...p })), history: [], ...over };
}
const ask = (w, q, extra = {}) => E.buildContext(w, { question: q, personaId: "steward", profileId: "prof_explore", ...extra }, { now: T0 });

// ── relationships ────────────────────────────────────────────────────────────
test("relationship rules: valid types, no self, no duplicate, no cycle", () => {
  const ts = terms(); let rels = [];
  let r = E.proposeRelationship(rels, ts, { from: "cCust", to: "cParty", type: "is_a" }, "dev", T0); assert.ok(r.ok); rels = r.rels;
  assert.equal(E.checkRelationship(rels, ts, { from: "cCust", to: "cParty", type: "is_a" }).errors[0].code, "duplicate");
  assert.ok(E.checkRelationship(rels, ts, { from: "cParty", to: "cCust", type: "is_a" }).errors.some(e => e.code === "cycle"));
  assert.equal(E.checkRelationship(rels, ts, { from: "cCust", to: "cCust", type: "related_to" }).errors[0].code, "self");
  assert.ok(E.checkRelationship(rels, ts, { from: "dRegion", to: "cCust", type: "is_a" }).errors.some(e => e.code === "source_type"));
  assert.ok(E.checkRelationship(rels, ts, { from: "tRev", to: "tOld", type: "related_to" }).errors.some(e => e.code === "inactive_term"));
  // symmetric duplicate in the other direction
  r = E.proposeRelationship(rels, ts, { from: "tRev", to: "cCust", type: "related_to" }, "dev", T0); rels = r.rels;
  assert.equal(E.checkRelationship(rels, ts, { from: "cCust", to: "tRev", type: "related_to" }).errors[0].code, "duplicate");
});

test("relationship review: approve/reject change status + history; both directions read", () => {
  const ts = terms();
  let { rels, rel } = E.proposeRelationship([], ts, { from: "cOrder", to: "cCust", type: "placed_by" }, "dev", T0);
  assert.equal(E.reviewRelationship(rels, rel.id, "reject", "maya", "", T0).ok, false, "reject needs a reason");
  rels = E.reviewRelationship(rels, rel.id, "approve", "maya", "", T0).rels;
  assert.equal(rels[0].status, "approved"); assert.equal(rels[0].history.length, 2);
  assert.equal(E.reviewRelationship(rels, rel.id, "approve", "maya", "", T0).ok, false, "cannot review twice");
  assert.equal(E.relationsOf("cOrder", rels, ts)[0].label, "is placed by");
  assert.equal(E.relationsOf("cCust", rels, ts)[0].label, "places");
  rels = E.removeRelationship(rels, rel.id, "maya", "wrong", T0);
  assert.equal(E.relationsOf("cCust", rels, ts).length, 0);
});

// ── links + publication pinning ──────────────────────────────────────────────
test("link a model element to a term: proposed → approved writes through; context waits for publish", () => {
  const w = world();
  let p = E.proposeLink(w.sl, w.terms, [], { kind: "metric", elementId: "mRev", termId: "tRev" }, "dev", T0);
  assert.ok(p.ok);
  assert.equal(E.checkLink(w.sl, w.terms, p.records, { kind: "metric", elementId: "mRev", termId: "tRev" }).errors[0].code, "pending");
  assert.ok(E.checkLink(w.sl, w.terms, [], { kind: "dataset", elementId: "eT", termId: "tRev" }).errors.some(e => e.code === "term_type"));
  let rv = E.reviewLink(w.sl, p.records, p.rec.id, "approve", "maya", "", T0);
  assert.equal(rv.sl.metrics.find(m => m.id === "mRev").termId, "tRev");
  const links = E.effectiveLinks(rv.sl, rv.records);
  assert.equal(links.find(l => l.elementId === "mRev").status, "approved");
  // Not published yet → "sales" (a term synonym) does not reach the metric
  const w2 = { ...w, sl: rv.sl, linkRecords: rv.records };
  assert.equal(ask(w2, "sales").status, "insufficient_context");
  // Draft differs from published, publish → now it does
  assert.ok(E.draftState(w2.sl, w2.versions, "mC").changed);
  const pub = E.publishModel(w2.sl, w2.versions, "mC", w2.terms, { schema }, "maya", "link revenue term", T0);
  assert.ok(pub.ok, pub.error);
  const w3 = { ...w2, sl: pub.sl, versions: pub.versions };
  const res = ask(w3, "sales");
  assert.equal(res.resolved.metric, "Daily Revenue"); assert.equal(res.resolved.version, 2);
  // Removing the link revokes it from context immediately, even before republishing.
  const lk = E.effectiveLinks(w3.sl, w3.linkRecords).find(l => l.elementId === "mRev");
  const rm = E.removeLink(w3.sl, w3.linkRecords, lk, "maya", "", T0);
  assert.equal(ask({ ...w3, sl: rm.sl, linkRecords: rm.records }, "sales").status, "insufficient_context");
});

test("draft edits do not change published context until the new version is published", () => {
  const w = world();
  const edited = { ...w.sl, metrics: w.sl.metrics.map(m => m.id === "mRev" ? { ...m, name: "Gross Takings" } : m) };
  const w2 = { ...w, sl: edited };
  assert.equal(ask(w2, "daily revenue").resolved.metric, "Daily Revenue", "published v1 still serves the old name");
  assert.equal(ask(w2, "gross takings").status, "insufficient_context");
  const pub = E.publishModel(edited, w.versions, "mC", w.terms, { schema }, "maya", "", T0);
  const w3 = { ...w2, sl: pub.sl, versions: pub.versions };
  assert.equal(ask(w3, "gross takings").resolved.version, 2);
  assert.equal(E.publishModel(pub.sl, pub.versions, "mC", w.terms, { schema }, "maya", "", T0).ok, false, "nothing changed → nothing to publish");
});

// ── validation ───────────────────────────────────────────────────────────────
test("validation issues point at a target and fixing them changes the next result", () => {
  const w = world();
  let s = { ...w.sl, rels: [] }; // remove the only join
  let issues = E.validateSnapshot(E.snapshotModel(s, "mC"), { terms: w.terms, schema });
  const un = issues.find(i => i.code === "dataset.unjoined");
  assert.ok(un); assert.equal(un.target.kind, "dataset"); assert.equal(un.severity, "error");
  assert.equal(E.publishModel(s, w.versions, "mC", w.terms, { schema }, "x", "", T0).ok, false);
  s = { ...s, rels: [{ id: "r9", from: "eO", to: "eU", fromKey: "customer_id", toKey: "user_id" }] };
  issues = E.validateSnapshot(E.snapshotModel(s, "mC"), { terms: w.terms, schema });
  assert.ok(!issues.some(i => i.code === "dataset.unjoined"));
  // Finance: metric linked to an unapproved term is an error; approving the term clears it.
  const fIssues = E.validateSnapshot(E.snapshotModel(w.sl, "mF"), { terms: w.terms, schema });
  const bad = fIssues.find(i => i.code === "link.term_not_approved");
  assert.equal(bad.target.kind, "term"); assert.equal(bad.target.id, "tMRR");
  const approved = w.terms.map(t => t.id === "tMRR" ? { ...t, status: "Approved" } : t);
  assert.ok(!E.validateSnapshot(E.snapshotModel(w.sl, "mF"), { terms: approved, schema }).some(i => i.severity === "error"));
  assert.ok(E.publishModel(w.sl, w.versions, "mF", approved, { schema }, "sarah", "", T0).ok);
});

// ── context behaviour ────────────────────────────────────────────────────────
test("ambiguous revenue request asks for clarification; a choice resolves it", () => {
  const w = world();
  const r = ask(w, "revenue");
  assert.equal(r.status, "needs_clarification");
  assert.deepEqual(r.clarification.options.map(o => o.metric).sort(), ["Daily Revenue", "Revenue YoY Growth"]);
  const pick = r.clarification.options.find(o => o.metric === "Daily Revenue");
  const r2 = ask(w, "revenue", { choice: pick.key });
  assert.equal(r2.resolved.metric, "Daily Revenue");
  assert.throws(() => ask(w, "revenue", { choice: "mX:nope" }), e => e.code === "invalid_request");
});

test("quality change changes the outcome under a blocking profile", () => {
  const w = world();
  const prof = { ...E.SEED_PROFILES[1], id: "pQ", name: "Q", requireApprovedTerm: false, minQualityPct: 90, maxStalenessHours: 6, onViolation: "block", onMissingEvidence: "block" };
  const w2 = { ...w, profiles: [...w.profiles, prof] };
  const a = E.buildContext(w2, { question: "daily revenue", personaId: "steward", profileId: "pQ" }, { now: T0 });
  assert.equal(a.status, "blocked"); assert.match(a.summary, /Quality is 75%/);
  const fixed = { ...w2, dq: w2.dq.map(t => t.id === "q2" ? { ...t, status: "Success", observedAt: "2026-11-04T10:00:00.000Z" } : t) };
  const b = E.buildContext(fixed, { question: "daily revenue", personaId: "steward", profileId: "pQ" }, { now: T0 });
  assert.equal(b.status, "ok");
  assert.equal(b.evidence.find(e => e.kind === "quality").at, "2026-11-04T10:00:00.000Z");
  assert.ok(E.diffResponses(a, b).some(d => /Status blocked → ok/.test(d)));
});

test("missing evidence warns or blocks according to the profile", () => {
  const w = world({ dq: [] });
  const warn = E.buildContext(w, { question: "daily revenue", personaId: "steward", profileId: "prof_analyst" }, { now: T0 });
  assert.equal(warn.status, "ok_with_warnings");
  assert.equal(warn.evidence.find(e => e.kind === "quality").status, "missing");
  const block = E.buildContext({ ...w, profiles: [...w.profiles, { ...E.SEED_PROFILES[1], id: "pB", requireApprovedTerm: false }] },
    { question: "daily revenue", personaId: "steward", profileId: "pB" }, { now: T0 });
  assert.equal(block.status, "blocked");
  assert.equal(block.context, undefined, "a blocked response carries no context payload");
});

test("personas: restricted domains and PII never leak into results", () => {
  const w = world();
  const pub = E.publishModel(w.sl, w.versions, "mF", w.terms.map(t => t.id === "tMRR" ? { ...t, status: "Approved" } : t), { schema }, "s", "", T0);
  const w2 = { ...w, sl: pub.sl, versions: pub.versions };
  const fin = E.buildContext(w2, { question: "monthly recurring revenue", personaId: "finance", profileId: "prof_explore" }, { now: T0 });
  assert.equal(fin.resolved.metric, "Monthly Recurring Revenue");
  const com = E.buildContext(w2, { question: "monthly recurring revenue", personaId: "commerce", profileId: "prof_explore" }, { now: T0 });
  assert.ok(!JSON.stringify(com).includes("Monthly Recurring"), "commerce persona must not see the finance metric anywhere");
  const prod = E.buildContext(w2, { question: "daily revenue", personaId: "product", profileId: "prof_explore" }, { now: T0 });
  assert.equal(prod.status, "insufficient_context");
  assert.ok(!JSON.stringify(prod).includes("Daily Revenue"), "suggestions are filtered too");
  const steward = ask(w2, "daily revenue"), analyst = E.buildContext(w2, { question: "daily revenue", personaId: "commerce", profileId: "prof_explore" }, { now: T0 });
  assert.ok(steward.context.dimensions.some(d => d.column === "email"));
  assert.ok(!JSON.stringify(analyst.context).includes("email"), "PII field withheld");
  const g = E.buildGraph(w2, E.personaOf("commerce"));
  assert.ok(!g.nodes.some(n => n.domain === "Finance"));
});

test("invalid input is rejected with a field", () => {
  const w = world();
  assert.throws(() => ask(w, "   "), e => e.code === "invalid_request" && e.field === "question");
  assert.throws(() => E.buildContext(w, { question: "x", personaId: "nobody", profileId: "prof_explore" }), e => e.field === "personaId");
  assert.throws(() => E.buildContext(w, { question: "x", personaId: "steward", profileId: "zzz" }), e => e.field === "profileId");
  assert.equal(ask(w, "weather in paris").status, "insufficient_context");
  assert.ok(!E.checkProfile({ name: "", minQualityPct: 120, maxStalenessHours: -1, relDepth: 3, onViolation: "x", onMissingEvidence: "warn" }, []).ok);
});

test("rendered text and JSON come from the same response object", () => {
  const w = world();
  const r = ask(w, "daily revenue");
  const txt = E.renderText(r);
  assert.ok(txt.includes(r.context.calculation));
  r.evidence.forEach(e => assert.ok(txt.includes(e.detail)));
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
});

test("impact separates potential from observed and follows mapping changes", () => {
  const w = world();
  let p = E.proposeLink(w.sl, w.terms, [], { kind: "field", elementId: "dReg", termId: "dRegion" }, "dev", T0);
  let rv = E.reviewLink(w.sl, p.records, p.rec.id, "approve", "maya", "", T0);
  const w2 = { ...w, sl: rv.sl, linkRecords: rv.records };
  const imp = E.impactOf(w2, { kind: "term", id: "dRegion" });
  assert.ok(imp.potential.some(x => x.kind === "metric" && x.id === "mRev"), "metric slicing by region is impacted");
  assert.equal(imp.observed.length, 0);
  const res = ask(w2, "daily revenue");
  const w3 = { ...w2, history: [{ id: "h1", at: T0, request: res.request, response: res }] };
  assert.equal(E.impactOf(w3, { kind: "metric", id: "mRev" }).observed.length, 1);
  // Remove the mapping → the term no longer reaches the metric
  const lk = E.effectiveLinks(w2.sl, w2.linkRecords).find(l => l.elementId === "dReg");
  const rm = E.removeLink(w2.sl, w2.linkRecords, lk, "maya", "", T0);
  assert.ok(!E.impactOf({ ...w2, sl: rm.sl, linkRecords: rm.records }, { kind: "term", id: "dRegion" }).potential.some(x => x.id === "mRev"));
});

test("term deletion is blocked by approved dependencies and published versions", () => {
  const w = world();
  const d = E.termDependencies(w, "cOrder");
  assert.equal(d.canDelete, false);
  assert.ok(d.blocking.some(b => b.kind === "link")); assert.ok(d.blocking.some(b => b.kind === "version"));
  assert.equal(E.termDependencies(w, "tOld").canDelete, true);
});

// ── persistence ──────────────────────────────────────────────────────────────
test("storage adapter round-trips, tolerates failures, and reset keeps user records", () => {
  const mem = new Map(); const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
  const a = createStorageAdapter({ storage, key: "k" });
  assert.equal(a.load(), null);
  a.save({ x: [1] }); assert.deepEqual(a.load().x, [1]);
  const errs = []; const bad = createStorageAdapter({ storage: { getItem: () => "{oops", setItem: () => { throw new Error("quota"); } }, key: "k", onError: e => errs.push(e) });
  assert.equal(bad.load(), null); assert.equal(bad.save({}), false); assert.equal(errs.length, 2);
  const seed = [{ id: "a", v: 1 }, { id: "b", v: 1 }];
  const cur = [{ id: "a", v: 9 }, { id: "u1", v: 5 }];
  assert.deepEqual(tombstonesOf(seed, cur), ["b"]);
  assert.deepEqual(mergeSaved(seed, cur, ["b"]).map(x => x.id), ["a", "u1"]);
  assert.deepEqual(mergeSaved(seed, cur, []).map(x => x.id), ["a", "u1", "b"]);
  assert.deepEqual(resetSeeded(seed, cur), [{ id: "a", v: 1 }, { id: "b", v: 1 }, { id: "u1", v: 5 }]);
});
