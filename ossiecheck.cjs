// Is EDG still aligned with Apache Ossie?
//
// The spec is 0.2.0.dev0 and says so plainly: "Schema is mutable; do not depend on this
// version in production." It moved twice in three weeks. So alignment is not something
// you establish once — it is something you re-check, and this is the thing that checks.
//
// It fetches the live schema and spec, diffs them against the copies in this repo, and
// says what changed and what that means for us. It changes nothing on its own: a spec
// that has moved is a decision, not an auto-upgrade.
//
//   node ossiecheck.cjs            compare against the live spec
//   node ossiecheck.cjs --adopt    also write the new schema into the repo
//
// After adopting, run `node ossietest.cjs` — that is what proves we still conform.

const fs = require("fs");
const path = require("path");
const https = require("https");

const RAW = "https://raw.githubusercontent.com/apache/ossie/main";
const LOCAL_SCHEMA = path.join(__dirname, "ossie-schema.json");
const ADOPT = process.argv.includes("--adopt");

const get = (url) => new Promise((resolve, reject) => {
  https.get(url, {headers: {"User-Agent": "edg-ossiecheck"}}, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
      return get(res.headers.location).then(resolve, reject);
    if (res.statusCode !== 200) return reject(new Error(`${url} → HTTP ${res.statusCode}`));
    let body = ""; res.setEncoding("utf8");
    res.on("data", d => body += d);
    res.on("end", () => resolve(body));
  }).on("error", reject);
});

// Flatten so two schemas can be compared key by key rather than eyeballed.
const flat = (o, p = "", out = {}) => {
  if (Array.isArray(o)) out[p] = JSON.stringify(o);
  else if (o && typeof o === "object") Object.entries(o).forEach(([k, v]) => flat(v, `${p}/${k}`, out));
  else out[p] = o;
  return out;
};

// What each kind of schema change means for us, so the report says what to DO.
const consequence = (key, ours, live) => {
  if (/\/enum$/.test(key)) {
    const a = new Set(JSON.parse(ours || "[]")), b = new Set(JSON.parse(live || "[]"));
    const added = [...b].filter(x => !a.has(x)), gone = [...a].filter(x => !b.has(x));
    const bits = [];
    if (added.length) bits.push(`${added.join(", ")} now allowed — accept ${added.length === 1 ? "it" : "them"} on the way in`);
    if (gone.length)  bits.push(`${gone.join(", ")} REMOVED — stop emitting ${gone.length === 1 ? "it" : "them"}`);
    return bits.join("; ");
  }
  if (/\/required$/.test(key))              return "a required-field list moved — slOssieValidate's OSSIE_SHAPE must match";
  if (/\/properties\/[^/]+$/.test(key))     return ours === undefined ? "new field available to us" : "field changed shape";
  if (/minLength|minItems|maxLength/.test(key)) return "a constraint tightened — check nothing we emit is empty or short";
  if (/additionalProperties/.test(key))     return "the closed-key rule changed";
  if (/\/const$/.test(key))                 return "a pinned value changed — likely the spec version";
  return "review";
};

(async () => {
  console.log("Apache Ossie — alignment check\n");

  let liveSchemaText, liveSpec;
  try {
    [liveSchemaText, liveSpec] = await Promise.all([
      get(`${RAW}/core-spec/ossie-schema.json`),
      get(`${RAW}/core-spec/spec.md`),
    ]);
  } catch (e) {
    console.log("Could not reach apache/ossie:", e.message);
    console.log("Nothing has been changed. Try again when you are online.");
    process.exit(2);
  }

  const live = JSON.parse(liveSchemaText);
  const ours = JSON.parse(fs.readFileSync(LOCAL_SCHEMA, "utf8"));

  const specVersion = (liveSpec.match(/\*\*Version:\*\*\s*(\S+)/) || [])[1] || "unknown";
  const pinned = (live.properties && live.properties.version && live.properties.version.const) || "unknown";
  console.log(`  spec.md says      ${specVersion}`);
  console.log(`  schema pins       ${pinned}`);
  console.log(`  we vendored       ${(ours.properties && ours.properties.version && ours.properties.version.const) || "unknown"}\n`);

  const fo = flat(ours), fl = flat(live);
  const keys = [...new Set([...Object.keys(fo), ...Object.keys(fl)])].sort()
    .filter(k => String(fo[k]) !== String(fl[k]));

  if (!keys.length) {
    console.log("  Schema is unchanged. We are aligned.\n");
  } else {
    console.log(`  ${keys.length} schema change${keys.length === 1 ? "" : "s"}:\n`);
    keys.forEach(k => {
      console.log(`  ${k}`);
      console.log(`    ours: ${fo[k] === undefined ? "—" : String(fo[k]).slice(0, 110)}`);
      console.log(`    live: ${fl[k] === undefined ? "—" : String(fl[k]).slice(0, 110)}`);
      const why = consequence(k, fo[k], fl[k]);
      if (why) console.log(`    →     ${why}`);
      console.log("");
    });
  }

  // Headings are how the spec announces a new concept. A new one is the signal to read.
  const headings = [...liveSpec.matchAll(/^##+\s+(.+)$/gm)].map(m => m[1].trim());
  const known = [
    "Goals","Table of Contents","Enumerations","Dialects","Data types","Semantic Model",
    "Schema","Example","Examples","Migrating earlier document shapes","Datasets",
    "Primary Key Examples","Unique Keys Examples","Relationships","Important Notes",
    "Fields","Expression Object","Dimension Object","DataType and `is_time`: type vs. role",
    "Metrics","Custom Extensions","Vendor Names","Complete Example","AI Context Structure",
    "Recommended AI Context Fields","Version History","License",
  ];
  const fresh = headings.filter(h => !known.includes(h));
  if (fresh.length) {
    console.log("  New sections in spec.md — read these:\n");
    fresh.forEach(h => console.log(`    · ${h}`));
    console.log("");
  }

  // Things the community has said it intends to change. Not conformance — foresight.
  console.log("  Tracked proposals (roadmap discussions, not yet spec):\n");
  [
    ["#33",  "Rename Field to Dimension", "we show Fields today because the spec says fields"],
    ["#40",  "Metric trees / metric-to-metric references", "we inline derived metrics until this lands"],
    ["#42",  "Native units", "we carry unit in custom_extensions"],
    ["#43",  "Native currencies", "same"],
    ["#55",  "dimension_type, PII classification", "we carry dimension_type in custom_extensions"],
    ["#50",  "Explicit relationship cardinality", "we carry cardinality in custom_extensions"],
    ["#12",  "Entity / grain as a first-class concept", "we carry grain in custom_extensions"],
    ["#5",   "Semantic filters", "we fold filters into the expression"],
  ].forEach(([n, t, s]) => console.log(`    ${n.padEnd(5)} ${t}\n          ${s}`));
  console.log("");

  if (keys.length && ADOPT) {
    fs.writeFileSync(LOCAL_SCHEMA, liveSchemaText);
    console.log("  Adopted the live schema into ossie-schema.json.");
    console.log("  Now run `node ossietest.cjs` — that is what proves we still conform.\n");
  } else if (keys.length) {
    console.log("  Nothing written. Re-run with --adopt to take the new schema,");
    console.log("  then `node ossietest.cjs` to prove we still conform.\n");
  }

  process.exit(keys.length ? 1 : 0);
})();
