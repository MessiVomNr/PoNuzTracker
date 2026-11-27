import { pokedex } from "../data/pokedex";
import { evolutionFamiliesByDex } from "../data/evolutionFamilies";
export const GENS = [1,2,3,4,5,6,7,8,9];
const ends = [151,251,386,493,649,721,809,905,1025];
export const genOf = id => ends.findIndex(end => id <= end) + 1;
export const nameOf = id => pokedex["pokedex"+id] || "#"+id;
export const art = id => "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/"+id+".png";
export function shuffle(items) {
  const a = [...items];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
export const poolOf = gens => Array.from({length:1025},(_,i)=>i+1).filter(id=>gens.includes(genOf(id)));
export function makeBoard(gens,count){const pool=poolOf(gens);if(pool.length<count)throw Error("Zu wenige Pokémon.");return shuffle(pool).slice(0,count);}
export function makeMemory(gens,count,mode){
  const pool=poolOf(gens), allowed=new Set(pool);
  let groups;
  if(mode==="evolution"){
    // Exclude branched families; the legacy map contains some incomplete entries.
    const excluded=new Set([60,61,62,186,43,44,45,182,265,266,267,268,269,290,291,292,361,362,478,366,367,368,412,413,414,280,281,282,475,236,106,107,237,133,134,135,136,196,197,470,471,700,79,80,199,789,790,791,792,840,841,842,1011,1019]);
    // Only unambiguous families: every overlapping legacy entry must be a subset
    // of the same three species, never introduce another possible relative.
    const families=Object.values(evolutionFamiliesByDex);
    const candidates=families.filter(a=>a.length===3&&new Set(a).size===3&&a.every(id=>allowed.has(id)&&!excluded.has(id))&&families.every(b=>!b.some(id=>a.includes(id))||b.every(id=>a.includes(id))));
    const used=new Set();groups=[];
    for(const a of shuffle(candidates)){if(a.some(id=>used.has(id)))continue;groups.push(a);a.forEach(id=>used.add(id));}
  }else groups=shuffle(pool).map(id=>Array(mode==="parts"?3:2).fill(id));
  if(groups.length<count)throw Error("Zu wenige passende Gruppen. Wähle mehr Generationen oder weniger Gruppen.");
  return shuffle(groups.slice(0,count).flatMap((ids,group)=>ids.map((id,part)=>({id,group,part,key:group+"-"+part}))));
}
export function initialMemory(cards,mode){return {cards,mode,turn:0,open:[],matched:[],owners:{},scores:[0,0],phase:"play"};}
export function memoryMove(state,index,player){
  if(state.phase!=="play"||state.turn!==player||!Number.isInteger(index)||!state.cards[index]||state.open.includes(index)||state.matched.includes(index))return state;
  const open=[...state.open,index], size=state.mode==="pair"?2:3;
  if(open.length<size)return {...state,open};
  if(open.every(i=>state.cards[i].group===state.cards[open[0]].group)){
    const matched=[...state.matched,...open], scores=[...state.scores];scores[player]++;
    const owners={...state.owners,[state.cards[open[0]].group]:player};
    return {...state,open:[],matched,owners,scores,phase:matched.length===state.cards.length?"finished":"play"};
  }
  return {...state,open,phase:"miss"};
}
export function clearMiss(state,player){return state.phase==="miss"&&state.turn===player?{...state,open:[],turn:1-player,phase:"play"}:state;}
