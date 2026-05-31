// Placement de MeasuredTemplate usando el patrón canónico de Foundry:
//
//   1. Crear un MeasuredTemplateDocument en memoria (no persistido)
//   2. Crear un MeasuredTemplate placeable y dibujarlo
//   3. Adjuntarlo a canvas.templates.preview (PIXI container del layer)
//   4. Listeners DOM sobre canvas.app.view (NO PIXI events, más confiable
//      cross-version V11/V12/V13)
//   5. En cada move: actualizar preview.document via updateSource + refresh
//   6. Click izq → createEmbeddedDocuments para persistir el template
//   7. Click der / Esc → cancelar, destruir preview, restaurar capa inicial
//
// Si el preview workflow falla (e.g. PIXI o doc class issues), cae a fallback:
// crear el template directamente en la última posición conocida del mouse.

import { AREA_SHAPE_MAP } from "../constants/items.mjs";

const CONE_ANGLE_DEG = 53.13;
const RAY_WIDTH_FT   = 5;

// Solo un placement activo a la vez. Si el usuario invoca otro, se cancela el anterior.
let _activeCleanup = null;

// ── Helpers cross-version ──

// Convierte clientX/clientY (DOM) a world coords del canvas usando worldTransform.
function _toWorld(clientX, clientY) {
  const t = canvas.stage.worldTransform;
  return { x: (clientX - t.tx) / t.a, y: (clientY - t.ty) / t.d };
}

// Snap a la grilla.
// V12+: mode es un bitmask de CONST.GRID_SNAPPING_MODES.
//   VERTEX=4 → esquinas (intersecciones de celdas). Es lo que querés por default.
//   EDGE_MIDPOINT=2 → puntos medios de aristas (era el bug previo).
//   CENTER=1 → centro de celda.
// V11: intervals=1 → solo esquinas; intervals=2 → esquinas + midpoints + centro.
// Si el usuario mantiene Alt, ampliamos el set de puntos válidos (snap más libre).
function _snap(pos, { altKey = false } = {}) {
  if (!pos) return pos;
  try {
    if (canvas.grid?.getSnappedPoint) {
      const M = globalThis.CONST?.GRID_SNAPPING_MODES;
      const VERTEX        = M?.VERTEX        ?? 4;
      const CENTER        = M?.CENTER        ?? 1;
      const EDGE_MIDPOINT = M?.EDGE_MIDPOINT ?? 2;
      const mode = altKey ? (VERTEX | CENTER | EDGE_MIDPOINT) : VERTEX;
      return canvas.grid.getSnappedPoint(pos, { mode });
    }
    if (canvas.grid?.getSnappedPosition) {
      const intervals = altKey ? 2 : 1;
      const s = canvas.grid.getSnappedPosition(pos.x, pos.y, intervals);
      return { x: s?.x ?? pos.x, y: s?.y ?? pos.y };
    }
  } catch (err) {
    console.warn("Forces | snap failed:", err);
  }
  return pos;
}

// Resuelve el HTMLCanvasElement del PIXI app (cambia de nombre entre versiones).
function _canvasEl() {
  return canvas.app?.view
      ?? canvas.app?.renderer?.view
      ?? document.querySelector("#board canvas")
      ?? null;
}

// Construye el data del MeasuredTemplate según shape.
//
// Para t="rect", Foundry interpreta (direction, distance) como el VECTOR diagonal
// del rectángulo: el bounding box va de (0,0) a (cos(dir)*dist, sin(dir)*dist).
// Con direction=0, la altura es 0 → invisible. Para un rect de ancho W y alto H
// necesitamos direction=atan2(H,W) y distance=hypot(W,H). Para cuadrado (W=H)
// eso da direction=45° y distance=S√2. Mismo patrón que usa dnd5e.
function _buildTemplateData({ shape, dist, dist2, fillColor }) {
  const data = {
    t: shape,
    user: game.user.id,
    direction: 0,
    x: 0,
    y: 0,
    fillColor,
  };
  if (shape === "circle") {
    data.distance = dist;
  } else if (shape === "cone") {
    data.distance = dist;
    data.angle    = CONE_ANGLE_DEG;
  } else if (shape === "ray") {
    data.distance = dist;
    data.width    = RAY_WIDTH_FT;
  } else if (shape === "rect") {
    // L11: dist=ancho, dist2=alto. Si dist2=0, cuadrado de lado=dist.
    const w = dist;
    const h = dist2 > 0 ? dist2 : dist;
    data.direction = Math.toDegrees(Math.atan2(h, w));
    data.distance  = Math.hypot(w, h);
    data.width     = w;
  }
  return data;
}

// ── Fallback: crea el template directamente sin preview workflow ──

async function _createDirect(data) {
  console.log("Forces | fallback: crear template sin preview");
  // Si hay última pos de mouse, usarla; sino centro de la vista.
  const initialPos = window._forcesCanvasPos
    ?? canvas.mousePosition
    ?? { x: (canvas.dimensions?.width  ?? 1000) / 2,
         y: (canvas.dimensions?.height ?? 1000) / 2 };
  const sp = _snap(initialPos);
  try {
    const created = await canvas.scene.createEmbeddedDocuments(
      "MeasuredTemplate", [{ ...data, x: sp.x, y: sp.y }]
    );
    ui.notifications.info("Plantilla creada — arrastrala con shift+click para mover.");
    return created;
  } catch (err) {
    console.error("Forces | fallback createEmbeddedDocuments failed:", err);
    ui.notifications.error("No se pudo crear la plantilla: " + err.message);
    return null;
  }
}

// ── Main entrypoint ──

export async function placeAreaTemplate({ dist, dist2 = 0, tipo }) {
  console.log("Forces | placeAreaTemplate called", { dist, dist2, tipo });

  // Validaciones tempranas.
  if (!canvas) {
    ui.notifications.warn("Forces: canvas no inicializado.");
    return;
  }
  if (!canvas.scene) {
    ui.notifications.warn("Necesitas una escena activa para colocar la plantilla.");
    return;
  }
  if (canvas.ready === false) {
    ui.notifications.warn("Canvas no listo, esperá un segundo.");
    return;
  }

  // Si hay otro placement activo, cancelarlo primero.
  if (_activeCleanup) {
    try { _activeCleanup(); } catch {}
    _activeCleanup = null;
  }

  const shape     = AREA_SHAPE_MAP[tipo] ?? "circle";
  const fillColor = game.user.color ?? "#ff9900";
  const data      = _buildTemplateData({ shape, dist, dist2, fillColor });

  // Posición inicial: último mouse conocido, o centro del viewport.
  const initialPos = window._forcesCanvasPos
    ?? canvas.mousePosition
    ?? { x: (canvas.dimensions?.width  ?? 1000) / 2,
         y: (canvas.dimensions?.height ?? 1000) / 2 };
  const initialSnap = _snap(initialPos);
  data.x = initialSnap.x;
  data.y = initialSnap.y;

  const canvasEl = _canvasEl();
  if (!canvasEl) {
    console.error("Forces | canvas DOM element not found");
    return _createDirect(data);
  }

  // Crear documento (no guardado) + placeable preview.
  let doc, preview;
  try {
    const docCls = CONFIG.MeasuredTemplate?.documentClass;
    const objCls = CONFIG.MeasuredTemplate?.objectClass;
    if (!docCls || !objCls) {
      throw new Error("CONFIG.MeasuredTemplate document/object class not found");
    }
    doc = new docCls(data, { parent: canvas.scene });
    preview = new objCls(doc);
    if (typeof preview.draw === "function") {
      await preview.draw();
    }
    console.log("Forces | preview created", { doc, preview });
  } catch (err) {
    console.error("Forces | preview creation failed, falling back:", err);
    return _createDirect(data);
  }

  // Adjuntar al preview container. Si no existe, al stage.
  const previewContainer = canvas.templates?.preview ?? canvas.stage;
  try {
    previewContainer.addChild(preview);
  } catch (err) {
    console.error("Forces | could not addChild preview:", err);
    return _createDirect(data);
  }

  const rotInfo = shape === "rect" ? " · R rota 90°"
                : shape === "circle" ? ""
                : " · R rota 15°";
  ui.notifications.info(`🎯 Plantilla: click izq coloca · der/Esc cancela${rotInfo} · Alt = snap fino`);
  canvasEl.style.cursor = "crosshair";

  return new Promise(resolve => {
    let finalized = false;
    let lastMoveTime = 0;

    const cleanup = () => {
      canvasEl.removeEventListener("pointermove", onMove);
      canvasEl.removeEventListener("pointerdown", onPointerDown);
      canvasEl.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown, true);
      canvasEl.style.cursor = "";
      try {
        // Quitar del container antes de destruir para evitar artifacts.
        if (previewContainer && preview.parent === previewContainer) {
          previewContainer.removeChild(preview);
        }
        preview.destroy({ children: true });
      } catch (e) {
        console.warn("Forces | preview destroy fail:", e);
      }
      _activeCleanup = null;
    };
    _activeCleanup = cleanup;

    const onMove = (ev) => {
      const now = Date.now();
      if (now - lastMoveTime < 16) return; // ~60fps cap
      lastMoveTime = now;
      try {
        const world = _toWorld(ev.clientX, ev.clientY);
        const sp = _snap(world, { altKey: ev.altKey });
        preview.document.updateSource({ x: sp.x, y: sp.y });
        preview.refresh();
      } catch (err) {
        // Silencioso: no spamear consola en cada move
      }
    };

    const onPointerDown = async (ev) => {
      if (finalized) return;
      console.log("Forces | template pointerdown button:", ev.button);

      // Solo click izquierdo confirma. Otros se ignoran (right via contextmenu).
      if (ev.button !== 0) return;

      ev.preventDefault();
      ev.stopPropagation();
      finalized = true;

      const world = _toWorld(ev.clientX, ev.clientY);
      const sp = _snap(world, { altKey: ev.altKey });
      const finalData = { ...preview.document.toObject(), x: sp.x, y: sp.y };

      cleanup();

      try {
        const created = await canvas.scene.createEmbeddedDocuments(
          "MeasuredTemplate", [finalData]
        );
        console.log("Forces | template placed:", created);
        resolve(created);
      } catch (err) {
        console.error("Forces | createEmbeddedDocuments failed:", err);
        ui.notifications.warn("No se pudo colocar: " + err.message);
        resolve(null);
      }
    };

    const onContextMenu = (ev) => {
      ev.preventDefault();
      if (finalized) return;
      finalized = true;
      cleanup();
      resolve(null);
    };

    // Rotación por tecla R. Step según shape:
    //  - cone/ray: 15° (rota la dirección apuntada)
    //  - rect: 90° (preserva la forma del rectángulo, solo cambia orientación)
    //  - circle: skip (simétrico, no tiene sentido rotar)
    const rotationStep = shape === "rect" ? 90
                       : shape === "circle" ? 0
                       : 15;

    const onKeyDown = (ev) => {
      if (finalized) return;
      if (ev.key === "Escape") {
        finalized = true;
        cleanup();
        resolve(null);
        return;
      }
      if ((ev.key === "r" || ev.key === "R") && rotationStep > 0) {
        ev.preventDefault();
        // Shift+R rota al revés.
        const delta = ev.shiftKey ? -rotationStep : rotationStep;
        const cur = preview.document.direction ?? 0;
        const next = ((cur + delta) % 360 + 360) % 360;
        try {
          preview.document.updateSource({ direction: next });
          preview.refresh();
          console.log(`Forces | rotated to ${next}°`);
        } catch (err) {
          console.warn("Forces | rotation failed:", err);
        }
      }
    };

    canvasEl.addEventListener("pointermove", onMove);
    canvasEl.addEventListener("pointerdown", onPointerDown);
    canvasEl.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown, true);

    console.log("Forces | template listeners attached on canvas element");
  });
}
