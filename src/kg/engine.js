// ─────────────────────────────────────────────────────────────────────────────
// EDG knowledge graph — built, never drawn.
//
// Two layers, both projected automatically from what EDG already holds:
//
//   1 · Metadata graph   catalog assets, columns, lineage, classifications, glossary,
//                        domains, owners, semantic models, metrics and ontology classes,
//                        with the edges between them; then inference rules add
//                        DERIVED edges (marked, with the edges that justify them).
//   2 · Entity graph     per ontology: every row of a mapped table is an instance of
//                        its class (keyed by the mapped key), properties come from the
//                        mapped columns, links follow the mapped joins. Sources are
//                        never merged.
//
// Pure: the caller passes the inputs; the same inputs always give the same graph,
// so a rebuild is just running it again.
// ─────────────────────────────────────────────────────────────────────────────

export const NODE_TYPES = {
  asset:   { l: "Data asset",      c: "#2563eb" },
  column:  { l: "Column",          c: "#64748b" },
  term:    { l: "Glossary term",   c: "#0d9488" },
  tag:     { l: "Classification",  c: "#e11d48" },
  domain:  { l: "Domain",          c: "#7c3aed" },
  user:    { l: "User",            c: "#d97706" },
  team:    { l: "Team",            c: "#ea580c" },
  product: { l: "Data product",    c: "#0ea5e9" },
  policy:  { l: "Policy",          c: "#be123c" },
  test:    { l: "Quality test",    c: "#65a30d" },
  service: { l: "Connection",      c: "#475569" },
  database:{ l: "Database",        c: "#57534e" },
  schema:  { l: "Schema",          c: "#78716c" },
  model:   { l: "Semantic model",  c: "#0891b2" },
  metric:  { l: "Metric",          c: "#16a34a" },
  ontology:{ l: "Ontology",        c: "#9333ea" },
  class:   { l: "Ontology class",  c: "#a855f7" },
  agent:   { l: "AI agent",        c: "#c026d3" },
  tool:    { l: "MCP tool",        c: "#0f766e" },
  mcpserver:{ l: "MCP server",     c: "#115e59" },
  gateway: { l: "AI gateway",      c: "#334155" },
};
// Catalog asset types that are not data: they become their own node types, keep
// the asset id (so they open in the catalog) and are left out of data lineage rules.
export const AI_NODE_TYPE = { "AI Agent": "agent", "MCP Tool": "tool", "MCP Server": "mcpserver", "AI Gateway": "gateway" };
export const EDGE_TYPES = {
  contains:     { l: "contains" },
  feeds:        { l: "feeds" },
  depends_on:   { l: "depends on" },
  tagged:       { l: "classified as" },
  described_by: { l: "described by" },
  in_domain:    { l: "belongs to" },
  owned_by:     { l: "owned by" },
  stewarded_by: { l: "stewarded by" },
  member_of:    { l: "member of" },
  part_of:      { l: "part of" },
  governed_by:  { l: "governed by" },
  tested_by:    { l: "tested by" },
  uses:         { l: "uses" },
  computed_from:{ l: "computed from" },
  joins:        { l: "joins" },
  defines:      { l: "defines" },
  is_a:         { l: "is a" },
  relates:      { l: "relates to" },
  realised_by:  { l: "realised by" },
  stored_in:    { l: "stored in" },
  measures:     { l: "measures" },
  routes:       { l: "routes" },
  calls:        { l: "calls" },
  reads:        { l: "reads" },
  writes:       { l: "writes" },
};
export const RULES = {
  pii_downstream:  { l: "PII flows downstream", d: "A column with the same name in a downstream asset inherits its PII classification." },
  domain_columns:  { l: "Columns inherit the domain", d: "Every column belongs to its asset's domain." },
  lineage_closure: { l: "Indirect dependencies", d: "An asset depends on everything upstream of it, not only its direct inputs." },
  class_pii:       { l: "Classes inherit PII", d: "A class whose property is stored in a PII column is classified PII." },
  agent_pii:       { l: "Agents inherit PII", d: "An AI agent that reads an asset with a PII column is classified PII." },
};

const nid = { asset: (n) => `asset:${n}`, column: (t, c) => `column:${t}.${c}`, term: (id) => `term:${id}`, tag: (n) => `tag:${n}`,
  domain: (n) => `domain:${n}`, user: (n) => `user:${n}`, model: (id) => `model:${id}`, metric: (id) => `metric:${id}`,
  ontology: (id) => `ontology:${id}`, class: (o, c) => `class:${o}:${c}`, team: (n) => `team:${n}`, product: (id) => `product:${id}`,
  policy: (id) => `policy:${id}`, test: (id) => `test:${id}`, service: (n) => `service:${n}`, database: (s, d) => `database:${s}/${d}`, schema: (s, d, x) => `schema:${s}/${d}/${x}` };
export { nid as nodeId };

export function buildMetadataGraph(input, opts = {}) {
  const rules = { pii_downstream: true, domain_columns: true, lineage_closure: true, class_pii: true, agent_pii: true, ...(opts.rules || {}) };
  const nodes = new Map(), edges = [], seen = new Set();
  const node = (id, type, label, extra) => { if (!nodes.has(id)) nodes.set(id, { id, type, label, ...(extra || {}) }); return id; };
  const edge = (from, to, type, extra) => {
    if (!nodes.has(from) || !nodes.has(to) || from === to) return null;
    const key = `${from}|${type}|${to}|${extra && extra.label ? extra.label : ""}`;
    if (seen.has(key)) return null; seen.add(key);
    const e = { id: `e${edges.length + 1}`, from, to, type, derived: false, ...(extra || {}) }; edges.push(e); return e;
  };
  const schemaOf = input.schemaOf || (() => []);
  const assets = input.assets || [];
  const byName = new Map(assets.map((a) => [a.name, a]));

  // catalog: assets, columns, domains, owners, classifications
  assets.forEach((a) => {
    node(nid.asset(a.name), AI_NODE_TYPE[a.type] || "asset", a.name, { assetType: a.type, assetId: a.id, domain: a.domain, db: a.db });
    if (a.domain) { node(nid.domain(a.domain), "domain", a.domain); edge(nid.asset(a.name), nid.domain(a.domain), "in_domain"); }
    (a.owners || (a.owner ? [a.owner] : [])).filter(Boolean).forEach((o) => { node(nid.user(o), "user", o); edge(nid.asset(a.name), nid.user(o), "owned_by"); });
    (a.stewards || (a.steward ? [a.steward] : [])).filter(Boolean).forEach((o) => { node(nid.user(o), "user", o); edge(nid.asset(a.name), nid.user(o), "stewarded_by"); });
    (a.tags || []).forEach((t) => { node(nid.tag(t), "tag", t); edge(nid.asset(a.name), nid.tag(t), "tagged"); });
    // where it lives: connection → database → schema → asset (from the "db / schema / name" path)
    const path = String(a.db || "").split("/").map((x) => x.trim()).filter(Boolean);
    if (a.service || a.connectionLabel) {
      const sv = node(nid.service(a.connectionLabel || a.service), "service", a.connectionLabel || a.service);
      if (path.length >= 3) {
        const d = node(nid.database(sv, path[0]), "database", path[0]); edge(sv, d, "contains");
        const sc = node(nid.schema(sv, path[0], path[1]), "schema", `${path[0]}.${path[1]}`); edge(d, sc, "contains");
        edge(sc, nid.asset(a.name), "contains");
      } else edge(sv, nid.asset(a.name), "contains");
    }
    schemaOf(a.name).forEach((c) => {
      node(nid.column(a.name, c.name), "column", `${a.name}.${c.name}`, { table: a.name, column: c.name, dataType: c.type });
      edge(nid.asset(a.name), nid.column(a.name, c.name), "contains");
      if (c.pii) { node(nid.tag("PII"), "tag", "PII"); edge(nid.column(a.name, c.name), nid.tag("PII"), "tagged"); }
    });
  });
  // lineage (asset level)
  (input.lineage || []).forEach((l) => { if (byName.has(l.from) && byName.has(l.to)) edge(nid.asset(l.from), nid.asset(l.to), "feeds"); });
  // AI: gateway routes agents and MCP servers, agents call tools, agents and tools read assets
  (input.ai || []).forEach((x) => { if (byName.has(x.from) && byName.has(x.to)) edge(nid.asset(x.from), nid.asset(x.to), x.type, x.label ? { label: x.label } : undefined); });
  // people: users belong to teams
  (input.teams || []).forEach((t) => {
    node(nid.team(t.name), "team", t.name);
    (t.members || []).forEach((u) => { node(nid.user(u), "user", u); edge(nid.user(u), nid.team(t.name), "member_of"); });
  });
  const assetFor = (name) => { if (!name) return null; if (byName.has(name)) return name; const last = String(name).split(".").pop(); return byName.has(last) ? last : null; };
  // data products: the assets they bundle, their domain and owners
  (input.products || []).forEach((p) => {
    node(nid.product(p.id), "product", p.name);
    if (p.domain) { node(nid.domain(p.domain), "domain", p.domain); edge(nid.product(p.id), nid.domain(p.domain), "in_domain"); }
    (p.owners || []).forEach((o) => { node(nid.user(o), "user", o); edge(nid.product(p.id), nid.user(o), "owned_by"); });
    (p.assets || []).forEach((n) => { const a = assetFor(n); if (a) edge(nid.asset(a), nid.product(p.id), "part_of"); });
  });
  // policies: the assets they name and the domains in their scope
  (input.policies || []).forEach((p) => {
    node(nid.policy(p.id), "policy", p.name);
    (p.assets || []).forEach((n) => { const a = assetFor(n); if (a) edge(nid.asset(a), nid.policy(p.id), "governed_by"); });
    (p.domains || []).forEach((d) => { if (nodes.has(nid.domain(d))) edge(nid.domain(d), nid.policy(p.id), "governed_by"); });
    (p.owners || []).forEach((o) => { node(nid.user(o), "user", o); edge(nid.policy(p.id), nid.user(o), "owned_by"); });
  });
  // data quality tests on assets and columns
  (input.tests || []).forEach((t) => {
    const a = assetFor(t.table); if (!a) return;
    node(nid.test(t.id), "test", t.name, { status: t.status });
    const col = t.column ? nid.column(a, t.column) : null;
    edge(col && nodes.has(col) ? col : nid.asset(a), nid.test(t.id), "tested_by");
  });
  // glossary
  (input.terms || []).forEach((t) => {
    node(nid.term(t.id), "term", t.name, { termType: t.termType });
    (t.owners || []).forEach((o) => { node(nid.user(o), "user", o); edge(nid.term(t.id), nid.user(o), "owned_by"); });
    (t.linkedAssets || []).forEach((la) => { if (byName.has(la.name)) edge(nid.asset(la.name), nid.term(t.id), "described_by"); });
  });
  // semantic models: model → assets it uses; metrics computed from columns; joins between assets
  const sl = input.semantic || {};
  const entTable = new Map((sl.entities || []).map((e) => [e.id, e.table]));
  const ensureTable = (t) => { if (!t) return null; const id = nid.asset(t); if (!nodes.has(id)) node(id, "asset", t, { assetType: "Dataset" }); return id; };
  (sl.models || []).forEach((m) => {
    node(nid.model(m.id), "model", m.name, { domain: m.domain });
    (m.entityIds || []).forEach((eid) => { const a = ensureTable(entTable.get(eid)); if (a) edge(nid.model(m.id), a, "uses"); });
  });
  (sl.rels || []).forEach((j) => { const a = ensureTable(entTable.get(j.from)), b = ensureTable(entTable.get(j.to)); if (a && b) edge(a, b, "joins", { label: `${(j.fromKeys || [j.fromKey]).join("+")} = ${(j.toKeys || [j.toKey]).join("+")}` }); });
  (sl.metrics || []).forEach((m) => {
    node(nid.metric(m.id), "metric", m.name, { model: m.model });
    if (m.model) edge(nid.metric(m.id), nid.model(m.model), "uses");
    const t = entTable.get(m.entity); ensureTable(t);
    const cols = m.type === "ratio" ? [m.numerator && m.numerator.col, m.denominator && m.denominator.col] : [m.col];
    cols.filter(Boolean).forEach((c) => { const cid = nid.column(t, c); if (nodes.has(cid)) edge(nid.metric(m.id), cid, "computed_from"); else if (t) edge(nid.metric(m.id), nid.asset(t), "computed_from"); });
    if (m.termId && nodes.has(nid.term(m.termId))) edge(nid.metric(m.id), nid.term(m.termId), "described_by");
  });
  // ontologies: classes, hierarchy, relationships, and how they are realised
  (input.ontologies || []).forEach((o) => {
    node(nid.ontology(o.id), "ontology", o.name);
    (o.classes || []).forEach((c) => {
      const cid = node(nid.class(o.id, c.id), "class", c.name, { ontology: o.id, classId: c.id });
      edge(nid.ontology(o.id), cid, "defines");
      if (c.termId && nodes.has(nid.term(c.termId))) edge(cid, nid.term(c.termId), "described_by");
    });
    (o.classes || []).forEach((c) => { if (c.parent) edge(nid.class(o.id, c.id), nid.class(o.id, c.parent), "is_a"); });
    (o.rels || []).forEach((r) => edge(nid.class(o.id, r.from), nid.class(o.id, r.to), "relates", { label: r.name }));
    (o.mappings || []).forEach((m) => {
      const cid = nid.class(o.id, m.classId);
      if (m.kind === "dataset" || m.kind === "table") { const t = m.kind === "table" ? m.target.table : entTable.get(m.target.entityId); const a = ensureTable(t); if (a) edge(cid, a, "realised_by"); }
      if (m.kind === "field") { const col = nid.column(m.target.table, m.target.column); if (nodes.has(col)) {
        const p = ((o.classes || []).find((c) => c.id === m.classId) || { props: [] }).props.find((x) => x.id === m.propId);
        edge(cid, col, "stored_in", { label: p ? p.name : m.target.column }); } }
      if (m.kind === "metric" && nodes.has(nid.metric(m.target.metricId))) edge(nid.metric(m.target.metricId), cid, "measures");
    });
  });

  // ── inference: derived edges, each with the edges that justify it ──
  const base = edges.slice();
  const derive = (from, to, type, rule, because, extra) => { const e = edge(from, to, type, { ...(extra || {}), derived: true, rule, because }); return e; };
  if (rules.domain_columns) base.filter((e) => e.type === "contains").forEach((c) => {
    const dom = base.find((e) => e.type === "in_domain" && e.from === c.from);
    if (dom) derive(c.to, dom.to, "in_domain", "domain_columns", [c.id, dom.id]);
  });
  if (rules.pii_downstream) {
    // Repeat until nothing new: PII flows as many hops downstream as lineage goes.
    for (let pass = 0; pass < 20; pass++) {
      const piiCols = new Set(edges.filter((e) => e.type === "tagged" && e.to === nid.tag("PII") && nodes.get(e.from).type === "column").map((e) => e.from));
      let added = 0;
      base.filter((e) => e.type === "feeds").forEach((f) => {
        const up = nodes.get(f.from), down = nodes.get(f.to);
        schemaOf(up.label).forEach((c) => {
          const src = nid.column(up.label, c.name), dst = nid.column(down.label, c.name);
          if (piiCols.has(src) && nodes.has(dst) && !piiCols.has(dst) && derive(dst, nid.tag("PII"), "tagged", "pii_downstream", [f.id])) added++;
        });
      });
      if (!added) break;
    }
  }
  if (rules.lineage_closure) {
    const feeds = base.filter((e) => e.type === "feeds");
    const down = new Map(); feeds.forEach((e) => down.set(e.from, [...(down.get(e.from) || []), e]));
    nodes.forEach((n) => { if (n.type !== "asset") return;
      const stack = (down.get(n.id) || []).map((e) => ({ at: e.to, path: [e.id] })), seen2 = new Set();
      while (stack.length) { const { at, path } = stack.pop(); if (seen2.has(at)) continue; seen2.add(at);
        if (path.length > 1) derive(at, n.id, "depends_on", "lineage_closure", path);
        (down.get(at) || []).forEach((e) => stack.push({ at: e.to, path: [...path, e.id] })); }
    });
  }
  if (rules.class_pii) {
    const piiCols = new Set(edges.filter((e) => e.type === "tagged" && e.to === nid.tag("PII")).map((e) => e.from));
    base.filter((e) => e.type === "stored_in" && piiCols.has(e.to)).forEach((s) => derive(s.from, nid.tag("PII"), "tagged", "class_pii", [s.id], { label: s.label }));
  }
  if (rules.agent_pii) {
    const piiTag = nid.tag("PII");
    const piiOf = (assetId) => edges.find((e) => e.type === "tagged" && e.to === piiTag && (e.from === assetId || (e.from.startsWith("column:") && nodes.get(e.from).table === nodes.get(assetId).label)));
    edges.filter((e) => e.type === "reads" && nodes.get(e.from).type === "agent").forEach((r) => {
      const t = piiOf(r.to); if (t) derive(r.from, piiTag, "tagged", "agent_pii", [r.id, t.id], { label: nodes.get(r.to).label });
    });
  }
  const all = [...nodes.values()];
  const count = (arr, k) => arr.reduce((m, x) => { m[x[k]] = (m[x[k]] || 0) + 1; return m; }, {});
  return { nodes: all, edges, stats: { nodes: all.length, edges: edges.length, derived: edges.filter((e) => e.derived).length,
    byNodeType: count(all, "type"), byEdgeType: count(edges, "type"), byRule: count(edges.filter((e) => e.derived), "rule") } };
}

// Neighbourhood of one node, for the explorer: nodes within `depth` hops.
export function neighbourhood(graph, id, { depth = 1, types = null, derived = true } = {}) {
  const ok = (e) => (derived || !e.derived) && (!types || types.includes(e.type));
  const keep = new Set([id]); let frontier = [id];
  for (let d = 0; d < depth; d++) {
    const next = [];
    graph.edges.forEach((e) => { if (!ok(e)) return;
      if (frontier.includes(e.from) && !keep.has(e.to)) { keep.add(e.to); next.push(e.to); }
      if (frontier.includes(e.to) && !keep.has(e.from)) { keep.add(e.from); next.push(e.from); } });
    frontier = next;
  }
  return { nodes: graph.nodes.filter((n) => keep.has(n.id)), edges: graph.edges.filter((e) => ok(e) && keep.has(e.from) && keep.has(e.to)) };
}

export function search(graph, q, limit = 30) {
  const s = String(q || "").toLowerCase().trim(); if (!s) return [];
  return graph.nodes.filter((n) => n.label.toLowerCase().includes(s)).sort((a, b) => (a.label.toLowerCase().startsWith(s) ? -1 : 1) - (b.label.toLowerCase().startsWith(s) ? -1 : 1) || a.label.length - b.label.length).slice(0, limit);
}

// ═════════════════════════════ ENTITY GRAPH ══════════════════════════════════
const parseCount = (s) => { const m = String(s || "").replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i); if (!m) return null;
  return Math.round(Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1)); };
export const fmtCount = (n) => n == null ? "—" : n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);

// A value for a column of sample row i, from what the profile says the column looks like.
function sampleValue(col, prof, i, key) {
  const t = String(col.type || "").toUpperCase();
  if (key) return /CHAR|STRING|TEXT/.test(t) ? `${col.name.slice(0, 3).toUpperCase()}-${1000 + i}` : String(1001 + i * 7);
  if (prof.samples && prof.samples.length) return prof.samples[i % prof.samples.length];
  if (prof.topValues && prof.topValues.length) return String(prof.topValues[i % prof.topValues.length]).replace(/\s*\(.*\)/, "");
  if (/BOOL/.test(t)) return i % 3 ? "true" : "false";
  if (/DATE|TIME/.test(t)) return `2026-${String(1 + (i * 3) % 12).padStart(2, "0")}-${String(3 + (i * 5) % 25).padStart(2, "0")}`;
  if (/DEC|NUM|INT|DOUBLE|FLOAT/.test(t)) return (prof.avg ? Number(String(prof.avg).replace(/[^0-9.]/g, "")) * (0.6 + (i % 5) * 0.2) : 10 * (i + 1)).toFixed(/DEC|DOUBLE|FLOAT/.test(t) ? 2 : 0);
  return `${col.name.replace(/_/g, " ")} ${i + 1}`;
}

// Per ontology: instance counts per class and source, a few sample entities with
// their properties (PII masked), and the links between samples along mapped joins.
export function buildEntityGraph(ont, ctx, { samplesPerSource = 3, mask = true } = {}) {
  const maps = ont.mappings || [];
  const ents = ctx.entities || [], joins = ctx.joins || [];
  const tableOf = (m) => m.kind === "table" ? m.target.table : (ents.find((e) => e.id === m.target.entityId) || {}).table;
  const classes = (ont.classes || []).map((c) => {
    const srcs = maps.filter((m) => (m.kind === "dataset" || m.kind === "table") && m.classId === c.id);
    const sources = srcs.map((m) => { const table = tableOf(m); const a = (ctx.assets || []).find((x) => x.name === table);
      const keys = (m.target.keys || []).length ? m.target.keys : (ctx.schemaOf(table) || []).filter((x) => x.pk).map((x) => x.name);
      const kp = keys.length === 1 ? (ctx.profileOf(table, keys[0]) || {}) : {};
      return { mappingId: m.id, entityId: m.kind === "dataset" ? m.target.entityId : null, table, keys, rows: parseCount(kp.distinctCount) || parseCount(a && a.rows) || null }; });
    return { classId: c.id, name: c.name, parent: c.parent || null, sources, total: sources.reduce((n, s) => n + (s.rows || 0), 0) || null };
  });
  const samples = {};
  classes.forEach((cl) => {
    const c = ont.classes.find((x) => x.id === cl.classId);
    samples[cl.classId] = cl.sources.flatMap((s) => {
      const cols = ctx.schemaOf(s.table) || [];
      return Array.from({ length: s.rows === 0 ? 0 : samplesPerSource }, (_, i) => {
        const keyVals = s.keys.map((k) => { const col = cols.find((x) => x.name === k) || { name: k, type: "BIGINT" }; return sampleValue(col, {}, i, true); });
        const props = {};
        (c.props || []).forEach((p) => {
          const fm = maps.find((m) => m.kind === "field" && m.classId === c.id && m.propId === p.id && m.target.table === s.table);
          if (!fm) return;
          const col = cols.find((x) => x.name === fm.target.column); if (!col) return;
          props[p.name] = mask && col.pii ? "••••••" : sampleValue(col, ctx.profileOf(s.table, col.name) || {}, i, s.keys.includes(col.name));
        });
        return { id: `${s.table}:${keyVals.join("|")}`, classId: c.id, label: `${c.name} ${keyVals.join("·")}`, source: s.table, key: keyVals.join("·"), props, row: i };
      });
    });
  });
  // links along mapped joins: sample i of the many side points at sample (i % n) of the one side
  const links = [];
  (ont.rels || []).forEach((r) => {
    const jm = maps.find((m) => m.kind === "join" && m.relId === r.id); if (!jm) return;
    const j = joins.find((x) => x.id === jm.target.joinId); if (!j) return;
    const fromS = (samples[r.from] || []).filter((x) => { const s = classes.find((c) => c.classId === r.from).sources.find((y) => y.table === x.source); return s && s.entityId && (s.entityId === j.from || s.entityId === j.to); });
    const toS = (samples[r.to] || []).filter((x) => { const s = classes.find((c) => c.classId === r.to).sources.find((y) => y.table === x.source); return s && s.entityId && (s.entityId === j.from || s.entityId === j.to); });
    if (!fromS.length || !toS.length) return;
    fromS.forEach((a, i) => { const b = toS[i % toS.length]; links.push({ relId: r.id, name: r.name, from: a.id, to: b.id, via: jm.target.joinId }); });
  });
  const total = classes.reduce((n, c) => n + (c.total || 0), 0);
  return { classes, samples, links, stats: { classes: classes.length, withData: classes.filter((c) => c.sources.length).length, entities: total,
    relationships: (ont.rels || []).length, linked: (ont.rels || []).filter((r) => maps.some((m) => m.kind === "join" && m.relId === r.id)).length } };
}

// ═════════════════════════════ EXPORT ════════════════════════════════════════
const esc = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const iri = (id) => `kg:${encodeURIComponent(id).replace(/%/g, "_")}`;
export function toTurtle(graph, { derived = true } = {}) {
  const L = ["@prefix kg: <https://kg.jnj.com/id/> .", "@prefix edg: <https://kg.jnj.com/def#> .", "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .", ""];
  graph.nodes.forEach((n) => L.push(`${iri(n.id)} a edg:${n.type.charAt(0).toUpperCase() + n.type.slice(1)} ; rdfs:label ${esc(n.label)} .`));
  L.push("");
  graph.edges.filter((e) => derived || !e.derived).forEach((e) => L.push(`${iri(e.from)} edg:${e.type} ${iri(e.to)} .${e.derived ? `  # derived · ${e.rule}` : ""}`));
  return L.join("\n");
}
export function toJsonLd(graph, { derived = true } = {}) {
  return JSON.stringify({ "@context": { kg: "https://kg.jnj.com/id/", edg: "https://kg.jnj.com/def#", label: "http://www.w3.org/2000/01/rdf-schema#label" },
    "@graph": [...graph.nodes.map((n) => ({ "@id": `kg:${n.id}`, "@type": `edg:${n.type}`, label: n.label })),
      ...graph.edges.filter((e) => derived || !e.derived).map((e) => ({ "@id": `kg:${e.id}`, "@type": `edg:${e.type}`, "edg:from": { "@id": `kg:${e.from}` }, "edg:to": { "@id": `kg:${e.to}` }, ...(e.derived ? { "edg:derivedBy": e.rule } : {}) }))] }, null, 2);
}
