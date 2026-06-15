# Solix EDG — Stewardship & Ownership Workflows
### End-to-End Plan & Implementation Spec (v3)
_Last updated: 2026-06-15. Status: APPROVED — implementation starting. Access/role-request flow is deferred._

---

## 1. Scope & Goal

**In scope:** stewardship + ownership workflows across the **six governed object types** that carry owners/stewards — catalog assets, glossary terms, policies, data products, data domains, tags.

**Now explicitly folded in:** **Data Quality incidents** and **Policy violations** become first-class stewardship work items (this version's addition).

**Deferred:** data-access / RBAC-role request flow.

**Goal:** one *findable* workspace; one *consistent* ownership model; every task *traceable* to a signal; a single *accountable* owner per object for compliance.

---

## 2. Diagnosis — Current State

| Problem | Evidence (solix-platform-v2.jsx) |
|---|---|
| **Undiscoverable** — not in sidebar | `StewardshipView` (10007) reachable only via avatar dropdown (2861); not in `GROUPS` (3151) |
| **Six+ fragmented inboxes** | Inbox + My Tasks + notification bell (`INBOX_DATA`) + Certifications + Orphaned + glossary approvals — and DQ/policy violations live in *separate modules entirely* |
| **Ownership is edit-only** | assignment = direct field write via pickers; no request→approve flow |
| **Request ↔ assignment disconnected** | `stewardship_request` (328) and orphan "Assign" (10378) are cosmetic — don't write fields |
| **Inconsistent vocabulary** | domains/products use `experts`, tags use `managedBy`, others use `stewards` |
| **DQ & Policy work is siloed** | DQ incidents in Quality module; policy `violations` in PolicyManagerView local state — neither reaches the steward's workspace |

---

## 2b. Implementation Reality (verified in running app, 2026-06-15)

- **The live "My Workspace" component is `InboxView` (26368)**, NOT `StewardshipView` (10007). `case "stewardship"` routes to `InboxView` (30022).
- `StewardshipView` (10007) with Inbox/My Tasks/Orphaned/Team + `STEWARDSHIP_TASKS` is **dead code** — no `<StewardshipView` reference exists.
- `InboxView` **already implements most of the Action Center**: card list, **List/Kanban toggle** (`viewMode`), tabs (All/Tasks/Alerts/Assigned/Done), section multiselect filter, detail panel with per-type `ActionRow`, ack/dismiss/markAll.
- **But** it reads only `INBOX_DATA` (5 types: `dq_alert`, `field_updated`, `assigned`, `needs_attention`, `stewardship_request`) and is asset/term-scoped.
- **Therefore Phases 2–3 = EXTEND `InboxView`'s data source**, not rebuild: fold in tag approvals (`tagCtx.inbox`), policy violations, DQ incidents, certifications, glossary approvals, orphans — across all 6 object types — plus add categories and the My Portfolio / Activity zones.
- Pre-existing console warning: duplicate React key in `TagProvider` (485) — unrelated to this work, but worth fixing opportunistically.

## 3. The Two-Axis Responsibility Model

Ownership is **not** a higher permission tier. Two separate axes:

- **Permission axis (RBAC)** — what you *can* do (edit/create/delete). → Steward does all of it.
- **Accountability axis (Owner/Steward)** — what you're *answerable* for.

| Role | Does | Needs |
|---|---|---|
| **Steward** | all operational work — edit/create/delete, resolve work items, prepare certs, curate | edit permissions |
| **Owner** | **approves & answers** — sign-off, accept risk/exceptions, set lifecycle/SLA, appoint stewards, escalation target, the one accountable contact | approve rights (not necessarily more edit) |

**Simplifications built in:** one person can be both (already true — `alex.wu` owns *and* stewards `product_events`); Owner = approver not editor; new objects default `owner = steward = creator`. **Never merged away:** a single accountable owner per object, because "who is accountable?" must resolve to one name even when "who can edit?" is many.

---

## 4. Normalized Ownership Model (locked)

Every governed object → identical `{owners:[], stewards:[]}`.

| Object | Migration |
|---|---|
| Catalog asset, Glossary term | already `owners`/`stewards` — unchanged |
| Policy | `owner` → `owners` |
| Domain, Data Product | `experts` → `stewards` |
| Tag | `managedBy` → `owners[0]`, add `stewards:[]` |

Implementation note: to avoid a risky global rewrite of every render site, introduce accessor helpers `getOwners(obj)` / `getStewards(obj)` that read whichever field exists, and migrate data incrementally behind them.

---

## 5. Unified WorkItem Spine

```js
WorkItem = {
  id,
  type,                          // from the catalogs in §6
  category,                      // Ownership | Approval | Classification | Violation | Curation
  subject: { kind, id, name },   // kind ∈ asset | term | policy | domain | dataproduct | tag
  why,                           // one plain sentence
  suggestedAction,               // primary CTA label
  assignee:   <subject.stewards>,// steward does it
  approver:   <subject.owners>,  // owner signs off (approval/violation-accept items)
  escalateTo: <subject.owners>,  // owner is escalation target
  severity,                      // Critical | High | Medium | Low
  dueBy,                         // derived from severity
  status,                        // Incoming → In Review → Pending Response → Resolved (+ Suppressed / Escalated)
  source,                        // { kind: dq | policy | scan | submission | system, ref }
  history
}
```

Polymorphic `subject` + normalized ownership = uniform accessors, no branching by object kind.

---

## 6. Work Catalogs (grounded in real prototype types)

Legend: ✅ live today · ⚠️ gap (object has owners/stewards but emits no work) · 🆕 new in this version

### A. Stewardship work (operational — steward acts)

| Object | Work item (`type`) | Source | Today |
|---|---|---|---|
| Asset | `dq_alert` (test fail / schema drift) | INBOX_DATA:309/339 | ✅ |
| Asset | `quality_incident` (DQ incident lifecycle) | Quality module (DQ tests/incidents) | 🆕 fold in |
| Asset | `policy_violation` (open policy violation) | PolicyManagerView `violations` (5719) | 🆕 fold in |
| Asset | `pii_audit` | STEWARDSHIP_TASKS:772 | ✅ |
| Asset | `schema_documentation` | 804 | ✅ |
| Asset | `certification_review` | 812 + CERTIFICATIONS:847 | ✅ |
| Asset | `field_updated` (passive awareness) | INBOX_DATA:315 | ✅ |
| Glossary term | `term_review` | 780 | ✅ |
| Glossary term | `conflict_resolution` | 764 | ✅ |
| Glossary term | `term_deprecation` | 820 | ✅ |
| Tag | `pending_approval` | INITIAL_INBOX:303 | ✅ |
| Tag | `sync_conflict` | 302 | ✅ |
| Tag | `new_source_tag` | 301 | ✅ |
| Tag | `propagation_review` | 305 | ✅ |
| Policy | `policy_review` (Draft→Review→Approved sign-off) | policy lifecycle (5563) | ⚠️ gap |
| Data Product | `sla_breach` (SLA/contract breach) | DATA_PRODUCTS `sla` (16733) | ⚠️ gap |
| Domain | `domain_health` (uncategorized assets / health) | — | ⚠️ gap |

### B. Ownership work (assignment lifecycle — owner/admin acts)

| Object | Work item (`type`) | Source | Today |
|---|---|---|---|
| Asset/Term | `assigned` (notice) | INBOX_DATA:322/345 | ✅ passive |
| Asset | `stewardship_request` | 328/365 | ⚠️ live but **doesn't write field** |
| Asset | `needs_attention` (no steward) | 334 | ✅ |
| Asset | `orphan_assignment` (assign/deprecate) | STEWARDSHIP_TASKS:796 | ⚠️ live but **fake toast** (10378) |
| Asset | orphaned list (`issue`: No Owner/Deprecated) | ORPHANED_ASSETS_DATA:840 | ✅ list only |
| Asset/Term | `new_dataset` (unowned detected) | NOTIFS:2635 | ✅ notification |
| All 6 | `transfer` / handoff single object | — | 🆕 gap |
| All 6 | `bulk_reassign` on offboarding | — | 🆕 gap |
| All 6 | `attestation` (quarterly owner confirm) | — | 🆕 gap |

**Honest state:** real stewardship work exists today only for assets, terms, tags. Policies/products/domains are gaps. DQ + policy violations exist but live in other modules — folding them in is the headline of this version. Request/orphan actions are cosmetic — wiring them to write fields is core to Phase 4.

---

## 7. Ownership Lifecycle (one state machine, all 6 types)

```
Unassigned(orphan) ──assign──▶ Assigned ──request change──▶ Pending approval ──▶ Assigned
       ▲                          │                                                 │
       └──────── vacated ◀────────┴──────────── transfer / handoff ─────────────────┘
```

Workflows: Assign (picker) · Request (owner approves → **writes field**) · Transfer · **Bulk-reassign on offboarding** (whole portfolio, all 6 types) · Orphan detection (→ domain owner → admin) · **Attestation** (quarterly owner confirm).

---

## 8. Routing (governance-graph rollup)

```
operational item  →  subject.stewards  →(SLA breach)→  subject.owners  →  subject.domain.owners  →  admin
approval item     →  subject.owners (sign-off)
```

SLA from severity (Critical 24h · High 3d · Medium 1w · Low 2w); overdue auto-escalates up the chain.

---

## 9. Workspace IA + Nav Fix (PM / UX)

- **Nav:** add **"My Workspace"** to the sidebar (top, personal scope) and fold Certifications into it.
- **Header metrics:** To Do · Critical · SLA at risk · Portfolio health.
- **Action Center** — all my work items across all 6 object types incl. DQ + policy violations; List ⇄ Board (4 columns: Incoming → In Review → Pending Response → Resolved); filter by category / object / severity; bulk actions.
- **My Portfolio** — everything I own or steward, grouped by object type, each with a health dot.
- **Activity** — passive feed scoped to my portfolio.
- **Owner lens** — owners also see approval items (sign-offs), attestation, and domain-orphan items.

### WorkItem card anatomy
```
▌ [CATEGORY badge]                        ⏰ overdue chip
  <subject name>                          (bold)
  <why — one sentence>
  <source · domain context>               [ primary CTA ▸ ]
```
Left-border color by category: Classification=amber · Approval=blue · Violation=red · Curation=purple · Ownership=teal.

---

## 10. Phased Build Order

| Phase | What | Delivers |
|---|---|---|
| **0** | Nav fix — add "My Workspace" to sidebar | discoverable (small, safe) |
| **1** | `getOwners`/`getStewards` accessors + normalize the 6 data sets incrementally | uniform model |
| **2** | Global work-item store + adapters feeding **`InboxView`** (fold all sources incl. **DQ + policy violations**, tag approvals, certs, orphans) | one data spine |
| **3** | Extend `InboxView`: category model + WorkItem card variants + cross-object filters (List/Kanban already exist) | the visible win |
| **4** | Ownership lifecycle wired to **actually write fields** (+ make request/orphan real; bulk-reassign; attestation) | real ownership workflow |
| **5** | My Portfolio + Activity zones + Owner lens | full workspace |
| **6** | Board view + graph routing + SLA escalation | enterprise rigor |

Phases 0–3 deliver the headline outcome. 4–6 add ownership rigor.

---

## 11. Cross-Module Integration (DQ + Policy → Stewardship)

To fold DQ incidents and policy violations into the workspace, both must be readable globally:

- **Policy violations:** currently in `PolicyManagerView` local `useState` (5719). Lift to a module-level store (`POLICY_VIOLATIONS`) so both the Policy Manager and the workspace adapter read the same source. Each open violation → `policy_violation` WorkItem, `assignee` = asset steward, `escalateTo`/`approver` = asset owner (owner accepts-risk/signs-off the exception).
- **DQ incidents:** failing test cases / incidents (Quality module) → `quality_incident` WorkItem on the asset, routed to its steward.
- Resolving the WorkItem updates the underlying record; re-evaluation auto-closes it.

---

## 12. Dependencies & Out-of-Scope

- `classification_review` needs the **Policy Manager scan engine** (separate plan) for a live source — seed as demo until then.
- Deferred **access flow** later adds `access_request` / `ownership_request` / `role_request` work-item types — no model change.
