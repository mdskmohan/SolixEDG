import { test } from "node:test";
import assert from "node:assert/strict";
import * as ONT from "../src/ontology/engine.js";
import * as OAI from "../src/ontology/ai.js";
import { IMPORT_SAMPLES } from "../src/ontology/standards.js";

const base = () => ({
  id: "o1", name: "Commerce", prefix: "com", namespace: "https://x/com#", status: "Draft", desc: "",
  classes: [
    { id: "party", name: "Party", desc: "A person or organisation.", synonyms: [], parent: null, props: [] },
    { id: "cust", name: "Customer", desc: "A party that buys.", synonyms: ["Client"], parent: "party", props: [{ id: "p1", name: "Email", datatype: "string" }] },
    { id: "ord", name: "Order", desc: "", synonyms: [], parent: null, props: [] },
  ],
  rels: [{ id: "r1", from: "ord", to: "cust", name: "placed by", inverse: "", cardinality: "many_to_one" }],
  constraints: [], versions: [],
});

test("validate: cycle, missing endpoint, missing definition", () => {
  const o = base();
  o.classes[0].parent = "cust";                       // Party → Customer → Party
  o.rels.push({ id: "r2", from: "ord", to: "gone", name: "x" });
  const issues = ONT.validate(o);
  assert.ok(issues.some((i) => i.code === "class.cycle"));
  assert.ok(issues.some((i) => i.code === "rel.endpoint" && i.fix.kind === "removeRel"));
  assert.ok(issues.some((i) => i.code === "class.desc" && i.target.id === "ord"));
  assert.equal(issues[0].severity, "error");
});

test("publish: blocked by errors, then versioned; no-op republish refused", () => {
  const bad = base(); bad.classes.push({ id: "dup", name: "order", props: [] });
  assert.equal(ONT.publish(bad, "me").ok, false);
  const r = ONT.publish(base(), "me", "first");
  assert.equal(r.ok, true); assert.equal(r.ontology.publishedN, 1);
  assert.equal(ONT.isDirty(r.ontology), false);
  assert.equal(ONT.publish(r.ontology, "me").ok, false);
  const next = { ...r.ontology, classes: [...r.ontology.classes, { id: "prod", name: "Product", props: [] }] };
  assert.equal(ONT.isDirty(next), true);
  assert.ok(ONT.diff(r.version.snapshot, ONT.snapshot(next)).some((l) => l.text === "Added class Product"));
});

test("Turtle round trip: export then import keeps classes, hierarchy, relationship and property", () => {
  const ttl = ONT.toTurtle(base());
  const imp = ONT.importTurtle(ttl);
  assert.equal(imp.ok, true);
  const cust = imp.classes.find((c) => c.name === "Customer");
  assert.equal(imp.classes.find((c) => c.id === cust.parent).name, "Party");
  assert.deepEqual(cust.synonyms, ["Client"]);
  assert.equal(cust.props[0].name, "Email");
  const r = imp.rels[0]; assert.equal(r.name, "placed by"); assert.equal(r.cardinality, "many_to_one");
});

test("import: OWL sample, SHACL constraints, SKOS concepts, Palantir JSON", () => {
  const owl = ONT.importTurtle(IMPORT_SAMPLES.turtle);
  assert.equal(owl.ok, true);
  assert.ok(owl.classes.some((c) => c.name === "Subscription"));
  assert.equal(owl.rels.find((r) => r.name === "placed by").inverse, "places");
  const sh = ONT.importTurtle(IMPORT_SAMPLES.shacl);
  const kinds = sh.constraints.map((k) => k.kind).sort();
  assert.deepEqual(kinds, ["pattern", "required", "unique", "values"]);
  assert.equal(sh.constraints.find((k) => k.kind === "values").severity, "warning");
  const sk = ONT.importTurtle(IMPORT_SAMPLES.skos);
  assert.equal(sk.concepts.length, 2); assert.equal(sk.concepts[1].broader, "Revenue");
  const pl = ONT.importDocument("palantir", IMPORT_SAMPLES.palantir);
  assert.equal(pl.ok, true); assert.equal(pl.rels[0].cardinality, "many_to_one");
  assert.ok(pl.constraints.some((k) => k.kind === "unique"));
  assert.equal(ONT.importTurtle("not turtle at all").ok, false);
});

test("SHACL out: required, unique, values", () => {
  const o = base();
  o.constraints = [{ id: "k1", classId: "cust", prop: "Email", kind: "required" }, { id: "k2", classId: "cust", prop: "Email", kind: "pattern", value: "^.+@.+$" }];
  const s = ONT.toShacl(o);
  assert.match(s, /sh:targetClass com:Customer/); assert.match(s, /sh:minCount 1/); assert.match(s, /sh:pattern/);
  const back = ONT.importTurtle(s);
  assert.ok(back.constraints.some((k) => k.kind === "required"));
});

test("merge: classes match by name; new parents remapped; nothing duplicated", () => {
  const imp = ONT.importTurtle(IMPORT_SAMPLES.turtle);
  const out = ONT.mergeInto(base(), imp, { by: "import" });
  assert.equal(out.classes.filter((c) => c.name === "Customer").length, 1);
  const sub = out.classes.find((c) => c.name === "Subscription");
  assert.ok(sub && sub.prov);
  assert.equal(out.rels.filter((r) => r.name === "placed by").length, 1);
  assert.ok(out.rels.some((r) => r.name === "held by" && out.classes.find((c) => c.id === r.to).name === "Customer"));
});

test("AI draft: classes from datasets named by concepts, is-a from broader, relationships from joins", () => {
  const d = OAI.draftFromMetadata({
    models: [{ name: "Commerce Revenue", entityIds: ["e_order", "e_cust"] }],
    entities: [{ id: "e_order", name: "Order", table: "orders", key: "order_id", concept: "tc3" }, { id: "e_cust", name: "Customer", table: "users", key: "user_id", concept: "tc1" }],
    joins: [{ id: "j", from: "e_order", to: "e_cust", fromKey: "customer_id", toKey: "user_id", cardinality: "many_to_one" }],
    dims: [{ entity: "e_order", name: "Order Status", column: "status", type: "categorical" }], facts: [],
    concepts: [{ id: "tc1", name: "Customer", definition: "Buys.", broader: "tc2" }, { id: "tc2", name: "Party", definition: "Anyone." }, { id: "tc3", name: "Order", definition: "Commitment." }],
    schemaOf: (t) => t === "orders" ? [{ name: "status", type: "ENUM" }] : [],
  });
  const names = d.classes.map((c) => c.name).sort();
  assert.deepEqual(names, ["Customer", "Order", "Party"]);
  const cust = d.classes.find((c) => c.name === "Customer");
  assert.equal(d.classes.find((c) => c.id === cust.parent).name, "Party");
  assert.equal(d.rels[0].name, "placed by"); assert.equal(d.rels[0].inverse, "places");
  assert.equal(d.classes.find((c) => c.name === "Order").props[0].name, "Order Status");
  assert.equal(cust.by, "ai");
});

test("AI extract from text: definitions, is-a and relationships with the sentence as evidence", () => {
  const x = OAI.extractFromText("Every customer is a kind of party. Each order is placed by exactly one customer. Every subscription belongs to one customer. A shipment is a parcel sent to fulfil an order.");
  const names = x.classes.map((c) => c.name);
  assert.ok(["Customer", "Party", "Order", "Subscription", "Shipment"].every((n) => names.includes(n)));
  assert.equal(x.isA[0].parent, "Party");
  assert.ok(x.rels.some((r) => r.from === "Order" && r.to === "Customer" && r.name === "placed by"));
  assert.ok(x.rels.some((r) => r.name === "belongs to"));
  assert.match(x.classes.find((c) => c.name === "Shipment").desc, /^A parcel sent/);
});

test("AI relationship suggestions: inverse, is-a by name, part-of, from joins", () => {
  const o = base();
  o.classes.push({ id: "rc", name: "Retail Customer", props: [] }, { id: "ol", name: "Order Line", props: [] }, { id: "pr", name: "Product", props: [] });
  const s = OAI.suggestRelationships(o, {
    entities: [{ id: "eL", name: "Order Line" }, { id: "eP", name: "Product" }],
    joins: [{ id: "j1", from: "eL", to: "eP", fromKey: "product_id", toKey: "product_id", cardinality: "many_to_one" }] });
  assert.equal(s.find((x) => x.kind === "inverse").patch.inverse, "places");
  assert.ok(s.some((x) => x.kind === "isA" && x.classId === "rc" && x.parentId === "cust"));
  assert.ok(s.some((x) => x.rel && x.rel.name === "part of" && x.rel.to === "ord"));
  assert.ok(s.some((x) => x.rel && x.rel.from === "ol" && x.rel.to === "pr" && x.rel.name === "is for"));
});

test("AI constraints from profiles, standards alignment, duplicates", () => {
  const o = base();
  o.classes[1].props.push({ id: "p2", name: "Status", datatype: "string" });
  const k = OAI.suggestConstraints(o, {
    entities: [{ id: "e", name: "Customer", table: "customers" }],
    schemaOf: () => [{ name: "email", nullable: false }, { name: "status" }],
    profileOf: (t, c) => c === "status" ? { nullPct: 0, distinctCount: "3", topValues: ["active (80%)", "paused (15%)", "closed (5%)"] } : { nullPct: 0, distinctPct: 100 },
  });
  assert.ok(k.some((x) => x.prop === "Email" && x.kind === "unique"));
  assert.ok(k.some((x) => x.prop === "Email" && x.kind === "pattern"));
  assert.equal(k.find((x) => x.prop === "Status" && x.kind === "values").value, "active, paused, closed");
  const st = OAI.alignToStandard(o, "fibo");
  assert.ok(st.some((x) => x.classId === "cust" && x.sameAs.label === "Customer"));
  assert.ok(st.some((x) => x.classId === "party" && x.sameAs.label === "Party"));
  const other = { id: "o2", name: "CRM", classes: [{ id: "c9", name: "Client", synonyms: [] }] };
  const d = OAI.findDuplicates([o, other]);
  assert.ok(d.some((x) => !x.within && x.b.name === "Client"));
});

test("AI plain-language edits", () => {
  const o = base();
  assert.equal(OAI.parseEdit("add class Subscription is a kind of Party", o).cls.parent, "party");
  const r = OAI.parseEdit("add relationship Order placed by Customer (many to one)", o);
  assert.equal(r.rel.name, "placed by"); assert.equal(r.rel.cardinality, "many_to_one"); assert.equal(r.rel.inverse, "places");
  assert.equal(OAI.parseEdit("make Order a kind of Party", o).parent, "party");
  assert.equal(OAI.parseEdit("rename class Order to Sales Order", o).name, "Sales Order");
  assert.equal(OAI.parseEdit("add class Customer", o).ok, false);
  assert.equal(OAI.parseEdit("do something", o).ok, false);
});

test("AI draft: a line narrower than its order is part of it, not a kind of it", () => {
  const d = OAI.draftFromMetadata({
    models: [{ name: "Retail", entityIds: ["eL", "eO"] }],
    entities: [{ id: "eL", name: "Order Line", table: "order_lines", keys: ["order_id", "line_no"], concept: "tc7" }, { id: "eO", name: "Order", table: "orders", key: "order_id", concept: "tc3" }],
    joins: [], dims: [{ entity: "eL", name: "Order Id", column: "order_id", type: "categorical" }], facts: [],
    concepts: [{ id: "tc7", name: "Order Line", definition: "", broader: "tc3" }, { id: "tc3", name: "Order", definition: "" }], schemaOf: () => [],
  });
  const line = d.classes.find((c) => c.name === "Order Line");
  assert.equal(line.parent, null);
  assert.ok(d.rels.some((r) => r.from === line.id && r.name === "part of"));
  assert.equal(line.props.length, 0, "key columns are not properties");
});
