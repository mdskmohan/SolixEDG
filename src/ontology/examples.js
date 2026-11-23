// Three worked ontologies, each filling every tab: Overview (status, versions),
// Classes, Relationships, Values, Validation (data rules, mapping checks,
// expected answers) and Configuration (the exported files).
//
//   Order to Cash   Commerce  Approved, two versions
//   Procure to Pay  Finance   In review, changes waiting on top of v1
//   Product Catalog Product   Draft, one broken field link and one unmapped relationship
//
// Data stays in the source: each ontology is bound to catalog views listed in
// EXAMPLE_TABLES, which the app adds to the catalog.
import * as ONT from "./engine.js";
import * as OMD from "./metadata.js";

const col = (name, type, desc, extra = {}) => ({ name, type, desc, pii: false, nullable: !extra.pk, pk: false, ...extra });

// Catalog views the examples are bound to. ORDERS and CUSTOMERS already exist
// as assets; their columns are defined here.
export const EXAMPLE_TABLES = [
  { id: 9201, name: "ORDERS", domain: "Commerce", owner: "maya.chen", steward: "dev.patel", db: "snowflake_prod / SALES / ORDERS", rows: "18.4M", size: "3.1 GB",
    description: "Approved sales orders view. One row per order, with the buyer and the bill-to customer.", cols: [
      col("ORDER_ID", "VARCHAR", "Order number, e.g. O-104", { pk: true }),
      col("BUYER_ID", "VARCHAR", "Customer who placed the order"),
      col("BILL_TO_ID", "VARCHAR", "Customer the order is invoiced to"),
      col("ORDER_DATE", "DATE", "Date the order was placed", { nullable: false }),
      col("AMOUNT", "DECIMAL(12,2)", "Order total", { nullable: false }),
      col("STATUS", "VARCHAR", "Order status: PENDING, SHIPPED, DELIVERED, CANCELLED", { nullable: false }),
      col("CHANNEL", "VARCHAR", "Sales channel: ONLINE, STORE, PARTNER")] },
  { id: 9202, name: "CUSTOMERS", domain: "Commerce", owner: "maya.chen", steward: "dev.patel", db: "snowflake_prod / SALES / CUSTOMERS", rows: "2.2M", size: "640 MB",
    description: "Approved customer view. One row per customer.", cols: [
      col("CUSTOMER_ID", "VARCHAR", "Customer number, e.g. C-007", { pk: true }),
      col("NAME", "VARCHAR", "Customer name", { pii: true, nullable: false }),
      col("EMAIL", "VARCHAR", "Contact email", { pii: true })] },
  { id: 9203, name: "INVOICES", domain: "Commerce", owner: "maya.chen", steward: "dev.patel", db: "snowflake_prod / SALES / INVOICES", rows: "16.9M", size: "2.4 GB",
    description: "Customer invoices. One row per invoice, linked to the order it bills.", cols: [
      col("INVOICE_ID", "VARCHAR", "Invoice number, e.g. INV-2026-0042", { pk: true }),
      col("ORDER_ID", "VARCHAR", "Order the invoice bills"),
      col("INVOICE_DATE", "DATE", "Date the invoice was issued", { nullable: false }),
      col("AMOUNT_DUE", "DECIMAL(12,2)", "Amount invoiced", { nullable: false })] },
  { id: 9204, name: "SUPPLIERS", domain: "Finance", owner: "dev.patel", steward: "sarah.kim", db: "oracle_erp / AP / SUPPLIERS", rows: "48K", size: "22 MB",
    description: "Approved supplier master. One row per supplier.", cols: [
      col("SUPPLIER_ID", "VARCHAR", "Supplier number, e.g. S-00412", { pk: true }),
      col("SUPPLIER_NAME", "VARCHAR", "Registered supplier name", { nullable: false }),
      col("TAX_ID", "VARCHAR", "Tax registration number", { pii: true }),
      col("RISK_TIER", "VARCHAR", "Supplier risk tier: LOW, MEDIUM, HIGH"),
      col("PAYMENT_TERMS", "VARCHAR", "Agreed payment terms: NET30, NET60")] },
  { id: 9205, name: "PURCHASE_ORDERS", domain: "Finance", owner: "dev.patel", steward: "sarah.kim", db: "oracle_erp / PO / PURCHASE_ORDERS", rows: "1.3M", size: "410 MB",
    description: "Purchase orders. One row per purchase order.", cols: [
      col("PO_NUMBER", "VARCHAR", "Purchase order number, e.g. PO-104233", { pk: true }),
      col("SUPPLIER_ID", "VARCHAR", "Supplier the order is issued to", { nullable: false }),
      col("PO_DATE", "DATE", "Date the order was issued", { nullable: false }),
      col("TOTAL_AMOUNT", "DECIMAL(14,2)", "Order total", { nullable: false }),
      col("PO_STATUS", "VARCHAR", "Status: OPEN, APPROVED, RECEIVED, CLOSED", { nullable: false })] },
  { id: 9206, name: "PO_LINES", domain: "Finance", owner: "dev.patel", steward: "sarah.kim", db: "oracle_erp / PO / PO_LINES", rows: "7.8M", size: "1.6 GB",
    description: "Purchase order lines. One row per line.", cols: [
      col("LINE_ID", "VARCHAR", "Line identifier", { pk: true }),
      col("PO_NUMBER", "VARCHAR", "Purchase order the line belongs to", { nullable: false }),
      col("ITEM_DESCRIPTION", "VARCHAR", "What is being bought"),
      col("QUANTITY", "DECIMAL(12,3)", "Quantity ordered", { nullable: false }),
      col("UNIT_PRICE", "DECIMAL(12,2)", "Agreed price per unit", { nullable: false })] },
  { id: 9207, name: "SUPPLIER_INVOICES", domain: "Finance", owner: "dev.patel", steward: "sarah.kim", db: "oracle_erp / AP / SUPPLIER_INVOICES", rows: "1.1M", size: "300 MB",
    description: "Invoices received from suppliers. One row per invoice.", cols: [
      col("INVOICE_NUMBER", "VARCHAR", "Supplier's invoice number", { pk: true }),
      col("PO_NUMBER", "VARCHAR", "Purchase order the invoice is for"),
      col("INVOICE_DATE", "DATE", "Date on the invoice", { nullable: false }),
      col("INVOICE_AMOUNT", "DECIMAL(14,2)", "Amount the supplier billed", { nullable: false })] },
  { id: 9208, name: "PRODUCTS", domain: "Product", owner: "priya.nair", steward: "james.oh", db: "postgresql_prod / PIM / PRODUCTS", rows: "84K", size: "38 MB",
    description: "Product master from the product information system. One row per sellable product.", cols: [
      col("SKU", "VARCHAR", "Stock keeping unit, e.g. SKU-100045", { pk: true }),
      col("PRODUCT_NAME", "VARCHAR", "Product name", { nullable: false }),
      col("CATEGORY_ID", "VARCHAR", "Category the product is placed in", { nullable: false }),
      col("BRAND_ID", "VARCHAR", "Brand the product is sold under"),
      col("LIFECYCLE_STATUS", "VARCHAR", "ACTIVE, DISCONTINUED, RECALLED", { nullable: false }),
      col("LAUNCH_DATE", "DATE", "Date the product went on sale"),
      col("LIST_PRICE", "DECIMAL(10,2)", "Current list price")] },
  { id: 9209, name: "PRODUCT_CATEGORIES", domain: "Product", owner: "priya.nair", steward: "james.oh", db: "postgresql_prod / PIM / PRODUCT_CATEGORIES", rows: "1.2K", size: "1 MB",
    description: "The merchandising hierarchy. One row per category, with its parent category.", cols: [
      col("CATEGORY_ID", "VARCHAR", "Category identifier", { pk: true }),
      col("CATEGORY_NAME", "VARCHAR", "Category name", { nullable: false }),
      col("PARENT_CATEGORY_ID", "VARCHAR", "Parent category; empty at the top of the tree")] },
  { id: 9210, name: "BRANDS", domain: "Product", owner: "priya.nair", steward: "james.oh", db: "postgresql_prod / PIM / BRANDS", rows: "310", size: "<1 MB",
    description: "Brands the group sells under. One row per brand.", cols: [
      col("BRAND_ID", "VARCHAR", "Brand identifier", { pk: true }),
      col("BRAND_NAME", "VARCHAR", "Brand name", { nullable: false })] },
];

const mapper = (by, at) => {
  let n = 0;
  return {
    table: (pre, classId, table, keys) => ({ id: `${pre}_m${++n}`, kind: "table", classId, target: { table, keys }, status: "approved", by, at }),
    field: (pre, classId, propId, table, column) => ({ id: `${pre}_m${++n}`, kind: "field", classId, propId, target: { table, column }, status: "approved", by, at }),
    rel: (pre, classId, relId, table, column) => ({ id: `${pre}_m${++n}`, kind: "relfield", classId, relId, target: { table, column }, status: "approved", by, at }),
  };
};
const p = (id, name, datatype, desc, extra = {}) => ({ id, name, datatype, required: false, desc, ...extra });
const v = (id, name, classId, desc) => ({ id, name, classId, desc });

// ── 1. Order to Cash · Commerce · Approved v2 ──
function orderToCash() {
  const by = "dev.patel", M = mapper(by, "2026-11-10T09:00:00.000Z");
  const PARTY = "o2c_party", CUST = "o2c_customer", ORD = "o2c_order", CANC = "o2c_cancelled_order", INV = "o2c_invoice", STAT = "o2c_status", CHAN = "o2c_channel";
  const v1 = {
    id: "ont_o2c", name: "Order to Cash", prefix: "o2c", namespace: "https://ontology.jnj.com/o2c#", domain: "Commerce",
    owner: "maya.chen", owners: ["maya.chen"], steward: "dev.patel", stewards: ["dev.patel"], created: "2026-11-10", source: { kind: "native" },
    desc: "From the customer's order to the invoice: who buys, who is billed, what state the order is in and how it was sold.",
    imports: ["https://schema.org/"], license: "Internal use only",
    classes: [
      { id: PARTY, name: "Party", desc: "A person or organization the group does business with.", synonyms: ["Business partner"], parent: null, termId: "tc2", sameAs: [], props: [] },
      { id: CUST, name: "Customer", desc: "A person or organization that buys from us or is invoiced by us.", synonyms: ["Client", "Account"], parent: PARTY, termId: "tc1", sameAs: [],
        props: [p("o2c_p_cid", "Customer ID", "string", "Customer number, e.g. C-007.", { required: true }), p("o2c_p_cname", "Name", "string", "Customer name.", { required: true }),
          p("o2c_p_cemail", "Email", "string", "Contact email.")], keyProps: ["o2c_p_cid"] },
      { id: ORD, name: "Order", desc: "A request from a customer to buy products, identified by its order number.", synonyms: ["Sales order"], parent: null, termId: "tc3",
        sameAs: [{ iri: "https://schema.org/Order", label: "Order", standard: "schema.org" }],
        props: [p("o2c_p_oid", "Order ID", "string", "Order number, e.g. O-104.", { required: true }), p("o2c_p_odate", "Order date", "date", "Date the order was placed.", { required: true }),
          p("o2c_p_oamt", "Amount", "decimal", "Order total.")], keyProps: ["o2c_p_oid"] },
      { id: STAT, name: "Order Status", desc: "Where an order is in its lifecycle.", synonyms: ["Order state"], parent: null, termId: "td2", sameAs: [], props: [] },
      { id: CHAN, name: "Sales Channel", desc: "How the order reached us.", synonyms: ["Channel"], parent: null, termId: null, sameAs: [], props: [] }],
    rels: [
      { id: "o2c_r_placed", from: ORD, to: CUST, name: "placed by", inverse: "places", cardinality: "many_to_one", required: true, kind: "association",
        synonyms: ["buyer", "purchaser"], desc: "The customer who placed the order (the buyer)." },
      { id: "o2c_r_billed", from: ORD, to: CUST, name: "billed to", inverse: "is billed for", cardinality: "many_to_one", required: false, kind: "association",
        synonyms: ["bill-to", "billing customer", "payer"], desc: "The customer who receives the invoice for the order." },
      { id: "o2c_r_status", from: ORD, to: STAT, name: "has status", inverse: "is status of", cardinality: "many_to_one", required: true, kind: "association",
        synonyms: ["order status", "state"], desc: "The order's current status." },
      { id: "o2c_r_channel", from: ORD, to: CHAN, name: "sold through", inverse: "sells", cardinality: "many_to_one", required: false, kind: "association",
        synonyms: ["channel", "sales channel"], desc: "The channel the order came in through." }],
    individuals: [
      v("o2c_v_pending", "Pending", STAT, "Placed, not yet shipped."), v("o2c_v_shipped", "Shipped", STAT, "Left the warehouse."),
      v("o2c_v_delivered", "Delivered", STAT, "Received by the customer."), v("o2c_v_cancelled", "Cancelled", STAT, "Withdrawn before delivery; never invoiced."),
      v("o2c_v_online", "Online", CHAN, "Web shop and mobile app."), v("o2c_v_store", "Store", CHAN, "Bought in a physical store."),
      v("o2c_v_partner", "Partner", CHAN, "Sold by a reseller on our behalf.")],
    constraints: [
      { id: "o2c_k_oid", classId: ORD, prop: "Order ID", kind: "pattern", value: "^O-[0-9]+$", severity: "violation", desc: "" },
      { id: "o2c_k_amt", classId: ORD, prop: "Amount", kind: "range", value: "0..", severity: "violation", desc: "An order total is never negative." },
      { id: "o2c_k_email", classId: CUST, prop: "Email", kind: "pattern", value: "^[^@]+@[^@]+$", severity: "warning", desc: "" },
      { id: "o2c_k_cid", classId: CUST, prop: "Customer ID", kind: "unique", value: "", severity: "violation", desc: "" }],
    mappings: [
      M.table("o2c", ORD, "ORDERS", ["ORDER_ID"]), M.table("o2c", CUST, "CUSTOMERS", ["CUSTOMER_ID"]), M.table("o2c", PARTY, "CUSTOMERS", ["CUSTOMER_ID"]),
      M.field("o2c", ORD, "o2c_p_oid", "ORDERS", "ORDER_ID"), M.field("o2c", ORD, "o2c_p_odate", "ORDERS", "ORDER_DATE"), M.field("o2c", ORD, "o2c_p_oamt", "ORDERS", "AMOUNT"),
      M.field("o2c", CUST, "o2c_p_cid", "CUSTOMERS", "CUSTOMER_ID"), M.field("o2c", CUST, "o2c_p_cname", "CUSTOMERS", "NAME"), M.field("o2c", CUST, "o2c_p_cemail", "CUSTOMERS", "EMAIL"),
      M.rel("o2c", ORD, "o2c_r_placed", "ORDERS", "BUYER_ID"), M.rel("o2c", ORD, "o2c_r_billed", "ORDERS", "BILL_TO_ID"),
      M.rel("o2c", ORD, "o2c_r_status", "ORDERS", "STATUS"), M.rel("o2c", ORD, "o2c_r_channel", "ORDERS", "CHANNEL")],
    tests: [
      { id: "o2c_t_buyer", question: "Which field identifies the buyer?", relId: "o2c_r_placed", expect: "ORDERS.BUYER_ID", approvedBy: "maya.chen" },
      { id: "o2c_t_billto", question: "Which field identifies the billing customer?", relId: "o2c_r_billed", expect: "ORDERS.BILL_TO_ID", approvedBy: "maya.chen" },
      { id: "o2c_t_status", question: "Which field holds the order status?", relId: "o2c_r_status", expect: "ORDERS.STATUS", approvedBy: "maya.chen" }],
    audience: ["Analytics", "Governance"], versions: [],
  };
  const r1 = ONT.publish(OMD.ensureIris(v1), "maya.chen", "Order, customer, buyer and billing customer", "2026-11-12T10:00:00Z").ontology;
  // v2 adds the invoice and a class defined by a value: a cancelled order.
  const o = OMD.ensureIris({
    ...r1,
    classes: [...r1.classes,
      { id: CANC, name: "Cancelled Order", desc: "An order whose status is Cancelled. Never invoiced.", synonyms: ["Void order"], parent: ORD, termId: null, sameAs: [], props: [],
        restrictions: [{ id: "o2c_x_canc", prop: "o2c_r_status", kind: "value", target: "o2c_v_cancelled", min: "", max: "" }] },
      { id: INV, name: "Invoice", desc: "A bill sent to the customer for an order.", synonyms: ["Bill"], parent: null, termId: null,
        sameAs: [{ iri: "https://schema.org/Invoice", label: "Invoice", standard: "schema.org" }], disjoint: [ORD],
        props: [p("o2c_p_iid", "Invoice ID", "string", "Invoice number, e.g. INV-2026-0042.", { required: true }), p("o2c_p_idate", "Invoice date", "date", "Date the invoice was issued."),
          p("o2c_p_iamt", "Amount due", "decimal", "Amount invoiced.")], keyProps: ["o2c_p_iid"] }],
    rels: [...r1.rels,
      { id: "o2c_r_invfor", from: INV, to: ORD, name: "issued for", inverse: "is invoiced by", cardinality: "many_to_one", required: true, kind: "association",
        synonyms: ["invoiced order"], desc: "The order the invoice bills." }],
    constraints: [...r1.constraints,
      { id: "o2c_k_iamt", classId: INV, prop: "Amount due", kind: "range", value: "0..", severity: "violation", desc: "" }],
    mappings: [...r1.mappings, M.table("o2c", INV, "INVOICES", ["INVOICE_ID"]), M.table("o2c", CANC, "ORDERS", ["ORDER_ID"]),
      M.field("o2c", INV, "o2c_p_iid", "INVOICES", "INVOICE_ID"), M.field("o2c", INV, "o2c_p_idate", "INVOICES", "INVOICE_DATE"), M.field("o2c", INV, "o2c_p_iamt", "INVOICES", "AMOUNT_DUE"),
      M.rel("o2c", INV, "o2c_r_invfor", "INVOICES", "ORDER_ID")],
    tests: [...r1.tests,
      { id: "o2c_t_inv", question: "Which field links an invoice to its order?", relId: "o2c_r_invfor", expect: "INVOICES.ORDER_ID", approvedBy: "maya.chen" }],
  });
  const review = { state: "approved", submittedBy: "dev.patel", submittedAt: "2026-11-18T14:05:00.000Z", approvedBy: "maya.chen", approvedAt: "2026-11-19T09:30:00.000Z", hash: OMD.draftHash(o) };
  const r2 = ONT.publish(o, "maya.chen", "Invoice and cancelled orders", "2026-11-19T09:30:00Z").ontology;
  return { ...r2, review: { ...review, hash: OMD.draftHash(r2) } };
}

// ── 2. Procure to Pay · Finance · In review, on top of v1 ──
function procureToPay() {
  const by = "sarah.kim", M = mapper(by, "2026-11-05T09:00:00.000Z");
  const SUP = "p2p_supplier", HIGH = "p2p_high_risk_supplier", PO = "p2p_po", LINE = "p2p_po_line", INV = "p2p_invoice", STAT = "p2p_po_status", RISK = "p2p_risk", TERMS = "p2p_terms";
  const v1 = OMD.ensureIris({
    id: "ont_p2p", name: "Procure to Pay", prefix: "p2p", namespace: "https://ontology.jnj.com/p2p#", domain: "Finance",
    owner: "dev.patel", owners: ["dev.patel"], steward: "sarah.kim", stewards: ["sarah.kim"], created: "2026-11-05", source: { kind: "native" },
    desc: "Buying from suppliers: who we buy from, what we ordered, what they billed and how risky they are.",
    imports: ["https://spec.edmcouncil.org/fibo/ontology/"], license: "Internal use only",
    classes: [
      { id: SUP, name: "Supplier", desc: "A legal entity from which the group purchases goods or services.", synonyms: ["Vendor"], parent: null, termId: "tc6",
        sameAs: [{ iri: "https://schema.org/Organization", label: "Organization", standard: "schema.org" }],
        props: [p("p2p_p_sid", "Supplier ID", "string", "Supplier number, e.g. S-00412.", { required: true }), p("p2p_p_sname", "Supplier name", "string", "Registered name.", { required: true }),
          p("p2p_p_tax", "Tax ID", "string", "Tax registration number.")], keyProps: ["p2p_p_sid"] },
      { id: PO, name: "Purchase Order", desc: "A commitment to buy goods or services from a supplier at agreed prices.", synonyms: ["PO"], parent: null, termId: null, sameAs: [],
        props: [p("p2p_p_pon", "PO number", "string", "Purchase order number, e.g. PO-104233.", { required: true }), p("p2p_p_podate", "PO date", "date", "Date issued.", { required: true }),
          p("p2p_p_poamt", "Total amount", "decimal", "Order total.")], keyProps: ["p2p_p_pon"] },
      { id: STAT, name: "PO Status", desc: "Where a purchase order is in its lifecycle.", synonyms: [], parent: null, termId: null, sameAs: [], props: [] },
      { id: RISK, name: "Supplier Risk Tier", desc: "How much supply or compliance risk a supplier carries.", synonyms: ["Risk rating"], parent: null, termId: null, sameAs: [], props: [] }],
    rels: [
      { id: "p2p_r_issued", from: PO, to: SUP, name: "issued to", inverse: "receives", cardinality: "many_to_one", required: true, kind: "association",
        synonyms: ["supplier", "vendor"], desc: "The supplier the purchase order is issued to." },
      { id: "p2p_r_status", from: PO, to: STAT, name: "has status", inverse: "is status of", cardinality: "many_to_one", required: true, kind: "association",
        synonyms: ["PO status"], desc: "The purchase order's current status." },
      { id: "p2p_r_risk", from: SUP, to: RISK, name: "rated", inverse: "rates", cardinality: "many_to_one", required: false, kind: "association",
        synonyms: ["risk tier", "risk rating"], desc: "The supplier's current risk tier." }],
    individuals: [
      v("p2p_v_open", "Open", STAT, "Raised, awaiting approval."), v("p2p_v_appr", "Approved", STAT, "Approved and sent to the supplier."),
      v("p2p_v_recv", "Received", STAT, "Goods or services received."), v("p2p_v_closed", "Closed", STAT, "Invoiced and paid; no further activity."),
      v("p2p_v_low", "Low", RISK, "No open findings."), v("p2p_v_med", "Medium", RISK, "Findings under remediation."),
      v("p2p_v_high", "High", RISK, "Single source, sanctions screening hit or failed audit.")],
    constraints: [
      { id: "p2p_k_pon", classId: PO, prop: "PO number", kind: "pattern", value: "^PO-[0-9]{6}$", severity: "violation", desc: "" },
      { id: "p2p_k_amt", classId: PO, prop: "Total amount", kind: "range", value: "0..", severity: "violation", desc: "" },
      { id: "p2p_k_tax", classId: SUP, prop: "Tax ID", kind: "required", value: "", severity: "warning", desc: "Needed before the first payment." }],
    mappings: [
      M.table("p2p", SUP, "SUPPLIERS", ["SUPPLIER_ID"]), M.table("p2p", PO, "PURCHASE_ORDERS", ["PO_NUMBER"]),
      M.field("p2p", SUP, "p2p_p_sid", "SUPPLIERS", "SUPPLIER_ID"), M.field("p2p", SUP, "p2p_p_sname", "SUPPLIERS", "SUPPLIER_NAME"), M.field("p2p", SUP, "p2p_p_tax", "SUPPLIERS", "TAX_ID"),
      M.field("p2p", PO, "p2p_p_pon", "PURCHASE_ORDERS", "PO_NUMBER"), M.field("p2p", PO, "p2p_p_podate", "PURCHASE_ORDERS", "PO_DATE"), M.field("p2p", PO, "p2p_p_poamt", "PURCHASE_ORDERS", "TOTAL_AMOUNT"),
      M.rel("p2p", PO, "p2p_r_issued", "PURCHASE_ORDERS", "SUPPLIER_ID"), M.rel("p2p", PO, "p2p_r_status", "PURCHASE_ORDERS", "PO_STATUS"), M.rel("p2p", SUP, "p2p_r_risk", "SUPPLIERS", "RISK_TIER")],
    tests: [{ id: "p2p_t_sup", question: "Which field identifies the supplier on a purchase order?", relId: "p2p_r_issued", expect: "PURCHASE_ORDERS.SUPPLIER_ID", approvedBy: "dev.patel" }],
    audience: ["Finance"], versions: [],
  });
  const r1 = ONT.publish(v1, "dev.patel", "Suppliers, purchase orders and risk tiers", "2026-11-07T11:00:00Z").ontology;
  // Submitted for review: order lines, supplier invoices, payment terms and high-risk suppliers.
  const o = OMD.ensureIris({
    ...r1,
    classes: [...r1.classes,
      { id: HIGH, name: "High-Risk Supplier", desc: "A supplier rated High. New purchase orders need a second approver.", synonyms: [], parent: SUP, termId: null, sameAs: [], props: [],
        restrictions: [{ id: "p2p_x_high", prop: "p2p_r_risk", kind: "value", target: "p2p_v_high", min: "", max: "" }] },
      { id: LINE, name: "Purchase Order Line", desc: "One item on a purchase order, at an agreed quantity and price.", synonyms: ["PO line"], parent: null, termId: null, sameAs: [],
        props: [p("p2p_p_lid", "Line ID", "string", "Line identifier.", { required: true }), p("p2p_p_item", "Item", "string", "What is being bought."),
          p("p2p_p_qty", "Quantity", "decimal", "Quantity ordered.", { required: true }), p("p2p_p_price", "Unit price", "decimal", "Agreed price per unit.", { required: true })], keyProps: ["p2p_p_lid"],
        restrictions: [{ id: "p2p_x_line1", prop: "p2p_r_line", kind: "count", target: PO, min: "1", max: "1" }] },
      { id: INV, name: "Supplier Invoice", desc: "A bill received from a supplier for a purchase order.", synonyms: ["AP invoice", "Vendor invoice"], parent: null, termId: null, sameAs: [], disjoint: [PO],
        props: [p("p2p_p_inum", "Invoice number", "string", "Supplier's invoice number.", { required: true }), p("p2p_p_idate", "Invoice date", "date", "Date on the invoice."),
          p("p2p_p_iamt", "Invoice amount", "decimal", "Amount billed.")], keyProps: ["p2p_p_inum"] },
      { id: TERMS, name: "Payment Terms", desc: "When a supplier is paid after a valid invoice.", synonyms: [], parent: null, termId: null, sameAs: [], props: [] }],
    rels: [...r1.rels,
      { id: "p2p_r_line", from: LINE, to: PO, name: "part of", inverse: "has line", cardinality: "many_to_one", required: true, kind: "part_of",
        synonyms: ["order line"], desc: "The purchase order the line belongs to." },
      { id: "p2p_r_inv", from: INV, to: PO, name: "billed for", inverse: "is billed by", cardinality: "many_to_one", required: false, kind: "association",
        synonyms: ["matched PO"], desc: "The purchase order the invoice is matched to." },
      { id: "p2p_r_terms", from: SUP, to: TERMS, name: "paid on", inverse: "applies to", cardinality: "many_to_one", required: false, kind: "association",
        synonyms: ["payment terms"], desc: "The supplier's agreed payment terms." }],
    individuals: [...r1.individuals,
      v("p2p_v_net30", "Net 30", TERMS, "Paid 30 days after a valid invoice."), v("p2p_v_net60", "Net 60", TERMS, "Paid 60 days after a valid invoice.")],
    constraints: [...r1.constraints,
      { id: "p2p_k_qty", classId: LINE, prop: "Quantity", kind: "range", value: "0..", severity: "violation", desc: "" },
      { id: "p2p_k_iamt", classId: INV, prop: "Invoice amount", kind: "range", value: "0..", severity: "violation", desc: "" }],
    mappings: [...r1.mappings, M.table("p2p", HIGH, "SUPPLIERS", ["SUPPLIER_ID"]), M.table("p2p", LINE, "PO_LINES", ["LINE_ID"]), M.table("p2p", INV, "SUPPLIER_INVOICES", ["INVOICE_NUMBER"]),
      M.field("p2p", LINE, "p2p_p_lid", "PO_LINES", "LINE_ID"), M.field("p2p", LINE, "p2p_p_item", "PO_LINES", "ITEM_DESCRIPTION"),
      M.field("p2p", LINE, "p2p_p_qty", "PO_LINES", "QUANTITY"), M.field("p2p", LINE, "p2p_p_price", "PO_LINES", "UNIT_PRICE"),
      M.field("p2p", INV, "p2p_p_inum", "SUPPLIER_INVOICES", "INVOICE_NUMBER"), M.field("p2p", INV, "p2p_p_idate", "SUPPLIER_INVOICES", "INVOICE_DATE"),
      M.field("p2p", INV, "p2p_p_iamt", "SUPPLIER_INVOICES", "INVOICE_AMOUNT"),
      M.rel("p2p", LINE, "p2p_r_line", "PO_LINES", "PO_NUMBER"), M.rel("p2p", INV, "p2p_r_inv", "SUPPLIER_INVOICES", "PO_NUMBER"),
      M.rel("p2p", SUP, "p2p_r_terms", "SUPPLIERS", "PAYMENT_TERMS")],
    tests: [...r1.tests,
      { id: "p2p_t_inv", question: "Which field links a supplier invoice to its purchase order?", relId: "p2p_r_inv", expect: "SUPPLIER_INVOICES.PO_NUMBER", approvedBy: "dev.patel" }],
  });
  return { ...o, review: { state: "in_review", submittedBy: "sarah.kim", submittedAt: "2026-11-21T16:40:00.000Z", comment: "Adds order lines, supplier invoices, payment terms and high-risk suppliers.", hash: OMD.draftHash(o) } };
}

// ── 3. Product Catalog · Product · Draft, never published ──
function productCatalog() {
  const by = "james.oh", M = mapper(by, "2026-11-20T09:00:00.000Z");
  const PROD = "pc_product", REC = "pc_recalled", CAT = "pc_category", BRAND = "pc_brand", LIFE = "pc_lifecycle", UOM = "pc_uom";
  return OMD.ensureIris({
    id: "ont_product", name: "Product Catalog", prefix: "prod", namespace: "https://ontology.jnj.com/product#", domain: "Product",
    owner: "priya.nair", owners: ["priya.nair"], steward: "james.oh", stewards: ["james.oh"], created: "2026-11-20", source: { kind: "native" },
    desc: "What we sell: products, the category tree they sit in, the brands they carry and where each is in its lifecycle.",
    imports: ["https://schema.org/"], license: "CC BY 4.0",
    classes: [
      { id: PROD, name: "Product", desc: "A sellable item, identified by its SKU.", synonyms: ["Item", "SKU"], parent: null, termId: "tc5",
        sameAs: [{ iri: "https://schema.org/Product", label: "Product", standard: "schema.org" }],
        props: [p("pc_p_sku", "SKU", "string", "Stock keeping unit, e.g. SKU-100045.", { required: true }), p("pc_p_name", "Product name", "string", "", { required: true }),
          p("pc_p_launch", "Launch date", "date", "Date the product went on sale."), p("pc_p_price", "List price", "decimal", "Current list price.")], keyProps: ["pc_p_sku"] },
      { id: REC, name: "Recalled Product", desc: "A product whose lifecycle status is Recalled. It must not be sold.", synonyms: [], parent: PROD, termId: null, sameAs: [], props: [],
        restrictions: [{ id: "pc_x_rec", prop: "pc_r_life", kind: "value", target: "pc_v_recalled", min: "", max: "" }] },
      { id: CAT, name: "Product Category", desc: "A node of the merchandising hierarchy a product is placed in.", synonyms: ["Category"], parent: null, termId: "tc8", sameAs: [], disjoint: [PROD],
        props: [p("pc_p_catid", "Category ID", "string", "", { required: true }), p("pc_p_catname", "Category name", "string", "", { required: true })], keyProps: ["pc_p_catid"] },
      { id: BRAND, name: "Brand", desc: "A name the group sells products under.", synonyms: [], parent: null, termId: null,
        sameAs: [{ iri: "https://schema.org/Brand", label: "Brand", standard: "schema.org" }],
        props: [p("pc_p_brandid", "Brand ID", "string", "", { required: true }), p("pc_p_brandname", "Brand name", "string", "", { required: true })], keyProps: ["pc_p_brandid"] },
      { id: LIFE, name: "Lifecycle Status", desc: "Whether a product can be sold.", synonyms: ["Product status"], parent: null, termId: null, sameAs: [], props: [] },
      { id: UOM, name: "Unit of Measure", desc: "The unit a product is sold in.", synonyms: ["UoM", "Pack size"], parent: null, termId: null, sameAs: [], props: [] }],
    rels: [
      { id: "pc_r_cat", from: PROD, to: CAT, name: "placed in", inverse: "contains", cardinality: "many_to_one", required: true, kind: "association",
        synonyms: ["category"], desc: "The category the product is placed in." },
      { id: "pc_r_sub", from: CAT, to: CAT, name: "subcategory of", inverse: "has subcategory", cardinality: "many_to_one", required: false, kind: "association",
        synonyms: ["parent category"], characteristics: ["transitive"], desc: "The category one level up. A subcategory of a subcategory is a subcategory." },
      { id: "pc_r_brand", from: PROD, to: BRAND, name: "sold under", inverse: "brands", cardinality: "many_to_one", required: false, kind: "association",
        synonyms: ["brand"], desc: "The brand the product is sold under." },
      { id: "pc_r_life", from: PROD, to: LIFE, name: "has lifecycle status", inverse: "is lifecycle status of", cardinality: "many_to_one", required: true, kind: "association",
        synonyms: ["status"], desc: "Whether the product can be sold." },
      { id: "pc_r_uom", from: PROD, to: UOM, name: "sold in", inverse: "is unit of", cardinality: "many_to_one", required: false, kind: "association",
        synonyms: ["unit", "pack size"], desc: "The unit the product is sold in. Not yet in the product master." }],
    individuals: [
      v("pc_v_active", "Active", LIFE, "On sale."), v("pc_v_disc", "Discontinued", LIFE, "No longer made; remaining stock may be sold."),
      v("pc_v_recalled", "Recalled", LIFE, "Withdrawn for safety or quality reasons; must not be sold."),
      v("pc_v_each", "Each", UOM, "A single unit."), v("pc_v_case", "Case", UOM, "A case of units."), v("pc_v_pallet", "Pallet", UOM, "A full pallet.")],
    constraints: [
      { id: "pc_k_sku", classId: PROD, prop: "SKU", kind: "pattern", value: "^SKU-[0-9]{6}$", severity: "violation", desc: "" },
      { id: "pc_k_price", classId: PROD, prop: "List price", kind: "range", value: "0..", severity: "violation", desc: "" },
      { id: "pc_k_sku_u", classId: PROD, prop: "SKU", kind: "unique", value: "", severity: "violation", desc: "" }],
    mappings: [
      M.table("pc", PROD, "PRODUCTS", ["SKU"]), M.table("pc", REC, "PRODUCTS", ["SKU"]), M.table("pc", CAT, "PRODUCT_CATEGORIES", ["CATEGORY_ID"]), M.table("pc", BRAND, "BRANDS", ["BRAND_ID"]),
      M.field("pc", PROD, "pc_p_sku", "PRODUCTS", "SKU"), M.field("pc", PROD, "pc_p_name", "PRODUCTS", "PRODUCT_NAME"),
      // Bound before the column was renamed to LAUNCH_DATE in the product master: shows as a broken link.
      M.field("pc", PROD, "pc_p_launch", "PRODUCTS", "LAUNCH_DT"), M.field("pc", PROD, "pc_p_price", "PRODUCTS", "LIST_PRICE"),
      M.field("pc", CAT, "pc_p_catid", "PRODUCT_CATEGORIES", "CATEGORY_ID"), M.field("pc", CAT, "pc_p_catname", "PRODUCT_CATEGORIES", "CATEGORY_NAME"),
      M.field("pc", BRAND, "pc_p_brandid", "BRANDS", "BRAND_ID"), M.field("pc", BRAND, "pc_p_brandname", "BRANDS", "BRAND_NAME"),
      M.rel("pc", PROD, "pc_r_cat", "PRODUCTS", "CATEGORY_ID"), M.rel("pc", CAT, "pc_r_sub", "PRODUCT_CATEGORIES", "PARENT_CATEGORY_ID"),
      M.rel("pc", PROD, "pc_r_brand", "PRODUCTS", "BRAND_ID"), M.rel("pc", PROD, "pc_r_life", "PRODUCTS", "LIFECYCLE_STATUS")],
    tests: [
      { id: "pc_t_cat", question: "Which field identifies a product's category?", relId: "pc_r_cat", expect: "PRODUCTS.CATEGORY_ID", approvedBy: "priya.nair" },
      { id: "pc_t_parent", question: "Which field holds the parent category?", relId: "pc_r_sub", expect: "PRODUCT_CATEGORIES.PARENT_CATEGORY_ID", approvedBy: "priya.nair" }],
    audience: ["Analytics"], versions: [],
  });
}

export function exampleOntologies() {
  return [orderToCash(), procureToPay(), productCatalog()];
}
