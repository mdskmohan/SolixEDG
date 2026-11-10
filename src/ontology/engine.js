// ─────────────────────────────────────────────────────────────────────────────
// EDG ontology engine — pure functions over one ontology record.
//
//   ontology = { id, name, prefix, namespace, domain, owner, steward, status, desc,
//                classes:[{id, name, desc, synonyms, parent, termId, sameAs:[], props:[{id,name,datatype,required,desc}], prov}],
//                rels:[{id, from, to, name, inverse, cardinality, kind, desc, prov}],
//                constraints:[{id, classId, prop, kind, value, severity, desc, prov}],
//                versions:[{n, at, by, note, hash, snapshot}], publishedN }
//
// validation · versions/diff · Turtle + SHACL out · Turtle/OWL/SKOS/SHACL and
// Palantir in. The AI suggestions live in ./ai.js. Nothing here writes; the
// screens apply what comes back.
// ─────────────────────────────────────────────────────────────────────────────

export const CARDINALITY = {
  many_to_one: "many to one", one_to_many: "one to many", one_to_one: "one to one", many_to_many: "many to many",
};
export const INVERSE_CARD = { many_to_one: "one_to_many", one_to_many: "many_to_one", one_to_one: "one_to_one", many_to_many: "many_to_many" };
export const DATATYPES = ["string", "integer", "decimal", "boolean", "date", "dateTime", "anyURI"];
export const CONSTRAINT_KINDS = {
  required: "Required", unique: "Unique", pattern: "Matches pattern", values: "Allowed values",
  range: "Value range", cardinality: "Relationship count",
};

const clone = (x) => JSON.parse(JSON.stringify(x));
export const slug = (s) => String(s || "").trim().replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")).replace(/^./, (c) => c.toUpperCase());
export const propSlug = (s) => { const x = slug(s); return x.charAt(0).toLowerCase() + x.slice(1); };
export const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const byId = (ont, id) => (ont.classes || []).find((c) => c.id === id);

// ═════════════════════════════ VALIDATION ════════════════════════════════════
export function validate(ont) {
  const issues = [];
  const push = (severity, code, title, explain, target, fix) => issues.push({ id: `${code}:${target ? target.id : ""}:${issues.length}`, severity, code, title, explain, target: target || null, fix: fix || null });
  const cls = ont.classes || [];
  // names
  const seen = new Map();
  cls.forEach((c) => {
    const k = String(c.name || "").trim().toLowerCase();
    if (!k) push("error", "class.name", "A class has no name", "Every class needs a name before the ontology can be published.", { kind: "class", id: c.id });
    else if (seen.has(k)) push("error", "class.duplicate", `Two classes are called ${c.name}`, "Class names must be unique within an ontology — merge them or rename one.", { kind: "class", id: c.id });
    else seen.set(k, c.id);
  });
  // hierarchy
  cls.forEach((c) => {
    if (c.parent && !byId(ont, c.parent)) push("error", "class.parent", `${c.name} is a kind of a class that no longer exists`, "Pick another parent or clear it.", { kind: "class", id: c.id }, { kind: "clearParent", classId: c.id, label: "Clear parent" });
  });
  cls.forEach((c) => {
    const path = new Set([c.id]); let at = c.parent;
    while (at) {
      if (path.has(at)) { push("error", "class.cycle", `${c.name} is, eventually, a kind of itself`, "The \"is a kind of\" chain loops back. Break the loop by clearing one parent.", { kind: "class", id: c.id }, { kind: "clearParent", classId: c.id, label: "Clear this parent" }); break; }
      path.add(at); at = (byId(ont, at) || {}).parent;
    }
  });
  // relationships
  const pairNames = new Set();
  (ont.rels || []).forEach((r) => {
    const A = byId(ont, r.from), B = byId(ont, r.to);
    if (!A || !B) { push("error", "rel.endpoint", `Relationship ${r.name || r.id} points at a missing class`, "Re-point it or remove it.", { kind: "rel", id: r.id }, { kind: "removeRel", relId: r.id, label: "Remove relationship" }); return; }
    if (!r.name) push("error", "rel.name", `${A.name} → ${B.name} has no name`, "Name the relationship as a verb phrase, e.g. \"placed by\".", { kind: "rel", id: r.id });
    const k = `${r.from}|${r.to}|${String(r.name || "").toLowerCase()}`;
    if (pairNames.has(k)) push("warning", "rel.duplicate", `${A.name} ${r.name} ${B.name} is declared twice`, "Remove the duplicate.", { kind: "rel", id: r.id }, { kind: "removeRel", relId: r.id, label: "Remove duplicate" });
    pairNames.add(k);
    if (!r.cardinality) push("warning", "rel.cardinality", `${A.name} ${r.name} ${B.name} has no cardinality`, "Without it nobody can tell whether a join along it is safe.", { kind: "rel", id: r.id });
  });
  // constraints
  (ont.constraints || []).forEach((k) => {
    const c = byId(ont, k.classId);
    if (!c) push("error", "con.class", "A constraint targets a missing class", "Remove it.", { kind: "constraint", id: k.id }, { kind: "removeConstraint", constraintId: k.id, label: "Remove constraint" });
    else if (k.prop && !(c.props || []).some((p) => p.name === k.prop)) push("error", "con.prop", `${c.name} has no property ${k.prop}`, "The constraint points at a property that does not exist.", { kind: "constraint", id: k.id }, { kind: "removeConstraint", constraintId: k.id, label: "Remove constraint" });
  });
  // completeness
  cls.forEach((c) => {
    if (!c.desc) push("info", "class.desc", `${c.name} has no definition`, "A class without a definition is a name, not a meaning.", { kind: "class", id: c.id });
    const linked = c.parent || cls.some((x) => x.parent === c.id) || (ont.rels || []).some((r) => r.from === c.id || r.to === c.id);
    if (cls.length > 1 && !linked) push("info", "class.orphan", `${c.name} is not connected`, "It has no parent, no subclasses and no relationships.", { kind: "class", id: c.id });
  });
  const order = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ═════════════════════════════ VERSIONS ══════════════════════════════════════
export function snapshot(ont) {
  return clone({ name: ont.name, prefix: ont.prefix, namespace: ont.namespace, desc: ont.desc || "",
    classes: ont.classes || [], rels: ont.rels || [], constraints: ont.constraints || [] });
}
export function hash(snap) {
  const norm = (v) => Array.isArray(v) ? v.map(norm) : v && typeof v === "object"
    ? Object.keys(v).sort().filter((k) => k !== "prov").reduce((o, k) => { o[k] = norm(v[k]); return o; }, {}) : v;
  const s = JSON.stringify(norm(snap)); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function publish(ont, actor, note, now) {
  const errs = validate(ont).filter((i) => i.severity === "error");
  if (errs.length) return { ok: false, error: `${errs.length} error${errs.length === 1 ? "" : "s"} must be fixed before publishing.` };
  const snap = snapshot(ont), h = hash(snap);
  const latest = (ont.versions || [])[0];
  if (latest && latest.hash === h) return { ok: false, error: `Nothing to publish — identical to v${latest.n}.` };
  const v = { n: (latest ? latest.n : 0) + 1, at: (now ? new Date(now) : new Date()).toISOString(), by: actor, note: note || "", hash: h, snapshot: snap };
  return { ok: true, version: v, ontology: { ...ont, status: "Published", publishedN: v.n, versions: [v, ...(ont.versions || [])] } };
}
export function isDirty(ont) {
  const latest = (ont.versions || [])[0];
  return !latest || latest.hash !== hash(snapshot(ont));
}
export function diff(prev, next) {
  const lines = [];
  const nm = (s, id) => ((s.classes || []).find((c) => c.id === id) || {}).name || id;
  const coll = (k, label, nameOf, s1, s2) => {
    const a = new Map((s1[k] || []).map((x) => [x.id, x])), b = new Map((s2[k] || []).map((x) => [x.id, x]));
    b.forEach((x, id) => { if (!a.has(id)) lines.push({ kind: "added", text: `Added ${label} ${nameOf(x, s2)}` }); });
    a.forEach((x, id) => { if (!b.has(id)) lines.push({ kind: "removed", text: `Removed ${label} ${nameOf(x, s1)}` }); });
    b.forEach((x, id) => { if (!a.has(id)) return; const y = a.get(id);
      const f = Object.keys({ ...x, ...y }).filter((k2) => k2 !== "prov" && JSON.stringify(x[k2]) !== JSON.stringify(y[k2]));
      if (f.length) lines.push({ kind: "changed", text: `Changed ${label} ${nameOf(x, s2)}: ${f.join(", ")}` }); });
  };
  prev = prev || {}; next = next || {};
  coll("classes", "class", (x) => x.name, prev, next);
  coll("rels", "relationship", (x, s) => `${nm(s, x.from)} ${x.name} ${nm(s, x.to)}`, prev, next);
  coll("constraints", "constraint", (x, s) => `${CONSTRAINT_KINDS[x.kind] || x.kind} on ${nm(s, x.classId)}${x.prop ? "." + x.prop : ""}`, prev, next);
  return lines;
}

// ═════════════════════════════ TURTLE OUT ════════════════════════════════════
const XSD = { string: "xsd:string", integer: "xsd:integer", decimal: "xsd:decimal", boolean: "xsd:boolean", date: "xsd:date", dateTime: "xsd:dateTime", anyURI: "xsd:anyURI" };
const lit = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
export function toTurtle(ont) {
  const p = ont.prefix || "ex", ns = ont.namespace || `https://data.example.com/ontology/${p}#`;
  const C = (id) => `${p}:${slug((byId(ont, id) || {}).name || id)}`;
  const L = [`@prefix ${p}: <${ns}> .`, "@prefix owl: <http://www.w3.org/2002/07/owl#> .", "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .", "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .", "",
    `<${ns.replace(/#$/, "")}> a owl:Ontology ; rdfs:label ${lit(ont.name)}${ont.desc ? ` ;\n  rdfs:comment ${lit(ont.desc)}` : ""} .`, ""];
  (ont.classes || []).forEach((c) => {
    const parts = [`${C(c.id)} a owl:Class`, `rdfs:label ${lit(c.name)}`];
    if (c.desc) parts.push(`rdfs:comment ${lit(c.desc)}`);
    if (c.parent) parts.push(`rdfs:subClassOf ${C(c.parent)}`);
    (c.synonyms || []).forEach((s) => parts.push(`skos:altLabel ${lit(s)}`));
    (c.sameAs || []).forEach((s) => parts.push(`owl:equivalentClass <${s.iri}>`));
    L.push(parts.join(" ;\n  ") + " .");
    (c.props || []).forEach((pr) => L.push(`${p}:${propSlug(pr.name)} a owl:DatatypeProperty ;\n  rdfs:label ${lit(pr.name)} ;\n  rdfs:domain ${C(c.id)} ;\n  rdfs:range ${XSD[pr.datatype] || "xsd:string"} .`));
    L.push("");
  });
  (ont.rels || []).forEach((r) => {
    const parts = [`${p}:${propSlug(r.name)} a owl:ObjectProperty`, `rdfs:label ${lit(r.name)}`, `rdfs:domain ${C(r.from)}`, `rdfs:range ${C(r.to)}`];
    if (r.inverse) parts.push(`owl:inverseOf ${p}:${propSlug(r.inverse)}`);
    if (r.cardinality === "many_to_one" || r.cardinality === "one_to_one") parts.push("a owl:FunctionalProperty");
    if (r.desc) parts.push(`rdfs:comment ${lit(r.desc)}`);
    L.push(parts.join(" ;\n  ") + " .", "");
  });
  return L.join("\n");
}
export function toShacl(ont) {
  const p = ont.prefix || "ex", ns = ont.namespace || `https://data.example.com/ontology/${p}#`;
  const L = [`@prefix ${p}: <${ns}> .`, "@prefix sh: <http://www.w3.org/ns/shacl#> .", "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .", ""];
  (ont.classes || []).forEach((c) => {
    const ks = (ont.constraints || []).filter((k) => k.classId === c.id);
    if (!ks.length) return;
    const byProp = new Map(); ks.forEach((k) => byProp.set(k.prop || "", [...(byProp.get(k.prop || "") || []), k]));
    const props = [...byProp.entries()].map(([prop, list]) => {
      const lines = [`sh:path ${p}:${propSlug(prop)}`];
      list.forEach((k) => {
        if (k.kind === "required") lines.push("sh:minCount 1");
        if (k.kind === "unique") lines.push("sh:maxCount 1");
        if (k.kind === "pattern") lines.push(`sh:pattern ${lit(k.value)}`);
        if (k.kind === "values") lines.push(`sh:in ( ${String(k.value).split(/\s*,\s*/).map(lit).join(" ")} )`);
        if (k.kind === "range") { const [lo, hi] = String(k.value).split(/\s*\.\.\s*/); if (lo) lines.push(`sh:minInclusive ${lo}`); if (hi) lines.push(`sh:maxInclusive ${hi}`); }
        if (k.severity === "warning") lines.push("sh:severity sh:Warning");
      });
      return `  sh:property [ ${lines.join(" ; ")} ]`;
    });
    L.push(`${p}:${slug(c.name)}Shape a sh:NodeShape ;\n  sh:targetClass ${p}:${slug(c.name)} ;\n${props.join(" ;\n")} .`, "");
  });
  return L.join("\n");
}

// ═════════════════════════════ TURTLE IN ═════════════════════════════════════
// A small Turtle reader: prefixes, IRIs, prefixed names, "a", literals with
// language or datatype, ; and , lists, blank nodes [ … ] and collections ( … ).
// Enough for OWL, RDFS, SKOS and SHACL documents as tools export them.
function tokenize(src) {
  const t = []; let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (ch === "<") { const j = src.indexOf(">", i); t.push({ k: "iri", v: src.slice(i + 1, j) }); i = j + 1; continue; }
    if (ch === '"' || ch === "'") {
      const q = src.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch; let j = i + q.length, s = "";
      while (j < src.length && !src.startsWith(q, j)) { if (src[j] === "\\") { s += ({ n: "\n", t: "\t" })[src[j + 1]] || src[j + 1]; j += 2; } else s += src[j++]; }
      i = j + q.length;
      if (src[i] === "@") { const m = src.slice(i).match(/^@[A-Za-z-]+/); i += m[0].length; }
      else if (src.startsWith("^^", i)) { i += 2; const m = src.slice(i).match(/^(<[^>]*>|[A-Za-z0-9_-]*:[A-Za-z0-9_.-]*)/); i += m[0].length; }
      t.push({ k: "lit", v: s }); continue;
    }
    if ("[](),;.".includes(ch) && !(ch === "." && /[0-9]/.test(src[i + 1] || "") && /[0-9]/.test(src[i - 1] || ""))) { t.push({ k: ch }); i++; continue; }
    const m = src.slice(i).match(/^(@prefix|@base|PREFIX|BASE|[^\s\[\](),;"'<#]+?)(?=[\s\[\](),;"'<#]|\.(\s|$)|$)/);
    if (!m) { i++; continue; }
    const w = m[0]; i += w.length;
    if (/^-?[0-9]/.test(w)) t.push({ k: "lit", v: w });
    else if (w === "a") t.push({ k: "iri", v: "rdf:type" });
    else if (/^(@prefix|PREFIX)$/.test(w)) t.push({ k: "prefix" });
    else if (/^(true|false)$/.test(w)) t.push({ k: "lit", v: w });
    else t.push({ k: "pname", v: w });
  }
  return t;
}
export function parseTurtle(src) {
  const toks = tokenize(String(src || "")); let i = 0; const prefixes = {}; const triples = []; let bn = 0;
  const peek = () => toks[i]; const next = () => toks[i++];
  const expand = (tk) => {
    if (tk.k === "iri") { if (tk.v === "rdf:type") return "rdf:type"; return tk.v; }
    const [pf, local] = tk.v.split(/:(.*)/s); const base = prefixes[pf];
    return base != null ? base + (local || "") : tk.v;
  };
  const term = () => {
    const tk = next(); if (!tk) throw new Error("Unexpected end");
    if (tk.k === "[") { const id = `_:b${++bn}`; if (peek() && peek().k !== "]") predList(id); next(); return { id }; }
    if (tk.k === "(") { const items = []; while (peek() && peek().k !== ")") items.push(term()); next(); return { list: items }; }
    if (tk.k === "lit") return { lit: tk.v };
    return { id: expand(tk) };
  };
  const predList = (s) => {
    while (true) {
      const p = term();
      do { const o = term(); triples.push({ s, p: p.id, o }); } while (peek() && peek().k === "," && next());
      if (peek() && peek().k === ";") { next(); while (peek() && peek().k === ";") next(); if (!peek() || peek().k === "." || peek().k === "]") return; continue; }
      return;
    }
  };
  try {
    while (i < toks.length) {
      const tk = peek();
      if (tk.k === "prefix") { next(); const name = next().v.replace(/:$/, ""); const iri = next().v; prefixes[name] = iri; if (peek() && peek().k === ".") next(); continue; }
      const s = term(); if (peek() && peek().k !== ".") predList(s.id); if (peek() && peek().k === ".") next();
    }
  } catch (e) { return { ok: false, error: `Could not read the document: ${e.message}`, triples: [], prefixes }; }
  return { ok: true, triples, prefixes };
}

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#", RDFS = "http://www.w3.org/2000/01/rdf-schema#",
  OWL = "http://www.w3.org/2002/07/owl#", SKOS = "http://www.w3.org/2004/02/skos/core#", SH = "http://www.w3.org/ns/shacl#",
  XSDNS = "http://www.w3.org/2001/XMLSchema#";
const DEFAULT_PREFIXES = { rdf: RDF, rdfs: RDFS, owl: OWL, skos: SKOS, sh: SH, xsd: XSDNS };
const local = (iri) => String(iri || "").replace(/^.*[#/:]/, "");
const humanize = (s) => String(s).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

// Turtle (OWL / RDFS / SKOS / SHACL, any mix) → classes, relationships, properties,
// constraints, and SKOS concepts for the glossary.
export function importTurtle(text) {
  const withDefaults = Object.entries(DEFAULT_PREFIXES).map(([k, v]) => `@prefix ${k}: <${v}> .`).join("\n") + "\n" + text;
  const r = parseTurtle(withDefaults);
  if (!r.ok) return { ok: false, error: r.error };
  const T = r.triples;
  const isA = (s, t) => T.some((x) => x.s === s && x.p === "rdf:type" && x.o.id === t);
  const val = (s, p) => (T.find((x) => x.s === s && x.p === p) || {}).o;
  const vals = (s, p) => T.filter((x) => x.s === s && x.p === p).map((x) => x.o);
  const label = (s) => { const l = val(s, RDFS + "label") || val(s, SKOS + "prefLabel"); return l && l.lit ? l.lit : humanize(local(s)); };
  const classIris = [...new Set(T.filter((x) => x.p === "rdf:type" && (x.o.id === OWL + "Class" || x.o.id === RDFS + "Class")).map((x) => x.s))];
  // Anything used as a domain/range/subclass target is a class too.
  T.filter((x) => [RDFS + "subClassOf", RDFS + "domain", RDFS + "range", SH + "targetClass"].includes(x.p) && x.o.id && !x.o.id.startsWith(XSDNS) && !x.o.id.startsWith("_:"))
    .forEach((x) => { if (!classIris.includes(x.o.id) && !isA(x.o.id, OWL + "ObjectProperty")) classIris.push(x.o.id); });
  T.filter((x) => x.p === RDFS + "subClassOf").forEach((x) => { if (!classIris.includes(x.s)) classIris.push(x.s); });
  const idOf = (iri) => `c_${slug(local(iri))}`;
  const classes = classIris.map((iri) => ({
    id: idOf(iri), iri, name: label(iri),
    desc: ((val(iri, RDFS + "comment") || val(iri, SKOS + "definition")) || {}).lit || "",
    synonyms: vals(iri, SKOS + "altLabel").map((o) => o.lit).filter(Boolean),
    parent: (() => { const p = vals(iri, RDFS + "subClassOf").find((o) => o.id && classIris.includes(o.id)); return p ? idOf(p.id) : null; })(),
    sameAs: vals(iri, OWL + "equivalentClass").filter((o) => o.id).map((o) => ({ iri: o.id, label: humanize(local(o.id)), standard: "Imported" })),
    props: [], termId: null,
  }));
  const cOf = (iri) => classes.find((c) => c.iri === iri);
  const rels = [];
  T.filter((x) => x.p === "rdf:type" && x.o.id === OWL + "ObjectProperty").forEach((x) => {
    const d = val(x.s, RDFS + "domain"), g = val(x.s, RDFS + "range");
    if (!d || !g || !cOf(d.id) || !cOf(g.id)) return;
    const inv = val(x.s, OWL + "inverseOf");
    rels.push({ id: `r_${slug(local(x.s))}`, from: cOf(d.id).id, to: cOf(g.id).id, name: label(x.s).toLowerCase(),
      inverse: inv ? humanize(local(inv.id)).toLowerCase() : "", cardinality: isA(x.s, OWL + "FunctionalProperty") ? "many_to_one" : "",
      kind: "association", desc: (val(x.s, RDFS + "comment") || {}).lit || "" });
  });
  const XS = { string: "string", integer: "integer", int: "integer", decimal: "decimal", double: "decimal", boolean: "boolean", date: "date", dateTime: "dateTime", anyURI: "anyURI" };
  T.filter((x) => x.p === "rdf:type" && x.o.id === OWL + "DatatypeProperty").forEach((x) => {
    const d = val(x.s, RDFS + "domain"), g = val(x.s, RDFS + "range"); const c = d && cOf(d.id); if (!c) return;
    c.props.push({ id: `p_${slug(local(x.s))}`, name: label(x.s), iri: x.s, datatype: XS[local(g && g.id)] || "string", required: false, desc: (val(x.s, RDFS + "comment") || {}).lit || "" });
  });
  // SHACL: node shapes with property constraints.
  const constraints = [];
  T.filter((x) => x.p === SH + "targetClass").forEach((x) => {
    const c = cOf(x.o.id); if (!c) return;
    vals(x.s, SH + "property").forEach((ps) => {
      const path = val(ps.id, SH + "path"); if (!path) return;
      let pr = c.props.find((p) => p.iri === path.id || propSlug(p.name) === local(path.id));
      if (!pr) { pr = { id: `p_${slug(local(path.id))}`, name: humanize(local(path.id)), iri: path.id, datatype: "string", required: false, desc: "" }; c.props.push(pr); }
      const dt = val(ps.id, SH + "datatype"); if (dt) pr.datatype = XS[local(dt.id)] || pr.datatype;
      const sev = (val(ps.id, SH + "severity") || {}).id === SH + "Warning" ? "warning" : "violation";
      const add = (kind, value) => constraints.push({ id: `k_${c.id}_${slug(pr.name)}_${kind}`, classId: c.id, prop: pr.name, kind, value, severity: sev, desc: "" });
      const min = val(ps.id, SH + "minCount"); if (min && Number(min.lit) >= 1) { add("required", ""); pr.required = true; }
      const max = val(ps.id, SH + "maxCount"); if (max && Number(max.lit) === 1) add("unique", "");
      const pat = val(ps.id, SH + "pattern"); if (pat) add("pattern", pat.lit);
      const inn = val(ps.id, SH + "in"); if (inn && inn.list) add("values", inn.list.map((o) => o.lit || local(o.id)).join(", "));
      const lo = val(ps.id, SH + "minInclusive"), hi = val(ps.id, SH + "maxInclusive"); if (lo || hi) add("range", `${lo ? lo.lit : ""}..${hi ? hi.lit : ""}`);
    });
  });
  // SKOS concepts → glossary candidates (and a broader → is-a hint).
  const concepts = [...new Set(T.filter((x) => x.p === "rdf:type" && x.o.id === SKOS + "Concept").map((x) => x.s))].map((iri) => ({
    iri, name: label(iri), definition: ((val(iri, SKOS + "definition")) || {}).lit || "",
    synonyms: vals(iri, SKOS + "altLabel").map((o) => o.lit), broader: (() => { const b = val(iri, SKOS + "broader"); return b ? label(b.id) : null; })(),
  }));
  const ontLabel = (() => { const o = T.find((x) => x.p === "rdf:type" && x.o.id === OWL + "Ontology"); return o ? label(o.s) : null; })();
  const ns = (() => { const own = Object.entries(r.prefixes).find(([k, v]) => !DEFAULT_PREFIXES[k] && v); return own ? { prefix: own[0], namespace: own[1] } : null; })();
  if (!classes.length && !concepts.length) return { ok: false, error: "No classes, properties or SKOS concepts found." };
  return { ok: true, name: ontLabel, ns, classes: classes.map(({ iri, ...c }) => ({ ...c, props: c.props.map(({ iri: _i, ...p }) => p) })), rels, constraints, concepts, triples: T.length };
}

// Palantir Foundry ontology export (object types + link types, JSON).
export function importPalantir(text) {
  let j; try { j = JSON.parse(text); } catch (e) { return { ok: false, error: "Not valid JSON." }; }
  const ots = j.objectTypes || [], lts = j.linkTypes || [];
  if (!ots.length) return { ok: false, error: "No objectTypes found." };
  const DT = { string: "string", integer: "integer", long: "integer", double: "decimal", decimal: "decimal", boolean: "boolean", date: "date", timestamp: "dateTime" };
  const classes = ots.map((o) => ({ id: `c_${slug(o.apiName)}`, name: o.displayName || humanize(o.apiName), desc: o.description || "", synonyms: [], parent: null, sameAs: [], termId: null,
    props: Object.entries(o.properties || {}).map(([k, v]) => ({ id: `p_${slug(o.apiName)}_${slug(k)}`, name: v.displayName || humanize(k), datatype: DT[(v.dataType || v.type || "string").toLowerCase()] || "string", required: k === o.primaryKey, desc: v.description || "" })) }));
  const cOf = (api) => classes.find((c) => c.id === `c_${slug(api)}`);
  const CARD = { ONE: "one", MANY: "many" };
  const rels = lts.filter((l) => cOf(l.objectTypeA) && cOf(l.objectTypeB)).map((l) => ({
    id: `r_${slug(l.apiName || `${l.objectTypeA}_${l.objectTypeB}`)}`, from: cOf(l.objectTypeA).id, to: cOf(l.objectTypeB).id,
    name: humanize(l.apiName || "links to").toLowerCase(), inverse: l.inverseApiName ? humanize(l.inverseApiName).toLowerCase() : "",
    cardinality: l.cardinality ? `${CARD[(l.cardinality.a || "MANY").toUpperCase()] || "many"}_to_${CARD[(l.cardinality.b || "ONE").toUpperCase()] || "one"}` : "many_to_one",
    kind: "association", desc: "" }));
  const constraints = ots.filter((o) => o.primaryKey && o.properties && o.properties[o.primaryKey]).map((o) => {
    const c = cOf(o.apiName); const pn = (o.properties[o.primaryKey].displayName) || humanize(o.primaryKey);
    return { id: `k_${c.id}_pk`, classId: c.id, prop: pn, kind: "unique", value: "", severity: "violation", desc: "Primary key" };
  });
  return { ok: true, name: j.name || null, ns: null, classes, rels, constraints, concepts: [] };
}

export function importDocument(format, text) {
  if (format === "palantir") return importPalantir(text);
  return importTurtle(text);
}

// Merge an import into an ontology. Classes match by name (case-insensitive);
// incoming ids are remapped so nothing collides.
export function mergeInto(ont, imp, prov) {
  const out = clone(ont);
  const remap = {};
  imp.classes.forEach((c) => {
    const ex = out.classes.find((x) => x.name.toLowerCase() === c.name.toLowerCase());
    if (ex) { remap[c.id] = ex.id;
      ex.desc = ex.desc || c.desc; ex.synonyms = [...new Set([...(ex.synonyms || []), ...(c.synonyms || [])])];
      (c.props || []).forEach((p) => { if (!(ex.props || []).some((q) => q.name.toLowerCase() === p.name.toLowerCase())) ex.props = [...(ex.props || []), { ...p, id: uid("p") }]; });
      ex.sameAs = [...(ex.sameAs || []), ...(c.sameAs || []).filter((s) => !(ex.sameAs || []).some((y) => y.iri === s.iri))];
    } else { const id = uid("c"); remap[c.id] = id; out.classes.push({ ...c, id, props: (c.props || []).map((p) => ({ ...p, id: uid("p") })), prov }); }
  });
  // Parents: a new class takes its imported parent; an existing one keeps its own.
  const created = new Set(imp.classes.filter((c) => !ont.classes.some((x) => x.id === remap[c.id])).map((c) => remap[c.id]));
  imp.classes.forEach((c) => {
    const t = out.classes.find((x) => x.id === remap[c.id]); if (!t) return;
    if (created.has(t.id)) t.parent = c.parent && remap[c.parent] ? remap[c.parent] : null;
    else if (!t.parent && c.parent && remap[c.parent]) t.parent = remap[c.parent];
  });
  imp.rels.forEach((r) => {
    const from = remap[r.from], to = remap[r.to]; if (!from || !to) return;
    if (out.rels.some((x) => x.from === from && x.to === to && x.name === r.name)) return;
    out.rels.push({ ...r, id: uid("r"), from, to, prov });
  });
  (imp.constraints || []).forEach((k) => {
    const classId = remap[k.classId]; if (!classId) return;
    if (out.constraints.some((x) => x.classId === classId && x.prop === k.prop && x.kind === k.kind)) return;
    out.constraints.push({ ...k, id: uid("k"), classId, prov });
  });
  return out;
}
