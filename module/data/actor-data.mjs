// Modelos de datos de Actor. Character y NPC comparten ~95% del schema y la
// derivación, por eso viven juntos y delegan en helpers locales/shared.

import {
  STAT_KEYS, SKILL_KEYS, SKILL_STAT, MAEST_BONUS, VIDA_DADO_POR_RANK,
  DEFENSA_CORPORAL_STATS, DEFENSA_CAOTICA_STATS,
  MOVIMIENTO_BASE, MOVIMIENTO_MINIMO, MOVIMIENTO_BONUS_ANILLOS, ANILLOS_PARA_BONUS,
  ENERGIA_CAOTICA_POR_CAOS,
  puntosToRank, puntosToMod,
} from "../constants/stats.mjs";

// Re-exporta para no romper imports antiguos.
export { puntosToRank, puntosToMod };

const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

// ── Field builders ─────────────────────────────────────────────────────────

function caracteristicaField(initial = 3) {
  return new SchemaField({
    // max=8 desde L4 (rango SS). Schemas viejos con max=7 siguen siendo compatibles.
    puntos: new NumberField({ required: true, integer: true, initial, min: 0, max: 8 }),
    bonus:  new NumberField({ required: true, integer: true, initial: 0 }),
  });
}

function habilidadField() {
  return new SchemaField({
    experticia: new NumberField({ required: true, integer: true, initial: 0, min: 0, max: 3 }),
  });
}

function maestriaSlotField(rank) {
  return new SchemaField({
    nombre:         new StringField({ required: true, initial: "" }),
    caracteristica: new StringField({ required: true, initial: "cognicion" }),
    rank:           new StringField({ required: true, initial: rank }),
  });
}

// Construye SchemaField con las 8 características (incluye caos).
function caracteristicasSchema() {
  return new SchemaField(Object.fromEntries(STAT_KEYS.map(k => [k, caracteristicaField(3)])));
}

// Construye SchemaField con las 14 habilidades.
function habilidadesSchema() {
  return new SchemaField(Object.fromEntries(SKILL_KEYS.map(k => [k, habilidadField()])));
}

// Construye los 3 slots de maestrías (S/A/B) bajo `teoricas` o `practicas`.
function maestriasSchema() {
  const slots = () => new SchemaField({
    s: maestriaSlotField("S"),
    a: maestriaSlotField("A"),
    b: maestriaSlotField("B"),
  });
  return new SchemaField({ teoricas: slots(), practicas: slots() });
}

function defensasSchema({ ecMaxInit = 21 } = {}) {
  return new SchemaField({
    vida: new SchemaField({
      value: new NumberField({ required: true, integer: true, initial: 8, min: 0 }),
      max:   new NumberField({ required: true, integer: true, initial: 8, min: 0 }),
    }),
    anillos: new SchemaField({
      value: new NumberField({ required: true, integer: true, initial: 0, min: 0, max: 100 }),
    }),
    energiaCaotica: new SchemaField({
      value: new NumberField({ required: true, integer: true, initial: ecMaxInit, min: 0 }),
      max:   new NumberField({ required: true, integer: true, initial: ecMaxInit, min: 0 }),
    }),
  });
}

// ── Derivación compartida ──────────────────────────────────────────────────
//
// Pipeline en dos pasos para que ForcesActor pueda re-derivar SÓLO lo
// downstream cuando los buffs de items cambian un modificador de característica:
//
//   1) recomputeStatMods(sys)
//        rank/mod base por puntos + bonus permanente, + bonus de maestrías
//   2) recomputeDownstreamOfMods(sys)
//        movimiento, defensas, EC máx, skills, vidaDado
//
// recomputeDerivedStats encadena ambos y se llama desde prepareDerivedData
// del DataModel. Tras aplicar buffs, ForcesActor llama solo al paso 2.

export function recomputeStatMods(sys) {
  const car = sys.caracteristicas;

  // L14: para el tooltip de descomposición, recordamos cada componente del mod.
  // statBreakdown[carKey] = [{ source, value }, ...]
  sys.statBreakdown = Object.fromEntries(Object.keys(car).map(k => [k, []]));

  for (const [key, stat] of Object.entries(car)) {
    stat.rank        = puntosToRank(stat.puntos);
    const modBase    = puntosToMod(stat.puntos);
    const bonusPerm  = stat.bonus ?? 0;
    stat.modificador = modBase + bonusPerm;
    stat.rankDisplay = stat.rank;
    sys.statBreakdown[key].push({ source: `Rango ${stat.rank}`, value: modBase });
    if (bonusPerm) sys.statBreakdown[key].push({ source: "Bonus permanente", value: bonusPerm });
  }

  // Aclaración de diseño (cambio post-refactor):
  // Las maestrías NO modifican el modificador base de la característica.
  // Se aplican ÚNICAMENTE en rollMaestria(tipo, slot) sumando MAEST_BONUS[m.rank]
  // sobre car.modificador en el momento de la tirada. El sheet expone
  // `maestriasInfo[carKey]` como índice informativo (lista de maestrías
  // asociadas a cada stat) para que el tooltip de bio pueda mostrarlas como
  // "aplican solo en tirada específica".
  sys.maestriasInfo = Object.fromEntries(Object.keys(car).map(k => [k, []]));
  if (sys.maestrias) {
    for (const tipo of ["teoricas", "practicas"]) {
      for (const slot of Object.values(sys.maestrias[tipo])) {
        if (!slot.nombre) continue;
        const carKey = slot.caracteristica || "cognicion";
        if (!car[carKey]) continue;
        sys.maestriasInfo[carKey].push({
          nombre: slot.nombre,
          rank:   slot.rank,
          bonus:  MAEST_BONUS[slot.rank] ?? 0,
          tipo,
        });
      }
    }
  }
}

export function recomputeDownstreamOfMods(sys) {
  const car = sys.caracteristicas;

  // Movimiento (mínimo 10 ft, +20 con 100 anillos).
  sys.movimiento = Math.max(
    MOVIMIENTO_MINIMO,
    10 * car.velocidad.modificador + MOVIMIENTO_BASE + (sys.bonusMovimiento ?? 0),
  );
  if ((sys.defensas.anillos?.value ?? 0) >= ANILLOS_PARA_BONUS) {
    sys.movimiento += MOVIMIENTO_BONUS_ANILLOS;
  }

  // Defensas: 10 + suma de mods de dos stats, mínimo 1.
  const sumMods = keys => keys.reduce((acc, k) => acc + (car[k]?.modificador ?? 0), 0);
  sys.defensas.defensaCorporal = Math.max(1, 10 + sumMods(DEFENSA_CORPORAL_STATS));
  sys.defensas.defensaCaotica  = Math.max(1, 10 + sumMods(DEFENSA_CAOTICA_STATS));

  // Energía caótica máx = mod caos × 7 (suelo 0).
  sys.defensas.energiaCaotica.max = Math.max(0, car.caos.modificador * ENERGIA_CAOTICA_POR_CAOS);

  // Skills: total = mod stat asociado + experticia. statKey útil para el sheet.
  for (const [hab, carKey] of Object.entries(SKILL_STAT)) {
    const skill = sys.habilidades[hab];
    if (!skill) continue;
    skill.total   = car[carKey].modificador + skill.experticia;
    skill.statKey = carKey;
  }

  // Dado de vida derivado del rango de Aguante.
  sys.vidaDado = VIDA_DADO_POR_RANK[car.aguante.rank] ?? 6;
}

export function recomputeDerivedStats(sys) {
  recomputeStatMods(sys);
  recomputeDownstreamOfMods(sys);
}

// ── DataModels ─────────────────────────────────────────────────────────────

export class ForcesActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      especie:          new StringField({ required: true, initial: "" }),
      edad:             new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      clase:            new StringField({ required: true, initial: "" }),
      origen:           new StringField({ required: true, initial: "" }),
      viveEn:           new StringField({ required: true, initial: "" }),
      nivel:            new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 20 }),
      bio:              new HTMLField({ required: false, initial: "" }),
      bonusMovimiento:  new NumberField({ required: true, integer: true, initial: 0 }),
      baseSlots:        new NumberField({ required: true, integer: true, initial: 3, min: 0 }),
      cardColor:        new StringField({ required: true, initial: "#0b3d6b" }),

      caracteristicas: caracteristicasSchema(),
      defensas:        defensasSchema({ ecMaxInit: 21 }),
      habilidades:     habilidadesSchema(),
      maestrias:       maestriasSchema(),
    };
  }

  // Mantener estos statics públicos: ForcesActor los usaba como
  // ForcesActorData.SKILL_STAT / VIDA_DADO.
  static SKILL_STAT = SKILL_STAT;
  static VIDA_DADO  = VIDA_DADO_POR_RANK;

  prepareDerivedData() { recomputeDerivedStats(this); }
}

export class ForcesNPCData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      especie:         new StringField({ required: true, initial: "" }),
      clase:           new StringField({ required: true, initial: "" }),
      nivel:           new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      bio:             new HTMLField({ required: false, initial: "" }),
      bonusMovimiento: new NumberField({ required: true, integer: true, initial: 0 }),
      // L13: NPCs ahora tienen slots de tarjeta como los PJs.
      baseSlots:       new NumberField({ required: true, integer: true, initial: 3, min: 0 }),

      caracteristicas: caracteristicasSchema(),
      defensas:        defensasSchema({ ecMaxInit: 0 }),
      habilidades:     habilidadesSchema(),
      maestrias:       maestriasSchema(),
    };
  }

  prepareDerivedData() { recomputeDerivedStats(this); }
}
