# Forces — Sistema de Rol para FoundryVTT

> *Un sistema de rol basado en el universo de Sonic Forces, creado por **Makota**.*  
> Implementación para FoundryVTT por [nispeter2](https://github.com/nispeter2).

---

## Instalación

### Desde el navegador de sistemas de Foundry (recomendado)
1. Abre FoundryVTT → **Configuración** → **Sistemas** → **Instalar sistema**
2. Pega la URL del manifiesto:
   ```
   https://github.com/nispeter2/forces/releases/latest/download/system.json
   ```
3. Haz clic en **Instalar**.

### Manual
Descarga el archivo `forces.zip` desde la [última release](https://github.com/nispeter2/forces/releases/latest) y extráelo en:
```
<FoundryVTT Data>/systems/forces/
```

---

## Características del sistema

### Características (stats) — escala de rango F → S
Siete características principales evaluadas con letras de rango (F, E, D, C, B, A, S):

| Característica | Abrev. |
|---|---|
| Fuerza | Fr |
| Aguante | Ag |
| Velocidad | Vel |
| Técnica | Tec |
| Cognición | Cog |
| Carisma | Car |
| Instintos | Ins |
| Caos *(especial)* | Cao |

Cada rango genera un modificador automático usado en todas las tiradas de dados.

### Habilidades
14 habilidades agrupadas por característica base. Cada una tiene 3 niveles de experticia (puntos), sumados al modificador de su característica para dar el total de la tirada.

### Maestrías
Tres slots de maestría (S, A, B) en dos categorías — **Teóricas** y **Prácticas** — cada una vinculable a cualquier característica.

### Caos Control
Panel de poderes de caos con coste en Energía Caótica (EC). Los poderes de categoría *caos* gastan EC al usarse y permiten tirada de Caos Control.

### Objetos (sistema de secciones)
Cada objeto puede activar/desactivar secciones independientes:
- **Daño / Efecto** — dado y tipo de daño
- **Hit / Ataque** — bonus de impacto y número de ataques
- **Caos Control** — coste EC y si es reacción
- **Saving Throw** — stat, etiqueta y DC
- **Buffs al equipar** — bonificaciones escalables por nivel o stat
- **Bonif. Estadísticos** — DF, reacción, ataque, slots
- **Feat / Clase** — requisitos de nivel y clase
- **Duración** — texto libre
- **Rango** — en pies
- **Usos por descanso** — máx/actual con restauración en Long Rest
- **Descripción** — editor de texto enriquecido

### Tiradas estandarizadas
Toda tirada de dado abre un panel con:
- **Normal / Ventaja / Desventaja**
- Campo de **bonus adicional**

El panel aparece junto al cursor del ratón.

### Long Rest
Restaura HP, Energía Caótica y usos de todos los objetos de un solo clic.

### Ficha de NPC
Ficha simplificada con características, defensas y acciones. Sin habilidades ni maestrías.

### Chat cards
Al usar un objeto se publica una tarjeta en el chat con botones para tirar ataque, daño, Caos Control y Saving Throw directamente desde el chat.

### Hovering de objetos
Pasa el cursor sobre cualquier objeto en la ficha para ver un resumen flotante con stats, chips y descripción.

---

## Compatibilidad

| FoundryVTT | Estado |
|---|---|
| v11 | Mínimo |
| v12 | ✅ Verificado |
| v13 | Compatible |

---

## Créditos

- **Diseño del mundo y reglas**: Makota
- **Implementación FoundryVTT**: nispeter2

---

## Reportar problemas

Abre un [issue en GitHub](https://github.com/nispeter2/forces/issues) con una descripción del problema y los pasos para reproducirlo.

---

## Licencia

Este sistema es un proyecto de fan no comercial basado en el universo de Sonic the Hedgehog (SEGA). Uso exclusivamente privado/educativo.
