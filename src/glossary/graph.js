// ─────────────────────────────────────────────────────────────────────────────
// Glossary as a graph (the "Ontology Explorer" view of the glossary) and SKOS
// export. Pure functions; the screen passes glossaries, terms and the typed term
// relationships (crels) it already holds.
//
// Edges come from three places, de-duplicated:
//   parent term (term.broader)       → "broader"  (hierarchy)
//   related terms (term.relatedTerms) → "related_to"
//   typed relationships (crels)       → their own type (is_a, part_of, placed_by …)
// No records: "with data" adds the catalog assets a term is linked to, nothing more.
// ─────────────────────────────────────────────────────────────────────────────
import { NS, X, writeTurtle, toRdfXml } from "../ontology/metadata.js";
import { slug, propSlug } from "../ontology/engine.js";

const LIVE = (r) => r.status !== "rejected" && r.status !== "removed";
export const HIERARCHY_TYPES = ["broader", "is_a", "part_of"];

export function relationTypes(crels, REL_TYPES) {
  const used = new Set(["broader", "related_to", ...crels.filter(LIVE).map((r) => r.type)]);
  const label = (k) => (k === "broader" ? "parent term" : (REL_TYPES[k] || { l: k }).l);
  return [...used].map((k) => ({ k, l: label(k) }));
}

export function glossaryGraph({ glossaries, terms, crels = [], REL_TYPES = {} }, { mode = "overview", glossaryIds = null, types = null, isolated = true, withData = false, q = "" } = {}) {
  const inScope = (t) => !glossaryIds || glossaryIds.includes(t.glossary);
  const scoped = terms.filter(inScope);
  const ids = new Set(scoped.map((t) => t.id));
  const edges = [], seen = new Set();
  const add = (from, to, type, extra) => {
    if (!ids.has(from) || !ids.has(to) || from === to) return;
    const k = [from, to, type].join("|"), k2 = [to, from, type].join("|");
    if (seen.has(k) || (type === "related_to" && seen.has(k2))) return;
    seen.add(k); edges.push({ id: `e${edges.length + 1}`, from, to, type, label: type === "broader" ? "parent term" : (REL_TYPES[type] || { l: type }).l, ...(extra || {}) });
  };
  scoped.forEach((t) => {
    if (t.broader) add(t.id, t.broader, "broader");
    (t.relatedTerms || []).forEach((r) => add(t.id, r, "related_to"));
  });
  crels.filter(LIVE).forEach((r) => add(r.from, r.to, r.type, { status: r.status }));
  // Same parent stated twice (parent term and "is a kind of") draws once.
  const parentPairs = new Set(edges.filter((e) => e.type === "broader").map((e) => `${e.from}|${e.to}`));
  let rel = edges.filter((e) => !(e.type === "is_a" && parentPairs.has(`${e.from}|${e.to}`)));
  if (mode === "hierarchy") rel = rel.filter((e) => HIERARCHY_TYPES.includes(e.type));
  if (types) rel = rel.filter((e) => types.includes(e.type));
  const touched = new Set(rel.flatMap((e) => [e.from, e.to]));
  const isolatedTerms = scoped.filter((t) => !touched.has(t.id));
  let shownTerms = isolated ? scoped : scoped.filter((t) => touched.has(t.id));
  if (mode === "hierarchy") shownTerms = shownTerms.filter((t) => touched.has(t.id) || isolated);
  const query = String(q || "").trim().toLowerCase();
  const match = (t) => !query || `${t.term} ${(t.synonyms || []).join(" ")} ${t.abbr || ""}`.toLowerCase().includes(query);
  const nodes = shownTerms.map((t) => ({ id: t.id, kind: "term", label: t.term, glossary: t.glossary, termType: t.termType || "Term", status: t.status || t.cert, hit: !!query && match(t) }));
  const out = [...rel];
  if (withData) {
    const assets = new Map();
    shownTerms.forEach((t) => (t.linkedAssets || []).forEach((a) => {
      const name = a.name || a; const id = `asset:${name}`;
      if (!assets.has(id)) assets.set(id, { id, kind: "asset", label: name, assetType: a.type || "Asset" });
      out.push({ id: `d${out.length + 1}`, from: t.id, to: id, type: "describes", label: "describes" });
    }));
    nodes.push(...assets.values());
  }
  const groups = (glossaries || []).filter((g) => !glossaryIds || glossaryIds.includes(g.id))
    .map((g) => ({ id: g.id, name: g.name, icon: g.icon, terms: nodes.filter((n) => n.kind === "term" && n.glossary === g.id).map((n) => n.id) }))
    .filter((g) => g.terms.length);
  return { nodes, edges: out, groups, stats: { terms: scoped.length, relations: rel.length, isolated: isolatedTerms.length, matches: nodes.filter((n) => n.hit).length } };
}

// ═══ SKOS ═══
// A glossary is a skos:ConceptScheme and each term a skos:Concept. Parent →
// skos:broader; related → skos:related; synonyms and abbreviation →
// skos:altLabel; other typed relationships use EDG properties so nothing is lost.
export const GL_NS = (g) => `https://glossary.jnj.com/${propSlug(g.name) || g.id}#`;
const T = (s, p, o) => ({ s, p, o });
const id = (x) => ({ id: x });
const lit = (v, dt) => ({ lit: String(v), ...(dt ? { dt } : {}) });
export function skosTriples(glossary, terms, crels = [], REL_TYPES = {}) {
  const ns = GL_NS(glossary), scheme = ns.replace(/#$/, "");
  const mine = terms.filter((t) => t.glossary === glossary.id);
  const iri = (t) => ns + slug(t.term);
  const byId = new Map(terms.map((t) => [t.id, t]));
  const L = [T(scheme, X("rdf:type"), id(X("skos:ConceptScheme"))), T(scheme, X("skos:prefLabel"), lit(glossary.name))];
  if (glossary.desc) L.push(T(scheme, X("skos:definition"), lit(glossary.desc)));
  mine.forEach((t) => {
    const s = iri(t);
    L.push(T(s, X("rdf:type"), id(X("skos:Concept"))), T(s, X("skos:prefLabel"), lit(t.term)), T(s, X("skos:inScheme"), id(scheme)));
    if (t.definition) L.push(T(s, X("skos:definition"), lit(t.definition)));
    [...new Set([...(t.synonyms || []), ...(t.abbr && t.abbr !== "—" ? [t.abbr] : [])])].forEach((a) => L.push(T(s, X("skos:altLabel"), lit(a))));
    if (t.broader && byId.get(t.broader)) L.push(T(s, X("skos:broader"), id(GL_NS(glossary) + slug(byId.get(t.broader).term))));
    else L.push(T(s, X("skos:topConceptOf"), id(scheme)));
    (t.relatedTerms || []).forEach((r) => byId.get(r) && L.push(T(s, X("skos:related"), id(ns + slug(byId.get(r).term)))));
    if (t.owner) L.push(T(s, X("dcterms:creator"), lit(t.owner)));
    if ((t.status || t.cert) === "Deprecated") L.push(T(s, X("owl:deprecated"), lit("true", X("xsd:boolean"))));
  });
  crels.filter(LIVE).forEach((r) => {
    const a = byId.get(r.from), b = byId.get(r.to);
    if (!a || !b || a.glossary !== glossary.id) return;
    const p = r.type === "is_a" ? X("skos:broader") : r.type === "related_to" ? X("skos:related") : `${NS.edg}${r.type}`;
    L.push(T(ns + slug(a.term), p, id(ns + slug(b.term))));
  });
  // De-duplicate identical statements (a parent stated twice).
  const seen = new Set();
  return L.filter((t) => { const k = `${t.s}|${t.p}|${t.o.id || t.o.lit}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
export function exportSkos(glossary, terms, crels, REL_TYPES, format = "rdfxml") {
  const tr = skosTriples(glossary, terms, crels, REL_TYPES);
  const pf = { gl: GL_NS(glossary) };
  return format === "turtle" ? writeTurtle(tr, pf) : toRdfXml(tr, pf);
}
