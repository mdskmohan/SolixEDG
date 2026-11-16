// ─────────────────────────────────────────────────────────────────────────────
// EDG mapping engine — how an ontology is realised by data.
//
// A mapping record ties one ontology element to one data element:
//
//   dataset  class        ← semantic-model dataset (+ the key that identifies an instance)
//   table    class        ← catalog table not yet in any semantic model
//   field    property     ← dataset field / column
//   join     relationship ← semantic-model join
//   metric   class        ← metric that measures instances of the class
//
//   { id, kind, classId, propId?, relId?, target:{entityId?, assetId?, table?, column?, fieldId?, joinId?, metricId?, keys?},
//     status:"approved", by, at, prov? }
//
// Mappings live on the ontology, so they are versioned and published with it.
// Pure: suggestions, coverage and drift are computed from what the caller passes.
//
// ctx = { entities, joins, dims, facts, metrics, models, assets, schemaOf(table), profileOf(table,col), settings? }
// ─────────────────────────────────────────────────────────────────────────────
import { envelope } from "../semantic/ai.js";

const uniq = (a) => [...new Set(a)];
const singular = (s) => String(s || "").replace(/ies$/i, "y").replace(/(ss)$/i, "$1").replace(/([^s])s$/i, "$1");
const norm = (s) => singular(String(s || "").toLowerCase().replace(/[_\-]+/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim());
const toks = (s) => norm(s).split(" ").filter((w) => w.length > 1).map(singular);
const stem = (t) => norm(String(t || "").replace(/^(dim|fct|fact|vw|stg|raw)_/, "").replace(/_(fact|dim|archive)$/, ""));
export const similarity = (a, b) => {
  const x = toks(a), y = toks(b); if (!x.length || !y.length) return 0;
  const hit = x.filter((w) => y.includes(w)).length;
  return hit / Math.max(x.length, y.length);
};
const keysOf = (e) => (e && e.keys && e.keys.length) ? e.keys : (e && e.key ? [e.key] : []);
const DT_OF = (t) => { t = String(t || "").toUpperCase(); return /DATE$/.test(t) ? "date" : /TIME/.test(t) ? "dateTime" : /BOOL/.test(t) ? "boolean" : /DEC|NUMERIC|DOUBLE|FLOAT/.test(t) ? "decimal" : /INT|NUMBER|SERIAL/.test(t) ? "integer" : "string"; };
const compatible = (prop, colType) => {
  const a = prop || "string", b = DT_OF(colType);
  if (a === b) return true;
  if ((a === "decimal" && b === "integer") || (a === "integer" && b === "decimal")) return true;
  if ((a === "date" && b === "dateTime") || (a === "dateTime" && b === "date")) return true;
  return a === "string";
};

export const KINDS = { dataset: "Dataset", table: "Catalog table", field: "Field", join: "Join", metric: "Metric" };
export const mappingsOf = (ont) => ont.mappings || [];
export const datasetOf = (ont, classId) => mappingsOf(ont).find((m) => (m.kind === "dataset" || m.kind === "table") && m.classId === classId);
const cls = (ont, id) => (ont.classes || []).find((c) => c.id === id);
const propOf = (ont, classId, propId) => ((cls(ont, classId) || {}).props || []).find((p) => p.id === propId);

// ═════════════════════════════ SUGGESTIONS ═══════════════════════════════════
// Datasets first; fields, joins and metrics are suggested for classes whose
// dataset mapping already exists, so an accepted dataset unlocks the rest.
export function suggestMappings(ont, ctx) {
  const out = [];
  const maps = mappingsOf(ont);
  const ents = ctx.entities || [];
  const col = (t, c) => ((ctx.schemaOf && ctx.schemaOf(t)) || []).find((x) => x.name === c);
  const entOf = (m) => m && m.target && m.target.entityId ? ents.find((e) => e.id === m.target.entityId) : null;
  const modelsOf = (eid) => (ctx.models || []).filter((m) => (m.entityIds || []).includes(eid)).map((m) => m.name);
  const takenEnt = new Set(maps.filter((m) => m.kind === "dataset").map((m) => m.target.entityId));

  // 1 · dataset → class
  (ont.classes || []).forEach((c) => {
    if (datasetOf(ont, c.id)) return;
    let best = null;
    ents.forEach((e) => {
      let s = 0; const ev = [];
      if (c.termId && e.concept === c.termId) { s = 0.97; ev.push(`Dataset realises the glossary concept this class names`); }
      const names = [c.name, ...(c.synonyms || [])];
      const nm = Math.max(...names.map((n) => (norm(n) === norm(e.name) ? 1 : 0)));
      if (nm) { s = Math.max(s, 0.88); ev.push(`Same name: ${e.name}`); }
      const st = Math.max(...names.map((n) => (norm(n) === stem(e.table) ? 1 : similarity(n, e.table))));
      if (!nm && st >= 0.99) { s = Math.max(s, 0.8); ev.push(`Table ${e.table} is named after it`); }
      // Sharing one word ("Purchase Order" / "orders") is weak evidence: below the default threshold.
      else if (!nm && st >= 0.5) { s = Math.max(s, 0.45 + st * 0.2); ev.push(`Table ${e.table} shares words with it`); }
      if (!s) return;
      if (takenEnt.has(e.id)) { s -= 0.15; ev.push("Already mapped to another class"); }
      if (!best || s > best.s) best = { s, e, ev };
    });
    if (best) {
      out.push({ key: `ds:${c.id}:${best.e.id}`, kind: "dataset", classId: c.id, target: { entityId: best.e.id, keys: keysOf(best.e) },
        title: `${c.name} ← ${best.e.name}`, sub: `${best.e.table} · one ${c.name.toLowerCase()} per ${keysOf(best.e).join(" + ") || "row"}${modelsOf(best.e.id).length ? ` · ${modelsOf(best.e.id).join(", ")}` : ""}`,
        ...envelope(best.s, best.ev[0], best.ev) });
      return;
    }
    // Gap: no semantic dataset — look in the catalog.
    const names = [c.name, ...(c.synonyms || [])];
    const inModels = new Set(ents.map((e) => e.table));
    let bestA = null;
    (ctx.assets || []).filter((a) => !inModels.has(a.name)).forEach((a) => {
      const s = Math.max(...names.map((n) => (norm(n) === stem(a.name) ? 1 : similarity(n, a.name))));
      if (s >= 0.5 && (!bestA || s > bestA.s)) bestA = { s, a };
    });
    if (bestA) {
      const pk = ((ctx.schemaOf && ctx.schemaOf(bestA.a.name)) || []).filter((x) => x.pk).map((x) => x.name);
      out.push({ key: `tb:${c.id}:${bestA.a.id}`, kind: "table", classId: c.id, target: { assetId: bestA.a.id, table: bestA.a.name, keys: pk },
        title: `${c.name} ← ${bestA.a.name}`, sub: `Catalog table · not in any semantic model${pk.length ? ` · key ${pk.join(" + ")}` : ""}`,
        ...envelope(0.6 + bestA.s * 0.2, bestA.s === 1 ? `Table ${bestA.a.name} is named after it` : `Table ${bestA.a.name} shares words with it`, [bestA.a.db || ""].filter(Boolean)) });
    } else out.push({ key: `gap:${c.id}`, kind: "gap", classId: c.id, title: `${c.name} has no data`, sub: "No dataset or catalog table matches", conf: 0, why: "Nothing found" });
  });

  // 2 · field → property (for mapped datasets)
  maps.filter((m) => m.kind === "dataset" || m.kind === "table").forEach((dm) => {
    const c = cls(ont, dm.classId); if (!c) return;
    const e = entOf(dm); const table = e ? e.table : dm.target.table;
    const columns = (ctx.schemaOf && ctx.schemaOf(table)) || [];
    const fields = e ? [...(ctx.dims || []), ...(ctx.facts || [])].filter((f) => f.entity === e.id) : [];
    const usedCols = new Set(maps.filter((m) => m.kind === "field" && m.classId === c.id).map((m) => m.target.column));
    (c.props || []).forEach((p) => {
      if (maps.some((m) => m.kind === "field" && m.classId === c.id && m.propId === p.id)) return;
      let best = null;
      columns.forEach((cl) => {
        const f = fields.find((x) => x.column === cl.name);
        let s = 0; const ev = [];
        if (p.column && p.column === cl.name) { s = 0.96; ev.push(`Property was drafted from column ${cl.name}`); }
        if (f && norm(f.name) === norm(p.name)) { s = Math.max(s, 0.93); ev.push(`Field ${f.name} has the same name`); }
        if (norm(cl.name) === norm(p.name)) { s = Math.max(s, 0.9); ev.push(`Column ${cl.name} has the same name`); }
        const sim = Math.max(similarity(p.name, cl.name), f ? similarity(p.name, f.name) : 0);
        if (!s && sim >= 0.5) { s = 0.5 + sim * 0.25; ev.push(`Column ${cl.name} shares words with it`); }
        if (!s) return;
        if (!compatible(p.datatype, cl.type)) { s -= 0.25; ev.push(`Types differ: ${p.datatype} vs ${cl.type}`); }
        if (usedCols.has(cl.name)) s -= 0.2;
        const pr = (ctx.profileOf && ctx.profileOf(table, cl.name)) || {};
        if (pr.nullPct != null) ev.push(`${pr.nullPct}% null${pr.distinctCount ? ` · ${pr.distinctCount} distinct` : ""}`);
        if (!best || s > best.s) best = { s, cl, f, ev };
      });
      if (best && best.s >= 0.5) out.push({ key: `fd:${c.id}:${p.id}`, kind: "field", classId: c.id, propId: p.id,
        target: { entityId: e ? e.id : null, table, column: best.cl.name, fieldId: best.f ? best.f.id : null },
        title: `${c.name}.${p.name} ← ${table}.${best.cl.name}`, sub: `${p.datatype || "string"} ← ${best.cl.type}${best.f ? ` · field ${best.f.name}` : ""}`,
        ...envelope(best.s, best.ev[0], best.ev) });
    });
  });

  // 3 · join → relationship
  (ont.rels || []).forEach((r) => {
    if (maps.some((m) => m.kind === "join" && m.relId === r.id)) return;
    const A = datasetOf(ont, r.from), B = datasetOf(ont, r.to);
    if (!A || !B || A.kind !== "dataset" || B.kind !== "dataset") return;
    const ea = A.target.entityId, eb = B.target.entityId;
    const fwd = (ctx.joins || []).filter((j) => j.from === ea && j.to === eb);
    const rev = (ctx.joins || []).filter((j) => j.from === eb && j.to === ea);
    const ca = cls(ont, r.from), cb = cls(ont, r.to);
    // A role-playing join whose role names the relationship wins.
    const pick = fwd.find((j) => j.role && norm(r.name).includes(norm(j.role))) || fwd[0] || rev[0];
    if (pick) out.push({ key: `jn:${r.id}`, kind: "join", relId: r.id, classId: r.from, target: { joinId: pick.id },
      title: `${ca.name} ${r.name} ${cb.name} ← join`, sub: `${(pick.fromKeys || [pick.fromKey]).join("+")} = ${(pick.toKeys || [pick.toKey]).join("+")}${pick.role ? ` · ${pick.role}` : ""}`,
      ...envelope(fwd.includes(pick) ? (pick.cardinality === r.cardinality || !r.cardinality ? 0.93 : 0.78) : 0.7,
        fwd.includes(pick) ? (pick.cardinality && r.cardinality && pick.cardinality !== r.cardinality ? `Join is ${pick.cardinality.replace(/_/g, " ")}, relationship says ${r.cardinality.replace(/_/g, " ")}` : "The only join between the two datasets, same direction")
          : "Join runs the other way", [pick.note || ""].filter(Boolean)) });
    else out.push({ key: `jgap:${r.id}`, kind: "gap", relId: r.id, classId: r.from, title: `${ca.name} ${r.name} ${cb.name} has no join`,
      sub: `Declare a join between their datasets in the semantic model`, conf: 0, why: "No join found" });
  });

  // 4 · metric → class it measures
  const byEnt = new Map(maps.filter((m) => m.kind === "dataset").map((m) => [m.target.entityId, m.classId]));
  (ctx.metrics || []).forEach((mt) => {
    if (maps.some((m) => m.kind === "metric" && m.target.metricId === mt.id)) return;
    const cid = byEnt.get(mt.entity); if (!cid) return;
    const model = (ctx.models || []).find((x) => x.id === mt.model);
    out.push({ key: `mt:${mt.id}`, kind: "metric", classId: cid, target: { metricId: mt.id },
      title: `${mt.name} measures ${cls(ont, cid).name}`, sub: `${model ? model.name : "—"} · computed over the ${(ents.find((e) => e.id === mt.entity) || {}).name} dataset`,
      ...envelope(mt.status === "Approved" ? 0.9 : 0.82, `${mt.name} is computed on the dataset ${cls(ont, cid).name} is mapped to`) });
  });
  return out.sort((a, b) => (b.conf || 0) - (a.conf || 0));
}

// Turn an accepted suggestion into a mapping record.
export function toMapping(s, actor, now) {
  return { id: `map_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind: s.kind, classId: s.classId,
    ...(s.propId ? { propId: s.propId } : {}), ...(s.relId ? { relId: s.relId } : {}), target: { ...s.target },
    status: "approved", by: actor, at: (now ? new Date(now) : new Date()).toISOString(), prov: { by: "ai", conf: s.conf, why: s.why } };
}

// ═════════════════════════════ COVERAGE ══════════════════════════════════════
export function coverage(ont, ctx = {}) {
  const maps = mappingsOf(ont);
  const classes = ont.classes || [];
  const props = classes.flatMap((c) => (c.props || []).map((p) => ({ c, p })));
  const rels = ont.rels || [];
  const mappedC = classes.filter((c) => datasetOf(ont, c.id));
  const mappedP = props.filter(({ c, p }) => maps.some((m) => m.kind === "field" && m.classId === c.id && m.propId === p.id));
  const mappedR = rels.filter((r) => maps.some((m) => m.kind === "join" && m.relId === r.id));
  const mEnts = new Set(maps.filter((m) => m.kind === "dataset").map((m) => m.target.entityId));
  const reachable = (ctx.metrics || []).filter((m) => mEnts.has(m.entity));
  const mappedM = reachable.filter((m) => maps.some((x) => x.kind === "metric" && x.target.metricId === m.id));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 100);
  return {
    classes: { mapped: mappedC.length, total: classes.length, pct: pct(mappedC.length, classes.length) },
    props: { mapped: mappedP.length, total: props.length, pct: pct(mappedP.length, props.length) },
    rels: { mapped: mappedR.length, total: rels.length, pct: pct(mappedR.length, rels.length) },
    metrics: { mapped: mappedM.length, total: reachable.length, pct: pct(mappedM.length, reachable.length) },
    perClass: classes.map((c) => {
      const ps = c.props || [];
      const ds = datasetOf(ont, c.id);
      return { classId: c.id, name: c.name, dataset: ds ? (ds.kind === "table" ? ds.target.table : ds.target.entityId) : null, datasetKind: ds ? ds.kind : null,
        props: { mapped: ps.filter((p) => maps.some((m) => m.kind === "field" && m.classId === c.id && m.propId === p.id)).length, total: ps.length },
        rels: { mapped: rels.filter((r) => r.from === c.id && maps.some((m) => m.kind === "join" && m.relId === r.id)).length, total: rels.filter((r) => r.from === c.id).length },
        metrics: maps.filter((m) => m.kind === "metric" && m.classId === c.id).length };
    }),
  };
}

// ═════════════════════════════ DRIFT ═════════════════════════════════════════
// A mapping breaks when either side moves: a column renamed or dropped, a field,
// join, metric or dataset removed, or the class / property / relationship it
// realises removed from the ontology. Each finding carries a fix as data.
export function drift(ont, ctx) {
  const out = [];
  const ents = ctx.entities || [];
  const push = (m, severity, title, explain, fix) => out.push({ key: `dr:${m.id}`, mappingId: m.id, severity, title, explain, fix: fix || { kind: "removeMapping", mappingId: m.id, label: "Remove mapping" } });
  mappingsOf(ont).forEach((m) => {
    const c = cls(ont, m.classId);
    if (!c) return push(m, "error", "Mapping for a removed class", "The class it realised is no longer in the ontology.");
    if (m.kind === "dataset") {
      const e = ents.find((x) => x.id === m.target.entityId);
      if (!e) return push(m, "error", `${c.name}'s dataset was removed`, "The semantic-model dataset no longer exists.");
      const k = keysOf(e);
      if (m.target.keys && m.target.keys.length && k.join("+") !== m.target.keys.join("+"))
        push(m, "warning", `${c.name}'s key changed`, `Mapped with key ${m.target.keys.join(" + ")}; the dataset's grain is now ${k.join(" + ") || "undeclared"}.`,
          { kind: "updateTarget", mappingId: m.id, patch: { keys: k }, label: `Use ${k.join(" + ")}` });
    }
    if (m.kind === "table") {
      const cols = (ctx.schemaOf && ctx.schemaOf(m.target.table)) || [];
      if (!cols.length) push(m, "error", `${c.name}'s table ${m.target.table} is gone`, "The catalog no longer has a schema for it.");
    }
    if (m.kind === "field") {
      const p = propOf(ont, m.classId, m.propId);
      if (!p) return push(m, "error", `Mapping for a removed property of ${c.name}`, "The property is no longer on the class.");
      const table = m.target.table || (ents.find((x) => x.id === m.target.entityId) || {}).table;
      const cols = (ctx.schemaOf && ctx.schemaOf(table)) || [];
      if (!cols.some((x) => x.name === m.target.column)) {
        const mapped = new Set(mappingsOf(ont).filter((x) => x.kind === "field" && x.id !== m.id).map((x) => x.target.column));
        const cand = cols.filter((x) => !mapped.has(x.name)).map((x) => ({ x, s: similarity(m.target.column, x.name) + (x.name.startsWith(m.target.column.split("_")[0]) ? 0.1 : 0) }))
          .sort((a, b) => b.s - a.s)[0];
        if (cand && cand.s >= 0.5)
          push(m, "error", `${table}.${m.target.column} no longer exists`, `${c.name}.${p.name} points at a column that was renamed or dropped. ${cand.x.name} looks like the same column.`,
            { kind: "updateTarget", mappingId: m.id, patch: { column: cand.x.name }, label: `Re-point to ${cand.x.name}`, conf: Math.min(0.95, 0.6 + cand.s * 0.35) });
        else push(m, "error", `${table}.${m.target.column} no longer exists`, `${c.name}.${p.name} points at a column that was dropped.`);
      } else if (m.target.fieldId && ![...(ctx.dims || []), ...(ctx.facts || [])].some((f) => f.id === m.target.fieldId)) {
        push(m, "warning", `The field behind ${c.name}.${p.name} was removed from its model`, "The column still exists, so the mapping can stay on the column.",
          { kind: "updateTarget", mappingId: m.id, patch: { fieldId: null }, label: "Keep on the column" });
      }
    }
    if (m.kind === "join") {
      const r = (ont.rels || []).find((x) => x.id === m.relId);
      if (!r) return push(m, "error", "Mapping for a removed relationship", "The relationship is no longer in the ontology.");
      if (!(ctx.joins || []).some((j) => j.id === m.target.joinId)) {
        const A = datasetOf(ont, r.from), B = datasetOf(ont, r.to);
        const alt = A && B && (ctx.joins || []).find((j) => j.from === A.target.entityId && j.to === B.target.entityId);
        push(m, "error", `The join behind ${c.name} ${r.name} was removed`, alt ? "Another join connects the same datasets." : "No join connects the two datasets any more.",
          alt ? { kind: "updateTarget", mappingId: m.id, patch: { joinId: alt.id }, label: "Use the other join" } : null);
      }
    }
    if (m.kind === "metric" && !(ctx.metrics || []).some((x) => x.id === m.target.metricId))
      push(m, "warning", `A metric measuring ${c.name} was removed`, "The metric no longer exists in any semantic model.");
  });
  return out;
}

export function applyFix(ont, fix) {
  if (!fix) return ont;
  if (fix.kind === "removeMapping") return { ...ont, mappings: mappingsOf(ont).filter((m) => m.id !== fix.mappingId) };
  if (fix.kind === "updateTarget") return { ...ont, mappings: mappingsOf(ont).map((m) => m.id === fix.mappingId ? { ...m, target: { ...m.target, ...fix.patch } } : m) };
  return ont;
}

// Readable description of a mapping's target.
export function describeTarget(m, ctx) {
  const e = (ctx.entities || []).find((x) => x.id === (m.target || {}).entityId);
  if (m.kind === "dataset") return e ? `${e.name} (${e.table})` : "missing dataset";
  if (m.kind === "table") return `${m.target.table} (catalog)`;
  if (m.kind === "field") return `${m.target.table || (e && e.table) || "?"}.${m.target.column}`;
  if (m.kind === "join") { const j = (ctx.joins || []).find((x) => x.id === m.target.joinId); return j ? `${(j.fromKeys || [j.fromKey]).join("+")} = ${(j.toKeys || [j.toKey]).join("+")}` : "missing join"; }
  if (m.kind === "metric") { const x = (ctx.metrics || []).find((y) => y.id === m.target.metricId); return x ? x.name : "missing metric"; }
  return "—";
}
