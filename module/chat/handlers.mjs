// Handlers de botones dentro de mensajes de chat (tarjeta de uso de objeto).
// Usamos delegación de eventos en document.body para que funcione en V11/V12/V13
// (donde el shape de `html` en renderChatMessage cambia entre versiones) y para
// mensajes que ya estaban renderizados antes de cargar el sistema.

import { rollDialog } from "../dialogs/roll-dialog.mjs";
import { d20Formula, evaluateRollWithMode, modeSuffix, bonusSuffix, bonusInline } from "../helpers/rolls.mjs";
import { placeAreaTemplate } from "./area-template.mjs";

// Lookup actor + item desde dataset. Devuelve null si falta alguno.
function _actorItem(btn) {
  const actor = game.actors.get(btn.dataset.actorId);
  const item  = actor?.items.get(btn.dataset.itemId);
  return actor && item ? { actor, item } : null;
}

// ─── Daño ───
async function onRollDamage(btn) {
  const ctx = _actorItem(btn);
  if (!ctx) return;
  const { actor, item } = ctx;
  const sys  = item.system;
  const base = sys.bonusDanio ? `${sys.dadoDanio}+${sys.bonusDanio}` : sys.dadoDanio;
  const opts = await rollDialog(`Daño — ${item.name}`);
  if (!opts) return;
  const formula = `${base}${bonusInline(opts)}`;
  const roll    = await evaluateRollWithMode(formula, opts);
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  `<strong>${item.name}</strong> — Daño${sys.danioTipo ? ` (${sys.danioTipo})` : ""}${modeSuffix(opts)}`,
  });
}

// ─── Ataque (con stat data-tipo) ───
async function onRollAttack(btn) {
  const ctx = _actorItem(btn);
  if (!ctx) return;
  const { actor, item } = ctx;
  const tipo     = btn.dataset.tipo || "fuerza";
  const bonifAtk = actor.system.bonifEquipados?.ataque ?? 0;
  const baseMod  = (actor.system.caracteristicas[tipo]?.modificador ?? 0)
                 + (item.system.bonusHit ?? 0)
                 + bonifAtk;
  const equipTag = bonifAtk ? ` (eq ${bonifAtk >= 0 ? "+" : ""}${bonifAtk})` : "";
  const opts     = await rollDialog(`Ataque — ${item.name} (${tipo})`);
  if (!opts) return;
  const roll = new Roll(d20Formula(baseMod, opts));
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  `<strong>${item.name}</strong> — Ataque (${tipo}) ${baseMod >= 0 ? "+" : ""}${baseMod}${equipTag}${bonusSuffix(opts)}${modeSuffix(opts)}`,
  });
}

// ─── Caos Control (botón ✦) ───
async function onRollCaos(btn) {
  const ctx = _actorItem(btn);
  if (!ctx) return;
  const { actor, item } = ctx;
  const mod  = actor.system.caracteristicas.caos.modificador;
  const opts = await rollDialog(`Caos Control — ${item.name}`);
  if (!opts) return;
  const roll = new Roll(d20Formula(mod, opts));
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  `<strong>${item.name}</strong> — Caos Control mod ${mod >= 0 ? "+" : ""}${mod}${modeSuffix(opts)}`,
  });
}

// ─── Dado libre (fórmula data-formula) ───
async function onRollDadoLibre(btn) {
  const formula = btn.dataset.formula;
  const label   = btn.dataset.label || "Tirada libre";
  if (!formula) return;
  const opts = await rollDialog(label);
  if (!opts) return;
  const full = `${formula}${bonusInline(opts)}`;
  const roll = await evaluateRollWithMode(full, opts);
  await roll.toMessage({ flavor: `<strong>${label}</strong>${modeSuffix(opts)}` });
}

// ─── Tabla aleatoria (entradas separadas por \n) ───
async function onRollTabla(btn) {
  const ctx = _actorItem(btn);
  if (!ctx) return;
  const { actor, item } = ctx;
  const entries = (item.system.dadoLibreEntradas ?? "").split("\n").filter(e => e.trim());
  if (!entries.length) return;
  const label = item.system.dadoLibreLabel || "Tabla";
  const n     = entries.length;
  const opts  = await rollDialog(`${label} (1d${n})`);
  if (!opts) return;
  const formula = `1d${n}`;
  const roll    = await evaluateRollWithMode(formula, opts);
  const idx     = Math.max(0, Math.min(n - 1, roll.total - 1));
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  `<strong>${label}</strong> — ${formula}${modeSuffix(opts)}<br><span class="fci-tabla-result">📋 ${roll.total}. ${entries[idx]}</span>`,
  });
}

// ─── Restaurar 1 uso ───
async function onRefundUses(btn) {
  const ctx = _actorItem(btn);
  if (!ctx || !ctx.actor.isOwner) return;
  const { item } = ctx;
  const curr = item.system.usosActuales ?? 0;
  const max  = item.system.usosPorDesc  ?? 0;
  if (curr >= max) { btn.disabled = true; return; }
  await item.update({ "system.usosActuales": curr + 1 });
  btn.disabled = true;
  btn.textContent = "✓ Restaurado";
  ui.notifications.info(`${item.name}: uso restaurado (${curr + 1}/${max}).`);
}

// ─── Saving throw ───
async function onRollSavingThrow(btn) {
  const stat  = btn.dataset.stat || "instintos";
  const dc    = parseInt(btn.dataset.dc) || 10;
  const actor = game.user.character ?? canvas.tokens?.controlled[0]?.actor;
  if (!actor) return ui.notifications.warn("Selecciona un token o asigna un personaje para tirar.");
  const car = actor.system.caracteristicas?.[stat];
  if (!car) return ui.notifications.warn(`El personaje no tiene el atributo "${stat}".`);
  const mod  = car.modificador ?? 0;
  const opts = await rollDialog(`Saving Throw — ${stat} DC ${dc}`);
  if (!opts) return;
  const roll = new Roll(d20Formula(mod, opts));
  await roll.evaluate();
  const success = roll.total >= dc;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  `<strong>Saving Throw — ${stat}</strong> DC ${dc} mod ${mod >= 0 ? "+" : ""}${mod}${modeSuffix(opts)}<br><strong>${success ? "✅ ÉXITO" : "❌ FALLO"}</strong>`,
  });
}

// ─── Plantilla de área ───
function onPlaceAreaTemplate(btn) {
  const dist  = Number(btn.dataset.dist) || 5;
  const dist2 = Number(btn.dataset.dist2) || 0;
  const tipo  = (btn.dataset.tipo || "esfera").toLowerCase();
  placeAreaTemplate({ dist, dist2, tipo });
}

// Tabla de despacho: data-action → handler.
const ACTION_HANDLERS = {
  "roll-damage":          onRollDamage,
  "roll-attack":          onRollAttack,
  "roll-caos":            onRollCaos,
  "roll-dado-libre":      onRollDadoLibre,
  "roll-tabla":           onRollTabla,
  "place-area-template":  onPlaceAreaTemplate,
  "refund-uses":          onRefundUses,
  "roll-saving-throw":    onRollSavingThrow,
};

// Setup global de delegación. Llamar una sola vez al "ready". Cualquier click
// en un botón con data-action conocido se despacha al handler correspondiente,
// sin importar cuándo se renderizó el mensaje ni la versión de Foundry.
//
// Usa CAPTURE PHASE para correr ANTES que cualquier stopPropagation que
// pueda hacer Foundry o algún módulo en chat (era el motivo más probable
// por el que place-area no respondía).
let _registered = false;
export function registerGlobalChatHandlers() {
  if (_registered) return;
  _registered = true;
  document.addEventListener("click", (ev) => {
    if (!(ev.target instanceof Element)) return;
    const btn = ev.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const handler = ACTION_HANDLERS[action];
    if (!handler) return;
    // Sin gate de chat: nuestros action names son específicos del sistema.
    // Si otro módulo usa el mismo nombre, lo evaluamos cuando aparezca.
    console.log(`Forces | chat action: ${action}`, btn);
    ev.preventDefault();
    ev.stopPropagation();
    try { handler(btn); }
    catch (err) { console.error(`Forces | chat handler error (${action}):`, err); }
  }, true); // capture=true
}

// Mantengo el nombre antiguo para no romper imports, pero ya no hace nada per-message
// (la delegación global hace todo el trabajo). Se llama desde forces.mjs por compat.
export function registerChatHandlers() { /* no-op */ }
