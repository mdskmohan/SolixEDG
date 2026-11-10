// ─────────────────────────────────────────────────────────────────────────────
// EDG ontology AI — suggestions for building and checking an ontology.
//
// Pure, like ../semantic/ai.js: the caller passes what the AI may read and gets
// SUGGESTIONS back, each with the same envelope {by:"ai", conf, why, evidence,
// state:"suggested"}. A person accepts or dismisses; nothing here writes.
// ─────────────────────────────────────────────────────────────────────────────
import { envelope, synonymsFor } from "../semantic/ai.js";
import { STANDARDS } from "./standards.js";
import { slug, uid } from "./engine.js";

export { envelope };
const uniq = (a) => [...new Set(a)];
const singular = (s) => String(s || "").replace(/ies$/i, "y").replace(/(ss)$/i, "$1").replace(/([^s])s$/i, "$1");
const title = (s) => String(s || "").trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const pretty = (s) => title(String(s || "").replace(/_/g, " "));
const norm = (s) => singular(String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim());
const toks = (s) => norm(s).split(/\s+/).filter((w) => w.length > 1).map(singular);
const classByName = (ont, n) => (ont.classes || []).find((c) => norm(c.name) === norm(n) || (c.synonyms || []).some((s) => norm(s) === norm(n)));

// Verb phrases for common relationships, and their inverses.
const VERBS = [
  [/order/, /customer|party|user|account/, "placed by", "places"],
  [/transaction|posting|payment|invoice/, /customer|account|party/, "paid by", "pays"],
  [/line|item/, /order/, "part of", "contains"],
  [/line|item/, /product/, "is for", "is sold on"],
  [/line|item|sale/, /store|location|channel/, "sold at", "sells"],
  [/shipment|parcel|delivery/, /order/, "fulfils", "fulfilled by"],
  [/product/, /category/, "classified as", "classifies"],
  [/subscription|contract/, /customer|party/, "held by", "holds"],
  [/event|session/, /user|customer/, "performed by", "performs"],
  [/inventory|stock|position/, /store|location/, "held at", "holds"],
];
export const INVERSES = { "placed by": "places", "paid by": "pays", "part of": "contains", "belongs to": "has", "held by": "holds",
  "issued to": "receives", "classified as": "classifies", "fulfils": "fulfilled by", "sold at": "sells", "is for": "is sold on",
  "performed by": "performs", "held at": "holds", "supplied by": "supplies", "references": "referenced by" };
export function verbFor(fromName, toName) {
  const a = String(fromName).toLowerCase(), b = String(toName).toLowerCase();
  const hit = VERBS.find(([x, y]) => x.test(a) && y.test(b));
  return hit ? { name: hit[2], inverse: hit[3], known: true } : { name: "belongs to", inverse: "has", known: false };
}

// ═════════════════════════════ DRAFT FROM METADATA ═══════════════════════════
// Classes from the datasets of the chosen semantic models (named after the
// glossary concept a dataset realises, when it has one), properties from their
// fields, relationships from their joins, "is a kind of" from glossary broader.
export function draftFromMetadata({ models, entities, joins, dims, facts, concepts, schemaOf }) {
  const ents = entities.filter((e) => models.some((m) => (m.entityIds || []).includes(e.id)));
  const conceptOf = (e) => (concepts || []).find((c) => c.id === e.concept);
  const classes = [], rels = [];
  const modelNames = (e) => models.filter((m) => (m.entityIds || []).includes(e.id)).map((m) => m.name);
  const DT = (t) => { t = String(t || "").toUpperCase(); return /DATE$/.test(t) ? "date" : /TIME/.test(t) ? "dateTime" : /BOOL/.test(t) ? "boolean" : /DEC|NUMERIC|DOUBLE|FLOAT/.test(t) ? "decimal" : /INT|NUMBER|SERIAL/.test(t) ? "integer" : "string"; };
  ents.forEach((e) => {
    const k = conceptOf(e);
    const name = k ? k.name : e.name;
    if (classes.some((c) => norm(c.name) === norm(name))) return;
    const cols = (schemaOf && schemaOf(e.table)) || [];
    const keys = (e.keys && e.keys.length) ? e.keys : [e.key];
    const props = [...(dims || []), ...(facts || [])].filter((f) => f.entity === e.id && f.type !== "identifier" && !keys.includes(f.column))
      .map((f) => ({ id: uid("p"), name: f.name, datatype: DT((cols.find((c) => c.name === f.column) || {}).type), required: false, desc: f.desc || "", column: f.column }));
    classes.push({ id: uid("c"), name, desc: k ? k.definition : (e.desc || ""), synonyms: k ? (k.synonyms || []) : synonymsFor(name), parent: null,
      termId: k ? k.id : null, sameAs: [], props, entity: e.id, broaderName: k && k.broader ? ((concepts || []).find((x) => x.id === k.broader) || {}).name : null,
      ...envelope(k ? 0.93 : 0.78, k ? `Dataset ${e.name} realises the glossary concept ${k.name}` : `Dataset ${e.name} in ${modelNames(e).join(", ")}`,
        [`${e.table} · one row per ${(e.keys || [e.key]).filter(Boolean).join(" + ") || "record"}`, `${props.length} field${props.length === 1 ? "" : "s"} become properties`]) });
  });
  // Broader concepts that are not themselves datasets still belong in the tree.
  classes.slice().forEach((c) => {
    if (!c.broaderName) return;
    if (new RegExp(`^${c.broaderName}\\s+(line|item|detail|entry)$`, "i").test(c.name)) { c.partOfName = c.broaderName; return; }
    let p = classes.find((x) => norm(x.name) === norm(c.broaderName));
    if (!p) { const k = (concepts || []).find((x) => x.name === c.broaderName);
      p = { id: uid("c"), name: c.broaderName, desc: k ? k.definition : "", synonyms: k ? k.synonyms || [] : [], parent: null, termId: k ? k.id : null, sameAs: [], props: [],
        ...envelope(0.9, `Broader concept of ${c.name} in the glossary`) }; classes.push(p); }
    c.parent = p.id;
  });
  const clsOfEnt = (id) => { const e = ents.find((x) => x.id === id); if (!e) return null; const k = conceptOf(e); return classes.find((c) => norm(c.name) === norm(k ? k.name : e.name)); };
  (joins || []).forEach((j) => {
    const A = clsOfEnt(j.from), B = clsOfEnt(j.to);
    if (!A || !B || A.id === B.id) return;
    if (rels.some((r) => r.from === A.id && r.to === B.id)) return;
    const v = verbFor(A.name, B.name);
    rels.push({ id: uid("r"), from: A.id, to: B.id, name: j.role ? `${j.role.toLowerCase()} on` : v.name, inverse: j.role ? "" : v.inverse,
      cardinality: j.cardinality || "many_to_one", kind: v.name === "part of" ? "part_of" : "association", desc: "",
      ...envelope(v.known ? 0.88 : 0.72, `Join ${j.fromKey || (j.fromKeys || []).join("+")} = ${j.toKey || (j.toKeys || []).join("+")} in the semantic model`, [j.note || ""].filter(Boolean)) });
  });
  // A line is part of the thing it is named after, not a kind of it.
  classes.filter((c) => c.partOfName).forEach((c) => {
    const p = classes.find((x) => norm(x.name) === norm(c.partOfName));
    if (p && !rels.some((r) => r.from === c.id && r.to === p.id))
      rels.push({ id: uid("r"), from: c.id, to: p.id, name: "part of", inverse: "contains", cardinality: "many_to_one", kind: "part_of", desc: "",
        ...envelope(0.9, `Glossary: ${c.name} is narrower than ${p.name}, and a ${c.name.toLowerCase()} is part of it`) });
  });
  return { classes: classes.map(({ broaderName, partOfName, ...c }) => c), rels };
}

// ═════════════════════════════ EXTRACT FROM TEXT ═════════════════════════════
// Concepts and relationships stated in a policy, spec or data dictionary. Each
// suggestion quotes the sentence it came from.
export function extractFromText(text) {
  const sentences = String(text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const classes = new Map(), rels = [], isA = [];
  const noun = (s) => title(singular(String(s).replace(/^(the|a|an|each|every|one|exactly one)\s+/i, "").trim()));
  const addC = (n, desc, ev, conf) => { const k = norm(n); if (!k || k.split(" ").length > 4) return;
    const prev = classes.get(k); if (!prev) classes.set(k, { name: noun(n), desc: desc || "", evidence: [ev], conf });
    else { prev.evidence = uniq([...prev.evidence, ev]); prev.conf = Math.min(0.97, Math.max(prev.conf, conf) + 0.04); if (!prev.desc && desc) prev.desc = desc; } };
  sentences.forEach((s) => {
    let m;
    if ((m = s.match(/^(?:an?|the|every|each)\s+([a-z][a-z ]{1,40}?)\s+is\s+(?:an?\s+)?(?:kind|type|form)\s+of\s+([a-z][a-z ]{1,40}?)[.,;]/i))) {
      addC(m[1], "", s, 0.82); addC(m[2], "", s, 0.78); isA.push({ child: noun(m[1]), parent: noun(m[2]), evidence: s, conf: 0.86 }); return;
    }
    if ((m = s.match(/^(?:an?|the)\s+([a-z][a-z ]{1,40}?)\s+is\s+(an?\s+[^.]{8,})\./i))) addC(m[1], m[2].replace(/^./, (c) => c.toUpperCase()) + ".", s, 0.8);
    if ((m = s.match(/(?:each|every|an?|the)\s+([a-z][a-z ]{1,30}?)\s+(?:is|are|must be)\s+([a-z]+ed)\s+by\s+(?:exactly\s+)?(?:one|a|an|the)\s+([a-z][a-z ]{1,30}?)[.,;]/i))) {
      addC(m[1], "", s, 0.8); addC(m[3], "", s, 0.8);
      rels.push({ from: noun(m[1]), to: noun(m[3]), name: `${m[2].toLowerCase()} by`, cardinality: "many_to_one", evidence: s, conf: 0.84 });
    }
    if ((m = s.match(/(?:each|every|an?|the)\s+([a-z][a-z ]{1,30}?)\s+belongs?\s+to\s+(?:exactly\s+)?(?:one|a|an|the)\s+([a-z][a-z ]{1,30}?)[.,;]/i))) {
      addC(m[1], "", s, 0.8); addC(m[2], "", s, 0.8);
      rels.push({ from: noun(m[1]), to: noun(m[2]), name: "belongs to", cardinality: "many_to_one", evidence: s, conf: 0.82 });
    }
    if ((m = s.match(/(?:each|every|an?|the)\s+([a-z][a-z ]{1,30}?)\s+(?:has|have|contains?|carries|holds)\s+(one or more|many|several|multiple|zero or more)\s+([a-z][a-z ]{1,30}?)[.,;]/i))) {
      addC(m[1], "", s, 0.78); addC(m[3], "", s, 0.78);
      rels.push({ from: noun(m[3]), to: noun(m[1]), name: "part of", cardinality: "many_to_one", evidence: s, conf: 0.8 });
    }
  });
  return {
    classes: [...classes.values()].map((c) => ({ name: c.name, desc: c.desc, ...envelope(c.conf, c.evidence.length > 1 ? `Mentioned in ${c.evidence.length} sentences` : "Stated in the document", c.evidence) })),
    rels: rels.map((r) => ({ ...r, ...envelope(r.conf, `"${r.evidence}"`, [r.evidence]) })),
    isA: isA.map((x) => ({ ...x, ...envelope(x.conf, `"${x.evidence}"`, [x.evidence]) })),
  };
}

// ═════════════════════════════ RELATIONSHIP SUGGESTIONS ══════════════════════
export function suggestRelationships(ont, ctx = {}) {
  const out = [];
  const cls = ont.classes || [];
  (ont.rels || []).forEach((r) => {
    const A = cls.find((c) => c.id === r.from), B = cls.find((c) => c.id === r.to); if (!A || !B) return;
    if (!r.inverse) { const inv = INVERSES[r.name] || `has ${A.name.toLowerCase()}`;
      out.push({ key: `inv:${r.id}`, kind: "inverse", relId: r.id, title: `${B.name} ${inv} ${A.name}`, patch: { inverse: inv },
        ...envelope(INVERSES[r.name] ? 0.9 : 0.66, `Inverse of "${r.name}"`) }); }
    if (!r.cardinality) { const card = / by$|belongs to|part of|is for|sold at|held at|fulfils/.test(r.name) ? "many_to_one" : "many_to_many";
      out.push({ key: `card:${r.id}`, kind: "cardinality", relId: r.id, title: `${A.name} ${r.name} ${B.name} · ${card.replace(/_/g, " ")}`, patch: { cardinality: card },
        ...envelope(card === "many_to_one" ? 0.82 : 0.6, card === "many_to_one" ? `"${r.name}" reads as each ${A.name} pointing at one ${B.name}` : "No signal either way") }); }
  });
  cls.forEach((c) => {
    if (c.parent) return;
    // "Retail Customer" is a kind of "Customer".
    const p = cls.find((x) => x.id !== c.id && norm(c.name).endsWith(" " + norm(x.name)));
    if (p) out.push({ key: `isa:${c.id}:${p.id}`, kind: "isA", classId: c.id, parentId: p.id, title: `${c.name} is a kind of ${p.name}`,
      ...envelope(0.86, `"${c.name}" ends with "${p.name}"`) });
  });
  cls.forEach((c) => {
    // "Order Line" is part of "Order".
    const m = norm(c.name).match(/^(.+) (line|item|detail|entry)$/); if (!m) return;
    const p = cls.find((x) => norm(x.name) === m[1]);
    if (p && !(ont.rels || []).some((r) => r.from === c.id && r.to === p.id))
      out.push({ key: `part:${c.id}:${p.id}`, kind: "rel", title: `${c.name} part of ${p.name}`,
        rel: { from: c.id, to: p.id, name: "part of", inverse: "contains", cardinality: "many_to_one", kind: "part_of" },
        ...envelope(0.84, `A ${m[2]} is part of the ${p.name.toLowerCase()} it is named after`) });
  });
  // Joins in semantic models between datasets whose classes are here but unrelated.
  const clsFor = (e) => cls.find((c) => (c.termId && c.termId === e.concept) || norm(c.name) === norm(e.name));
  (ctx.joins || []).forEach((j) => {
    const ea = (ctx.entities || []).find((e) => e.id === j.from), eb = (ctx.entities || []).find((e) => e.id === j.to);
    if (!ea || !eb) return;
    const A = clsFor(ea), B = clsFor(eb); if (!A || !B || A.id === B.id) return;
    if ((ont.rels || []).some((r) => (r.from === A.id && r.to === B.id) || (r.from === B.id && r.to === A.id))) return;
    if (out.some((x) => x.rel && x.rel.from === A.id && x.rel.to === B.id)) return;
    const v = verbFor(A.name, B.name);
    out.push({ key: `join:${j.id}`, kind: "rel", title: `${A.name} ${j.role ? j.role.toLowerCase() + " on" : v.name} ${B.name}`,
      rel: { from: A.id, to: B.id, name: j.role ? `${j.role.toLowerCase()} on` : v.name, inverse: j.role ? "" : v.inverse, cardinality: j.cardinality || "many_to_one", kind: "association" },
      ...envelope(v.known ? 0.85 : 0.7, `Datasets ${ea.name} and ${eb.name} are joined on ${j.fromKey || (j.fromKeys || []).join("+")} = ${j.toKey || (j.toKeys || []).join("+")}`, [j.note || ""].filter(Boolean)) });
  });
  return out.sort((a, b) => b.conf - a.conf);
}

// ═════════════════════════════ DESCRIPTIONS ══════════════════════════════════
export function describeClass(c, ctx = {}) {
  const term = (ctx.glossary || []).find((t) => t.id === c.termId) || (ctx.glossary || []).find((t) => norm(t.name) === norm(c.name));
  if (term && term.definition) return { desc: term.definition, synonyms: uniq([...(term.synonyms || []), ...synonymsFor(c.name)]).slice(0, 5), ...envelope(0.92, `Glossary term ${term.name}`) };
  const ent = (ctx.entities || []).find((e) => norm(e.name) === norm(c.name));
  if (ent && ent.desc) return { desc: ent.desc, synonyms: synonymsFor(c.name), ...envelope(0.74, `Dataset ${ent.name}`) };
  const std = Object.values(STANDARDS).flatMap((s) => s.classes.map((x) => ({ ...x, std: s.label }))).find((x) => norm(x.label) === norm(c.name));
  if (std) return { desc: std.def, synonyms: uniq([...std.syn.map(title), ...synonymsFor(c.name)]).slice(0, 5), ...envelope(0.7, `${std.std} definition of ${std.label}`) };
  return null;
}

// ═════════════════════════════ CONSTRAINTS FROM PROFILES ═════════════════════
// For a class realised by a dataset, the column profiles say what always holds.
export function suggestConstraints(ont, ctx = {}) {
  const out = [];
  (ont.classes || []).forEach((c) => {
    const e = (ctx.entities || []).find((x) => (c.termId && x.concept === c.termId) || norm(x.name) === norm(c.name));
    if (!e) return;
    const cols = (ctx.schemaOf && ctx.schemaOf(e.table)) || [];
    (c.props || []).forEach((p) => {
      const col = cols.find((x) => x.name === p.column || norm(x.name) === norm(p.name) || pretty(x.name) === p.name);
      if (!col) return;
      const pr = (ctx.profileOf && ctx.profileOf(e.table, col.name)) || {};
      const has = (kind) => (ont.constraints || []).some((k) => k.classId === c.id && k.prop === p.name && k.kind === kind);
      const add = (kind, value, conf, why) => { if (!has(kind)) out.push({ key: `${c.id}:${p.name}:${kind}`, classId: c.id, prop: p.name, kind, value, severity: "violation",
        title: `${c.name}.${p.name} · ${({ required: "required", unique: "unique", values: `one of ${value}`, pattern: "matches pattern" })[kind]}`,
        ...envelope(conf, why, [`${e.table}.${col.name}`]) }); };
      if (pr.nullPct === 0 || col.nullable === false) add("required", "", pr.nullPct === 0 ? 0.9 : 0.8, pr.nullPct === 0 ? "Never null in the column profile" : "Declared NOT NULL");
      if (col.pk || pr.distinctPct === 100) add("unique", "", 0.9, col.pk ? "Primary key" : "100% distinct");
      if (pr.topValues && /^[0-9.,]+$/.test(String(pr.distinctCount || "").replace(/[KM]/g, "")) && Number(pr.distinctCount) <= 12)
        add("values", pr.topValues.map((v) => String(v).replace(/\s*\(.*\)/, "")).join(", "), 0.76, `${pr.distinctCount} distinct values in the profile`);
      if (/e?mail/i.test(col.name)) add("pattern", "^[^@\\s]+@[^@\\s]+$", 0.84, "Email column");
    });
  });
  return out.sort((a, b) => b.conf - a.conf);
}

// ═════════════════════════════ STANDARDS ═════════════════════════════════════
export function alignToStandard(ont, std) {
  const S = STANDARDS[std]; if (!S) return [];
  const out = [];
  (ont.classes || []).forEach((c) => {
    const mine = uniq([norm(c.name), ...(c.synonyms || []).map(norm)]);
    let best = null;
    S.classes.forEach((x) => {
      const theirs = uniq([norm(x.label), ...x.syn.map(norm)]);
      // Same name 1 · one of our synonyms is their name 0.9 · names/synonyms overlap 0.85
      const exact = norm(c.name) === norm(x.label) ? 1 : mine.includes(norm(x.label)) ? 0.9 : mine.some((m) => theirs.includes(m)) ? 0.85 : 0;
      const tokenHit = exact ? 0 : (() => { const a = toks(c.name), b = toks(x.label); const h = a.filter((w) => b.includes(w)).length; return h / Math.max(a.length, b.length) * 0.7; })();
      const s = Math.max(exact, tokenHit);
      if (s >= 0.55 && (!best || s > best.s)) best = { s, x };
    });
    if (!best) return;
    const iri = S.base + best.x.id;
    if ((c.sameAs || []).some((y) => y.iri === iri)) return;
    out.push({ key: `std:${c.id}:${iri}`, classId: c.id, title: `${c.name} ≡ ${S.label} ${best.x.label}`, sameAs: { iri, label: best.x.label, standard: S.label },
      ...envelope(0.55 + best.s * 0.4, best.s === 1 ? "Same name" : best.s >= 0.9 ? `Its synonym "${best.x.label}" is the standard's name` : best.s >= 0.85 ? "A synonym matches on both sides" : "Shares words with the standard's class", [best.x.def]) });
  });
  return out.sort((a, b) => b.conf - a.conf);
}

// ═════════════════════════════ DUPLICATES ════════════════════════════════════
export function findDuplicates(onts, focusId) {
  const all = onts.flatMap((o) => (o.classes || []).map((c) => ({ o, c })));
  const out = [];
  all.forEach((a, i) => all.slice(i + 1).forEach((b) => {
    if (focusId && a.o.id !== focusId && b.o.id !== focusId) return;
    const an = [norm(a.c.name), ...(a.c.synonyms || []).map(norm)], bn = [norm(b.c.name), ...(b.c.synonyms || []).map(norm)];
    const same = norm(a.c.name) === norm(b.c.name);
    const syn = !same && (an.includes(norm(b.c.name)) || bn.includes(norm(a.c.name)));
    if (!same && !syn) return;
    const within = a.o.id === b.o.id;
    out.push({ key: `dup:${a.c.id}:${b.c.id}`, within, a: { ontId: a.o.id, ontName: a.o.name, classId: a.c.id, name: a.c.name }, b: { ontId: b.o.id, ontName: b.o.name, classId: b.c.id, name: b.c.name },
      title: within ? `${a.c.name} and ${b.c.name} look like the same class` : `${a.c.name} (${a.o.name}) and ${b.c.name} (${b.o.name}) overlap`,
      ...envelope(same ? 0.92 : 0.78, same ? "Same name" : "One is a synonym of the other") });
  }));
  return out;
}

// ═════════════════════════════ PLAIN-LANGUAGE EDITS ══════════════════════════
// add class Subscription [is a Contract] · add relationship Subscription held by Customer [one to many]
// make Retail Customer a kind of Customer · rename class X to Y · remove class X
export function parseEdit(text, ont) {
  const s = String(text || "").trim().replace(/\.$/, "");
  const find = (n) => classByName(ont, n);
  let m;
  if ((m = s.match(/^(?:add|create)\s+(?:a\s+)?class\s+(.+?)(?:\s*,?\s+(?:is a kind of|is an?|kind of|a kind of)\s+(.+))?$/i))) {
    const name = title(m[1]); if (find(name)) return { ok: false, error: `${name} already exists.` };
    const parent = m[2] ? find(m[2]) : null; if (m[2] && !parent) return { ok: false, error: `No class called ${m[2]}.` };
    return { ok: true, action: "addClass", summary: `Add class ${name}${parent ? ` as a kind of ${parent.name}` : ""}`, cls: { name, parent: parent ? parent.id : null } };
  }
  if ((m = s.match(/^make\s+(.+?)\s+a kind of\s+(.+)$/i))) {
    const c = find(m[1]), p = find(m[2]); if (!c || !p) return { ok: false, error: `No class called ${!c ? m[1] : m[2]}.` };
    return { ok: true, action: "setParent", summary: `${c.name} is a kind of ${p.name}`, classId: c.id, parent: p.id };
  }
  if ((m = s.match(/^(?:add|create)\s+(?:a\s+)?relationship\s+(.+?)(?:\s*\((one to many|many to one|one to one|many to many)\))?$/i))) {
    const body = m[1]; const names = (ont.classes || []).map((c) => c.name).sort((a, b) => b.length - a.length);
    const from = names.find((n) => body.toLowerCase().startsWith(n.toLowerCase() + " "));
    const to = from && names.find((n) => body.toLowerCase().endsWith(" " + n.toLowerCase()) && body.length > from.length + n.length + 1);
    if (!from || !to) return { ok: false, error: "Name two existing classes, e.g. add relationship Order placed by Customer." };
    const verb = body.slice(from.length, body.length - to.length).trim().toLowerCase();
    const A = find(from), B = find(to);
    return { ok: true, action: "addRel", summary: `Add relationship ${A.name} ${verb} ${B.name}`,
      rel: { from: A.id, to: B.id, name: verb, inverse: INVERSES[verb] || "", cardinality: m[2] ? m[2].replace(/ /g, "_") : (/ by$|part of|belongs to/.test(verb) ? "many_to_one" : ""), kind: verb === "part of" ? "part_of" : "association" } };
  }
  if ((m = s.match(/^rename\s+(?:class\s+)?(.+?)\s+to\s+(.+)$/i))) {
    const c = find(m[1]); if (!c) return { ok: false, error: `No class called ${m[1]}.` };
    return { ok: true, action: "renameClass", summary: `Rename ${c.name} to ${title(m[2])}`, classId: c.id, name: title(m[2]) };
  }
  if ((m = s.match(/^(?:remove|delete)\s+(?:class\s+)?(.+)$/i))) {
    const c = find(m[1]); if (!c) return { ok: false, error: `No class called ${m[1]}.` };
    const n = (ont.rels || []).filter((r) => r.from === c.id || r.to === c.id).length;
    return { ok: true, action: "removeClass", summary: `Remove ${c.name}${n ? ` and its ${n} relationship${n === 1 ? "" : "s"}` : ""}`, classId: c.id };
  }
  return { ok: false, error: "Try: add class <name> [is a kind of <class>] · add relationship <class> <verb> <class> (many to one) · make <class> a kind of <class> · rename class <name> to <name> · remove class <name>" };
}

export const FEATURES = [
  { k: "draft", l: "Draft from metadata" }, { k: "extract", l: "Extract from documents" }, { k: "relationships", l: "Relationships, inverses and hierarchy" },
  { k: "descriptions", l: "Definitions and synonyms" }, { k: "constraints", l: "Constraints from profiles" }, { k: "standards", l: "Align to standards" },
  { k: "duplicates", l: "Duplicate and overlapping classes" }, { k: "changes", l: "Version summaries" }, { k: "edit", l: "Plain-language edits" },
];
export const INPUTS = [
  { k: "models", l: "Semantic models", ex: "Datasets, fields, joins", required: true },
  { k: "glossary", l: "Glossary", ex: "Concept terms, definitions, broader" },
  { k: "profiles", l: "Column profiles", ex: "0% null · 100% distinct · 5 values" },
  { k: "documents", l: "Documents", ex: "Policies, specs, data dictionaries" },
  { k: "standards", l: "Industry standards", ex: "schema.org, FIBO" },
];
export { slug };
