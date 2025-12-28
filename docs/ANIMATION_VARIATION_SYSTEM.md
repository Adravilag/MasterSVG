# Sistema de Animaciones y Variaciones Bezier

## Resumen

El sistema de animaciones y variaciones de Bezier Icons ha sido rediseñado para separar las definiciones de estilos del contenido SVG. En lugar de embeber estilos inline en los SVGs, ahora utilizamos:

1. **IDs en los SVGs** - Cada icono tiene un ID único
2. **animation.bz.js** - Controlador de animaciones generado en el build
3. **variation.bz.js** - Controlador de variaciones generado en el build
4. **bezier-icons.css** - Estilos CSS con keyframes y clases

## Sintaxis de Variantes de Animación

Las animaciones soportan **variantes** que modifican sus propiedades. La sintaxis es:

```
animation-name:variant1:variant2:variant3
```

### Ejemplo

```html
<!-- Animación base -->
<svg data-bz-animation="spin">...</svg>

<!-- Con variantes de velocidad y timing -->
<svg data-bz-animation="spin:slow:ease-in-out">...</svg>

<!-- Múltiples variantes combinadas -->
<svg data-bz-animation="pulse:fast:intense:once">...</svg>

<!-- Preset combinado -->
<svg data-bz-animation="bounce:energetic">...</svg>
```

## Categorías de Variantes

### 🏃 Speed (Velocidad)

| Variante | Multiplicador | Descripción |
|----------|---------------|-------------|
| `slower` | 3x | 3 veces más lento |
| `slow` | 2x | 2 veces más lento |
| `fast` | 0.5x | 2 veces más rápido |
| `faster` | 0.25x | 4 veces más rápido |

### ⏱️ Timing (Easing)

| Variante | Función | Descripción |
|----------|---------|-------------|
| `linear` | linear | Velocidad constante |
| `ease` | ease | Suave inicio y fin |
| `ease-in` | ease-in | Inicio lento, fin rápido |
| `ease-out` | ease-out | Inicio rápido, fin lento |
| `ease-in-out` | ease-in-out | Inicio y fin lentos |
| `bounce` | cubic-bezier(0.68, -0.55, 0.265, 1.55) | Efecto rebote |
| `elastic` | cubic-bezier(0.68, -0.6, 0.32, 1.6) | Efecto elástico |
| `snap` | cubic-bezier(0.5, 0, 0.1, 1) | Efecto snap |

### 🔄 Iteration (Repetición)

| Variante | Valor | Descripción |
|----------|-------|-------------|
| `once` | 1 | Una sola vez (con forwards) |
| `twice` | 2 | Dos veces |
| `thrice` | 3 | Tres veces |
| `loop` | infinite | Infinito |

### ↔️ Direction (Dirección)

| Variante | Valor | Descripción |
|----------|-------|-------------|
| `reverse` | reverse | Reproducir al revés |
| `alternate` | alternate | Alternar ida y vuelta |
| `alternate-reverse` | alternate-reverse | Alternar empezando al revés |

### ⏳ Delay (Retardo)

| Variante | Valor | Descripción |
|----------|-------|-------------|
| `delay-100` | 0.1s | 100ms de retardo |
| `delay-200` | 0.2s | 200ms de retardo |
| `delay-300` | 0.3s | 300ms de retardo |
| `delay-500` | 0.5s | 500ms de retardo |
| `delay-1000` | 1s | 1 segundo de retardo |

### 💪 Intensity (Intensidad)

| Variante | Escala | Descripción |
|----------|--------|-------------|
| `subtle` | 0.5x | Mitad de intensidad |
| `gentle` | 0.75x | 75% de intensidad |
| `intense` | 1.5x | 150% de intensidad |
| `extreme` | 2x | 200% de intensidad |

### 🎨 Presets (Combinaciones)

| Variante | Configuración | Descripción |
|----------|---------------|-------------|
| `smooth` | ease-in-out + 1.5x duración | Suave y lento |
| `snappy` | snap timing + 0.5x duración | Rápido y brusco |
| `lazy` | ease-out + 2.5x duración | Lento y perezoso |
| `energetic` | bounce + 0.6x + 1.3x intensidad | Rápido y enérgico |
| `dramatic` | ease-in + 1.8x + delay + 1.5x intensidad | Dramático |

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     Build Output                             │
├─────────────────────────────────────────────────────────────┤
│  animation.bz.js    │  variation.bz.js   │ bezier-icons.css │
│  ─────────────────  │  ────────────────  │ ──────────────── │
│  - Keyframes CSS    │  - Size configs    │ - @keyframes     │
│  - Animation defs   │  - Color palettes  │ - Utility classes│
│  - Icon mappings    │  - State variations│ - CSS variables  │
│  - Controller API   │  - Controller API  │ - Base styles    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Icon Elements                            │
├───────────────┬────────────────┬───────────────┬────────────┤
│  <svg>        │  <svg><use>    │  <img>        │ <bz-icon>  │
│  inline       │  sprite ref    │  external     │ web comp   │
│               │                │               │            │
│  id="icon-x"  │  href="#icon"  │  data-bz-*    │ name="x"   │
└───────────────┴────────────────┴───────────────┴────────────┘
```

## Uso

### SVG Inline

```html
<!-- El SVG tiene un ID, la animación se aplica via JS/CSS -->
<svg id="loading-spinner" data-bz-animation="spin">
  <circle cx="12" cy="12" r="10" />
</svg>
```

### SVG Sprite Reference

```html
<svg class="bz-icon bz-size-md bz-color-primary" data-bz-icon-id="arrow-right">
  <use href="sprite.svg#arrow-right"></use>
</svg>
```

### Imagen Externa

```html
<img src="icons/check.svg" 
     class="bz-icon bz-size-lg" 
     data-bz-icon-id="check"
     data-bz-animation="zoom-in">
```

### Web Component (bz-icon)

```html
<bz-icon 
  name="heart" 
  size="md" 
  color="error" 
  animation="heartbeat">
</bz-icon>
```

## API de animation.bz.js

```javascript
// Inicializar (auto-ejecutado)
BezierAnimations.init();

// Aplicar animación a elemento
BezierAnimations.apply(element, 'spin', {
  duration: 2,        // segundos
  timing: 'linear',   // ease, ease-in-out, etc.
  iteration: 'infinite',
  delay: 0
});

// Quitar animación
BezierAnimations.remove(element);

// Pausar/Reanudar
BezierAnimations.pause(element);
BezierAnimations.resume(element);

// Animación en hover
BezierAnimations.applyOnHover(element, 'pulse');

// Animación en click (una vez)
BezierAnimations.applyOnClick(element, 'tada');

// Obtener animación por nombre
const spinDef = BezierAnimations.getAnimation('spin');

// Listar todas las animaciones
const allAnimations = BezierAnimations.getAllAnimations();
```

## API de variation.bz.js

```javascript
// Inicializar (auto-ejecutado)
BezierVariations.init();

// Aplicar variaciones
BezierVariations.apply(element, {
  size: 'lg',       // xs, sm, md, lg, xl, 2xl, 3xl
  color: 'primary', // default, primary, secondary, success, etc.
  state: 'hover'    // default, hover, active, disabled, loading, etc.
});

// Cambiar estado
BezierVariations.setState(element, 'loading');
BezierVariations.setState(element, null); // reset

// Modificar CSS variables
BezierVariations.setCssVariable('--bz-color-primary', '#8b5cf6');

// Aplicar tema
BezierVariations.applyTheme('dark');
```

## Animaciones Disponibles

### Rotación
- `spin` - Rotación continua
- `spin-reverse` - Rotación inversa
- `spin-pulse` - Rotación con pulso
- `flip` - Volteo 3D eje Y
- `flip-x` - Volteo 3D eje X

### Escala
- `pulse` - Pulso suave con opacidad
- `pulse-grow` - Pulso solo escala
- `pulse-shrink` - Pulso de encogimiento
- `heartbeat` - Latido de corazón
- `rubber-band` - Efecto elástico

### Traslación
- `bounce` - Rebote vertical
- `bounce-horizontal` - Rebote horizontal
- `shake` - Sacudida horizontal
- `shake-vertical` - Sacudida vertical
- `float` - Flotación suave
- `swing` - Balanceo como péndulo

### Desvanecimiento
- `fade` - Pulso de opacidad
- `fade-in` - Aparecer
- `fade-out` - Desaparecer
- `blink` - Parpadeo

### Complejas
- `wobble` - Tambaleo con rotación
- `jello` - Efecto gelatina
- `tada` - Atención (tada!)

### Entrada/Salida
- `zoom-in` / `zoom-out`
- `slide-in-up` / `slide-in-down`
- `slide-in-left` / `slide-in-right`

### Efectos
- `glow` - Brillo pulsante
- `morph` - Transformación de forma

## Variaciones de Tamaño

| Token | Pixels | Stroke Width |
|-------|--------|--------------|
| xs    | 12px   | 1            |
| sm    | 16px   | 1.5          |
| md    | 24px   | 2            |
| lg    | 32px   | 2            |
| xl    | 48px   | 2.5          |
| 2xl   | 64px   | 3            |
| 3xl   | 96px   | 3            |

## Variaciones de Color

- `default` - currentColor (hereda)
- `primary` - Color principal (#3b82f6)
- `secondary` - Color secundario (#64748b)
- `success` - Verde (#22c55e)
- `warning` - Amarillo (#f59e0b)
- `error` - Rojo (#ef4444)
- `info` - Cyan (#06b6d4)
- `muted` - Gris atenuado
- `brand` - Color de marca
- `accent` - Color de acento

## Variaciones de Estado

- `default` - Estado normal
- `hover` - Escala 1.05
- `active` - Escala 0.95, opacidad 0.7
- `disabled` - Opacidad 0.4
- `focus` - Escala 1.02
- `selected` - Color primario
- `loading` - Opacidad 0.6 + animación pulse
- `error` - Color rojo + animación shake
- `success` - Color verde
- `warning` - Color amarillo

## Configuración del Build

```typescript
import { BezierBuildService } from './services/BezierBuildService';

const buildService = new BezierBuildService({
  outputDir: '.bezier/build',
  animation: {
    filename: 'animation.bz.js',
    includeKeyframes: true,
    includeController: true,
    minify: false,
    format: 'esm' // 'esm' | 'cjs' | 'iife'
  },
  variation: {
    filename: 'variation.bz.js',
    includeCssVariables: true,
    includeUtilityClasses: true,
    minify: false,
    format: 'esm'
  },
  generateTypes: true
});

// Ejecutar build
const result = await buildService.build('/path/to/workspace');
```

## Asignar Animaciones a Iconos

```typescript
import { AnimationService } from './services/AnimationService';

// Asignar animación por ID
AnimationService.assignAnimation('loading-icon', 'spin', {
  duration: 1.5,
  timing: 'linear'
});

// Preparar SVG para build (agrega ID y data-bz-animation)
const preparedSvg = AnimationService.prepareSvgForBuild(
  svgContent,
  'my-icon',
  'pulse'
);
```

## Ventajas del Nuevo Sistema

1. **Sin duplicación** - Las animaciones se definen una vez en animation.bz.js
2. **Consistencia** - Todos los iconos usan las mismas definiciones
3. **Rendimiento** - CSS Keyframes compartidos, no inline
4. **Flexibilidad** - Funciona con `<svg>`, `<img>`, sprites y web components
5. **Mantenibilidad** - Cambios centralizados en un solo lugar
6. **Cache-friendly** - Los archivos JS/CSS se cachean independientemente
7. **Tree-shaking** - Solo se incluyen las animaciones usadas
