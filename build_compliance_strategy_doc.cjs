const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  TableOfContents, PageNumber, Header, Footer, PageBreak
} = require("docx");

// ---- palette (matches build_policy_fields_doc.cjs house style) ----
const NAVY = "1F2D5A", RED = "C0392B", GREY = "555555", HEAD = "1F2D5A", ZEBRA = "F6F7FB";
const GREEN = "1E7A34", AMBER = "B7791F", SLATE = "6B7280", MAROON = "7A1F1F";
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const CONTENT_W = 9360;

function txt(s, o = {}) { return new TextRun({ text: s, ...o }); }
function p(children, o = {}) { return new Paragraph({ children: Array.isArray(children) ? children : [txt(children)], ...o }); }
function h1(s) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [txt(s)] }); }
function h2(s) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [txt(s)] }); }
function h3(s) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [txt(s, { size: 22, bold: true, color: NAVY })] }); }
function spacer(n = 80) { return new Paragraph({ spacing: { after: n }, children: [txt("")] }); }
function bullet(children, o = {}) { return new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: Array.isArray(children) ? children : [txt(children)], ...o }); }

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
    children: headers.map((hT, i) => cell([txt(hT, { bold: true, color: "FFFFFF", size: 17 })], widths[i], { fill: HEAD })),
  });
  const bodyRows = rows.map((r, ri) =>
    new TableRow({
      children: r.map((c, i) => {
        const runs = Array.isArray(c) ? c : [txt(String(c), { size: 17 })];
        return cell(runs, widths[i], { fill: ri % 2 ? ZEBRA : "FFFFFF" });
      }),
    })
  );
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, rows: [headRow, ...bodyRows] });
}

const mono = (s) => txt(s, { font: "Consolas", size: 16, color: NAVY, bold: true });
const code = (s) => txt(s, { font: "Consolas", size: 16 });

// ---- classification chip ----
const CLASS_META = {
  "Enforceable":            { color: GREEN,  label: "Enforceable" },
  "Enforceable (meta)":     { color: GREEN,  label: "Enforceable (meta)" },
  "Enforceable (proxy)":    { color: GREEN,  label: "Enforceable (proxy)" },
  "Enforceable (partial)":  { color: AMBER,  label: "Enforceable (partial)" },
  "Gap — new field":        { color: AMBER,  label: "Gap — new field" },
  "Attested":               { color: SLATE,  label: "Attested" },
  "Out of model":           { color: MAROON, label: "Out of model" },
};
function classChip(key) {
  const m = CLASS_META[key] || { color: SLATE, label: key };
  return [txt(m.label, { bold: true, size: 16, color: m.color })];
}

const sections = [];
const C = sections;

// ===================================================================
// COVER
// ===================================================================
C.push(new Paragraph({ spacing: { before: 1600, after: 0 }, alignment: AlignmentType.CENTER,
  children: [txt("Solix EDG", { bold: true, size: 30, color: RED })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 0 },
  children: [txt("Regulatory Compliance & Policy Pack Strategy", { bold: true, size: 46, color: NAVY })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 0 },
  children: [txt("From framework label to provable, auditable compliance state", { size: 22, color: GREY, italics: true })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 0 },
  children: [txt("End-to-end strategy: product rationale, current-state findings, data model, control-pattern library,", { size: 18, color: GREY })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 0 },
  children: [txt("per-framework requirement mapping, gap analysis, and build roadmap", { size: 18, color: GREY })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 0 },
  children: [txt("Source of truth: solix-platform-v2.jsx (PolicyManagerView, REGS_META), POLICY_MANAGEMENT_PLAN.md", { size: 15, color: GREY } )] }));
C.push(new Paragraph({ children: [new PageBreak()] }));

// TOC
C.push(h1("Contents"));
C.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }));
C.push(new Paragraph({ children: [new PageBreak()] }));

// ===================================================================
// 1. PRODUCT STRATEGY
// ===================================================================
C.push(h1("1. Product strategy — what problem this solves"));
C.push(p("Today, regulatory compliance in EDG is a label, not a fact. A steward creates a policy and optionally tags it with a regulation name; nothing forces that policy to actually satisfy what the regulation requires, and nothing checks back later whether it still does. The Regulations tab shows a compliance score, but that score is hand-set seed data, not something earned by real, linked, working policies."));
C.push(spacer());
C.push(p([txt("Three product outcomes this strategy delivers:", { bold: true })]));
C.push(bullet([txt("Guidance for non-experts.", { bold: true }), txt(" A data steward should not need to independently know that “restricting access to patient records” satisfies HIPAA §164.312(a). The product hands them that mapping — either via a pre-built pack, or a plain-language requirement picker.")]));
C.push(bullet([txt("A compliance score that is true.", { bold: true }), txt(" “Covered” must mean an active, working policy is actually linked to that specific requirement — not that someone once selected a framework name from a list.")]));
C.push(bullet([txt("Honesty about what EDG can and cannot check.", { bold: true }), txt(" Some requirements are data rules a rule engine can verify. Others are procedural (training, physical access, incident response) and can never be verified from asset metadata. The product must say so explicitly, per requirement — not silently ignore them or force a fake policy onto them.")]));
C.push(spacer());
C.push(p([txt("This is the single most important idea in this document: ", { bold: true }), txt("every requirement across every supported framework is classified into one of seven honest buckets (section 4), and the compliance score is computed only from what that classification allows it to claim.")]));

// ===================================================================
// 2. CURRENT STATE
// ===================================================================
C.push(h1("2. Current state — what exists today and the gap"));
C.push(p("This is not a greenfield build. Tracing the running prototype (solix-platform-v2.jsx) turned up substantially more than expected:"));
C.push(spacer());
C.push(table(
  ["Capability", "Status", "Where"],
  [
    ["Regulations dashboard (list + drill-in per framework, score bar, gap count, Governing Policies list)", "Built", "PolicyManagerView, tab===\"regulations\", ~line 8256"],
    ["Manual “Link policy to requirement” modal (toggle any existing policy onto any requirement)", "Built", "handleLinkPol / linkPolOpen, ~line 6453 and ~line 10076"],
    ["Policy-creation wizard: pick framework, then check specific plain-language articles it satisfies", "Built", "Create Policy wizard Step 3, regulationArticles, ~line 9412"],
    ["Settings → Regulations: enable/disable which frameworks apply to the org", "Built", "~line 29388"],
    ["23-framework metadata library with real per-framework requirements (REGS_META)", "Built", "~line 5722; 10 of 23 currently enabled"],
    ["54 canonical policy rules across 5 categories, against a defined canonical asset field model", "Built (design)", "POLICY_MANAGEMENT_PLAN.md"],
    ["Wiring between the creation-wizard article picker and the dashboard's linkedPolicies", "Missing — the core bug", "handleCreate, ~line 6295, never calls the equivalent of handleLinkPol"],
    ["Policy packs (pre-built starter policies mapped to requirements)", "Missing", "n/a"],
    ["Enforceable vs. attested classification per requirement", "Missing", "n/a"],
    ["Attestation workflow for non-enforceable requirements", "Missing", "n/a"],
    ["Live-computed framework score (vs. hardcoded seed value)", "Missing", "score/status fields on REGS_META are static"],
    ["Legacy duplicate constants REGULATIONS / COMPLIANCE_CONTROLS — confirmed zero references elsewhere", "Dead code, safe to delete", "~line 745, ~line 758"],
  ],
  [4200, 1800, 3360]
));
C.push(spacer());
C.push(p([txt("The one bug that matters most: ", { bold: true }), txt("when a policy is created via the wizard and the author checks “GDPR — Art. 17,” that selection is saved only on the policy object ("), mono("regulationArticles"), txt("). "), txt("handleCreate"), txt(" never writes the new policy’s id into "), mono("REGS_META"), txt("'s matching "), mono("requirement.linkedPolicies"), txt(" array — the only field the dashboard actually reads. Two UIs, two data structures, never reconciled. A user who mapped their policy correctly at creation time will still see it as an uncovered gap on the compliance dashboard. Fixing this one write path (Phase 1, section 7) is the prerequisite for everything else in this document — packs built on the same broken wiring would inherit the identical problem.")]));

// ===================================================================
// 3. TARGET DATA MODEL
// ===================================================================
C.push(h1("3. Target data model"));
C.push(p("Additive changes only — nothing here removes an existing field."));
C.push(spacer());
C.push(h2("3.1 Requirement object (extends REGS_META[].requirements[])"));
C.push(table(
  ["Field", "Type", "Purpose"],
  [
    [[mono("linkedPolicies")], "policyId[]  (existing)", "Policies satisfying this requirement. Now written from both the dashboard link modal and the creation wizard."],
    [[mono("enforcement")], "\"enforceable\" | \"meta\" | \"proxy\" | \"partial\" | \"gap\" | \"attested\" | \"out_of_model\"", "The classification from section 4 — drives which UI (policy picker vs. attestation form vs. none) the requirement shows."],
    [[mono("controlPatternId")], "string, references the Control Pattern Library (section 5)", "Which reusable control this requirement maps to — lets many requirements across frameworks share one rule definition."],
    [[mono("attestation")], "{ evidence, reviewedBy, reviewedAt, nextReviewDue } | null", "Present once a steward/owner has filed a manual attestation for a non-enforceable requirement."],
    [[mono("suggestedPolicy")], "{ name, category, rules[] } | null", "The pack-provided starter policy definition offered by “Add suggested policy.”"],
  ],
  [2100, 3200, 4060]
));
C.push(spacer());
C.push(h2("3.2 Policy object (extends the existing policy shape)"));
C.push(table(
  ["Field", "Type", "Purpose"],
  [
    [[mono("satisfies")], "{ frameworkId, requirementId }[]", "Bidirectional counterpart to linkedPolicies — written and read together, never independently."],
    [[mono("packOrigin")], "{ packId, frameworkId } | null", "Set when a policy was created via “Add suggested policy”; null for fully custom policies. Used for pack-adoption analytics."],
  ],
  [2100, 3200, 4060]
));
C.push(spacer());
C.push(h2("3.3 New top-level structures"));
C.push(bullet([mono("POLICY_PACKS"), txt("  — keyed by frameworkId, each entry a list of starter policy definitions (name, category, rules[], suggested domains/tags), each pre-tagged with the requirementId(s) it satisfies.")]));
C.push(bullet([mono("CONTROL_PATTERNS"), txt("  — the ~20 reusable control definitions in section 5, each with its canonical-field rule logic and enforcement classification. Requirements reference a pattern rather than each inventing its own rule from scratch.")]));

// ===================================================================
// 4. SEVEN-WAY ENFORCEMENT CLASSIFICATION
// ===================================================================
C.push(h1("4. The enforcement classification (seven buckets)"));
C.push(p("Every requirement in every supported framework is placed in exactly one bucket. This replaces the earlier, looser “enforceable vs. attested” framing — that binary was not honest enough once the actual 49 requirements were mapped (section 7)."));
C.push(spacer());
C.push(table(
  ["Bucket", "Meaning", "What the UI shows"],
  [
    [[...classChip("Enforceable")], "A canonical-field rule can check this per-asset, today, with fields that already exist.", "“Add suggested policy” creates a real, working policy."],
    [[...classChip("Enforceable (meta)")], "Not a per-asset check — verified by the existence of an Active EDG policy/program covering the relevant scope (e.g. “a PHI-scoped security policy exists and is Active”).", "“Add suggested policy,” but the rule checks policy existence, not asset facts."],
    [[...classChip("Enforceable (proxy)")], "No direct legal test is data-observable, but a reasonable automated signal exists (e.g. flag long-idle, never-reviewed PII as a minimisation risk).", "“Add suggested policy,” labeled as an approximation in the UI so nobody mistakes proxy coverage for legal certainty."],
    [[...classChip("Enforceable (partial)")], "The requirement bundles two things — part is a real per-asset rule, part is not.", "Both a suggested policy for the enforceable half and an attestation prompt for the rest."],
    [[...classChip("Gap — new field")], "Would be enforceable, but requires a canonical field or data source EDG does not populate yet.", "Shown as a gap with the specific missing field named — not hidden, not silently attested."],
    [[...classChip("Attested")], "Genuinely not observable from asset metadata — procedural, organisational, or evidence-based.", "“Attest manually” form: evidence, reviewed-by, next-review-date, routed through owner sign-off."],
    [[...classChip("Out of model")], "Belongs to a different system entirely (identity/MFA, SIEM, vendor registry, incident response, financial disclosure) — forcing it into EDG's asset-policy engine would be dishonest.", "Shown as explicitly out of scope, excluded from the compliance score rather than left as a perpetual open gap."],
  ],
  [1900, 3600, 3860]
));
C.push(spacer());
C.push(p([txt("Why “Out of model” matters: ", { bold: true }), txt("without it, requirements like “enforce MFA” (an identity-system concept, not a data-asset concept) would sit forever as an unaddressed gap dragging the score down, or get force-fitted into a meaningless asset-level rule. Naming it out of scope is more honest than either.")]));

// ===================================================================
// 5. CONTROL PATTERN LIBRARY
// ===================================================================
C.push(h1("5. Control pattern library"));
C.push(p("Twenty recurring control themes cover all 49 requirements across the 10 currently-enabled frameworks (section 7). Requirements reference a pattern instead of each authoring a bespoke rule — this is what makes 49 requirements tractable instead of 49 one-off designs. Canonical field names and rule numbers reference POLICY_MANAGEMENT_PLAN.md's existing 54-rule library wherever a fit already exists."));
C.push(spacer());

const CP = [
  ["CP1", "PII/PHI/PCI access restriction", "Enforceable", "Access Policy #1, #2, #6, #9 — classification=PII/PHI + accessLevel=Open or roleCount above threshold."],
  ["CP2", "Encryption at rest / in transit", "Enforceable (partial)", "Security Policy #3, #4 — classification=PII + encryptionStatus=Disabled. Source-conditional: asserted Enabled on managed warehouses, Unknown on self-managed Postgres/MySQL/Oracle (see field reference §5)."],
  ["CP3", "Column masking / redaction", "Enforceable (partial)", "Security Policy #5, #6, #10 — maskingStatus. Only meaningful on Snowflake / Databricks / Oracle tables."],
  ["CP4", "Audit logging of access to sensitive data", "Gap — new field", "No canonical auditLoggingEnabled field exists today. Needed: boolean per table/source, populated from QUERY_HISTORY / CloudTrail / Azure Monitor presence."],
  ["CP5", "Deletion / erasure request fulfilment", "Attested", "SLA on data-subject deletion requests is a workflow metric, not an asset-state fact. A future “Data Subject Request” tracking module could enforce this; not in scope now."],
  ["CP6", "Retention limits / storage limitation", "Enforceable", "Retention Policy #1, #3, #5, #6, #8, #10 — classification=PII + retentionPeriod=Not Set or Indefinite without legal hold."],
  ["CP7", "Purpose limitation / lawful basis / consent", "Out of model", "Consent and legal-basis records live in a consent-management system EDG does not ingest. Forcing this onto asset metadata would be meaningless."],
  ["CP8", "Records of processing / documentation completeness", "Enforceable", "Metadata Quality Policy #1, #2, #6 — hasDescription, hasBusinessTerm, owner/steward set."],
  ["CP9", "Breach notification timeline (24h/72h)", "Out of model", "An incident-response runbook metric, not a data-asset attribute. Belongs to a future incident-management module, not the policy engine."],
  ["CP10", "Physical / facility safeguards", "Attested", "Badge access, server room controls — no canonical field could ever represent this."],
  ["CP11", "Workforce training / security awareness", "Attested", "An HR/LMS concept, not a data-asset concept."],
  ["CP12", "Minimum necessary / need-to-know disclosure limits", "Enforceable", "Access Policy #1, #2, #6 — same fields as CP1, applied to disclosure scope rather than raw access."],
  ["CP13", "Right of access (subject can request a copy)", "Attested", "A fulfilment workflow / SLA, not a static asset fact."],
  ["CP14", "User identification & authentication (MFA, unique IDs)", "Out of model", "An identity/IAM-system concept, evaluated at the account level, not the data-asset level. Requires an IAM/SSO integration — a separate initiative, not a new ASSETS field."],
  ["CP15", "Vendor / third-party risk assessment", "Attested", "No vendor-registry object exists in the canonical model today; would need a new object type, not just a new field."],
  ["CP16", "Change management / authorised change process", "Attested", "A deployment/CI-audit concept, outside the asset metadata model."],
  ["CP17", "Backup & disaster recovery (RTO/RPO tested)", "Attested", "Infrastructure-level, not per-data-asset."],
  ["CP18", "Asset catalogue / inventory maintained", "Enforceable", "Data Policy #1, #4, #9, #10, #11 — this is what EDG's core catalog already does. Strongest natural fit in the whole library."],
  ["CP19", "Information classification scheme applied", "Enforceable", "Direct measure: % of assets with classification ≠ Not Set. Uses the classification field itself as the metric."],
  ["CP20", "Accountable individual / DPO designated", "Attested", "An organisational-role fact, not observable from any asset."],
];
C.push(table(
  ["#", "Control pattern", "Class", "Rule logic / canonical fields"],
  CP.map(r => [r[0], r[1], classChip(r[2]), r[3]]),
  [560, 2300, 1700, 4800]
));

// ===================================================================
// 6. UX FLOWS
// ===================================================================
C.push(h1("6. Rule fidelity — what a passing check proves, and what it doesn't"));
C.push(p([txt("This is the gap between two different claims: ", { bold: true }), txt("“EDG can systematically check this” (the section 4 classification) is not the same claim as “passing this check means the regulation's intent is satisfied.” Every Enforceable / meta / proxy / partial pattern below is a "), txt("mechanical proxy", { bold: true }), txt(" for a legal standard, not the standard itself. Treating a 100% control-coverage score as “certified compliant” would be exactly the kind of overclaiming this strategy exists to prevent — so the residual gap is named explicitly, pattern by pattern, with the compensating control that closes it.")]));
C.push(spacer());
const FIDELITY = [
  ["CP1", "PII/PHI/PCI access restriction", "No broad or open grant exists, and the raw count of roles with access is below a threshold.", "That the roles which do have access actually need it for their specific job function. “Minimum necessary” is a contextual, per-purpose legal test — a static role count cannot distinguish a justified small group from an unjustified one.", "Pair every CP1 policy with a mandatory periodic access-review attestation (reuses the existing lastAccessReviewDays field) rather than treating the automated count as sufficient on its own."],
  ["CP2", "Encryption at rest / in transit", "An encryption flag is set to Enabled.", "That the cipher/algorithm and key-management practice meet the specific standard the regulation expects (e.g. PCI DSS's “strong cryptography”). A weak or outdated cipher still reads as Enabled.", "Require a periodic security-architecture attestation of the actual encryption implementation alongside the automated flag."],
  ["CP3", "Column masking / redaction", "A masking mechanism is applied to the column.", "That the masking technique achieves the specific de-identification standard required (e.g. HIPAA Safe Harbor's 18-identifier removal, or GDPR's “effective anonymisation” test). Partial or reversible redaction still reads as Applied.", "Attest the specific masking technique against the regulation's de-identification standard, not just its presence."],
  ["CP6", "Retention limits / storage limitation", "A retentionPeriod value is set on the asset.", "That expiry actually triggers automated deletion. The field can be pure metadata with no enforcement mechanism behind it.", "Verify (instrument or attest) that the connector or platform genuinely purges data at expiry, not only that it is tagged."],
  ["CP8", "Records of processing", "A description and a linked business term exist.", "That the documentation contains the specific elements the regulation legally requires (for GDPR Art. 30: purposes, categories of recipients, international transfers, retention schedule). A generic one-line description passes the rule while failing the legal content requirement.", "Replace the generic description check with a structured, requirement-specific documentation template for Art. 30-class controls."],
  ["CP12", "Minimum necessary / need-to-know", "roleCount or accessLevel is below a threshold on sensitive-classified assets.", "That the specific data accessed was minimally necessary for the specific purpose of each access — a per-transaction judgement, not a static asset property.", "Route CP12 gaps to periodic use-case attestation rather than closing them purely on the numeric threshold."],
  ["CP18", "Asset catalogue maintained", "Owner, tier, description, and domain are populated on catalogued assets.", "That the catalogue is complete. The rule can only ever evaluate assets already known to EDG — an undiscovered shadow data source is invisible to it and never counted against the score.", "Pair with a periodic discovery-coverage audit: are all data sources in the organisation actually connected to EDG at all?"],
  ["CP19", "Classification scheme applied", "The classification field is set to something other than Not Set.", "That the classification value is correct. An asset labelled Internal when it actually contains PII passes this rule while being substantively non-compliant — and because CP1, CP2, CP3, CP6, and CP12 are all conditioned on classification, a wrong label silently breaks every downstream rule that depends on it without ever showing as a failure.", "The single highest-leverage compensating control in the library: periodically sample catalogued assets and re-run automated classification against manual/expert review to measure and bound the mislabelling rate."],
  ["Meta pattern", "Used for HIPAA §164.308, PCI Req. 12", "An Active EDG policy object exists, scoped to the right classification.", "That the policy's actual rule content is adequate, that it is being followed operationally, or that it would survive an external auditor's review of its substance. Existence is the weakest evidence tier in this entire model — it is not adequacy.", "Never let a “meta” check stand alone: always pair it with a mandatory periodic legal/compliance sign-off attestation, regardless of the automated result."],
  ["Proxy pattern", "Used for GDPR Art. 5(1)(c), UK GDPR Art. 25, CCPA §1798.120", "A plausible automated signal correlated with the requirement (e.g. long-idle PII as an over-collection signal).", "That the actual legal test is satisfied. Proxies have false positives and false negatives — a rarely-accessed PII column may still be strictly necessary for an annual audit, so “low usage” alone is not proof of over-collection.", "Proxy flags must always route to human review before being treated as resolved — never auto-close a proxy-flagged requirement."],
];
C.push(table(
  ["Pattern", "What the rule proves", "What it does not prove (residual gap)", "Compensating control"],
  FIDELITY.map(r => [[txt(r[0]+" — "+r[1], { bold: true, size: 16 })], r[2], r[3], r[4]]),
  [1900, 2000, 2960, 2500]
));
C.push(spacer());
C.push(p([txt("Consequence for the score: ", { bold: true }), txt("the number in section 9 should be labelled “automated governance control coverage,” never “certified compliant.” Every point in that score, even at 100%, still carries the residual gap above — this document's job is to make that gap visible, not to make it disappear.")]));
C.push(new Paragraph({ children: [new PageBreak()] }));

C.push(h1("7. End-to-end user experience"));
C.push(h2("6.1 Starting from a pack (the non-expert path)"));
C.push(bullet("Policy Manager → “Start from a compliance pack”, next to “Create policy”."));
C.push(bullet("Pick a framework (10 enabled today — section 7). See its requirement checklist grouped by status: Covered / Attested / Gap."));
C.push(bullet("On an Enforceable gap: “Add suggested policy” creates a pre-filled Draft using that requirement's Control Pattern rule, correctly pre-linked via satisfies / linkedPolicies. The steward customises domains/tags/thresholds, then runs it through the existing Draft → In Review → Approved → Active lifecycle."));
C.push(bullet("On an Attested gap: “Attest manually” opens the evidence + reviewed-by + next-review-date form, routed through the owner-approval store already built for Tag/Domain status changes."));
C.push(bullet("On an Out-of-model requirement: shown as explicitly excluded, with a one-line reason, and does not count against the score."));
C.push(spacer());
C.push(h2("6.2 Fully custom policy (the expert path)"));
C.push(p("Unchanged UI — the Step 3 framework/article picker already exists (~line 9412). The only change is that saving now writes both directions (section 3), so a custom policy's requirement selection is immediately visible on the compliance dashboard instead of silently going nowhere."));
C.push(spacer());
C.push(h2("6.3 Compliance dashboard (the auditor / compliance-owner view)"));
C.push(p("The existing Regulations tab (~line 8256) gains: enforcement-bucket badges per requirement (section 4), a live-computed score (section 8) instead of the hardcoded value, and drill-through from any requirement to its linked policy or its attestation evidence."));

// ===================================================================
// 7. PER-FRAMEWORK REQUIREMENT MAPPING
// ===================================================================
C.push(h1("8. Per-framework requirement mapping — all 10 enabled frameworks"));
C.push(p("Every requirement currently defined in REGS_META for an enabled framework, classified per section 4, mapped to its Control Pattern (section 5), with the specific suggested policy or attestation ask named. This is the literal content of every framework's “Add suggested policy” buttons."));

const FW = [
{ id:"GDPR", full:"General Data Protection Regulation — EU", reqs:[
  ["Art. 5(1)(c)","Data minimisation — collect only what is necessary","Enforceable (proxy)","CP1 proxy","Flag PII assets with usage=Low and lastAccessedDays>180 for a necessity review."],
  ["Art. 5(1)(b)","Purpose limitation — data used only as declared","Attested","CP7","Attest the documented purpose for each processing activity; no per-asset signal exists."],
  ["Art. 5(1)(e)","Storage limitation — enforce retention periods","Enforceable","CP6","Policy: “PII Storage Limitation” — flags classification=PII with retentionPeriod=Not Set or Indefinite without legal hold."],
  ["Art. 17","Right to erasure — honour deletion requests within one month","Attested","CP5","Attest the deletion-request SLA process; not an asset-state fact today."],
  ["Art. 32","Security of processing — technical controls documented","Enforceable","CP2 + CP3","Policy: “GDPR Technical Security Controls” — encryption + masking checks on PII/PHI-classified assets."],
  ["Art. 30","Records of processing activities maintained","Enforceable","CP8","Policy: “GDPR Processing Records Completeness” — hasDescription + hasBusinessTerm on in-scope assets."],
]},
{ id:"UK GDPR", full:"UK General Data Protection Regulation", reqs:[
  ["Art. 6","Lawful basis for processing — documented and maintained","Attested","CP7","Attest the recorded lawful basis per processing activity."],
  ["Art. 13-14","Transparency — privacy notices provided to data subjects","Attested","CP7","Attest that a current privacy notice exists and covers in-scope data."],
  ["Art. 25","Data protection by design and by default","Enforceable (proxy)","CP19 proxy","Flag newly catalogued PII assets left at classification=Not Set past a grace period, as a design-time proxy."],
  ["Art. 35","DPIA for high-risk processing","Attested","CP7","Attest a completed Data Protection Impact Assessment for flagged high-risk processing."],
  ["Art. 33","Breach notification — 72-hour reporting to ICO","Out of model","CP9","Incident-response timeline; excluded from the data-asset compliance score."],
]},
{ id:"CCPA / CPRA", full:"California Consumer Privacy Act / Privacy Rights Act", reqs:[
  ["§1798.100","Right to know — disclose personal data collected","Attested","CP13","Attest the consumer-disclosure fulfilment process."],
  ["§1798.105","Right to delete — honour deletion requests","Attested","CP5","Same as GDPR Art. 17 — attest the deletion SLA process."],
  ["§1798.120","Right to opt-out — do not sell or share personal information","Enforceable (proxy)","CP1 proxy","Requires an “opt-out-honored” tag convention; policy flags PII assets missing that tag. Depends on adopting the tag convention org-wide."],
  ["§1798.150","Data breach liability — reasonable security measures required","Enforceable","CP2 + CP1","Policy: “CCPA Reasonable Security Controls” — encryption + access-restriction checks."],
  ["§1798.121","Sensitive personal information — limit use and disclosure","Enforceable","CP12","Policy: “CCPA Sensitive Data Disclosure Limits” — roleCount / accessLevel checks on sensitive-classified assets."],
]},
{ id:"HIPAA", full:"Health Insurance Portability and Accountability Act", reqs:[
  ["§164.308","Administrative safeguards — policies and procedures for PHI","Enforceable (meta)","CP1 meta","Policy existence check: at least one Active Security/Data policy scoped to PHI classification."],
  ["§164.310","Physical safeguards — facility and workstation controls","Attested","CP10","No digital signal is possible — always attested."],
  ["§164.312","Technical safeguards — access controls and audit controls","Enforceable (partial)","CP1 + CP4","Access-control half enforceable today (CP1). Audit-controls half is a Gap — new field (CP4, auditLoggingEnabled)."],
  ["§164.502","Use and disclosure limitations — minimum necessary standard","Enforceable","CP12","Policy: “HIPAA Minimum Necessary” — roleCount / accessLevel checks on PHI-classified assets."],
  ["§164.524","Right of access — patients can request copies of PHI","Attested","CP13","Attest the patient-request fulfilment process."],
]},
{ id:"HITECH", full:"Health Information Technology for Economic and Clinical Health Act", reqs:[
  ["§13402","Breach notification — notify affected individuals and HHS","Out of model","CP9","Incident-response timeline; excluded from score."],
  ["§13401","Business associate liability — direct HIPAA obligations apply","Attested","CP15","A vendor/contract fact, not an asset attribute — no vendor-registry object exists yet."],
  ["§13405","Restrictions on disclosures — honour patient restrictions","Enforceable","CP12","Same rule family as §164.502 — access/disclosure limits on PHI."],
  ["§13405(c)","Accounting of disclosures — track disclosures made through an EHR","Gap — new field","CP4","Needs a disclosure-log capability per PHI asset; overlaps the CP4 audit-logging gap."],
]},
{ id:"PCI DSS", full:"Payment Card Industry Data Security Standard", reqs:[
  ["Req. 3","Protect stored cardholder data — encryption required","Enforceable (partial)","CP2","Enforceable on Snowflake/Databricks/managed warehouses; Unknown (attested fallback) on self-managed Postgres/MySQL/Oracle — see field reference §5."],
  ["Req. 7","Restrict access to cardholder data by business need-to-know","Enforceable","CP1","Policy: “PCI Need-to-Know Access” — roleCount / accessLevel on PCI-classified assets."],
  ["Req. 8","Identify users and authenticate access to system components","Out of model","CP14","Identity/MFA is an IAM-system concept, not an asset field — requires a separate IAM integration."],
  ["Req. 10","Log and monitor all access to network resources and cardholder data","Gap — new field","CP4","Needs auditLoggingEnabled plus a monitoring/alerting signal — not present in the canonical model today."],
  ["Req. 12","Support information security with organisational policies","Enforceable (meta)","CP1 meta","Policy existence check: at least one Active policy scoped to PCI-classified assets."],
]},
{ id:"SOX", full:"Sarbanes-Oxley Act", reqs:[
  ["§302","CEO/CFO certification of financial statement accuracy","Attested","CP20","A textbook fit for the attestation feature itself — a named officer signs a statement with evidence and a review date."],
  ["§404","Internal control assessment — ICFR documented annually","Attested","CP16","Annual control-documentation artifact, not an asset fact."],
  ["§802","Records retention — audit records retained 7 years","Enforceable","CP6","Policy: “SOX Audit Record Retention” — domain=Finance assets require retentionClass=Regulatory and retentionPeriod=7y."],
  ["§409","Real-time disclosure of material changes to financial condition","Out of model","n/a","A financial-reporting/legal-disclosure process entirely outside data governance — explicitly excluded, not left open."],
]},
{ id:"SOC 2", full:"Service Organisation Control 2", reqs:[
  ["CC6.1","Logical access security measures — RBAC and MFA enforced","Enforceable (partial)","CP1 + CP14","RBAC half enforceable (CP1). MFA half is Out of model (CP14, identity system)."],
  ["CC7.1","System monitoring — anomaly detection and alerting","Out of model","n/a","A SIEM/observability concept — adjacent system integration, not the asset-policy engine's job."],
  ["CC8.1","Change management — authorised change process documented","Attested","CP16","A deployment/CI-audit concept, outside the asset model."],
  ["A1.1","Data backup and recovery — tested RTO/RPO targets","Attested","CP17","Infrastructure-level, not per-asset."],
  ["CC9.2","Vendor risk management — third-party assessments conducted","Attested","CP15","No vendor-registry object exists yet."],
]},
{ id:"ISO 27001", full:"ISO/IEC 27001 — Information Security Management", reqs:[
  ["Clause 6.1","Information security risk assessment and treatment","Attested","n/a","An organisational risk-assessment document, not an asset fact."],
  ["Annex A 5.12","Information classification — asset classification scheme","Enforceable","CP19","Direct measure: % of catalogued assets with classification ≠ Not Set. Strongest natural fit."],
  ["Annex A 5.15","Access control policy — documented and implemented","Enforceable (partial)","CP1 + CP16","Implemented half enforceable (CP1). Documented half is attested."],
  ["Annex A 8.15","Logging and monitoring — event logs retained and reviewed","Gap — new field / Attested","CP4","Retention half is a Gap — new field; review-cadence half is attested."],
  ["Annex A 5.29","Information security continuity — BCP/DR aligned","Attested","CP17","Infrastructure continuity plan, not per-asset."],
]},
{ id:"NIST CSF", full:"NIST Cybersecurity Framework", reqs:[
  ["ID.AM","Asset management — catalogue of data assets maintained","Enforceable","CP18","This is what EDG's core catalog already does. Reuses Data Policy #1, #4, #9, #10, #11 — the flagship easy win."],
  ["PR.AC","Identity management and access control implemented","Enforceable (partial)","CP1 + CP14","Access-control half enforceable (CP1). Identity/MFA half is Out of model (CP14)."],
  ["PR.DS","Data security — data-at-rest and in-transit protection","Enforceable (partial)","CP2 + CP3","Source-conditional, same caveats as PCI Req. 3."],
  ["DE.CM","Continuous monitoring — security events detected","Out of model","n/a","A SIEM concept, same as SOC 2 CC7.1."],
  ["RS.RP","Response planning — incident response plan executed","Attested","CP9","An incident-response artifact, not an asset fact."],
]},
];

FW.forEach(fw => {
  C.push(h2(fw.id + " — " + fw.full));
  C.push(table(
    ["Ref", "Requirement", "Class", "Pattern", "Suggested policy / attestation"],
    fw.reqs.map(r => [r[0], r[1], classChip(r[2]), r[3], r[4]]),
    [900, 2400, 1500, 900, 3660]
  ));
  C.push(spacer(120));
});

// ===================================================================
// 8. GAP SUMMARY & SCORING
// ===================================================================
C.push(h1("9. Gap summary and compliance scoring"));

let counts = {};
FW.forEach(fw => fw.reqs.forEach(r => {
  const k = r[2].replace(" (proxy)","").replace(" (meta)","").replace(" (partial)","");
  counts[k] = (counts[k]||0)+1;
}));
const total = FW.reduce((s,fw)=>s+fw.reqs.length,0);
C.push(p(`Across the ${FW.length} currently-enabled frameworks and ${total} requirements they define:`));
C.push(spacer());
C.push(table(
  ["Bucket", "Count", "Share of total"],
  Object.entries(counts).map(([k,v]) => [classChip(k), String(v), Math.round(v/total*100)+"%"]),
  [3000, 1500, 4860]
));
C.push(spacer());
C.push(h2("9.1 Net-new canonical fields required"));
C.push(bullet([mono("auditLoggingEnabled"), txt(" (boolean, per table/source) — closes the audit-controls half of HIPAA §164.312, HITECH §13405(c), PCI Req. 10, ISO 27001 Annex A 8.15. Populated from QUERY_HISTORY / CloudTrail / Azure Monitor presence, same connector pattern already used for lastAccessedDays.")]));
C.push(spacer());
C.push(h2("9.2 Scoring formula"));
C.push(p([txt("Per framework: "), code("score = round( (enforceable_covered + meta_covered + proxy_covered + attested_covered) / (total_requirements − out_of_model_count) × 100 )"), txt(". Partial requirements count as covered only once both halves are addressed (a linked policy for the enforceable half and a filed attestation for the non-enforceable half). Out-of-model requirements are removed from the denominator entirely — they are not part of what EDG can honestly claim to measure.")]));
C.push(spacer());
C.push(h2("9.3 Label the score honestly"));
C.push(p([txt("Per section 6, this number must be surfaced in the UI as ", { bold: true }), txt("“automated governance control coverage,”", { bold: true }), txt(" never as “compliant” or “certified.” Recommended dashboard copy: “82% of HIPAA controls have automated coverage or a filed attestation — this reflects governance readiness, not a legal compliance certification.” Every Enforceable/meta/proxy point in the score still carries the residual gap documented in section 6; the label is what keeps the score from being read as something it is not.")]));

// ===================================================================
// 9. ROADMAP
// ===================================================================
C.push(h1("10. Build roadmap"));
C.push(table(
  ["Phase", "What", "Depends on"],
  [
    ["1. Fix the wire", "handleCreate writes satisfies/linkedPolicies both directions. Same on edit/delete.", "—"],
    ["2. Retire dead code", "Delete REGULATIONS and COMPLIANCE_CONTROLS (~line 745, ~line 758) — confirmed unreferenced.", "—"],
    ["3. Enforcement classification", "Add enforcement + controlPatternId to every requirement in REGS_META per section 8.", "Phase 1"],
    ["4. Control Pattern Library", "Encode the 20 patterns (section 5) as reusable rule templates the engine can instantiate.", "Phase 3"],
    ["5. Policy packs (HIPAA + GDPR first)", "POLICY_PACKS content authored from section 8's mapping; “Start from a compliance pack” entry point.", "Phase 4"],
    ["6. Attestation workflow", "Attestation form + owner-approval routing (reuses the Tag/Domain status-request store).", "Phase 3"],
    ["7. Compensating controls", "Wire the section 6 compensating controls as recurring tasks (access-review reminders, classification-accuracy sampling, meta-check sign-off cadence) — not just the automated rule itself.", "Phases 5, 6"],
    ["8. Live scoring, honestly labelled", "Replace hardcoded score/status with the section 9.2 formula and the section 9.3 “control coverage” copy — never “compliant.”", "Phases 1, 3, 6, 7"],
    ["9. New field: auditLoggingEnabled", "Closes the largest single gap cluster (HIPAA, HITECH, PCI, ISO 27001).", "Connector work, independent track"],
    ["10. Remaining 13 frameworks", "Same methodology (sections 4–6) applied to the frameworks not yet enabled in REGS_META.", "Phases 3–4 proven out first"],
  ],
  [2600, 5100, 1660]
));
C.push(spacer());
C.push(p([txt("Nothing in this document has been built yet — it is the agreed strategy, pending explicit sign-off to begin implementation.", { italics: true, color: GREY })]));

// ===================================================================
// DOCUMENT
// ===================================================================
const doc = new Document({
  creator: "Solix EDG", title: "Regulatory Compliance & Policy Pack Strategy",
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
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: NAVY, font: "Arial" },
        paragraph: { spacing: { before: 180, after: 90 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [ new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [txt("Solix EDG · Compliance & Policy Pack Strategy", { size: 15, color: GREY })] }) ] }) },
    footers: { default: new Footer({ children: [ new Paragraph({ alignment: AlignmentType.CENTER,
      children: [txt("Page ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY }),
                 txt(" of ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GREY })] }) ] }) },
    children: sections,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("Solix_EDG_Compliance_Policy_Pack_Strategy.docx", buf);
  console.log("written");
});
