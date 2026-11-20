import { test } from "node:test";
import assert from "node:assert/strict";
import * as G from "../src/glossary/graph.js";

const glossaries = [{ id: "g1", name: "Commerce Glossary", icon: "🛒", desc: "Commerce" }, { id: "g2", name: "Finance Glossary", icon: "💰" }];
const terms = () => [
  { id: "p", term: "Party", glossary: "g1", status: "Approved", relations: [] },
  { id: "c", term: "Customer", glossary: "g1", broader: "p", synonyms: ["Client"], status: "Approved", linkedAssets: [{ name: "customers", type: "Table" }],
    relations: [{ id: "r1", type: "sameAs", to: "cl", note: "", status: "approved" }] },
  { id: "cl", term: "Client", glossary: "g2", status: "Approved", relations: [{ id: "r2", type: "sameAs", to: "c", status: "approved" }] },
  { id: "x", term: "Lonely", glossary: "g1", status: "Draft", relations: [] },
  { id: "gm", term: "Gross Margin", glossary: "g2", termType: "Metric", status: "Approved", relations: [{ id: "r3", type: "calculatedFrom", to: "rev", status: "approved" }] },
  { id: "rev", term: "Revenue", glossary: "g2", termType: "Metric", status: "Deprecated", relations: [{ id: "r4", type: "replacedBy", to: "gm", status: "proposed" }] },
];

test("relationsOf: both directions in words, symmetric shown once, child terms", () => {
  const ts = terms();
  const c = G.relationsOf(ts[1], ts);
  assert.deepEqual(c.map((r) => r.label).sort(), ["Parent term", "Same meaning as"]);
  const p = G.relationsOf(ts[0], ts);
  assert.deepEqual(p.map((r) => [r.label, r.other.term]), [["Child term", "Customer"]]);
  const rev = G.relationsOf(ts[5], ts);
  assert.ok(rev.some((r) => r.label === "Used to calculate" && r.other.term === "Gross Margin"));
  assert.ok(rev.some((r) => r.label === "Replaced by" && r.status === "proposed"));
});

test("checkRelation: self, duplicate, metric-only, parent cycle", () => {
  const ts = terms();
  assert.equal(G.checkRelation(ts[0], ts, { type: "related", to: "p" }), "A term cannot relate to itself");
  assert.equal(G.checkRelation(ts[2], ts, { type: "sameAs", to: "c" }), "This relationship already exists");
  assert.match(G.checkRelation(ts[0], ts, { type: "calculatedFrom", to: "c" }), /metric/);
  assert.equal(G.checkRelation(ts[0], ts, { type: "broader", to: "c" }), "That would make the term its own parent");
  assert.equal(G.checkRelation(ts[3], ts, { type: "related", to: "c" }), null);
});

test("graph: glossary boxes, typed edges, filters, isolated, with data, search", () => {
  const ts = terms();
  const g = G.glossaryGraph({ glossaries, terms: ts });
  assert.deepEqual(g.edges.map((e) => e.type).sort(), ["broader", "calculatedFrom", "replacedBy", "sameAs"]);
  assert.equal(g.stats.isolated, 1);
  assert.equal(g.groups.length, 2);
  assert.deepEqual(G.glossaryGraph({ glossaries, terms: ts }, { mode: "hierarchy", isolated: false }).edges.map((e) => e.type), ["broader"]);
  assert.deepEqual(G.glossaryGraph({ glossaries, terms: ts }, { types: ["sameAs"] }).edges.map((e) => e.type), ["sameAs"]);
  assert.ok(G.glossaryGraph({ glossaries, terms: ts }, { withData: true }).nodes.some((n) => n.id === "asset:customers"));
  assert.equal(G.glossaryGraph({ glossaries, terms: ts }, { q: "client" }).stats.matches, 2);
});

test("legacy data: related terms and vocabulary links become relationships; business links do not", () => {
  const crels = [{ id: "k1", from: "a", to: "b", type: "placed_by", status: "approved" }, { id: "k2", from: "a", to: "c", type: "calculated_from", status: "approved" },
    { id: "k3", from: "a", to: "d", type: "related_to", status: "proposed" }];
  const rs = G.legacyRelations({ id: "a", relatedTerms: ["e"] }, crels);
  assert.deepEqual(rs.map((r) => [r.type, r.to, r.status]), [["related", "e", "approved"], ["calculatedFrom", "c", "approved"], ["related", "d", "proposed"]]);
});

test("SKOS: scheme, concepts, broader, exactMatch across glossaries, approved only, deprecated", () => {
  const ts = terms();
  const ttl = G.exportSkos(glossaries[0], ts, glossaries, "turtle");
  assert.match(ttl, /a skos:ConceptScheme/);
  assert.match(ttl, /gl:Customer a skos:Concept/);
  assert.match(ttl, /skos:broader gl:Party/);
  assert.match(ttl, /skos:exactMatch <https:\/\/glossary.jnj.com\/financeGlossary#Client>/);
  const fin = G.exportSkos(glossaries[1], ts, glossaries, "turtle");
  assert.match(fin, /owl:deprecated "true"/);
  assert.ok(!/isReplacedBy/.test(fin), "proposed relationships are not exported");
  assert.match(G.exportSkos(glossaries[0], ts, glossaries), /^<\?xml/);
});
