# Changelog

All notable changes to the Forces system are documented here.

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
