import { pokedexGen1 } from "../pokedex/pokedex_gen1";
import { pokedexGen2 } from "../pokedex/pokedex_gen2";
import { pokedexGen3 } from "../pokedex/pokedex_gen3";
import { pokedexGen4 } from "../pokedex/pokedex_gen4";
import { pokedexGen5 } from "../pokedex/pokedex_gen5";
import { pokedexGen6 } from "../pokedex/pokedex_gen6";
import { pokedexGen7 } from "../pokedex/pokedex_gen7";

export const versionToPokedex = {
  "Rot": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3 },
  "Blau": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3 },
  "Gelb": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3 },
  "Silber": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3 },
  "Gold": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3 },
  "Kristall": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3 },
  "Rubin": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3 },
  "Saphir": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3 },
  "Smaragd": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3 },
  "Feuerrot": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3 },
  "Blattgrün": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3 },
  "Diamant": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5 },
  "Perl": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5 },
  "Platin": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5 },
  "HeartGold": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5 },
  "SoulSilver": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5 },
  "Schwarz": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5 },
  "Weiß": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5 },
  "Schwarz 2": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5 },
  "Weiß 2": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5 },
  "X": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5, ...pokedexGen6 },
  "Y": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5, ...pokedexGen6 },
  "Omega Rubin": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5, ...pokedexGen6 },
  "Alpha Saphir": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5, ...pokedexGen6 },
    "Sonne": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5, ...pokedexGen6, ...pokedexGen7 },
  "Mond": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5, ...pokedexGen6, ...pokedexGen7 },
  "Ultrasonne": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5, ...pokedexGen6, ...pokedexGen7 },
  "Ultramond": { ...pokedexGen1, ...pokedexGen2, ...pokedexGen3, ...pokedexGen4, ...pokedexGen5, ...pokedexGen6, ...pokedexGen7 },

};
