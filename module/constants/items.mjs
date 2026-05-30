// Constantes relacionadas con objetos: categorías, secciones, buffs y opciones de escala.

export const ITEM_CATEGORIAS = [
  { value: "arma",       label: "Arma" },
  { value: "armadura",   label: "Armadura" },
  { value: "equipo",     label: "Equipo / Objeto" },
  { value: "consumible", label: "Consumible" },
  { value: "feat",       label: "Feat / Clase" },
  { value: "caos",       label: "Caos Control" },
  { value: "tarjeta",    label: "Tarjeta" },
  { value: "loot",       label: "Loot" },
];

export const CAT_LABEL = {
  arma: "Arma", armadura: "Armadura", equipo: "Equipo", consumible: "Consumible",
  feat: "Feat / Clase", caos: "Caos Control", tarjeta: "Tarjeta", loot: "Loot",
};

export const CAT_CSS = {
  arma: "fci-cat-arma", armadura: "fci-cat-armor", equipo: "fci-cat-equipo",
  consumible: "fci-cat-consumible", feat: "fci-cat-feat", caos: "fci-cat-caos",
  tarjeta: "fci-cat-tarjeta", loot: "fci-cat-loot",
};

// Class para el sidebar/chip en sheet (helper catClass).
export const CAT_CLASS_HELPER = {
  arma: "cat-arma", armadura: "cat-armor", equipo: "cat-equipo",
  consumible: "cat-consumible", feat: "cat-feat", caos: "cat-caos",
  tarjeta: "cat-tarjeta", loot: "cat-loot",
};

// Items que se auto-equipan al crearse (no requieren equipar manual).
export const AUTO_EQUIP_CATS = ["arma", "feat", "caos", "armadura"];

// Secciones del item-sheet en el orden de presentación.
// "bonEstadistica" se eliminó del listado público (deprecated, usar Buffs).
// Sigue funcionando si está habilitada en items legacy, pero no aparece en
// "Añadir sección" ni se auto-habilita en items nuevos.
export const ALL_SECTIONS = [
  { key: "danioEfecto",    label: "🗡 Daño" },
  { key: "hit",            label: "⊕ Hit / Ataque" },
  { key: "caosControl",    label: "✦ Caos Control" },
  { key: "savingThrow",    label: "🛡 Saving Throw" },
  { key: "featClase",      label: "⭐ Feat / Clase" },
  { key: "duracion",       label: "⏱ Duración" },
  { key: "rango",          label: "📐 Rango" },
  { key: "usos",           label: "🔄 Usos" },
  { key: "buffs",          label: "↑ Buffs" },
  { key: "dadoLibre",      label: "🎲 Dado libre" },
  { key: "areaEfecto",     label: "💥 Área de efecto" },
  { key: "descripcion",    label: "📝 Descripción" },
];

// Qué secciones se activan por defecto al crear un objeto de cada categoría.
// Armadura ya no auto-incluye bonEstadistica (deprecated — usar Buffs).
export const CAT_DEFAULTS = {
  arma:       ["danioEfecto", "hit", "descripcion"],
  armadura:   ["descripcion", "buffs"],
  equipo:     ["descripcion"],
  consumible: ["descripcion", "usos"],
  feat:       ["descripcion", "featClase"],
  caos:       ["descripcion", "caosControl", "danioEfecto"],
  tarjeta:    ["descripcion"],
  loot:       ["descripcion"],
};

// Posibles destinos de un buff (path bajo system del actor).
// `group` agrupa el dropdown en <optgroup> según L16. El orden del grupo
// es el orden de aparición de la primera entrada del grupo en este array.
export const BUFF_TARGETS = [
  // Características.
  { value: "caracteristicas.fuerza.bonus",    label: "Fuerza (bonus)",    group: "Características" },
  { value: "caracteristicas.aguante.bonus",   label: "Aguante (bonus)",   group: "Características" },
  { value: "caracteristicas.velocidad.bonus", label: "Velocidad (bonus)", group: "Características" },
  { value: "caracteristicas.tecnica.bonus",   label: "Técnica (bonus)",   group: "Características" },
  { value: "caracteristicas.cognicion.bonus", label: "Cognición (bonus)", group: "Características" },
  { value: "caracteristicas.carisma.bonus",   label: "Carisma (bonus)",   group: "Características" },
  { value: "caracteristicas.instintos.bonus", label: "Instintos (bonus)", group: "Características" },
  { value: "caracteristicas.caos.bonus",      label: "Caos (bonus)",      group: "Características" },

  // Defensas y movimiento.
  { value: "defensas.defensaCorporal", label: "Def. Corporal",  group: "Defensas" },
  { value: "defensas.defensaCaotica",  label: "Def. Caótica",   group: "Defensas" },
  { value: "movimiento",               label: "Movimiento (ft)", group: "Defensas" },

  // Recursos (máximos).
  { value: "defensas.vida.max",           label: "Vida (máx.)", group: "Recursos" },
  { value: "defensas.energiaCaotica.max", label: "EC (máx.)",   group: "Recursos" },

  // Habilidades.
  { value: "habilidades.carga.total",           label: "Carga",           group: "Habilidades" },
  { value: "habilidades.carrera.total",         label: "Carrera",         group: "Habilidades" },
  { value: "habilidades.motricidad.total",      label: "Motricidad",      group: "Habilidades" },
  { value: "habilidades.controlCorporal.total", label: "Control corp.",   group: "Habilidades" },
  { value: "habilidades.quickThinking.total",   label: "Quick thinking",  group: "Habilidades" },
  { value: "habilidades.investigacion.total",   label: "Investigación",   group: "Habilidades" },
  { value: "habilidades.conocimiento.total",    label: "Conocimiento",    group: "Habilidades" },
  { value: "habilidades.liderazgo.total",       label: "Liderazgo",       group: "Habilidades" },
  { value: "habilidades.empatia.total",         label: "Empatía",         group: "Habilidades" },
  { value: "habilidades.actuacion.total",       label: "Actuación",       group: "Habilidades" },
  { value: "habilidades.percepcion.total",      label: "Percepción",      group: "Habilidades" },
  { value: "habilidades.perspicacia.total",     label: "Perspicacia",     group: "Habilidades" },
  { value: "habilidades.meditacion.total",      label: "Meditación",      group: "Habilidades" },
  { value: "habilidades.deteccion.total",       label: "Detección",       group: "Habilidades" },
];

// Devuelve BUFF_TARGETS reagrupado para template: [{ group, options: [...] }, ...]
// preservando el orden de aparición de cada grupo.
export function buffTargetsGrouped(selectedValue) {
  const groups = new Map();
  for (const t of BUFF_TARGETS) {
    if (!groups.has(t.group)) groups.set(t.group, []);
    groups.get(t.group).push({ ...t, selected: t.value === selectedValue });
  }
  return Array.from(groups, ([group, options]) => ({ group, options }));
}

// Variables disponibles para escalar el baseVal de un buff (× stat o nivel).
export const SCALE_VARS = [
  { value: "none",      label: "— sin escala —" },
  { value: "nivel",     label: "× Nivel" },
  { value: "caos",      label: "× Caos" },
  { value: "fuerza",    label: "× Fuerza" },
  { value: "aguante",   label: "× Aguante" },
  { value: "velocidad", label: "× Velocidad" },
  { value: "tecnica",   label: "× Técnica" },
  { value: "cognicion", label: "× Cognición" },
  { value: "carisma",   label: "× Carisma" },
  { value: "instintos", label: "× Instintos" },
];

// Mapa forma de plantilla a tipo MeasuredTemplate de Foundry.
export const AREA_SHAPE_MAP = {
  esfera: "circle", sphere: "circle", circle: "circle",
  cono:   "cone",   cone:   "cone",
  linea:  "ray",    line:   "ray",    ray:    "ray",
  cuadrado: "rect", cubo:   "rect",   rect:   "rect", square: "rect",
};
