// ─────────────────────────────────────────────────────────────────────────────
// Policy Manager 3: check, act, prove.
//
//   Policies     CHECK metadata. Validation only, scoped by classification /
//                domain / source, evaluated against the live catalog every time
//                it changes. No scans: a policy always covers what it applies to.
//   Retention    ACT on data. A schedule (data class → keep N → trigger → action
//   & Holds      → disposition review) and legal hold matters, executed NATIVELY
//                in each source: a Snowflake task, a Delta job, a BigQuery
//                partition expiry, an S3 lifecycle rule, an S3 Object Lock hold,
//                a Postgres trigger. EDG generates, approves and records them.
//   Regulations  PROVE. Articles map to policies, schedules and evidence
//                requests; one score per regulation.
//
// Precedence (same as every records product): a hold always beats retention,
// and when two schedules cover one object the longest period wins.
//
// Pure: callers pass assets and state; nothing here touches the DOM or storage.
// ─────────────────────────────────────────────────────────────────────────────

// ── Sources EDG can execute on, and how ──────────────────────────────────────
// family drives the code generator; retention/hold name the native mechanism.
export const SOURCES = {
  snowflake: { l: "Snowflake",  family: "warehouse", retention: "Scheduled task",                     hold: "Purge exclusion + object tag" },
  databricks:{ l: "Databricks", family: "delta",     retention: "Workflow job (DELETE + VACUUM)",     hold: "Purge exclusion + table tag" },
  bigquery:  { l: "BigQuery",   family: "bigquery",  retention: "Partition expiration",               hold: "Expiration removed + label" },
  postgres:  { l: "PostgreSQL", family: "postgres",  retention: "pg_cron job",                        hold: "BEFORE DELETE trigger" },
  mysql:     { l: "MySQL",      family: "mysql",     retention: "Event Scheduler event",              hold: "BEFORE DELETE trigger" },
  oracle:    { l: "Oracle",     family: "oracle",    retention: "DBMS_SCHEDULER job",                 hold: "BEFORE DELETE trigger" },
  s3:        { l: "Amazon S3",  family: "s3",        retention: "S3 Lifecycle rule",                  hold: "S3 Object Lock legal hold" },
  azureblob: { l: "Azure Blob", family: "azure",     retention: "Lifecycle management policy",        hold: "Immutable storage legal hold" },
  gcs:       { l: "Google Cloud Storage", family: "gcs", retention: "Object Lifecycle rule",          hold: "Temporary object hold" },
};
const TABLE_TYPES = new Set(["Table", "Iceberg Table"]);
const OBJECT_TYPES = new Set(["Object", "Blob", "Folder", "Bucket", "Container"]);
export const isStore = (a) => a && SOURCES[a.service] && ["s3", "azure", "gcs"].includes(SOURCES[a.service].family);
// Only real data containers in a supported source can be retained or held.
export const lifecycleCapable = (a) => !!(a && SOURCES[a.service] && (TABLE_TYPES.has(a.type) || (isStore(a) && OBJECT_TYPES.has(a.type))));

// ── Small helpers ────────────────────────────────────────────────────────────
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const parseRows = (r) => {
  if (typeof r === "number") return r;
  const m = String(r || "").trim().match(/^([\d.]+)\s*([KMB])?/i); if (!m) return 0;
  return Math.round(parseFloat(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1));
};
export const fmtCount = (n) => n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);
export const periodDays = (keep) => !keep ? 0 : Math.round((+keep.n || 0) * ({ years: 365, months: 30, days: 1 }[keep.unit] || 1));
export const periodLabel = (keep) => !keep ? "—" : `${keep.n} ${+keep.n === 1 ? keep.unit.replace(/s$/, "") : keep.unit}`;
const pathParts = (a) => String(a.db || a.name).split("/").map((s) => s.trim()).filter(Boolean);
const ident = (s) => String(s).replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
const lower = (s) => String(s).replace(/[^A-Za-z0-9_]/g, "_").toLowerCase();

// ── Classification of an asset (asset tags + PII columns) ────────────────────
export const classesOf = (a, columns = []) => {
  const s = new Set((a.tags || []).map(String));
  if (columns.some((c) => c.pii)) s.add("PII");
  return [...s];
};

// ── Scope: what a policy / schedule / hold applies to ────────────────────────
// appliesTo = {mode:"class"|"object", tags:[], domains:[], services:[], objects:[]}
export const inScope = (a, appliesTo, columns) => {
  const ap = appliesTo || {};
  if (ap.mode === "object") return (ap.objects || []).includes(a.name);
  const tags = ap.tags || [], doms = ap.domains || [], svcs = ap.services || [];
  if (tags.length && !classesOf(a, columns).some((t) => tags.includes(t))) return false;
  if (doms.length && !doms.includes(a.domain)) return false;
  if (svcs.length && !svcs.includes(a.service)) return false;
  return true;
};
export const scopeLabel = (ap) => {
  if (!ap) return "All data";
  if (ap.mode === "object") return (ap.objects || []).join(", ") || "No object picked";
  const parts = [];
  if ((ap.tags || []).length) parts.push(ap.tags.join(", "));
  if ((ap.domains || []).length) parts.push(`${ap.domains.join(", ")} domain`);
  if ((ap.services || []).length) parts.push(ap.services.map((s) => (SOURCES[s] || { l: s }).l).join(", "));
  return parts.join(" · ") || "All data";
};

// ── CHECK: fields a policy can test, and the operators each allows ───────────
export const FIELDS = {
  owner:       { l: "Owner", yes: "Owner assigned", kind: "presence", get: (a) => (a.owners || [a.owner]).filter(Boolean).length > 0 },
  steward:     { l: "Steward", yes: "Steward assigned", kind: "presence", get: (a) => (a.stewards || [a.steward]).filter(Boolean).length > 0 },
  description: { l: "Description", yes: "Description written", kind: "presence", get: (a) => String(a.description || "").trim().length >= 20 },
  domain:      { l: "Domain", yes: "Domain assigned", kind: "presence", get: (a) => !!a.domain },
  classified:  { l: "Classification", yes: "Classified", kind: "presence", get: (a, x) => classesOf(a, x.columns).length > 0 },
  cert:        { l: "Certification",       kind: "enum", values: ["Approved", "In Review", "Draft", "Deprecated"], get: (a) => a.cert || "Draft" },
  // A score of 0 means "not profiled" (files, containers), so the check does not apply.
  quality:     { l: "Quality score",       kind: "number", get: (a) => (+a.quality > 0 ? +a.quality : null) },
  masked:      { l: "Sensitive columns masked", yes: "Sensitive columns masked", kind: "presence", get: (a, x) => !x.columns.some((c) => c.pii) || !!x.masked },
  // Views and BI objects hold no data of their own, so only data containers need a schedule.
  retention:   { l: "Retention schedule",  yes: "Under a retention schedule", kind: "presence", get: (a, x) => !lifecycleCapable(a) || !!x.retained },
};
export const OPS = {
  presence: [{ v: "set", l: "is set" }, { v: "unset", l: "is not set" }],
  enum:     [{ v: "is", l: "is" }, { v: "not", l: "is not" }],
  number:   [{ v: "gte", l: "is at least" }, { v: "lte", l: "is at most" }],
};
export const checkLabel = (c) => {
  const f = FIELDS[c.field]; if (!f) return c.field;
  const op = (OPS[f.kind] || []).find((o) => o.v === c.op) || { l: c.op };
  if (f.kind === "presence") return c.op === "unset" ? `${f.l} ${op.l}` : (f.yes || `${f.l} ${op.l}`);
  return `${f.l} ${op.l} ${c.value}`;
};
export const checkPasses = (c, a, x) => {
  const f = FIELDS[c.field]; if (!f) return true;
  const v = f.get(a, x);
  if (v === null) return true; // not applicable to this asset
  switch (c.op) {
    case "set": return !!v;
    case "unset": return !v;
    case "is": return v === c.value;
    case "not": return v !== c.value;
    case "gte": return v >= +c.value;
    case "lte": return v <= +c.value;
    default: return true;
  }
};

// Continuous evaluation: every active policy against every asset it applies to.
// ctx = {assets, columnsOf(name), maskedOf(name), retainedOf(name), exceptions:{key:{until}}, today}
export const evaluatePolicy = (p, ctx) => {
  const assets = ctx.assets.filter((a) => inScope(a, p.appliesTo, ctx.columnsOf(a.name)));
  const findings = [];
  const perCheck = {};
  for (const c of p.checks || []) perCheck[c.id] = { pass: 0, fail: 0 };
  for (const a of assets) {
    const x = { columns: ctx.columnsOf(a.name), masked: ctx.maskedOf(a.name), retained: ctx.retainedOf(a.name) };
    for (const c of p.checks || []) {
      const ok = checkPasses(c, a, x);
      if (ok) { perCheck[c.id].pass++; continue; }
      const key = `${p.id}|${c.id}|${a.name}`;
      const ex = (ctx.exceptions || {})[key];
      const excepted = ex && (!ex.until || ex.until >= (ctx.today || ""));
      if (!excepted) perCheck[c.id].fail++;
      findings.push({ key, policyId: p.id, checkId: c.id, asset: a.name, service: a.service, owner: (a.owners || [a.owner])[0] || "",
        severity: c.severity || p.severity || "Medium", message: `${a.name}: fails "${checkLabel(c)}"`,
        status: excepted ? "Exception" : "Open", until: excepted ? ex.until : null });
    }
  }
  const open = findings.filter((f) => f.status === "Open").length;
  const total = assets.length * (p.checks || []).length;
  return { assets, findings, open, perCheck, total, passRate: total ? Math.round(((total - open) / total) * 100) : 100 };
};

// ── ACT: retention ───────────────────────────────────────────────────────────
export const TRIGGERS = {
  created:  { l: "Created date" },
  modified: { l: "Last modified" },
  event:    { l: "Event date (column)" },
};
// The date column a retention rule counts from, read from the table's own schema.
export const pickDateColumn = (columns, trigger) => {
  const names = (columns || []).map((c) => (typeof c === "string" ? c : c.name));
  const pref = trigger === "modified"
    ? [/^updated_at$/, /modified/, /_at$/]
    : [/^created_at$/, /^(order|event|txn|transaction|encounter|invoice|hire)_date$/, /_date$/, /_ts$/, /timestamp/, /_at$/, /date/];
  for (const re of pref) { const hit = names.find((n) => re.test(n)); if (hit) return hit; }
  return names.find((n) => /date|_at$|_ts$/.test(n)) || null;
};

// Every lifecycle-capable asset a schedule or hold reaches.
export const targetsOf = (rule, ctx) => ctx.assets.filter((a) => lifecycleCapable(a) && inScope(a, rule.appliesTo, ctx.columnsOf(a.name)));

// Rows or objects that are past the period now; deterministic per object.
export const dueEstimate = (sched, a) => {
  const rows = parseRows(a.rows);
  const frac = 0.02 + (hash(`${sched.id}|${a.name}|${periodDays(sched.keep)}`) % 160) / 1000; // 2%–18%
  if (isStore(a) && !TABLE_TYPES.has(a.type)) return { unit: "objects", n: a.type === "Object" || a.type === "Blob" ? (frac > 0.1 ? 1 : 0) : Math.max(1, Math.round(40 * frac * 10)) };
  return { unit: "rows", n: Math.round(rows * frac) };
};

// Which schedule governs an object, and whether a hold stops it.
export const lifecycleOf = (asset, state) => {
  const live = (state.schedules || []).filter((s) => s.status === "Active" && s._targets && s._targets.includes(asset));
  const covering = (state.schedules || []).filter((s) => s._targets && s._targets.includes(asset) && s.status !== "Draft");
  const winner = [...live].sort((x, y) => periodDays(y.keep) - periodDays(x.keep))[0] || null;
  const holds = (state.holds || []).filter((h) => h.status !== "Released" && h._targets && h._targets.includes(asset));
  const wholeHold = holds.some((h) => !((h.criteria || {})[asset] && (h.criteria || {})[asset].col));
  return { schedules: covering, winner, holds, held: holds.length > 0, paused: wholeHold, overridden: live.filter((s) => s !== winner) };
};

// ── Native code: what EDG writes into the source ─────────────────────────────
const HOLD_SQL = (h, a) => {
  const c = (h.criteria || {})[a.name];
  if (!c || !c.col) return null;
  const v = /^\d+(\.\d+)?$/.test(c.val) ? c.val : `'${String(c.val).replace(/'/g, "''")}'`;
  return `${c.col} ${c.op || "="} ${v}`;
};
// The SQL a purge must never touch: one clause per active hold on the object.
export const holdExclusions = (a, holds) => holds.map((h) => HOLD_SQL(h, a)).filter(Boolean);

const icebergFq = (a) => pathParts(a).map(lower).join(".");
export const retentionCode = (sched, a, opts = {}) => {
  const src = SOURCES[a.service]; if (!src) return null;
  if (a.type === "Iceberg Table") {
    // Iceberg on object storage: delete rows through the table; expiring its files would corrupt it.
    const days = periodDays(sched.keep), col = (sched.dateCols || {})[a.name] || opts.dateCol || "created_at";
    const conds = [`${col} < current_date - INTERVAL '${days}' DAY`, ...(opts.exclusions || []).map((e) => `NOT (${e})`)];
    return { lang: "sql", mechanism: "Iceberg row delete + snapshot expiry", code:
      `-- Iceberg on ${src.l}: rows are deleted through the table, never by expiring files\nDELETE FROM ${icebergFq(a)}\nWHERE ${conds.join("\n  AND ")};\n\n-- Drop the snapshots that still reference the deleted rows\nCALL system.expire_snapshots(\n  table => '${icebergFq(a)}',\n  older_than => current_timestamp - INTERVAL '7' DAY,\n  retain_last => 1);` };
  }
  const days = periodDays(sched.keep);
  const col = (sched.dateCols || {})[a.name] || opts.dateCol || "created_at";
  const excl = (opts.exclusions || []).map((e) => `NOT (${e})`);
  const p = pathParts(a);
  const review = sched.review !== false;
  const name = `edg_ret_${lower(sched.id)}_${lower(a.name)}`;
  const where = (fn) => [`${col} < ${fn}`, ...excl].join("\n    AND ");
  switch (src.family) {
    case "warehouse": {
      const fq = p.map(ident).join(".");
      const cut = `DATEADD(day, -${days}, CURRENT_DATE())`;
      return { lang: "sql", mechanism: src.retention, code: review
        ? `-- Daily: stage what is due, EDG asks the owner, then purges the approved batch\nCREATE OR REPLACE TASK EDG_GOVERNANCE.${ident(name)}\n  WAREHOUSE = EDG_GOVERNANCE_WH\n  SCHEDULE  = 'USING CRON 0 2 * * * UTC'\nAS\n  INSERT INTO EDG_GOVERNANCE.DISPOSITION_QUEUE (schedule_id, object, row_key, due_on)\n  SELECT '${sched.id}', '${fq}', HASH(*), CURRENT_DATE()\n  FROM ${fq}\n  WHERE ${where(cut)};\n\n-- Runs only for a batch the owner approved\nDELETE FROM ${fq} t\nUSING EDG_GOVERNANCE.DISPOSITION_QUEUE q\nWHERE q.batch_id = :approved_batch AND q.row_key = HASH(t.*);\n\nALTER TASK EDG_GOVERNANCE.${ident(name)} RESUME;`
        : `CREATE OR REPLACE TASK EDG_GOVERNANCE.${ident(name)}\n  WAREHOUSE = EDG_GOVERNANCE_WH\n  SCHEDULE  = 'USING CRON 0 2 * * * UTC'\nAS\n  DELETE FROM ${fq}\n  WHERE ${where(cut)};\n\nALTER TASK EDG_GOVERNANCE.${ident(name)} RESUME;` };
    }
    case "delta": {
      const fq = p.map(lower).join(".");
      return { lang: "sql", mechanism: src.retention, code: `-- Databricks Workflow "${name}" · daily 02:00 UTC · task 1\n${review ? `INSERT INTO edg_governance.disposition_queue\nSELECT '${sched.id}', '${fq}', * FROM ${fq}\nWHERE ${where(`current_date() - INTERVAL ${days} DAYS`)};\n-- task 2 runs after the owner approves the batch\n` : ""}DELETE FROM ${fq}\nWHERE ${where(`current_date() - INTERVAL ${days} DAYS`)};\n\n-- task 3: remove the deleted files for good\nVACUUM ${fq} RETAIN 168 HOURS;` };
    }
    case "bigquery": {
      const fq = p.map(lower).join(".");
      return { lang: "sql", mechanism: src.retention, code: `-- Partitions older than the period expire automatically\nALTER TABLE \`${fq}\`\nSET OPTIONS (\n  partition_expiration_days = ${days},\n  labels = [("edg_retention", "${lower(sched.id)}")]\n);` };
    }
    case "postgres": {
      const fq = p.slice(1).map(lower).join(".") || lower(a.name);
      return { lang: "sql", mechanism: src.retention, code: `SELECT cron.schedule(\n  '${name}',\n  '0 2 * * *',\n  $$DELETE FROM ${fq}\n    WHERE ${where(`now() - interval '${days} days'`)}$$\n);` };
    }
    case "mysql": {
      const fq = p.slice(1).map(lower).join(".") || lower(a.name);
      return { lang: "sql", mechanism: src.retention, code: `CREATE EVENT ${name}\n  ON SCHEDULE EVERY 1 DAY STARTS (CURRENT_DATE + INTERVAL 2 HOUR)\n  DO\n    DELETE FROM ${fq}\n    WHERE ${where(`NOW() - INTERVAL ${days} DAY`)};` };
    }
    case "oracle": {
      const fq = p.slice(1).map(ident).join(".") || ident(a.name);
      return { lang: "sql", mechanism: src.retention, code: `BEGIN\n  DBMS_SCHEDULER.CREATE_JOB(\n    job_name        => '${ident(name)}',\n    job_type        => 'PLSQL_BLOCK',\n    job_action      => 'BEGIN DELETE FROM ${fq} WHERE ${[`${col} < SYSDATE - ${days}`, ...excl].join(" AND ").replace(/'/g, "''")}; COMMIT; END;',\n    repeat_interval => 'FREQ=DAILY;BYHOUR=2',\n    enabled         => TRUE);\nEND;` };
    }
    case "s3": {
      const bucket = p[0], prefix = p.slice(1, a.type === "Folder" ? undefined : -1).join("/");
      const rule = { ID: name, Status: "Enabled", Filter: review ? { And: { Prefix: prefix ? `${prefix}/` : "", Tags: [{ Key: "edg-disposition", Value: "approved" }] } } : { Prefix: prefix ? `${prefix}/` : "" },
        Expiration: { Days: review ? 1 : days }, NoncurrentVersionExpiration: { NoncurrentDays: 30 } };
      return { lang: "json", mechanism: src.retention, code: `// aws s3api put-bucket-lifecycle-configuration --bucket ${bucket}\n${review ? `// EDG tags objects older than ${days} days as edg-disposition=approved after the owner signs off\n` : ""}${JSON.stringify({ Rules: [rule] }, null, 2)}` };
    }
    case "azure": {
      const container = p[0], prefix = p.slice(1, a.type === "Folder" ? undefined : -1).join("/");
      const def = { name, enabled: true, type: "Lifecycle", definition: { filters: { blobTypes: ["blockBlob"], prefixMatch: [`${container}/${prefix}`.replace(/\/$/, "")], ...(review ? { blobIndexMatch: [{ name: "edgDisposition", op: "==", value: "approved" }] } : {}) },
        actions: { baseBlob: { delete: { daysAfterModificationGreaterThan: review ? 0 : days } } } } };
      return { lang: "json", mechanism: src.retention, code: `// Storage account › Lifecycle management\n${JSON.stringify({ rules: [def] }, null, 2)}` };
    }
    case "gcs": {
      const prefix = p.slice(1, a.type === "Bucket" ? undefined : -1).join("/");
      const rule = { action: { type: "Delete" }, condition: { age: days, ...(prefix ? { matchesPrefix: [`${prefix}/`] } : {}) } };
      return { lang: "json", mechanism: src.retention, code: `// gcloud storage buckets update gs://${p[0]} --lifecycle-file=lifecycle.json\n${JSON.stringify({ rule: [rule] }, null, 2)}` };
    }
    default: return null;
  }
};

export const holdCode = (h, a) => {
  const src = SOURCES[a.service]; if (!src) return null;
  if (a.type === "Iceberg Table") {
    const c = HOLD_SQL(h, a);
    return { lang: "sql", mechanism: "Iceberg tagged snapshot", code:
      `-- Pin the current snapshot for the life of the matter\nALTER TABLE ${icebergFq(a)}\n  CREATE TAG legal_hold_${lower(h.matterId || h.id)} RETAIN 3650 DAYS;\n-- Purge jobs exclude: ${c ? `NOT (${c})` : "the whole table (paused)"}` };
  }
  const p = pathParts(a);
  const crit = HOLD_SQL(h, a);
  const tag = lower(h.matterId || h.id);
  switch (src.family) {
    case "warehouse": {
      const fq = p.map(ident).join(".");
      return { lang: "sql", mechanism: src.hold, code: `ALTER TABLE ${fq} SET TAG EDG_GOVERNANCE.LEGAL_HOLD = '${h.matterId}';\n\n-- Every EDG purge task on this table now carries:\n--   AND NOT (${crit || "TRUE"})\n${crit ? "" : `-- Whole table held: purge tasks are suspended and DELETE / TRUNCATE are revoked\nREVOKE DELETE, TRUNCATE ON TABLE ${fq} FROM ROLE TRANSFORMER;\n`}` };
    }
    case "delta": {
      const fq = p.map(lower).join(".");
      return { lang: "sql", mechanism: src.hold, code: `ALTER TABLE ${fq} SET TAGS ('edg_legal_hold' = '${h.matterId}');\n-- Keep deleted files recoverable while the hold lasts\nALTER TABLE ${fq} SET TBLPROPERTIES ('delta.deletedFileRetentionDuration' = 'interval 3650 days');\n-- Purge jobs exclude: ${crit ? `NOT (${crit})` : "the whole table (job paused)"}` };
    }
    case "bigquery": {
      const fq = p.map(lower).join(".");
      return { lang: "sql", mechanism: src.hold, code: `ALTER TABLE \`${fq}\`\nSET OPTIONS (\n  partition_expiration_days = NULL,\n  labels = [("edg_legal_hold", "${tag}")]\n);` };
    }
    case "postgres": case "mysql": case "oracle": {
      const fq = p.slice(1).map(src.family === "oracle" ? ident : lower).join(".") || a.name;
      const cond = crit ? crit.replace(/(^|\s)([a-z_][a-z0-9_]*)(\s*(=|<|>|<=|>=|<>|!=|LIKE|IN))/gi, (m, s, c, rest) => `${s}OLD.${c}${rest}`) : "TRUE";
      const trg = `edg_hold_${tag}`;
      if (src.family === "postgres") return { lang: "sql", mechanism: src.hold, code: `CREATE OR REPLACE FUNCTION edg_hold.${trg}() RETURNS trigger AS $$\nBEGIN\n  IF ${cond} THEN\n    RAISE EXCEPTION 'Legal hold ${h.matterId}: change blocked';\n  END IF;\n  RETURN OLD;\nEND $$ LANGUAGE plpgsql;\n\nCREATE TRIGGER ${trg}\n  BEFORE DELETE OR UPDATE ON ${fq}\n  FOR EACH ROW EXECUTE FUNCTION edg_hold.${trg}();` };
      if (src.family === "mysql") return { lang: "sql", mechanism: src.hold, code: `CREATE TRIGGER ${trg}\n  BEFORE DELETE ON ${fq}\n  FOR EACH ROW\n  BEGIN\n    IF ${cond} THEN\n      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Legal hold ${h.matterId}: delete blocked';\n    END IF;\n  END;` };
      return { lang: "sql", mechanism: src.hold, code: `CREATE OR REPLACE TRIGGER ${ident(trg)}\n  BEFORE DELETE OR UPDATE ON ${fq}\n  FOR EACH ROW\n  WHEN (${cond.replace(/OLD\./g, "old.")})\nBEGIN\n  RAISE_APPLICATION_ERROR(-20001, 'Legal hold ${h.matterId}: change blocked');\nEND;` };
    }
    case "s3": {
      const bucket = p[0], key = p.slice(1).join("/");
      return { lang: "shell", mechanism: src.hold, code: a.type === "Object"
        ? `aws s3api put-object-legal-hold \\\n  --bucket ${bucket} \\\n  --key ${key} \\\n  --legal-hold Status=ON`
        : `# Every object under ${bucket}/${key ? `${key}/` : ""} (S3 Batch Operations job)\naws s3control create-job \\\n  --operation '{"S3PutObjectLegalHold":{"LegalHold":{"Status":"ON"}}}' \\\n  --manifest-generator '{"S3JobManifestGenerator":{"SourceBucket":"arn:aws:s3:::${bucket}","Filter":{"KeyNameConstraint":{"MatchAnyPrefix":["${key}"]}}}}' \\\n  --priority 10 --role-arn arn:aws:iam::<account>:role/edg-governance` };
    }
    case "azure": {
      const container = p[0], blob = p.slice(1).join("/");
      return { lang: "shell", mechanism: src.hold, code: a.type === "Container"
        ? `az storage container legal-hold set \\\n  --container-name ${container} \\\n  --tags ${tag.replace(/_/g, "")} \\\n  --account-name <account>`
        : `az storage blob set-legal-hold \\\n  --container-name ${container} \\\n  --name ${blob} \\\n  --legal-hold true \\\n  --account-name <account>` };
    }
    case "gcs": {
      const obj = p.join("/");
      return { lang: "shell", mechanism: src.hold, code: a.type === "Bucket"
        ? `gcloud storage objects update "gs://${p[0]}/**" --temporary-hold`
        : `gcloud storage objects update gs://${obj} --temporary-hold` };
    }
    default: return null;
  }
};

// ── PROVE: regulation scoring ────────────────────────────────────────────────
// An article is met when every item mapped to it is met. Items:
//   {kind:"policy", id}      active, and no open findings
//   {kind:"retention", id}   active, every object approved, period ≥ the article's floor
//   {kind:"hold", id}        hold capability shown by an active matter (or none needed)
//   {kind:"evidence", id}    latest submission accepted and in date
export const itemStatus = (item, art, S) => {
  if (item.kind === "policy") {
    const p = S.policies.find((x) => x.id === item.id); if (!p) return { ok: false, l: "Missing" };
    if (p.status !== "Active") return { ok: false, l: p.status };
    const ev = S.evalOf(p);
    return ev.open ? { ok: false, l: `${ev.open} finding${ev.open === 1 ? "" : "s"}` } : { ok: true, l: "Passing" };
  }
  if (item.kind === "retention") {
    const s = S.schedules.find((x) => x.id === item.id); if (!s) return { ok: false, l: "Missing" };
    const floor = art.req && art.req.minDays;
    if (floor && periodDays(s.keep) < floor) return { ok: false, l: `Below ${Math.round(floor / 365)}-year minimum` };
    if (s.status !== "Active") return { ok: false, l: s.status };
    const waiting = (s._targets || []).filter((n) => (s.approvals || {})[n] !== "approved").length;
    if (waiting) return { ok: false, l: `${waiting} awaiting owner` };
    return { ok: true, l: "Enforced" };
  }
  if (item.kind === "hold") {
    const h = S.holds.find((x) => x.id === item.id); if (!h) return { ok: false, l: "Missing" };
    return h.status === "Active" ? { ok: true, l: "Holding" } : { ok: true, l: h.status };
  }
  if (item.kind === "evidence") {
    const e = S.evidence.find((x) => x.id === item.id); if (!e) return { ok: false, l: "Missing" };
    const last = (e.submissions || [])[0];
    if (!last) return { ok: false, l: `Due ${e.due || ""}`.trim() };
    if (last.status === "Accepted") return { ok: true, l: "Accepted" };
    return { ok: false, l: last.status === "Submitted" ? "In review" : "Returned" };
  }
  return { ok: false, l: "Unknown" };
};
export const articleStatus = (art, S) => {
  const items = art.items || [];
  if (!items.length) return { state: "unmapped", items: [] };
  const st = items.map((it) => ({ ...it, ...itemStatus(it, art, S) }));
  return { state: st.every((x) => x.ok) ? "met" : "gap", items: st };
};
export const regulationScore = (reg, S) => {
  const arts = reg.articles || [];
  const st = arts.map((a) => articleStatus(a, S));
  const met = st.filter((s) => s.state === "met").length;
  return { met, gaps: st.filter((s) => s.state === "gap").length, unmapped: st.filter((s) => s.state === "unmapped").length, total: arts.length, pct: arts.length ? Math.round((met / arts.length) * 100) : 0 };
};
