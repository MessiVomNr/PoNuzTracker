import { pokedexGen1 } from "../pokedex/pokedex_gen1";
import { pokedexGen2 } from "../pokedex/pokedex_gen2";
import { pokedexGen3 } from "../pokedex/pokedex_gen3";
import { pokedexGen4 } from "../pokedex/pokedex_gen4";
import { pokedexGen5 } from "../pokedex/pokedex_gen5";
import { pokedexGen6 } from "../pokedex/pokedex_gen6";
import { pokedexGen7 } from "../pokedex/pokedex_gen7";

import locationsGen1 from "../locations/locations_gen1";
import locationsGen2 from "../locations/locations_gen2";
import locationsGen3 from "../locations/locations_gen3";
import locationsGen4 from "../locations/locations_gen4";
import locationsGen5 from "../locations/locations_gen5";
import locationsGen6 from "../locations/locations_gen6";
import locationsGen32 from "../locations/locations_gen32";
import locationsGen42 from "../locations/locations_gen42";
import locationsGen52 from "../locations/locations_gen52";
import locationsGen62 from "../locations/locations_gen62";
import locationsGen7 from "../locations/locations_gen7";
import locationsGen72 from "../locations/locations_gen72";

import guideGen1 from "../guides/guide_gen1";
import guideGen2 from "../guides/guide_gen2";
import guideGen3 from "../guides/guide_gen3";
import guideGen4 from "../guides/guide_gen4";
import guideGen5 from "../guides/guide_gen5";
import guideGen6 from "../guides/guide_gen6";
import guideGen32 from "../guides/guide_gen32";
import guideGen42 from "../guides/guide_gen42";
import guideGen52 from "../guides/guide_gen52";
import guideGen62 from "../guides/guide_gen62";
import guideGen7 from "../guides/guide_gen7";
import guideGen72 from "../guides/guide_gen72";

import { vms_gen1 as vmsGen1 } from "../vms/vms_gen1";
import { vms_gen2 as vmsGen2 } from "../vms/vms_gen2";
import { vms_gen3 as vmsGen3 } from "../vms/vms_gen3";
import { vms_gen4 as vmsGen4 } from "../vms/vms_gen4";
import { vms_gen5 as vmsGen5 } from "../vms/vms_gen5";
import { vms_gen6 as vmsGen6 } from "../vms/vms_gen6";
import { vms_gen32 as vmsGen32 } from "../vms/vms_gen32";
import { vms_gen42 as vmsGen42 } from "../vms/vms_gen42";
import { vms_gen52 as vmsGen52 } from "../vms/vms_gen52";
import { vms_gen62 as vmsGen62 } from "../vms/vms_gen62";
import { vms_gen7 as vmsGen7 } from "../vms/vms_gen7";
import { vms_gen72 as vmsGen72 } from "../vms/vms_gen72";

const editionData = {
  "Rot":      { gen: 1, pokedex: pokedexGen1, locations: locationsGen1, guide: guideGen1, vms: vmsGen1 },
  "Blau":     { gen: 1, pokedex: pokedexGen1, locations: locationsGen1, guide: guideGen1, vms: vmsGen1 },
  "Gelb":     { gen: 1, pokedex: pokedexGen1, locations: locationsGen1, guide: guideGen1, vms: vmsGen1 },
  "Gold":     { gen: 2, pokedex: pokedexGen2, locations: locationsGen2, guide: guideGen2, vms: vmsGen2 },
  "Silber":   { gen: 2, pokedex: pokedexGen2, locations: locationsGen2, guide: guideGen2, vms: vmsGen2 },
  "Kristall": { gen: 2, pokedex: pokedexGen2, locations: locationsGen2, guide: guideGen2, vms: vmsGen2 },
  "Rubin":    { gen: 3, pokedex: pokedexGen3, locations: locationsGen3, guide: guideGen3, vms: vmsGen3 },
  "Saphir":   { gen: 3, pokedex: pokedexGen3, locations: locationsGen3, guide: guideGen3, vms: vmsGen3 },
  "Smaragd":  { gen: 3, pokedex: pokedexGen3, locations: locationsGen3, guide: guideGen3, vms: vmsGen3 },
  "Feuerrot": { gen: 32, pokedex: pokedexGen3, locations: locationsGen32, guide: guideGen32, vms: vmsGen32 },
  "Blattgrün":{ gen: 32, pokedex: pokedexGen3, locations: locationsGen32, guide: guideGen32, vms: vmsGen32 },
  "Diamant":  { gen: 4, pokedex: pokedexGen4, locations: locationsGen4, guide: guideGen4, vms: vmsGen4 },
  "Perl":     { gen: 4, pokedex: pokedexGen4, locations: locationsGen4, guide: guideGen4, vms: vmsGen4 },
  "Platin":   { gen: 4, pokedex: pokedexGen4, locations: locationsGen4, guide: guideGen4, vms: vmsGen4 },
  "HeartGold":{ gen: 42, pokedex: pokedexGen4, locations: locationsGen42, guide: guideGen42, vms: vmsGen42 },
  "SoulSilver":{ gen: 42, pokedex: pokedexGen4, locations: locationsGen42, guide: guideGen42, vms: vmsGen42 },
  "Schwarz":  { gen: 5, pokedex: pokedexGen5, locations: locationsGen5, guide: guideGen5, vms: vmsGen5 },
  "Weiß":     { gen: 5, pokedex: pokedexGen5, locations: locationsGen5, guide: guideGen5, vms: vmsGen5 },
  "Schwarz 2":{ gen: 52, pokedex: pokedexGen5, locations: locationsGen52, guide: guideGen52, vms: vmsGen52 },
  "Weiß 2":   { gen: 52, pokedex: pokedexGen5, locations: locationsGen52, guide: guideGen52, vms: vmsGen52 },
  "X":        { gen: 6, pokedex: pokedexGen6, locations: locationsGen6, guide: guideGen6, vms: vmsGen6 },
  "Y":        { gen: 6, pokedex: pokedexGen6, locations: locationsGen6, guide: guideGen6, vms: vmsGen6 },
  "Omega Rubin": { gen: 62, pokedex: pokedexGen6, locations: locationsGen62, guide: guideGen62, vms: vmsGen62 },
  "Alpha Saphir":{ gen: 62, pokedex: pokedexGen6, locations: locationsGen62, guide: guideGen62, vms: vmsGen62 },
  "Sonne":    { gen: 7, pokedex: pokedexGen7, locations: locationsGen7, guide: guideGen7, vms: vmsGen7 },
  "Mond":     { gen: 7, pokedex: pokedexGen7, locations: locationsGen7, guide: guideGen7, vms: vmsGen7 },
  "Ultrasonne": { gen: 72, pokedex: pokedexGen7, locations: locationsGen72, guide: guideGen72, vms: vmsGen72 },
  "Ultramond":  { gen: 72, pokedex: pokedexGen7, locations: locationsGen72, guide: guideGen72, vms: vmsGen72 },
};

export default editionData;
