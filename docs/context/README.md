# Project Context

This folder contains design decisions, session logs, and reference documents for the Solix EDG prototype. Any account or session working on this repo should read these files first.

## Files

| File | What it covers |
|---|---|
| [rbac_roles.md](rbac_roles.md) | **START HERE for RBAC work.** 4 default roles (Admin/Connection Admin/Steward/Viewer), full resource/operation tables, prototype implementation details |
| [session_2026_04_27_rbac_jira.md](session_2026_04_27_rbac_jira.md) | Session log from 2026-04-27: all Jira stories updated/deleted/renamed, prototype commits, key decisions |
| [stewardship_redesign.md](stewardship_redesign.md) | Parked stewardship/My Workspace redesign — 3-zone layout, kanban, capability matrix. Resume before building. |
| [jira_story_format.md](jira_story_format.md) | Exact Jira user story format the PM uses. Follow this for every new story. |

## Quick Reference

- **Jira project**: EDG — solixjira.atlassian.net (cloudId: `40818818-e33a-4031-81ec-e93f0010c980`)
- **GitHub repo**: mdskmohan/SolixEDG — always commit and push after every code change
- **Prototype file**: `solix-platform-v2.jsx` (root of repo)
- **April Jira stories (EDG-Q2-APR label)**: DO NOT TOUCH — in QA/dev. Add new stories if something is missing.
- **May Jira stories (Q2-MAY-2026 label)**: Active sprint, can be updated.

## RBAC Quick Summary

4 roles provisioned on every new tenant:
- **Admin** — system role, cannot be deleted, full platform access
- **Connection Admin** — default, editable, manages connections + workflows
- **Steward** — default, editable, domain-scoped governance
- **Viewer** — default, editable, read-only everywhere

Data asset resources (no `catalog`): `database`, `databaseSchema`, `table`, `container`
