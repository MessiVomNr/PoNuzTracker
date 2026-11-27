import React,{useState,useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {doc,onSnapshot,runTransaction} from "firebase/firestore";
import {db,ensureAnonAuth} from "../firebase";
import {GenerationFilter} from "./GenerationFilter";
import {GENS,nameOf,art,makeBoard,makeMemory,initialMemory,memoryMove,clearMiss} from "./partyGameEngine";
import "./partyGames.css";

export default function PartyGames({kind}){
 const guess=kind==="guess",nav=useNavigate();
 const [gens,setGens]=useState(GENS),[count,setCount]=useState(guess?24:8),[mode,setMode]=useState("pair");
 const [online,setOnline]=useState(false),[code,setCode]=useState(""),[room,setRoom]=useState(""),[uid,setUid]=useState("");
 const [state,setState]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [secret,setSecret]=useState(null),[hidden,setHidden]=useState([]),[question,setQuestion]=useState(""),[pick,setPick]=useState(null);
 const [reveal,setReveal]=useState(false),[localSecrets,setLocalSecrets]=useState([]),[handoff,setHandoff]=useState(false);
 useEffect(()=>{
  if(!room||!db)return;
  return onSnapshot(doc(db,"partyGameRooms",room),snap=>{if(snap.exists())setState(snap.data());else setError("Raum nicht gefunden.");},e=>setError(e.message));
 },[room]);
 const player=online?state?.players?.indexOf(uid):state?.turn;
 const active=state&&(!online||player===state.turn);
 function build(){
  if(guess)return {kind,board:makeBoard(gens,count),turn:0,phase:"choose",ready:[false,false],history:[],pending:null,winner:-1};
  return {kind,...initialMemory(makeMemory(gens,count,mode),mode)};
 }
 async function start(join=false){
  setError("");setBusy(true);
  try{
   setSecret(null);setHidden([]);setPick(null);setLocalSecrets([]);setHandoff(false);setReveal(false);setQuestion("");
   if(!online){setState(build());return;}
   const user=await ensureAnonAuth();setUid(user.uid);
   const key=join?code.trim().toUpperCase():Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>(x%32).toString(32)).join("").toUpperCase();
   if(!/^[A-Z0-9]{8}$/.test(key))throw Error("Bitte einen achtstelligen Raumcode eingeben.");
   const ref=doc(db,"partyGameRooms",key);
   await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(join){if(!snap.exists())throw Error("Raum nicht gefunden.");const data=snap.data();if(data.kind!==kind)throw Error("Falscher Spieltyp.");if(data.players.includes(user.uid))throw Error("Du bist bereits in diesem Raum. Nutze für Spieler 2 ein anderes Browserprofil.");if(data.players.length!==1)throw Error("Raum ist voll.");tx.update(ref,{players:[...data.players,user.uid]});}
    else {if(snap.exists())throw Error("Code belegt. Erstelle einen neuen Raum.");tx.set(ref,{...build(),players:[user.uid],createdAt:Date.now()});}
   });
   setRoom(key);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function change(fn){
  setError("");
  try{
   if(!online){setState(s=>fn(s));return;}
   const ref=doc(db,"partyGameRooms",room);
   await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error("Raum gelöscht.");const s=snap.data();if(s.players.length!==2||!s.players.includes(uid))return;const next=fn(s);if(next!==s)tx.set(ref,next);});
  }catch(e){setError(e.message);}
 }
 function reset(){setRoom("");setState(null);setReveal(false);setPick(null);setQuestion("");setLocalHidden([[],[]]);setSecret(null);setHidden([]);setLocalSecrets([]);setHandoff(false);setError("");}
 function choose(id){
  setReveal(false);
  if(online){
   if(state.ready[player])return;
   setSecret(id);
   change(s=>{if(s.phase!=="choose"||s.ready[player])return s;const ready=[...s.ready];ready[player]=true;return {...s,ready,phase:ready.every(Boolean)?"ask":"choose"};});
  }else{
   const next=[...localSecrets,id];setLocalSecrets(next);setHandoff(true);if(next.length===2)setState(s=>({...s,phase:"ask"}));
  }
 }
 function ask(){const q=question.trim();if(!q)return;change(s=>s.phase==="ask"&&s.turn===player?{...s,phase:"answer",pending:{type:"question",text:q}}:s);setQuestion("");if(!online){setHandoff(true);setReveal(false);}}
 function answer(yes){
  change(s=>{if(s.phase!=="answer"||(online&&s.turn===player))return s;
   const history=[...s.history,{...s.pending,yes,by:s.turn}];
   if(s.pending.type==="guess"&&yes)return {...s,history,phase:"finished",winner:s.turn,pending:null};
   return {...s,history,phase:"ask",turn:1-s.turn,pending:null};
  });if(!online){setHandoff(true);setReveal(false);}
 }
 function guessNow(){if(!pick)return;change(s=>s.phase==="ask"&&s.turn===player?{...s,phase:"answer",pending:{type:"guess",text:nameOf(pick),id:pick}}:s);setPick(null);if(!online){setHandoff(true);setReveal(false);}}
 const [localHidden,setLocalHidden]=useState([[],[]]);
 function toggle(id){if(online)setHidden(h=>h.includes(id)?h.filter(x=>x!==id):[...h,id]);else setLocalHidden(h=>h.map((a,i)=>i===player?(a.includes(id)?a.filter(x=>x!==id):[...a,id]):a));}
 const excluded=online?hidden:localHidden[player]||[];
 const own=online?secret:localSecrets[state?.phase==="answer"?1-state.turn:state?.turn];
 const waiting=online&&state?.players?.length!==2;
 return <main className="games-page party-page"><section className="party-panel">
 <button onClick={()=>nav("/games")}>‹ Spiele</button><h1>{guess?"Pokémon – Wer ist es?":"Pokémon Memory"}</h1>
 {error&&<p role="alert" className="party-error">{error}</p>}
 {!state&&!room&&<><GenerationFilter generations={gens} onToggle={g=>setGens(a=>a.includes(g)?a.filter(x=>x!==g):[...a,g])} onOnly={g=>setGens([g])} onAll={()=>setGens(GENS)} onClear={()=>setGens([])}/>
 <div className="party-controls"><label>Spielmodus <select value={online?"online":"local"} onChange={e=>setOnline(e.target.value==="online")}><option value="local">2 Spieler lokal</option><option value="online">2 Spieler online</option></select></label>
 {!guess&&<label>Kartenmodus <select value={mode} onChange={e=>setMode(e.target.value)}><option value="pair">2er – gleiche Pokémon</option><option value="evolution">3er – Entwicklungsreihe</option><option value="parts">3er – Bildausschnitte</option></select></label>}
 <label>{guess?"Pokémon pro Runde":"Anzahl Gruppen"} <select value={count} onChange={e=>setCount(+e.target.value)}>{(guess?[12,18,24,30,36,48]:[4,6,8,10,12,16]).map(n=><option key={n}>{n}</option>)}</select></label>
 <button disabled={busy||!gens.length} onClick={()=>{setLocalHidden([[],[]]);start();}}>{online?"Raum erstellen":"Spiel starten"}</button>
 {online&&<><input placeholder="Raumcode" value={code} onChange={e=>setCode(e.target.value)} maxLength={8}/><button disabled={busy} onClick={()=>start(true)}>Beitreten</button></>}</div></>}
 {room&&<p>Raumcode: <strong>{room}</strong> · {state?.players?.length||0}/2 Spieler</p>}
 {state&&<><button onClick={reset}>Spiel verlassen</button>{waiting?<p>Warte auf Spieler 2 …</p>:!guess?<><h2>{state.phase==="finished"?(state.scores[0]===state.scores[1]?"Unentschieden!":"Spieler "+(state.scores[0]>state.scores[1]?1:2)+" gewinnt!"):"Spieler "+(state.turn+1)+" ist dran"}</h2><p>Spieler 1: {state.scores[0]} · Spieler 2: {state.scores[1]} {online&&" · Du bist Spieler "+(player+1)}</p>
 <div className="party-grid">{state.cards.map((card,i)=>{const shown=state.open.includes(i)||state.matched.includes(i);return <button key={card.key} className={"party-card "+(shown?"shown":"back")+(state.matched.includes(i)?" matched":"")} disabled={!active||state.phase!=="play"||shown} onClick={()=>change(s=>memoryMove(s,i,player))} aria-label={shown?nameOf(card.id):"Karte "+(i+1)}>{shown?<><div className={"party-picture "+(state.mode==="parts"?"part-"+card.part:"")}><img src={art(card.id)} alt={state.mode==="parts"?"Bildausschnitt":nameOf(card.id)}/></div>{state.mode!=="parts"&&<small>{nameOf(card.id)}</small>}</>:<span>?</span>}</button>;})}</div>
 {state.phase==="miss"&&<button disabled={!active} onClick={()=>change(s=>clearMiss(s,player))}>Karten umdrehen & Spieler wechseln</button>}</>:<>
 {handoff?<div className="party-handoff"><h2>Gerät weitergeben</h2><p>Nur der nächste Spieler darf auf den Bildschirm schauen.</p><button onClick={()=>setHandoff(false)}>Bereit</button></div>:state.phase==="choose"?<><h2>{online?(state.ready[player]?"Warte auf Gegner":"Wähle dein geheimes Pokémon"):"Spieler "+(localSecrets.length+1)+": Wähle dein geheimes Pokémon"}</h2>{(!online||!state.ready[player])&&<div className="party-grid">{state.board.map(id=><button className="party-card" key={id} onClick={()=>choose(id)}><img src={art(id)} alt=""/><small>{nameOf(id)}</small></button>)}</div>}</>:state.phase==="finished"?<h2>Spieler {state.winner+1} gewinnt!</h2>:<>
 <h2>Spieler {state.turn+1} {state.phase==="ask"?"fragt":"wartet auf Antwort"}</h2>
 <button onClick={()=>setReveal(v=>!v)}>{reveal?"Eigenes Pokémon verbergen":"Eigenes Pokémon ansehen"}</button>{reveal&&own&&<p>{nameOf(own)}</p>}
 {state.phase==="answer"?<><p>{state.pending.type==="guess"?"Tipp: ":"Frage: "}{state.pending.text}</p>{(!online||!active)&&<>{state.pending.type==="guess"?<button disabled={!own} onClick={()=>answer(own===state.pending.id)}>Tipp prüfen</button>:<><button onClick={()=>answer(true)}>Ja</button><button onClick={()=>answer(false)}>Nein</button></>}</>}</>:<>
 {active&&<div className="party-controls"><input maxLength={180} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Hat dein Pokémon Flügel?"/><button disabled={!question.trim()} onClick={ask}>Frage stellen</button><select value={pick||""} onChange={e=>setPick(+e.target.value||null)}><option value="">Pokémon erraten …</option>{state.board.filter(id=>!excluded.includes(id)).map(id=><option key={id} value={id}>{nameOf(id)}</option>)}</select><button disabled={!pick} onClick={guessNow}>Tipp abgeben</button></div>}
 <p>{state.board.length-excluded.length} Pokémon übrig · Antippen zum Umklappen</p><div className="party-grid">{state.board.map(id=><button key={id} className={"party-card "+(excluded.includes(id)?" eliminated":"")} aria-pressed={excluded.includes(id)} onClick={()=>toggle(id)}><img src={art(id)} alt=""/><small>{nameOf(id)}</small></button>)}</div></>}
 <details><summary>Fragenverlauf</summary>{state.history.map((h,i)=><p key={i}>Spieler {h.by+1}: {h.text} – {h.yes?"Ja":"Nein"}</p>)}</details></>}</>}</>}
 </section></main>;
}
