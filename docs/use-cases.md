# 📚 Casos de Uso - Icon Manager

Esta guía presenta casos de uso prácticos para aprovechar al máximo la extensión Icon Manager en tu flujo de trabajo diario.

---

## 📋 Índice

1. [Gestión de Iconos en un Proyecto Nuevo](#1-gestión-de-iconos-en-un-proyecto-nuevo)
2. [Migrar Iconos Inline a Componentes](#2-migrar-iconos-inline-a-componentes)
3. [Optimizar SVGs para Producción](#3-optimizar-svgs-para-producción)
4. [Crear un Sistema de Iconos Consistente](#4-crear-un-sistema-de-iconos-consistente)
5. [Descargar y Localizar Imágenes Remotas](#5-descargar-y-localizar-imágenes-remotas)
6. [Convertir Imágenes a Formatos Modernos](#6-convertir-imágenes-a-formatos-modernos)
7. [Buscar e Integrar Iconos de Librerías](#7-buscar-e-integrar-iconos-de-librerías)
8. [Generar SVG Sprites](#8-generar-svg-sprites)
9. [Personalizar Colores de Iconos](#9-personalizar-colores-de-iconos)
10. [Documentar Licencias de Iconos](#10-documentar-licencias-de-iconos)
11. [Auditar Uso de Iconos en el Proyecto](#11-auditar-uso-de-iconos-en-el-proyecto)
12. [Trabajar con Múltiples Frameworks](#12-trabajar-con-múltiples-frameworks)
13. [Redimensionar y Optimizar Imágenes](#13-redimensionar-y-optimizar-imágenes)
14. [Previsualizar Iconos con Zoom](#14-previsualizar-iconos-con-zoom)
15. [Exportar Iconos como Componentes](#15-exportar-iconos-como-componentes)
16. [Gestionar Colecciones de Iconos](#16-gestionar-colecciones-de-iconos)
17. [Navegación Rápida entre Iconos y Usos](#17-navegación-rápida-entre-iconos-y-usos)
18. [Build de Iconos para Producción](#18-build-de-iconos-para-producción)
19. [Limpiar Iconos No Utilizados](#19-limpiar-iconos-no-utilizados)
20. [Integración con Icon Manager App](#20-integración-con-icon-manager-app)
21. [Exportar a React Native](#21-exportar-a-react-native)
22. [Usar Code Actions para SVGs](#22-usar-code-actions-para-svgs)
23. [Descargar SVGs desde el Panel](#23-descargar-svgs-desde-el-panel)
24. [Configurar Atributos Personalizados](#24-configurar-atributos-personalizados)
25. [Exportar a Frameworks Modernos (Solid, Qwik, Angular)](#25-exportar-a-frameworks-modernos-solid-qwik-angular)
26. [Buscar Iconos en Iconify](#26-buscar-iconos-en-iconify)
27. [Añadir Archivos SVG a la Colección](#27-añadir-archivos-svg-a-la-colección)
28. [Importar SVGs a la Librería Global](#28-importar-svgs-a-la-librería-global)
29. [Usar Variantes de Iconos](#29-usar-variantes-de-iconos)
30. [Animaciones de Iconos](#30-animaciones-de-iconos)
31. [Convertir Tags IMG a Componentes](#31-convertir-tags-img-a-componentes)
32. [Generar Sprite con Helper Component](#32-generar-sprite-con-helper-component)
33. [Watch Automático de Cambios en SVGs](#33-watch-automático-de-cambios-en-svgs)
34. [Generar Web Components](#34-generar-web-components)

---

## 1. Gestión de Iconos en un Proyecto Nuevo

### Escenario
Estás comenzando un nuevo proyecto y necesitas organizar todos los iconos SVG que usarás.

### Pasos

1. **Configura las carpetas de iconos**
   ```json
   // settings.json
   {
     "iconManager.svgFolders": [
       "src/assets/icons",
       "public/icons"
     ]
   }
   ```

2. **Escanea el workspace**
   - Abre la paleta de comandos (`Ctrl+Shift+P`)
   - Ejecuta: `Icon Manager: Scan Workspace SVGs`

3. **Abre el panel de iconos**
   - Comando: `Icon Manager: Open Panel`
   - Visualiza todos los iconos detectados
   - Usa el buscador para encontrar iconos específicos

4. **Inserta iconos en tu código**
   - Selecciona un icono del panel
   - Haz clic para insertarlo en el editor activo
   - El formato se ajustará según tu configuración

---

## 2. Migrar Iconos Inline a Componentes

### Escenario
Tienes SVGs inline en tu código y quieres convertirlos a componentes reutilizables de tu librería de iconos.

### Pasos

1. **Configura tu componente de iconos**
   ```json
   {
     "iconManager.componentName": "Icon",
     "iconManager.componentImport": "@/components/ui/Icon",
     "iconManager.iconNameAttribute": "name",
     "iconManager.autoImport": true
   }
   ```

2. **Selecciona el SVG inline**
   ```html
   <!-- Antes -->
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
     <path d="M12 2L2 7l10 5 10-5-10-5z"/>
   </svg>
   ```

3. **Transforma el SVG**
   - Selecciona todo el código SVG
   - Clic derecho → `Transform SVG to Icon Component`
   - O usa el comando: `Icon Manager: Transform SVG to Icon Component`

4. **Resultado**
   ```jsx
   // Se agrega automáticamente el import
   import { Icon } from '@/components/ui/Icon';
   
   // Tu código transformado
   <Icon name="layers" />
   ```

### Tip
Usa el Code Action (💡) que aparece automáticamente cuando detecta SVGs inline.

---

## 3. Optimizar SVGs para Producción

### Escenario
Tienes SVGs exportados de Figma/Illustrator con metadatos innecesarios que aumentan el tamaño.

### Pasos

1. **Optimización individual**
   - Abre un archivo SVG
   - Comando: `Icon Manager: Optimize SVG (SVGO)`
   - Elige el preset:
     - **Minimal**: Cambios conservadores, máxima compatibilidad
     - **Safe**: Balance entre optimización y seguridad
     - **Aggressive**: Máxima reducción de tamaño

2. **Optimización desde selección**
   - Selecciona código SVG en cualquier archivo
   - Ejecuta el comando de optimización
   - Copia el resultado o aplícalo directamente

3. **Ver estadísticas**
   - El panel muestra el porcentaje de ahorro
   - Compara antes/después en la vista previa

### Ejemplo de Reducción
```
Original:    2.4 KB
Optimizado:  0.8 KB
Ahorro:      67%
```

---

## 4. Crear un Sistema de Iconos Consistente

### Escenario
Quieres establecer un sistema de iconos uniforme para todo tu equipo.

### Pasos

1. **Define la estructura**
   ```
   src/
   └── assets/
       └── icons/
           ├── actions/
           │   ├── add.svg
           │   ├── delete.svg
           │   └── edit.svg
           ├── navigation/
           │   ├── arrow-left.svg
           │   └── menu.svg
           └── social/
               ├── github.svg
               └── twitter.svg
   ```

2. **Configura el proyecto**
   - Comando: `Icon Manager: Configure Project`
   - Define convenciones de nombres
   - Establece el formato de salida por defecto

3. **Exporta como componentes**
   - Selecciona iconos en el panel
   - Comando: `Icon Manager: Export as Component`
   - Elige el framework: React, Vue, Svelte, Astro

4. **Genera documentación**
   - El catálogo muestra todos los iconos disponibles
   - Comparte el panel con tu equipo como referencia visual

---

## 5. Descargar y Localizar Imágenes Remotas

### Escenario
Tu proyecto tiene imágenes referenciadas por URL y quieres servirlas localmente para mejor rendimiento.

### Pasos

1. **Escanear archivo por URLs**
   - Abre el archivo con referencias remotas
   - El panel detecta automáticamente:
     - `<img src="https://...">`
     - `background: url('https://...')`
     - `![alt](https://...)`

2. **Descargar individualmente**
   - Pega una URL de imagen
   - Elige la carpeta de destino
   - Opcionalmente convierte a WebP

3. **Descarga masiva**
   - Selecciona todas las URLs detectadas
   - Descarga en lote
   - Las referencias se actualizan automáticamente

### Antes
```html
<img src="https://example.com/hero-image.png" />
```

### Después
```html
<img src="/assets/images/hero-image.webp" />
```

---

## 6. Convertir Imágenes a Formatos Modernos

### Escenario
Quieres migrar tus imágenes PNG/JPG a WebP o AVIF para mejor compresión.

### Pasos

1. **Configurar calidad**
   ```json
   {
     "assetManager.image.quality": 85,
     "assetManager.image.defaultFormat": "webp"
   }
   ```

2. **Conversión individual**
   - Clic derecho en una imagen
   - Selecciona `Convert to WebP` o `Convert to AVIF`

3. **Conversión masiva**
   - Abre el panel de Asset Manager
   - Selecciona múltiples imágenes
   - Usa `Batch Convert` para procesar todas

4. **Ver estadísticas**
   - Revisa el ahorro total en el panel
   - Compara tamaños por formato

### Comparativa de Formatos
| Formato | Soporte | Compresión | Uso Recomendado |
|---------|---------|------------|-----------------|
| WebP    | 97%+    | Muy buena  | General         |
| AVIF    | 90%+    | Excelente  | Fotos/Fondos    |
| PNG     | 100%    | Sin pérdida| Iconos/Logos    |

---

## 7. Buscar e Integrar Iconos de Librerías

### Escenario
Necesitas un icono específico y quieres buscarlo en librerías populares como Iconify.

### Pasos

1. **Abre el catálogo**
   - Comando: `Icon Manager: Browse Icon Catalog`

2. **Busca iconos**
   - Usa el buscador para encontrar por nombre
   - Filtra por colección (Material, Feather, Heroicons, etc.)
   - Previsualiza en diferentes tamaños

3. **Integra el icono**
   - Selecciona el icono deseado
   - Elige el formato de salida
   - Inserta directamente o copia el código

4. **Añade a tu colección**
   - Guarda iconos favoritos
   - Crea colecciones personalizadas

---

## 8. Generar SVG Sprites

### Escenario
Quieres combinar múltiples iconos en un sprite SVG para reducir peticiones HTTP.

### Pasos

1. **Selecciona iconos**
   - En el panel, selecciona los iconos a incluir
   - O marca una carpeta completa

2. **Genera el sprite**
   - Comando: `Icon Manager: Generate SVG Sprite`
   - Elige la carpeta de salida

3. **Resultado**
   ```html
   <!-- sprite.svg -->
   <svg xmlns="http://www.w3.org/2000/svg">
     <symbol id="icon-add" viewBox="0 0 24 24">...</symbol>
     <symbol id="icon-delete" viewBox="0 0 24 24">...</symbol>
     <symbol id="icon-edit" viewBox="0 0 24 24">...</symbol>
   </svg>
   ```

4. **Uso en HTML**
   ```html
   <svg class="icon">
     <use href="/sprites/icons.svg#icon-add"></use>
   </svg>
   ```

---

## 9. Personalizar Colores de Iconos

### Escenario
Necesitas adaptar los colores de un icono a tu paleta de diseño.

### Pasos

1. **Abre el editor de iconos**
   - Selecciona un icono en el panel
   - Comando: `Edit Icon` o haz clic en el icono de edición

2. **Usa el Color Picker**
   - Visualiza todos los colores del SVG
   - Haz clic en cualquier color para editarlo
   - Los cambios se previsualizan en tiempo real

3. **Aplica cambios**
   - Guarda los cambios en el archivo
   - O copia el SVG modificado

### Tip
Para iconos monocromáticos, usa `currentColor` para heredar el color del CSS padre:
```svg
<svg fill="currentColor">...</svg>
```

---

## 10. Documentar Licencias de Iconos

### Escenario
Necesitas cumplir con los requisitos de atribución de las librerías de iconos que usas.

### Pasos

1. **Genera archivo de licencias**
   - Comando: `Icon Manager: Generate License Files`

2. **Revisa el resultado**
   - Se crea un archivo con todas las licencias
   - Incluye atribución por cada colección usada

3. **Incluye en tu proyecto**
   - Añade el archivo a tu documentación
   - Referencia en el footer o página de créditos

---

## 11. Auditar Uso de Iconos en el Proyecto

### Escenario
Quieres saber qué iconos se están usando realmente en tu código y cuáles no.

### Pasos

1. **Escanea los usos**
   - Comando: `Icon Manager: Scan Icon Usages`
   - O haz clic en el icono de referencias en el panel

2. **Revisa el reporte**
   - Iconos usados vs disponibles
   - Ubicación de cada uso
   - Iconos huérfanos (sin usar)

3. **Navega a los usos**
   - Haz clic en cualquier uso para ir directamente al código
   - Revisa el contexto de cada referencia

### Beneficios
- Identifica iconos que puedes eliminar
- Encuentra usos duplicados
- Asegura consistencia en el naming

---

## 12. Trabajar con Múltiples Frameworks

### Escenario
Tu proyecto usa diferentes frameworks o necesitas generar componentes para varios targets.

### Configuración por Framework

**React/JSX**
```json
{
  "iconManager.outputFormat": "jsx",
  "iconManager.componentName": "Icon",
  "iconManager.componentImport": "@/components/Icon"
}
```

**Vue**
```json
{
  "iconManager.outputFormat": "vue",
  "iconManager.componentName": "BaseIcon",
  "iconManager.componentImport": "@/components/BaseIcon.vue"
}
```

**Svelte**
```json
{
  "iconManager.outputFormat": "svelte",
  "iconManager.componentName": "Icon",
  "iconManager.componentImport": "$lib/components/Icon.svelte"
}
```

**Astro**
```json
{
  "iconManager.outputFormat": "astro",
  "iconManager.componentName": "Icon",
  "iconManager.componentImport": "@/components/Icon.astro"
}
```

**HTML (Iconify)**
```json
{
  "iconManager.outputFormat": "html"
}
```

### Resultados por Framework

| Framework | Salida |
|-----------|--------|
| React     | `<Icon name="arrow" />` |
| Vue       | `<BaseIcon name="arrow" />` |
| Svelte    | `<Icon name="arrow" />` |
| Astro     | `<Icon name="arrow" />` |
| HTML      | `<iconify-icon icon="arrow"></iconify-icon>` |

---

## 13. Redimensionar y Optimizar Imágenes

### Escenario
Necesitas preparar imágenes para diferentes breakpoints o reducir su tamaño.

### Pasos para Redimensionar

1. **Selecciona la imagen**
   - Clic derecho en la imagen en el explorador
   - O usa el panel de Asset Manager

2. **Ejecuta el comando**
   - `Asset Manager: Resize Image`

3. **Especifica dimensiones**
   - Ancho y/o alto en píxeles
   - Mantener aspecto ratio automáticamente

### Optimización en Lote

1. **Escanea el workspace**
   - Comando: `Asset Manager: Scan Workspace Images`

2. **Optimiza todas**
   - Comando: `Asset Manager: Batch Optimize Images`
   - Configura la calidad deseada

3. **Ver estadísticas**
   - Comando: `Asset Manager: Show Image Statistics`
   - Revisa el ahorro total

### Configuración Recomendada
```json
{
  "assetManager.image.quality": 85,
  "assetManager.image.lossless": false,
  "assetManager.image.deleteOriginalOnConvert": false
}
```

---

## 14. Previsualizar Iconos con Zoom

### Escenario
Necesitas revisar los detalles de un icono a diferentes tamaños.

### Pasos

1. **Abre el panel de detalles**
   - Selecciona un icono
   - Comando: `Show Details`

2. **Usa los controles de zoom**
   - 50% - Vista miniatura
   - 75% - Vista reducida
   - 100% - Tamaño original
   - 150% - Vista ampliada
   - 200% - Vista detalle

3. **Revisa el icono**
   - Verifica que se vea bien en todos los tamaños
   - Detecta problemas de rendering
   - Comprueba la nitidez de los trazos

### Tip
Usa zoom 200% para verificar que los iconos se vean bien en pantallas retina/HiDPI.

---

## 15. Exportar Iconos como Componentes

### Escenario
Quieres generar archivos de componente individuales para cada icono.

### Pasos

1. **Selecciona el icono**
   - En el panel de Workspace SVGs
   - Clic derecho → `Export as Component`

2. **Elige el formato**
   - React Component (.tsx)
   - Vue Component (.vue)
   - Svelte Component (.svelte)
   - Astro Component (.astro)

3. **Selecciona destino**
   - Elige la carpeta de salida
   - El archivo se nombra automáticamente

### Ejemplo de Salida (React)
```tsx
// ArrowIcon.tsx
import React from 'react';

interface ArrowIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export const ArrowIcon: React.FC<ArrowIconProps> = ({ 
  size = 24, 
  ...props 
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M12 4l-8 8h16l-8-8z" fill="currentColor" />
  </svg>
);
```

---

## 16. Gestionar Colecciones de Iconos

### Escenario
Quieres organizar iconos en colecciones temáticas para tu proyecto.

### Pasos

1. **Añade iconos a una colección**
   - Selecciona un icono en el panel
   - Clic derecho → `Add to Icon Collection`
   - O usa el icono ➕ en el menú contextual

2. **Organiza por categorías**
   - Crea colecciones: "Navigation", "Actions", "Social", etc.
   - Mueve iconos entre colecciones

3. **Exporta colecciones**
   - Genera sprites por colección
   - Exporta componentes agrupados

### Estructura Sugerida
```
collections/
├── navigation/
│   ├── arrow-left.svg
│   ├── arrow-right.svg
│   └── menu.svg
├── actions/
│   ├── add.svg
│   ├── delete.svg
│   └── edit.svg
└── social/
    ├── github.svg
    └── twitter.svg
```

---

## 17. Navegación Rápida entre Iconos y Usos

### Escenario
Estás revisando código y quieres saltar rápidamente al archivo SVG o viceversa.

### Desde el Código al SVG

1. **Hover Preview**
   - Pasa el cursor sobre `<Icon name="arrow" />`
   - Ve la previsualización del icono

2. **Go to Definition**
   - `Ctrl+Click` en el nombre del icono
   - Salta directamente al archivo SVG

3. **Comando Preview**
   - `Icon Manager: Preview Icon at Cursor`
   - Abre el panel de detalles

### Desde el SVG al Código

1. **Scan Usages**
   - En el panel, el icono muestra contador de usos
   - Haz clic para ver todas las referencias

2. **Go to Usage**
   - Clic derecho → `Go to Usage`
   - Navega entre las ocurrencias

### Atajos Útiles
| Acción | Atajo |
|--------|-------|
| Go to Definition | `Ctrl+Click` / `F12` |
| Find All References | `Shift+F12` |
| Peek Definition | `Alt+F12` |

---

## 18. Build de Iconos para Producción

### Escenario
Necesitas generar archivos optimizados para producción.

### Configuración

```json
{
  "iconManager.outputDirectory": "src/generated",
  "iconManager.outputFormat": "both"  // "icons.ts", "sprite.svg", o "both"
}
```

### Pasos

1. **Configura el output**
   - Define el directorio de salida
   - Elige el formato (TypeScript, Sprite, o ambos)

2. **Ejecuta el build**
   - Comando: `Icon Manager: Build Icons`
   - Se generan los archivos optimizados

3. **Resultado**

**icons.ts**
```typescript
export const icons = {
  'arrow-left': '<svg>...</svg>',
  'arrow-right': '<svg>...</svg>',
  'menu': '<svg>...</svg>',
} as const;

export type IconName = keyof typeof icons;
```

**sprite.svg**
```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="arrow-left">...</symbol>
  <symbol id="arrow-right">...</symbol>
  <symbol id="menu">...</symbol>
</svg>
```

---

## 19. Limpiar Iconos No Utilizados

### Escenario
Tu proyecto ha crecido y tienes muchos iconos que ya no usas.

### Pasos

1. **Escanea usos**
   - Comando: `Icon Manager: Scan Icon Usages`
   - Identifica iconos sin referencias

2. **Revisa los candidatos**
   - El panel muestra iconos con 0 usos
   - Verifica que realmente no se necesitan

3. **Elimina los iconos**
   - Selecciona los iconos a eliminar
   - Clic derecho → `Delete Icon(s)`
   - Confirma la eliminación

### Precauciones
- Algunos iconos pueden cargarse dinámicamente
- Revisa imports con variables o template strings
- Considera iconos usados solo en producción

### Configuración de Exclusión
```json
{
  "assetManager.image.excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**"
  ]
}
```

---

## 20. Integración con Icon Manager App

### Escenario
Usas la aplicación Icon Manager de escritorio/web y quieres sincronizar con VS Code.

### Configuración

```json
{
  "iconManager.libraryPath": "./icons.json"
}
```

### Flujo de Trabajo

1. **Gestiona en la App**
   - Descarga iconos de diferentes fuentes
   - Organiza colecciones
   - Exporta `icons.json`

2. **Sincroniza con VS Code**
   - La extensión detecta el archivo `icons.json`
   - Los iconos aparecen en el panel
   - IntelliSense incluye los iconos de la librería

3. **Usa en el código**
   - Autocomplete muestra todos los iconos
   - Previsualización al hover
   - Navegación integrada

### Beneficios
- Única fuente de verdad
- Mismo naming en toda la organización
- Sincronización automática

---

## 21. Exportar a React Native

### Escenario
Desarrollas una app móvil con React Native y necesitas usar los mismos iconos del proyecto web.

### Pasos

1. **Selecciona el icono**
   - En el panel de Workspace SVGs
   - Clic derecho → `Export as Component`

2. **Elige React Native**
   - Selecciona "React Native" como formato
   - Configura si deseas TypeScript

3. **Resultado**
   ```tsx
   // ArrowIcon.tsx
   import React from 'react';
   import Svg, { Path } from 'react-native-svg';
   
   interface ArrowIconProps {
     size?: number;
     color?: string;
   }
   
   export const ArrowIcon: React.FC<ArrowIconProps> = ({
     size = 24,
     color = 'currentColor',
     ...props
   }) => (
     <Svg
       width={size}
       height={size}
       viewBox="0 0 24 24"
       fill="none"
       {...props}
     >
       <Path d="M12 4l-8 8h16l-8-8z" fill={color} />
     </Svg>
   );
   ```

### Dependencias Requeridas
```bash
npm install react-native-svg
```

---

## 22. Usar Code Actions para SVGs

### Escenario
Quieres una forma rápida de transformar SVGs mientras editas código.

### Cómo Funciona

1. **Detecta SVGs automáticamente**
   - La extensión detecta SVGs inline en tu código
   - Aparece el icono 💡 (Code Action) junto al SVG

2. **Aplica la acción**
   - Haz clic en el 💡 o usa `Ctrl+.`
   - Selecciona "Transform SVG to Icon Component"

3. **Transformación instantánea**
   - El SVG se reemplaza por el componente
   - Se añade el import automáticamente

### Ejemplo Visual
```html
<!-- Cursor aquí muestra 💡 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12 2L2 7l10 5..."/>
</svg>
```

↓ Después de aplicar Code Action

```jsx
import { Icon } from '@/components/ui/Icon';

<Icon name="layers" />
```

### Otros Code Actions Disponibles
- **Optimize SVG** - Optimizar con SVGO
- **Preview Icon** - Ver previsualización
- **Add to Collection** - Añadir a una colección

---

## 23. Descargar SVGs desde el Panel

### Escenario
Necesitas exportar un icono como archivo SVG independiente.

### Pasos

1. **Selecciona el icono**
   - En el panel de Workspace SVGs
   - O en el panel de Preview

2. **Descarga el SVG**
   - Haz clic en el botón de descarga (📥)
   - O clic derecho → `Download SVG`

3. **Opciones de descarga**
   - SVG original
   - SVG optimizado
   - Con colores modificados (si editaste)

### Desde el Panel de Preview
El panel lateral incluye una barra de herramientas con:
- 📥 **Download** - Descargar el SVG
- 📋 **Copy** - Copiar al portapapeles
- ✏️ **Edit** - Abrir editor de colores
- 🚀 **Optimize** - Optimizar con SVGO

---

## 24. Configurar Atributos Personalizados

### Escenario
Tu componente de iconos usa atributos diferentes a los estándar.

### Configuración

```json
{
  // Nombre del atributo para el identificador del icono
  "iconManager.iconNameAttribute": "icon",
  
  // Nombre del componente
  "iconManager.componentName": "SvgIcon",
  
  // Path de import
  "iconManager.componentImport": "@acme/ui/SvgIcon"
}
```

### Ejemplos de Configuración

**Configuración por defecto:**
```jsx
<Icon name="arrow" />
```

**Con `iconNameAttribute: "icon"`:**
```jsx
<SvgIcon icon="arrow" />
```

**Con `iconNameAttribute: "src"`:**
```jsx
<Icon src="arrow" />
```

**Para Iconify:**
```jsx
<iconify-icon icon="mdi:arrow" />
```

### Formatos Soportados por Atributo
| Atributo | Uso Común |
|----------|-----------|
| `name` | React, Vue, Svelte |
| `icon` | Iconify, custom |
| `src` | Algunas librerías |
| `type` | Icon systems legacy |

---

## 25. Exportar a Frameworks Modernos (Solid, Qwik, Angular)

### Escenario
Tu proyecto usa un framework moderno y necesitas componentes nativos.

### SolidJS

```tsx
// ArrowIcon.tsx
import { Component, JSX, splitProps } from 'solid-js';

interface ArrowIconProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ArrowIcon: Component<ArrowIconProps> = (props) => {
  const [local, others] = splitProps(props, ['size', 'color']);
  
  return (
    <svg
      width={local.size ?? 24}
      height={local.size ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      {...others}
    >
      <path d="M12 4l-8 8h16l-8-8z" fill={local.color ?? 'currentColor'} />
    </svg>
  );
};
```

### Qwik

```tsx
// ArrowIcon.tsx
import { component$, QwikIntrinsicElements } from '@builder.io/qwik';

interface ArrowIconProps {
  size?: number | string;
  color?: string;
}

export const ArrowIcon = component$<ArrowIconProps>((props) => {
  const { size = 24, color = 'currentColor' } = props;
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path d="M12 4l-8 8h16l-8-8z" fill={color} />
    </svg>
  );
});
```

### Angular

```typescript
// arrow-icon.component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-arrow-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path d="M12 4l-8 8h16l-8-8z" [attr.fill]="color" />
    </svg>
  `
})
export class ArrowIconComponent {
  @Input() size: number | string = 24;
  @Input() color: string = 'currentColor';
}
```

### Pasos para Exportar

1. **Selecciona el icono** en el panel
2. **Clic derecho** → `Export as Component`
3. **Elige el framework**:
   - SolidJS
   - Qwik
   - Angular
4. **Selecciona opciones**:
   - TypeScript / JavaScript
   - Export named / default

---

## 26. Buscar Iconos en Iconify

### Escenario
Necesitas encontrar iconos específicos de las más de 150,000 opciones disponibles en Iconify.

### Pasos

1. **Abre la búsqueda**
   - Comando: `Icon Manager: Search Icons (Iconify)`
   - O haz clic en el icono 🔍 en el panel

2. **Busca por palabra clave**
   - Escribe: "arrow", "user", "settings", etc.
   - Los resultados se muestran con preview

3. **Filtra por colección**
   - Material Design Icons
   - Heroicons
   - Feather Icons
   - Phosphor Icons
   - Y muchas más...

4. **Inserta el icono**
   - Selecciona el icono deseado
   - Se inserta automáticamente en tu código
   - Se añade al build si está configurado

### Ejemplo
```
Búsqueda: "home"
Resultados:
  - mdi:home (Material Design)
  - heroicons:home (Heroicons)
  - feather:home (Feather)
  - ph:house (Phosphor)
```

---

## 27. Añadir Archivos SVG a la Colección

### Escenario
Tienes archivos SVG en tu proyecto y quieres añadirlos al sistema de iconos centralizado.

### Pasos

1. **Localiza el archivo SVG**
   - En el panel de Workspace SVGs
   - Aparecen bajo "SVG Files"

2. **Añade a la colección**
   - Clic derecho → `Add to Icon Collection`
   - O usa el icono ➕

3. **Configura el nombre**
   - Confirma o modifica el nombre del icono
   - Se convierte automáticamente a kebab-case

4. **Opciones post-importación**
   - Mantener el archivo original
   - Eliminar el archivo SVG fuente

### Resultado
El icono se añade a `icons.js` y/o `sprite.svg` según tu configuración.

```javascript
// icons.js (generado)
export const home = {
  name: 'home',
  body: `<path d="..."/>`,
  viewBox: '0 0 24 24'
};
```

---

## 28. Importar SVGs a la Librería Global

### Escenario
Quieres que ciertos iconos estén disponibles en todos tus proyectos.

### Pasos

1. **Detecta una referencia SVG**
   - Code Action detecta `<img src="icon.svg">`
   - Ofrece "Import to Library"

2. **Importa el icono**
   - El SVG se copia a la librería global
   - Ubicación: `%APPDATA%/icon-manager/icons.json`

3. **Usa en cualquier proyecto**
   - El icono aparece en el panel
   - Disponible en IntelliSense

### Librería Global vs Local
| Tipo | Ubicación | Uso |
|------|-----------|-----|
| Global | `%APPDATA%/icon-manager/` | Todos los proyectos |
| Local | `icons.json` en workspace | Solo este proyecto |

---

## 29. Usar Variantes de Iconos

### Escenario
Quieres tener diferentes versiones de color para el mismo icono.

### Configuración de Variantes

El archivo `variants.js` se genera automáticamente:

```javascript
// variants.js
export const defaultVariants = {
  'arrow': 'primary'
};

export const Variants = {
  'arrow': {
    'primary': ['#3B82F6'],
    'success': ['#10B981'],
    'danger': ['#EF4444'],
    'neutral': ['#6B7280']
  }
};
```

### Uso en el Código

```jsx
// Usa la variante por defecto
<Icon name="arrow" />

// Especifica una variante
<Icon name="arrow" variant="success" />
<Icon name="arrow" variant="danger" />
```

### IntelliSense para Variantes

Al escribir `variant="`, obtienes autocomplete con las variantes disponibles para ese icono específico.

---

## 30. Animaciones de Iconos

### Escenario
Quieres añadir animaciones predefinidas a tus iconos.

### Configuración

El archivo `animations.js` se genera automáticamente:

```javascript
// animations.js
export const animations = {
  'loading': 'spin',
  'notification': 'pulse',
  'warning': 'shake'
};
```

### Animaciones Disponibles

| Animación | Descripción | Uso típico |
|-----------|-------------|------------|
| `spin` | Rotación continua 360° | Loading, refresh |
| `pulse` | Escala con opacidad | Notificaciones |
| `bounce` | Movimiento vertical | Llamar atención |
| `shake` | Movimiento horizontal | Errores, alertas |
| `fade` | Aparecer/desaparecer | Transiciones |

### Uso

```jsx
// Animación configurada por defecto
<Icon name="loading" />

// Animación explícita
<Icon name="settings" animation="spin" />

// Sin animación
<Icon name="loading" animation="none" />
```

### IntelliSense

Al escribir `animation="`, aparece autocomplete con todas las animaciones disponibles.

---

## 31. Convertir Tags IMG a Componentes

### Escenario
Tu código tiene referencias a SVGs con `<img src="icon.svg">` y quieres convertirlas a componentes.

### Detección Automática

La extensión detecta automáticamente:

```html
<!-- Detectado -->
<img src="./icons/arrow.svg" alt="Arrow" />
<img src={ArrowIcon} />
background: url('./icons/arrow.svg');
import arrow from './icons/arrow.svg';
```

### Code Actions Disponibles

Cuando el cursor está sobre una referencia SVG:

1. **💡 Transform to Icon Component**
   - Convierte a `<Icon name="arrow" />`
   
2. **💡 Import SVG to Library**
   - Añade el SVG a tu colección

### Diagnósticos

La extensión muestra advertencias (wave amarilla) en referencias a SVGs que podrían convertirse a componentes.

```html
<!-- ⚠️ Consider using Icon component -->
<img src="./icons/arrow.svg" />
```

---

## 32. Generar Sprite con Helper Component

### Escenario
Quieres generar un sprite SVG junto con un componente helper para usarlo fácilmente.

### Pasos

1. **Ejecuta el comando**
   - `Icon Manager: Generate SVG Sprite`

2. **Elige el formato del helper**
   - React
   - Vue
   - Svelte
   - Vanilla JS

3. **Archivos generados**

**sprite.svg**
```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="arrow" viewBox="0 0 24 24">...</symbol>
  <symbol id="home" viewBox="0 0 24 24">...</symbol>
</svg>
```

**sprite.types.ts**
```typescript
export type IconName = 'arrow' | 'home' | 'settings';
export const iconNames = ['arrow', 'home', 'settings'] as const;
```

**Icon.tsx** (React helper)
```tsx
interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, className }) => (
  <svg width={size} height={size} className={className}>
    <use href={`/sprite.svg#${name}`} />
  </svg>
);
```

---

## 33. Watch Automático de Cambios en SVGs

### Escenario
Quieres que los iconos se actualicen automáticamente cuando modificas archivos SVG.

### Funcionamiento

La extensión observa automáticamente cambios en archivos `.svg`:

- **Crear** - Se añade al panel
- **Modificar** - Se actualiza la preview
- **Eliminar** - Se remueve del panel

### Configuración

No requiere configuración adicional. El watcher se activa automáticamente.

### Flujo de Trabajo

1. Diseñador actualiza `arrow.svg` en Figma
2. Exporta y reemplaza el archivo
3. VS Code detecta el cambio
4. El panel se actualiza automáticamente
5. IntelliSense refleja los cambios

### Tip

Para forzar un refresh manual:
- Comando: `Icon Manager: Refresh Icons`
- O haz clic en el icono 🔄 del panel

---

## 34. Generar Web Components

### Escenario
Quieres usar tus iconos como Web Components nativos sin dependencia de framework.

### Build Automático

Al ejecutar `Icon Manager: Build Icons` se genera:

**sg-icon.js** (Web Component)
```javascript
class SgIcon extends HTMLElement {
  static get observedAttributes() {
    return ['name', 'size', 'color', 'variant', 'animation'];
  }
  
  // ... implementación completa
}

customElements.define('sg-icon', SgIcon);
```

### Uso en HTML

```html
<script src="icons/sg-icon.js"></script>

<!-- Uso básico -->
<sg-icon name="arrow"></sg-icon>

<!-- Con propiedades -->
<sg-icon name="home" size="32" color="#3B82F6"></sg-icon>

<!-- Con variante -->
<sg-icon name="alert" variant="danger"></sg-icon>

<!-- Con animación -->
<sg-icon name="loading" animation="spin"></sg-icon>
```

### Beneficios

- Sin dependencias de framework
- Funciona en cualquier HTML
- Soporte completo de variantes y animaciones
- TypeScript types incluidos

---

## 💡 Tips Adicionales

### Atajos de Teclado Recomendados
Configura atajos para las acciones más frecuentes:
```json
{
  "key": "ctrl+shift+i",
  "command": "iconManager.openPanel"
},
{
  "key": "ctrl+alt+t",
  "command": "iconManager.transformSvgToIcon"
}
```

### IntelliSense
- **Autocomplete**: Escribe el nombre del componente y obtén sugerencias de iconos
- **Hover**: Pasa el cursor sobre un nombre de icono para ver la previsualización
- **Go to Definition**: `Ctrl+Click` en un nombre de icono para ir al archivo SVG

### Integración con el Workflow
1. Diseñador exporta SVGs desde Figma
2. Desarrollador importa al proyecto
3. Icon Manager optimiza automáticamente
4. Se transforman a componentes
5. Se generan sprites para producción

---

## 🔗 Recursos Relacionados

- [README Principal](../README.md)
- [Configuración Avanzada](./configuration.md)
- [API de Comandos](./commands.md)
- [Contribuir](../CONTRIBUTING.md)
