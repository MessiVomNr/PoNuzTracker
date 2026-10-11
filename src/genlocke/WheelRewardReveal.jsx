import React, {useEffect, useMemo, useState} from "react";
import {wheelCatalogOptions, WHEEL_REWARD_KINDS, WHEEL_RESULTS} from "./core";

export default function WheelRewardReveal({record,genlocke}){
  const rolls=useMemo(()=>record.effects.map((effect,index)=>({
    effect,index,final:record.details?.[index]||"",
    names:WHEEL_REWARD_KINDS[effect] ? wheelCatalogOptions(genlocke,effect).map(e=>e[1]) : []
  })),[record,genlocke]);
  const [step,setStep]=useState(0);
  useEffect(()=>{
    setStep(0);
    if(!rolls.some(x=>x.effect.startsWith("random")&&x.final))return;
    let count=0;
    const handle=setInterval(()=>{
      count++;
      setStep(count);
      if(count>=17)clearInterval(handle);
    },85);
    return ()=>clearInterval(handle);
  },[record.id,rolls]);
  return <div style={{display:"grid",gap:9,marginTop:11}}>
    {rolls.map(({effect,index,final,names})=>{
      const label=WHEEL_RESULTS.find(r=>r.id===effect)?.label||effect;
      const showRolling=effect.startsWith("random")&&names.length>1&&!!final;
      const visible=showRolling&&step<17?names[(step*17+index*29)%names.length]:final;
      return <div key={index} style={{
        border:"1px solid #4c6384",borderRadius:12,padding:"11px 14px",
        background:"linear-gradient(125deg,#1b2f4d,#12233c)"
      }}>
        <span style={{display:"block",fontSize:12,color:"#bdcee6"}}>{label}</span>
        <strong style={{display:"block",fontSize:20,color:final&&step>=17?"#d8f3b3":"#f0f5ff",marginTop:3}}>
          {visible || "Auswahl noch offen"}
        </strong>
        {showRolling&&step<17&&<span style={{color:"#aec2de",fontSize:12}}>Zufallsauswahl läuft …</span>}
      </div>;
    })}
  </div>;
}
