import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";

// ─────────────────────────────────────────────
// THEME SYSTEM
// ─────────────────────────────────────────────
const DARK = {
  bg:          "#09090b",
  bgSurface:   "#111115",
  bgElevated:  "#18181d",
  bgHover:     "#1f1f26",
  bgActive:    "#25252e",
  border:      "#27272e",
  borderLight: "#38383f",
  text:        "#f4f4f5",
  textSub:     "#a1a1aa",
  textMuted:   "#52525b",
  accent:      "#059669",
  accentDim:   "rgba(5,150,105,0.12)",
  blue:        "#7dd3fc",
  blueDim:     "rgba(125,211,252,0.10)",
  amber:       "#fbbf24",
  amberDim:    "rgba(251,191,36,0.10)",
  rose:        "#fda4af",
  roseDim:     "rgba(253,164,175,0.10)",
  violet:      "#c4b5fd",
  violetDim:   "rgba(196,181,253,0.10)",
  green:       "#4ade80",
  red:         "#f87171",
  yellow:      "#facc15",
  isDark:      true,
  logoFilter:  "brightness(0) invert(1)",
};

const LIGHT = {
  bg:          "#f8f8fa",
  bgSurface:   "#ffffff",
  bgElevated:  "#f1f1f5",
  bgHover:     "#e8e8f0",
  bgActive:    "#dddde8",
  border:      "#e2e2ea",
  borderLight: "#c8c8d8",
  text:        "#0f0f11",
  textSub:     "#4b4b60",
  textMuted:   "#9090a8",
  accent:      "#059669",
  accentDim:   "rgba(5,150,105,0.10)",
  blue:        "#0284c7",
  blueDim:     "rgba(2,132,199,0.10)",
  amber:       "#d97706",
  amberDim:    "rgba(217,119,6,0.10)",
  rose:        "#e11d48",
  roseDim:     "rgba(225,29,72,0.10)",
  violet:      "#7c3aed",
  violetDim:   "rgba(124,58,237,0.10)",
  green:       "#16a34a",
  red:         "#dc2626",
  yellow:      "#ca8a04",
  isDark:      false,
  logoFilter:  "none",
};

// Mutable token object — mutated in place so all existing T.xxx refs work
const T = { ...DARK };

const ThemeCtx = createContext({isDark:true,toggleTheme:()=>{}});
const useTheme = () => useContext(ThemeCtx);
const NavCtx = createContext(()=>{});
const useNav = () => useContext(NavCtx);

// ─────────────────────────────────────────────
// DYNAMIC GLOBAL STYLES
// ─────────────────────────────────────────────
const makeG = (t) => `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;background:${t.bg};color:${t.text};font-family:'Geist',sans-serif;font-size:13px;line-height:1.5;transition:background .25s,color .25s;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:${t.border};border-radius:2px;}
button{cursor:pointer;font-family:inherit;font-size:inherit;}
input,textarea,select{font-family:inherit;font-size:inherit;transition:background .25s,border-color .2s,color .2s;}
.mono{font-family:'Geist Mono',monospace;}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes scaleIn{from{opacity:0;transform:scale(.96);}to{opacity:1;transform:scale(1);}}
@keyframes slideIn{from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:translateX(0);}}
@keyframes pulse2{0%,100%{opacity:1;}50%{opacity:.4;}}
@keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
.fadeUp{animation:fadeUp .2s ease both;}
.fadeIn{animation:fadeIn .15s ease both;}
.scaleIn{animation:scaleIn .18s ease both;}
.slideIn{animation:slideIn .15s ease both;}
.row-hover:hover{background:${t.bgHover}!important;cursor:pointer;}
.btn-hover:hover{opacity:.8;}
*{transition:background-color .2s,border-color .2s,color .15s,box-shadow .2s;}
[title]{position:relative;}
[title]:hover::after{content:attr(title);position:fixed;background:${t.bgActive};color:${t.text};border:1px solid ${t.border};border-radius:5px;padding:4px 8px;font-size:11px;font-weight:500;white-space:nowrap;pointer-events:none;z-index:9999;margin-top:36px;box-shadow:0 4px 12px rgba(0,0,0,.3);}
`;

// ─────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────
const ASSETS = [
  {id:1,name:"orders",type:"Table",domain:"Commerce",owner:"maya.chen",steward:"dev.patel",cert:"Certified",quality:94,usage:"High",updated:"2h ago",db:"warehouse.prod",rows:"48.2M",size:"12.4 GB",tags:["PII","revenue"],description:"Core transactional orders table. Source of truth for all order data.",slaFreshness:"2h"},
  {id:2,name:"customers",type:"Table",domain:"Commerce",owner:"dev.patel",steward:"dev.patel",cert:"Certified",quality:91,usage:"High",updated:"1d ago",db:"warehouse.prod",rows:"3.1M",size:"2.8 GB",tags:["PII"],description:"Master customer dimension table from Salesforce CRM.",slaFreshness:"6h"},
  {id:3,name:"revenue_dashboard",type:"Dashboard",domain:"Finance",owner:"sarah.kim",steward:"sarah.kim",cert:"In Review",quality:87,usage:"Med",updated:"3d ago",db:"looker.prod",rows:"—",size:"—",tags:["finance"],description:"Executive revenue dashboard used in weekly reporting.",slaFreshness:"24h"},
  {id:4,name:"product_events",type:"Table",domain:"Product",owner:"alex.wu",steward:"alex.wu",cert:"Uncertified",quality:72,usage:"Med",updated:"5d ago",db:"warehouse.prod",rows:"210M",size:"38 GB",tags:["events"],description:"Raw product analytics events from web and mobile.",slaFreshness:"1h"},
  {id:5,name:"ml_churn_model",type:"ML Model",domain:"ML",owner:"priya.nair",steward:"priya.nair",cert:"Certified",quality:88,usage:"Low",updated:"1w ago",db:"mlflow.prod",rows:"—",size:"420 MB",tags:["model"],description:"Gradient-boosted churn prediction model v3.2.",slaFreshness:"72h"},
  {id:6,name:"etl_orders_pipeline",type:"Pipeline",domain:"Commerce",owner:"james.oh",steward:"james.oh",cert:"Certified",quality:96,usage:"High",updated:"30m ago",db:"airflow.prod",rows:"—",size:"—",tags:["etl"],description:"Fivetran-powered orders ETL. Runs hourly.",slaFreshness:"2h"},
  {id:7,name:"user_sessions",type:"Table",domain:"Product",owner:"alex.wu",steward:"alex.wu",cert:"Deprecated",quality:45,usage:"Low",updated:"2w ago",db:"warehouse.prod",rows:"890M",size:"142 GB",tags:["PII","events"],description:"Legacy session table. Use product_events instead.",slaFreshness:"4h"},
  {id:8,name:"finance_summary",type:"Dashboard",domain:"Finance",owner:"sarah.kim",steward:"sarah.kim",cert:"Certified",quality:92,usage:"High",updated:"4h ago",db:"tableau.prod",rows:"—",size:"—",tags:["finance","sensitive"],description:"Finance summary report for leadership.",slaFreshness:"24h"},
  {id:9,name:"dim_products",type:"Table",domain:"Commerce",owner:"james.oh",steward:"maya.chen",cert:"Certified",quality:98,usage:"High",updated:"1h ago",db:"warehouse.prod",rows:"82K",size:"45 MB",tags:["dimension"],description:"Product dimension with SKU, categories, pricing.",slaFreshness:"24h"},
  {id:10,name:"marketing_attribution",type:"Dashboard",domain:"Marketing",owner:"lisa.ray",steward:"lisa.ray",cert:"Uncertified",quality:79,usage:"Med",updated:"6d ago",db:"looker.prod",rows:"—",size:"—",tags:["marketing"],description:"Multi-touch attribution reporting.",slaFreshness:"24h"},
];

const SCHEMA = {
  orders:[
    {name:"order_id",type:"BIGINT",desc:"Unique order identifier",pii:false,nullable:false,quality:"NOT NULL",pk:true},
    {name:"customer_id",type:"BIGINT",desc:"Reference to customers.customer_id",pii:true,nullable:false,quality:"FK valid",pk:false},
    {name:"email",type:"VARCHAR(255)",desc:"Customer email at order time",pii:true,nullable:true,quality:"Format valid",pk:false},
    {name:"amount",type:"DECIMAL(12,2)",desc:"Order total in USD",pii:false,nullable:false,quality:"amount > 0",pk:false},
    {name:"status",type:"ENUM",desc:"Order lifecycle status",pii:false,nullable:false,quality:"Value in set",pk:false},
    {name:"shipping_address",type:"JSONB",desc:"Shipping address blob",pii:true,nullable:true,quality:"Schema valid",pk:false},
    {name:"created_at",type:"TIMESTAMP",desc:"Order creation time",pii:false,nullable:false,quality:"< 2h lag",pk:false},
    {name:"updated_at",type:"TIMESTAMP",desc:"Last modification",pii:false,nullable:false,quality:"Freshness",pk:false},
  ],
};

const QUALITY_RULES = [
  {id:1,table:"orders",rule:"Completeness: order_id NOT NULL",status:"passing",score:100,runs:1440,lastRun:"2m ago",dim:"Completeness"},
  {id:2,table:"orders",rule:"Freshness: updated_at < 2h",status:"passing",score:98,runs:720,lastRun:"5m ago",dim:"Freshness"},
  {id:3,table:"customers",rule:"Uniqueness: email unique",status:"warning",score:87,runs:360,lastRun:"12m ago",dim:"Uniqueness"},
  {id:4,table:"product_events",rule:"Schema drift detection",status:"failing",score:0,runs:240,lastRun:"1h ago",dim:"Validity"},
  {id:5,table:"user_sessions",rule:"Completeness: session_id",status:"failing",score:41,runs:180,lastRun:"3h ago",dim:"Completeness"},
  {id:6,table:"orders",rule:"Accuracy: amount > 0",status:"passing",score:99,runs:1440,lastRun:"3m ago",dim:"Accuracy"},
  {id:7,table:"dim_products",rule:"Referential integrity: category_id",status:"passing",score:100,runs:96,lastRun:"15m ago",dim:"Integrity"},
  {id:8,table:"customers",rule:"Freshness: updated_at < 6h",status:"passing",score:95,runs:240,lastRun:"8m ago",dim:"Freshness"},
];

const POLICIES = [
  {id:1,name:"PII Data Handling",scope:"All Tables",severity:"Critical",status:"Active",assets:23,violations:2,owner:"maya.chen",updated:"3d ago",description:"Governs handling of personally identifiable information across all data assets."},
  {id:2,name:"Data Retention 90d",scope:"Events Tables",severity:"High",status:"Active",assets:12,violations:0,owner:"dev.patel",updated:"1w ago",description:"Events data must be purged or archived after 90 days per policy."},
  {id:3,name:"GDPR Compliance",scope:"EU Data",severity:"Critical",status:"Active",assets:31,violations:5,owner:"maya.chen",updated:"2d ago",description:"GDPR Article 5 requirements for data collected from EU subjects."},
  {id:4,name:"SOC2 Access Controls",scope:"Finance Domain",severity:"High",status:"Active",assets:8,violations:0,owner:"sarah.kim",updated:"1w ago",description:"Access must follow least-privilege and be reviewed quarterly."},
  {id:5,name:"Column Encryption PII",scope:"PII Columns",severity:"Critical",status:"Draft",assets:0,violations:0,owner:"dev.patel",updated:"Today",description:"All PII columns must be encrypted at rest using AES-256."},
  {id:6,name:"Model Governance",scope:"ML Domain",severity:"High",status:"Active",assets:5,violations:1,owner:"priya.nair",updated:"5d ago",description:"ML models must be versioned, documented, and audited before production."},
];

const ACCESS_REQUESTS = [
  {id:1,user:"john.doe",asset:"customers",level:"Read",status:"Pending",since:"2h ago",reason:"Analytics project Q4",team:"Analytics"},
  {id:2,user:"alice.wang",asset:"orders",level:"Write",status:"Pending",since:"5h ago",reason:"Data cleanup sprint",team:"Data Eng"},
  {id:3,user:"bob.smith",asset:"finance_summary",level:"Read",status:"Approved",since:"1d ago",reason:"Budget review cycle",team:"Finance"},
  {id:4,user:"carol.jones",asset:"ml_churn_model",level:"Read",status:"Denied",since:"2d ago",reason:"Research project",team:"Product"},
  {id:5,user:"marc.tran",asset:"product_events",level:"Read",status:"Pending",since:"30m ago",reason:"Funnel analysis",team:"Analytics"},
];

const CONTRACTS = [
  {id:1,name:"orders-v2",provider:"etl_orders_pipeline",consumer:"revenue_dashboard",status:"Active",version:"2.1.0",sla:"99.9%",schema:"orders_v2",owners:["james.oh","sarah.kim"],updated:"2d ago",description:"Guarantees orders schema stability and freshness for downstream BI."},
  {id:2,name:"customers-v1",provider:"crm_sync",consumer:"ml_churn_model",status:"Active",version:"1.4.2",sla:"99.5%",schema:"customers_v1",owners:["dev.patel","priya.nair"],updated:"5d ago",description:"CRM customer data contract for ML feature pipeline consumption."},
  {id:3,name:"events-v3",provider:"kafka_events",consumer:"product_events",status:"Deprecated",version:"3.0.1",sla:"98%",schema:"events_v3",owners:["alex.wu"],updated:"2w ago",description:"Legacy events contract. Migrate to events-v4 immediately."},
  {id:4,name:"finance-agg-v1",provider:"finance_summary",consumer:"exec_reporting",status:"Active",version:"1.0.0",sla:"99.9%",schema:"finance_v1",owners:["sarah.kim"],updated:"1w ago",description:"Aggregated finance metrics for executive reporting layer."},
];

const GLOSSARY_TERMS = [
  {id:1,term:"Customer Lifetime Value",abbr:"CLV",domain:"Commerce",owner:"maya.chen",linked:4,status:"Approved",definition:"Predicted revenue a customer will generate over their lifetime."},
  {id:2,term:"Monthly Recurring Revenue",abbr:"MRR",domain:"Finance",owner:"sarah.kim",linked:7,status:"Approved",definition:"Normalized monthly subscription revenue."},
  {id:3,term:"Daily Active Users",abbr:"DAU",domain:"Product",owner:"alex.wu",linked:3,status:"Approved",definition:"Count of unique users who perform an action within a calendar day."},
  {id:4,term:"Churn Rate",abbr:"—",domain:"Commerce",owner:"maya.chen",linked:2,status:"In Review",definition:"Percentage of customers who stop subscribing within a period."},
  {id:5,term:"Gross Margin",abbr:"GM",domain:"Finance",owner:"sarah.kim",linked:5,status:"Approved",definition:"Revenue minus cost of goods sold, expressed as a percentage."},
  {id:6,term:"Attribution Window",abbr:"—",domain:"Marketing",owner:"lisa.ray",linked:1,status:"Draft",definition:"Time period in which conversions are credited to a marketing touchpoint."},
  {id:7,term:"Conversion Rate",abbr:"CVR",domain:"Product",owner:"alex.wu",linked:3,status:"Approved",definition:"Percentage of users who complete a desired action."},
];

const COMMENTS = [
  {id:1,user:"dev.patel",avatar:"DP",text:"The email column has inconsistent casing — should be lowercased at ingestion. Opened a dbt PR.",time:"3h ago",resolved:false},
  {id:2,user:"maya.chen",avatar:"MC",text:"Agreed. Also, we should add a validation rule here. @james.oh can you add this to quality suite?",time:"2h ago",resolved:false},
  {id:3,user:"james.oh",avatar:"JO",text:"Done — added `LOWER(email)` check to quality rules. Will deploy tonight.",time:"1h ago",resolved:true},
];

const STEWARDSHIP_TASKS = [
  {id:1,type:"Certification Review",asset:"revenue_dashboard",priority:"High",due:"2d",assigned:"maya.chen",status:"Open"},
  {id:2,type:"Orphan Assignment",asset:"marketing_attribution",priority:"Med",due:"5d",assigned:"maya.chen",status:"Open"},
  {id:3,type:"PII Audit",asset:"user_sessions",priority:"Critical",due:"1d",assigned:"dev.patel",status:"In Progress"},
  {id:4,type:"Schema Documentation",asset:"product_events",priority:"Med",due:"1w",assigned:"alex.wu",status:"Open"},
  {id:5,type:"Access Review",asset:"finance_summary",priority:"High",due:"3d",assigned:"sarah.kim",status:"In Progress"},
  {id:6,type:"Quality Rule Update",asset:"customers",priority:"Low",due:"2w",assigned:"dev.patel",status:"Open"},
];

const CERTIFICATIONS = [
  {id:1,asset:"orders",type:"Table",certifier:"maya.chen",date:"2024-01-15",expires:"2024-07-15",status:"Active",score:94,notes:"Reviewed schema, lineage, PII handling, and quality rules."},
  {id:2,asset:"customers",type:"Table",certifier:"dev.patel",date:"2024-01-10",expires:"2024-07-10",status:"Active",score:91,notes:"All PII columns tagged. Retention policy applied."},
  {id:3,asset:"ml_churn_model",type:"ML Model",certifier:"priya.nair",date:"2024-02-01",expires:"2024-08-01",status:"Active",score:88,notes:"Model card complete. Bias audit passed."},
  {id:4,asset:"revenue_dashboard",type:"Dashboard",certifier:null,date:null,expires:null,status:"Pending",score:87,notes:"Awaiting data steward review."},
  {id:5,asset:"dim_products",type:"Table",certifier:"james.oh",date:"2024-01-20",expires:"2024-07-20",status:"Active",score:98,notes:"Golden dataset — highest quality in warehouse."},
];

const TEAMS_DATA = [
  {name:"maya.chen",email:"maya@solix.com",role:"Data Steward",domain:"Commerce",assets:342,joined:"Jan 2023",status:"Active"},
  {name:"dev.patel",email:"dev@solix.com",role:"Data Engineer",domain:"Commerce",assets:218,joined:"Mar 2023",status:"Active"},
  {name:"sarah.kim",email:"sarah@solix.com",role:"Data Steward",domain:"Finance",assets:156,joined:"Feb 2022",status:"Active"},
  {name:"alex.wu",email:"alex@solix.com",role:"Analytics Engineer",domain:"Product",assets:289,joined:"Jun 2023",status:"Active"},
  {name:"priya.nair",email:"priya@solix.com",role:"ML Engineer",domain:"ML",assets:94,joined:"Sep 2023",status:"Active"},
  {name:"james.oh",email:"james@solix.com",role:"Data Engineer",domain:"Commerce",assets:178,joined:"Nov 2022",status:"Active"},
  {name:"lisa.ray",email:"lisa@solix.com",role:"Analytics Engineer",domain:"Marketing",assets:67,joined:"Jan 2024",status:"Active"},
  {name:"tom.vance",email:"tom@solix.com",role:"Compliance Officer",domain:"All",assets:0,joined:"Mar 2022",status:"Active"},
];

// ─────────────────────────────────────────────
// ICON SYSTEM
// ─────────────────────────────────────────────
const Ic = {
  home:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M2 6.5L8 2l6 4.5V14a.5.5 0 01-.5.5h-4V10H6.5v4.5H2.5A.5.5 0 012 14V6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  search:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  catalog:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2" width="13" height="2.5" rx=".8" fill="currentColor" opacity=".9"/><rect x="1.5" y="6.5" width="13" height="2.5" rx=".8" fill="currentColor" opacity=".6"/><rect x="1.5" y="11" width="13" height="2.5" rx=".8" fill="currentColor" opacity=".3"/></svg>,
  lineage:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="3" cy="8" r="2" fill="currentColor"/><circle cx="13" cy="4" r="2" fill="currentColor"/><circle cx="13" cy="12" r="2" fill="currentColor"/><path d="M5 8L11 4M5 8L11 12" stroke="currentColor" strokeWidth="1.2" strokeOpacity=".6"/></svg>,
  quality:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 1.5L9.6 6H14.5l-4 2.9 1.5 4.6L8 11 4 13.5l1.5-4.6L1.5 6H6.4L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>,
  policies:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><rect x="3" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M6 5.5h4M6 8.5h4M6 11.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  access:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="2.8" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 14c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  compliance:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 1.5L13.5 4v4c0 3.5-2.5 5.8-5.5 6.5C5 14 2 11.5 2 8V4L8 1.5Z" stroke="currentColor" strokeWidth="1.3"/><path d="M5.5 8.5l2 2L11 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  steward:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 4H14l-3.5 2.5 1.3 4-3.8-2.8L4.2 12.5l1.3-4L2 6h4.5L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>,
  cert:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5.5 13.5l2.5-.8 2.5.8V11A4.5 4.5 0 015.5 11v2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 7l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  glossary:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M2.5 3h11M2.5 7h7M2.5 11h9M2.5 14.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  domain:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1.5v13M1.5 8h13" stroke="currentColor" strokeWidth="1" strokeOpacity=".5"/><path d="M3 4.5C4.5 5.5 6.5 6 8 6s3.5-.5 5-1.5M3 11.5C4.5 10.5 6.5 10 8 10s3.5.5 5 1.5" stroke="currentColor" strokeWidth="1" strokeOpacity=".4"/></svg>,
  contracts:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M3.5 2h7l3 3v9a.8.8 0 01-.8.8H3.5a.8.8 0 01-.8-.8V2.8A.8.8 0 013.5 2Z" stroke="currentColor" strokeWidth="1.3"/><path d="M10.5 2v4h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 9.5l1.5 1.5L11 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  obs:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M1.5 12L5 7.5l3 2 3-5 2.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="14" cy="10" r="1.5" fill="currentColor"/></svg>,
  analytics:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><rect x="1.5" y="10" width="3" height="4.5" rx="1" fill="currentColor"/><rect x="6.5" y="6" width="3" height="8.5" rx="1" fill="currentColor"/><rect x="11.5" y="2" width="3" height="12.5" rx="1" fill="currentColor"/></svg>,
  settings:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  teams:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="11" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M11 8.5c1.8 0 3.5.8 3.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  integrations:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><rect x="1.5" y="5.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="9.5" y="5.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 8h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  plus:(s=14)=><svg width={s} height={s} viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  chevDown:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chevRight:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chevLeft:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  check:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  alert:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M6 1.5L11 10.5H1L6 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M6 5v2.5M6 9.5h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  dot:(s=8,c=T.accent)=><svg width={s} height={s} viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill={c}/></svg>,
  arrow:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  tag:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M1 1.5h5l5 5-5 5-5-5V1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><circle cx="3.5" cy="4" r=".8" fill="currentColor"/></svg>,
  filter:(s=14)=><svg width={s} height={s} viewBox="0 0 14 14" fill="none"><path d="M1.5 3.5h11M4 7h6M6 10.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  bell:(s=15)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 2C6 2 4.5 3.5 4.5 5.5V10l-1 2h9l-1-2V5.5C11.5 3.5 10 2 8 2Z" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3"/></svg>,
  edit:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5L10.5 3.5l-7 7L1 12l1-2.5 7-8Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>,
  trash:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M2 3h8M4 3V2h4v1M4.5 5.5v3M7.5 5.5v3M3 3l.5 7.5h5L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  copy:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M3 8H2.5A1.5 1.5 0 011 6.5V2.5A1.5 1.5 0 012.5 1h4A1.5 1.5 0 018 2.5V3" stroke="currentColor" strokeWidth="1.2"/></svg>,
  external:(s=12)=><svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M8 1h3v3M11 1L7 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  comment:(s=14)=><svg width={s} height={s} viewBox="0 0 14 14" fill="none"><path d="M1.5 2.5h11v8a.5.5 0 01-.5.5h-7L2 13.5V11h-.5a.5.5 0 01-.5-.5v-8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M4 5.5h6M4 8h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  refresh:(s=13)=><svg width={s} height={s} viewBox="0 0 13 13" fill="none"><path d="M11 6.5A4.5 4.5 0 112 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M11 3v3.5H7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  shield:(s=14)=><svg width={s} height={s} viewBox="0 0 14 14" fill="none"><path d="M7 1.5L12 4v4.5c0 2.5-2 4.5-5 5.5-3-1-5-3-5-5.5V4L7 1.5Z" stroke="currentColor" strokeWidth="1.3"/></svg>,
  upload:(s=14)=><svg width={s} height={s} viewBox="0 0 14 14" fill="none"><path d="M2.5 9.5v2a.5.5 0 00.5.5h8a.5.5 0 00.5-.5v-2M7 2v7M4.5 4.5L7 2l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  branches:(s=14)=><svg width={s} height={s} viewBox="0 0 14 14" fill="none"><circle cx="3.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="3.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="10.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 5v4M5 3.5h2.5c1.5 0 2 1 2 2v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  info:(s=13)=><svg width={s} height={s} viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M6.5 5.5v4M6.5 3.5h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
};

// ─────────────────────────────────────────────
// PRIMITIVE COMPONENTS
// ─────────────────────────────────────────────
const Badge = ({children, color=T.textSub, bg=T.bgElevated, border})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"1.5px 7px",borderRadius:99,fontSize:11,fontWeight:500,color,background:bg,border:`1px solid ${border||T.border}`,whiteSpace:"nowrap",lineHeight:1.6}}>
    {children}
  </span>
);

const certStyle = c => ({
  "Certified":  {color:T.accent, bg:T.accentDim, border:"rgba(110,231,183,0.2)"},
  "In Review":  {color:T.amber, bg:T.amberDim, border:"rgba(252,211,77,0.2)"},
  "Uncertified":{color:T.textSub, bg:T.bgElevated, border:T.border},
  "Deprecated": {color:T.rose, bg:T.roseDim, border:"rgba(253,164,175,0.2)"},
  "Pending":    {color:T.amber, bg:T.amberDim, border:"rgba(252,211,77,0.2)"},
  "Active":     {color:T.accent, bg:T.accentDim, border:"rgba(110,231,183,0.2)"},
}[c]||{color:T.textSub, bg:T.bgElevated, border:T.border});

const CertBadge = ({cert})=>{const s=certStyle(cert);return <Badge color={s.color} bg={s.bg} border={s.border}>{Ic.check(10)} {cert}</Badge>;};

const typeStyle = t => ({
  "Table":       {color:T.blue,   bg:T.blueDim},
  "Dashboard":   {color:T.violet, bg:T.violetDim},
  "Pipeline":    {color:T.amber,  bg:T.amberDim},
  "ML Model":    {color:T.rose,   bg:T.roseDim},
  "Database":    {color:T.accent, bg:T.accentDim},
  "Data Product":{color:T.text,   bg:T.bgElevated},
}[t]||{color:T.textSub,bg:T.bgElevated});

const TypeBadge = ({type})=>{const s=typeStyle(type);return <Badge color={s.color} bg={s.bg}>{type}</Badge>;};

const QScore = ({score})=>{
  const c = score>=90?T.green:score>=70?T.amber:T.red;
  return <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12}}>
    <span style={{display:"inline-block",width:36,height:3,borderRadius:2,background:T.bgHover,overflow:"hidden",flexShrink:0}}>
      <span style={{display:"block",width:`${score}%`,height:"100%",background:c,borderRadius:2}}/>
    </span>
    <span style={{color:c,fontWeight:600,fontFamily:"'Geist Mono',monospace",fontSize:11,minWidth:20}}>{score}</span>
  </span>;
};

const SDot = ({status})=>{
  const c = {passing:T.green,warning:T.yellow,failing:T.red,Active:T.green,Draft:T.textSub,Pending:T.yellow,Approved:T.green,Denied:T.red,Deprecated:T.red,"In Progress":T.blue,"In Review":T.amber,"Open":T.textSub}[status]||T.textSub;
  return <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:c,flexShrink:0}}/>;
};

const Btn = ({children,variant="default",onClick,small,icon,style:s={}})=>{
  const vs = {
    default:{bg:T.bgElevated,color:T.text,border:T.border},
    primary:{bg:T.accent,color:"#052e16",border:T.accent},
    ghost:  {bg:"transparent",color:T.textSub,border:"transparent"},
    danger: {bg:"rgba(248,113,113,0.08)",color:T.red,border:"rgba(248,113,113,0.25)"},
    amber:  {bg:"rgba(252,211,77,0.08)",color:T.amber,border:"rgba(252,211,77,0.25)"},
  };
  const v=vs[variant]||vs.default;
  return <button className="btn-hover" onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:6,padding:small?"4px 10px":"6px 14px",borderRadius:7,border:`1px solid ${v.border}`,background:v.bg,color:v.color,fontSize:12,fontWeight:500,transition:"opacity .15s",...s}}>{icon&&icon}{children}</button>;
};

const Input2 = ({placeholder,value,onChange,icon,style:s={},multiline,rows=4})=>{
  const base={width:"100%",padding:icon?"7px 12px 7px 32px":"7px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:13,outline:"none",...s};
  return <div style={{position:"relative",display:"flex",alignItems:multiline?"flex-start":"center"}}>
    {icon&&<span style={{position:"absolute",left:10,top:multiline?10:0,color:T.textMuted,pointerEvents:"none",display:"flex",alignItems:"center",height:multiline?"auto":"100%"}}>{icon}</span>}
    {multiline
      ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{...base,resize:"vertical"}} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
      : <input value={value} onChange={onChange} placeholder={placeholder} style={base} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>}
  </div>;
};

const Tabs2 = ({tabs,active,onChange,pill})=>(
  <div style={pill?{display:"flex",gap:4,padding:3,background:T.bgElevated,borderRadius:9,border:`1px solid ${T.border}`}:{display:"flex",gap:2,borderBottom:`1px solid ${T.border}`}}>
    {tabs.map(t=>{
      const isA=active===t.key||(typeof t==="string"&&active===t);
      const label=typeof t==="string"?t:t.label;
      const key=typeof t==="string"?t:t.key;
      return pill
        ? <button key={key} onClick={()=>onChange(key)} style={{padding:"5px 14px",fontSize:12,fontWeight:500,color:isA?T.text:T.textSub,background:isA?T.bgHover:"transparent",border:`1px solid ${isA?T.borderLight:"transparent"}`,borderRadius:7,cursor:"pointer",transition:"all .15s"}}>{label}</button>
        : <button key={key} onClick={()=>onChange(key)} style={{padding:"9px 16px",fontSize:12,fontWeight:500,color:isA?T.text:T.textSub,background:"transparent",border:"none",borderBottom:isA?`2px solid ${T.accent}`:"2px solid transparent",cursor:"pointer",transition:"all .15s",marginBottom:-1}}>{label}</button>;
    })}
  </div>
);

const Card2 = ({children,style={}})=>(
  <div style={{background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:10,...style}}>
    {children}
  </div>
);

const SH = ({title,sub,action,style={}})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,...style}}>
    <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>{title}</div>{sub&&<div style={{fontSize:11,color:T.textMuted,marginTop:1}}>{sub}</div>}</div>
    {action}
  </div>
);

const Metric = ({label,value,delta,color=T.accent,icon})=>(
  <Card2 style={{padding:"14px 18px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
      <span style={{fontSize:10,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600}}>{label}</span>
      {icon&&<span style={{color:T.textMuted}}>{icon}</span>}
    </div>
    <div style={{fontSize:26,fontWeight:700,color,fontFamily:"'Geist Mono',monospace",letterSpacing:"-0.04em"}}>{value}</div>
    {delta&&<div style={{fontSize:11,color:delta.startsWith("+")?T.green:T.red,marginTop:4}}>{delta}</div>}
  </Card2>
);

const DataTable = ({cols,rows,onRowClick,emptyMsg="No data"})=>(
  <div style={{overflowX:"auto"}}>
    {rows.length===0
      ? <div style={{padding:"40px 20px",textAlign:"center",color:T.textMuted,fontSize:13}}>{emptyMsg}</div>
      : <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>{cols.map(c=><th key={c.key} style={{padding:"8px 14px",fontSize:11,fontWeight:500,color:T.textMuted,textAlign:"left",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:"0.06em"}}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row,i)=>(
              <tr key={i} className={onRowClick?"row-hover":""} onClick={()=>onRowClick&&onRowClick(row)} style={{borderBottom:`1px solid ${T.border}`,transition:"background .1s"}}>
                {cols.map(c=><td key={c.key} style={{padding:"10px 14px",fontSize:12,color:T.text,verticalAlign:"middle"}}>{c.render?c.render(row[c.key],row):row[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>}
  </div>
);

// ─────────────────────────────────────────────
// MODAL SYSTEM
// ─────────────────────────────────────────────
const Modal = ({open,onClose,title,children,width=540})=>{
  if(!open)return null;
  return <div className="fadeIn" style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
    <div className="scaleIn" style={{background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:14,width:"100%",maxWidth:width,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 22px",borderBottom:`1px solid ${T.border}`}}>
        <span style={{fontSize:14,fontWeight:600,color:T.text}}>{title}</span>
        <button onClick={onClose} style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer",display:"flex"}}>{Ic.x(14)}</button>
      </div>
      <div style={{padding:22}}>{children}</div>
    </div>
  </div>;
};

const Toast = ({msg,type="success",onDone})=>{
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[]);
  const c = type==="success"?T.accent:type==="error"?T.red:T.amber;
  return <div className="scaleIn" style={{position:"fixed",bottom:24,right:24,zIndex:2000,background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 18px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
    <span style={{color:c}}>{type==="success"?Ic.check(14):Ic.alert(14)}</span>
    <span style={{fontSize:13,color:T.text}}>{msg}</span>
  </div>;
};

// ─────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────
const NAV = [
  {section:"Workspace",items:[{id:"home",label:"Home",icon:"home"},{id:"search",label:"Search",icon:"search"}]},
  {section:"Catalog",items:[{id:"catalog",label:"Data Catalog",icon:"catalog"},{id:"lineage",label:"Lineage",icon:"lineage"},{id:"quality",label:"Data Quality",icon:"quality"},{id:"contracts",label:"Contracts",icon:"contracts"}]},
  {section:"Governance",items:[{id:"policies",label:"Policies",icon:"policies"},{id:"access",label:"Access Governance",icon:"access"},{id:"compliance",label:"Compliance",icon:"compliance"},{id:"certifications",label:"Certifications",icon:"cert"},{id:"stewardship",label:"Stewardship",icon:"steward"}]},
  {section:"Knowledge",items:[{id:"glossary",label:"Business Glossary",icon:"glossary"},{id:"domains",label:"Data Domains",icon:"domain"}]},
  {section:"Insights",items:[{id:"observability",label:"Observability",icon:"obs"},{id:"analytics",label:"Usage Analytics",icon:"analytics"}]},
  {section:"Organization",items:[{id:"integrations",label:"Integrations",icon:"integrations"}]},
];

const COLLAPSED_W = 60;
const EXPANDED_W  = 240;

const Sidebar = ({active, onNav, exp, setExp}) => {

  return (
    <div
      style={{
        width: exp ? EXPANDED_W : COLLAPSED_W,
        height: "100vh",
        background: T.bgSurface,
        borderRight: `1px solid ${T.border}`,
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        left: 0, top: 0,
        zIndex: 200,
        overflow: "visible",
        transition: "width .2s ease, box-shadow .2s ease",
        boxShadow: exp ? "4px 0 20px rgba(0,0,0,.22)" : "none",
        flexShrink: 0,
      }}>

      {/* ── LOGO HEADER ── */}
      <div
        onClick={() => setExp(v => !v)}
        title={exp ? "Collapse sidebar" : "Expand sidebar"}
        style={{
          height: 54,
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: exp ? 14 : 0,
          paddingRight: exp ? 10 : 0,
          justifyContent: exp ? "flex-start" : "center",
          gap: 10,
          flexShrink: 0,
          overflow: "hidden",
          cursor: "pointer",
          userSelect: "none",
          transition: "background .15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = T.bgHover}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        {/* J&J round logo badge */}
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#cc0000",
          border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          transition: "transform .2s",
        }}>
          <span style={{color:"#fff",fontSize:11,fontWeight:800,fontFamily:"Georgia,serif",letterSpacing:"-0.5px",lineHeight:1,userSelect:"none"}}>J&amp;J</span>
        </div>
        {/* Tenant name + collapse chevron */}
        {exp && (
          <div style={{display:"flex",alignItems:"center",flex:1,minWidth:0,justifyContent:"space-between"}}>
            <div style={{overflow: "hidden", whiteSpace: "nowrap"}}>
              <div style={{fontSize: 12, fontWeight: 700, color: T.text, lineHeight: 1.3}}>Johnson &amp; Johnson</div>
              <div style={{fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 1}}>Data Governance</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{color:T.textMuted,flexShrink:0,marginLeft:6}}>
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

      {/* ── NAV ITEMS ── */}
      <div style={{flex: 1, overflowY: "auto", overflowX: "clip", padding: "6px 0"}}>
        {NAV.map(sec => (
          <div key={sec.section}>
            {/* Section header */}
            <div style={{
              height: exp ? 26 : 0,
              overflow: "hidden",
              transition: "height .2s ease",
            }}>
              <div style={{
                padding: "8px 16px 2px",
                fontSize: 9, fontWeight: 700,
                color: T.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                whiteSpace: "nowrap",
              }}>{sec.section}</div>
            </div>

            {/* Nav buttons */}
            {sec.items.map(item => {
              const isA = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNav(item.id)}
                  title={item.label}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: exp ? 10 : 0,
                    height: 36,
                    padding: exp ? "0 16px" : "0",
                    justifyContent: "center",
                    background: isA ? T.bgHover : "transparent",
                    border: "none",
                    borderLeft: isA ? `2.5px solid ${T.accent}` : "2.5px solid transparent",
                    color: isA ? T.text : T.textSub,
                    fontSize: 12.5,
                    fontWeight: isA ? 600 : 400,
                    cursor: "pointer",
                    transition: "background .1s, border-color .1s, gap .2s, padding .2s",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                  onMouseEnter={e => { if (!isA) e.currentTarget.style.background = T.bgHover; }}
                  onMouseLeave={e => { if (!isA) e.currentTarget.style.background = "transparent"; }}>
                  {/* Icon — always centered when collapsed */}
                  <span style={{
                    flexShrink: 0,
                    width: 18, height: 18,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isA ? T.accent : "currentColor",
                    opacity: isA ? 1 : 0.65,
                  }}>
                    {Ic[item.icon] && Ic[item.icon](15)}
                  </span>
                  {/* Label — only in DOM when expanded to avoid affecting icon centering */}
                  {exp && (
                    <span style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textAlign: "left",
                    }}>
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── FOOTER ── */}

    </div>
  );
};


// ─────────────────────────────────────────────
// USER MENU
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// NOTIFICATIONS PANEL
// ─────────────────────────────────────────────
const NOTIFS = [
  {id:1,type:"alert",unread:true,title:"Quality rule failed",body:"Rule 'orders.amount_not_null' failed on 847 rows (1.8%)",time:"2m ago",icon:"⚠️",nav:"quality"},
  {id:2,type:"cert",unread:true,title:"Certification approved",body:"'customers' dataset certified by dev.patel",time:"18m ago",icon:"✅",nav:"certifications"},
  {id:3,type:"access",unread:true,title:"Access request pending",body:"john.doe requested access to 'payments' table",time:"1h ago",icon:"🔑",nav:"access"},
  {id:4,type:"policy",unread:false,title:"New policy applied",body:"PII Masking policy applied to 'user_events'",time:"2h ago",icon:"🛡️",nav:"policies"},
  {id:5,type:"alert",unread:false,title:"Schema drift detected",body:"Column 'user_id' type changed in product_events",time:"3h ago",icon:"🔀",nav:"observability"},
  {id:6,type:"contract",unread:false,title:"Data contract updated",body:"'orders-v2' contract version 2.1 published",time:"5h ago",icon:"📋",nav:"contracts"},
  {id:7,type:"cert",unread:false,title:"SLA breach warning",body:"'transactions' table freshness SLA at risk",time:"6h ago",icon:"⏱️",nav:"observability"},
];

const NotificationsPanel = ({onClose}) => {
  const onNav = useNav();
  const [notifs, setNotifs] = useState(NOTIFS);
  const [filter, setFilter] = useState("all");
  const unreadCount = notifs.filter(n=>n.unread).length;
  const filtered = filter==="unread" ? notifs.filter(n=>n.unread) : notifs;
  const markAll = () => setNotifs(n=>n.map(x=>({...x,unread:false})));
  const dismiss = (id) => setNotifs(n=>n.filter(x=>x.id!==id));
  const markOne = (id) => setNotifs(n=>n.map(x=>x.id===id?{...x,unread:false}:x));
  return (
    <div className="scaleIn" style={{position:"absolute",top:"calc(100% + 8px)",right:0,width:360,background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:12,boxShadow:"0 12px 40px rgba(0,0,0,.35)",zIndex:600,overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:480}}>
      {/* Header */}
      <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14,fontWeight:600,color:T.text}}>Notifications</span>
            {unreadCount>0&&<span style={{background:T.rose,color:"#fff",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:99}}>{unreadCount}</span>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {unreadCount>0&&<button onClick={markAll} style={{background:"transparent",border:"none",color:T.accent,fontSize:11,fontWeight:500,cursor:"pointer",padding:0}}>Mark all read</button>}
            <button onClick={onClose} style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer",display:"flex"}}><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
          </div>
        </div>
        <div style={{display:"flex",gap:4}}>
          {["all","unread"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 12px",borderRadius:99,border:`1px solid ${filter===f?T.accent:T.border}`,background:filter===f?T.accentDim:"transparent",color:filter===f?T.accent:T.textMuted,fontSize:11,fontWeight:500,cursor:"pointer",textTransform:"capitalize",transition:"all .15s"}}>{f}{f==="unread"&&unreadCount>0?` (${unreadCount})`:""}</button>
          ))}
        </div>
      </div>
      {/* List */}
      <div style={{overflowY:"auto",flex:1}}>
        {filtered.length===0
          ? <div style={{padding:"32px 16px",textAlign:"center",color:T.textMuted,fontSize:12}}>No {filter==="unread"?"unread ":""}notifications</div>
          : filtered.map(n=>(
          <div key={n.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"11px 14px",borderBottom:`1px solid ${T.border}`,background:n.unread?`${T.bgHover}`:"transparent",cursor:"pointer",transition:"background .1s",position:"relative"}}
            onMouseEnter={e=>e.currentTarget.style.background=T.bgHover}
            onMouseLeave={e=>e.currentTarget.style.background=n.unread?T.bgHover:"transparent"}
            onClick={()=>{markOne(n.id);onNav(n.nav);onClose();}}>
            {n.unread&&<span style={{position:"absolute",top:14,left:6,width:5,height:5,borderRadius:"50%",background:T.accent}}/>}
            <span style={{fontSize:18,lineHeight:1,flexShrink:0,marginTop:1}}>{n.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:12,fontWeight:n.unread?600:500,color:T.text}}>{n.title}</span>
                <span style={{fontSize:10,color:T.textMuted,whiteSpace:"nowrap",marginLeft:8}}>{n.time}</span>
              </div>
              <div style={{fontSize:11,color:T.textMuted,lineHeight:1.4}}>{n.body}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end",flexShrink:0}}>
              <button onClick={e=>{e.stopPropagation();dismiss(n.id);}} title="Dismiss" style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer",padding:2,flexShrink:0,opacity:0.6,display:"flex"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=1}
              onMouseLeave={e=>e.currentTarget.style.opacity=0.6}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{color:T.textMuted,opacity:0.4,marginTop:2}}><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        ))}
      </div>
      {/* Footer */}
      <div style={{padding:"10px 14px",borderTop:`1px solid ${T.border}`,flexShrink:0,textAlign:"center"}}>
        <button style={{background:"transparent",border:"none",color:T.accent,fontSize:12,fontWeight:500,cursor:"pointer"}}>View all notifications</button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// NOTIFICATIONS BUTTON (topbar)
// ─────────────────────────────────────────────
const NotifBtn = () => {
  const [open, setOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(3);
  const ref = useRef(null);
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} title="Notifications"
        style={{width:32,height:32,borderRadius:8,background:open?T.bgHover:"transparent",border:`1px solid ${open?T.borderLight:T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:T.textSub,transition:"all .15s"}}
        onMouseEnter={e=>{if(!open){e.currentTarget.style.background=T.bgHover;e.currentTarget.style.borderColor=T.borderLight;}}}
        onMouseLeave={e=>{if(!open){e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=T.border;}}}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2C6 2 4.5 3.5 4.5 5.5V10l-1 2h9l-1-2V5.5C11.5 3.5 10 2 8 2Z" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3"/></svg>
        {notifCount>0&&<span style={{position:"absolute",top:5,right:5,width:7,height:7,borderRadius:"50%",background:T.rose,border:`1.5px solid ${T.bg}`,pointerEvents:"none"}}/>}
      </button>
      {open && <NotificationsPanel onClose={()=>setOpen(false)}/>}
    </div>
  );
};

// ─────────────────────────────────────────────
// PROFILE DROPDOWN MENU
// ─────────────────────────────────────────────
const ProfilePanel = ({onClose, onNav}) => {
  const menuItems = [
    {section: "account"},
    {label:"My Profile",   desc:"View and edit your profile",       icon:"👤", nav:"profile"},
    {label:"My Tasks",     desc:"Stewardship tasks assigned to you", icon:"✅", nav:"stewardship"},
    {label:"My Assets",    desc:"Assets you own or steward",        icon:"📦", nav:"catalog"},
    {divider:true},
    {label:"Settings",     desc:"Platform preferences & API keys",  icon:"⚙️", nav:"settings"},
    {divider:true},
    {label:"Sign Out",     desc:null, icon:"🚪", danger:true, nav:null},
  ];
  return (
    <div className="scaleIn" style={{position:"absolute",top:"calc(100% + 8px)",right:0,width:260,background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:12,boxShadow:"0 12px 40px rgba(0,0,0,.35)",zIndex:600,overflow:"hidden"}}>
      {/* User header */}
      <div style={{padding:"14px 14px 12px",borderBottom:`1px solid ${T.border}`,background:`linear-gradient(135deg,${T.violetDim},${T.bgSurface})`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${T.violet},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0}}>MC</div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text}}>Maya Chen</div>
            <div style={{fontSize:11,color:T.textMuted}}>maya@jnj.com</div>
            <div style={{marginTop:4,display:"inline-flex",alignItems:"center",gap:3,padding:"1px 7px",background:T.accentDim,borderRadius:99}}>
              <span style={{width:4,height:4,borderRadius:"50%",background:T.accent,display:"inline-block"}}/>
              <span style={{fontSize:9.5,color:T.accent,fontWeight:600}}>Data Steward</span>
            </div>
          </div>
        </div>
      </div>
      {/* Menu items */}
      <div style={{padding:"6px 0"}}>
        {menuItems.map((item,i) => {
          if(item.section) return null;
          if(item.divider) return <div key={i} style={{height:1,background:T.border,margin:"4px 6px"}}/>;
          return (
            <button key={i}
              onClick={()=>{ if(item.nav){onNav(item.nav);} onClose(); }}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left",transition:"background .1s"}}
              onMouseEnter={e=>e.currentTarget.style.background=T.bgHover}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span style={{fontSize:16,lineHeight:1,flexShrink:0,width:20,textAlign:"center"}}>{item.icon}</span>
              <div style={{minWidth:0}}>
                <div style={{fontSize:12.5,fontWeight:500,color:item.danger?T.rose:T.text}}>{item.label}</div>
                {item.desc&&<div style={{fontSize:10.5,color:T.textMuted,marginTop:1}}>{item.desc}</div>}
              </div>
              {!item.danger&&<svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{marginLeft:"auto",color:T.textMuted,flexShrink:0,opacity:0.5}}><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// USER MENU BUTTON
// ─────────────────────────────────────────────
const UserMenu = () => {
  const onNav = useNav();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} title="My Profile"
        style={{width:32,height:32,borderRadius:8,background:open?T.bgHover:"transparent",border:`1px solid ${open?T.borderLight:T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,transition:"all .15s"}}
        onMouseEnter={e=>{if(!open){e.currentTarget.style.background=T.bgHover;e.currentTarget.style.borderColor=T.borderLight;}}}
        onMouseLeave={e=>{if(!open){e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=T.border;}}}>
        <div style={{width:24,height:24,borderRadius:6,background:`linear-gradient(135deg,${T.violet},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff"}}>MC</div>
      </button>
      {open && <ProfilePanel onClose={()=>setOpen(false)} onNav={onNav}/>}
    </div>
  );
};

// ─────────────────────────────────────────────
// DOCBOT
// ─────────────────────────────────────────────
const DOCS = [
  {cat:"Getting Started", icon:"🚀", items:[
    {title:"Platform Overview", desc:"Introduction to Solix Data Governance"},
    {title:"Quick Start Guide", desc:"Set up your first data domain in minutes"},
    {title:"Key Concepts", desc:"Assets, lineage, policies, and quality explained"},
  ]},
  {cat:"Data Catalog", icon:"📂", items:[
    {title:"Cataloging Assets", desc:"How to register and describe data assets"},
    {title:"Schema Management", desc:"Tracking columns, types and changes"},
    {title:"Asset Lineage", desc:"Visualizing data flow and dependencies"},
  ]},
  {cat:"Governance", icon:"🛡️", items:[
    {title:"Creating Policies", desc:"Policy types, rules and enforcement"},
    {title:"Access Control", desc:"Roles, permissions and request flows"},
    {title:"Compliance Frameworks", desc:"GDPR, SOC2 and CCPA mapping"},
  ]},
  {cat:"Data Quality", icon:"⭐", items:[
    {title:"Quality Rules", desc:"Writing and scheduling quality checks"},
    {title:"Incident Management", desc:"Responding to quality failures"},
    {title:"SLA Configuration", desc:"Setting freshness and completeness SLAs"},
  ]},
  {cat:"API Reference", icon:"⚡", items:[
    {title:"REST API", desc:"Full endpoint reference with examples"},
    {title:"Webhooks", desc:"Event-driven integrations and payloads"},
    {title:"SDK Guide", desc:"Python and JS SDKs for automation"},
  ]},
];

const SUGGESTED = [
  "How do I certify a dataset?",
  "What's the difference between a policy and a rule?",
  "How do I set up lineage tracking?",
  "How do I request access to a restricted asset?",
];

const DocBot = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("docs");
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState([
    {role:"assistant", text:"Hi! I'm your Solix documentation assistant. Ask me anything about data governance, or browse the docs on the Docs tab."}
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [expandedCat, setExpandedCat] = useState("Getting Started");
  const msgRef = useRef(null);

  useEffect(()=>{
    if(msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight;
  },[messages,typing]);

  const sendMsg = async (text) => {
    const q = text || input.trim();
    if(!q) return;
    setInput("");
    setMessages(m=>[...m,{role:"user",text:q}]);
    setTyping(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:"You are a helpful documentation assistant for Solix, an enterprise data governance platform. Answer questions about data governance concepts, the Solix platform features (data catalog, lineage, quality, policies, access control, compliance, certifications, stewardship, glossary, contracts, observability, analytics, domains, teams, integrations). Be concise and practical. Use bullet points for lists. Keep answers under 200 words.",
          messages:[...messages.filter(m=>m.role!=="assistant"||messages.indexOf(m)>0).map(m=>({role:m.role,content:m.text})),{role:"user",content:q}]
        })
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, I couldn't fetch a response.";
      setMessages(m=>[...m,{role:"assistant",text:reply}]);
    } catch(e) {
      setMessages(m=>[...m,{role:"assistant",text:"Connection error. Please try again."}]);
    }
    setTyping(false);
  };

  const filteredDocs = search
    ? DOCS.map(cat=>({...cat,items:cat.items.filter(d=>d.title.toLowerCase().includes(search.toLowerCase())||d.desc.toLowerCase().includes(search.toLowerCase()))})).filter(cat=>cat.items.length>0)
    : DOCS;

  const ref = useRef(null);
  useEffect(()=>{
    const fn = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return ()=>document.removeEventListener("mousedown", fn);
  },[]);

  return (
    <div ref={ref} style={{position:"relative"}}>
      {/* Topbar button */}
      <button
        onClick={()=>setOpen(o=>!o)}
        title="DocBot — Docs & AI Assistant"
        style={{
          width:32,height:32,borderRadius:8,
          background:open?`linear-gradient(135deg,${T.violet},${T.blue})`:"transparent",
          border:`1px solid ${open?T.violet:T.border}`,
          cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",
          color:open?"#fff":T.textSub,
          transition:"all .15s",
        }}
        onMouseEnter={e=>{if(!open){e.currentTarget.style.background=T.bgHover;e.currentTarget.style.borderColor=T.borderLight;}}}
        onMouseLeave={e=>{if(!open){e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=T.border;}}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.07 5.07L2 22l4.93-1.37A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="currentColor" opacity="0.9"/>
          <path d="M8 10.5h8M8 14h5" stroke={open?"rgba(255,255,255,0.7)":T.bg} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Panel — drops down from topbar */}
      {open && (
        <div className="scaleIn" style={{
          position:"fixed",top:62,right:24,zIndex:600,
          width:380,height:560,
          background:T.bgSurface,
          border:`1px solid ${T.border}`,
          borderRadius:16,
          display:"flex",flexDirection:"column",
          boxShadow:"0 16px 48px rgba(0,0,0,.4)",
          overflow:"hidden",
        }}>
          {/* Panel header */}
          <div style={{padding:"14px 16px 0",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${T.violet},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l4.93-1.37A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>DocBot</div>
                  <div style={{fontSize:10,color:T.textMuted}}>Docs &amp; AI Assistant</div>
                </div>
              </div>
              <button onClick={()=>setOpen(false)} style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer",display:"flex",padding:4}}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            {/* Tabs */}
            <div style={{display:"flex",gap:2}}>
              {["docs","ask"].map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"6px 0",background:"transparent",border:"none",borderBottom:`2px solid ${tab===t?T.accent:"transparent"}`,color:tab===t?T.text:T.textMuted,fontSize:12,fontWeight:tab===t?600:400,cursor:"pointer",transition:"all .15s",textTransform:"capitalize",marginBottom:-1}}>
                  {t==="docs"?"📄 Docs":"✨ Ask AI"}
                </button>
              ))}
            </div>
          </div>

          {/* Docs tab */}
          {tab==="docs" && (
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <div style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
                <input
                  value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Search docs…"
                  style={{width:"100%",padding:"7px 10px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:"none"}}/>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
                {filteredDocs.map(cat=>(
                  <div key={cat.cat}>
                    <button onClick={()=>setExpandedCat(expandedCat===cat.cat?null:cat.cat)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 14px",background:"transparent",border:"none",color:T.text,fontSize:12,fontWeight:600,cursor:"pointer",textAlign:"left"}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.bgHover}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <span style={{fontSize:14}}>{cat.icon}</span>
                      <span style={{flex:1}}>{cat.cat}</span>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{transform:expandedCat===cat.cat?"rotate(180deg)":"rotate(0)",transition:"transform .15s",color:T.textMuted}}><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    </button>
                    {expandedCat===cat.cat && cat.items.map(doc=>(
                      <button key={doc.title} style={{width:"100%",display:"block",padding:"7px 14px 7px 36px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left",transition:"background .1s"}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.bgHover}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{fontSize:12,color:T.text,fontWeight:500}}>{doc.title}</div>
                        <div style={{fontSize:10,color:T.textMuted,marginTop:1}}>{doc.desc}</div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ask AI tab */}
          {tab==="ask" && (
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <div ref={msgRef} style={{flex:1,overflowY:"auto",padding:"12px"}}>
                {messages.map((m,i)=>(
                  <div key={i} style={{marginBottom:12,display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                    {m.role==="assistant" && (
                      <div style={{width:22,height:22,borderRadius:6,background:`linear-gradient(135deg,${T.violet},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginRight:7,marginTop:2}}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l4.93-1.37A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
                      </div>
                    )}
                    <div style={{
                      maxWidth:"80%",padding:"8px 11px",borderRadius:m.role==="user"?"10px 10px 2px 10px":"10px 10px 10px 2px",
                      background:m.role==="user"?`linear-gradient(135deg,${T.violet},${T.blue})`:`${T.bgElevated}`,
                      color:m.role==="user"?"#fff":T.text,
                      fontSize:12,lineHeight:1.5,
                      border:m.role==="assistant"?`1px solid ${T.border}`:"none",
                      whiteSpace:"pre-wrap",
                    }}>{m.text}</div>
                  </div>
                ))}
                {typing && (
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
                    <div style={{width:22,height:22,borderRadius:6,background:`linear-gradient(135deg,${T.violet},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l4.93-1.37A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
                    </div>
                    <div style={{background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:"10px 10px 10px 2px",padding:"8px 12px",display:"flex",gap:4,alignItems:"center"}}>
                      {[0,1,2].map(i=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:T.textMuted,display:"inline-block",animation:"pulse2 1.2s ease infinite",animationDelay:`${i*0.2}s`}}/>)}
                    </div>
                  </div>
                )}
                {messages.length===1 && !typing && (
                  <div style={{marginTop:4}}>
                    <div style={{fontSize:10,color:T.textMuted,marginBottom:7,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.08em"}}>Suggested</div>
                    {SUGGESTED.map(s=>(
                      <button key={s} onClick={()=>sendMsg(s)} style={{display:"block",width:"100%",textAlign:"left",padding:"7px 10px",marginBottom:5,background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:11.5,cursor:"pointer",transition:"all .1s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background=T.bgHover;e.currentTarget.style.borderColor=T.borderLight;}}
                        onMouseLeave={e=>{e.currentTarget.style.background=T.bgElevated;e.currentTarget.style.borderColor=T.border;}}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Input */}
              <div style={{padding:"10px 12px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8,flexShrink:0}}>
                <input
                  value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}}
                  placeholder="Ask anything about Solix…"
                  style={{flex:1,padding:"8px 11px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12,outline:"none"}}/>
                <button onClick={()=>sendMsg()} disabled={!input.trim()||typing} style={{width:34,height:34,borderRadius:8,background:input.trim()&&!typing?`linear-gradient(135deg,${T.violet},${T.blue})`:`${T.bgElevated}`,border:`1px solid ${T.border}`,cursor:input.trim()&&!typing?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M14 8H2M14 8l-5-5M14 8l-5 5" stroke={input.trim()&&!typing?"#fff":T.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// TOPBAR
// ─────────────────────────────────────────────
const Topbar = ({breadcrumb,actions})=>{
  const {isDark,toggleTheme:onThemeToggle} = useTheme();
  return (
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px 0 28px",height:54,borderBottom:`1px solid ${T.border}`,background:T.bg,flexShrink:0}}>
    <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13}}>
      {breadcrumb.map((b,i)=>(
        <span key={i} style={{display:"flex",alignItems:"center",gap:6}}>
          {i>0&&<span style={{color:T.border}}>/</span>}
          {b.onClick
            ? <button onClick={b.onClick} style={{background:"transparent",border:"none",color:T.textSub,cursor:"pointer",fontSize:13,padding:0}}>{b.label}</button>
            : <span style={{color:i===breadcrumb.length-1?T.text:T.textSub,fontWeight:i===breadcrumb.length-1?600:400}}>{b.label}</span>}
        </span>
      ))}
    </div>
    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      {actions}
      <button
        onClick={()=>onThemeToggle()}
        title={isDark?"Switch to Light":"Switch to Dark"}
        style={{width:32,height:32,borderRadius:8,background:"transparent",border:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:T.textSub,flexShrink:0,transition:"background .15s,border-color .15s"}}
        onMouseEnter={e=>{e.currentTarget.style.background=T.bgHover;e.currentTarget.style.borderColor=T.borderLight;}}
        onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=T.border;}}>
        {isDark
          ? <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/></svg>
          : <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
        }
      </button>
      <DocBot/>
      <NotifBtn/>
      <UserMenu/>
    </div>
  </div>
  );
};

// ─────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────
const HomeView = ({onNav,onToast})=>{
  const stats=[
    {label:"Total Assets",value:"2,847",delta:"+12 this week",color:T.accent},
    {label:"Certified",value:"1,234",delta:"+3 today",color:T.blue},
    {label:"Avg Quality",value:"87.3",delta:"-0.4 pts",color:T.amber},
    {label:"Violations",value:"7",delta:"-2 resolved",color:T.rose},
  ];
  const activity=[
    {event:"orders certified as trusted",user:"maya.chen",time:"2m ago",type:"cert"},
    {event:"PII policy applied to customers",user:"dev.patel",time:"18m ago",type:"policy"},
    {event:"Schema drift: product_events",user:"System",time:"1h ago",type:"alert"},
    {event:"Access request: john.doe → customers",user:"System",time:"2h ago",type:"access"},
    {event:"Data contract orders-v2 updated",user:"james.oh",time:"3h ago",type:"contract"},
    {event:"Quality rule failed: user_sessions",user:"System",time:"5h ago",type:"alert"},
  ];
  const tc={cert:T.accent,policy:T.violet,alert:T.rose,access:T.blue,contract:T.amber};

  const pendingReqs=ACCESS_REQUESTS.filter(r=>r.status==="Pending").slice(0,2);

  return <div className="fadeUp" style={{height:"100%",overflowY:"auto"}}>
    <Topbar breadcrumb={[{label:"Home"}]}/>
    <div style={{padding:28,maxWidth:1200}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {stats.map(s=><Metric key={s.label} {...s}/>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card2>
          <div style={{padding:16}}>
            <SH title="Recent Activity" action={<Btn small ghost onClick={()=>{}}>View All</Btn>}/>
            {activity.map((a,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<activity.length-1?`1px solid ${T.border}`:"none"}}>
                <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:tc[a.type],flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}><span style={{fontSize:12,color:T.text}}>{a.event}</span><span style={{fontSize:11,color:T.textMuted,marginLeft:6}}>by {a.user}</span></div>
                <span style={{fontSize:11,color:T.textMuted,whiteSpace:"nowrap"}}>{a.time}</span>
              </div>
            ))}
          </div>
        </Card2>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card2>
            <div style={{padding:16}}>
              <SH title="Quick Actions"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[{label:"Browse Catalog",icon:"catalog",nav:"catalog"},{label:"View Lineage",icon:"lineage",nav:"lineage"},{label:"Quality Checks",icon:"quality",nav:"quality"},{label:"Manage Policies",icon:"policies",nav:"policies"}].map(a=>(
                  <button key={a.label} onClick={()=>onNav(a.nav)} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 14px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:8,cursor:"pointer",color:T.textSub,fontSize:12,fontWeight:500,transition:"all .15s",textAlign:"left"}}
                    onMouseEnter={e=>{e.currentTarget.style.background=T.bgHover;e.currentTarget.style.color=T.text;}}
                    onMouseLeave={e=>{e.currentTarget.style.background=T.bgElevated;e.currentTarget.style.color=T.textSub;}}>
                    {Ic[a.icon]&&Ic[a.icon](14)} {a.label}
                  </button>
                ))}
              </div>
            </div>
          </Card2>
          <Card2>
            <div style={{padding:16}}>
              <SH title="Pending Access Requests" action={<Btn small ghost onClick={()=>onNav("access")}>Review All</Btn>}/>
              {pendingReqs.map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i===0?`1px solid ${T.border}`:"none"}}>
                  <SDot status="Pending"/>
                  <div style={{flex:1}}><div style={{fontSize:12,color:T.text}}>{r.user} → <span style={{color:T.blue,fontFamily:"'Geist Mono',monospace"}}>{r.asset}</span></div><div style={{fontSize:11,color:T.textMuted}}>{r.level} access · {r.since}</div></div>
                  <div style={{display:"flex",gap:5}}>
                    <Btn small variant="primary" onClick={()=>onToast("Access approved","success")}>Approve</Btn>
                    <Btn small variant="danger" onClick={()=>onToast("Access denied","error")}>Deny</Btn>
                  </div>
                </div>
              ))}
            </div>
          </Card2>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <Card2>
          <div style={{padding:16}}>
            <SH title="Stewardship Tasks" action={<Btn small ghost onClick={()=>onNav("stewardship")}>View</Btn>}/>
            {STEWARDSHIP_TASKS.slice(0,3).map((t,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<2?`1px solid ${T.border}`:"none"}}>
                <SDot status={t.status}/>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.type}</div><div style={{fontSize:11,color:T.textMuted,fontFamily:"'Geist Mono',monospace"}}>{t.asset}</div></div>
                <Badge color={t.priority==="Critical"?T.red:t.priority==="High"?T.amber:T.textSub}>{t.priority}</Badge>
              </div>
            ))}
          </div>
        </Card2>
        <Card2>
          <div style={{padding:16}}>
            <SH title="Quality Incidents" action={<Btn small ghost onClick={()=>onNav("quality")}>View</Btn>}/>
            {QUALITY_RULES.filter(r=>r.status!=="passing").map((r,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<1?`1px solid ${T.border}`:"none"}}>
                <SDot status={r.status}/>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.rule}</div><div style={{fontSize:11,color:T.textMuted,fontFamily:"'Geist Mono',monospace"}}>{r.table}</div></div>
              </div>
            ))}
          </div>
        </Card2>
        <Card2>
          <div style={{padding:16}}>
            <SH title="Certifications Due" action={<Btn small ghost onClick={()=>onNav("certifications")}>View</Btn>}/>
            {CERTIFICATIONS.filter(c=>c.status==="Active").slice(0,3).map((c,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<2?`1px solid ${T.border}`:"none"}}>
                <SDot status="Active"/>
                <div style={{flex:1}}><div style={{fontSize:12,color:T.text,fontFamily:"'Geist Mono',monospace"}}>{c.asset}</div><div style={{fontSize:11,color:T.textMuted}}>Expires {c.expires}</div></div>
                <QScore score={c.score}/>
              </div>
            ))}
          </div>
        </Card2>
      </div>
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────
const CatalogView = ({onAsset})=>{
  const [q,setQ]=useState("");
  const [typeF,setTypeF]=useState("All");
  const [certF,setCertF]=useState("All");
  const [domainF,setDomainF]=useState("All");
  const types=["All","Table","Dashboard","Pipeline","ML Model"];
  const certs=["All","Certified","In Review","Uncertified","Deprecated"];
  const domains=["All",...new Set(ASSETS.map(a=>a.domain))];
  const filtered=ASSETS.filter(a=>{
    const mq=a.name.toLowerCase().includes(q.toLowerCase())||a.domain.toLowerCase().includes(q.toLowerCase())||a.tags.some(t=>t.toLowerCase().includes(q.toLowerCase()));
    const mt=typeF==="All"||a.type===typeF;
    const mc=certF==="All"||a.cert===certF;
    const md=domainF==="All"||a.domain===domainF;
    return mq&&mt&&mc&&md;
  });

  const cols=[
    {key:"name",label:"Asset Name",render:(v,r)=><div><div style={{fontSize:13,fontWeight:500,color:T.text,fontFamily:"'Geist Mono',monospace"}}>{v}</div><div style={{fontSize:11,color:T.textMuted}}>{r.db}</div></div>},
    {key:"type",label:"Type",render:v=><TypeBadge type={v}/>},
    {key:"domain",label:"Domain",render:v=><span style={{fontSize:12,color:T.textSub}}>{v}</span>},
    {key:"owner",label:"Owner",render:v=><span style={{fontSize:12,color:T.textMuted,fontFamily:"'Geist Mono',monospace"}}>{v}</span>},
    {key:"cert",label:"Certification",render:v=><CertBadge cert={v}/>},
    {key:"quality",label:"Quality",render:v=><QScore score={v}/>},
    {key:"usage",label:"Usage",render:v=><Badge color={v==="High"?T.accent:v==="Med"?T.amber:T.textMuted}>{v}</Badge>},
    {key:"updated",label:"Updated",render:v=><span style={{fontSize:11,color:T.textMuted}}>{v}</span>},
    {key:"tags",label:"Tags",render:v=><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{v.map(t=><span key={t} style={{fontSize:10,padding:"1px 6px",borderRadius:99,background:t==="PII"?T.roseDim:T.bgHover,color:t==="PII"?T.rose:T.textMuted,border:`1px solid ${t==="PII"?"rgba(253,164,175,0.25)":T.border}`}}>{t}</span>)}</div>},
  ];

  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Data Catalog"}]} actions={<Btn icon={Ic.plus(12)} variant="primary">Add Asset</Btn>}/>
    <div style={{padding:"14px 28px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
      <div style={{flex:"1 1 240px",minWidth:200}}>
        <Input2 placeholder="Search assets, columns, tags, owners…" value={q} onChange={e=>setQ(e.target.value)} icon={Ic.search(13)}/>
      </div>
      <select value={typeF} onChange={e=>setTypeF(e.target.value)} style={{padding:"7px 10px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,cursor:"pointer",outline:"none"}}>
        {types.map(t=><option key={t} value={t}>{t==="All"?"All Types":t}</option>)}
      </select>
      <select value={certF} onChange={e=>setCertF(e.target.value)} style={{padding:"7px 10px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,cursor:"pointer",outline:"none"}}>
        {certs.map(c=><option key={c} value={c}>{c==="All"?"All Certs":c}</option>)}
      </select>
      <select value={domainF} onChange={e=>setDomainF(e.target.value)} style={{padding:"7px 10px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,cursor:"pointer",outline:"none"}}>
        {domains.map(d=><option key={d} value={d}>{d==="All"?"All Domains":d}</option>)}
      </select>
      <span style={{fontSize:11,color:T.textMuted}}>{filtered.length} assets</span>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"0 28px 28px"}}>
      <Card2 style={{marginTop:14,overflow:"hidden",padding:0}}>
        <DataTable cols={cols} rows={filtered} onRowClick={onAsset} emptyMsg="No assets match your filters"/>
      </Card2>
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// ASSET DETAIL — full 9-tab view
// ─────────────────────────────────────────────
const AssetDetail = ({asset,onBack,onToast})=>{
  const [tab,setTab]=useState("overview");
  const [certModal,setCertModal]=useState(false);
  const [certNote,setCertNote]=useState("");

  const tabs=[
    {key:"overview",label:"Overview"},{key:"schema",label:"Schema"},
    {key:"lineage",label:"Lineage"},{key:"quality",label:"Quality"},
    {key:"policies",label:"Policies"},{key:"access",label:"Access"},
    {key:"usage",label:"Usage"},{key:"docs",label:"Documentation"},
    {key:"activity",label:"Activity"},{key:"comments",label:`Comments (${COMMENTS.length})`},
  ];

  const handleCertify=()=>{
    setCertModal(false);
    onToast(`${asset.name} certified successfully`,"success");
  };

  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar
      breadcrumb={[{label:"Data Catalog",onClick:onBack},{label:asset.name}]}
      actions={<>
        <CertBadge cert={asset.cert}/>
        {asset.cert!=="Certified"&&<Btn icon={Ic.cert(13)} variant="primary" onClick={()=>setCertModal(true)}>Certify</Btn>}
        <Btn icon={Ic.edit(12)}>Edit</Btn>
      </>}
    />
    {/* Header */}
    <div style={{padding:"18px 28px 0",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,marginBottom:16}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><TypeBadge type={asset.type}/><span style={{fontSize:12,color:T.textMuted,fontFamily:"'Geist Mono',monospace"}}>{asset.db}</span></div>
          <h2 style={{fontSize:22,fontWeight:700,fontFamily:"'Geist Mono',monospace",color:T.text,letterSpacing:"-0.04em",marginBottom:6}}>{asset.name}</h2>
          <p style={{fontSize:13,color:T.textSub,maxWidth:600,lineHeight:1.7}}>{asset.description}</p>
        </div>
        <div style={{display:"flex",gap:20,flexShrink:0}}>
          {[{l:"Quality",v:<QScore score={asset.quality}/>},{l:"Domain",v:<span style={{color:T.blue,fontSize:12}}>{asset.domain}</span>},{l:"Owner",v:<span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.textSub}}>{asset.owner}</span>},{l:"Updated",v:<span style={{fontSize:12,color:T.textMuted}}>{asset.updated}</span>}].map(m=>(
            <div key={m.l} style={{textAlign:"right"}}><div style={{fontSize:10,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>{m.l}</div>{m.v}</div>
          ))}
        </div>
      </div>
      <Tabs2 tabs={tabs} active={tab} onChange={setTab}/>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      {tab==="overview"  && <AssetOverview asset={asset} onToast={onToast}/>}
      {tab==="schema"    && <AssetSchema asset={asset} onToast={onToast}/>}
      {tab==="lineage"   && <AssetLineageFull asset={asset}/>}
      {tab==="quality"   && <AssetQualityTab asset={asset}/>}
      {tab==="policies"  && <AssetPoliciesTab/>}
      {tab==="access"    && <AssetAccessTab onToast={onToast}/>}
      {tab==="usage"     && <AssetUsageTab/>}
      {tab==="docs"      && <AssetDocsTab asset={asset} onToast={onToast}/>}
      {tab==="activity"  && <AssetActivityTab/>}
      {tab==="comments"  && <AssetCommentsTab onToast={onToast}/>}
    </div>

    {/* Certification Modal */}
    <Modal open={certModal} onClose={()=>setCertModal(false)} title={`Certify "${asset.name}"`}>
      <p style={{fontSize:13,color:T.textSub,marginBottom:16}}>Certifying marks this asset as trusted and production-ready. This action is logged and visible to all users.</p>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {[
          {label:"Schema documented",done:true},
          {label:"PII columns tagged",done:true},
          {label:"Data lineage verified",done:true},
          {label:"Quality rules passing",done:asset.quality>=85},
          {label:"Owner assigned",done:true},
          {label:"Retention policy applied",done:false},
        ].map((c,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:c.done?T.accentDim:T.bgElevated,border:`1px solid ${c.done?"rgba(110,231,183,0.2)":T.border}`,borderRadius:8}}>
            <span style={{color:c.done?T.accent:T.textMuted}}>{c.done?Ic.check(14):Ic.x(14)}</span>
            <span style={{fontSize:13,color:c.done?T.text:T.textSub}}>{c.label}</span>
            {!c.done&&<span style={{fontSize:11,color:T.amber,marginLeft:"auto"}}>Required</span>}
          </div>
        ))}
      </div>
      <div style={{marginTop:16}}>
        <div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Certification notes</div>
        <Input2 multiline rows={3} placeholder="Add notes for the certification record…" value={certNote} onChange={e=>setCertNote(e.target.value)}/>
      </div>
      <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end"}}>
        <Btn onClick={()=>setCertModal(false)}>Cancel</Btn>
        <Btn variant="primary" icon={Ic.cert(13)} onClick={handleCertify}>Certify Asset</Btn>
      </div>
    </Modal>
  </div>;
};

const AssetOverview = ({asset,onToast})=>(
  <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20}}>
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <Card2>
        <div style={{padding:16}}>
          <SH title="Description" action={<Btn small ghost icon={Ic.edit(11)}>Edit</Btn>}/>
          <p style={{fontSize:13,color:T.textSub,lineHeight:1.8}}>{asset.description} Refreshed every {asset.slaFreshness} via automated pipeline. All PII columns are tagged and subject to data retention policy.</p>
        </div>
      </Card2>
      <Card2>
        <div style={{padding:16}}>
          <SH title="Linked Assets"/>
          {[{name:"etl_orders_pipeline",rel:"Produced by",type:"Pipeline"},{name:"revenue_dashboard",rel:"Consumed by",type:"Dashboard"},{name:"ml_churn_model",rel:"Feature source for",type:"ML Model"}].map(a=>(
            <div key={a.name} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:6,cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=T.blue}
              onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
              <TypeBadge type={a.type}/><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.text,flex:1}}>{a.name}</span>
              <span style={{fontSize:11,color:T.textMuted}}>{a.rel}</span>{Ic.arrow(12)}
            </div>
          ))}
        </div>
      </Card2>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Card2>
        <div style={{padding:16}}>
          <SH title="Metadata"/>
          {[{l:"Domain",v:asset.domain},{l:"Owner",v:asset.owner},{l:"Steward",v:asset.steward},{l:"Certification",v:<CertBadge cert={asset.cert}/>},{l:"Row Count",v:asset.rows},{l:"Size",v:asset.size},{l:"SLA Freshness",v:asset.slaFreshness},{l:"Last Updated",v:asset.updated}].map(m=>(
            <div key={m.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,marginBottom:8}}>
              <span style={{color:T.textMuted}}>{m.l}</span>
              <span style={{color:T.text,fontFamily:typeof m.v==="string"?"'Geist Mono',monospace":"inherit"}}>{m.v}</span>
            </div>
          ))}
        </div>
      </Card2>
      <Card2>
        <div style={{padding:16}}>
          <SH title="Tags" action={<button style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer"}}>{Ic.plus(12)}</button>}/>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {asset.tags.map(t=><span key={t} style={{fontSize:11,padding:"3px 9px",borderRadius:99,background:t==="PII"?T.roseDim:T.bgHover,color:t==="PII"?T.rose:T.textSub,border:`1px solid ${t==="PII"?"rgba(253,164,175,0.25)":T.border}`,cursor:"pointer"}}>{t}</span>)}
            <span style={{fontSize:11,padding:"3px 9px",borderRadius:99,background:"transparent",color:T.textMuted,border:`1px dashed ${T.border}`,cursor:"pointer"}}>+ Add</span>
          </div>
        </div>
      </Card2>
    </div>
  </div>
);

const AssetSchema = ({asset,onToast})=>{
  const cols=SCHEMA[asset.name]||SCHEMA.orders;
  const [editing,setEditing]=useState(null);
  return <div className="fadeIn">
    <Card2 style={{overflow:"hidden",padding:0}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:12,alignItems:"center"}}>
        <span style={{fontSize:12,color:T.textMuted}}>{cols.length} columns · {cols.filter(c=>c.pii).length} PII · {cols.filter(c=>c.pk).length} PK</span>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <Input2 placeholder="Filter columns…" icon={Ic.search(12)} style={{width:180}}/>
          <Btn small icon={Ic.plus(11)} onClick={()=>onToast("Add column dialog would open","success")}>Add Column</Btn>
        </div>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Column","Type","Nullable","Description","PII","Quality Rule","Owner","Actions"].map(h=><th key={h} style={{padding:"8px 14px",fontSize:11,fontWeight:500,color:T.textMuted,textAlign:"left",borderBottom:`1px solid ${T.border}`,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>
          {cols.map((c,i)=>(
            <tr key={i} className="row-hover" style={{borderBottom:`1px solid ${T.border}`,transition:"background .1s"}}>
              <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:6}}>{c.pk&&<span style={{fontSize:9,color:T.amber,border:`1px solid ${T.amberDim}`,padding:"1px 5px",borderRadius:4,fontFamily:"'Geist Mono',monospace"}}>PK</span>}<span style={{fontSize:13,fontFamily:"'Geist Mono',monospace",color:T.text}}>{c.name}</span></div></td>
              <td style={{padding:"10px 14px"}}><Badge color={T.blue} bg={T.blueDim}>{c.type}</Badge></td>
              <td style={{padding:"10px 14px"}}><span style={{fontSize:11,color:c.nullable?T.textMuted:T.textSub}}>{c.nullable?"YES":"NOT NULL"}</span></td>
              <td style={{padding:"10px 14px",fontSize:12,color:T.textSub,maxWidth:200}}>{editing===i?<Input2 value={c.desc} onChange={()=>{}} style={{fontSize:12}}/>:c.desc}</td>
              <td style={{padding:"10px 14px"}}>{c.pii&&<Badge color={T.rose} bg={T.roseDim} border="rgba(253,164,175,0.25)">PII</Badge>}</td>
              <td style={{padding:"10px 14px",fontSize:11,fontFamily:"'Geist Mono',monospace",color:T.textMuted}}>{c.quality}</td>
              <td style={{padding:"10px 14px",fontSize:11,color:T.textMuted}}>james.oh</td>
              <td style={{padding:"10px 14px"}}><div style={{display:"flex",gap:6}}><button onClick={()=>setEditing(editing===i?null:i)} style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer"}}>{Ic.edit(12)}</button><button onClick={()=>onToast("Column deleted","error")} style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer"}}>{Ic.trash(12)}</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card2>
  </div>;
};

const AssetLineageFull = ({asset})=>{
  const [mode,setMode]=useState("table");
  const nodes=[
    {id:"pg",label:"postgresql_prod",type:"Database",x:30,y:140},
    {id:"pipe",label:"etl_pipeline",type:"Pipeline",x:200,y:140},
    {id:"self",label:asset.name,type:"Table",x:380,y:140,active:true},
    {id:"dash1",label:"revenue_dashboard",type:"Dashboard",x:560,y:80},
    {id:"ml",label:"ml_churn_model",type:"ML Model",x:560,y:200},
    {id:"dash2",label:"finance_summary",type:"Dashboard",x:740,y:80},
    {id:"api",label:"reporting_api",type:"Pipeline",x:740,y:200},
  ];
  const edges=[{f:"pg",t:"pipe"},{f:"pipe",t:"self"},{f:"self",t:"dash1"},{f:"self",t:"ml"},{f:"dash1",t:"dash2"},{f:"ml",t:"api"}];
  const nm=Object.fromEntries(nodes.map(n=>[n.id,n]));
  const tc={Database:T.blue,Pipeline:T.amber,Table:T.accent,Dashboard:T.violet,"ML Model":T.rose};

  return <div className="fadeIn">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        {Object.entries(tc).map(([t,c])=><span key={t} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:T.textSub}}><span style={{width:8,height:8,borderRadius:2,background:c,display:"inline-block"}}/>{t}</span>)}
      </div>
      <div style={{display:"flex",gap:8}}>
        <Tabs2 tabs={[{key:"table",label:"Table Level"},{key:"column",label:"Column Level"}]} active={mode} onChange={setMode} pill/>
        <Btn small ghost>Export</Btn>
      </div>
    </div>
    <Card2 style={{overflow:"hidden",padding:0}}>
      <div style={{padding:24,overflowX:"auto",minHeight:280}}>
        {mode==="table"
          ? <svg width="900" height="280" style={{display:"block",minWidth:880}}>
              <defs><marker id="arr2" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 Z" fill={T.borderLight}/></marker></defs>
              {edges.map((e,i)=>{
                const f=nm[e.f],t=nm[e.t];if(!f||!t)return null;
                const fx=f.x+130,fy=f.y+22,tx=t.x,ty=t.y+22;
                return <path key={i} d={`M${fx},${fy} C${(fx+tx)/2},${fy} ${(fx+tx)/2},${ty} ${tx},${ty}`} stroke={T.borderLight} strokeWidth="1.5" fill="none" markerEnd="url(#arr2)"/>;
              })}
              {nodes.map(n=>(
                <g key={n.id} style={{cursor:"pointer"}}>
                  <rect x={n.x} y={n.y} width={130} height={44} rx={9} fill={n.active?"rgba(110,231,183,0.1)":T.bgElevated} stroke={n.active?T.accent:T.border} strokeWidth={n.active?1.5:1}/>
                  <text x={n.x+10} y={n.y+14} fontSize="9" fill={tc[n.type]} fontFamily="Geist Sans" fontWeight="600" textTransform="uppercase">{n.type}</text>
                  <text x={n.x+10} y={n.y+31} fontSize="11" fill={n.active?T.accent:T.text} fontFamily="Geist Mono">{n.label.length>16?n.label.slice(0,15)+"…":n.label}</text>
                </g>
              ))}
            </svg>
          : <div style={{padding:20}}>
              <p style={{fontSize:12,color:T.textSub,marginBottom:16}}>Column-level lineage shows how individual columns flow between assets.</p>
              {[{from:"postgresql_prod.order_id",to:"orders.order_id",transform:"direct"},{from:"postgresql_prod.amount",to:"orders.amount",transform:"CAST(amount AS DECIMAL)"},{from:"orders.customer_id",to:"ml_churn_model.customer_id_feat",transform:"feature extraction"},{from:"orders.amount",to:"revenue_dashboard.total_revenue",transform:"SUM(amount)"}].map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:6}}>
                  <span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.blue}}>{c.from}</span>
                  {Ic.arrow(12)}
                  <span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.accent}}>{c.to}</span>
                  <span style={{marginLeft:"auto",fontSize:11,color:T.textMuted,fontStyle:"italic"}}>{c.transform}</span>
                </div>
              ))}
            </div>}
      </div>
    </Card2>
  </div>;
};

const AssetQualityTab = ({asset})=>{
  const rules=QUALITY_RULES.filter(r=>r.table===asset.name).slice(0,4);
  const display=rules.length?rules:QUALITY_RULES.slice(0,3);
  const trend=[91,94,93,96,94,92,95,97,94,96,94,94];
  return <div className="fadeIn" style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
      <Metric label="Overall Score" value={String(asset.quality)} color={asset.quality>=90?T.green:T.amber}/>
      <Metric label="Rules Total" value={String(display.length)} color={T.blue}/>
      <Metric label="Passing" value={String(display.filter(r=>r.status==="passing").length)} color={T.green}/>
      <Metric label="Failing" value={String(display.filter(r=>r.status==="failing").length)} color={T.red}/>
    </div>
    <Card2>
      <div style={{padding:16}}>
        <SH title="Quality Trend (12h)"/>
        <div style={{height:80,display:"flex",alignItems:"flex-end",gap:3}}>
          {trend.map((v,i)=><div key={i} style={{flex:1,background:T.accentDim,borderRadius:"2px 2px 0 0",position:"relative",height:`${(v/100)*80}px`}}><div style={{position:"absolute",bottom:0,left:0,right:0,borderRadius:"2px 2px 0 0",background:T.accent,height:`${(v/100)*80}px`,opacity:.7}}/></div>)}
        </div>
      </div>
    </Card2>
    <Card2 style={{overflow:"hidden",padding:0}}>
      <DataTable cols={[
        {key:"rule",label:"Rule",render:v=><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.text}}>{v}</span>},
        {key:"dim",label:"Dimension",render:v=><Badge>{v}</Badge>},
        {key:"status",label:"Status",render:v=><span style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><SDot status={v}/>{v}</span>},
        {key:"score",label:"Score",render:v=><QScore score={v}/>},
        {key:"runs",label:"Runs/day",render:v=><span style={{fontSize:11,color:T.textMuted,fontFamily:"'Geist Mono',monospace"}}>{v}</span>},
        {key:"lastRun",label:"Last Run",render:v=><span style={{fontSize:11,color:T.textMuted}}>{v}</span>},
      ]} rows={display}/>
    </Card2>
  </div>;
};

const AssetPoliciesTab = ()=>(
  <div className="fadeIn" style={{display:"flex",flexDirection:"column",gap:10}}>
    {POLICIES.slice(0,3).map(p=>(
      <Card2 key={p.id}>
        <div style={{padding:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}><SDot status={p.status}/><span style={{fontSize:13,fontWeight:500,color:T.text}}>{p.name}</span><Badge color={p.severity==="Critical"?T.rose:T.amber} bg={p.severity==="Critical"?T.roseDim:T.amberDim}>{p.severity}</Badge></div><div style={{fontSize:12,color:T.textMuted}}>{p.description}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:12,color:p.violations>0?T.rose:T.green,fontFamily:"'Geist Mono',monospace"}}>{p.violations} violations</div><div style={{fontSize:11,color:T.textMuted}}>Updated {p.updated}</div></div>
        </div>
      </Card2>
    ))}
    <Btn icon={Ic.plus(12)} style={{alignSelf:"flex-start"}}>Apply Policy</Btn>
  </div>
);

const AssetAccessTab = ({onToast})=>{
  const [reqModal,setReqModal]=useState(false);
  const [reqForm,setReqForm]=useState({level:"Read",reason:""});
  return <div className="fadeIn">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <span style={{fontSize:13,color:T.textSub}}>Current access grants</span>
      <Btn icon={Ic.plus(12)} onClick={()=>setReqModal(true)}>Request Access</Btn>
    </div>
    {[{user:"maya.chen",role:"Owner",level:"Admin",since:"2023-01-15"},{user:"dev.patel",role:"Steward",level:"Write",since:"2023-03-20"},{user:"analytics_team",role:"Group",level:"Read",since:"2023-06-01"},{user:"finance_team",role:"Group",level:"Read",since:"2023-09-10"}].map((a,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:9,marginBottom:6}}>
        <div style={{width:28,height:28,borderRadius:8,background:T.bgHover,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:T.accent,fontWeight:600}}>{a.user[0].toUpperCase()}</div>
        <div style={{flex:1}}><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.text}}>{a.user}</span><span style={{fontSize:11,color:T.textMuted,marginLeft:8}}>{a.role}</span></div>
        <Badge color={a.level==="Admin"?T.rose:a.level==="Write"?T.amber:T.blue}>{a.level}</Badge>
        <span style={{fontSize:11,color:T.textMuted}}>since {a.since}</span>
        <button onClick={()=>onToast("Access revoked","error")} style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer"}}>{Ic.trash(12)}</button>
      </div>
    ))}
    <Modal open={reqModal} onClose={()=>setReqModal(false)} title="Request Access">
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Access Level</div>
          <select value={reqForm.level} onChange={e=>setReqForm({...reqForm,level:e.target.value})} style={{width:"100%",padding:"8px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:13,outline:"none"}}>
            {["Read","Write","Admin"].map(l=><option key={l}>{l}</option>)}
          </select>
        </div>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Business Reason</div><Input2 multiline rows={3} placeholder="Explain why you need access…" value={reqForm.reason} onChange={e=>setReqForm({...reqForm,reason:e.target.value})}/></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
          <Btn onClick={()=>setReqModal(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>{setReqModal(false);onToast("Access request submitted","success");}}>Submit Request</Btn>
        </div>
      </div>
    </Modal>
  </div>;
};

const AssetUsageTab = ()=>{
  const data=[420,380,510,490,620,580,700,650,720,680,810,760];
  return <div className="fadeIn">
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
      <Metric label="Queries / day" value="810" delta="+12%" color={T.blue}/>
      <Metric label="Unique Users" value="47" delta="+3 this week" color={T.accent}/>
      <Metric label="Avg Query Time" value="1.2s" delta="-0.1s" color={T.amber}/>
    </div>
    <Card2>
      <div style={{padding:16}}>
        <SH title="Query Volume (12d)"/>
        <div style={{height:100,display:"flex",alignItems:"flex-end",gap:4}}>
          {data.map((v,i)=><div key={i} style={{flex:1,background:T.blue,borderRadius:"3px 3px 0 0",opacity:.4+(i/data.length)*.5,height:`${(v/810)*100}px`}}/>)}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
          {["12d ago","9d","6d","3d","Today"].map(l=><span key={l} style={{fontSize:10,color:T.textMuted}}>{l}</span>)}
        </div>
      </div>
    </Card2>
    <Card2 style={{marginTop:14}}>
      <div style={{padding:16}}>
        <SH title="Top Consumers"/>
        {[{user:"john.doe",queries:280,team:"Analytics"},{user:"alice.wang",queries:210,team:"Data Eng"},{user:"analytics_team",queries:180,team:"Analytics"},{user:"reporting_bot",queries:140,team:"Automation"}].map((u,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<3?`1px solid ${T.border}`:"none"}}>
            <span style={{fontSize:11,color:T.textMuted,width:16,textAlign:"center"}}>{i+1}</span>
            <div style={{flex:1}}><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.text}}>{u.user}</span><span style={{fontSize:11,color:T.textMuted,marginLeft:8}}>{u.team}</span></div>
            <span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.blue}}>{u.queries}</span>
          </div>
        ))}
      </div>
    </Card2>
  </div>;
};

const AssetDocsTab = ({asset,onToast})=>{
  const [editing,setEditing]=useState(false);
  const [doc,setDoc]=useState(`## Overview\n\nThe \`${asset.name}\` table is the source of truth for ${asset.domain.toLowerCase()} data.\n\n## Freshness\n\nData is updated every **${asset.slaFreshness}** via automated pipeline.\n\n## Usage Notes\n\n- Use primary key for all joins\n- PII columns require data masking in non-prod environments\n- Contact ${asset.owner} for access requests\n\n## Schema Notes\n\nSee Schema tab for full column documentation.`);
  return <Card2 className="fadeIn">
    <div style={{padding:16}}>
      <SH title="Documentation" action={<Btn small ghost icon={editing?Ic.check(11):Ic.edit(11)} onClick={()=>{setEditing(!editing);if(editing)onToast("Documentation saved","success");}}>{editing?"Save":"Edit"}</Btn>}/>
      {editing
        ? <Input2 multiline rows={14} value={doc} onChange={e=>setDoc(e.target.value)}/>
        : <div style={{fontSize:13,color:T.textSub,lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"'Geist Mono',monospace"}}>{doc}</div>}
    </div>
  </Card2>;
};

const AssetActivityTab = ()=>(
  <Card2 className="fadeIn">
    <div style={{padding:16}}>
      <SH title="Activity Log"/>
      {[
        {action:"Certified as Trusted",user:"maya.chen",time:"2h ago",type:"cert"},
        {action:"Schema drift detected in column amount",user:"System",time:"1d ago",type:"alert"},
        {action:"PII tag added to email column",user:"dev.patel",time:"3d ago",type:"tag"},
        {action:"Quality rule updated: Freshness",user:"james.oh",time:"5d ago",type:"rule"},
        {action:"Access granted to analytics_team",user:"maya.chen",time:"1w ago",type:"access"},
        {action:"Data contract orders-v2 linked",user:"james.oh",time:"2w ago",type:"contract"},
        {action:"Description updated",user:"dev.patel",time:"3w ago",type:"edit"},
      ].map((a,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:T.blue,flexShrink:0}}/>
          <div style={{flex:1}}><span style={{fontSize:12,color:T.text}}>{a.action}</span><span style={{fontSize:11,color:T.textMuted,marginLeft:8}}>by {a.user}</span></div>
          <span style={{fontSize:11,color:T.textMuted}}>{a.time}</span>
        </div>
      ))}
    </div>
  </Card2>
);

const AssetCommentsTab = ({onToast})=>{
  const [comments,setComments]=useState(COMMENTS);
  const [newComment,setNewComment]=useState("");
  const submit=()=>{
    if(!newComment.trim())return;
    setComments([...comments,{id:comments.length+1,user:"maya.chen",avatar:"MC",text:newComment,time:"Just now",resolved:false}]);
    setNewComment("");
    onToast("Comment posted","success");
  };
  return <div className="fadeIn">
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
      {comments.map(c=>(
        <Card2 key={c.id} style={{opacity:c.resolved?.7:1}}>
          <div style={{padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:26,height:26,borderRadius:7,background:T.bgHover,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.accent}}>{c.avatar}</div>
              <span style={{fontSize:12,fontWeight:500,color:T.text}}>{c.user}</span>
              <span style={{fontSize:11,color:T.textMuted}}>{c.time}</span>
              {c.resolved&&<Badge color={T.green} bg={T.accentDim} style={{marginLeft:"auto"}}>Resolved</Badge>}
              <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                {!c.resolved&&<button onClick={()=>setComments(comments.map(cc=>cc.id===c.id?{...cc,resolved:true}:cc))} style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:4}}>{Ic.check(12)} Resolve</button>}
              </div>
            </div>
            <p style={{fontSize:13,color:T.textSub,lineHeight:1.7}}>{c.text}</p>
          </div>
        </Card2>
      ))}
    </div>
    <Card2>
      <div style={{padding:14}}>
        <div style={{fontSize:12,color:T.textSub,marginBottom:8}}>Add a comment</div>
        <Input2 multiline rows={3} placeholder="Leave a comment, ask a question, or flag an issue…" value={newComment} onChange={e=>setNewComment(e.target.value)}/>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
          <Btn variant="primary" icon={Ic.comment(12)} onClick={submit}>Post Comment</Btn>
        </div>
      </div>
    </Card2>
  </div>;
};

// ─────────────────────────────────────────────
// LINEAGE FULL VIEW
// ─────────────────────────────────────────────
const LineageView = () => {
  const [selected,   setSelected]   = useState(null);
  const [panelTab,   setPanelTab]   = useState("details");
  const [colLevel,   setColLevel]   = useState(false);
  const [search,     setSearch]     = useState("");
  const [hlTypes,    setHlTypes]    = useState(new Set());
  const [hopsUp,     setHopsUp]     = useState(3);
  const [hopsDown,   setHopsDown]   = useState(3);
  const [pan,        setPan]        = useState({x:0,y:0});
  const [zoom,       setZoom]       = useState(1);
  const panDrag = useRef(null);
  const canvasRef = useRef(null);

  /* ─── type config ─── */
  const TM = {
    Database:  {color:"#38bdf8", glow:"56,189,248",  icon:"🗄", dim:"rgba(56,189,248,0.1)"},
    Stream:    {color:"#fb923c", glow:"251,146,60",   icon:"⚡", dim:"rgba(251,146,60,0.1)"},
    Pipeline:  {color:"#fbbf24", glow:"251,191,36",   icon:"⚙", dim:"rgba(251,191,36,0.1)"},
    Table:     {color:"#34d399", glow:"52,211,153",   icon:"▦",  dim:"rgba(52,211,153,0.1)"},
    View:      {color:"#a78bfa", glow:"167,139,250",  icon:"◎",  dim:"rgba(167,139,250,0.1)"},
    "ML Model":{color:"#f472b6", glow:"244,114,182",  icon:"⬡",  dim:"rgba(244,114,182,0.1)"},
    Dashboard: {color:"#60a5fa", glow:"96,165,250",   icon:"▣",  dim:"rgba(96,165,250,0.1)"},
  };

  /* ─── fixed node positions ─── */
  const NW = 176, NH = 68, GAP_X = 220, COL_ROW = 22;
  // columns: 0=Sources(x:60) 1=Pipelines(x:280) 2=Tables(x:500) 3=Derived(x:720) 4=Consumers(x:940)
  const COLS = [60, 280, 500, 720, 940];

  const NODES = [
    // Sources
    {id:"src1",label:"postgresql_prod",sub:"warehouse.prod",   type:"Database",  col:0,row:0,status:"Active", owner:"infra-team",domain:"Platform"},
    {id:"src2",label:"salesforce_crm", sub:"crm.salesforce",   type:"Database",  col:0,row:1,status:"Active", owner:"sales-ops", domain:"CRM"},
    {id:"src3",label:"kafka_events",   sub:"events.prod",      type:"Stream",    col:0,row:2,status:"Active", owner:"platform",  domain:"Events"},
    // Pipelines
    {id:"pip1",label:"etl_orders",     sub:"6× daily",         type:"Pipeline",  col:1,row:0,status:"Active", owner:"data-eng",  domain:"Commerce",lastRun:"2m ago"},
    {id:"pip2",label:"crm_sync",       sub:"1× daily",         type:"Pipeline",  col:1,row:1,status:"Warning",owner:"data-eng",  domain:"CRM",     lastRun:"18m ago"},
    {id:"pip3",label:"event_ingest",   sub:"Streaming",        type:"Pipeline",  col:1,row:2,status:"Active", owner:"platform",  domain:"Events",  lastRun:"live"},
    // Tables
    {id:"t1",  label:"orders",         sub:"48.2M rows · 12 GB",type:"Table",   col:2,row:0,status:"Active", owner:"maya.chen", domain:"Commerce",quality:94,cert:"Certified",tags:["PII","revenue"],
      cols:[{n:"order_id",t:"bigint",pk:true},{n:"customer_id",t:"bigint",fk:true},{n:"amount",t:"decimal"},{n:"status",t:"varchar"},{n:"created_at",t:"timestamp"}]},
    {id:"t2",  label:"customers",      sub:"3.1M rows · 2.1 GB",type:"Table",   col:2,row:1,status:"Active", owner:"dev.patel",  domain:"Commerce",quality:88,cert:"Certified",tags:["PII"],
      cols:[{n:"customer_id",t:"bigint",pk:true},{n:"email",t:"varchar"},{n:"country",t:"varchar"},{n:"tier",t:"varchar"},{n:"created_at",t:"timestamp"}]},
    {id:"t3",  label:"product_events", sub:"1.2B rows · 340 GB",type:"Table",   col:2,row:2,status:"Warning",owner:"james.oh",   domain:"Product", quality:71,cert:"Requested",tags:["clickstream"],
      cols:[{n:"event_id",t:"uuid",pk:true},{n:"user_id",t:"bigint"},{n:"event_type",t:"varchar"},{n:"properties",t:"jsonb"},{n:"ts",t:"timestamp"}]},
    // Derived
    {id:"d1",  label:"orders_enriched",sub:"Materialized view", type:"View",    col:3,row:0,status:"Active", owner:"maya.chen", domain:"Commerce",quality:91,cert:"Certified",
      cols:[{n:"order_id",t:"bigint",src:"t1"},{n:"customer_id",t:"bigint",src:"t1"},{n:"email",t:"varchar",src:"t2"},{n:"tier",t:"varchar",src:"t2"},{n:"amount",t:"decimal",src:"t1"}]},
    {id:"d2",  label:"customer_360",   sub:"Wide table",        type:"Table",   col:3,row:1,status:"Active", owner:"dev.patel",  domain:"Commerce",quality:85,cert:"In Review",
      cols:[{n:"customer_id",t:"bigint",src:"t2"},{n:"email",t:"varchar",src:"t2"},{n:"tier",t:"varchar",src:"t2"},{n:"total_orders",t:"int",src:"t1"},{n:"ltv",t:"decimal",src:"t1"}]},
    // Consumers
    {id:"ml1", label:"churn_model_v2", sub:"sklearn · v2.3",    type:"ML Model",col:4,row:0,status:"Active", owner:"ai-team",   domain:"ML",      version:"v2.3"},
    {id:"rpt1",label:"revenue_dash",   sub:"Tableau · 1.2k/day",type:"Dashboard",col:4,row:1,status:"Active",owner:"finance",   domain:"Finance", views:"1.2k/day"},
    {id:"rpt2",label:"ops_report",     sub:"Looker · 340/day",  type:"Dashboard",col:4,row:2,status:"Active",owner:"ops-team",  domain:"Ops",     views:"340/day"},
    {id:"rpt3",label:"exec_360",       sub:"Tableau · 890/day", type:"Dashboard",col:4,row:3,status:"Active",owner:"leadership",domain:"Exec",    views:"890/day"},
  ];

  // compute per-column row counts for vertical centering
  const colRowCounts = [0,0,0,0,0];
  NODES.forEach(n => { colRowCounts[n.col] = Math.max(colRowCounts[n.col], n.row+1); });
  const maxRows = Math.max(...colRowCounts);
  const ROW_H = 110;
  const SVG_H = maxRows * ROW_H + 80;
  const SVG_W = COLS[4] + NW + 60;

  // position each node
  const nodePos = (n) => {
    const colCount = colRowCounts[n.col];
    const totalH   = colCount * ROW_H;
    const offsetY  = (SVG_H - totalH) / 2;
    return {
      x: COLS[n.col],
      y: offsetY + n.row * ROW_H + (ROW_H - NH) / 2,
    };
  };

  const nm = Object.fromEntries(NODES.map(n => [n.id, {...n, ...nodePos(n)}]));

  const EDGES = [
    {f:"src1",t:"pip1",op:""},{f:"src2",t:"pip2",op:""},{f:"src3",t:"pip3",op:""},
    {f:"pip1",t:"t1", op:"INSERT"},{f:"pip2",t:"t2",op:"MERGE"},{f:"pip3",t:"t3",op:"APPEND"},
    {f:"t1",  t:"d1", op:"JOIN"}, {f:"t2",  t:"d1",op:"JOIN"},
    {f:"t2",  t:"d2", op:"JOIN"}, {f:"t1",  t:"d2",op:"AGGREGATE"},
    {f:"d1",  t:"ml1",op:"TRAIN"},{f:"d1",  t:"rpt1",op:"QUERY"},
    {f:"d2",  t:"rpt1",op:"QUERY"},{f:"d2", t:"rpt2",op:"QUERY"},
    {f:"d2",  t:"rpt3",op:"QUERY"},{f:"ml1",t:"rpt3",op:"SCORE"},
  ];

  const COL_EDGES = [
    {from:"t1",fromCol:"order_id",   to:"d1",toCol:"order_id"},
    {from:"t1",fromCol:"customer_id",to:"d1",toCol:"customer_id"},
    {from:"t1",fromCol:"amount",     to:"d1",toCol:"amount"},
    {from:"t2",fromCol:"email",      to:"d1",toCol:"email"},
    {from:"t2",fromCol:"tier",       to:"d1",toCol:"tier"},
    {from:"t2",fromCol:"customer_id",to:"d2",toCol:"customer_id"},
    {from:"t2",fromCol:"email",      to:"d2",toCol:"email"},
    {from:"t2",fromCol:"tier",       to:"d2",toCol:"tier"},
    {from:"t1",fromCol:"order_id",   to:"d2",toCol:"total_orders"},
    {from:"t1",fromCol:"amount",     to:"d2",toCol:"ltv"},
  ];

  /* ─── path tracing ─── */
  const trace = (nodeId) => {
    const up=new Set(), dn=new Set(), upE=new Set(), dnE=new Set();
    const walk=(id,dir,hops,max,vis=new Set())=>{
      if(hops>max||vis.has(id))return; vis.add(id);
      EDGES.forEach((e,i)=>{
        if(dir==="up"&&e.t===id){  up.add(e.f);upE.add(i);walk(e.f,"up",  hops+1,max,vis);}
        if(dir==="dn"&&e.f===id){  dn.add(e.t);dnE.add(i);walk(e.t,"dn",  hops+1,max,vis);}
      });
    };
    walk(nodeId,"up",1,hopsUp); walk(nodeId,"dn",1,hopsDown);
    return {up,dn,upE,dnE};
  };
  const path = selected ? trace(selected.id) : null;

  /* ─── display helpers ─── */
  const nodeAlpha = (n) => {
    if(hlTypes.size>0 && !hlTypes.has(n.type)) return 0.12;
    if(search && !n.label.toLowerCase().includes(search.toLowerCase())) return 0.12;
    if(!selected) return 1;
    if(n.id===selected.id||path?.up.has(n.id)||path?.dn.has(n.id)) return 1;
    return 0.12;
  };
  const edgeInfo = (i) => {
    if(!selected) return {color:"rgba(148,163,184,0.2)",width:1.4,lit:false,isUp:false};
    const isUp=path?.upE.has(i), isDn=path?.dnE.has(i);
    if(isUp) return {color:"#38bdf8",width:2.2,lit:true,isUp:true};
    if(isDn) return {color:"#34d399",width:2.2,lit:true,isUp:false};
    return {color:"rgba(148,163,184,0.05)",width:1,lit:false,isUp:false};
  };

  const allTypes = [...new Set(NODES.map(n=>n.type))];
  const impactStats = selected&&path ? {
    up: path.up.size, dn: path.dn.size,
    dash: [...path.dn].filter(id=>nm[id]?.type==="Dashboard").length,
    ml:   [...path.dn].filter(id=>nm[id]?.type==="ML Model").length,
  } : null;

  /* ─── pan/zoom ─── */
  const onCanvasMouseDown = (e) => {
    if(e.target !== e.currentTarget && e.target.tagName !== "svg" && !e.target.closest("svg")) return;
    panDrag.current = {sx:e.clientX,sy:e.clientY,ox:pan.x,oy:pan.y};
  };
  const onCanvasMouseMove = (e) => {
    if(!panDrag.current) return;
    setPan({x:panDrag.current.ox+(e.clientX-panDrag.current.sx), y:panDrag.current.oy+(e.clientY-panDrag.current.sy)});
  };
  const onCanvasMouseUp = () => { panDrag.current=null; };
  const onWheel = (e) => {
    e.preventDefault();
    setZoom(z=>Math.max(0.3,Math.min(2,z*(e.deltaY<0?1.1:0.91))));
  };

  /* ─── column-level edge path ─── */
  const colEdgePath = (ce) => {
    const an=nm[ce.from], bn=nm[ce.to]; if(!an||!bn) return null;
    const showColsA = colLevel && selected?.id===an.id;
    const showColsB = colLevel && selected?.id===bn.id;
    const fi=(an.cols||[]).findIndex(c=>c.n===ce.fromCol);
    const ti=(bn.cols||[]).findIndex(c=>c.n===ce.toCol);
    if(fi<0) return null;
    // only draw if at least one end is expanded
    if(!showColsA&&!showColsB) return null;
    const ayBase = an.y + NH + 4 + fi*COL_ROW + COL_ROW/2;
    const byBase = bn.y + NH + 4 + (ti>=0?ti:0)*COL_ROW + COL_ROW/2;
    const ax=an.x+NW, ay=showColsA?ayBase:an.y+NH/2;
    const bx=bn.x,     by=showColsB?byBase:bn.y+NH/2;
    const cx=(ax+bx)/2;
    return `M${ax},${ay} C${cx},${ay} ${cx},${by} ${bx},${by}`;
  };

  return (
    <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column",background:"#080d1a"}}>

      {/* topbar */}
      <Topbar breadcrumb={[{label:"Data Lineage"}]} actions={
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setColLevel(v=>!v)} style={{
            display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:7,
            fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .18s",
            border:`1.5px solid ${colLevel?"#a78bfa":"rgba(255,255,255,0.1)"}`,
            background:colLevel?"rgba(167,139,250,0.13)":"rgba(255,255,255,0.04)",
            color:colLevel?"#a78bfa":"rgba(148,163,184,0.8)",
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="7" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Column Lineage
            {colLevel&&<span style={{background:"#a78bfa",color:"#100820",fontSize:9,fontWeight:900,borderRadius:3,padding:"1px 5px",marginLeft:2}}>ON</span>}
          </button>
          <Btn small ghost>Export SVG</Btn>
        </div>
      }/>

      {/* toolbar */}
      <div style={{
        display:"flex",gap:10,alignItems:"center",padding:"8px 20px",
        flexShrink:0,flexWrap:"wrap",
        background:"rgba(8,13,26,0.98)",
        borderBottom:"1px solid rgba(255,255,255,0.06)",
      }}>
        {/* search */}
        <div style={{position:"relative",display:"flex",alignItems:"center"}}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{position:"absolute",left:9,color:"rgba(100,116,139,0.6)",pointerEvents:"none"}}>
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search nodes…"
            style={{paddingLeft:30,paddingRight:10,paddingTop:6,paddingBottom:6,
              background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:8,color:"#e2e8f0",fontSize:12,outline:"none",width:185,
            }}/>
        </div>

        <div style={{width:1,height:20,background:"rgba(255,255,255,0.07)",flexShrink:0}}/>

        {/* type highlight pills */}
        <span style={{fontSize:10,color:"rgba(100,116,139,0.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",flexShrink:0}}>Highlight</span>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {allTypes.map(t=>{
            const on=hlTypes.has(t), m=TM[t];
            return (
              <button key={t} onClick={()=>setHlTypes(prev=>{const s=new Set(prev);s.has(t)?s.delete(t):s.add(t);return s;})}
                style={{
                  display:"flex",alignItems:"center",gap:5,padding:"3px 10px",
                  borderRadius:99,fontSize:11,fontWeight:500,cursor:"pointer",transition:"all .15s",
                  border:`1px solid ${on?m.color:"rgba(255,255,255,0.09)"}`,
                  background:on?`rgba(${m.glow},0.12)`:"rgba(255,255,255,0.03)",
                  color:on?m.color:"rgba(100,116,139,0.75)",
                }}>
                <span style={{width:7,height:7,borderRadius:"50%",background:m.color,display:"inline-block",
                  boxShadow:on?`0 0 7px rgba(${m.glow},0.9)`:"none",transition:"box-shadow .15s"}}/>
                {t}
              </button>
            );
          })}
          {hlTypes.size>0&&<button onClick={()=>setHlTypes(new Set())} style={{fontSize:11,color:"rgba(100,116,139,0.5)",background:"transparent",border:"none",cursor:"pointer",textDecoration:"underline"}}>Clear</button>}
        </div>

        {/* zoom controls */}
        <div style={{marginLeft:"auto",display:"flex",gap:5,alignItems:"center"}}>
          {[["−",()=>setZoom(z=>Math.max(0.3,+(z-0.1).toFixed(1)))],
            ["+",()=>setZoom(z=>Math.min(2,+(z+0.1).toFixed(1)))],
            ["Fit",()=>{setZoom(1);setPan({x:0,y:0});}]
          ].map(([l,fn])=>(
            <button key={l} onClick={fn} style={{
              padding:l==="Fit"?"3px 9px":"0",width:l==="Fit"?undefined:26,height:26,
              borderRadius:6,border:"1px solid rgba(255,255,255,0.09)",
              background:"rgba(255,255,255,0.04)",color:"rgba(148,163,184,0.8)",
              fontSize:l==="Fit"?11:17,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>{l}</button>
          ))}
          <span style={{fontSize:11,color:"rgba(100,116,139,0.55)",minWidth:38,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
        </div>
      </div>

      {/* main */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>

        {/* canvas */}
        <div ref={canvasRef}
          style={{flex:1,overflow:"hidden",position:"relative",
            background:"#080d1a",
            backgroundImage:"radial-gradient(rgba(148,163,184,0.06) 1px, transparent 1px)",
            backgroundSize:"28px 28px",
            cursor:panDrag.current?"grabbing":"grab"}}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
          onWheel={onWheel}>

          {/* ambient glow */}
          <div style={{position:"absolute",inset:0,pointerEvents:"none",
            background:"radial-gradient(ellipse 90% 70% at 50% 45%, rgba(56,189,248,0.025) 0%, transparent 65%)"}}/>

          {/* transform layer */}
          <div style={{
            position:"absolute",top:20,left:20,
            transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
            transformOrigin:"0 0",
          }}>

            {/* layer labels */}
            <div style={{position:"absolute",top:-28,left:0,width:SVG_W,display:"flex",pointerEvents:"none"}}>
              {["Sources","Pipelines","Tables","Derived","Consumers"].map((l,i)=>(
                <div key={l} style={{position:"absolute",left:COLS[i],width:NW,textAlign:"center"}}>
                  <span style={{fontSize:9.5,fontWeight:700,color:"rgba(100,116,139,0.5)",textTransform:"uppercase",letterSpacing:"0.12em"}}>{l}</span>
                </div>
              ))}
            </div>

            {/* column dividers */}
            {[1,2,3,4].map(i=>(
              <div key={i} style={{
                position:"absolute",left:COLS[i]-16,top:-30,
                width:1,height:SVG_H+60,
                background:"rgba(255,255,255,0.04)",
                pointerEvents:"none",
              }}/>
            ))}

            {/* SVG edges */}
            <svg width={SVG_W} height={SVG_H} style={{position:"absolute",top:0,left:0,overflow:"visible",pointerEvents:"none"}}>
              <defs>
                {[["a-dim","rgba(148,163,184,0.4)"],["a-up","#38bdf8"],["a-dn","#34d399"],["a-col","#a78bfa"]].map(([id,c])=>(
                  <marker key={id} id={id} markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                    <polygon points="0 0,9 3.5,0 7" fill={c}/>
                  </marker>
                ))}
                <filter id="lg"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>

              {/* table-level edges */}
              {EDGES.map((e,i)=>{
                const a=nm[e.f],b=nm[e.t]; if(!a||!b) return null;
                const ei=edgeInfo(i);
                const ax=a.x+NW, ay=a.y+NH/2;
                const bx=b.x,    by=b.y+NH/2;
                const cx=(ax+bx)/2;
                const mxp=(ax+bx)/2, myp=(ay+by)/2;
                const marker=ei.lit?(ei.isUp?"url(#a-up)":"url(#a-dn)"):"url(#a-dim)";
                return (
                  <g key={i}>
                    {ei.lit&&<path d={`M${ax},${ay} C${cx},${ay} ${cx},${by} ${bx},${by}`}
                      stroke={ei.color} strokeWidth={ei.width+3} fill="none" opacity="0.15" filter="url(#lg)"/>}
                    <path d={`M${ax},${ay} C${cx},${ay} ${cx},${by} ${bx},${by}`}
                      stroke={ei.color} strokeWidth={ei.width} fill="none"
                      markerEnd={marker}
                      style={{transition:"stroke .25s,stroke-width .25s"}}/>
                    {ei.lit&&e.op&&(
                      <g transform={`translate(${mxp},${myp})`}>
                        <rect x="-22" y="-9" width="44" height="17" rx="5" fill="#080d1a" stroke={ei.color} strokeWidth="0.8"/>
                        <text textAnchor="middle" y="4.5" fontSize="8.5" fill={ei.color} fontFamily="'Courier New',monospace" fontWeight="700">{e.op}</text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* column-level edges */}
              {colLevel && selected && COL_EDGES.map((ce,i)=>{
                const p=colEdgePath(ce); if(!p) return null;
                return <path key={`c${i}`} d={p} stroke="#a78bfa" strokeWidth="1.6" fill="none"
                  strokeDasharray="5 3" markerEnd="url(#a-col)" opacity="0.8"/>;
              })}
            </svg>

            {/* HTML node cards */}
            {NODES.map(n=>{
              const pos=nodePos(n);
              const isS=selected?.id===n.id;
              const isUp=path?.up.has(n.id), isDn=path?.dn.has(n.id);
              const alpha=nodeAlpha(n);
              const m=TM[n.type]||TM.Table;
              const showCols=colLevel&&isS&&n.cols;
              const extraH=showCols?n.cols.length*COL_ROW+10:0;
              const border=isS?m.color:isUp?"#38bdf8":isDn?"#34d399":"rgba(255,255,255,0.09)";
              const bg=isS?`rgba(${m.glow},0.1)`:isUp?"rgba(56,189,248,0.05)":isDn?"rgba(52,211,153,0.05)":"rgba(12,18,34,0.9)";
              const shadow=isS
                ?`0 0 0 2px rgba(${m.glow},0.45),0 0 24px rgba(${m.glow},0.3),0 8px 28px rgba(0,0,0,0.55)`
                :isUp?"0 0 0 1.5px rgba(56,189,248,0.3),0 4px 18px rgba(0,0,0,0.5)"
                :isDn?"0 0 0 1.5px rgba(52,211,153,0.3),0 4px 18px rgba(0,0,0,0.5)"
                :"0 2px 12px rgba(0,0,0,0.4)";

              return (
                <div key={n.id}
                  onClick={()=>setSelected(prev=>prev?.id===n.id?null:({...n,...pos}))}
                  style={{
                    position:"absolute",left:pos.x,top:pos.y,
                    width:NW,minHeight:NH+extraH,
                    background:bg,border:`1.5px solid ${border}`,
                    borderRadius:12,boxShadow:shadow,opacity:alpha,
                    backdropFilter:"blur(12px)",overflow:"hidden",
                    cursor:"pointer",transition:"opacity .25s,box-shadow .2s,border-color .2s",
                    userSelect:"none",
                  }}>
                  {/* top glow strip */}
                  <div style={{position:"absolute",top:0,left:14,right:14,height:2,borderRadius:"0 0 3px 3px",
                    background:`linear-gradient(90deg,transparent,rgba(${m.glow},${isS||isUp||isDn?0.85:0.3}),transparent)`,
                    transition:"opacity .2s"}}/>

                  {/* node body */}
                  <div style={{padding:"11px 11px 0",display:"flex",alignItems:"flex-start",gap:8}}>
                    <div style={{
                      width:30,height:30,borderRadius:8,flexShrink:0,marginTop:1,
                      background:`rgba(${m.glow},0.14)`,border:`1px solid rgba(${m.glow},0.28)`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:15,boxShadow:isS?`0 0 12px rgba(${m.glow},0.5)`:"none",
                    }}>{m.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:9,fontWeight:700,color:m.color,textTransform:"uppercase",letterSpacing:"0.09em",lineHeight:1,marginBottom:3}}>{n.type}</div>
                      <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9",fontFamily:"'Courier New',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.3}}>{n.label}</div>
                    </div>
                    {/* status */}
                    <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,marginTop:5,
                      background:n.status==="Active"?"#34d399":n.status==="Warning"?"#fbbf24":"#f87171",
                      boxShadow:`0 0 7px ${n.status==="Active"?"#34d399":n.status==="Warning"?"#fbbf24":"#f87171"}`}}/>
                  </div>

                  {/* sub row */}
                  <div style={{padding:"4px 11px 10px",paddingLeft:NW>100?52:11,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:9.5,color:"rgba(148,163,184,0.5)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.sub}</span>
                    {n.quality!=null&&<span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:4,flexShrink:0,fontFamily:"'Courier New',monospace",
                      background:n.quality>=90?"rgba(52,211,153,0.12)":n.quality>=70?"rgba(251,191,36,0.12)":"rgba(248,113,113,0.12)",
                      color:n.quality>=90?"#34d399":n.quality>=70?"#fbbf24":"#f87171"}}>{n.quality}%</span>}
                    {n.cert==="Certified"&&<span style={{fontSize:9,fontWeight:800,color:"#34d399",background:"rgba(52,211,153,0.1)",borderRadius:4,padding:"1px 5px",flexShrink:0}}>✓</span>}
                  </div>

                  {/* column rows */}
                  {showCols&&(
                    <div style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                      {n.cols.map((col,ci)=>{
                        const linked=COL_EDGES.some(ce=>(ce.from===n.id&&ce.fromCol===col.n)||(ce.to===n.id&&ce.toCol===col.n));
                        return (
                          <div key={col.n} style={{display:"flex",alignItems:"center",gap:4,padding:"0 9px",height:COL_ROW,
                            background:linked?"rgba(167,139,250,0.07)":ci%2===0?"rgba(255,255,255,0.015)":"transparent",
                            borderBottom:ci<n.cols.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                            {col.pk&&<span style={{fontSize:7,fontWeight:800,color:"#fbbf24",background:"rgba(251,191,36,0.12)",borderRadius:2,padding:"0 3px",lineHeight:"14px",flexShrink:0}}>PK</span>}
                            {col.fk&&<span style={{fontSize:7,fontWeight:800,color:"#38bdf8",background:"rgba(56,189,248,0.12)",borderRadius:2,padding:"0 3px",lineHeight:"14px",flexShrink:0}}>FK</span>}
                            <span style={{flex:1,fontSize:10.5,fontFamily:"'Courier New',monospace",
                              color:linked?"#c4b5fd":"rgba(148,163,184,0.8)",fontWeight:linked?700:400,
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{col.n}</span>
                            <span style={{fontSize:9,color:"rgba(100,116,139,0.5)",fontFamily:"'Courier New',monospace",flexShrink:0}}>{col.t}</span>
                            {linked&&<span style={{color:"#a78bfa",fontSize:9,flexShrink:0}}>⟶</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

          </div>{/* /transform */}

          {/* hop control — only when node selected */}
          {selected&&(
            <div className="fadeIn" style={{position:"absolute",top:14,left:14,
              background:"rgba(8,13,26,0.94)",border:"1px solid rgba(255,255,255,0.09)",
              borderRadius:11,padding:"10px 14px",backdropFilter:"blur(16px)",
              display:"flex",gap:14,alignItems:"center",
              boxShadow:"0 8px 28px rgba(0,0,0,0.5)"}}>
              {[{label:"Upstream",color:"#38bdf8",g:"56,189,248",val:hopsUp,set:setHopsUp,
                  arrow:<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M2 6l4-4 4 4" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>},
                {label:"Downstream",color:"#34d399",g:"52,211,153",val:hopsDown,set:setHopsDown,
                  arrow:<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6l4 4 4-4" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>},
              ].map((ctrl,ci)=>(
                <React.Fragment key={ctrl.label}>
                  {ci>0&&<div style={{width:1,height:20,background:"rgba(255,255,255,0.08)"}}/>}
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {ctrl.arrow}
                    <span style={{fontSize:11,color:ctrl.color,fontWeight:600}}>{ctrl.label}</span>
                    {[1,2,3].map(h=>(
                      <button key={h} onClick={()=>ctrl.set(h)} style={{
                        width:24,height:24,borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700,
                        border:`1.5px solid ${ctrl.val===h?ctrl.color:"rgba(255,255,255,0.1)"}`,
                        background:ctrl.val===h?`rgba(${ctrl.g},0.18)`:"transparent",
                        color:ctrl.val===h?ctrl.color:"rgba(100,116,139,0.55)",
                        transition:"all .15s",
                      }}>{h}</button>
                    ))}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* legend */}
          <div style={{position:"absolute",bottom:14,left:14,
            background:"rgba(8,13,26,0.9)",border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:9,padding:"7px 14px",backdropFilter:"blur(12px)",
            display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",maxWidth:580}}>
            {Object.entries(TM).map(([type,m])=>(
              <span key={type} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:"rgba(148,163,184,0.55)"}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:m.color,
                  boxShadow:`0 0 5px rgba(${m.glow},0.6)`,display:"inline-block"}}/>
                {type}
              </span>
            ))}
            <span style={{width:1,height:12,background:"rgba(255,255,255,0.07)",display:"inline-block"}}/>
            <span style={{fontSize:10,color:"rgba(100,116,139,0.35)"}}>Scroll to zoom · Drag to pan · Click to trace</span>
          </div>
        </div>{/* /canvas */}

        {/* side panel */}
        {selected&&(()=>{
          const m=TM[selected.type]||TM.Table;
          return (
            <div className="slideIn" style={{
              width:294,flexShrink:0,
              borderLeft:"1px solid rgba(255,255,255,0.06)",
              display:"flex",flexDirection:"column",
              background:"rgba(7,11,22,0.99)",
            }}>
              {/* header */}
              <div style={{padding:"14px 15px 0",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div style={{
                    width:36,height:36,borderRadius:10,flexShrink:0,
                    background:`rgba(${m.glow},0.12)`,border:`1.5px solid rgba(${m.glow},0.3)`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:18,boxShadow:`0 0 14px rgba(${m.glow},0.25)`}}>{m.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9",fontFamily:"'Courier New',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected.label}</div>
                    <div style={{fontSize:9.5,color:m.color,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:2}}>{selected.type}</div>
                  </div>
                  <button onClick={()=>setSelected(null)} style={{
                    width:28,height:28,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",
                    background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                    color:"rgba(148,163,184,0.5)",cursor:"pointer",flexShrink:0,transition:"all .15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.1)";e.currentTarget.style.color="#f1f5f9";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.color="rgba(148,163,184,0.5)";}}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </button>
                </div>
                {/* tabs */}
                <div style={{display:"flex"}}>
                  {[{k:"details",l:"Details"},{k:"impact",l:"Impact"},{k:"upstream",l:`↑ ${path.up.size}`},{k:"downstream",l:`↓ ${path.dn.size}`}].map(tb=>(
                    <button key={tb.k} onClick={()=>setPanelTab(tb.k)} style={{
                      flex:1,padding:"7px 0 8px",background:"transparent",cursor:"pointer",
                      border:"none",borderBottom:`2px solid ${panelTab===tb.k?m.color:"transparent"}`,
                      color:panelTab===tb.k?"#f1f5f9":"rgba(100,116,139,0.55)",
                      fontSize:11.5,fontWeight:panelTab===tb.k?700:400,transition:"all .15s"}}>{tb.l}</button>
                  ))}
                </div>
              </div>

              {/* body */}
              <div style={{flex:1,overflowY:"auto",padding:15}}>

                {panelTab==="details"&&(
                  <div>
                    {[
                      {l:"Status",v:<span style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{width:7,height:7,borderRadius:"50%",display:"inline-block",
                          background:selected.status==="Active"?"#34d399":"#fbbf24",
                          boxShadow:`0 0 6px ${selected.status==="Active"?"#34d399":"#fbbf24"}`}}/>
                        <span style={{color:"#e2e8f0",fontSize:12}}>{selected.status}</span>
                      </span>},
                      {l:"Domain",v:selected.domain},
                      {l:"Owner",v:selected.owner},
                      selected.quality!=null&&{l:"Quality",v:<span style={{fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:12,color:selected.quality>=90?"#34d399":selected.quality>=70?"#fbbf24":"#f87171"}}>{selected.quality}%</span>},
                      selected.cert&&{l:"Cert",v:<span style={{fontSize:11.5,color:selected.cert==="Certified"?"#34d399":selected.cert==="In Review"?"#fbbf24":"rgba(148,163,184,0.6)"}}>{selected.cert}</span>},
                      selected.size&&{l:"Size",v:selected.size},
                      selected.lastRun&&{l:"Last Run",v:selected.lastRun},
                      selected.version&&{l:"Version",v:<span style={{fontFamily:"'Courier New',monospace",color:"#38bdf8"}}>{selected.version}</span>},
                      selected.views&&{l:"Views",v:selected.views},
                    ].filter(Boolean).map(({l,v})=>(
                      <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                        <span style={{fontSize:11,color:"rgba(100,116,139,0.65)",fontWeight:500,flexShrink:0}}>{l}</span>
                        <span style={{fontSize:12,color:"#cbd5e1",textAlign:"right"}}>{v}</span>
                      </div>
                    ))}
                    {selected.tags&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:10}}>
                      {selected.tags.map(tg=><span key={tg} style={{fontSize:10,padding:"2px 8px",borderRadius:99,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",color:"#f87171"}}>{tg}</span>)}
                    </div>}
                    {selected.cols&&(
                      <div style={{marginTop:15}}>
                        <div style={{fontSize:10,fontWeight:700,color:"rgba(100,116,139,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Columns ({selected.cols.length})</div>
                        {selected.cols.map(col=>{
                          const linked=COL_EDGES.some(ce=>(ce.from===selected.id&&ce.fromCol===col.n)||(ce.to===selected.id&&ce.toCol===col.n));
                          return (
                            <div key={col.n} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                              {col.pk&&<span style={{fontSize:7,fontWeight:800,color:"#fbbf24",background:"rgba(251,191,36,0.1)",borderRadius:2,padding:"0 3px",lineHeight:"14px",flexShrink:0}}>PK</span>}
                              {col.fk&&<span style={{fontSize:7,fontWeight:800,color:"#38bdf8",background:"rgba(56,189,248,0.1)",borderRadius:2,padding:"0 3px",lineHeight:"14px",flexShrink:0}}>FK</span>}
                              <span style={{flex:1,fontSize:11,fontFamily:"'Courier New',monospace",color:linked?"#c4b5fd":"rgba(148,163,184,0.75)",fontWeight:linked?700:400}}>{col.n}</span>
                              <span style={{fontSize:9.5,color:"rgba(100,116,139,0.45)",fontFamily:"'Courier New',monospace",flexShrink:0}}>{col.t}</span>
                              {linked&&<span style={{color:"#a78bfa",fontSize:10}}>⟶</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button style={{
                      marginTop:15,width:"100%",padding:"9px",borderRadius:9,cursor:"pointer",
                      background:`linear-gradient(135deg,rgba(${m.glow},0.14),rgba(${m.glow},0.06))`,
                      border:`1px solid rgba(${m.glow},0.28)`,color:m.color,fontSize:12,fontWeight:700,transition:"all .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=`rgba(${m.glow},0.2)`}
                      onMouseLeave={e=>e.currentTarget.style.background=`linear-gradient(135deg,rgba(${m.glow},0.14),rgba(${m.glow},0.06))`}>
                      View Asset ↗
                    </button>
                  </div>
                )}

                {panelTab==="impact"&&impactStats&&(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {[{l:"Upstream",v:impactStats.up,c:"#38bdf8",g:"56,189,248"},
                        {l:"Downstream",v:impactStats.dn,c:"#34d399",g:"52,211,153"},
                        {l:"Dashboards",v:impactStats.dash,c:"#60a5fa",g:"96,165,250"},
                        {l:"ML Models",v:impactStats.ml,c:"#f472b6",g:"244,114,182"},
                      ].map(s=>(
                        <div key={s.l} style={{padding:"12px",background:`rgba(${s.g},0.07)`,borderRadius:10,border:`1px solid rgba(${s.g},0.16)`}}>
                          <div style={{fontSize:24,fontWeight:700,color:s.c,fontFamily:"'Courier New',monospace",lineHeight:1}}>{s.v}</div>
                          <div style={{fontSize:10,color:"rgba(148,163,184,0.5)",marginTop:5}}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{padding:"12px",background:"rgba(251,191,36,0.07)",borderRadius:10,border:"1px solid rgba(251,191,36,0.16)"}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#fbbf24",marginBottom:5}}>⚠ Change Impact</div>
                      <div style={{fontSize:11.5,color:"rgba(148,163,184,0.8)",lineHeight:1.65}}>
                        Modifying <strong style={{color:"#f1f5f9"}}>{selected.label}</strong> will propagate to <strong style={{color:"#f1f5f9"}}>{impactStats.dn}</strong> downstream assets — <strong style={{color:"#f1f5f9"}}>{impactStats.dash}</strong> dashboard{impactStats.dash!==1?"s":""} and <strong style={{color:"#f1f5f9"}}>{impactStats.ml}</strong> ML model{impactStats.ml!==1?"s":""}.
                      </div>
                    </div>
                  </div>
                )}

                {(panelTab==="upstream"||panelTab==="downstream")&&(()=>{
                  const isUp2=panelTab==="upstream";
                  const ids=isUp2?[...path.up]:[...path.dn];
                  const hops=isUp2?hopsUp:hopsDown;
                  return (
                    <div>
                      <div style={{fontSize:11,color:"rgba(100,116,139,0.55)",marginBottom:10}}>
                        {ids.length} {isUp2?"upstream":"downstream"} node{ids.length!==1?"s":""} · {hops} hop{hops!==1?"s":""}
                      </div>
                      {ids.length===0
                        ? <div style={{color:"rgba(100,116,139,0.35)",fontSize:12,textAlign:"center",paddingTop:28}}>None within {hops} hop{hops!==1?"s":""}</div>
                        : ids.map(id=>{
                            const nd=NODES.find(n=>n.id===id); if(!nd) return null;
                            const m2=TM[nd.type]||TM.Table;
                            return (
                              <div key={id}
                                onClick={()=>{setSelected({...nd,...nodePos(nd)});setPanelTab("details");}}
                                style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:9,marginBottom:4,
                                  background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",cursor:"pointer",transition:"all .15s"}}
                                onMouseEnter={e=>{e.currentTarget.style.background=`rgba(${m2.glow},0.08)`;e.currentTarget.style.borderColor=`rgba(${m2.glow},0.25)`;}}
                                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";}}>
                                <span style={{width:9,height:9,borderRadius:"50%",background:m2.color,boxShadow:`0 0 6px rgba(${m2.glow},0.7)`,flexShrink:0}}/>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:12,color:"#f1f5f9",fontWeight:600,fontFamily:"'Courier New',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nd.label}</div>
                                  <div style={{fontSize:10,color:"rgba(100,116,139,0.55)"}}>{nd.type} · {nd.domain}</div>
                                </div>
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 1.5l3.5 3.5L3 8.5" stroke="rgba(148,163,184,0.35)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              </div>
                            );
                          })
                      }
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};



// ─────────────────────────────────────────────
// DATA QUALITY FULL VIEW
// ─────────────────────────────────────────────
const QualityView = ()=>{
  const [tab,setTab]=useState("overview");
  const [newRule,setNewRule]=useState(false);
  const [ruleForm,setRuleForm]=useState({table:"orders",rule:"",dim:"Completeness",threshold:95});

  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Data Quality"}]} actions={<Btn icon={Ic.plus(12)} variant="primary" onClick={()=>setNewRule(true)}>New Rule</Btn>}/>
    <div style={{padding:"0 28px",borderBottom:`1px solid ${T.border}`,flexShrink:0,paddingTop:18}}>
      <Tabs2 tabs={[{key:"overview",label:"Overview"},{key:"rules",label:"Rules"},{key:"incidents",label:"Incidents"},{key:"trends",label:"Trends"}]} active={tab} onChange={setTab}/>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      {tab==="overview"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
          <Metric label="Avg Quality" value="87.3" delta="-0.4" color={T.amber}/>
          <Metric label="Passing Rules" value="147" delta="+3" color={T.green}/>
          <Metric label="Warnings" value="12" color={T.amber}/>
          <Metric label="Failing" value="8" color={T.red}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
          <Card2 style={{overflow:"hidden",padding:0}}>
            <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:13,fontWeight:600}}>All Quality Rules</span></div>
            <DataTable cols={[
              {key:"table",label:"Table",render:v=><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.blue}}>{v}</span>},
              {key:"rule",label:"Rule",render:v=><span style={{fontSize:12,color:T.text}}>{v}</span>},
              {key:"dim",label:"Dimension",render:v=><Badge>{v}</Badge>},
              {key:"status",label:"Status",render:v=><span style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><SDot status={v}/>{v}</span>},
              {key:"score",label:"Score",render:v=><QScore score={v}/>},
            ]} rows={QUALITY_RULES}/>
          </Card2>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card2><div style={{padding:16}}>
              <SH title="By Domain"/>
              {[{d:"Commerce",s:94},{d:"Finance",s:91},{d:"Product",s:72},{d:"ML",s:88}].map(d=>(
                <div key={d.d} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:T.textSub}}>{d.d}</span><span style={{color:d.s>=90?T.green:d.s>=70?T.amber:T.red,fontFamily:"'Geist Mono',monospace"}}>{d.s}</span></div>
                  <div style={{height:4,background:T.bgHover,borderRadius:2}}><div style={{height:"100%",width:`${d.s}%`,background:d.s>=90?T.green:d.s>=70?T.amber:T.red,borderRadius:2}}/></div>
                </div>
              ))}
            </div></Card2>
            <Card2><div style={{padding:16}}>
              <SH title="Recent Incidents"/>
              {[{asset:"product_events",issue:"Schema drift in user_agent",time:"1h ago",sev:"High"},{asset:"user_sessions",issue:"Completeness < 50%",time:"3h ago",sev:"Critical"},{asset:"customers",issue:"Email uniqueness < 90%",time:"6h ago",sev:"Med"}].map((inc,i)=>(
                <div key={i} style={{padding:"8px 0",borderBottom:i<2?`1px solid ${T.border}`:"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.blue}}>{inc.asset}</span><Badge color={inc.sev==="Critical"?T.red:inc.sev==="High"?T.amber:T.textMuted} bg="transparent">{inc.sev}</Badge></div>
                  <div style={{fontSize:11,color:T.textMuted}}>{inc.issue} · {inc.time}</div>
                </div>
              ))}
            </div></Card2>
          </div>
        </div>
      </>}
      {tab==="rules"&&<Card2 style={{overflow:"hidden",padding:0}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,fontWeight:600}}>{QUALITY_RULES.length} Rules</span>
          <div style={{display:"flex",gap:8}}><Input2 placeholder="Search rules…" icon={Ic.search(12)} style={{width:200}}/><Btn small icon={Ic.plus(11)} onClick={()=>setNewRule(true)}>Add Rule</Btn></div>
        </div>
        <DataTable cols={[
          {key:"table",label:"Table",render:v=><span style={{fontFamily:"'Geist Mono',monospace",color:T.blue,fontSize:12}}>{v}</span>},
          {key:"rule",label:"Rule",render:v=><span style={{fontSize:12,color:T.text}}>{v}</span>},
          {key:"dim",label:"Dimension",render:v=><Badge>{v}</Badge>},
          {key:"status",label:"Status",render:v=><span style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><SDot status={v}/>{v}</span>},
          {key:"score",label:"Score",render:v=><QScore score={v}/>},
          {key:"runs",label:"Runs/day",render:v=><span style={{fontSize:11,color:T.textMuted,fontFamily:"'Geist Mono',monospace"}}>{v}</span>},
          {key:"lastRun",label:"Last Run",render:v=><span style={{fontSize:11,color:T.textMuted}}>{v}</span>},
          {key:"id",label:"",render:(_,r)=><div style={{display:"flex",gap:5}}><Btn small ghost>Edit</Btn><Btn small variant="danger">Delete</Btn></div>},
        ]} rows={QUALITY_RULES}/>
      </Card2>}
      {tab==="incidents"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[{asset:"product_events",issue:"Schema drift: new column `user_agent_v2` detected",sev:"High",time:"1h ago",status:"Open"},{asset:"user_sessions",issue:"Completeness dropped to 41% on session_id",sev:"Critical",time:"3h ago",status:"In Progress"},{asset:"customers",issue:"Email uniqueness SLA breached (87% < 90% threshold)",sev:"Med",time:"6h ago",status:"Open"}].map((inc,i)=>(
          <Card2 key={i}><div style={{padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><SDot status={inc.status}/><span style={{fontSize:13,fontWeight:500,color:T.text}}>{inc.issue}</span></div>
              <Badge color={inc.sev==="Critical"?T.red:inc.sev==="High"?T.amber:T.textSub}>{inc.sev}</Badge>
            </div>
            <div style={{display:"flex",gap:12,fontSize:11,color:T.textMuted}}><span style={{fontFamily:"'Geist Mono',monospace",color:T.blue}}>{inc.asset}</span><span>{inc.time}</span><span>{inc.status}</span></div>
            <div style={{display:"flex",gap:8,marginTop:10}}><Btn small>Investigate</Btn><Btn small ghost>Silence</Btn></div>
          </div></Card2>
        ))}
      </div>}
      {tab==="trends"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {["Commerce","Finance","Product","ML"].map(d=>{
            const scores=[84,86,87,89,88,90,91,90,92,93,92,94];
            return <Card2 key={d}><div style={{padding:16}}>
              <SH title={`${d} Domain`}/>
              <div style={{height:80,display:"flex",alignItems:"flex-end",gap:2}}>
                {scores.map((v,i)=><div key={i} style={{flex:1,background:T.accent,borderRadius:"2px 2px 0 0",opacity:.3+(i/scores.length)*.6,height:`${(v/100)*80}px`}}/>)}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:T.textMuted}}><span>30d ago</span><span>Today: <b style={{color:T.accent}}>{scores[scores.length-1]}</b></span></div>
            </div></Card2>;
          })}
        </div>
      </div>}
    </div>

    <Modal open={newRule} onClose={()=>setNewRule(false)} title="Create Quality Rule">
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Table</div>
          <select value={ruleForm.table} onChange={e=>setRuleForm({...ruleForm,table:e.target.value})} style={{width:"100%",padding:"8px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:13,outline:"none"}}>
            {ASSETS.filter(a=>a.type==="Table").map(a=><option key={a.name}>{a.name}</option>)}
          </select>
        </div>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Rule Expression</div><Input2 placeholder="e.g. order_id IS NOT NULL" value={ruleForm.rule} onChange={e=>setRuleForm({...ruleForm,rule:e.target.value})}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Dimension</div>
            <select value={ruleForm.dim} onChange={e=>setRuleForm({...ruleForm,dim:e.target.value})} style={{width:"100%",padding:"8px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:13,outline:"none"}}>
              {["Completeness","Freshness","Uniqueness","Accuracy","Validity","Integrity"].map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Threshold (%)</div><Input2 type="number" value={ruleForm.threshold} onChange={e=>setRuleForm({...ruleForm,threshold:e.target.value})}/></div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}><Btn onClick={()=>setNewRule(false)}>Cancel</Btn><Btn variant="primary">Create Rule</Btn></div>
      </div>
    </Modal>
  </div>;
};

// ─────────────────────────────────────────────
// POLICIES
// ─────────────────────────────────────────────
const PoliciesView = ({onToast})=>{
  const [selected,setSelected]=useState(null);
  const [newModal,setNewModal]=useState(false);
  const [form,setForm]=useState({name:"",scope:"",severity:"Critical",description:""});

  if(selected) return <PolicyDetail policy={selected} onBack={()=>setSelected(null)} onToast={onToast}/>;

  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Governance Policies"}]} actions={<Btn icon={Ic.plus(12)} variant="primary" onClick={()=>setNewModal(true)}>New Policy</Btn>}/>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <Metric label="Active Policies" value={String(POLICIES.filter(p=>p.status==="Active").length)} color={T.green}/>
        <Metric label="Total Violations" value={String(POLICIES.reduce((a,p)=>a+p.violations,0))} color={T.red}/>
        <Metric label="Assets Covered" value="74" color={T.blue}/>
      </div>
      <Card2 style={{overflow:"hidden",padding:0}}>
        <DataTable cols={[
          {key:"name",label:"Policy Name",render:v=><span style={{fontSize:13,fontWeight:500,color:T.text}}>{v}</span>},
          {key:"description",label:"Description",render:v=><span style={{fontSize:12,color:T.textSub,maxWidth:260,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</span>},
          {key:"scope",label:"Scope",render:v=><span style={{fontSize:12,color:T.textSub}}>{v}</span>},
          {key:"severity",label:"Severity",render:v=><Badge color={v==="Critical"?T.rose:T.amber} bg={v==="Critical"?T.roseDim:T.amberDim}>{v}</Badge>},
          {key:"status",label:"Status",render:v=><span style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><SDot status={v}/>{v}</span>},
          {key:"assets",label:"Assets",render:v=><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.textMuted}}>{v}</span>},
          {key:"violations",label:"Violations",render:v=><span style={{fontSize:12,color:v>0?T.red:T.green,fontFamily:"'Geist Mono',monospace"}}>{v}</span>},
        ]} rows={POLICIES} onRowClick={setSelected}/>
      </Card2>
    </div>
    <Modal open={newModal} onClose={()=>setNewModal(false)} title="Create Governance Policy">
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Policy Name</div><Input2 placeholder="e.g. PII Data Handling" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Scope</div><Input2 placeholder="e.g. All Tables, Finance Domain" value={form.scope} onChange={e=>setForm({...form,scope:e.target.value})}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Severity</div>
            <select value={form.severity} onChange={e=>setForm({...form,severity:e.target.value})} style={{width:"100%",padding:"8px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:13,outline:"none"}}>
              {["Critical","High","Medium","Low"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Status</div>
            <select style={{width:"100%",padding:"8px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:13,outline:"none"}}>
              <option>Draft</option><option>Active</option>
            </select>
          </div>
        </div>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Description</div><Input2 multiline rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe what this policy governs…"/></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}><Btn onClick={()=>setNewModal(false)}>Cancel</Btn><Btn variant="primary" onClick={()=>{setNewModal(false);onToast("Policy created","success");}}>Create Policy</Btn></div>
      </div>
    </Modal>
  </div>;
};

const PolicyDetail = ({policy,onBack,onToast})=>(
  <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Governance Policies",onClick:onBack},{label:policy.name}]} actions={<><Btn small icon={Ic.edit(11)}>Edit</Btn><Btn small variant="danger">Disable</Btn></>}/>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card2><div style={{padding:16}}>
            <SH title="Policy Definition"/>
            <p style={{fontSize:13,color:T.textSub,marginBottom:14,lineHeight:1.7}}>{policy.description}</p>
            <div style={{background:T.bgHover,borderRadius:8,padding:16,fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.textSub,lineHeight:1.9}}>
              <span style={{color:T.violet}}>policy</span> <span style={{color:T.accent}}>{policy.name.toLowerCase().replace(/\s+/g,"_")}</span> {"{"}<br/>
              &nbsp;&nbsp;<span style={{color:T.violet}}>scope</span>: <span style={{color:T.amber}}>"{policy.scope}"</span><br/>
              &nbsp;&nbsp;<span style={{color:T.violet}}>severity</span>: <span style={{color:T.amber}}>"{policy.severity}"</span><br/>
              &nbsp;&nbsp;<span style={{color:T.violet}}>owner</span>: <span style={{color:T.amber}}>"{policy.owner}"</span><br/>
              &nbsp;&nbsp;<span style={{color:T.violet}}>rules</span>: [<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:T.blue}}>"no_unmasked_pii_in_logs"</span>,<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:T.blue}}>"require_encryption_at_rest"</span>,<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:T.blue}}>"access_review_quarterly"</span><br/>
              &nbsp;&nbsp;]<br/>{"}"}
            </div>
          </div></Card2>
          <Card2 style={{overflow:"hidden",padding:0}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:13,fontWeight:600}}>Affected Assets</span></div>
            <DataTable cols={[
              {key:"name",label:"Asset",render:v=><span style={{fontFamily:"'Geist Mono',monospace",color:T.blue,fontSize:12}}>{v}</span>},
              {key:"type",label:"Type",render:v=><TypeBadge type={v}/>},
              {key:"cert",label:"Cert",render:v=><CertBadge cert={v}/>},
              {key:"id",label:"Violations",render:(_,r)=><span style={{color:r.id<=2?T.red:T.green,fontFamily:"'Geist Mono',monospace",fontSize:12}}>{r.id<=2?r.id-1:0}</span>},
            ]} rows={ASSETS.slice(0,5)}/>
          </Card2>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card2><div style={{padding:16}}>
            <SH title="Policy Info"/>
            {[{l:"Status",v:<><SDot status={policy.status}/> {policy.status}</>},{l:"Severity",v:<Badge color={policy.severity==="Critical"?T.rose:T.amber}>{policy.severity}</Badge>},{l:"Scope",v:policy.scope},{l:"Owner",v:policy.owner},{l:"Assets Covered",v:`${policy.assets}`},{l:"Violations",v:<span style={{color:policy.violations>0?T.red:T.green}}>{policy.violations}</span>},{l:"Last Updated",v:policy.updated}].map(m=>(
              <div key={m.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,marginBottom:9}}><span style={{color:T.textMuted}}>{m.l}</span><span style={{color:T.text,display:"flex",alignItems:"center",gap:4}}>{m.v}</span></div>
            ))}
          </div></Card2>
          <Card2><div style={{padding:16}}>
            <SH title="Violation History"/>
            <div style={{height:60,display:"flex",alignItems:"flex-end",gap:3}}>
              {[0,1,0,2,0,1,3,2,1,2,1,policy.violations].map((v,i)=><div key={i} style={{flex:1,background:v>0?T.rose:T.accentDim,borderRadius:"2px 2px 0 0",height:`${Math.max((v/4)*60,4)}px`}}/>)}
            </div>
          </div></Card2>
        </div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// ACCESS GOVERNANCE
// ─────────────────────────────────────────────
const AccessView = ({onToast})=>{
  const [tab,setTab]=useState("requests");
  const [reqs,setReqs]=useState(ACCESS_REQUESTS);

  const approve=(id)=>{setReqs(reqs.map(r=>r.id===id?{...r,status:"Approved"}:r));onToast("Access approved","success");};
  const deny=(id)=>{setReqs(reqs.map(r=>r.id===id?{...r,status:"Denied"}:r));onToast("Access denied","error");};

  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Access Governance"}]} actions={<Btn icon={Ic.plus(12)} variant="primary">Grant Access</Btn>}/>
    <div style={{padding:"0 28px",borderBottom:`1px solid ${T.border}`,flexShrink:0,paddingTop:18}}>
      <Tabs2 tabs={[{key:"requests",label:`Requests (${reqs.filter(r=>r.status==="Pending").length})`},{key:"roles",label:"Roles & Permissions"},{key:"audit",label:"Audit Log"}]} active={tab} onChange={setTab}/>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      {tab==="requests"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
          <Metric label="Pending" value={String(reqs.filter(r=>r.status==="Pending").length)} color={T.amber}/>
          <Metric label="Approved (30d)" value="28" color={T.green}/>
          <Metric label="Denied (30d)" value="4" color={T.red}/>
        </div>
        <Card2 style={{overflow:"hidden",padding:0}}>
          <DataTable cols={[
            {key:"user",label:"User",render:v=><span style={{fontFamily:"'Geist Mono',monospace",color:T.text,fontSize:12}}>{v}</span>},
            {key:"asset",label:"Asset",render:v=><span style={{fontFamily:"'Geist Mono',monospace",color:T.blue,fontSize:12}}>{v}</span>},
            {key:"level",label:"Level",render:v=><Badge color={v==="Write"?T.amber:T.blue}>{v}</Badge>},
            {key:"team",label:"Team",render:v=><span style={{fontSize:12,color:T.textSub}}>{v}</span>},
            {key:"reason",label:"Reason",render:v=><span style={{fontSize:11,color:T.textMuted,maxWidth:180,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</span>},
            {key:"status",label:"Status",render:v=><span style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><SDot status={v}/>{v}</span>},
            {key:"since",label:"Since",render:v=><span style={{fontSize:11,color:T.textMuted}}>{v}</span>},
            {key:"id",label:"Actions",render:(id,r)=>r.status==="Pending"?<div style={{display:"flex",gap:5}}><Btn small variant="primary" onClick={()=>approve(id)}>Approve</Btn><Btn small variant="danger" onClick={()=>deny(id)}>Deny</Btn></div>:<SDot status={r.status}/>},
          ]} rows={reqs}/>
        </Card2>
      </>}
      {tab==="roles"&&<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        {[{role:"Data Engineer",users:8,perms:["Read","Write","Create","Delete","Schema Edit"],scope:"All Domains"},{role:"Data Analyst",users:24,perms:["Read","Export"],scope:"Analytics Domain"},{role:"Data Steward",users:5,perms:["Read","Write","Certify","Tag"],scope:"Assigned Assets"},{role:"Compliance Officer",users:3,perms:["Read","Audit","Policy View","Export"],scope:"All Domains"},{role:"ML Engineer",users:6,perms:["Read","Write","Model Deploy"],scope:"ML Domain"},{role:"Business User",users:45,perms:["Read"],scope:"Public Assets"}].map(r=>(
          <Card2 key={r.role}><div style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div><div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:2}}>{r.role}</div><div style={{fontSize:11,color:T.textMuted}}>{r.users} users · {r.scope}</div></div>
              <Btn small ghost>Edit</Btn>
            </div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {r.perms.map(p=><Badge key={p} color={T.blue} bg={T.blueDim}>{p}</Badge>)}
            </div>
          </div></Card2>
        ))}
      </div>}
      {tab==="audit"&&<Card2 style={{overflow:"hidden",padding:0}}>
        <DataTable cols={[
          {key:"user",label:"User",render:v=><span style={{fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.text}}>{v}</span>},
          {key:"action",label:"Action",render:v=><span style={{fontSize:12,color:T.text}}>{v}</span>},
          {key:"asset",label:"Asset",render:v=><span style={{fontFamily:"'Geist Mono',monospace",color:T.blue,fontSize:12}}>{v}</span>},
          {key:"time",label:"Time",render:v=><span style={{fontSize:11,color:T.textMuted}}>{v}</span>},
          {key:"ip",label:"IP",render:v=><span style={{fontFamily:"'Geist Mono',monospace",fontSize:11,color:T.textMuted}}>{v}</span>},
          {key:"result",label:"Result",render:v=><SDot status={v==="Success"?"Approved":"Denied"}/>},
        ]} rows={[
          {user:"maya.chen",action:"Granted Read access",asset:"customers",time:"2h ago",ip:"10.0.1.45",result:"Success"},
          {user:"john.doe",action:"Queried table",asset:"orders",time:"3h ago",ip:"10.0.2.12",result:"Success"},
          {user:"alice.wang",action:"Write access denied",asset:"orders",time:"5h ago",ip:"10.0.1.88",result:"Denied"},
          {user:"System",action:"Revoked expired access",asset:"user_sessions",time:"1d ago",ip:"—",result:"Success"},
          {user:"carol.jones",action:"Export blocked (PII)",asset:"customers",time:"2d ago",ip:"10.0.3.22",result:"Denied"},
          {user:"dev.patel",action:"Updated column tags",asset:"customers",time:"2d ago",ip:"10.0.1.33",result:"Success"},
        ]}/>
      </Card2>}
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// COMPLIANCE
// ─────────────────────────────────────────────
const ComplianceView = ()=>{
  const [tab,setTab]=useState("overview");
  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Compliance"}]} actions={<><Btn small>Run Assessment</Btn><Btn small variant="primary">Export Report</Btn></>}/>
    <div style={{padding:"0 28px",borderBottom:`1px solid ${T.border}`,flexShrink:0,paddingTop:18}}>
      <Tabs2 tabs={[{key:"overview",label:"Overview"},{key:"gdpr",label:"GDPR"},{key:"soc2",label:"SOC 2"},{key:"ccpa",label:"CCPA"},{key:"issues",label:"Open Issues"}]} active={tab} onChange={setTab}/>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      {tab==="overview"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
          <Metric label="GDPR Score" value="94%" color={T.green}/>
          <Metric label="SOC2 Score" value="88%" color={T.blue}/>
          <Metric label="CCPA Score" value="91%" color={T.accent}/>
          <Metric label="Open Issues" value="7" color={T.rose}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[{f:"GDPR",s:94,c:T.green},{f:"SOC 2 Type II",s:88,c:T.blue},{f:"CCPA",s:91,c:T.accent},{f:"ISO 27001",s:76,c:T.amber}].map(fw=>(
              <Card2 key={fw.f}><div style={{padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontSize:14,fontWeight:600,color:T.text}}>{fw.f}</span>
                  <div style={{display:"flex",alignItems:"center",gap:10}}><QScore score={fw.s}/><Btn small ghost>View Report</Btn></div>
                </div>
                <div style={{height:6,background:T.bgHover,borderRadius:3}}><div style={{height:"100%",width:`${fw.s}%`,background:fw.c,borderRadius:3}}/></div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:11,color:T.textMuted}}><span>{fw.s}% compliant</span><span>{100-fw.s}% needs attention</span></div>
              </div></Card2>
            ))}
          </div>
          <Card2><div style={{padding:16}}>
            <SH title="Open Issues"/>
            {[{issue:"PII exported without masking",fw:"GDPR",sev:"Critical",due:"3d"},{issue:"Key rotation overdue",fw:"SOC2",sev:"High",due:"1w"},{issue:"Retention not applied",fw:"GDPR",sev:"Med",due:"2w"},{issue:"Consent logs missing",fw:"CCPA",sev:"High",due:"5d"}].map((item,i)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:i<3?`1px solid ${T.border}`:"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:T.textMuted}}>{item.fw}</span><Badge color={item.sev==="Critical"?T.red:item.sev==="High"?T.amber:T.textSub} bg="transparent">{item.sev}</Badge></div>
                <div style={{fontSize:12,color:T.text,marginBottom:2}}>{item.issue}</div>
                <div style={{fontSize:10,color:T.textMuted}}>Due in {item.due}</div>
              </div>
            ))}
          </div></Card2>
        </div>
      </>}
      {(tab==="gdpr"||tab==="soc2"||tab==="ccpa")&&<ComplianceFramework framework={tab.toUpperCase().replace("SOC2","SOC 2 Type II")}/>}
      {tab==="issues"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[{issue:"PII exported without masking in user_sessions",fw:"GDPR",sev:"Critical",due:"3d",status:"Open",asset:"user_sessions"},{issue:"Encryption key rotation overdue by 30 days",fw:"SOC2",sev:"High",due:"1w",status:"In Progress",asset:"warehouse.prod"},{issue:"Data retention not applied to product_events",fw:"GDPR",sev:"Med",due:"2w",status:"Open",asset:"product_events"},{issue:"Missing data subject consent logs",fw:"CCPA",sev:"High",due:"5d",status:"Open",asset:"customers"}].map((item,i)=>(
          <Card2 key={i}><div style={{padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:500,color:T.text}}>{item.issue}</span>
              <Badge color={item.sev==="Critical"?T.red:item.sev==="High"?T.amber:T.textSub}>{item.sev}</Badge>
            </div>
            <div style={{display:"flex",gap:12,fontSize:11,color:T.textMuted,marginBottom:10}}>
              <span>{item.fw}</span><span>·</span><span style={{fontFamily:"'Geist Mono',monospace",color:T.blue}}>{item.asset}</span><span>·</span><span>Due in {item.due}</span><SDot status={item.status}/><span>{item.status}</span>
            </div>
            <div style={{display:"flex",gap:8}}><Btn small>Remediate</Btn><Btn small ghost>Assign</Btn><Btn small ghost>Defer</Btn></div>
          </div></Card2>
        ))}
      </div>}
    </div>
  </div>;
};

const ComplianceFramework = ({framework})=>{
  const items=[{check:"Data minimization controls",status:"passing"},{check:"Right to erasure workflow",status:"passing"},{check:"Data portability export",status:"warning"},{check:"Breach notification process",status:"passing"},{check:"Privacy by design review",status:"passing"},{check:"Cross-border transfer controls",status:"warning"},{check:"Consent management",status:"failing"}];
  return <div style={{display:"flex",flexDirection:"column",gap:10}}>
    <Card2><div style={{padding:16}}>
      <SH title={`${framework} Compliance Checklist`} action={<Btn small>Export</Btn>}/>
      {items.map((item,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:6}}>
          <span style={{fontSize:13,color:T.text}}>{item.check}</span>
          <span style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:item.status==="passing"?T.green:item.status==="warning"?T.amber:T.red}}><SDot status={item.status}/>{item.status}</span>
        </div>
      ))}
    </div></Card2>
  </div>;
};

// ─────────────────────────────────────────────
// CERTIFICATIONS
// ─────────────────────────────────────────────
const CertificationsView = ({onToast})=>{
  const [tab,setTab]=useState("all");
  const [certModal,setCertModal]=useState(false);
  const [form,setForm]=useState({asset:"",notes:""});

  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Certifications"}]} actions={<Btn icon={Ic.cert(13)} variant="primary" onClick={()=>setCertModal(true)}>New Certification</Btn>}/>
    <div style={{padding:"0 28px",borderBottom:`1px solid ${T.border}`,flexShrink:0,paddingTop:18}}>
      <Tabs2 tabs={[{key:"all",label:"All"},{key:"active",label:"Active"},{key:"pending",label:"Pending"},{key:"expiring",label:"Expiring Soon"}]} active={tab} onChange={setTab}/>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <Metric label="Total Certified" value={String(CERTIFICATIONS.filter(c=>c.status==="Active").length)} color={T.accent}/>
        <Metric label="Pending Review" value={String(CERTIFICATIONS.filter(c=>c.status==="Pending").length)} color={T.amber}/>
        <Metric label="Expiring 30d" value="2" color={T.rose}/>
        <Metric label="Avg Quality" value="92" color={T.blue}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {CERTIFICATIONS.filter(c=>tab==="all"||c.status.toLowerCase()===tab||(tab==="expiring"&&c.status==="Active")).map(cert=>(
          <Card2 key={cert.id}><div style={{padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:10,background:cert.status==="Active"?T.accentDim:T.amberDim,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${cert.status==="Active"?"rgba(110,231,183,.25)":"rgba(252,211,77,.25)"}`}}>
                  {Ic.cert(20)}
                </div>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontSize:14,fontWeight:600,fontFamily:"'Geist Mono',monospace",color:T.text}}>{cert.asset}</span>
                    <TypeBadge type={cert.type}/>
                    <CertBadge cert={cert.status==="Active"?"Certified":cert.status==="Pending"?"In Review":"Uncertified"}/>
                  </div>
                  <div style={{fontSize:12,color:T.textMuted}}>{cert.certifier?`Certified by ${cert.certifier}`:"Awaiting certification"} {cert.date&&`· ${cert.date}`}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Quality Score</div>
                  <QScore score={cert.score}/>
                </div>
                {cert.expires&&<div style={{textAlign:"right"}}>
                  <div style={{fontSize:11,color:T.textMuted,marginBottom:2}}>Expires</div>
                  <div style={{fontSize:12,color:T.text}}>{cert.expires}</div>
                </div>}
                <div style={{display:"flex",gap:6}}>
                  {cert.status==="Pending"&&<Btn small variant="primary" onClick={()=>onToast(`${cert.asset} certified`,"success")}>Certify</Btn>}
                  {cert.status==="Active"&&<Btn small ghost>Renew</Btn>}
                  <Btn small ghost>View</Btn>
                </div>
              </div>
            </div>
            {cert.notes&&<div style={{marginTop:10,fontSize:12,color:T.textSub,padding:"8px 12px",background:T.bgHover,borderRadius:7,borderLeft:`2px solid ${T.accent}`}}>{cert.notes}</div>}
          </div></Card2>
        ))}
      </div>
    </div>
    <Modal open={certModal} onClose={()=>setCertModal(false)} title="Initiate Certification">
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Asset to Certify</div>
          <select value={form.asset} onChange={e=>setForm({...form,asset:e.target.value})} style={{width:"100%",padding:"8px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:13,outline:"none"}}>
            <option value="">Select asset…</option>
            {ASSETS.map(a=><option key={a.name}>{a.name}</option>)}
          </select>
        </div>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Certification Notes</div><Input2 multiline rows={3} placeholder="Describe what was reviewed…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
          <Btn onClick={()=>setCertModal(false)}>Cancel</Btn>
          <Btn variant="primary" icon={Ic.cert(13)} onClick={()=>{setCertModal(false);onToast("Certification initiated","success");}}>Start Review</Btn>
        </div>
      </div>
    </Modal>
  </div>;
};

// ─────────────────────────────────────────────
// STEWARDSHIP
// ─────────────────────────────────────────────
const StewardshipView = ({onToast})=>{
  const [tasks,setTasks]=useState(STEWARDSHIP_TASKS);
  const [tab,setTab]=useState("tasks");
  const complete=(id)=>{setTasks(tasks.map(t=>t.id===id?{...t,status:"Done"}:t));onToast("Task completed","success");};

  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Stewardship"}]} actions={<Btn icon={Ic.plus(12)}>New Task</Btn>}/>
    <div style={{padding:"0 28px",borderBottom:`1px solid ${T.border}`,flexShrink:0,paddingTop:18}}>
      <Tabs2 tabs={[{key:"tasks",label:"My Tasks"},{key:"assets",label:"Orphaned Assets"},{key:"stewards",label:"Stewards"}]} active={tab} onChange={setTab}/>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      {tab==="tasks"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
          <Metric label="Open Tasks" value={String(tasks.filter(t=>t.status==="Open").length)} color={T.amber}/>
          <Metric label="In Progress" value={String(tasks.filter(t=>t.status==="In Progress").length)} color={T.blue}/>
          <Metric label="Completed" value={String(tasks.filter(t=>t.status==="Done").length)} color={T.green}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {tasks.filter(t=>t.status!=="Done").map(task=>(
            <Card2 key={task.id}><div style={{padding:14,display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:36,height:36,borderRadius:8,background:task.priority==="Critical"?T.roseDim:task.priority==="High"?T.amberDim:T.bgHover,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${task.priority==="Critical"?"rgba(253,164,175,.25)":task.priority==="High"?"rgba(252,211,77,.25)":T.border}`}}>
                {Ic.steward(14)}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <span style={{fontSize:13,fontWeight:500,color:T.text}}>{task.type}</span>
                  <Badge color={task.priority==="Critical"?T.red:task.priority==="High"?T.amber:task.priority==="Med"?T.blue:T.textSub}>{task.priority}</Badge>
                </div>
                <div style={{fontSize:12,color:T.textMuted}}>Asset: <span style={{fontFamily:"'Geist Mono',monospace",color:T.blue}}>{task.asset}</span> · Assigned to <span style={{color:T.text}}>{task.assigned}</span> · Due in <span style={{color:T.amber}}>{task.due}</span></div>
              </div>
              <SDot status={task.status}/>
              <span style={{fontSize:12,color:T.textSub}}>{task.status}</span>
              <div style={{display:"flex",gap:6}}>
                <Btn small variant="primary" onClick={()=>complete(task.id)}>Complete</Btn>
                <Btn small ghost>Reassign</Btn>
              </div>
            </div></Card2>
          ))}
          {tasks.filter(t=>t.status==="Done").length>0&&<div style={{marginTop:8}}>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.07em"}}>Completed</div>
            {tasks.filter(t=>t.status==="Done").map(task=>(
              <Card2 key={task.id} style={{opacity:.5}}><div style={{padding:12,display:"flex",alignItems:"center",gap:10}}>
                <SDot status="Approved"/><span style={{fontSize:13,color:T.textSub}}>{task.type}</span><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.textMuted}}>{task.asset}</span>
              </div></Card2>
            ))}
          </div>}
        </div>
      </>}
      {tab==="assets"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
          <Metric label="Orphaned Assets" value="124" color={T.rose}/>
          <Metric label="No Quality Rules" value="38" color={T.amber}/>
          <Metric label="No Documentation" value="56" color={T.blue}/>
        </div>
        <Card2 style={{overflow:"hidden",padding:0}}>
          <DataTable cols={[
            {key:"name",label:"Asset",render:v=><span style={{fontFamily:"'Geist Mono',monospace",color:T.text,fontSize:12}}>{v}</span>},
            {key:"type",label:"Type",render:v=><TypeBadge type={v}/>},
            {key:"domain",label:"Domain",render:v=><span style={{fontSize:12,color:T.textSub}}>{v}</span>},
            {key:"quality",label:"Quality",render:v=><QScore score={v}/>},
            {key:"cert",label:"Issue",render:v=><Badge color={v==="Uncertified"?T.amber:v==="Deprecated"?T.rose:T.textMuted}>{v==="Uncertified"?"No Owner":v==="Deprecated"?"Deprecated":v}</Badge>},
            {key:"id",label:"",render:()=><Btn small onClick={()=>onToast("Assignment dialog opened","success")}>Assign Steward</Btn>},
          ]} rows={ASSETS.filter(a=>a.cert==="Uncertified"||a.cert==="Deprecated"||a.cert==="In Review")}/>
        </Card2>
      </>}
      {tab==="stewards"&&<Card2 style={{overflow:"hidden",padding:0}}>
        <DataTable cols={[
          {key:"name",label:"Steward",render:(v,r)=><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:8,background:T.bgHover,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.accent}}>{v[0].toUpperCase()}</div><div><div style={{fontSize:12,fontWeight:500,color:T.text}}>{v}</div><div style={{fontSize:11,color:T.textMuted}}>{r.email}</div></div></div>},
          {key:"domain",label:"Domain",render:v=><span style={{fontSize:12,color:T.textSub}}>{v}</span>},
          {key:"assets",label:"Owned Assets",render:v=><span style={{fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.blue}}>{v}</span>},
          {key:"role",label:"Role",render:v=><Badge color={T.violet} bg={T.violetDim}>{v}</Badge>},
          {key:"name",label:"Open Tasks",render:(v)=><span style={{fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.amber}}>{Math.floor(Math.random()*6)}</span>},
        ]} rows={TEAMS_DATA}/>
      </Card2>}
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// GLOSSARY
// ─────────────────────────────────────────────
const GlossaryView = ({onToast})=>{
  const [q,setQ]=useState("");
  const [selected,setSelected]=useState(null);
  const [newModal,setNewModal]=useState(false);
  const [form,setForm]=useState({term:"",abbr:"",domain:"Commerce",definition:"",owner:"maya.chen"});
  const filtered=GLOSSARY_TERMS.filter(t=>t.term.toLowerCase().includes(q.toLowerCase())||t.domain.toLowerCase().includes(q.toLowerCase()));

  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Business Glossary"}]} actions={<Btn icon={Ic.plus(12)} variant="primary" onClick={()=>setNewModal(true)}>New Term</Btn>}/>
    <div style={{flex:1,display:"grid",gridTemplateColumns:selected?"2fr 1fr":"1fr",overflow:"hidden"}}>
      <div style={{overflowY:"auto",padding:28,borderRight:selected?`1px solid ${T.border}`:"none"}}>
        <div style={{marginBottom:16}}><Input2 placeholder="Search terms…" value={q} onChange={e=>setQ(e.target.value)} icon={Ic.search(13)}/></div>
        <Card2 style={{overflow:"hidden",padding:0}}>
          <DataTable cols={[
            {key:"term",label:"Term",render:(v,r)=><div><div style={{fontSize:13,fontWeight:500,color:T.text}}>{v}</div>{r.abbr!=="—"&&<div style={{fontSize:11,color:T.textMuted,fontFamily:"'Geist Mono',monospace"}}>{r.abbr}</div>}</div>},
            {key:"domain",label:"Domain",render:v=><Badge>{v}</Badge>},
            {key:"definition",label:"Definition",render:v=><span style={{fontSize:12,color:T.textSub,maxWidth:260,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</span>},
            {key:"owner",label:"Owner",render:v=><span style={{fontSize:12,color:T.textMuted,fontFamily:"'Geist Mono',monospace"}}>{v}</span>},
            {key:"linked",label:"Assets",render:v=><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.blue}}>{v}</span>},
            {key:"status",label:"Status",render:v=><span style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><SDot status={v}/>{v}</span>},
          ]} rows={filtered} onRowClick={setSelected}/>
        </Card2>
      </div>
      {selected&&<div className="slideIn" style={{overflowY:"auto",padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div><div style={{fontSize:18,fontWeight:700,color:T.text}}>{selected.term}</div>{selected.abbr!=="—"&&<div style={{fontSize:13,fontFamily:"'Geist Mono',monospace",color:T.textMuted,marginTop:2}}>{selected.abbr}</div>}</div>
          <button onClick={()=>setSelected(null)} style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer"}}>{Ic.x(14)}</button>
        </div>
        <Card2 style={{marginBottom:12}}><div style={{padding:14}}>
          <div style={{fontSize:11,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Definition</div>
          <p style={{fontSize:13,color:T.textSub,lineHeight:1.8}}>{selected.definition}</p>
        </div></Card2>
        <Card2><div style={{padding:14}}>
          {[{l:"Domain",v:<Badge>{selected.domain}</Badge>},{l:"Owner",v:selected.owner},{l:"Status",v:<><SDot status={selected.status}/> {selected.status}</>},{l:"Linked Assets",v:<span style={{color:T.blue,fontFamily:"'Geist Mono',monospace"}}>{selected.linked}</span>}].map(m=>(
            <div key={m.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,marginBottom:10}}><span style={{color:T.textMuted}}>{m.l}</span><span style={{color:T.text,display:"flex",alignItems:"center",gap:4}}>{m.v}</span></div>
          ))}
        </div></Card2>
        <div style={{marginTop:14,display:"flex",gap:8}}>
          <Btn small icon={Ic.edit(11)}>Edit</Btn>
          <Btn small ghost>Link Asset</Btn>
        </div>
      </div>}
    </div>
    <Modal open={newModal} onClose={()=>setNewModal(false)} title="Add Glossary Term">
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Term</div><Input2 placeholder="e.g. Gross Margin" value={form.term} onChange={e=>setForm({...form,term:e.target.value})}/></div>
          <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Abbreviation (optional)</div><Input2 placeholder="e.g. GM" value={form.abbr} onChange={e=>setForm({...form,abbr:e.target.value})}/></div>
        </div>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Definition</div><Input2 multiline rows={3} placeholder="Clear business definition…" value={form.definition} onChange={e=>setForm({...form,definition:e.target.value})}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Domain</div>
            <select value={form.domain} onChange={e=>setForm({...form,domain:e.target.value})} style={{width:"100%",padding:"8px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:13,outline:"none"}}>
              {["Commerce","Finance","Product","ML","Marketing"].map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Owner</div>
            <select value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})} style={{width:"100%",padding:"8px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:13,outline:"none"}}>
              {TEAMS_DATA.map(t=><option key={t.name}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}><Btn onClick={()=>setNewModal(false)}>Cancel</Btn><Btn variant="primary" onClick={()=>{setNewModal(false);onToast("Term added","success");}}>Add Term</Btn></div>
      </div>
    </Modal>
  </div>;
};

// ─────────────────────────────────────────────
// DATA CONTRACTS
// ─────────────────────────────────────────────
const ContractsView = ({onToast})=>{
  const [selected,setSelected]=useState(null);
  if(selected) return <ContractDetail contract={selected} onBack={()=>setSelected(null)} onToast={onToast}/>;
  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Data Contracts"}]} actions={<Btn icon={Ic.plus(12)} variant="primary">New Contract</Btn>}/>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <Metric label="Active Contracts" value={String(CONTRACTS.filter(c=>c.status==="Active").length)} color={T.green}/>
        <Metric label="Avg SLA" value="99.7%" color={T.accent}/>
        <Metric label="Deprecated" value={String(CONTRACTS.filter(c=>c.status==="Deprecated").length)} color={T.rose}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {CONTRACTS.map(c=>(
          <Card2 key={c.id} style={{cursor:"pointer"}} onClick={()=>setSelected(c)}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.blue}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <div style={{padding:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:40,height:40,borderRadius:10,background:T.blueDim,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid rgba(125,211,252,.2)`}}>{Ic.contracts(18)}</div>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontSize:14,fontWeight:700,fontFamily:"'Geist Mono',monospace",color:T.text}}>{c.name}</span>
                    <Badge color={T.textMuted} bg={T.bgHover}>v{c.version}</Badge>
                    <SDot status={c.status}/><span style={{fontSize:12,color:T.textSub}}>{c.status}</span>
                  </div>
                  <div style={{fontSize:12,color:T.textMuted}}>Provider: <span style={{color:T.amber}}>{c.provider}</span> → Consumer: <span style={{color:T.violet}}>{c.consumer}</span></div>
                  <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{c.description}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:20}}>
                <div style={{textAlign:"right"}}><div style={{fontSize:11,color:T.textMuted,marginBottom:2}}>SLA</div><div style={{fontSize:16,fontWeight:700,color:T.accent,fontFamily:"'Geist Mono',monospace"}}>{c.sla}</div></div>
                {Ic.chevRight(12)}
              </div>
            </div>
          </Card2>
        ))}
      </div>
    </div>
  </div>;
};

const ContractDetail = ({contract,onBack,onToast})=>(
  <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Data Contracts",onClick:onBack},{label:contract.name}]} actions={<><Btn small icon={Ic.branches(12)}>New Version</Btn><Btn small ghost>Edit</Btn></>}/>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card2><div style={{padding:16}}>
            <SH title="Contract Definition"/>
            <p style={{fontSize:13,color:T.textSub,marginBottom:14,lineHeight:1.7}}>{contract.description}</p>
            <div style={{background:T.bgHover,borderRadius:8,padding:16,fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.textSub,lineHeight:1.9}}>
              <span style={{color:T.violet}}>contract</span> <span style={{color:T.accent}}>{contract.name}</span> {"{"}<br/>
              &nbsp;&nbsp;<span style={{color:T.violet}}>version</span>: <span style={{color:T.amber}}>"{contract.version}"</span><br/>
              &nbsp;&nbsp;<span style={{color:T.violet}}>provider</span>: <span style={{color:T.amber}}>"{contract.provider}"</span><br/>
              &nbsp;&nbsp;<span style={{color:T.violet}}>consumer</span>: <span style={{color:T.amber}}>"{contract.consumer}"</span><br/>
              &nbsp;&nbsp;<span style={{color:T.violet}}>sla</span>: {"{"} <span style={{color:T.blue}}>availability</span>: <span style={{color:T.amber}}>"{contract.sla}"</span>, <span style={{color:T.blue}}>freshness</span>: <span style={{color:T.amber}}>"2h"</span> {"}"}<br/>
              &nbsp;&nbsp;<span style={{color:T.violet}}>schema</span>: <span style={{color:T.amber}}>"{contract.schema}"</span><br/>
              &nbsp;&nbsp;<span style={{color:T.violet}}>owners</span>: [<span style={{color:T.blue}}>{contract.owners.map(o=>`"${o}"`).join(", ")}</span>]<br/>
              {"}"}
            </div>
          </div></Card2>
          <Card2><div style={{padding:16}}>
            <SH title="Schema Snapshot" action={<Badge color={T.accent} bg={T.accentDim}>v{contract.version}</Badge>}/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {["id: BIGINT NOT NULL","customer_id: BIGINT","amount: DECIMAL(12,2)","status: ENUM","created_at: TIMESTAMP"].map((f,i)=>(
                <div key={i} style={{padding:"7px 12px",background:T.bgHover,borderRadius:6,fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.textSub}}>{f}</div>
              ))}
            </div>
          </div></Card2>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card2><div style={{padding:14}}>
            <SH title="Contract Info"/>
            {[{l:"Status",v:<><SDot status={contract.status}/> {contract.status}</>},{l:"Version",v:contract.version},{l:"SLA",v:<span style={{color:T.accent,fontFamily:"'Geist Mono',monospace"}}>{contract.sla}</span>},{l:"Provider",v:<span style={{color:T.amber,fontFamily:"'Geist Mono',monospace"}}>{contract.provider}</span>},{l:"Consumer",v:<span style={{color:T.violet,fontFamily:"'Geist Mono',monospace"}}>{contract.consumer}</span>},{l:"Updated",v:contract.updated}].map(m=>(
              <div key={m.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,marginBottom:9}}><span style={{color:T.textMuted}}>{m.l}</span><span style={{color:T.text,display:"flex",alignItems:"center",gap:4}}>{m.v}</span></div>
            ))}
          </div></Card2>
          <Card2><div style={{padding:14}}>
            <SH title="Version History"/>
            {[{v:contract.version,date:"2d ago",status:"Current"},{v:"2.0.2",date:"2w ago",status:"Deprecated"},{v:"1.x",date:"3mo ago",status:"Deprecated"}].map((v,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<2?`1px solid ${T.border}`:"none"}}>
                <span style={{fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.text}}>v{v.v}</span>
                <span style={{fontSize:11,color:T.textMuted,flex:1}}>{v.date}</span>
                <Badge color={v.status==="Current"?T.accent:T.textMuted}>{v.status}</Badge>
              </div>
            ))}
          </div></Card2>
        </div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// OBSERVABILITY
// ─────────────────────────────────────────────
const ObsView = ({onToast})=>{
  const [tab,setTab]=useState("pipelines");
  const pipelines=[
    {name:"etl_orders_pipeline",status:"passing",latency:"1.2s",runs:144,failures:0,last:"2m ago",freshness:"1h 45m"},
    {name:"crm_sync",status:"passing",latency:"3.4s",runs:48,failures:0,last:"15m ago",freshness:"4h 12m"},
    {name:"kafka_events",status:"warning",latency:"8.1s",runs:720,failures:2,last:"1m ago",freshness:"12m"},
    {name:"ml_feature_store",status:"failing",latency:"—",runs:24,failures:5,last:"2h ago",freshness:"Stale"},
    {name:"dbt_transform",status:"passing",latency:"4.2m",runs:24,failures:0,last:"30m ago",freshness:"28m"},
  ];
  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Observability"}]} actions={<><Btn small ghost icon={Ic.refresh(12)}>Refresh</Btn><Btn small onClick={()=>onToast("Alert config opened","success")}>Configure Alerts</Btn></>}/>
    <div style={{padding:"0 28px",borderBottom:`1px solid ${T.border}`,flexShrink:0,paddingTop:18}}>
      <Tabs2 tabs={[{key:"pipelines",label:"Pipelines"},{key:"freshness",label:"Data Freshness"},{key:"alerts",label:"Alert Rules"}]} active={tab} onChange={setTab}/>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      {tab==="pipelines"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
          <Metric label="Total Pipelines" value={String(pipelines.length)} color={T.blue}/>
          <Metric label="Healthy" value={String(pipelines.filter(p=>p.status==="passing").length)} color={T.green}/>
          <Metric label="Warnings" value={String(pipelines.filter(p=>p.status==="warning").length)} color={T.amber}/>
          <Metric label="Failing" value={String(pipelines.filter(p=>p.status==="failing").length)} color={T.red}/>
        </div>
        <Card2 style={{overflow:"hidden",padding:0}}>
          <DataTable cols={[
            {key:"name",label:"Pipeline",render:v=><span style={{fontFamily:"'Geist Mono',monospace",color:T.text,fontSize:12}}>{v}</span>},
            {key:"status",label:"Status",render:v=><span style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><SDot status={v}/>{v}</span>},
            {key:"latency",label:"Avg Latency",render:v=><span style={{fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.textSub}}>{v}</span>},
            {key:"freshness",label:"Data Age",render:v=><span style={{fontFamily:"'Geist Mono',monospace",fontSize:12,color:v==="Stale"?T.red:T.textSub}}>{v}</span>},
            {key:"runs",label:"Runs/day",render:v=><span style={{fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.textMuted}}>{v}</span>},
            {key:"failures",label:"Failures",render:v=><span style={{color:v>0?T.red:T.green,fontFamily:"'Geist Mono',monospace",fontSize:12}}>{v}</span>},
            {key:"last",label:"Last Run",render:v=><span style={{fontSize:11,color:T.textMuted}}>{v}</span>},
            {key:"name",label:"",render:()=><Btn small ghost>Logs</Btn>},
          ]} rows={pipelines}/>
        </Card2>
      </>}
      {tab==="freshness"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        <Card2><div style={{padding:16}}>
          <SH title="Freshness Status — All Assets"/>
          {ASSETS.slice(0,7).map((a,i)=>{
            const fresh=Math.random()>.3;
            const age=fresh?`${Math.floor(Math.random()*4+1)}h ago`:"Stale";
            return <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:i<6?`1px solid ${T.border}`:"none"}}>
              <SDot status={fresh?"passing":"failing"}/>
              <span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.text,flex:1,width:160}}>{a.name}</span>
              <TypeBadge type={a.type}/>
              <span style={{fontSize:12,color:T.textMuted}}>SLA: {a.slaFreshness}</span>
              <span style={{fontSize:12,color:fresh?T.green:T.red,fontFamily:"'Geist Mono',monospace",minWidth:80,textAlign:"right"}}>{age}</span>
            </div>;
          })}
        </div></Card2>
      </div>}
      {tab==="alerts"&&<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
          <Btn icon={Ic.plus(12)} onClick={()=>onToast("New alert rule dialog","success")}>Add Alert Rule</Btn>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            {rule:"Pipeline failure rate > 5%",channel:"Slack #data-alerts",status:"Active",severity:"Critical"},
            {rule:"Data freshness SLA breached",channel:"Email: data-team@solix.com",status:"Active",severity:"High"},
            {rule:"Quality score drops > 10pt in 1h",channel:"PagerDuty",status:"Active",severity:"Critical"},
            {rule:"Schema drift detected",channel:"Slack #schema-changes",status:"Active",severity:"Med"},
            {rule:"Access denied spike > 10/hr",channel:"Email: security@solix.com",status:"Paused",severity:"High"},
          ].map((a,i)=>(
            <Card2 key={i}><div style={{padding:14,display:"flex",alignItems:"center",gap:14}}>
              <SDot status={a.status==="Active"?"Active":"Pending"}/>
              <div style={{flex:1}}><div style={{fontSize:13,color:T.text,marginBottom:2}}>{a.rule}</div><div style={{fontSize:12,color:T.textMuted}}>→ {a.channel}</div></div>
              <Badge color={a.severity==="Critical"?T.red:a.severity==="High"?T.amber:T.textSub}>{a.severity}</Badge>
              <Btn small ghost>{a.status==="Active"?"Pause":"Resume"}</Btn>
              <Btn small variant="danger">Delete</Btn>
            </div></Card2>
          ))}
        </div>
      </>}
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// USAGE ANALYTICS
// ─────────────────────────────────────────────
const AnalyticsView = ()=>{
  const [tab,setTab]=useState("overview");
  const bars=Array.from({length:30},(_,i)=>40+Math.sin(i*0.4)*15+Math.random()*20+(i/30)*15);
  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Usage Analytics"}]} actions={<><Btn small ghost>Export CSV</Btn></>}/>
    <div style={{padding:"0 28px",borderBottom:`1px solid ${T.border}`,flexShrink:0,paddingTop:18}}>
      <Tabs2 tabs={[{key:"overview",label:"Overview"},{key:"assets",label:"Top Assets"},{key:"users",label:"User Activity"},{key:"queries",label:"Query Analysis"}]} active={tab} onChange={setTab}/>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      {tab==="overview"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
          <Metric label="Queries (30d)" value="84.2K" delta="+12%" color={T.blue}/>
          <Metric label="Unique Users" value="143" delta="+8" color={T.accent}/>
          <Metric label="Avg Query Time" value="1.4s" delta="-0.2s" color={T.amber}/>
          <Metric label="Data Scanned" value="2.1TB" delta="+340GB" color={T.violet}/>
        </div>
        <Card2 style={{marginBottom:16}}><div style={{padding:16}}>
          <SH title="Query Volume — 30 Days"/>
          <div style={{height:120,display:"flex",alignItems:"flex-end",gap:2}}>
            {bars.map((v,i)=><div key={i} style={{flex:1,background:T.blue,borderRadius:"2px 2px 0 0",opacity:.3+(i/bars.length)*.7,height:`${(v/100)*120}px`}}/>)}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:T.textMuted}}>
            {["30d","25d","20d","15d","10d","5d","Today"].map(l=><span key={l}>{l}</span>)}
          </div>
        </div></Card2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card2><div style={{padding:16}}>
            <SH title="Top Assets (Queries)"/>
            {ASSETS.slice(0,5).map((a,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<4?`1px solid ${T.border}`:"none"}}>
                <span style={{fontSize:11,color:T.textMuted,width:16,textAlign:"center"}}>{i+1}</span>
                <TypeBadge type={a.type}/><span style={{flex:1,fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.text}}>{a.name}</span>
                <span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.blue}}>{((5-i)*180+Math.floor(Math.random()*50)).toLocaleString()}</span>
              </div>
            ))}
          </div></Card2>
          <Card2><div style={{padding:16}}>
            <SH title="Query Volume by Domain"/>
            {[{d:"Commerce",v:72},{d:"Finance",v:18},{d:"Product",v:58},{d:"ML",v:12}].map(d=>(
              <div key={d.d} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:T.textSub}}>{d.d}</span><span style={{color:T.textMuted,fontFamily:"'Geist Mono',monospace"}}>{d.v}%</span></div>
                <div style={{height:4,background:T.bgHover,borderRadius:2}}><div style={{height:"100%",width:`${d.v}%`,background:T.blue,borderRadius:2}}/></div>
              </div>
            ))}
          </div></Card2>
        </div>
      </>}
      {tab==="assets"&&<Card2 style={{overflow:"hidden",padding:0}}>
        <DataTable cols={[
          {key:"name",label:"Asset",render:v=><span style={{fontFamily:"'Geist Mono',monospace",color:T.blue,fontSize:12}}>{v}</span>},
          {key:"type",label:"Type",render:v=><TypeBadge type={v}/>},
          {key:"domain",label:"Domain",render:v=><span style={{fontSize:12,color:T.textSub}}>{v}</span>},
          {key:"quality",label:"Quality",render:v=><QScore score={v}/>},
          {key:"usage",label:"Usage Tier",render:v=><Badge color={v==="High"?T.accent:v==="Med"?T.amber:T.textMuted}>{v}</Badge>},
          {key:"id",label:"Queries/day",render:(v)=><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.blue}}>{(v*120).toLocaleString()}</span>},
        ]} rows={ASSETS.sort((a,b)=>b.quality-a.quality)}/>
      </Card2>}
      {tab==="users"&&<Card2 style={{overflow:"hidden",padding:0}}>
        <DataTable cols={[
          {key:"name",label:"User",render:(v,r)=><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:26,height:26,borderRadius:7,background:T.bgHover,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.accent}}>{v[0].toUpperCase()}</div><div><div style={{fontSize:12,color:T.text}}>{v}</div><div style={{fontSize:11,color:T.textMuted}}>{r.role}</div></div></div>},
          {key:"domain",label:"Domain",render:v=><span style={{fontSize:12,color:T.textSub}}>{v}</span>},
          {key:"assets",label:"Assets Accessed",render:v=><span style={{fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.blue}}>{Math.floor(v*.3)}</span>},
          {key:"assets",label:"Queries (30d)",render:v=><span style={{fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.accent}}>{(v*8).toLocaleString()}</span>},
          {key:"joined",label:"Last Active",render:()=><span style={{fontSize:11,color:T.textMuted}}>{Math.floor(Math.random()*24)+1}h ago</span>},
        ]} rows={TEAMS_DATA}/>
      </Card2>}
      {tab==="queries"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        <Card2><div style={{padding:16}}>
          <SH title="Recent Queries"/>
          {[{query:"SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '7 days'",user:"john.doe",time:"2m ago",duration:"0.8s"},{query:"SELECT customer_id, SUM(amount) FROM orders GROUP BY 1",user:"analytics_team",time:"5m ago",duration:"2.1s"},{query:"SELECT COUNT(*) FROM customers WHERE email IS NULL",user:"dev.patel",time:"12m ago",duration:"0.3s"}].map((q,i)=>(
            <div key={i} style={{padding:"10px 0",borderBottom:i<2?`1px solid ${T.border}`:"none"}}>
              <div style={{fontFamily:"'Geist Mono',monospace",fontSize:11,color:T.blue,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.query}</div>
              <div style={{display:"flex",gap:10,fontSize:11,color:T.textMuted}}><span>{q.user}</span><span>·</span><span>{q.time}</span><span>·</span><span style={{color:T.accent}}>{q.duration}</span></div>
            </div>
          ))}
        </div></Card2>
      </div>}
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// DOMAINS
// ─────────────────────────────────────────────
const DomainsView = ()=>{
  const domains=[
    {name:"Commerce",color:T.accent,assets:342,steward:"maya.chen",quality:94,icon:"🛒",description:"Order, product, and customer transactional data."},
    {name:"Finance",color:T.amber,assets:156,steward:"sarah.kim",quality:91,icon:"💰",description:"Revenue, P&L, and financial reporting data."},
    {name:"Product",color:T.blue,assets:289,steward:"alex.wu",quality:72,icon:"📱",description:"User behavior, events, and product analytics."},
    {name:"ML",color:T.violet,assets:94,steward:"priya.nair",quality:88,icon:"🤖",description:"Model artifacts, features, and experiment tracking."},
    {name:"Marketing",color:T.rose,assets:67,steward:"lisa.ray",quality:79,icon:"📣",description:"Attribution, campaigns, and acquisition analytics."},
  ];
  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Data Domains"}]} actions={<Btn icon={Ic.plus(12)}>New Domain</Btn>}/>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
        {domains.map(d=>(
          <Card2 key={d.name} style={{cursor:"pointer",transition:"border-color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=d.color}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <div style={{padding:18}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <span style={{fontSize:28}}>{d.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:2}}>{d.name}</div>
                  <div style={{fontSize:12,color:T.textMuted}}>Steward: {d.steward}</div>
                </div>
                <QScore score={d.quality}/>
              </div>
              <p style={{fontSize:12,color:T.textSub,marginBottom:14,lineHeight:1.6}}>{d.description}</p>
              <div style={{display:"flex",gap:16,alignItems:"center"}}>
                <div><div style={{fontSize:11,color:T.textMuted,marginBottom:2}}>Assets</div><div style={{fontSize:20,fontWeight:700,color:d.color,fontFamily:"'Geist Mono',monospace"}}>{d.assets}</div></div>
                <div style={{flex:1}}>
                  <div style={{height:4,background:T.bgHover,borderRadius:2}}><div style={{height:"100%",width:`${d.quality}%`,background:d.color,borderRadius:2}}/></div>
                  <div style={{fontSize:10,color:T.textMuted,marginTop:3}}>Quality Score</div>
                </div>
              </div>
            </div>
          </Card2>
        ))}
      </div>
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────
const SearchView = ({onAsset})=>{
  const [q,setQ]=useState("");
  const aResults=q.length>1?ASSETS.filter(a=>a.name.toLowerCase().includes(q.toLowerCase())||a.domain.toLowerCase().includes(q.toLowerCase())||a.tags.some(t=>t.toLowerCase().includes(q.toLowerCase()))):[];
  const gResults=q.length>1?GLOSSARY_TERMS.filter(t=>t.term.toLowerCase().includes(q.toLowerCase())):[];
  return <div className="fadeUp" style={{height:"100%",overflowY:"auto"}}>
    <Topbar breadcrumb={[{label:"Search & Discovery"}]}/>
    <div style={{padding:28,maxWidth:860,margin:"0 auto"}}>
      <div style={{marginBottom:28}}>
        <Input2 placeholder="Search assets, columns, owners, tags, glossary…" value={q} onChange={e=>setQ(e.target.value)} icon={Ic.search(16)} style={{fontSize:15,padding:"11px 14px 11px 38px"}}/>
        {q.length>0&&<div style={{fontSize:11,color:T.textMuted,marginTop:8}}>{aResults.length+gResults.length} results for "{q}"</div>}
      </div>
      {q.length===0&&<>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Recent Searches</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
          {["orders","PII","Commerce","CLV","customers","ml_churn"].map(s=><button key={s} onClick={()=>setQ(s)} style={{padding:"5px 14px",borderRadius:99,background:T.bgElevated,border:`1px solid ${T.border}`,color:T.textSub,fontSize:12,cursor:"pointer"}}>{s}</button>)}
        </div>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Browse by Type</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:24}}>
          {["Table","Dashboard","Pipeline","ML Model","Database","Data Product"].map(t=>(
            <button key={t} onClick={()=>setQ(t.toLowerCase())} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 14px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:9,cursor:"pointer",color:T.textSub,fontSize:12,textAlign:"left",transition:"all .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.blue;e.currentTarget.style.color=T.text;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.textSub;}}>
              <TypeBadge type={t}/>{t}
            </button>
          ))}
        </div>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Browse by Domain</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["Commerce","Finance","Product","ML","Marketing"].map(d=>(
            <button key={d} onClick={()=>setQ(d.toLowerCase())} style={{padding:"6px 14px",borderRadius:99,background:T.bgElevated,border:`1px solid ${T.border}`,color:T.textSub,fontSize:12,cursor:"pointer",transition:"all .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.color=T.text;}}
              onMouseLeave={e=>{e.currentTarget.style.color=T.textSub;}}>{d}</button>
          ))}
        </div>
      </>}
      {aResults.length>0&&<div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Assets ({aResults.length})</div>
        <Card2 style={{overflow:"hidden",padding:0}}>
          {aResults.map((a,i)=>(
            <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<aResults.length-1?`1px solid ${T.border}`:"none",cursor:"pointer",transition:"background .1s"}}
              onClick={()=>onAsset(a)}
              onMouseEnter={e=>e.currentTarget.style.background=T.bgHover}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <TypeBadge type={a.type}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontFamily:"'Geist Mono',monospace",color:T.text}}>{a.name}</div><div style={{fontSize:11,color:T.textMuted}}>{a.db} · {a.domain}</div></div>
              <CertBadge cert={a.cert}/><QScore score={a.quality}/>{Ic.chevRight(12)}
            </div>
          ))}
        </Card2>
      </div>}
      {gResults.length>0&&<div>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Glossary ({gResults.length})</div>
        <Card2 style={{overflow:"hidden",padding:0}}>
          {gResults.map((t,i)=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<gResults.length-1?`1px solid ${T.border}`:"none",cursor:"pointer",transition:"background .1s"}}
              onMouseEnter={e=>e.currentTarget.style.background=T.bgHover}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span style={{fontSize:18}}>📖</span>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:T.text}}>{t.term}</div><div style={{fontSize:11,color:T.textMuted,lineHeight:1.6}}>{t.definition.slice(0,80)}…</div></div>
              <Badge color={t.status==="Approved"?T.green:T.amber}>{t.status}</Badge>
            </div>
          ))}
        </Card2>
      </div>}
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// TEAMS
// ─────────────────────────────────────────────
const TeamsView = ({onToast})=>{
  const [inviteModal,setInviteModal]=useState(false);
  const [form,setForm]=useState({email:"",role:"Data Analyst"});
  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Teams"}]} actions={<Btn icon={Ic.plus(12)} variant="primary" onClick={()=>setInviteModal(true)}>Invite Member</Btn>}/>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <Metric label="Total Members" value={String(TEAMS_DATA.length)} color={T.accent}/>
        <Metric label="Active" value={String(TEAMS_DATA.filter(t=>t.status==="Active").length)} color={T.green}/>
        <Metric label="Domains" value="5" color={T.blue}/>
      </div>
      <Card2 style={{overflow:"hidden",padding:0}}>
        <DataTable cols={[
          {key:"name",label:"User",render:(v,r)=><div style={{display:"flex",alignItems:"center",gap:9}}><div style={{width:30,height:30,borderRadius:8,background:T.bgHover,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:T.accent}}>{v[0].toUpperCase()}</div><div><div style={{fontSize:12,fontWeight:500,color:T.text}}>{v}</div><div style={{fontSize:11,color:T.textMuted}}>{r.email}</div></div></div>},
          {key:"role",label:"Role",render:v=><Badge color={T.violet} bg={T.violetDim}>{v}</Badge>},
          {key:"domain",label:"Domain",render:v=><span style={{fontSize:12,color:T.textSub}}>{v}</span>},
          {key:"assets",label:"Owned Assets",render:v=><span style={{fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.blue}}>{v}</span>},
          {key:"joined",label:"Joined",render:v=><span style={{fontSize:11,color:T.textMuted}}>{v}</span>},
          {key:"status",label:"Status",render:v=><span style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><SDot status={v}/>{v}</span>},
          {key:"name",label:"",render:()=><div style={{display:"flex",gap:5}}><Btn small ghost>Edit</Btn><Btn small variant="danger">Remove</Btn></div>},
        ]} rows={TEAMS_DATA}/>
      </Card2>
    </div>
    <Modal open={inviteModal} onClose={()=>setInviteModal(false)} title="Invite Team Member">
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Email Address</div><Input2 placeholder="user@solix.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
        <div><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>Role</div>
          <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={{width:"100%",padding:"8px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:13,outline:"none"}}>
            {["Data Engineer","Data Analyst","Data Steward","Compliance Officer","ML Engineer","Business User"].map(r=><option key={r}>{r}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}><Btn onClick={()=>setInviteModal(false)}>Cancel</Btn><Btn variant="primary" onClick={()=>{setInviteModal(false);onToast("Invitation sent","success");}}>Send Invite</Btn></div>
      </div>
    </Modal>
  </div>;
};

// ─────────────────────────────────────────────
// INTEGRATIONS
// ─────────────────────────────────────────────
const IntegrationsView = ({onToast})=>{
  const ints=[
    {name:"Snowflake",cat:"Data Warehouse",status:"Connected",assets:1842,icon:"❄️",desc:"Main analytics warehouse"},
    {name:"dbt",cat:"Transformation",status:"Connected",assets:234,icon:"🔄",desc:"Data transformation layer"},
    {name:"Fivetran",cat:"Pipelines",status:"Connected",assets:48,icon:"🔌",desc:"ELT pipeline automation"},
    {name:"Looker",cat:"BI / Dashboards",status:"Connected",assets:312,icon:"📊",desc:"Business intelligence layer"},
    {name:"Airflow",cat:"Orchestration",status:"Connected",assets:89,icon:"🌬️",desc:"Workflow orchestration"},
    {name:"Kafka",cat:"Streaming",status:"Warning",assets:56,icon:"⚡",desc:"Real-time event streaming"},
    {name:"Tableau",cat:"BI / Dashboards",status:"Connected",assets:178,icon:"📈",desc:"Data visualization"},
    {name:"MLflow",cat:"ML Platform",status:"Connected",assets:34,icon:"🤖",desc:"ML experiment tracking"},
    {name:"GitHub",cat:"Version Control",status:"Not Connected",assets:0,icon:"🐙",desc:"Code and schema versioning"},
    {name:"Monte Carlo",cat:"Observability",status:"Not Connected",assets:0,icon:"🎰",desc:"Data reliability platform"},
    {name:"OpenMetadata",cat:"Catalog",status:"Not Connected",assets:0,icon:"🗃️",desc:"Open metadata standard"},
    {name:"Great Expectations",cat:"Quality",status:"Connected",assets:120,icon:"✅",desc:"Data quality testing"},
  ];
  const statusColor={Connected:T.green,Warning:T.amber,"Not Connected":T.textMuted};
  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Integrations"}]} actions={<Btn icon={Ic.plus(12)}>Add Integration</Btn>}/>
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <Metric label="Connected" value={String(ints.filter(i=>i.status==="Connected").length)} color={T.green}/>
        <Metric label="Warnings" value={String(ints.filter(i=>i.status==="Warning").length)} color={T.amber}/>
        <Metric label="Available" value={String(ints.filter(i=>i.status==="Not Connected").length)} color={T.textSub}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {ints.map(int=>(
          <Card2 key={int.name} style={{cursor:"pointer",transition:"border-color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=int.status==="Connected"?T.accent:T.borderLight}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <div style={{padding:14}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:26}}>{int.icon}</span>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{int.name}</div><div style={{fontSize:11,color:T.textMuted}}>{int.cat}</div></div>
                <SDot status={int.status}/>
              </div>
              <p style={{fontSize:11,color:T.textMuted,marginBottom:10,lineHeight:1.5}}>{int.desc}</p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:statusColor[int.status]}}>{int.status==="Connected"?`${int.assets} assets`:int.status}</span>
                <Btn small ghost onClick={()=>onToast(`${int.name} config opened`,"success")}>{int.status==="Not Connected"?"Connect":"Configure"}</Btn>
              </div>
            </div>
          </Card2>
        ))}
      </div>
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// PROFILE VIEW (full page)
// ─────────────────────────────────────────────
const ProfileView = ({onToast}) => {
  const [name, setName] = useState("Maya Chen");
  const [bio, setBio] = useState("Senior Data Steward managing Commerce and Marketing domains. Focused on data quality and governance compliance.");
  const [saved, setSaved] = useState(false);
  const [notifsOn, setNotifsOn] = useState([true,true,true,false]);
  const save = () => { setSaved(true); onToast("Profile updated","success"); setTimeout(()=>setSaved(false),2000); };

  const stats = [
    {label:"Assets Owned",value:"47",color:T.accent},
    {label:"Certified",value:"38",color:T.blue},
    {label:"Open Tasks",value:"5",color:T.amber},
    {label:"Policies Applied",value:"12",color:T.violet},
  ];
  const activity = [
    {action:"Certified 'orders' dataset",time:"2h ago",icon:"✅",nav:"certifications"},
    {action:"Updated PII Masking policy",time:"Yesterday",icon:"🛡️",nav:"policies"},
    {action:"Resolved quality incident #42",time:"2d ago",icon:"⭐",nav:"quality"},
    {action:"Added glossary term 'GMV'",time:"3d ago",icon:"📖",nav:"glossary"},
    {action:"Approved access for sarah.kim",time:"4d ago",icon:"🔑",nav:"access"},
    {action:"Schema drift alert acknowledged",time:"5d ago",icon:"🔀",nav:"observability"},
  ];
  const notifLabels = ["Email on policy violations","Email on quality failures","In-app access requests","Weekly digest"];

  return <div className="fadeUp" style={{height:"100%",overflowY:"auto"}}>
    <Topbar breadcrumb={[{label:"My Profile"}]}/>
    <div style={{padding:28,maxWidth:960}}>
      {/* Profile header card */}
      <Card2 style={{marginBottom:20}}>
        <div style={{padding:24,background:`linear-gradient(135deg,${T.violetDim} 0%,transparent 60%)`,borderRadius:10}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:20,marginBottom:20}}>
            <div style={{width:72,height:72,borderRadius:18,background:`linear-gradient(135deg,${T.violet},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"#fff",flexShrink:0,border:`3px solid ${T.border}`}}>MC</div>
            <div style={{flex:1}}>
              <div style={{fontSize:20,fontWeight:700,color:T.text,marginBottom:3}}>Maya Chen</div>
              <div style={{fontSize:13,color:T.textMuted,marginBottom:8}}>maya@jnj.com · Johnson &amp; Johnson</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <span style={{padding:"3px 10px",background:T.accentDim,border:"1px solid rgba(110,231,183,0.2)",borderRadius:99,fontSize:11,color:T.accent,fontWeight:600}}>● Data Steward</span>
                <span style={{padding:"3px 10px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:99,fontSize:11,color:T.textSub}}>Commerce Domain</span>
                <span style={{padding:"3px 10px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:99,fontSize:11,color:T.textSub}}>Marketing Domain</span>
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {stats.map(s=>(
              <div key={s.label} style={{padding:"12px 14px",background:"rgba(0,0,0,.2)",borderRadius:9,border:`1px solid ${T.border}`}}>
                <div style={{fontSize:22,fontWeight:700,color:s.color,fontFamily:"'Geist Mono',monospace"}}>{s.value}</div>
                <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Card2>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {/* Edit profile */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card2>
            <div style={{padding:20}}>
              <SH title="Edit Profile" style={{marginBottom:16}}/>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div>
                  <label style={{fontSize:11,color:T.textMuted,fontWeight:500,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Display Name</label>
                  <input value={name} onChange={e=>setName(e.target.value)} style={{width:"100%",padding:"9px 11px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:13,outline:"none"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,color:T.textMuted,fontWeight:500,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Email</label>
                  <input value="maya@jnj.com" readOnly style={{width:"100%",padding:"9px 11px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.textMuted,fontSize:13,outline:"none",cursor:"not-allowed"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,color:T.textMuted,fontWeight:500,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Bio</label>
                  <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} style={{width:"100%",padding:"9px 11px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:"none",resize:"none",lineHeight:1.6}}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <label style={{fontSize:11,color:T.textMuted,fontWeight:500,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Role</label>
                    <input value="Data Steward" readOnly style={{width:"100%",padding:"9px 11px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.textMuted,fontSize:12,outline:"none",cursor:"not-allowed"}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:T.textMuted,fontWeight:500,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Member Since</label>
                    <input value="Jan 15, 2023" readOnly style={{width:"100%",padding:"9px 11px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:7,color:T.textMuted,fontSize:12,outline:"none",cursor:"not-allowed"}}/>
                  </div>
                </div>
                <button onClick={save} style={{padding:"10px",borderRadius:8,background:saved?T.accentDim:`linear-gradient(135deg,${T.violet},${T.blue})`,border:`1px solid ${saved?T.accent:"transparent"}`,color:saved?T.accent:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .2s",marginTop:4}}>
                  {saved?"✓ Changes Saved":"Save Changes"}
                </button>
              </div>
            </div>
          </Card2>
          {/* Notification prefs */}
          <Card2>
            <div style={{padding:20}}>
              <SH title="Notification Preferences" style={{marginBottom:14}}/>
              {notifLabels.map((label,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<notifLabels.length-1?`1px solid ${T.border}`:"none"}}>
                  <span style={{fontSize:13,color:T.text}}>{label}</span>
                  <button onClick={()=>setNotifsOn(v=>{const n=[...v];n[i]=!n[i];return n;})} style={{width:40,height:22,borderRadius:11,background:notifsOn[i]?T.accent:T.bgActive,border:"none",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
                    <span style={{position:"absolute",top:3,left:notifsOn[i]?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .18s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/>
                  </button>
                </div>
              ))}
            </div>
          </Card2>
        </div>

        {/* Recent activity */}
        <Card2>
          <div style={{padding:20,height:"100%",display:"flex",flexDirection:"column"}}>
            <SH title="Recent Activity" style={{marginBottom:16}}/>
            <div style={{flex:1}}>
              {activity.map((a,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"11px 0",borderBottom:i<activity.length-1?`1px solid ${T.border}`:"none"}}>
                  <span style={{fontSize:18,lineHeight:1,marginTop:1,flexShrink:0}}>{a.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:T.text,fontWeight:500,marginBottom:2}}>{a.action}</div>
                    <div style={{fontSize:11,color:T.textMuted}}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card2>
      </div>
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────
const SettingsView = ({onToast})=>{
  const {isDark,toggleTheme:onThemeToggle} = useTheme();
  const [tab,setTab]=useState("general");
  const [orgName,setOrgName]=useState("Solix Technologies");
  const [apiKeys,setApiKeys]=useState([{name:"Production",key:"solix_prod_••••••••••••••••",created:"2024-01-15",last:"2h ago"},{name:"Staging",key:"solix_stg_••••••••••••••••",created:"2024-03-01",last:"1d ago"}]);

  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    <Topbar breadcrumb={[{label:"Settings"}]}/>
    <div style={{flex:1,display:"grid",gridTemplateColumns:"200px 1fr",overflow:"hidden"}}>
      <div style={{borderRight:`1px solid ${T.border}`,padding:"16px 0",background:T.bgSurface}}>
        {[{key:"general",label:"General"},{key:"appearance",label:"Appearance"},{key:"security",label:"Security"},{key:"api",label:"API Keys"},{key:"notifications",label:"Notifications"},{key:"teams",label:"Teams"},{key:"audit",label:"Audit"},{key:"billing",label:"Billing"}].map(s=>(
          <button key={s.key} onClick={()=>setTab(s.key)} style={{width:"100%",padding:"8px 20px",textAlign:"left",background:tab===s.key?T.bgHover:"transparent",border:"none",borderLeft:tab===s.key?`2px solid ${T.accent}`:"2px solid transparent",color:tab===s.key?T.text:T.textSub,fontSize:12.5,fontWeight:tab===s.key?500:400,cursor:"pointer",transition:"all .1s"}}>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{overflowY:"auto",padding:28,background:T.bg}}>
        <div style={{maxWidth:560}}>
          {tab==="general"&&<>
            <h2 style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:20}}>General Settings</h2>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[{l:"Organization Name",v:orgName,set:setOrgName},{l:"Default Domain",v:"Commerce"},{l:"Timezone",v:"UTC-8 (Pacific Time)"},{l:"Default Language",v:"English"},{l:"Date Format",v:"MM/DD/YYYY"}].map(f=>(
                <div key={f.l}><div style={{fontSize:12,color:T.textSub,marginBottom:6}}>{f.l}</div><Input2 value={f.v} onChange={f.set?e=>f.set(e.target.value):undefined} placeholder={f.v}/></div>
              ))}
              <div style={{marginTop:8,display:"flex",gap:8}}>
                <Btn variant="primary" onClick={()=>onToast("Settings saved","success")}>Save Changes</Btn>
                <Btn ghost>Discard</Btn>
              </div>
            </div>
          </>}

          {tab==="appearance"&&<>
            <h2 style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:6}}>Appearance</h2>
            <p style={{fontSize:12,color:T.textMuted,marginBottom:24}}>Choose how Solix Data Governance looks to you.</p>

            {/* Theme picker */}
            <div style={{fontSize:12,fontWeight:600,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>Color Theme</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:28}}>
              {/* Dark card */}
              <button onClick={()=>onThemeToggle(true)} style={{padding:0,border:`2px solid ${isDark?T.accent:T.border}`,borderRadius:12,cursor:"pointer",overflow:"hidden",background:"transparent",transition:"border-color .2s",textAlign:"left"}}>
                <div style={{background:"#09090b",padding:14,borderRadius:"10px 10px 0 0"}}>
                  {/* Mini sidebar preview */}
                  <div style={{display:"flex",gap:6,height:60}}>
                    <div style={{width:32,background:"#111115",borderRadius:6,padding:"4px 0",display:"flex",flexDirection:"column",gap:3,alignItems:"center"}}>
                      {[T.accent,"#27272e","#27272e","#27272e"].map((c,i)=><div key={i} style={{width:16,height:3,borderRadius:2,background:c,opacity:i?0.4:1}}/>)}
                    </div>
                    <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
                      <div style={{display:"flex",gap:4}}>
                        {["#18181d","#18181d","#18181d","#18181d"].map((c,i)=><div key={i} style={{flex:1,height:12,borderRadius:3,background:c}}/>)}
                      </div>
                      <div style={{height:24,background:"#111115",borderRadius:4,border:"1px solid #27272e"}}/>
                      <div style={{display:"flex",gap:4}}>
                        <div style={{flex:2,height:20,background:"#111115",borderRadius:4,border:"1px solid #27272e"}}/>
                        <div style={{flex:1,height:20,background:"#059669",borderRadius:4,opacity:.8}}/>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{padding:"10px 14px",background:"#111115",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"#f4f4f5",marginBottom:1}}>Dark</div>
                    <div style={{fontSize:11,color:"#52525b"}}>Easy on the eyes at night</div>
                  </div>
                  {isDark&&<div style={{width:18,height:18,borderRadius:"50%",background:T.accent,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="#052e16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                  </div>}
                </div>
              </button>

              {/* Light card */}
              <button onClick={()=>onThemeToggle(false)} style={{padding:0,border:`2px solid ${!isDark?T.accent:T.border}`,borderRadius:12,cursor:"pointer",overflow:"hidden",background:"transparent",transition:"border-color .2s",textAlign:"left"}}>
                <div style={{background:"#f8f8fa",padding:14,borderRadius:"10px 10px 0 0"}}>
                  <div style={{display:"flex",gap:6,height:60}}>
                    <div style={{width:32,background:"#ffffff",borderRadius:6,padding:"4px 0",display:"flex",flexDirection:"column",gap:3,alignItems:"center",border:"1px solid #e2e2ea"}}>
                      {["#059669","#e2e2ea","#e2e2ea","#e2e2ea"].map((c,i)=><div key={i} style={{width:16,height:3,borderRadius:2,background:c,opacity:i?0.5:1}}/>)}
                    </div>
                    <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
                      <div style={{display:"flex",gap:4}}>
                        {["#f1f1f5","#f1f1f5","#f1f1f5","#f1f1f5"].map((c,i)=><div key={i} style={{flex:1,height:12,borderRadius:3,background:c,border:"1px solid #e2e2ea"}}/>)}
                      </div>
                      <div style={{height:24,background:"#ffffff",borderRadius:4,border:"1px solid #e2e2ea"}}/>
                      <div style={{display:"flex",gap:4}}>
                        <div style={{flex:2,height:20,background:"#ffffff",borderRadius:4,border:"1px solid #e2e2ea"}}/>
                        <div style={{flex:1,height:20,background:"#059669",borderRadius:4,opacity:.8}}/>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{padding:"10px 14px",background:"#ffffff",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid #e2e2ea"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"#0f0f11",marginBottom:1}}>Light</div>
                    <div style={{fontSize:11,color:"#9090a8"}}>Clean and bright</div>
                  </div>
                  {!isDark&&<div style={{width:18,height:18,borderRadius:"50%",background:"#059669",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                  </div>}
                </div>
              </button>
            </div>

            {/* Quick toggle */}
            <Card2>
              <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:T.text,marginBottom:2}}>Quick Toggle</div>
                  <div style={{fontSize:11,color:T.textMuted}}>Currently using <b style={{color:T.accent}}>{isDark?"Dark":"Light"}</b> theme</div>
                </div>
                <button onClick={()=>onThemeToggle()} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:8,cursor:"pointer",color:T.text,fontSize:12,fontWeight:500,transition:"all .15s"}}>
                  <span>{isDark?"☀️":"🌙"}</span>
                  Switch to {isDark?"Light":"Dark"}
                </button>
              </div>
            </Card2>
          </>}

          {tab==="api"&&<>
            <h2 style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:20}}>API Keys</h2>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              {apiKeys.map((k,i)=>(
                <Card2 key={i}><div style={{padding:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div><div style={{fontSize:12,fontWeight:500,color:T.text,marginBottom:2}}>{k.name}</div><div style={{fontSize:11,color:T.textMuted}}>Created {k.created} · Last used {k.last}</div></div>
                    <div style={{display:"flex",gap:6}}><Btn small ghost icon={Ic.copy(11)}>Copy</Btn><Btn small variant="danger" icon={Ic.trash(11)} onClick={()=>onToast("Key revoked","error")}>Revoke</Btn></div>
                  </div>
                  <div style={{fontFamily:"'Geist Mono',monospace",fontSize:12,color:T.textMuted,background:T.bgHover,padding:"8px 12px",borderRadius:7}}>{k.key}</div>
                </div></Card2>
              ))}
            </div>
            <Btn icon={Ic.plus(12)} onClick={()=>onToast("New API key generated","success")}>Generate New Key</Btn>
          </>}
          {tab==="security"&&<>
            <h2 style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:20}}>Security</h2>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[{label:"Two-Factor Authentication",desc:"Require 2FA for all users",enabled:true},{label:"SSO / SAML",desc:"Single sign-on via identity provider",enabled:false},{label:"IP Allowlisting",desc:"Restrict access to specified IP ranges",enabled:false},{label:"Session Timeout",desc:"Auto-logout after 8 hours of inactivity",enabled:true}].map((s,i)=>(
                <Card2 key={i}><div style={{padding:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div><div style={{fontSize:13,fontWeight:500,color:T.text}}>{s.label}</div><div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s.desc}</div></div>
                  <div style={{width:36,height:20,borderRadius:10,background:s.enabled?T.accent:T.bgHover,border:`1px solid ${s.enabled?T.accent:T.border}`,position:"relative",cursor:"pointer"}} onClick={()=>onToast(`${s.label} toggled`,"success")}>
                    <div style={{position:"absolute",width:14,height:14,borderRadius:"50%",background:T.bg,top:2,left:s.enabled?18:2,transition:"left .15s"}}/>
                  </div>
                </div></Card2>
              ))}
            </div>
          </>}
          {tab==="notifications"&&<>
            <h2 style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:20}}>Notification Preferences</h2>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[{label:"Quality rule failures",email:true,slack:true},{label:"New access requests",email:true,slack:false},{label:"Certification expiring",email:true,slack:true},{label:"Policy violations",email:true,slack:true},{label:"Schema drift detected",email:false,slack:true},{label:"New comments on assets",email:false,slack:false}].map((n,i)=>(
                <Card2 key={i}><div style={{padding:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,color:T.text}}>{n.label}</span>
                  <div style={{display:"flex",gap:10}}>
                    {["Email","Slack"].map((ch,j)=>{
                      const on=j===0?n.email:n.slack;
                      return <div key={ch} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:T.textMuted}}>
                        <div style={{width:28,height:16,borderRadius:8,background:on?T.accentDim:T.bgHover,border:`1px solid ${on?T.accent:T.border}`,position:"relative",cursor:"pointer"}}>
                          <div style={{position:"absolute",width:10,height:10,borderRadius:"50%",background:on?T.accent:T.textMuted,top:2,left:on?14:2,transition:"left .15s"}}/>
                        </div>{ch}
                      </div>;
                    })}
                  </div>
                </div></Card2>
              ))}
            </div>
          </>}
          {tab==="teams"&&<>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:T.text}}>Team Members</div>
                <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Manage who has access to your Solix workspace</div>
              </div>
              <Btn variant="primary" icon={<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                onClick={()=>{}}>Invite Member</Btn>
            </div>
            <Card2 style={{overflow:"hidden",padding:0,marginBottom:16}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:T.bgElevated}}>
                  {["Member","Role","Domain","Status","Joined",""].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:11,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {TEAMS_DATA.map((m,i)=>(
                    <tr key={m.id} className="row-hover" style={{borderBottom:i<TEAMS_DATA.length-1?`1px solid ${T.border}`:"none"}}>
                      <td style={{padding:"12px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${T.violetDim},${T.blueDim})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.violet,border:`1px solid ${T.border}`,flexShrink:0}}>{m.name.split(" ").map(n=>n[0]).join("")}</div>
                          <div>
                            <div style={{fontSize:13,fontWeight:500,color:T.text}}>{m.name}</div>
                            <div style={{fontSize:11,color:T.textMuted}}>{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:"12px 16px"}}><span style={{fontSize:12,color:T.text}}>{m.role}</span></td>
                      <td style={{padding:"12px 16px"}}><span style={{fontSize:12,color:T.textSub}}>{m.domain}</span></td>
                      <td style={{padding:"12px 16px"}}><Badge color={m.status==="Active"?T.accent:T.amber} bg={m.status==="Active"?T.accentDim:T.amberDim} border="transparent">{m.status}</Badge></td>
                      <td style={{padding:"12px 16px"}}><span style={{fontSize:12,color:T.textMuted}}>{m.joined}</span></td>
                      <td style={{padding:"12px 16px",textAlign:"right"}}>
                        <Btn small ghost>Edit</Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card2>
            <Card2>
              <div style={{padding:16}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:14}}>Pending Invites</div>
                {[{email:"priya.sharma@jnj.com",role:"Data Analyst",sent:"2d ago"},{email:"tom.wright@jnj.com",role:"Viewer",sent:"5d ago"}].map((inv,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i===0?`1px solid ${T.border}`:"none"}}>
                    <div>
                      <div style={{fontSize:12,color:T.text,fontWeight:500}}>{inv.email}</div>
                      <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>Invited as {inv.role} · {inv.sent}</div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <Btn small ghost>Resend</Btn>
                      <Btn small variant="danger">Revoke</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </Card2>
          </>}
          {(tab==="audit"||tab==="billing")&&<div style={{color:T.textMuted,fontSize:13,paddingTop:20}}>{tab==="audit"?"Audit log settings and export options":"Billing and subscription management"} — configure as needed for your organization.</div>}
        </div>
      </div>
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function App(){
  const [nav,setNav]=useState("home");
  const [asset,setAsset]=useState(null);
  const [toast,setToast]=useState(null);
  const [isDark,setIsDark]=useState(true);
  const [themeKey,setThemeKey]=useState(0);
  const [sideExp,setSideExp]=useState(false);

  const handleNav=(id)=>{setNav(id);setAsset(null);};
  const handleAsset=(a)=>{setAsset(a);setNav("catalog");};
  const showToast=(msg,type="success")=>setToast({msg,type,key:Date.now()});

  // Pass target=true for dark, target=false for light, undefined to toggle
  const toggleTheme=(target)=>{
    const next = target !== undefined ? target : !isDark;
    if(next === isDark) return;
    Object.assign(T, next ? DARK : LIGHT);
    setIsDark(next);
    setThemeKey(k=>k+1);
  };

  const renderPage=()=>{
    if(nav==="catalog"&&asset) return <AssetDetail asset={asset} onBack={()=>setAsset(null)} onToast={showToast}/>;
    switch(nav){
      case "home":          return <HomeView onNav={handleNav} onToast={showToast}/>;
      case "search":        return <SearchView onAsset={handleAsset}/>;
      case "catalog":       return <CatalogView onAsset={handleAsset}/>;
      case "lineage":       return <LineageView/>;
      case "quality":       return <QualityView/>;
      case "contracts":     return <ContractsView onToast={showToast}/>;
      case "policies":      return <PoliciesView onToast={showToast}/>;
      case "access":        return <AccessView onToast={showToast}/>;
      case "compliance":    return <ComplianceView/>;
      case "certifications":return <CertificationsView onToast={showToast}/>;
      case "stewardship":   return <StewardshipView onToast={showToast}/>;
      case "glossary":      return <GlossaryView onToast={showToast}/>;
      case "domains":       return <DomainsView/>;
      case "observability": return <ObsView onToast={showToast}/>;
      case "analytics":     return <AnalyticsView/>;
      case "teams":         return <TeamsView onToast={showToast}/>;
      case "integrations":  return <IntegrationsView onToast={showToast}/>;
      case "profile":       return <ProfileView onToast={showToast}/>;
      case "settings":      return <SettingsView onToast={showToast}/>;
      default:              return <HomeView onNav={handleNav} onToast={showToast}/>;
    }
  };

  return (
    <NavCtx.Provider value={handleNav}>
    <ThemeCtx.Provider value={{isDark,toggleTheme}}>
      <style key={themeKey}>{makeG(T)}</style>
      <div key={themeKey} style={{display:"flex",height:"100vh",background:T.bg,overflow:"hidden"}}>
        <Sidebar active={nav} onNav={handleNav} exp={sideExp} setExp={setSideExp}/>
        <main style={{flex:1,marginLeft:sideExp?EXPANDED_W:COLLAPSED_W,height:"100vh",overflowY:"auto",display:"flex",flexDirection:"column",background:T.bg,transition:"margin-left .2s ease"}}>
          {renderPage()}
        </main>
      </div>
      {toast&&<Toast key={toast.key} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </ThemeCtx.Provider>
    </NavCtx.Provider>
  );
}
