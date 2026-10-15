import { genlockePokemonOptionsForEdition } from "./GenlockePokemonSelect";
import { versionToPokedex } from "../data/versionToPokedex";

test("starter / MVP / Hater autocomplete uses exactly the table's edition Pokédex", () => {
  for (const edition of ["Feuerrot", "HeartGold", "Ultrasonne", "Smaragd Romhack"]) {
    const options = genlockePokemonOptionsForEdition(edition);
    const names = new Set(options.map(x => x.value));
    const tableNames = new Set(Object.values(versionToPokedex[edition]));
    expect(names).toEqual(tableNames);
    expect(options.every(o => o.value === o.label)).toBe(true);
  }
});

test("starter name suggestions never duplicate Pokémon and support later generations", () => {
  const options = genlockePokemonOptionsForEdition("Smaragd Romhack");
  expect(options.length).toBe(new Set(options.map(o => o.value)).size);
  expect(options.some(option => option.value === "Pikachu")).toBe(true);
  expect(options.length).toBeGreaterThan(genlockePokemonOptionsForEdition("Feuerrot").length);
});
