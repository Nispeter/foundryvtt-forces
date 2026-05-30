// Sheet de item. Maneja toggle de secciones, buffs editables, popup de "añadir sección".

import { BUFF_TARGETS, buffTargetsGrouped, ALL_SECTIONS, ITEM_CATEGORIAS, SCALE_VARS } from "../constants/items.mjs";

export class ForcesItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes:   ["forces", "sheet", "item"],
      template:  "systems/forces/templates/item/item-sheet.hbs",
      width:     520,
      height:    560,
      resizable: true,
      scrollY:   [".item-sections-body"],
    });
  }

  getData() {
    const ctx = super.getData();
    const sys = this.item.system;
    ctx.system = sys;

    ctx.secciones         = this._resolveActiveSections(sys);
    ctx.seccionesActivas  = ALL_SECTIONS.filter(s => ctx.secciones[s.key]);
    ctx.allSectionsToggle = ALL_SECTIONS.map(s => ({ ...s, active: !!ctx.secciones[s.key] }));

    // Para mostrar el bonificador computado de cada buff: si el item está
    // embebido en un actor, calculamos el valor concreto; si está en el world,
    // lo dejamos simbólico.
    const ownerActor = this.item.actor;
    ctx.buffRows = (sys.buffs ?? []).map((b, idx) => {
      const scaleVar = b.scaleVar || "none";
      const baseVal  = Number(b.baseVal)   || 0;
      const mult     = Number(b.scaleMult) || 0;
      let computed = null;
      let symbolic = null;
      if (scaleVar === "none") {
        computed = baseVal;
      } else if (ownerActor) {
        // nivel = system.nivel; cualquier otra = caracteristicas.X.modificador.
        const statVal = scaleVar === "nivel"
          ? (ownerActor.system.nivel ?? 0)
          : (ownerActor.system.caracteristicas?.[scaleVar]?.modificador ?? 0);
        computed = Math.round(baseVal + mult * statVal);
      } else {
        symbolic = `${baseVal >= 0 ? "+" : ""}${baseVal} ${mult >= 0 ? "+" : ""}${mult}×${scaleVar}`;
      }
      const computedLabel = computed !== null
        ? `= ${computed >= 0 ? "+" : ""}${computed}`
        : `= ${symbolic}`;
      return {
        ...b, idx,
        targetGroups:    buffTargetsGrouped(b.target),
        targetOptions:   BUFF_TARGETS.map(t => ({ ...t, selected: t.value === b.target })),
        scaleVarOptions: SCALE_VARS.map(v => ({ ...v, selected: scaleVar === v.value })),
        showMult: scaleVar !== "none",
        computedLabel,
      };
    });

    const tablaEntradas = (sys.dadoLibreEntradas ?? "").split("\n").filter(e => e.trim());
    ctx.dadoLibreNumEntradas = tablaEntradas.length;

    ctx.categorias = ITEM_CATEGORIAS;

    // L11: label de la medida primaria según tipo de forma.
    const tipo = (sys.areaEfectoTipo || "esfera").toLowerCase();
    ctx.areaTipoIsRect   = ["cuadrado", "cubo", "rect", "square"].includes(tipo);
    ctx.areaMedidaLabel  = ctx.areaTipoIsRect ? "Ancho"
                        : tipo === "cono" || tipo === "linea" || tipo === "line" || tipo === "ray" ? "Longitud"
                        : "Radio";

    return ctx;
  }

  // Combina flags `system.secciones.*` con auto-detección de datos legacy
  // (un objeto pre-flags con dadoDanio sigue mostrando "Daño" sin tener que migrarlo).
  // Importante: si la flag está explícitamente en `false`, NO se auto-activa.
  _resolveActiveSections(sys) {
    const stored = sys.secciones ?? {};
    const sec = { ...stored };
    const autoIf = (key, condition) => {
      if (stored[key] !== false && condition) sec[key] = true;
    };
    autoIf("descripcion",    sys.descripcion);
    autoIf("duracion",       sys.duracion);
    autoIf("rango",          sys.rango);
    autoIf("danioEfecto",    sys.dadoDanio);
    autoIf("hit",            sys.bonusHit || (sys.numAtaques ?? 1) > 1);
    autoIf("featClase",      (sys.nivelReq ?? 1) > 1 || sys.claseReq);
    autoIf("caosControl",    sys.costoCaos || sys.esReaccion);
    autoIf("usos",           sys.usosPorDesc);
    autoIf("buffs",          (sys.buffs ?? []).length > 0);
    autoIf("bonEstadistica", sys.bonusDf || sys.bonusReaccion || sys.bonusAtaque || sys.slots);
    autoIf("savingThrow",    sys.savingThrow);
    autoIf("dadoLibre",      sys.dadoLibreFormula || sys.dadoLibreTabla);
    autoIf("areaEfecto",     sys.areaEfecto);
    return sec;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Toggle de collapse por sección.
    const _toggleSection = el => {
      const sec = el.closest(".item-section");
      const btn = sec.querySelector(".sec-collapse-btn");
      sec.classList.toggle("collapsed");
      if (btn) btn.textContent = sec.classList.contains("collapsed") ? "▸" : "▾";
    };
    html.find(".sec-collapse-btn").click(ev => _toggleSection(ev.currentTarget));
    html.find(".sec-header .sec-title").click(ev => _toggleSection(ev.currentTarget));

    // Hack: el value de los <select> no siempre se setea correcto desde Handlebars
    // cuando el dataset es array de objetos. Aquí lo forzamos después del render.
    const storedBuffs = this.item.system.buffs ?? [];
    html.find(".buff-row").each((_i, row) => {
      const buff = storedBuffs[parseInt(row.dataset.idx)];
      if (!buff) return;
      const tgt = row.querySelector(".buff-target");
      const scv = row.querySelector(".buff-scale-var");
      if (tgt) tgt.value = buff.target;
      if (scv) scv.value = buff.scaleVar || "none";
    });

    if (!this.isEditable) return;
    this._activateEditListeners(html);
  }

  _activateEditListeners(html) {
    this._activateSectionsPopup(html);

    // Toggle pills de secciones.
    html.find(".sec-add-btn").click(ev => {
      const key    = ev.currentTarget.dataset.key;
      const active = ev.currentTarget.classList.contains("sec-btn-active");
      this.item.update({ [`system.secciones.${key}`]: !active });
    });

    // Botón × en header de sección → desactiva la sección.
    html.find(".sec-remove").click(ev => {
      const key = ev.currentTarget.closest(".item-section").dataset.secKey;
      this.item.update({ [`system.secciones.${key}`]: false });
    });

    html.find(".buff-add").click(this._onBuffAdd.bind(this));
    html.find(".buff-remove").click(this._onBuffRemove.bind(this));
    html.find(".buff-field").on("change", this._onBuffFieldChange.bind(this));

    html.find(".uso-tick").click(this._onUsoTick.bind(this));
  }

  // Popup flotante de "Añadir sección".
  _activateSectionsPopup(html) {
    html.find(".sec-add-toggle").click(ev => {
      ev.stopPropagation();
      const btn  = ev.currentTarget;
      const list = html.find(".sec-add-list")[0];
      if (!list) return;

      if (list._forcesOpen) {
        list.style.display = "none";
        list._forcesOpen = false;
        return;
      }

      const rect = btn.getBoundingClientRect();
      Object.assign(list.style, {
        display:  "flex",
        position: "fixed",
        bottom:   `${window.innerHeight - rect.top + 8}px`,
        left:     `${Math.max(8, rect.left - 4)}px`,
        right:    "auto",
        width:    "320px",
        maxHeight:"220px",
        zIndex:   "20000",
      });
      list._forcesOpen = true;

      // Cerrar al click fuera o Escape.
      const close = (e) => {
        if (!list.contains(e.target) && e.target !== btn) {
          list.style.display = "none";
          list._forcesOpen = false;
          document.removeEventListener("pointerdown", close, true);
          document.removeEventListener("keydown", onEsc);
        }
      };
      const onEsc = (e) => {
        if (e.key !== "Escape") return;
        list.style.display = "none";
        list._forcesOpen = false;
        document.removeEventListener("pointerdown", close, true);
        document.removeEventListener("keydown", onEsc);
      };
      document.addEventListener("pointerdown", close, true);
      document.addEventListener("keydown", onEsc);
    });
  }

  _onBuffFieldChange(ev) {
    const row   = ev.currentTarget.closest(".buff-row");
    const idx   = parseInt(row.dataset.idx);
    const field = ev.currentTarget.dataset.field;
    const el    = ev.currentTarget;
    const value = el.type === "checkbox" ? el.checked
                : el.type === "number"   ? (parseFloat(el.value) || 0)
                : el.value;
    const buffs = foundry.utils.deepClone(this.item.system.buffs ?? []);
    if (!buffs[idx]) return;
    buffs[idx][field] = value;
    return this.item.update({ "system.buffs": buffs });
  }

  async _onUsoTick() {
    const curr = this.item.system.usosActuales ?? 0;
    const max  = this.item.system.usosPorDesc ?? 0;
    return this.item.update({ "system.usosActuales": Math.min(max, curr + 1) });
  }

  async _onBuffAdd() {
    const buffs = foundry.utils.deepClone(this.item.system.buffs ?? []);
    buffs.push({ target: "defensas.defensaCorporal", baseVal: 0, scaleVar: "none", scaleMult: 1, activo: true });
    return this.item.update({ "system.buffs": buffs });
  }

  async _onBuffRemove(ev) {
    const idx   = parseInt(ev.currentTarget.dataset.idx);
    const buffs = foundry.utils.deepClone(this.item.system.buffs ?? []);
    buffs.splice(idx, 1);
    return this.item.update({ "system.buffs": buffs });
  }
}
