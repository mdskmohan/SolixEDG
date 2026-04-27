---
name: Session Summary — RBAC + Jira Cleanup (2026-04-27)
description: Full context of RBAC decisions, Jira story updates, and prototype changes made in this session
type: session-log
date: 2026-04-27
---

## What Was Done This Session

### 1. Prototype Changes (solix-platform-v2.jsx)

**Commit `c61870e`** — RBAC: add Viewer default role, replace catalog with actual asset resources
- Replaced `catalog` resource with `database`, `databaseSchema`, `table`, `container` in all 3 system policies (PlatformAdminPolicy, ConnectionAdminPolicy, DataStewardPolicy)
- Added `ViewerPolicy` (pol4) with 5 ViewBasic-only rules
- Added `Viewer` as 4th default role (purple `#7c3aed`)
- Updated ROLE_COLORS_AC to include Viewer

**Commit `63cee1c`** — fix: Admin is the only system role, Connection Admin/Steward/Viewer are editable default roles
- Set `system:false` on Connection Admin, Steward, Viewer roles (r2, r3, r4)
- Set `system:false` on ConnectionAdminPolicy, DataStewardPolicy, ViewerPolicy (pol2, pol3, pol4)
- Only Admin (r1) and PlatformAdminPolicy (pol1) retain `system:true`

---

### 2. Jira Story Updates

**RBAC stories — all under epic EDG-45 (Settings – Access Control) and EDG-544:**

#### Marked DELETE:
| Story | Reason |
|---|---|
| EDG-589 | Direct policy-to-user/team assignment — not in prototype |
| EDG-590 | Enforce RBAC on UI/API — engineering NFR, not a user story |
| EDG-584 | Duplicate of EDG-48 (Change a User's Platform Role) |

#### Renamed with LDAP prefix:
| Story | New Title |
|---|---|
| EDG-593 | LDAP - Map LDAP groups to EDG roles for automatic role assignment |
| EDG-596 | LDAP - View LDAP-synced users and their role assignments |

#### Updated (major rewrites):
| Story | What Changed |
|---|---|
| EDG-583 | Title: "View default roles, permission matrix, and role detail panel in Access Control". Full rewrite: 4 default roles table, permission matrix per role with correct resources, role detail panel UI, RBAC table, edge cases |
| EDG-585 | Updated to cover all 4 roles including Viewer |
| EDG-586 | Fixed resource list (replaced `catalog` with actual types), updated context to reference 4 default roles |

#### Left untouched (correct as-is):
- EDG-587 (Edit access policy), EDG-588 (Delete access policy)
- All April stories: EDG-48, 54, 55, 56, 57, 58, 59, 60, 61, 104, 105, 106, 107

---

### 3. Tag Management Jira Updates (from earlier in session)

- EDG-565: Removed propagation and connector alias from Create Tag user story
- Stories related to Assignment tab: marked DELETE in title

### 4. Connections Jira Cleanup (from earlier in session)

- Old connections stories EDG-573 through EDG-582: marked DELETE in title
- New epics created:
  - Settings - Connections (EDG-609, 610, 611, 612)
  - Settings - Connections - Add Connections (EDG-613 = common wizard flow, EDG-599–605 = connector-specific child stories)
- EDG-613 description was rewritten to fix double-escaped newlines (gibberish issue)

---

## Current RBAC Jira Story State

| Story | Label | Status | Notes |
|---|---|---|---|
| EDG-45 | (none) | InProgress | Epic: Settings – Access Control (RBAC) |
| EDG-48 | EDG-Q2-APR | QA InProgress | Change a User's Platform Role — **DO NOT TOUCH** |
| EDG-54 | EDG-Q2-APR | Ready for QA | Create a New Role — **DO NOT TOUCH** |
| EDG-55 | EDG-Q2-APR | QA InProgress | Create a Policy with Inline Rules — **DO NOT TOUCH** |
| EDG-56 | EDG-Q2-APR | QA InProgress | Add a Rule to an Existing Policy — **DO NOT TOUCH** |
| EDG-57 | EDG-Q2-APR | QA InProgress | Edit an Existing Rule on a Policy — **DO NOT TOUCH** |
| EDG-58 | EDG-Q2-APR | New | Delete a Rule from a Policy — **DO NOT TOUCH** |
| EDG-59 | EDG-Q2-APR | Ready for QA | Attach a Policy to a Role — **DO NOT TOUCH** |
| EDG-60 | EDG-Q2-APR | Ready for QA | Detach a Policy from a Role — **DO NOT TOUCH** |
| EDG-61 | EDG-Q2-APR | InProgress | Enable or Disable a Policy — **DO NOT TOUCH** |
| EDG-104 | EDG-Q2-APR | New | Rule Editor Modal — **DO NOT TOUCH** |
| EDG-105 | EDG-Q2-APR | New | System Roles (note: calls them system roles, language not updated since April) — **DO NOT TOUCH** |
| EDG-106 | EDG-Q2-APR | New | System Policies Catalogue — **DO NOT TOUCH** |
| EDG-107 | EDG-Q2-APR | New | Domain-Scoping for Data Steward — **DO NOT TOUCH** |
| EDG-544 | Q2-MAY-2026 | New | Epic: Access Control (4-role model) |
| EDG-583 | Q2-MAY-2026 | New | ✅ Updated: View default roles, permission matrix, and role detail panel |
| EDG-584 | Q2-MAY-2026 | New | DELETE - Duplicate of EDG-48 |
| EDG-585 | Q2-MAY-2026 | New | ✅ Updated: Revoke a role (all 4 roles including Viewer) |
| EDG-586 | Q2-MAY-2026 | New | ✅ Updated: Create access policy (correct resource list) |
| EDG-587 | Q2-MAY-2026 | New | Edit an existing access policy — OK as-is |
| EDG-588 | Q2-MAY-2026 | New | Delete an access policy — OK as-is |
| EDG-589 | Q2-MAY-2026 | New | DELETE - Direct policy-to-user assignment (not in prototype) |
| EDG-590 | Q2-MAY-2026 | New | DELETE - Enforce RBAC on UI/API |
| EDG-593 | Q2-MAY-2026 | New | LDAP - Map LDAP groups to EDG roles — KEEP, important |
| EDG-596 | Q2-MAY-2026 | New | LDAP - View LDAP-synced users — KEEP, important |

---

## Key Decisions Made

1. **4 roles confirmed**: Admin (system), Connection Admin (default), Steward (default), Viewer (default)
2. **Viewer is a default role** provisioned for every new tenant automatically
3. **Admin is the ONLY system role** — cannot be edited or deleted. Other 3 can be edited/deleted by Admin.
4. **`catalog` is not a resource** — replaced by: `database`, `databaseSchema`, `table`, `container`
5. **`storedProcedure` not supported** — removed from all role definitions
6. **`container` covers**: S3 (bucket/folder/object) + Azure Blob (container/folder/blob) via OpenMetadata's container resource type
7. **LDAP stories kept** — EDG-593 and EDG-596 are important, just renamed with LDAP prefix
8. **No June stories exist** — searched all June label variants, 0 results
9. **April stories are untouchable** — EDG-Q2-APR label = do not change, add new stories if something is missing

---

## Pending / Not Yet Done

- No outstanding Jira or prototype tasks from this session
- If new RBAC stories are needed in future, use May label `Q2-MAY-2026` and add to epic EDG-544
