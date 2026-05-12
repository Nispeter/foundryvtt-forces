import { BUFF_TARGETS, ALL_SECTIONS } from "../data/item-data.mjs";

const SCALE_VARS = [
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

    // Effective sections: stored flags OR auto-detect legacy data
    const stored = sys.secciones ?? {};
    const sec = { ...stored };
    if (stored.descripcion    !== false && sys.descripcion)                                    sec.descripcion    = true;
    if (stored.duracion       !== false && sys.duracion)                                       sec.duracion       = true;
    if (stored.rango          !== false && sys.rango)                                          sec.rango          = true;
    if (stored.danioEfecto    !== false && sys.dadoDanio)                                      sec.danioEfecto    = true;
    if (stored.hit            !== false && (sys.bonusHit || (sys.numAtaques ?? 1) > 1))        sec.hit            = true;
    if (stored.featClase      !== false && ((sys.nivelReq ?? 1) > 1 || sys.claseReq))          sec.featClase      = true;
    if (stored.caosControl    !== false && (sys.costoCaos || sys.esReaccion))                  sec.caosControl    = true;
    if (stored.usos           !== false && sys.usosPorDesc)                                    sec.usos           = true;
    if (stored.buffs          !== false && (sys.buffs ?? []).length > 0)                       sec.buffs          = true;
    if (stored.bonEstadistica !== false && (sys.bonusDf || sys.bonusReaccion || sys.bonusAtaque || sys.slots)) sec.bonEstadistica = true;
    if (stored.savingThrow    !== false && sys.savingThrow)                                    sec.savingThrow    = true;
    if (stored.dadoLibre      !== false && (sys.dadoLibreFormula || sys.dadoLibreTabla))        sec.dadoLibre      = true;
    if (stored.areaEfecto     !== false && sys.areaEfecto)                                     sec.areaEfecto     = true;

    ctx.secciones         = sec;
    ctx.seccionesActivas  = ALL_SECTIONS.filter(s => sec[s.key]);
    // allSectionsToggle drives the toggle-slider panel
    ctx.allSectionsToggle = ALL_SECTIONS.map(s => ({ ...s, active: !!sec[s.key] }));

    ctx.buffRows = (sys.buffs ?? []).map((b, idx) => ({
      ...b, idx,
      targetOptions:   BUFF_TARGETS.map(t => ({ ...t, selected: t.value === b.target })),
      scaleVarOptions: SCALE_VARS.map(v => ({ ...v, selected: (b.scaleVar || "none") === v.value })),
      showMult: (b.scaleVar || "none") !== "none",
    }));

    const tablaEntradas = (sys.dadoLibreEntradas ?? "").split("\n").filter(e => e.trim());
    ctx.dadoLibreNumEntradas = tablaEntradas.length;

    ctx.categorias = [
      { value: "arma",       label: "Arma" },
      { value: "armadura",   label: "Armadura" },
      { value: "equipo",     label: "Equipo / Objeto" },
      { value: "consumible", label: "Consumible" },
      { value: "feat",       label: "Feat / Clase" },
      { value: "caos",       label: "Caos Control" },
      { value: "tarjeta",    label: "Tarjeta" },
    ];

    return ctx;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Per-section collapse toggle
    const _toggleSection = el => {
      const sec = el.closest(".item-section");
      const btn = sec.querySelector(".sec-collapse-btn");
      sec.classList.toggle("collapsed");
      if (btn) btn.textContent = sec.classList.contains("collapsed") ? "▸" : "▾";
    };
    html.find(".sec-collapse-btn").click(ev => _toggleSection(ev.currentTarget));
    html.find(".sec-header .sec-title").click(ev => _toggleSection(ev.currentTarget));

    // Fix buff select values after render
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

    // Sections popup — floating overlay window
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

    // Section pill buttons — toggle active state
    html.find(".sec-add-btn").click(ev => {
      const key    = ev.currentTarget.dataset.key;
      const active = ev.currentTarget.classList.contains("sec-btn-active");
      this.item.update({ [`system.secciones.${key}`]: !active });
    });

    // × remove button inside each section header
    html.find(".sec-remove").click(ev => {
      const key = ev.currentTarget.closest(".item-section").dataset.secKey;
      this.item.update({ [`system.secciones.${key}`]: false });
    });

    html.find(".buff-add").click(this._onBuffAdd.bind(this));
    html.find(".buff-remove").click(this._onBuffRemove.bind(this));

    html.find(".buff-field").on("change", ev => {
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
      this.item.update({ "system.buffs": buffs });
    });

    html.find(".uso-tick").click(this._onUsoTick.bind(this));
  }

  async _onUsoTick() {
    const curr = this.item.system.usosActuales ?? 0;
    const max  = this.item.system.usosPorDesc ?? 0;
    this.item.update({ "system.usosActuales": Math.min(max, curr + 1) });
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
