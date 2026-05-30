// ForcesActor: clase de documento Actor + métodos de roll de alto nivel.
// La lógica de derivación vive en data/actor-data.mjs; aquí solo aplicamos
// buffs de items y construimos tiradas que delegan en helpers.

import { STAT_KEYS, SKILL_STAT, REACCION_STAT, REACCION_LABEL,
         DEFENSA_CORPORAL_STATS, DEFENSA_CAOTICA_STATS,
         MOVIMIENTO_BASE, MOVIMIENTO_MINIMO, MOVIMIENTO_BONUS_ANILLOS, ANILLOS_PARA_BONUS,
         MAEST_BONUS } from "../constants/stats.mjs";
import { addToPath } from "../helpers/paths.mjs";
import { d20Formula, modeSuffix, bonusSuffix } from "../helpers/rolls.mjs";
import { rollDialog } from "../dialogs/roll-dialog.mjs";
import { levelUpDialog, shortRestDialog, recargaDialog } from "../dialogs/rest-dialogs.mjs";
import { buildUseItemCard, resolveActiveSections } from "../chat/use-item-card.mjs";

// Re-exports para que forces.mjs (y compatibilidad externa) pueda seguir importando
// rollDialog y d20Formula desde aquí.
export { rollDialog, d20Formula };

// ─── Helpers internos ──────────────────────────────────────────────────────

// Patrón compartido: pide modo+bonus, evalúa d20+mod, manda flavor a chat.
// `label`         → título del diálogo.
// `flavorBuilder` → función (opts) => string para el flavor del mensaje.
async function _rollD20WithDialog(actor, baseMod, label, flavorBuilder) {
  const opts = await rollDialog(label);
  if (!opts) return null;
  const roll = new Roll(d20Formula(baseMod, opts));
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  flavorBuilder(opts),
  });
  return roll;
}

// Pretty-print de modificador con signo.
const _signed = m => `${m >= 0 ? "+" : ""}${m}`;

// ─── ForcesActor ───────────────────────────────────────────────────────────

export class ForcesActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
    this._applyItemBuffs();
  }

  // Suma buffs de items equipados (excepto armas: ahí los buffs no se aplican
  // hasta empuñarse — comportamiento heredado pre-refactor). Si algún buff
  // afecta a un modificador de característica, se recomputa la cadena derivada.
  _applyItemBuffs() {
    const sys = this.system;
    const car = sys.caracteristicas;
    let charModChanged = false;

    // Acumular bonificaciones estadísticas planas (DF, ataque, reacción) de
    // items equipados. Se exponen como sys.bonifEquipados.{df, ataque, reaccion}
    // para que rollAtaque/rollReaccion y la defensa corporal puedan sumarlos.
    // Armas no aportan estos bonus pasivos (sus stats van en el daño/hit).
    const bonif = { df: 0, ataque: 0, reaccion: 0 };

    for (const item of this.items) {
      if (!item.system.equipado) continue;
      if ((item.system.categoria ?? "") === "arma") continue;

      bonif.df       += Number(item.system.bonusDf)       || 0;
      bonif.ataque   += Number(item.system.bonusAtaque)   || 0;
      bonif.reaccion += Number(item.system.bonusReaccion) || 0;

      for (const buff of (item.system.buffs ?? [])) {
        if (!buff.activo || !buff.target) continue;

        // delta = baseVal + scaleMult * (mod stat | nivel | 0)
        let delta = Number(buff.baseVal) || 0;
        if (buff.scaleVar && buff.scaleVar !== "none") {
          const sv = buff.scaleVar === "nivel"
            ? (sys.nivel ?? 0)
            : (car[buff.scaleVar]?.modificador ?? 0);
          delta += (Number(buff.scaleMult) || 1) * sv;
        }
        delta = Math.round(delta);
        if (!delta) continue;

        if (buff.target.startsWith("caracteristicas.") && buff.target.endsWith(".bonus")) {
          // Atajo: aplicamos al modificador derivado directamente (no a bonus base)
          // para que afecte SOLO mientras el item esté equipado. Marca para recomputar.
          const carKey = buff.target.slice("caracteristicas.".length, -".bonus".length);
          if (car[carKey]) {
            car[carKey].modificador += delta;
            charModChanged = true;
            // L14: registrar contribución del item para el breakdown.
            sys.statBreakdown?.[carKey]?.push({ source: `Item: ${item.name}`, value: delta });
          }
        } else {
          addToPath(sys, buff.target, delta);
        }
      }
    }

    // Si cambiaron mods de car, recomputar defensas/movimiento/skills.
    // OJO: este recompute es deliberadamente PARCIAL y mirror del comportamiento
    // pre-refactor: NO toca EC máx ni vidaDado, para que buffs que aporten
    // directamente a EC máx (vía addToPath) no se sobreescriban.
    if (charModChanged) {
      const sum = keys => keys.reduce((acc, k) => acc + (car[k]?.modificador ?? 0), 0);
      sys.defensas.defensaCorporal = Math.max(1, 10 + sum(DEFENSA_CORPORAL_STATS));
      sys.defensas.defensaCaotica  = Math.max(1, 10 + sum(DEFENSA_CAOTICA_STATS));
      sys.movimiento = Math.max(MOVIMIENTO_MINIMO,
        10 * car.velocidad.modificador + MOVIMIENTO_BASE + (sys.bonusMovimiento ?? 0));
      if ((sys.defensas.anillos?.value ?? 0) >= ANILLOS_PARA_BONUS) {
        sys.movimiento += MOVIMIENTO_BONUS_ANILLOS;
      }
      for (const [hab, carKey] of Object.entries(SKILL_STAT)) {
        const skill = sys.habilidades[hab];
        if (skill) skill.total = (car[carKey]?.modificador ?? 0) + (skill.experticia ?? 0);
      }
    }

    // Expone bonificaciones planas para rolls de atk/reacción (línea 12 del backlog).
    // Se publica siempre (incluso si son 0) para que el sheet pueda mostrarlas.
    // bonusDf se suma DESPUÉS del recompute para que no sea clobbered.
    sys.bonifEquipados = bonif;
    sys.defensas.defensaCorporal = Math.max(1, sys.defensas.defensaCorporal + bonif.df);

    // L6: si el mod de caos cambió por un buff, EC máx debería reflejarlo
    // (la fórmula canónica es mod × 7). Antes esto se quedaba "stuck" en el valor
    // base y los usuarios veían inconsistencia entre el modificador y los recursos.
    // Tomamos max() para no romper buffs que aporten directamente a EC máx vía addToPath.
    if (charModChanged) {
      const ecBaseDesdeNuevoMod = Math.max(0, 7 * car.caos.modificador);
      sys.defensas.energiaCaotica.max = Math.max(sys.defensas.energiaCaotica.max, ecBaseDesdeNuevoMod);
    }
  }

  getRollData() {
    // Plano de modificadores para fórmulas tipo "1d20+@fuerza".
    const car = this.system.caracteristicas;
    const out = { nivel: this.system.nivel };
    for (const k of STAT_KEYS) out[k] = car[k].modificador;
    return out;
  }

  // ── Tiradas básicas (todas siguen el patrón _rollD20WithDialog) ──

  async rollCaracteristica(carKey) {
    const car   = this.system.caracteristicas[carKey];
    const label = `${carKey.charAt(0).toUpperCase()}${carKey.slice(1)} (${car.rankDisplay})`;
    return _rollD20WithDialog(this, car.modificador, label, opts =>
      `<strong>${label}</strong> mod ${_signed(car.modificador)}${bonusSuffix(opts)}${modeSuffix(opts)}`
    );
  }

  async rollCaos() {
    const car   = this.system.caracteristicas.caos;
    const label = `Caos (${car.rankDisplay})`;
    return _rollD20WithDialog(this, car.modificador, label, opts =>
      `<strong>Tirada de Caos</strong> mod ${_signed(car.modificador)}${bonusSuffix(opts)}${modeSuffix(opts)}`
    );
  }

  async rollMovimiento() {
    const car   = this.system.caracteristicas.velocidad;
    const label = `Velocidad / Movimiento (${car.rankDisplay})`;
    return _rollD20WithDialog(this, car.modificador, label, opts =>
      `<strong>Velocidad</strong> — mov ${this.system.movimiento} pies${bonusSuffix(opts)}${modeSuffix(opts)}`
    );
  }

  async rollHabilidad(habKey) {
    const hab   = this.system.habilidades[habKey];
    const label = `${habKey} (total ${_signed(hab.total)})`;
    return _rollD20WithDialog(this, hab.total, label, opts =>
      `<strong>${habKey}</strong> total ${_signed(hab.total)}${bonusSuffix(opts)}${modeSuffix(opts)}`
    );
  }

  async rollAtaque(tipo = "fuerza", etiqueta = "") {
    const car      = this.system.caracteristicas[tipo];
    const bonifAtk = this.system.bonifEquipados?.ataque ?? 0;
    const base     = car.modificador + bonifAtk;
    const label    = `${etiqueta || "Ataque"} (${tipo})`;
    const equipTag = bonifAtk ? ` (eq ${_signed(bonifAtk)})` : "";
    return _rollD20WithDialog(this, base, label, opts =>
      `<strong>${etiqueta || "Ataque"}</strong> (${tipo}) mod ${_signed(base)}${equipTag}${bonusSuffix(opts)}${modeSuffix(opts)}`
    );
  }

  async rollReaccion(tipo) {
    const carKey   = REACCION_STAT[tipo] ?? "instintos";
    const bonifRea = this.system.bonifEquipados?.reaccion ?? 0;
    const mod      = this.system.caracteristicas[carKey].modificador + bonifRea;
    const label    = `Reacción: ${REACCION_LABEL[tipo] ?? tipo}`;
    const equipTag = bonifRea ? ` (eq ${_signed(bonifRea)})` : "";
    const opts     = await rollDialog(label);
    if (!opts) return null;
    const roll     = new Roll(d20Formula(mod, opts));
    await roll.evaluate();

    // Reglas extra de reacciones: 20+ éxito total, 1+ éxito parcial.
    let flavor = `<strong>${label}</strong> mod ${_signed(mod)}${equipTag}${bonusSuffix(opts)}${modeSuffix(opts)}`;
    if      (roll.total >= 20) flavor += " — <em>¡Éxito total!</em>";
    else if (roll.total > 0)   flavor += " — <em>Éxito parcial (enemigo -1d4)</em>";

    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this }), flavor });
    return roll;
  }

  // Tirada caos + daño embebido si el item tiene dadoDanio.
  async rollCaosControl(item) {
    const data  = item.system;
    const mod   = this.system.caracteristicas.caos.modificador;
    const label = `${item.name} — Caos Control`;
    const opts  = await rollDialog(label);
    if (!opts) return null;
    const roll  = new Roll(d20Formula(mod, opts));
    await roll.evaluate();

    let flavor = `<strong>${item.name}</strong> — ${data.costoCaos}✦ EC — mod ${_signed(mod)}${bonusSuffix(opts)}${modeSuffix(opts)}`;
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

    // car.modificador NO incluye bonus de maestrías (cambio de diseño): el bonus
    // de la maestría es plano según su rank y se aplica SOLO en su propia tirada.
    const maestBonus = MAEST_BONUS[m.rank] ?? 0;
    const total      = car.modificador + maestBonus;
    const nombre     = m.nombre || `Maestría ${m.rank}`;
    const label      = `${nombre} [${m.rank}]`;
    const breakdown  = ` [${carKey} ${_signed(car.modificador)} + maestría [${m.rank}] ${_signed(maestBonus)}]`;
    return _rollD20WithDialog(this, total, label, opts =>
      `<strong>${nombre}</strong> [${m.rank}] — total ${_signed(total)}${breakdown}${bonusSuffix(opts)}${modeSuffix(opts)}`
    );
  }

  // ── Usar item: tarjeta de chat con botones ────────────────────────────────

  async useItem(item) {
    const sys     = item.system;
    const isOwner = this.isOwner;
    const sec     = resolveActiveSections(sys);

    // Consumir 1 uso si quedan.
    const max    = sys.usosPorDesc ?? 0;
    let usesCurr = sys.usosActuales ?? 0;
    if (isOwner && max > 0) {
      if (usesCurr <= 0) {
        ui.notifications.warn(`${item.name}: Sin usos restantes (0/${max}).`);
        return;
      }
      usesCurr--;
      await item.update({ "system.usosActuales": usesCurr });
    }

    // Consumir EC si es un caos control con coste.
    if (isOwner && sec.caosControl && (sys.costoCaos ?? 0) > 0) {
      const ec = this.system.defensas.energiaCaotica.value ?? 0;
      await this.update({
        "system.defensas.energiaCaotica.value": Math.max(0, ec - sys.costoCaos),
      });
    }

    const content = buildUseItemCard({
      actor: this, item, sec, usesCurr, max, isOwner,
    });

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      flags: { forces: { type: "item-use", itemId: item.id, actorId: this.id } },
    });
  }

  // ── Descansos / nivel-up (delegan en módulo dialogs) ──────────────────────

  levelUp()   { return levelUpDialog(this); }
  shortRest() { return shortRestDialog(this); }
  recarga()   { return recargaDialog(this); }

  // Long rest: no requiere diálogo. Restaura PV, EC y todos los usos.
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
