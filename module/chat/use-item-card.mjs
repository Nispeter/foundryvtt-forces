// Builder de la tarjeta HTML que se envía a chat cuando un actor "usa" un item.
// Separado de actor.mjs porque era >200 líneas de string-templating y dificultaba
// localizar la lógica real del actor.
//
// Recibe { actor, item, secciones, usesCurr, max }, devuelve { content }.

import { STAT_ABBR } from "../constants/stats.mjs";
import { CAT_LABEL, CAT_CSS } from "../constants/items.mjs";

// Construye el array de tags pequeños (slot, EC, duración, rango, etc.).
function _buildTags({ sys, sec, usesCurr, max }) {
  const tags = [];
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
  return tags;
}

// Resumen de buffs estadísticos pasivos (DF, reacción, ataque, slots).
function _buildBonusRow({ sys, sec }) {
  if (!sec.bonEstadistica) return "";
  const bonuses = [];
  if (sys.bonusDf)       bonuses.push(`DF Corp <strong>+${sys.bonusDf}</strong>`);
  if (sys.bonusReaccion) bonuses.push(`Reac. <strong>+${sys.bonusReaccion}</strong>`);
  if (sys.bonusAtaque)   bonuses.push(`Ataque <strong>+${sys.bonusAtaque}</strong>`);
  if (sys.slots)         bonuses.push(`Slots <strong>+${sys.slots}</strong>`);
  return bonuses.length ? `<div class="fci-bonus-row">${bonuses.join(" · ")}</div>` : "";
}

// Botones de tirada (ataque, daño, dado libre, caos, ST, área, refund).
function _buildRollRows({ actor, item, sys, sec, usesCurr, max, isOwner }) {
  const aId  = actor.id;
  const iId  = item.id;
  const car  = actor.system.caracteristicas;
  const rows = [];

  // Ataque (uno o dos botones según atacarCon / atacarCon2).
  if (sec.hit) {
    const hit   = sys.bonusHit ?? 0;
    const n     = sys.numAtaques ?? 1;
    const stat1 = sys.atacarCon  || null;
    const stat2 = sys.atacarCon2 || null;
    const btns  = [];
    if (stat1) {
      const m = (car[stat1]?.modificador ?? car.fuerza.modificador) + hit;
      btns.push(`<button class="fci-roll-btn" data-action="roll-attack" data-tipo="${stat1}" data-actor-id="${aId}" data-item-id="${iId}">🗡 ${STAT_ABBR[stat1] ?? stat1} ${m >= 0 ? "+" : ""}${m}</button>`);
    }
    if (stat2) {
      const m = (car[stat2]?.modificador ?? car.tecnica.modificador) + hit;
      btns.push(`<button class="fci-roll-btn" data-action="roll-attack" data-tipo="${stat2}" data-actor-id="${aId}" data-item-id="${iId}">⚙ ${STAT_ABBR[stat2] ?? stat2} ${m >= 0 ? "+" : ""}${m}</button>`);
    }
    if (btns.length) {
      rows.push(`
        <div class="fci-roll-row">
          <span class="fci-dmg-label">Ataque${n > 1 ? ` ×${n}` : ""}${hit ? ` (+${hit} hit)` : ""}</span>
          <div class="fci-btn-group">${btns.join("")}</div>
        </div>`);
    }
  }

  // Daño.
  if (sec.danioEfecto && sys.dadoDanio) {
    const diceStr = sys.bonusDanio ? `${sys.dadoDanio}+${sys.bonusDanio}` : sys.dadoDanio;
    rows.push(`
      <div class="fci-roll-row">
        <span class="fci-dmg-label">Daño:</span>
        <strong class="fci-dmg-dice">${diceStr}</strong>
        ${sys.danioTipo ? `<span class="fci-dmg-type">(${sys.danioTipo})</span>` : ""}
        <button class="fci-roll-btn" data-action="roll-damage" data-actor-id="${aId}" data-item-id="${iId}">🎲 Tirar daño</button>
      </div>`);
  }

  // Dado libre / tabla.
  if (sec.dadoLibre) {
    const dlLabel = sys.dadoLibreLabel || "Tirada libre";
    if (sys.dadoLibreTabla) {
      const entries = (sys.dadoLibreEntradas ?? "").split("\n").filter(e => e.trim());
      if (entries.length) {
        rows.push(`
          <div class="fci-roll-row">
            <span class="fci-dmg-label">📋 ${dlLabel}</span>
            <strong class="fci-dmg-dice">1d${entries.length}</strong>
            <button class="fci-roll-btn" data-action="roll-tabla"
                    data-actor-id="${aId}" data-item-id="${iId}">🎲 Lanzar en tabla</button>
          </div>`);
      }
    } else if (sys.dadoLibreFormula) {
      rows.push(`
        <div class="fci-roll-row">
          <span class="fci-dmg-label">${dlLabel}</span>
          <strong class="fci-dmg-dice">${sys.dadoLibreFormula}</strong>
          <button class="fci-roll-btn" data-action="roll-dado-libre"
                  data-formula="${sys.dadoLibreFormula}"
                  data-label="${dlLabel.replace(/"/g, "&quot;")}">🎲 Tirar</button>
        </div>`);
    }
  }

  // Caos Control.
  if (sec.caosControl) {
    const cMod = car.caos.modificador;
    rows.push(`
      <div class="fci-roll-row">
        <span class="fci-dmg-label">Caos Control</span>
        <button class="fci-roll-btn fci-roll-caos" data-action="roll-caos" data-actor-id="${aId}" data-item-id="${iId}">
          ✦ Tirar Caos ${cMod >= 0 ? "+" : ""}${cMod}
        </button>
      </div>`);
  }

  // Saving throw.
  if (sec.savingThrow) {
    const stStat  = sys.savingThrowStat || "instintos";
    const stLabel = sys.savingThrow || "Saving Throw";
    rows.push(`
      <div class="fci-roll-row">
        <span class="fci-dmg-label">🛡 ${stLabel} DC ${sys.savingThrowDC}</span>
        <button class="fci-roll-btn" data-action="roll-saving-throw" data-stat="${stStat}" data-dc="${sys.savingThrowDC}">Tirar</button>
      </div>`);
  }

  // Plantilla de área.
  if (sec.areaEfecto && sys.areaEfecto) {
    // Normaliza tipo a slug ascii sin espacios para que el handler resuelva la forma.
    const tipoNorm = (sys.areaEfectoTipo || "esfera").toLowerCase()
      .replace(/[áà]/g, "a").replace(/[éè]/g, "e").replace(/[íì]/g, "i")
      .replace(/[óò]/g, "o").replace(/[úù]/g, "u").replace(/\s+/g, "");
    // L11: para rect, areaEfecto = ancho y areaEfectoAncho = alto (si > 0).
    const dist2 = Number(sys.areaEfectoAncho) || 0;
    const dist2Tag = dist2 > 0 && ["cuadrado", "cubo", "rect", "square"].includes(tipoNorm)
      ? ` × ${dist2} ft` : "";
    rows.push(`
      <div class="fci-roll-row">
        <span class="fci-dmg-label">💥 ${sys.areaEfecto} ft${dist2Tag}${sys.areaEfectoTipo ? ` · ${sys.areaEfectoTipo}` : ""}</span>
        <button class="fci-roll-btn fci-area-btn" data-action="place-area-template"
                data-dist="${sys.areaEfecto}" data-dist2="${dist2}" data-tipo="${tipoNorm}">
          🎯 Colocar plantilla
        </button>
      </div>`);
  }

  // Botón ↺ Restaurar uso (solo dueño).
  if (sec.usos && max > 0 && isOwner) {
    const refundDisabled = usesCurr >= max ? " disabled" : "";
    rows.push(`
      <div class="fci-roll-row">
        <span class="fci-dmg-label">Usos restantes: ${usesCurr}/${max}</span>
        <button class="fci-roll-btn fci-refund-btn" data-action="refund-uses" data-actor-id="${aId}" data-item-id="${iId}"${refundDisabled}>
          ↺ Restaurar uso
        </button>
      </div>`);
  }

  return rows;
}

// Calcula qué secciones mostrar combinando flags de `sys.secciones` con auto-detección
// de datos legacy (un item viejo sin flags pero con dadoDanio sigue mostrando daño).
export function resolveActiveSections(sys) {
  const sec = { ...(sys.secciones ?? {}) };
  if (sys.descripcion)                                                              sec.descripcion    = true;
  if (sys.dadoDanio)                                                                sec.danioEfecto    = true;
  if (sys.bonusHit || (sys.numAtaques ?? 1) > 1 || sys.atacarCon || sys.atacarCon2) sec.hit            = true;
  if (sys.savingThrow)                                                              sec.savingThrow    = true;
  if (sys.usosPorDesc)                                                              sec.usos           = true;
  if ((sys.buffs ?? []).length)                                                     sec.buffs          = true;
  if (sys.bonusDf || sys.bonusReaccion || sys.bonusAtaque || sys.slots)             sec.bonEstadistica = true;
  if ((sys.nivelReq ?? 1) > 1 || sys.claseReq)                                      sec.featClase      = true;
  if (sys.categoria === "caos")                                                     sec.caosControl    = true;
  if (sys.dadoLibreFormula || sys.dadoLibreTabla)                                   sec.dadoLibre      = true;
  if (sys.areaEfecto)                                                               sec.areaEfecto     = true;
  return sec;
}

// Construye el HTML completo de la tarjeta de uso. Pure function: no toca el actor.
export function buildUseItemCard({ actor, item, sec, usesCurr, max, isOwner }) {
  const sys      = item.system;
  const tags     = _buildTags({ sys, sec, usesCurr, max });
  const bonRow   = _buildBonusRow({ sys, sec });
  const rollRows = _buildRollRows({ actor, item, sys, sec, usesCurr, max, isOwner });

  const catLabel = CAT_LABEL[sys.categoria] ?? sys.categoria;
  const catCss   = CAT_CSS[sys.categoria]   ?? "";

  return `
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
}
