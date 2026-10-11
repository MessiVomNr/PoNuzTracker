import React from "react";
import { wheelCatalogOptions } from "./core";

const ALL_GENS=Array.from({length:9},(_,i)=>i+1);
const LABELS=[["abilities","Fähigkeiten"],["natures","Wesen"],["moves","Attacken"],["items","Items"]];

export default function WheelGenerationSettings({rules,edition,onChange}) {
  const chosen=rules.wheelGenerations||ALL_GENS;
  const selected=new Set(chosen);
  const g={rules,editions:[edition],currentIndex:0};
  const counts=LABELS.map(([id,name])=>({id,name,count:wheelCatalogOptions(g,id).length}));
  const toggle=(generation)=>onChange({...rules,wheelGenerations:
    selected.has(generation)?chosen.filter(v=>v!==generation):[...chosen,generation].sort((a,b)=>a-b)
  });
  return <div className="genlocke-wheel-generations">
    <div style={{fontWeight:850,marginBottom:7}}>Generationen für die Zufallsbelohnungen</div>
    <p style={{color:"#aebedc",fontSize:12,lineHeight:1.5,margin:"3px 0 12px"}}>
      Entscheide, aus welchen Einführungs-Generationen Fähigkeiten, Wesen, Attacken und Items gezogen werden.
      Jedes passende Ergebnis hat im jeweiligen Pool dieselbe Chance.
    </p>
    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
      {ALL_GENS.map(gen=><label key={gen} style={{
        display:"inline-flex",alignItems:"center",gap:7,padding:"9px 12px",
        border:"1px solid "+(selected.has(gen)?"#7293ce":"#435572"),
        borderRadius:11,background:selected.has(gen)?"#29436a":"#182842",
        cursor:"pointer",fontSize:13,color:"#eff5ff",fontWeight:800
      }}>
        <input type="checkbox" checked={selected.has(gen)} onChange={()=>toggle(gen)} style={{accentColor:"#8bb4f9"}}/>
        Gen {gen}
      </label>)}
    </div>
    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}>
      <button type="button" className="genlocke-setup-button" onClick={()=>onChange({...rules,wheelGenerations:ALL_GENS})}>Alle</button>
      <button type="button" className="genlocke-setup-button subtle" onClick={()=>onChange({...rules,wheelGenerations:[]})}>Keine</button>
    </div>
    <div style={{marginTop:13,display:"flex",flexWrap:"wrap",gap:8}}>
      {counts.map(x=><span key={x.id} style={{
        padding:"6px 10px",borderRadius:8,background:"rgba(150,180,240,.10)",
        fontSize:12,color:"#dce8ff"
      }}>{x.name}: <strong>{x.count}</strong></span>)}
    </div>
    {rules.wheelOnlyLegal&&
      <p style={{margin:"11px 0 0",color:"#aebedc",fontSize:12}}>
        Die Einstellung „Bis zur Spielgeneration“ begrenzt die Listen zusätzlich auf {edition}.
        Welche Attacken oder Fähigkeiten ein einzelnes Pokémon erlernen kann, wird damit nicht geprüft.
      </p>}
    {counts.every(x=>x.count===0)&&
      <p role="alert" style={{color:"#ffb4b4",fontSize:12}}>Keine verfügbaren Boni in den ausgewählten Generationen.</p>}
  </div>;
}
