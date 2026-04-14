import re

with open("solix-platform-v2.jsx", "r", encoding="utf-8") as f:
    src = f.read()

# ── 1. Replace AssetOverview ──────────────────────────────────────────────────
OLD_OVERVIEW = src[src.index("const AssetOverview = ({asset,onToast})=>(\n"):
                   src.index("\nconst AssetSchema = ({asset,onToast})=>")]
NEW_OVERVIEW = """const AssetOverview = ({asset,data,setData,onToast})=>{
  const [editingDesc,setEditingDesc]=useState(false);
  const [descVal,setDescVal]=useState(data.description||asset.description);
  const [editingNotes,setEditingNotes]=useState(false);
  const [notesVal,setNotesVal]=useState(data.notes||(
    `The \\`${asset.name}\\` table is the source of truth for ${asset.domain.toLowerCase()} data.\\n\\nData is refreshed every ${asset.slaFreshness} via automated pipeline. All PII columns are tagged and subject to data retention policy.\\n\\nContact ${asset.owner} for access requests.`
  ));
  return (
  <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:900}}>
    {/* Description */}
    <Card2>
      <div style={{padding:"14px 16px"}}>
        <SH title="Description" action={
          editingDesc
            ? <div style={{display:"flex",gap:6}}>
                <Btn small ghost onClick={()=>{setData(d=>({...d,description:descVal}));setEditingDesc(false);onToast("Description saved","success");}}>Save</Btn>
                <Btn small ghost onClick={()=>{setDescVal(data.description||asset.description);setEditingDesc(false);}}>Cancel</Btn>
              </div>
            : <Btn small ghost icon={Ic.edit(11)} onClick={()=>setEditingDesc(true)}>Edit</Btn>
        }/>
        {editingDesc
          ? <textarea value={descVal} onChange={e=>setDescVal(e.target.value)} rows={3}
              style={{width:"100%",padding:"9px 12px",background:T.bgElevated,border:`1.5px solid ${T.accent}`,borderRadius:8,color:T.text,fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7,fontFamily:"inherit",boxSizing:"border-box"}}/>
          : <p style={{fontSize:13,color:T.textSub,lineHeight:1.8,margin:0}}>{descVal}</p>
        }
      </div>
    </Card2>
    {/* Linked Assets */}
    <Card2>
      <div style={{padding:"14px 16px"}}>
        <SH title="Linked Assets"/>
        {[{name:"etl_orders_pipeline",rel:"Produced by",type:"Pipeline"},{name:"revenue_dashboard",rel:"Consumed by",type:"Dashboard"},{name:"ml_churn_model",rel:"Feature source for",type:"ML Model"}].map(a=>(
          <div key={a.name} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:6,cursor:"pointer",transition:"border-color .1s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.blue}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <TypeBadge type={a.type}/><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.text,flex:1}}>{a.name}</span>
            <span style={{fontSize:11,color:T.textMuted}}>{a.rel}</span>{Ic.chevRight(12)}
          </div>
        ))}
      </div>
    </Card2>
    {/* Notes / Wiki */}
    <Card2>
      <div style={{padding:"14px 16px"}}>
        <SH title="Notes" action={
          editingNotes
            ? <div style={{display:"flex",gap:6}}>
                <Btn small ghost onClick={()=>{setData(d=>({...d,notes:notesVal}));setEditingNotes(false);onToast("Notes saved","success");}}>Save</Btn>
                <Btn small ghost onClick={()=>{setNotesVal(data.notes||notesVal);setEditingNotes(false);}}>Cancel</Btn>
              </div>
            : <Btn small ghost icon={Ic.edit(11)} onClick={()=>setEditingNotes(true)}>Edit</Btn>
        }/>
        {editingNotes
          ? <textarea value={notesVal} onChange={e=>setNotesVal(e.target.value)} rows={6}
              style={{width:"100%",padding:"9px 12px",background:T.bgElevated,border:`1.5px solid ${T.accent}`,borderRadius:8,color:T.text,fontSize:13,outline:"none",resize:"vertical",lineHeight:1.75,fontFamily:"'Geist Mono',monospace",boxSizing:"border-box"}}/>
          : <div style={{fontSize:13,color:T.textSub,lineHeight:1.9,whiteSpace:"pre-wrap"}}>{notesVal}</div>
        }
      </div>
    </Card2>
  </div>
);}"""

src = src.replace(OLD_OVERVIEW, NEW_OVERVIEW)

# ── 2. Replace AssetSchema (add search) ─────────────────────────────────────
OLD_SCHEMA = src[src.index("const AssetSchema = ({asset,onToast})=>"):
                 src.index("\nconst AssetLineageFull")]
NEW_SCHEMA = """const AssetSchema = ({asset,onToast})=>{
  const cols=SCHEMA[asset.name]||SCHEMA.orders||[];
  const [editing,setEditing]=useState(null);
  const [schSearch,setSchSearch]=useState("");
  const filtered=cols.filter(c=>!schSearch||c.name.toLowerCase().includes(schSearch.toLowerCase())||c.desc?.toLowerCase().includes(schSearch.toLowerCase())||c.type?.toLowerCase().includes(schSearch.toLowerCase()));
  return <div className="fadeIn">
    <Card2 style={{overflow:"hidden",padding:0}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:1,minWidth:160}}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:T.textMuted,pointerEvents:"none"}}><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <input value={schSearch} onChange={e=>setSchSearch(e.target.value)} placeholder="Search columns…"
            style={{width:"100%",padding:"6px 10px 6px 28px",background:T.bgElevated,border:`1.5px solid ${schSearch?T.accent:T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:"none",boxSizing:"border-box",transition:"border-color .15s"}}
            onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=schSearch?T.accent:T.border}/>
          {schSearch&&<button onClick={()=>setSchSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:15,lineHeight:1}}>×</button>}
        </div>
        <span style={{fontSize:12,color:T.textMuted,whiteSpace:"nowrap"}}>{filtered.length} / {cols.length} columns · {cols.filter(c=>c.pii).length} PII · {cols.filter(c=>c.pk).length} PK</span>
        <Btn small icon={Ic.plus(11)} onClick={()=>onToast("Add column dialog would open","success")}>Add Column</Btn>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Column","Type","Nullable","Description","PII","Quality Rule","Actions"].map(h=><th key={h} style={{padding:"8px 14px",fontSize:11,fontWeight:600,color:T.textMuted,textAlign:"left",borderBottom:`1px solid ${T.border}`,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",background:T.bgElevated}}>{h}</th>)}</tr></thead>
        <tbody>
          {filtered.map((c,i)=>(
            <tr key={i} className="row-hover" style={{borderBottom:i<filtered.length-1?`1px solid ${T.border}`:"none"}}>
              <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:6}}>{c.pk&&<span style={{fontSize:9,color:T.amber,border:`1px solid ${T.amberDim}`,padding:"1px 5px",borderRadius:4,fontFamily:"'Geist Mono',monospace",fontWeight:700}}>PK</span>}<span style={{fontSize:13,fontFamily:"'Geist Mono',monospace",color:T.text,fontWeight:500}}>{c.name}</span></div></td>
              <td style={{padding:"10px 14px"}}><Badge color={T.blue} bg={T.blueDim}>{c.type}</Badge></td>
              <td style={{padding:"10px 14px"}}><span style={{fontSize:11,color:c.nullable?T.textMuted:T.textSub}}>{c.nullable?"YES":"NOT NULL"}</span></td>
              <td style={{padding:"10px 14px",fontSize:12,color:T.textSub,maxWidth:220}}>{editing===i?<Input2 value={c.desc} onChange={()=>{}} style={{fontSize:12}}/>:c.desc}</td>
              <td style={{padding:"10px 14px"}}>{c.pii&&<Badge color={T.rose} bg={T.roseDim} border="rgba(253,164,175,0.25)">PII</Badge>}</td>
              <td style={{padding:"10px 14px",fontSize:11,fontFamily:"'Geist Mono',monospace",color:T.textMuted}}>{c.quality}</td>
              <td style={{padding:"10px 14px"}}><div style={{display:"flex",gap:6}}><button onClick={()=>setEditing(editing===i?null:i)} style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer"}}>{Ic.edit(12)}</button><button onClick={()=>onToast("Column deleted","error")} style={{background:"transparent",border:"none",color:T.textMuted,cursor:"pointer"}}>{Ic.trash(12)}</button></div></td>
            </tr>
          ))}
          {filtered.length===0&&<tr><td colSpan={7} style={{padding:"32px",textAlign:"center",color:T.textMuted,fontSize:13}}>No columns match "{schSearch}"</td></tr>}
        </tbody>
      </table>
    </Card2>
  </div>;
}"""

src = src.replace(OLD_SCHEMA, NEW_SCHEMA)

# ── 3. Replace AssetQualityTab (sync with DQ_TEST_CASES) ────────────────────
OLD_QUALITY = src[src.index("const AssetQualityTab = ({asset})=>{"):
                  src.index("\nconst AssetPoliciesTab")]
NEW_QUALITY = """const AssetQualityTab = ({asset})=>{
  const [runningIds,setRunningIds]=useState(new Set());
  const [localCases,setLocalCases]=useState(()=>{
    // match DQ test cases to this asset — table field is like "commerce.orders", asset.name is "orders"
    const matched=DQ_TEST_CASES.filter(t=>t.table.endsWith("."+asset.name)||t.table===asset.name);
    return matched.length>0?matched:DQ_TEST_CASES.slice(0,3);
  });
  const tcSuccess=localCases.filter(t=>t.status==="Success").length;
  const tcFailed=localCases.filter(t=>t.status==="Failed").length;
  const tcAborted=localCases.filter(t=>t.status==="Aborted").length;
  const trend=[91,94,93,96,94,92,95,97,94,96,94,asset.quality];
  const dimColor=(dim)=>({Completeness:"#3b82f6",Accuracy:"#8b5cf6",Validity:"#10b981",Volume:"#f59e0b",Uniqueness:"#ec4899",Consistency:"#06b6d4",Integrity:"#f97316"}[dim]||T.textMuted);
  const TC_CFG={Success:{color:"#16a34a",bg:"#16a34a12"},Failed:{color:"#e11d48",bg:"rgba(225,29,72,.1)"},Aborted:{color:"#d97706",bg:"rgba(217,119,6,.1)"}};

  const runTest=(id)=>{
    setRunningIds(p=>new Set([...p,id]));
    setTimeout(()=>setRunningIds(p=>{const n=new Set(p);n.delete(id);return n;}),1800);
  };
  const deleteTest=(id)=>setLocalCases(p=>p.filter(t=>t.id!==id));

  return <div className="fadeIn" style={{display:"flex",flexDirection:"column",gap:16}}>
    {/* Score cards */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
      <Card2 style={{padding:"14px 16px"}}>
        <div style={{fontSize:10.5,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Quality Score</div>
        <div style={{fontSize:26,fontWeight:800,color:asset.quality>=90?"#16a34a":asset.quality>=70?T.amber:T.rose,fontFamily:"'Geist Mono',monospace"}}>{asset.quality}<span style={{fontSize:14,fontWeight:500,color:T.textMuted}}>%</span></div>
      </Card2>
      <Card2 style={{padding:"14px 16px"}}>
        <div style={{fontSize:10.5,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Tests</div>
        <div style={{fontSize:26,fontWeight:800,color:T.text,fontFamily:"'Geist Mono',monospace"}}>{localCases.length}</div>
      </Card2>
      <Card2 style={{padding:"14px 16px"}}>
        <div style={{fontSize:10.5,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Passing</div>
        <div style={{fontSize:26,fontWeight:800,color:"#16a34a",fontFamily:"'Geist Mono',monospace"}}>{tcSuccess}</div>
      </Card2>
      <Card2 style={{padding:"14px 16px",borderColor:tcFailed>0?T.rose+"55":""}}>
        <div style={{fontSize:10.5,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Failing</div>
        <div style={{fontSize:26,fontWeight:800,color:tcFailed>0?T.rose:T.textMuted,fontFamily:"'Geist Mono',monospace"}}>{tcFailed}</div>
      </Card2>
    </div>

    {/* Trend */}
    <Card2>
      <div style={{padding:"14px 16px"}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Quality Score Trend (12 runs)</div>
        <div style={{height:64,display:"flex",alignItems:"flex-end",gap:3}}>
          {trend.map((v,i)=>{
            const col=v>=90?"#16a34a":v>=70?T.amber:T.rose;
            return <div key={i} style={{flex:1,borderRadius:"3px 3px 0 0",background:col,opacity:i<trend.length-1?0.45:0.85,height:`${(v/100)*64}px`,transition:"opacity .15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity=i<trend.length-1?"0.45":"0.85"}/>;
          })}
        </div>
        <div style={{height:1,background:T.border,marginTop:4}}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:10,color:T.textMuted}}>
          <span>12 runs ago</span><span>Latest</span>
        </div>
      </div>
    </Card2>

    {/* Test Cases table */}
    <Card2 style={{padding:0,overflow:"hidden"}}>
      <div style={{padding:"11px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bgElevated}}>
        <span style={{fontSize:11.5,fontWeight:700,color:T.text}}>Test Cases ({localCases.length})</span>
        <span style={{fontSize:11.5,color:T.textMuted}}>
          <span style={{color:"#16a34a",fontWeight:600}}>{tcSuccess} passing</span>
          {tcFailed>0&&<span style={{color:T.rose,fontWeight:600,marginLeft:8}}>{tcFailed} failing</span>}
          {tcAborted>0&&<span style={{color:T.amber,fontWeight:600,marginLeft:8}}>{tcAborted} aborted</span>}
        </span>
      </div>
      {localCases.length===0
        ? <div style={{padding:"40px",textAlign:"center",color:T.textMuted,fontSize:13}}>No test cases linked to this asset yet.</div>
        : <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:T.bgElevated,borderBottom:`1px solid ${T.border}`}}>
                {["","Name","Column","Dimension","Last Run","Actions"].map((h,i)=>(
                  <th key={i} style={{padding:"8px 14px",fontSize:10.5,fontWeight:700,color:T.textMuted,textAlign:"left",textTransform:"uppercase",letterSpacing:".05em",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {localCases.map((t,i)=>{
                const cfg=TC_CFG[t.status]||TC_CFG.Success;
                const isRunning=runningIds.has(t.id);
                return (
                  <tr key={t.id} style={{borderBottom:i<localCases.length-1?`1px solid ${T.border}`:"none",transition:"background .1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.bgHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"10px 14px",width:32}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:isRunning?T.amber:cfg.color,animation:isRunning?"pulse2 1s infinite":""}}/>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{fontSize:12.5,fontWeight:600,color:T.text}}>{t.name}</div>
                      {t.failedReason&&<div style={{fontSize:11,color:cfg.color,marginTop:2}}>{t.failedReason}</div>}
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      {t.col?<span style={{fontSize:11.5,fontFamily:"'Geist Mono',monospace",color:T.textSub}}>{t.col}</span>:<span style={{color:T.textMuted,fontSize:12}}>—</span>}
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:5,background:`${dimColor(t.dim)}12`,color:dimColor(t.dim),fontWeight:600,border:`1px solid ${dimColor(t.dim)}22`}}>{t.dim}</span>
                    </td>
                    <td style={{padding:"10px 14px",fontSize:11.5,fontFamily:"'Geist Mono',monospace",color:T.textMuted,whiteSpace:"nowrap"}}>{isRunning?"Running…":t.lastRun}</td>
                    <td style={{padding:"8px 14px"}} onClick={e=>e.stopPropagation()}>
                      <div style={{display:"flex",gap:4}}>
                        <button title="Run now" onClick={()=>runTest(t.id)}
                          style={{width:28,height:28,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",background:T.accentDim,border:`1px solid ${T.accent}33`,color:T.accent,cursor:"pointer",transition:"opacity .1s"}}
                          onMouseEnter={e=>e.currentTarget.style.opacity=".7"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 2l7 4-7 4V2z" fill="currentColor"/></svg>
                        </button>
                        <button title="Delete test" onClick={()=>deleteTest(t.id)}
                          style={{width:28,height:28,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1px solid transparent`,color:T.textMuted,cursor:"pointer",transition:"all .1s"}}
                          onMouseEnter={e=>{e.currentTarget.style.background=T.roseDim;e.currentTarget.style.borderColor=T.rose+"44";e.currentTarget.style.color=T.rose;}}
                          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="transparent";e.currentTarget.style.color=T.textMuted;}}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M4 3v7h4V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      }
    </Card2>
  </div>;
}"""

src = src.replace(OLD_QUALITY, NEW_QUALITY)

# ── 4. Replace AssetDetail (full component) ──────────────────────────────────
OLD_DETAIL_START = "const AssetDetail = ({asset, onBack, onToast}) => {"
OLD_DETAIL_END   = "\n// ─────────────────────────────────────────────\n// CATALOG VIEW"

old_detail = src[src.index(OLD_DETAIL_START):src.index(OLD_DETAIL_END)]

NEW_DETAIL = """const AssetDetail = ({asset, onBack, onToast}) => {
  const [tab,       setTab]       = useState("overview");
  const [data,      setData]      = useState({...asset,owners:asset.owners||[asset.owner],tags:[...(asset.tags||[])]});
  const [certOpen,  setCertOpen]  = useState(false);
  const [domainOpen,setDomainOpen]= useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerSearch,setOwnerSearch]=useState("");
  const [tagInput,  setTagInput]  = useState("");
  const [certModal, setCertModal] = useState(false);
  const [certNote,  setCertNote]  = useState("");

  const DOMAINS_LIST = ["Commerce","Finance","Product","Marketing","ML","Engineering"];
  const USERS_LIST   = ["maya.chen","sarah.kim","alex.wu","dev.patel","lisa.ray","priya.nair","james.oh"];
  const ava          = name => (name||"?").split(".").map(s=>s[0]?.toUpperCase()||"").join("");

  // cert meta inline
  const CMETA = {
    "Certified":   {color:"#16a34a",bg:"rgba(22,163,74,.12)",  border:"rgba(22,163,74,.3)",  icon:"✓"},
    "In Review":   {color:"#d97706",bg:"rgba(217,119,6,.12)",  border:"rgba(217,119,6,.3)",  icon:"⏳"},
    "Uncertified": {color:"#6b7280",bg:"rgba(107,114,128,.1)", border:"rgba(107,114,128,.25)",icon:"◐"},
    "Deprecated":  {color:"#e11d48",bg:"rgba(225,29,72,.12)",  border:"rgba(225,29,72,.3)",  icon:"✕"},
  };

  const cm = CMETA[data.cert]||CMETA["Uncertified"];
  const owners = Array.isArray(data.owners)?data.owners:(data.owner?[data.owner]:[]);

  // close all dropdowns on outside click
  useEffect(()=>{
    if(!certOpen&&!domainOpen&&!ownerOpen) return;
    const close=()=>{setCertOpen(false);setDomainOpen(false);setOwnerOpen(false);setOwnerSearch("");};
    document.addEventListener("mousedown",close);
    return ()=>document.removeEventListener("mousedown",close);
  },[certOpen,domainOpen,ownerOpen]);

  const addTag=()=>{
    const t=tagInput.trim().toLowerCase();
    if(!t||data.tags.includes(t))return;
    setData(d=>({...d,tags:[...d.tags,t]}));
    setTagInput("");
  };

  const tabs=[
    {key:"overview",label:"Overview"},{key:"schema",label:"Schema"},
    {key:"lineage",label:"Lineage"},{key:"quality",label:"Quality"},
    {key:"policies",label:"Policies"},{key:"access",label:"Access"},
    {key:"usage",label:"Usage"},{key:"activity",label:"Activity"},
    {key:"comments",label:`Comments (${COMMENTS.length})`},
  ];

  const handleCertify=()=>{
    setData(d=>({...d,cert:"Certified"}));
    setCertModal(false);
    onToast(`${asset.name} certified successfully`,"success");
  };

  return <div className="fadeUp" style={{height:"100%",display:"flex",flexDirection:"column"}}>
    {/* Topbar — breadcrumb only */}
    <Topbar breadcrumb={[{label:"Data Catalog",onClick:onBack},{label:asset.name}]}/>

    {/* ── Asset header ── */}
    <div style={{background:T.bgSurface,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
      <div style={{padding:"18px 28px 0"}}>

        {/* Row 1: db path + type badge */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <TypeBadge type={data.type}/>
          <span style={{fontSize:11.5,color:T.textMuted,fontFamily:"'Geist Mono',monospace"}}>{data.db}</span>
        </div>

        {/* Row 2: name + Edit / Certify actions */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:14}}>
          <h2 style={{fontSize:22,fontWeight:700,fontFamily:"'Geist Mono',monospace",color:T.text,letterSpacing:"-0.04em",margin:0}}>{data.name}</h2>
          <div style={{display:"flex",gap:7,flexShrink:0,alignItems:"center"}}>
            {data.cert!=="Certified"&&(
              <button onClick={()=>setCertModal(true)}
                style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:8,background:"#16a34a12",border:"1px solid rgba(22,163,74,.3)",color:"#16a34a",fontSize:12.5,fontWeight:600,cursor:"pointer",transition:"opacity .1s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity=".8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                {Ic.cert(12)} Certify
              </button>
            )}
            <button onClick={()=>onToast("Edit panel coming soon","success")}
              style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:8,background:T.bgElevated,border:`1px solid ${T.border}`,color:T.textSub,fontSize:12.5,fontWeight:500,cursor:"pointer",transition:"all .1s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.color=T.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.textSub;}}>
              {Ic.edit(11)} Edit
            </button>
          </div>
        </div>

        {/* Row 3: interactive metadata pills */}
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:14,position:"relative"}}>

          {/* Certificate dropdown */}
          <div style={{position:"relative"}}>
            <button onMouseDown={e=>{e.stopPropagation();setCertOpen(p=>!p);setDomainOpen(false);setOwnerOpen(false);}}
              style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 11px 4px 9px",borderRadius:7,background:cm.bg,border:`1px solid ${cm.border}`,cursor:"pointer",fontSize:12.5,fontWeight:700,color:cm.color}}>
              <span>{cm.icon}</span>{data.cert}
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{flexShrink:0}}><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
            {certOpen&&(
              <div onMouseDown={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 5px)",left:0,zIndex:500,background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:10,boxShadow:"0 8px 28px rgba(0,0,0,.2)",overflow:"hidden",minWidth:160}}>
                {Object.entries(CMETA).map(([c,m])=>(
                  <button key={c} onMouseDown={e=>{e.stopPropagation();setData(d=>({...d,cert:c}));setCertOpen(false);onToast(`Certification set to ${c}`,"success");}}
                    style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 14px",background:data.cert===c?m.bg:"transparent",border:"none",cursor:"pointer",textAlign:"left",transition:"background .1s"}}
                    onMouseEnter={e=>{if(data.cert!==c)e.currentTarget.style.background=T.bgHover;}} onMouseLeave={e=>{if(data.cert!==c)e.currentTarget.style.background="transparent";}}>
                    <span style={{fontSize:14}}>{m.icon}</span>
                    <span style={{fontSize:12.5,fontWeight:600,color:m.color,flex:1}}>{c}</span>
                    {data.cert===c&&<span style={{fontSize:12,color:m.color}}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Domain dropdown */}
          <div style={{position:"relative"}}>
            <button onMouseDown={e=>{e.stopPropagation();setDomainOpen(p=>!p);setCertOpen(false);setOwnerOpen(false);}}
              style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 11px 4px 9px",borderRadius:7,background:T.accentDim,border:`1px solid ${T.accent}33`,cursor:"pointer",fontSize:12.5,fontWeight:600,color:T.accent}}>
              {data.domain}
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{flexShrink:0}}><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
            {domainOpen&&(
              <div onMouseDown={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 5px)",left:0,zIndex:500,background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:10,boxShadow:"0 8px 28px rgba(0,0,0,.2)",overflow:"hidden",minWidth:150}}>
                {DOMAINS_LIST.map(d=>(
                  <button key={d} onMouseDown={e=>{e.stopPropagation();setData(dd=>({...dd,domain:d}));setDomainOpen(false);onToast(`Domain set to ${d}`,"success");}}
                    style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:data.domain===d?T.accentDim:"transparent",border:"none",cursor:"pointer",fontSize:12.5,color:data.domain===d?T.accent:T.textSub,fontWeight:data.domain===d?600:400,transition:"background .1s"}}
                    onMouseEnter={e=>{if(data.domain!==d)e.currentTarget.style.background=T.bgHover;}} onMouseLeave={e=>{if(data.domain!==d)e.currentTarget.style.background="transparent";}}>
                    {d}{data.domain===d&&<span style={{color:T.accent,fontSize:12}}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Separator */}
          <div style={{width:1,height:20,background:T.border,flexShrink:0}}/>

          {/* Owner chips */}
          {owners.map((o,i)=>(
            <div key={i} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 8px 3px 5px",borderRadius:7,background:T.bgElevated,border:`1px solid ${T.border}`}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:T.accentDim,border:`1px solid ${T.accent}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7.5,fontWeight:700,color:T.accent,flexShrink:0}}>{ava(o)}</div>
              <span style={{fontSize:12,color:T.text}}>{o}</span>
              <button onClick={()=>{const no=owners.filter((_,j)=>j!==i);setData(d=>({...d,owners:no,owner:no[0]||""}));}}
                style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,padding:0,display:"flex",lineHeight:1,marginLeft:1}}
                onMouseEnter={e=>e.currentTarget.style.color=T.rose} onMouseLeave={e=>e.currentTarget.style.color=T.textMuted}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
          ))}

          {/* Add owner button + dropdown */}
          <div style={{position:"relative"}}>
            <button onMouseDown={e=>{e.stopPropagation();setOwnerOpen(p=>{if(!p)setOwnerSearch("");return !p;});setCertOpen(false);setDomainOpen(false);}}
              style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:7,border:`1px dashed ${ownerOpen?T.accent:T.border}`,background:"none",color:ownerOpen?T.accent:T.textMuted,fontSize:12,cursor:"pointer",transition:"all .12s"}}
              onMouseEnter={e=>{if(!ownerOpen){e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.color=T.accent;}}}
              onMouseLeave={e=>{if(!ownerOpen){e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.textMuted;}}}>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> Owner
            </button>
            {ownerOpen&&(
              <div onMouseDown={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 5px)",left:0,zIndex:500,background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:10,boxShadow:"0 8px 28px rgba(0,0,0,.2)",overflow:"hidden",minWidth:200}}>
                <div style={{padding:"8px 10px",borderBottom:`1px solid ${T.border}`}}>
                  <input autoFocus value={ownerSearch} onChange={e=>setOwnerSearch(e.target.value)} placeholder="Search users…"
                    style={{width:"100%",padding:"5px 9px",background:T.bgElevated,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,fontSize:12,outline:"none"}}
                    onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
                </div>
                <div style={{maxHeight:180,overflowY:"auto"}}>
                  {USERS_LIST.filter(u=>!ownerSearch||u.toLowerCase().includes(ownerSearch.toLowerCase())).map(u=>{
                    const sel=owners.includes(u);
                    return <button key={u} onMouseDown={e=>{e.stopPropagation();
                      if(sel){const no=owners.filter(x=>x!==u);setData(d=>({...d,owners:no,owner:no[0]||""}));}
                      else{setData(d=>({...d,owners:[...owners,u],owner:owners[0]||u}));}}}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"8px 12px",background:sel?T.bgElevated:"transparent",border:"none",cursor:"pointer",textAlign:"left",transition:"background .1s"}}
                      onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=T.bgHover;}} onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>
                      <div style={{width:22,height:22,borderRadius:6,background:T.accentDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:T.accent,flexShrink:0}}>{ava(u)}</div>
                      <span style={{flex:1,fontSize:12,color:T.text}}>{u}</span>
                      {sel&&<span style={{fontSize:12,color:T.accent,fontWeight:700}}>✓</span>}
                    </button>;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div style={{width:1,height:20,background:T.border,flexShrink:0}}/>

          {/* Tags */}
          {(data.tags||[]).map(t=>(
            <span key={t} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,padding:"3px 9px 3px 9px",borderRadius:7,background:t==="PII"?T.roseDim:T.bgElevated,color:t==="PII"?T.rose:T.textSub,border:`1px solid ${t==="PII"?"rgba(253,164,175,.3)":T.border}`}}>
              {t}
              <button onClick={()=>setData(d=>({...d,tags:d.tags.filter(x=>x!==t)}))} style={{background:"none",border:"none",cursor:"pointer",color:"inherit",padding:0,display:"flex",opacity:.65,lineHeight:1}}
                onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity=".65"}>
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </span>
          ))}
          {/* Add tag inline */}
          <div style={{display:"inline-flex",alignItems:"center",gap:4}}>
            <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag();}}}
              placeholder="+ Tag"
              style={{width:tagInput?90:54,padding:"3px 8px",background:"none",border:`1px dashed ${tagInput?T.accent:T.border}`,borderRadius:7,color:tagInput?T.text:T.textMuted,fontSize:12,outline:"none",transition:"width .15s,border-color .15s"}}
              onFocus={e=>{e.target.style.borderColor=T.accent;e.target.style.width="90px";}} onBlur={e=>{e.target.style.borderColor=tagInput?T.accent:T.border;if(!tagInput)e.target.style.width="54px";}}/>
          </div>

          {/* Stats: quality, rows, size, updated — right side */}
          <div style={{marginLeft:"auto",display:"flex",gap:18,alignItems:"center",flexShrink:0}}>
            {[{l:"Quality",v:<QScore score={data.quality}/>},{l:"Rows",v:<span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:T.text}}>{data.rows}</span>},{l:"Updated",v:<span style={{fontSize:12,color:T.textMuted}}>{data.updated}</span>}].map(m=>(
              <div key={m.l} style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{m.l}</div>
                {m.v}
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar — flush with header bottom border */}
        <div style={{display:"flex",marginBottom:-1}}>
          {tabs.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{padding:"9px 16px",background:"transparent",border:"none",borderBottom:`2px solid ${tab===t.key?T.accent:"transparent"}`,color:tab===t.key?T.text:T.textMuted,fontSize:13,fontWeight:tab===t.key?600:400,cursor:"pointer",transition:"all .12s",whiteSpace:"nowrap"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Content */}
    <div style={{flex:1,overflowY:"auto",padding:28}}>
      {tab==="overview"  && <AssetOverview asset={asset} data={data} setData={setData} onToast={onToast}/>}
      {tab==="schema"    && <AssetSchema asset={asset} onToast={onToast}/>}
      {tab==="lineage"   && <AssetLineageFull asset={asset}/>}
      {tab==="quality"   && <AssetQualityTab asset={data}/>}
      {tab==="policies"  && <AssetPoliciesTab/>}
      {tab==="access"    && <AssetAccessTab onToast={onToast}/>}
      {tab==="usage"     && <AssetUsageTab/>}
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
          {label:"Quality rules passing",done:data.quality>=85},
          {label:"Owner assigned",done:true},
          {label:"Retention policy applied",done:false},
        ].map((c,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:c.done?T.accentDim:T.bgElevated,border:`1px solid ${c.done?"rgba(238,36,36,0.2)":T.border}`,borderRadius:8}}>
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
};"""

src = src.replace(old_detail, NEW_DETAIL)

with open("solix-platform-v2.jsx", "w", encoding="utf-8") as f:
    f.write(src)

print("Done.")
