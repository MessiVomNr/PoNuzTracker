import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WHEEL_RESULTS, getCurrentStage, stageSnapshot, adjustHistoricalStage, finishStage, resolveWheel, archiveWipe, clearCurrentList, clearAllLists, restartGenlocke, isGloballyBanned, registerDeath, killPokemonInSave, syncCurrentTeamWithDeaths, getTeams, cleanRules, copy } from "./core";
import { versionToPokedex } from "../data/versionToPokedex";
import { useDuoSave } from "../duo/useDuoSave";
import HistoricalEditor from "./HistoricalEditor";
import FullWipeModal from "../components/FullWipeModal";
import { RULE_OPTIONS } from "./GenlockeSetup";
import GenlockeExtras from "./GenlockeExtras";
import { validateTeamRules } from "./ruleValidation";

const frame={background:"#121e32",border:"1px solid #354460",borderRadius:16,padding:16};
const btn={border:"1px solid #5b7298",borderRadius:8,background:"#253b60",color:"#fff",padding:"9px 12px",cursor:"pointer"};
function sprite(pokemon, edition) {
  const dex=versionToPokedex[edition]||{};
  const id=Object.keys(dex).find(k=>dex[k]===pokemon);
  const n=Number((id||"").replace("pokedex",""));
  return n? "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/"+n+".png":null;
}
function dexId(pokemon, edition) {
  const dex=versionToPokedex[edition]||{};
  return Number((Object.keys(dex).find(k=>dex[k]===pokemon)||"").replace("pokedex",""))||null;
}
const quotes=["Nicht mal Karpador hätte das so gemacht.","Ein weiterer Run für die Geschichtsbücher. Leider das Kapitel mit den Fehlern.","Der nächste Versuch wird bestimmt besser. Vielleicht.","Game Over. Deine Pokémon verlangen eine Gewerkschaft.","Der Champ wartet noch. Sehr geduldig.","Das war kein Wipe. Das war ein strategischer Rückzug zu Gen 1."];
export default function GenlockeHub() {
  const nav=useNavigate();
  const roomId=localStorage.getItem("activeDuoRoomId")||"";
  const {save:remoteSave,patchSave, error:remoteError}=useDuoSave(roomId);
  const name=localStorage.getItem("activeSave");
  const read=()=>{const saves=JSON.parse(localStorage.getItem("savegames")||"{}");return saves[name]||null;};
  const [localSave,setLocalSave]=useState(read);
  const save=roomId?remoteSave:localSave;
  const [tab,setTab]=useState("overview");
  const [stageEdit,setStageEdit]=useState(0);
  const [selected,setSelected]=useState([]);
  const [locked,setLocked]=useState([]);
  const [mvp,setMvp]=useState(["",""]);
  const [hater,setHater]=useState(["",""]);
  const [target,setTarget]=useState("");
  const [wheelPlayer,setWheelPlayer]=useState(0);
  const [wheelResult,setWheelResult]=useState(null);
  const [wheelSpun,setWheelSpun]=useState(false);
  const [deathName,setDeathName]=useState("");
  const [deathPlayer,setDeathPlayer]=useState(0);
  const [notice,setNotice]=useState("");
  const [quote,setQuote]=useState(quotes[0]);
  const [wipeModal,setWipeModal]=useState(false);
  const [rulesOpen,setRulesOpen]=useState(false);
  const [rules,setRules]=useState(cleanRules(save?.genlocke?.rules));
  const g=save?.genlocke, stage=getCurrentStage(g);
  useEffect(()=>{if(g?.rules)setRules(cleanRules(g.rules));},[g?.rules]);
  const persist=async(next)=>{
    if (roomId) {
      const patch = Object.fromEntries(Object.keys(next).filter(key =>
        JSON.stringify(next[key]) !== JSON.stringify(save?.[key])
      ).map(key => [key, next[key]]));
      if (Object.keys(patch).length) await patchSave(patch);
      return;
    }
    const saves=JSON.parse(localStorage.getItem("savegames")||"{}");
    if(!saves[name])throw new Error("Spielstand fehlt");
    saves[name]=next;localStorage.setItem("savegames",JSON.stringify(saves));setLocalSave(next);
  };
  const run=async(fn)=>{try{setNotice("");await fn();}catch(e){setNotice(e.message||String(e));}};
  if(!g)return <div style={{padding:40}}><h2>{remoteError||"Genlocke wird geladen ..."}</h2><button onClick={()=>nav("/solo")}>Spielstände</button></div>;
  const completed=g.stages.filter(s=>s.completedAt).length;
  const playerCount=g.mode==="duo"?2:1;
  const teams=getTeams(save,playerCount);
  const activeHeirs=(stage?.heirs||[]).filter(h=>!h.dead);
  const finish=()=>run(async()=>{
    if(!window.confirm("Generation abschließen? Die Erbenauswahl kann danach nicht mehr geändert werden."))return;
    const picks=g.rules.heirLottery ? (stage.lotterySlots||[]) : selected;
    const next=finishStage(save,picks,locked,mvp.slice(0,playerCount),hater.slice(0,playerCount),playerCount);
    if (!next.genlocke.finishedAt) {
      const errors=await validateTeamRules(getTeams(next,playerCount),next.edition,g.rules);
      if(errors.length) throw new Error("Übernommene Erben verletzen Teamregeln: "+errors.join(" | "));
    }
    await persist(next);setSelected([]);setLocked([]);setWheelResult(null);setWheelSpun(false);setTab("overview");
  });
  const wipe=()=>setWipeModal(true);
  const finalizeWipe=async(summary)=>{
    await persist(archiveWipe(save,summary.reason||"FULLWIPE",summary));
    setQuote(quotes[Math.floor(Math.random()*quotes.length)]);
    setTab("wipe");
    setSelected([]);
    setLocked([]);
    setWheelSpun(false);
  };
  const recordDeath=()=>run(async()=>{
    if(!deathName.trim())return;
    const result=killPokemonInSave(save,{pokemon:deathName.trim(),player:deathPlayer});
    await persist(result.save);
    setDeathName("");
    if(result.wipe) setWipeModal(true);
  });
  const doWheel=()=>run(async()=>{
    if(!g.rules.wheel) return;
    const previous=(g.wheelHistory||[]).filter(x=>x.stageIndex===g.currentIndex&&x.player===wheelPlayer);
    const heirs=activeHeirs.filter(h=>h.player===wheelPlayer);
    let selectedMon=target;
    if(heirs.length) {
      if(g.rules.wheelMode==="oneRandom") {
        if(previous.length) throw new Error("Für diesen Spieler wurde bereits ein Erbe ausgelost.");
        selectedMon=heirs[Math.floor(Math.random()*heirs.length)]?.pokemon;
      } else if(g.rules.wheelMode==="oneChoose") {
        if(previous.length) throw new Error("Die einmalige Drehung wurde bereits verwendet.");
        if(!heirs.some(h=>h.pokemon===selectedMon)) throw new Error("Bitte einen gültigen Erben wählen.");
      } else {
        if(!heirs.some(h=>h.pokemon===selectedMon)) throw new Error("Bitte einen gültigen Erben wählen.");
      }
    } else {
      if(!g.rules.wheelWithoutHeir) throw new Error("Keine Erben zum Drehen vorhanden.");
      if(previous.length) throw new Error("Der Starter hat bereits einen Glücksrad-Effekt erhalten.");
      if(!selectedMon) throw new Error("Bitte den neuen Starter eintragen.");
    }
    if(previous.some(x=>x.pokemon===selectedMon)) throw new Error("Dieses Pokémon wurde bereits gedreht.");
    if(!heirs.length && !getTeams(save,playerCount)[wheelPlayer].includes(selectedMon))
      throw new Error("Den Starter bitte zuerst in Encounter-Tabelle und aktivem Team eintragen.");
    const {genlocke,record}=resolveWheel(g,selectedMon,wheelPlayer);
    let next={...save,genlocke};
    let autoWipe=false;
    if(record.effects.includes("death")) {
      const result=killPokemonInSave(next,{pokemon:selectedMon,player:wheelPlayer,note:"Glücksrad"});
      next=result.save;
      autoWipe=result.wipe;
    }
    await persist(next);
    if(autoWipe) setWipeModal(true);
    setWheelResult(record);
    setWheelSpun(true);
  });
  return <div style={{minHeight:"100vh",background:"#091225",color:"#edf2ff",padding:"24px 14px"}}>
    <FullWipeModal open={wipeModal} title="Genlocke-Versuch beenden" save={save} playerCount={playerCount} onCancel={()=>setWipeModal(false)} onConfirm={finalizeWipe} />
    <div style={{maxWidth:1050,margin:"auto",display:"grid",gap:15}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div><small>GENLOCKE · VERSUCH {g.attempt}</small><h1 style={{margin:"4px 0"}}>{g.name}</h1><div>{stage?.edition} · Etappe {g.currentIndex+1}/{g.editions.length}</div></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>{roomId&&<button style={btn} onClick={()=>navigator.clipboard.writeText(roomId)} title="Zum Einladen Roomcode kopieren">Room: {roomId} · Kopieren</button>}<button style={btn} onClick={()=>nav("/table")}>Zur Encounter-Tabelle</button></div>
      </div>
      <nav style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[["overview","Übersicht"],["hall","Ruhmeshalle"],["grave","Friedhof"],["history","Chronik"],["historical","Alte Generationen"],["rules","Regeln"]].map(([id,text])=><button key={id} style={{...btn,background:tab===id?"#386a99":"#253b60"}} onClick={()=>setTab(id)}>{text}</button>)}</nav>
      {notice&&<div style={{...frame,borderColor:"#e88181"}}>{notice}</div>}
      {tab==="overview"&&<>
        <section style={{...frame,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
          <div>Championsiege<h2>{completed}</h2></div><div>Tote<h2>{g.deaths.length}</h2></div><div>Erlöst<h2>{g.released.length}</h2></div>
          <div>Aktive Erben<div style={{display:"flex",gap:8,marginTop:8}}>{activeHeirs.length?activeHeirs.map((h,i)=><div key={i} title={h.pokemon}>{sprite(h.pokemon,stage.edition)?<img alt={h.pokemon} src={sprite(h.pokemon,stage.edition)} width="64" style={{filter:"drop-shadow(0 0 9px #ffd76c)"}}/>:h.pokemon}{h.locked?"🔒":""}</div>):"—"}</div></div>
        </section>
        <section style={frame}><h2>Deine Etappen</h2>{g.editions.map((edition,i)=><div key={i} style={{padding:"9px 0",borderBottom:"1px solid #354460",color:i===g.currentIndex?"#a8d6ff":undefined}}>{i+1}. {edition} {i<g.currentIndex?"✓ Abgeschlossen":i===g.currentIndex?"● Aktuell":"🔒"}{g.stages[i]?.issues?.length>0&&<span style={{color:"#ffab69",marginLeft:10}}>⚠ Nach Korrektur prüfen</span>}</div>)}</section>
        {!g.finishedAt&&<>
          <GenlockeExtras save={save} persist={persist} run={run}/>
          <section style={frame}>
            <h2>Generation abschließen</h2>
            <p>Die Ruhmeshalle wird aus dem aktuellen Team übernommen. Wähle die Erben vor dem Abschluss.</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {Array.from({length:6},(_,slot)=>({slot,pokemon:teams.map(t=>t[slot]||"")})).map(({slot,pokemon})=>pokemon.some(Boolean)&&<div key={slot} style={{...frame,minWidth:145,textAlign:"center"}}>
                {pokemon.map((name,i)=>name&&<div key={i}>{sprite(name,stage.edition)&&<img src={sprite(name,stage.edition)} alt={name} width="60"/>}<div>{playerCount>1?"P"+(i+1)+": ":""}{name}</div></div>)}
                <label><input type="checkbox" checked={(g.rules.heirLottery?stage.lotterySlots||[]:selected).includes(slot)}
                  disabled={g.rules.heirLottery||(!selected.includes(slot)&&selected.length>=g.rules.heirs)}
                  onChange={e=>{setSelected(p=>e.target.checked?[...p,slot]:p.filter(x=>x!==slot));setLocked(p=>p.filter(x=>x!==slot));}}/> Erbe</label>
                {(g.rules.heirLottery?stage.lotterySlots||[]:selected).includes(slot)&&<label style={{display:"block"}}><input type="checkbox" checked={locked.includes(slot)} disabled={!locked.includes(slot)&&locked.length>=g.rules.lockedHeirs} onChange={e=>setLocked(p=>e.target.checked?[...p,slot]:p.filter(x=>x!==slot))}/> Teamlock</label>}
              </div>)}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0"}}>
              {Array.from({length:playerCount},(_,i)=><div key={i} style={{display:"grid",gap:7}}>
                {playerCount>1&&<b>Spieler {i+1}</b>}
                <label>MVP <input style={btn} value={mvp[i]||""} onChange={e=>setMvp(a=>a.map((v,j)=>i===j?e.target.value:v))} placeholder="Pokémon"/></label>
                <label>Hater <input style={btn} value={hater[i]||""} onChange={e=>setHater(a=>a.map((v,j)=>i===j?e.target.value:v))} placeholder="Pokémon"/></label>
              </div>)}
            </div>
            <button style={{...btn,background:"#267855"}} onClick={finish}>Generation abschließen</button>
          </section>
          <section style={frame}>
            <h2>Glücksrad</h2>
            {g.rules.wheel ? <>
              <p>Pro Spieler gelten die konfigurierten Drehlimits. Alle Ergebnisse werden dauerhaft protokolliert.</p>
              <style>{`@keyframes gl-wheel-spin {0% {transform: rotate(0deg) scale(.9)} 85% {transform: rotate(1400deg) scale(1.03)} 100% {transform: rotate(1440deg) scale(1)}}`}</style>
              <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{
                  height:140,width:140,borderRadius:"50%",border:"7px solid #d9b66b",
                  background:"conic-gradient(#7b476c 0 14%,#668ec4 14% 28%,#409f8b 28% 42%,#b47652 42% 56%,#b89d51 56% 70%,#755bac 70% 84%,#376b85 84% 100%)",
                  boxShadow:"0 0 24px #9f8a5a66",
                  animation: wheelSpun?"gl-wheel-spin 1.7s ease-out":"none"
                }}/>
                <div style={{display:"grid",gap:8,minWidth:240,flex:1}}>
                  {playerCount>1&&<label>Spieler <select style={btn} value={wheelPlayer} onChange={e=>{setWheelPlayer(Number(e.target.value));setWheelSpun(false);setWheelResult(null);}}><option value={0}>Spieler 1</option><option value={1}>Spieler 2</option></select></label>}
                  {activeHeirs.filter(h=>h.player===wheelPlayer).length?
                    <label>Erbe
                      <select style={btn} value={target} onChange={e=>{setTarget(e.target.value);setWheelSpun(false);}}>
                        <option value="">Bitte wählen</option>
                        {activeHeirs.filter(h=>h.player===wheelPlayer).map((h,i)=><option key={i} value={h.pokemon}>{h.pokemon}</option>)}
                      </select>
                    </label>:
                    g.rules.wheelWithoutHeir?<input style={btn} placeholder="Starter der nächsten Edition" value={target} onChange={e=>setTarget(e.target.value)}/>:<p>Keine Erben verfügbar.</p>}
                  <button style={{...btn,background:"#ae8140"}} onClick={doWheel}>Glücksrad drehen</button>
                </div>
              </div>
              {wheelResult&&<div style={{...frame,marginTop:14,borderColor:"#e0be65"}}>
                <h3>{wheelResult.pokemon}: {wheelResult.effects.map(id=>WHEEL_RESULTS.find(x=>x.id===id)?.label).join(" + ")}</h3>
                <p>Bitte das Ergebnis im Spielstand entsprechend umsetzen.</p>
              </div>}
              {(g.wheelHistory||[]).filter(x=>x.stageIndex===g.currentIndex).map(h=><div key={h.id} style={{borderBottom:"1px solid #39455c",padding:"6px 0"}}>Spieler {h.player+1}: {h.pokemon} – {h.effects.join(", ")}</div>)}
            </>:<p>In den Regeln deaktiviert.</p>}
          </section>
          <section style={frame}><h2>Tod eintragen</h2>
            {playerCount>1&&<label>Spieler <select style={btn} value={deathPlayer} onChange={e=>setDeathPlayer(Number(e.target.value))}><option value={0}>Spieler 1</option><option value={1}>Spieler 2</option></select></label>}
            <input style={btn} placeholder="Pokémon" value={deathName} onChange={e=>setDeathName(e.target.value)}/>
            <button style={btn} onClick={recordDeath}>Als tot markieren (Soullink inklusive)</button>
          </section>
          <section style={frame}>
            <h2>Spielstand verwalten</h2>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button style={btn} onClick={()=>run(async()=>{if(window.confirm("Encounter-Liste der aktuellen Etappe leeren?"))await persist(clearCurrentList(save));})}>Liste leeren</button>
              <button style={btn} onClick={()=>run(async()=>{if(window.confirm("Alle Encounter-Listen sämtlicher Generationen leeren?"))await persist(clearAllLists(save));})}>Alle Listen leeren</button>
              <button style={{...btn,background:"#8b3c34"}} onClick={()=>run(async()=>{if(window.confirm("RESTART: Den Versuch mit allen Todeszahlen, Erben und Sperren zurücksetzen?")){await persist(restartGenlocke(save));setSelected([]);setLocked([]);setWheelSpun(false);}})}>Restart</button>
              {!roomId&&<button style={{...btn,background:"#87262f"}} onClick={()=>run(async()=>{if(!window.confirm("Genlocke vollständig löschen?"))return;const saves=JSON.parse(localStorage.getItem("savegames")||"{}");delete saves[name];localStorage.setItem("savegames",JSON.stringify(saves));localStorage.removeItem("activeSave");nav("/solo");})}>Genlocke löschen</button>}
            </div>
          </section>
          <button style={{...btn,background:"#a82c34",padding:18,fontSize:22,fontWeight:900}} onClick={wipe}>FULLWIPE</button>
        </>}
        {g.finishedAt&&<section style={frame}><h2>Genlocke abgeschlossen!</h2><button style={btn} onClick={wipe}>Neuen Versuch beginnen</button></section>}
      </>}
      {tab==="historical"&&<section style={frame}><HistoricalEditor genlocke={g} onUpdate={async(nextG)=>{await persist({...save,genlocke:nextG});setNotice("Korrektur gespeichert. Spätere Etappen wurden farbig als prüfbedürftig markiert.");}}/></section>}
      {tab==="hall"&&<section style={frame}><h2>Globale Ruhmeshalle</h2>{g.stages.filter(s=>s.completedAt).map((s,i)=><div key={s.id} style={{...frame,marginBottom:12}}><h3>{s.edition} · Etappe {i+1}</h3><div style={{display:"flex",gap:14,flexWrap:"wrap"}}>{s.hall.map((h,j)=><div key={j} style={{textAlign:"center",border:"1px solid #ad9569",padding:10,borderRadius:12}}>{h.pokemon.map((p,k)=><div key={k}>{sprite(p,s.edition)&&<img src={sprite(p,s.edition)} alt={p} width="70"/>}<div>{p}</div></div>)}{s.selectedSlots?.includes(h.slot)?"★ Erbe":""}</div>)}</div><p>MVP: {s.mvp.join(", ")||"—"} · Hater: {s.hater.join(", ")||"—"}</p></div>)}</section>}
      {tab==="grave"&&<section style={frame}><h2>Friedhof</h2>{g.deaths.map((d,i)=><div key={d.id||i} style={{padding:8,borderBottom:"1px solid #34405a"}}>{d.pokemon} · {g.editions[d.stageIndex]} · {d.note||"Tot"}</div>)}<h2>Erlöste Champions (keine Tode)</h2>{g.released.map((d,i)=><div key={i} style={{padding:8}}>{d.pokemon} · {g.editions[d.stageIndex]}</div>)}</section>}
      {tab==="history"&&<section style={frame}><h2>Chronik</h2>{g.archives.map((a,i)=><div key={i} style={{...frame,marginBottom:10}}>Versuch {a.attempt}: {a.reachedStage} Etappen · {a.deaths} Tote · {a.champions} Championsiege</div>)}<button style={btn} onClick={()=>run(async()=>{if(window.confirm("Chronik endgültig löschen?"))await persist({...save,genlocke:{...g,archives:[]}});})}>Chronik löschen</button></section>}
      {tab==="rules"&&<section style={frame}>
        <h2>Aktuelle Regeln</h2>
        <p>Regeln können nach einer Warnung geändert werden. Bereits ausgeführte Erbenauswahlen bleiben unverändert.</p>
        <button style={btn} onClick={()=>setRulesOpen(p=>!p)}>{rulesOpen?"Bearbeitung schließen":"Regeln bearbeiten"}</button>
        {rulesOpen&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginTop:16}}>
            {RULE_OPTIONS.filter(([id])=>playerCount>1||!["crossPrimaryTypeUnique","linkPairPrimaryTypeUnique","sameAce"].includes(id)).map(([id,desc,type])=>
              <label key={id} style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",borderBottom:"1px solid #3d4b66",padding:8}}>
                {desc}
                {type==="check"?
                  <input type="checkbox" checked={!!rules[id]} onChange={e=>setRules(cleanRules({...rules,[id]:e.target.checked}))}/>:
                  <input type="number" style={{...btn,width:70}} min="0" max={["heirs","lockedHeirs","legendLimit","mythicalLimit","ultraLimit","pseudoLimit"].includes(id)?6:undefined} value={rules[id]} onChange={e=>setRules(cleanRules({...rules,[id]:e.target.value}))}/>}
              </label>
            )}
            <label>Wipe-Art <select style={btn} value={rules.wipeMode} onChange={e=>setRules(cleanRules({...rules,wipeMode:e.target.value}))}><option value="team">Team-Wipe</option><option value="run">Run-Wipe</option></select></label>
            <label>Glücksrad-Modus <select style={btn} value={rules.wheelMode} onChange={e=>setRules(cleanRules({...rules,wheelMode:e.target.value}))}><option value="each">Für jeden Erben</option><option value="oneChoose">Ein Erbe nach Wahl</option><option value="oneRandom">Ein zufälliger Erbe</option></select></label>
          </div>
          <details style={{marginTop:16}}><summary>Glücksrad-Gewichtungen</summary><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:10,marginTop:12}}>
          {WHEEL_RESULTS.map(w=><label key={w.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>{w.label}<input type="number" style={{...btn,width:75}} min="0" max="1000" value={rules.wheelWeights[w.id]} onChange={e=>setRules(cleanRules({...rules,wheelWeights:{...rules.wheelWeights,[w.id]:Number(e.target.value)}}))}/></label>)}
          </div>
          {["ability","item","move"].map(kind=><label key={kind} style={{display:"grid",gap:5,marginTop:10}}>
            {({ability:"Zufallsfähigkeiten",item:"Zufallsitems",move:"Zufallsattacken"})[kind]}
            <textarea style={{...btn,width:"100%",minHeight:50}} value={(rules.wheelPools?.[kind]||[]).join(", ")}
              onChange={e=>setRules(cleanRules({...rules,wheelPools:{...rules.wheelPools,[kind]:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)}}))}/>
          </label>)}
          <p>Pool-Einträge müssen im jeweiligen Spiel verfügbar sein. Bei Gen 1 werden Item- und Fähigkeitsfelder automatisch entfernt.</p>
          </details>
          <button style={{...btn,background:"#2a7956",marginTop:14}} onClick={()=>run(async()=>{if(window.confirm("Regeln während des Runs ändern? Bisherige Erben und Ergebnisse bleiben erhalten."))await persist({...save,genlocke:{...g,rules:cleanRules(rules)}});})}>Änderungen speichern</button>
        </>}
      </section>}
      {tab==="wipe"&&<section style={{...frame,textAlign:"center"}}><h1>GAME OVER</h1><h2>{quote}</h2><p>Versuch archiviert. Ein neuer Versuch beginnt bei der ersten Edition.</p><button style={btn} onClick={()=>setTab("overview")}>Weiter zum nächsten Versuch</button></section>}
    </div>
  </div>;
}
