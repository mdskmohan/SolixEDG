import { test } from "node:test";
import assert from "node:assert/strict";
import * as ONT from "../src/ontology/engine.js";
import * as M from "../src/ontology/metadata.js";
import { exampleOntologies, EXAMPLE_TABLES } from "../src/ontology/examples.js";

const S = Object.fromEntries(EXAMPLE_TABLES.map((t) => [t.name, t.cols]));
const ctx = { tableOf: (m) => m.target.table, assetOf: (t) => (S[t] ? { id: t, name: t } : null), columnsOf: (t) => S[t] || [] };
const [o2c, p2p, prod] = exampleOntologies();

test("examples: three ontologies, one per status", () => {
  assert.deepEqual([o2c, p2p, prod].map((o) => o.name), ["Order to Cash", "Procure to Pay", "Product Catalog"]);
  assert.equal(M.statusOf(o2c), "Approved");
  assert.equal(M.statusOf(p2p), "In Review");
  assert.equal(M.statusOf(prod), "Draft");
  assert.equal(o2c.versions.length, 2);
  assert.equal(p2p.versions.length, 1);
  assert.equal(prod.versions.length, 0);
});

test("examples: every tab has content and no structural errors", () => {
  for (const o of [o2c, p2p, prod]) {
    assert.deepEqual(ONT.validate(o).filter((i) => i.severity === "error"), [], o.name);
    assert.ok(o.classes.length >= 5 && o.rels.length >= 4 && o.individuals.length >= 6, o.name);
    assert.ok(o.constraints.length >= 3 && o.tests.length >= 1, o.name);
    // Every value belongs to a class of its own ontology.
    o.individuals.forEach((v) => assert.ok(o.classes.some((c) => c.id === v.classId), `${o.name}: ${v.name}`));
  }
});

test("examples: approved and in-review ontologies pass every check", () => {
  for (const o of [o2c, p2p]) {
    assert.equal(M.validateMetadata(o, ctx).violations, 0, o.name);
    assert.deepEqual(M.runTests(o, ctx).filter((t) => !t.pass), [], o.name);
  }
});

test("examples: the draft shows a broken field link and an unmapped relationship", () => {
  const rep = M.validateMetadata(prod, ctx);
  assert.equal(rep.violations, 1);
  assert.ok(rep.results.some((r) => r.severity !== "Violation" && /not mapped/.test(r.message)));
  assert.deepEqual(M.runTests(prod, ctx).filter((t) => !t.pass), []);
});

test("examples: values reach the OWL file and the class defined by a value", () => {
  for (const o of [o2c, p2p, prod]) {
    const owl = M.toRdfXml(M.owlTriples(o));
    assert.equal((owl.match(/owl#NamedIndividual/g) || []).length, o.individuals.length, o.name);
    assert.ok(/owl:hasValue|owl#hasValue/.test(owl), o.name);
  }
});
