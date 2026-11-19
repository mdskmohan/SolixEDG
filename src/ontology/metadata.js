// ─────────────────────────────────────────────────────────────────────────────
// Ontology Manager at the metadata level. Data stays in the source; EDG holds
// meaning (OWL), rules (SHACL) and the links from meaning to catalog fields.
//
//   ontology.ttl  — OWL/RDF definitions with stable IRIs
//   shapes.ttl    — SHACL shapes the steward authors (business rules)
//   mappings.ttl  — EDG bindings from classes, properties and relationships to
//                   catalog assets and fields (edg: vocabulary, RDF)
//   report.ttl    — SHACL validation report of the mapping shapes over the
//                   metadata graph (ontology + catalog + bindings)
//
// Pure functions. Triples use full IRIs: {s, p, o} where o is {id} or
// {lit, dt}. The screens pass a ctx that reads the catalog.
// ─────────────────────────────────────────────────────────────────────────────
import { slug, propSlug, parseTurtle, hash, snapshot } from "./engine.js";

export const NS = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#", rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#", xsd: "http://www.w3.org/2001/XMLSchema#", sh: "http://www.w3.org/ns/shacl#",
  skos: "http://www.w3.org/2004/02/skos/core#", dash: "http://datashapes.org/dash#", dcterms: "http://purl.org/dc/terms/",
  edg: "https://edg.solix.com/def#", cat: "https://edg.solix.com/catalog/",
};
const RDF_TYPE = NS.rdf + "type";
export const X = (c) => { const m = /^([a-z]+):(.*)$/.exec(c); return m && NS[m[1]] != null ? NS[m[1]] + m[2] : c; };
export const curie = (iri, extra = {}) => {
  const all = { ...extra, ...NS };
  for (const [k, v] of Object.entries(all)) if (v && String(iri).startsWith(v) && /^[A-Za-z0-9_.-]*$/.test(String(iri).slice(v.length))) return `${k}:${String(iri).slice(v.length)}`;
  return `<${iri}>`;
};
export const XSD = { string: "xsd:string", integer: "xsd:integer", long: "xsd:long", decimal: "xsd:decimal", double: "xsd:double", float: "xsd:float",
  boolean: "xsd:boolean", date: "xsd:date", dateTime: "xsd:dateTime", time: "xsd:time", duration: "xsd:duration", anyURI: "xsd:anyURI", langString: "rdf:langString" };

// ═══ Stable identifiers ═══
// Assigned once, from the name at creation; renaming never changes them.
export function ensureIris(ont) {
  const ns = ont.namespace;
  if (!ns) return ont;   // a draft with no namespace yet gets its IRIs on save
  const used = new Set();
  [...(ont.classes || []), ...(ont.rels || []), ...(ont.individuals || [])].forEach((x) => x.iri && used.add(x.iri));
  (ont.classes || []).forEach((c) => (c.props || []).forEach((p) => p.iri && used.add(p.iri)));
  const take = (base, alt) => { let iri = ns + base; if (used.has(iri)) iri = ns + alt; let n = 2; const b = iri; while (used.has(iri)) iri = b + n++; used.add(iri); return iri; };
  const nameOf = (id) => ((ont.classes || []).find((c) => c.id === id) || {}).name || "";
  const classes = (ont.classes || []).map((c) => ({ ...c, iri: c.iri || take(slug(c.name), slug(c.name) + "Class") }));
  const withProps = classes.map((c) => ({ ...c, props: (c.props || []).map((p) => ({ ...p, iri: p.iri || take(propSlug(p.name), propSlug(`${c.name} ${p.name}`)) })) }));
  const rels = (ont.rels || []).map((r) => ({ ...r, iri: r.iri || take(propSlug(r.name), propSlug(`${r.name} ${nameOf(r.to)}`)),
    inverseIri: r.inverse ? (r.inverseIri || take(propSlug(r.inverse), propSlug(`${r.inverse} ${nameOf(r.from)}`))) : null }));
  const individuals = (ont.individuals || []).map((x) => ({ ...x, iri: x.iri || take(slug(x.name), slug(`${nameOf(x.classId)} ${x.name}`)) }));
  return { ...ont, classes: withProps, rels, ...(ont.individuals ? { individuals } : {}) };
}

// ═══ Catalog references ═══
export const assetIri = (assetId) => `${NS.cat}asset/${encodeURIComponent(assetId)}`;
export const fieldIri = (assetId, column) => `${NS.cat}asset/${encodeURIComponent(assetId)}/field/${encodeURIComponent(column)}`;
export const fieldLabel = (table, column) => `${table}.${column}`;

// The bindings an ontology holds, read from its mappings:
//   class        ← dataset/table  (source asset + key fields)
//   property     ← field          (one column)
//   relationship ← relfield       (one column of the subject's asset)
export function bindings(ont, ctx) {
  const maps = ont.mappings || [];
  const out = [];
  maps.forEach((m) => {
    if (m.kind === "dataset" || m.kind === "table") {
      const table = ctx.tableOf(m); const a = table ? ctx.assetOf(table) : null;
      out.push({ id: m.id, kind: "class", classId: m.classId, table, assetId: a ? a.id : null, keys: (m.target.keys || []) });
    } else if (m.kind === "field") {
      const a = ctx.assetOf(m.target.table);
      out.push({ id: m.id, kind: "property", classId: m.classId, propId: m.propId, table: m.target.table, assetId: a ? a.id : null, column: m.target.column || null });
    } else if (m.kind === "relfield") {
      const a = m.target.table ? ctx.assetOf(m.target.table) : null;
      out.push({ id: m.id, kind: "relationship", classId: m.classId, relId: m.relId, table: m.target.table || null, assetId: a ? a.id : null, column: m.target.column || null });
    }
  });
  return out;
}

// ═══ Triples ═══
const T = (s, p, o) => ({ s, p, o });
const id = (x) => ({ id: x });
const lit = (v, dt) => ({ lit: String(v), ...(dt ? { dt } : {}) });

export function owlTriples(ont) {
  const o = ensureIris(ont), ns = o.namespace, oi = ns.replace(/[#/]$/, "");
  let bn = 0; const B = () => `_:o${++bn}`;
  const L = [T(oi, RDF_TYPE, id(X("owl:Ontology"))), T(oi, X("rdfs:label"), lit(o.name))];
  if (o.desc) L.push(T(oi, X("rdfs:comment"), lit(o.desc)));
  // Ontology header: version, imports, provenance, licence, deprecation.
  if (o.publishedN) {
    L.push(T(oi, X("owl:versionInfo"), lit(String(o.publishedN))), T(oi, X("owl:versionIRI"), id(`${oi}/v${o.publishedN}`)));
    if (o.publishedN > 1) L.push(T(oi, X("owl:priorVersion"), id(`${oi}/v${o.publishedN - 1}`)));
  }
  (o.imports || []).forEach((iri) => L.push(T(oi, X("owl:imports"), id(iri))));
  (o.owners || (o.owner ? [o.owner] : [])).forEach((u) => L.push(T(oi, X("dcterms:creator"), lit(u))));
  (o.stewards || (o.steward ? [o.steward] : [])).forEach((u) => L.push(T(oi, X("dcterms:contributor"), lit(u))));
  if (o.created) L.push(T(oi, X("dcterms:created"), lit(o.created, X("xsd:date"))));
  if (o.license) L.push(T(oi, X("dcterms:license"), /^https?:/.test(o.license) ? id(o.license) : lit(o.license)));
  if (o.deprecated) L.push(T(oi, X("owl:deprecated"), lit("true", X("xsd:boolean"))));
  const C = (cid) => ((o.classes || []).find((c) => c.id === cid) || {}).iri;
  const P = (pid) => { for (const c of o.classes || []) { const p = (c.props || []).find((x) => x.id === pid); if (p) return p; } return null; };
  const R = (rid) => (o.rels || []).find((r) => r.id === rid);
  const I = (iid) => (o.individuals || []).find((x) => x.id === iid);
  const dep = (s, x) => { if (x.deprecated) L.push(T(s, X("owl:deprecated"), lit("true", X("xsd:boolean")))); };
  const CARD = { min: ["owl:minCardinality", "owl:minQualifiedCardinality"], max: ["owl:maxCardinality", "owl:maxQualifiedCardinality"], exact: ["owl:cardinality", "owl:qualifiedCardinality"] };
  const restrict = (cls, prop, kind, target, n, isRel) => {
    const b = B();
    L.push(T(cls, X("rdfs:subClassOf"), id(b)), T(b, RDF_TYPE, id(X("owl:Restriction"))), T(b, X("owl:onProperty"), id(prop)));
    if (kind === "some") L.push(T(b, X("owl:someValuesFrom"), id(target)));
    else if (kind === "all") L.push(T(b, X("owl:allValuesFrom"), id(target)));
    else if (kind === "value") L.push(T(b, X("owl:hasValue"), target && /^https?:/.test(target) ? id(target) : lit(target)));
    else if (isRel && target) L.push(T(b, X(CARD[kind][1]), lit(n, X("xsd:nonNegativeInteger"))), T(b, X("owl:onClass"), id(target)));
    else L.push(T(b, X(CARD[kind][0]), lit(n, X("xsd:nonNegativeInteger"))));
  };
  (o.classes || []).forEach((c) => {
    L.push(T(c.iri, RDF_TYPE, id(X("owl:Class"))), T(c.iri, X("rdfs:label"), lit(c.name)));
    if (c.desc) L.push(T(c.iri, X("rdfs:comment"), lit(c.desc)));
    [...new Set([c.parent, ...(c.parents || [])].filter(Boolean))].forEach((pid) => { if (C(pid)) L.push(T(c.iri, X("rdfs:subClassOf"), id(C(pid)))); });
    (c.synonyms || []).forEach((s) => L.push(T(c.iri, X("skos:altLabel"), lit(s))));
    (c.sameAs || []).forEach((s) => L.push(T(c.iri, X("owl:equivalentClass"), id(s.iri))));
    (c.disjoint || []).forEach((d) => { if (C(d)) L.push(T(c.iri, X("owl:disjointWith"), id(C(d)))); });
    const keys = (c.keyProps || []).map((k) => (P(k) || R(k) || {}).iri).filter(Boolean);
    if (keys.length) L.push(T(c.iri, X("owl:hasKey"), { list: keys.map((k) => id(k)) }));
    dep(c.iri, c);
    (c.props || []).forEach((p) => {
      L.push(T(p.iri, RDF_TYPE, id(X("owl:DatatypeProperty"))), T(p.iri, X("rdfs:label"), lit(p.name)),
        T(p.iri, X("rdfs:domain"), id(c.iri)), T(p.iri, X("rdfs:range"), id(X(XSD[p.datatype] || "xsd:string"))));
      if (p.desc) L.push(T(p.iri, X("rdfs:comment"), lit(p.desc)));
      if (p.functional) L.push(T(p.iri, RDF_TYPE, id(X("owl:FunctionalProperty"))));
      if (p.parentProp && P(p.parentProp)) L.push(T(p.iri, X("rdfs:subPropertyOf"), id(P(p.parentProp).iri)));
      dep(p.iri, p);
      if (p.required) restrict(c.iri, p.iri, "min", null, 1, false);
    });
    (c.restrictions || []).forEach((x) => {
      const pr = R(x.prop) || P(x.prop); if (!pr) return;
      const isRel = !!R(x.prop);
      let target = null;
      if (x.kind === "some" || x.kind === "all") target = isRel ? C(x.target) : X(XSD[x.target] || "xsd:string");
      else if (x.kind === "value") target = (I(x.target) || {}).iri || x.target;
      else if (isRel && x.target) target = C(x.target);
      if ((x.kind === "some" || x.kind === "all" || x.kind === "value") && !target) return;
      restrict(c.iri, pr.iri, x.kind, target, x.n != null ? x.n : 1, isRel);
    });
  });
  const CHAR = { transitive: "owl:TransitiveProperty", symmetric: "owl:SymmetricProperty", asymmetric: "owl:AsymmetricProperty",
    reflexive: "owl:ReflexiveProperty", irreflexive: "owl:IrreflexiveProperty", inverseFunctional: "owl:InverseFunctionalProperty" };
  (o.rels || []).forEach((r) => {
    if (!C(r.from) || !C(r.to)) return;
    L.push(T(r.iri, RDF_TYPE, id(X("owl:ObjectProperty"))), T(r.iri, X("rdfs:label"), lit(r.name)),
      T(r.iri, X("rdfs:domain"), id(C(r.from))), T(r.iri, X("rdfs:range"), id(C(r.to))));
    if (r.desc) L.push(T(r.iri, X("rdfs:comment"), lit(r.desc)));
    (r.synonyms || []).forEach((s) => L.push(T(r.iri, X("skos:altLabel"), lit(s))));
    const types = new Set();
    if (r.cardinality === "many_to_one" || r.cardinality === "one_to_one") types.add("owl:FunctionalProperty");
    if (r.cardinality === "one_to_one" || r.cardinality === "one_to_many") types.add("owl:InverseFunctionalProperty");
    (r.characteristics || []).forEach((k) => { if (CHAR[k]) types.add(CHAR[k]); });
    types.forEach((t) => L.push(T(r.iri, RDF_TYPE, id(X(t)))));
    if (r.parentRel && R(r.parentRel)) L.push(T(r.iri, X("rdfs:subPropertyOf"), id(R(r.parentRel).iri)));
    if ((r.chain || []).length === 2 && r.chain.every((x) => R(x))) L.push(T(r.iri, X("owl:propertyChainAxiom"), { list: r.chain.map((x) => id(R(x).iri)) }));
    dep(r.iri, r);
    if (r.required) restrict(C(r.from), r.iri, "min", C(r.to), 1, true);
    if (r.inverseIri) {
      L.push(T(r.inverseIri, RDF_TYPE, id(X("owl:ObjectProperty"))), T(r.inverseIri, X("rdfs:label"), lit(r.inverse)),
        T(r.inverseIri, X("owl:inverseOf"), id(r.iri)), T(r.inverseIri, X("rdfs:domain"), id(C(r.to))), T(r.inverseIri, X("rdfs:range"), id(C(r.from))));
    }
  });
  (o.individuals || []).forEach((x) => {
    L.push(T(x.iri, RDF_TYPE, id(X("owl:NamedIndividual"))), T(x.iri, X("rdfs:label"), lit(x.name)));
    if (C(x.classId)) L.push(T(x.iri, RDF_TYPE, id(C(x.classId))));
    if (x.desc) L.push(T(x.iri, X("rdfs:comment"), lit(x.desc)));
    dep(x.iri, x);
  });
  return L;
}

// ═══ OWL as RDF/XML ═══
// The format Protégé and most OWL tools open by default. Blank nodes are written
// with rdf:nodeID; lists are written as rdf:first / rdf:rest chains.
export function toRdfXml(triples, prefixes = {}) {
  const out = []; let ln = 0;
  triples.forEach((t) => {
    if (!t.o.list) { out.push(t); return; }
    const items = t.o.list; if (!items.length) { out.push({ s: t.s, p: t.p, o: { id: NS.rdf + "nil" } }); return; }
    const nodes = items.map(() => `_:l${++ln}`);
    out.push({ s: t.s, p: t.p, o: { id: nodes[0] } });
    items.forEach((it, i) => { out.push({ s: nodes[i], p: NS.rdf + "first", o: it }, { s: nodes[i], p: NS.rdf + "rest", o: { id: nodes[i + 1] || NS.rdf + "nil" } }); });
  });
  const P = { ...NS, ...prefixes }, used = new Set(["rdf"]);
  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const qn = (iri) => { for (const [k, v] of Object.entries(P)) if (iri.startsWith(v) && /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(iri.slice(v.length))) { used.add(k); return `${k}:${iri.slice(v.length)}`; } return null; };
  const ref = (x) => (String(x).startsWith("_:") ? `rdf:nodeID="${esc(String(x).slice(2))}"` : `rdf:resource="${esc(x)}"`);
  const order = [], by = new Map();
  out.forEach((t) => { if (!by.has(t.s)) { by.set(t.s, []); order.push(t.s); } by.get(t.s).push(t); });
  const body = order.map((s) => {
    const head = String(s).startsWith("_:") ? `<rdf:Description rdf:nodeID="${esc(String(s).slice(2))}">` : `<rdf:Description rdf:about="${esc(s)}">`;
    const lines = by.get(s).map((t) => {
      const q = qn(t.p) || "rdf:value";
      if (t.o.id != null) return `    <${q} ${ref(t.o.id)}/>`;
      return `    <${q}${t.o.dt ? ` rdf:datatype="${esc(t.o.dt)}"` : ""}>${esc(t.o.lit)}</${q}>`;
    });
    return `  ${head}\n${lines.join("\n")}\n  </rdf:Description>`;
  }).join("\n");
  const xmlns = Object.entries(P).filter(([k]) => used.has(k)).map(([k, v]) => `\n    xmlns:${k}="${esc(v)}"`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rdf:RDF${xmlns}>\n${body}\n</rdf:RDF>\n`;
}

// ═══ Apache Ossie (ontology spec 0.3.0.dev0) ═══
// Classes → EntityType concepts; data properties → relationships to built-in
// value types; object properties → relationships with roles and multiplicity;
// keys → identify_by; parents → extends. Catalog bindings travel in a separate
// mapping document (concept_mappings), as the spec defines.
export const OSSIE_ONTOLOGY_VERSION = "0.3.0.dev0";
const OSSIE_VT = { string: "String", integer: "Integer", long: "Integer", decimal: "Decimal", double: "Float", float: "Float", boolean: "Boolean",
  date: "Date", dateTime: "DateTime", time: "String", duration: "String", anyURI: "String", langString: "String" };
const yq = (v) => (/^[A-Za-z_][A-Za-z0-9_ .\-/]*$/.test(String(v)) && !/^(true|false|null|yes|no)$/i.test(String(v)) && !/:\s/.test(String(v)) ? String(v) : JSON.stringify(String(v)));
export function toYaml(v, ind = 0) {
  const pad = " ".repeat(ind);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return v.map((x) => {
      if (x && typeof x === "object" && !Array.isArray(x)) { const inner = toYaml(x, ind + 2).replace(/^\s+/, ""); return `${pad}- ${inner}`; }
      return `${pad}- ${yq(x)}`;
    }).join("\n");
  }
  if (v && typeof v === "object") {
    return Object.entries(v).filter(([, x]) => x != null && !(Array.isArray(x) && !x.length)).map(([k, x]) => {
      if (x && typeof x === "object") return `${pad}${k}:\n${toYaml(x, ind + 2)}`;
      return `${pad}${k}: ${yq(x)}`;
    }).join("\n");
  }
  return `${pad}${yq(v)}`;
}
const ossieName = (s) => slug(s) || "Concept";
export function toOssie(ont, ctx) {
  const o = ensureIris(ont), pf = o.prefix || "ex";
  const cname = (cid) => ossieName(((o.classes || []).find((c) => c.id === cid) || {}).name);
  const q = (iri) => (iri && iri.startsWith(o.namespace) ? `${pf}:${iri.slice(o.namespace.length)}` : iri);
  const concepts = (o.classes || []).map((c) => {
    const cn = ossieName(c.name);
    const dataRels = (c.props || []).map((p) => ({ name: propSlug(p.name), description: p.desc || undefined,
      multiplicity: p.functional || (c.keyProps || []).includes(p.id) ? "ManyToOne" : undefined,
      roles: [{ concept: OSSIE_VT[p.datatype] || "String" }], verbalizes: [`{${cn}} has ${p.name} {${OSSIE_VT[p.datatype] || "String"}}`], iri: q(p.iri) }));
    const objRels = (o.rels || []).filter((r) => r.from === c.id).map((r) => {
      const tn = cname(r.to), self = tn === cn;
      return { name: propSlug(r.name), description: r.desc || undefined,
        multiplicity: r.cardinality === "many_to_one" ? "ManyToOne" : r.cardinality === "one_to_one" ? "OneToOne" : undefined,
        roles: [self ? { concept: tn, name: "other" } : { concept: tn }],
        verbalizes: [`{${cn}} ${r.name} {${self ? `${tn}:other` : tn}}`], iri: q(r.iri) };
    });
    const keys = (c.keyProps || []).map((k) => { const p = (c.props || []).find((x) => x.id === k); return p ? propSlug(p.name) : null; }).filter(Boolean);
    return { concept: cn, type: "EntityType", description: c.desc || undefined,
      extends: [...new Set([c.parent, ...(c.parents || [])].filter(Boolean))].map(cname),
      identify_by: keys.length ? keys : undefined, iri: q(c.iri), relationships: [...dataRels, ...objRels] };
  });
  const doc = { name: ossieName(o.name), description: o.desc || undefined, prefixes: { [pf]: o.namespace }, ontology: concepts };
  // Mapping document: each bound class to its key expression; properties and
  // relationships as link mappings to DATASET.FIELD expressions.
  const bs = bindings(o, ctx);
  const cm = (o.classes || []).map((c) => {
    const cb = bs.find((b) => b.kind === "class" && b.classId === c.id && b.table); if (!cb) return null;
    const keyExpr = `${cb.table}.${(cb.keys || [])[0] || "ID"}`;
    const children = [
      ...bs.filter((b) => b.kind === "property" && b.classId === c.id && b.column).map((b) => {
        const p = (c.props || []).find((x) => x.id === b.propId); return p ? { relationship: propSlug(p.name), object_mapping: { expression: `${b.table}.${b.column}` } } : null; }),
      ...bs.filter((b) => b.kind === "relationship" && b.classId === c.id && b.column).map((b) => {
        const r = (o.rels || []).find((x) => x.id === b.relId); return r ? { relationship: propSlug(r.name), object_mapping: { concept: cname(r.to), expression: `${b.table}.${b.column}` } } : null; }),
    ].filter(Boolean);
    return { concept: ossieName(c.name), link_mappings: [{ object_mapping: { expression: keyExpr }, children: children.length ? children : undefined }] };
  }).filter(Boolean);
  const mapping = { version: OSSIE_ONTOLOGY_VERSION, name: `${ossieName(o.name)}Mapping`, description: `Catalog bindings of ${o.name}`,
    ontology_ref: { name: ossieName(o.name) }, semantic_model_ref: { name: `${ossieName(o.name)}Catalog` }, concept_mappings: cm };
  const clean = (x) => JSON.parse(JSON.stringify(x));
  return { ontology: `# Apache Ossie ontology · spec ${OSSIE_ONTOLOGY_VERSION}\n${toYaml(clean(doc))}\n`, mapping: `# Apache Ossie mapping · spec ${OSSIE_ONTOLOGY_VERSION}\n${toYaml(clean(mapping))}\n` };
}

// Catalog facts for the assets and fields the bindings reference: present
// fields are typed edg:CatalogField; a missing field has no type, so sh:class
// catches it.
export function catalogTriples(ont, ctx) {
  const L = [], seen = new Set();
  bindings(ont, ctx).forEach((b) => {
    if (!b.assetId || seen.has(b.assetId)) return; seen.add(b.assetId);
    const ai = assetIri(b.assetId);
    L.push(T(ai, RDF_TYPE, id(X("edg:CatalogAsset"))), T(ai, X("rdfs:label"), lit(b.table)));
    (ctx.columnsOf(b.table) || []).forEach((c) => {
      const fi = fieldIri(b.assetId, c.name);
      L.push(T(fi, RDF_TYPE, id(X("edg:CatalogField"))), T(fi, X("rdfs:label"), lit(fieldLabel(b.table, c.name))), T(fi, X("edg:fieldOf"), id(ai)));
    });
  });
  return L;
}

export function mappingTriples(ont, ctx) {
  const o = ensureIris(ont), L = [];
  const base = `https://edg.solix.com/mapping/${o.id}/`;
  const cls = (cid) => (o.classes || []).find((c) => c.id === cid);
  // Each relationship the steward defines (not its inverse) is registered so the
  // coverage shape can require a binding for it.
  (o.rels || []).forEach((r) => r.iri && L.push(T(r.iri, RDF_TYPE, id(X("edg:Relationship")))));
  bindings(o, ctx).forEach((b) => {
    const bi = base + encodeURIComponent(b.id);
    if (b.kind === "class") {
      L.push(T(bi, RDF_TYPE, id(X("edg:ClassBinding"))));
      if (cls(b.classId)) L.push(T(bi, X("edg:boundClass"), id(cls(b.classId).iri)));
      if (b.assetId) L.push(T(bi, X("edg:sourceAsset"), id(assetIri(b.assetId))));
      b.keys.forEach((k) => b.assetId && L.push(T(bi, X("edg:keyField"), id(fieldIri(b.assetId, k)))));
    } else if (b.kind === "property") {
      const p = ((cls(b.classId) || {}).props || []).find((x) => x.id === b.propId);
      L.push(T(bi, RDF_TYPE, id(X("edg:PropertyBinding"))));
      if (p) L.push(T(bi, X("edg:boundProperty"), id(p.iri)));
      if (b.assetId) L.push(T(bi, X("edg:sourceAsset"), id(assetIri(b.assetId))));
      if (b.assetId && b.column) L.push(T(bi, X("edg:sourceField"), id(fieldIri(b.assetId, b.column))));
    } else {
      const r = (o.rels || []).find((x) => x.id === b.relId);
      L.push(T(bi, RDF_TYPE, id(X("edg:RelationshipBinding"))));
      if (r) L.push(T(bi, X("edg:boundRelationship"), id(r.iri)));
      if (b.assetId) L.push(T(bi, X("edg:sourceAsset"), id(assetIri(b.assetId))));
      if (b.assetId && b.column) L.push(T(bi, X("edg:sourceField"), id(fieldIri(b.assetId, b.column))));
    }
  });
  return L;
}

export const metadataTriples = (ont, ctx) => [...owlTriples(ont), ...catalogTriples(ont, ctx), ...mappingTriples(ont, ctx)];

// ═══ SHACL shapes (structured) ═══
// shape = {id, targetClass, severity?, props:[{path | inversePath, minCount, maxCount,
//          class, datatype, pattern, in, minInclusive, maxInclusive, unique, severity, message, name}]}
// Business shapes come from the ontology (classes, properties, relationships and
// the steward's constraints). They describe the source data and are exported;
// EDG does not read the data, so it does not run them.
export function businessShapes(ont) {
  const o = ensureIris(ont), ns = o.namespace, out = [];
  const C = (cid) => (o.classes || []).find((c) => c.id === cid);
  (o.classes || []).forEach((c) => {
    const ks = (o.constraints || []).filter((k) => k.classId === c.id);
    const sev = (k) => (k.severity === "warning" ? "Warning" : "Violation");
    const props = [];
    (c.props || []).forEach((p) => {
      const ps = { path: p.iri, name: p.name, datatype: X(XSD[p.datatype] || "xsd:string") };
      if (p.required) ps.minCount = 1;
      ks.filter((k) => k.prop === p.name).forEach((k) => {
        if (k.kind === "required") ps.minCount = 1;
        if (k.kind === "unique") ps.unique = true;
        if (k.kind === "pattern") ps.pattern = String(k.value);
        if (k.kind === "values") ps.in = String(k.value).split(/\s*,\s*/).filter(Boolean);
        if (k.kind === "range") { const [lo, hi] = String(k.value).split(/\s*\.\.\s*/); if (lo !== "" && lo != null && !isNaN(+lo)) ps.minInclusive = +lo; if (hi !== "" && hi != null && !isNaN(+hi)) ps.maxInclusive = +hi; }
        if (k.severity === "warning") ps.severity = "Warning";
      });
      props.push(ps);
    });
    (o.rels || []).filter((r) => r.from === c.id && C(r.to)).forEach((r) => {
      const ps = { path: r.iri, name: r.name, class: C(r.to).iri };
      if (r.required) ps.minCount = 1;
      if (r.cardinality === "many_to_one" || r.cardinality === "one_to_one") ps.maxCount = 1;
      ks.filter((k) => k.kind === "cardinality" && k.prop === r.name).forEach((k) => {
        const [lo, hi] = String(k.value).split(/\s*\.\.\s*/);
        if (lo && !isNaN(+lo)) ps.minCount = +lo; if (hi && hi !== "*" && !isNaN(+hi)) ps.maxCount = +hi;
        if (k.severity === "warning") ps.severity = sev(k);
      });
      props.push(ps);
    });
    if (props.length) out.push({ id: ns + slug(c.name) + "Shape", targetClass: c.iri, name: c.name, props });
  });
  return out;
}

// Mapping shapes: EDG's own rules for the metadata graph. These do run in EDG.
export const MAPPING_SHAPES = [
  { id: X("edg:ClassBindingShape"), targetClass: X("edg:ClassBinding"), name: "Class binding", props: [
    { path: X("edg:boundClass"), minCount: 1, maxCount: 1, class: X("owl:Class"), message: "Class binding must name one class of the ontology" },
    { path: X("edg:sourceAsset"), minCount: 1, maxCount: 1, class: X("edg:CatalogAsset"), message: "Class binding must reference one catalog asset" },
    { path: X("edg:keyField"), minCount: 1, class: X("edg:CatalogField"), severity: "Warning", message: "Class binding should declare a key field that exists in the catalog" }] },
  { id: X("edg:PropertyBindingShape"), targetClass: X("edg:PropertyBinding"), name: "Property binding", props: [
    { path: X("edg:boundProperty"), minCount: 1, maxCount: 1, class: X("owl:DatatypeProperty"), message: "Property binding must name one datatype property" },
    { path: X("edg:sourceField"), minCount: 1, maxCount: 1, class: X("edg:CatalogField"), message: "Property binding must reference one catalog field that exists" }] },
  { id: X("edg:RelationshipBindingShape"), targetClass: X("edg:RelationshipBinding"), name: "Relationship binding", props: [
    { path: X("edg:boundRelationship"), minCount: 1, maxCount: 1, class: X("owl:ObjectProperty"), message: "Relationship binding must name one object property" },
    { path: X("edg:sourceAsset"), minCount: 1, maxCount: 1, class: X("edg:CatalogAsset"), message: "Relationship binding must reference one catalog asset" },
    { path: X("edg:sourceField"), minCount: 1, maxCount: 1, class: X("edg:CatalogField"), message: "Relationship binding must reference one catalog field that exists" }] },
  { id: X("edg:RelationshipCoverageShape"), targetClass: X("edg:Relationship"), name: "Relationship coverage", severity: "Warning", props: [
    { inversePath: X("edg:boundRelationship"), minCount: 1, message: "Relationship is not mapped to a catalog field" }] },
];

// ═══ SHACL validation (Core subset) ═══
export const COMPONENT = {
  minCount: "sh:MinCountConstraintComponent", maxCount: "sh:MaxCountConstraintComponent", class: "sh:ClassConstraintComponent",
  datatype: "sh:DatatypeConstraintComponent", pattern: "sh:PatternConstraintComponent", in: "sh:InConstraintComponent",
  minInclusive: "sh:MinInclusiveConstraintComponent", maxInclusive: "sh:MaxInclusiveConstraintComponent",
};
export function validateShacl(triples, shapes) {
  const byS = new Map(), byO = new Map();
  triples.forEach((t) => { (byS.get(t.s) || byS.set(t.s, []).get(t.s)).push(t); if (t.o.id) (byO.get(t.o.id) || byO.set(t.o.id, []).get(t.o.id)).push(t); });
  const sub = new Map(); triples.filter((t) => t.p === X("rdfs:subClassOf") && t.o.id).forEach((t) => (sub.get(t.o.id) || sub.set(t.o.id, []).get(t.o.id)).push(t.s));
  const subsOf = (c) => { const out = new Set([c]), st = [c]; while (st.length) (sub.get(st.pop()) || []).forEach((x) => { if (!out.has(x)) { out.add(x); st.push(x); } }); return out; };
  const typesOf = (s) => (byS.get(s) || []).filter((t) => t.p === RDF_TYPE && t.o.id).map((t) => t.o.id);
  const isA = (s, c) => { const cs = subsOf(c); return typesOf(s).some((t) => cs.has(t)); };
  const instances = (c) => { const cs = subsOf(c); return [...new Set(triples.filter((t) => t.p === RDF_TYPE && t.o.id && cs.has(t.o.id)).map((t) => t.s))]; };
  const results = [];
  shapes.forEach((sh) => {
    const focus = sh.targetClass ? instances(sh.targetClass) : [];
    focus.forEach((f) => (sh.props || []).forEach((ps) => {
      const path = ps.inversePath || ps.path;
      const vals = ps.inversePath ? (byO.get(f) || []).filter((t) => t.p === ps.inversePath).map((t) => ({ id: t.s }))
        : (byS.get(f) || []).filter((t) => t.p === ps.path).map((t) => t.o);
      const severity = ps.severity || sh.severity || "Violation";
      const add = (comp, value, msg) => results.push({ focusNode: f, resultPath: path, inverse: !!ps.inversePath, value: value || null, sourceShape: sh.id,
        component: COMPONENT[comp], severity, message: ps.message || msg });
      if (ps.minCount != null && vals.length < ps.minCount) add("minCount", null, `Expected at least ${ps.minCount} value${ps.minCount === 1 ? "" : "s"}, found ${vals.length}`);
      if (ps.maxCount != null && vals.length > ps.maxCount) add("maxCount", null, `Expected at most ${ps.maxCount}, found ${vals.length}`);
      vals.forEach((v) => {
        if (ps.class && !(v.id && isA(v.id, ps.class))) add("class", v.id || v.lit, `Value is not a ${curie(ps.class)}`);
        if (ps.datatype && v.lit != null && v.dt && v.dt !== ps.datatype) add("datatype", v.lit, `Value is not ${curie(ps.datatype)}`);
        if (ps.pattern && v.lit != null && !new RegExp(ps.pattern).test(v.lit)) add("pattern", v.lit, `Value does not match ${ps.pattern}`);
        if (ps.in && !ps.in.includes(v.lit != null ? v.lit : v.id)) add("in", v.lit || v.id, "Value is not in the allowed list");
        if (ps.minInclusive != null && v.lit != null && +v.lit < ps.minInclusive) add("minInclusive", v.lit, `Value is below ${ps.minInclusive}`);
        if (ps.maxInclusive != null && v.lit != null && +v.lit > ps.maxInclusive) add("maxInclusive", v.lit, `Value is above ${ps.maxInclusive}`);
      });
    }));
  });
  return { conforms: results.length === 0, results, violations: results.filter((r) => r.severity === "Violation").length,
    warnings: results.filter((r) => r.severity === "Warning").length };
}

// Everything EDG checks before approval and publication, in one call.
export function validateMetadata(ont, ctx) {
  return validateShacl(metadataTriples(ont, ctx), MAPPING_SHAPES);
}

// ═══ Expected-answer tests ═══
// A steward-approved test: "this relationship's identifying field is X". SHACL
// cannot see a swapped mapping (both fields exist); this test can.
export function relationshipField(ont, ctx, relId) {
  const b = bindings(ont, ctx).find((x) => x.kind === "relationship" && x.relId === relId);
  return b && b.column ? { table: b.table, column: b.column, assetId: b.assetId, label: fieldLabel(b.table, b.column), iri: b.assetId ? fieldIri(b.assetId, b.column) : null } : null;
}
export function runTests(ont, ctx) {
  return (ont.tests || []).map((t) => {
    const got = relationshipField(ont, ctx, t.relId);
    const r = (ont.rels || []).find((x) => x.id === t.relId);
    const pass = !!(r && got && got.label === t.expect);
    return { ...t, actual: got ? got.label : null, pass, reason: !r ? "Relationship no longer exists" : !got ? "Relationship is not mapped" : pass ? "" : `Mapped to ${got.label}` };
  });
}

// ═══ Governed query ═══
// Resolve a question to one relationship by its label, aliases and definition;
// answer from the published version only; a restricted caller gets the same
// "unavailable" whether or not the answer exists.
const words = (s) => String(s || "").toLowerCase().match(/[a-z0-9]+/g) || [];
const STOP = new Set(["which", "what", "field", "column", "identifies", "identify", "the", "of", "an", "a", "is", "for", "who", "does", "in", "on", "order", "orders", "to", "by", "from", "with", "and", "related", "are", "do", "this", "that"]);
export function resolveRelationship(ont, question) {
  // Class names do not pick a relationship ("customer" fits buyer and bill-to alike).
  const classWords = new Set((ont.classes || []).flatMap((c) => words(c.name).flatMap((w) => [w, w + "s"])));
  const q0 = words(question).filter((w) => !STOP.has(w));
  const q = q0.filter((w) => !classWords.has(w));
  const scored = (ont.rels || []).map((r) => {
    const vocab = new Set([...words(r.name), ...words(r.inverse), ...(r.synonyms || []).flatMap(words)].filter((w) => !classWords.has(w)));
    const defn = new Set(words(r.desc).filter((w) => !classWords.has(w) && !STOP.has(w)));
    const score = q.reduce((n, w) => n + (vocab.has(w) ? 2 : defn.has(w) ? 1 : 0), 0);
    return { r, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) {
    const named = (ont.classes || []).filter((c) => words(c.name).some((w) => q0.includes(w) || q0.includes(w + "s")));
    const fits = (ont.rels || []).filter((r) => named.some((c) => c.id === r.to));
    return fits.length > 1 ? { status: "ambiguous", options: fits } : fits.length === 1 ? { status: "ok", rel: fits[0] } : { status: "no_match" };
  }
  if (scored.length > 1 && scored[1].score === scored[0].score) return { status: "ambiguous", options: scored.filter((x) => x.score === scored[0].score).map((x) => x.r) };
  return { status: "ok", rel: scored[0].r };
}
export function query(ont, ctx, { question, relId, caller }) {
  const published = (ont.versions || []).find((v) => v.n === ont.publishedN);
  const audience = ont.audience || [];
  if (!published || !caller || !audience.includes(caller.team)) return { status: "unavailable" };
  const snap = { ...published.snapshot, id: ont.id, namespace: ont.namespace };
  const res = relId ? { status: "ok", rel: (snap.rels || []).find((r) => r.id === relId) } : resolveRelationship(snap, question);
  if (res.status !== "ok" || !res.rel) return { status: res.status === "ambiguous" ? "ambiguous" : "no_match", options: (res.options || []).map((r) => ({ id: r.id, name: r.name })), version: published.n };
  const f = relationshipField(snap, ctx, res.rel.id);
  const iris = ensureIris(snap);
  const rel = iris.rels.find((r) => r.id === res.rel.id);
  if (!f) return { status: "not_mapped", relationship: { name: rel.name, iri: rel.iri }, version: published.n };
  return { status: "ok", tool: "get_relationship_field", relationship: { name: rel.name, iri: rel.iri }, field: f.label,
    catalog: { assetId: f.assetId, asset: f.table, fieldIri: f.iri }, version: published.n, graph: `${ont.namespace.replace(/[#/]$/, "")}/v${published.n}` };
}

// ═══ Turtle writer ═══
export function writeTurtle(triples, prefixes = {}) {
  const P = { ...NS, ...prefixes };
  const used = new Set();
  const term = (x) => {
    if (x.list) return `( ${x.list.map(term).join(" ")} )`;
    if (x.lit != null) {
      const s = `"${String(x.lit).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
      if (x.dt) { const c = curie(x.dt, prefixes); if (c.includes(":") && !c.startsWith("<")) used.add(c.split(":")[0]); return `${s}^^${c}`; }
      return s;
    }
    return node(x.id);
  };
  const node = (iri) => {
    if (String(iri).startsWith("_:")) return iri;
    if (iri === RDF_TYPE) return "a";
    const c = curie(iri, prefixes);
    if (!c.startsWith("<")) used.add(c.split(":")[0]);
    return c;
  };
  const order = [], by = new Map();
  triples.forEach((t) => { if (!by.has(t.s)) { by.set(t.s, []); order.push(t.s); } by.get(t.s).push(t); });
  const body = order.map((s) => {
    const ts = by.get(s);
    const lines = ts.map((t, i) => `${i ? "    " : ""}${node(t.p)} ${term(t.o)}`);
    return `${node(s)} ${lines.join(" ;\n")} .`;
  }).join("\n\n");
  const head = Object.entries(P).filter(([k]) => used.has(k)).map(([k, v]) => `@prefix ${k}: <${v}> .`).join("\n");
  return `${head}\n\n${body}\n`;
}

export function shapesTriples(shapes) {
  const L = []; let bn = 0;
  shapes.forEach((sh) => {
    L.push(T(sh.id, RDF_TYPE, id(X("sh:NodeShape"))), T(sh.id, X("sh:targetClass"), id(sh.targetClass)));
    if (sh.severity) L.push(T(sh.id, X("sh:severity"), id(X("sh:" + sh.severity))));
    (sh.props || []).forEach((ps) => {
      const b = `_:p${++bn}`;
      L.push(T(sh.id, X("sh:property"), id(b)));
      if (ps.inversePath) { const ib = `_:i${bn}`; L.push(T(b, X("sh:path"), id(ib)), T(ib, X("sh:inversePath"), id(ps.inversePath))); }
      else L.push(T(b, X("sh:path"), id(ps.path)));
      if (ps.name) L.push(T(b, X("sh:name"), lit(ps.name)));
      if (ps.minCount != null) L.push(T(b, X("sh:minCount"), lit(ps.minCount, X("xsd:integer"))));
      if (ps.maxCount != null) L.push(T(b, X("sh:maxCount"), lit(ps.maxCount, X("xsd:integer"))));
      if (ps.class) L.push(T(b, X("sh:class"), id(ps.class)));
      if (ps.datatype) L.push(T(b, X("sh:datatype"), id(ps.datatype)));
      if (ps.pattern) L.push(T(b, X("sh:pattern"), lit(ps.pattern)));
      if (ps.in) L.push(T(b, X("sh:in"), { list: ps.in.map((v) => lit(v)) }));
      if (ps.minInclusive != null) L.push(T(b, X("sh:minInclusive"), lit(ps.minInclusive, X("xsd:decimal"))));
      if (ps.maxInclusive != null) L.push(T(b, X("sh:maxInclusive"), lit(ps.maxInclusive, X("xsd:decimal"))));
      if (ps.unique) L.push(T(b, X("dash:uniqueValueForClass"), lit("true", X("xsd:boolean"))));
      if (ps.severity) L.push(T(b, X("sh:severity"), id(X("sh:" + ps.severity))));
      if (ps.message) L.push(T(b, X("sh:message"), lit(ps.message)));
    });
  });
  return L;
}

export function reportTriples(report) {
  const R = "_:report", L = [T(R, RDF_TYPE, id(X("sh:ValidationReport"))), T(R, X("sh:conforms"), lit(report.conforms ? "true" : "false", X("xsd:boolean")))];
  report.results.forEach((r, i) => {
    const b = `_:r${i + 1}`;
    L.push(T(R, X("sh:result"), id(b)), T(b, RDF_TYPE, id(X("sh:ValidationResult"))), T(b, X("sh:focusNode"), id(r.focusNode)));
    if (r.inverse) { const ib = `_:ri${i + 1}`; L.push(T(b, X("sh:resultPath"), id(ib)), T(ib, X("sh:inversePath"), id(r.resultPath))); }
    else L.push(T(b, X("sh:resultPath"), id(r.resultPath)));
    if (r.value) L.push(T(b, X("sh:value"), String(r.value).includes("://") ? id(r.value) : lit(r.value)));
    L.push(T(b, X("sh:sourceShape"), id(r.sourceShape)), T(b, X("sh:sourceConstraintComponent"), id(X(r.component))),
      T(b, X("sh:resultSeverity"), id(X("sh:" + r.severity))), T(b, X("sh:resultMessage"), lit(r.message)));
  });
  return L;
}

// The four files, as Turtle.
export function exportFiles(ont, ctx) {
  const o = ensureIris(ont), pf = { [o.prefix || "ex"]: o.namespace };
  return {
    "ontology.ttl": writeTurtle(owlTriples(o), pf),
    "shapes.ttl": writeTurtle(shapesTriples(businessShapes(o)), pf),
    "mappings.ttl": writeTurtle([...catalogTriples(o, ctx), ...mappingTriples(o, ctx)], pf),
    "mapping-shapes.ttl": writeTurtle(shapesTriples(MAPPING_SHAPES), pf),
    "report.ttl": writeTurtle(reportTriples(validateMetadata(o, ctx)), pf),
    "ontology.owl": toRdfXml(owlTriples(o), pf),
    "ossie-ontology.yaml": toOssie(o, ctx).ontology,
    "ossie-mapping.yaml": toOssie(o, ctx).mapping,
  };
}

// ═══ Reading Turtle back ═══
export function readTriples(text) {
  const r = parseTurtle(text);
  if (!r.ok) return { ok: false, error: r.error, triples: [] };
  const fix = (x) => (x === "rdf:type" || x === "a" ? RDF_TYPE : x);
  return { ok: true, triples: r.triples.map((t) => ({ s: fix(t.s), p: fix(t.p), o: t.o.id ? { id: fix(t.o.id) } : t.o })) };
}
export function shapesFromTriples(triples) {
  const by = new Map(); triples.forEach((t) => (by.get(t.s) || by.set(t.s, []).get(t.s)).push(t));
  const one = (s, p) => ((by.get(s) || []).find((t) => t.p === p) || {}).o;
  const num = (o) => (o == null ? undefined : +(o.lit != null ? o.lit : o.id));
  const sev = (o) => (o && o.id ? o.id.replace(NS.sh, "") : undefined);
  return triples.filter((t) => t.p === RDF_TYPE && t.o.id === X("sh:NodeShape")).map((t) => {
    const s = t.s, tc = one(s, X("sh:targetClass"));
    const props = (by.get(s) || []).filter((x) => x.p === X("sh:property")).map((x) => {
      const b = x.o.id, path = one(b, X("sh:path")), ps = {};
      if (path && path.id && by.has(path.id) && one(path.id, X("sh:inversePath"))) ps.inversePath = one(path.id, X("sh:inversePath")).id; else if (path) ps.path = path.id;
      const nm = one(b, X("sh:name")); if (nm) ps.name = nm.lit;
      ["minCount", "maxCount", "minInclusive", "maxInclusive"].forEach((k) => { const v = one(b, X("sh:" + k)); if (v) ps[k] = num(v); });
      const cl = one(b, X("sh:class")); if (cl) ps.class = cl.id;
      const dt = one(b, X("sh:datatype")); if (dt) ps.datatype = dt.id;
      const pt = one(b, X("sh:pattern")); if (pt) ps.pattern = pt.lit;
      const inn = one(b, X("sh:in")); if (inn && inn.list) ps.in = inn.list.map((v) => (v.lit != null ? v.lit : v.id));
      const u = one(b, X("dash:uniqueValueForClass")); if (u) ps.unique = String(u.lit != null ? u.lit : u.id) === "true";
      const sv = sev(one(b, X("sh:severity"))); if (sv) ps.severity = sv;
      const ms = one(b, X("sh:message")); if (ms) ps.message = ms.lit;
      return ps;
    });
    const out = { id: s, targetClass: tc && tc.id, props }; const sv = sev(one(s, X("sh:severity"))); if (sv) out.severity = sv;
    return out;
  });
}

// ═══ Round trip ═══
// Export the files, read them back as an independent RDF consumer would, and
// check identifiers, relationship definitions, shapes and validation results.
const canonShape = (s) => JSON.stringify({ id: s.id, targetClass: s.targetClass, severity: s.severity || null,
  props: (s.props || []).map((p) => Object.keys(p).sort().reduce((o, k) => { o[k] = p[k]; return o; }, {})) });
export function roundTrip(ont, ctx) {
  const files = exportFiles(ont, ctx), checks = [];
  const owl = readTriples(files["ontology.ttl"]), shp = readTriples(files["shapes.ttl"]), map = readTriples(files["mappings.ttl"]), msh = readTriples(files["mapping-shapes.ttl"]);
  const parsed = [owl, shp, map, msh].every((r) => r.ok);
  checks.push({ k: "parse", l: "Files parse as Turtle", ok: parsed, detail: parsed ? "4 of 4 files" : [owl, shp, map, msh].map((r) => r.error).filter(Boolean).join("; ") });
  if (!parsed) return { ok: false, checks, files };
  const typed = (tr, t) => new Set(tr.filter((x) => x.p === RDF_TYPE && x.o.id === X(t)).map((x) => x.s));
  const orig = owlTriples(ont);
  const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
  const idsOk = ["owl:Class", "owl:DatatypeProperty", "owl:ObjectProperty"].every((t) => same(typed(orig, t), typed(owl.triples, t)));
  checks.push({ k: "ids", l: "Identifiers preserved", ok: idsOk, detail: `${typed(orig, "owl:Class").size} classes · ${typed(orig, "owl:DatatypeProperty").size} properties · ${typed(orig, "owl:ObjectProperty").size} relationships` });
  const relSig = (tr) => new Set([...typed(tr, "owl:ObjectProperty")].map((r) => ["rdfs:domain", "rdfs:range", "owl:inverseOf"].map((p) => (tr.find((x) => x.s === r && x.p === X(p)) || { o: {} }).o.id || "").join("|") + "|" + r));
  const relOk = same(relSig(orig), relSig(owl.triples));
  checks.push({ k: "rels", l: "Relationship definitions preserved", ok: relOk, detail: "domain · range · inverse" });
  const shapesOk = JSON.stringify(businessShapes(ont).map(canonShape).sort()) === JSON.stringify(shapesFromTriples(shp.triples).map(canonShape).sort())
    && JSON.stringify(MAPPING_SHAPES.map(canonShape).sort()) === JSON.stringify(shapesFromTriples(msh.triples).map(canonShape).sort());
  checks.push({ k: "shapes", l: "SHACL shapes preserved", ok: shapesOk, detail: `${businessShapes(ont).length} business · ${MAPPING_SHAPES.length} mapping shapes` });
  const key = (r) => `${r.focusNode}|${r.resultPath}|${r.component}|${r.severity}`;
  const before = validateMetadata(ont, ctx).results.map(key).sort();
  const after = validateShacl([...owl.triples, ...map.triples], shapesFromTriples(msh.triples)).results.map(key).sort();
  const vOk = JSON.stringify(before) === JSON.stringify(after);
  checks.push({ k: "validation", l: "Validation results preserved", ok: vOk, detail: `${before.length} result${before.length === 1 ? "" : "s"} before · ${after.length} after re-import` });
  return { ok: checks.every((c) => c.ok), checks, files };
}

// ═══ Status, the EDG way ═══
// Draft → In Review → Approved, or Rejected; Deprecated by an owner. Anyone
// editing submits; an owner who did not submit approves, and only when there
// are no errors. Approving publishes the exact draft as a new version; any edit
// after that is a new Draft while the approved version stays active.
export const STATUSES = ["Draft", "In Review", "Approved", "Rejected", "Deprecated"];
export const draftHash = (ont) => hash({ ...snapshot(ont), tests: ont.tests || [], audience: ont.audience || [] });
export function statusOf(ont) {
  if (ont.deprecated) return "Deprecated";
  const r = ont.review || {};
  const same = r.hash && r.hash === draftHash(ont);
  if (same && r.state === "in_review") return "In Review";
  if (same && (r.state === "rejected" || r.state === "changes_requested")) return "Rejected";
  const latest = (ont.versions || [])[0];
  if (ont.publishedN && latest && latest.hash === hash(snapshot(ont))) return "Approved";
  return "Draft";
}
// Kept for callers that still read the lower-case review state.
export const reviewState = (ont) => ({ "In Review": "in_review", Approved: "approved", Rejected: "changes_requested" })[statusOf(ont)] || "draft";
// Errors that block approval: structure, mapping checks (SHACL violations) and failing expected answers.
export function blockingIssues(ont, ctx, structuralErrors = 0) {
  const rep = validateMetadata(ont, ctx), tests = runTests(ont, ctx);
  const failing = tests.filter((t) => !t.pass).length;
  return { structural: structuralErrors, violations: rep.violations, failing, total: structuralErrors + rep.violations + failing };
}
export function canApprove(ont, user, blocking = 0) {
  const r = ont.review || {};
  const owners = ont.owners || (ont.owner ? [ont.owner] : []);
  if (statusOf(ont) !== "In Review") return { ok: false, why: "Not in review" };
  if (r.submittedBy === user) return { ok: false, why: "The submitter cannot approve" };
  if (!owners.includes(user)) return { ok: false, why: "Only an owner can approve" };
  if (blocking > 0) return { ok: false, why: `${blocking} error${blocking === 1 ? "" : "s"} must be fixed first` };
  return { ok: true };
}
