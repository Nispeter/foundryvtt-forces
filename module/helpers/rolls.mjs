// Helpers compartidos para construir y evaluar tiradas con ventaja/desventaja
// y para formatear flavors de mensajes de chat.
//
// Convención `opts`: { mode: "normal"|"adv"|"dis", bonus: number }
//   - normal: 1d20+mod
//   - adv:    {2d20kh1}+mod
//   - dis:    {2d20kl1}+mod
//
// `bonus` es bonus adicional pedido en el diálogo (suma a mod base).

// Construye la fórmula d20 con modificador y modo ventaja/desventaja.
export function d20Formula(baseMod, opts) {
  const t = baseMod + (opts?.bonus || 0);
  const s = t >= 0 ? `+${t}` : `${t}`;
  if (opts?.mode === "adv") return `{2d20kh1}${s}`;
  if (opts?.mode === "dis") return `{2d20kl1}${s}`;
  return `1d20${s}`;
}

export function modeSuffix(opts) {
  return opts?.mode === "adv" ? " [Ventaja]" :
         opts?.mode === "dis" ? " [Desventaja]" : "";
}

export function bonusSuffix(opts) {
  if (!opts?.bonus) return "";
  return ` +bns ${opts.bonus >= 0 ? "+" : ""}${opts.bonus}`;
}

// Para tiradas de daño/libre: bonus aplicado directo a la fórmula (sin "bns").
export function bonusInline(opts) {
  if (!opts?.bonus) return "";
  return opts.bonus >= 0 ? `+${opts.bonus}` : `${opts.bonus}`;
}

// Evalúa una fórmula genérica respetando ventaja/desventaja.
// Para fórmulas no-d20 (daño, dado libre), ejecuta dos tiradas y elige por total.
export async function evaluateRollWithMode(formula, opts) {
  if (opts?.mode === "normal" || !opts?.mode) {
    const roll = new Roll(formula);
    await roll.evaluate();
    return roll;
  }
  const r1 = new Roll(formula);
  const r2 = new Roll(formula);
  await r1.evaluate();
  await r2.evaluate();
  if (opts.mode === "adv") return r1.total >= r2.total ? r1 : r2;
  return r1.total <= r2.total ? r1 : r2; // dis
}
