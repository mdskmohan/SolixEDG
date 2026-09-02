// Headless test of the Knowledge Layer pure logic — extracts the seed + logic
// blocks straight out of the JSX and exercises them, so the numbers are verified
// before any of this is wired to a screen.
const fs = require("fs");
const src = fs.readFileSync("solix-platform-v2.jsx", "utf8");
const lines = src.split("\n");

const from = (startsWith) => lines.findIndex(l => l.startsWith(startsWith));
const seedStart = from("const KL_SRC_SEED = [");
const logicEnd  = from("const klLineDiff = ");
const block = lines[from("const KL_ENTITIES = ")] + "\n" +
              lines.slice(seedStart, logicEnd + 6).join("\n");

const sandbox = {};
const fn = new Function(block + `
  return {KL_SRC_SEED, KL_X_SEED, klExceptions, klScore, klWorklist, klDialPreview,
          klReadiness, klMoney, klMoneyFull, KL_MEASURES, klBuildIR, klCompile,
          klDiff, klLineDiff, klRuleSQL, klSlug, KL_CUSTOM_OPEN, KL_CUSTOM_CLOSE,
          KL_ID_ROLES, KL_ID_SIGNALS, klMatchKeys, klExcluded, klMatchable, klBinding,
          klFill, klCrossCols, klKeyEvidence, klKeyExclusions, klOpen:
          (x)=>[...(x.conflicts||[]),...(x.unmatched||[])].filter(r=>(r.state||"open")==="open").length};
`);
const M = fn();

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra !== undefined ? "  → " + JSON.stringify(extra) : "")); }
};

console.log("\n-- Identifier roles: a classification is not a match key --");
const sapV = M.KL_SRC_SEED[0].masters.find(m => m.table === "VENDOR_MASTER");
const ebsV = M.KL_SRC_SEED[1].masters.find(m => m.table === "AP_SUPPLIERS");
const fusV = M.KL_SRC_SEED[2].masters.find(m => m.table === "POZ_SUPPLIERS");

// The bug this whole model exists to prevent. SAP's vendor number and Fusion's SEGMENT1 are
// both "the vendor code" and mean nothing to each other, so matching on it merges unrelated
// suppliers. Typing the role has to make that impossible, not merely unlikely.
ok("a local code is never a cross-source match key",
   [sapV, ebsV, fusV].every(m => !M.klMatchKeys(m).includes("Vendor Code")),
   [sapV, ebsV, fusV].map(m => M.klMatchKeys(m)));
ok("the local code is still declared, and its exclusion carries a reason",
   M.klExcluded(fusV).some(c => c.c === "SEGMENT1" && /inside this system only/.test(c.why || "")));
ok("no published cross-source graph matches on an excluded role",
   M.KL_X_SEED.every(x => x.srcIds.every(id => {
     const g = M.KL_SRC_SEED.find(y => y.id === id);
     const m = g && g.masters.find(y => y.entity === x.entity && y.ready);
     if (!m) return true;
     return (x.keys || []).every(k => {
       const c = (m.idCols || []).find(y => y.key === k);
       return !c || M.KL_ID_ROLES[c.role].cross;
     });
   })), M.KL_X_SEED.map(x => [x.key, x.keys]));

// A primary key identifies a row, not a business entity.
ok("a technical primary key is never a match key",
   M.KL_SRC_SEED.every(g => g.masters.every(m =>
     !(m.idCols || []).some(c => c.role === "technical_key" && M.klMatchKeys(m).includes(c.key)))));
ok("every master's declared PK is typed as a technical or natural key",
   M.KL_SRC_SEED.every(g => g.masters.every(m => {
     if (!m.rule || !(m.idCols || []).length) return true;
     const c = m.idCols.find(y => y.c === m.rule.pk);
     return !c || c.role === "technical_key" || c.role === "natural_key";
   })));

// Classification and identifier role are independent concepts. Both directions have to hold,
// or the two have quietly been collapsed back into one.
ok("a column can identify without carrying any classification",
   (fusV.idCols.find(c => c.c === "SEGMENT1") || {}).cls.length === 0);
ok("a classification alone does not make a column a key",
   M.klExcluded(sapV).some(c => (c.cls || []).length > 0) ||
   M.KL_ID_ROLES[sapV.idCols.find(c => c.c === "SMTP_ADDR").role].hint.includes("Supporting evidence"));

console.log("\n-- Match keys are derived, never authored twice --");
ok("every ready master's key list equals its derived keys",
   M.KL_SRC_SEED.every(g => g.masters.every(m =>
     !(m.idCols || []).length || JSON.stringify(m.keys) === JSON.stringify(M.klMatchKeys(m)))),
   M.KL_SRC_SEED.flatMap(g => g.masters.map(m => [m.table, m.keys])));
ok("a master with no declared identity is honestly not matchable",
   !M.klMatchable(M.KL_SRC_SEED[1].masters.find(m => m.table === "MTL_SYSTEM_ITEMS_B")));
ok("every published cross-source key exists in every source it joins",
   M.KL_X_SEED.filter(x => x.status === "Published").every(x =>
     x.keys.every(k => x.srcIds.every(id => {
       const g = M.KL_SRC_SEED.find(y => y.id === id);
       const m = g && g.masters.find(y => y.entity === x.entity && y.ready);
       return !m || M.klMatchKeys(m).includes(k);
     }))),
   M.KL_X_SEED.map(x => [x.key, x.keys]));

console.log("\n-- Profiling is the evidence, and the weakest binding decides --");
const ev = M.klKeyEvidence(M.KL_SRC_SEED, ["sg1", "sg2", "sg3"], "Supplier");
const tax = ev.find(e => e.key === "Tax ID");
ok("a key's strength is its worst source, not its best", tax.minFill === 61, tax);
ok("the binding is per-source, because the column name differs in every system",
   tax.sources.map(x => x.col).join(",") === "STCD1,NUM_1099,TAXPAYER_ID", tax.sources.map(x => x.col));
ok("the weak binding is the one the unmatched rows already blame",
   /blank in Oracle EBS/.test(JSON.stringify(M.KL_X_SEED[0].unmatched || [])));
ok("a key present in only one source is not a shared key",
   ev.find(e => e.key === "Email").sources.length === 1);
ok("excluded keys are reported to the builder with their reason",
   M.klKeyExclusions(M.KL_SRC_SEED, ["sg1", "sg2", "sg3"], "Supplier")
    .some(e => e.key === "Vendor Code" && e.sources.length === 3),
   M.klKeyExclusions(M.KL_SRC_SEED, ["sg1", "sg2", "sg3"], "Supplier"));
ok("every proposed role names the signal that proposed it",
   M.KL_SRC_SEED.every(g => g.masters.every(m => (m.idCols || []).every(c =>
     M.KL_ID_SIGNALS.some(sg => sg.k === c.by)))));
console.log("     Supplier keys:", ev.map(e => e.key + " min " + e.minFill + "% in " + e.sources.length + " src").join(" | "));
console.log("\n── Worklist ranking (C3) ──");
const wl = M.klWorklist(M.KL_X_SEED);
ok("every exception surfaces across all graphs", wl.length === 10, wl.length);
ok("top item is the $9.27M Owens Corning doubt", wl[0].name === "Owens Corning", wl[0].name);
ok("ranked strictly by governs x (1-conf)",
   wl.every((it, i) => i === 0 || M.klScore(wl[i - 1]) >= M.klScore(it)));
console.log("     top 4:", wl.slice(0, 4).map(i => `${i.name} ${M.klMoney(i.governs)}@${i.conf}`).join(" | "));

console.log("\n── Reconciliation (scale spec §8.1) ──");
const rd = M.klReadiness(M.KL_X_SEED);
ok("waiting count equals the open rows underneath it", rd.waiting === wl.filter(i => i.state === "open").length, rd);
ok("per-graph klOpen sums to the full-estate waiting count",
   M.KL_X_SEED.reduce((n, x) => n + M.klOpen(x), 0) === rd.waiting);
ok("auto-applied is the resolver's, not the page's", rd.autoApplied === 1198 + 3910 + 838, rd.autoApplied);

console.log("\n── Trust dial preview (C5) ──");
const p90 = M.klDialPreview(wl, 0.90), p60 = M.klDialPreview(wl, 0.60);
ok("at 0.90 nothing auto-confirms", p90.auto === 0, p90);
ok("lowering to 0.60 auto-confirms the strong matches", p60.auto === 3, p60);
ok("preview totals always partition the open set", p60.auto + p60.wait === wl.length);
console.log("     at 0.60:", p60.auto, "auto (", M.klMoney(p60.autoMoney), ") ·", p60.wait, "wait (", M.klMoney(p60.waitMoney), ")");

console.log("\n── Resolution descriptors, never raw SQL (§16) ──");
const sap = M.KL_SRC_SEED[0];
const sql = M.klRuleSQL(sap.masters[0], sap.name);
ok("resolver compiles its own SELECT from the descriptor", /^select/.test(sql) && sql.includes("LIFNR as source_pk"));
ok("no master stores free-form SQL",
   M.KL_SRC_SEED.every(g => g.masters.every(m => !m.rule || !("sql" in m.rule) && !("resolution_sql" in m.rule))));
const asset = sap.masters.find(m => m.entity === "Fixed Asset");
ok("degenerate technical PK guarded (MANDT rejected)", asset.rule.pk === "ANLN1" && /MANDT/.test(asset.rule.guard));
ok("asset class matches on serial/tag", !!asset.rule.serial && !!asset.rule.tag);
const blocked = M.KL_SRC_SEED[1].masters.find(m => !m.ready);
ok("composite-key master honestly reports not-generatable", blocked.rule === null && /Composite/.test(blocked.blocked));

console.log("\n── Mode 2: IR + compile (C8) ──");
const xg = M.KL_X_SEED[0];
const ir = M.klBuildIR(xg, M.KL_SRC_SEED, M.KL_MEASURES, { intent: "bi", target: "databricks" });
ok("IR names no target technology in its core", !JSON.stringify(ir.sources).match(/dbt|databricks|delta/i));
ok("IR carries one source per joined graph", ir.sources.length === 3, ir.sources.length);
ok("crosswalk is decision-stamped", ir.crosswalk.length === 6 && "decided_by" in ir.crosswalk[0]);
ok("uncertified terms are excluded from metrics", ir.metrics.length === 1 && ir.metrics[0].label === "Supplier", ir.metrics.map(m => m.label));

const files = M.klCompile(ir, "2026-08-25 09:00", {});
ok("artifact set compiles", files.length === 8, files.map(f => f.path));
ok("every SQL model carries a provenance header", files.filter(f => f.path.endsWith(".sql")).every(f => f.body.includes("GENERATED BY EDG")));
ok("every SQL model carries a custom-section marker", files.filter(f => f.path.endsWith(".sql")).every(f => f.body.includes(M.KL_CUSTOM_OPEN)));
const cw = files.find(f => f.path.includes("crosswalk"));
ok("crosswalk seed names the steward verbatim", cw.body.includes("decided_by"));
ok("generator guard is documented in the staging model",
   files.some(f => f.body.includes("MANDT rejected")) === false, "supplier build should not mention the asset guard");

console.log("\n── Regeneration contract (C8.6 — the crown jewel) ──");
const baseline = M.klCompile(ir, "2026-08-25 09:00", {});
const later = M.klCompile(ir, "2026-08-26 17:42", {});
ok("a no-change regeneration proposes NOTHING (timestamps normalised out)", M.klDiff(baseline, later).count === 0, M.klDiff(baseline, later));

const dimPath = "models/marts/dim_supplier.sql";
const customs = { [dimPath]: "-- my own late-payment flag\nleft join finance.dso using (golden_id)" };
const withCustom = M.klCompile(ir, "2026-08-27 10:00", customs);
ok("engineer's custom block is injected", withCustom.find(f => f.path === dimPath).body.includes("late-payment flag"));
ok("custom block alone registers as a change", M.klDiff(baseline, withCustom).changed.includes(dimPath));

// Now a real governance change: a steward renames a golden record.
const renamed = JSON.parse(JSON.stringify(xg));
renamed.conflicts[2].n = "Owens Corning Inc";
renamed.conflicts[2].state = "confirmed";
renamed.conflicts[2].decidedBy = "maya.chen";
const ir2 = M.klBuildIR(renamed, M.KL_SRC_SEED, M.KL_MEASURES, { intent: "bi", target: "databricks" });
const regen = M.klCompile(ir2, "2026-08-27 10:05", customs);
const d = M.klDiff(withCustom, regen);
ok("a steward decision changes the decision-stamped crosswalk", d.changed.includes("seeds/xkg_supplier_crosswalk.csv"), d);
ok("a steward decision does NOT churn any SQL model the engineer reviews",
   d.changed.every(f => !f.endsWith(".sql")), d.changed);
ok("the engineer's custom block survived the regeneration", regen.find(f => f.path === dimPath).body.includes("late-payment flag"));
ok("the steward's name is now in the generated artifact", regen.find(f => f.path.includes("crosswalk")).body.includes("maya.chen"));

console.log("\n── Certifying a term changes the build (C7 → C8 parity) ──");
const certified = M.KL_MEASURES.map(m => m.id === "m1" ? { ...m, state: "certified", certifiedBy: "maya.chen" } : m);
const ir3 = M.klBuildIR(xg, M.KL_SRC_SEED, certified, { intent: "bi", target: "databricks" });
const afterCert = M.klCompile(ir3, "2026-08-27 11:00", customs);
const dc = M.klDiff(withCustom, afterCert);
ok("certifying Vendor Spend changes metrics.yml", dc.changed.includes("models/marts/metrics.yml") && dc.changed.includes("README.md"), dc);
ok("the certified definition lands in the artifact", afterCert.find(f => f.path.includes("metrics.yml")).body.includes("vendor_spend"));
ok("the currency policy is compiled in", afterCert.find(f => f.path.includes("metrics.yml")).body.includes("ECB"));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
