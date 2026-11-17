// Access & Personas — the simplified model.
//   Role    = WHAT you may do   (levels per section + nothing else)
//   Grant   = WHO + role + WHERE (scope) + add-ons + optional expiry
//   Persona = WHAT you see      (navigation, landing page, home widgets, KPIs)
// A persona never grants access. Visible screens = persona screens ∩ what the role allows.

export const LEVELS = ["none", "view", "contribute", "manage"];
export const LEVEL_LABEL = { none: "None", view: "View", contribute: "Contribute", manage: "Manage" };
export const rank = (l) => LEVELS.indexOf(l || "none");

export const SECTIONS = [
  { key: "catalog",   label: "Catalog assets",
    allows: { view: "Browse · Search · Lineage", contribute: "Description · Tags · Owner · Status", manage: "Certify · Bulk edit" } },
  { key: "glossary",  label: "Glossary & Tags",
    allows: { view: "Browse terms & tags", contribute: "Draft terms · Apply tags", manage: "Approve terms · Create classifications" } },
  { key: "quality",   label: "Data Quality",
    allows: { view: "Results · Incidents", contribute: "Create tests · Acknowledge incidents", manage: "Test definitions · Resolve incidents · Alerts" } },
  { key: "policies",  label: "Policies",
    allows: { view: "Policies · Violations", contribute: "Request exemptions", manage: "Author · Approve · Scan" } },
  { key: "knowledge", label: "Knowledge",
    allows: { view: "Semantic models · Ontologies · Graphs", contribute: "Edit drafts · Mappings", manage: "Publish · Build graphs" } },
  { key: "domains",   label: "Domains & Data Products",
    allows: { view: "Browse", contribute: "Edit details · Add assets", manage: "Create · Delete · Set visibility" } },
  { key: "requests",  label: "Requests & approvals",
    allows: { view: "Own requests", contribute: "Raise requests", manage: "Approve · Reject · Reassign" } },
];

export const ADDONS = [
  { key: "connections", label: "Manage connections & ingestion", short: "Connections" },
  { key: "sensitive",   label: "View sensitive data",            short: "Sensitive data" },
];

const all = (lvl) => Object.fromEntries(SECTIONS.map((s) => [s.key, lvl]));

export const PRESET_ROLES = [
  { id: "viewer", name: "Viewer", preset: true, desc: "See and search everything in scope",
    levels: { ...all("view"), requests: "contribute" } },
  { id: "contributor", name: "Contributor", preset: true, desc: "Edit metadata and suggest changes",
    levels: { ...all("contribute"), policies: "view", domains: "view" } },
  { id: "steward", name: "Steward", preset: true, desc: "Approve, certify and govern in scope",
    levels: { ...all("manage"), policies: "view", knowledge: "contribute" } },
  { id: "admin", name: "Admin", preset: true, system: true, desc: "Everything, including Settings & Users",
    levels: all("manage"), settings: true },
];

export const SEED_CUSTOM_ROLES = [
  { id: "dq_lead", name: "Data Quality Lead", base: "contributor", desc: "Contributor who owns data quality",
    levels: { ...PRESET_ROLES[1].levels, quality: "manage", requests: "manage" } },
];

export const diffFromBase = (role, roles) => {
  const base = roles.find((r) => r.id === role.base);
  if (!base) return [];
  return SECTIONS.filter((s) => base.levels[s.key] !== role.levels[s.key]).map((s) => ({
    key: s.key, label: s.label, from: base.levels[s.key], to: role.levels[s.key],
  }));
};

export const DOMAINS = ["Commerce", "Finance", "Marketing", "Supply Chain", "HR"];

export const USERS = [
  { id: "alex.rivera", name: "Alex Rivera", avatar: "AR", teams: ["platform"] },
  { id: "maya.chen",   name: "Maya Chen",   avatar: "MC", teams: ["commerce_stewards"] },
  { id: "dev.patel",   name: "Dev Patel",   avatar: "DP", teams: ["finance_analytics"] },
  { id: "james.oh",    name: "James Oh",    avatar: "JO", teams: ["data_platform"] },
  { id: "sarah.kim",   name: "Sarah Kim",   avatar: "SK", teams: [] },
  { id: "priya.nair",  name: "Priya Nair",  avatar: "PN", teams: ["compliance"] },
];

export const TEAMS = [
  { id: "platform",          name: "Platform Admins" },
  { id: "commerce_stewards", name: "Commerce Stewards" },
  { id: "finance_analytics", name: "Finance Analytics" },
  { id: "data_platform",     name: "Data Platform" },
  { id: "compliance",        name: "Compliance" },
];

export const SEED_GRANTS = [
  { id: "g1", whoType: "team", who: "platform",          role: "admin",       scope: "all",                     addons: ["connections", "sensitive"], expires: "" },
  { id: "g2", whoType: "team", who: "commerce_stewards", role: "steward",     scope: ["Commerce"],              addons: ["sensitive"],                 expires: "" },
  { id: "g3", whoType: "team", who: "finance_analytics", role: "contributor", scope: ["Finance"],               addons: [],                            expires: "" },
  { id: "g4", whoType: "team", who: "data_platform",     role: "contributor", scope: "all",                     addons: ["connections"],               expires: "" },
  { id: "g5", whoType: "team", who: "compliance",        role: "steward",     scope: "all",                     addons: ["sensitive"],                 expires: "" },
  { id: "g6", whoType: "user", who: "dev.patel",         role: "dq_lead",     scope: ["Commerce"],              addons: [],                            expires: "2026-12-31" },
  { id: "g7", whoType: "org",  who: "everyone",          role: "viewer",      scope: "all",                     addons: [],                            expires: "", system: true },
];

export const ASSETS = [
  { id: "customers",        name: "customers",        domain: "Commerce",     owner: "dev.patel", sensitive: "PII" },
  { id: "orders",           name: "orders",           domain: "Commerce",     owner: "maya.chen", sensitive: null },
  { id: "finance_summary",  name: "finance_summary",  domain: "Finance",      owner: "dev.patel", sensitive: null },
  { id: "campaign_spend",   name: "campaign_spend",   domain: "Marketing",    owner: "",          sensitive: null },
  { id: "employee_records", name: "employee_records", domain: "HR",           owner: "priya.nair", sensitive: "PII" },
];

export const NAV_SCREENS = [
  { key: "home",           label: "Home",            locked: true },
  { key: "search",         label: "Search",          locked: true },
  { key: "stewardship",    label: "Inbox" },
  { key: "catalog",        label: "Data Catalog",    needs: "catalog" },
  { key: "glossary",       label: "Glossary",        needs: "glossary" },
  { key: "domains",        label: "Domains",         needs: "domains" },
  { key: "dataproducts",   label: "Data Products",   needs: "domains" },
  { key: "quality",        label: "Data Quality",    needs: "quality" },
  { key: "policymanager",  label: "Policies",        needs: "policies" },
  { key: "semanticlayer",  label: "Semantic Models", needs: "knowledge" },
  { key: "ontologies",     label: "Ontologies",      needs: "knowledge" },
  { key: "knowledgegraphs",label: "Knowledge Graphs",needs: "knowledge" },
  { key: "connections",    label: "Connections",     needsAddon: "connections" },
  { key: "settings",       label: "Settings",        needsSettings: true },
];

export const WIDGETS = [
  { key: "needs_you",       label: "Needs you" },
  { key: "my_assets",       label: "My assets" },
  { key: "domain_health",   label: "Domain health" },
  { key: "certified",       label: "Certified assets" },
  { key: "incidents",       label: "Open incidents" },
  { key: "violations",      label: "Policy violations" },
  { key: "connections",     label: "Connection health" },
  { key: "recent",          label: "Recently viewed" },
  { key: "announcements",   label: "Announcements" },
];

// KPI library: a measure + optional filter. Values are seeded per domain.
export const KPI_MEASURES = [
  { id: "desc_cov",       label: "Description coverage",    kind: "pct",   better: "higher" },
  { id: "own_cov",        label: "Ownership coverage",      kind: "pct",   better: "higher" },
  { id: "class_cov",      label: "Classification coverage", kind: "pct",   better: "higher" },
  { id: "cert_cov",       label: "Certification coverage",  kind: "pct",   better: "higher" },
  { id: "dq_pass",        label: "DQ pass rate",            kind: "pct",   better: "higher" },
  { id: "fresh_sla",      label: "Freshness SLA met",       kind: "pct",   better: "higher" },
  { id: "ingest_success", label: "Ingestion success (7d)",  kind: "pct",   better: "higher" },
  { id: "policy_comp",    label: "Policy compliance",       kind: "pct",   better: "higher" },
  { id: "certified_n",    label: "Certified assets",        kind: "count", better: "higher" },
  { id: "open_incidents", label: "Open DQ incidents",       kind: "count", better: "lower" },
  { id: "open_viol",      label: "Open violations",         kind: "count", better: "lower" },
  { id: "pii_unmasked",   label: "PII not masked",          kind: "count", better: "lower" },
  { id: "req_age",        label: "Avg request age (days)",  kind: "count", better: "lower" },
  { id: "failing_conns",  label: "Failing connections",     kind: "count", better: "lower", global: true },
];

const KPI_SEED = {
  desc_cov:       { Commerce: 82, Finance: 71, Marketing: 58, "Supply Chain": 64, HR: 49 },
  own_cov:        { Commerce: 91, Finance: 88, Marketing: 62, "Supply Chain": 70, HR: 77 },
  class_cov:      { Commerce: 86, Finance: 79, Marketing: 55, "Supply Chain": 60, HR: 92 },
  cert_cov:       { Commerce: 48, Finance: 41, Marketing: 22, "Supply Chain": 30, HR: 35 },
  dq_pass:        { Commerce: 94, Finance: 89, Marketing: 81, "Supply Chain": 86, HR: 97 },
  fresh_sla:      { Commerce: 97, Finance: 93, Marketing: 88, "Supply Chain": 90, HR: 99 },
  ingest_success: { Commerce: 98, Finance: 96, Marketing: 92, "Supply Chain": 95, HR: 99 },
  policy_comp:    { Commerce: 95, Finance: 92, Marketing: 84, "Supply Chain": 89, HR: 90 },
  certified_n:    { Commerce: 112, Finance: 74, Marketing: 31, "Supply Chain": 46, HR: 18 },
  open_incidents: { Commerce: 3, Finance: 5, Marketing: 7, "Supply Chain": 2, HR: 0 },
  open_viol:      { Commerce: 4, Finance: 2, Marketing: 9, "Supply Chain": 3, HR: 6 },
  pii_unmasked:   { Commerce: 2, Finance: 0, Marketing: 5, "Supply Chain": 0, HR: 3 },
  req_age:        { Commerce: 1.8, Finance: 3.2, Marketing: 5.1, "Supply Chain": 2.4, HR: 1.1 },
  failing_conns:  { _all: 2 },
};

export const kpiValue = (measureId, domains) => {
  const m = KPI_MEASURES.find((x) => x.id === measureId);
  const seed = KPI_SEED[measureId] || {};
  if (!m) return 0;
  if (m.global) return seed._all || 0;
  const vals = domains.map((d) => seed[d]).filter((v) => v != null);
  if (!vals.length) return 0;
  if (m.kind === "pct" || measureId === "req_age") return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  return vals.reduce((a, b) => a + b, 0);
};

export const kpiOnTrack = (measureId, value, target) => {
  const m = KPI_MEASURES.find((x) => x.id === measureId);
  if (!m || target === "" || target == null) return null;
  return m.better === "higher" ? value >= Number(target) : value <= Number(target);
};

export const SEED_PERSONAS = [
  { id: "business", name: "Business User", suggestedRole: "viewer", landing: "search",
    nav: ["home", "search", "stewardship", "catalog", "glossary", "domains", "dataproducts"],
    widgets: ["certified", "recent", "announcements"],
    kpis: [{ m: "certified_n", target: "", by: "" }, { m: "desc_cov", target: 80, by: "2027-03-31" }],
    assigned: { users: ["sarah.kim"], teams: [] } },
  { id: "analyst", name: "Data Analyst", suggestedRole: "contributor", landing: "catalog",
    nav: ["home", "search", "stewardship", "catalog", "glossary", "dataproducts", "quality", "semanticlayer"],
    widgets: ["certified", "my_assets", "recent"],
    kpis: [{ m: "certified_n", target: "", by: "" }, { m: "fresh_sla", target: 95, by: "2027-03-31" }, { m: "dq_pass", target: 95, by: "2027-03-31" }],
    assigned: { users: [], teams: ["finance_analytics"] } },
  { id: "engineer", name: "Data Engineer", suggestedRole: "contributor", landing: "home",
    nav: ["home", "search", "stewardship", "catalog", "quality", "connections", "semanticlayer", "knowledgegraphs", "settings"],
    widgets: ["connections", "incidents", "my_assets"],
    kpis: [{ m: "ingest_success", target: 99, by: "2027-01-31" }, { m: "failing_conns", target: 0, by: "" }, { m: "open_incidents", target: 2, by: "2027-01-31" }, { m: "dq_pass", target: 95, by: "2027-03-31" }],
    assigned: { users: [], teams: ["data_platform"] } },
  { id: "steward", name: "Data Steward", suggestedRole: "steward", landing: "stewardship",
    nav: ["home", "search", "stewardship", "catalog", "glossary", "domains", "dataproducts", "quality", "policymanager"],
    widgets: ["needs_you", "domain_health", "my_assets"],
    kpis: [{ m: "desc_cov", target: 90, by: "2027-03-31" }, { m: "own_cov", target: 95, by: "2027-03-31" }, { m: "class_cov", target: 90, by: "2027-03-31" }, { m: "cert_cov", target: 60, by: "2027-06-30" }, { m: "req_age", target: 2, by: "" }],
    assigned: { users: [], teams: ["commerce_stewards"] } },
  { id: "compliance", name: "Compliance Officer", suggestedRole: "steward", landing: "policymanager",
    nav: ["home", "search", "stewardship", "catalog", "policymanager", "domains"],
    widgets: ["violations", "needs_you", "domain_health"],
    kpis: [{ m: "policy_comp", target: 95, by: "2027-03-31" }, { m: "open_viol", target: 0, by: "" }, { m: "pii_unmasked", target: 0, by: "" }, { m: "class_cov", target: 95, by: "2027-03-31" }],
    assigned: { users: [], teams: ["compliance"] } },
  { id: "admin", name: "Platform Admin", suggestedRole: "admin", landing: "home",
    nav: ["home", "search", "stewardship", "catalog", "quality", "policymanager", "connections", "settings"],
    widgets: ["connections", "needs_you", "announcements"],
    kpis: [{ m: "failing_conns", target: 0, by: "" }, { m: "ingest_success", target: 99, by: "2027-01-31" }, { m: "own_cov", target: 95, by: "2027-03-31" }],
    assigned: { users: ["alex.rivera"], teams: ["platform"] } },
];

// ── Evaluation ───────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
export const grantActive = (g) => !g.expires || g.expires >= today();

export const grantsFor = (userId, grants) => {
  const u = USERS.find((x) => x.id === userId);
  if (!u) return [];
  return grants.filter((g) => grantActive(g) && (
    g.whoType === "org" ||
    (g.whoType === "user" && g.who === userId) ||
    (g.whoType === "team" && u.teams.includes(g.who))));
};

export const inScope = (g, domain) => g.scope === "all" || (Array.isArray(g.scope) && g.scope.includes(domain));

export const whoLabel = (g) => g.whoType === "org" ? "Everyone"
  : g.whoType === "team" ? (TEAMS.find((t) => t.id === g.who)?.name || g.who)
  : (USERS.find((u) => u.id === g.who)?.name || g.who);

export const scopeLabel = (g) => g.scope === "all" ? "All domains" : g.scope.join(", ");

// Best level a user holds for a section on a given domain (or any domain when domain is null)
export const levelFor = (userId, section, domain, grants, roles) => {
  let best = { level: "none", grant: null };
  for (const g of grantsFor(userId, grants)) {
    if (domain && !inScope(g, domain)) continue;
    const r = roles.find((x) => x.id === g.role);
    const l = r?.levels[section] || "none";
    if (rank(l) > rank(best.level)) best = { level: l, grant: g, role: r };
  }
  return best;
};

export const hasAddon = (userId, addon, domain, grants) =>
  grantsFor(userId, grants).find((g) => g.addons.includes(addon) && (!domain || inScope(g, domain))) || null;

export const isSettingsUser = (userId, grants, roles) =>
  grantsFor(userId, grants).find((g) => roles.find((r) => r.id === g.role)?.settings) || null;

export const CHECK_ACTIONS = [
  { key: "view",    label: "View",                   section: "catalog", need: "view" },
  { key: "edit",    label: "Edit description & tags", section: "catalog", need: "contribute", owner: true },
  { key: "certify", label: "Certify",                section: "catalog", need: "manage" },
  { key: "delete",  label: "Delete",                 adminOnly: true },
  { key: "dqtest",  label: "Create DQ test",          section: "quality", need: "contribute", owner: true },
  { key: "sample",  label: "View sample data",       sensitive: true },
  { key: "ingest",  label: "Run ingestion",          addon: "connections" },
];

const grantText = (g, r) => `${whoLabel(g)} → ${r?.name || g.role} · ${scopeLabel(g)}`;

export const checkAccess = (userId, assetId, grants, roles) => {
  const a = ASSETS.find((x) => x.id === assetId);
  if (!a) return [];
  const isOwner = a.owner === userId;
  return CHECK_ACTIONS.map((act) => {
    if (act.adminOnly) {
      const g = isSettingsUser(userId, grants, roles);
      return { ...act, allowed: !!g, why: g ? `Admin · ${whoLabel(g)}` : "Admin only" };
    }
    if (act.addon) {
      const g = hasAddon(userId, act.addon, a.domain, grants);
      return { ...act, allowed: !!g, why: g ? `Add-on: ${ADDONS.find((x) => x.key === act.addon).short} · ${whoLabel(g)}` : `Needs add-on: ${ADDONS.find((x) => x.key === act.addon).short}` };
    }
    if (act.sensitive) {
      const view = levelFor(userId, "catalog", a.domain, grants, roles);
      if (!a.sensitive) return { ...act, allowed: rank(view.level) >= 1, why: rank(view.level) >= 1 ? `Not sensitive · ${grantText(view.grant, view.role)}` : "No grant covers this domain" };
      const g = hasAddon(userId, "sensitive", a.domain, grants);
      return { ...act, allowed: !!g || isOwner, why: g ? `${a.sensitive} · add-on via ${whoLabel(g)}` : isOwner ? `${a.sensitive} · owner of asset` : `${a.sensitive} · needs add-on: Sensitive data` };
    }
    const best = levelFor(userId, act.section, a.domain, grants, roles);
    if (rank(best.level) >= rank(act.need)) return { ...act, allowed: true, why: grantText(best.grant, best.role) };
    if (act.owner && isOwner) return { ...act, allowed: true, why: "Owner of asset · built in" };
    if (act.key === "certify" && isOwner) return { ...act, allowed: false, why: "Owners can't certify their own assets" };
    const anyDomain = levelFor(userId, act.section, null, grants, roles);
    const why = rank(best.level) === 0 ? `No grant covers ${a.domain}`
      : `Has ${LEVEL_LABEL[best.level]} · needs ${LEVEL_LABEL[act.need]}`;
    return { ...act, allowed: false, why: rank(anyDomain.level) >= rank(act.need) && rank(best.level) < rank(act.need) ? `${why} (allowed in ${scopeLabel(anyDomain.grant)})` : why };
  });
};

export const screenAllowed = (screen, userId, grants, roles) => {
  if (screen.locked || (!screen.needs && !screen.needsAddon && !screen.needsSettings)) return true;
  if (screen.needsSettings) return !!isSettingsUser(userId, grants, roles) || !!hasAddon(userId, "connections", null, grants);
  if (screen.needsAddon) return !!hasAddon(userId, screen.needsAddon, null, grants);
  return rank(levelFor(userId, screen.needs, null, grants, roles).level) >= 1;
};

// Which role presets would hide this screen (for the persona editor hint)
export const rolesWithoutScreen = (screen, roles) => roles.filter((r) => {
  if (screen.locked) return false;
  if (screen.needsSettings || screen.needsAddon) return !r.settings;
  if (!screen.needs) return false;
  return rank(r.levels[screen.needs]) < 1;
});

export const userScopeDomains = (userId, grants) => {
  const gs = grantsFor(userId, grants).filter((g) => g.whoType !== "org");
  if (gs.some((g) => g.scope === "all")) return DOMAINS;
  const set = new Set(gs.flatMap((g) => g.scope));
  return set.size ? DOMAINS.filter((d) => set.has(d)) : DOMAINS;
};

export const personasFor = (userId, personas) => {
  const u = USERS.find((x) => x.id === userId);
  if (!u) return [];
  return personas.filter((p) => p.assigned.users.includes(userId) || p.assigned.teams.some((t) => u.teams.includes(t)));
};
