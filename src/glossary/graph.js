// ─────────────────────────────────────────────────────────────────────────────
// Business glossary: term relationships, the glossary graph and SKOS export.
//
// A glossary holds vocabulary — words, meanings and how words relate. Business
// structure (Customer is placed by Order, Customer is a kind of Party) lives in
// the ontology, which links back to the term. So a term has only vocabulary
// relationships:
//   Parent term (broader) · Related to · Same meaning as · Close in meaning to ·
//   Calculated from (metrics) · Replaced by
// Parent term is the term's `broader` field; the rest are `relations` entries
// {id, type, to, note, status}. Pure functions; the screens pass the terms.
// ─────────────────────────────────────────────────────────────────────────────
import { NS, X, writeTurtle, toRdfXml } from "../ontology/metadata.js";
import { slug, propSlug } from "../ontology/engine.js";

export const GL_REL = {
  broader:        { l: "Parent term",          inv: "Child term",           skos: "skos:broader" },
  related:        { l: "Related to",           inv: "Related to",           skos: "skos:related", symmetric: true },
  sameAs:         { l: "Same meaning as",      inv: "Same meaning as",      skos: "skos:exactMatch", symmetric: true },
  closeMatch:     { l: "Close in meaning to",  inv: "Close in meaning to",  skos: "skos:closeMatch", symmetric: true },
  calculatedFrom: { l: "Calculated from",      inv: "Used to calculate",    skos: "edg:calculatedFrom", fromTypes: ["Metric"] },
  replacedBy:     { l: "Replaced by",          inv: "Replaces",             skos: "dcterms:isReplacedBy" },
};
export const HIERARCHY_TYPES = ["broader"];
const LIVE = (r) => r.status !== "rejected" && r.status !== "removed";

// Every relationship of one term, both directions, in words.
export function relationsOf(term, terms) {
  const out = [];
  const byId = new Map(terms.map((t) => [t.id, t]));
  if (term.broader && byId.get(term.broader)) out.push({ key: `p:${term.id}`, type: "broader", dir: "out", other: byId.get(term.broader), label: GL_REL.broader.l, own: true, status: "approved" });
  (term.relations || []).filter(LIVE).forEach((r) => byId.get(r.to) && out.push({ key: r.id, rel: r, type: r.type, dir: "out", other: byId.get(r.to), label: (GL_REL[r.type] || { l: r.type }).l, note: r.note, own: true, status: r.status || "approved" }));
  terms.forEach((t) => {
    if (t.id === term.id) return;
    if (t.broader === term.id) out.push({ key: `c:${t.id}`, type: "broader", dir: "in", other: t, label: GL_REL.broader.inv, own: false, status: "approved" });
    (t.relations || []).filter(LIVE).filter((r) => r.to === term.id).forEach((r) => {
      const def = GL_REL[r.type] || { inv: r.type };
      // A symmetric relationship stated from the other side shows once.
      if (def.symmetric && (term.relations || []).some((x) => LIVE(x) && x.type === r.type && x.to === t.id)) return;
      out.push({ key: `in:${r.id}`, rel: r, type: r.type, dir: "in", other: t, label: def.inv, note: r.note, own: false, status: r.status || "approved" });
    });
  });
  return out;
}

// Checks before adding a relationship.
export function checkRelation(term, terms, { type, to }) {
  if (!GL_REL[type]) return "Choose a relationship";
  if (!to) return "Choose a term";
  if (to === term.id) return "A term cannot relate to itself";
  const def = GL_REL[type];
  if (def.fromTypes && !def.fromTypes.includes(term.termType || "Term")) return `${def.l} is for ${def.fromTypes.join(", ").toLowerCase()} terms`;
  if (type === "broader") {
    const byId = new Map(terms.map((t) => [t.id, t]));
    let at = to, guard = 0;
    while (at && guard++ < 100) { if (at === term.id) return "That would make the term its own parent"; at = (byId.get(at) || {}).broader; }
    return null;
  }
  if ((term.relations || []).some((r) => LIVE(r) && r.type === type && r.to === to)) return "This relationship already exists";
  const other = terms.find((t) => t.id === to);
  if (def.symmetric && other && (other.relations || []).some((r) => LIVE(r) && r.type === type && r.to === term.id)) return "This relationship already exists";
  return null;
}

export function relationTypes(terms) {
  const used = new Set(["broader", "related"]);
  terms.forEach((t) => (t.relations || []).filter(LIVE).forEach((r) => used.add(r.type)));
  return Object.keys(GL_REL).filter((k) => used.has(k)).map((k) => ({ k, l: GL_REL[k].l }));
}

export function glossaryGraph({ glossaries, terms }, { mode = "overview", glossaryIds = null, types = null, isolated = true, withData = false, q = "" } = {}) {
  const scoped = terms.filter((t) => !glossaryIds || glossaryIds.includes(t.glossary));
  const ids = new Set(scoped.map((t) => t.id));
  const edges = [], seen = new Set();
  const add = (from, to, type, extra) => {
    if (!ids.has(from) || !ids.has(to) || from === to) return;
    const k = [from, to, type].join("|"), k2 = [to, from, type].join("|");
    if (seen.has(k) || ((GL_REL[type] || {}).symmetric && seen.has(k2))) return;
    seen.add(k); edges.push({ id: `e${edges.length + 1}`, from, to, type, label: (GL_REL[type] || { l: type }).l, ...(extra || {}) });
  };
  scoped.forEach((t) => {
    if (t.broader) add(t.id, t.broader, "broader");
    (t.relations || []).filter(LIVE).forEach((r) => add(t.id, r.to, r.type, { status: r.status || "approved" }));
  });
  let rel = edges;
  if (mode === "hierarchy") rel = rel.filter((e) => HIERARCHY_TYPES.includes(e.type));
  if (types) rel = rel.filter((e) => types.includes(e.type));
  const touched = new Set(rel.flatMap((e) => [e.from, e.to]));
  const isolatedTerms = scoped.filter((t) => !touched.has(t.id));
  const shownTerms = isolated ? scoped : scoped.filter((t) => touched.has(t.id));
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
export const GL_NS = (g) => `https://glossary.jnj.com/${propSlug(g.name) || g.id}#`;
const T = (s, p, o) => ({ s, p, o });
const id = (x) => ({ id: x });
const lit = (v, dt) => ({ lit: String(v), ...(dt ? { dt } : {}) });
export function skosTriples(glossary, terms, glossaries = []) {
  const ns = GL_NS(glossary), scheme = ns.replace(/#$/, "");
  const mine = terms.filter((t) => t.glossary === glossary.id);
  const byId = new Map(terms.map((t) => [t.id, t]));
  const gOf = (t) => glossaries.find((g) => g.id === t.glossary) || glossary;
  const iri = (t) => GL_NS(gOf(t)) + slug(t.term);
  const L = [T(scheme, X("rdf:type"), id(X("skos:ConceptScheme"))), T(scheme, X("skos:prefLabel"), lit(glossary.name))];
  if (glossary.desc) L.push(T(scheme, X("skos:definition"), lit(glossary.desc)));
  mine.forEach((t) => {
    const s = iri(t);
    L.push(T(s, X("rdf:type"), id(X("skos:Concept"))), T(s, X("skos:prefLabel"), lit(t.term)), T(s, X("skos:inScheme"), id(scheme)));
    if (t.definition) L.push(T(s, X("skos:definition"), lit(t.definition)));
    [...new Set([...(t.synonyms || []), ...(t.abbr && t.abbr !== "—" ? [t.abbr] : [])])].forEach((a) => L.push(T(s, X("skos:altLabel"), lit(a))));
    if (t.broader && byId.get(t.broader)) L.push(T(s, X("skos:broader"), id(iri(byId.get(t.broader)))));
    else L.push(T(s, X("skos:topConceptOf"), id(scheme)));
    (t.relations || []).filter((r) => LIVE(r) && (r.status || "approved") === "approved").forEach((r) => {
      const o = byId.get(r.to); if (!o || !GL_REL[r.type]) return;
      L.push(T(s, X(GL_REL[r.type].skos), id(iri(o))));
    });
    if (t.owner) L.push(T(s, X("dcterms:creator"), lit(t.owner)));
    if ((t.status || t.cert) === "Deprecated") L.push(T(s, X("owl:deprecated"), lit("true", X("xsd:boolean"))));
  });
  return L;
}
export function exportSkos(glossary, terms, glossaries = [], format = "rdfxml") {
  const tr = skosTriples(glossary, terms, glossaries);
  const pf = { gl: GL_NS(glossary) };
  return format === "turtle" ? writeTurtle(tr, pf) : toRdfXml(tr, pf);
}

// Older data: untyped related terms, and typed links that were vocabulary
// (related to, calculated from), become relationships. Business links between
// concepts (placed by, paid by, part of …) are the ontology's, not the glossary's.
export function legacyRelations(term, crels = []) {
  if (term.relations) return term.relations;
  const out = [];
  (term.relatedTerms || []).forEach((to) => out.push({ id: `rl_${term.id}_${to}`, type: "related", to, note: "", status: "approved" }));
  crels.filter((r) => LIVE(r) && r.from === term.id).forEach((r) => {
    if (r.type === "related_to" && !out.some((x) => x.type === "related" && x.to === r.to)) out.push({ id: `rl_${r.id}`, type: "related", to: r.to, note: r.note || "", status: r.status === "proposed" ? "proposed" : "approved" });
    if (r.type === "calculated_from") out.push({ id: `rl_${r.id}`, type: "calculatedFrom", to: r.to, note: r.note || "", status: r.status === "proposed" ? "proposed" : "approved" });
  });
  return out;
}
