// Policy Manager 3 seed: templates, the regulation catalogue and a starting tenant.
// Asset names match the prototype catalog (orders, customers, users, employees …).

const Y = 365;

// Prebuilt policy templates. Adopting one COPIES it; the copy is yours to edit.
export const TEMPLATES = [
  { key: "T-OWN", name: "Sensitive data has accountable owners", desc: "Every classified asset names an owner and a steward.",
    appliesTo: { mode: "class", tags: ["PII", "finance", "PHI"] }, severity: "High",
    checks: [{ field: "owner", op: "set" }, { field: "steward", op: "set" }] },
  { key: "T-PII", name: "Personal data is protected", desc: "PII columns are masked in the source and the data sits under a retention schedule.",
    appliesTo: { mode: "class", tags: ["PII"] }, severity: "High",
    checks: [{ field: "masked", op: "set" }, { field: "retention", op: "set" }] },
  { key: "T-DOC", name: "Assets are documented", desc: "Descriptions and domains on every data asset.",
    appliesTo: { mode: "class", tags: [] }, severity: "Low",
    checks: [{ field: "description", op: "set" }, { field: "domain", op: "set" }] },
  { key: "T-FIN", name: "Financial data is certified", desc: "Finance data used for reporting is certified and of good quality.",
    appliesTo: { mode: "class", tags: [], domains: ["Finance"] }, severity: "Medium",
    checks: [{ field: "cert", op: "is", value: "Approved" }, { field: "quality", op: "gte", value: 80 }] },
  { key: "T-RET", name: "Regulated data has a retention schedule", desc: "Anything classified finance, PII or PHI is covered by a schedule.",
    appliesTo: { mode: "class", tags: ["PII", "finance", "PHI"] }, severity: "Medium",
    checks: [{ field: "retention", op: "set" }] },
];

// Articles: req = what satisfies it. kind policy → a template; retention → a schedule
// over a classification with a legal minimum; evidence → a recurring evidence request.
export const CATALOGUE = [
  { id: "gdpr", name: "GDPR", full: "General Data Protection Regulation", region: "EU", articles: [
    { id: "5-1-e", ref: "Art. 5(1)(e)", title: "Storage limitation", req: { kind: "retention", tag: "PII" } },
    { id: "5-1-f", ref: "Art. 5(1)(f)", title: "Integrity and confidentiality", req: { kind: "policy", template: "T-PII" } },
    { id: "5-2", ref: "Art. 5(2)", title: "Accountability", req: { kind: "policy", template: "T-OWN" } },
    { id: "17", ref: "Art. 17", title: "Right to erasure", req: { kind: "evidence", title: "Erasure requests completed within one month", every: "Quarterly" } },
    { id: "30", ref: "Art. 30", title: "Records of processing activities", req: { kind: "evidence", title: "Records of processing reviewed", every: "Annual" } },
    { id: "32", ref: "Art. 32", title: "Security of processing", req: { kind: "policy", template: "T-PII" } },
  ] },
  { id: "hipaa", name: "HIPAA", full: "Health Insurance Portability and Accountability Act", region: "US", articles: [
    { id: "164-316", ref: "§164.316(b)(2)", title: "Retain documentation for 6 years", req: { kind: "retention", tag: "PHI", minDays: 6 * Y } },
    { id: "164-312", ref: "§164.312(a)(1)", title: "Access control", req: { kind: "policy", template: "T-OWN" } },
    { id: "164-308", ref: "§164.308(a)(1)", title: "Risk analysis", req: { kind: "evidence", title: "Security risk analysis completed", every: "Annual" } },
  ] },
  { id: "sox", name: "SOX", full: "Sarbanes-Oxley Act", region: "US", articles: [
    { id: "802", ref: "§802", title: "Retain audit records for 7 years", req: { kind: "retention", tag: "finance", minDays: 7 * Y } },
    { id: "404", ref: "§404", title: "Internal control over financial reporting", req: { kind: "policy", template: "T-FIN" } },
    { id: "302", ref: "§302", title: "Officer certification of reports", req: { kind: "evidence", title: "Quarterly sub-certification signed", every: "Quarterly" } },
  ] },
  { id: "ccpa", name: "CCPA", full: "California Consumer Privacy Act", region: "US-CA", articles: [
    { id: "100", ref: "§1798.100(a)(3)", title: "Disclose and limit retention", req: { kind: "retention", tag: "PII" } },
    { id: "105", ref: "§1798.105", title: "Right to delete", req: { kind: "evidence", title: "Deletion requests completed within 45 days", every: "Quarterly" } },
    { id: "150", ref: "§1798.150", title: "Reasonable security", req: { kind: "policy", template: "T-PII" } },
  ] },
  { id: "sec17a4", name: "SEC 17a-4", full: "SEC Rule 17a-4 (broker-dealer records)", region: "US", articles: [
    { id: "b", ref: "17a-4(b)", title: "Preserve records for 6 years", req: { kind: "retention", tag: "finance", minDays: 6 * Y } },
    { id: "f", ref: "17a-4(f)", title: "Records kept non-rewriteable", req: { kind: "evidence", title: "WORM storage configuration verified", every: "Annual" } },
  ] },
  { id: "pci", name: "PCI DSS", full: "Payment Card Industry Data Security Standard v4.0", region: "Global", articles: [
    { id: "3-2", ref: "Req. 3.2", title: "Keep cardholder data to a minimum", req: { kind: "retention", tag: "PII" } },
    { id: "3-5", ref: "Req. 3.5", title: "Protect stored account data", req: { kind: "policy", template: "T-PII" } },
  ] },
];

// Columns masked natively in the source (masking stays a CHECK, not an EDG action).
export const MASKED = ["customers", "users", "employees", "customer_consent", "app_users"];

const pol = (id, tkey, extra = {}) => {
  const t = TEMPLATES.find((x) => x.key === tkey);
  return { id, template: tkey, name: t.name, desc: t.desc, appliesTo: JSON.parse(JSON.stringify(t.appliesTo)), severity: t.severity,
    checks: t.checks.map((c, i) => ({ id: `${id}-c${i + 1}`, ...c })), owner: "maya.chen", status: "Active", updated: "2026-10-28", ...extra };
};

export const seedState = () => ({
  version: 1,
  policies: [
    pol("pol-own", "T-OWN"),
    pol("pol-pii", "T-PII", { owner: "dev.patel" }),
    pol("pol-fin", "T-FIN", { owner: "sarah.kim" }),
    pol("pol-doc", "T-DOC", { owner: "james.oh", status: "Draft" }),
  ],
  exceptions: { "pol-pii|pol-pii-c1|sales_transactions": { by: "dev.patel", until: "2027-01-31", reason: "Masking policy rolls out in December" } },
  schedules: [
    { id: "rs-cust", name: "Customer personal data", recordClass: "Customer records", owner: "dev.patel",
      appliesTo: { mode: "class", tags: ["PII"] }, keep: { n: 3, unit: "years" }, trigger: "created", action: "delete", review: true,
      status: "Active", activatedAt: "2026-09-15", approvals: "all", dateCols: {},
      batches: [{ id: "b-1116", at: "2026-11-16", status: "Awaiting review", items: "due" }],
      runs: [{ at: "2026-10-16", asset: "users", n: 412880, unit: "rows", result: "Deleted", by: "dev.patel" },
             { at: "2026-10-16", asset: "customers", n: 1183004, unit: "rows", result: "Deleted", by: "dev.patel" }] },
    { id: "rs-fin", name: "Financial records", recordClass: "General ledger and transactions", owner: "sarah.kim",
      appliesTo: { mode: "class", tags: ["finance"] }, keep: { n: 7, unit: "years" }, trigger: "created", action: "delete", review: true,
      status: "Active", activatedAt: "2026-08-01", approvals: "all", dateCols: {}, batches: [], runs: [] },
    { id: "rs-raw", name: "Raw landing files", recordClass: "Ingestion drops", owner: "james.oh",
      appliesTo: { mode: "object", objects: ["raw", "raw-ingestion", "gcs-raw-events"] }, keep: { n: 400, unit: "days" }, trigger: "modified", action: "delete", review: false,
      status: "Active", activatedAt: "2026-07-10", approvals: "all", dateCols: {}, batches: [],
      runs: [{ at: "2026-11-15", asset: "raw", n: 1240, unit: "objects", result: "Expired by S3 Lifecycle", by: "source" }] },
    { id: "rs-phi", name: "Clinical encounters", recordClass: "Patient encounter records", owner: "priya.nair",
      appliesTo: { mode: "object", objects: ["patient_encounters"] }, keep: { n: 6, unit: "years" }, trigger: "event", action: "delete", review: true,
      status: "Awaiting approval", approvals: {}, dateCols: { patient_encounters: "encounter_date" }, batches: [], runs: [] },
  ],
  holds: [
    { id: "lh-acme", matter: "Acme Corp v. J&J (supply contract)", matterId: "MATTER-2026-014", type: "Legal", owner: "lisa.ray",
      appliesTo: { mode: "object", objects: ["orders", "app_orders", "exports_2025_q4.csv"] },
      criteria: { orders: { col: "customer_id", op: "=", val: "48213" }, app_orders: { col: "customer_id", op: "=", val: "48213" } },
      status: "Active", since: "2026-09-02", notices: { orders: "2026-09-03", app_orders: "2026-09-04" } },
    { id: "lh-irs", matter: "IRS examination FY2024", matterId: "TAX-2026-003", type: "Tax", owner: "sarah.kim",
      appliesTo: { mode: "class", tags: ["finance"] }, criteria: {}, status: "Active", since: "2026-10-20", notices: {} },
    { id: "lh-emp", matter: "Former employee claim", matterId: "MATTER-2025-091", type: "Legal", owner: "lisa.ray",
      appliesTo: { mode: "object", objects: ["employees"] }, criteria: { employees: { col: "employee_id", op: "=", val: "10422" } },
      status: "Released", since: "2025-12-01", releasedAt: "2026-10-01", releaseReq: { by: "lisa.ray", at: "2026-09-29" }, releasedBy: "maya.chen", notices: { employees: "2025-12-02" } },
  ],
  evidence: [
    { id: "ev-gdpr-17", title: "Erasure requests completed within one month", every: "Quarterly", assignee: "dev.patel", reviewer: "lisa.ray", due: "2027-01-05",
      questions: [{ q: "Erasure requests received this quarter", type: "number" }, { q: "All completed within one month?", type: "yesno" }, { q: "Exceptions and reasons", type: "text" }],
      submissions: [{ at: "2026-10-05", by: "dev.patel", answers: ["37", "Yes", "None"], status: "Accepted", decidedBy: "lisa.ray" }] },
    { id: "ev-gdpr-30", title: "Records of processing reviewed", every: "Annual", assignee: "maya.chen", reviewer: "lisa.ray", due: "2026-11-30",
      questions: [{ q: "Processing activities reviewed", type: "number" }, { q: "Register updated and published?", type: "yesno" }], submissions: [] },
    { id: "ev-hipaa-308", title: "Security risk analysis completed", every: "Annual", assignee: "priya.nair", reviewer: "maya.chen", due: "2026-12-15",
      questions: [{ q: "Analysis completed?", type: "yesno" }, { q: "High risks open", type: "number" }, { q: "Remediation plan", type: "text" }],
      submissions: [{ at: "2026-11-12", by: "priya.nair", answers: ["Yes", "2", "Both tracked in GRC-311 and GRC-318"], status: "Submitted" }] },
    { id: "ev-sox-302", title: "Quarterly sub-certification signed", every: "Quarterly", assignee: "sarah.kim", reviewer: "maya.chen", due: "2027-01-15",
      questions: [{ q: "Controls operated as designed?", type: "yesno" }, { q: "Deficiencies", type: "text" }],
      submissions: [{ at: "2026-10-14", by: "sarah.kim", answers: ["Yes", "None"], status: "Accepted", decidedBy: "maya.chen" }] },
  ],
  regulations: [
    { id: "gdpr", adopted: "2026-08-12", articles: {
      "5-1-e": [{ kind: "retention", id: "rs-cust" }], "5-1-f": [{ kind: "policy", id: "pol-pii" }], "5-2": [{ kind: "policy", id: "pol-own" }],
      "17": [{ kind: "evidence", id: "ev-gdpr-17" }], "30": [{ kind: "evidence", id: "ev-gdpr-30" }], "32": [{ kind: "policy", id: "pol-pii" }] } },
    { id: "hipaa", adopted: "2026-08-12", articles: {
      "164-316": [{ kind: "retention", id: "rs-phi" }], "164-312": [{ kind: "policy", id: "pol-own" }], "164-308": [{ kind: "evidence", id: "ev-hipaa-308" }] } },
    { id: "sox", adopted: "2026-08-20", articles: {
      "802": [{ kind: "retention", id: "rs-fin" }], "404": [{ kind: "policy", id: "pol-fin" }], "302": [{ kind: "evidence", id: "ev-sox-302" }] } },
  ],
});
