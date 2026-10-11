import React, { useMemo, useState } from "react";
import { wheelCatalogOptions } from "./core";

const field={background:"#1a2d4b",color:"#f2f6ff",border:"1px solid #5d7499",padding:"9px 10px",borderRadius:9,maxWidth:"100%"};
const button={...field,background:"#2e527b",cursor:"pointer",fontWeight:850};

export default function WheelRewardChoice({genlocke,effectId,onSave,disabled=false}){
  const [search,setSearch]=useState("");
  const [choice,setChoice]=useState("");
  const entries=useMemo(()=>wheelCatalogOptions(genlocke,effectId),[genlocke,effectId]);
  const found=useMemo(()=>entries.filter(([,name])=>
    name.toLocaleLowerCase("de").includes(search.trim().toLocaleLowerCase("de"))
  ).slice(0,80),[entries,search]);
  return <div style={{display:"grid",gap:8,padding:"10px 0",maxWidth:510}}>
    <p style={{margin:0,fontSize:12,color:"#b8cbe8"}}>
      {entries.length} mögliche Ergebnisse. Suche nach dem Namen und bestätige genau eines.
    </p>
    <input style={field} type="search" placeholder="Fähigkeit, Wesen, Item oder Attacke suchen …"
      aria-label="Belohnung suchen" value={search}
      onChange={e=>{setSearch(e.target.value);setChoice("");}}/>
    <select style={{...field,width:"100%"}} value={choice}
      onChange={e=>setChoice(e.target.value)} aria-label="Belohnung auswählen" disabled={disabled||!entries.length}>
      <option value="">Ergebnis auswählen …</option>
      {found.map(([id,name,generation])=><option key={id} value={name}>
        {name} (Gen {generation})
      </option>)}
    </select>
    {entries.length>80&&!search&&<span style={{fontSize:12,color:"#adbfdb"}}>
      Es werden zunächst 80 Treffer angezeigt. Für weitere Namen einfach suchen.
    </span>}
    <div>
      <button type="button" style={button} disabled={!choice||disabled}
        onClick={()=>onSave(choice)}>Auswahl bestätigen</button>
    </div>
  </div>;
}
