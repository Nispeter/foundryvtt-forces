function addToPath(obj, path, delta) {
  if (!delta || delta === 0) return;
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur?.[parts[i]];
    if (cur == null) return;
  }
  const last = parts[parts.length - 1];
  if (last in cur && typeof cur[last] === "number") cur[last] += delta;
}

// ─── Roll dialog (exported so chat handlers in forces.mjs can reuse it) ──
export async function rollDialog(label) {
  const click = window._forcesLastClick ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const W = 340, H = 190;
  let left = click.x + 14;
  if (left + W > window.innerWidth - 8) left = click.x - W - 14;
  left = Math.max(8, Math.round(left));
  let top = click.y - 24;
  if (top + H > window.innerHeight - 8) top = window.innerHeight - H - 8;
  top = Math.max(8, Math.round(top));

  return new Promise(resolve => {
    new Dialog({
      title: `🎲 ${label}`,
      content: `<form class="forces-roll-dlg">
        <div class="frd-modes">
          <label class="frd-opt frd-normal">
            <input type="radio" name="mode" value="normal" checked /> Normal
          </label>
          <label class="frd-opt frd-adv">
            <input type="radio" name="mode" value="adv" /> ↑ Ventaja
          </label>
          <label class="frd-opt frd-dis">
            <input type="radio" name="mode" value="dis" /> ↓ Desventaja
          </label>
        </div>
        <div class="frd-bonus-row">
          <span class="frd-lbl">Bonus adicional</span>
          <input type="number" name="bonus" value="0" class="frd-bonus" autofocus />
        </div>
      </form>`,
      buttons: {
        roll: {
          icon: "<i class='fas fa-dice-d20'></i>", label: "Tirar",
          callback: html => resolve({
            mode:  html.find("[name=mode]:checked").val() || "normal",
            bonus: parseInt(html.find("[name=bonus]").val()) || 0,
          }),
        },
        cancel: {
          icon: "<i class='fas fa-times'></i>", label: "Cancelar",
          callback: () => resolve(null),
        },
      },
      default: "roll",
      close: () => resolve(null),
    }, { classes: ["dialog", "forces-roll-dlg-win"], left, top }).render(true);
  });
}

export function d20Formula(baseMod, opts) {
  const t = baseMod + (opts?.bonus || 0);
  const s = t >= 0 ? `+${t}` : `${t}`;
  if (opts?.mode === "adv") return `{2d20kh1}${s}`;
  if (opts?.mode === "dis") return `{2d20kl1}${s}`;
  return `1d20${s}`;
}

function modeSuffix(opts) {
  return opts?.mode === "adv" ? " [Ventaja]" : opts?.mode === "dis" ? " [Desventaja]" : "";
}
function bonusSuffix(opts) {
  if (!opts?.bonus) return "";
  return ` +bns ${opts.bonus >= 0 ? "+" : ""}${opts.bonus}`;
}

// ─────────────────────────────────────────────────────────────────────────
export class ForcesActor extends Actor {
  // Item buffs are applied here, after TypeDataModel.prepareDerivedData().
  prepareDerivedData() {
    super.prepareDerivedData();
    this._applyItemBuffs();
  }

  _applyItemBuffs() {
    const sys = this.system;
    const rd  = this.getRollData();
    for (const item of this.items) {
      if (!item.system.equipado) continue;
      if ((item.system.categoria ?? "") === "arma") continue;
      for (const buff of (item.system.buffs ?? [])) {
        if (!buff.activo || !buff.target) continue;
        let delta = Number(buff.baseVal) || 0;
        if (buff.scaleVar && buff.scaleVar !== "none") {
          delta += (Number(buff.scaleMult) || 1) * (Number(rd[buff.scaleVar]) || 0);
        }
        addToPath(sys, buff.target, Math.round(delta));
      }
    }
  }

  // Flat roll data for formula evaluation (post-derivation modifiers)
  getRollData() {
    const car = this.system.caracteristicas;
    return {
      nivel:     this.system.nivel,
      fuerza:    car.fuerza.modificador,
      aguante:   car.aguante.modificador,
      velocidad: car.velocidad.modificador,
      tecnica:   car.tecnica.modificador,
      cognicion: car.cognicion.modificador,
      carisma:   car.carisma.modificador,
      instintos: car.instintos.modificador,
      caos:      car.caos.modificador,
    };
  }

  // ─── Roll helpers ──────────────────────────────────────────────────────

  async rollCaracteristica(carKey) {
    const car   = this.system.caracteristicas[carKey];
    const label = `${carKey.charAt(0).toUpperCase()}${carKey.slice(1)} (${car.rankDisplay})`;
    const opts  = await rollDialog(label);
    if (!opts) return null;
    const roll  = new Roll(d20Formula(car.modificador, opts));
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor:  `<strong>${label}</strong> mod ${car.modificador >= 0 ? "+" : ""}${car.modificador}${bonusSuffix(opts)}${modeSuffix(opts)}`,
    });
    return roll;
  }

  async rollCaos() {
    const car   = this.system.caracteristicas.caos;
    const label = `Caos (${car.rankDisplay})`;
    const opts  = await rollDialog(label);
    if (!opts) return null;
    const roll  = new Roll(d20Formula(car.modificador, opts));
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor:  `<strong>Tirada de Caos</strong> mod ${car.modificador >= 0 ? "+" : ""}${car.modificador}${bonusSuffix(opts)}${modeSuffix(opts)}`,
    });
    return roll;
  }

  async rollMovimiento() {
    const car   = this.system.caracteristicas.velocidad;
    const label = `Velocidad / Movimiento (${car.rankDisplay})`;
    const opts  = await rollDialog(label);
    if (!opts) return null;
    const roll  = new Roll(d20Formula(car.modificador, opts));
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor:  `<strong>Velocidad</strong> — mov ${this.system.movimiento} pies${bonusSuffix(opts)}${modeSuffix(opts)}`,
    });
    return roll;
  }

  async rollHabilidad(habKey) {
    const hab   = this.system.habilidades[habKey];
    const label = `${habKey} (total ${hab.total >= 0 ? "+" : ""}${hab.total})`;
    const opts  = await rollDialog(label);
    if (!opts) return null;
    const roll  = new Roll(d20Formula(hab.total, opts));
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor:  `<strong>${habKey}</strong> total ${hab.total >= 0 ? "+" : ""}${hab.total}${bonusSuffix(opts)}${modeSuffix(opts)}`,
    });
    return roll;
  }

  async rollAtaque(tipo = "fuerza", etiqueta = "") {
    const car   = this.system.caracteristicas[tipo];
    const label = `${etiqueta || "Ataque"} (${tipo})`;
    const opts  = await rollDialog(label);
    if (!opts) return null;
    const roll  = new Roll(d20Formula(car.modificador, opts));
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor:  `<strong>${etiqueta || "Ataque"}</strong> (${tipo}) mod ${car.modificador >= 0 ? "+" : ""}${car.modificador}${bonusSuffix(opts)}${modeSuffix(opts)}`,
    });
    return roll;
  }

  async rollReaccion(tipo) {
    const statMap  = { esquivar: "instintos", fortaleza: "aguante", resistencia: "caos" };
    const labelMap = { esquivar: "Esquivar", fortaleza: "Fortaleza", resistencia: "Resistencia" };
    const carKey   = statMap[tipo] ?? "instintos";
    const mod      = this.system.caracteristicas[carKey].modificador;
    const label    = `Reacción: ${labelMap[tipo] ?? tipo}`;
    const opts     = await rollDialog(label);
    if (!opts) return null;
    const roll     = new Roll(d20Formula(mod, opts));
    await roll.evaluate();

    let flavor = `<strong>${label}</strong> mod ${mod >= 0 ? "+" : ""}${mod}${bonusSuffix(opts)}${modeSuffix(opts)}`;
    if      (roll.total >= 20) flavor += " — <em>¡Éxito total!</em>";
    else if (roll.total >   0) flavor += " — <em>Éxito parcial (enemigo -1d4)</em>";

    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this }), flavor });
    return roll;
  }

  async rollCaosControl(item) {
    const data  = item.system;
    const mod   = this.system.caracteristicas.caos.modificador;
    const label = `${item.name} — Caos Control`;
    const opts  = await rollDialog(label);
    if (!opts) return null;
    const roll  = new Roll(d20Formula(mod, opts));
    await roll.evaluate();

    let flavor = `<strong>${item.name}</strong> — ${data.costoCaos}✦ EC — mod ${mod >= 0 ? "+" : ""}${mod}${bonusSuffix(opts)}${modeSuffix(opts)}`;
    if (data.dadoDanio) {
      const dmgRoll = new Roll(`${data.dadoDanio}${data.bonusDanio ? `+${data.bonusDanio}` : ""}`);
      await dmgRoll.evaluate();
      flavor += `<br>Daño: <strong>${dmgRoll.result}</strong>`;
    }
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this }), flavor });
    return roll;
  }

  async rollMaestria(tipoKey, slot) {
    const m = this.system.maestrias?.[tipoKey]?.[slot];
    if (!m) return null;
    const carKey = m.caracteristica || "cognicion";
    const car    = this.system.caracteristicas[carKey];
    if (!car) return null;
    const nombre = m.nombre || `Maestría ${m.rank}`;
    const label  = `${nombre} [${m.rank}]`;
    const opts   = await rollDialog(label);
    if (!opts) return null;
    const roll   = new Roll(d20Formula(car.modificador, opts));
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor:  `<strong>${nombre}</strong> [${m.rank}] — ${carKey} (${car.rankDisplay}) mod ${car.modificador >= 0 ? "+" : ""}${car.modificador}${bonusSuffix(opts)}${modeSuffix(opts)}`,
    });
    return roll;
  }

  async useItem(item) {
    const sys     = item.system;
    const isOwner = this.isOwner;

    // Effective sections: stored flags OR auto-detected from data (for pre-section items)
    const sec = { ...(sys.secciones ?? {}) };
    if (sys.descripcion)                            sec.descripcion    = true;
    if (sys.dadoDanio)                              sec.danioEfecto    = true;
    if (sys.bonusHit || (sys.numAtaques ?? 1) > 1) sec.hit            = true;
    if (sys.savingThrow)                            sec.savingThrow    = true;
    if (sys.usosPorDesc)                            sec.usos           = true;
    if ((sys.buffs ?? []).length)                   sec.buffs          = true;
    if (sys.bonusDf || sys.bonusReaccion || sys.bonusAtaque || sys.slots) sec.bonEstadistica = true;
    if ((sys.nivelReq ?? 1) > 1 || sys.claseReq)   sec.featClase      = true;
    if (sys.categoria === "caos")                   sec.caosControl    = true;
    const max     = sys.usosPorDesc ?? 0;
    let usesCurr  = sys.usosActuales ?? 0;

    // Deduct uses
    if (isOwner && max > 0) {
      if (usesCurr <= 0)
        return void ui.notifications.warn(`${item.name}: Sin usos restantes (0/${max}).`);
      usesCurr--;
      await item.update({ "system.usosActuales": usesCurr });
    }

    // Deduct EC for caos items
    if (isOwner && sec.caosControl && (sys.costoCaos ?? 0) > 0) {
      const ec = this.system.defensas.energiaCaotica.value ?? 0;
      await this.update({ "system.defensas.energiaCaotica.value": Math.max(0, ec - sys.costoCaos) });
    }

    // Header tags
    const tags = [];
    if (sec.caosControl && sys.costoCaos)
      tags.push(`<span class="fci-tag fci-caos-cost">✦ ${sys.costoCaos} EC${sys.esReaccion ? " · ⚡ Reacción" : ""}</span>`);
    if (sec.duracion && sys.duracion)
      tags.push(`<span class="fci-tag fci-dur">⏱ ${sys.duracion}</span>`);
    if (sec.rango && sys.rango)
      tags.push(`<span class="fci-tag fci-dur">📐 ${sys.rango} ft</span>`);
    if (sec.usos && max > 0)
      tags.push(`<span class="fci-tag fci-uses-disp">🔄 ${usesCurr}/${max} usos</span>`);
    if (sec.savingThrow && sys.savingThrow)
      tags.push(`<span class="fci-tag fci-save-tag">🛡 ${sys.savingThrow} DC${sys.savingThrowDC}</span>`);
    if (sec.featClase && (sys.nivelReq > 1 || sys.claseReq))
      tags.push(`<span class="fci-tag fci-feat-tag">⭐ ${[sys.claseReq, sys.nivelReq > 1 ? "Nv." + sys.nivelReq : ""].filter(Boolean).join(" ")}</span>`);

    // Stat bonus row
    const bonuses = [];
    if (sec.bonEstadistica) {
      if (sys.bonusDf)       bonuses.push(`DF Corp <strong>+${sys.bonusDf}</strong>`);
      if (sys.bonusReaccion) bonuses.push(`Reac. <strong>+${sys.bonusReaccion}</strong>`);
      if (sys.bonusAtaque)   bonuses.push(`Ataque <strong>+${sys.bonusAtaque}</strong>`);
      if (sys.slots)         bonuses.push(`Slots <strong>+${sys.slots}</strong>`);
    }
    const bonRow = bonuses.length
      ? `<div class="fci-bonus-row">${bonuses.join(" · ")}</div>` : "";

    // Roll buttons (only in chat, not in hover preview)
    const car  = this.system.caracteristicas;
    const fMod = car.fuerza.modificador;
    const tMod = car.tecnica.modificador;
    const cMod = car.caos.modificador;
    const aId  = this.id;
    const iId  = item.id;
    const rollRows = [];

    if (sec.hit) {
      const hit = sys.bonusHit ?? 0;
      const n   = sys.numAtaques ?? 1;
      const fTotal = fMod + hit;
      const tTotal = tMod + hit;
      rollRows.push(`
        <div class="fci-roll-row">
          <span class="fci-dmg-label">Ataque${n > 1 ? ` ×${n}` : ""}${hit ? ` (+${hit} hit)` : ""}</span>
          <div class="fci-btn-group">
            <button class="fci-roll-btn" data-action="roll-attack" data-tipo="fuerza" data-actor-id="${aId}" data-item-id="${iId}">
              🗡 Fr ${fTotal >= 0 ? "+" : ""}${fTotal}
            </button>
            <button class="fci-roll-btn" data-action="roll-attack" data-tipo="tecnica" data-actor-id="${aId}" data-item-id="${iId}">
              ⚙ Tec ${tTotal >= 0 ? "+" : ""}${tTotal}
            </button>
          </div>
        </div>`);
    }

    if (sec.danioEfecto && sys.dadoDanio) {
      const diceStr = sys.bonusDanio ? `${sys.dadoDanio}+${sys.bonusDanio}` : sys.dadoDanio;
      rollRows.push(`
        <div class="fci-roll-row">
          <span class="fci-dmg-label">Daño:</span>
          <strong class="fci-dmg-dice">${diceStr}</strong>
          ${sys.danioTipo ? `<span class="fci-dmg-type">(${sys.danioTipo})</span>` : ""}
          <button class="fci-roll-btn" data-action="roll-damage" data-actor-id="${aId}" data-item-id="${iId}">🎲 Tirar daño</button>
        </div>`);
    }

    if (sec.caosControl) {
      rollRows.push(`
        <div class="fci-roll-row">
          <span class="fci-dmg-label">Caos Control</span>
          <button class="fci-roll-btn fci-roll-caos" data-action="roll-caos" data-actor-id="${aId}" data-item-id="${iId}">
            ✦ Tirar Caos ${cMod >= 0 ? "+" : ""}${cMod}
          </button>
        </div>`);
    }

    if (sec.savingThrow && sys.savingThrow) {
      const stStat = sys.savingThrowStat || "instintos";
      rollRows.push(`
        <div class="fci-roll-row">
          <span class="fci-dmg-label">Saving Throw:</span>
          <span class="fci-save-info">${sys.savingThrow}</span>
          <strong class="fci-dmg-dice">DC ${sys.savingThrowDC}</strong>
          <button class="fci-roll-btn" data-action="roll-saving-throw" data-stat="${stStat}" data-dc="${sys.savingThrowDC}">🛡 Tirar</button>
        </div>`);
    }

    if (sec.usos && max > 0 && isOwner) {
      const refundDisabled = usesCurr >= max ? " disabled" : "";
      rollRows.push(`
        <div class="fci-roll-row">
          <span class="fci-dmg-label">Usos restantes: ${usesCurr}/${max}</span>
          <button class="fci-roll-btn fci-refund-btn" data-action="refund-uses" data-actor-id="${aId}" data-item-id="${iId}"${refundDisabled}>
            ↺ Restaurar uso
          </button>
        </div>`);
    }

    const catLabel = { arma:"Arma", armadura:"Armadura", equipo:"Equipo", consumible:"Consumible",
                       feat:"Feat / Clase", caos:"Caos Control", tarjeta:"Tarjeta" }[sys.categoria] ?? sys.categoria;
    const catCss   = { arma:"fci-cat-arma", armadura:"fci-cat-armor", equipo:"fci-cat-equipo",
                       consumible:"fci-cat-consumible", feat:"fci-cat-feat", caos:"fci-cat-caos",
                       tarjeta:"fci-cat-tarjeta" }[sys.categoria] ?? "";

    const content = `
      <div class="forces-chat-item ${catCss}">
        <div class="fci-header">
          <img class="fci-img" src="${item.img}" />
          <div class="fci-meta">
            <div class="fci-name">${item.name}</div>
            <div class="fci-category">${catLabel}</div>
            ${tags.length ? `<div class="fci-tags">${tags.join("")}</div>` : ""}
          </div>
        </div>
        ${bonRow}
        ${sys.descripcion ? `<div class="fci-desc">${sys.descripcion}</div>` : ""}
        ${rollRows.join("")}
      </div>`;

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      flags: { forces: { type: "item-use", itemId: item.id, actorId: this.id } },
    });
  }

  async rollVidaDado() {
    const dado = this.system.vidaDado ?? 6;
    const roll = new Roll(`1d${dado}`);
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor:  `<strong>Tirada de Vida</strong> (1d${dado})`,
    });
    return roll;
  }

  async longRest() {
    const updates = [];
    for (const item of this.items.contents) {
      const max = item.system.usosPorDesc ?? 0;
      if (max > 0) updates.push(item.update({ "system.usosActuales": max }));
    }
    await Promise.all(updates);
    await this.update({
      "system.defensas.vida.value":               this.system.defensas.vida.max,
      "system.defensas.energiaCaotica.value":     this.system.defensas.energiaCaotica.max,
    });
    ui.notifications.info(`${this.name}: Long Rest — vida, energía caótica y usos restaurados.`);
  }
}
