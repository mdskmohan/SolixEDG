# Solix EDG — Sales/Demo Deck · Content Blueprint (v2, CODE-VERIFIED)

> **Product:** Solix EDG — **Enterprise Data Governance**.
> **Audience:** net-new prospects (EDG is a brand-new product — no customers yet). Social proof leans on Solix's company track record, not EDG references.
> **Source of truth:** the actual prototype code only (`solix-platform-v2.jsx`, ~28.6k lines) plus developer context notes (`docs/context/rbac_roles.md`). The Product Definition Document was deliberately **NOT used** (per your note that it contains errors). Every product slide below is marked **[BUILT]**, **[LIGHT]** (exists but shallow), or **[ROADMAP — exclude]**. Nothing marked ROADMAP goes in the demo deck.
> **Note:** the prototype is currently branded as a "Johnson & Johnson Data Governance" demo instance — for the deck I'll use neutral Solix EDG branding.

---

## What the prototype actually ships today (verified)

**Fully built, demoable modules** (deep implementations):
Home/governance dashboard · Global Search · Data Catalog (asset profiles, certifications) · Data Lineage (asset & column) · Business Glossary · Tags & Classifications · Data Quality (tests, scores, incidents) · Policy Manager (policies → rules → conditions, domain-scoped RBAC) · Roles & Permissions (4 default roles + custom, permission matrix) · Teams & Users · Data Domains · Data Products · Stewardship Inbox & Approval Workflows · Certifications · Compliance / Regulation Linking (GDPR, CCPA, HIPAA, SOC 2) · Analytics / Reports & Dashboards · Audit Logs · Notifications · Settings (incl. LDAP/SSO group→role mapping) · Integrations · Access Requests.

**Connectors / source types represented:** Snowflake, Databricks, Oracle, MySQL, Postgres, Amazon S3, Azure Blob (the doc's "validated" set). Demo data also references BigQuery, Redshift, Kafka, dbt, Tableau, Salesforce.

**Lighter (exists, but shallow today):** Data Contracts · Observability (pipeline/SLA).

**Asset types supported (from rbac_roles.md):** database, database schema, table/view, container (S3 bucket/folder/object, Azure Blob container/folder/blob). **Stored procedures are NOT in scope.**

**NOT built / excluded (do not put in deck):**
AI Governance (aspirational only — no real module) · **LDAP** (you've confirmed you're not doing LDAP) · data masking & encryption · automated classification/policy suggestion · pre-deploy data-contract enforcement · behavioral usage analytics · model-dataset registries · multi-cloud federated *enforcement* · the "Organization → Workspace" hierarchy (barely present in the UI).

---

## Section A — Framing

**Slide 1 · Title**
- **Solix EDG — Enterprise Data Governance**
- Tagline (pick one): *"Discover, understand, trust, and control your data — across the entire enterprise."* / *"Trusted data as the default state of your enterprise."*
- Placeholders: [Customer Name] · [Presenter | Title] · [Date]

**Slide 2 · Agenda** — Introductions · Our Understanding · Company Overview · The Governance Problem · Solix EDG Solution · How It Works (Demo) · Why Solix EDG · Q&A

**Slide 3 · Our Understanding** *(discovery placeholders, filled per prospect)* — Problem Statement · Business Drivers · Data Estate (sources/volumes) · Technical Details

**Slide 4 · About Solix Technologies** *(reuse)* — Founded 2002 · 500+ employees · 100+ PBs processed · 8 global offices · Santa Clara, CA. Pillars: Common Data Platform · Enterprise Data Preservation · Data Governance & Security · Enterprise AI.

**Slide 5 · Built on a Proven Data Platform** *(replaces customer-logo slide — EDG is new)* — credibility from Solix the company + the CDP/EDP foundation EDG is built on. *(Or drop — your call.)*

**Slide 6 · Partner Ecosystem** *(reuse, optional)* **[CONFIRM keep/drop]**

---

## Section B — Problem narrative (governance-focused, backed by the doc's industry context)

**Slide 7 · Why Data Governance Matters Now** — data grew faster than the ability to govern it; AI raises the stakes for trusted data; regulation keeps expanding; ungoverned data = cost, risk, rework. *(No specific market stats unless you give me a verified source.)*

**Slide 8 · The Reality of Ungoverned Data** — data scattered across clouds/warehouses; unclear ownership; conflicting definitions; governance run on spreadsheets and email.

**Slide 9 · What Breaks Without Governance** (4 quadrants) — can't find/trust data → duplicated work; no classification → sensitive data exposed; inconsistent policy/access → compliance & breach risk; no lineage/audit → audit failures.

**Slide 10 · The Trade-off Today** — heavyweight legacy suites (powerful but slow/costly) vs. lightweight catalogs (fast but thin on access control/compliance). EDG aims to close the gap. *(Generic framing — confirm you're comfortable with it.)*

---

## Section C — The Solix EDG Solution (CODE-VERIFIED — this is the heart of the demo)

**Slide 11 · Positioning** — *Discover · Trust · Govern · Comply* (four pillars drawn from what's built). **[CONFIRM wording]**

**Slide 12 · EDG at a Glance** — single platform over a central metadata repository: Catalog · Glossary · Quality · Lineage · Classifications · Domains · Data Products · Policy/RBAC · Stewardship Workflows · Compliance · Audit. **[BUILT]**

**Slide 13 · The Governance Lifecycle** — *Discover → Classify → Govern → Monitor → Improve → Audit* (matches the doc's model and the built modules). **[BUILT]**

### Capability deep-dives (each maps to a real, demoable screen)

**Slide 14 · Discover: Data Catalog, Metadata & Lineage** **[BUILT]**
- Automated metadata catalog of databases, schemas, tables, storage containers
- Asset profiles + certification signals; global search across assets & metadata
- Asset- and column-level data lineage for impact analysis & provenance

**Slide 15 · Understand: Business Glossary, Tags & Classifications** **[BUILT]**
- Business glossary with controlled vocabulary and steward approvals
- Tags & sensitivity classifications applied across assets
- Classification drives downstream policy and compliance

**Slide 16 · Trust: Data Quality (+ Contracts)** **[BUILT; Contracts LIGHT]**
- Data-quality tests, quality scores, incident workflows and alerts
- Producer/consumer data contracts *(present but lighter — keep at high level)*

**Slide 17 · Govern: Domains, Teams, Roles & Policy (RBAC)** **[BUILT — strongest area]**
- Teams, Users, Roles & Permissions model
- Four roles (Admin = system/non-deletable, Connection Admin, Steward, Viewer) + custom roles, each backed by a policy
- Policy Manager: policies → inline rules → conditions, with **domain-scoped** least-privilege permissions; reversible, auditable policy management; permission matrix
- Data Domains & Data Products with team-based ownership

**Slide 18 · Operate: Stewardship Inbox & Approval Workflows** **[BUILT]**
- Stewardship inbox / work queues; multi-step approval & certification workflows
- Access-request workflow (request → approve, written to audit log)
- *(No LDAP. SSO provisioning — confirm if you want it mentioned or leave out.)*

**Slide 19 · Comply: Regulation Linking & Audit** **[BUILT]**
- Link regulations (GDPR, CCPA, HIPAA, SOC 2) to classified data, ownership, and policy
- Immutable audit logs; compliance posture dashboards & notifications

**Slide 20 · Connectivity** **[BUILT — metadata ingestion]**
- Connectors for Snowflake, Databricks, Oracle, MySQL, Postgres, Amazon S3, Azure Blob
- *(Note: ingestion is metadata/lineage/profiling — not data movement.)*

**Slide 21 · End-to-End Demo Flow** (numbered, mirrors the ECS flow slide) — proposed:
1. Connect a source → metadata auto-ingested into the Catalog
2. Steward curates: glossary terms, tags/classifications, certification
3. Quality tests run → scores & incidents surfaced
4. Policy Manager enforces domain-scoped, role-based access
5. Approval workflow routes requests; everything written to the Audit Log
6. Compliance view links regulations to classified assets
**[CONFIRM this is the path you'll demo live]**

---

## Section D — Close

**Slide 22 · Why Solix EDG** — differentiators grounded in what's actually built: domain-scoped RBAC + reversible policy management · compliance/regulation linking (GDPR, CCPA, HIPAA, SOC 2) tied to classified data · stewardship workflows + immutable audit trail · unified catalog/glossary/quality/lineage in one platform. **[CONFIRM / edit — tell me your real differentiators; I won't invent competitive claims.]**

**Slide 23 · Competitive comparison** — *removed for now.* Any competitor positioning needs to come from you, not from the doc. **[Tell me if you want one and supply the points.]**

**Slide 24 · CTA / Contact** — request a personalized demo. Contact: www.solix.com · info@solix.com · 408.654.6400 · Santa Clara, CA. **[CONFIRM demo email + whether a trial exists]**

---

## Decisions I still need from you
1. **AI Governance** — leave out entirely (current plan), or one forward-looking "roadmap" slide?
2. **Data Contracts & Observability** — keep light or drop?
3. **SSO provisioning** — mention it (no LDAP), or leave access provisioning out?
4. **Tagline** + which **differentiators** to feature (slide 22) — give me your real ones.
5. **Branding** — confirm strip J&J demo branding, use neutral Solix EDG.

## Confirmed exclusions (won't appear in deck)
Product Definition Document content · LDAP · AI Governance (unless you opt for a roadmap slide) · data masking/encryption · market stats & competitor claims unless you supply verified ones · Organization/Workspace hierarchy.
