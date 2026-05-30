// Registro de helpers Handlebars. Se llama una sola vez desde forces.mjs/init.
import { CAT_CLASS_HELPER } from "../constants/items.mjs";

export function registerHandlebarsHelpers() {
  Handlebars.registerHelper("signedNum", n => {
    const v = Number(n) || 0;
    return v >= 0 ? `+${v}` : `${v}`;
  });

  Handlebars.registerHelper("lowercase", s => (s ?? "").toLowerCase());

  // Convierte un rango string a clase CSS segura (S+ → splus).
  Handlebars.registerHelper("rankClass", r => (r ?? "f").toLowerCase().replace("+", "plus"));

  Handlebars.registerHelper("eq",  (a, b) => a === b);
  Handlebars.registerHelper("neq", (a, b) => a !== b);
  Handlebars.registerHelper("lte", (a, b) => a <= b);
  Handlebars.registerHelper("or",  (a, b) => a || b);
  Handlebars.registerHelper("gt",  (a, b) => Number(a) > Number(b));

  // Porcentaje 0–100 con un decimal, clampeado para barras de progreso.
  Handlebars.registerHelper("pct", (v, m) =>
    Math.min(100, Math.max(0, ((Number(v) || 0) / Math.max(1, Number(m) || 1)) * 100)).toFixed(1)
  );

  Handlebars.registerHelper("catClass", cat => CAT_CLASS_HELPER[cat] ?? "cat-equipo");
}
