// Plantillas de área "drag-and-drop" desde la tarjeta de chat de un objeto.
// Dibuja preview PIXI siguiendo al mouse y crea un MeasuredTemplate al click izquierdo.
// Cancelable con click derecho o Escape.

import { AREA_SHAPE_MAP } from "../constants/items.mjs";

const CONE_ANGLE_DEG = 53.13;
const RAY_WIDTH_FT   = 5;

function _toWorld(canvas, clientX, clientY) {
  const t = canvas.stage.worldTransform;
  return { x: (clientX - t.tx) / t.a, y: (clientY - t.ty) / t.d };
}

function _snap(canvas, pos) {
  try {
    return canvas.grid.getSnappedPoint?.(pos)
        ?? canvas.grid.getSnappedPosition?.(pos.x, pos.y)
        ?? pos;
  } catch {
    return pos;
  }
}

// Devuelve la primera posición mundo conocida del mouse, o null si nunca hubo.
// canvas.mousePosition puede ser stale/sintético — preferimos lo trackeado.
function _initialMousePos(canvas) {
  const tracked = window._forcesCanvasPos;
  if (tracked && Number.isFinite(tracked.x) && Number.isFinite(tracked.y)) return tracked;
  const cm = canvas.mousePosition;
  if (cm && Number.isFinite(cm.x) && Number.isFinite(cm.y)) return cm;
  return null;
}

export function placeAreaTemplate({ dist, dist2 = 0, tipo }) {
  console.log("Forces | placeAreaTemplate called", { dist, dist2, tipo });
  const shape = AREA_SHAPE_MAP[tipo] ?? "circle";

  if (!canvas) {
    return ui.notifications.warn("No hay canvas (Forces).");
  }
  if (!canvas.scene) {
    return ui.notifications.warn("Necesitas una escena activa para colocar la plantilla.");
  }
  if (canvas.ready === false) {
    return ui.notifications.warn("Canvas aún no listo, esperá un segundo.");
  }

  const gridDist  = canvas.scene.grid?.distance ?? 5;
  const pxPerUnit = canvas.grid.size / gridDist;
  const r         = dist * pxPerUnit;
  // L11: para rect, dist=ancho, dist2=alto. Si dist2=0, cuadrado de lado=dist.
  const rectAlto  = (dist2 > 0 ? dist2 : dist) * pxPerUnit;
  const halfAngle = (CONE_ANGLE_DEG / 2) * (Math.PI / 180);
  const rayHalfW  = (RAY_WIDTH_FT / 2) * pxPerUnit;
  const colorHex  = game.user.color ?? "#ff9900";
  const colorInt  = parseInt(colorHex.replace("#", ""), 16);

  const preview   = new PIXI.Graphics();
  const container = canvas.interface ?? canvas.stage;
  if (!container) {
    return ui.notifications.warn("No se encontró el container de canvas para la preview.");
  }
  container.addChild(preview);

  const drawAt = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    preview.clear();
    preview.lineStyle(2, colorInt, 1);
    preview.beginFill(colorInt, 0.18);
    switch (shape) {
      case "circle":
        preview.drawCircle(x, y, r); break;
      case "rect":
        // L11: rect anclado al centro. r = ancho, rectAlto = alto.
        preview.drawRect(x - r / 2, y - rectAlto / 2, r, rectAlto); break;
      case "cone":
        preview.moveTo(x, y);
        preview.lineTo(x + Math.cos(-halfAngle) * r, y + Math.sin(-halfAngle) * r);
        preview.arc(x, y, r, -halfAngle, halfAngle);
        preview.closePath();
        break;
      case "ray":
        preview.drawRect(x, y - rayHalfW, r, rayHalfW * 2); break;
    }
    preview.endFill();
  };

  const canvasEl = canvas.app.view ?? canvas.app.renderer?.view;
  const board    = canvasEl ?? document.getElementById("board");
  if (board) board.style.cursor = "crosshair";

  // Solo dibujamos preview inicial si tenemos una posición real (no (0,0) por fallback).
  // Antes esto causaba un artifact en la esquina superior izquierda del mundo.
  const initPos = _initialMousePos(canvas);
  if (initPos) {
    const p = _snap(canvas, initPos);
    drawAt(p.x, p.y);
  }

  // Notificación efímera para que el usuario sepa qué hacer.
  ui.notifications.info("Plantilla: click izquierdo coloca, derecho/Esc cancela.");

  const inBounds = (clientX, clientY) => {
    if (!canvasEl) return true;
    const rect = canvasEl.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  };

  // Bulletproof cleanup: remueve del parent ANTES de destroy para evitar artifacts
  // residuales en algunas versiones de PIXI.
  const cleanup = () => {
    document.removeEventListener("pointermove", onMove, true);
    document.removeEventListener("pointerdown", onPointer, true);
    window.removeEventListener("keydown", onKey);
    if (board) board.style.cursor = "";
    if (preview && !preview.destroyed) {
      try { container.removeChild(preview); } catch {}
      preview.destroy();
    }
  };

  const onMove = (moveEv) => {
    if (!inBounds(moveEv.clientX, moveEv.clientY)) return;
    try {
      const p = _snap(canvas, _toWorld(canvas, moveEv.clientX, moveEv.clientY));
      drawAt(p.x, p.y);
    } catch {}
  };

  const onPointer = async (pEv) => {
    if (!inBounds(pEv.clientX, pEv.clientY)) return;
    if (pEv.button === 2) { pEv.preventDefault(); pEv.stopPropagation(); cleanup(); return; }
    if (pEv.button !== 0) return;
    pEv.preventDefault();
    pEv.stopPropagation();
    cleanup();
    const pos = _snap(canvas, _toWorld(canvas, pEv.clientX, pEv.clientY));
    try {
      // L11: para rect, distance=alto y width=ancho. Si dist2=0 → cuadrado.
      // El preview es centrado en (pos.x, pos.y); MeasuredTemplate de Foundry extiende
      // desde (pos.x, pos.y) hacia direction=0. La forma visible será similar pero
      // con ancla en la esquina superior izquierda en lugar de centro.
      const rectAltoFt = shape === "rect" ? (dist2 > 0 ? dist2 : dist) : null;
      await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
        t: shape,
        x: shape === "rect" ? pos.x - (dist * pxPerUnit) / 2 : pos.x,
        y: shape === "rect" ? pos.y - (rectAltoFt * pxPerUnit) / 2 : pos.y,
        distance: shape === "rect" ? rectAltoFt : dist,
        direction: 0,
        angle:    shape === "cone" ? CONE_ANGLE_DEG : shape === "ray" ? RAY_WIDTH_FT : 360,
        width:    shape === "ray" ? RAY_WIDTH_FT
                : shape === "rect" ? dist
                : undefined,
        user:     game.user.id,
        fillColor: colorHex,
      }]);
    } catch (err) {
      console.error("Forces | Template error:", err);
      ui.notifications.warn("No se pudo colocar la plantilla: " + err.message);
    }
  };

  const onKey = (kEv) => { if (kEv.key === "Escape") { kEv.preventDefault(); cleanup(); } };

  document.addEventListener("pointermove", onMove, true);
  document.addEventListener("pointerdown", onPointer, true);
  window.addEventListener("keydown", onKey);
}
