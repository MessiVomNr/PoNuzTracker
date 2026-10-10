import {categoryForDex, validateTeamRules} from "./ruleValidation";

test("Legendary, mythical, Ultra Beast and pseudo classifications",()=>{
  expect(categoryForDex(150)).toBe("legendary");
  expect(categoryForDex(151)).toBe("mythical");
  expect(categoryForDex(793)).toBe("ultra");
  expect(categoryForDex(985)).toBe("ultra");
  expect(categoryForDex(149)).toBe("pseudo");
  expect(categoryForDex(25)).toBe("ordinary");
});

test("per-player legend limits respect shared and separate mythical groups",async()=>{
  const base={legendLimit:1,mythicalLimit:0,mythicalShared:true,
    ultraLimit:1,ultraShared:false,pseudoLimit:6};
  const errors=await validateTeamRules([["Mewtu","Mew"]],"Smaragd",base);
  expect(errors.some(x=>x.includes("Legendäre"))).toBe(true);
  const separate=await validateTeamRules([["Mewtu","Mew"]],"Smaragd",{...base,mythicalShared:false});
  expect(separate.some(x=>x.includes("Mysteriöse"))).toBe(true);
  expect(separate.some(x=>x.includes("Legendäre"))).toBe(false);
});

test("primary-type uniqueness within and across teams, and linked pair",async()=>{
  const fire=new Set([4,6]);
  const lookup=async id=>fire.has(id)?"fire":"water";
  const own=await validateTeamRules([["Glumanda","Glurak"]],"Feuerrot",
    {ownPrimaryTypeUnique:true},lookup);
  expect(own.some(x=>x.includes("Doppelter Primärtyp"))).toBe(true);
  const duo=await validateTeamRules([["Glumanda"],["Glurak"]],"Feuerrot",
    {crossPrimaryTypeUnique:true,linkPairPrimaryTypeUnique:true},lookup);
  expect(duo.some(x=>x.includes("Soul-Paar"))).toBe(true);
  expect(duo.some(x=>x.includes("über beide Teams"))).toBe(true);
});
