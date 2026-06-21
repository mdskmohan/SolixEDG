const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  TableOfContents, PageNumber, Header, Footer, PageBreak
} = require("docx");

// ---- palette ----
const NAVY = "1F2D5A", RED = "C0392B", GREY = "555555", HEAD = "1F2D5A", ZEBRA = "F6F7FB";
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const CONTENT_W = 9360;

function txt(s, o = {}) { return new TextRun({ text: s, ...o }); }
function p(children, o = {}) { return new Paragraph({ children: Array.isArray(children) ? children : [txt(children)], ...o }); }
function h1(s) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [txt(s)] }); }
function h2(s) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [txt(s)] }); }
function spacer(n = 80) { return new Paragraph({ spacing: { after: n }, children: [txt("")] }); }

function cell(content, w, opts = {}) {
  const runs = Array.isArray(content) ? content : [txt(String(content), opts.run || {})];
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    verticalAlign: "center",
    children: [new Paragraph({ children: runs, spacing: { after: 0 } })],
  });
}

function table(headers, rows, widths) {
  const headRow = new TableRow({
    tableHeader: true,
    children: headers.map((hT, i) => cell([txt(hT, { bold: true, color: "FFFFFF", size: 18 })], widths[i], { fill: HEAD })),
  });
  const bodyRows = rows.map((r, ri) =>
    new TableRow({
      children: r.map((c, i) => {
        const runs = Array.isArray(c) ? c : [txt(String(c), { size: 18 })];
        return cell(runs, widths[i], { fill: ri % 2 ? ZEBRA : "FFFFFF" });
      }),
    })
  );
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, rows: [headRow, ...bodyRows] });
}

const mono = (s) => txt(s, { font: "Consolas", size: 17, color: NAVY, bold: true });
const code = (s) => txt(s, { font: "Consolas", size: 17 });

const sections = [];
const C = sections;

// ---- Cover ----
C.push(new Paragraph({ spacing: { before: 1800, after: 0 }, alignment: AlignmentType.CENTER,
  children: [txt("Solix EDG Prototype", { bold: true, size: 30, color: RED })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 0 },
  children: [txt("Policy Management - Canonical Field Reference", { bold: true, size: 48, color: NAVY })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 0 },
  children: [txt("Field definitions, operators, values, significance, and technical feasibility", { size: 22, color: GREY, italics: true })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 0 },
  children: [txt("Prepared for engineering hand-off", { size: 20, color: GREY })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 0 },
  children: [txt("Source of truth: POLICY_MANAGEMENT_PLAN.md, policy-mgmt-preview.jsx, solix-platform-v2.jsx", { size: 16, color: GREY })] }));
C.push(new Paragraph({ children: [new PageBreak()] }));

// ---- TOC ----
C.push(h1("Contents"));
C.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }));
C.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 1 ----
C.push(h1("1. What a canonical field is"));
C.push(p([
  txt("A "), txt("canonical field", { bold: true }),
  txt(" is a single, normalized attribute that the platform computes for every data asset regardless of where that asset lives. Each source connector (Snowflake, Databricks, Postgres, MySQL, Oracle, S3, Azure Blob) fetches raw, source-specific metadata and maps it onto this common vocabulary. Policies are written against canonical fields only - never against raw source metadata - so the same rule behaves identically across all sources."),
]));
C.push(spacer());
C.push(p([txt("Pipeline: ", { bold: true }),
  code("Source Systems -> Connectors -> Normalization -> Canonical Asset Model -> Policy Engine -> Violation Engine -> Notifications / Dashboards")]));
C.push(spacer());
C.push(p([
  txt("Why it matters for implementation: ", { bold: true }),
  txt("the canonical field set is the contract between the connector layer and the policy engine. Each field has a fixed data type and a fixed set of allowed values (its enum). The Rule Builder UI exposes exactly these fields as dropdowns, and "),
  code("evaluatePolicy(policy, assets)"),
  txt(" evaluates a policy's condition array against these field values on each asset. Adding a source means writing a new mapping onto these fields - not inventing new ones."),
]));

// ---- 2 ----
C.push(h1("2. The five policy categories"));
C.push(p("Every field belongs to one or more of five governance categories. A policy is always scoped to one category, and its rules may only reference fields valid for that category."));
C.push(spacer());
C.push(table(
  ["Category", "What it governs"],
  [
    ["Data Policy", "Ownership, stewardship, certification, quality, and tiering of assets."],
    ["Security Policy", "Classification, sensitivity, encryption, masking, row-level security, and exposure."],
    ["Retention Policy", "Retention periods, retention class, legal hold, and last-access staleness."],
    ["Access Policy", "Access levels, role counts, guest / privileged access, and sharing breadth."],
    ["Metadata Quality Policy", "Descriptions, business terms, tag coverage, metadata scores, and review staleness."],
  ],
  [2600, 6760]
));

// ---- 3 ----
C.push(h1("3. Operators"));
C.push(p([txt("Each rule condition is a triple of "), mono("Field"), txt(" + "), mono("Operator"), txt(" + "), mono("Value"),
  txt(". The Rule Builder offers these seven operators. The valid operators for a field depend on its data type.")]));
C.push(spacer());
C.push(table(
  ["Operator", "Applies to", "Meaning"],
  [
    [[mono("is")], "Enum / boolean", "Field value exactly equals the chosen value."],
    [[mono("is not")], "Enum / boolean", "Field value is anything other than the chosen value."],
    [[mono("greater than")], "Numeric", "Field value is strictly greater than the entered number."],
    [[mono("less than")], "Numeric", "Field value is strictly less than the entered number."],
    [[mono("contains")], "Tags / text", "Field collection or string contains the entered token (e.g. a tag)."],
    [[mono("is empty")], "Any", "Field is unset / null / blank (renders as Not Set)."],
    [[mono("is not empty")], "Any", "Field has any value assigned."],
  ],
  [1900, 2200, 5260]
));
C.push(spacer());
C.push(p([txt("Multiple conditions in one rule are combined with an "), mono("AND / OR"),
  txt(" logic toggle. The builder auto-generates a plain-language summary, e.g. 'Flag assets where classification is PII and masking status is Not Applied. Create a Critical severity violation.'")]));

// ---- 4 ----
C.push(h1("4. Canonical field reference"));
C.push(p([txt("Field names below are the exact identifiers in the asset data model ("),
  code("ASSETS"),
  txt(" array). The Rule Builder shows the human label; the engine uses the code name shown in monospace.")]));

const W = [1750, 2150, 2300, 3160];
function fieldTable(rows) {
  return table(["Field (code)", "Type & allowed values", "How it's populated", "Significance"],
    rows.map(r => [[mono(r[0])], [code(r[1])], r[2], r[3]]), W);
}

// 4.1
C.push(h2("4.1 Data Policy fields"));
C.push(fieldTable([
  ["owner", "string | Not Set", "Manual, or connector account that owns the object.", "Accountable individual/team. Unset owner on Tier-1 assets is a core violation trigger."],
  ["steward", "string | Not Set", "Platform stewardship field; manual assignment.", "Day-to-day data caretaker. Required for PII; drives notification routing."],
  ["cert", "Approved | Deprecated | Pending | Not Set", "Manual certification workflow.", "Trust signal. Deprecated + high usage, or PII not Approved, are flagged."],
  ["qualityScore", "number 0-100", "Platform-computed quality metric.", "Data health score. Thresholds tighten by tier and classification (e.g. PHI < 90)."],
  ["classification", "PII | PHI | PCI | Confidential | Internal | Public | Not Set", "Connector tags + platform classifier.", "The single most important field - drives the majority of security, retention, and access rules."],
  ["tags", "string[] (e.g. GDPR, finance)", "Connector tags + manual.", "Free-form labels. Matched with the contains operator (e.g. a GDPR tag triggers retention rules)."],
  ["tier", "number 1-5 (1 = most critical)", "Connector tag (tier:1) or manual.", "Business-criticality ranking. Tier-1 carries the strictest thresholds across all categories."],
  ["usage", "Low | Medium | High", "Platform-derived from query/access activity.", "Activity level. High usage on deprecated assets is flagged."],
  ["hasDescription", "boolean (description not empty)", "Computed from the description field.", "Documentation presence check. Required on Tier-1 assets."],
  ["domain", "Customer | Finance | HR | Marketing | Ops | Legal | Not Set", "Manual / inherited assignment.", "Business domain. Used for scoping and notification routing."],
]));

// 4.2
C.push(h2("4.2 Security Policy fields"));
C.push(p([txt("Reuses "), mono("classification"), txt(" (above) plus the fields below. Three fields are source-conditional - see section 5.")]));
C.push(spacer(60));
C.push(fieldTable([
  ["sensitivity", "Low | Medium | High | Critical | Not Set", "Platform-derived from classification + context.", "Graded risk level distinct from classification. High/Critical tighten encryption, row-security, and access rules."],
  ["exposure", "Public | Internal | Restricted | Not Set", "From cloud API (S3 PublicAccessBlock / Azure access level); inherited for objects.", "Network reachability. PII + Public is a max-risk violation. Only meaningful for S3 / Azure."],
  ["encryptionStatus", "Enabled | Disabled | Unknown", "Genuinely read only for S3/Azure (encryption config). Asserted Enabled for managed warehouses; Unknown for self-managed Postgres/MySQL/Oracle.", "Encryption-at-rest state. Reliable only on object stores; elsewhere it is an assertion or Unknown - see section 8."],
  ["maskingStatus", "Applied | Partial | Not Applied | Unknown", "From DDP / Unity column masks / Oracle Data Masking.", "Column-level masking state. PII without masking is flagged. Snowflake / Databricks / Oracle tables only."],
  ["rowSecurity", "Enabled | Disabled | Unknown", "From Row Access Policy / Row Filters / RLS / VPD.", "Row-level filtering state. High sensitivity / PCI without it is flagged. Snowflake / Databricks / Postgres / Oracle tables only."],
]));

// 4.3
C.push(h2("4.3 Retention Policy fields"));
C.push(p([txt("Reuses "), mono("classification"), txt(", "), mono("tags"), txt(", "), mono("owner"), txt(" plus the fields below.")]));
C.push(spacer(60));
C.push(fieldTable([
  ["retentionPeriod", "30d | 90d | 1y | 7y | Indefinite | Not Set", "S3/Azure lifecycle rules; manual for all database sources.", "How long data is kept. PII with Not Set or Indefinite (no legal hold) is flagged."],
  ["retentionClass", "Operational | Regulatory | Archive | Legal Hold | Not Set", "Manual classification.", "Retention intent/category. Drives staleness thresholds (Operational vs Archive)."],
  ["lastAccessedDays", "number (days since last access)", "Query history / audit logs / CloudTrail / Azure Monitor.", "Staleness signal. Long-idle PII/PHI without legal hold indicates over-retention."],
  ["legalHold", "boolean", "Manual platform flag.", "Legal preservation override. When true, retention/deletion rules are suspended; hold without an owner is itself flagged."],
]));

// 4.4
C.push(h2("4.4 Access Policy fields"));
C.push(p([txt("Reuses "), mono("classification"), txt(", "), mono("sensitivity"), txt(", "), mono("tier"), txt(" plus the fields below.")]));
C.push(spacer(60));
C.push(fieldTable([
  ["accessLevel", "Open | Controlled | Restricted | Not Set", "Derived from grants / bucket policy / RBAC.", "Breadth of access. Open access on PII is a primary violation. Only as accurate as the grant data exposed - see section 8."],
  ["privilegedAccess", "boolean", "Detected from grants to known admin/superuser roles. Grant-exposing sources only.", "Whether elevated/admin roles can read the asset. Flagged on PHI. Not available for file/object-level assets."],
  ["guestAccess", "boolean", "Detected from grants to PUBLIC / anonymous / external principals. Grant-exposing sources only.", "Whether broadly-shared or external principals have access. Flagged on High sensitivity. Limited support - see section 8."],
  ["lastAccessReviewDays", "number (days since last review)", "Platform access-review workflow timestamp.", "Governance freshness. Overdue reviews on PII / Tier-1 are flagged. Platform-tracked, not read from source."],
  ["roleCount", "number | null (null for file assets)", "SHOW GRANTS / information_schema / DBA_TAB_PRIVS / bucket policy.", "How many roles can access the asset. High counts on PII/PHI indicate over-sharing."],
]));

// 4.5
C.push(h2("4.5 Metadata Quality Policy fields"));
C.push(p([txt("Reuses "), mono("owner"), txt(", "), mono("steward"), txt(", "), mono("domain"), txt(", "), mono("hasDescription"), txt(", "), mono("tier"), txt(". All quality fields are platform-computed and apply to every source and asset type.")]));
C.push(spacer(60));
C.push(fieldTable([
  ["tagCoverage", "number 0-100", "Computed: tagged columns / total columns.", "Percentage of columns tagged. Low coverage on PII / Tier-1 is flagged."],
  ["metadataScore", "number 0-100", "Platform-computed composite metadata score.", "Overall metadata completeness. Low scores on low tiers are flagged."],
  ["lastReviewedDays", "number (days since metadata review)", "Platform review tracking.", "Metadata freshness. Overdue reviews on Tier-1 are flagged."],
  ["hasBusinessTerm", "boolean", "True if a glossary term is linked.", "Business-glossary linkage. Required on Tier-1 assets."],
]));

// ---- 5 ----
C.push(h1("5. Source-conditional fields"));
C.push(p("Three security fields are not meaningful on every source. The Rule Builder surfaces an inline warning when one of these is used, and scoping hides inapplicable fields. The engine treats them as not-applicable (skipped) on unsupported sources rather than failing."));
C.push(spacer());
C.push(table(
  ["Field", "Only evaluated on", "Reason"],
  [
    [[mono("maskingStatus")], "Snowflake, Databricks, Oracle (tables)", "Native column-masking only exists on these engines."],
    [[mono("exposure")], "S3, Azure Blob", "Public/private reachability is an object-store concept; databases are always Internal."],
    [[mono("rowSecurity")], "Snowflake, Databricks, Postgres, Oracle (tables)", "Native row-level security only exists on these engines."],
  ],
  [2100, 3600, 3660]
));
C.push(spacer());
C.push(p([txt("Two more fields are populated differently by source rather than being skipped: "),
  mono("encryptionStatus"), txt(" is asserted Enabled for managed warehouses, read from API for object stores, and Unknown for self-managed databases; "),
  mono("retentionPeriod"), txt(" is read from lifecycle rules on S3/Azure but is manual on all databases.")]));

// ---- 6 ----
C.push(h1("6. Scope filter fields (Create Policy wizard)"));
C.push(p("Before rules are evaluated, a policy is narrowed to a set of assets using these scope dimensions. These are filters on the asset population, not rule conditions."));
C.push(spacer());
C.push(table(
  ["Scope dimension", "Options"],
  [
    [[mono("source")], "Snowflake, Databricks, Postgres, MySQL, Oracle, S3, Azure Blob"],
    [[mono("assetType")], "Table, View, Schema, Database, Bucket, Container, Pipeline"],
    [[mono("domain")], "Customer, Finance, HR, Marketing, Ops, Legal"],
    [[mono("classification")], "PII, PHI, PCI, Confidential, Internal, Public"],
    [[mono("sensitivity")], "Low, Medium, High, Critical"],
  ],
  [2700, 6660]
));

// ---- 7 ----
C.push(h1("7. Violation record fields"));
C.push(p("When a policy condition matches, the Violation Engine persists a record with the fields below. The canonical field values are snapshotted at violation time so the drawer can show exactly what triggered the rule and from which source."));
C.push(spacer());
C.push(table(
  ["Field", "Meaning"],
  [
    [[mono("policyId")], "The policy that fired."],
    [[mono("assetId")], "The asset in violation."],
    [[mono("ruleId")], "The specific rule/condition within the policy."],
    [[mono("severity")], "Low / Medium / High / Critical - inherited from the policy."],
    [[mono("canonicalFieldsAtViolationTime")], "Snapshot of the field name, value, and source label (e.g. 'Snowflake tag: PII_EMAIL') that triggered the rule."],
    [[mono("detectedAt")], "Timestamp the violation was detected; starts the SLA timer."],
  ],
  [3100, 6260]
));
C.push(spacer());
C.push(p([txt("Lifecycle: ", { bold: true }), code("Open -> Acknowledged -> In Progress -> Resolved"),
  txt(". Notifications (in-platform inbox, email to owner + steward, Slack, Jira) fire per the policy's Actions config; an SLA breach escalates to the escalation owner.")]));

// ---- 8 ----
C.push(h1("8. Technical feasibility notes"));
C.push(p("This pass checked each field against what a source connector or the platform can actually populate. Two fields are not technically derivable and have been removed; several others are only partially derivable and are flagged so the connector layer scopes them correctly."));

C.push(h2("8.1 Removed - not technically derivable"));
C.push(table(
  ["Field", "Why it was removed"],
  [
    [[mono("environment")], "PROD / DEV / TEST is a deployment convention, not metadata a connector can read. The only population path was guessing from a schema/name prefix, which is unreliable and inconsistent across sources. Removed from the field model, scope filters, and all rules."],
    [[mono("crossDomainAccess")], "Determining whether a principal from another domain has access requires mapping every grantee role/user to an EDG business domain and comparing it to the asset's domain. Sources do not expose EDG's domain taxonomy and the prototype has no principal-to-domain mapping, so it cannot be computed. Re-introducible only if role-to-domain membership is configured in the platform."],
  ],
  [2600, 6760]
));
C.push(spacer());
C.push(p([txt("Note: removing "), mono("environment"),
  txt(" affects every rule that combined it with another condition (it appeared in Data, Security, Retention, Access, and Quality rule sets). Those rules should be reworded to drop the environment clause - e.g. 'PII + encryptionStatus = Disabled' instead of 'PII + encryptionStatus = Disabled + environment = PROD'.")]));

C.push(h2("8.2 Kept, but only partially derivable"));
C.push(p("These fields are valid but the connector cannot populate them reliably for every source. They should default to Unknown / null where the signal is unavailable rather than being treated as a confident value."));
C.push(spacer(60));
C.push(table(
  ["Field", "Limitation"],
  [
    [[mono("encryptionStatus")], "Genuinely read only for S3 / Azure (encryption config). Asserted Enabled for managed warehouses (Snowflake / Databricks); Unknown for self-managed Postgres / MySQL / Oracle, where per-object encryption is not queryable."],
    [[mono("privilegedAccess")], "Derivable only from sources that expose grant detail (warehouses + relational DBs). Requires a known list of admin/superuser roles. Not available for file/object-level assets."],
    [[mono("guestAccess")], "Detected from PUBLIC / anonymous / external grants where the source exposes them. No native guest concept in most databases; limited to grant-exposing sources and cloud identity."],
    [[mono("accessLevel")], "An abstraction (Open / Controlled / Restricted) computed from grant breadth - only as accurate as the grant data the source exposes."],
    [[mono("roleCount")], "Available for grant-exposing sources (SHOW GRANTS / information_schema / DBA_TAB_PRIVS / bucket policy); null for individual file/object assets."],
    [[mono("lastAccessedDays")], "Depends on query history / audit logging being enabled at the source (QUERY_HISTORY, CloudTrail, Azure Monitor); null where logging is off."],
    [[mono("qualityScore"), txt(", "), mono("metadataScore"), txt(", "), mono("tagCoverage"), txt(", "), mono("lastReviewedDays"), txt(", "), mono("lastAccessReviewDays"), txt(", "), mono("hasBusinessTerm")], "Platform-computed or platform-tracked, not read from the source. Feasible, but only as good as the platform's profiling and review workflows. Until those exist, they are platform-side commitments, not connector outputs."],
  ],
  [2600, 6760]
));

// ---- 9 ----
C.push(h1("9. One-line summary for review"));
C.push(p([txt("After the feasibility pass the prototype defines about two dozen canonical fields across five categories. "),
  code("classification"), txt(", "), code("tier"), txt(" and "), code("sensitivity"),
  txt(" are the cross-cutting fields that most rules pivot on. Three fields ("),
  code("maskingStatus"), txt(", "), code("exposure"), txt(", "), code("rowSecurity"),
  txt(") are source-conditional, and several access/encryption fields are only partially derivable (section 8). "),
  code("environment"), txt(" and "), code("crossDomainAccess"),
  txt(" were removed as not technically derivable. Every remaining field has a fixed type and enum, the Rule Builder exposes them as Field + Operator + Value, and the engine evaluates condition arrays against the canonical asset to produce violation records.")]));

// ===================== DOCUMENT =====================
const doc = new Document({
  creator: "Solix EDG", title: "Policy Management - Canonical Field Reference",
  styles: {
    default: { document: { run: { font: "Arial", size: 21, color: "222222" } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: NAVY, font: "Arial" },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RED, space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, color: NAVY, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [ new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [txt("Solix EDG . Policy Management Canonical Fields", { size: 15, color: GREY })] }) ] }) },
    footers: { default: new Footer({ children: [ new Paragraph({ alignment: AlignmentType.CENTER,
      children: [txt("Page ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY }),
                 txt(" of ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GREY })] }) ] }) },
    children: sections,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/sessions/lucid-clever-hopper/mnt/outputs/Solix_EDG_Policy_Canonical_Fields.docx", buf);
  console.log("written");
});
