import {
  CLASSIC_EDITIONS, createGenlocke, cleanRules, finishStage, getTeams,
  isGloballyBanned, bannedEvolutionIds, inheritBasePokemon, belongsToHeir,
  resolveWheel, availableWheelResults, killPokemonInSave, adjustHistoricalStage, archiveWipe, restartGenlocke, drawChampionLottery, drawStarterLottery, recordArenaChoice, setWheelEffectDetail
} from "./core";

const makeSave = (editions = ["Feuerrot", "Smaragd"], overrides = {}) => {
  const g = createGenlocke({ name: "Test", editions, rules: overrides });
  return {
    edition: editions[0], linkMode: "solo", genlocke: g,
    encounters: { "Route 1": { pokemon1: "Glurak", status: "Gefangen" } },
    teams: [["Glurak", "Garados", "", "", "", ""]], team: ["Glurak", "Garados", "", "", "", ""],
    gymsDefeated: 8
  };
};

test("classic sequence is preselected but arbitrary stages are possible", () => {
  expect(CLASSIC_EDITIONS).toHaveLength(7);
  const g = createGenlocke({ name: "Repeat", editions: ["Gelb", "Rot", "Feuerrot", "Rot"] });
  expect(g.editions).toEqual(["Gelb", "Rot", "Feuerrot", "Rot"]);
});

test("heir and lock counts are bounded, default Ace gap is two", () => {
  expect(cleanRules({heirs:2,lockedHeirs:5}).lockedHeirs).toBe(2);
  expect(cleanRules({heirs:0,lockedHeirs:4}).lockedHeirs).toBe(0);
  expect(cleanRules({}).aceDifference).toBe(2);
});

test("known linear chains are banned, branches are independent", () => {
  expect(bannedEvolutionIds(6)).toEqual(expect.arrayContaining([4,5,6]));
  expect(bannedEvolutionIds(197)).toEqual([197]);
  expect(bannedEvolutionIds(197)).not.toContain(196);
});

test("one heir advances in its base form and other champions are released", () => {
  const save = makeSave();
  const next = finishStage(save,[0],[0],["Glurak"],["Garados"]);
  expect(next.edition).toBe("Smaragd");
  expect(next.genlocke.currentIndex).toBe(1);
  expect(next.genlocke.stages[0].selectedSlots).toEqual([0]);
  expect(next.genlocke.stages[1].heirs[0]).toMatchObject({pokemon:"Glumanda",locked:true,level:5});
  expect(getTeams(next,1)[0][0]).toBe("Glumanda");
  expect(next.genlocke.deaths).toHaveLength(0);
  expect(next.genlocke.released).toHaveLength(1);
  expect(isGloballyBanned(next.genlocke,129)).toBe(true);
  expect(isGloballyBanned(next.genlocke,129,{gift:true})).toBe(true);
});

test("champion release remains banned if death ban is disabled", () => {
  const next = finishStage(makeSave(["Feuerrot","Smaragd"],{globalDeathBan:false}),[0],[0]);
  expect(isGloballyBanned(next.genlocke,129)).toBe(true);
  next.genlocke.rules.giftException = true;
  expect(isGloballyBanned(next.genlocke,129,{gift:true})).toBe(false);
});

test("Duo heir pair shares the same encounter and remains linked", () => {
  const g = createGenlocke({name:"Duo",editions:["Feuerrot","Smaragd"],mode:"duo"});
  const save = {genlocke:g,edition:"Feuerrot",teams:{0:["Glurak"],1:["Garados"]},encounters:{}};
  const next = finishStage(save,[0],[0],[],[],2);
  expect(next.genlocke.stages[1].heirs).toHaveLength(2);
  expect(next.encounters["Erbe 1"]).toMatchObject({pokemon1:"Glumanda",pokemon2:"Karpador"});
  expect(getTeams(next,2).map(team=>team[0])).toEqual(["Glumanda","Karpador"]);
});

test("wheel death kills the linked pair and records two actual deaths", () => {
  const g = createGenlocke({name:"Duo",editions:["Feuerrot","Smaragd"],mode:"duo"});
  const save = {genlocke:g,edition:"Feuerrot",teams:{0:["Glurak"],1:["Garados"]},encounters:{}};
  const next = finishStage(save,[0],[0],[],[],2);
  const config = next.genlocke;
  config.rules.wheel = true;
  config.rules.wheelWeights = {death:1};
  const {genlocke,result:unused} = resolveWheel(config,"Glumanda",0,()=>0);
  expect(genlocke.deaths).toHaveLength(2);
  expect(genlocke.stages[1].heirs.every(h=>h.dead)).toBe(true);
  expect(() => resolveWheel(genlocke,"Glumanda",0,()=>0)).toThrow(/bereits gedreht/);
});

test("historical corrections preserve the champion selection", () => {
  const next = finishStage(makeSave(),[0],[0]);
  const altered = adjustHistoricalStage(next.genlocke,0,{encounters:{},gymsDefeated:2});
  expect(altered.stages[0].selectedSlots).toEqual([0]);
  expect(altered.stages[1].issues.length).toBeGreaterThan(0);
  expect(altered.backups).toHaveLength(1);
});

test("wipe archives attempt, while full restart clears current progress", () => {
  const next = finishStage(makeSave(),[0],[0]);
  const wiped = archiveWipe(next);
  expect(wiped.genlocke.attempt).toBe(2);
  expect(wiped.genlocke.currentIndex).toBe(0);
  expect(wiped.genlocke.archives).toHaveLength(1);
  const restarted = restartGenlocke(wiped);
  expect(restarted.genlocke.attempt).toBe(1);
  expect(restarted.genlocke.deaths).toHaveLength(0);
});

test("heir base form has an available entry in the next edition", () => {
  expect(inheritBasePokemon("Glurak","Feuerrot","Smaragd")).toMatchObject({pokemon:"Glumanda",available:true});
});

test("Duo Pokémon death removes both linked heirs, keeps history and triggers team wipe", () => {
  const g = createGenlocke({name:"Duo",editions:["Feuerrot","Smaragd"],mode:"duo"});
  const first = {genlocke:g, edition:"Feuerrot", teams:{0:["Glurak"],1:["Garados"]},encounters:{}};
  const inherited = finishStage(first,[0],[0],[],[],2);
  const { save, wipe, targets } = killPokemonInSave(inherited,{pokemon:"Glumanda",player:0});
  expect(wipe).toBe(true);
  expect(targets).toEqual([{pokemon:"Glumanda",player:0},{pokemon:"Karpador",player:1}]);
  expect(save.genlocke.deaths).toHaveLength(2);
  expect(getTeams(save,2).every(team=>team.every(name=>name===""))).toBe(true);
  expect(save.encounters["Erbe 1"].status).toBe("Besiegt");
  expect(save.genlocke.stages[1].heirs.every(heir=>heir.dead)).toBe(true);
});
test("Solo manual death registers banned evolution family", () => {
  const first = makeSave(["Feuerrot","Smaragd"]);
  const {save,wipe} = killPokemonInSave(first,{pokemon:"Glurak",player:0});
  expect(wipe).toBe(false); // Garados is still in team
  expect(getTeams(save,1)[0][0]).toBe("");
  expect(getTeams(save,1)[0][1]).toBe("Garados");
  expect(isGloballyBanned(save.genlocke,4)).toBe(true);
});

test("inherited heir retains identity after evolving and can be marked dead", () => {
  const inherited = finishStage(makeSave(),[0],[0]);
  const heir = inherited.genlocke.stages[1].heirs[0];
  expect(belongsToHeir(heir,"Glutexo","Smaragd")).toBe(true);
  expect(belongsToHeir(heir,"Glurak","Smaragd")).toBe(true);
  expect(belongsToHeir(heir,"Garados","Smaragd")).toBe(false);
});

test("heir lottery persists drawn slots and cannot be rerolled",()=>{
  const original=makeSave(["Feuerrot","Smaragd"],{heirLottery:true});
  const drawn=drawChampionLottery(original,1,()=>0);
  expect(drawn.genlocke.stages[0].lotterySlots).toHaveLength(1);
  expect(()=>drawChampionLottery(drawn,1,()=>0)).toThrow(/bereits ausgelost/);
  const next=finishStage(drawn,[],[drawn.genlocke.stages[0].lotterySlots[0]]);
  expect(next.genlocke.currentIndex).toBe(1);
});

test("starter lottery runs once per player and records choice",()=>{
  const save=makeSave(["Feuerrot","Smaragd"],{starterLottery:true});
  const {save:updated,chosen}=drawStarterLottery(save,0,["Bisasam","Glumanda","Schiggy"],()=>0.4);
  expect(chosen).toBe("Glumanda");
  expect(()=>drawStarterLottery(updated,0,["Bisasam","Glumanda","Schiggy"])).toThrow(/bereits ausgelost/);
});

test("Same Ace and heir gym attendance is recorded",()=>{
  const g=createGenlocke({name:"Duo",editions:["Feuerrot","Smaragd"],mode:"duo",rules:{sameAce:true,heirGym:true,heirGymAll:true}});
  const base={genlocke:g,edition:"Feuerrot",teams:{team1:["Glurak"],team2:["Garados"]},encounters:{}};
  const next=finishStage(base,[0],[0],[],[],2);
  expect(()=>recordArenaChoice(next,{name:"Roxanne",aceSlot:0})).toThrow(/Alle lebenden Erben/);
  const logged=recordArenaChoice(next,{name:"Roxanne",aceSlot:0,participatingSlots:[0]});
  expect(logged.genlocke.stages[1].arenas[0].aceSlot).toBe(0);
  expect(()=>recordArenaChoice(logged,{name:"Roxanne",aceSlot:0,participatingSlots:[0]})).toThrow(/bereits dokumentiert/);
});

test("Wheel details are stored on the original immutable spin record",()=>{
  const g=createGenlocke({name:"T",editions:["Smaragd"],rules:{wheelWeights:{ability:1}}});
  const {genlocke,record}=resolveWheel(g,"Bisasam",0,()=>0);
  const save={genlocke,edition:"Smaragd",teams:[],encounters:{}};
  const result=setWheelEffectDetail(save,record.id,0,"Erzwinger");
  expect(result.genlocke.wheelHistory[0].details[0]).toBe("Erzwinger");
  expect(result.genlocke.wheelHistory[0].effects[0]).toBe("ability");
});

test("wheel does not produce abilities or held items in Gen 1",()=>{
  const g=createGenlocke({name:"Old",editions:["Rot"],rules:{wheel:true}});
  const results=availableWheelResults(g);
  expect(results.find(x=>x.id==="ability").weight).toBe(0);
  expect(results.find(x=>x.id==="item").weight).toBe(0);
  expect(results.find(x=>x.id==="nature").weight).toBe(0);
  expect(results.find(x=>x.id==="randomMove").weight).toBeGreaterThan(0);
});
test("random IV records a real randomly chosen stat",()=>{
  const g=createGenlocke({name:"Test",editions:["Smaragd"],rules:{wheelWeights:{randomIv:1}}});
  const {record}=resolveWheel(g,"Glumanda",0,()=>0);
  expect(record.effects).toEqual(["randomIv"]);
  expect(record.details[0]).toBe("KP = 31 IV");
});
