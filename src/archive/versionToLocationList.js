// src/versionToLocationList.js
import gen1 from "../locations/locations_gen1";
import gen2 from "../locations/locations_gen2";
import gen3 from "../locations/locations_gen3";
import gen4 from "../locations/locations_gen4";
import gen5 from "../locations/locations_gen5";
import gen6 from "../locations/locations_gen6";
import gen32 from "../locations/locations_gen32";
import gen42 from "../locations/locations_gen42";
import gen52 from "../locations/locations_gen52";
import gen62 from "../locations/locations_gen62";
import gen7 from "../locations/locations_gen7";
import gen72 from "../locations/locations_gen72";

const versionToLocationList = {
  "Rot": gen1,
  "Blau": gen1,
  "Gelb": gen1,
  "Silber": gen2,
  "Gold": gen2,
  "Kristall": gen2,
  "Rubin": gen3,
  "Saphir": gen3,
  "Smaragd": gen3,
  "Feuerrot": gen32,
  "Blattgrün": gen32,
  "Diamant": gen4,
  "Perl": gen4,
  "Platin": gen4,
  "HeartGold": gen42,
  "SoulSilver": gen42,
  "Schwarz": gen5,
  "Weiß": gen5,
  "Schwarz 2": gen52,
  "Weiß 2": gen52,
  "X": gen6,
  "Y": gen6,
  "Omega Rubin": gen62,
  "Alpha Saphir": gen62,
  "Sonne": gen7,
  "Mond": gen7,
  "Ultrasonne": gen72,
  "Ultramond": gen72,
};

export default versionToLocationList;
s