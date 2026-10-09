import React, { useEffect, useState } from "react";
import { adjustHistoricalStage, copy } from "./core";

const inputStyle = { background:"#192a42",color:"#e9efff",border:"1px solid #58698a",borderRadius:8,padding:8,maxWidth:"100%" };
const buttonStyle = { ...inputStyle,background:"#29426a",cursor:"pointer" };
export default function HistoricalEditor({ genlocke, onUpdate }) {
  const completed = genlocke.stages.map((stage,index)=>({...stage,index})).filter(s=>s.completedAt && s.index < genlocke.currentIndex);
  const [index,setIndex]=useState(completed[0]?.index??0);
  const [draft,setDraft]=useState({});
  const [error,setError]=useState("");
  const current=genlocke.stages[index];
  useEffect(()=>{
    setDraft(copy(genlocke.stages[index]?.snapshot||{}));
    setError("");
  },[genlocke.stages,index]);
  const update=(field,value)=>setDraft(d=>({...d,[field]:value}));
  const updateEntry=(location,field,value)=>setDraft(d=>({
    ...d,
    encounters:{...(d.encounters||{}),[location]:{...(d.encounters?.[location]||{}),[field]:value}}
  }));
  const save=async()=>{
    try {
      if(!window.confirm("Änderung an abgeschlossener Generation speichern? Spätere Einträge werden als prüfbedürftig markiert. Erben bleiben unverändert."))return;
      const updated=adjustHistoricalStage(genlocke,index,draft);
      await onUpdate(updated);
    } catch(e){setError(e.message||String(e));}
  };
  const undo=async()=>{
    const last=genlocke.backups?.[genlocke.backups.length-1];
    if(!last)return;
    if(!window.confirm("Letzte historische Korrektur zurücknehmen?"))return;
    try {
      const next=copy(genlocke);
      next.stages[last.stageIndex].snapshot=last.snapshot;
      next.stages[last.stageIndex].issues=[];
      next.backups.pop();
      await onUpdate(next);
    }catch(e){setError(e.message||String(e));}
  };
  return <section style={{display:"grid",gap:14,color:"#e9efff"}}>
    <h2>Abgeschlossene Generationen bearbeiten</h2>
    <p style={{opacity:.7}}>Korrekturen verändern nur das Archiv der ausgewählten Etappe. Der aktuelle Spielstand bleibt geschützt. Bestätigte Erben sind nicht editierbar.</p>
    {completed.length===0?<p>Noch keine abgeschlossene Etappe vorhanden.</p>:<>
      <label>Edition <select style={inputStyle} value={index} onChange={e=>setIndex(Number(e.target.value))}>{completed.map(s=><option key={s.id} value={s.index}>{s.index+1}. {s.edition}</option>)}</select></label>
      {!!current?.issues?.length&&<div style={{background:"#563124",border:"1px solid #e9a25c",padding:12,borderRadius:10}}>{current.issues.join(" · ")}</div>}
      <label>Besiegte Arenen <input style={inputStyle} type="number" min="0" max="16" value={draft.gymsDefeated??0} onChange={e=>update("gymsDefeated",Number(e.target.value))}/></label>
      <h3>Encounters</h3>
      {Object.entries(draft.encounters||{}).map(([location,row])=><div key={location} style={{display:"grid",gap:8,padding:12,border:"1px solid #3b4c67",borderRadius:12}}>
        <strong>{location}</strong>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["pokemon1","pokemon2","pokemon3"].filter((field,i)=>i===0||row?.[field]).map(field=><label key={field}>{field} <input style={inputStyle} value={row?.[field]||""} onChange={e=>updateEntry(location,field,e.target.value)}/></label>)}
          <label>Status <select style={inputStyle} value={row?.status||""} onChange={e=>updateEntry(location,"status",e.target.value)}>{["","Gefangen","Besiegt","Entkommen"].map(v=><option value={v} key={v}>{v||"Offen"}</option>)}</select></label>
        </div>
      </div>)}
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button style={buttonStyle} onClick={save}>Korrekturen speichern</button>
        <button style={buttonStyle} disabled={!genlocke.backups?.length} onClick={undo}>Letzte Korrektur rückgängig</button>
      </div>
      {error&&<p role="alert" style={{color:"#ff9595"}}>{error}</p>}
    </>}
  </section>;
}
