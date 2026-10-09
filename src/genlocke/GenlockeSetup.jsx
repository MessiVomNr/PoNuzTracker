import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CLASSIC_EDITIONS, DEFAULT_RULES, WHEEL_RESULTS, cleanRules, createGenlocke, getPresets, savePreset, deletePreset } from "./core";
import editionData from "../data/editionData";
import { createDuoRoom } from "../duo/duoService";

const panel = { background:"rgba(12,20,39,.92)",color:"#e9efff",border:"1px solid #394765",borderRadius:16,padding:20 };
const button = { cursor:"pointer",padding:"9px 14px",background:"#283b60",color:"#fff",border:"1px solid #6680aa",borderRadius:9 };
const input = { ...button,background:"#121f34",maxWidth:"100%" };
const label = {display:"flex",alignItems:"center",gap:8,marginBottom:8};
const OPTIONS = [
  ["legendLimit","Legendäre im Team","number"],["mythicalLimit","Mysteriöse im Team","number"],
  ["mythicalShared","Mysteriöse zählen zum Legendenlimit","check"],["ultraLimit","Ultrabestien/Paradox im Team","number"],
  ["ultraShared","Ultrabestien/Paradox zum Legendenlimit","check"],["pseudoLimit","Pseudo-Legendäre im Team","number"],
  ["globalDeathBan","Verstorbene Entwicklungslinien global sperren","check"],["giftException","Geschenk-Pokémon sind von Sperren befreit","check"],
  ["aceCap","Ace-Levelcap aktiv","check"],["aceDifference","Levelabstand der übrigen Pokémon","number"],
  ["noHealingItems","Heilitems im Kampf verboten","check"],["ownPrimaryTypeUnique","Primärtypen im eigenen Team einzigartig","check"],
  ["crossPrimaryTypeUnique","Primärtypen über beide Teams einzigartig","check"],["linkPairPrimaryTypeUnique","Soul-Paar: unterschiedliche Primärtypen","check"],
  ["sameAce","Same Ace im Duo","check"],["heirs","Anzahl Champion-Erben","number"],
  ["lockedHeirs","Davon feste Teamplätze","number"],["releaseChampions","Übrige Champions erlösen und sperren","check"],
  ["allowRepeatHeir","Erben dürfen erneut vererbt werden","check"],["maxRepeatHeir","Maximale Erbfolgen (0 = unbegrenzt)","number"],
  ["heirInHall","Erbe muss am Ende im Championteam stehen","check"],["heirGym","Erbe muss an Arenen teilnehmen","check"],
  ["heirGymAll","Alle Erben müssen an Arenen teilnehmen","check"],["heirLottery","Champion-Erben zufällig auswählen","check"],
  ["starterLottery","Starter-Lotterie","check"],["wheel","Erben-Glücksrad","check"],
  ["wheelWithoutHeir","Ohne Erben auf Starter drehen","check"],["wheelOnlyLegal","Nur regulär mögliche Attacken/Fähigkeiten","check"],
  ["riskWinChance","Risiko-Gewinnchance (%)","number"]
];
export default function GenlockeSetup() {
  const navigate=useNavigate();
  const [name,setName]=useState("");
  const [mode,setMode]=useState("solo");
  const [editions,setEditions]=useState([...CLASSIC_EDITIONS]);
  const [addEdition,setAddEdition]=useState("Rot");
  const [rules,setRules]=useState({...cleanRules(DEFAULT_RULES)});
  const [presets,setPresets]=useState(getPresets);
  const [presetName,setPresetName]=useState("");
  const [showWheel,setShowWheel]=useState(false);
  const [error,setError]=useState("");
  const change=(key,value)=>setRules(p=>cleanRules({...p,[key]:value}));
  const changeEdition=(i,value)=>setEditions(p=>p.map((e,j)=>i===j?value:e));
  const move=(i,delta)=>setEditions(p=>{const a=[...p],j=i+delta;if(j<0||j>=a.length)return p;[a[i],a[j]]=[a[j],a[i]];return a;});
  const editionsAvailable=[...new Set([...Object.keys(editionData),...CLASSIC_EDITIONS])].sort((a,b)=>a.localeCompare(b,"de"));
  const create=async()=>{setError("");const trimmed=name.trim();if(!trimmed)return setError("Bitte einen Namen eingeben.");if(!editions.length)return setError("Bitte ein Spiel hinzufügen.");
    if(mode==="solo"){
      const saves=JSON.parse(localStorage.getItem("savegames")||"{}");
      if(saves[trimmed])return setError("Dieser Spielstand existiert bereits.");
      const g=createGenlocke({name:trimmed,editions,rules,mode});
      saves[trimmed]={encounters:{},teams:[["","","","","",""]],team:["","","","","",""],gymsDefeated:0,edition:editions[0],linkMode:"solo",genlocke:g};
      localStorage.setItem("savegames",JSON.stringify(saves));localStorage.removeItem("activeDuoRoomId");localStorage.setItem("activeSave",trimmed);navigate("/genlocke");return;
    }
    try {
      const genlocke=createGenlocke({name:trimmed,editions,rules,mode:"duo"});
      const res=await createDuoRoom({displayName:localStorage.getItem("duoPlayerName")||"Spieler 1",edition:editions[0],linkMode:"duo",title:trimmed,genlocke});
      localStorage.removeItem("activeSave");
      localStorage.setItem("activeDuoRoomId",res.roomId);
      navigate("/genlocke");
    } catch (err) { setError(err.message||String(err)); }
  };
  return <div style={{minHeight:"100vh",background:"#091225",padding:"24px 14px",color:"#e9efff"}}>
    <div style={{maxWidth:1000,margin:"auto",display:"grid",gap:14}}>
      <button onClick={()=>navigate("/solo")} style={{...button,width:"fit-content"}}>← Spielstände</button>
      <h1 style={{margin:0}}>Genlocke erstellen</h1>
      <section style={panel}>
        <div style={{display:"grid",gap:10,gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))"}}>
          <label>Name <input style={input} value={name} onChange={e=>setName(e.target.value)} placeholder="Meine Genlocke" /></label>
          <label>Modus <select style={input} value={mode} onChange={e=>setMode(e.target.value)}><option value="solo">Solo</option><option value="duo">Duo Soullink</option></select></label>
        </div>
      </section>
      <section style={panel}>
        <h2>Spielreihenfolge</h2>
        <p style={{opacity:.7}}>Beliebige Editionen mehrfach möglich; die klassische Reihenfolge ist vorausgewählt.</p>
        {editions.map((e,i)=><div key={i} style={{display:"flex",gap:7,alignItems:"center",marginBottom:7,flexWrap:"wrap"}}>
          <span style={{width:28}}>{i+1}.</span><select style={{...input,flex:1}} value={e} onChange={ev=>changeEdition(i,ev.target.value)}>{editionsAvailable.map(ed=><option key={ed}>{ed}</option>)}</select>
          <button style={button} onClick={()=>move(i,-1)}>↑</button><button style={button} onClick={()=>move(i,1)}>↓</button>
          <button style={button} onClick={()=>setEditions(p=>p.filter((_,j)=>j!==i))}>Entfernen</button>
        </div>)}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><select style={input} value={addEdition} onChange={e=>setAddEdition(e.target.value)}>{editionsAvailable.map(ed=><option key={ed}>{ed}</option>)}</select><button style={button} onClick={()=>setEditions(p=>[...p,addEdition])}>+ Hinzufügen</button><button style={button} onClick={()=>setEditions([...CLASSIC_EDITIONS])}>Klassische Reihenfolge</button></div>
      </section>
      <section style={panel}>
        <h2>Eigene Regel-Presets</h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><input placeholder="Preset-Name" style={input} value={presetName} onChange={e=>setPresetName(e.target.value)} /><button style={button} onClick={()=>{if(!presetName.trim())return;setPresets(savePreset(presetName.trim(),rules));}}>Preset speichern</button></div>
        {Object.keys(presets).map(p=><div key={p} style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}><strong style={{flex:1}}>{p}</strong><button style={button} onClick={()=>setRules(cleanRules(presets[p]))}>Laden</button><button style={button} onClick={()=>setPresets(deletePreset(p))}>Löschen</button></div>)}
      </section>
      <section style={panel}>
        <h2>Regeln</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:12}}>
          {OPTIONS.filter(([id])=>mode==="duo"||!["crossPrimaryTypeUnique","linkPairPrimaryTypeUnique","sameAce"].includes(id)).map(([id,desc,type])=><label key={id} style={{...label,justifyContent:"space-between",borderBottom:"1px solid #26364e",padding:"7px 0"}}>
            <span>{desc}</span>{type==="check"?<input type="checkbox" checked={!!rules[id]} onChange={e=>change(id,e.target.checked)}/>:<input type="number" style={{...input,width:72}} min={0} max={["heirs","lockedHeirs","legendLimit","mythicalLimit","ultraLimit","pseudoLimit"].includes(id)?6:undefined} value={rules[id]} onChange={e=>change(id,e.target.value)}/>}
          </label>)}
          <label style={label}>Glücksrad-Modus <select style={input} value={rules.wheelMode} onChange={e=>change("wheelMode",e.target.value)}><option value="each">Für jeden Erben</option><option value="oneChoose">Einen Erben wählen</option><option value="oneRandom">Einen Erben auslosen</option></select></label>
          <label style={label}>Wipe-Bedingung <select style={input} value={rules.wipeMode} onChange={e=>change("wipeMode",e.target.value)}><option value="team">Team-Wipe</option><option value="run">Run-Wipe</option></select></label>
        </div>
        <button style={{...button,marginTop:14}} onClick={()=>setShowWheel(p=>!p)}>{showWheel?"Glücksrad-Details schließen":"Glücksrad-Details öffnen"}</button>
        {showWheel&&<div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:8}}>{WHEEL_RESULTS.map(r=><label key={r.id} style={{...label,justifyContent:"space-between"}}>{r.label}<input type="number" min={0} max={1000} style={{...input,width:75}} value={rules.wheelWeights[r.id]} onChange={e=>change("wheelWeights",{...rules.wheelWeights,[r.id]:Number(e.target.value)})}/></label>)}</div>}
      </section>
      {error&&<p role="alert" style={{color:"#ff8e94"}}>{error}</p>}
      <button style={{...button,background:"#176e57",padding:16,fontWeight:800}} onClick={create}>Genlocke erstellen</button>
    </div>
  </div>;
}
