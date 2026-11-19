// Knowledge graph operations: quality checks, build runs and status.
// Pure functions — the screen passes in the ontology, the entity graph that
// buildEntityGraph produced and a context of schema, profiles and joins.
// No MDM: checks look at mapped rows and mapped joins only; nothing is matched
// or merged across sources.

const pct = (x) => (typeof x === "number" ? x : parseFloat(x)) || 0;

export const SEVERITY = { error: "Error", warning: "Warning", info: "Info" };
export const CHECK_KINDS = {
  source: "Data source", column: "Column", link: "Relationship", required: "Required", unique: "Unique", orphan: "Orphan records",
};

// Every check returns {id, kind, severity, classId, title, detail, affected}.
export function qualityChecks(ont, eg, ctx) {
  const out = [];
  const maps = ont.mappings || [];
  const nm = (id) => ((ont.classes || []).find((c) => c.id === id) || {}).name || id;
  const colOf = (t, c) => (ctx.schemaOf(t) || []).find((x) => x.name === c);
  const egc = (id) => (eg.classes || []).find((c) => c.classId === id) || { sources: [], total: null };

  (ont.classes || []).forEach((c) => {
    if (!egc(c.id).sources.length)
      out.push({ id: `src:${c.id}`, kind: "source", severity: "warning", classId: c.id, title: `${c.name} has no data source`, detail: "No entities are created for this class", affected: null });
  });
  maps.filter((m) => m.kind === "field").forEach((m) => {
    if (!colOf(m.target.table, m.target.column)) {
      const p = (((ont.classes || []).find((c) => c.id === m.classId) || {}).props || []).find((x) => x.id === m.propId);
      out.push({ id: `col:${m.id}`, kind: "column", severity: "error", classId: m.classId, title: `${m.target.table}.${m.target.column} not found`,
        detail: `${nm(m.classId)}.${p ? p.name : "property"} is skipped in every build`, affected: egc(m.classId).total });
    }
  });
  (ont.rels || []).forEach((r) => {
    const jm = maps.find((m) => m.kind === "join" && m.relId === r.id);
    if (!jm) { out.push({ id: `link:${r.id}`, kind: "link", severity: "warning", classId: r.from, title: `${nm(r.from)} ${r.name} ${nm(r.to)} is not linked`, detail: "No join selected · entities are not connected", affected: null }); return; }
    const j = (ctx.joins || []).find((x) => x.id === jm.target.joinId);
    if (!j) { out.push({ id: `link:${r.id}`, kind: "link", severity: "error", classId: r.from, title: `Join for ${nm(r.from)} ${r.name} ${nm(r.to)} no longer exists`, detail: "Relationship is skipped", affected: null }); return; }
    const ent = (ctx.entities || []).find((e) => e.id === j.from);
    const prof = ent && j.fromKey ? ctx.profileOf(ent.table, j.fromKey) || {} : {};
    if (pct(prof.nullPct) > 0)
      out.push({ id: `orphan:${r.id}`, kind: "orphan", severity: "warning", classId: r.from, title: `${pct(prof.nullPct)}% of ${nm(r.from)} entities have no ${nm(r.to)}`,
        detail: `${ent.table}.${j.fromKey} is empty in ${prof.nullCount || "some"} rows`, affected: prof.nullCount || null });
  });
  (ont.constraints || []).forEach((k) => {
    if (k.kind !== "required" && k.kind !== "unique") return;
    const c = (ont.classes || []).find((x) => x.id === k.classId); if (!c) return;
    const p = (c.props || []).find((x) => x.name === k.prop); if (!p) return;
    const fm = maps.find((m) => m.kind === "field" && m.classId === c.id && m.propId === p.id); if (!fm) return;
    const prof = ctx.profileOf(fm.target.table, fm.target.column) || {};
    const sev = k.severity === "warning" ? "warning" : "error";
    if (k.kind === "required" && pct(prof.nullPct) > 0)
      out.push({ id: `req:${k.id}`, kind: "required", severity: sev, classId: c.id, title: `${c.name}.${p.name} is required`,
        detail: `Missing in ${prof.nullCount || `${prof.nullPct}%`} entities (${prof.nullPct}%)`, affected: prof.nullCount || null });
    if (k.kind === "unique" && prof.distinctPct != null && pct(prof.distinctPct) < 100)
      out.push({ id: `uniq:${k.id}`, kind: "unique", severity: sev, classId: c.id, title: `${c.name}.${p.name} must be unique`,
        detail: `${prof.distinctPct}% distinct`, affected: null });
  });
  const rank = { error: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title));
}

// The steps a build runs, in order. Each step reports what it did.
export const STEPS = [
  { k: "read", l: "Read sources" }, { k: "keys", l: "Resolve keys" }, { k: "entities", l: "Create entities" },
  { k: "links", l: "Link relationships" }, { k: "validate", l: "Validate constraints" }, { k: "infer", l: "Apply inference" }, { k: "publish", l: "Publish to target" },
];

// One build run of an entity graph. Errors that stop the read (no class has
// data) fail the build; broken columns or links skip that part and warn.
export function runBuild(eg, checks, { n, at, trigger = "Manual", by = "system", target = "EDG managed", infer = true } = {}) {
  const st = eg.stats || {};
  const errs = checks.filter((c) => c.severity === "error"), warns = checks.filter((c) => c.severity === "warning");
  const sources = (eg.classes || []).reduce((s, c) => s + c.sources.length, 0);
  const fail = !st.withData;
  const steps = STEPS.map((s) => ({ ...s, status: "ok", detail: "" }));
  const set = (k, status, detail) => { const s = steps.find((x) => x.k === k); s.status = status; s.detail = detail; };
  set("read", fail ? "failed" : errs.some((c) => c.kind === "column") ? "warning" : "ok",
    fail ? "No class has a data source" : `${sources} source${sources === 1 ? "" : "s"}${errs.filter((c) => c.kind === "column").length ? ` · ${errs.filter((c) => c.kind === "column").length} column not found` : ""}`);
  if (fail) steps.slice(1).forEach((s) => { s.status = "skipped"; });
  else {
    set("keys", "ok", `${st.withData} class${st.withData === 1 ? "" : "es"} keyed`);
    set("entities", "ok", `${(st.entities || 0).toLocaleString("en-US")} entities`);
    const unlinked = (st.relationships || 0) - (st.linked || 0);
    set("links", unlinked ? "warning" : "ok", `${st.linked || 0} of ${st.relationships || 0} relationships${unlinked ? ` · ${unlinked} skipped` : ""}`);
    const v = checks.filter((c) => c.kind === "required" || c.kind === "unique" || c.kind === "orphan");
    set("validate", v.length ? "warning" : "ok", v.length ? `${v.length} finding${v.length === 1 ? "" : "s"}` : "All constraints pass");
    set("infer", infer ? "ok" : "skipped", infer ? "Rules applied" : "Turned off");
    set("publish", "ok", target);
  }
  const status = fail ? "Failed" : errs.length || warns.length ? "Warnings" : "Succeeded";
  const duration = fail ? 4 : 18 + Math.round(Math.log10((st.entities || 10) + 10) * 9) + sources * 3;
  return { n, at, trigger, by, status, duration, entities: fail ? 0 : st.entities || 0, links: fail ? 0 : st.linked || 0,
    classes: fail ? 0 : st.withData || 0, errors: errs.length, warnings: warns.length, steps };
}

// Status shown on the list and the profile.
export function statusOf(g, eg) {
  if (g.paused) return "Paused";
  if (eg && !(eg.stats || {}).withData) return "Needs data";
  const last = (g.builds || [])[0];
  if (!last) return "Not built";
  return last.status === "Failed" ? "Failed" : last.status === "Warnings" ? "Warnings" : "Active";
}

export const fmtDuration = (s) => (s == null ? "—" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

// ═══ Ontology graphs (metadata only) ═══
// An ontology graph is the PUBLISHED version of an ontology, its bindings to
// catalog assets and fields, and its SHACL report. No source records are read
// or copied. `og` = {published, version, stats:{classes, classesBound, rels,
// relsBound, props, propsBound, assets, fields, triples, bindings},
// report:{violations, warnings}, tests:{total, failing}}.
export const ONTOLOGY_STEPS = [
  { k: "read", l: "Read published ontology" }, { k: "catalog", l: "Read catalog" }, { k: "bind", l: "Resolve bindings" },
  { k: "shacl", l: "Validate (SHACL)" }, { k: "tests", l: "Check expected answers" }, { k: "publish", l: "Publish to target" },
];
export function runOntologyBuild(og, { n, at, trigger = "Manual", by = "system", target = "Apache Jena TDB2", graph = "" } = {}) {
  const st = og.stats || {}, rep = og.report || { violations: 0, warnings: 0 }, ts = og.tests || { total: 0, failing: 0 };
  const steps = ONTOLOGY_STEPS.map((s) => ({ ...s, status: "ok", detail: "" }));
  const set = (k, status, detail) => { const s = steps.find((x) => x.k === k); s.status = status; s.detail = detail; };
  const skipFrom = (k) => { let on = false; steps.forEach((s) => { if (s.k === k) on = true; else if (on) { s.status = "skipped"; s.detail = ""; } }); };
  if (!og.published) {
    set("read", "failed", "The ontology has no published version"); skipFrom("read");
    return { n, at, trigger, by, status: "Failed", duration: 2, entities: 0, links: 0, classes: 0, errors: 1, warnings: 0, steps };
  }
  set("read", "ok", `v${og.version} · ${st.classes} classes · ${st.rels} relationships`);
  set("catalog", "ok", `${st.assets} asset${st.assets === 1 ? "" : "s"} · ${st.fields} field${st.fields === 1 ? "" : "s"}`);
  const unbound = (st.classes - st.classesBound) + (st.rels - st.relsBound);
  set("bind", unbound ? "warning" : "ok", `${st.classesBound} of ${st.classes} classes · ${st.relsBound} of ${st.rels} relationships · ${st.propsBound} of ${st.props} properties`);
  set("shacl", rep.violations ? "failed" : rep.warnings ? "warning" : "ok",
    rep.violations ? `${rep.violations} violation${rep.violations === 1 ? "" : "s"}` : rep.warnings ? `Conforms with ${rep.warnings} warning${rep.warnings === 1 ? "" : "s"}` : "Conforms");
  set("tests", ts.failing ? "failed" : "ok", ts.total ? `${ts.total - ts.failing} of ${ts.total} passing` : "None defined");
  const fail = rep.violations > 0 || ts.failing > 0;
  if (fail) skipFrom("tests"); else set("publish", "ok", `${target}${graph ? ` · ${graph}` : ""}`);
  return { n, at, trigger, by, status: fail ? "Failed" : (rep.warnings || unbound) ? "Warnings" : "Succeeded",
    duration: 3 + Math.round((st.triples || 0) / 40), entities: st.triples || 0, links: st.bindings || 0, classes: st.classesBound || 0,
    errors: rep.violations + ts.failing, warnings: rep.warnings, steps };
}
export function ontologyGraphStatus(g, og) {
  if (g.paused) return "Paused";
  if (og && !og.published) return "Not published";
  const last = (g.builds || [])[0];
  if (!last) return "Not built";
  return last.status === "Failed" ? "Failed" : last.status === "Warnings" ? "Warnings" : "Active";
}
