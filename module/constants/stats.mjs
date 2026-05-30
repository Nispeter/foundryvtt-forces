// Tablas centrales de características, rangos y habilidades.
// Toda referencia a stats/skills debe pasar por aquí en vez de re-declarar listas.

export const STAT_KEYS = [
  "fuerza", "aguante", "velocidad", "tecnica",
  "cognicion", "carisma", "instintos", "caos",
];

export const STAT_LABELS = {
  fuerza:    "Fuerza",
  aguante:   "Aguante",
  velocidad: "Velocidad",
  tecnica:   "Técnica",
  cognicion: "Cognición",
  carisma:   "Carisma",
  instintos: "Instintos",
  caos:      "Caos",
};

export const STAT_ABBR = {
  fuerza:    "Fr",
  aguante:   "Agu",
  velocidad: "Vel",
  tecnica:   "Tec",
  cognicion: "Cog",
  carisma:   "Car",
  instintos: "Ins",
  caos:      "Cao",
};

// puntos (0–8) → rango (F→SS) y modificador.
// Nueva tabla (backlog L4): SS=+30, S+=+20, S=+10. SS es alcanzable solo vía bonus o eventos.
export const RANK_LETTERS = ["F", "E", "D", "C", "B", "A", "S", "S+", "SS"];
export const RANK_FROM_PUNTOS = { 0: "F", 1: "E", 2: "D", 3: "C", 4: "B", 5: "A", 6: "S", 7: "S+", 8: "SS" };
export const MOD_FROM_PUNTOS  = { 0: -10, 1: -6, 2: -3, 3: 0, 4: 3, 5: 6, 6: 10, 7: 20, 8: 30 };

// Bonus que aporta cada slot de maestría según su rango asignado.
// El patrón natural extiende +1 por escalón sobre S: B=1, A=2, S=3, S+=4, SS=5.
export const MAEST_BONUS = { B: 1, A: 2, S: 3, "S+": 4, SS: 5 };

// Dado de vida según rango de Aguante. SS hereda 1d12 (cap natural del sistema).
export const VIDA_DADO_POR_RANK = { SS: 12, "S+": 12, S: 12, A: 10, B: 8, C: 6, D: 4, E: 4, F: 4 };

// Skill → característica base (modificador de la característica + experticia)
export const SKILL_STAT = {
  carga:           "fuerza",
  carrera:         "velocidad",
  motricidad:      "tecnica",
  controlCorporal: "tecnica",
  quickThinking:   "cognicion",
  investigacion:   "cognicion",
  conocimiento:    "cognicion",
  liderazgo:       "carisma",
  empatia:         "carisma",
  actuacion:       "carisma",
  percepcion:      "instintos",
  perspicacia:     "instintos",
  meditacion:      "caos",
  deteccion:       "caos",
};

export const SKILL_KEYS = Object.keys(SKILL_STAT);

export const SKILL_LABELS = {
  carga:           "Carga",
  carrera:         "Carrera",
  motricidad:      "Motricidad",
  controlCorporal: "Control corporal",
  quickThinking:   "Quick thinking",
  investigacion:   "Investigación",
  conocimiento:    "Conocimiento",
  liderazgo:       "Liderazgo",
  empatia:         "Empatía",
  actuacion:       "Actuación",
  percepcion:      "Percepción",
  perspicacia:     "Perspicacia",
  meditacion:      "Meditación",
  deteccion:       "Detección",
};

// Mapas reaccion → característica y etiqueta usados por rollReaccion.
export const REACCION_STAT = {
  esquivar:    "instintos",
  fortaleza:   "aguante",
  resistencia: "caos",
};
export const REACCION_LABEL = {
  esquivar:    "Esquivar",
  fortaleza:   "Fortaleza",
  resistencia: "Resistencia",
};

// Defensas: fórmulas (10 + mod1 + mod2, mínimo 1) viven en actor-data.mjs.
// Estas son las dos características que aportan a cada defensa.
export const DEFENSA_CORPORAL_STATS = ["aguante", "velocidad"];
export const DEFENSA_CAOTICA_STATS  = ["caos", "tecnica"];

// Movimiento base: max(10, 10*velMod + 30 + bonus). +20 ft a partir de 100 anillos.
export const MOVIMIENTO_BASE   = 30;
export const MOVIMIENTO_MINIMO = 10;
export const MOVIMIENTO_BONUS_ANILLOS = 20;
export const ANILLOS_PARA_BONUS = 100;

// Energía caótica: caos.modificador * 7 (máximo, suelo 0).
export const ENERGIA_CAOTICA_POR_CAOS = 7;

// clamp con compatibilidad V11–V13 (Math.clamped fue deprecado en V12+).
export const clampInt = (v, min, max) =>
  (typeof Math.clamp === "function" ? Math.clamp(v, min, max) : Math.clamped(v, min, max));

// MAX_PUNTOS es 8 desde L4 (rango SS). El field schema clampea hasta este valor.
export const MAX_PUNTOS = 8;

export function puntosToRank(p) { return RANK_FROM_PUNTOS[clampInt(p, 0, MAX_PUNTOS)] ?? "C"; }
export function puntosToMod(p)  { return MOD_FROM_PUNTOS[clampInt(p, 0, MAX_PUNTOS)] ?? 0; }
