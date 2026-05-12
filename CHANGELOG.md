# Changelog

All notable changes to the Forces system are documented here.

## [0.4.0] — 2026-05-11

### Added
- **Base tarjeta slots**: characters now have a configurable `baseSlots` field (default 3) editable directly on the actor sheet header.
- **NPC full sections**: NPCs now have habilidades, maestrías, and caos sections (same as PCs); habilidades and maestrías start collapsed by default.
- **NPC maestría bonuses and skill totals**: NPC derivation now applies maestría rank bonuses and computes full skill totals identically to PCs.

### Fixed
- **Buff system**: characteristic-bonus buffs now modify the derived `modificador` field (post-derivation) instead of the stored `bonus` field, preventing FoundryVTT from resetting them each cycle; downstream values (defenses, movement, skills) are recomputed after applying buffs.
- **EC max formula**: Energía Caótica max now uses `caos.modificador × 7` (e.g. A rank = +6 → EC max 42) instead of `caos.puntos × 7`.
- **Section add popup**: the "add section" button in item sheets now opens a floating fixed-position overlay instead of an inline inline list, so it no longer pushes content around.
- **Equipped icon standardized**: all item types (armas, equipo, tarjetas, caos, feats) now use the same `fa-check-circle` equipped icon.
- **Tooltip not triggered by icon hover**: hovering over the equip/edit/delete icon controls no longer opens the floating item tooltip.
- **Checkbox and slider accent color**: checkboxes and range sliders across all sheets (principal, item, secciones) now render in blue (`--clr-accent`) instead of red, overriding FoundryVTT's base CSS.
- **Toggle track default color**: the section toggle track background is now blue by default (was grey).
- **Template placement on canvas**: area-of-effect template placement now uses document-level capture-phase pointer events with canvas-bounds checking, reliably intercepting clicks even over HTML overlays above the PIXI canvas.

## [0.3.0] — 2026-05-10

### Added
- **S+ rank**: puntos=7, modifier=+15 — now a real selectable rank, not a display trick.
- **Configurable attack stats per item**: hit section now has two stat dropdowns (defaults: Fuerza / Técnica).
- **Dado libre section**: any free dice formula with a custom label, rolls from chat card.
- **Área de efecto section**: radius (ft) and shape field, shown as a chip on hover and in chat.
- **Buff targets expanded**: characteristic bonuses (`Car: *`), Vida (máx.) and EC (máx.) can now be buffed by equipped items.
- **Two-pass buff system**: characteristic-bonus buffs apply before derivation so skill totals reflect them correctly.
- **Favoritos**: star toggle on every item row; starred items appear in a Favoritos block at the top of the Principal tab.
- **Tarjeta slots**: `costoTarjeta` field on tarjetas; header shows slots used / available (from equipped items with slots bonus).
- **Section toggle sliders**: the "add section" pill panel is replaced by a row of ON/OFF toggles always visible at the bottom of the item sheet.
- **Collapse buttons on all principal-tab section blocks**: click ▾ to collapse any block; NPC's Caos Control starts collapsed.
- **Acciones & Reacciones merged** into one collapsible block.
- **Maestrías moved** next to Caos Control in a side-by-side row (replaces old bottom position).
- **New items auto-equipped**: arma, feat, caos, and armadura start as equipado=true on creation.
- **`rankClass` Handlebars helper**: maps rank strings to safe CSS class names (`S+` → `rank-splus`).

### Fixed
- Caos modifier text invisible on low-rank (F–C) badges — default color was white on a white background.
- Movement now scales correctly with Velocity rank: `10 × vel modifier + 30`, minimum 10 ft.
- `costoCaos` default was 10 (triggered section auto-detection on every new item); changed to 0.
- Equipado + tipo (category) shown on same header line in item sheet.
- Bonus input moved inline with rank selector in Características cells.
- Hover tooltip now shows área de efecto, dado libre, tarjeta cost, and caos cost chips.
- `roll-dado-libre` chat button handler added to forces.mjs.

## [0.2.0] — 2026-05-10

### Added
- **Roll dialog**: every dice roll now opens a Normal / Ventaja / Desventaja panel with optional bonus field, positioned near the cursor.
- **Saving Throw stat picker**: saving throw sections can now target a specific characteristic; a roll button appears in chat.
- **Long Rest button**: restores HP, Energía Caótica, and all item uses in one click.
- **Item uses in actor sheet**: remaining uses shown as a badge on each item row.
- **Restore-use button in chat**: disabled automatically when uses are already at max.
- **Floating item tooltip**: hovering over an item shows a fixed-position summary window near the cursor.
- **Section collapse per item section**: each section in the item sheet has its own ▾/▸ toggle.
- **Add section panel**: redesigned as a floating pill list above the footer strip.
- **Color picker theming**: the header color picker now propagates to tabs, section title borders, and content frame.
- **Item create auto-opens**: creating a new item immediately opens its edit sheet.
- **Per-category chat cards**: arma, caos, feat, tarjeta, consumible, armadura each get distinct header color.

### Fixed
- Caos Control section could not be deleted when `costoCaos` had a default value.
- Buff add button and use-tick buttons were expanding to full row width.
- Buff target dropdown collapsed to 0 px width.
- `color-mix()` incompatibility with Electron — replaced with `rgba` overlays.
- Section collapse button was on the item name header; moved to each individual section.
- `＋` add-section button overlapped Foundry's resize handle; moved to the left.
- Description section was always shown at the top; moved to bottom of section list.

## [0.1.0] — Initial release

- Actor sheet: 7 characteristics with rank picker (F→S), 14 skills with dot experticia, maestrías, HP/EC bars, anillos, movimiento badge, Caos badge.
- NPC sheet: characteristics and defenses only.
- Item sheet: categoria, description editor, secciones system (daño, hit, caos, saving throw, buffs, bonif. estadísticos, feat/clase, duración, rango, usos).
- Buff system: equip-time stat bonuses that scale by level or characteristic modifier.
- Caos Control panel with EC deduction on item use.
- Chat cards for item use with inline roll buttons.
- Spanish localization.
