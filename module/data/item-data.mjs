const { HTMLField, NumberField, SchemaField, StringField, BooleanField, ArrayField } = foundry.data.fields;

export const BUFF_TARGETS = [
  { value: "defensas.defensaCorporal",          label: "Def. Corporal" },
  { value: "defensas.defensaCaotica",           label: "Def. Caótica" },
  { value: "movimiento",                        label: "Movimiento (pies)" },
  { value: "habilidades.carga.total",           label: "Hab: Carga" },
  { value: "habilidades.carrera.total",         label: "Hab: Carrera" },
  { value: "habilidades.motricidad.total",      label: "Hab: Motricidad" },
  { value: "habilidades.controlCorporal.total", label: "Hab: Control corp." },
  { value: "habilidades.quickThinking.total",   label: "Hab: Quick thinking" },
  { value: "habilidades.investigacion.total",   label: "Hab: Investigación" },
  { value: "habilidades.conocimiento.total",    label: "Hab: Conocimiento" },
  { value: "habilidades.liderazgo.total",       label: "Hab: Liderazgo" },
  { value: "habilidades.empatia.total",         label: "Hab: Empatía" },
  { value: "habilidades.actuacion.total",       label: "Hab: Actuación" },
  { value: "habilidades.percepcion.total",      label: "Hab: Percepción" },
  { value: "habilidades.perspicacia.total",     label: "Hab: Perspicacia" },
  { value: "habilidades.meditacion.total",      label: "Hab: Meditación" },
  { value: "habilidades.deteccion.total",       label: "Hab: Detección" },
];

export const ALL_SECTIONS = [
  { key: "danioEfecto",    label: "🗡 Daño" },
  { key: "hit",            label: "⊕ Hit / Ataque" },
  { key: "caosControl",    label: "✦ Caos Control" },
  { key: "savingThrow",    label: "🛡 Saving Throw" },
  { key: "bonEstadistica", label: "📊 Bonif. Est." },
  { key: "featClase",      label: "⭐ Feat / Clase" },
  { key: "duracion",       label: "⏱ Duración" },
  { key: "rango",          label: "📐 Rango" },
  { key: "usos",           label: "🔄 Usos" },
  { key: "buffs",          label: "↑ Buffs" },
  { key: "descripcion",    label: "📝 Descripción" },
];

// Default sections to enable per category on creation
export const CAT_DEFAULTS = {
  arma:       ["descripcion", "danioEfecto", "hit"],
  armadura:   ["descripcion", "bonEstadistica"],
  equipo:     ["descripcion"],
  consumible: ["descripcion", "usos"],
  feat:       ["descripcion", "featClase"],
  caos:       ["descripcion", "caosControl", "danioEfecto"],
  tarjeta:    ["descripcion"],
};

export class ForcesItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      descripcion:   new HTMLField({ required: false, initial: "" }),
      categoria:     new StringField({ required: true, initial: "equipo" }),
      equipado:      new BooleanField({ required: true, initial: false }),

      duracion:      new StringField({ required: true, initial: "" }),
      rango:         new NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      dadoDanio:     new StringField({ required: true, initial: "" }),
      bonusDanio:    new NumberField({ required: true, integer: true, initial: 0 }),
      danioTipo:     new StringField({ required: true, initial: "" }),

      bonusHit:      new NumberField({ required: true, integer: true, initial: 0 }),
      numAtaques:    new NumberField({ required: true, integer: true, initial: 1, min: 1 }),

      bonusDf:       new NumberField({ required: true, integer: true, initial: 0 }),
      bonusReaccion: new NumberField({ required: true, integer: true, initial: 0 }),
      bonusAtaque:   new NumberField({ required: true, integer: true, initial: 0 }),
      slots:         new NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      nivelReq:      new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      claseReq:      new StringField({ required: true, initial: "" }),

      savingThrow:     new StringField({ required: true, initial: "" }),
      savingThrowDC:   new NumberField({ required: true, integer: true, initial: 10 }),
      savingThrowStat: new StringField({ required: true, initial: "instintos" }),

      costoCaos:     new NumberField({ required: true, integer: true, initial: 10, min: 0 }),
      esReaccion:    new BooleanField({ required: true, initial: false }),

      usosPorDesc:   new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      usosActuales:  new NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      // Which sections are active for this item
      secciones: new SchemaField({
        descripcion:    new BooleanField({ initial: false }),
        duracion:       new BooleanField({ initial: false }),
        rango:          new BooleanField({ initial: false }),
        featClase:      new BooleanField({ initial: false }),
        bonEstadistica: new BooleanField({ initial: false }),
        danioEfecto:    new BooleanField({ initial: false }),
        hit:            new BooleanField({ initial: false }),
        savingThrow:    new BooleanField({ initial: false }),
        caosControl:    new BooleanField({ initial: false }),
        usos:           new BooleanField({ initial: false }),
        buffs:          new BooleanField({ initial: false }),
      }),

      buffs: new ArrayField(
        new SchemaField({
          target:    new StringField({ required: true, initial: "defensas.defensaCorporal" }),
          baseVal:   new NumberField({ required: true, initial: 0 }),
          scaleVar:  new StringField({ required: true, initial: "none" }),
          scaleMult: new NumberField({ required: true, integer: true, initial: 1 }),
          activo:    new BooleanField({ required: true, initial: true }),
        }),
        { initial: [] }
      ),
    };
  }
}
