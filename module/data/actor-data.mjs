const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

// S+ is puntos=7, modifier=+15
const RANK_FROM_PUNTOS = { 0: "F", 1: "E", 2: "D", 3: "C", 4: "B", 5: "A", 6: "S", 7: "S+" };
const MOD_FROM_PUNTOS  = { 0: -10, 1: -6, 2: -3, 3: 0, 4: 3, 5: 6, 6: 10, 7: 15 };

export function puntosToRank(p) { return RANK_FROM_PUNTOS[Math.clamped(p, 0, 7)] ?? "C"; }
export function puntosToMod(p)  { return MOD_FROM_PUNTOS[Math.clamped(p, 0, 7)] ?? 0; }

function caracteristicaField(initial = 3) {
  return new SchemaField({
    puntos: new NumberField({ required: true, integer: true, initial, min: 0, max: 7 }),
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

// ───────────────────────── Character ──────────────────────────
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

      caracteristicas: new SchemaField({
        fuerza:    caracteristicaField(3),
        aguante:   caracteristicaField(3),
        velocidad: caracteristicaField(3),
        tecnica:   caracteristicaField(3),
        cognicion: caracteristicaField(3),
        carisma:   caracteristicaField(3),
        instintos: caracteristicaField(3),
        caos:      caracteristicaField(3),
      }),

      defensas: new SchemaField({
        vida: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 8, min: 0 }),
          max:   new NumberField({ required: true, integer: true, initial: 8, min: 0 }),
        }),
        anillos: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 0, min: 0, max: 100 }),
        }),
        energiaCaotica: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 21, min: 0 }),
          max:   new NumberField({ required: true, integer: true, initial: 21, min: 0 }),
        }),
      }),

      habilidades: new SchemaField({
        carga:           habilidadField(),
        carrera:         habilidadField(),
        motricidad:      habilidadField(),
        controlCorporal: habilidadField(),
        quickThinking:   habilidadField(),
        investigacion:   habilidadField(),
        conocimiento:    habilidadField(),
        liderazgo:       habilidadField(),
        empatia:         habilidadField(),
        actuacion:       habilidadField(),
        percepcion:      habilidadField(),
        perspicacia:     habilidadField(),
        meditacion:      habilidadField(),
        deteccion:       habilidadField(),
      }),

      maestrias: new SchemaField({
        teoricas: new SchemaField({
          s: maestriaSlotField("S"),
          a: maestriaSlotField("A"),
          b: maestriaSlotField("B"),
        }),
        practicas: new SchemaField({
          s: maestriaSlotField("S"),
          a: maestriaSlotField("A"),
          b: maestriaSlotField("B"),
        }),
      }),
    };
  }

  static SKILL_STAT = {
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

  static VIDA_DADO = { "S+": 12, S: 12, A: 10, B: 8, C: 6, D: 4, E: 4, F: 4 };

  prepareDerivedData() {
    const car = this.caracteristicas;

    for (const stat of Object.values(car)) {
      stat.rank        = puntosToRank(stat.puntos);
      stat.modificador = puntosToMod(stat.puntos) + (stat.bonus ?? 0);
      stat.rankDisplay = stat.rank;
    }

    const MAEST_BONUS = { B: 1, A: 2, S: 3, "S+": 4 };
    for (const tipo of ["teoricas", "practicas"]) {
      for (const slot of Object.values(this.maestrias[tipo])) {
        if (!slot.nombre) continue;
        const bonus = MAEST_BONUS[slot.rank] ?? 0;
        const c = car[slot.caracteristica || "cognicion"];
        if (c) c.modificador += bonus;
      }
    }

    // Movement: 10 × vel modifier + 30, min 10 ft. 100 anillos → +20 ft bonus.
    this.movimiento = Math.max(10, 10 * car.velocidad.modificador + 30 + (this.bonusMovimiento ?? 0));
    if ((this.defensas.anillos?.value ?? 0) >= 100) this.movimiento += 20;

    this.defensas.defensaCorporal = Math.max(1, 10 + car.aguante.modificador + car.velocidad.modificador);
    this.defensas.defensaCaotica  = Math.max(1, 10 + car.caos.modificador   + car.tecnica.modificador);
    this.defensas.energiaCaotica.max = Math.max(0, car.caos.modificador * 7);

    for (const [hab, carKey] of Object.entries(ForcesActorData.SKILL_STAT)) {
      const skill   = this.habilidades[hab];
      skill.total   = car[carKey].modificador + skill.experticia;
      skill.statKey = carKey;
    }

    this.vidaDado = ForcesActorData.VIDA_DADO[car.aguante.rank] ?? 6;
  }
}

// ───────────────────────── NPC ──────────────────────────
export class ForcesNPCData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      especie: new StringField({ required: true, initial: "" }),
      clase:   new StringField({ required: true, initial: "" }),
      nivel:   new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      bio:     new HTMLField({ required: false, initial: "" }),
      bonusMovimiento: new NumberField({ required: true, integer: true, initial: 0 }),

      caracteristicas: new SchemaField({
        fuerza:    caracteristicaField(3),
        aguante:   caracteristicaField(3),
        velocidad: caracteristicaField(3),
        tecnica:   caracteristicaField(3),
        cognicion: caracteristicaField(3),
        carisma:   caracteristicaField(3),
        instintos: caracteristicaField(3),
        caos:      caracteristicaField(3),
      }),

      defensas: new SchemaField({
        vida: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 8, min: 0 }),
          max:   new NumberField({ required: true, integer: true, initial: 8, min: 0 }),
        }),
        anillos: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 0, min: 0, max: 100 }),
        }),
        energiaCaotica: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
          max:   new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        }),
      }),

      habilidades: new SchemaField({
        carga:           habilidadField(),
        carrera:         habilidadField(),
        motricidad:      habilidadField(),
        controlCorporal: habilidadField(),
        quickThinking:   habilidadField(),
        investigacion:   habilidadField(),
        conocimiento:    habilidadField(),
        liderazgo:       habilidadField(),
        empatia:         habilidadField(),
        actuacion:       habilidadField(),
        percepcion:      habilidadField(),
        perspicacia:     habilidadField(),
        meditacion:      habilidadField(),
        deteccion:       habilidadField(),
      }),

      maestrias: new SchemaField({
        teoricas: new SchemaField({
          s: maestriaSlotField("S"),
          a: maestriaSlotField("A"),
          b: maestriaSlotField("B"),
        }),
        practicas: new SchemaField({
          s: maestriaSlotField("S"),
          a: maestriaSlotField("A"),
          b: maestriaSlotField("B"),
        }),
      }),
    };
  }

  prepareDerivedData() {
    const car = this.caracteristicas;
    for (const stat of Object.values(car)) {
      stat.rank        = puntosToRank(stat.puntos);
      stat.modificador = puntosToMod(stat.puntos) + (stat.bonus ?? 0);
      stat.rankDisplay = stat.rank;
    }

    const MAEST_BONUS = { B: 1, A: 2, S: 3, "S+": 4 };
    for (const tipo of ["teoricas", "practicas"]) {
      for (const slot of Object.values(this.maestrias[tipo])) {
        if (!slot.nombre) continue;
        const bonus = MAEST_BONUS[slot.rank] ?? 0;
        const c = car[slot.caracteristica || "cognicion"];
        if (c) c.modificador += bonus;
      }
    }

    this.movimiento = Math.max(10, 10 * car.velocidad.modificador + 30 + (this.bonusMovimiento ?? 0));
    if ((this.defensas.anillos?.value ?? 0) >= 100) this.movimiento += 20;
    this.defensas.defensaCorporal = Math.max(1, 10 + car.aguante.modificador + car.velocidad.modificador);
    this.defensas.defensaCaotica  = Math.max(1, 10 + car.caos.modificador   + car.tecnica.modificador);
    this.defensas.energiaCaotica.max = Math.max(0, car.caos.modificador * 7);
    this.vidaDado = ForcesActorData.VIDA_DADO?.[car.aguante.rank] ?? 6;

    for (const [hab, carKey] of Object.entries(ForcesActorData.SKILL_STAT)) {
      const skill   = this.habilidades[hab];
      skill.total   = car[carKey].modificador + skill.experticia;
      skill.statKey = carKey;
    }
  }
}
