# Policy Management — Developer Implementation Plan

## Architecture

```
Source Systems → Connectors → Normalization → Canonical Asset Model → Policy Engine → Violation Engine → Notifications / Dashboards
```

Each source system connector is responsible for fetching raw metadata and mapping it to canonical fields. The Policy Engine evaluates structured condition arrays against canonical assets. The Violation Engine persists results and triggers notifications.

---

## 5 Policy Categories

| Category | Description |
|---|---|
| Data Policy | Governance, ownership, certification, quality, and tiering rules |
| Security Policy | Classification, sensitivity, encryption, masking, row security, and exposure rules |
| Retention Policy | Retention periods, legal hold, last-access staleness, and storage class rules |
| Access Policy | Access levels, role counts, guest/privileged access, and cross-domain rules |
| Metadata Quality Policy | Descriptions, business terms, tag coverage, metadata scores, and review staleness |

---

## Source + Asset Field Support Matrix

| Field | Snowflake Table | Snowflake DB/Schema | Databricks Table | Postgres Table | MySQL Table | Oracle Table | S3 Bucket | S3 Object | Azure Container | Azure Blob | Pipeline |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Classification | Connector (tags) + Classifier | Classifier | Connector (tags) + Classifier | Classifier only | Classifier only | Classifier only | Classifier | Classifier | Classifier | Classifier | N/A |
| Sensitivity | Platform derived | Platform derived | Platform derived | Platform derived | Platform derived | Platform derived | Platform derived | Platform derived | Platform derived | Platform derived | N/A |
| Encryption | Assert: Always Enabled | Assert: Always Enabled | Assert: Always Enabled | Unknown (pg_settings) | Unknown | Unknown | From API (SSE config) | Inherited from bucket | From API (Azure config) | Inherited from container | N/A |
| Masking | ✅ Snowflake DDP | N/A | ✅ Unity column masks | ❌ Not native | ❌ Not native | ✅ Oracle Data Masking | N/A | N/A | N/A | N/A | N/A |
| Row Security | ✅ Row Access Policy | N/A | ✅ Row Filters | ✅ Row Security Policy | ❌ Not native | ✅ VPD | N/A | N/A | N/A | N/A | N/A |
| Exposure | Always Internal | Always Internal | Always Internal | Always Internal | Always Internal | Always Internal | From API (Public Access Block) | Inherited | From API (Blob access level) | Inherited | N/A |
| Access Level / Role Count | SHOW GRANTS | SHOW GRANTS | Unity Catalog perms | information_schema | information_schema | DBA_TAB_PRIVS | Bucket policy + ACLs | N/A | RBAC roles | N/A | N/A |
| Last Accessed Days | QUERY_HISTORY | QUERY_HISTORY | Audit logs | pg_stat_user_tables | performance_schema | v$sql | CloudTrail | CloudTrail | Azure Monitor | Azure Monitor | Last run date |
| Retention Period | Manual only | Manual only | Manual only | Manual only | Manual only | Manual only | S3 Lifecycle rules | Storage class | Access tier | Access tier | N/A |
| Legal Hold | Manual (platform) | Manual | Manual | Manual | Manual | Manual | Manual | Manual | Manual | Manual | N/A |

---

## Canonical Fields Per Category

### Data Policy
`owner`, `steward`, `cert`, `qualityScore`, `classification`, `tags`, `tier`, `usage`, `environment`, `hasDescription`, `domain`

### Security Policy
`classification`, `sensitivity`, `exposure`, `encryptionStatus`, `maskingStatus`, `rowSecurity`, `environment`

- `maskingStatus` only applicable to Snowflake / Databricks / Oracle table assets
- `exposure` only meaningful for S3 / Azure assets
- `rowSecurity` only for Snowflake / Databricks / Postgres / Oracle tables

### Retention Policy
`retentionPeriod`, `retentionClass`, `lastAccessedDays`, `legalHold`, `classification`, `tags`

- `retentionPeriod` from connectors only for S3/Azure (lifecycle rules); manual for all database sources

### Access Policy
`accessLevel`, `privilegedAccess`, `guestAccess`, `lastAccessReviewDays`, `roleCount`, `crossDomainAccess`, `sensitivity`

- `roleCount` from connectors for Snowflake / Databricks / Postgres / Oracle / S3; N/A for file-level assets

### Metadata Quality Policy
`hasDescription`, `tagCoverage`, `metadataScore`, `lastReviewedDays`, `owner`, `steward`, `domain`, `hasBusinessTerm`

- All platform-computed; applies to all sources and asset types

---

## New Fields to Add to Asset Data Model

```js
// ── Data + Security ──────────────────────────────────────────────────────────
environment: "PROD" | "DEV" | "TEST"
classification: "PII" | "PHI" | "PCI" | "Confidential" | "Internal" | "Public" | "Not Set"
sensitivity: "Low" | "Medium" | "High" | "Critical" | "Not Set"
exposure: "Public" | "Internal" | "Restricted" | "Not Set"   // only meaningful for S3/Azure
encryptionStatus: "Enabled" | "Disabled" | "Unknown"
maskingStatus: "Applied" | "Partial" | "Not Applied" | "Unknown"  // only for Snowflake/Databricks/Oracle tables
rowSecurity: "Enabled" | "Disabled" | "Unknown"              // only for Snowflake/Databricks/Postgres/Oracle tables

// ── Retention ────────────────────────────────────────────────────────────────
retentionPeriod: "30d" | "90d" | "1y" | "7y" | "Indefinite" | "Not Set"
retentionClass: "Operational" | "Regulatory" | "Archive" | "Legal Hold" | "Not Set"
lastAccessedDays: number        // days since last access
legalHold: boolean

// ── Access ───────────────────────────────────────────────────────────────────
accessLevel: "Open" | "Controlled" | "Restricted" | "Not Set"
privilegedAccess: boolean
guestAccess: boolean
lastAccessReviewDays: number    // days since last access review
roleCount: number | null        // null for file assets
crossDomainAccess: boolean

// ── Quality ──────────────────────────────────────────────────────────────────
hasDescription: boolean         // computed: description !== ""
tagCoverage: number             // 0–100; computed: tagged columns / total columns
metadataScore: number           // 0–100; platform computed
lastReviewedDays: number        // days since metadata last reviewed
hasBusinessTerm: boolean
```

---

## Violation Notification Flow

When the Policy Engine evaluates and finds a violation:

1. **Violation record created** with: `policyId`, `assetId`, `ruleId`, `severity`, `canonicalFieldsAtViolationTime`, `detectedAt`
2. **SLA timer starts** — configured per policy (e.g. 72 h for Critical)
3. **Notifications fire** based on policy Actions config:
   - **In-platform** — notification appears in asset owner's Inbox (stewardship view)
   - **Email** — sent to asset owner + steward
   - **Slack** — posted to configured channel
   - **Jira** — ticket created in configured project with violation details
4. **SLA breach** — escalation notification to escalation owner
5. **Violation lifecycle** — `Open → Acknowledged → In Progress → Resolved`

---

## Policy Rule Sets

### Data Policy — 12 Rules
1. `owner` not set + `tier` = 1
2. `steward` not set + `classification` = PII
3. `owner` null + `steward` null + `environment` = PROD
4. `tier` = 1 + `environment` = PROD + `cert` ≠ Approved
5. `cert` = Deprecated + `usage` = High
6. `classification` = PII + `cert` ≠ Approved
7. `classification` = PHI + `qualityScore` < 90
8. `classification` = PII + `qualityScore` < 80 + `environment` = PROD
9. `tier` = 1 + `qualityScore` < 70
10. `tier` = 1 + `hasDescription` = false
11. `domain` not set + `environment` = PROD
12. `tags` empty + `environment` = PROD + `tier` ≤ 2

### Security Policy — 12 Rules
1. `classification` = PII + `exposure` = Public
2. `classification` = PHI + `exposure` ≠ Restricted
3. `classification` = PII + `encryptionStatus` = Disabled
4. `sensitivity` = High + `encryptionStatus` = Disabled + `environment` = PROD
5. `classification` = PII + `maskingStatus` = Not Applied + `environment` = PROD _(Snowflake/Databricks/Oracle only)_
6. `classification` = PHI + `maskingStatus` ≠ Applied _(Snowflake/Databricks/Oracle only)_
7. `sensitivity` = High + `rowSecurity` = Disabled + `environment` = PROD _(Snowflake/Databricks/Postgres/Oracle only)_
8. `classification` = PCI + `rowSecurity` = Disabled _(Snowflake/Databricks/Postgres/Oracle only)_
9. `sensitivity` = High + `exposure` = Public
10. `classification` = PII + `maskingStatus` = Partial
11. `classification` = PII + `encryptionStatus` = Unknown
12. Max risk: `classification` = PII + `exposure` = Public + `encryptionStatus` = Disabled + `maskingStatus` = Not Applied

### Retention Policy — 10 Rules
1. `classification` = PII + `retentionPeriod` = Not Set
2. `classification` = PHI + `lastAccessedDays` > 2555 + `legalHold` = false
3. GDPR tag + `lastAccessedDays` > 30 + `retentionPeriod` = 30d
4. `environment` = PROD + `tier` = 1 + `retentionPeriod` = Not Set
5. `retentionClass` = Operational + `lastAccessedDays` > 90
6. `retentionClass` = Archive + `lastAccessedDays` > 365 _(S3/Azure only)_
7. `legalHold` = true + `owner` = Not Set
8. `classification` = PII + `retentionPeriod` = Indefinite + `legalHold` = false
9. `lastAccessedDays` > 180 + `owner` = Not Set
10. `environment` = PROD + `retentionClass` = Not Set + `tier` ≤ 2

### Access Policy — 10 Rules
1. `classification` = PII + `accessLevel` = Open
2. `classification` = PHI + `roleCount` > 10
3. `sensitivity` = High + `guestAccess` = true
4. `classification` = PII + `lastAccessReviewDays` > 90
5. `classification` = PII + `crossDomainAccess` = true
6. `classification` = PII + `roleCount` > 25
7. `classification` = PHI + `privilegedAccess` = true
8. `tier` = 1 + `lastAccessReviewDays` > 180
9. `sensitivity` = High + `accessLevel` = Open + `environment` = PROD
10. `tier` = 1 + `crossDomainAccess` = true + `sensitivity` = High

### Metadata Quality Policy — 10 Rules
1. `tier` = 1 + `hasDescription` = false
2. `tier` = 1 + `hasBusinessTerm` = false
3. `metadataScore` < 40 + `environment` = PROD
4. `classification` = PII + `tagCoverage` < 50
5. `tier` = 1 + `tagCoverage` < 30
6. `owner` = Not Set + `steward` = Not Set
7. `tier` = 1 + `lastReviewedDays` > 180
8. `metadataScore` < 60 + `tier` ≤ 2 + `environment` = PROD
9. `domain` = Not Set + `tier` ≤ 2
10. `tier` = 1 + `lastReviewedDays` > 365

---

## 4 Screens

### Screen 1 — Policy List
- Posture bar: assets monitored / violations / compliance % / critical count — 4 chips
- Search + filter bar with category chips: All / Data / Security / Retention / Access / Quality
- "New Policy" button (accent red)
- Table columns: Policy Name (with category color dot), Category chip, Severity, Assets in Scope, Violations badge, Compliance % (mini bar), Last Evaluated, Status chip, Owner

### Screen 2 — Create Policy Wizard
- 6-step sidebar: Policy Info → Scope → Rule Builder → Evaluation → Actions → Review
- **Scope step**: filter rows for Source System, Asset Type, Domain, Environment, Classification, Sensitivity; live preview box showing "147 assets currently match this scope" with sample asset list
- **Rule Builder step**: IF/THEN rows with Field + Operator + Value dropdowns; source-aware warnings on inapplicable fields (masking, exposure, row security); AND/OR logic toggle; auto-generated human-readable summary
- **Actions step**: notification toggles — Email Owner, Notify Steward, Slack, Jira; SLA timer input

### Screen 3 — Policy Detail
- Tabs: Overview / Violations / Assets in Scope / Audit Log
- Compliance score, violations table

### Screen 4 — Violations Dashboard
- 4 metric cards: Total Open, Critical, Assets at Risk, Avg Resolution Age
- Filter row: severity chips + domain filter
- Violations table: Asset / Source / Policy / Rule Fired / Severity / Domain / Owner / Age / Status
- Clickable row → right-side Violation Drawer:
  - Asset name + source badge + type
  - Policy that fired + exact rule in plain language
  - "Fields that triggered this violation" — canonical field name, value, and source label (e.g. "Snowflake tag: PII_EMAIL", "SHOW GRANTS: public role detected")
  - "Notifications sent" — email / Slack / Jira rows with delivery status
  - Action buttons: Assign Remediation, Create Jira, Snooze, Mark Resolved

---

## Implementation Steps

| Step | Task |
|---|---|
| 1 | Add 20 new canonical fields to `ASSETS` array in `solix-platform-v2.jsx` |
| 2 | Update `PolicyManagerView` data model — policies get structured `conditions` array instead of free-text rules |
| 3 | Build `evaluatePolicy(policy, assets)` — filter assets by structured conditions, return violations array |
| 4 | Build policy list page with posture bar |
| 5 | Build Create Policy Wizard (6 steps) with scope builder and rule builder |
| 6 | Build violations dashboard with drawer |
| 7 | Wire violation creation to stewardship inbox (existing) + toast notifications |
| 8 | Add source+asset field support matrix to rule builder — hide inapplicable fields based on scope selection |
