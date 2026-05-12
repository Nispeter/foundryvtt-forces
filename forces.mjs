import { ForcesActorData, ForcesNPCData } from "./module/data/actor-data.mjs";
import { ForcesItemData } from "./module/data/item-data.mjs";
import { ForcesActor, rollDialog, d20Formula } from "./module/documents/actor.mjs";
import { ForcesActorSheet } from "./module/sheets/actor-sheet.mjs";
import { ForcesItemSheet } from "./module/sheets/item-sheet.mjs";

/* ─── Handlebars helpers ─── */
Handlebars.registerHelper("signedNum", n => { const v = Number(n)||0; return v >= 0 ? `+${v}` : `${v}`; });
Handlebars.registerHelper("lowercase", s => (s ?? "").toLowerCase());
// rankClass: converts rank string to a safe CSS class name (S+ → splus)
Handlebars.registerHelper("rankClass", r => (r ?? "f").toLowerCase().replace("+", "plus"));
Handlebars.registerHelper("eq",  (a, b) => a === b);
Handlebars.registerHelper("neq", (a, b) => a !== b);
Handlebars.registerHelper("lte", (a, b) => a <= b);
Handlebars.registerHelper("or",  (a, b) => a || b);
Handlebars.registerHelper("pct", (v, m) =>
  Math.min(100, Math.max(0, ((Number(v) || 0) / Math.max(1, Number(m) || 1)) * 100)).toFixed(1)
);
Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));
Handlebars.registerHelper("catClass", cat => {
  return { arma:"cat-arma", armadura:"cat-armor", equipo:"cat-equipo",
           consumible:"cat-consumible", feat:"cat-feat", caos:"cat-caos",
           tarjeta:"cat-tarjeta" }[cat] ?? "cat-equipo";
});

/* ─── Track last mouse-click position for dialog placement ─── */
document.addEventListener("mousedown", ev => {
  window._forcesLastClick = { x: ev.clientX, y: ev.clientY };
});

/* ─── init ─── */
Hooks.once("init", () => {
  console.log("Forces | Initializing – Fuck it, we ball 🦔");

  CONFIG.Actor.documentClass = ForcesActor;

  CONFIG.Actor.dataModels = { character: ForcesActorData, npc: ForcesNPCData };
  CONFIG.Item.dataModels  = { item: ForcesItemData };

  CONFIG.Actor.trackableAttributes = {
    character: {
      bar:   ["defensas.vida", "defensas.energiaCaotica"],
      value: ["defensas.defensaCorporal", "defensas.defensaCaotica", "movimiento", "defensas.anillos.value"],
    },
    npc: {
      bar:   ["defensas.vida", "defensas.energiaCaotica"],
      value: ["defensas.defensaCorporal", "defensas.defensaCaotica"],
    },
  };

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("forces", ForcesActorSheet, {
    types: ["character", "npc"], makeDefault: true, label: "FORCES.SheetLabel",
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("forces", ForcesItemSheet, {
    types: ["item"], makeDefault: true, label: "FORCES.ItemSheetLabel",
  });

  loadTemplates([
    "systems/forces/templates/actor/character-sheet.hbs",
    "systems/forces/templates/item/item-sheet.hbs",
  ]);
});

Hooks.once("ready", () => {
  console.log("Forces | Ready. ¡Fuck it, we ball!");

  // Track canvas-space mouse position so chat buttons can place templates instantly
  document.getElementById("board")?.addEventListener("mousemove", ev => {
    const t = canvas?.stage?.worldTransform;
    if (!t) return;
    window._forcesCanvasPos = {
      x: (ev.clientX - t.tx) / t.a,
      y: (ev.clientY - t.ty) / t.d,
    };
  });
});

/* ─── Chat card roll buttons ─── */
Hooks.on("renderChatMessage", (_msg, html) => {
  html.find("[data-action='roll-damage']").click(async ev => {
    const btn   = ev.currentTarget;
    const actor = game.actors.get(btn.dataset.actorId);
    const item  = actor?.items.get(btn.dataset.itemId);
    if (!actor || !item) return;
    const sys    = item.system;
    const base   = sys.bonusDanio ? `${sys.dadoDanio}+${sys.bonusDanio}` : sys.dadoDanio;
    const opts   = await rollDialog(`Daño — ${item.name}`);
    if (!opts) return;
    const bonStr  = opts.bonus ? (opts.bonus >= 0 ? `+${opts.bonus}` : `${opts.bonus}`) : "";
    const formula = `${base}${bonStr}`;
    let roll;
    if (opts.mode === "normal") {
      roll = new Roll(formula); await roll.evaluate();
    } else {
      const r1 = new Roll(formula), r2 = new Roll(formula);
      await r1.evaluate(); await r2.evaluate();
      roll = opts.mode === "adv" ? (r1.total >= r2.total ? r1 : r2) : (r1.total <= r2.total ? r1 : r2);
    }
    const modeTag = opts.mode === "adv" ? " [Ventaja]" : opts.mode === "dis" ? " [Desventaja]" : "";
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  `<strong>${item.name}</strong> — Daño${sys.danioTipo ? ` (${sys.danioTipo})` : ""}${modeTag}`,
    });
  });

  html.find("[data-action='roll-attack']").click(async ev => {
    const btn      = ev.currentTarget;
    const actor    = game.actors.get(btn.dataset.actorId);
    const item     = actor?.items.get(btn.dataset.itemId);
    if (!actor || !item) return;
    const tipo     = btn.dataset.tipo || "fuerza";
    const baseMod  = (actor.system.caracteristicas[tipo]?.modificador ?? 0) + (item.system.bonusHit ?? 0);
    const opts     = await rollDialog(`Ataque — ${item.name} (${tipo})`);
    if (!opts) return;
    const roll     = new Roll(d20Formula(baseMod, opts));
    await roll.evaluate();
    const modeTag  = opts.mode === "adv" ? " [Ventaja]" : opts.mode === "dis" ? " [Desventaja]" : "";
    const bonStr   = opts.bonus ? ` +bns${opts.bonus >= 0 ? "+" : ""}${opts.bonus}` : "";
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  `<strong>${item.name}</strong> — Ataque (${tipo}) ${baseMod >= 0 ? "+" : ""}${baseMod}${bonStr}${modeTag}`,
    });
  });

  html.find("[data-action='roll-caos']").click(async ev => {
    const btn   = ev.currentTarget;
    const actor = game.actors.get(btn.dataset.actorId);
    const item  = actor?.items.get(btn.dataset.itemId);
    if (!actor || !item) return;
    const mod   = actor.system.caracteristicas.caos.modificador;
    const opts  = await rollDialog(`Caos Control — ${item.name}`);
    if (!opts) return;
    const roll  = new Roll(d20Formula(mod, opts));
    await roll.evaluate();
    const modeTag = opts.mode === "adv" ? " [Ventaja]" : opts.mode === "dis" ? " [Desventaja]" : "";
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  `<strong>${item.name}</strong> — Caos Control mod ${mod >= 0 ? "+" : ""}${mod}${modeTag}`,
    });
  });

  html.find("[data-action='roll-dado-libre']").click(async ev => {
    const btn     = ev.currentTarget;
    const formula = btn.dataset.formula;
    const label   = btn.dataset.label || "Tirada libre";
    if (!formula) return;
    const opts = await rollDialog(label);
    if (!opts) return;
    const bonus = opts.bonus ? (opts.bonus >= 0 ? `+${opts.bonus}` : `${opts.bonus}`) : "";
    const full  = `${formula}${bonus}`;
    let roll;
    if (opts.mode === "normal") {
      roll = new Roll(full); await roll.evaluate();
    } else {
      const r1 = new Roll(full), r2 = new Roll(full);
      await r1.evaluate(); await r2.evaluate();
      roll = opts.mode === "adv" ? (r1.total >= r2.total ? r1 : r2) : (r1.total <= r2.total ? r1 : r2);
    }
    const modeTag = opts.mode === "adv" ? " [Ventaja]" : opts.mode === "dis" ? " [Desventaja]" : "";
    await roll.toMessage({
      flavor: `<strong>${label}</strong>${modeTag}`,
    });
  });

  html.find("[data-action='roll-tabla']").click(async ev => {
    const btn   = ev.currentTarget;
    const actor = game.actors.get(btn.dataset.actorId);
    const item  = actor?.items.get(btn.dataset.itemId);
    if (!actor || !item) return;
    const entries = (item.system.dadoLibreEntradas ?? "").split("\n").filter(e => e.trim());
    if (!entries.length) return;
    const label = item.system.dadoLibreLabel || "Tabla";
    const n     = entries.length;
    const opts  = await rollDialog(`${label} (1d${n})`);
    if (!opts) return;
    const formula = `1d${n}`;
    let roll;
    if (opts.mode === "normal") {
      roll = new Roll(formula); await roll.evaluate();
    } else {
      const r1 = new Roll(formula), r2 = new Roll(formula);
      await r1.evaluate(); await r2.evaluate();
      roll = opts.mode === "adv" ? (r1.total >= r2.total ? r1 : r2) : (r1.total <= r2.total ? r1 : r2);
    }
    const idx     = Math.max(0, Math.min(n - 1, roll.total - 1));
    const result  = entries[idx];
    const modeTag = opts.mode === "adv" ? " [Ventaja]" : opts.mode === "dis" ? " [Desventaja]" : "";
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  `<strong>${label}</strong> — ${formula}${modeTag}<br><span class="fci-tabla-result">📋 ${roll.total}. ${result}</span>`,
    });
  });

  html.find("[data-action='place-area-template']").click(ev => {
    const btn  = ev.currentTarget;
    const dist = Number(btn.dataset.dist) || 5;
    const tipo = (btn.dataset.tipo || "esfera").toLowerCase();
    const SHAPE = {
      esfera: "circle", sphere: "circle", circle: "circle",
      cono:   "cone",   cone:   "cone",
      linea:  "ray",    line:   "ray",    ray:    "ray",
      cuadrado: "rect", cubo:   "rect",   rect:   "rect", square: "rect",
    };
    const shape = SHAPE[tipo] ?? "circle";

    if (!canvas?.scene) return ui.notifications.warn("Necesitas una escena activa para colocar la plantilla.");

    const gridDist  = canvas.scene.grid?.distance ?? 5;
    const pxPerUnit = canvas.grid.size / gridDist;
    const r         = dist * pxPerUnit;
    const halfAngle = (53.13 / 2) * (Math.PI / 180);
    const rayHalfW  = 2.5 * pxPerUnit;
    const colorHex  = game.user.color ?? "#ff9900";
    const colorInt  = parseInt(colorHex.replace("#", ""), 16);

    const preview   = new PIXI.Graphics();
    const container = canvas.interface ?? canvas.stage;
    container.addChild(preview);

    const drawAt = (x, y) => {
      preview.clear();
      preview.lineStyle(2, colorInt, 1);
      preview.beginFill(colorInt, 0.18);
      switch (shape) {
        case "circle": preview.drawCircle(x, y, r); break;
        case "rect":   preview.drawRect(x - r / 2, y - r / 2, r, r); break;
        case "cone":
          preview.moveTo(x, y);
          preview.lineTo(x + Math.cos(-halfAngle) * r, y + Math.sin(-halfAngle) * r);
          preview.arc(x, y, r, -halfAngle, halfAngle);
          preview.closePath();
          break;
        case "ray":
          preview.drawRect(x, y - rayHalfW, r, rayHalfW * 2);
          break;
      }
      preview.endFill();
    };

    const toWorld = (clientX, clientY) => {
      const t = canvas.stage.worldTransform;
      return { x: (clientX - t.tx) / t.a, y: (clientY - t.ty) / t.d };
    };

    const snap = (pos) => {
      try { return canvas.grid.getSnappedPoint?.(pos) ?? canvas.grid.getSnappedPosition?.(pos.x, pos.y) ?? pos; }
      catch { return pos; }
    };

    // Get the bounding rect of the PIXI canvas for in-bounds check
    const canvasEl = canvas.app.view ?? canvas.app.renderer?.view;
    const board    = canvasEl ?? document.getElementById("board");
    if (board) board.style.cursor = "crosshair";

    // Initial preview at last known mouse position
    const initPos = canvas.mousePosition ?? window._forcesCanvasPos ?? { x: 0, y: 0 };
    drawAt(snap(initPos).x, snap(initPos).y);

    const inBounds = (clientX, clientY) => {
      if (!canvasEl) return true; // no bounds check fallback
      const r = canvasEl.getBoundingClientRect();
      return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    };

    const cleanup = () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
      if (board) board.style.cursor = "";
      if (preview && !preview.destroyed) preview.destroy();
    };

    const onMove = (moveEv) => {
      if (!inBounds(moveEv.clientX, moveEv.clientY)) return;
      try { const p = snap(toWorld(moveEv.clientX, moveEv.clientY)); drawAt(p.x, p.y); } catch {}
    };

    const onPointer = async (pEv) => {
      if (!inBounds(pEv.clientX, pEv.clientY)) return;
      if (pEv.button === 2) { pEv.preventDefault(); pEv.stopPropagation(); cleanup(); return; }
      if (pEv.button !== 0) return;
      pEv.preventDefault();
      pEv.stopPropagation();
      cleanup();
      const pos = snap(toWorld(pEv.clientX, pEv.clientY));
      try {
        await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
          t: shape, x: pos.x, y: pos.y,
          distance: dist, direction: 0,
          angle:    shape === "cone" ? 53.13 : shape === "ray" ? 5 : 360,
          width:    shape === "ray" ? 5 : undefined,
          user:     game.user.id,
          fillColor: colorHex,
        }]);
      } catch (err) {
        console.error("Forces | Template error:", err);
        ui.notifications.warn("No se pudo colocar la plantilla: " + err.message);
      }
    };

    const onKey = (kEv) => { if (kEv.key === "Escape") { kEv.preventDefault(); cleanup(); } };

    // Capture phase on document — intercepts before any element or PIXI handler
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
  });

  html.find("[data-action='refund-uses']").click(async ev => {
    const btn   = ev.currentTarget;
    const actor = game.actors.get(btn.dataset.actorId);
    const item  = actor?.items.get(btn.dataset.itemId);
    if (!actor?.isOwner || !item) return;
    const curr = item.system.usosActuales ?? 0;
    const max  = item.system.usosPorDesc  ?? 0;
    if (curr >= max) { btn.disabled = true; return; }
    await item.update({ "system.usosActuales": curr + 1 });
    btn.disabled = true;
    btn.textContent = "✓ Restaurado";
    ui.notifications.info(`${item.name}: uso restaurado (${curr + 1}/${max}).`);
  });

  html.find("[data-action='roll-saving-throw']").click(async ev => {
    const btn  = ev.currentTarget;
    const stat = btn.dataset.stat || "instintos";
    const dc   = parseInt(btn.dataset.dc) || 10;
    const actor = game.user.character ?? canvas.tokens?.controlled[0]?.actor;
    if (!actor) return ui.notifications.warn("Selecciona un token o asigna un personaje para tirar.");
    const car  = actor.system.caracteristicas?.[stat];
    if (!car)  return ui.notifications.warn(`El personaje no tiene el atributo "${stat}".`);
    const mod  = car.modificador ?? 0;
    const opts = await rollDialog(`Saving Throw — ${stat} DC ${dc}`);
    if (!opts) return;
    const roll = new Roll(d20Formula(mod, opts));
    await roll.evaluate();
    const success = roll.total >= dc;
    const modeTag = opts.mode === "adv" ? " [Ventaja]" : opts.mode === "dis" ? " [Desventaja]" : "";
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  `<strong>Saving Throw — ${stat}</strong> DC ${dc} mod ${mod >= 0 ? "+" : ""}${mod}${modeTag}<br><strong>${success ? "✅ ÉXITO" : "❌ FALLO"}</strong>`,
    });
  });
});
