// Sheet de actor (character + npc). Construye listas para el template y
// conecta listeners. Lógica de datos vive en data/actor-data.mjs y documents/actor.mjs.

import { STAT_LABELS, STAT_ABBR, SKILL_KEYS, SKILL_LABELS, SKILL_STAT, RANK_LETTERS } from "../constants/stats.mjs";
import { AUTO_EQUIP_CATS } from "../constants/items.mjs";

// Labels cortos para selector de caracteristica en maestrías.
// Reusa STAT_ABBR para no duplicar.
const MAEST_CAR_META = Object.entries(STAT_ABBR).map(([key, label]) => ({ key, label }));

// Stats que aparecen en el panel de características (no incluye caos: va en su badge).
const PRINCIPAL_STAT_KEYS = ["fuerza", "aguante", "velocidad", "tecnica", "cognicion", "carisma", "instintos"];

// Construye [{ value, letter, selected }] para el dropdown de rangos por característica.
function buildRankOptions(puntos) {
  return RANK_LETTERS.map((letter, value) => ({ value, letter, selected: value === puntos }));
}

// L8: ordena items según el modo elegido. Default "ninguno" = item.sort
// (controlado por drag-and-drop, L9). Función genérica para todos los grupos.
function _sortItems(items, mode) {
  const cmpStr = (a, b) => (a ?? "").localeCompare(b ?? "", "es", { sensitivity: "base" });
  const arr = [...items];
  switch (mode) {
    case "nombre":
      arr.sort((a, b) => cmpStr(a.name, b.name)); break;
    case "clase":
      arr.sort((a, b) => cmpStr(a.system.claseReq, b.system.claseReq) || cmpStr(a.name, b.name)); break;
    case "nivel":
      arr.sort((a, b) => (a.system.nivelReq ?? 1) - (b.system.nivelReq ?? 1) || cmpStr(a.name, b.name)); break;
    case "dano":
      arr.sort((a, b) => cmpStr(a.system.dadoDanio, b.system.dadoDanio) || cmpStr(a.name, b.name)); break;
    case "costo":
      arr.sort((a, b) => (a.system.costoTarjeta ?? 0) - (b.system.costoTarjeta ?? 0) || cmpStr(a.name, b.name)); break;
    case "categoria":
      arr.sort((a, b) => cmpStr(a.system.categoria, b.system.categoria) || cmpStr(a.name, b.name)); break;
    case "ninguno":
    default:
      arr.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)); break;
  }
  return arr;
}

// Opciones del dropdown de sort por grupo. "Ninguno" siempre primero (default).
function _sortOptionsFor(group, current) {
  const sel = v => v === current;
  const base = [{ value: "ninguno", label: "—", selected: sel("ninguno") },
                { value: "nombre",  label: "Nombre", selected: sel("nombre") }];
  if (group === "feats") {
    base.push({ value: "clase", label: "Clase", selected: sel("clase") });
    base.push({ value: "nivel", label: "Nivel", selected: sel("nivel") });
  } else if (group === "armas") {
    base.push({ value: "dano", label: "Daño", selected: sel("dano") });
  } else if (group === "tarjetas") {
    base.push({ value: "costo", label: "Costo", selected: sel("costo") });
  } else if (group === "otros") {
    base.push({ value: "categoria", label: "Categ.", selected: sel("categoria") });
  }
  return base;
}

export class ForcesActorSheet extends ActorSheet {
  // Cleanup del popup al cerrar el sheet: el popup vive en document.body
  // y no se destruye automáticamente cuando se cierra el sheet.
  async close(options) {
    if (this._itemTip?.popup) {
      this._itemTip.popup.remove();
      this._itemTip = null;
    }
    return super.close(options);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes:   ["forces", "sheet", "actor"],
      template:  "systems/forces/templates/actor/character-sheet.hbs",
      width:     800,
      height:    840,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "principal" }],
      resizable: true,
      // L9: reorder usando el sistema de drag-drop nativo de Foundry.
      // dragSelector cubre tanto .items-list (objetos/feats) como .favoritos-section.
      dragDrop: [{ dragSelector: ".item-entry-wrap", dropSelector: ".items-list, .favoritos-section" }],
    });
  }

  // L9: sobrescribimos _onSortItem para que los siblings dependan del contexto.
  // - Drop dentro de .favoritos-section: siblings = todos los favoritos (cualquier categoría)
  // - Drop en una items-list de categoría: siblings = items de la misma categoría
  // El reorder modifica item.sort, que es global, así que el feat reordenado en
  // favoritos también cambia su posición en la sección de feats. Esto es
  // intencional y consistente con cómo Foundry maneja el sort.
  async _onSortItem(event, itemData) {
    const source = this.actor.items.get(itemData._id);
    if (!source) return;
    const dropTarget = event.target.closest("[data-item-id]");
    if (!dropTarget) return;
    const target = this.actor.items.get(dropTarget.dataset.itemId);
    if (!target || target.id === source.id) return;

    const inFavoritos = !!dropTarget.closest(".favoritos-section");
    const siblings = inFavoritos
      ? this.actor.items.filter(i => i.id !== source.id && i.system.favorito)
      : this.actor.items.filter(i => i.id !== source.id && i.system.categoria === source.system.categoria);

    const sortUpdates = SortingHelpers.performIntegerSort(source, { target, siblings });
    const updates = sortUpdates.map(u => ({ _id: u.target.id, sort: u.update.sort }));
    if (updates.length) return this.actor.updateEmbeddedDocuments("Item", updates);
  }

  getData() {
    const ctx  = super.getData();
    const sys  = this.actor.system;
    ctx.system = sys;
    ctx.isChar = this.actor.type === "character";
    ctx.isNPC  = this.actor.type === "npc";

    // Listas de características. breakdown = componentes del modificador (L14).
    // maestrias = lista informativa de maestrías asociadas (NO contribuyen al mod,
    // solo aplican en su propia tirada — diseño post-refactor).
    ctx.caracteristicasList = PRINCIPAL_STAT_KEYS.map(key => ({
      key,
      label: STAT_LABELS[key],
      ...sys.caracteristicas[key],
      rankOptions: buildRankOptions(sys.caracteristicas[key].puntos),
      breakdown:   sys.statBreakdown?.[key] ?? [],
      maestrias:   sys.maestriasInfo?.[key] ?? [],
    }));
    ctx.caos = {
      ...sys.caracteristicas.caos,
      rankOptions: buildRankOptions(sys.caracteristicas.caos.puntos),
      breakdown:   sys.statBreakdown?.caos ?? [],
      maestrias:   sys.maestriasInfo?.caos ?? [],
    };
    ctx.velocidad = {
      ...sys.caracteristicas.velocidad,
      rankOptions: buildRankOptions(sys.caracteristicas.velocidad.puntos),
      breakdown:   sys.statBreakdown?.velocidad ?? [],
      maestrias:   sys.maestriasInfo?.velocidad ?? [],
    };

    // Habilidades con metadata para el template (label, abreviatura del stat, dots).
    ctx.habilidadesList = SKILL_KEYS.map(key => {
      const skill = sys.habilidades[key];
      return {
        key,
        label:      SKILL_LABELS[key],
        car:        STAT_ABBR[SKILL_STAT[key]],
        experticia: skill.experticia,
        total:      skill.total ?? 0,
        dots:       [0, 1, 2].map(i => i < skill.experticia),
      };
    });

    // Maestrías (3 slots S/A/B por tipo teóricas/prácticas).
    const buildMaestList = (tipo) =>
      ["s", "a", "b"].map(sk => {
        const m = sys.maestrias[tipo][sk];
        return {
          slotKey: sk,
          ...m,
          carOptions: MAEST_CAR_META.map(({ key, label }) => ({
            key, label,
            selected: (m.caracteristica || "cognicion") === key,
          })),
        };
      });
    ctx.maestriasTeoricasList  = buildMaestList("teoricas");
    ctx.maestriasPracticasList = buildMaestList("practicas");

    // Filtrado + sort de items por categoría (L8 + L9: persiste en flag).
    // Default "ninguno" = item.sort (drag-and-drop manual).
    const allItems = this.actor.items.contents;
    const getSort = (group) => this.actor.getFlag("forces", `sort_${group}`) || "ninguno";
    const sortFor = (group) => getSort(group);

    ctx.sortArmas    = sortFor("armas");
    ctx.sortFeats    = sortFor("feats");
    ctx.sortCaos     = sortFor("caos");
    ctx.sortTarjetas = sortFor("tarjetas");
    ctx.sortOtros    = sortFor("otros");
    ctx.sortLoot     = sortFor("loot");

    ctx.sortOptionsArmas    = _sortOptionsFor("armas",    ctx.sortArmas);
    ctx.sortOptionsFeats    = _sortOptionsFor("feats",    ctx.sortFeats);
    ctx.sortOptionsCaos     = _sortOptionsFor("caos",     ctx.sortCaos);
    ctx.sortOptionsTarjetas = _sortOptionsFor("tarjetas", ctx.sortTarjetas);
    ctx.sortOptionsOtros    = _sortOptionsFor("otros",    ctx.sortOtros);
    ctx.sortOptionsLoot     = _sortOptionsFor("loot",     ctx.sortLoot);

    ctx.itemsArmas     = _sortItems(allItems.filter(i => i.system.categoria === "arma"),    ctx.sortArmas);
    ctx.itemsCaos      = _sortItems(allItems.filter(i => i.system.categoria === "caos"),    ctx.sortCaos);
    ctx.itemsFeats     = _sortItems(allItems.filter(i => i.system.categoria === "feat"),    ctx.sortFeats);
    ctx.itemsTarjetas  = _sortItems(allItems.filter(i => i.system.categoria === "tarjeta"), ctx.sortTarjetas);
    ctx.itemsLoot      = _sortItems(allItems.filter(i => i.system.categoria === "loot"),    ctx.sortLoot);
    ctx.itemsOtros     = _sortItems(
      allItems.filter(i => !["caos", "feat", "arma", "tarjeta", "loot"].includes(i.system.categoria)),
      ctx.sortOtros,
    );
    ctx.itemsFavoritos = _sortItems(allItems.filter(i => i.system.favorito), "ninguno");
    ctx.caosControlItems = ctx.itemsCaos;
    ctx.contadorItems    = allItems.length;

    // L7: opciones para selector de tamaño de token. Detecta el actual leyendo
    // prototypeToken.width (0.5 / 1 / 2). Valores fuera de esos 3 se muestran como medium.
    const tokWidth = this.actor.prototypeToken?.width ?? 1;
    const tokSize  = tokWidth === 0.5 ? "small" : tokWidth === 2 ? "large" : "medium";
    ctx.tokenSizeOptions = [
      { value: "small",  label: "S",  selected: tokSize === "small"  },
      { value: "medium", label: "M",  selected: tokSize === "medium" },
      { value: "large",  label: "L",  selected: tokSize === "large"  },
    ];

    // Slots: las tarjetas equipadas consumen slots; objetos equipados aportan slots.
    const tarjetasActivas = ctx.itemsTarjetas.filter(i => i.system.equipado);
    ctx.slotsUsados = tarjetasActivas.reduce((s, i) => s + (i.system.costoTarjeta ?? 1), 0);
    ctx.slotsDisponibles = (sys.baseSlots ?? 3) + allItems
      .filter(i => i.system.equipado && (i.system.slots ?? 0) > 0)
      .reduce((s, i) => s + (i.system.slots ?? 0), 0);
    // Slots libres = disponibles - usados, clamp a 0 si over-equipado (no negativo).
    ctx.slotsLibres = Math.max(0, ctx.slotsDisponibles - ctx.slotsUsados);

    return ctx;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Cada listener corre en su propio try/catch para que un bug en una sección
    // no impida que el resto del sheet funcione (i.e. la hoja al menos se abre).
    const safe = (name, fn) => {
      try { fn(); }
      catch (err) { console.error(`Forces | error in ${name}:`, err); }
    };

    safe("card-color", () => {
      const color = this.actor.system.cardColor ?? "#0b3d6b";
      html[0]?.closest(".app")?.style.setProperty("--card-color", color);
    });
    safe("rollListeners",         () => this._activateRollListeners(html));
    safe("itemListeners",         () => this._activateItemListeners(html));
    safe("tooltipListeners",      () => this._activateTooltipListeners(html));
    safe("statBreakdownTooltip",  () => this._activateStatBreakdownTooltip(html));
    safe("dragReorder",           () => this._activateDragReorder(html));

    if (!this.isEditable) return;
    safe("editListeners",   () => this._activateEditListeners(html));
    safe("deltaInputs",     () => this._activateDeltaInputs(html));
  }

  // L15: inputs ±. Aceptan "+5", "-3" como delta sobre el valor actual,
  // o un número absoluto como antes. Se invoca al blur o Enter.
  _activateDeltaInputs(html) {
    const apply = (input) => {
      const raw = (input.value ?? "").trim();
      const target = input.dataset.deltaTarget;
      if (!target) return;
      const curr = Number(foundry.utils.getProperty(this.actor, target)) || 0;
      const maxPath = input.dataset.deltaClampMax;
      const max = maxPath ? (Number(foundry.utils.getProperty(this.actor, maxPath)) || Infinity) : Infinity;

      let next;
      if (raw === "") {
        next = curr;
      } else if (raw.startsWith("+") || raw.startsWith("-")) {
        const delta = parseInt(raw, 10);
        if (Number.isNaN(delta)) { input.value = curr; return; }
        next = curr + delta;
      } else {
        const abs = parseInt(raw, 10);
        if (Number.isNaN(abs)) { input.value = curr; return; }
        next = abs;
      }
      next = Math.max(0, Math.min(max, next));
      this.actor.update({ [target]: next });
    };

    html.find(".delta-input").each((_i, input) => {
      // blur aplica el cambio. Enter dispara blur con submit nativo.
      input.addEventListener("blur", () => apply(input));
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); input.blur(); }
        else if (ev.key === "Escape") { input.value = foundry.utils.getProperty(this.actor, input.dataset.deltaTarget) ?? 0; input.blur(); }
      });
    });
  }

  // ── Rolls ─────────────────────────────────────────────────────────────────

  _activateRollListeners(html) {
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
    html.find(".roll-short-rest").click(() => this.actor.shortRest());
    html.find(".roll-recarga").click(() => this.actor.recarga());
    html.find(".roll-nivel-up").click(() => this.actor.levelUp());
    html.find(".maestria-roll").click(ev => {
      const btn = ev.currentTarget;
      this.actor.rollMaestria(btn.dataset.tipo, btn.dataset.slot);
    });
  }

  // ── Items (clicks generales) ──────────────────────────────────────────────

  _activateItemListeners(html) {
    // Click en fila de item → mandar tarjeta a chat (excluye sub-clicks).
    html.find(".item-entry").click(ev => {
      if (ev.target.closest(".item-controls, .item-uso-tick, .item-favorito-toggle")) return;
      const wrap = ev.currentTarget.closest("[data-item-id]");
      const item = this.actor.items.get(wrap?.dataset.itemId);
      if (item) this.actor.useItem(item);
    });

    // Collapse de sección en pestaña principal.
    html.find(".section-collapse-btn").click(ev => {
      const block = ev.currentTarget.closest(".section-block");
      if (!block) return;
      block.classList.toggle("collapsed");
      ev.currentTarget.textContent = block.classList.contains("collapsed") ? "▸" : "▾";
    });

    // Decrementar usos.
    html.find(".item-uso-tick").click(ev => {
      const li   = ev.currentTarget.closest("[data-item-id]");
      const item = this.actor.items.get(li?.dataset.itemId);
      if (!item) return;
      const curr = item.system.usosActuales ?? 0;
      const max  = item.system.usosPorDesc ?? 0;
      // Si llega a 0, el siguiente click resetea a max (atajo).
      item.update({ "system.usosActuales": curr <= 0 ? max : curr - 1 });
    });

    // Toggle favorito.
    html.find(".item-favorito-toggle").click(ev => {
      ev.stopPropagation();
      const li   = ev.currentTarget.closest("[data-item-id]");
      const item = this.actor.items.get(li?.dataset.itemId);
      if (item) item.update({ "system.favorito": !item.system.favorito });
    });
  }

  // ── Tooltip flotante de item ──────────────────────────────────────────────
  // El popup se appendea a document.body para sobrevivir a re-renders del sheet
  // (useItem actualiza usos/EC y dispara render → si el popup estuviera dentro
  // del sheet HTML se destruiría al clickear). Estado persistente en this._itemTip.

  _activateTooltipListeners(html) {
    const HOVER_DELAY_MS = 500;
    const PAD            = 6;

    this._itemTip = this._itemTip || { popup: null, currentItemId: null, showTimer: null, hideTimer: null };
    const state = this._itemTip;

    // Solo destruye el popup. NO toca timers: si hay un showTimer pendiente
    // para OTRO item, debe poder ejecutarse normalmente (antes hideTimer mataba
    // showTimer y por eso el tooltip no reaparecía al saltar de un nombre a otro).
    const _destroyPopup = () => {
      if (state.popup) { state.popup.remove(); state.popup = null; }
      state.currentItemId = null;
    };

    const _position = (popup, mx, my) => {
      Object.assign(popup.style, { position: "fixed", left: "0px", top: "0px" });
      const W = popup.offsetWidth  || 310;
      const H = popup.offsetHeight || 360;
      let left = mx + PAD;
      if (left + W > window.innerWidth - 8) left = mx - W - PAD;
      left = Math.max(8, left);
      let top = my + PAD;
      if (top + H > window.innerHeight - 8) top = my - H - PAD;
      top = Math.max(8, top);
      Object.assign(popup.style, { left: `${left}px`, top: `${top}px` });
    };

    const _scheduleHide = () => {
      clearTimeout(state.hideTimer);
      state.hideTimer = setTimeout(_destroyPopup, 120);
    };

    const _show = (wrap, mx, my) => {
      clearTimeout(state.hideTimer);
      const itemId = wrap.dataset.itemId;
      const expand = wrap.querySelector(".item-expand");
      if (!expand) return;

      if (state.popup && state.currentItemId === itemId) {
        _position(state.popup, mx, my);
        return;
      }

      _destroyPopup();

      const img  = wrap.querySelector(".item-img")?.getAttribute("src") ?? "";
      const name = wrap.querySelector(".item-name")?.textContent?.trim() ?? "";
      const popup = document.createElement("div");
      popup.className = "item-tooltip-popup";
      popup.innerHTML = `
        <div class="ihc-win-header"><img class="ihc-win-img" src="${img}"><span class="ihc-win-name">${name}</span></div>
        <div class="ihc-body">${expand.innerHTML}</div>
      `;
      document.body.appendChild(popup);
      state.popup = popup;
      state.currentItemId = itemId;
      _position(popup, mx, my);

      popup.addEventListener("mouseenter", () => clearTimeout(state.hideTimer));
      popup.addEventListener("mouseleave", () => _scheduleHide());
    };

    html.find(".item-expand-trigger").on("mouseenter", ev => {
      const wrap = ev.currentTarget.closest(".item-entry-wrap");
      if (!wrap) return;
      const mx = ev.clientX, my = ev.clientY;
      const itemId = wrap.dataset.itemId;

      // Cancel pending hide: si entramos a un trigger (mismo o distinto item)
      // ya no queremos cerrar el popup actual.
      clearTimeout(state.hideTimer);

      // Si ya hay popup mostrando este item, reposicionar (no flicker).
      if (state.popup && state.currentItemId === itemId) {
        _position(state.popup, mx, my);
        return;
      }

      // Item nuevo: cancelar show pendiente (para otro item) y programar nuevo.
      // El popup viejo (si existe) sigue visible hasta que _show lo reemplace.
      clearTimeout(state.showTimer);
      state.showTimer = setTimeout(() => _show(wrap, mx, my), HOVER_DELAY_MS);
    });

    html.find(".item-expand-trigger").on("mouseleave", () => {
      // Mouse se fue del trigger: cancelar show pendiente (el usuario no se va
      // a quedar 500ms para ver el tooltip si ya movió el mouse).
      clearTimeout(state.showTimer);
    });

    html.find(".item-entry-wrap").on("mouseleave", () => {
      _scheduleHide();
    });
  }

  // ── Tooltip flotante de descomposición de stat en bio (L14, ahora floating) ──

  _activateStatBreakdownTooltip(html) {
    const HOVER_DELAY_MS = 500;
    const PAD            = 6;
    let showTimer = null;
    let popup     = null;

    const sys = this.actor.system;
    const escapeHtml = s => String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

    // Construye los datos desde el actor (no del DOM/template). Esto evita
    // todo edge case de parsing y deja el template HTML trivialmente renderizable.
    const _dataFor = (statKey) => {
      const car = sys.caracteristicas?.[statKey];
      if (!car) return null;
      const STAT_LABELS_LOCAL = STAT_LABELS;
      return {
        label:     STAT_LABELS_LOCAL[statKey] ?? statKey,
        mod:       car.modificador ?? 0,
        breakdown: sys.statBreakdown?.[statKey] ?? [],
        maestrias: sys.maestriasInfo?.[statKey] ?? [],
      };
    };

    const _hide = () => {
      if (popup) { popup.remove(); popup = null; }
      clearTimeout(showTimer);
    };

    const _render = (data) => {
      const sign = v => (v >= 0 ? `+${v}` : `${v}`);
      const breakdownTotal = (data.breakdown ?? []).reduce((acc, r) => acc + (r.value ?? 0), 0);
      const rows = (data.breakdown ?? [])
        .map(r => `<div class="sbd-row"><span class="sbd-src">${escapeHtml(r.source)}</span><span class="sbd-val">${sign(r.value)}</span></div>`)
        .join("");
      const maestRows = (data.maestrias ?? []).length
        ? `<div class="sbd-section-title">Maestrías asociadas (aplican solo en su tirada)</div>` +
          data.maestrias.map(m =>
            `<div class="sbd-row sbd-row-maest"><span class="sbd-src">${escapeHtml(m.nombre)} [${escapeHtml(m.rank)}]</span><span class="sbd-val">${sign(m.bonus)}</span></div>`
          ).join("")
        : "";
      const mismatch = breakdownTotal !== data.mod
        ? `<div class="sbd-warn">⚠ Suma de componentes (${sign(breakdownTotal)}) ≠ mod mostrado (${sign(data.mod)})</div>`
        : "";
      return `
        <div class="sbd-title">${escapeHtml(data.label)}: total ${sign(data.mod)}</div>
        ${rows}
        ${mismatch}
        ${maestRows}
      `;
    };

    const _show = (cell, mx, my) => {
      const statKey = cell.dataset.statKey;
      const data = _dataFor(statKey);
      if (!data) return;

      if (popup) popup.remove();
      popup = document.createElement("div");
      popup.className = "stat-breakdown-popup";
      popup.innerHTML = _render(data);
      document.body.appendChild(popup);

      const W = popup.offsetWidth  || 240;
      const H = popup.offsetHeight || 120;
      let left = mx + PAD;
      if (left + W > window.innerWidth - 8) left = mx - W - PAD;
      left = Math.max(8, left);
      let top = my + PAD;
      if (top + H > window.innerHeight - 8) top = my - H - PAD;
      top = Math.max(8, top);
      Object.assign(popup.style, { left: `${left}px`, top: `${top}px` });
    };

    html.find(".stat-disp-cell").on("mouseenter", ev => {
      const cell = ev.currentTarget;
      const mx = ev.clientX, my = ev.clientY;
      clearTimeout(showTimer);
      showTimer = setTimeout(() => _show(cell, mx, my), HOVER_DELAY_MS);
    });
    html.find(".stat-disp-cell").on("mouseleave", _hide);
  }

  // ── L9: drag-and-drop reorder dentro de cada items-list ───────────────────
  // Usa SortingHelpers.performIntegerSort de Foundry para asignar sort values.
  // Solo permite reordenar dentro de la misma categoría visual; entre categorías
  // mantenemos el orden por sort natural del Item.

  _activateDragReorder(html) {
    if (!this.isEditable) return;
    // html puede ser jQuery (V11/V12) o HTMLElement (V13). Normalizar.
    const root = html instanceof jQuery ? html[0] : html;
    if (!root || typeof root.querySelectorAll !== "function") return;

    // Foundry hace todo el binding via su sistema dragDrop (configurado en
    // defaultOptions). Acá solo aseguramos atributos draggable correctos:
    //  - wraps draggables (Foundry agrega los listeners via su DragDrop class)
    //  - imgs NO draggables (sino el browser inicia drag del img y se pierde)
    // Aplica a items en .items-list (objetos/feats) y .favoritos-section.
    root.querySelectorAll(".item-entry-wrap")
      .forEach(w => w.setAttribute("draggable", "true"));
    root.querySelectorAll(".item-entry-wrap .item-img")
      .forEach(img => img.setAttribute("draggable", "false"));
  }

  // ── Listeners solo si el sheet es editable ────────────────────────────────

  _activateEditListeners(html) {
    html.find(".rank-sel").change(ev => {
      const sel = ev.currentTarget;
      this.actor.update({
        [`system.caracteristicas.${sel.dataset.key}.puntos`]: parseInt(sel.value),
      });
    });

    html.find(".skill-dot").click(ev => {
      const dot  = ev.currentTarget;
      const key  = dot.dataset.key;
      const idx  = parseInt(dot.dataset.idx);
      const curr = this.actor.system.habilidades[key].experticia;
      // Click en el dot ya activado → bajar 1 nivel; click en otro → activar hasta idx+1.
      this.actor.update({ [`system.habilidades.${key}.experticia`]: curr === idx + 1 ? idx : idx + 1 });
    });

    html.find(".item-create").click(ev => this._onItemCreate(ev));

    // L8: cambio de sort por grupo. data-group identifica el grupo (feats, armas, etc.).
    html.find(".group-sort-sel").change(ev => {
      const group = ev.currentTarget.dataset.group;
      if (!group) return;
      this.actor.setFlag("forces", `sort_${group}`, ev.currentTarget.value);
    });

    // L7: cambio de tamaño de token. Actualiza prototypeToken (para nuevos tokens)
    // y todos los tokens existentes del actor en la escena actual.
    html.find(".token-size-sel").change(async ev => {
      const sz = ev.currentTarget.value;
      const dim = sz === "small" ? 0.5 : sz === "large" ? 2 : 1;
      await this.actor.update({ "prototypeToken.width": dim, "prototypeToken.height": dim });
      const tokenUpdates = canvas.tokens?.placeables
        ?.filter(t => t.actor?.id === this.actor.id)
        ?.map(t => ({ _id: t.id, width: dim, height: dim })) ?? [];
      if (tokenUpdates.length) {
        await canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
      }
    });
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

    // Las secciones por defecto se importan en runtime para evitar ciclo de imports.
    const { CAT_DEFAULTS } = await import("../constants/items.mjs");
    const defaults = CAT_DEFAULTS[cat] ?? ["descripcion"];
    const secciones = {};
    for (const k of defaults) secciones[k] = true;

    const equipado = AUTO_EQUIP_CATS.includes(cat);

    const items = await this.actor.createEmbeddedDocuments("Item", [
      { name, type: "item", system: { categoria: cat, secciones, equipado } },
    ]);
    if (items?.[0]) items[0].sheet.render(true);
  }
}
