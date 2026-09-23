// Headless conformance test for the Apache Ossie (incubating) export.
//
// It does two separate things, and the second is the one that matters:
//   1. runs EDG's own slOssieValidate over every emitted document, and
//   2. validates the same documents against the REAL core-spec/ossie-schema.json
//      downloaded from apache/ossie, using a small draft-2020-12 checker below.
// Agreement between the two is the point. If EDG's validator ever says yes where the
// published schema says no, this file fails and the claim of compatibility is false.
//
//   node ossietest.cjs [path/to/ossie-schema.json]

const fs = require("fs");
const path = require("path");
const src = fs.readFileSync("solix-platform-v2.jsx", "utf8");
const lines = src.split("\n");

// ── Pull the pure blocks straight out of the JSX, in dependency order.
// A declaration runs until the first line that starts a new one: indented lines and
// the closing `};` belong to it, a fresh statement at column 0 does not.
const grabFrom = (i) => {
  let j = i + 1;
  const belongs = (k) => /^\s/.test(lines[k]) || /^[}\])]/.test(lines[k]);
  while (j < lines.length) {
    if (lines[j].trim() === "") {
      const next = lines.findIndex((l, k) => k > j && l.trim() !== "");
      if (next < 0 || !belongs(next)) break;
    } else if (!belongs(j)) break;
    j++;
  }
  return lines.slice(i, j).join("\n");
};
const grab = (startsWith) => {
  const i = lines.findIndex(l => l.startsWith(startsWith));
  if (i < 0) throw new Error("not found: " + startsWith);
  return grabFrom(i);
};
const span = (startsWith, endStartsWith) => {
  const i = lines.findIndex(l => l.startsWith(startsWith));
  const j = lines.findIndex((l, k) => k > i && l.startsWith(endStartsWith));
  if (i < 0 || j < 0) throw new Error("span not found: " + startsWith);
  return lines.slice(i, j).join("\n");
};

const block = [
  "const SCHEMA = {",
  "const GLOSSARY_TERMS = [",
  "const SL_CONF = ",
  "const SL_TYPES = ",
  "const SL_CONCEPTS = ",
  "const SL_CONCEPT_RELS = ",
  "const SL_REL_TYPES = ",
  "const SL_ENTITIES = ",
  "const SL_MODELS = ",
  "const SL_METRICS = ",
  "const SL_VENDOR = ",
  "const SL_RELATIONSHIPS = ",
  "const SL_DIMENSIONS = ",
  "const SL_FACTS = ",
  "const SL_DIM_TYPES = ",
].map(grab).join("\n\n")
  // SCHEMA is declared holding one table and extended by Object.assign blocks. Without
  // them the sandbox sees a catalogue with almost no columns, and every datatype the
  // export should carry comes back empty for the wrong reason.
  + "\n\n" + lines.map((l, i) => l.startsWith("Object.assign(SCHEMA,{") ? grabFrom(i) : null)
                  .filter(Boolean).join("\n\n")
  + "\n\n" + grab("let _slState = ")
  + "\n\n" + ["const slSlug ", "const slPK ", "const slQ ", "const slMeasureName ",
              "const slEntConcept ", "const slConceptNames ", "const slSynList "].map(grab).join("\n\n")
  + "\n\n" + span("const OSSIE_VERSION", "const SL_ADAPTERS");

const M = new Function(block + `
  return {slOssieDoc, slOssieValidate, slAdaptOssie, slOssieGaps, slOssieExpr, slYaml,
          slOssieType, OSSIE_VERSION, OSSIE_DATATYPES, slParseYaml, slApplyOssie, slReadOssie,
          slOssieDialects, slDax, slTableauCalc,
          SL_MODELS, SL_ENTITIES, SL_RELATIONSHIPS, SL_DIMENSIONS, SL_FACTS, SL_METRICS};
`)();

// ── A draft-2020-12 subset good enough for ossie-schema.json: $ref/$defs, type,
//    properties, required, additionalProperties:false, enum, const, items, minItems,
//    oneOf. Deliberately strict — an unsupported keyword throws rather than passing.
const makeValidator = (schema) => {
  const resolve = (ref) => ref.split("/").slice(1).reduce((o, k) =>
    o[k.replace(/~1/g, "/").replace(/~0/g, "~")], schema);
  const TYPE_OK = {
    string: v => typeof v === "string",
    number: v => typeof v === "number",
    integer: v => Number.isInteger(v),
    boolean: v => typeof v === "boolean",
    object: v => v !== null && typeof v === "object" && !Array.isArray(v),
    array: v => Array.isArray(v),
    null: v => v === null,
  };
  const KNOWN = new Set(["$schema","$id","title","description","examples","$defs",
    "$ref","type","properties","required","additionalProperties","enum","const",
    "items","minItems","oneOf"]);

  const check = (v, s, p, errs) => {
    Object.keys(s).forEach(k => { if (!KNOWN.has(k)) throw new Error("unsupported schema keyword: " + k); });
    if (s.$ref) return check(v, resolve(s.$ref), p, errs);
    if (s.oneOf) {
      const hits = s.oneOf.filter(sub => { const e = []; check(v, sub, p, e); return !e.length; });
      if (hits.length !== 1) errs.push(`${p}: matches ${hits.length} of ${s.oneOf.length} oneOf branches`);
      return;
    }
    if (s.type && !TYPE_OK[s.type](v)) { errs.push(`${p}: expected ${s.type}`); return; }
    if (s.const !== undefined && v !== s.const) errs.push(`${p}: must equal ${JSON.stringify(s.const)}`);
    if (s.enum && !s.enum.includes(v)) errs.push(`${p}: ${JSON.stringify(v)} not in enum`);
    if (Array.isArray(v)) {
      if (s.minItems != null && v.length < s.minItems) errs.push(`${p}: needs at least ${s.minItems} item(s)`);
      if (s.items) v.forEach((x, i) => check(x, s.items, `${p}[${i}]`, errs));
    }
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      (s.required || []).forEach(k => { if (v[k] === undefined) errs.push(`${p}: missing required \`${k}\``); });
      if (s.properties) Object.entries(v).forEach(([k, x]) => {
        if (s.properties[k]) check(x, s.properties[k], `${p}.${k}`, errs);
        else if (s.additionalProperties === false) errs.push(`${p}: \`${k}\` is not allowed (additionalProperties:false)`);
      });
    }
  };
  return (doc) => { const errs = []; check(doc, schema, "$", errs); return errs; };
};

// ── Run.
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra !== undefined ? "\n          → " + JSON.stringify(extra, null, 2).slice(0, 1400) : "")); }
};

const schemaPath = process.argv[2] || path.join(__dirname, "ossie-schema.json");
let validateAgainstSpec = null;
if (fs.existsSync(schemaPath)) {
  validateAgainstSpec = makeValidator(JSON.parse(fs.readFileSync(schemaPath, "utf8")));
  console.log("Schema: " + schemaPath);
} else {
  console.log("Schema: NOT FOUND at " + schemaPath + " — only EDG's own validator will run.");
}
console.log("");

M.SL_MODELS.forEach(mdl => {
  const ents  = M.SL_ENTITIES.filter(e => (mdl.entityIds || []).includes(e.id));
  const rels  = M.SL_RELATIONSHIPS.filter(r => ents.some(e => e.id === r.from) && ents.some(e => e.id === r.to));
  const mets  = M.SL_METRICS.filter(m => m.model === mdl.id);
  const dims  = M.SL_DIMENSIONS.filter(d => ents.some(e => e.id === d.entity));
  const facts = M.SL_FACTS.filter(x => ents.some(e => e.id === x.entity));
  const ctx = { mdl, ents, rels, mets, dims, facts };

  console.log(`── ${mdl.name}`);
  const doc = M.slOssieDoc(ctx);

  const mine = M.slOssieValidate(doc).filter(e => e.level === "error");
  ok(`${mdl.name}: EDG validator reports no errors`, mine.length === 0, mine);

  if (validateAgainstSpec) {
    const errs = validateAgainstSpec(doc);
    ok(`${mdl.name}: validates against apache/ossie core-spec ${M.OSSIE_VERSION}`, errs.length === 0, errs);
  }

  // Structural expectations the schema cannot state.
  ok(`${mdl.name}: every entity became a dataset`, doc.datasets.length === ents.length,
     { datasets: doc.datasets.length, entities: ents.length });
  ok(`${mdl.name}: every metric carries an ANSI_SQL expression or is reported as a gap`,
     (doc.metrics || []).every(m => m.expression.dialects.length > 0
        || M.slOssieGaps(ctx).some(g => g.metric && g.level === "blocked")),
     (doc.metrics || []).filter(m => !m.expression.dialects.length).map(m => m.name));
  ok(`${mdl.name}: governance survives the crossing`,
     (doc.metrics || []).every(m => {
        const d = JSON.parse(m.custom_extensions[0].data);
        return d.governance && d.governance.owner && d.metric_type;
     }));
  ok(`${mdl.name}: relationships point at datasets that exist`,
     (doc.relationships || []).every(r =>
        doc.datasets.some(d => d.name === r.from) && doc.datasets.some(d => d.name === r.to)));

  // The serialiser has to survive a round trip through the eyes, at least structurally.
  const body = M.slAdaptOssie(ctx)[0].body;
  ok(`${mdl.name}: YAML emits without a stray "undefined" or "[object Object]"`,
     !/undefined|\[object Object\]/.test(body),
     (body.match(/.*(undefined|\[object Object\]).*/g) || []).slice(0, 3));

  // OSSIE_PRINT=<model id> prints the document itself, for reading by eye.
  if (process.env.OSSIE_PRINT === mdl.id) console.log("\n" + body + "\n");

  const {doc: reparsed, errors: perr} = M.slParseYaml(body);
  ok(`${mdl.name}: the emitted YAML parses back`, perr.length === 0, perr);
  ok(`${mdl.name}: re-parsed document still validates`,
     M.slOssieValidate(reparsed).filter(e => e.level === "error").length === 0,
     M.slOssieValidate(reparsed).filter(e => e.level === "error"));
  const round = M.slReadOssie(body, { mdl, ents, dims, facts, metrics: mets });
  ok(`${mdl.name}: round trip is a no-op — emit, read back, nothing changed`,
     round.ok && round.changes.length === 0, round.ok ? round.changes : round.errors);

  const gaps = M.slOssieGaps(ctx);
  if (gaps.length) gaps.forEach(g => console.log(`        gap · ${g.level.padEnd(7)} ${g.metric.name} — ${g.why}`));
  console.log("");
});

// Datatype mapping, against the physical types the catalogue actually holds.
console.log("── Datatype mapping");
[["BIGINT","Integer"],["DECIMAL(12,2)","Decimal"],["NUMBER(12,2)","Decimal"],["NUMBER(6)","Integer"],
 ["VARCHAR(255)","String"],["VARCHAR2(50)","String"],["CHAR(3)","String"],["ENUM","String"],
 ["BOOLEAN","Boolean"],["DATE","Date"],["TIMESTAMP","DateTime"],["TIMESTAMPTZ","DateTimeTz"],
 ["DATETIME","DateTime"],["JSONB","Opaque"],["INT UNSIGNED","Integer"],["BIGSERIAL","Integer"],
 ["STRING","String"],["SOMETHING_ELSE",null]].forEach(([phys, want]) =>
  ok(`${phys} → ${want}`, M.slOssieType(phys) === want, M.slOssieType(phys)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
