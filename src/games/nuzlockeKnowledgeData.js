// Gemeinsame Wissensfragen für Training und Nuzlocke-Prüfung.
// Historische Verfügbarkeit wird über minGen und den Regelstand gefiltert.
import { getTypeMultiplierForGeneration, getGenerationTypes, getTypeLabel, shuffleItems } from "./typeTrainerData";
import { pokedex } from "../data/pokedex";

export const EXTRA_CATEGORIES = [
  { key: "items", label: "Wichtige Items" },
  { key: "offense", label: "Physisch oder speziell?" },
  { key: "speed", label: "Initiative-Vergleich" },
  { key: "evolution", label: "Entwicklungswissen" },
  { key: "moves", label: "Attackenmechaniken" },
  { key: "battle", label: "Wetter, Status & Kampf" },
];

export const IMPORTANT_ITEMS = [
  { id:"leftovers", name:"Überreste", minGen:2, effect:"Heilt am Rundenende einen Teil der maximalen KP." },
  { id:"focus-sash", name:"Fokusgurt", minGen:4, effect:"Lässt bei vollen KP einen sonst tödlichen Treffer mit 1 KP überstehen; wird verbraucht." },
  { id:"choice-scarf", name:"Wahlschal", minGen:4, effect:"Erhöht die Initiative um 50 %, legt aber auf eine Attacke fest." },
  { id:"choice-band", name:"Wahlband", minGen:3, effect:"Erhöht den physischen Angriff um 50 %, legt aber auf eine Attacke fest." },
  { id:"choice-specs", name:"Wahlglas", minGen:4, effect:"Erhöht den Spezial-Angriff um 50 %, legt aber auf eine Attacke fest." },
  { id:"life-orb", name:"Leben-Orb", minGen:4, effect:"Verstärkt schädigende Attacken um 30 %, verursacht danach normalerweise Rückstoßschaden." },
  { id:"eviolite", name:"Evolith", minGen:5, effect:"Erhöht Verteidigung und Spezial-Verteidigung eines entwicklungsfähigen Pokémon um 50 %." },
  { id:"assault-vest", name:"Offensivweste", minGen:6, effect:"Erhöht die Spezial-Verteidigung um 50 %, erlaubt aber normalerweise keine Status-Attacken." },
  { id:"sitrus-berry", name:"Tsitrubeere", minGen:4, effect:"Heilt bei höchstens der Hälfte der KP einmalig ein Viertel der maximalen KP." },
  { id:"lum-berry", name:"Prunusbeere", minGen:3, effect:"Heilt einmalig eine primäre Statusveränderung oder Verwirrung." },
  { id:"rocky-helmet", name:"Beulenhelm", minGen:5, effect:"Verletzt Gegner bei Kontaktattacken." },
  { id:"air-balloon", name:"Luftballon", minGen:5, effect:"Macht schwebend und schützt normalerweise vor Boden-Attacken, bis er platzt." },
  { id:"shed-shell", name:"Wechselhülle", minGen:4, effect:"Erlaubt den Wechsel trotz normalerweise festhaltender Fähigkeiten oder Attacken." },
  { id:"expert-belt", name:"Expertengurt", minGen:4, effect:"Verstärkt sehr effektive Treffer um 20 %." },
  { id:"heavy-duty-boots", name:"Plateauschuhe", minGen:8, effect:"Schützen vor den meisten Effekten von Entry Hazards beim Einwechseln." },
  { id:"safety-goggles", name:"Schutzbrille", minGen:6, effect:"Schützen vor Puder- und Sporen-Attacken sowie Wetterschaden durch Sandsturm und Hagel." },
  { id:"focus-band", name:"Fokus-Band", minGen:2, effect:"Kann mit einer Wahrscheinlichkeit von 10 % einen sonst tödlichen Treffer mit 1 KP überstehen." },
  { id:"quick-claw", name:"Flinkklaue", minGen:2, effect:"Ermöglicht manchmal einen Angriff vor einem sonst schnelleren Gegner in derselben Prioritätsstufe." },
  { id:"kings-rock", name:"King-Stein", minGen:2, effect:"Kann bei bestimmten Treffern den Gegner zurückschrecken lassen." },
  { id:"metal-coat", name:"Metallmantel", minGen:2, effect:"Verstärkt Stahl-Attacken und ermöglicht bestimmte Tauschentwicklungen." },
  { id:"amulet-coin", name:"Münzamulett", minGen:2, effect:"Verdoppelt das Preisgeld, wenn der Träger am Trainerkampf teilnimmt." },
  { id:"charcoal", name:"Holzkohle", minGen:2, effect:"Verstärkt Feuer-Attacken des Trägers." },
  { id:"mystic-water", name:"Zauberwasser", minGen:2, effect:"Verstärkt Wasser-Attacken des Trägers." },
  { id:"magnet", name:"Magnet", minGen:2, effect:"Verstärkt Elektro-Attacken des Trägers." },
  { id:"miracle-seed", name:"Wundersaat", minGen:2, effect:"Verstärkt Pflanzen-Attacken des Trägers." },
];

export const EVOLUTION_FACTS = [
  { id:"pikachu", minGen:1, target:"Raichu", trigger:"Donnerstein", from:"Pikachu" },
  { id:"eevee-fire", minGen:1, target:"Flamara", trigger:"Feuerstein", from:"Evoli" },
  { id:"eevee-water", minGen:1, target:"Aquana", trigger:"Wasserstein", from:"Evoli" },
  { id:"eevee-thunder", minGen:1, target:"Blitza", trigger:"Donnerstein", from:"Evoli" },
  { id:"machoke", minGen:1, target:"Machomei", trigger:"Tausch", from:"Maschock" },
  { id:"kadabra", minGen:1, target:"Simsala", trigger:"Tausch", from:"Kadabra" },
  { id:"haunter", minGen:1, target:"Gengar", trigger:"Tausch", from:"Alpollo" },
  { id:"clefairy", minGen:1, target:"Pixi", trigger:"Mondstein", from:"Piepi" },
  { id:"nidorina", minGen:1, target:"Nidoqueen", trigger:"Mondstein", from:"Nidorina" },
  { id:"nidorino", minGen:1, target:"Nidoking", trigger:"Mondstein", from:"Nidorino" },
  { id:"vulpix", minGen:1, target:"Vulnona", trigger:"Feuerstein", from:"Vulpix" },
  { id:"poliwhirl", minGen:1, target:"Quappo", trigger:"Wasserstein", from:"Quaputzi" },
  { id:"gloom-vileplume", minGen:1, target:"Giflor", trigger:"Blattstein", from:"Duflor" },
  { id:"golbat", minGen:2, target:"Iksbat", trigger:"Hohe Freundschaft", from:"Golbat" },
  { id:"eevee-day", minGen:2, target:"Psiana", trigger:"Hohe Freundschaft am Tag", from:"Evoli" },
  { id:"eevee-night", minGen:2, target:"Nachtara", trigger:"Hohe Freundschaft in der Nacht", from:"Evoli" },
  { id:"scyther", minGen:2, target:"Scherox", trigger:"Tausch mit Metallmantel", from:"Sichlor" },
  { id:"onix", minGen:2, target:"Stahlos", trigger:"Tausch mit Metallmantel", from:"Onix" },
  { id:"roselia", minGen:4, target:"Roserade", trigger:"Leuchtstein", from:"Roselia" },
  { id:"togetic", minGen:4, target:"Togekiss", trigger:"Leuchtstein", from:"Togetic" },
  { id:"kirlia", minGen:4, target:"Galagladi", trigger:"Männliches Kirlia + Funkelstein", from:"Kirlia" },
  { id:"porygon2", minGen:4, target:"Porygon-Z", trigger:"Tausch mit Dubiosdisc", from:"Porygon2" },
  { id:"eevee-ice", minGen:4, target:"Glaziola", trigger:"Eisfelsen in Gen 4–7; später auch Eisstein", from:"Evoli" },
  { id:"lampent", minGen:5, target:"Skelabra", trigger:"Finsterstein", from:"Laternecto" },
  { id:"minccino", minGen:5, target:"Chillabell", trigger:"Leuchtstein", from:"Picochilla" },
  { id:"eevee-fairy", minGen:6, target:"Feelinara", trigger:"Freundschaft, Fee-Attacke und passende Entwicklungsbedingung", from:"Evoli" },
  { id:"charjabug", minGen:7, target:"Donarion", trigger:"Besonderer Magnet-Ort (Gen 7); später Donnerstein", from:"Akkup" },
  { id:"bisharp", minGen:9, target:"Gladimperio", trigger:"Besiege drei Anführer-Gladiantri mit ihrem Emblem und steige ein Level", from:"Caesurio" },
];
// Für eindeutige Quizantworten werden nur Fakten mit EINEM klaren Trigger verwendet.
export const SIMPLE_EVOLUTIONS = EVOLUTION_FACTS.filter((fact) =>
  !["eevee-ice","eevee-fairy","charjabug","bisharp"].includes(fact.id));


// Fest überprüfte Levelaufstiege. Die Spezies müssen in der jeweiligen
// Generation bereits existieren und sich im normalen Hauptspiel entwickeln.
export const LEVEL_EVOLUTIONS = [
  { id:"bulbasaur", minGen:1, from:"Bisasam", target:"Bisaknosp", level:16 },
  { id:"ivysaur", minGen:1, from:"Bisaknosp", target:"Bisaflor", level:32 },
  { id:"charmander", minGen:1, from:"Glumanda", target:"Glutexo", level:16 },
  { id:"charmeleon", minGen:1, from:"Glutexo", target:"Glurak", level:36 },
  { id:"squirtle", minGen:1, from:"Schiggy", target:"Schillok", level:16 },
  { id:"wartortle", minGen:1, from:"Schillok", target:"Turtok", level:36 },
  { id:"caterpie", minGen:1, from:"Raupy", target:"Safcon", level:7 },
  { id:"metapod", minGen:1, from:"Safcon", target:"Smettbo", level:10 },
  { id:"weedle", minGen:1, from:"Hornliu", target:"Kokuna", level:7 },
  { id:"kakuna", minGen:1, from:"Kokuna", target:"Bibor", level:10 },
  { id:"pidgey", minGen:1, from:"Taubsi", target:"Tauboga", level:18 },
  { id:"pidgeotto", minGen:1, from:"Tauboga", target:"Tauboss", level:36 },
  { id:"magikarp", minGen:1, from:"Karpador", target:"Garados", level:20 },
  { id:"dratini", minGen:1, from:"Dratini", target:"Dragonir", level:30 },
  { id:"dragonair", minGen:1, from:"Dragonir", target:"Dragoran", level:55 },
  { id:"abra", minGen:1, from:"Abra", target:"Kadabra", level:16 },
  { id:"gastly", minGen:1, from:"Nebulak", target:"Alpollo", level:25 },
  { id:"geodude", minGen:1, from:"Kleinstein", target:"Georok", level:25 },
  { id:"chikorita", minGen:2, from:"Endivie", target:"Lorblatt", level:16 },
  { id:"bayleef", minGen:2, from:"Lorblatt", target:"Meganie", level:32 },
  { id:"cyndaquil", minGen:2, from:"Feurigel", target:"Igelavar", level:14 },
  { id:"quilava", minGen:2, from:"Igelavar", target:"Tornupto", level:36 },
  { id:"totodile", minGen:2, from:"Karnimani", target:"Tyracroc", level:18 },
  { id:"croconaw", minGen:2, from:"Tyracroc", target:"Impergator", level:30 },
  { id:"mareep", minGen:2, from:"Voltilamm", target:"Waaty", level:15 },
  { id:"flaaffy", minGen:2, from:"Waaty", target:"Ampharos", level:30 },
  { id:"treecko", minGen:3, from:"Geckarbor", target:"Reptain", level:16 },
  { id:"grovyle", minGen:3, from:"Reptain", target:"Gewaldro", level:36 },
  { id:"torchic", minGen:3, from:"Flemmli", target:"Jungglut", level:16 },
  { id:"combusken", minGen:3, from:"Jungglut", target:"Lohgock", level:36 },
  { id:"mudkip", minGen:3, from:"Hydropi", target:"Moorabbel", level:16 },
  { id:"marshtomp", minGen:3, from:"Moorabbel", target:"Sumpex", level:36 },
  { id:"ralts", minGen:3, from:"Trasla", target:"Kirlia", level:20 },
  { id:"kirlia", minGen:3, from:"Kirlia", target:"Guardevoir", level:30 },
  { id:"turtwig", minGen:4, from:"Chelast", target:"Chelcarain", level:18 },
  { id:"grotle", minGen:4, from:"Chelcarain", target:"Chelterrar", level:32 },
  { id:"chimchar", minGen:4, from:"Panflam", target:"Panpyro", level:14 },
  { id:"monferno", minGen:4, from:"Panpyro", target:"Panferno", level:36 },
  { id:"piplup", minGen:4, from:"Plinfa", target:"Pliprin", level:16 },
  { id:"prinplup", minGen:4, from:"Pliprin", target:"Impoleon", level:36 },
  { id:"snivy", minGen:5, from:"Serpifeu", target:"Efoserp", level:17 },
  { id:"servine", minGen:5, from:"Efoserp", target:"Serpiroyal", level:36 },
  { id:"tepig", minGen:5, from:"Floink", target:"Ferkokel", level:17 },
  { id:"pignite", minGen:5, from:"Ferkokel", target:"Flambirex", level:36 },
  { id:"oshawott", minGen:5, from:"Ottaro", target:"Zwottronin", level:17 },
  { id:"dewott", minGen:5, from:"Zwottronin", target:"Admurai", level:36 },
  { id:"chespin", minGen:6, from:"Igamaro", target:"Igastarn", level:16 },
  { id:"quilladin", minGen:6, from:"Igastarn", target:"Brigaron", level:36 },
  { id:"fennekin", minGen:6, from:"Fynx", target:"Rutena", level:16 },
  { id:"braixen", minGen:6, from:"Rutena", target:"Fennexis", level:36 },
  { id:"froakie", minGen:6, from:"Froxy", target:"Amphizel", level:16 },
  { id:"frogadier", minGen:6, from:"Amphizel", target:"Quajutsu", level:36 },
  { id:"rowlet", minGen:7, from:"Bauz", target:"Arboretoss", level:17 },
  { id:"dartrix", minGen:7, from:"Arboretoss", target:"Silvarro", level:34 },
  { id:"litten", minGen:7, from:"Flamiau", target:"Miezunder", level:17 },
  { id:"torracat", minGen:7, from:"Miezunder", target:"Fuegro", level:34 },
  { id:"popplio", minGen:7, from:"Robball", target:"Marikeck", level:17 },
  { id:"brionne", minGen:7, from:"Marikeck", target:"Primarene", level:34 },
  { id:"grookey", minGen:8, from:"Chimpep", target:"Chimstix", level:16 },
  { id:"thwackey", minGen:8, from:"Chimstix", target:"Gortrom", level:35 },
  { id:"scorbunny", minGen:8, from:"Hopplo", target:"Kickerlo", level:16 },
  { id:"raboot", minGen:8, from:"Kickerlo", target:"Liberlo", level:35 },
  { id:"sobble", minGen:8, from:"Memmeon", target:"Phlegleon", level:16 },
  { id:"drizzile", minGen:8, from:"Phlegleon", target:"Intelleon", level:35 },
  { id:"sprigatito", minGen:9, from:"Felori", target:"Feliospa", level:16 },
  { id:"floragato", minGen:9, from:"Feliospa", target:"Maskagato", level:36 },
  { id:"fuecoco", minGen:9, from:"Krokel", target:"Lokroko", level:16 },
  { id:"crocalor", minGen:9, from:"Lokroko", target:"Skelokrok", level:36 },
  { id:"quaxly", minGen:9, from:"Kwaks", target:"Fuentente", level:16 },
  { id:"quaxwell", minGen:9, from:"Fuentente", target:"Bailonda", level:36 },
];

export const MOVE_FACTS = [
  { key:"earthquake", name:"Erdbeben", type:"ground", minGen:1, category:"physical" },
  { key:"surf", name:"Surfer", type:"water", minGen:1, category:"special" },
  { key:"thunderbolt", name:"Donnerblitz", type:"electric", minGen:1, category:"special" },
  { key:"ice-beam", name:"Eisstrahl", type:"ice", minGen:1, category:"special" },
  { key:"flamethrower", name:"Flammenwurf", type:"fire", minGen:1, category:"special" },
  { key:"hyper-beam", name:"Hyperstrahl", type:"normal", minGen:1, category:"special" },
  { key:"quick-attack", name:"Ruckzuckhieb", type:"normal", minGen:1, category:"physical" },
  { key:"rock-slide", name:"Steinhagel", type:"rock", minGen:1, category:"physical" },
  { key:"toxic", name:"Toxin", type:"poison", minGen:1, category:"status" },
  { key:"thunder-wave", name:"Donnerwelle", type:"electric", minGen:1, category:"status" },
  { key:"swords-dance", name:"Schwerttanz", type:"normal", minGen:1, category:"status" },
  { key:"shadow-ball", name:"Spukball", type:"ghost", minGen:2, category:"special" },
  { key:"crunch", name:"Knirscher", type:"dark", minGen:2, category:"physical" },
  { key:"iron-tail", name:"Eisenschweif", type:"steel", minGen:2, category:"physical" },
  { key:"thunder-punch", name:"Donnerschlag", type:"electric", minGen:1, category:"physical" },
  { key:"fire-punch", name:"Feuerschlag", type:"fire", minGen:1, category:"physical" },
  { key:"ice-punch", name:"Eishieb", type:"ice", minGen:1, category:"physical" },
  { key:"dragon-claw", name:"Drachenklaue", type:"dragon", minGen:3, category:"physical" },
  { key:"will-o-wisp", name:"Irrlicht", type:"fire", minGen:3, category:"status" },
  { key:"leaf-blade", name:"Laubklinge", type:"grass", minGen:3, category:"physical" },
  { key:"aura-sphere", name:"Aurasphäre", type:"fighting", minGen:4, category:"special" },
  { key:"dark-pulse", name:"Finsteraura", type:"dark", minGen:4, category:"special" },
  { key:"stone-edge", name:"Steinkante", type:"rock", minGen:4, category:"physical" },
  { key:"energy-ball", name:"Energieball", type:"grass", minGen:4, category:"special" },
  { key:"close-combat", name:"Nahkampf", type:"fighting", minGen:4, category:"physical" },
  { key:"moonblast", name:"Mondgewalt", type:"fairy", minGen:6, category:"special" },
  { key:"play-rough", name:"Knuddler", type:"fairy", minGen:6, category:"physical" },
  { key:"scald", name:"Siedewasser", type:"water", minGen:5, category:"special" },
];
const EARLY_PHYSICAL = new Set(["normal","fighting","poison","ground","flying","bug","rock","ghost","steel"]);
export function moveDamageClass(move, gen) {
  if (move.category === "status") return "status";
  if (gen <= 3) return EARLY_PHYSICAL.has(move.type) ? "physical" : "special";
  return move.category;
}
export const FINAL_EVOLUTION_IDS = [
  3,6,9,18,26,34,38,59,65,68,76,94,112,115,130,131,143,149,
  154,157,160,169,181,186,196,197,205,208,212,214,230,232,242,248,
  254,257,260,282,289,295,306,310,330,334,350,373,376,384,
  389,392,395,398,405,407,409,411,416,423,428,430,435,442,445,448,450,452,462,464,466,467,468,469,470,471,472,473,474,475,477,478,
  497,500,503,508,510,512,514,516,518,521,523,526,530,534,537,542,545,547,549,553,558,560,563,565,567,569,571,573,576,579,581,584,586,589,593,596,598,601,604,609,612,614,617,620,623,628,630,631,635,637,
  652,655,658,660,663,666,668,671,673,675,676,678,681,683,685,687,689,691,693,695,697,699,700,701,702,703,706,707,709,711,713,715,
  724,727,730,733,735,738,740,743,745,748,750,752,754,758,760,763,765,766,768,770,773,775,776,778,780,781,784,793,794,795,796,797,798,799,800,801,802,804,805,806,807,809,
  812,815,818,820,823,826,828,830,832,834,836,839,841,842,844,845,847,849,851,853,855,858,861,862,863,864,866,867,869,870,871,873,874,875,876,877,879,880,881,882,883,884,887,888,889,890,892,893,894,895,896,897,898,905,
  908,911,914,916,918,920,923,925,927,930,934,936,937,941,943,945,947,949,952,954,956,959,961,964,966,968,970,973,975,977,979,981,982,983,985,986,987,988,989,990,991,992,993,994,995,998,1000,
];
// Only species we have explicitly checked as final-stage species are used.
export function finalEvolutionPool(pokemonPool) {
  const allowed = new Set(FINAL_EVOLUTION_IDS);
  return pokemonPool.filter((pokemon) => allowed.has(pokemon.dexId));
}

export const BATTLE_FACTS = [
  { id:"rain-water", minGen:2, question:"Regen ist aktiv: Wie verändert sich die Stärke einer gewöhnlichen Wasser-Attacke?", options:["Sie steigt um 50 %.","Sie sinkt um 50 %.","Sie verdoppelt sich.","Sie bleibt unverändert."],correct:0,explanation:"Regen erhöht die Stärke von Wasser-Attacken normalerweise um 50 %." },
  { id:"rain-fire", minGen:2, question:"Regen ist aktiv: Wie verändert sich die Stärke einer gewöhnlichen Feuer-Attacke?", options:["Sie sinkt um 50 %.","Sie steigt um 50 %.","Sie verdoppelt sich.","Sie bleibt unverändert."],correct:0,explanation:"Regen halbiert die Stärke gewöhnlicher Feuer-Attacken." },
  { id:"sun-fire", minGen:2, question:"Sonnenschein ist aktiv: Was geschieht mit gewöhnlichen Feuer-Attacken?", options:["Ihre Stärke steigt um 50 %.","Ihre Stärke sinkt um 50 %.","Sie werden immer kritisch.","Sie verlieren ihren Typ."],correct:0,explanation:"Sonne verstärkt Feuer-Attacken normalerweise um 50 %." },
  { id:"sun-water", minGen:2, question:"Sonnenschein ist aktiv: Was passiert mit gewöhnlichen Wasser-Attacken?", options:["Ihre Stärke sinkt um 50 %.","Ihre Stärke steigt um 50 %.","Sie werden neutral.","Sie treffen immer zweimal."],correct:0,explanation:"Sonne schwächt gewöhnliche Wasser-Attacken um 50 %." },
  { id:"swift-swim", minGen:3, question:"Was macht Wassertempo während Regen mit der Initiative?", options:["Sie verdoppelt sich.","Sie halbiert sich.","Sie steigt um eine Stufe.","Es gibt keinen Bonus."],correct:0,explanation:"Wassertempo verdoppelt die Initiative bei Regen." },
  { id:"chlorophyll", minGen:3, question:"Was macht Chlorophyll bei Sonnenschein?", options:["Die Initiative verdoppelt sich.","Die Verteidigung verdoppelt sich.","Die KP regenerieren sofort.","Der Angriff wird immun gegen Wasser."],correct:0,explanation:"Chlorophyll verdoppelt die Initiative bei Sonne." },
  { id:"burn", minGen:2, question:"Welche typische Auswirkung hat eine Verbrennung bei den meisten Pokémon?",options:["Sie schwächt physischen Angriffsschaden.","Sie halbiert die Initiative.","Sie blockiert alle Status-Attacken.","Sie verdoppelt Spezial-Angriff."],correct:0,explanation:"Verbrennung schwächt normalerweise den physischen Schaden. Ausnahmen durch Fähigkeiten und Attacken existieren." },
  { id:"paralysis-old", minGen:1,maxGen:6, question:"Wie stark reduziert Paralyse bis einschließlich Generation 6 normalerweise die Initiative?", options:["Auf ein Viertel.","Auf die Hälfte.","Um 10 %.","Gar nicht."],correct:0,explanation:"Bis Generation 6 beträgt die Initiative bei Paralyse normalerweise nur 25 %." },
  { id:"paralysis-new", minGen:7, question:"Wie stark reduziert Paralyse ab Generation 7 normalerweise die Initiative?", options:["Auf die Hälfte.","Auf ein Viertel.","Auf ein Zehntel.","Gar nicht."],correct:0,explanation:"Ab Generation 7 wird die Initiative bei Paralyse normalerweise halbiert." },
  { id:"stealth-rocks", minGen:4, question:"Ohne Schutz und bei vollen KP: Wie viel verliert ein Feuer/Flug-Pokémon durch Tarnsteine beim Einwechseln?", options:["50 % der maximalen KP.","25 % der maximalen KP.","12,5 % der maximalen KP.","Keine KP."],correct:0,explanation:"Feuer/Flug hat eine vierfache Gesteinsschwäche: Tarnsteine verursachen 50 %." },
  { id:"stealth-neutral", minGen:4, question:"Ein Pokémon wird neutral von Gestein getroffen. Wie viele maximale KP kostet Tarnsteine ohne Schutz?", options:["12,5 %.","25 %.","50 %.","0 %."],correct:0,explanation:"Tarnsteine verursachen bei neutraler Gesteinswirkung 1/8 der maximalen KP." },
  { id:"priority", minGen:1, question:"Bei ansonsten gleichen Bedingungen: Welche Attacke hat die höhere Priorität?", options:["Ruckzuckhieb","Erdbeben","Surfer","Flammenwurf"],correct:0,explanation:"Ruckzuckhieb hat Priorität +1, die übrigen genannten Attacken +0." },
  { id:"protect", minGen:2, question:"Welchen Nutzen hat Schutzschild normalerweise?", options:["Es blockiert viele gegen das Pokémon gerichtete Attacken in dieser Runde.","Es erhöht dauerhaft den Angriff.","Es heilt die Hälfte der KP.","Es verhindert jeden zukünftigen Wechsel."],correct:0,explanation:"Schutzschild schützt für eine Runde gegen viele Attacken; wiederholte Nutzung kann scheitern." },
  { id:"sandstorm-rock", minGen:4, question:"Was geschieht mit der Spezial-Verteidigung von Gesteins-Pokémon in einem Sandsturm (ab Gen 4)?",
    options:["Sie steigt um 50 %.","Sie wird halbiert.","Sie ist immer verdoppelt.","Sie bleibt unverändert."],correct:0,
    explanation:"Seit Generation 4 erhöht Sandsturm die Spezial-Verteidigung von Gesteins-Pokémon um 50 %." },
  { id:"solar-beam-rain", minGen:2, question:"Welche Besonderheit hat Solarstrahl bei Regen ohne Spezialeffekte?",
    options:["Die Attacke benötigt normalerweise eine Aufladerunde und hat verringerte Stärke.","Die Attacke trifft zweimal.","Die Attacke wird vom Typ Wasser.","Die Attacke hat Priorität +1."],correct:0,
    explanation:"Bei Regen muss Solarstrahl normalerweise aufladen und verursacht nur halbe Stärke." },
  { id:"sleep", minGen:1, question:"Was kann ein schlafendes Pokémon normalerweise nicht?",
    options:["Gewöhnliche Attacken ohne besondere Schlaf-Ausnahme einsetzen.","Ein Item tragen.","Schaden erleiden.","Vom gegnerischen Pokémon getroffen werden."],correct:0,
    explanation:"Schlaf verhindert gewöhnliche Attacken; Schnarcher und Schlafrede sind bekannte Ausnahmen." },
  { id:"confusion", minGen:1, question:"Was kann bei einem verwirrten Pokémon passieren?",
    options:["Es fügt sich selbst Schaden zu, statt anzugreifen.","Es verliert dauerhaft seinen Typ.","Es ist immer immun gegen Boden.","Es kann nie ausgewechselt werden."],correct:0,
    explanation:"Bei Verwirrung kann ein Pokémon seinen Zug verlieren und sich stattdessen selbst schaden." },
  { id:"spikes-levitate", minGen:3, question:"Ein Pokémon mit Schwebe wechselt in einen Kampf mit Stachler. Was passiert normalerweise?",
    options:["Es erleidet keinen Stachler-Schaden.","Stachler treffen es doppelt.","Es verliert immer die Hälfte der KP.","Stachler wechseln seinen Typ."],correct:0,
    explanation:"Stachler betreffen normalerweise nur geerdete Pokémon." },
  { id:"taunt", minGen:3, question:"Was verhindert Verhöhner beim betroffenen Pokémon normalerweise?",
    options:["Status-Attacken einzusetzen.","Jegliche direkte Schadensattacke einzusetzen.","Seine Fähigkeit zu nutzen.","Ein anderes Pokémon im Team zu besitzen."],correct:0,
    explanation:"Verhöhner blockiert die meisten Status-Attacken für einige Runden." },
  { id:"priority-extreme", minGen:2, question:"Welche dieser Attacken hat normalerweise die höchste Priorität?",
    options:["Turbotempo","Ruckzuckhieb","Erdbeben","Eisstrahl"],correct:0,
    explanation:"Turbotempo hat Priorität +2 und Ruckzuckhieb +1." },
  { id:"psychic-dark", minGen:2, question:"Wie viel Schaden verursacht eine gewöhnliche Psycho-Attacke gegen ein reines Unlicht-Pokémon?",
    options:["0×","½×","1×","2×"],correct:0,
    explanation:"Unlicht ist gegen Psycho-Attacken immun." },
  { id:"roost-flying", minGen:4, question:"Was ändert Ruheort für den Rest der Runde normalerweise bei einem Flug-Pokémon?",
    options:["Seine Flug-Typ-Eigenschaft für die Effektivitätsberechnung entfällt vorübergehend.","Es wird dauerhaft vom Typ Feuer.","Seine Initiative verdoppelt sich.","Es erhält eine Immunität gegen alle Attacken."],correct:0,
    explanation:"Ruheort entfernt während der Runde den Flug-Typ für die Typenberechnung, wenn der Effekt eintritt." },
  { id:"toxic-spikes", minGen:4, question:"Welche Pokémon entfernen Giftspitzen typischerweise beim Einwechseln?", options:["Geerdete Gift-Pokémon","Alle Stahl-Pokémon","Alle Flug-Pokémon","Alle Drachen-Pokémon"],correct:0,explanation:"Geerdete Gift-Pokémon absorbieren Giftspitzen beim Einwechseln." },
];
export function availableBattleFacts(gen) {
  return BATTLE_FACTS.filter((fact) => fact.minGen <= gen && (!fact.maxGen || fact.maxGen >= gen));
}

function pickDifferent(array, correct, count) {
  return shuffleItems(array.filter((item) => item !== correct)).slice(0,count);
}
function asOptions(labels, correctLabel) {
  return {
    options: shuffleItems(labels).map((label) => ({ key: label, label })),
    correct: [correctLabel],
  };
}
export function makeItemQuestion(item, ruleGen, difficulty="normal") {
  const available = IMPORTANT_ITEMS.filter((candidate) => candidate.minGen <= ruleGen);
  const reverse = Math.random() >= 0.5;
  const count = difficulty === "hard" ? 6 : 4;
  const wrong = pickDifferent(available, item, count-1);
  const labels = reverse ? [item.name, ...wrong.map((x) => x.name)] : [item.effect, ...wrong.map((x) => x.effect)];
  const correctLabel = reverse ? item.name : item.effect;
  return {
    category:"items", title:reverse ? "Welches Item bewirkt Folgendes?" : "Was bewirkt " + item.name + "?",
    questionNote:reverse ? item.effect : "",
    // Item icons from the original PokeAPI sprites repository.
    itemImage:reverse ? null : "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/" + item.id + ".png",
    ...asOptions(labels,correctLabel),
    explanation:item.name + ": " + item.effect,
  };
}
export function makeEvolutionQuestion(fact, ruleGen, difficulty="normal", variant="mixed") {
  const count = difficulty === "hard" ? 6 : 4;
  if (variant === "target") {
    return {
      category: "evolution",
      responseType: "pokemon-name",
      title: "In welches Pokémon entwickelt sich " + fact.from + "?",
      correct: [fact.target],
      explanation: fact.from + " entwickelt sich zu " + fact.target + (fact.level
        ? " (ab Level " + fact.level + ")." : " (" + fact.trigger + ")."),
    };
  }
  if (fact.level) {
    const levelCandidates = LEVEL_EVOLUTIONS.filter((entry) => entry.minGen <= ruleGen);
    // Nahe Entwicklungslevel sind schwierigere Ablenkungen.
    const levels = [...new Set([
      ...levelCandidates.map((entry) => entry.level),
      ...Array.from({length:8}, (_,i) => fact.level+(i-4)*2),
    ])].filter((level) => level !== fact.level && level >= 5 && level <= 70);
    const sorted = levels.sort((a,b) => Math.abs(a-fact.level)-Math.abs(b-fact.level));
    const wrong = difficulty === "easy"
      ? shuffleItems(sorted).slice(0,count-1)
      : sorted.slice(0,count-1);
    const labels = [fact.level, ...wrong].map((level) => "Level " + level);
    return {
      category:"evolution",
      title: "Ab welchem Level entwickelt sich " + fact.from + " zu " + fact.target + "?",
      ...asOptions(labels,"Level "+fact.level),
      explanation:fact.from+" entwickelt sich ab Level "+fact.level+" zu "+fact.target+".",
    };
  }
  const candidates = SIMPLE_EVOLUTIONS.filter((entry) => entry.minGen <= ruleGen);
  const reverse = Math.random() >= .75;
  if (reverse) {
    return {
      category: "evolution",
      responseType: "pokemon-name",
      title: "Zu welchem Pokémon entwickelt sich " + fact.from + " durch " + fact.trigger + "?",
      correct: [fact.target],
      explanation: fact.from + " → " + fact.target + " (" + fact.trigger + ").",
    };
  }
  const triggers = [...new Set(candidates.map((entry) => entry.trigger))];
  const wrong = shuffleItems(triggers.filter((trigger) => trigger !== fact.trigger)).slice(0,count-1);
  return {
    category:"evolution",
    title:"Wie entwickelt sich "+fact.from+" zu "+fact.target+"?",
    ...asOptions([fact.trigger,...wrong],fact.trigger),
    explanation:fact.from+" wird durch "+fact.trigger+" zu "+fact.target+".",
  };
}
const MOVE_CLASSES = [
  { key:"physical", label:"Physisch" },
  { key:"special", label:"Speziell" },
  { key:"status", label:"Status" },
  { key:"variable", label:"Keine feste Schadensklasse" },
];
// Im einfachen Test wechseln sich Typ-Erkennung und Schadensklasse ab.
export function makeMoveQuestion(move, ruleGen, variant = "class", difficulty = "normal") {
  if (variant === "type") {
    const candidates = getGenerationTypes(ruleGen);
    if (!candidates.some((type) => type.key === move.type)) return null;
    const wrong = shuffleItems(candidates.filter((type) => type.key !== move.type));
    const total = difficulty === "hard" ? 6 : 4;
    const options = shuffleItems([
      { key: move.type, type: move.type },
      ...wrong.slice(0, total - 1).map((type) => ({ key: type.key, type: type.key })),
    ]);
    return {
      category: "moves",
      title: "Welchen Typ hat die Attacke " + move.name + "?",
      options,
      correct: [move.type],
      explanation: move.name + " ist eine Attacke vom Typ " + getTypeLabel(move.type) + ".",
    };
  }
  const moveClass = moveDamageClass(move, ruleGen);
  return {
    category:"moves", title:"Ist " + move.name + " physisch, speziell oder eine Status-Attacke?",
    options:shuffleItems(MOVE_CLASSES).map((entry) => ({key:entry.key,label:entry.label})),
    correct:[moveClass],
    explanation:move.name + " gehört in Generation " + ruleGen + " zur Klasse " +
      MOVE_CLASSES.find((item) => item.key === moveClass).label + (ruleGen<=3 && move.category!=="status"
      ? " (vor Gen 4 wurde die Schadensklasse nach Typ bestimmt)." : "."),
  };
}
export function makeBattleQuestion(fact) {
  const correctLabel = fact.options[fact.correct];
  return {
    category:"battle", title:fact.question,
    ...asOptions(fact.options,correctLabel),
    explanation:fact.explanation,
  };
}
function statValue(pokemon, field) {
  const value=Number(pokemon?.stats?.[field]);
  return Number.isFinite(value)&&value>0?value:null;
}
export function makeOffenseQuestion(pokemon,difficulty="normal") {
  const atk=statValue(pokemon,"attack"),spa=statValue(pokemon,"special-attack");
  if(atk===null||spa===null)return null;
  const difference=Math.abs(atk-spa);
  if(difference<(difficulty==="easy"?25:1))return null;
  const correct=atk===spa?"equal":atk>spa?"physical":"special";
  return {
    category:"offense",title:"Ist " + pokemon.name + " von den aktuellen Basiswerten eher physischer oder spezieller Angreifer?",
    pokemon,options:[
      {key:"physical",label:"Physisch"},
      {key:"special",label:"Speziell"},
      {key:"equal",label:"Gleiche Angriffswerte"},
      {key:"zero",label:"Beide Angriffswerte sind 0"},
    ],correct:[correct],
    explanation:"Basis-Angriff: " + atk + " · Basis-Spezial-Angriff: " + spa +
      ". Gesucht ist der höhere Basiswert, nicht die tatsächliche Teamrolle.",
  };
}
export function makeSpeedQuestion(left,right,difficulty="normal") {
  const a=statValue(left,"speed"),b=statValue(right,"speed");
  if(a===null||b===null)return null;
  const gap=Math.abs(a-b);
  if(!gap || (difficulty==="easy"&&gap<25) || (difficulty==="hard"&&gap>30))return null;
  return {
    category:"speed",
    title:"Wer besitzt den höheren aktuellen Initiative-Basiswert (ohne EV, Wesen oder Items)?",
    pokemonPair:[left,right],
    options:[
      {key:String(left.id),label:left.name},
      {key:String(right.id),label:right.name},
      {key:"equal",label:"Gleiche Initiative"},
      {key:"unknown",label:"Mit Basiswerten nicht vergleichbar"},
    ],
    correct:[String(a>b?left.id:right.id)],
    explanation:left.name+": "+a+" Initiative · "+right.name+": "+b+" Initiative (Basiswerte).",
  };
}
