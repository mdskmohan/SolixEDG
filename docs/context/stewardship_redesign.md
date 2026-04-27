# Stewardship / My Workspace Redesign

## Status: Parked — resume discussion before building

---

## User Feedback
- Current view is "extremely confusing, the UI/UX is the worst"
- Steward's role is unclear
- Too many variables / tabs
- Activities are unclear

---

## Agreed Design Direction

### Three Zones

**Zone 1 — Action Center** (needs your decision)
- 4-column Kanban: **Incoming → In Review → Pending Response → Resolved**
- Toggle between List view and Kanban board (segmented button top-right)
- Card anatomy:
  - Color-coded left border by item type (Quality=red, Tag=purple, Glossary=blue, Orphan=yellow, Certification=green)
  - Type badge top-left
  - Overdue chip top-right if >2d old, red if >5d
  - Bold title (asset or term name)
  - Context line (who raised it, team, short note)
  - Single CTA button per card
- Column header: name + count badge + avg wait time
- Smart features: drag-to-move, filter by type, overdue red border override, bulk select + resolve, calm empty-state illustrations

**Zone 2 — My Portfolio** (what you own/steward)
- Grid of assets, glossary terms, tags, domains assigned to you
- Health indicators per item
- Click → goes to asset profile

**Zone 3 — Recent Activity** (passive awareness feed)
- Scoped to assets/terms/tags you personally own or steward
- Read-only, no actions needed
- Examples: new columns detected on your table, DQ score dropped, tag applied by someone, lineage changed upstream, glossary term you steward was edited
- NOT a full audit log (that's Settings → Audit)
- NOT team-wide — personal scope only

---

## Steward Capability Matrix

| Resource | Steward Actions | Trigger |
|---|---|---|
| Data Asset (table, view, dashboard) | Certify, Decertify, Edit description, Link glossary, Apply/remove tags, Assign owner, Deprecate | System or user request |
| Business Glossary Term | Approve new, Approve edit, Reject with feedback, Merge duplicates, Deprecate, Link to assets | Analyst or Data Owner submits |
| Tag | Approve application, Reject application, Resolve conflict | Auto-rule or manual request |
| Data Quality | Acknowledge failure, Suppress false positive, Escalate to owner, Mark resolved | DQ test run (automated) |
| Orphaned Asset | Assign owner, Assign steward, Flag for deprecation, Link to domain | System detects |
| Lineage | Approve manual edit, Reject with reason | Data Engineer submits |
| Data Contract | Review & sign off, Flag violation, Request renegotiation | System breach or Owner submits |
| Access Request | Recommend approval/rejection (advisory only) | User requests access |

### What a Steward CANNOT Do
- Grant / revoke actual data access (Data Owner or Admin)
- Create or delete tags (Tag Admin)
- Create or delete domains (Platform Admin)
- Run ingestion pipelines (Connector Admin)
- Edit users / teams (Platform Admin)
- Override a rejection from an owner

### Three-Tier Access Model
- Tier 1 — Metadata rights: read + edit descriptions, tags, glossary links
- Tier 2 — Approval rights: approve/reject submissions on assigned assets
- Tier 3 — Governance rights: certify, deprecate, assign ownership

All tiers scoped to assigned assets only.

---

## Outstanding Decision (answer before building)
- Kanban column structure confirmed: Incoming / In Review / Pending Response / Resolved ✅
- Todo/Done rejected in favour of 4-column workflow ✅
- Zone 3 clarified as passive awareness feed ✅
- Capability matrix defined ✅
