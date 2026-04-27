---
name: RBAC Role Policy Definitions
description: Finalized 4 default roles with resources and operations for Solix EDG — Admin (system), Connection Admin, Steward, Viewer
type: project
lastUpdated: 2026-04-27
---

## Overview

Solix EDG uses a 4-role model. Every new tenant is provisioned with these 4 roles on creation.

| Role | Type | Policy | Can Edit? | Can Delete? |
|---|---|---|---|---|
| Admin | **System** | PlatformAdminPolicy | No | No |
| Connection Admin | Default | ConnectionAdminPolicy | Yes | Yes |
| Steward | Default | DataStewardPolicy | Yes | Yes |
| Viewer | Default | ViewerPolicy | Yes | Yes |

**Admin is the only system role** — it cannot be deleted and its policy (PlatformAdminPolicy) cannot be edited. The other 3 are default roles pre-configured on tenant creation but editable/deletable by an Admin.

---

## Supported Data Asset Resources

These are the actual data objects Solix EDG supports across its connectors. There is no `catalog` resource — it is replaced by the specific asset types below.

| Resource | Covers |
|---|---|
| `database` | Snowflake, Databricks, Oracle, MySQL, Postgres |
| `databaseSchema` | Snowflake, Databricks, Oracle, MySQL, Postgres |
| `table` | Tables and views across all relational DBs |
| `container` | S3 (bucket/folder/object) + Azure Blob (container/folder/blob) |

> Stored procedures are NOT supported in current scope.

---

## Role 1: Admin — `PlatformAdminPolicy` (system, read-only)

| Resource | Operations |
|---|---|
| `database` | ViewBasic, Create, Edit, Delete, EditDescription, EditOwner, EditSteward, EditTags, EditStatus |
| `databaseSchema` | ViewBasic, Create, Edit, Delete, EditDescription, EditOwner, EditSteward, EditTags, EditStatus |
| `table` | ViewBasic, ViewTests, Create, Edit, Delete, EditDescription, EditOwner, EditSteward, EditTags, EditStatus, TriggerIngestion |
| `container` | ViewBasic, Create, Edit, Delete, EditDescription, EditOwner, EditSteward, EditTags, EditStatus |
| `connection` | ViewBasic, Create, Edit, Delete, TestConnection, EditStatus |
| `workflow` | ViewBasic, Create, Edit, Delete, EditStatus, TriggerIngestion |
| `tagCategory` | ViewBasic, Create, Edit, Delete |
| `tag` | ViewBasic, Create, Edit, Delete, EditStatus |
| `user` | ViewBasic, Create, Edit, Delete, EditRole |
| `team` | ViewBasic, Create, Edit, Delete, EditUsers, EditTeam |
| `role` | ViewBasic, Create, Edit, Delete, EditRole |
| `domain` | ViewBasic, Create, Edit, Delete |
| `glossary` | ViewBasic, Create, Edit, Delete |
| `glossaryCategory` | ViewBasic, Create, Edit, Delete |
| `glossaryTerm` | ViewBasic, Create, Edit, Delete, EditStatus |
| `testDefinition` | ViewBasic, Create, Edit, Delete |
| `testCase` | ViewBasic, Create, Edit, Delete, TriggerIngestion, AcknowledgeIncident, AssignIncident, ResolveIncident |
| `policy` | ViewBasic, Create, Edit, Delete, Apply, EditPolicy |
| `certification` | ViewBasic, EditStatus, Delete |
| `accessRequest` | ViewBasic, Approve, Revoke, Delete |
| `settings` | ViewBasic, Edit |
| `stewardshipInbox` | ViewBasic |

---

## Role 2: Connection Admin — `ConnectionAdminPolicy` (editable default)

| Resource | Operations |
|---|---|
| `connection` | ViewBasic, Create, Edit, Delete, TestConnection, EditStatus |
| `workflow` | ViewBasic, Create, Edit, Delete, EditStatus, TriggerIngestion |
| `database` | ViewBasic |
| `databaseSchema` | ViewBasic |
| `table` | ViewBasic |
| `container` | ViewBasic |
| `tagCategory` | ViewBasic |
| `tag` | ViewBasic |

---

## Role 3: Steward — `DataStewardPolicy` (editable default, domain-scoped)

| Resource | Operations |
|---|---|
| `database` *(domain-scoped)* | ViewBasic, EditDescription, EditOwner, EditTags, EditStatus |
| `databaseSchema` *(domain-scoped)* | ViewBasic, EditDescription, EditOwner, EditTags, EditStatus |
| `table` *(domain-scoped)* | ViewBasic, ViewTests, TriggerIngestion, EditDescription, EditOwner, EditTags, EditStatus |
| `container` *(domain-scoped)* | ViewBasic, EditDescription, EditOwner, EditTags, EditStatus |
| `tagCategory` | ViewBasic |
| `tag` | ViewBasic, EditTags |
| `glossary` | ViewBasic |
| `glossaryCategory` | ViewBasic, Create, Edit |
| `glossaryTerm` | ViewBasic, Create, Edit, EditStatus |
| `certification` | ViewBasic, EditStatus |
| `testDefinition` | ViewBasic |
| `testCase` | ViewBasic, Create, Edit, Delete, TriggerIngestion, AcknowledgeIncident, AssignIncident, ResolveIncident |
| `accessRequest` | ViewBasic, Approve, Revoke |
| `policy` | ViewBasic |
| `stewardshipInbox` | ViewBasic, Resolve |

Domain-scoping is enforced via condition `hasDomain()` on all data asset rules.

---

## Role 4: Viewer — `ViewerPolicy` (editable default)

| Resource | Operations |
|---|---|
| `database` | ViewBasic |
| `databaseSchema` | ViewBasic |
| `table` | ViewBasic |
| `container` | ViewBasic |
| `tagCategory` | ViewBasic |
| `tag` | ViewBasic |
| `glossary` | ViewBasic |
| `glossaryCategory` | ViewBasic |
| `glossaryTerm` | ViewBasic |
| `certification` | ViewBasic |
| `testDefinition` | ViewBasic |
| `testCase` | ViewBasic |

---

## Key Design Decisions

- `catalog` is NOT a resource — replaced by database/databaseSchema/table/container
- `storedProcedure` is NOT supported in current scope
- `EditStatus` covers all status changes (active/inactive connections, certified/deprecated assets, approved/rejected terms)
- Steward cannot hard delete anything — only deprecate/reject via EditStatus. Only Admin deletes.
- Steward is domain-scoped — operations on data assets apply only within assigned domain
- Only Admin carries the System badge in the UI
- ViewTests on table = ability to see DQ test results on that asset
- TriggerIngestion on table/workflow = ability to run ingestion/DQ runs

---

## Deferred (out of scope this sprint)

- Tag sync / reverse sync / source mappings
- Tag propagation configuration
- Conflict resolution (tag conflicts, inbox conflicts from sync)
- `testSuite` resource (not built yet)
- `ViewAll` operation (using ViewBasic only)
- `storedProcedure` resource

---

## Prototype Implementation

In `solix-platform-v2.jsx`, the AccessSection component (lines ~13430–14273):
- `pol1` (PlatformAdminPolicy): `system:true`
- `pol2` (ConnectionAdminPolicy): `system:false`
- `pol3` (DataStewardPolicy): `system:false`
- `pol4` (ViewerPolicy): `system:false`
- `r1` Admin: `system:true`, color `#ee2424`
- `r2` Connection Admin: `system:false`, color `#0891b2`
- `r3` Steward: `system:false`, color `#d97706`
- `r4` Viewer: `system:false`, color `#7c3aed`
- ROLE_COLORS_AC includes all 4 roles
