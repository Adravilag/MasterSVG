# 📋 Requisitos Funcionales - Icon Manager

Este documento define los requisitos funcionales de la extensión Icon Manager para VS Code.

---

## Índice

1. [Gestión de SVGs](#1-gestión-de-svgs)
2. [Transformación de SVGs](#2-transformación-de-svgs)
3. [Optimización](#3-optimización)
4. [IntelliSense](#4-intellisense)
5. [Panel y UI](#5-panel-y-ui)
6. [Build y Generación](#6-build-y-generación)
7. [Catálogo e Iconify](#7-catálogo-e-iconify)
8. [Gestión de Imágenes](#8-gestión-de-imágenes)
9. [Configuración](#9-configuración)

---

## 1. Gestión de SVGs

### RF-1.1: Escaneo de Workspace
| Campo | Valor |
|-------|-------|
| **ID** | RF-1.1 |
| **Nombre** | Escaneo automático de SVGs en workspace |
| **Descripción** | El sistema debe escanear automáticamente las carpetas configuradas para detectar archivos SVG |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-1, UC-4 |

**Criterios de Aceptación:**
- [ ] CA-1.1.1: Escanea carpetas definidas en `iconManager.svgFolders`
- [ ] CA-1.1.2: Detecta archivos con extensión `.svg`
- [ ] CA-1.1.3: Excluye carpetas según patrones de exclusión
- [ ] CA-1.1.4: Se ejecuta al abrir el workspace
- [ ] CA-1.1.5: Actualiza el árbol de iconos tras el escaneo

---

### RF-1.2: Detección de SVGs Inline
| Campo | Valor |
|-------|-------|
| **ID** | RF-1.2 |
| **Nombre** | Detección de SVGs inline en código |
| **Descripción** | El sistema debe detectar código SVG inline en archivos del proyecto |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-2, UC-11 |

**Criterios de Aceptación:**
- [ ] CA-1.2.1: Detecta `<svg>...</svg>` en archivos HTML, JSX, TSX, Vue, Svelte, Astro
- [ ] CA-1.2.2: Extrae nombre del icono de atributos `id` o `title`
- [ ] CA-1.2.3: Registra ubicación (archivo, línea, columna)
- [ ] CA-1.2.4: Muestra en el panel como "Inline SVGs"

---

### RF-1.3: Watch de Cambios en SVGs
| Campo | Valor |
|-------|-------|
| **ID** | RF-1.3 |
| **Nombre** | Observador de cambios en archivos SVG |
| **Descripción** | El sistema debe detectar automáticamente cambios en archivos SVG |
| **Prioridad** | Media |
| **Casos de Uso** | UC-33 |

**Criterios de Aceptación:**
- [ ] CA-1.3.1: Detecta creación de nuevos archivos SVG
- [ ] CA-1.3.2: Detecta modificación de archivos SVG existentes
- [ ] CA-1.3.3: Detecta eliminación de archivos SVG
- [ ] CA-1.3.4: Actualiza el panel automáticamente

---

### RF-1.4: Escaneo de Usos de Iconos
| Campo | Valor |
|-------|-------|
| **ID** | RF-1.4 |
| **Nombre** | Escaneo de referencias a iconos en código |
| **Descripción** | El sistema debe encontrar todas las referencias a iconos en el código fuente |
| **Prioridad** | Media |
| **Casos de Uso** | UC-11, UC-17, UC-19 |

**Criterios de Aceptación:**
- [ ] CA-1.4.1: Detecta `<Icon name="..." />`
- [ ] CA-1.4.2: Detecta `<iconify-icon icon="..." />`
- [ ] CA-1.4.3: Cuenta número de usos por icono
- [ ] CA-1.4.4: Permite navegar a cada uso

---

### RF-1.5: Eliminación de Iconos
| Campo | Valor |
|-------|-------|
| **ID** | RF-1.5 |
| **Nombre** | Eliminar iconos del proyecto |
| **Descripción** | El sistema debe permitir eliminar iconos de la colección |
| **Prioridad** | Media |
| **Casos de Uso** | UC-19 |

**Criterios de Aceptación:**
- [ ] CA-1.5.1: Permite selección múltiple de iconos
- [ ] CA-1.5.2: Solicita confirmación antes de eliminar
- [ ] CA-1.5.3: Elimina del archivo `icons.js`
- [ ] CA-1.5.4: Actualiza el panel tras eliminar

---

## 2. Transformación de SVGs

### RF-2.1: Transformar SVG a Componente
| Campo | Valor |
|-------|-------|
| **ID** | RF-2.1 |
| **Nombre** | Transformar SVG inline a componente Icon |
| **Descripción** | El sistema debe convertir código SVG a componente de icono configurable |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-2, UC-12 |

**Criterios de Aceptación:**
- [ ] CA-2.1.1: Transforma SVG seleccionado en editor
- [ ] CA-2.1.2: Genera `<ComponentName nameAttr="iconName" />`
- [ ] CA-2.1.3: Soporta formatos: JSX, Vue, Svelte, Astro, HTML
- [ ] CA-2.1.4: Solicita nombre del icono si no se detecta

---

### RF-2.2: Auto-Import de Componente
| Campo | Valor |
|-------|-------|
| **ID** | RF-2.2 |
| **Nombre** | Añadir import automático del componente Icon |
| **Descripción** | El sistema debe añadir la declaración import si está configurado |
| **Prioridad** | Media |
| **Casos de Uso** | UC-2 |

**Criterios de Aceptación:**
- [ ] CA-2.2.1: Añade import si `autoImport` está habilitado
- [ ] CA-2.2.2: Usa path de `componentImport`
- [ ] CA-2.2.3: No duplica imports existentes
- [ ] CA-2.2.4: Coloca import en posición correcta

---

### RF-2.3: Exportar como Componente Individual
| Campo | Valor |
|-------|-------|
| **ID** | RF-2.3 |
| **Nombre** | Exportar icono como archivo de componente |
| **Descripción** | El sistema debe generar archivos de componente individuales |
| **Prioridad** | Media |
| **Casos de Uso** | UC-15, UC-21, UC-25 |

**Criterios de Aceptación:**
- [ ] CA-2.3.1: Soporta React (.tsx/.jsx)
- [ ] CA-2.3.2: Soporta React Native
- [ ] CA-2.3.3: Soporta Vue (.vue)
- [ ] CA-2.3.4: Soporta Svelte (.svelte)
- [ ] CA-2.3.5: Soporta Angular (.component.ts)
- [ ] CA-2.3.6: Soporta SolidJS
- [ ] CA-2.3.7: Soporta Qwik
- [ ] CA-2.3.8: Soporta Preact
- [ ] CA-2.3.9: Permite elegir TypeScript o JavaScript

---

### RF-2.4: Añadir SVG a Colección
| Campo | Valor |
|-------|-------|
| **ID** | RF-2.4 |
| **Nombre** | Añadir archivo SVG a la colección de iconos |
| **Descripción** | El sistema debe permitir añadir SVGs externos a la colección del proyecto |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-16, UC-27 |

**Criterios de Aceptación:**
- [ ] CA-2.4.1: Permite seleccionar icono desde el panel
- [ ] CA-2.4.2: Solicita nombre para el icono
- [ ] CA-2.4.3: Añade a `icons.js` y/o `sprite.svg`
- [ ] CA-2.4.4: Opción de eliminar archivo fuente

---

## 3. Optimización

### RF-3.1: Optimización con SVGO
| Campo | Valor |
|-------|-------|
| **ID** | RF-3.1 |
| **Nombre** | Optimizar SVG con SVGO |
| **Descripción** | El sistema debe optimizar SVGs usando la librería SVGO |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-3 |

**Criterios de Aceptación:**
- [ ] CA-3.1.1: Ofrece presets: Minimal, Safe, Aggressive
- [ ] CA-3.1.2: Muestra ahorro en bytes y porcentaje
- [ ] CA-3.1.3: Permite aplicar, copiar o previsualizar
- [ ] CA-3.1.4: Funciona desde editor y explorador de archivos

**Preset Minimal:**
- Elimina comentarios
- Elimina metadata
- Mantiene estructura

**Preset Safe:**
- Todo de Minimal
- Convierte colores
- Convierte paths
- Ordena atributos

**Preset Aggressive:**
- Todo de Safe
- Combina paths
- Elimina elementos ocultos
- Mayor precisión numérica

---

### RF-3.2: Limpieza de SVG
| Campo | Valor |
|-------|-------|
| **ID** | RF-3.2 |
| **Nombre** | Limpiar y normalizar SVG |
| **Descripción** | El sistema debe limpiar SVGs de metadatos innecesarios |
| **Prioridad** | Media |
| **Casos de Uso** | UC-3 |

**Criterios de Aceptación:**
- [ ] CA-3.2.1: Elimina declaración XML
- [ ] CA-3.2.2: Elimina DOCTYPE
- [ ] CA-3.2.3: Elimina comentarios HTML
- [ ] CA-3.2.4: Elimina elemento `<metadata>`
- [ ] CA-3.2.5: Elimina atributos de editores (data-name, etc.)
- [ ] CA-3.2.6: Normaliza espacios en blanco

---

## 4. IntelliSense

### RF-4.1: Autocompletado de Nombres de Iconos
| Campo | Valor |
|-------|-------|
| **ID** | RF-4.1 |
| **Nombre** | Autocompletado para nombres de iconos |
| **Descripción** | El sistema debe ofrecer autocompletado al escribir nombres de iconos |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-17 |

**Criterios de Aceptación:**
- [ ] CA-4.1.1: Se activa en `<Icon name="`
- [ ] CA-4.1.2: Se activa en `<iconify-icon icon="`
- [ ] CA-4.1.3: Muestra preview del icono
- [ ] CA-4.1.4: Muestra fuente y categoría
- [ ] CA-4.1.5: Prioriza iconos del workspace

---

### RF-4.2: Autocompletado de Variantes
| Campo | Valor |
|-------|-------|
| **ID** | RF-4.2 |
| **Nombre** | Autocompletado para variantes de iconos |
| **Descripción** | El sistema debe ofrecer variantes disponibles para cada icono |
| **Prioridad** | Media |
| **Casos de Uso** | UC-29 |

**Criterios de Aceptación:**
- [ ] CA-4.2.1: Se activa en `variant="`
- [ ] CA-4.2.2: Muestra variantes del icono actual
- [ ] CA-4.2.3: Muestra colores de cada variante
- [ ] CA-4.2.4: Lee de `variants.js`

---

### RF-4.3: Autocompletado de Animaciones
| Campo | Valor |
|-------|-------|
| **ID** | RF-4.3 |
| **Nombre** | Autocompletado para animaciones |
| **Descripción** | El sistema debe ofrecer animaciones disponibles |
| **Prioridad** | Media |
| **Casos de Uso** | UC-30 |

**Criterios de Aceptación:**
- [ ] CA-4.3.1: Se activa en `animation="`
- [ ] CA-4.3.2: Muestra: spin, pulse, bounce, shake, fade, none
- [ ] CA-4.3.3: Incluye descripción de cada animación

---

### RF-4.4: Hover Preview
| Campo | Valor |
|-------|-------|
| **ID** | RF-4.4 |
| **Nombre** | Preview de icono al hover |
| **Descripción** | El sistema debe mostrar preview del icono al pasar el cursor |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-17 |

**Criterios de Aceptación:**
- [ ] CA-4.4.1: Muestra imagen SVG del icono
- [ ] CA-4.4.2: Muestra nombre, fuente, categoría
- [ ] CA-4.4.3: Muestra advertencia si icono no existe
- [ ] CA-4.4.4: Funciona en todos los lenguajes soportados

---

### RF-4.5: Code Actions para SVG
| Campo | Valor |
|-------|-------|
| **ID** | RF-4.5 |
| **Nombre** | Code Actions para referencias SVG |
| **Descripción** | El sistema debe ofrecer acciones rápidas para SVGs detectados |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-22, UC-31 |

**Criterios de Aceptación:**
- [ ] CA-4.5.1: Detecta `<img src="...svg">`
- [ ] CA-4.5.2: Detecta `<img src={...svg}>`
- [ ] CA-4.5.3: Detecta `url(...svg)`
- [ ] CA-4.5.4: Detecta `import ... from '...svg'`
- [ ] CA-4.5.5: Ofrece "Transform to Icon Component"
- [ ] CA-4.5.6: Ofrece "Import to Library"

---

### RF-4.6: Diagnósticos
| Campo | Valor |
|-------|-------|
| **ID** | RF-4.6 |
| **Nombre** | Diagnósticos para referencias SVG |
| **Descripción** | El sistema debe mostrar advertencias en referencias SVG convertibles |
| **Prioridad** | Baja |
| **Casos de Uso** | UC-31 |

**Criterios de Aceptación:**
- [ ] CA-4.6.1: Muestra warning en `<img src="...svg">`
- [ ] CA-4.6.2: Sugiere usar componente Icon
- [ ] CA-4.6.3: Se actualiza al cambiar el documento

---

## 5. Panel y UI

### RF-5.1: Tree View de Iconos
| Campo | Valor |
|-------|-------|
| **ID** | RF-5.1 |
| **Nombre** | Panel de árbol con iconos del workspace |
| **Descripción** | El sistema debe mostrar un árbol con todos los iconos disponibles |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-1, UC-14 |

**Criterios de Aceptación:**
- [ ] CA-5.1.1: Muestra iconos por categoría (Built, SVG Files, Inline)
- [ ] CA-5.1.2: Permite selección múltiple
- [ ] CA-5.1.3: Muestra contador de usos
- [ ] CA-5.1.4: Menú contextual con acciones

---

### RF-5.2: Panel de Preview
| Campo | Valor |
|-------|-------|
| **ID** | RF-5.2 |
| **Nombre** | Panel lateral de preview |
| **Descripción** | El sistema debe mostrar preview del icono seleccionado |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-14 |

**Criterios de Aceptación:**
- [ ] CA-5.2.1: Muestra SVG renderizado
- [ ] CA-5.2.2: Muestra nombre y fuente
- [ ] CA-5.2.3: Muestra ubicación (archivo:línea)
- [ ] CA-5.2.4: Botones: Download, Copy, Edit, Optimize

---

### RF-5.3: Panel de Detalles
| Campo | Valor |
|-------|-------|
| **ID** | RF-5.3 |
| **Nombre** | Panel de detalles con zoom |
| **Descripción** | El sistema debe mostrar panel de detalles con controles de zoom |
| **Prioridad** | Media |
| **Casos de Uso** | UC-14 |

**Criterios de Aceptación:**
- [ ] CA-5.3.1: Controles de zoom: 50%, 75%, 100%, 150%, 200%
- [ ] CA-5.3.2: Muestra colores usados en el SVG
- [ ] CA-5.3.3: Permite editar colores
- [ ] CA-5.3.4: Permite optimizar

---

### RF-5.4: Editor de Colores
| Campo | Valor |
|-------|-------|
| **ID** | RF-5.4 |
| **Nombre** | Editor visual de colores |
| **Descripción** | El sistema debe permitir editar colores del SVG visualmente |
| **Prioridad** | Media |
| **Casos de Uso** | UC-9 |

**Criterios de Aceptación:**
- [ ] CA-5.4.1: Detecta todos los colores del SVG (fill, stroke)
- [ ] CA-5.4.2: Muestra color picker nativo
- [ ] CA-5.4.3: Preview en tiempo real
- [ ] CA-5.4.4: Permite guardar o copiar resultado

---

### RF-5.5: Panel Principal (Webview)
| Campo | Valor |
|-------|-------|
| **ID** | RF-5.5 |
| **Nombre** | Panel principal de Icon Manager |
| **Descripción** | El sistema debe mostrar panel completo para gestión de iconos |
| **Prioridad** | Media |
| **Casos de Uso** | UC-1, UC-7 |

**Criterios de Aceptación:**
- [ ] CA-5.5.1: Buscador de iconos
- [ ] CA-5.5.2: Filtros por categoría/fuente
- [ ] CA-5.5.3: Grid de iconos con preview
- [ ] CA-5.5.4: Click para insertar en editor

---

## 6. Build y Generación

### RF-6.1: Build de icons.js
| Campo | Valor |
|-------|-------|
| **ID** | RF-6.1 |
| **Nombre** | Generar archivo icons.js |
| **Descripción** | El sistema debe generar archivo con todos los iconos exportados |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-18 |

**Criterios de Aceptación:**
- [ ] CA-6.1.1: Exporta cada icono como objeto con name, body, viewBox
- [ ] CA-6.1.2: Exporta objeto `icons` con todos los iconos
- [ ] CA-6.1.3: Genera en directorio configurado
- [ ] CA-6.1.4: Soporte para reconstrucción completa

---

### RF-6.2: Generación de sprite.svg
| Campo | Valor |
|-------|-------|
| **ID** | RF-6.2 |
| **Nombre** | Generar SVG sprite |
| **Descripción** | El sistema debe generar sprite SVG con symbols |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-8, UC-32 |

**Criterios de Aceptación:**
- [ ] CA-6.2.1: Genera `<symbol>` por cada icono
- [ ] CA-6.2.2: Incluye viewBox correcto
- [ ] CA-6.2.3: Opción de incluir título y descripción
- [ ] CA-6.2.4: Genera archivo de tipos TypeScript

---

### RF-6.3: Generación de Helper Component
| Campo | Valor |
|-------|-------|
| **ID** | RF-6.3 |
| **Nombre** | Generar componente helper para sprite |
| **Descripción** | El sistema debe generar componente para usar el sprite fácilmente |
| **Prioridad** | Media |
| **Casos de Uso** | UC-32 |

**Criterios de Aceptación:**
- [ ] CA-6.3.1: Soporta React
- [ ] CA-6.3.2: Soporta Vue
- [ ] CA-6.3.3: Soporta Svelte
- [ ] CA-6.3.4: Soporta Vanilla JS
- [ ] CA-6.3.5: Incluye props para size, className, etc.

---

### RF-6.4: Generación de Web Component
| Campo | Valor |
|-------|-------|
| **ID** | RF-6.4 |
| **Nombre** | Generar Web Component nativo |
| **Descripción** | El sistema debe generar Custom Element para iconos |
| **Prioridad** | Media |
| **Casos de Uso** | UC-34 |

**Criterios de Aceptación:**
- [ ] CA-6.4.1: Genera clase `SgIcon` extendiendo HTMLElement
- [ ] CA-6.4.2: Soporta atributos: name, size, color, variant, animation
- [ ] CA-6.4.3: Registra como `<sg-icon>`
- [ ] CA-6.4.4: Carga iconos desde `icons.js`

---

### RF-6.5: Generación de variants.js
| Campo | Valor |
|-------|-------|
| **ID** | RF-6.5 |
| **Nombre** | Generar archivo de variantes |
| **Descripción** | El sistema debe generar archivo para definir variantes de color |
| **Prioridad** | Baja |
| **Casos de Uso** | UC-29 |

**Criterios de Aceptación:**
- [ ] CA-6.5.1: Genera estructura para `defaultVariants`
- [ ] CA-6.5.2: Genera estructura para `Variants`
- [ ] CA-6.5.3: Solo crea si no existe

---

### RF-6.6: Generación de animations.js
| Campo | Valor |
|-------|-------|
| **ID** | RF-6.6 |
| **Nombre** | Generar archivo de animaciones |
| **Descripción** | El sistema debe generar archivo para definir animaciones por icono |
| **Prioridad** | Baja |
| **Casos de Uso** | UC-30 |

**Criterios de Aceptación:**
- [ ] CA-6.6.1: Define animaciones: spin, pulse, bounce, shake, fade
- [ ] CA-6.6.2: Permite asignar animación por defecto por icono
- [ ] CA-6.6.3: Solo crea si no existe

---

## 7. Catálogo e Iconify

### RF-7.1: Búsqueda en Iconify
| Campo | Valor |
|-------|-------|
| **ID** | RF-7.1 |
| **Nombre** | Buscar iconos en Iconify |
| **Descripción** | El sistema debe permitir buscar iconos en la API de Iconify |
| **Prioridad** | Media |
| **Casos de Uso** | UC-7, UC-26 |

**Criterios de Aceptación:**
- [ ] CA-7.1.1: Búsqueda por palabra clave
- [ ] CA-7.1.2: Muestra resultados con preview
- [ ] CA-7.1.3: Muestra colección de origen
- [ ] CA-7.1.4: Permite seleccionar e insertar

---

### RF-7.2: Panel de Catálogo
| Campo | Valor |
|-------|-------|
| **ID** | RF-7.2 |
| **Nombre** | Panel de catálogo de iconos |
| **Descripción** | El sistema debe mostrar catálogo navegable de colecciones |
| **Prioridad** | Media |
| **Casos de Uso** | UC-7 |

**Criterios de Aceptación:**
- [ ] CA-7.2.1: Muestra colecciones populares
- [ ] CA-7.2.2: Filtro por colección
- [ ] CA-7.2.3: Permite añadir iconos al proyecto
- [ ] CA-7.2.4: Rastrea iconos usados

---

### RF-7.3: Generación de Licencias
| Campo | Valor |
|-------|-------|
| **ID** | RF-7.3 |
| **Nombre** | Generar archivos de licencia |
| **Descripción** | El sistema debe generar documentación de licencias para iconos usados |
| **Prioridad** | Baja |
| **Casos de Uso** | UC-10 |

**Criterios de Aceptación:**
- [ ] CA-7.3.1: Detecta iconos del catálogo usados
- [ ] CA-7.3.2: Genera archivo por colección
- [ ] CA-7.3.3: Incluye atribución requerida
- [ ] CA-7.3.4: Crea en carpeta `icon-licenses/`

---

## 8. Gestión de Imágenes

### RF-8.1: Escaneo de Imágenes
| Campo | Valor |
|-------|-------|
| **ID** | RF-8.1 |
| **Nombre** | Escanear imágenes del workspace |
| **Descripción** | El sistema debe detectar imágenes en el proyecto |
| **Prioridad** | Media |
| **Casos de Uso** | UC-6, UC-13 |

**Criterios de Aceptación:**
- [ ] CA-8.1.1: Detecta PNG, JPG, GIF, WebP, AVIF
- [ ] CA-8.1.2: Excluye carpetas configuradas
- [ ] CA-8.1.3: Muestra estadísticas por formato

---

### RF-8.2: Conversión a WebP/AVIF
| Campo | Valor |
|-------|-------|
| **ID** | RF-8.2 |
| **Nombre** | Convertir imágenes a formatos modernos |
| **Descripción** | El sistema debe convertir imágenes a WebP o AVIF |
| **Prioridad** | Media |
| **Casos de Uso** | UC-6 |

**Criterios de Aceptación:**
- [ ] CA-8.2.1: Convierte individual o en lote
- [ ] CA-8.2.2: Configurable calidad (1-100)
- [ ] CA-8.2.3: Opción lossless
- [ ] CA-8.2.4: Opción de eliminar original

---

### RF-8.3: Descarga de Imágenes Remotas
| Campo | Valor |
|-------|-------|
| **ID** | RF-8.3 |
| **Nombre** | Descargar imágenes desde URL |
| **Descripción** | El sistema debe permitir descargar imágenes remotas |
| **Prioridad** | Media |
| **Casos de Uso** | UC-5 |

**Criterios de Aceptación:**
- [ ] CA-8.3.1: Detecta URLs en código
- [ ] CA-8.3.2: Descarga individual o en lote
- [ ] CA-8.3.3: Opción de convertir a WebP
- [ ] CA-8.3.4: Actualiza referencias en código

---

## 9. Configuración

### RF-9.1: Configuración del Proyecto
| Campo | Valor |
|-------|-------|
| **ID** | RF-9.1 |
| **Nombre** | Asistente de configuración |
| **Descripción** | El sistema debe guiar al usuario en la configuración inicial |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-4 |

**Criterios de Aceptación:**
- [ ] CA-9.1.1: Solicita nombre del componente
- [ ] CA-9.1.2: Solicita directorio de salida
- [ ] CA-9.1.3: Solicita formato de salida (icons.ts, sprite.svg, both)
- [ ] CA-9.1.4: Guarda en workspace settings

---

### RF-9.2: Opciones de Configuración
| Campo | Valor |
|-------|-------|
| **ID** | RF-9.2 |
| **Nombre** | Opciones de configuración disponibles |
| **Descripción** | El sistema debe soportar las siguientes opciones |
| **Prioridad** | Alta |
| **Casos de Uso** | UC-4, UC-24 |

**Configuración Soportada:**

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `componentName` | string | `"icon"` | Nombre del componente |
| `componentImport` | string | `"@/components/ui/Icon"` | Path del import |
| `svgFolders` | array | `["src/assets/icons", ...]` | Carpetas a escanear |
| `outputFormat` | enum | `"jsx"` | Formato de salida |
| `iconNameAttribute` | string | `"name"` | Atributo para el nombre |
| `autoImport` | boolean | `true` | Auto-añadir imports |
| `libraryPath` | string | `""` | Path a icons.json externo |
| `outputDirectory` | string | `""` | Directorio de build |

---

### RF-9.3: Integración con Librería Externa
| Campo | Valor |
|-------|-------|
| **ID** | RF-9.3 |
| **Nombre** | Sincronización con Icon Manager App |
| **Descripción** | El sistema debe leer iconos desde archivo externo |
| **Prioridad** | Baja |
| **Casos de Uso** | UC-20, UC-28 |

**Criterios de Aceptación:**
- [ ] CA-9.3.1: Lee `icons.json` desde `libraryPath`
- [ ] CA-9.3.2: Combina con iconos del workspace
- [ ] CA-9.3.3: Permite importar a librería global

---

## Matriz de Trazabilidad

| Requisito | Casos de Uso Relacionados |
|-----------|---------------------------|
| RF-1.1 | UC-1, UC-4 |
| RF-1.2 | UC-2, UC-11 |
| RF-1.3 | UC-33 |
| RF-1.4 | UC-11, UC-17, UC-19 |
| RF-1.5 | UC-19 |
| RF-2.1 | UC-2, UC-12 |
| RF-2.2 | UC-2 |
| RF-2.3 | UC-15, UC-21, UC-25 |
| RF-2.4 | UC-16, UC-27 |
| RF-3.1 | UC-3 |
| RF-3.2 | UC-3 |
| RF-4.1 | UC-17 |
| RF-4.2 | UC-29 |
| RF-4.3 | UC-30 |
| RF-4.4 | UC-17 |
| RF-4.5 | UC-22, UC-31 |
| RF-4.6 | UC-31 |
| RF-5.1 | UC-1, UC-14 |
| RF-5.2 | UC-14 |
| RF-5.3 | UC-14 |
| RF-5.4 | UC-9 |
| RF-5.5 | UC-1, UC-7 |
| RF-6.1 | UC-18 |
| RF-6.2 | UC-8, UC-32 |
| RF-6.3 | UC-32 |
| RF-6.4 | UC-34 |
| RF-6.5 | UC-29 |
| RF-6.6 | UC-30 |
| RF-7.1 | UC-7, UC-26 |
| RF-7.2 | UC-7 |
| RF-7.3 | UC-10 |
| RF-8.1 | UC-6, UC-13 |
| RF-8.2 | UC-6 |
| RF-8.3 | UC-5 |
| RF-9.1 | UC-4 |
| RF-9.2 | UC-4, UC-24 |
| RF-9.3 | UC-20, UC-28 |

---

## Historial de Cambios

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2024-12-24 | Versión inicial |
