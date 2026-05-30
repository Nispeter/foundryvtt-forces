// Schema del item de Forces. Las constantes de UI (categorías, secciones, buffs)
// viven en module/constants/items.mjs; aquí se re-exportan para no romper imports
// pre-refactor.

const { HTMLField, NumberField, SchemaField, StringField, BooleanField, ArrayField } = foundry.data.fields;

export { BUFF_TARGETS, ALL_SECTIONS, CAT_DEFAULTS } from "../constants/items.mjs";

export class ForcesItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      descripcion:   new HTMLField({ required: false, initial: "" }),
      categoria:     new StringField({ required: true, initial: "equipo" }),
      equipado:      new BooleanField({ required: true, initial: false }),
      favorito:      new BooleanField({ required: true, initial: false }),

      // Metadata genérica para tarjeta de uso.
      duracion:       new StringField({ required: true, initial: "" }),
      rango:          new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      areaEfecto:     new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      areaEfectoTipo: new StringField({ required: true, initial: "" }),
      // L11: segunda medida — solo se usa para cuadrado/rectangulo (alto vs ancho=areaEfecto).
      // Si 0 y el tipo es rect, fallback a un cuadrado de lado=areaEfecto.
      areaEfectoAncho: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      // Daño.
      dadoDanio:     new StringField({ required: true, initial: "" }),
      bonusDanio:    new NumberField({ required: true, integer: true, initial: 0 }),
      danioTipo:     new StringField({ required: true, initial: "" }),

      // Ataque (hit).
      bonusHit:      new NumberField({ required: true, integer: true, initial: 0 }),
      numAtaques:    new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      atacarCon:     new StringField({ required: true, initial: "" }),
      atacarCon2:    new StringField({ required: true, initial: "" }),

      // Dado libre / tabla aleatoria.
      dadoLibreFormula:   new StringField({ required: true, initial: "" }),
      dadoLibreLabel:     new StringField({ required: true, initial: "" }),
      dadoLibreTabla:     new BooleanField({ initial: false }),
      dadoLibreEntradas:  new StringField({ required: true, initial: "" }),

      // Bonificaciones estadísticas pasivas (armadura, equipo).
      bonusDf:       new NumberField({ required: true, integer: true, initial: 0 }),
      bonusReaccion: new NumberField({ required: true, integer: true, initial: 0 }),
      bonusAtaque:   new NumberField({ required: true, integer: true, initial: 0 }),
      slots:         new NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      // Requisitos para feats/clases.
      nivelReq:      new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      claseReq:      new StringField({ required: true, initial: "" }),

      // Saving throw asociado al efecto.
      savingThrow:     new StringField({ required: true, initial: "" }),
      savingThrowDC:   new NumberField({ required: true, integer: true, initial: 10 }),
      savingThrowStat: new StringField({ required: true, initial: "instintos" }),

      // Caos / Tarjeta.
      costoCaos:    new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      esReaccion:   new BooleanField({ required: true, initial: false }),
      costoTarjeta: new NumberField({ required: true, integer: true, initial: 1, min: 0 }),

      // Usos por descanso.
      usosPorDesc:  new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      usosActuales: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      // Flags de qué secciones mostrar en el item-sheet/tarjeta de uso.
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
        dadoLibre:      new BooleanField({ initial: false }),
        areaEfecto:     new BooleanField({ initial: false }),
      }),

      // Buffs aplicados a stats del actor cuando equipado.
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
