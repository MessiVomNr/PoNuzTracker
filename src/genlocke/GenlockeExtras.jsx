import React, {useState} from "react";
import {championRoster, drawChampionLottery, drawStarterLottery, recordArenaChoice,
  setWheelEffectDetail, WHEEL_RESULTS, WHEEL_REWARD_KINDS} from "./core";
import WheelRewardChoice from "./WheelRewardChoice";

const panel={background:"#14223b",border:"1px solid #3c5070",borderRadius:12,padding:14};
const field={background:"#182a46",color:"#edf4ff",border:"1px solid #7188ab",padding:"8px 10px",borderRadius:8,maxWidth:"100%"};
const action={...field,background:"#2d496a",cursor:"pointer"};
export default function GenlockeExtras({save,persist,run}){
  const g=save.genlocke,stage=g.stages[g.currentIndex],rules=g.rules;
  const players=g.mode==="duo"?2:1;
  const [lotteryPlayer,setLotteryPlayer]=useState(0);
  const [starters,setStarters]=useState(["","",""]);
  const [arena,setArena]=useState("");
  const [aceSlot,setAceSlot]=useState("");
  const [participants,setParticipants]=useState([]);
  const [editBonuses,setEditBonuses]=useState({});
  const roster=championRoster(save,players);
  const heirs=(stage.heirs||[]).filter(h=>!h.dead);
  const doHeirLottery=()=>run(async()=>{
    if(!window.confirm("Erben zufällig auslosen? Diese Auswahl ist danach endgültig."))return;
    await persist(drawChampionLottery(save,players));
  });
  const doStarter=()=>run(async()=>{
    const next=drawStarterLottery(save,lotteryPlayer,starters);
    await persist(next.save);
    setStarters(["","",""]);
  });
  const doArena=()=>run(async()=>{
    const updated=recordArenaChoice(save,{
      name:arena,aceSlot:aceSlot===""?null:Number(aceSlot),participatingSlots:participants
    });
    await persist(updated);
    setArena("");setAceSlot("");setParticipants([]);
  });
  const setDetail=(recordId,number,value)=>run(async()=>{
    await persist(setWheelEffectDetail(save,recordId,number,value));
  });
  return <div style={{display:"grid",gap:12}}>
    {rules.heirLottery&&g.currentIndex<g.editions.length-1&&
      <section style={panel}>
        <h3>Champion-Erben-Lotterie</h3>
        <p>Aus {roster.length} verfügbaren Champion-Slots werden {Math.min(roster.length,rules.heirs)} ohne Zurücklegen gezogen. Die Ziehung lässt sich nicht wiederholen.</p>
        {stage.lotterySlots
          ?<p style={{color:"#ffdc8c"}}>Fest ausgelost: Champion-Slot {stage.lotterySlots.map(s=>s+1).join(", ")||"keiner"}. Wähle jetzt gegebenenfalls die Teamlocks.</p>
          :<button style={action} onClick={doHeirLottery}>Erben jetzt auslosen</button>}
      </section>}
    {rules.starterLottery&&
      <section style={panel}>
        <h3>Starter-Lotterie</h3>
        <p>Trage die drei tatsächlich randomisierten Starter deiner aktuellen Edition ein. Pro Spieler gibt es nur eine Ziehung.</p>
        {players>1&&<label>Spieler <select style={field} value={lotteryPlayer} onChange={e=>setLotteryPlayer(Number(e.target.value))}><option value={0}>Spieler 1</option><option value={1}>Spieler 2</option></select></label>}
        {stage.starterDraws?.[lotteryPlayer]
          ?<p style={{color:"#ffdc8c"}}>Ausgelost: <strong>{stage.starterDraws[lotteryPlayer].chosen}</strong></p>
          :<div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
            {starters.map((mon,i)=><input key={i} style={field} value={mon} onChange={e=>setStarters(arr=>arr.map((v,j)=>j===i?e.target.value:v))} placeholder={"Starter "+(i+1)}/>)}
            <button style={action} onClick={doStarter}>Starter auslosen</button>
          </div>}
      </section>}
    {(rules.heirGym||rules.sameAce)&&<section style={panel}>
      <h3>Arena-Protokoll {rules.sameAce&&"(Same Ace)"}</h3>
      <p>Für jede Arena darfst du ein neues Ace-Paar auswählen. Die Teilnahme der Erben wird pro Arena festgehalten.</p>
      {(stage.arenas||[]).map((a,i)=><p key={i} style={{borderBottom:"1px solid #394b65",paddingBottom:8}}>{a.name} {a.aceSlot!==null&&a.aceSlot!==undefined?"· Ace-Paar "+(a.aceSlot+1):""}</p>)}
      <div style={{display:"flex",gap:9,flexWrap:"wrap",alignItems:"center"}}>
        <input style={field} value={arena} onChange={e=>setArena(e.target.value)} placeholder="Arena / Arenaleiter"/>
        {rules.sameAce&&players>1&&<label>Ace-Paar <select style={field} value={aceSlot} onChange={e=>setAceSlot(e.target.value)}><option value="">Wählen</option>{[0,1,2,3,4,5].map(i=><option key={i} value={i}>Team-Slot {i+1}</option>)}</select></label>}
      </div>
      {rules.heirGym&&heirs.length>0&&<div style={{display:"flex",gap:12,flexWrap:"wrap",margin:"10px 0"}}>
        {[...new Set(heirs.map(h=>h.sourceSlot))].map(slot=><label key={slot}>
          <input type="checkbox" checked={participants.includes(slot)}
            onChange={e=>setParticipants(a=>e.target.checked?[...a,slot]:a.filter(v=>v!==slot))}/>
          {" Erbe "+heirs.filter(h=>h.sourceSlot===slot).map(h=>h.pokemon).join(" / ")}
        </label>)}
      </div>}
      <button style={action} onClick={doArena}>Arena dokumentieren</button>
    </section>}
    {(g.wheelHistory||[]).some(rec=>rec.stageIndex===g.currentIndex)&&
      <section style={panel}>
        <h3>Glücksrad-Ergebnisse</h3>
        <p>Bei Zufallsergebnissen wird der Name direkt gezogen. Bei „Wählen“ suchst du ihn in der vollständigen Liste. Anschließend setzt du den Bonus selbst im ROM-Spielstand um.</p>
        {(g.wheelHistory||[]).filter(rec=>rec.stageIndex===g.currentIndex).map(rec=><div key={rec.id} style={{borderTop:"1px solid #425371",padding:"10px 0"}}>
          <b>Spieler {rec.player+1} · {rec.pokemon}</b>
          {rec.effects.map((id,i)=>{
            const kind=WHEEL_RESULTS.find(x=>x.id===id);
            const fixed=rec.details?.[i];
            if(id==="death"||id==="nothing"||id==="risk"||id==="jackpot")
              return <p key={i}>{kind?.label||id}</p>;
            return <div key={i} style={{marginTop:10}}>
              <div style={{color:"#d7e6ff",fontWeight:850}}>{kind?.label||id}</div>
              {fixed
                ?<div style={{color:"#b8eecc",fontWeight:950,fontSize:17,marginTop:5}}>{fixed}</div>
                :WHEEL_REWARD_KINDS[id]
                  ?<WheelRewardChoice genlocke={g} effectId={id}
                      onSave={value=>setDetail(rec.id,i,value)}/>
                  :<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
                    <input style={field} aria-label={"Bonus "+id}
                      value={editBonuses[rec.id+":"+i]||""}
                      onChange={e=>setEditBonuses(d=>({...d,[rec.id+":"+i]:e.target.value}))}
                      placeholder="IV / gewünschter Wert"/>
                    <button style={action}
                      onClick={()=>setDetail(rec.id,i,editBonuses[rec.id+":"+i])}>Speichern</button>
                  </div>}
            </div>;
          })}
        </div>)}
      </section>}
  </div>;
}
