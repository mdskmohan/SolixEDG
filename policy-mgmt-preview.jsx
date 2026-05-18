import { useState } from "react";

const T = {
  bg: "#09090b", bgSurface: "#111115", bgElevated: "#18181d", bgHover: "#1f1f26",
  border: "#27272e", borderLight: "#38383f",
  text: "#f4f4f5", textSub: "#a1a1aa", textMuted: "#52525b",
  accent: "#ee2424", accentDim: "rgba(238,36,36,0.15)",
  blue: "#0284c7", blueDim: "rgba(2,132,199,0.10)",
  amber: "#d97706", amberDim: "rgba(217,119,6,0.10)",
  rose: "#e11d48", roseDim: "rgba(225,29,72,0.10)",
  violet: "#7c3aed", violetDim: "rgba(124,58,237,0.10)",
  green: "#16a34a", greenDim: "rgba(22,163,74,0.10)",
  cyan: "#0891b2",
};

const CAT_COLORS = {
  Data: { fg: T.blue, bg: T.blueDim },
  Security: { fg: T.rose, bg: T.roseDim },
  Retention: { fg: T.amber, bg: T.amberDim },
  Access: { fg: T.violet, bg: T.violetDim },
  Quality: { fg: T.green, bg: T.greenDim },
};

const SEV_COLORS = {
  Critical: { fg: T.rose, bg: T.roseDim },
  High: { fg: T.accent, bg: T.accentDim },
  Medium: { fg: T.amber, bg: T.amberDim },
  Low: { fg: T.blue, bg: T.blueDim },
};

const SRC_COLORS = {
  Snowflake: { fg: T.blue, bg: T.blueDim },
  MySQL: { fg: T.amber, bg: T.amberDim },
  Postgres: { fg: T.cyan, bg: "rgba(8,145,178,0.10)" },
  S3: { fg: T.amber, bg: T.amberDim },
  "Azure Blob": { fg: T.violet, bg: T.violetDim },
  Databricks: { fg: T.rose, bg: T.roseDim },
};

// ── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ label, fg, bg, size = "sm" }) {
  const pad = size === "xs" ? "1px 6px" : "2px 8px";
  const fs = size === "xs" ? 10 : 11;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: pad,
      background: bg, color: fg, borderRadius: 4, fontSize: fs,
      fontWeight: 600, whiteSpace: "nowrap", letterSpacing: "0.02em",
    }}>{label}</span>
  );
}

// ── Mini progress bar ─────────────────────────────────────────────────────────
function CompBar({ pct }) {
  const color = pct >= 90 ? T.green : pct >= 70 ? T.amber : T.rose;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 5, background: T.border, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, color: T.textSub, minWidth: 28 }}>{pct}%</span>
    </div>
  );
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const POLICIES = [
  { id: 1, name: "PII Data Governance", cat: "Data", sev: "Critical", scope: 312, violations: 7, compliance: 78, lastEval: "2 hrs ago", status: "Active", owner: "J. Park" },
  { id: 2, name: "PHI Encryption Enforcement", cat: "Security", sev: "Critical", scope: 88, violations: 3, compliance: 97, lastEval: "4 hrs ago", status: "Active", owner: "M. Chen" },
  { id: 3, name: "GDPR Retention Sweep", cat: "Retention", sev: "High", scope: 540, violations: 14, compliance: 82, lastEval: "1 hr ago", status: "Active", owner: "S. Torres" },
  { id: 4, name: "Snowflake Access Review", cat: "Access", sev: "High", scope: 197, violations: 6, compliance: 89, lastEval: "6 hrs ago", status: "Active", owner: "A. Rowe" },
  { id: 5, name: "Tier 1 Metadata Completeness", cat: "Quality", sev: "Medium", scope: 64, violations: 5, compliance: 92, lastEval: "30 min ago", status: "Active", owner: "D. Kim" },
  { id: 6, name: "S3 Bucket Exposure Audit", cat: "Security", sev: "High", scope: 230, violations: 2, compliance: 94, lastEval: "3 hrs ago", status: "Active", owner: "L. Patel" },
  { id: 7, name: "Operational Data Retention", cat: "Retention", sev: "Medium", scope: 410, violations: 1, compliance: 98, lastEval: "8 hrs ago", status: "Paused", owner: "T. Wright" },
];

const VIOLATIONS = [
  {
    id: 1, asset: "customer_pii_raw", source: "Snowflake", assetType: "Table", policy: "PII Data Governance",
    rule: "PII classification + masking not applied in PROD", sev: "Critical", domain: "Customer", owner: "J. Park",
    age: "3d", status: "Open",
    fields: [
      { name: "classification", value: "PII", sourceLabel: "Snowflake tag: PII_EMAIL" },
      { name: "maskingStatus", value: "Not Applied", sourceLabel: "Snowflake DDP: no active masking policy" },
      { name: "environment", value: "PROD", sourceLabel: "Connector: schema prefix PROD_" },
    ],
    notifications: [
      { type: "Email", target: "j.park@corp.com", status: "Delivered", time: "3d ago" },
      { type: "Slack", target: "#data-governance", status: "Delivered", time: "3d ago" },
      { type: "Jira", target: "EDG-612", status: "Open", time: "3d ago" },
    ],
  },
  {
    id: 2, asset: "orders_2022_archive", source: "MySQL", assetType: "Table", policy: "GDPR Retention Sweep",
    rule: "PROD tier 1 table with retention period not set", sev: "High", domain: "Finance", owner: "S. Torres",
    age: "7d", status: "Open",
    fields: [
      { name: "retentionPeriod", value: "Not Set", sourceLabel: "Manual: not configured in platform" },
      { name: "tier", value: "1", sourceLabel: "Connector: table tagged tier:1" },
      { name: "environment", value: "PROD", sourceLabel: "Connector: schema prefix prod_" },
    ],
    notifications: [
      { type: "Email", target: "s.torres@corp.com", status: "Delivered", time: "7d ago" },
      { type: "Jira", target: "EDG-601", status: "Open", time: "7d ago" },
    ],
  },
  {
    id: 3, asset: "raw-data-uploads", source: "S3", assetType: "Bucket", policy: "S3 Bucket Exposure Audit",
    rule: "S3 bucket with PII classification and public exposure", sev: "Critical", domain: "Marketing", owner: "L. Patel",
    age: "1d", status: "Acknowledged",
    fields: [
      { name: "exposure", value: "Public", sourceLabel: "S3 API: PublicAccessBlock=false" },
      { name: "classification", value: "PII", sourceLabel: "Platform classifier: filename pattern match" },
      { name: "encryptionStatus", value: "Disabled", sourceLabel: "S3 API: SSE config not found" },
    ],
    notifications: [
      { type: "Email", target: "l.patel@corp.com", status: "Delivered", time: "1d ago" },
      { type: "Slack", target: "#infosec-alerts", status: "Delivered", time: "1d ago" },
    ],
  },
  {
    id: 4, asset: "hr_employee_records", source: "Postgres", assetType: "Table", policy: "PII Data Governance",
    rule: "PII asset with no steward set in PROD", sev: "High", domain: "HR", owner: "Unassigned",
    age: "12d", status: "Open",
    fields: [
      { name: "steward", value: "Not Set", sourceLabel: "Platform: steward field empty" },
      { name: "classification", value: "PII", sourceLabel: "Platform classifier: column name pattern" },
      { name: "environment", value: "PROD", sourceLabel: "Connector: pg_stat: schema = public" },
    ],
    notifications: [
      { type: "Email", target: "data-ops@corp.com", status: "Delivered", time: "12d ago" },
    ],
  },
  {
    id: 5, asset: "payments_fact_v2", source: "Snowflake", assetType: "Table", policy: "Snowflake Access Review",
    rule: "PCI table with row security disabled", sev: "Critical", domain: "Finance", owner: "A. Rowe",
    age: "5d", status: "In Progress",
    fields: [
      { name: "classification", value: "PCI", sourceLabel: "Snowflake tag: PCI_CARD" },
      { name: "rowSecurity", value: "Disabled", sourceLabel: "Snowflake: no row access policy found" },
      { name: "roleCount", value: "31", sourceLabel: "SHOW GRANTS: 31 roles with SELECT" },
    ],
    notifications: [
      { type: "Email", target: "a.rowe@corp.com", status: "Delivered", time: "5d ago" },
      { type: "Slack", target: "#data-governance", status: "Delivered", time: "5d ago" },
      { type: "Jira", target: "EDG-608", status: "In Progress", time: "4d ago" },
    ],
  },
  {
    id: 6, asset: "backup-container-prod", source: "Azure Blob", assetType: "Container", policy: "Tier 1 Metadata Completeness",
    rule: "Tier 1 asset with no business term and description empty", sev: "Medium", domain: "Ops", owner: "D. Kim",
    age: "18d", status: "Open",
    fields: [
      { name: "hasDescription", value: "false", sourceLabel: "Platform: description field empty" },
      { name: "hasBusinessTerm", value: "false", sourceLabel: "Platform: no glossary term linked" },
      { name: "tier", value: "1", sourceLabel: "Connector: Azure tag tier=1" },
    ],
    notifications: [
      { type: "Email", target: "d.kim@corp.com", status: "Delivered", time: "18d ago" },
    ],
  },
];

const WIZARD_STEPS = ["Policy Info", "Scope", "Rule Builder", "Evaluation", "Actions", "Review"];

const FIELD_GROUPS = {
  "Data Fields": ["Owner", "Steward", "Certification", "Quality Score", "Tier", "Domain", "Usage", "Environment"],
  "Security Fields": ["Classification", "Sensitivity", "Exposure", "Encryption Status", "Masking Status", "Row Security"],
  "Retention Fields": ["Retention Period", "Retention Class", "Last Accessed Days", "Legal Hold"],
  "Access Fields": ["Access Level", "Privileged Access", "Guest Access", "Role Count", "Cross-Domain Access", "Last Access Review Days"],
  "Quality Fields": ["Has Description", "Tag Coverage", "Metadata Score", "Last Reviewed Days", "Has Business Term"],
};

const FIELD_WARNINGS = {
  "Masking Status": "Only evaluated on Snowflake, Databricks, and Oracle table assets",
  "Exposure": "Only evaluated on S3 and Azure Blob assets",
  "Row Security": "Only evaluated on Snowflake, Databricks, Postgres, and Oracle table assets",
};

const OPERATORS = ["is", "is not", "greater than", "less than", "contains", "is empty", "is not empty"];

const SCOPE_SAMPLE_ASSETS = [
  { name: "customer_pii_raw", type: "Table", src: "Snowflake" },
  { name: "hr_employee_records", type: "Table", src: "Postgres" },
  { name: "payments_fact_v2", type: "Table", src: "Snowflake" },
  { name: "orders_master_v3", type: "Table", src: "MySQL" },
];

// ── Shared button ─────────────────────────────────────────────────────────────
function Btn({ children, accent, ghost, small, onClick, style = {} }) {
  const [hov, setHov] = useState(false);
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: "none",
    borderRadius: 6, fontWeight: 600, fontSize: small ? 12 : 13, transition: "background 0.15s",
    padding: small ? "5px 12px" : "7px 16px",
    ...style,
  };
  if (accent) return (
    <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
      style={{ ...base, background: hov ? "#c81e1e" : T.accent, color: "#fff" }}>{children}</button>
  );
  if (ghost) return (
    <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
      style={{ ...base, background: hov ? T.bgHover : "transparent", color: T.textSub, border: `1px solid ${T.border}` }}>{children}</button>
  );
  return (
    <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
      style={{ ...base, background: hov ? T.bgHover : T.bgElevated, color: T.text, border: `1px solid ${T.border}` }}>{children}</button>
  );
}

// ── Policy List Screen ────────────────────────────────────────────────────────
function PolicyListScreen({ onNavigate }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [hovRow, setHovRow] = useState(null);

  const cats = ["All", "Data", "Security", "Retention", "Access", "Quality"];
  const filtered = POLICIES.filter(p =>
    (catFilter === "All" || p.cat === catFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalViolations = POLICIES.reduce((s, p) => s + p.violations, 0);
  const avgCompliance = Math.round(POLICIES.reduce((s, p) => s + p.compliance, 0) / POLICIES.length);
  const criticalCount = POLICIES.filter(p => p.sev === "Critical").length;
  const totalScope = POLICIES.reduce((s, p) => s + p.scope, 0);

  const thStyle = {
    padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600,
    color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em",
    borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap",
  };

  return (
    <div>
      {/* Posture bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Assets Monitored", value: totalScope.toLocaleString(), fg: T.blue, bg: T.blueDim },
          { label: "Total Violations", value: totalViolations, fg: T.accent, bg: T.accentDim },
          { label: "Avg Compliance", value: `${avgCompliance}%`, fg: T.green, bg: T.greenDim },
          { label: "Critical Policies", value: criticalCount, fg: T.rose, bg: T.roseDim },
        ].map(c => (
          <div key={c.label} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
            background: c.bg, border: `1px solid ${c.fg}22`, borderRadius: 8,
          }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: c.fg }}>{c.value}</span>
            <span style={{ fontSize: 12, color: T.textSub }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search policies…"
          style={{
            background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 6,
            color: T.text, fontSize: 13, padding: "7px 12px", outline: "none", width: 220,
          }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${catFilter === c ? (CAT_COLORS[c]?.fg || T.accent) : T.border}`,
              background: catFilter === c ? (CAT_COLORS[c]?.bg || T.accentDim) : "transparent",
              color: catFilter === c ? (CAT_COLORS[c]?.fg || T.accent) : T.textSub,
            }}>{c}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Btn accent onClick={() => onNavigate("wizard")}>+ New Policy</Btn>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: T.bgElevated }}>
              <th style={thStyle}>Policy Name</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Severity</th>
              <th style={thStyle}>Assets in Scope</th>
              <th style={thStyle}>Violations</th>
              <th style={thStyle}>Compliance</th>
              <th style={thStyle}>Last Evaluated</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const sev = SEV_COLORS[p.sev] || SEV_COLORS.Medium;
              const cat = CAT_COLORS[p.cat] || CAT_COLORS.Data;
              const isHov = hovRow === p.id;
              return (
                <tr key={p.id}
                  onMouseEnter={() => setHovRow(p.id)}
                  onMouseLeave={() => setHovRow(null)}
                  style={{
                    borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none",
                    background: isHov ? T.bgHover : "transparent",
                    cursor: "pointer",
                    transition: "background 0.12s",
                  }}>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cat.fg, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "11px 14px" }}><Chip label={p.cat} fg={cat.fg} bg={cat.bg} /></td>
                  <td style={{ padding: "11px 14px" }}><Chip label={p.sev} fg={sev.fg} bg={sev.bg} /></td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: T.textSub }}>{p.scope.toLocaleString()}</td>
                  <td style={{ padding: "11px 14px" }}>
                    {p.violations > 0
                      ? <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          minWidth: 22, height: 20, padding: "0 6px", borderRadius: 99,
                          background: T.accentDim, color: T.accent, fontSize: 11, fontWeight: 700,
                        }}>{p.violations}</span>
                      : <span style={{ fontSize: 12, color: T.green }}>Clean</span>
                    }
                  </td>
                  <td style={{ padding: "11px 14px" }}><CompBar pct={p.compliance} /></td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: T.textSub }}>{p.lastEval}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <Chip
                      label={p.status}
                      fg={p.status === "Active" ? T.green : T.textMuted}
                      bg={p.status === "Active" ? T.greenDim : T.bgHover}
                    />
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: T.textSub }}>{p.owner}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Violations Dashboard Screen ───────────────────────────────────────────────
function ViolationsDashboardScreen() {
  const [sevFilter, setSevFilter] = useState("All");
  const [hovRow, setHovRow] = useState(null);
  const [drawer, setDrawer] = useState(null);

  const sevFilters = ["All", "Critical", "High", "Medium", "Low"];
  const filtered = VIOLATIONS.filter(v => sevFilter === "All" || v.sev === sevFilter);

  const thStyle = {
    padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600,
    color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em",
    borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap",
  };

  const notifIcon = { Email: "✉", Slack: "#", Jira: "J" };
  const notifStatusColor = (s) => s === "Delivered" ? T.green : s === "Open" ? T.amber : T.blue;

  const drawerWidth = 380;

  return (
    <div style={{ position: "relative" }}>
      {/* Metric cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total Open", value: 38, icon: "⚠", fg: T.accent, bg: T.accentDim },
          { label: "Critical", value: 9, icon: "🔴", fg: T.rose, bg: T.roseDim },
          { label: "Assets at Risk", value: 24, icon: "⛔", fg: T.amber, bg: T.amberDim },
          { label: "Avg Resolution", value: "4.2d", icon: "⏱", fg: T.blue, bg: T.blueDim },
        ].map(c => (
          <div key={c.label} style={{
            flex: "1 1 160px", padding: "16px 20px", background: c.bg,
            border: `1px solid ${c.fg}22`, borderRadius: 10,
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            <span style={{ fontSize: 11, color: T.textSub, textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.label}</span>
            <span style={{ fontSize: 28, fontWeight: 700, color: c.fg }}>{c.value}</span>
          </div>
        ))}
      </div>

      {/* Severity filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: T.textMuted, marginRight: 4 }}>Severity:</span>
        {sevFilters.map(s => {
          const col = SEV_COLORS[s] || { fg: T.textSub, bg: T.bgHover };
          const active = sevFilter === s;
          return (
            <button key={s} onClick={() => setSevFilter(s)} style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${active ? col.fg : T.border}`,
              background: active ? col.bg : "transparent",
              color: active ? col.fg : T.textSub,
            }}>{s}</button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{
        background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden",
        transition: "margin-right 0.25s",
        marginRight: drawer ? drawerWidth + 12 : 0,
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: T.bgElevated }}>
              {["Asset", "Source", "Policy", "Rule Fired", "Severity", "Domain", "Owner", "Age", "Status"].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => {
              const sev = SEV_COLORS[v.sev] || SEV_COLORS.Medium;
              const src = SRC_COLORS[v.source] || { fg: T.textSub, bg: T.bgHover };
              const isHov = hovRow === v.id;
              const statusColor = v.status === "Open" ? T.accent : v.status === "Acknowledged" ? T.amber : v.status === "In Progress" ? T.blue : T.green;
              const statusBg = v.status === "Open" ? T.accentDim : v.status === "Acknowledged" ? T.amberDim : v.status === "In Progress" ? T.blueDim : T.greenDim;
              return (
                <tr key={v.id}
                  onMouseEnter={() => setHovRow(v.id)}
                  onMouseLeave={() => setHovRow(null)}
                  onClick={() => setDrawer(drawer?.id === v.id ? null : v)}
                  style={{
                    borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none",
                    background: drawer?.id === v.id ? T.bgHover : isHov ? `${T.bgHover}88` : "transparent",
                    cursor: "pointer", transition: "background 0.12s",
                  }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{v.asset}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{v.assetType}</div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px" }}><Chip label={v.source} fg={src.fg} bg={src.bg} size="xs" /></td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: T.textSub, maxWidth: 160 }}>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{v.policy}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.textMuted, maxWidth: 200 }}>
                    <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.rule}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}><Chip label={v.sev} fg={sev.fg} bg={sev.bg} size="xs" /></td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: T.textSub }}>{v.domain}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: T.textSub }}>{v.owner}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: T.textMuted }}>{v.age}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Chip label={v.status} fg={statusColor} bg={statusBg} size="xs" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Violation Drawer */}
      {drawer && (
        <div style={{
          position: "absolute", top: 0, right: 0, width: drawerWidth,
          background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: 20, display: "flex", flexDirection: "column", gap: 16,
          boxShadow: `-8px 0 40px rgba(0,0,0,0.5)`,
          maxHeight: "calc(100vh - 200px)", overflowY: "auto",
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>{drawer.asset}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Chip label={drawer.source} fg={SRC_COLORS[drawer.source]?.fg || T.textSub} bg={SRC_COLORS[drawer.source]?.bg || T.bgHover} size="xs" />
                <Chip label={drawer.assetType} fg={T.textMuted} bg={T.bgHover} size="xs" />
                <Chip label={drawer.sev} fg={SEV_COLORS[drawer.sev]?.fg} bg={SEV_COLORS[drawer.sev]?.bg} size="xs" />
              </div>
            </div>
            <button onClick={() => setDrawer(null)} style={{
              background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 16,
            }}>✕</button>
          </div>

          {/* Policy + Rule */}
          <div style={{ background: T.bgElevated, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Policy Violated</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>{drawer.policy}</div>
            <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
              <span style={{ color: T.rose, fontWeight: 600 }}>Rule: </span>{drawer.rule}
            </div>
          </div>

          {/* Fields that triggered */}
          <div>
            <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Fields That Triggered This Violation</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {drawer.fields.map((f, i) => (
                <div key={i} style={{
                  background: T.bgElevated, borderRadius: 6, padding: "8px 10px",
                  borderLeft: `3px solid ${T.accent}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: "monospace" }}>{f.name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                      background: T.accentDim, color: T.accent,
                    }}>{f.value}</span>
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted }}>Source: {f.sourceLabel}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div>
            <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Notifications Sent</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {drawer.notifications.map((n, i) => {
                const sc = notifStatusColor(n.status);
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "6px 10px",
                    background: T.bgElevated, borderRadius: 6, fontSize: 12,
                  }}>
                    <span style={{ fontSize: 13 }}>{notifIcon[n.type]}</span>
                    <span style={{ color: T.textSub, flex: 1 }}>{n.target}</span>
                    <span style={{ fontSize: 10, color: T.textMuted }}>{n.time}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: sc }}>{n.status}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Actions</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <Btn ghost small>Assign Remediation</Btn>
              <Btn ghost small>Create Jira</Btn>
              <Btn ghost small>Snooze 24h</Btn>
              <Btn accent small>Mark Resolved</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create Policy Wizard Screen ────────────────────────────────────────────────
function CreatePolicyWizardScreen() {
  const [step, setStep] = useState(2); // 0-indexed, default Rule Builder (index 2)
  const [conditions, setConditions] = useState([
    { field: "Classification", op: "is", val: "PII", warning: null },
    { field: "Masking Status", op: "is", val: "Not Applied", warning: FIELD_WARNINGS["Masking Status"] },
    { field: "Environment", op: "is", val: "PROD", warning: null },
  ]);
  const [logic, setLogic] = useState("AND");
  const [severity, setSeverity] = useState("Critical");
  const [scopeFilters, setScopeFilters] = useState({
    source: "Snowflake", assetType: "Table", domain: "Customer", environment: "PROD",
    classification: "PII", sensitivity: "High",
  });

  const addCondition = () => setConditions(c => [...c, { field: "Classification", op: "is", val: "", warning: null }]);
  const removeCondition = (i) => setConditions(c => c.filter((_, idx) => idx !== i));
  const updateConditionField = (i, field) => setConditions(c => c.map((cond, idx) =>
    idx === i ? { ...cond, field, warning: FIELD_WARNINGS[field] || null } : cond
  ));
  const updateConditionOp = (i, op) => setConditions(c => c.map((cond, idx) => idx === i ? { ...cond, op } : cond));
  const updateConditionVal = (i, val) => setConditions(c => c.map((cond, idx) => idx === i ? { ...cond, val } : cond));

  const allFields = Object.values(FIELD_GROUPS).flat();

  const humanSummary = conditions.length > 0
    ? `Flag assets where ${conditions.map(c => `${c.field.toLowerCase()} ${c.op} "${c.val}"`).join(` ${logic.toLowerCase()} `)}. Create a ${severity} severity violation.`
    : "Add conditions above to generate a rule summary.";

  const scopeKeys = Object.keys(scopeFilters);
  const scopeLabels = { source: "Source System", assetType: "Asset Type", domain: "Domain", environment: "Environment", classification: "Classification", sensitivity: "Sensitivity" };
  const scopeOptions = {
    source: ["Snowflake", "Databricks", "Postgres", "MySQL", "Oracle", "S3", "Azure Blob"],
    assetType: ["Table", "View", "Schema", "Database", "Bucket", "Container", "Pipeline"],
    domain: ["Customer", "Finance", "HR", "Marketing", "Ops", "Legal"],
    environment: ["PROD", "DEV", "TEST"],
    classification: ["PII", "PHI", "PCI", "Confidential", "Internal", "Public"],
    sensitivity: ["Low", "Medium", "High", "Critical"],
  };

  const inputStyle = {
    background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 6,
    color: T.text, fontSize: 13, padding: "6px 10px", outline: "none",
  };
  const selectStyle = { ...inputStyle, cursor: "pointer", minWidth: 140 };

  return (
    <div style={{ display: "flex", gap: 0, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 200, borderRight: `1px solid ${T.border}`, padding: "20px 0", flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 16px 12px" }}>Wizard Steps</div>
        {WIZARD_STEPS.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <button key={s} onClick={() => setStep(i)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px", background: active ? T.accentDim : "transparent",
              border: "none", cursor: "pointer", borderLeft: active ? `3px solid ${T.accent}` : "3px solid transparent",
              textAlign: "left",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0, fontSize: 11,
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
                background: active ? T.accent : done ? T.green : T.bgHover,
                color: active || done ? "#fff" : T.textMuted,
              }}>{done ? "✓" : i + 1}</div>
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? T.text : T.textSub }}>{s}</span>
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 24, minHeight: 500 }}>

        {/* Step 1: Scope */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>Define Scope</div>
            <div style={{ fontSize: 13, color: T.textSub, marginBottom: 20 }}>Select which assets this policy will monitor.</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {scopeKeys.map(k => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <label style={{ fontSize: 13, color: T.textSub, width: 140 }}>{scopeLabels[k]}</label>
                  <select value={scopeFilters[k]}
                    onChange={e => setScopeFilters(f => ({ ...f, [k]: e.target.value }))}
                    style={selectStyle}>
                    <option value="">Any</option>
                    {scopeOptions[k].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Live preview */}
            <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: T.green }}>147 assets currently match this scope</span>
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sample assets</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {SCOPE_SAMPLE_ASSETS.map(a => (
                  <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: T.bgSurface, borderRadius: 6 }}>
                    <span style={{ fontSize: 13, fontFamily: "monospace", color: T.text, flex: 1 }}>{a.name}</span>
                    <Chip label={a.type} fg={T.blue} bg={T.blueDim} size="xs" />
                    <Chip label={a.src} fg={SRC_COLORS[a.src]?.fg || T.textSub} bg={SRC_COLORS[a.src]?.bg || T.bgHover} size="xs" />
                  </div>
                ))}
                <div style={{ fontSize: 11, color: T.textMuted, paddingLeft: 10 }}>+ 143 more assets…</div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Rule Builder */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>Rule Builder</div>
            <div style={{ fontSize: 13, color: T.textSub, marginBottom: 20 }}>Define conditions that will trigger a violation when matched.</div>

            {/* IF section */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", width: 24 }}>IF</div>
                <div style={{ display: "flex", gap: 4, background: T.bgElevated, borderRadius: 6, padding: 2 }}>
                  {["AND", "OR"].map(l => (
                    <button key={l} onClick={() => setLogic(l)} style={{
                      padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      background: logic === l ? T.accent : "transparent",
                      color: logic === l ? "#fff" : T.textSub, border: "none",
                    }}>{l}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {conditions.map((cond, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <select value={cond.field} onChange={e => updateConditionField(i, e.target.value)} style={selectStyle}>
                        {Object.entries(FIELD_GROUPS).map(([grp, fields]) => (
                          <optgroup key={grp} label={grp}>
                            {fields.map(f => <option key={f} value={f}>{f}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      <select value={cond.op} onChange={e => updateConditionOp(i, e.target.value)} style={{ ...selectStyle, minWidth: 110 }}>
                        {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <input value={cond.val} onChange={e => updateConditionVal(i, e.target.value)}
                        placeholder="value…"
                        style={{ ...inputStyle, width: 130 }} />
                      <button onClick={() => removeCondition(i)} style={{
                        background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14, padding: "4px 6px",
                      }}>✕</button>
                    </div>
                    {cond.warning && (
                      <div style={{
                        display: "flex", alignItems: "flex-start", gap: 6, marginTop: 4, marginLeft: 4,
                        padding: "5px 10px", background: T.amberDim, border: `1px solid ${T.amber}33`, borderRadius: 5,
                      }}>
                        <span style={{ color: T.amber, fontSize: 12 }}>⚠</span>
                        <span style={{ fontSize: 11, color: T.amber }}>{cond.warning}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={addCondition} style={{
                marginTop: 10, background: "transparent", border: `1px dashed ${T.borderLight}`,
                borderRadius: 6, color: T.textSub, fontSize: 12, padding: "6px 14px", cursor: "pointer", width: "100%",
              }}>+ Add Condition</button>
            </div>

            {/* THEN section */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", width: 40 }}>THEN</div>
              <span style={{ fontSize: 13, color: T.textSub }}>Create violation with severity</span>
              <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ ...selectStyle, minWidth: 100 }}>
                {["Critical", "High", "Medium", "Low"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Summary */}
            <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Auto-generated Rule Summary</div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, fontStyle: "italic" }}>{humanSummary}</div>
            </div>
          </div>
        )}

        {/* Step 4: Actions */}
        {step === 4 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>Actions & Notifications</div>
            <div style={{ fontSize: 13, color: T.textSub, marginBottom: 20 }}>Configure what happens when a violation is detected.</div>
            {[
              { label: "Email Asset Owner", sub: "Sends to the owner field of the asset", checked: true },
              { label: "Notify Steward", sub: "Sends to the steward field of the asset", checked: true },
              { label: "Slack Notification", sub: "Post to #data-governance", checked: false },
              { label: "Create Jira Ticket", sub: "Project: EDG — auto-assigns to domain lead", checked: true },
            ].map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
                background: T.bgElevated, borderRadius: 8, marginBottom: 8,
                border: `1px solid ${T.border}`,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4, border: `2px solid ${a.checked ? T.accent : T.borderLight}`,
                  background: a.checked ? T.accent : "transparent", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {a.checked && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{a.sub}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: "12px 14px", background: T.bgElevated, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 8 }}>SLA Timer (per severity)</div>
              {[["Critical", "24h"], ["High", "72h"], ["Medium", "7d"], ["Low", "30d"]].map(([s, d]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <Chip label={s} fg={SEV_COLORS[s]?.fg} bg={SEV_COLORS[s]?.bg} size="xs" />
                  <input defaultValue={d} style={{ ...inputStyle, width: 80 }} />
                  <span style={{ fontSize: 11, color: T.textMuted }}>before escalation</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Default / other steps placeholder */}
        {step !== 1 && step !== 2 && step !== 4 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
            <div style={{ fontSize: 32, opacity: 0.3 }}>📋</div>
            <div style={{ fontSize: 14, color: T.textSub }}>Configure {WIZARD_STEPS[step]}</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>Select a step from the sidebar to preview it.</div>
          </div>
        )}

        {/* Wizard nav buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <Btn ghost onClick={() => setStep(s => Math.max(0, s - 1))}>← Back</Btn>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn ghost>Save Draft</Btn>
            {step < WIZARD_STEPS.length - 1
              ? <Btn accent onClick={() => setStep(s => Math.min(WIZARD_STEPS.length - 1, s + 1))}>Next →</Btn>
              : <Btn accent>Activate Policy</Btn>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export default function PolicyMgmtPreview() {
  const [activeTab, setActiveTab] = useState("list");

  const TABS = [
    { id: "list", label: "Policy List" },
    { id: "wizard", label: "Create Policy Wizard" },
    { id: "violations", label: "Violations Dashboard" },
  ];

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: T.bg, minHeight: "100vh", color: T.text,
    }}>
      {/* Page header */}
      <div style={{
        borderBottom: `1px solid ${T.border}`, padding: "20px 32px 0",
        background: T.bgSurface,
      }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>Policy Management</h1>
          <p style={{ fontSize: 13, color: T.textSub, margin: "4px 0 0" }}>
            Continuously monitor governance compliance across all enterprise assets
          </p>
        </div>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: "10px 20px", background: "transparent", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? T.text : T.textSub,
                borderBottom: `2px solid ${active ? T.accent : "transparent"}`,
                marginBottom: -1, transition: "all 0.15s",
              }}>{tab.label}</button>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      <div style={{ padding: "24px 32px" }}>
        {activeTab === "list" && <PolicyListScreen onNavigate={setActiveTab} />}
        {activeTab === "wizard" && <CreatePolicyWizardScreen />}
        {activeTab === "violations" && <ViolationsDashboardScreen />}
      </div>
    </div>
  );
}
