import { ForcesActorData, ForcesNPCData } from "./module/data/actor-data.mjs";
import { ForcesItemData } from "./module/data/item-data.mjs";
import { ForcesActor, rollDialog, d20Formula } from "./module/documents/actor.mjs";
import { ForcesActorSheet } from "./module/sheets/actor-sheet.mjs";
import { ForcesItemSheet } from "./module/sheets/item-sheet.mjs";

/* ─── Handlebars helpers ─── */
Handlebars.registerHelper("signedNum", n => { const v = Number(n)||0; return v >= 0 ? `+${v}` : `${v}`; });
Handlebars.registerHelper("lowercase", s => (s ?? "").toLowerCase());
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

Hooks.once("ready", () => console.log("Forces | Ready. ¡Fuck it, we ball!"));

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
