// Utilidades genéricas de manipulación de objetos por path (a.b.c).

// Suma delta al número en el path. No-op si el path no resuelve a número
// o si delta es 0/falsy. No crea propiedades nuevas.
export function addToPath(obj, path, delta) {
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

// Devuelve "+n" / "-n" según signo, "" si es 0/falsy.
export function signedBonus(n) {
  if (!n) return "";
  return n >= 0 ? `+${n}` : `${n}`;
}
