import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/ontology/metadata.js";

// The plan's Sales example: Order, Customer, placedBy, billedTo, mapped to
// ORDERS.BUYER_ID and ORDERS.BILL_TO_ID. Data stays in the source.
const SCHEMA = {
  ORDERS: [{ name: "ORDER_ID", type: "VARCHAR", pk: true }, { name: "BUYER_ID", type: "VARCHAR" }, { name: "BILL_TO_ID", type: "VARCHAR" }, { name: "ORDER_DATE", type: "DATE" }],
  CUSTOMERS: [{ name: "CUSTOMER_ID", type: "VARCHAR", pk: true }, { name: "NAME", type: "VARCHAR" }],
};
const ctx = { tableOf: (m) => m.target.table, assetOf: (t) => (SCHEMA[t] ? { id: `a_${t}`, name: t } : null), columnsOf: (t) => SCHEMA[t] || [] };
const base = () => ({
  id: "ont_sales", name: "Sales", prefix: "sales", namespace: "https://example.org/edg/sales#", owner: "maya.chen", owners: ["maya.chen"],
  classes: [
    { id: "cO", name: "Order", props: [{ id: "pId", name: "Order ID", datatype: "string", required: true }, { id: "pDt", name: "Order date", datatype: "date" }] },
    { id: "cC", name: "Customer", props: [{ id: "pCid", name: "Customer ID", datatype: "string", required: true }] }],
  rels: [
    { id: "rB", from: "cO", to: "cC", name: "placed by", inverse: "places", cardinality: "many_to_one", required: true, synonyms: ["buyer", "purchaser"], desc: "The customer who placed the order." },
    { id: "rT", from: "cO", to: "cC", name: "billed to", cardinality: "many_to_one", synonyms: ["bill-to", "billing customer", "payer"], desc: "The customer who receives the invoice." }],
  constraints: [{ id: "k1", classId: "cO", prop: "Order ID", kind: "pattern", value: "^O-[0-9]+$", severity: "violation" }],
  mappings: [
    { id: "m1", kind: "table", classId: "cO", target: { table: "ORDERS", keys: ["ORDER_ID"] } },
    { id: "m2", kind: "table", classId: "cC", target: { table: "CUSTOMERS", keys: ["CUSTOMER_ID"] } },
    { id: "m3", kind: "field", classId: "cO", propId: "pId", target: { table: "ORDERS", column: "ORDER_ID" } },
    { id: "m4", kind: "relfield", classId: "cO", relId: "rB", target: { table: "ORDERS", column: "BUYER_ID" } },
    { id: "m5", kind: "relfield", classId: "cO", relId: "rT", target: { table: "ORDERS", column: "BILL_TO_ID" } }],
  tests: [{ id: "t1", question: "Which field identifies the buyer?", relId: "rB", expect: "ORDERS.BUYER_ID" },
    { id: "t2", question: "Which field identifies the billing customer?", relId: "rT", expect: "ORDERS.BILL_TO_ID" }],
  audience: ["Analytics"],
});

test("IRIs are stable: renaming a class or relationship keeps its identifier", () => {
  const a = M.ensureIris(base());
  assert.equal(a.classes[0].iri, "https://example.org/edg/sales#Order");
  assert.equal(a.rels[0].iri, "https://example.org/edg/sales#placedBy");
  const renamed = M.ensureIris({ ...a, classes: a.classes.map((c) => (c.id === "cO" ? { ...c, name: "Sales Order" } : c)), rels: a.rels.map((r) => (r.id === "rB" ? { ...r, name: "bought by" } : r)) });
  assert.equal(renamed.classes[0].iri, "https://example.org/edg/sales#Order");
  assert.equal(renamed.rels[0].iri, "https://example.org/edg/sales#placedBy");
});

test("OWL: classes, datatype and object properties, inverse, functional", () => {
  const ttl = M.exportFiles(base(), ctx)["ontology.ttl"];
  assert.match(ttl, /sales:Order a owl:Class/);
  assert.match(ttl, /sales:placedBy a owl:ObjectProperty/);
  assert.match(ttl, /rdfs:domain sales:Order/);
  assert.match(ttl, /sales:places a owl:ObjectProperty[\s\S]*owl:inverseOf sales:placedBy/);
  assert.match(ttl, /a owl:FunctionalProperty/);
});

test("SHACL business shapes: datatype, sh:class + counts on relationships, pattern", () => {
  const shapes = M.businessShapes(base());
  const order = shapes.find((s) => s.targetClass.endsWith("#Order"));
  const placed = order.props.find((p) => p.path.endsWith("#placedBy"));
  assert.deepEqual([placed.class.endsWith("#Customer"), placed.minCount, placed.maxCount], [true, 1, 1]);
  assert.equal(order.props.find((p) => p.name === "Order ID").pattern, "^O-[0-9]+$");
  assert.equal(order.props.find((p) => p.name === "Order ID").datatype, M.NS.xsd + "string");
});

test("a mapped ontology conforms; a binding with no catalog field is a violation", () => {
  const ok = M.validateMetadata(base(), ctx);
  assert.equal(ok.violations, 0, JSON.stringify(ok.results.filter((r) => r.severity === "Violation")));
  const broken = base(); broken.mappings = broken.mappings.map((m) => (m.id === "m5" ? { ...m, target: { table: "ORDERS", column: "" } } : m));
  const r = M.validateMetadata(broken, ctx);
  const v = r.results.find((x) => x.severity === "Violation");
  assert.ok(v && v.component === "sh:MinCountConstraintComponent" && v.resultPath === M.X("edg:sourceField"));
  // a field the catalog no longer has: sh:class fails
  const gone = base(); gone.mappings = gone.mappings.map((m) => (m.id === "m4" ? { ...m, target: { table: "ORDERS", column: "PURCHASER_ID" } } : m));
  assert.ok(M.validateMetadata(gone, ctx).results.some((x) => x.component === "sh:ClassConstraintComponent"));
});

test("swapped fields pass SHACL but fail the expected-answer tests", () => {
  const sw = base(); sw.mappings = sw.mappings.map((m) => (m.id === "m4" ? { ...m, target: { ...m.target, column: "BILL_TO_ID" } } : m.id === "m5" ? { ...m, target: { ...m.target, column: "BUYER_ID" } } : m));
  assert.equal(M.validateMetadata(sw, ctx).violations, 0);
  const t = M.runTests(sw, ctx);
  assert.deepEqual(t.map((x) => x.pass), [false, false]);
  assert.ok(M.runTests(base(), ctx).every((x) => x.pass));
});

test("query: authorized caller gets the field from the published version; restricted caller gets unavailable", () => {
  const o = { ...base(), publishedN: 1 };
  o.versions = [{ n: 1, snapshot: JSON.parse(JSON.stringify({ classes: o.classes, rels: o.rels, mappings: o.mappings, constraints: o.constraints })) }];
  const r = M.query(o, ctx, { question: "Which field identifies the buyer?", caller: { team: "Analytics" } });
  assert.equal(r.status, "ok"); assert.equal(r.field, "ORDERS.BUYER_ID"); assert.equal(r.version, 1);
  assert.equal(M.query(o, ctx, { question: "Which field identifies the buyer?", caller: { team: "Marketing" } }).status, "unavailable");
  assert.equal(M.query(o, ctx, { question: "Which field identifies the nothing?", caller: { team: "Marketing" } }).status, "unavailable");
  assert.equal(M.query(o, ctx, { question: "Which field identifies the billing customer?", caller: { team: "Analytics" } }).field, "ORDERS.BILL_TO_ID");
  const amb = M.query(o, ctx, { question: "Which customer is related to the order?", caller: { team: "Analytics" } });
  assert.equal(amb.status, "ambiguous"); assert.equal(amb.options.length, 2);
  assert.equal(M.query(o, ctx, { question: "Who is the payer?", caller: { team: "Analytics" } }).field, "ORDERS.BILL_TO_ID");
});

test("round trip: export, re-read, identifiers, relationships, shapes and validation results match", () => {
  const rt = M.roundTrip(base(), ctx);
  assert.ok(rt.ok, JSON.stringify(rt.checks));
  const broken = base(); broken.mappings = broken.mappings.map((m) => (m.id === "m5" ? { ...m, target: { table: "ORDERS", column: "" } } : m));
  const rt2 = M.roundTrip(broken, ctx);
  assert.ok(rt2.checks.find((c) => c.k === "validation").ok, JSON.stringify(rt2.checks));
});

test("status: draft, in review, approval only by an owner who did not submit and with no errors", () => {
  const o = base(); o.review = { state: "in_review", submittedBy: "alex.rivera", hash: M.draftHash(o) };
  assert.equal(M.statusOf(o), "In Review");
  assert.equal(M.canApprove(o, "alex.rivera").ok, false);
  assert.equal(M.canApprove(o, "maya.chen").ok, true);
  assert.equal(M.canApprove(o, "maya.chen", 1).ok, false);
  assert.equal(M.statusOf({ ...o, rels: o.rels.map((r) => ({ ...r, desc: "changed" })) }), "Draft");
  assert.equal(M.statusOf({ ...o, deprecated: true }), "Deprecated");
  assert.equal(M.statusOf({ ...o, review: { ...o.review, state: "rejected" } }), "Rejected");
});

test("full OWL: parents, disjoint, keys, restrictions, characteristics, chains, individuals, header", () => {
  const o = base();
  o.publishedN = 2; o.imports = ["https://schema.org/"]; o.license = "https://creativecommons.org/licenses/by/4.0/"; o.created = "2026-11-10";
  o.classes = [...o.classes, { id: "cP", name: "Party", props: [] }, { id: "cS", name: "Order Status", props: [] }];
  o.classes[1] = { ...o.classes[1], parent: "cP", parents: ["cP"], disjoint: ["cO"], keyProps: ["pCid"] };
  o.classes[0] = { ...o.classes[0], restrictions: [{ id: "x1", kind: "some", prop: "rB", target: "cC" }, { id: "x2", kind: "max", prop: "rT", target: "cC", n: 1 }, { id: "x3", kind: "value", prop: "pId", target: "O-1" }] };
  o.rels = [...o.rels, { id: "rR", from: "cC", to: "cC", name: "related to", cardinality: "many_to_many", characteristics: ["symmetric", "transitive"], parentRel: null },
    { id: "rX", from: "cO", to: "cC", name: "billed party", cardinality: "many_to_many", parentRel: "rB", chain: ["rB", "rR"] }];
  o.individuals = [{ id: "i1", name: "Open", classId: "cS", desc: "Not yet shipped" }];
  const ttl = M.exportFiles(o, ctx)["ontology.ttl"];
  for (const re of [/owl:imports <https:\/\/schema.org\/>/, /owl:versionIRI/, /owl:priorVersion/, /dcterms:license/, /dcterms:creator "maya.chen"/,
    /sales:Customer[\s\S]*rdfs:subClassOf sales:Party/, /owl:disjointWith sales:Order/, /owl:hasKey \( sales:customerID \)/,
    /owl:someValuesFrom sales:Customer/, /owl:maxQualifiedCardinality "1"\^\^xsd:nonNegativeInteger/, /owl:hasValue "O-1"/,
    /a owl:SymmetricProperty/, /a owl:TransitiveProperty/, /rdfs:subPropertyOf sales:placedBy/, /owl:propertyChainAxiom \( sales:placedBy sales:relatedTo \)/,
    /sales:Open a owl:NamedIndividual/, /owl:minCardinality "1"/]) assert.match(ttl, re);
  assert.ok(M.roundTrip(o, ctx).ok, JSON.stringify(M.roundTrip(o, ctx).checks));
});

test("RDF/XML and Apache Ossie exports", () => {
  const f = M.exportFiles(base(), ctx);
  assert.match(f["ontology.owl"], /^<\?xml version="1.0"/);
  assert.match(f["ontology.owl"], /<rdf:Description rdf:about="https:\/\/example.org\/edg\/sales#placedBy">/);
  assert.match(f["ontology.owl"], /<rdf:type rdf:resource="http:\/\/www.w3.org\/2002\/07\/owl#ObjectProperty"\/>/);
  assert.match(f["ossie-ontology.yaml"], /concept: Order\n\s+type: EntityType/);
  assert.match(f["ossie-ontology.yaml"], /name: placedBy[\s\S]*multiplicity: ManyToOne[\s\S]*verbalizes:/);
  assert.match(f["ossie-mapping.yaml"], /expression: ORDERS.BUYER_ID/);
  assert.match(f["ossie-mapping.yaml"], /ontology_ref:\n\s+name: Sales/);
});

test("inverse properties are not reported as unmapped relationships", () => {
  const r = M.validateMetadata(base(), ctx);
  assert.equal(r.results.length, 0, JSON.stringify(r.results));
  const unmapped = base(); unmapped.mappings = unmapped.mappings.filter((m) => m.id !== "m5");
  const r2 = M.validateMetadata(unmapped, ctx);
  assert.equal(r2.results.length, 1); assert.equal(r2.results[0].severity, "Warning"); assert.ok(r2.results[0].focusNode.endsWith("#billedTo"));
});

test("restriction 'number of values' with separate min and max", () => {
  const o = base();
  o.classes[0] = { ...o.classes[0], restrictions: [{ id: "c1", kind: "count", prop: "rT", target: "cC", min: "1", max: "3" }, { id: "c2", kind: "count", prop: "pDt", min: "2", max: "2" }] };
  const ttl = M.exportFiles(o, ctx)["ontology.ttl"];
  assert.match(ttl, /owl:minQualifiedCardinality "1"/);
  assert.match(ttl, /owl:maxQualifiedCardinality "3"/);
  assert.match(ttl, /owl:cardinality "2"/);
});
