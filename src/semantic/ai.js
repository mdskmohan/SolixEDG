// ─────────────────────────────────────────────────────────────────────────────
// EDG semantic-model AI — suggestions for building and checking semantic models.
//
// Every function is pure: the caller passes in what the model may read (schema,
// column profiles, glossary, existing metrics, observed usage) and gets back
// SUGGESTIONS. Nothing here writes. Each suggestion carries the same provenance
// envelope the rest of the AI layer uses:
//
//   { by:"ai", src, conf, why, evidence:[…], state:"suggested" }
//
// A person accepts or dismisses it; only an accepted suggestion becomes part of
// the model. In production the reasoning steps are model calls; here they are
// deterministic so the prototype, the tests and the screens agree.
//
// ctx = {
//   schemaOf(table)        → [{name, type, desc, pk, pii}]
//   profileOf(table, col)  → {distinctPct, nullPct, distinctCount, topValues, dataType} | {}
//   glossary               → [{id, name, synonyms?, termType?}]
//   metrics                → existing metrics [{id, name, model, entity, agg, col, filters, type, numerator, denominator}]
//   entities               → existing datasets [{id, table}]   (to resolve metric.entity → table)
//   usage                  → observed usage records (see usage-seed.js)
//   settings               → {minConfidence, features:{…}, inputs:{…}}
// }
// ─────────────────────────────────────────────────────────────────────────────

export const AI_SRC = "EDG · Semantic Model AI";

const round2 = (n) => Math.round(Math.max(0, Math.min(1, n)) * 100) / 100;
export const envelope = (conf, why, evidence = []) =>
  ({ by: "ai", src: AI_SRC, conf: round2(conf), why, evidence, state: "suggested" });

const uniq = (a) => [...new Set(a)];
const pretty = (s) => String(s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const singular = (s) => String(s || "").replace(/ies$/, "y").replace(/ses$/, "s").replace(/s$/, "");
const stem = (table) => singular(String(table || "").replace(/^(dim|fct|fact|vw|stg|raw)_/, "").replace(/_(fact|dim|archive)$/, ""));
const baseType = (t) => String(t || "").toUpperCase().replace(/\(.*/, "");
const NUMERIC = /^(DECIMAL|NUMBER|NUMERIC|BIGINT|INT|INTEGER|SMALLINT|DOUBLE|FLOAT|REAL|BIGSERIAL)$/;
const TIME = /^(DATE|TIMESTAMP|TIMESTAMPTZ|DATETIME)$/;
const INTISH = /^(BIGINT|INT|INTEGER|SMALLINT|NUMBER|BIGSERIAL)$/;
const typesCompatible = (a, b) => {
  const x = baseType(a), y = baseType(b);
  if (x === y) return true;
  if (INTISH.test(x) && INTISH.test(y)) return true;
  if (/CHAR|STRING|TEXT/.test(x) && /CHAR|STRING|TEXT/.test(y)) return true;
  return false;
};
const isIdName = (c) => /(^id$|_id$|_ref$|_key$|_no$|_code$|^sku$)/i.test(c);
const cols = (ctx, table) => (ctx.schemaOf && ctx.schemaOf(table)) || [];
const prof = (ctx, table, col) => {
  if (ctx.settings && ctx.settings.inputs && ctx.settings.inputs.profiles === false) return {};
  const p = (ctx.profileOf && ctx.profileOf(table, col)) || {};
  return ctx.settings && ctx.settings.inputs && ctx.settings.inputs.samples === false ? { ...p, topValues: null, samples: null } : p;
};
const keysOf = (e) => (e && e.keys && e.keys.length) ? e.keys : (e && e.key ? [e.key] : []);
// Each usage record is read only if its kind of source is switched on in settings.
const usageOf = (ctx) => (ctx.usage || []).filter((u) => useInput(ctx, u.source === "query" ? "usage" : u.source));
const on = (ctx, f) => !ctx.settings || !ctx.settings.features || ctx.settings.features[f] !== false;
const useInput = (ctx, i) => !ctx.settings || !ctx.settings.inputs || ctx.settings.inputs[i] !== false;

// ═════════════════════════════ GRAIN ═════════════════════════════════════════
// What one row means. Declared keys win; a profiled unique column comes next;
// a column only NAMED like an id is a weak guess and says so.
export function suggestGrain(table, ctx) {
  const cs = cols(ctx, table);
  const pks = cs.filter((c) => c.pk).map((c) => c.name);
  if (pks.length) return { keys: pks, ...envelope(0.98, pks.length > 1 ? `Composite primary key (${pks.join(" + ")})` : `Declared primary key ${pks[0]}`) };
  const uniqueCol = cs.find((c) => { const p = prof(ctx, table, c.name); return p.distinctPct === 100 && p.nullPct === 0; });
  if (uniqueCol) return { keys: [uniqueCol.name], ...envelope(0.9, `${uniqueCol.name} is 100% distinct and never null`) };
  const own = cs.find((c) => c.name === `${stem(table)}_id`) || cs.find((c) => c.name === "id");
  if (own) return { keys: [own.name], ...envelope(0.62, `${own.name} is named like this table's identifier — not verified by a profile`) };
  return null;
}

// ═════════════════════════════ JOINS ═════════════════════════════════════════
// Candidate joins between the chosen datasets, each checked for fan-out and type
// mismatch before it is shown. Evidence: matching key names, column descriptions
// that name the target, and joins actually written in query history.
export function suggestJoins(entities, ctx) {
  const out = [];
  const usageJoins = usageOf(ctx).flatMap((u) => (u.joins || []).map((j) => ({ ...j, runs: u.runs || 0, object: u.object })));
  for (const A of entities) {
    for (const B of entities) {
      if (A.id === B.id) continue;
      const bKeys = keysOf(B);
      if (bKeys.length !== 1) continue;                       // composite targets are declared by hand
      const k = bKeys[0];
      const kCol = cols(ctx, B.table).find((c) => c.name === k);
      for (const c of cols(ctx, A.table)) {
        const aKeys = keysOf(A);
        const evidence = [];
        let conf = 0;
        const bStem = stem(B.table);
        if (c.name === k && k !== "id") { conf = Math.max(conf, 0.78); evidence.push(`Same column name: ${c.name}`); }
        if (c.name === `${bStem}_id` || c.name === `${bStem}_key`) { conf = Math.max(conf, 0.74); evidence.push(`${c.name} is named after ${B.table}`); }
        if (/_ref$/.test(c.name) && bStem.startsWith(c.name.replace(/_ref$/, ""))) { conf = Math.max(conf, 0.6); evidence.push(`${c.name} abbreviates ${bStem}`); }
        if (c.desc && new RegExp(`\\b${B.table}\\.${k}\\b`, "i").test(c.desc)) { conf = Math.max(conf, 0.86) + 0.04; evidence.push(`Column description references ${B.table}.${k}`); }
        const seen = usageJoins.filter((j) => (j.from === `${A.table}.${c.name}` && j.to === `${B.table}.${k}`));
        if (seen.length) {
          const runs = seen.reduce((n, j) => n + j.runs, 0);
          conf = Math.max(conf, 0.7) + 0.12;
          evidence.push(`Written in ${runs.toLocaleString("en-US")} queries (${uniq(seen.map((j) => j.object)).join(", ")})`);
        }
        if (!conf) continue;
        // Two keys of the same name are one-to-one only when both sides are keyed on it.
        const bothKeys = aKeys.length === 1 && aKeys[0] === c.name;
        if (bothKeys && A.table > B.table) continue;          // report a one-to-one once
        const issues = [];
        if (kCol && !typesCompatible(c.type, kCol.type)) { issues.push(`Types differ — ${c.type} vs ${kCol.type}.`); conf -= 0.25; }
        // A declared primary key is unique by definition; only a guessed key is
        // checked against its profile.
        const pB = prof(ctx, B.table, k);
        const declared = !!(kCol && kCol.pk) || B.keyStrong === true;
        const fanOut = !declared && pB.distinctPct != null && pB.distinctPct < 100;
        const pA = prof(ctx, A.table, c.name);
        if (pA.nullPct > 0) issues.push(`${c.name} is ${pA.nullPct}% null — those rows drop out of the join.`);
        if (fanOut) { issues.push(`${B.table}.${k} is not unique in its profile — the join may fan out.`); conf -= 0.2; }
        out.push({
          id: `aj_${A.id}_${c.name}_${B.id}`,
          from: A.id, to: B.id, fromKey: c.name, toKey: k, fromKeys: [c.name], toKeys: [k],
          cardinality: bothKeys ? "one_to_one" : "many_to_one",
          filterDirection: "single",
          fanOutSafe: !fanOut,
          issues,
          note: `Suggested by AI: ${evidence.join("; ")}.`,
          ...envelope(Math.min(conf, 0.97), evidence.slice().reverse().join(" · ") || "Matching key", evidence),
        });
      }
    }
  }
  // One suggestion per (from,to) pair: the strongest.
  const best = new Map();
  out.forEach((j) => { const key = `${j.from}>${j.to}`; if (!best.has(key) || best.get(key).conf < j.conf) best.set(key, j); });
  return [...best.values()].sort((a, b) => b.conf - a.conf);
}

// ═════════════════════════════ FIELDS ════════════════════════════════════════
const MEASURE_WORDS = /(amount|amt|cost|price|revenue|sales|spend|value|qty|quantity|units|clicks|impressions|views|duration|salary|balance|fee|tax|discount|count|total|ltv|lifetime_value|score)/i;
const AVG_WORDS = /(price|rate|pct|percent|ratio|score|avg|average|lifetime_value|duration)/i;
// A line total ("extended_price", "total_price") is money, and money adds up.
const isAvgish = (c) => AVG_WORDS.test(c) && !/^(extended|total|gross|net|line|sale)_/i.test(c);
const NOISE = /(password|hash|token|secret|properties|payload|_ingested_at|^_)/i;
const FREE_TEXT = /(url|address|description|comment|notes|reference|user_agent)/i;
const PII_PATTERNS = [
  [/(^|_)(e?ma?i?l|eml)($|_)|email/i, "Email address"],
  [/(phone|tel|mobile)/i, "Phone number"],
  [/(first_name|last_name|full_name|full_nm|customer_name|username)/i, "Person name"],
  [/(dob|date_of_birth|birth)/i, "Date of birth"],
  [/(address|pcode|postal|zip|ship_to)/i, "Postal address"],
  [/(ssn|national_id|passport|mrn)/i, "Government or medical identifier"],
  [/(ip_address|device_id)/i, "Network or device identifier"],
  [/(salary|compensation)/i, "Compensation"],
];
export const sensitivityOf = (c) => {
  const hit = PII_PATTERNS.find(([re]) => re.test(c.name));
  if (c.pii || hit) return { kind: hit ? hit[1] : "Personal data", why: c.pii ? "Profiled as personal data at ingest" : `Column name matches ${hit[1].toLowerCase()}` };
  return null;
};

export function dimTypeOf(c, p) {
  if (TIME.test(baseType(c.type)) || p.dataType === "datetime") return "time";
  if (isIdName(c.name) || p.distinctPct === 100) return "identifier";
  return "categorical";
}

// Role for every column of a dataset: key, time, dimension, measure, or leave out.
export function classifyFields(entity, ctx) {
  const keys = keysOf(entity);
  return cols(ctx, entity.table).map((c) => {
    const p = prof(ctx, entity.table, c.name);
    const t = baseType(c.type);
    const sensitive = on(ctx, "pii") ? sensitivityOf(c) : null;
    const base = { entity: entity.id, column: c.name, name: pretty(c.name), sensitive };
    if (keys.includes(c.name)) return { ...base, role: "key", ...envelope(0.99, "Part of the grain") };
    if (NOISE.test(c.name) || /^(MAP|JSON|JSONB|VARIANT|ARRAY|STRUCT|OBJECT)$/.test(t))
      return { ...base, role: "", ...envelope(0.82, /^(MAP|JSON|JSONB|VARIANT|ARRAY|STRUCT|OBJECT)$/.test(t) ? `${t} column — not groupable or summable` : "Technical column — no business meaning") };
    if (TIME.test(t)) return { ...base, role: "dimension", dimType: "time", ...envelope(0.95, `${t} column — a time dimension`) };
    if (NUMERIC.test(t) && !isIdName(c.name) && t !== "BOOLEAN") {
      const avg = isAvgish(c.name);
      const strong = MEASURE_WORDS.test(c.name);
      return { ...base, role: "measure", defaultAgg: avg ? "avg" : "sum", additive: !avg,
        ...envelope(strong ? 0.92 : 0.7, `${strong ? "Numeric and named like a measure" : "Numeric column"}${avg ? " — a rate or price, so averaged, not summed" : ""}`) };
    }
    if (sensitive && !(p.distinctPct != null && p.distinctPct < 5) && !isIdName(c.name))
      return { ...base, role: "", ...envelope(0.8, "Personal data with high cardinality — left out unless a metric needs it") };
    if (FREE_TEXT.test(c.name) && !(p.distinctPct != null && p.distinctPct < 5))
      return { ...base, role: "", ...envelope(0.66, "High-cardinality free text — rarely useful to group by") };
    const dt = dimTypeOf(c, p);
    const low = p.distinctPct != null && p.distinctPct < 1;
    return { ...base, role: "dimension", dimType: dt,
      ...envelope(dt === "identifier" ? 0.74 : low ? 0.93 : 0.8,
        dt === "identifier" ? "Identifier — groupable, high cardinality"
          : low ? `Low cardinality (${p.distinctCount || "few"} values)` : "Descriptive attribute") };
  });
}

// ═════════════════════════════ HIERARCHIES ═══════════════════════════════════
const HIER = [
  { name: "Geography", levels: [/^region$/, /^country(_code)?$/, /^state|province$/, /^city$/, /^(pcode|postal_code|zip|zip_code)$/] },
  { name: "Fiscal calendar", levels: [/^fiscal_year$|^year$/, /^fiscal_quarter$|^quarter$/, /^month(_name)?$/, /^week$/, /^date_day$|^date$/] },
  { name: "Product", levels: [/^department$/, /^category(_name)?$/, /^sub_?category(_name)?$/, /^brand$/, /^product_name$|^product$/] },
  { name: "Organization", levels: [/^division$/, /^dept(_name)?|department_name$/, /^team$/, /^(employee|emp)_name$/] },
];
export function suggestHierarchies(entities, ctx) {
  // Levels come from ONE dataset: a drill path across datasets is only valid
  // through a join, and that is declared, not guessed.
  const out = [];
  HIER.forEach((h) => entities.forEach((e) => {
    const levels = [];
    h.levels.forEach((re) => {
      const c = cols(ctx, e.table).find((x) => re.test(x.name));
      if (c) levels.push({ entity: e.id, column: c.name, name: pretty(c.name) });
    });
    if (levels.length >= 2)
      out.push({ id: `ah_${h.name.replace(/\s/g, "_").toLowerCase()}_${e.id}`, name: entities.length > 1 ? `${h.name} (${e.name || pretty(e.table)})` : h.name, levels,
        ...envelope(0.7 + Math.min(0.2, levels.length * 0.06), `${levels.map((l) => l.name).join(" › ")} in ${e.name || e.table}`) });
  }));
  return out;
}

// ═════════════════════════════ METRICS ═══════════════════════════════════════
const AGG_WORD = { sum: "Total", avg: "Average", "count distinct": "Count of", count: "Count of", min: "Minimum", max: "Maximum" };
const titleCase = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());
const filtersKey = (f) => (f || []).map((x) => `${x.col}${x.op}${x.val}`).sort().join("&");
const tableOfEntity = (ctx, id, local) => ((local || []).concat(ctx.entities || []).find((e) => e.id === id) || {}).table;

// Same aggregate over the same column, same table, same filters = the same metric,
// whatever it is called. A similar name alone is only a "near" duplicate.
export function findDuplicate(m, table, ctx, localEntities) {
  const sig = (x, t) => x.type === "ratio" || x.kind === "ratio"
    ? `${t}|ratio|${(x.numerator || {}).agg}:${(x.numerator || {}).col}/${(x.denominator || {}).agg}:${(x.denominator || {}).col}|${filtersKey(x.filters)}`
    : `${t}|${x.agg}|${x.col}|${filtersKey(x.filters)}`;
  const mine = sig(m, table);
  const exact = (ctx.metrics || []).find((x) => sig(x, tableOfEntity(ctx, x.entity, localEntities)) === mine);
  if (exact) return { kind: "exact", id: exact.id, name: exact.name, model: exact.model };
  const words = (s) => String(s || "").toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const near = (ctx.metrics || []).find((x) => {
    const a = words(x.name), b = words(m.name);
    return a.length && b.length && a.filter((w) => b.includes(w)).length >= Math.min(a.length, b.length);
  });
  return near ? { kind: "near", id: near.id, name: near.name, model: near.model } : null;
}

// Metrics proposed from what people already compute (query history, dashboards,
// dbt), then from measures nobody has queried yet. Each says where it came from.
export function suggestMetrics(entities, fields, ctx) {
  const byTable = Object.fromEntries(entities.map((e) => [e.table, e]));
  // The time a row happened: never a personal date (date of birth), and an event
  // or creation time ahead of an update or archive time.
  const timeOf = (e) => {
    const ts = cols(ctx, e.table).filter((c) => TIME.test(baseType(c.type)) && !sensitivityOf(c));
    const rank = (n) => /(created|order|txn|event|spend|session|placed|shipped)_?(at|date|ts|on)?$|_date$|^date/.test(n) ? 0 : /updated|archived|modified|_ingested/.test(n) ? 2 : 1;
    return (ts.sort((a, b) => rank(a.name) - rank(b.name))[0] || {}).name || null;
  };
  const groups = new Map();
  usageOf(ctx).forEach((u) => {
    const e = byTable[u.table]; if (!e) return;
    const sig = u.kind === "ratio"
      ? `${u.table}|ratio|${u.numerator.agg}:${u.numerator.col}/${u.denominator.agg}:${u.denominator.col}|${filtersKey(u.filters)}`
      : `${u.table}|${u.agg}|${u.col}|${filtersKey(u.filters)}`;
    const g = groups.get(sig) || { u, e, recs: [] };
    g.recs.push(u); groups.set(sig, g);
  });
  const out = [];
  groups.forEach(({ u, e, recs }) => {
    const runs = recs.reduce((n, r) => n + (r.runs || 0), 0);
    const users = recs.reduce((n, r) => n + (r.users || 0), 0);
    const sources = uniq(recs.map((r) => r.source));
    const label = recs.map((r) => r.label).find(Boolean) || u.col;
    const name = titleCase(label);
    const dims = uniq(recs.flatMap((r) => r.groupBy || [])).filter((c) => !TIME.test(baseType((cols(ctx, e.table).find((x) => x.name === c) || {}).type)));
    const timeDim = uniq(recs.flatMap((r) => r.groupBy || [])).find((c) => TIME.test(baseType((cols(ctx, e.table).find((x) => x.name === c) || {}).type))) || timeOf(e);
    const conf = Math.min(0.97, 0.6 + Math.min(0.25, Math.log10(1 + runs) / 16) + (sources.length - 1) * 0.06);
    const evidence = recs.map((r) => `${r.object}${r.runs ? ` · ${r.runs.toLocaleString("en-US")} runs, ${r.users} users` : ""}`);
    const draft = u.kind === "ratio"
      ? { name, type: "ratio", entity: e.id, numerator: { ...u.numerator, label: pretty(u.numerator.col).toLowerCase() },
          denominator: { ...u.denominator, label: pretty(u.denominator.col).toLowerCase() } }
      : { name, type: "simple", entity: e.id, agg: u.agg, col: u.col };
    out.push({ id: `am_${e.id}_${out.length}`, ...draft,
      timeDim, timeGrain: "day", filters: u.filters || [], dims,
      unit: /amount|cost|value|revenue|price/.test(u.col || (u.numerator || {}).col || "") && u.kind !== "ratio" ? "USD" : u.kind === "ratio" ? "ratio" : "count",
      origin: sources, runs, users,
      duplicate: findDuplicate({ ...draft, filters: u.filters || [] }, e.table, ctx, entities),
      ...envelope(conf, `${sources.map((s) => ({ query: "Query history", bi: "BI dashboards", dbt: "dbt metrics" })[s]).join(" + ")} · ${runs.toLocaleString("en-US")} runs by ${users} people`, evidence) });
  });
  // Measures nobody has queried: a plain total, lower confidence.
  const used = new Set(out.flatMap((m) => [m.type === "ratio" ? null : `${m.entity}.${m.col}`]));
  (fields || []).filter((f) => f.role === "measure").forEach((f) => {
    if (used.has(`${f.entity}.${f.column}`)) return;
    const e = entities.find((x) => x.id === f.entity); if (!e) return;
    const agg = f.defaultAgg || "sum";
    const draft = { name: `${AGG_WORD[agg] || "Total"} ${pretty(f.column)}`, type: "simple", entity: e.id, agg, col: f.column };
    out.push({ id: `am_${e.id}_${out.length}`, ...draft, timeDim: timeOf(e), timeGrain: "day", filters: [], dims: [],
      unit: /amount|cost|value|price/.test(f.column) ? "USD" : "count", origin: ["profile"], runs: 0, users: 0,
      duplicate: findDuplicate(draft, e.table, ctx, entities),
      ...envelope(0.58, "Measure column with no observed usage")});
  });
  return out.sort((a, b) => b.conf - a.conf);
}

// ═════════════════════════════ DESCRIPTIONS ══════════════════════════════════
const SYN = {
  amount: ["revenue", "sales", "value"], order: ["purchase", "sale"], customer: ["client", "buyer", "account"],
  cost: ["spend", "expense"], user: ["member", "account holder"], region: ["territory", "area"],
  quantity: ["units", "qty"], session: ["visit"], click: ["tap"], transaction: ["txn", "posting"],
  status: ["state", "stage"], product: ["item", "SKU"], campaign: ["promotion"], channel: ["medium", "source"],
  revenue: ["sales", "turnover"], segment: ["tier", "cohort"], country: ["market", "nation"],
};
export function synonymsFor(name) {
  const words = String(name || "").toLowerCase().split(/[\s_]+/).map(singular);
  return uniq(words.flatMap((w) => SYN[w] || [])).slice(0, 4);
}
const AGG_PHRASE = { sum: "Sum of", avg: "Average", "count distinct": "Number of distinct", count: "Number of", min: "Smallest", max: "Largest" };
const filtersText = (f) => (f || []).length ? `, where ${f.map((x) => `${x.col} ${x.op} ${x.val}`).join(" and ")}` : "";

export function describe(kind, obj, ctx = {}) {
  if (kind === "dataset") {
    const g = keysOf(obj);
    const desc = `One row per ${g.length ? g.map(pretty).join(" + ").toLowerCase() : "record"} in ${obj.table}.${obj.assetDesc ? ` ${obj.assetDesc}` : ""}`;
    return { name: obj.name, desc, synonyms: synonymsFor(stem(obj.table)), ...envelope(0.84, "From the grain and the catalog description") };
  }
  if (kind === "field") {
    const p = prof(ctx, obj.table, obj.column);
    const top = p.topValues ? ` Values: ${p.topValues.slice(0, 4).map((v) => String(v).replace(/\s*\(.*\)/, "")).join(", ")}.` : "";
    const base = obj.colDesc || `${pretty(obj.column)} of each ${singular(obj.table).replace(/_/g, " ")}`;
    return { name: pretty(obj.column), desc: `${base.replace(/\.$/, "")}.${top}`, synonyms: synonymsFor(obj.column),
      ...envelope(obj.colDesc ? 0.86 : 0.68, obj.colDesc ? "From the column description and profile" : "From the column name and profile") };
  }
  if (kind === "metric") {
    const body = obj.type === "ratio"
      ? `${pretty((obj.numerator || {}).col)} divided by ${pretty((obj.denominator || {}).col).toLowerCase()}`
      : `${AGG_PHRASE[obj.agg] || "Aggregate of"} ${pretty(obj.col).toLowerCase()}`;
    return { name: obj.name, desc: `${body} on ${obj.entityName || "the dataset"}${filtersText(obj.filters)}${obj.timeDim ? `, by ${pretty(obj.timeDim).toLowerCase()}` : ""}.`,
      synonyms: synonymsFor(obj.name), ...envelope(0.8, "From the metric definition") };
  }
  if (kind === "model") {
    const ents = obj.entities || [];
    const main = ents[0];
    const name = `${obj.domain || ""} ${main ? pretty(stem(main.table)) : "Model"}${ents.length > 1 ? " 360" : ""}`.trim();
    const desc = `${ents.map((e) => pretty(stem(e.table))).join(", ")} for the ${(obj.domain || "business").toLowerCase()} domain, at ${main ? keysOf(main).join(" + ") || main.table : "—"} grain.`;
    return { name, desc, ...envelope(0.7, "From the chosen datasets and domain") };
  }
  return null;
}

// ═════════════════════════════ GLOSSARY ══════════════════════════════════════
export function suggestTerm(name, ctx) {
  if (!useInput(ctx, "glossary")) return null;
  const toks = (s) => String(s || "").toLowerCase().split(/[\s_\-]+/).map(singular).filter((w) => w.length > 2);
  const mine = toks(name);
  if (!mine.length) return null;
  let best = null;
  (ctx.glossary || []).forEach((t) => {
    const names = [t.name, ...(t.synonyms || [])];
    names.forEach((n, i) => {
      const theirs = toks(n);
      if (!theirs.length) return;
      const hit = theirs.filter((w) => mine.includes(w)).length;
      const score = hit / Math.max(theirs.length, mine.length);
      const s = score * (i === 0 ? 1 : 0.92);
      if (s >= 0.6 && (!best || s > best.s)) best = { s, term: t, via: i === 0 ? "name" : `synonym "${n}"` };
    });
  });
  return best ? { termId: best.term.id, termName: best.term.name, ...envelope(0.55 + best.s * 0.4, `Matches the term's ${best.via}`) } : null;
}

// ═════════════════════════════ VALIDATION ════════════════════════════════════
// Problems in a model, each explained and, where possible, with a fix the screen
// can apply. A fix is data ({kind, …}), never code.
export function validateModel({ entities, joins, dims, facts, metrics }, ctx) {
  const issues = [];
  const ent = (id) => entities.find((e) => e.id === id);
  const push = (sev, title, explain, target, fix) => issues.push({ id: `v${issues.length + 1}`, severity: sev, title, explain, target, fix: fix || null });
  entities.forEach((e) => {
    if (!keysOf(e).length) {
      const g = suggestGrain(e.table, ctx);
      push("error", `${e.name} has no grain`, "Without a key nothing on this dataset can be counted safely, and the model cannot be certified.",
        { kind: "dataset", id: e.id }, g ? { kind: "setKey", entityId: e.id, keys: g.keys, label: `Use ${g.keys.join(" + ")} (${g.why})` } : null);
    }
  });
  (joins || []).forEach((j) => {
    const A = ent(j.from), B = ent(j.to); if (!A || !B) return;
    // Declared as able to fan out: the join is kept (it may be right), but anything
    // measured on the far side is counted once per matching row on the near side.
    if (j.fanOutSafe === false)
      push("warning", `${A.name} → ${B.name} can double-count`, `Several ${A.name} rows can point at one ${B.name}, so ${/^[aeiou]/i.test(B.name) ? "an" : "a"} ${B.name} measure read through this join is counted once per ${A.name} row. ${A.name} measures are safe.`,
        { kind: "join", id: j.id });
    const fc = cols(ctx, A.table).find((c) => c.name === j.fromKey), tc = cols(ctx, B.table).find((c) => c.name === j.toKey);
    if (fc && tc && !typesCompatible(fc.type, tc.type))
      push("warning", `${A.name} → ${B.name} compares different types`, `${j.fromKey} is ${fc.type} and ${j.toKey} is ${tc.type}; the join will need a cast and may silently match nothing.`, { kind: "join", id: j.id });
  });
  // Two different join routes between the same pair = ambiguous path.
  const pairs = new Map();
  (joins || []).forEach((j) => { const k = [j.from, j.to].sort().join("|"); pairs.set(k, [...(pairs.get(k) || []), j]); });
  // Role-playing joins (each with its own role, e.g. Order date / Ship date) are
  // deliberate; only unnamed duplicates are ambiguous.
  pairs.forEach((js) => { if (js.length > 1 && !(js.every((j) => j.role) && new Set(js.map((j) => j.role)).size === js.length)) {
    const A = ent(js[0].from), B = ent(js[0].to);
    push("warning", `Two join paths between ${A ? A.name : "?"} and ${B ? B.name : "?"}`, `Queries cannot tell which of ${js.map((j) => `${j.fromKey} = ${j.toKey}`).join(" or ")} to use. Keep one, or model the second as a role (for example "Ship Date").`,
      { kind: "join", id: js[1].id }, { kind: "removeJoin", joinId: js[1].id, label: `Remove ${js[1].fromKey} = ${js[1].toKey}` });
  } });
  // Datasets that nothing joins to.
  if (entities.length > 1) entities.forEach((e) => {
    if (!(joins || []).some((j) => j.from === e.id || j.to === e.id))
      push("info", `${e.name} is not joined`, "Its metrics work on their own, but cannot be sliced by fields from the other datasets.", { kind: "dataset", id: e.id });
  });
  (metrics || []).forEach((m) => {
    const e = ent(m.entity);
    if (m.type !== "ratio" && m.agg === "sum") {
      const f = (facts || []).find((x) => x.entity === m.entity && x.column === m.col);
      const isKey = (e && keysOf(e).includes(m.col)) || isIdName(m.col || "");
      // A declared semi-additive metric (sums across stores, last value over time)
      // has already been thought about.
      if (m.additive === false || (f && f.nonAdditiveOver)) { /* declared */ }
      else if ((f && f.additive === false) || isAvgish(m.col || "") || isKey)
        push("warning", `${m.name} sums something that should not be summed`,
          `${m.col} is ${isIdName(m.col || "") || (e && keysOf(e).includes(m.col)) ? "an identifier — summing ids is meaningless; count them" : "a rate or price — summing it across rows has no meaning; average it"}.`,
          { kind: "metric", id: m.id }, { kind: "setAgg", metricId: m.id, agg: isIdName(m.col || "") || (e && keysOf(e).includes(m.col)) ? "count distinct" : "avg",
            label: isIdName(m.col || "") || (e && keysOf(e).includes(m.col)) ? "Count distinct instead" : "Average instead" });
    }
    if (e && m.type !== "ratio") {
      const c = cols(ctx, e.table).find((x) => x.name === m.col);
      // A calculated field (a measure with an expression) is a column too.
      const calc = [...(facts || []), ...(dims || [])].some((x) => x.entity === e.id && x.column === m.col);
      if (!c && !calc && m.col) push("error", `${m.name} reads a column that does not exist`, `${e.table} has no column ${m.col}.`, { kind: "metric", id: m.id });
      // Counting personal identifiers reveals nothing; adding or averaging them does.
      else if (c && sensitivityOf(c) && !/count/.test(m.agg || "")) push("warning", `${m.name} is computed from personal data`, `${m.col} is ${sensitivityOf(c).kind.toLowerCase()}. Results will be masked for roles below Steward.`, { kind: "metric", id: m.id });
    }
    if (e && !m.timeDim && !(e.timeDims || []).length)
      push("info", `${m.name} has no time dimension`, "It cannot be trended or filtered to a period.", { kind: "metric", id: m.id });
  });
  const order = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ═════════════════════════════ TEST QUESTIONS ════════════════════════════════
// Questions the model should answer, each with the SQL it should compile to.
// Run them before and after a change to see whether answers moved.
const SQL_AGG = (agg, col) => agg === "count distinct" ? `COUNT(DISTINCT ${col})` : `${String(agg || "sum").toUpperCase()}(${col})`;
// Many-to-one only: a metric may be sliced by what its rows point AT, never by
// the rows that point at it — walking the other way fans out and double-counts.
const joinPath = (fromId, toId, joins) => {
  const seen = new Set([fromId]); const q = [[fromId, []]];
  while (q.length) {
    const [at, path] = q.shift();
    if (at === toId) return path;
    (joins || []).forEach((j) => {
      const next = j.from === at ? j.to : (j.to === at && j.cardinality === "one_to_one") ? j.from : null;
      if (next && !seen.has(next)) { seen.add(next); q.push([next, [...path, j]]); }
    });
  }
  return null;
};
export function generateTestQuestions({ entities, joins, dims, metrics }, ctx, limit = 8) {
  const ent = (id) => entities.find((e) => e.id === id);
  const out = [];
  (metrics || []).forEach((m) => {
    const e = ent(m.entity); if (!e) return;
    const where = (m.filters || []).map((f) => `${e.table}.${f.col} ${f.op === "is not" ? "<>" : "="} '${f.val}'`);
    const q = (c) => `${e.table}.${c}`;
    const expr = m.type === "ratio"
      ? `${SQL_AGG(m.numerator.agg, q(m.numerator.col))} / NULLIF(${SQL_AGG(m.denominator.agg, q(m.denominator.col))}, 0)`
      : SQL_AGG(m.agg, q(m.col));
    const td = m.timeDim || (e.timeDims || [])[0];
    if (td) out.push({ id: `tq_${m.id || m.name}_t`, metric: m.name, q: `What was ${m.name.toLowerCase()} last month?`,
      sql: `SELECT ${expr} AS ${m.name.toLowerCase().replace(/\W+/g, "_")}\nFROM ${e.table}\nWHERE ${[...where, `${q(td)} >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'`, `${q(td)} < DATE_TRUNC('month', CURRENT_DATE)`].join("\n  AND ")}` });
    // Slice by a dimension from another dataset, through the declared joins.
    const other = (dims || []).find((d) => d.entity !== e.id && d.type !== "time" && d.type !== "identifier" && joinPath(e.id, d.entity, joins));
    const local = (dims || []).find((d) => d.entity === e.id && d.type === "categorical");
    const d = other || local;
    if (d) {
      const path = joinPath(e.id, d.entity, joins) || [];
      let cur = e.id;
      const joinSql = path.map((j) => {
        const next = j.from === cur ? j.to : j.from;
        const left = ent(cur), right = ent(next);
        const onSql = j.from === cur ? `${left.table}.${j.fromKey} = ${right.table}.${j.toKey}` : `${left.table}.${j.toKey} = ${right.table}.${j.fromKey}`;
        cur = next;
        return `JOIN ${right.table} ON ${onSql}`;
      });
      const dt = (ent(d.entity) || {}).table;
      out.push({ id: `tq_${m.id || m.name}_d`, metric: m.name, q: `${m.name} by ${(d.name || pretty(d.column)).toLowerCase()}`,
        sql: `SELECT ${dt}.${d.column}, ${expr} AS ${m.name.toLowerCase().replace(/\W+/g, "_")}\nFROM ${e.table}${joinSql.length ? "\n" + joinSql.join("\n") : ""}${where.length ? `\nWHERE ${where.join(" AND ")}` : ""}\nGROUP BY ${dt}.${d.column}` });
    }
  });
  return out.slice(0, limit).map((t) => ({ ...t, ...envelope(0.9, "Compiled from the metric and the declared joins") }));
}

// ═════════════════════════════ VERSION CHANGES ═══════════════════════════════
export function summarizeChanges(prev, next) {
  if (!prev || !next) return { lines: [], impact: [] };
  const lines = [];
  const coll = (k, label, nameOf) => {
    const a = new Map((prev[k] || []).map((x) => [x.id, x])), b = new Map((next[k] || []).map((x) => [x.id, x]));
    b.forEach((x, id) => { if (!a.has(id)) lines.push({ kind: "added", text: `Added ${label} ${nameOf(x)}` }); });
    a.forEach((x, id) => { if (!b.has(id)) lines.push({ kind: "removed", text: `Removed ${label} ${nameOf(x)}` }); });
    b.forEach((x, id) => { if (a.has(id) && JSON.stringify(a.get(id)) !== JSON.stringify(x)) {
      const fields = Object.keys({ ...a.get(id), ...x }).filter((f) => JSON.stringify(a.get(id)[f]) !== JSON.stringify(x[f]) && !/^(updated|certifiedAt)$/.test(f));
      lines.push({ kind: "changed", text: `Changed ${label} ${nameOf(x)}: ${fields.slice(0, 4).join(", ")}`, id, coll: k });
    } });
  };
  coll("entities", "dataset", (x) => x.name);
  coll("rels", "join", (x) => `${x.fromKey} = ${x.toKey}`);
  coll("dims", "dimension", (x) => x.name);
  coll("facts", "measure", (x) => x.name);
  coll("metrics", "metric", (x) => x.name);
  // Impact: metrics that read a changed or removed dataset / measure.
  const touched = new Set(lines.filter((l) => l.kind !== "added" && (l.coll === "entities" || l.coll === "facts")).map((l) => l.id));
  const impact = (next.metrics || []).filter((m) => touched.has(m.entity) || (next.facts || []).some((f) => touched.has(f.id) && f.entity === m.entity && f.column === m.col)).map((m) => m.name);
  return { lines, impact: uniq(impact) };
}

// ═════════════════════════════ PLAIN-LANGUAGE EDITS ══════════════════════════
// "add metric Average Order Value = Net Revenue / Orders"
// "add metric Total Cost = sum of cost"   "rename metric X to Y"   "remove metric X"
export function parseEdit(text, { metrics = [], entities = [], facts = [] }) {
  const s = String(text || "").trim();
  const byName = (n) => metrics.find((m) => m.name.toLowerCase() === String(n).trim().toLowerCase());
  let m;
  if ((m = s.match(/^(?:add|create)\s+(?:a\s+)?metric\s+(.+?)\s*=\s*(.+?)\s*\/\s*(.+)$/i))) {
    const a = byName(m[2]), b = byName(m[3]);
    if (!a || !b) return { ok: false, error: `I could not find ${!a ? `"${m[2]}"` : `"${m[3]}"`} among this model's metrics.` };
    if (a.type === "ratio" || b.type === "ratio") return { ok: false, error: "A ratio of ratios is not supported — define it from simple metrics." };
    if (a.entity !== b.entity) return { ok: false, error: `${a.name} and ${b.name} are on different datasets — a ratio needs both on the same grain.` };
    return { ok: true, action: "addMetric", summary: `Add ratio metric ${m[1]} = ${a.name} ÷ ${b.name}`,
      metric: { name: m[1].trim(), type: "ratio", entity: a.entity, numerator: { agg: a.agg, col: a.col, label: a.name.toLowerCase() },
        denominator: { agg: b.agg, col: b.col, label: b.name.toLowerCase() }, filters: a.filters || [], timeDim: a.timeDim, timeGrain: a.timeGrain || "day", dims: [], unit: "ratio" } };
  }
  if ((m = s.match(/^(?:add|create)\s+(?:a\s+)?metric\s+(.+?)\s*=\s*(sum|average|avg|count distinct|count|min|max)\s+(?:of\s+)?([a-z_0-9]+)(?:\s+on\s+([a-z_0-9 ]+))?$/i))) {
    const agg = m[2].toLowerCase() === "average" ? "avg" : m[2].toLowerCase();
    const col = m[3];
    const f = facts.find((x) => x.column === col && (!m[4] || ((entities.find((e) => e.id === x.entity) || {}).name || "").toLowerCase() === m[4].trim().toLowerCase()));
    const e = f ? entities.find((x) => x.id === f.entity) : entities.find((x) => (x.columns || []).includes(col));
    if (!e) return { ok: false, error: `No dataset in this model has a measure ${col}.` };
    return { ok: true, action: "addMetric", summary: `Add metric ${m[1]} = ${agg} of ${col} on ${e.name}`,
      metric: { name: m[1].trim(), type: "simple", entity: e.id, agg, col, filters: [], timeDim: (e.timeDims || [])[0] || null, timeGrain: "day", dims: [], unit: /amount|cost|price|value/.test(col) ? "USD" : "count" } };
  }
  if ((m = s.match(/^rename\s+(?:metric\s+)?(.+?)\s+to\s+(.+)$/i))) {
    const a = byName(m[1]); if (!a) return { ok: false, error: `No metric called "${m[1]}".` };
    return { ok: true, action: "renameMetric", summary: `Rename ${a.name} to ${m[2]}`, metricId: a.id, name: m[2].trim() };
  }
  if ((m = s.match(/^(?:remove|delete)\s+(?:metric\s+)?(.+)$/i))) {
    const a = byName(m[1]); if (!a) return { ok: false, error: `No metric called "${m[1]}".` };
    return { ok: true, action: "removeMetric", summary: `Remove metric ${a.name}`, metricId: a.id };
  }
  return { ok: false, error: "Try: add metric <name> = <metric> / <metric> · add metric <name> = sum of <column> · rename metric <name> to <name> · remove metric <name>" };
}

// ═════════════════════════════ IMPORT ════════════════════════════════════════
// Convert another tool's semantic definition into datasets and metrics. Only the
// subset each format shares with Ossie is read; what the source leaves out (grain,
// joins, descriptions) is filled by the suggestions above and marked as such.
export function importDefinition(format, text, ctx) {
  const src = String(text || "");
  const datasets = [], metrics = [], warnings = [];
  if (format === "dbt") {
    // semantic_models: - name: x  model: ref('t') entities/dimensions/measures ; metrics: - name type_params measure
    // Split into top-level sections, then into each section's own list items (by
    // the indent of its first "- name:"), so nested measures stay inside their model.
    const smBlocks = src.split(/\n(?=[a-z_]+:\s*\n)/).flatMap((sec) => {
      const first = sec.match(/\n( *)-\s+name:/); if (!first) return [];
      return sec.split(new RegExp(`\\n${first[1]}-\\s+name:\\s*`)).slice(1);
    });
    smBlocks.forEach((blk) => {
      const name = blk.split(/\n/)[0].trim();
      const ref = (blk.match(/model:\s*ref\(['"]([\w]+)['"]\)/) || [])[1];
      if (ref) {
        const meas = [...blk.matchAll(/-\s*name:\s*(\w+)\s*\n\s*agg:\s*(\w+)(?:\s*\n\s*expr:\s*(\w+))?/g)].map((x) => ({ name: x[1], agg: x[2] === "count_distinct" ? "count distinct" : x[2], col: x[3] || x[1] }));
        const dims = [...blk.matchAll(/-\s*name:\s*(\w+)\s*\n\s*type:\s*(categorical|time)/g)].map((x) => ({ column: x[1], type: x[2] }));
        const pk = (blk.match(/-\s*name:\s*(\w+)\s*\n\s*type:\s*primary/) || [])[1];
        datasets.push({ name, table: ref, keys: pk ? [pk] : [], measures: meas, dims });
      } else if (/type_params/.test(blk)) {
        const measure = (blk.match(/measure:\s*(\w+)/) || [])[1];
        metrics.push({ name: pretty(name), measure, type: (blk.match(/type:\s*(\w+)/) || [])[1] || "simple" });
      }
    });
  } else if (format === "lookml") {
    [...src.matchAll(/view:\s*(\w+)\s*\{([\s\S]*?)\n\}/g)].forEach((v) => {
      const table = (v[2].match(/sql_table_name:\s*[\w.]*?\.?(\w+)\s*;;/) || [])[1] || v[1];
      const pk = [...v[2].matchAll(/dimension:\s*(\w+)\s*\{[^}]*primary_key:\s*yes/g)].map((x) => x[1]);
      const dims = [...v[2].matchAll(/dimension(?:_group)?:\s*(\w+)\s*\{((?:\$\{[^}]*\}|[^{}])*)\}/g)].map((x) => ({ column: x[1], type: /time/.test(x[2]) ? "time" : "categorical" }));
      const meas = [...v[2].matchAll(/measure:\s*(\w+)\s*\{((?:\$\{[^}]*\}|[^{}])*)\}/g)].map((x) => {
        const type = (x[2].match(/type:\s*(\w+)/) || [])[1] || "sum";
        const col = (x[2].match(/\$\{TABLE\}\.(\w+)|\$\{(\w+)\}/) || []).slice(1).find(Boolean) || x[1];
        return { name: x[1], agg: type === "count_distinct" ? "count distinct" : type === "average" ? "avg" : type, col };
      });
      datasets.push({ name: v[1], table, keys: pk, measures: meas, dims });
      meas.forEach((mm) => metrics.push({ name: pretty(mm.name), measure: mm.name, type: "simple" }));
    });
  } else if (format === "snowflake") {
    // CREATE SEMANTIC VIEW … TABLES ( alias AS db.schema.table PRIMARY KEY (col) ) … METRICS ( alias.name AS SUM(col) )
    [...src.matchAll(/(\w+)\s+AS\s+[\w.]*?\.?(\w+)\s+PRIMARY KEY\s*\(([^)]+)\)/gi)].forEach((x) =>
      datasets.push({ name: x[1], table: x[2], keys: x[3].split(",").map((s) => s.trim()), measures: [], dims: [] }));
    [...src.matchAll(/(\w+)\.(\w+)\s+AS\s+(SUM|AVG|COUNT|MIN|MAX)\s*\(\s*(DISTINCT\s+)?(?:\w+\.)?(\w+)\s*\)/gi)].forEach((x) => {
      const ds = datasets.find((d) => d.name === x[1]);
      const agg = x[3].toLowerCase() === "count" && x[4] ? "count distinct" : x[3].toLowerCase();
      if (ds) ds.measures.push({ name: x[2], agg, col: x[5] });
      metrics.push({ name: pretty(x[2]), measure: x[2], type: "simple" });
    });
  } else {
    return { ok: false, error: `Unsupported format: ${format}` };
  }
  if (!datasets.length) return { ok: false, error: "No datasets found in the definition." };
  // Fill what the source left out.
  const filled = [];
  datasets.forEach((d) => {
    if (!cols(ctx, d.table).length) warnings.push(`${d.table} is not in the catalog — it will be imported without a schema.`);
    if (!d.keys.length) {
      const g = suggestGrain(d.table, ctx);
      if (g) { d.keys = g.keys; d.keyProv = g; filled.push(`Grain of ${d.table}: ${g.keys.join(" + ")} (${g.why})`); }
      else warnings.push(`No grain could be found for ${d.table}.`);
    }
  });
  metrics.forEach((m) => {
    const ds = datasets.find((d) => d.measures.some((x) => x.name === m.measure));
    const ms = ds && ds.measures.find((x) => x.name === m.measure);
    if (ds && ms) Object.assign(m, { table: ds.table, agg: ms.agg, col: ms.col });
    else warnings.push(`Metric ${m.name} refers to a measure that was not found.`);
  });
  return { ok: true, format, datasets, metrics: metrics.filter((m) => m.table), warnings, filled };
}

// ═════════════════════════════ ORCHESTRATION ═════════════════════════════════
// One call for the New model flow: everything the AI would propose for a set of
// datasets. Feature switches in settings turn whole kinds of suggestion off.
export function generateModel({ entities, domain }, ctx) {
  const minC = (ctx.settings && ctx.settings.minConfidence) || 0;
  const keep = (xs) => xs.filter((x) => x.conf >= minC);
  const grains = Object.fromEntries(entities.filter((e) => !keysOf(e).length).map((e) => [e.id, suggestGrain(e.table, ctx)]).filter(([, g]) => g));
  const withKeys = entities.map((e) => grains[e.id] ? { ...e, keys: grains[e.id].keys, key: grains[e.id].keys[0] } : e);
  const fields = on(ctx, "fields") ? withKeys.flatMap((e) => classifyFields(e, ctx)) : [];
  const fieldsWithText = on(ctx, "descriptions") ? fields.map((f) => {
    const e = withKeys.find((x) => x.id === f.entity);
    const c = cols(ctx, e.table).find((x) => x.name === f.column) || {};
    const d = describe("field", { table: e.table, column: f.column, colDesc: c.desc }, ctx);
    const t = on(ctx, "terms") ? suggestTerm(f.column, ctx) : null;
    return { ...f, desc: d.desc, synonyms: d.synonyms, term: t };
  }) : fields;
  const metrics = on(ctx, "metrics") ? keep(suggestMetrics(withKeys, fields, ctx)).map((m) => {
    const e = withKeys.find((x) => x.id === m.entity);
    const d = on(ctx, "descriptions") ? describe("metric", { ...m, entityName: e && e.name }, ctx) : null;
    const t = on(ctx, "terms") ? suggestTerm(m.name, ctx) : null;
    return { ...m, definition: d ? d.desc : "", synonyms: d ? d.synonyms : [], term: t };
  }) : [];
  return {
    grains,
    identity: on(ctx, "descriptions") ? describe("model", { entities: withKeys, domain }, ctx) : null,
    datasets: on(ctx, "descriptions") ? withKeys.map((e) => ({ entity: e.id, ...describe("dataset", e, ctx) })) : [],
    joins: on(ctx, "joins") ? keep(suggestJoins(withKeys, ctx)) : [],
    fields: fieldsWithText,
    hierarchies: on(ctx, "hierarchies") ? keep(suggestHierarchies(withKeys, ctx)) : [],
    metrics,
  };
}

export const FEATURES = [
  { k: "joins", l: "Joins" }, { k: "fields", l: "Field roles" }, { k: "hierarchies", l: "Hierarchies" },
  { k: "metrics", l: "Metrics" }, { k: "descriptions", l: "Descriptions and synonyms" }, { k: "terms", l: "Glossary links" },
  { k: "validation", l: "Validation fixes" }, { k: "tests", l: "Test questions" }, { k: "changes", l: "Version summaries" },
  { k: "pii", l: "Sensitive fields" }, { k: "import", l: "Import conversion" },
];
export const INPUTS = [
  { k: "schema", l: "Schema", ex: "Column names, types, keys", required: true },
  { k: "profiles", l: "Column profiles", ex: "Distinct %, null %, top values" },
  { k: "samples", l: "Sample values", ex: "completed, pending, cancelled" },
  { k: "usage", l: "Query history", ex: "SUM(amount) WHERE status <> 'cancelled' · 1,840 runs" },
  { k: "bi", l: "BI dashboards", ex: "Tableau · Revenue Overview" },
  { k: "dbt", l: "dbt metrics", ex: "metrics/revenue.yml" },
  { k: "glossary", l: "Glossary", ex: "Customer Lifetime Value" },
  { k: "lineage", l: "Lineage", ex: "orders → fct_revenue → Orders_Certified" },
];
