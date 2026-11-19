import { test } from "node:test";
import assert from "node:assert/strict";
import * as G from "../src/glossary/graph.js";

const REL_TYPES = { is_a: { l: "is a kind of" }, part_of: { l: "is part of" }, placed_by: { l: "is placed by" }, related_to: { l: "is related to" } };
const glossaries = [{ id: "g1", name: "Commerce Glossary", icon: "🛒", desc: "Commerce" }, { id: "g2", name: "Finance Glossary", icon: "💰" }];
const terms = [
  { id: "p", term: "Party", glossary: "g1", termType: "Concept", status: "Approved" },
  { id: "c", term: "Customer", glossary: "g1", termType: "Concept", broader: "p", synonyms: ["Client"], status: "Approved", linkedAssets: [{ name: "customers", type: "Table" }] },
  { id: "o", term: "Order", glossary: "g1", termType: "Concept", status: "Approved" },
  { id: "x", term: "Lonely", glossary: "g1", status: "Draft" },
  { id: "r", term: "Revenue", glossary: "g2", termType: "Metric", relatedTerms: ["o"], status: "Deprecated" },
];
const crels = [{ id: "cr1", from: "o", to: "c", type: "placed_by", status: "approved" }, { id: "cr2", from: "c", to: "p", type: "is_a", status: "approved" },
  { id: "cr3", from: "o", to: "p", type: "part_of", status: "rejected" }];
const input = { glossaries, terms, crels, REL_TYPES };

test("overview: all glossaries, typed edges, parent stated twice draws once, rejected ignored", () => {
  const g = G.glossaryGraph(input);
  assert.equal(g.stats.terms, 5);
  assert.deepEqual(g.edges.map((e) => e.type).sort(), ["broader", "placed_by", "related_to"]);
  assert.equal(g.stats.isolated, 1);
  assert.equal(g.groups.length, 2);
});

test("filters: glossary, relationship type, isolated, hierarchy, with data, search", () => {
  assert.equal(G.glossaryGraph(input, { glossaryIds: ["g1"] }).stats.terms, 4);
  assert.deepEqual(G.glossaryGraph(input, { types: ["placed_by"] }).edges.map((e) => e.type), ["placed_by"]);
  assert.ok(!G.glossaryGraph(input, { isolated: false }).nodes.some((n) => n.id === "x"));
  assert.deepEqual(G.glossaryGraph(input, { mode: "hierarchy", isolated: false }).edges.map((e) => e.type), ["broader"]);
  const d = G.glossaryGraph(input, { withData: true });
  assert.ok(d.nodes.some((n) => n.id === "asset:customers") && d.edges.some((e) => e.type === "describes"));
  assert.equal(G.glossaryGraph(input, { q: "client" }).stats.matches, 1);
  assert.ok(G.relationTypes(crels, REL_TYPES).some((t) => t.k === "placed_by"));
});

test("SKOS export: scheme, concepts, labels, broader, related, typed and deprecated", () => {
  const ttl = G.exportSkos(glossaries[0], terms, crels, REL_TYPES, "turtle");
  assert.match(ttl, /a skos:ConceptScheme/);
  assert.match(ttl, /gl:Customer a skos:Concept/);
  assert.match(ttl, /skos:altLabel "Client"/);
  assert.match(ttl, /skos:broader gl:Party/);
  assert.match(ttl, /edg:placed_by gl:Customer/);
  assert.ok(!/part_of/.test(ttl), "rejected relationships are not exported");
  const fin = G.exportSkos(glossaries[1], terms, crels, REL_TYPES, "turtle");
  assert.match(fin, /owl:deprecated "true"/);
  assert.match(G.exportSkos(glossaries[0], terms, crels, REL_TYPES), /^<\?xml/);
});
