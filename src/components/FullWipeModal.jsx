import React, { useState } from "react";

const jokes=[
  "Nicht jeder Held trägt einen Umhang. Manche verlieren gegen ein Rattfratz.",
  "Team Rocket hätte das vermutlich auch geschafft. Vermutlich.",
  "Die Pokémon-Pension nimmt deine Bewerbung leider nicht mehr an.",
  "Glückwunsch! Du hast die Neustart-Taste freigeschaltet.",
  "Ein taktischer Rückzug bis ganz zurück zum ersten Starter.",
  "Man kann nicht jeden Kampf gewinnen. Dieser Run ist der Beweis.",
  "Das Universum bietet dir einen kostenlosen Neustart. Mit emotionalen Kosten."
];
const ui={background:"#131f35",border:"1px solid #465d7d",borderRadius:14,padding:14,color:"#eef2ff"};
const button={...ui,cursor:"pointer",padding:"10px 14px"};
export default function FullWipeModal({ open, title="Run abgeschlossen", save, playerCount=1, onCancel, onConfirm }) {
  const [mvp,setMvp]=useState("");
  const [hater,setHater]=useState("");
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [ended,setEnded]=useState(false);
  const [quote,setQuote]=useState(jokes[0]);
  if(!open)return null;
  const encounters=Object.values(save?.encounters||{});
  const captures=encounters.filter(x=>x?.status==="Gefangen").length;
  const escaped=encounters.filter(x=>x?.status==="Entkommen").length;
  const defeated=encounters.filter(x=>x?.status==="Besiegt").length;
  const pokemon=[...new Set(encounters.flatMap(row=>Array.from({length:playerCount},(_,i)=>row?.["pokemon"+(i+1)]||"")).filter(Boolean))];
  const summary={at:Date.now(),mvp,hater,reason,captures,escaped,defeated,edition:save?.edition,runCounter:Number(save?.runCounter||0),playerCount};
  const confirm=async()=>{
    if(!window.confirm("Diesen Run endgültig als FULLWIPE archivieren und Team und Encounter-Liste leeren?"))return;
    setBusy(true);
    try {
      await onConfirm(summary);
      setQuote(jokes[Math.floor(Math.random()*jokes.length)]);
      setEnded(true);
    }catch(e){alert(e.message||String(e));}
    finally{setBusy(false);}
  };
  return <div role="dialog" aria-modal="true" aria-label="Fullwipe-Auswertung" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:9999999,display:"grid",placeItems:"center",padding:14}}>
    <div style={{...ui,maxWidth:600,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 90px #0009"}}>
      <h1 style={{color:"#ff9696"}}>{ended?"GAME OVER":"FULLWIPE"}</h1>
      {ended?<><h2>{quote}</h2><p>Dein Versuch wurde in der Chronik gespeichert. Der neue Run kann beginnen.</p><button style={button} onClick={()=>{setEnded(false);setMvp("");setHater("");setReason("");onCancel();}}>Nächster Run</button></>:<>
        <p>{title}</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[["Gefangen",captures],["Geflohen",escaped],["Besiegt",defeated]].map(([label,value])=><div key={label} style={{...ui,textAlign:"center"}}><strong style={{fontSize:24}}>{value}</strong><div>{label}</div></div>)}
        </div>
        <p style={{opacity:.75}}>Die Zahlen beziehen sich auf Encounter-Status, nicht auf die tatsächliche Anzahl verstorbener Team-Pokémon.</p>
        <div style={{display:"grid",gap:12}}>
          <label>MVP / Favorit
            <select value={mvp} onChange={e=>setMvp(e.target.value)} style={{...ui,display:"block",width:"100%"}}><option value="">Bitte auswählen</option>{pokemon.map(p=><option key={p}>{p}</option>)}</select>
          </label>
          <label>Hater
            <select value={hater} onChange={e=>setHater(e.target.value)} style={{...ui,display:"block",width:"100%"}}><option value="">Bitte auswählen</option>{pokemon.map(p=><option key={p}>{p}</option>)}</select>
          </label>
          <label>Warum ist der Run gescheitert?
            <input value={reason} onChange={e=>setReason(e.target.value)} style={{...ui,display:"block",width:"100%"}} placeholder="Optionaler Grund"/>
          </label>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button style={button} onClick={onCancel}>Abbrechen</button>
          <button style={{...button,background:"#9b3038",flex:1,fontWeight:900}} disabled={busy} onClick={confirm}>{busy?"Speichern ...":"FULLWIPE BESTÄTIGEN"}</button>
        </div>
      </>}
    </div>
  </div>;
}
