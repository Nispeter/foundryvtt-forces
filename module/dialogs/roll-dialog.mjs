// Diálogo flotante de tirada: Normal / Ventaja / Desventaja + bonus adicional.
// Se posiciona junto al último click del usuario (tracked en forces.mjs).

export async function rollDialog(label) {
  const click = window._forcesLastClick ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const W = 340, H = 190;

  // Si no cabe a la derecha del click, lo movemos a la izquierda.
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
