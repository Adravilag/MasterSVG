# Plan de Estabilización y Refactorización - Bezier Icons

Este documento define las tareas necesarias para llevar la extensión de un estado "funcional pero frágil" a una versión v1.0 estable y mantenible.

## 🎯 Objetivos del Sprint
1.  **Refactorización Crítica**: Eliminar la deuda técnica en `IconEditorPanel`.
2.  **Robustez**: Mejorar el parseo y manipulación de SVGs para evitar errores de corrupción.
3.  **Testing**: Asegurar que las funcionalidades críticas tienen cobertura de tests.
4.  **Finalización**: Validar las funcionalidades de generación de Sprites y Web Components.

## 📋 Backlog de Tareas

### Epic 1: Refactorización de Arquitectura (Prioridad Alta)
- [x] **TASK-1.1**: Crear `SvgManipulationService`.
    - Extraer lógica de `_embedAnimationInSvg`, `_cleanAnimationFromSvg`, `_ensureSvgNamespace`.
    - Mover lógica de detección de animaciones (`_detectAnimationFromSvg`).
    - Objetivo: Que `IconEditorPanel.ts` delegue estas tareas y reduzca su tamaño.
- [x] **TASK-1.2**: Crear `AnimationService`.
    - Centralizar las definiciones de keyframes y lógica de inyección de CSS.
    - Separar la lógica de "Draw Animations" que es compleja.

### Epic 2: Fiabilidad y Parseo (Prioridad Alta)
- [x] **TASK-2.1**: Reemplazar Regex frágiles por Parseo XML real (donde sea posible).
    - Implementado usando `@xmldom/xmldom`.
    - Se mantiene Regex como fallback en caso de error de parseo.
- [x] **TASK-2.2**: Sistema de Manejo de Errores.
    - Implementar un wrapper para operaciones de archivo que capture errores y muestre mensajes amigables al usuario en lugar de fallar silenciosamente.

### Epic 3: Funcionalidades Core (Prioridad Media)
- [x] **TASK-3.1**: Validar Generación de Sprites y Web Components.
    - Verificar que la configuración `webComponentName` se respeta.
    - Verificar que `icons.js` generado es válido y funciona en un navegador.
- [x] **TASK-3.2**: Unificar lógica de guardado.
    - Asegurar que `save` siempre pasa por el pipeline de limpieza -> validación -> inyección.

### Epic 4: Testing y QA (Prioridad Media)
- [x] **TASK-4.1**: Tests Unitarios para `SvgManipulationService`.
    - Testear inyección de animaciones en SVGs rotos.
    - Testear limpieza de animaciones previas.
- [x] **TASK-4.2**: Tests de Integración para el flujo de Guardado.

## 🚀 Siguientes Pasos Inmediatos
1.  Comenzar con **TASK-1.1**: Crear el servicio de manipulación de SVG para aislar la lógica que acabamos de arreglar.
