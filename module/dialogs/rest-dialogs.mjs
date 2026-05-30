// Diálogos de descanso/recarga/levelUp: presentan opción "tirar dado" vs "promedio"
// y aplican el update al actor + mandan flavor a chat.

// Helper común: muestra dialog de 2 botones (roll/avg) sobre un dado + mod,
// y resuelve con { gained, mode } o null si se cancela.
async function _twoChoiceDialog({ title, contentBody, dado, mod, avg, onRoll, onAvg }) {
  return new Promise(resolve => {
    new Dialog({
      title,
      content: contentBody,
      buttons: {
        roll: {
          icon: "<i class='fas fa-dice'></i>", label: "Tirar dado",
          callback: async () => {
            const roll = new Roll(`1d${dado}+${mod}`);
            await roll.evaluate();
            const gained = Math.max(1, roll.total);
            await onRoll(roll, gained);
            resolve({ gained, mode: "roll" });
          },
        },
        avg: {
          icon: "<i class='fas fa-calculator'></i>", label: `Promedio (+${avg})`,
          callback: async () => { await onAvg(avg); resolve({ gained: avg, mode: "avg" }); },
        },
        cancel: {
          icon: "<i class='fas fa-times'></i>", label: "Cancelar",
          callback: () => resolve(null),
        },
      },
      default: "roll",
    }, { classes: ["dialog", "forces-roll-dlg-win"] }).render(true);
  });
}

// Promedio de un dN+mod (igual que el de D&D): floor(N/2)+1 + mod, mínimo 1.
export function avgDado(dado, mod) {
  return Math.max(1, Math.floor(dado / 2) + 1 + mod);
}

export async function levelUpDialog(actor) {
  const dado  = actor.system.vidaDado ?? 6;
  const mod   = actor.system.caracteristicas.aguante.modificador;
  const avg   = avgDado(dado, mod);
  const lvl   = actor.system.nivel ?? 1;
  const maxHP = actor.system.defensas.vida.max ?? 0;
  const curHP = actor.system.defensas.vida.value ?? 0;

  return _twoChoiceDialog({
    title: `⬆ Subir de Nivel (${lvl} → ${lvl + 1})`,
    contentBody: `<div style="padding:10px 4px">
      <p>Dado de vida: <strong>1d${dado}</strong> + mod Aguante (${mod >= 0 ? "+" : ""}${mod})</p>
      <p>Promedio: <strong>${avg} PV</strong></p>
    </div>`,
    dado, mod, avg,
    onRoll: async (roll, gained) => {
      await actor.update({
        "system.nivel":               Math.min(20, lvl + 1),
        "system.defensas.vida.max":   maxHP + gained,
        "system.defensas.vida.value": curHP + gained,
      });
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor:  `<strong>¡Nivel ${lvl + 1}!</strong> +${gained} PV máx (1d${dado}${mod >= 0 ? "+" : ""}${mod})`,
      });
    },
    onAvg: async (gained) => {
      await actor.update({
        "system.nivel":               Math.min(20, lvl + 1),
        "system.defensas.vida.max":   maxHP + gained,
        "system.defensas.vida.value": curHP + gained,
      });
      ui.notifications.info(`${actor.name}: ¡Nivel ${lvl + 1}! +${gained} PV máx (promedio).`);
    },
  });
}

export async function shortRestDialog(actor) {
  const dado  = actor.system.vidaDado ?? 6;
  const mod   = actor.system.caracteristicas.aguante.modificador;
  const avg   = avgDado(dado, mod);
  const maxHP = actor.system.defensas.vida.max ?? 0;
  const curHP = actor.system.defensas.vida.value ?? 0;
  const maxEC = actor.system.defensas.energiaCaotica.max ?? 0;

  return _twoChoiceDialog({
    title: "💤 Descanso Corto",
    contentBody: `<div style="padding:10px 4px">
      <p>Recuperas PV con tu dado de vida y restauras toda tu EC:</p>
      <p><strong>1d${dado}</strong> + mod Aguante (${mod >= 0 ? "+" : ""}${mod}) · Promedio: <strong>${avg}</strong></p>
      <p style="color:#888;font-size:11px">PV actuales: ${curHP} / ${maxHP} · EC: → ${maxEC}</p>
    </div>`,
    dado, mod, avg,
    onRoll: async (roll, gained) => {
      const newHP = Math.min(maxHP, curHP + gained);
      await actor.update({
        "system.defensas.vida.value":           newHP,
        "system.defensas.energiaCaotica.value": maxEC,
      });
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor:  `<strong>Descanso Corto</strong> — Recupera ${newHP - curHP} PV · EC restaurada (${maxEC})`,
      });
    },
    onAvg: async (gained) => {
      const newHP = Math.min(maxHP, curHP + gained);
      await actor.update({
        "system.defensas.vida.value":           newHP,
        "system.defensas.energiaCaotica.value": maxEC,
      });
      ui.notifications.info(`${actor.name}: Descanso corto — recupera ${newHP - curHP} PV y EC restaurada.`);
    },
  });
}

export async function recargaDialog(actor) {
  const dado  = actor.system.vidaDado ?? 6;
  const mod   = actor.system.caracteristicas.caos.modificador;
  const avg   = avgDado(dado, mod);
  const maxEC = actor.system.defensas.energiaCaotica.max ?? 0;
  const curEC = actor.system.defensas.energiaCaotica.value ?? 0;

  return _twoChoiceDialog({
    title: "✦ Recarga de Energía Caótica",
    contentBody: `<div style="padding:10px 4px">
      <p>Recuperas EC en un descanso corto:</p>
      <p><strong>1d${dado}</strong> + mod Caos (${mod >= 0 ? "+" : ""}${mod}) · Promedio: <strong>${avg}</strong></p>
      <p style="color:#888;font-size:11px">EC actuales: ${curEC} / ${maxEC}</p>
    </div>`,
    dado, mod, avg,
    onRoll: async (roll, gained) => {
      const newEC = Math.min(maxEC, curEC + gained);
      await actor.update({ "system.defensas.energiaCaotica.value": newEC });
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor:  `<strong>Recarga ✦</strong> — Recupera ${newEC - curEC} EC`,
      });
    },
    onAvg: async (gained) => {
      const newEC = Math.min(maxEC, curEC + gained);
      await actor.update({ "system.defensas.energiaCaotica.value": newEC });
      ui.notifications.info(`${actor.name}: Recarga — recupera ${newEC - curEC} EC.`);
    },
  });
}
