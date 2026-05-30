// Entry point del sistema Forces. Solo hace setup en init/ready;
// la lógica vive en module/*.

import { ForcesActorData, ForcesNPCData } from "./module/data/actor-data.mjs";
import { ForcesItemData } from "./module/data/item-data.mjs";
import { ForcesActor } from "./module/documents/actor.mjs";
import { ForcesActorSheet } from "./module/sheets/actor-sheet.mjs";
import { ForcesItemSheet } from "./module/sheets/item-sheet.mjs";
import { registerHandlebarsHelpers } from "./module/helpers/handlebars.mjs";
import { registerChatHandlers, registerGlobalChatHandlers } from "./module/chat/handlers.mjs";

// Re-exports para compatibilidad con código externo que pueda importar
// desde el entrypoint del sistema (módulos compatibles, macros, etc.).
export { rollDialog, d20Formula } from "./module/documents/actor.mjs";

// Trackea último click para posicionar el roll dialog junto al cursor.
document.addEventListener("mousedown", ev => {
  window._forcesLastClick = { x: ev.clientX, y: ev.clientY };
});

Hooks.once("init", () => {
  console.log("Forces | Initializing – Fuck it, we ball 🦔");

  registerHandlebarsHelpers();

  CONFIG.Actor.documentClass = ForcesActor;
  CONFIG.Actor.dataModels    = { character: ForcesActorData, npc: ForcesNPCData };
  CONFIG.Item.dataModels     = { item: ForcesItemData };

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

  // Trackea posición del mouse en coords mundo del canvas para que la
  // preview de plantilla de área aparezca al instante en su posición correcta.
  document.getElementById("board")?.addEventListener("mousemove", ev => {
    const t = canvas?.stage?.worldTransform;
    if (!t) return;
    window._forcesCanvasPos = {
      x: (ev.clientX - t.tx) / t.a,
      y: (ev.clientY - t.ty) / t.d,
    };
  });

  // Delegación global de clicks en botones de chat (data-action). Funciona en
  // V11/V12/V13 y para mensajes ya renderizados antes de cargar el sistema.
  registerGlobalChatHandlers();
});

// Hook legacy mantenido por si hay binding adicional needed; ya no es crítico.
Hooks.on("renderChatMessage", (_msg, html) => registerChatHandlers(html));
