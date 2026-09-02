# PRD — EDG Knowledge Layer

**Owner:** Mohan (EDG Product) · **Status:** Draft for engineering pickup · **Date:** 2026-09-02
**Prototype:** `solix-platform-v2.jsx` → Knowledge Layer (nav key `knowledgelayer`), commit `1783618`
**Logic test:** `node kltest.cjs` — 49 assertions over the pure logic, must stay green

> **Revision note (2026-09-02).** An earlier draft of this PRD stated that match keys are derived
> from EDG classifications, and recommended that EDG "link, not master". Both were wrong. A
> classification and an identifier role are different concepts, and the strategic fork was already
> decided the other way on 2026-08-25: **EDG builds and governs the cross-source graph, resolver
> included.** §2, §3, §4, §5, KL-4, KL-5 and §8–§9 have been corrected, and KL-15 … KL-18 added
> for work that is now built. Sections marked **BUILT** are implemented in the prototype.

---

## 1. The problem, in one example

The company buys from **GAF Materials**. GAF exists three times:

| System | Name stored | Local ID | Tax ID |
|---|---|---|---|
| SAP ECC | GAF Corp | 4471 | 04-1181920 |
| Oracle EBS | GAF | V10293 | 04-1181920 |
| Oracle Fusion | G.A.F. | SUP-88 | 04-1181920 |

Ask *"what do we spend with GAF?"* and there is no answer, because no system knows those rows are one company. Finance reconciles by hand. Procurement cannot see total exposure to a supplier. Nobody can prove a number.

Two things are missing:

1. **Agreement** — a single definition of "Supplier" and which table represents it in each system.
2. **Resolution** — the knowledge that these three rows are one company, and which value to trust when they disagree.

---

## 2. What already exists (do not rebuild)

| Component | Where it lives | What it does |
|---|---|---|
| **AKG** (Application Knowledge Graph) | Data Sense | The AI's map of **one** application: tables, columns, relationships, meanings. One per connection. |
| **XKG builder** | Data Sense | 6 steps — Scope → Discover → Resolve → Curate → Terms → Publish. Runs the matching, holds a steward queue, certifies terms, publishes versioned views. |
| **EDG governance objects** | EDG | Classifications & Tags, Business Glossary, Domains, Owners/Stewards, Policy Manager, Data Contracts, Inbox, Lineage. |
| **EDG Knowledge Layer** | EDG — **already built** | Registers and governs source graphs, builds and governs cross-source graphs, exposes the entity model as a graph, and gates record-level access. |

**Already implemented in the Knowledge Layer — do not re-specify.** These exist in the prototype
and are covered by `kltest.cjs`. Engineering should read the code before picking up any story
that touches them:

| Capability | What it does |
|---|---|
| **Provenance envelope** | Every proposed fact carries `{by, src, conf, state}` plus an append-only history, surfaced in a history drawer. Nothing in the graph is unattributable. |
| **Worklist** | Ranks open exceptions by `governs × (1 − confidence)`, so the most expensive doubt is worked first. Bulk confirm commits as one audited transaction. |
| **Trust dial** | Per-object-type confidence threshold with a live preview of what it would auto-confirm, admin-gated and routed through the Inbox. |
| **Certified measures** | Binds one certified term to the column or expression implementing it per application (the Vendor Spend case across EKKO/EKPO, RBKP and BSIK/BSAK). Certifying writes through to the Glossary. **This is what KL-12 asked for.** |
| **Resolution descriptors** | Matching is declared as structured descriptors, never stored SQL; the resolver compiles its own SELECT. Includes guards for degenerate technical primary keys and composite-key masters it honestly reports as not generatable. |
| **Generated build (Mode 2)** | Compiles the governed model to dbt artifacts with a regeneration contract: a no-change regeneration proposes nothing, an engineer's custom block survives, and a steward decision changes only the decision-stamped crosswalk — never a SQL model under review. |
| **Identifier roles** | Types every identifier column and makes an invalid cross-source key unrepresentable. See KL-15 … KL-17. |

**Architectural principles**

1. **Do not re-implement resolution.** Matching, clustering and survivorship *execution* stay in the resolver. EDG owns the governed model, the vocabulary, the decisions and the exceptions.
2. **EDG builds and governs the cross-source graph — decided 2026-08-25.** The resolver runs
   inside EDG rather than being consumed from elsewhere. EDG does **not** write back to source
   systems and is **not** in any transaction path: source systems stay authoritative for their
   own rows. The category risk this creates is the false merge, and §3 and KL-16 are the
   controls against it, not arguments against the decision.
3. **Every merge must be reversible.** Crosswalks are retained precisely so a steward decision can be undone. A false merge is the failure mode that permanently destroys trust in this feature.
4. **Match keys are derived from identifier roles, never authored twice.** A classification says
   what the data *is*; an identifier role says what the column can be *used for*. Neither implies
   the other — a vendor code identifies a supplier while carrying no classification, and a Tax ID
   classification says a column is sensitive, not that it is safe to match on. A steward confirms
   the role; the key list is a consequence of it. Where no column identifies an entity across
   systems, that is reported as a governance gap with a fix path, never worked around by
   hand-entered rules.

---

## 3. Market position (validated 2026-08-24)

- **No data catalog vendor ships entity resolution / golden records.** Not OpenMetadata/Collate, Collibra, Atlan, data.world, Purview or Apache Atlas. Collibra partners with Reltio; Informatica owns both but as separate products. **Cross-source golden records inside a governance product is unoccupied territory.**
- **"Knowledge graph" is a data model + UI + workflow, not a graph database.** OpenMetadata ships its Knowledge Graph tab with "no separate graph database"; its RDF/Fuseki triplestore is beta, disabled by default, dual-write, with no documented consistency guarantees. Only data.world is RDF-native (now inside ServiceNow). **Decision: model the graph over the existing relational store. Do not adopt a triplestore.**
- **Term-to-column binding is table stakes — and is already built.** Collibra Semantic Agents do ML-suggested physical-column mapping with steward acceptance. EDG reached parity with Certified measures (see §2); KL-12 is therefore closed, not pending.
- **The open lane is enforcement.** No vendor turns "this column implements certified term *Customer PII*" into automatic masking / retention / access enforcement. EDG already owns Policy Manager and in-place enforcement, so this is our defensible extension.
- **Two-view convention is emerging.** OpenMetadata pairs an *asset-centric* graph (start from a table) with a *concept-centric* one (start from a business term). Worth matching.

### The MDM side — and the warning that comes with it

- **The absence of catalog-native golden records is a signal, not an opening.** Purview, Collibra, Alation and Atlan all had the adjacency, the metadata and the funding, and all four chose to **partner** instead. Purview's MDM documentation is entirely partner integrations (CluedIn, Profisee, Reltio, Semarchy). Any plan to own mastering needs an explicit argument for why four well-resourced competitors were wrong.
- **Convergence is real but flows the other way.** Ataccama, Informatica/IDMC, Semarchy and Syniti do ship catalog + MDM in one platform — but every one of them **built the mastering engine first and added the catalog later**. No discovery-catalog vendor has ever shipped a match/merge/survivorship engine. That direction is harder: MDM is a write-path operational system with SLAs, a permanent stewardship queue, source write-back and undo semantics. A catalog is read-mostly and tolerates staleness.
- **~75% of MDM programmes fail to meet their business objectives** (widely attributed to Gartner), and ~90% of them never instrument a single business KPI. The dominant technical failure is the **false merge**: fusing two different companies. One visible false merge and the business stops trusting the golden record permanently — and unmerging does not undo the downstream damage.
- **Graph does not improve matching accuracy.** Even CluedIn, a graph-native MDM vendor arguing its own book, concedes this. Graph makes resolved entities explorable; it does not make resolution correct. Do not position the graph as the answer to match quality.
- **Our natural asset is the match key, not the match engine.** Classifications, tags, glossary terms and profiling statistics are exactly the raw material for identifying candidate identifying columns. Every specialist names hand-configured match rules as the biggest cost in the category — Senzing sells "no tuning", Tamr sells "no rule maintenance". Deriving match keys from governance the customer already maintains is a genuinely catalog-shaped capability and is defensible. *"We are your system of record for Customer"* is not, unless the company intends to fund an MDM programme.

### Resulting positioning decision — settled 2026-08-25

**EDG builds and governs the cross-source graph, resolver included.** The market findings above
are not an argument against that decision; they are the list of ways it fails if built carelessly,
and each one now has a named control:

| Risk from the market scan | Control in the product |
|---|---|
| The **false merge** is the failure mode that permanently destroys trust | Identifier roles make an invalid key *unrepresentable*, not merely discouraged (KL-16). Crosswalks retain every contributing source row, so every merge is reversible. |
| **Graph does not improve matching accuracy** | The graph is positioned as how resolved entities are explored and governed, never as the reason matching is correct. Accuracy claims rest on the keys and their evidence. |
| **Hand-configured match rules are the category's biggest cost** | Keys are derived from governance the customer already maintains — identifier roles confirmed once per source, with profiling as the evidence. No rule authoring. |
| **~75% of MDM programmes miss their objectives; ~90% instrument no KPI** | Every exception carries the money it governs, and the worklist ranks by it. The business number is present from the first screen rather than retrofitted. |
| Survivorship politics | Precedence is an explicit, recorded, per-field steward decision, not an inferred default. |

What EDG still does **not** do: write back to source systems, or sit in a transaction path. Source
systems remain authoritative for their own rows. Reading survivorship at query time rather than
materialising a merged row (the Reltio pattern) stays the preferred implementation where possible,
because it keeps a merge reversible in practice and not only in principle.

---

## 4. Scope

### In scope
Source Knowledge Graph registry, profile and graph view · Cross-source graph creation, profile and entity-level graph · **identifier roles and the match keys derived from them** · **inherited policy visibility, including where a masking policy blocks a key** · precedence (survivorship) decisions · record exceptions (conflicts and unmatched) · data-scan consent and audit · drift detection.

### Out of scope (this release)
The matching engine itself · a triplestore / SPARQL endpoint · authoring AKGs from scratch in EDG · Data Ask query execution · natural-language search over the graph.

### Explicitly deferred (tracked, not built)
Persona-scoped lineage · versioned published views with diff · value-chain classification · transaction-entity linking. See §7. *(Per-application term binding was on this list and is now built — see §2.)*

---

## 5. Key terms for engineering

| Term | Definition |
|---|---|
| **Source Knowledge Graph** | The governed representation of one AKG in EDG. One per connection. |
| **Cross-Source Knowledge Graph** | Built on ≥2 **published** source graphs. Produces trusted records for one business entity. |
| **Business Entity** | Governed vocabulary item (Supplier, Customer, Material). The join key across sources. |
| **Master table** | The table in a source that represents an entity. |
| **Identifier role** | What a column can be *used for*: `natural_key`, `name`, `contact` (valid across systems) or `local_code`, `technical_key`, `description` (valid only inside their own system). Its own concept — **not** a classification. |
| **Match key** | A business *concept* two rows are compared on (Tax ID, Legal Name). **Derived from the identifier roles a steward confirmed — never hand-authored, and never inferred from a classification.** |
| **Binding** | The physical column implementing a match key in one source. The same Tax ID concept is `STCD1` in SAP, `NUM_1099` in EBS and `TAXPAYER_ID` in Fusion. |
| **Weakest binding** | The lowest fill rate for a key across the sources being joined. This is what decides whether a key works, so it is what the builder shows. |
| **Usable key** | A declared match key the resolver is actually permitted to read. A masking policy with no resolver exemption removes a key from this set. |
| **Resolver exemption** | The audited grant that lets the resolver read a masked column. Without it, matching on that column would compare mask characters and merge everything. |
| **Precedence** | Which source wins per field when values disagree. Industry term: survivorship. |
| **Trusted record** | One resolved record per real-world entity, linked to its contributing source rows. |
| **Conflict** | Records matched, but sources hold different values for a field. |
| **Unmatched** | Present in one source with no counterpart found. |
| **Data scan** | The approved, audited act of reading rows in order to resolve records. |
| **Entity level / record level** | Entity level = metadata only, always available. Record level = requires a completed data scan. |

---

## 6. User stories

Priority: **P0** = required for first release · **P1** = required to reach parity · **P2** = backlog.

---

### KL-1 · View all source knowledge graphs — P0

#### User Story
As a data steward, I want to see every source knowledge graph in one list, so that I can tell which systems are mapped and which still need work.

#### Problem/Context
Source graphs are built per application and today there is no single place that shows their state. A steward cannot answer "which of our connected systems are mapped, and are any of them stale?" without opening each one.

#### Acceptance Criteria
1. Given I open Knowledge Layer, when I select the Source Knowledge Graphs tab, then I see one row per source graph with: name, ID, connection, scope (tables and columns), governed-vocabulary percentage, matchable entities, freshness, where it was created, and status.
2. Given the list is displayed, when I type in the search field, then rows filter on name, ID, connection, business entity and owner.
3. Given the list is displayed, when I select a status filter (All / Published / In review / Needs attention), then only matching rows remain and each filter shows its own count.
4. Given the list is displayed, when I change the sort control, then rows re-order by name, table count or most recently built.
5. Given a source graph has schema drift, when the list renders, then its freshness cell shows the number of columns added rather than "Current".
6. Given a source graph is not yet published, when the list renders, then its status shows its progress through the build steps instead of "Published".
7. Given my search or filter returns nothing, when the list renders, then an empty state appears with an action to clear the filters.
8. Given there are connected systems with no source graph, when the list renders, then a line below the table names them.

---

### KL-2 · Open a source knowledge graph profile — P0

#### User Story
As a data steward, I want a profile page for a source knowledge graph, so that I can see what it describes, how much of it is governed, and what depends on it.

#### Problem/Context
Once a source graph exists, a steward needs to judge whether it is trustworthy — whether its labels come from governed vocabulary, which entities it can match on, and what breaks if it changes. There is no such view today.

#### Acceptance Criteria
1. Given I select a source graph, when the profile opens, then a header shows its name, ID, status, version, and whether it was created in Data Sense or EDG.
2. Given the profile is open, when it renders, then a property strip shows connection, domain, owner, table count, column count, matchable entity count, last built date and freshness.
3. Given the profile is open, when it renders, then tabs are available for Overview, Knowledge Graph, Tables and Used by.
4. Given I am on Overview, when it renders, then I see counts for tables described, governed-vocabulary percentage, ungoverned labels, terms awaiting approval, and how many cross-source graphs consume this graph.
5. Given the graph has ungoverned labels, when Overview renders, then the count is displayed with a stated target of zero and an explanation that a non-zero value means vocabulary EDG does not govern.
6. Given the source has schema drift, when the profile opens, then a banner states how many columns were added since the last build and offers a review action.
7. Given I am on the Used by tab and no cross-source graph consumes this graph, when it renders, then an empty state explains how to join it with another published source.

---

### KL-3 · See the source knowledge graph as a graph — P0

#### User Story
As a data steward, I want to see a source knowledge graph drawn as a graph, so that I can understand at a glance how its tables relate and what governs them.

#### Problem/Context
A table list does not convey structure. A steward auditing a source needs to see which table is the master for an entity, how tables join, and which governed objects each table is bound to.

#### Acceptance Criteria
1. Given I open the Knowledge Graph tab, when it renders, then nodes are drawn for the source system, its tables and views, and the governed objects they bind to (business entity, business term, classification, owner).
2. Given the graph is rendered, when I inspect a node, then its type, name, and key attributes are visible on the node itself.
3. Given the graph is rendered, when edges are drawn, then each edge is labelled with its relationship (`contains`, `means`, `is a`, `classified as`, `owned by`) and structural edges are visually distinct from governance edges.
4. Given the graph is rendered, when I change the depth control, then only nodes within the selected number of steps from the source system remain visible.
5. Given the graph is rendered, when I toggle the governance control off, then governance nodes and their edges are hidden and only structural nodes remain.
6. Given the graph is rendered, when I type in the in-graph search field, then non-matching nodes are visually de-emphasised without being removed.
7. Given the graph is rendered, when I select a node, then it becomes the focused node and selecting it again clears the focus.
8. Given the graph has no mapped tables, when the tab renders, then an empty state is shown instead of a blank canvas.

---

### KL-4 · See what a source can actually be matched on — P0 · **BUILT**

#### User Story
As a data steward, I want to see what each entity in a source can actually be matched on, so that I know whether that source can participate in cross-source matching and what to fix if it cannot.

#### Problem/Context
A source that cannot be matched used to fail silently and produce no records, with no indication of why. The fix belongs in the source, so the source has to show the problem. "What it can be matched on" is narrower than "what identifies it": a column can identify an entity locally and still be invalid across systems, and a valid key can be unreadable because a policy masks it.

#### Acceptance Criteria
1. Given a table is the master table for an entity and has at least one usable match key, when the Tables tab renders, then its Match keys cell lists those keys as concepts.
2. Given a master table has identifier columns but none valid across systems, when the Tables tab renders, then its Match keys cell reports it as not matchable across sources, in a warning treatment, with the reason.
3. Given a table is not a master table for any entity, when the Tables tab renders, then its Match keys cell shows no value.
4. Given a master table declares no identity at all, when I request the fix, then guidance sends me to Entity & Identity in that source graph rather than to classifications.
5. Given match keys are displayed anywhere in the product, when they render, then they are derived from confirmed identifier roles and are never free-text authored, and never inferred from a classification alone.
6. Given a declared key is blocked by a masking policy with no resolver exemption, when the cell renders, then that key is excluded from what the source can be matched on, and the block is attributable to the named policy.

---

### KL-5 · Create a cross-source knowledge graph — P0

#### User Story
As a data steward, I want to create a cross-source knowledge graph in three steps, so that I can produce one trusted definition of a business entity across systems without configuring a matching engine.

#### Problem/Context
Most of what a cross-source graph needs is already known: the entity vocabulary exists, the source graphs exist, and the match keys follow from identifier roles already confirmed in each source. Only three things genuinely require a person — what to master, who wins on conflict, and whether data may be read. The flow must ask only those, and must show the evidence behind the keys rather than asking the user to trust them.

#### Acceptance Criteria
1. Given I start the flow, when step 1 renders, then I select a business entity and the published source graphs to join, and every source graph that is ready is pre-selected.
2. Given I select a business entity, when the entity list renders, then each entity shows how many published source graphs are ready for it.
3. Given a published source graph has no usable match key for the selected entity, when step 1 renders, then it is shown as not ready with the reason, and cannot be selected.
4. Given a source graph is not yet published, when step 1 renders, then it is listed as unavailable with an instruction to publish it first.
5. Given fewer than two source graphs are selected, when I try to advance, then advancing is blocked and a message states that at least two are required.
6. Given I change the selected entity, when the source list re-renders, then the selection resets to the source graphs that are ready for the new entity.
7. Given I reach step 2, when it renders, then candidate match keys are pre-populated from the identifier roles confirmed in the selected sources, each showing its role, whether it matches exactly or fuzzily, and how many of the selected sources carry it.
8. Given a candidate match key is present in every selected source, when step 2 renders, then it is marked as covering all sources and selected by default.
8a. Given a candidate match key is shown, when step 2 renders, then the physical column it binds to in each source is listed with that column's fill rate, and the weakest of those fill rates is stated as the key's strength.
8b. Given a selected key's weakest binding is below 80% populated, when step 2 renders, then it states approximately what proportion of rows will not match on that key and advises pairing it with a second key.
8c. Given a candidate covers fewer sources than are being joined, when step 2 renders, then it names the sources it does cover and states that rows in the remaining sources fall through to the other selected keys.
8d. Given an identifier column was excluded from matching, when step 2 renders, then it is listed separately as not available as a match key, with its role, its column in each source, and the reason — never simply omitted.
9. Given no match key is selected, when I try to advance from step 2, then advancing is blocked with a message stating at least one is required.
10. Given match keys are selected, when step 2 renders the precedence section, then I set a preferred source per selected field plus address, and the options are the selected sources or a rule such as most recently updated.
11. Given I reach step 3, when it renders, then owner, policy, business term and domain are pre-filled from the entity's domain.
12. Given I reach step 3, when it renders, then the tables a data scan would read are listed with their classifications shown, and I choose between publishing the model only, scanning a sample, or scanning all rows.
13. Given I choose to publish the model only, when I publish, then the graph is created at entity level with no records and no data is read.
14. Given I publish, when the graph is created, then the match keys and precedence decisions I made are persisted on it and visible on its profile.
15. Given a cross-source graph already exists with the same generated name, when I publish, then the new graph is given a distinct name rather than colliding.

---

### KL-6 · See a cross-source knowledge graph as an entity graph — P0

#### User Story
As a data steward, I want the cross-source graph drawn at entity level, so that I can see how a business entity is represented in each system and why those representations are considered the same thing.

#### Problem/Context
The value of a cross-source graph is the claim that separate objects represent one entity. That claim needs to be inspectable — not just asserted — and it must be viewable without reading any data.

#### Acceptance Criteria
1. Given I open the Knowledge Graph tab of a cross-source graph, when it renders, then nodes are drawn for each joined source system, its master table for the entity, the business entity itself, and the governance objects bound to it.
2. Given the graph renders, when the edge from a master table to the entity is drawn, then it is labelled with the match key that justifies the mapping.
3. Given the graph renders, when it completes, then no individual record nodes are drawn at any depth.
4. Given the graph renders, when the entity node is drawn, then it shows how many sources are joined and whether records have been scanned.
5. Given the graph renders, when the tab loads, then an explanatory line states that individual records are listed under Trusted records.
6. Given a joined source has no master table for the entity, when the graph renders, then its node still appears, marked as not matchable.

---

### KL-7 · Approve a data scan before records are resolved — P0

#### User Story
As a data owner, I want resolving records to require an explicit approval that names what will be read, so that reading production rows is a deliberate, recorded decision rather than a side effect of opening a screen.

#### Problem/Context
Everything up to the entity model is metadata and carries little risk. Producing trusted records means reading real rows, frequently including PII. That is a different level of access and must be consented to, attributed and audited.

#### Acceptance Criteria
1. Given a cross-source graph has no completed data scan, when I open it, then a notice states that only the model is available and offers to run a data scan.
2. Given I request a data scan, when the dialog opens, then it lists every table that will be read, grouped by source, with the classifications on those tables displayed.
3. Given the dialog is open, when it renders, then I choose between a sample scan and a scan of all rows, with the sample described as the lower-exposure option.
4. Given the dialog is open, when it renders, then it states that the scan runs as a background job, is attributed to the approving user, and is recorded in the audit log.
5. Given I approve the scan, when it is submitted, then the scan is queued as a background job and the approving user, scope and timestamp are persisted against the graph.
6. Given I cancel the dialog, when it closes, then no scan is queued and no state changes.
7. Given a data scan has never completed, when I open the Trusted records tab, then records are not shown and the tab explains that a scan is required.
8. Given a data scan has completed, when I view the graph profile, then the scan mode, date, row count and approving user are visible.
9. Given a source has changed since the last completed scan, when I view the graph, then the records are marked as potentially out of date and a re-scan is offered.

---

### KL-8 · Review records where sources disagree — P0

#### User Story
As a data steward, I want to see only the records whose sources hold conflicting values, so that I spend my time on the records that actually need a decision.

#### Problem/Context
A resolved entity typically produces thousands of records, almost all of which match cleanly and need no human. Presenting all of them buries the few that matter. The steward's job is the exceptions.

#### Acceptance Criteria
1. Given a data scan has completed, when I open the Trusted records tab, then a summary states how many records resolved in total and how many resolved without conflict.
2. Given conflicting records exist, when the tab renders, then each is shown with its confidence, the nature of the conflict, and a per-field comparison across the contributing sources.
3. Given a per-field comparison is rendered, when a field holds the same value in every source, then that field is displayed without emphasis.
4. Given a per-field comparison is rendered, when a field differs between sources, then the differing values are visually highlighted and the preferred source for that field is shown.
5. Given a conflicting record is displayed, when I review it, then I can either keep the records separate or confirm them as one, and my decision is recorded.
6. Given a conflicting record is displayed, when I select one of its contributing source references, then I navigate to the source graph that produced it.
7. Given no conflicts and no unmatched records exist, when the tab renders, then a state confirms that all records resolved without conflict and nothing requires a decision.
8. Given I confirm two records as one, when the decision is saved, then crosswalks to every contributing source row are retained so the decision can be reversed later.
9. Given a confirm-as-one decision was made previously, when I revisit the record, then the decision is shown with who made it and when, and an action to reverse it is available.
10. Given I reverse a confirm-as-one decision, when it is applied, then the records return to separate and the reversal is recorded in the audit log.
11. Given records were grouped transitively — A matched B and B matched C, but A and C never matched each other — when the group is displayed, then that is stated, because transitive grouping is the most common cause of an incorrect merge.

---

### KL-9 · Review records that matched nothing — P0

#### User Story
As a data steward, I want to see records present in only one source, so that I can tell the difference between a genuinely single-source record and a missing match key.

#### Problem/Context
A record that matches nothing is ambiguous: it may legitimately exist in one system only, or the match may have failed because an identifying column is not classified. Both need to be visible, because the second is a fixable governance gap.

#### Acceptance Criteria
1. Given unmatched records exist, when I open the Trusted records tab, then each is listed with the entity name, the only source it appears in, its source table and row reference, and the reason no match was found.
2. Given an unmatched record is listed, when I review it, then I can accept it as single-source or investigate it.
3. Given I choose to investigate, when I act, then I navigate to the source graph so I can inspect its classifications and match keys.
4. Given unmatched records are listed, when the section renders, then an action is offered to review the graph's match keys.
5. Given the reason a record did not match is a missing or blank match key, when it is listed, then the reason states which key was unavailable.

---

### KL-10 · See what requires attention across the Knowledge Layer — P0

#### User Story
As a data steward, I want one place that lists everything in the Knowledge Layer needing a decision, so that I do not have to open every graph to find out.

#### Problem/Context
Work accumulates across source graphs and cross-source graphs — drift, pending terms, conflicting records. Without an aggregate view, the layer silently degrades.

#### Acceptance Criteria
1. Given I open the Knowledge Layer overview, when it renders, then I see counts for source graphs published, tables described, trusted records, items requiring review, and ungoverned labels.
2. Given items require attention, when the overview renders, then each is listed with its type, the object it concerns, a detail line, where it lives, and an action to review it.
3. Given I select the review action on an item, when I act, then I navigate directly to the tab of the object where the decision is made.
4. Given nothing requires attention, when the overview renders, then a state confirms the Knowledge Layer is up to date.
5. Given the overview renders, when entity coverage is shown, then each business entity displays how many published source graphs are ready for it and whether it has been mastered.
6. Given an entity has two or more ready source graphs and has not been mastered, when the overview renders, then an action is offered to create a cross-source graph for it.
7. Given items are accepted automatically by confidence threshold, when the overview renders, then they are not listed as requiring attention.

---

### KL-11 · Trace a trusted record back to its source rows — P1

#### User Story
As a data steward, I want to look up one trusted record and see every source row behind it, so that I can defend the number to an auditor.

#### Problem/Context
Record-level lineage exists in the resolver's curation queue but there is no way in EDG to start from a named record and prove where each of its values came from. Without this, "trusted record" is an assertion rather than something provable. This is the primary gap against the existing XKG builder.

#### Acceptance Criteria
1. Given I am on a cross-source graph with a completed scan, when I search for a record by name or identifier, then matching trusted records are returned.
2. Given I select a trusted record, when the trace renders, then every contributing source row is listed with its source system, table, row identifier and status.
3. Given the trace renders, when a field is displayed, then the source that supplied the surviving value is identified.
4. Given the trace renders, when I select a contributing source row, then I navigate to the source graph and table that produced it.
5. Given a trusted record has been merged or split by a steward, when the trace renders, then that decision is shown with who made it and when.
6. Given no scan has completed, when I attempt a trace, then the trace is unavailable and the data-scan requirement is stated.

---

### KL-12 · Bind a certified business term to a column in each application — P1 · **BUILT (Certified measures)**

> Implemented as Certified measures (§2), including the Vendor Spend case across EKKO/EKPO, RBKP
> and BSIK/BSAK, with certification writing through to the Glossary. Retained here as the
> specification of record; AC6 (broken binding on drift) is the only part still open and is
> tracked with KL-13.

#### User Story
As a data steward, I want to bind one certified business term to the specific column or expression that implements it in each application, so that the same metric resolves consistently everywhere.

#### Problem/Context
"Vendor spend" currently resolves differently depending on which system and which phrasing is used, because no single definition is bound to a physical implementation per application. Competing products already ship suggested column-to-term mapping with steward acceptance, so this is required for parity.

#### Acceptance Criteria
1. Given a certified business term exists, when I open it in the Knowledge Layer, then I see which applications have a binding and which do not.
2. Given an application has no binding for a term, when I open the term, then candidate columns or expressions from that application are suggested with a confidence indicator.
3. Given a candidate binding is suggested, when I review it, then I can accept, change or reject it, and my decision is recorded against the term.
4. Given a term is bound in an application, when the binding renders, then the source table and column or expression are shown.
5. Given a term has no binding in any application, when it is listed, then it is reported as unbound so it can be assigned.
6. Given a term is bound and the underlying column is later removed or renamed at source, when drift is detected, then the binding is flagged as broken and surfaced as requiring attention.
7. Given a term binding is accepted, when it is saved, then no new vocabulary is created — the binding always references an existing certified term.

---

### KL-13 · Detect and act on source drift — P1

#### User Story
As a data steward, I want to be told when a source has changed since a graph was built, so that I can refresh it before anyone relies on stale results.

#### Problem/Context
Source schemas change — new columns and tables appear. Today customers depend on services to notice and rebuild, which is the most frequently reported operational pain. The layer must detect this itself.

#### Acceptance Criteria
1. Given a scheduled scan detects schema change in a connected source, when the change is recorded, then the affected source graph is marked as drifted with the number of changes.
2. Given a source graph is drifted, when I open it, then a banner states what changed and offers a review action.
3. Given a source graph is drifted, when any cross-source graph depends on it, then those graphs are marked as potentially out of date.
4. Given a drifted source graph is listed anywhere, when it renders, then its freshness reflects the drift rather than showing as current.
5. Given drift exists, when I open the Knowledge Layer overview, then it appears in the items requiring attention.
6. Given I request a re-scan, when it is submitted, then it is queued as a background job and its history is available in run history.

---

### KL-14 · Delete a source knowledge graph safely — P1

#### User Story
As a data steward, I want to be warned when deleting a source knowledge graph that other graphs depend on, so that I do not silently break a cross-source graph.

#### Problem/Context
Cross-source graphs read only from source graphs. Removing a source graph that is in use would invalidate every graph built on it, and nothing currently prevents that.

#### Acceptance Criteria
1. Given a source graph has no dependent cross-source graphs, when I delete it, then it is removed after a confirmation.
2. Given a source graph has dependent cross-source graphs, when I attempt to delete it, then the dependent graphs are named and the deletion is blocked until they are addressed.
3. Given a source graph is deleted, when the action completes, then it no longer appears in any list, selector or coverage view.
4. Given a source graph is deleted, when the action completes, then the deletion is recorded in the audit log with who performed it and when.

---

### KL-15 · Declare which columns identify an entity — P0 · **BUILT**

#### User Story
As a data steward, I want to declare which table represents a business entity and which of its columns identify it, so that cross-source matching has something correct to work from.

#### Problem/Context
This is the one thing the catalog cannot infer, and the only thing cross-source matching depends on. It used to be implied by classification, which is a different concept and produced wrong keys. It needs its own stage, and it needs to show the evidence behind each proposal so a steward can overrule rather than rubber-stamp.

#### Acceptance Criteria
1. Given I am building a source knowledge graph, when I reach the Entity & Identity stage, then each candidate master table is shown with the business entity it represents.
2. Given a master table is shown, when its identifier columns render, then each column shows its proposed identifier role, the concept it identifies, its fill rate, its distinct rate, any classifications on it, and which signal proposed the role.
3. Given a role was proposed, when I disagree, then I can change it to any other role and the match keys recalculate from my change.
4. Given the stage renders, when I read what it declares, then it states that it reads Business Entities, column profiling, Classifications and Policies, and that it proposes identifier roles back into EDG.
5. Given a column is held back from cross-source matching, when the stage renders, then it is listed with the reason, rather than being absent.
6. Given the weakest declared key on a table is populated below 80%, when the stage renders, then it states the figure and that every row the key misses becomes an exception for someone to clear by hand.
7. Given a connection has been profiled, when identity is proposed, then the proposal uses that connection's own object and column shapes and never presents columns of a kind the connector cannot return.
8. Given a master table ends with no column valid across systems, when the stage renders, then it is reported as not matchable across sources with what would make it matchable.

---

### KL-16 · Prevent an invalid column from becoming a cross-source match key — P0 · **BUILT**

#### User Story
As a data steward, I want the product to make it impossible to match across sources on a column that is only meaningful inside one system, so that two unrelated records can never be merged into one.

#### Problem/Context
The false merge is the failure mode that permanently destroys trust in this feature, and unmerging does not undo the downstream damage. The concrete case: a vendor code is a local code in every system, and SAP's is unrelated to Fusion's. Matching on it merges unrelated suppliers on a supplier master, which is wrong money. This must be structurally impossible, not merely discouraged by guidance.

#### Acceptance Criteria
1. Given a column's identifier role is one that is valid only inside its own system, when match keys are derived anywhere in the product, then that column is never among them.
2. Given a column is a technical primary key, when match keys are derived, then it is never among them, regardless of how unique it is.
3. Given a column has been excluded, when a user asks why, then the answer names the role and explains that the same value means different things in different systems.
4. Given an excluded concept is still useful for display, when precedence is set, then it remains selectable as a survivorship field — deciding which system's value to *show* is a separate decision from deciding two records are the *same*.
5. Given a cross-source graph is published, when its keys are inspected, then every key is valid across sources in every source graph it joins.
6. Given the identifier roles on a master change, when match keys are read again, then they reflect the change, because the key list is derived and not stored a second time.

---

### KL-17 · See the policies governing identifier columns, and where one blocks matching — P0 · **BUILT**

#### User Story
As a data steward, I want to see which policies already govern the columns I am matching on and be told when one of them prevents matching, so that I find out before a scan produces wrong results rather than after.

#### Problem/Context
There is deliberately no step for attaching a policy to a graph: a policy already targets a classification, so it governs a column the moment that column is classified, and attaching one by hand would create a second, divergent truth. What was missing is visibility. It also exposed a genuine conflict between two features that are each correct alone — matching reads the raw value of a key, so a masking policy over that column either blocks the read or compares mask characters against mask characters and merges everything.

#### Acceptance Criteria
1. Given identifier columns carry classifications, when the Entity & Identity stage renders, then every policy that now governs those columns is listed with the columns it reaches and what it does.
2. Given the flow renders anywhere, when a user looks for a step to attach a policy, then no such step exists, and the product states that policy is inherited through classifications.
3. Given a masking policy covers a declared match key and the resolver holds an exemption, when the stage renders, then the key remains usable and the exemption is shown with who granted it and when.
4. Given a masking policy covers a declared match key and no resolver exemption exists, when the stage renders, then that key is reported as blocked, naming the policy and the column, and stating that an administrator must grant an exemption.
5. Given a key is blocked, when match keys are offered to a cross-source graph, then the blocked key is not offered.
6. Given a policy restricts access rather than masking values, when the stage renders, then it is listed as governing the columns but is not reported as blocking matching.
7. Given a blocked key is reported, when the report renders, then it is one finding per key rather than one per policy, because the steward has one decision to make about that key.

---

### KL-18 · Stop only on the stages that need a decision — P1 · **BUILT**

#### User Story
As a data steward, I want the builder to stop only where something is actually being asked of me, so that I am not clicking through screens that had nothing to ask.

#### Problem/Context
Several stages complete on their own. Presenting them as steps to walk through teaches stewards to click Next without reading, which is exactly the habit that lets a wrong proposal through on the stages that do matter. The stages must stay visible and inspectable — hiding them would make the process unauditable — but the flow should not wait on them.

#### Acceptance Criteria
1. Given a stage completes without a decision, when it renders, then it states that it completed automatically and that nothing there is waiting on a decision.
2. Given a stage completes without a decision, when the stage rail renders, then it is labelled as automatic and remains selectable so it can still be inspected.
3. Given a stage requires input, when the stage rail renders, then it states how many items are waiting.
4. Given the next stage requiring input is not the immediately following one, when I advance, then I am taken to that stage and the control names it before I click.
5. Given stages are skipped by advancing, when they are skipped, then they are recorded as complete, because they were.
6. Given any stage renders, when its header shows, then it declares which governed EDG objects it reads and, where applicable, which object it proposes into.
7. Given a stage proposes into a governed object, when a proposal is created, then it goes through that object's normal approval flow and nothing is created silently.
8. Given the builder renders, when progress is shown, then the count of automatic stages is stated alongside the current position.

---

### KL-19 · Backlog — P2

One line each; to be expanded when prioritised.

1. **Persona-scoped lineage** — what a user can trace is limited by their policy scope, so a regional analyst sees only their source systems.
2. **Versioned published views** — publish a named, versioned snapshot of a cross-source graph with entity and application counts, and allow comparison between versions.
3. **Transaction entities** — link transaction entities (invoices, purchase orders, payments) across sources so cross-application totals can be answered, not just master entities identified.
4. **Value-chain classification** — classify entities by value chain (Source-to-Pay, Order-to-Cash, Record-to-Report) for navigation and reporting.
5. **Enforcement from the semantic layer** — use a certified term's bindings to apply masking, retention or access policy automatically to every column that implements it. *No competitor currently closes this loop; strongest differentiation available.*
6. **Vocabulary completeness as a governed metric** — track business entities and terms with no relationships or bindings, assign them to owners, and report coverage over time.
7. **Concept-centric graph view** — start from a business term and see everything that implements it, complementing the asset-centric view.
8. **Standards export** — export the governed model using standard vocabularies (SKOS for glossary, DCAT for assets, PROV-O for lineage) without adopting a triplestore.

---

## 7. Sequencing

| Phase | Contents | Status | Outcome |
|---|---|---|---|
| **1** | KL-1 … KL-4, KL-15 … KL-17 | **Built** | Source graphs are registered, governed and inspectable; identity is declared and typed; an invalid key is unrepresentable; inherited policy is visible. No dependency on cross-source work. |
| **2** | KL-5, KL-6, KL-10, KL-18 | **Built** | Cross-source graphs can be created and understood at entity level, on the evidence behind each key. Entirely metadata; safe to demo anywhere. |
| **3** | KL-7 … KL-9 | Open — blocked on §8.1 | Records are resolved under explicit approval, and exceptions are worked. |
| **4** | KL-11, KL-13, KL-14 | Open | Provable lineage, drift handling and safe deletion. *(KL-12 built.)* |
| **5** | KL-19 | Backlog | Differentiation, led by enforcement from the semantic layer. |

---

## 8. Dependencies and open decisions

**Dependencies**
1. Match keys require identifier roles to be confirmed on each source graph. Where they are not, the entity is correctly reported as not matchable — this is a governance gap for the customer to close, not a defect. Classifying a column does not by itself make it matchable, and is not a substitute.
2. A key blocked by a masking policy requires an administrator to grant the resolver an exemption. Until then the entity may be matchable on fewer keys than it declares, which is reported rather than silently worked around.
3. Drift detection depends on scheduled source scans and their run history.
4. Column profiling must supply fill and distinct rates per identifier column. The evidence shown at key selection is only as good as the profiling behind it.

**Open decisions — needed before Phase 3**
1. **Store contract.** Does EDG read the resolver's output through an API, or do both read a shared store? This determines whether Phase 3 is an integration or a shared-schema change. *Unresolved and blocking.*
2. **Who approves a data scan.** Currently the approver is whoever runs it. Reading PII from a source arguably requires the owner of that master table to approve, routed through the existing Inbox. Recommend owner approval; requires product sign-off.
3. **Stale records.** When a source changes after a scan, records are currently shown with a warning. Alternative is to withhold them until re-scanned. Recommend shown-with-warning; requires product sign-off.
4. **Ownership of the create flow.** A cross-source build flow now exists in both Data Sense and EDG. One should be retired or made headless. *Requires a decision with the CPO.*
5. ~~**How far into mastering do we intend to go?**~~ **Decided 2026-08-25: EDG builds and governs
   the cross-source graph, resolver included.** No write-back to source systems and no transaction
   path. The market evidence that made this a question is retained in §3 as the risk register for
   the decision, with the control against each risk. What it still implies, and should be funded
   explicitly: a permanent stewardship function, a named business owner, a single starting domain,
   and business KPIs instrumented from day one — the last is the failure most MDM programmes
   share, and the worklist already carries the money to make it cheap.
6. **Do we need a false-merge guardrail beyond reversibility and typed roles?** Typed identifier
   roles (KL-16) remove the structural cause; they do not cover a genuinely wrong steward decision
   on a real candidate. Options: a second approver above a blast-radius threshold, or
   link-without-merge above a downstream-consumer count. Recommend deciding alongside KL-8.
7. **Who grants a resolver exemption, and does matching on a masked column need its own approval?**
   The exemption is currently modelled as an administrator grant recorded against the policy.
   Whether the *data* owner must also consent — matching reads raw values of columns the
   organisation chose to mask — is unresolved. Recommend routing it to the owner through the
   Inbox, consistent with the data-scan decision in §8.2.

---

## 9. Success criteria

1. A steward can state, for any connected system, whether it is mapped, governed and matchable — without opening the source.
2. An entity cannot silently fail to resolve. Any entity that cannot be matched reports why and where to fix it, and any key held back reports the reason rather than being absent.
3. No production row is read without a named approver and an audit entry.
4. A steward reviews only exceptions. Records that resolve cleanly are never presented as work.
5. Any trusted record can be traced to its contributing source rows and defended to an auditor.
6. Ungoverned labels introduced by the Knowledge Layer remain at zero.
7. No steward decision is irreversible. Every confirm-as-one can be undone from the crosswalks, and zero false merges reach a downstream consumer without a reversal path.
8. No cross-source graph is ever matched on a column that is meaningful only inside one system. Zero false merges from a local code reach a downstream consumer, and the product makes that class of key unrepresentable rather than merely warning against it.
9. EDG never writes back to a source system and never sits in a transaction path. Source systems remain authoritative for their own rows, and every merge remains reversible from the retained crosswalks.
10. A steward can defend any key they matched on: its role, the column it binds to in each source, and how populated that column is.
