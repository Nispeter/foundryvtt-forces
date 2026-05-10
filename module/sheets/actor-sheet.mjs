const SKILL_META = {
  carga:           { label: "Carga",           car: "Fr" },
  carrera:         { label: "Carrera",          car: "Vel" },
  motricidad:      { label: "Motricidad",       car: "Tec" },
  controlCorporal: { label: "Control corporal", car: "Tec" },
  quickThinking:   { label: "Quick thinking",   car: "Cog" },
  investigacion:   { label: "Investigación",    car: "Cog" },
  conocimiento:    { label: "Conocimiento",     car: "Cog" },
  liderazgo:       { label: "Liderazgo",        car: "Car" },
  empatia:         { label: "Empatía",          car: "Car" },
  actuacion:       { label: "Actuación",        car: "Car" },
  percepcion:      { label: "Percepción",       car: "Ins" },
  perspicacia:     { label: "Perspicacia",      car: "Ins" },
  meditacion:      { label: "Meditación",       car: "Cao" },
  deteccion:       { label: "Detección",        car: "Cao" },
};

const CAR_META = [
  { key: "fuerza",    label: "Fuerza" },
  { key: "aguante",   label: "Aguante" },
  { key: "velocidad", label: "Velocidad" },
  { key: "tecnica",   label: "Técnica" },
  { key: "cognicion", label: "Cognición" },
  { key: "carisma",   label: "Carisma" },
  { key: "instintos", label: "Instintos" },
];

const RANK_LETTERS = ["F", "E", "D", "C", "B", "A", "S"];

const MAEST_CAR_META = [...CAR_META, { key: "caos", label: "Caos" }];

function buildRankOptions(puntos) {
  return RANK_LETTERS.map((letter, value) => ({
    value, letter, selected: value === puntos,
  }));
}

export class ForcesActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes:   ["forces", "sheet", "actor"],
      template:  "systems/forces/templates/actor/character-sheet.hbs",
      width:     800,
      height:    960,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "principal" }],
      resizable: true,
    });
  }

  getData() {
    const ctx  = super.getData();
    const sys  = this.actor.system;
    ctx.system = sys;
    ctx.isChar = this.actor.type === "character";
    ctx.isNPC  = this.actor.type === "npc";

    // 7 main characteristics with rank options for the picker
    ctx.caracteristicasList = CAR_META.map(({ key, label }) => ({
      key, label, ...sys.caracteristicas[key],
      rankOptions: buildRankOptions(sys.caracteristicas[key].puntos),
    }));
    ctx.caos = {
      ...sys.caracteristicas.caos,
      rankOptions: buildRankOptions(sys.caracteristicas.caos.puntos),
    };

    // Skills with dots pre-computed (character only)
    if (ctx.isChar) {
      ctx.habilidadesList = Object.entries(SKILL_META).map(([key, { label, car }]) => {
        const skill = sys.habilidades[key];
        return {
          key, label, car,
          experticia: skill.experticia,
          total:      skill.total ?? 0,
          dots: [0, 1, 2].map(i => i < skill.experticia),
        };
      });
      const buildMaestList = (tipo) =>
        ["s", "a", "b"].map(sk => {
          const m = sys.maestrias[tipo][sk];
          return {
            slotKey: sk,
            ...m,
            carOptions: MAEST_CAR_META.map(({ key, label }) => ({
              key, label, selected: (m.caracteristica || "cognicion") === key,
            })),
          };
        });
      ctx.maestriasTeoricasList  = buildMaestList("teoricas");
      ctx.maestriasPracticasList = buildMaestList("practicas");
    } else {
      ctx.habilidadesList        = [];
      ctx.maestriasTeoricasList  = [];
      ctx.maestriasPracticasList = [];
    }

    // Items – grouped by categoria
    const allItems = this.actor.items.contents;
    ctx.itemsCaos     = allItems.filter(i => i.system.categoria === "caos");
    ctx.itemsFeats    = allItems.filter(i => i.system.categoria === "feat");
    ctx.itemsArmas    = allItems.filter(i => i.system.categoria === "arma");
    ctx.itemsTarjetas = allItems.filter(i => i.system.categoria === "tarjeta");
    ctx.itemsOtros    = allItems.filter(i => !["caos", "feat", "arma", "tarjeta"].includes(i.system.categoria));

    ctx.caosControlItems = ctx.itemsCaos;
    ctx.contadorItems    = allItems.length;

    return ctx;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Apply custom card colour as CSS variable on the sheet root
    const color = this.actor.system.cardColor ?? "#0b3d6b";
    html[0].closest(".app")?.style.setProperty("--card-color", color);

    // Rolls – available to everyone (including GM observers)
    html.find(".roll-caracteristica").click(ev =>
      this.actor.rollCaracteristica(ev.currentTarget.dataset.key)
    );
    html.find(".roll-caos-badge").click(() => this.actor.rollCaos());
    html.find(".roll-mov-badge").click(() => this.actor.rollMovimiento());
    html.find(".roll-habilidad").click(ev =>
      this.actor.rollHabilidad(ev.currentTarget.dataset.key)
    );
    html.find(".roll-ataque").click(ev =>
      this.actor.rollAtaque(ev.currentTarget.dataset.tipo ?? "fuerza", ev.currentTarget.textContent.trim())
    );
    html.find(".roll-reaccion").click(ev =>
      this.actor.rollReaccion(ev.currentTarget.dataset.tipo)
    );
    html.find(".roll-caos-item").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      const item   = this.actor.items.get(itemId);
      if (item) this.actor.rollCaosControl(item);
    });
    html.find(".roll-vida").click(() => this.actor.longRest());
    html.find(".maestria-roll").click(ev => {
      const btn = ev.currentTarget;
      this.actor.rollMaestria(btn.dataset.tipo, btn.dataset.slot);
    });

    // Click anywhere on item row (except controls/use-tick) → send to chat
    html.find(".item-entry").click(ev => {
      if (ev.target.closest(".item-controls, .item-uso-tick")) return;
      const wrap = ev.currentTarget.closest("[data-item-id]");
      const item = this.actor.items.get(wrap?.dataset.itemId);
      if (item) this.actor.useItem(item);
    });

    // Floating tooltip — one at a time, positioned to the right as a separate window
    let _currentExpand = null;
    let _ttTimer       = null;

    const _showTip = (wrap, mx, my) => {
      clearTimeout(_ttTimer);
      const expand = wrap.querySelector(".item-expand");
      if (!expand) return;

      // Hide previous tooltip
      if (_currentExpand && _currentExpand !== expand) {
        _currentExpand.style.display = "none";
      }
      _currentExpand = expand;

      // Build floating window structure once per render cycle
      if (!expand.querySelector(".ihc-win-header")) {
        const img  = wrap.querySelector(".item-img")?.getAttribute("src") ?? "";
        const name = wrap.querySelector(".item-name")?.textContent?.trim() ?? "";
        const hdr  = document.createElement("div");
        hdr.className = "ihc-win-header";
        hdr.innerHTML = `<img class="ihc-win-img" src="${img}"><span class="ihc-win-name">${name}</span>`;
        const body = document.createElement("div");
        body.className = "ihc-body";
        [...expand.childNodes].forEach(n => body.appendChild(n));
        expand.appendChild(body);
        expand.insertBefore(hdr, body);
      }

      // Position near mouse cursor; flip left/up if off-screen
      const W = 310, H = 360, PAD = 14;
      let left = mx + PAD;
      if (left + W > window.innerWidth - 8) left = mx - W - PAD;
      left = Math.max(8, left);
      let top = my - 24;
      if (top + H > window.innerHeight - 8) top = window.innerHeight - H - 8;
      top = Math.max(8, top);

      Object.assign(expand.style, {
        display: "block", position: "fixed",
        left: `${left}px`, top: `${top}px`,
        width: `${W}px`, zIndex: "10000",
      });
    };

    const _hideTip = (expand) => {
      _ttTimer = setTimeout(() => {
        if (expand) expand.style.display = "none";
        if (_currentExpand === expand) _currentExpand = null;
      }, 80);
    };

    html.find(".item-entry-wrap")
      .on("mouseenter", ev => _showTip(ev.currentTarget, ev.clientX, ev.clientY))
      .on("mouseleave", ev => _hideTip(ev.currentTarget.querySelector(".item-expand")));

    html.find(".item-expand")
      .on("mouseenter", () => clearTimeout(_ttTimer))
      .on("mouseleave", ev => {
        ev.currentTarget.style.display = "none";
        _currentExpand = null;
      });

    // Uses tick — decrement remaining uses (owner only via update permission)
    html.find(".item-uso-tick").click(ev => {
      const li   = ev.currentTarget.closest("[data-item-id]");
      const item = this.actor.items.get(li?.dataset.itemId);
      if (!item) return;
      const curr = item.system.usosActuales ?? 0;
      const max  = item.system.usosPorDesc ?? 0;
      item.update({ "system.usosActuales": curr <= 0 ? max : curr - 1 });
    });

    if (!this.isEditable) return;

    // Rank dropdown — change select to set characteristic puntos
    html.find(".rank-sel").change(ev => {
      const sel = ev.currentTarget;
      this.actor.update({
        [`system.caracteristicas.${sel.dataset.key}.puntos`]: parseInt(sel.value),
      });
    });

    // Skill dot toggle
    html.find(".skill-dot").click(ev => {
      const dot  = ev.currentTarget;
      const key  = dot.dataset.key;
      const idx  = parseInt(dot.dataset.idx);
      const curr = this.actor.system.habilidades[key].experticia;
      this.actor.update({ [`system.habilidades.${key}.experticia`]: curr === idx + 1 ? idx : idx + 1 });
    });

    // Item CRUD
    html.find(".item-create").click(ev => this._onItemCreate(ev));
    html.find(".item-edit").click(ev => {
      const li = ev.currentTarget.closest("[data-item-id]");
      this.actor.items.get(li.dataset.itemId)?.sheet.render(true);
    });
    html.find(".item-delete").click(ev => {
      const li = ev.currentTarget.closest("[data-item-id]");
      this.actor.items.get(li.dataset.itemId)?.delete();
    });
    html.find(".item-equip-toggle").click(ev => {
      const li   = ev.currentTarget.closest("[data-item-id]");
      const item = this.actor.items.get(li.dataset.itemId);
      if (item) item.update({ "system.equipado": !item.system.equipado });
    });
  }

  async _onItemCreate(ev) {
    const cat  = ev.currentTarget.dataset.cat ?? "equipo";
    const name = game.i18n.localize("FORCES.NewItem");

    // Auto-enable default sections for this category
    const { CAT_DEFAULTS } = await import("../data/item-data.mjs");
    const defaults = CAT_DEFAULTS[cat] ?? ["descripcion"];
    const secciones = {};
    for (const k of defaults) secciones[k] = true;

    const items = await this.actor.createEmbeddedDocuments("Item", [
      { name, type: "item", system: { categoria: cat, secciones } },
    ]);
    if (items?.[0]) items[0].sheet.render(true);
  }
}
