// ─────────────────────────────────────────────────────────────────────────────
// EDG context engine — deterministic, no LLM.
//
// Pure functions over the same records the screens edit. The UI, the JSON/API
// preview, the request history and the tests all call these, so what a person
// reads and what an agent would receive cannot drift apart.
//
//   relationships  — typed term↔term edges with source/target rules, duplicate
//                    and cycle prevention, review status and provenance
//   links          — model element (metric / field / dataset) ↔ glossary term
//   versions       — immutable snapshots of a semantic model; one is published
//   validation     — issues for a chosen version, each pointing at what to fix
//   context        — retrieval + traversal + trust evidence + profile rules
//   impact         — potential impact from stored dependencies vs observed use
// ─────────────────────────────────────────────────────────────────────────────

const clone = (x) => JSON.parse(JSON.stringify(x));
const uniq = (a) => [...new Set(a)];
const nowIso = (now) => (now ? new Date(now) : new Date()).toISOString();

// ═════════════════════════════ RELATIONSHIPS ═════════════════════════════════
// Types are data. `from`/`to` list the glossary term types allowed at each end;
// `acyclic` types are hierarchies or derivations where a loop is meaningless;
// `symmetric` types are stored once and read the same from both ends.
export const REL_TYPES = {
  is_a:            { l: "is a kind of",       inv: "has kind",              from: ["Concept"], to: ["Concept"], acyclic: true },
  part_of:         { l: "is part of",         inv: "contains",              from: ["Concept"], to: ["Concept"], acyclic: true },
  placed_by:       { l: "is placed by",       inv: "places",                from: ["Concept"], to: ["Concept"] },
  belongs_to:      { l: "belongs to",         inv: "has",                   from: ["Concept"], to: ["Concept"] },
  paid_by:         { l: "is paid by",         inv: "pays for",              from: ["Concept"], to: ["Concept"] },
  supplied_by:     { l: "is supplied by",     inv: "supplies",              from: ["Concept"], to: ["Concept"] },
  classifies:      { l: "classifies",         inv: "is classified by",      from: ["Dimension"], to: ["Concept"] },
  measures:        { l: "measures",           inv: "is measured by",        from: ["Metric"], to: ["Concept"] },
  calculated_from: { l: "is calculated from", inv: "is an input to",        from: ["Metric"], to: ["Metric"], acyclic: true },
  related_to:      { l: "is related to",      inv: "is related to",         from: ["Term", "Concept", "Metric", "Dimension"], to: ["Term", "Concept", "Metric", "Dimension"], symmetric: true },
};

export const REL_STATUS = { approved: "Approved", proposed: "Proposed", rejected: "Rejected", removed: "Removed" };
const LIVE_REL = (r) => r.status !== "rejected" && r.status !== "removed";

const termType = (t) => (t && (t.termType || "Term")) || "Term";

// Returns {ok, errors[]}; each error carries a code a test can assert on and a
// sentence a person can act on.
export function checkRelationship(rels, terms, { from, to, type }, opts = {}) {
  const errors = [];
  const rt = REL_TYPES[type];
  const a = terms.find(t => t.id === from), b = terms.find(t => t.id === to);
  if (!rt) errors.push({ code: "type", msg: "Choose a relationship type." });
  if (!a) errors.push({ code: "from", msg: "Choose the source term." });
  if (!b) errors.push({ code: "to", msg: "Choose the target term." });
  if (errors.length) return { ok: false, errors };
  if (from === to) return { ok: false, errors: [{ code: "self", msg: "A term cannot be related to itself." }] };
  if (!rt.from.includes(termType(a)))
    errors.push({ code: "source_type", msg: `"${rt.l}" must start from a ${rt.from.join(" or ")} — ${a.term} is a ${termType(a)}.` });
  if (!rt.to.includes(termType(b)))
    errors.push({ code: "target_type", msg: `"${rt.l}" must point to a ${rt.to.join(" or ")} — ${b.term} is a ${termType(b)}.` });
  for (const t of [a, b]) if (t.status === "Deprecated" || t.status === "Rejected")
    errors.push({ code: "inactive_term", msg: `${t.term} is ${t.status} and cannot take new relationships.` });
  const live = rels.filter(r => LIVE_REL(r) && r.id !== opts.ignoreId);
  const dup = live.find(r => r.type === type && ((r.from === from && r.to === to) || (rt.symmetric && r.from === to && r.to === from)));
  if (dup) errors.push({ code: "duplicate", msg: `${a.term} already ${rt.l} ${b.term}${dup.status === "proposed" ? " (awaiting review)" : ""}.` });
  if (rt.acyclic) {
    // Would from→to close a loop? Only if `to` already reaches `from` through the same type.
    const path = findPath(live.filter(r => r.type === type), to, from);
    if (path) errors.push({ code: "cycle", msg: `This creates a loop: ${[b, ...path.map(id => terms.find(t => t.id === id))].map(t => t ? t.term : "?").join(" → ")} → ${b.term}. "${rt.l}" cannot loop.` });
  }
  // A hierarchy may not be expressed in both directions with different types either.
  if (rt.acyclic) {
    const reverse = live.find(r => REL_TYPES[r.type] && REL_TYPES[r.type].acyclic && r.from === to && r.to === from);
    if (reverse && !errors.some(e => e.code === "cycle"))
      errors.push({ code: "cycle", msg: `${b.term} already ${REL_TYPES[reverse.type].l} ${a.term}; the reverse would make a loop.` });
  }
  return { ok: errors.length === 0, errors };
}

function findPath(edges, start, goal) {
  const seen = new Set([start]); const q = [[start, []]];
  while (q.length) {
    const [n, p] = q.shift();
    for (const e of edges.filter(e => e.from === n)) {
      if (e.to === goal) return [...p, e.to];
      if (!seen.has(e.to)) { seen.add(e.to); q.push([e.to, [...p, e.to]]); }
    }
  }
  return null;
}

// Every relationship a term takes part in, read from ITS side — the outgoing ones
// with the forward label and the incoming ones with the inverse label.
export function relationsOf(termId, rels, terms, { includeInactive = false } = {}) {
  return rels.filter(r => (includeInactive || LIVE_REL(r)) && (r.from === termId || r.to === termId)).map(r => {
    const rt = REL_TYPES[r.type] || { l: r.type, inv: r.type };
    const out = r.from === termId;
    const otherId = out ? r.to : r.from;
    return { rel: r, otherId, other: terms.find(t => t.id === otherId) || null,
      label: out || rt.symmetric ? rt.l : rt.inv, direction: out ? "out" : "in" };
  });
}

export function proposeRelationship(rels, terms, input, actor, now) {
  const chk = checkRelationship(rels, terms, input);
  if (!chk.ok) return { ok: false, errors: chk.errors, rels };
  const at = nowIso(now);
  const r = { id: input.id || `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    from: input.from, to: input.to, type: input.type, note: input.note || "",
    status: "proposed", source: input.source || "user", proposedBy: actor, proposedAt: at,
    history: [{ action: "Proposed", by: actor, at, note: input.note || "" }] };
  return { ok: true, rel: r, rels: [...rels, r] };
}

export function reviewRelationship(rels, id, decision, actor, note, now) {
  const r = rels.find(x => x.id === id);
  if (!r) return { ok: false, error: "Relationship not found.", rels };
  if (r.status !== "proposed") return { ok: false, error: `Only a proposed relationship can be reviewed — this one is ${r.status}.`, rels };
  if (decision === "reject" && !String(note || "").trim()) return { ok: false, error: "Give a reason for rejecting.", rels };
  const at = nowIso(now);
  const status = decision === "approve" ? "approved" : "rejected";
  return { ok: true, rels: rels.map(x => x.id !== id ? x : { ...x, status, reviewedBy: actor, reviewedAt: at, reviewNote: note || "",
    history: [...(x.history || []), { action: status === "approved" ? "Approved" : "Rejected", by: actor, at, note: note || "" }] }) };
}

export function removeRelationship(rels, id, actor, note, now) {
  const at = nowIso(now);
  return rels.map(x => x.id !== id ? x : { ...x, status: "removed", removedBy: actor, removedAt: at,
    history: [...(x.history || []), { action: "Removed", by: actor, at, note: note || "" }] });
}

// ════════════════════════════════ LINKS ═══════════════════════════════════════
// The approved link lives ON the element (metric.termId, field.termId,
// dataset.concept) so every existing screen that reads those keeps working.
// Proposals, rejections and history live in link records.
export const LINK_KINDS = {
  metric:  { coll: "metrics",  field: "termId",  allowed: ["Metric", "Term"],              l: "Metric" },
  field:   { coll: "dims",     field: "termId",  allowed: ["Dimension", "Term", "Metric"], l: "Field" },
  measure: { coll: "facts",    field: "termId",  allowed: ["Metric", "Term", "Dimension"], l: "Field" },
  dataset: { coll: "entities", field: "concept", allowed: ["Concept"],                     l: "Dataset" },
};

export function elementOf(sl, kind, id) {
  const k = LINK_KINDS[kind]; if (!k) return null;
  return (sl[k.coll] || []).find(x => x.id === id) || null;
}

// Models an element belongs to (datasets are shared across models).
export function modelsOfElement(sl, kind, el) {
  if (!el) return [];
  if (kind === "metric") return sl.models.filter(m => m.id === el.model);
  const entId = kind === "dataset" ? el.id : el.entity;
  return sl.models.filter(m => (m.entityIds || []).includes(entId));
}

export function elementName(sl, kind, el) {
  if (!el) return "—";
  if (kind === "dataset") return el.name;
  if (kind === "metric") return el.name;
  const ent = sl.entities.find(e => e.id === el.entity);
  return `${ent ? ent.name + "." : ""}${el.name}`;
}

// All links as one list: approved ones from the elements, pending/rejected/removed
// from the records. An approved record whose element no longer carries the term
// (edited elsewhere, or reset) is reported as superseded, never as approved.
export function effectiveLinks(sl, records) {
  const out = [];
  const recs = records || [];
  for (const kind of Object.keys(LINK_KINDS)) {
    const k = LINK_KINDS[kind];
    for (const el of sl[k.coll] || []) {
      const termId = el[k.field];
      if (!termId) continue;
      const rec = [...recs].reverse().find(r => r.kind === kind && r.elementId === el.id && r.termId === termId && r.status === "approved");
      out.push({ id: rec ? rec.id : `seed:${kind}:${el.id}`, kind, elementId: el.id, termId, status: "approved",
        source: rec ? rec.source || "user" : "model definition", proposedBy: rec && rec.proposedBy, proposedAt: rec && rec.proposedAt,
        reviewedBy: rec && rec.reviewedBy, reviewedAt: rec && rec.reviewedAt, history: rec ? rec.history : [], note: rec ? rec.note : "" });
    }
  }
  for (const r of recs) {
    if (r.status === "approved") {
      const el = elementOf(sl, r.kind, r.elementId);
      if (!el || el[LINK_KINDS[r.kind].field] !== r.termId) out.push({ ...r, status: "superseded" });
      continue;
    }
    out.push({ ...r });
  }
  return out;
}

export function checkLink(sl, terms, records, { kind, elementId, termId }) {
  const errors = [];
  const k = LINK_KINDS[kind];
  if (!k) return { ok: false, errors: [{ code: "kind", msg: "Choose what to link." }] };
  const el = elementOf(sl, kind, elementId);
  if (!el) errors.push({ code: "element", msg: "Choose a model element." });
  const t = terms.find(x => x.id === termId);
  if (!t) errors.push({ code: "term", msg: "Choose a glossary term." });
  if (errors.length) return { ok: false, errors };
  if (!k.allowed.includes(termType(t)))
    errors.push({ code: "term_type", msg: `A ${k.l.toLowerCase()} can be linked to a ${k.allowed.join(", ")} term — ${t.term} is a ${termType(t)}.` });
  if (t.status === "Deprecated" || t.status === "Rejected")
    errors.push({ code: "inactive_term", msg: `${t.term} is ${t.status}; link to its successor instead.` });
  if (el[k.field] === termId) errors.push({ code: "duplicate", msg: `${elementName(sl, kind, el)} is already linked to ${t.term}.` });
  const pend = (records || []).find(r => r.kind === kind && r.elementId === elementId && r.status === "proposed");
  if (pend) errors.push({ code: "pending", msg: `A link for ${elementName(sl, kind, el)} is already awaiting review.` });
  return { ok: errors.length === 0, errors };
}

export function proposeLink(sl, terms, records, input, actor, now) {
  const chk = checkLink(sl, terms, records, input);
  if (!chk.ok) return { ok: false, errors: chk.errors, records };
  const at = nowIso(now);
  const el = elementOf(sl, input.kind, input.elementId);
  const rec = { id: `lnk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, kind: input.kind,
    elementId: input.elementId, termId: input.termId, replaces: el[LINK_KINDS[input.kind].field] || null,
    status: "proposed", source: input.source || "user", note: input.note || "", proposedBy: actor, proposedAt: at,
    history: [{ action: "Proposed", by: actor, at, note: input.note || "" }] };
  return { ok: true, rec, records: [...(records || []), rec] };
}

// Approving writes the term onto the element; rejecting leaves the element alone.
export function reviewLink(sl, records, id, decision, actor, note, now) {
  const rec = (records || []).find(r => r.id === id);
  if (!rec) return { ok: false, error: "Link not found." };
  if (rec.status !== "proposed") return { ok: false, error: `Only a proposed link can be reviewed — this one is ${rec.status}.` };
  if (decision === "reject" && !String(note || "").trim()) return { ok: false, error: "Give a reason for rejecting." };
  const at = nowIso(now);
  const status = decision === "approve" ? "approved" : "rejected";
  const records2 = records.map(r => r.id !== id ? r : { ...r, status, reviewedBy: actor, reviewedAt: at, reviewNote: note || "",
    history: [...(r.history || []), { action: status === "approved" ? "Approved" : "Rejected", by: actor, at, note: note || "" }] });
  let sl2 = sl;
  if (status === "approved") {
    const k = LINK_KINDS[rec.kind];
    sl2 = { ...sl, [k.coll]: sl[k.coll].map(x => x.id === rec.elementId ? { ...x, [k.field]: rec.termId } : x) };
  }
  return { ok: true, sl: sl2, records: records2 };
}

// Removing an approved link clears the element and leaves a record of who did it.
export function removeLink(sl, records, link, actor, note, now) {
  const at = nowIso(now);
  const k = LINK_KINDS[link.kind];
  if (link.status === "proposed") {
    return { sl, records: records.map(r => r.id !== link.id ? r : { ...r, status: "removed",
      history: [...(r.history || []), { action: "Withdrawn", by: actor, at, note: note || "" }] }) };
  }
  const sl2 = { ...sl, [k.coll]: sl[k.coll].map(x => x.id === link.elementId && x[k.field] === link.termId ? { ...x, [k.field]: null } : x) };
  const rec = { id: `lnk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, kind: link.kind, elementId: link.elementId,
    termId: link.termId, status: "removed", source: "user", proposedBy: link.proposedBy || null, proposedAt: link.proposedAt || null,
    history: [...(link.history || []), { action: "Removed", by: actor, at, note: note || "" }] };
  return { sl: sl2, records: [...records.filter(r => !(r.id === link.id && r.status === "approved")), rec] };
}

// ═══════════════════════════════ VERSIONS ═════════════════════════════════════
// A version is an immutable copy of everything a consumer would read from the
// model at that moment. The live model is the working draft; publishing freezes
// it. Context is pinned to the published version until another is published.
export function snapshotModel(sl, modelId) {
  const model = sl.models.find(m => m.id === modelId);
  if (!model) return null;
  const ids = model.entityIds || [];
  return clone({
    model: { id: model.id, name: model.name, domain: model.domain, owner: model.owner, steward: model.steward,
      desc: model.desc || "", entityIds: ids, targets: model.targets || [] },
    entities: sl.entities.filter(e => ids.includes(e.id)),
    rels: sl.rels.filter(r => ids.includes(r.from) && ids.includes(r.to)),
    dims: sl.dims.filter(d => ids.includes(d.entity)),
    facts: sl.facts.filter(f => ids.includes(f.entity)),
    metrics: sl.metrics.filter(m => m.model === modelId),
  });
}

// Stable fingerprint, so "the draft differs from what is published" is a fact,
// not a guess. Key order is normalised.
export function snapshotHash(snap) {
  const norm = (v) => Array.isArray(v) ? v.map(norm) : v && typeof v === "object"
    ? Object.keys(v).sort().reduce((o, k) => { o[k] = norm(v[k]); return o; }, {}) : v;
  const s = JSON.stringify(norm(snap));
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function versionsOf(versions, modelId) {
  return (versions || []).filter(v => v.modelId === modelId).sort((a, b) => b.n - a.n);
}

export function publishedVersion(versions, model) {
  return model && model.publishedVersionId ? (versions || []).find(v => v.id === model.publishedVersionId) || null : null;
}

export function draftState(sl, versions, modelId) {
  const model = sl.models.find(m => m.id === modelId);
  const pub = publishedVersion(versions, model);
  const snap = snapshotModel(sl, modelId);
  const hash = snap ? snapshotHash(snap) : null;
  const latest = versionsOf(versions, modelId)[0];
  return { snap, hash, pub, changed: !pub || pub.hash !== hash, nextN: (latest ? latest.n : 0) + 1 };
}

export function publishModel(sl, versions, modelId, terms, ctx, actor, note, now) {
  const d = draftState(sl, versions, modelId);
  if (!d.snap) return { ok: false, error: "Model not found." };
  if (d.pub && !d.changed) return { ok: false, error: `Nothing to publish — the draft is identical to published v${d.pub.n}.` };
  const issues = validateSnapshot(d.snap, { ...ctx, terms });
  const errs = issues.filter(i => i.severity === "error");
  if (errs.length) return { ok: false, error: `${errs.length} error${errs.length === 1 ? "" : "s"} must be fixed before publishing.`, issues };
  const at = nowIso(now);
  const v = { id: `ver_${modelId}_${d.nextN}_${Date.now().toString(36)}`, modelId, n: d.nextN, hash: d.hash, snapshot: d.snap,
    publishedAt: at, publishedBy: actor, note: note || "", supersedes: d.pub ? d.pub.id : null,
    validation: { errors: 0, warnings: issues.filter(i => i.severity === "warning").length } };
  const sl2 = { ...sl, models: sl.models.map(m => m.id === modelId ? { ...m, publishedVersionId: v.id, lastPublished: at.slice(0, 10) } : m) };
  return { ok: true, version: v, versions: [...(versions || []), v], sl: sl2, issues };
}

// ══════════════════════════════ VALIDATION ════════════════════════════════════
// Issues for ONE snapshot. Each names a target the UI can open: a dataset, a
// join, a metric, a field, a link or a glossary term.
export function validateSnapshot(snap, ctx = {}) {
  const issues = [];
  if (!snap) return issues;
  const terms = ctx.terms || [], schema = ctx.schema || {};
  const add = (severity, code, message, target, fix) =>
    issues.push({ id: `${code}:${target.kind}:${target.id}${target.sub ? ":" + target.sub : ""}`, severity, code, message, target, fix });
  const ents = snap.entities, entIds = new Set(ents.map(e => e.id));

  if (!ents.length) add("error", "model.no_datasets", "The model has no datasets, so nothing in it can be computed.", { kind: "model", id: snap.model.id }, "Add a dataset");

  for (const e of ents) {
    const keys = Array.isArray(e.key) ? e.key : e.key ? [e.key] : [];
    if (!keys.length) add("error", "dataset.no_key", `${e.name} has no primary key, so its grain is undefined.`, { kind: "dataset", id: e.id }, "Set the primary key");
    const cols = schema[e.table];
    if (cols && keys.some(k => !cols.some(c => c.name === k)))
      add("error", "dataset.key_missing", `${e.name}'s key ${keys.join(", ")} is not a column of ${e.table}.`, { kind: "dataset", id: e.id }, "Set the primary key");
  }
  // Every dataset beyond the first has to be reachable through a join, or a metric
  // on one cannot be sliced by anything on the other.
  if (ents.length > 1) {
    const adj = {}; snap.rels.forEach(r => { (adj[r.from] = adj[r.from] || []).push(r.to); (adj[r.to] = adj[r.to] || []).push(r.from); });
    const seen = new Set([ents[0].id]); const q = [ents[0].id];
    while (q.length) { const n = q.shift(); (adj[n] || []).forEach(x => { if (!seen.has(x)) { seen.add(x); q.push(x); } }); }
    ents.filter(e => !seen.has(e.id)).forEach(e =>
      add("error", "dataset.unjoined", `${e.name} is not joined to the rest of the model.`, { kind: "dataset", id: e.id }, "Add a join"));
  }
  snap.rels.filter(r => r.fanOutSafe === false).forEach(r => {
    const a = ents.find(e => e.id === r.from), b = ents.find(e => e.id === r.to);
    add("warning", "join.fanout", `The join ${a ? a.name : r.from} → ${b ? b.name : r.to} can fan out and double-count measures.`, { kind: "join", id: r.id }, "Review the join");
  });

  for (const m of snap.metrics) {
    if (!entIds.has(m.entity)) { add("error", "metric.no_dataset", `${m.name} is not measured on any dataset in this model.`, { kind: "metric", id: m.id }, "Open the metric"); continue; }
    const ent = ents.find(e => e.id === m.entity);
    const cols = schema[ent.table];
    const used = m.type === "ratio" ? [m.numerator && m.numerator.col, m.denominator && m.denominator.col] : m.type === "simple" ? [m.col] : [];
    const facts = snap.facts.filter(f => f.entity === ent.id).map(f => f.column);
    used.filter(Boolean).forEach(c => {
      if (cols && !cols.some(x => x.name === c) && !facts.includes(c))
        add("error", "metric.bad_column", `${m.name} reads ${c}, which is not a column of ${ent.table}.`, { kind: "metric", id: m.id, sub: c }, "Open the metric");
    });
    if (!m.timeDim) add("warning", "metric.no_time", `${m.name} has no time dimension and cannot be trended.`, { kind: "metric", id: m.id }, "Open the metric");
    const confirmed = (m.bindings || []).some(b => b.confirmed);
    if (m.status === "Approved" && !confirmed)
      add("error", "metric.unbound", `${m.name} is certified but has no confirmed binding.`, { kind: "metric", id: m.id }, "Open the metric");
    else if (m.status === "In Review" && !confirmed)
      add("warning", "metric.unbound", `${m.name} has no confirmed binding yet.`, { kind: "metric", id: m.id }, "Open the metric");
    if (m.status !== "Approved")
      add("warning", "metric.uncertified", `${m.name} is ${m.status}; profiles that require certification will not serve it.`, { kind: "metric", id: m.id }, "Open the metric");
    if (!m.termId) {
      if (m.status === "Approved")
        add("warning", "metric.no_term", `${m.name} is certified but not linked to a glossary term.`, { kind: "link", id: m.id, sub: "metric" }, "Link a term");
    } else {
      const t = terms.find(x => x.id === m.termId);
      if (!t) add("error", "link.missing_term", `${m.name} is linked to a term that no longer exists.`, { kind: "link", id: m.id, sub: "metric" }, "Relink");
      else if (t.status !== "Approved")
        add("error", "link.term_not_approved", `${m.name} is linked to "${t.term}", which is ${t.status}. A published metric must point at an approved term.`, { kind: "term", id: t.id, sub: m.id }, "Open the term");
    }
  }
  for (const f of [...snap.dims.map(d => ["field", d]), ...snap.facts.map(x => ["measure", x])]) {
    const [kind, el] = f;
    if (!el.termId) continue;
    const t = terms.find(x => x.id === el.termId);
    if (!t) add("error", "link.missing_term", `Field ${el.name} is linked to a term that no longer exists.`, { kind: "link", id: el.id, sub: kind }, "Relink");
    else if (t.status !== "Approved")
      add("error", "link.term_not_approved", `Field ${el.name} is linked to "${t.term}", which is ${t.status}.`, { kind: "term", id: t.id, sub: el.id }, "Open the term");
  }
  for (const e of ents) if (e.concept) {
    const t = terms.find(x => x.id === e.concept);
    if (t && t.status !== "Approved")
      add("error", "link.term_not_approved", `${e.name} realises "${t.term}", which is ${t.status}.`, { kind: "term", id: t.id, sub: e.id }, "Open the term");
  }
  const order = { error: 0, warning: 1 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ════════════════════════════ PERSONAS & PROFILES ═════════════════════════════
export const PERSONAS = [
  { id: "steward",  label: "Data steward",     domains: ["*"],                      pii: true,  d: "All domains, including PII fields." },
  { id: "commerce", label: "Commerce analyst", domains: ["Commerce", "Marketing"],  pii: false, d: "Commerce and Marketing. No PII." },
  { id: "finance",  label: "Finance analyst",  domains: ["Finance"],                pii: false, d: "Finance only. No PII." },
  { id: "product",  label: "Product analyst",  domains: ["Product"],                pii: false, d: "Product only. No PII." },
];
export const personaOf = (id) => PERSONAS.find(p => p.id === id) || PERSONAS[0];
export const canSeeDomain = (persona, domain) => !!persona && (persona.domains.includes("*") || persona.domains.includes(domain));

export const SEED_PROFILES = [
  { id: "prof_analyst", name: "Analyst assistant", seeded: true,
    desc: "Answers for analysts. Serves uncertified definitions with a warning.",
    requireCertified: true, requireApprovedTerm: false, minQualityPct: 75, maxStalenessHours: 24,
    onViolation: "warn", onMissingEvidence: "warn", relDepth: 1, includeExamples: true },
  { id: "prof_finance", name: "Finance reporting agent", seeded: true,
    desc: "Feeds numbers that end up in reports. Anything unproven is refused.",
    requireCertified: true, requireApprovedTerm: true, minQualityPct: 90, maxStalenessHours: 6,
    onViolation: "block", onMissingEvidence: "block", relDepth: 2, includeExamples: false },
  { id: "prof_explore", name: "Exploration", seeded: true,
    desc: "For discovery. Reports evidence, enforces nothing.",
    requireCertified: false, requireApprovedTerm: false, minQualityPct: 0, maxStalenessHours: 0,
    onViolation: "warn", onMissingEvidence: "warn", relDepth: 2, includeExamples: true },
];

export function checkProfile(p, profiles) {
  const errors = [];
  if (!String(p.name || "").trim()) errors.push({ code: "name", msg: "Name the profile." });
  else if ((profiles || []).some(x => x.id !== p.id && x.name.trim().toLowerCase() === p.name.trim().toLowerCase()))
    errors.push({ code: "name", msg: "Another profile already has this name." });
  const q = Number(p.minQualityPct);
  if (!Number.isFinite(q) || q < 0 || q > 100) errors.push({ code: "minQualityPct", msg: "Minimum quality is a percentage from 0 to 100." });
  const s = Number(p.maxStalenessHours);
  if (!Number.isFinite(s) || s < 0) errors.push({ code: "maxStalenessHours", msg: "Maximum age is 0 (no limit) or more hours." });
  if (![1, 2].includes(Number(p.relDepth))) errors.push({ code: "relDepth", msg: "Relationship depth is 1 or 2." });
  if (!["warn", "block"].includes(p.onViolation)) errors.push({ code: "onViolation", msg: "Choose warn or block." });
  if (!["warn", "block"].includes(p.onMissingEvidence)) errors.push({ code: "onMissingEvidence", msg: "Choose warn or block." });
  return { ok: errors.length === 0, errors };
}

// ══════════════════════════════ QUALITY ═══════════════════════════════════════
// DQ test cases are matched to a dataset by table name (commerce.orders ↔ orders).
export function qualityFor(table, dq) {
  const cases = (dq || []).filter(t => String(t.table || "").split(".").pop() === table);
  const judged = cases.filter(t => ["Success", "Failed", "Warning"].includes(t.status));
  const score = judged.reduce((s, t) => s + (t.status === "Success" ? 1 : t.status === "Warning" ? 0.5 : 0), 0);
  const fresh = cases.find(t => /freshness/i.test(t.defName || t.name || ""));
  const ageH = fresh ? parseFloat(String(fresh.lastVal || "").replace(/[^0-9.]/g, "")) : null;
  const latest = cases.map(t => t.observedAt).filter(Boolean).sort().pop() || null;
  return { cases, judged: judged.length, pct: judged.length ? Math.round((score / judged.length) * 100) : null,
    failing: judged.filter(t => t.status === "Failed"), warning: judged.filter(t => t.status === "Warning"),
    freshness: fresh ? { status: fresh.status, ageHours: Number.isFinite(ageH) ? ageH : null, at: fresh.observedAt || null, test: fresh.name, id: fresh.id } : null,
    observedAt: latest };
}

// ══════════════════════════════ CONTEXT ═══════════════════════════════════════
export class ContextError extends Error {
  constructor(code, message, field) { super(message); this.code = code; this.field = field; }
}

const STOP = new Set("the a an of for in on by to and or what is was were how much many show me give our we us my per with from last this that which are do does did be been get value number total".split(" "));
export const tokens = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").split(" ").filter(w => w && !STOP.has(w))
  .map(w => w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

function nameScore(qt, names) {
  let best = 0;
  for (const n of names) {
    const nt = tokens(n); if (!nt.length) continue;
    const hit = nt.filter(t => qt.includes(t)).length;
    if (!hit) continue;
    // How much of the QUESTION the name explains, then how much of the NAME was asked
    // for. "revenue" explains itself equally well against every revenue metric — that
    // is an ambiguity, not a win for the shortest name.
    const s = hit / qt.length + 0.5 * (hit / nt.length) + (hit === nt.length ? 0.5 : 0);
    best = Math.max(best, s);
  }
  return best;
}

// The world is everything the engine may read. Built by the app from its stores,
// and by the tests from fixtures.
export function contextCandidates(world, persona, req) {
  const qt = tokens(req.question);
  const out = [];
  for (const model of world.sl.models) {
    const ver = publishedVersion(world.versions, model);
    if (!ver) continue;
    const snap = ver.snapshot;
    const domain = snap.model.domain;
    for (const m of snap.metrics) {
      // A link counts only if it was in the published version AND is still approved.
      const liveM = world.sl.metrics.find(x => x.id === m.id);
      const termId = m.termId && liveM && liveM.termId === m.termId ? m.termId : null;
      const term = termId ? world.terms.find(t => t.id === termId) : null;
      const ent = snap.entities.find(e => e.id === m.entity);
      const liveEnt = ent && world.sl.entities.find(e => e.id === ent.id);
      const conceptId = ent && ent.concept && liveEnt && liveEnt.concept === ent.concept ? ent.concept : null;
      const concept = conceptId ? world.terms.find(t => t.id === conceptId) : null;
      const names = [m.name, ...(term ? [term.term, term.abbr, ...(term.synonyms || [])] : [])].filter(x => x && x !== "—");
      let score = nameScore(qt, names);
      // Concept route: "revenue per customer" reaches metrics measured on the concept
      if (concept) score += 0.25 * nameScore(qt, [concept.term, ...(concept.synonyms || [])]);
      if (req.conceptId && conceptId !== req.conceptId && !(term && related(world, term.id, req.conceptId))) continue;
      if (req.domain && domain !== req.domain) continue;
      if (score <= 0 && !req.choice) continue;
      out.push({ key: `${model.id}:${m.id}`, model, version: ver, snap, metric: m, term, concept, domain, score,
        visible: canSeeDomain(persona, domain) && (!term || canSeeDomain(persona, term.domain) || term.domain === domain) });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.metric.name.localeCompare(b.metric.name));
}

function related(world, a, b) {
  return (world.crels || []).some(r => r.status === "approved" && ((r.from === a && r.to === b) || (r.from === b && r.to === a)));
}

export function validateRequest(world, req) {
  if (!req || typeof req !== "object") throw new ContextError("invalid_request", "The request body must be a JSON object.");
  const q = req.question;
  if (typeof q !== "string" || !q.trim()) throw new ContextError("invalid_request", "Ask a question — the request has no question text.", "question");
  if (q.length > 500) throw new ContextError("invalid_request", "Keep the question under 500 characters.", "question");
  if (!PERSONAS.some(p => p.id === req.personaId)) throw new ContextError("invalid_request", `Unknown persona "${req.personaId}".`, "personaId");
  if (!(world.profiles || []).some(p => p.id === req.profileId)) throw new ContextError("invalid_request", `Unknown context profile "${req.profileId}".`, "profileId");
  if (req.domain != null && typeof req.domain !== "string") throw new ContextError("invalid_request", "domain must be a string.", "domain");
}

export function buildContext(world, req, opts = {}) {
  validateRequest(world, req);
  const now = nowIso(opts.now);
  const persona = personaOf(req.personaId);
  const profile = world.profiles.find(p => p.id === req.profileId);
  const base = {
    apiVersion: "edg.context/v1",
    requestId: opts.requestId || `ctx_${Date.now().toString(36)}`,
    generatedAt: now,
    request: { question: req.question, personaId: req.personaId, profileId: req.profileId,
      domain: req.domain || null, conceptId: req.conceptId || null, purpose: req.purpose || null, choice: req.choice || null },
    persona: { id: persona.id, label: persona.label, simulated: true },
    profile: { id: profile.id, name: profile.name, rules: profileRules(profile) },
  };
  const all = contextCandidates(world, persona, req);
  // Permission filtering happens BEFORE ranking is reported: a hidden candidate is
  // never named, counted or hinted at.
  const cands = all.filter(c => c.visible);
  if (req.choice) {
    const pick = cands.find(c => c.key === req.choice);
    if (!pick) throw new ContextError("invalid_request", "That choice is not one of the available definitions.", "choice");
    return assemble(world, base, pick, persona, profile, now);
  }
  if (!cands.length) {
    const askable = uniq(world.sl.models.flatMap(mo => {
      const v = publishedVersion(world.versions, mo); if (!v || !canSeeDomain(persona, v.snapshot.model.domain)) return [];
      return v.snapshot.metrics.map(m => m.name);
    })).slice(0, 6);
    return { ...base, status: "insufficient_context",
      summary: "No published definition you are permitted to use matches this question.",
      insufficient: { reason: tokens(req.question).length ? "no_match" : "no_terms",
        detail: tokens(req.question).length ? `Nothing published matches "${tokens(req.question).join(" ")}".` : "The question has no searchable words.",
        suggestions: askable },
      evidence: [], warnings: [], sources: [] };
  }
  const top = cands[0].score;
  const close = cands.filter(c => c.score >= top * 0.75);
  if (close.length > 1) {
    return { ...base, status: "needs_clarification",
      summary: `"${req.question}" matches ${close.length} published definitions. Choose the one you mean.`,
      clarification: { question: "Which definition do you mean?",
        options: close.map(c => ({ key: c.key, metric: c.metric.name, model: c.model.name, version: c.version.n, domain: c.domain,
          status: c.metric.status, definition: (c.term && c.term.status === "Approved" ? c.term.definition : c.metric.definition) || "" })) },
      evidence: [], warnings: [], sources: close.map(c => ({ type: "metric", id: c.metric.id, modelId: c.model.id, version: c.version.n })) };
  }
  return assemble(world, base, cands[0], persona, profile, now);
}

function profileRules(p) {
  const r = [];
  if (p.requireCertified) r.push("certified metric");
  if (p.requireApprovedTerm) r.push("approved glossary term");
  if (Number(p.minQualityPct) > 0) r.push(`quality ≥ ${p.minQualityPct}%`);
  if (Number(p.maxStalenessHours) > 0) r.push(`data ≤ ${p.maxStalenessHours} h old`);
  r.push(`violations ${p.onViolation === "block" ? "block" : "warn"}`, `missing evidence ${p.onMissingEvidence === "block" ? "blocks" : "warns"}`);
  return r;
}

function assemble(world, base, c, persona, profile, now) {
  const { metric: m, snap, version, model, term } = c;
  const ent = snap.entities.find(e => e.id === m.entity) || null;
  const schemaCols = (world.schema && ent && world.schema[ent.table]) || [];
  const isPII = (col) => !!(schemaCols.find(x => x.name === col) || {}).pii;
  const declared = snap.dims.filter(d => d.entity === m.entity || (m.dims || []).includes(d.column));
  const dimCols = uniq([...(m.dims || []), ...declared.filter(d => d.entity === m.entity).map(d => d.column)]);
  const hiddenDims = persona.pii ? [] : dimCols.filter(isPII);
  const dims = dimCols.filter(cn => !hiddenDims.includes(cn)).map(cn => {
    const d = snap.dims.find(x => x.column === cn);
    const t = d && d.termId ? world.terms.find(x => x.id === d.termId) : null;
    return { column: cn, name: d ? d.name : cn, declared: !!d, term: t && canSeeDomain(persona, t.domain) ? t.term : null };
  });
  // Relationship traversal from the metric's term and the dataset's concept, over
  // APPROVED relationships only, to the profile's depth, inside the persona's domains.
  const starts = [term && term.id, c.concept && c.concept.id].filter(Boolean);
  const relsOut = [];
  const seen = new Set(starts);
  let frontier = starts.map(id => ({ id, depth: 0 }));
  while (frontier.length) {
    const next = [];
    for (const f of frontier) {
      if (f.depth >= Number(profile.relDepth || 1)) continue;
      for (const r of relationsOf(f.id, (world.crels || []).filter(x => x.status === "approved"), world.terms)) {
        if (!r.other || !canSeeDomain(persona, r.other.domain)) continue;
        const from = world.terms.find(t => t.id === f.id);
        relsOut.push({ from: from ? from.term : f.id, relation: r.label, to: r.other.term, toType: termType(r.other), depth: f.depth + 1, relId: r.rel.id,
          approvedBy: r.rel.reviewedBy || null, approvedAt: r.rel.reviewedAt || null });
        if (!seen.has(r.otherId)) { seen.add(r.otherId); next.push({ id: r.otherId, depth: f.depth + 1 }); }
      }
    }
    frontier = next;
  }
  const joins = snap.rels.filter(r => r.from === m.entity || r.to === m.entity).map(r => {
    const a = snap.entities.find(e => e.id === r.from), b = snap.entities.find(e => e.id === r.to);
    return { from: a ? a.name : r.from, to: b ? b.name : r.to, on: `${r.fromKey || (r.fromKeys || []).join(",")} = ${r.toKey || (r.toKeys || []).join(",")}`,
      cardinality: r.cardinality || null, fanOutSafe: r.fanOutSafe !== false };
  });

  // ── Trust evidence, each item timestamped.
  const evidence = [];
  const ev = (kind, label, status, detail, at, ref) => evidence.push({ kind, label, status, detail, at: at || null, ref: ref || null });
  ev("publication", "Published model version", "pass", `${model.name} v${version.n}, published by ${version.publishedBy}`, version.publishedAt, { versionId: version.id });
  ev("certification", "Metric certification", m.status === "Approved" ? "pass" : "warn",
    m.status === "Approved" ? `Certified${m.certifiedBy ? " by " + m.certifiedBy : ""}` : `Status is ${m.status}`, m.certifiedAt || version.publishedAt);
  if (term) {
    const linkRec = (world.linkRecords || []).filter(r => r.kind === "metric" && r.elementId === m.id && r.termId === term.id && r.status === "approved").pop();
    ev("term", "Glossary term", term.status === "Approved" ? "pass" : "fail", `${term.term} · ${term.status}${linkRec ? ` · link approved by ${linkRec.reviewedBy}` : " · linked in the model definition"}`,
      (linkRec && linkRec.reviewedAt) || term.reviewedAt || null, { termId: term.id });
  } else {
    ev("term", "Glossary term", "missing", "Not linked to an approved glossary term in the published version", null);
  }
  const q = ent ? qualityFor(ent.table, world.dq) : { judged: 0 };
  if (!q.judged) ev("quality", "Data quality", "missing", `No quality tests have run on ${ent ? ent.table : "the dataset"}`, null, { table: ent && ent.table });
  else ev("quality", "Data quality", q.failing.length ? (q.pct >= Number(profile.minQualityPct || 0) ? "warn" : "fail") : q.warning.length ? "warn" : "pass",
    `${q.pct}% of ${q.judged} tests on ${ent.table}${q.failing.length ? ` · failing: ${q.failing.map(t => t.name).join(", ")}` : ""}`, q.observedAt,
    { table: ent.table, pct: q.pct, failing: q.failing.map(t => t.id) });
  if (q.freshness && q.freshness.ageHours != null)
    ev("freshness", "Freshness", Number(profile.maxStalenessHours) > 0 && q.freshness.ageHours > Number(profile.maxStalenessHours) ? "fail"
      : q.freshness.status === "Success" ? "pass" : "warn", `Newest data is ${q.freshness.ageHours} h old (${q.freshness.test})`, q.freshness.at, { testId: q.freshness.id });
  else ev("freshness", "Freshness", "missing", "No freshness test on this dataset", null);
  const bind = (m.bindings || []).find(b => b.confirmed);
  ev("binding", "Physical binding", bind ? "pass" : "warn", bind ? `${bind.object} · ${bind.expr}` : "No confirmed binding", version.publishedAt);

  // ── Profile rules → violations.
  const violations = [], missing = [];
  if (profile.requireCertified && m.status !== "Approved") violations.push(`The profile requires a certified metric; ${m.name} is ${m.status}.`);
  if (profile.requireApprovedTerm && (!term || term.status !== "Approved")) violations.push(term ? `The profile requires an approved term; ${term.term} is ${term.status}.` : "The profile requires an approved glossary term; none is linked.");
  if (term && term.status !== "Approved" && !profile.requireApprovedTerm) violations.push(`${term.term} is ${term.status}.`);
  if (Number(profile.minQualityPct) > 0) {
    if (!q.judged) missing.push("No data-quality results to check against the profile's minimum.");
    else if (q.pct < Number(profile.minQualityPct)) violations.push(`Quality is ${q.pct}%, below the profile's ${profile.minQualityPct}%.`);
  }
  if (Number(profile.maxStalenessHours) > 0) {
    if (!q.freshness || q.freshness.ageHours == null) missing.push("No freshness evidence to check against the profile's maximum age.");
    else if (q.freshness.ageHours > Number(profile.maxStalenessHours)) violations.push(`Data is ${q.freshness.ageHours} h old, past the profile's ${profile.maxStalenessHours} h.`);
  }
  if (snap.rels.some(r => (r.from === m.entity || r.to === m.entity) && r.fanOutSafe === false)) violations.push("A join on this dataset can fan out — slicing across it may double-count.");
  const blocked = (violations.length && profile.onViolation === "block") || (missing.length && profile.onMissingEvidence === "block");
  const warnings = [...violations, ...missing];
  if (hiddenDims.length) warnings.push(`${hiddenDims.length} field${hiddenDims.length === 1 ? " is" : "s are"} withheld by your permissions.`);

  const definition = term && term.status === "Approved" ? term.definition : m.definition;
  const sources = [{ type: "model", id: model.id, version: version.n, versionId: version.id },
    { type: "metric", id: m.id, modelId: model.id, version: version.n }, ent && { type: "dataset", id: ent.id, table: ent.table },
    term && { type: "term", id: term.id }, c.concept && { type: "term", id: c.concept.id },
    ...relsOut.map(r => ({ type: "relationship", id: r.relId }))].filter(Boolean);
  if (blocked) {
    return { ...base, status: "blocked",
      summary: `${profile.name} will not serve ${m.name}: ${(violations[0] || missing[0])}`,
      resolved: { metric: m.name, metricId: m.id, model: model.name, modelId: model.id, version: version.n },
      evidence, warnings, sources };
  }
  return { ...base, status: warnings.length ? "ok_with_warnings" : "ok",
    summary: `${m.name} — ${definition || "no definition recorded"}`,
    resolved: { metric: m.name, metricId: m.id, model: model.name, modelId: model.id, version: version.n, versionId: version.id, domain: c.domain },
    context: {
      definition, term: term ? { id: term.id, name: term.term, status: term.status, owner: term.owner } : null,
      calculation: m.type === "ratio" && m.numerator ? `${m.numerator.agg}(${m.numerator.col}) / ${m.denominator.agg}(${m.denominator.col})`
        : m.type === "simple" ? `${m.agg || "sum"}(${m.col})` : (m.formula || m.expr || m.type),
      unit: m.unit || null, grain: ent ? { dataset: ent.name, table: ent.table, key: ent.key } : null,
      time: m.timeDim ? { column: m.timeDim, grain: m.timeGrain || null } : null,
      filters: uniq([...((ent && ent.filters) || []), ...(m.filters || [])].map(f => `${f.col} ${f.op} ${f.val}`)),
      dimensions: dims, joins, relationships: relsOut,
      owner: m.owner || model.owner, steward: m.steward || null,
      examples: profile.includeExamples ? (m.examples || []) : [],
    },
    evidence, warnings, sources };
}

// What a person reads, generated from the response object — never separately.
export function renderText(res) {
  const L = [];
  L.push(`Status: ${res.status}`);
  L.push(res.summary || "");
  if (res.clarification) res.clarification.options.forEach((o, i) => L.push(`  ${i + 1}. ${o.metric} (${o.model} v${o.version}, ${o.status})`));
  if (res.insufficient && res.insufficient.suggestions.length) L.push(`You can ask about: ${res.insufficient.suggestions.join(", ")}`);
  if (res.resolved) L.push(`Source: ${res.resolved.model} v${res.resolved.version}`);
  if (res.context) {
    L.push(`Calculation: ${res.context.calculation}${res.context.unit ? " (" + res.context.unit + ")" : ""}`);
    if (res.context.grain) L.push(`Grain: one row per ${res.context.grain.key} of ${res.context.grain.dataset}`);
    if (res.context.dimensions.length) L.push(`Slice by: ${res.context.dimensions.map(d => d.name).join(", ")}`);
    if (res.context.relationships.length) L.push(`Related: ${res.context.relationships.map(r => `${r.from} ${r.relation} ${r.to}`).join("; ")}`);
  }
  (res.evidence || []).forEach(e => L.push(`[${e.status}] ${e.label}: ${e.detail}${e.at ? " @ " + e.at : ""}`));
  (res.warnings || []).forEach(w => L.push(`! ${w}`));
  return L.join("\n");
}

// Compare a recorded response with a rerun — what changed and why it matters.
export function diffResponses(a, b) {
  const d = [];
  if (a.status !== b.status) d.push(`Status ${a.status} → ${b.status}`);
  const va = a.resolved && a.resolved.version, vb = b.resolved && b.resolved.version;
  if (va !== vb) d.push(`Model version ${va != null ? "v" + va : "—"} → ${vb != null ? "v" + vb : "—"}`);
  const ea = Object.fromEntries((a.evidence || []).map(e => [e.kind, e])), eb = Object.fromEntries((b.evidence || []).map(e => [e.kind, e]));
  uniq([...Object.keys(ea), ...Object.keys(eb)]).forEach(k => {
    const x = ea[k], y = eb[k];
    if (!x || !y) d.push(`${(x || y).label} ${x ? "no longer reported" : "now reported"}`);
    else if (x.status !== y.status || x.detail !== y.detail) d.push(`${y.label}: ${x.status} → ${y.status}`);
  });
  if (a.context && b.context && a.context.definition !== b.context.definition) d.push("Definition changed");
  else if (!!a.context !== !!b.context) d.push(b.context ? "Context payload now served" : "Context payload no longer served");
  return d;
}

// ═══════════════════════════════ IMPACT ═══════════════════════════════════════
// Potential impact comes from stored dependencies. Observed usage comes only from
// recorded context requests. They are reported separately and never mixed.
export function impactOf(world, target) {
  const { sl } = world;
  const potential = []; const seen = new Set();
  const add = (kind, id, name, via, extra) => { const k = kind + ":" + id; if (seen.has(k)) return; seen.add(k); potential.push({ kind, id, name, via, ...extra }); };
  const metricUses = (m, col, entId) => m.entity === entId && (m.col === col || m.timeDim === col || (m.dims || []).includes(col) ||
    (m.numerator && m.numerator.col === col) || (m.denominator && m.denominator.col === col));
  const fromMetric = (m, via) => {
    add("metric", m.id, m.name, via);
    sl.models.filter(mo => mo.id === m.model).forEach(mo => {
      add("model", mo.id, mo.name, `contains ${m.name}`, { published: !!mo.publishedVersionId });
      const pv = publishedVersion(world.versions, mo);
      if (pv && pv.snapshot.metrics.some(x => x.id === m.id)) add("version", pv.id, `${mo.name} v${pv.n} (published)`, `serves ${m.name} to context`);
    });
    sl.metrics.filter(x => (x.basedOn || []).includes(m.id)).forEach(x => fromMetric(x, `derived from ${m.name}`));
  };
  const fromField = (kind, f) => {
    const ent = sl.entities.find(e => e.id === f.entity);
    sl.metrics.filter(m => metricUses(m, f.column, f.entity)).forEach(m => fromMetric(m, `reads ${ent ? ent.name + "." : ""}${f.column}`));
  };
  const fromDataset = (e) => {
    [...sl.dims.filter(d => d.entity === e.id).map(d => ["field", d]), ...sl.facts.filter(f => f.entity === e.id).map(f => ["measure", f])]
      .forEach(([k, f]) => add("field", f.id, `${e.name}.${f.name}`, `field of ${e.name}`));
    sl.rels.filter(r => r.from === e.id || r.to === e.id).forEach(r => {
      const o = sl.entities.find(x => x.id === (r.from === e.id ? r.to : r.from));
      add("join", r.id, `${e.name} ↔ ${o ? o.name : "?"}`, "joined on this dataset");
    });
    sl.metrics.filter(m => m.entity === e.id).forEach(m => fromMetric(m, `measured on ${e.name}`));
    sl.models.filter(mo => (mo.entityIds || []).includes(e.id)).forEach(mo => add("model", mo.id, mo.name, `uses ${e.name}`, { published: !!mo.publishedVersionId }));
  };
  const links = effectiveLinks(sl, world.linkRecords);
  if (target.kind === "term") {
    links.filter(l => l.termId === target.id && (l.status === "approved" || l.status === "proposed")).forEach(l => {
      const el = elementOf(sl, l.kind, l.elementId);
      add(l.kind === "dataset" ? "dataset" : l.kind === "metric" ? "metric" : "field", l.elementId, elementName(sl, l.kind, el),
        `${l.status === "proposed" ? "proposed link" : "linked"} to the term`, { linkStatus: l.status });
      if (l.status !== "approved" || !el) return;
      if (l.kind === "metric") fromMetric(el, "linked to the term");
      else if (l.kind === "dataset") fromDataset(el);
      else fromField(l.kind, el);
    });
    relationsOf(target.id, world.crels || [], world.terms).forEach(r =>
      add("term", r.otherId, r.other ? r.other.term : r.otherId, `${r.label} (${r.rel.status})`));
    (world.profiles || []).forEach(p => { if (p.requireApprovedTerm) add("profile", p.id, p.name, "requires approved terms on every metric it serves"); });
  } else if (target.kind === "metric") {
    const m = sl.metrics.find(x => x.id === target.id); if (m) fromMetric(m, "selected");
    potential.shift();
  } else if (target.kind === "field" || target.kind === "measure") {
    const f = (target.kind === "field" ? sl.dims : sl.facts).find(x => x.id === target.id); if (f) fromField(target.kind, f);
  } else if (target.kind === "dataset") {
    const e = sl.entities.find(x => x.id === target.id); if (e) fromDataset(e);
  } else if (target.kind === "model") {
    const mo = sl.models.find(x => x.id === target.id);
    if (mo) {
      sl.metrics.filter(m => m.model === mo.id).forEach(m => add("metric", m.id, m.name, "in this model"));
      versionsOf(world.versions, mo.id).forEach(v => add("version", v.id, `${mo.name} v${v.n}`, v.id === mo.publishedVersionId ? "published" : "superseded"));
    }
  }
  // Observed use: recorded requests whose response cited the target or anything it reaches.
  // A request that merely used the same model version did not use this item — only
  // element-level citations count, unless the target IS the model.
  const ids = new Set([target.id, ...potential.filter(p => target.kind === "model" || (p.kind !== "model" && p.kind !== "version" && p.kind !== "profile")).map(p => p.id)]);
  const cites = (s) => (s.type !== "model" || target.kind === "model") && (ids.has(s.id) || (target.kind === "model" && ids.has(s.versionId)));
  const observed = (world.history || []).filter(h => (h.response.sources || []).some(cites))
    .map(h => ({ id: h.id, at: h.at, question: h.request.question, status: h.response.status, persona: h.request.personaId,
      cited: (h.response.sources || []).filter(cites).map(s => s.type + ":" + s.id) }));
  return { potential, observed };
}

// ═══════════════════════════ TERM DELETION RULE ═══════════════════════════════
// RULE: a term that anything APPROVED depends on cannot be deleted — deprecate it
// instead, or remove those dependencies first. Proposed links and relationships
// that point at it are rejected automatically when it is deleted.
export function termDependencies(world, termId) {
  const { sl } = world;
  const links = effectiveLinks(sl, world.linkRecords).filter(l => l.termId === termId);
  const rels = (world.crels || []).filter(r => (r.from === termId || r.to === termId) && LIVE_REL(r));
  const versions = (world.versions || []).filter(v => {
    const s = v.snapshot; return [...s.metrics, ...s.dims, ...s.facts].some(x => x.termId === termId) || s.entities.some(e => e.concept === termId);
  });
  const name = (l) => elementName(sl, l.kind, elementOf(sl, l.kind, l.elementId));
  const blocking = [
    ...links.filter(l => l.status === "approved").map(l => ({ kind: "link", id: l.id, label: `${LINK_KINDS[l.kind].l} ${name(l)} is linked to it` })),
    ...rels.filter(r => r.status === "approved").map(r => {
      const o = world.terms.find(t => t.id === (r.from === termId ? r.to : r.from));
      return { kind: "relationship", id: r.id, label: `Approved relationship with ${o ? o.term : "?"}` };
    }),
    ...versions.filter(v => sl.models.some(m => m.publishedVersionId === v.id)).map(v => {
      const mo = sl.models.find(m => m.id === v.modelId);
      return { kind: "version", id: v.id, label: `${mo ? mo.name : v.modelId} v${v.n} is published with it` };
    }),
  ];
  const cascade = [
    ...links.filter(l => l.status === "proposed").map(l => ({ kind: "link", id: l.id, label: `Proposed link from ${name(l)}` })),
    ...rels.filter(r => r.status === "proposed").map(r => ({ kind: "relationship", id: r.id, label: "Proposed relationship" })),
  ];
  return { canDelete: blocking.length === 0, blocking, cascade,
    rule: "A term that an approved link, an approved relationship or a published model version depends on cannot be deleted. Deprecate it, or remove those dependencies first. Pending proposals that point at it are rejected automatically." };
}

// ══════════════════════════════ GRAPH ═════════════════════════════════════════
// Nodes and edges for the Ontology Explorer, from stored records only.
export const NODE_KINDS = {
  Concept:   { l: "Concept",   col: 3 }, Metric: { l: "Metric term", col: 3 }, Dimension: { l: "Dimension term", col: 3 }, Term: { l: "Term", col: 3 },
  metric:    { l: "Model metric", col: 2 }, field: { l: "Model field", col: 2 }, dataset: { l: "Dataset", col: 1 }, model: { l: "Semantic model", col: 0 },
};

export function buildGraph(world, persona) {
  const { sl } = world;
  const nodes = [], edges = [];
  const visTerm = (t) => canSeeDomain(persona, t.domain);
  world.terms.filter(visTerm).forEach(t => nodes.push({ id: "t:" + t.id, ref: t.id, kind: termType(t), name: t.term, domain: t.domain, status: t.status, group: "term" }));
  const visModels = sl.models.filter(m => canSeeDomain(persona, m.domain));
  const entIds = new Set(visModels.flatMap(m => m.entityIds || []));
  visModels.forEach(m => nodes.push({ id: "m:" + m.id, ref: m.id, kind: "model", name: m.name, domain: m.domain, status: m.publishedVersionId ? "Published" : "Draft", group: "model" }));
  sl.entities.filter(e => entIds.has(e.id)).forEach(e => {
    nodes.push({ id: "d:" + e.id, ref: e.id, kind: "dataset", name: e.name, domain: e.domain, status: "", group: "model" });
    visModels.filter(m => (m.entityIds || []).includes(e.id)).forEach(m =>
      edges.push({ id: `in:${e.id}:${m.id}`, from: "d:" + e.id, to: "m:" + m.id, label: "in model", status: "structural", kind: "structural",
        why: `${e.name} is one of the datasets declared in ${m.name}.` }));
  });
  sl.metrics.filter(m => visModels.some(x => x.id === m.model)).forEach(m => {
    nodes.push({ id: "x:" + m.id, ref: m.id, kind: "metric", name: m.name, domain: m.domain, status: m.status, group: "model" });
    if (entIds.has(m.entity)) edges.push({ id: `grain:${m.id}`, from: "x:" + m.id, to: "d:" + m.entity, label: "measured on", status: "structural", kind: "structural",
      why: `${m.name} is declared on this dataset's grain in the model definition.` });
  });
  const ids = new Set(nodes.map(n => n.id));
  effectiveLinks(sl, world.linkRecords).filter(l => l.status === "approved" || l.status === "proposed").forEach(l => {
    const el = elementOf(sl, l.kind, l.elementId); if (!el) return;
    let nid;
    if (l.kind === "metric") nid = "x:" + el.id;
    else if (l.kind === "dataset") nid = "d:" + el.id;
    else {
      if (!entIds.has(el.entity)) return;
      nid = "f:" + el.id;
      if (!ids.has(nid)) { nodes.push({ id: nid, ref: el.id, kind: "field", sub: l.kind, name: elementName(sl, l.kind, el), domain: "", status: "", group: "model" }); ids.add(nid);
        edges.push({ id: `fld:${el.id}`, from: nid, to: "d:" + el.entity, label: "field of", status: "structural", kind: "structural", why: "Declared as a field of this dataset." }); }
    }
    if (!ids.has(nid) || !ids.has("t:" + l.termId)) return;
    edges.push({ id: "lnk:" + l.id, ref: l.id, from: nid, to: "t:" + l.termId, label: l.kind === "dataset" ? "realises" : "means", status: l.status, kind: "link", link: l });
  });
  (world.crels || []).filter(r => r.status === "approved" || r.status === "proposed").forEach(r => {
    if (!ids.has("t:" + r.from) || !ids.has("t:" + r.to)) return;
    edges.push({ id: "rel:" + r.id, ref: r.id, from: "t:" + r.from, to: "t:" + r.to, label: (REL_TYPES[r.type] || { l: r.type }).l, status: r.status, kind: "relationship", rel: r });
  });
  return { nodes, edges };
}

export function whyConnected(world, edge) {
  if (edge.kind === "structural") return [{ step: "Declared", detail: edge.why }];
  const r = edge.kind === "link" ? edge.link : edge.rel;
  const steps = [];
  if (edge.kind === "link" && r.source === "model definition") steps.push({ step: "Declared", detail: "Set in the semantic model definition (seeded); no proposal record." });
  (r.history || []).forEach(h => steps.push({ step: h.action, by: h.by, at: h.at, detail: h.note || "" }));
  if (r.source === "seed" && !(r.history || []).length) steps.push({ step: "Seeded", detail: "Part of the shipped demo glossary." });
  if (edge.kind === "link" && r.status === "approved") {
    const pub = world.sl.models.filter(m => m.publishedVersionId).map(m => publishedVersion(world.versions, m)).filter(Boolean)
      .filter(v => [...v.snapshot.metrics, ...v.snapshot.dims, ...v.snapshot.facts].some(x => x.id === r.elementId && x.termId === r.termId)
        || v.snapshot.entities.some(e => e.id === r.elementId && e.concept === r.termId));
    steps.push(pub.length ? { step: "In published context", detail: pub.map(v => `v${v.n} of ${(world.sl.models.find(m => m.id === v.modelId) || {}).name}`).join(", ") }
      : { step: "Not yet published", detail: "Context will use this link once a model version containing it is published." });
  }
  return steps;
}
