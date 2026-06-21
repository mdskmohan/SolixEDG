const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, Header, Footer, PageBreak,
  TableOfContents,
} = require("docx");

const CONTENT_W = 9360; // US Letter, 1" margins

// ---- palette ----
const C = {
  ink: "1f2937", sub: "6b7280", line: "d1d5db",
  l1: "0d9488", l1b: "d6f3ef",   // connectivity (teal)
  l2: "0ea5e9", l2b: "dcf1fb",   // catalog (blue)
  l3: "d97706", l3b: "fbe9cf",   // governance (amber)
  l4: "7c3aed", l4b: "ece2fb",   // experience (purple)
  l5: "475569", l5b: "e2e6ec",   // audit (slate)
  red: "ee2424", redb: "fbdada",
  green: "16a34a", greenb: "d8f0df",
  hdr: "1f3a5f", hdrb: "dde6f0",
};

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder };
const thinAll = (c = C.line) => {
  const b = { style: BorderStyle.SINGLE, size: 4, color: c };
  return { top: b, bottom: b, left: b, right: b };
};

// ---- helpers ----
function t(text, opts = {}) { return new TextRun({ text, ...opts }); }

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: opts.spacing || { after: 120 },
    children: Array.isArray(text) ? text : [t(text, opts.run || {})],
  });
}

function bullet(text, runOpts = {}) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60 },
    children: Array.isArray(text) ? text : [t(text, runOpts)],
  });
}

// colored full-width band (layer header)
function band(numLabel, title, subtitle, fill) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: noBorders,
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        borders: thinAll(fill),
        children: [
          new Paragraph({ spacing: { after: 0 }, children: [
            t(numLabel + "  ", { bold: true, color: "FFFFFF", size: 26 }),
            t(title, { bold: true, color: "FFFFFF", size: 26 }),
          ]}),
          ...(subtitle ? [new Paragraph({ spacing: { before: 30, after: 0 }, children: [
            t(subtitle, { color: "FFFFFF", italics: true, size: 17 }),
          ]})] : []),
        ],
      })],
    })],
  });
}

// row of equal-width component "boxes"
function boxes(items, fill, textColor = C.ink) {
  const n = items.length;
  const w = Math.floor(CONTENT_W / n);
  const widths = Array(n).fill(w);
  widths[n - 1] = CONTENT_W - w * (n - 1);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    borders: noBorders,
    rows: [new TableRow({
      children: items.map((it, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 90, right: 90 },
        borders: thinAll("FFFFFF"),
        verticalAlign: VerticalAlign.CENTER,
        children: it.split("\n").map((ln, idx) => new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 0 },
          children: [t(ln, { color: textColor, bold: idx === 0, size: idx === 0 ? 17 : 15 })],
        })),
      })),
    })],
  });
}

function arrow(label) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [
      t("▼", { color: C.sub, size: 22, bold: true }),
      ...(label ? [t("  " + label, { color: C.sub, italics: true, size: 15 })] : []),
    ],
  });
}

// single flow box (vertical data-flow)
function flowBox(title, sub, fill, textColor = C.ink) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: noBorders,
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 90, bottom: 90, left: 200, right: 200 },
      borders: thinAll(fill),
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: sub ? 30 : 0 },
          children: [t(title, { bold: true, color: textColor, size: 19 })] }),
        ...(sub ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 },
          children: [t(sub, { color: textColor, size: 15 })] })] : []),
      ],
    })] })],
  });
}

function spacer(h = 60) { return new Paragraph({ spacing: { after: h }, children: [t("")] }); }

// ---- generic table builder ----
function dataTable(headers, rows, widths, headFill = C.hdr) {
  const headCells = headers.map((h, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: { fill: headFill, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: thinAll(C.line),
    children: [new Paragraph({ children: [t(h, { bold: true, color: "FFFFFF", size: 18 })] })],
  }));
  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((cell, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: ri % 2 ? "f3f5f8" : "ffffff", type: ShadingType.CLEAR },
      margins: { top: 70, bottom: 70, left: 120, right: 120 },
      borders: thinAll(C.line),
      verticalAlign: VerticalAlign.CENTER,
      children: (Array.isArray(cell) ? cell : [cell]).map((line, li) => new Paragraph({
        spacing: { after: 0 },
        children: [t(line, { size: 17, bold: i === 0 && li === 0 })],
      })),
    })),
  }));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: headCells }), ...bodyRows],
  });
}

// ============================ BUILD ============================
const children = [];

// Title
children.push(
  new Paragraph({ spacing: { before: 1200, after: 0 }, alignment: AlignmentType.LEFT,
    children: [t("Solix EDG", { bold: true, color: C.red, size: 30 })] }),
  new Paragraph({ spacing: { before: 80, after: 0 },
    children: [t("Architecture Overview", { bold: true, color: C.ink, size: 56 })] }),
  new Paragraph({ spacing: { before: 120, after: 0 },
    children: [t("Conceptual reference architecture for the Enterprise Data Governance platform",
      { color: C.sub, size: 22, italics: true })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.red, space: 8 } },
    spacing: { before: 200, after: 0 }, children: [t("")] }),
  new Paragraph({ spacing: { before: 200 },
    children: [t("Version 1.0   ·   June 2026", { color: C.sub, size: 18 })] }),
  new Paragraph({ children: [new PageBreak()] }),
);

// TOC
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t("Contents")] }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({ children: [new PageBreak()] }),
);

// 1. Purpose
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t("1. Purpose & Scope")] }),
  p("This document describes the conceptual architecture of the Solix EDG platform — how data flows from connected sources into a governed, trusted, and consumable state. Every component described here is reflected in the working prototype."),
  p([
    t("Scope note: ", { bold: true }),
    t("This is a conceptual architecture. Deployment topology, physical storage, and security/network architecture are "),
    t("not specified in the prototype source", { bold: true }),
    t(" and are listed in Section 7 (Assumptions & Gaps)."),
  ]),
  p("The platform is organized into five cooperating layers. Sources feed the catalog through the connectivity layer; the governance & policy layer operates over the catalogued assets; the experience & access layer scopes what each role can see and do; and the audit layer records every consequential action across all of them."),
);

// 2. Layered architecture (DIAGRAM)
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t("2. Layered Architecture")] }),
  p("The diagram below shows the five layers and the principal components within each. Data and control flow downward; the audit layer spans the catalog, governance, and access layers.", { run: { color: C.sub } }),
  spacer(40),
);

// Sources
children.push(band("①", "SOURCES", "Governed in place — no data is moved or copied", C.l1));
children.push(boxes([
  "Cloud Warehouses\nSnowflake · Databricks · BigQuery",
  "Databases\nOracle · PostgreSQL · MySQL",
  "Cloud Storage\nS3 · Azure Blob",
  "Transformation\ndbt · ETL / Airflow",
], C.l1b));
children.push(arrow("read-only metadata, lineage, profiles, usage"));

// Connectivity
children.push(band("②", "CONNECTIVITY LAYER", "Scheduled or on-demand ingestion", C.l1));
children.push(boxes([
  "Metadata &\nschema scan",
  "Lineage &\nprofile capture",
  "Classification sync\n(bi-directional)",
  "Scheduled /\non-demand runs",
], C.l1b));
children.push(arrow());

// Catalog
children.push(band("③", "METADATA CATALOG", "Central, searchable inventory — the single source of truth", C.l2));
children.push(boxes([
  "Asset hierarchy\ndb→schema→table/view",
  "Lineage graph\nasset + column level",
  "Quality\nresults",
], C.l2b));
children.push(boxes([
  "Classifications\n/ tags",
  "Certification\nstatus",
  "Business\nglossary",
], C.l2b));
children.push(arrow());

// Governance
children.push(band("④", "GOVERNANCE & POLICY LAYER", "Operates over catalogued assets", C.l3));
children.push(boxes([
  "Domains &\nData Products",
  "Classification &\npropagation",
  "Data Quality\nrules · suites · incidents",
], C.l3b));
children.push(boxes([
  "Policies → Rules\nconformity · violations",
  "Regulations &\nCompliance",
  "Certification\nlifecycle",
  "Stewardship\nworkflows",
], C.l3b));
children.push(arrow());

// Experience
children.push(band("⑤", "EXPERIENCE & ACCESS LAYER", "Governs who may see and act, scoped by domain", C.l4));
children.push(boxes([
  "RBAC roles\n(Steward scoped by domain)",
  "Role-based navigation\n& home widgets",
  "Search · Catalog ·\nLineage UI",
], C.l4b));
children.push(spacer(80));

// Audit spanning
children.push(band("⑥", "AUDIT LAYER", "Tamper-evident activity history spanning assets · domains · data products · policies · terms", C.l5));
children.push(spacer(40));
children.push(p([t("The audit layer is cross-cutting: ", { bold: true }),
  t("it records every consequential action in the catalog, governance, and access layers — with actor, timestamp, and before/after detail.", { color: C.sub })]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 3. Layer responsibilities table
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t("3. Layer Responsibilities")] }),
  spacer(20),
  dataTable(
    ["Layer", "Responsibility", "Key prototype components"],
    [
      ["① Connectivity", "Read metadata, lineage, profiles, and usage from sources on a schedule or on demand — governing data in place without moving it. Sync classifications bi-directionally with conflict detection.", "Connectors: Snowflake, Databricks, BigQuery, dbt, Oracle, PostgreSQL, MySQL, S3, Azure Blob; sync status, name-mapping, conflict rules"],
      ["② Metadata Catalog", "The central, searchable inventory of assets and everything known about them. The single source the governance layer reads from and writes to.", "Asset hierarchy, lineage graph, quality results, classifications, certification status, glossary"],
      ["③ Governance & Policy", "Apply structure, control, and trust over catalogued assets: organize and own, classify, measure quality, evaluate policy, certify, and drive stewardship work.", "Domains, Data Products, Tags + propagation, Quality rules/suites/incidents, Policies/Rules, Regulations, Certifications, Stewardship tasks"],
      ["④ Experience & Access", "Govern who may see and act on assets, scoped by domain, and present the right surfaces per role.", "RBAC role profiles, role-based navigation and home widgets, Search/Catalog/Lineage UIs"],
      ["⑤ Audit", "A tamper-evident activity history of every consequential change, with actor, timestamp, and before/after detail.", "Audit logs and activity timelines on assets, domains, products, policies, terms, certifications, tags"],
    ],
    [1700, 3830, 3830],
  ),
  new Paragraph({ children: [new PageBreak()] }),
);

// 4. Data flow (DIAGRAM)
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t("4. Functional Data Flow")] }),
  p("How a single asset moves from raw to trusted and consumable. Each transition below is recorded in the audit layer.", { run: { color: C.sub } }),
  spacer(40),
);
children.push(flowBox("Source asset", "a table or storage object in a connected system", C.l1b));
children.push(arrow("connector scan"));
children.push(flowBox("Catalogued & profiled", "added to the inventory with schema, profile and metadata", C.l2b));
children.push(arrow("tags synced / propagated along lineage & hierarchy"));
children.push(flowBox("Classified", "carries sensitivity / regulatory / business tags", C.l3b));
children.push(arrow("classifications determine which policies & regulations apply"));
children.push(boxes([
  "Policies evaluated (in scope)\n→ conformity score + violations",
  "Quality suites run\n→ quality score + incidents",
], C.l3b));
children.push(arrow("documentation · classification · lineage · quality · ownership"));
children.push(flowBox("Certification gate — are the criteria met?", "glossary terms & ownership also feed this decision", C.hdrb));
children.push(spacer(20));
children.push(boxes([
  "YES  →  Certified ✓ (trusted)",
  "NO  →  Stewardship task raised → steward resolves → re-evaluated",
], C.greenb));
children.push(arrow());
children.push(flowBox("Bundled into a Data Product", "with defined input & output ports", C.l4b));
children.push(arrow());
children.push(flowBox("Consumed", "via the data product's output ports, by downstream products and users", C.l4b));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 5. Object relationship model
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t("5. Object Relationship Model")] }),
  p("The governance objects the layers operate on, and how they relate to one another.", { run: { color: C.sub } }),
  spacer(20),
  dataTable(
    ["Object", "Relationship", "Related object(s)"],
    [
      ["Domain", "organizes / contains", "Assets, Data Products"],
      ["Data Product", "bundles (input/output ports); consumes & provides to other products", "Assets, Data Products"],
      ["Asset", "has lineage and physical-hierarchy links to", "Assets (db→schema→table/view; bucket→object)"],
      ["Asset", "is classified by", "Tags (which propagate along lineage / hierarchy)"],
      ["Policy", "is enforced by; evaluated against (scope); maps to", "Rules, Assets, Regulations"],
      ["Asset", "is measured by", "Quality rules → Incidents"],
      ["Asset / Glossary term", "is certified by", "Certification (lifecycle + expiry)"],
      ["Glossary term", "defines / is linked to", "Assets"],
      ["Stewardship task", "is scoped to", "a Domain"],
      ["RBAC role (Steward)", "is scoped by", "a Domain"],
      ["Audit log", "records changes to", "Assets, Policies, Terms, Domains, Products"],
    ],
    [2200, 3760, 3400],
  ),
  spacer(80),
);

// 6. Principles
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t("6. Architectural Principles")] }),
  p("As evidenced by the prototype:", { run: { color: C.sub } }),
);
[
  ["Govern in place.", " Connectors read metadata, lineage, profiles, and usage — the platform never moves or copies the underlying data."],
  ["Catalog as the single source of truth.", " Every governance function reads from and writes back to one searchable inventory; nothing operates on a private copy."],
  ["Classification drives control.", " Tags — synced, manual, or propagated along lineage/hierarchy — bind assets to the policies and regulations that apply to them."],
  ["Computed, not asserted, compliance.", " Conformity scores, violations, and quality scores are evaluated against real catalogued state and roll up into regulation-level posture."],
  ["Trust is gated and expiring.", " Certification is granted only when documentation, classification, lineage, quality, and ownership criteria are met, and it must be renewed."],
  ["Access scoped by business structure.", " RBAC governs who may act, and the steward role is bound to a domain — the same unit that owns the data."],
  ["Everything is auditable.", " Each consequential change across assets, domains, products, policies, and terms is recorded with actor, time, and before/after detail."],
].forEach(([h, b]) => children.push(bullet([t(h, { bold: true }), t(b)])));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 7. Assumptions & Gaps
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t("7. Assumptions & Gaps")] }),
  p([t("The following are ", {}), t("not specified in the prototype source", { bold: true }),
    t(" and are presented here as the conceptual model only:")]),
);
[
  ["Deployment topology", "SaaS vs. self-hosted, region, multi-tenancy, scaling, and HA are undefined."],
  ["Physical storage", "Where catalog metadata, audit logs, and indexes physically persist (the prototype uses in-memory mock data)."],
  ["Security architecture", "Authentication/SSO, network boundaries, encryption at rest/in transit, secrets handling, and the connector credential/permission model are not modeled."],
  ["Audit immutability", "Described as “tamper-evident,” but the backing store and retention guarantees are unspecified."],
  ["Ingestion engine", "Scheduling, orchestration, throughput, and failure/retry semantics behind the connectors are conceptual."],
].forEach(([h, b]) => children.push(bullet([t(h + " — ", { bold: true }), t(b)])));

// ---- document ----
const doc = new Document({
  creator: "Solix EDG",
  title: "Solix EDG — Architecture Overview",
  styles: {
    default: { document: { run: { font: "Arial", size: 21, color: C.ink } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: C.hdr, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.line, space: 6 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: C.ink, font: "Arial" },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 460, hanging: 260 } } } }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 6 } },
        children: [
          t("Solix EDG — Architecture Overview", { size: 15, color: C.sub }),
          t("          Page ", { size: 15, color: C.sub }),
          new TextRun({ children: [PageNumber.CURRENT], size: 15, color: C.sub }),
        ],
      })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("Solix_EDG_Architecture_Overview.docx", buf);
  console.log("WROTE Solix_EDG_Architecture_Overview.docx", buf.length, "bytes");
});
