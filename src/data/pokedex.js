import { pokedexGen1 as pokedex_gen1 } from "../pokedex/pokedex_gen1";
import { pokedexGen2 as pokedex_gen2 } from "../pokedex/pokedex_gen2";
import { pokedexGen3 as pokedex_gen3 } from "../pokedex/pokedex_gen3";
import { pokedexGen4 as pokedex_gen4 } from "../pokedex/pokedex_gen4";
import { pokedexGen5 as pokedex_gen5 } from "../pokedex/pokedex_gen5";
import { pokedexGen6 as pokedex_gen6 } from "../pokedex/pokedex_gen6";


export const pokedex = {
  ...pokedex_gen1,
  ...pokedex_gen2,
  ...pokedex_gen3,
  ...pokedex_gen4,
  ...pokedex_gen5,
  ...pokedex_gen6,
};
