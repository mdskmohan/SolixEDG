// ─────────────────────────────────────────────────────────────────────────────
// Observed usage the semantic-model AI reads: warehouse query history, BI
// dashboards and dbt metrics. Already parsed into structured records (aggregate,
// column, filters, group-bys, joins), which is what a query-log harvester hands
// over. Seed data for the prototype.
// ─────────────────────────────────────────────────────────────────────────────

export const SL_USAGE = [
  // ── Snowflake query history ──
  { id: "q1", source: "query", object: "Snowflake query history", runs: 1840, users: 23,
    table: "orders", agg: "sum", col: "amount", filters: [{ col: "status", op: "is not", val: "cancelled" }],
    groupBy: ["created_at", "status"], label: "net revenue",
    joins: [{ from: "orders.customer_id", to: "customers.customer_id" }] },
  { id: "q2", source: "query", object: "Snowflake query history", runs: 960, users: 14,
    table: "orders", agg: "count distinct", col: "order_id", filters: [{ col: "status", op: "is not", val: "cancelled" }],
    groupBy: ["created_at"], label: "orders" },
  { id: "q3", source: "query", object: "Snowflake query history", runs: 410, users: 9,
    table: "orders", kind: "ratio", label: "average order value",
    numerator: { agg: "sum", col: "amount" }, denominator: { agg: "count distinct", col: "order_id" },
    filters: [{ col: "status", op: "is not", val: "cancelled" }], groupBy: ["created_at"] },
  { id: "q4", source: "query", object: "Snowflake query history", runs: 620, users: 11,
    table: "customers", agg: "count distinct", col: "customer_id", filters: [], groupBy: ["segment", "country"],
    label: "customers" },
  { id: "q5", source: "query", object: "Snowflake query history", runs: 300, users: 6,
    table: "customers", agg: "avg", col: "lifetime_value", filters: [], groupBy: ["segment"], label: "average lifetime value" },
  { id: "q6", source: "query", object: "Snowflake query history", runs: 1210, users: 18,
    table: "sales_transactions", agg: "sum", col: "amount", filters: [], groupBy: ["txn_date", "region", "channel"],
    label: "sales", joins: [{ from: "sales_transactions.customer_id", to: "customers.customer_id" }] },
  { id: "q7", source: "query", object: "Snowflake query history", runs: 540, users: 8,
    table: "campaign_spend", agg: "sum", col: "cost", filters: [], groupBy: ["spend_date", "channel"], label: "marketing spend" },
  { id: "q8", source: "query", object: "Snowflake query history", runs: 380, users: 7,
    table: "campaign_spend", kind: "ratio", label: "click-through rate",
    numerator: { agg: "sum", col: "clicks" }, denominator: { agg: "sum", col: "impressions" }, filters: [], groupBy: ["channel"] },
  { id: "q9", source: "query", object: "Snowflake query history", runs: 210, users: 5,
    table: "campaign_spend", kind: "ratio", label: "cost per click",
    numerator: { agg: "sum", col: "cost" }, denominator: { agg: "sum", col: "clicks" }, filters: [], groupBy: ["channel"] },
  { id: "q10", source: "query", object: "Databricks query history", runs: 890, users: 12,
    table: "web_sessions", agg: "count distinct", col: "session_id", filters: [], groupBy: ["session_date"], label: "sessions",
    joins: [{ from: "web_sessions.user_id", to: "users.user_id" }] },
  { id: "q11", source: "query", object: "Databricks query history", runs: 330, users: 6,
    table: "web_sessions", agg: "avg", col: "duration_s", filters: [], groupBy: ["session_date"], label: "average session duration" },
  { id: "q12", source: "query", object: "Databricks query history", runs: 1500, users: 21,
    table: "user_events", agg: "count distinct", col: "user_id", filters: [], groupBy: ["event_ts", "event_type"],
    label: "active users", joins: [{ from: "user_events.user_id", to: "users.user_id" }] },
  { id: "q13", source: "query", object: "Oracle query history", runs: 720, users: 10,
    table: "transactions", agg: "sum", col: "amount", filters: [{ col: "direction", op: "is", val: "credit" }],
    groupBy: ["txn_date", "currency"], label: "credits posted" },
  // ── BI dashboards ──
  { id: "b1", source: "bi", object: "Tableau · Revenue Overview", runs: 2600, users: 64,
    table: "orders", agg: "sum", col: "amount", filters: [{ col: "status", op: "is not", val: "cancelled" }],
    groupBy: ["created_at"], label: "revenue" },
  { id: "b2", source: "bi", object: "Power BI · Growth Scorecard", runs: 1900, users: 41,
    table: "customers", agg: "count distinct", col: "customer_id", filters: [], groupBy: ["created_at"], label: "new customers" },
  { id: "b3", source: "bi", object: "Power BI · Marketing ROI", runs: 700, users: 19,
    table: "campaign_spend", agg: "sum", col: "cost", filters: [], groupBy: ["campaign_id"], label: "spend" },
  // ── dbt metrics ──
  { id: "d1", source: "dbt", object: "dbt · metrics/revenue.yml", runs: 0, users: 0,
    table: "orders", agg: "sum", col: "amount", filters: [{ col: "status", op: "is not", val: "cancelled" }],
    groupBy: ["created_at"], label: "revenue" },
];

export const USAGE_SOURCE_LABEL = { query: "Query history", bi: "BI dashboards", dbt: "dbt metrics" };
