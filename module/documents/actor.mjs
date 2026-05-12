import { puntosToMod, ForcesActorData } from "../data/actor-data.mjs";

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

const STAT_ABBR = {
  fuerza:"Fr", aguante:"Agu", velocidad:"Vel", tecnica:"Tec",
  cognicion:"Cog", carisma:"Car", instintos:"Ins", caos:"Cao",
};

// ─────────────────────────────────────────────────────────────────────────
export class ForcesActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
    this._applyItemBuffs();
  }

  _applyItemBuffs() {
    const sys = this.system;
    const car = sys.caracteristicas;
    let charModChanged = false;

    for (const item of this.items) {
      if (!item.system.equipado) continue;
      if ((item.system.categoria ?? "") === "arma") continue;
      for (const buff of (item.system.buffs ?? [])) {
        if (!buff.activo || !buff.target) continue;
        let delta = Number(buff.baseVal) || 0;
        if (buff.scaleVar && buff.scaleVar !== "none") {
          const sv = buff.scaleVar === "nivel" ? (sys.nivel ?? 0) : (car[buff.scaleVar]?.modificador ?? 0);
          delta += (Number(buff.scaleMult) || 1) * sv;
        }
        delta = Math.round(delta);
        if (!delta) continue;

        if (buff.target.startsWith("caracteristicas.") && buff.target.endsWith(".bonus")) {
          const carKey = buff.target.slice("caracteristicas.".length, -".bonus".length);
          if (car[carKey]) { car[carKey].modificador += delta; charModChanged = true; }
        } else {
          addToPath(sys, buff.target, delta);
        }
      }
    }

    if (charModChanged) {
      sys.defensas.defensaCorporal = Math.max(1, 10 + car.aguante.modificador + car.velocidad.modificador);
      sys.defensas.defensaCaotica  = Math.max(1, 10 + car.caos.modificador   + car.tecnica.modificador);
      sys.movimiento = Math.max(10, 10 * car.velocidad.modificador + 30 + (sys.bonusMovimiento ?? 0));
      if ((sys.defensas.anillos?.value ?? 0) >= 100) sys.movimiento += 20;
      for (const [hab, carKey] of Object.entries(ForcesActorData.SKILL_STAT)) {
        const skill = sys.habilidades[hab];
        if (skill) skill.total = (car[carKey]?.modificador ?? 0) + (skill.experticia ?? 0);
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

    const sec = { ...(sys.secciones ?? {}) };
    if (sys.descripcion)                              sec.descripcion    = true;
    if (sys.dadoDanio)                                sec.danioEfecto    = true;
    if (sys.bonusHit || (sys.numAtaques ?? 1) > 1 || sys.atacarCon || sys.atacarCon2) sec.hit = true;
    if (sys.savingThrow)                              sec.savingThrow    = true;
    if (sys.usosPorDesc)                              sec.usos           = true;
    if ((sys.buffs ?? []).length)                     sec.buffs          = true;
    if (sys.bonusDf || sys.bonusReaccion || sys.bonusAtaque || sys.slots) sec.bonEstadistica = true;
    if ((sys.nivelReq ?? 1) > 1 || sys.claseReq)     sec.featClase      = true;
    if (sys.categoria === "caos")                     sec.caosControl    = true;
    if (sys.dadoLibreFormula || sys.dadoLibreTabla)   sec.dadoLibre      = true;
    if (sys.areaEfecto)                               sec.areaEfecto     = true;

    const max    = sys.usosPorDesc ?? 0;
    let usesCurr = sys.usosActuales ?? 0;

    if (isOwner && max > 0) {
      if (usesCurr <= 0)
        return void ui.notifications.warn(`${item.name}: Sin usos restantes (0/${max}).`);
      usesCurr--;
      await item.update({ "system.usosActuales": usesCurr });
    }
    if (isOwner && sec.caosControl && (sys.costoCaos ?? 0) > 0) {
      const ec = this.system.defensas.energiaCaotica.value ?? 0;
      await this.update({ "system.defensas.energiaCaotica.value": Math.max(0, ec - sys.costoCaos) });
    }

    // Declare everything before building tags/rollRows
    const car      = this.system.caracteristicas;
    const cMod     = car.caos.modificador;
    const aId      = this.id;
    const iId      = item.id;
    const tags     = [];
    const rollRows = [];

    // ── Tags ──
    if (sys.categoria === "tarjeta" && sys.costoTarjeta)
      tags.push(`<span class="fci-tag fci-dur">🃏 ${sys.costoTarjeta} slot</span>`);
    if (sec.caosControl && sys.costoCaos)
      tags.push(`<span class="fci-tag fci-caos-cost">✦ ${sys.costoCaos} EC${sys.esReaccion ? " · ⚡ Reacción" : ""}</span>`);
    if (sec.duracion && sys.duracion)
      tags.push(`<span class="fci-tag fci-dur">⏱ ${sys.duracion}</span>`);
    if (sec.rango && sys.rango)
      tags.push(`<span class="fci-tag fci-dur">📐 ${sys.rango} ft</span>`);
    if (sec.areaEfecto && sys.areaEfecto)
      tags.push(`<span class="fci-tag fci-dur">💥 ${sys.areaEfecto} ft${sys.areaEfectoTipo ? ` (${sys.areaEfectoTipo})` : ""}</span>`);
    if (sec.usos && max > 0)
      tags.push(`<span class="fci-tag fci-uses-disp">🔄 ${usesCurr}/${max} usos</span>`);
    if (sec.savingThrow)
      tags.push(`<span class="fci-tag fci-save-tag">🛡 ${sys.savingThrow || "ST"} DC${sys.savingThrowDC}</span>`);
    if (sec.featClase && (sys.nivelReq > 1 || sys.claseReq))
      tags.push(`<span class="fci-tag fci-feat-tag">⭐ ${[sys.claseReq, sys.nivelReq > 1 ? "Nv." + sys.nivelReq : ""].filter(Boolean).join(" ")}</span>`);

    // ── Stat bonus row ──
    const bonuses = [];
    if (sec.bonEstadistica) {
      if (sys.bonusDf)       bonuses.push(`DF Corp <strong>+${sys.bonusDf}</strong>`);
      if (sys.bonusReaccion) bonuses.push(`Reac. <strong>+${sys.bonusReaccion}</strong>`);
      if (sys.bonusAtaque)   bonuses.push(`Ataque <strong>+${sys.bonusAtaque}</strong>`);
      if (sys.slots)         bonuses.push(`Slots <strong>+${sys.slots}</strong>`);
    }
    const bonRow = bonuses.length ? `<div class="fci-bonus-row">${bonuses.join(" · ")}</div>` : "";

    // ── Roll rows ──
    if (sec.hit) {
      const hit   = sys.bonusHit ?? 0;
      const n     = sys.numAtaques ?? 1;
      const stat1 = sys.atacarCon  || null;
      const stat2 = sys.atacarCon2 || null;
      const btns  = [];
      if (stat1) {
        const c = car[stat1] ?? car.fuerza;
        const m = c.modificador + hit;
        btns.push(`<button class="fci-roll-btn" data-action="roll-attack" data-tipo="${stat1}" data-actor-id="${aId}" data-item-id="${iId}">🗡 ${STAT_ABBR[stat1] ?? stat1} ${m >= 0 ? "+" : ""}${m}</button>`);
      }
      if (stat2) {
        const c = car[stat2] ?? car.tecnica;
        const m = c.modificador + hit;
        btns.push(`<button class="fci-roll-btn" data-action="roll-attack" data-tipo="${stat2}" data-actor-id="${aId}" data-item-id="${iId}">⚙ ${STAT_ABBR[stat2] ?? stat2} ${m >= 0 ? "+" : ""}${m}</button>`);
      }
      if (btns.length) {
        rollRows.push(`
          <div class="fci-roll-row">
            <span class="fci-dmg-label">Ataque${n > 1 ? ` ×${n}` : ""}${hit ? ` (+${hit} hit)` : ""}</span>
            <div class="fci-btn-group">${btns.join("")}</div>
          </div>`);
      }
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
    if (sec.dadoLibre) {
      const dlLabel = sys.dadoLibreLabel || "Tirada libre";
      if (sys.dadoLibreTabla) {
        const entries = (sys.dadoLibreEntradas ?? "").split("\n").filter(e => e.trim());
        if (entries.length) {
          rollRows.push(`
            <div class="fci-roll-row">
              <span class="fci-dmg-label">📋 ${dlLabel}</span>
              <strong class="fci-dmg-dice">1d${entries.length}</strong>
              <button class="fci-roll-btn" data-action="roll-tabla"
                      data-actor-id="${aId}" data-item-id="${iId}">🎲 Lanzar en tabla</button>
            </div>`);
        }
      } else if (sys.dadoLibreFormula) {
        rollRows.push(`
          <div class="fci-roll-row">
            <span class="fci-dmg-label">${dlLabel}</span>
            <strong class="fci-dmg-dice">${sys.dadoLibreFormula}</strong>
            <button class="fci-roll-btn" data-action="roll-dado-libre"
                    data-formula="${sys.dadoLibreFormula}"
                    data-label="${dlLabel.replace(/"/g, "&quot;")}">🎲 Tirar</button>
          </div>`);
      }
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
    if (sec.savingThrow) {
      const stStat  = sys.savingThrowStat || "instintos";
      const stLabel = sys.savingThrow || "Saving Throw";
      rollRows.push(`
        <div class="fci-roll-row">
          <span class="fci-dmg-label">🛡 ${stLabel} DC ${sys.savingThrowDC}</span>
          <button class="fci-roll-btn" data-action="roll-saving-throw" data-stat="${stStat}" data-dc="${sys.savingThrowDC}">Tirar</button>
        </div>`);
    }
    if (sec.areaEfecto && sys.areaEfecto) {
      const tipoNorm = (sys.areaEfectoTipo || "esfera").toLowerCase()
        .replace(/[áà]/g, "a").replace(/[éè]/g, "e").replace(/[íì]/g, "i")
        .replace(/[óò]/g, "o").replace(/[úù]/g, "u").replace(/\s+/g, "");
      rollRows.push(`
        <div class="fci-roll-row">
          <span class="fci-dmg-label">💥 ${sys.areaEfecto} ft${sys.areaEfectoTipo ? ` · ${sys.areaEfectoTipo}` : ""}</span>
          <button class="fci-roll-btn fci-area-btn" data-action="place-area-template"
                  data-dist="${sys.areaEfecto}" data-tipo="${tipoNorm}">
            🎯 Colocar plantilla
          </button>
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

  async levelUp() {
    const dado = this.system.vidaDado ?? 6;
    const mod  = this.system.caracteristicas.aguante.modificador;
    const avg  = Math.max(1, Math.floor(dado / 2) + 1 + mod);
    const lvl  = this.system.nivel ?? 1;
    const maxHP = this.system.defensas.vida.max ?? 0;
    const curHP = this.system.defensas.vida.value ?? 0;

    return new Promise(resolve => {
      new Dialog({
        title: `⬆ Subir de Nivel (${lvl} → ${lvl + 1})`,
        content: `<div style="padding:10px 4px">
          <p>Dado de vida: <strong>1d${dado}</strong> + mod Aguante (${mod >= 0 ? "+" : ""}${mod})</p>
          <p>Promedio: <strong>${avg} PV</strong></p>
        </div>`,
        buttons: {
          roll: {
            icon: "<i class='fas fa-dice'></i>", label: "Tirar dado",
            callback: async () => {
              const roll = new Roll(`1d${dado}+${mod}`);
              await roll.evaluate();
              const gained = Math.max(1, roll.total);
              await this.update({
                "system.nivel":                 Math.min(20, lvl + 1),
                "system.defensas.vida.max":     maxHP + gained,
                "system.defensas.vida.value":   curHP + gained,
              });
              await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this }),
                flavor:  `<strong>¡Nivel ${lvl + 1}!</strong> +${gained} PV máx (1d${dado}${mod >= 0 ? "+" : ""}${mod})`,
              });
              resolve(gained);
            },
          },
          avg: {
            icon: "<i class='fas fa-calculator'></i>", label: `Promedio (+${avg} PV)`,
            callback: async () => {
              await this.update({
                "system.nivel":                 Math.min(20, lvl + 1),
                "system.defensas.vida.max":     maxHP + avg,
                "system.defensas.vida.value":   curHP + avg,
              });
              ui.notifications.info(`${this.name}: ¡Nivel ${lvl + 1}! +${avg} PV máx (promedio).`);
              resolve(avg);
            },
          },
          cancel: { icon: "<i class='fas fa-times'></i>", label: "Cancelar", callback: () => resolve(null) },
        },
        default: "roll",
      }, { classes: ["dialog", "forces-roll-dlg-win"] }).render(true);
    });
  }

  async shortRest() {
    const dado  = this.system.vidaDado ?? 6;
    const mod   = this.system.caracteristicas.aguante.modificador;
    const avg   = Math.max(1, Math.floor(dado / 2) + 1 + mod);
    const maxHP = this.system.defensas.vida.max ?? 0;
    const curHP = this.system.defensas.vida.value ?? 0;
    const maxEC = this.system.defensas.energiaCaotica.max ?? 0;

    return new Promise(resolve => {
      new Dialog({
        title: "💤 Descanso Corto",
        content: `<div style="padding:10px 4px">
          <p>Recuperas PV con tu dado de vida y restauras toda tu EC:</p>
          <p><strong>1d${dado}</strong> + mod Aguante (${mod >= 0 ? "+" : ""}${mod}) · Promedio: <strong>${avg}</strong></p>
          <p style="color:#888;font-size:11px">PV actuales: ${curHP} / ${maxHP} · EC: → ${maxEC}</p>
        </div>`,
        buttons: {
          roll: {
            icon: "<i class='fas fa-dice'></i>", label: "Tirar dado de vida",
            callback: async () => {
              const roll   = new Roll(`1d${dado}+${mod}`);
              await roll.evaluate();
              const healed = Math.max(1, roll.total);
              const newHP  = Math.min(maxHP, curHP + healed);
              await this.update({
                "system.defensas.vida.value":           newHP,
                "system.defensas.energiaCaotica.value": maxEC,
              });
              await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this }),
                flavor:  `<strong>Descanso Corto</strong> — Recupera ${newHP - curHP} PV · EC restaurada (${maxEC})`,
              });
              resolve(healed);
            },
          },
          avg: {
            icon: "<i class='fas fa-calculator'></i>", label: `Promedio (+${avg} PV)`,
            callback: async () => {
              const newHP = Math.min(maxHP, curHP + avg);
              await this.update({
                "system.defensas.vida.value":           newHP,
                "system.defensas.energiaCaotica.value": maxEC,
              });
              ui.notifications.info(`${this.name}: Descanso corto — recupera ${newHP - curHP} PV y EC restaurada.`);
              resolve(avg);
            },
          },
          cancel: { icon: "<i class='fas fa-times'></i>", label: "Cancelar", callback: () => resolve(null) },
        },
        default: "roll",
      }, { classes: ["dialog", "forces-roll-dlg-win"] }).render(true);
    });
  }

  async recarga() {
    const dado  = this.system.vidaDado ?? 6;
    const mod   = this.system.caracteristicas.caos.modificador;
    const avg   = Math.max(1, Math.floor(dado / 2) + 1 + mod);
    const maxEC = this.system.defensas.energiaCaotica.max ?? 0;
    const curEC = this.system.defensas.energiaCaotica.value ?? 0;

    return new Promise(resolve => {
      new Dialog({
        title: "✦ Recarga de Energía Caótica",
        content: `<div style="padding:10px 4px">
          <p>Recuperas EC en un descanso corto:</p>
          <p><strong>1d${dado}</strong> + mod Caos (${mod >= 0 ? "+" : ""}${mod}) · Promedio: <strong>${avg}</strong></p>
          <p style="color:#888;font-size:11px">EC actuales: ${curEC} / ${maxEC}</p>
        </div>`,
        buttons: {
          roll: {
            icon: "<i class='fas fa-dice'></i>", label: "Tirar",
            callback: async () => {
              const roll   = new Roll(`1d${dado}+${mod}`);
              await roll.evaluate();
              const gained = Math.max(1, roll.total);
              const newEC  = Math.min(maxEC, curEC + gained);
              await this.update({ "system.defensas.energiaCaotica.value": newEC });
              await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this }),
                flavor:  `<strong>Recarga ✦</strong> — Recupera ${newEC - curEC} EC`,
              });
              resolve(gained);
            },
          },
          avg: {
            icon: "<i class='fas fa-calculator'></i>", label: `Promedio (+${avg} EC)`,
            callback: async () => {
              const newEC = Math.min(maxEC, curEC + avg);
              await this.update({ "system.defensas.energiaCaotica.value": newEC });
              ui.notifications.info(`${this.name}: Recarga — recupera ${newEC - curEC} EC.`);
              resolve(avg);
            },
          },
          cancel: { icon: "<i class='fas fa-times'></i>", label: "Cancelar", callback: () => resolve(null) },
        },
        default: "roll",
      }, { classes: ["dialog", "forces-roll-dlg-win"] }).render(true);
    });
  }

  async longRest() {
    const updates = [];
    for (const item of this.items.contents) {
      const max = item.system.usosPorDesc ?? 0;
      if (max > 0) updates.push(item.update({ "system.usosActuales": max }));
    }
    await Promise.all(updates);
    await this.update({
      "system.defensas.vida.value":           this.system.defensas.vida.max,
      "system.defensas.energiaCaotica.value": this.system.defensas.energiaCaotica.max,
    });
    ui.notifications.info(`${this.name}: Long Rest — vida, energía caótica y usos restaurados.`);
  }
}
