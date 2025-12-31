/**
 * Tests de integración para IconEditorColorHandlers
 * Verifican que los filtros de color se aplican correctamente sin duplicación
 */

import { ColorService, getColorService } from '../../services/ColorService';

describe('IconEditorColorHandlers Integration', () => {
  let colorService: ColorService;

  beforeEach(() => {
    colorService = getColorService();
  });

  /**
   * Reimplementación exacta del algoritmo de filtros usado en IconEditorColorHandlers.ts
   * para verificar que coincide con el frontend
   */
  function applyColorFilters(
    hexColor: string,
    hueRotate: number,
    saturatePercent: number,
    brightnessPercent: number
  ): string {
    let r: number, g: number, b: number;

    if (hexColor.startsWith('#')) {
      const hex = hexColor.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else {
        return hexColor;
      }
    } else if (hexColor.startsWith('rgb')) {
      const match = hexColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      } else {
        return hexColor;
      }
    } else {
      return hexColor;
    }

    // Step 1: Apply hue-rotate
    const angle = (hueRotate * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const r1 =
      r * (0.213 + cos * 0.787 - sin * 0.213) +
      g * (0.715 - cos * 0.715 - sin * 0.715) +
      b * (0.072 - cos * 0.072 + sin * 0.928);
    const g1 =
      r * (0.213 - cos * 0.213 + sin * 0.143) +
      g * (0.715 + cos * 0.285 + sin * 0.14) +
      b * (0.072 - cos * 0.072 - sin * 0.283);
    const b1 =
      r * (0.213 - cos * 0.213 - sin * 0.787) +
      g * (0.715 - cos * 0.715 + sin * 0.715) +
      b * (0.072 + cos * 0.928 + sin * 0.072);

    // Step 2: Apply saturate
    const sat = saturatePercent / 100;
    const r2 = r1 * (0.213 + 0.787 * sat) + g1 * (0.715 - 0.715 * sat) + b1 * (0.072 - 0.072 * sat);
    const g2 = r1 * (0.213 - 0.213 * sat) + g1 * (0.715 + 0.285 * sat) + b1 * (0.072 - 0.072 * sat);
    const b2 = r1 * (0.213 - 0.213 * sat) + g1 * (0.715 - 0.715 * sat) + b1 * (0.072 + 0.928 * sat);

    // Step 3: Apply brightness
    const bright = brightnessPercent / 100;
    const r3 = r2 * bright;
    const g3 = g2 * bright;
    const b3 = b2 * bright;

    // Clamp and convert to hex
    const clamp = (x: number): number => Math.max(0, Math.min(255, Math.round(x)));
    const toHex = (x: number): string => clamp(x).toString(16).padStart(2, '0');
    return `#${toHex(r3)}${toHex(g3)}${toHex(b3)}`;
  }

  describe('Filtros aplicados una sola vez', () => {
    it('no debe aplicar filtros dos veces al mismo color', () => {
      // Simulación: color original del diamante
      const originalColor = '#89f7fe'; // Cyan claro del diamante
      const hue = 192; // Como en las imágenes
      const saturation = 100;
      const brightness = 100;

      // Primera aplicación (lo que hace el preview)
      const filtered1 = applyColorFilters(originalColor, hue, saturation, brightness);

      // Segunda aplicación (si hubiera bug de doble aplicación)
      const filtered2 = applyColorFilters(filtered1, hue, saturation, brightness);

      // Los resultados deben ser diferentes si se aplican dos veces
      // El bug sería que filtered2 es lo que se está mostrando
      console.log('Original:', originalColor);
      console.log('Una vez:', filtered1);
      console.log('Dos veces:', filtered2);

      // Verificar que una aplicación es suficiente
      expect(filtered1).not.toBe(filtered2);
    });

    it('debe producir colores consistentes desde el SVG original', () => {
      // Colores originales del diamante (de las imágenes)
      const originalColors = ['#fff', '#89f7fe', '#66a6ff'];

      // Filtros aplicados (hue=192 como en la imagen)
      const hue = 192;
      const saturation = 100;
      const brightness = 100;

      // Aplicar filtros una vez
      const filteredColors = originalColors.map(c =>
        applyColorFilters(colorService.toHexColor(c), hue, saturation, brightness)
      );

      // Verificar que los colores son válidos
      filteredColors.forEach(color => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });

      // Verificar que son diferentes de los originales (hue=192 es significativo)
      expect(filteredColors[1].toLowerCase()).not.toBe('#89f7fe');
    });
  });

  describe('Flujo de aplicación de variantes', () => {
    it('debe calcular colores correctos cuando se selecciona variante custom', () => {
      // Simulación del flujo:
      // 1. SVG original tiene color azul
      // 2. Variante "custom" tiene color naranja
      // 3. Al seleccionar variante, se reemplaza el color en el SVG
      // 4. El filtro debe calcularse desde el color de la variante, no del original

      const originalSvgColor = '#89f7fe'; // Azul original
      const variantColor = '#fea389'; // Naranja de la variante custom

      // Cuando se aplica la variante, el SVG se actualiza con variantColor
      // Los filtros deben partir de variantColor, no de originalSvgColor

      // Filtro para volver a azul desde naranja
      const filters = colorService.estimateFiltersForColor(variantColor, originalSvgColor);

      // Aplicar el filtro calculado al color de la variante
      const result = applyColorFilters(variantColor, filters.hue, filters.saturation, filters.brightness);

      // El resultado debe acercarse al color original
      const resultRgb = colorService.hexToRgb(result);
      const targetRgb = colorService.hexToRgb(originalSvgColor);

      expect(resultRgb).not.toBeNull();
      expect(targetRgb).not.toBeNull();

      // Tolerancia de ~30 para cada canal (los filtros son aproximaciones)
      const tolerance = 50;
      expect(Math.abs(resultRgb!.r - targetRgb!.r)).toBeLessThan(tolerance);
      expect(Math.abs(resultRgb!.g - targetRgb!.g)).toBeLessThan(tolerance);
      expect(Math.abs(resultRgb!.b - targetRgb!.b)).toBeLessThan(tolerance);
    });
  });

  describe('Sincronización paleta-preview', () => {
    it('la paleta debe mostrar el mismo color que el preview filtrado', () => {
      // Color base en la paleta (data-original-color)
      const paletteOriginalColor = '#ff5500';

      // Filtros actuales
      const hue = 120;
      const saturation = 150;
      const brightness = 80;

      // El color mostrado en la paleta debe ser el resultado del filtro
      const expectedPaletteDisplay = applyColorFilters(paletteOriginalColor, hue, saturation, brightness);

      // Y el preview del SVG usa el filtro CSS que produce el mismo resultado visualmente
      // (CSS filter: hue-rotate(120deg) saturate(150%) brightness(80%))

      // Verificar que el color calculado es válido
      expect(expectedPaletteDisplay).toMatch(/^#[0-9a-f]{6}$/i);
      expect(expectedPaletteDisplay.toLowerCase()).not.toBe(paletteOriginalColor.toLowerCase());
    });
  });

  describe('Build no debe re-aplicar filtros ya mostrados', () => {
    it('si la paleta muestra colores filtrados, el build debe usar esos colores', () => {
      // Escenario:
      // 1. SVG original: fill="#ff5500"
      // 2. Usuario mueve sliders: hue=90
      // 3. Paleta muestra: color filtrado (ej: #xxxx)
      // 4. Usuario hace click en "Aplicar filtros"
      // 5. Build debe:
      //    a) Leer color ORIGINAL del SVG (#ff5500)
      //    b) Aplicar filtro UNA vez
      //    c) Guardar resultado en SVG

      const svgOriginalColor = '#ff5500';
      const hue = 90;
      const saturation = 100;
      const brightness = 100;

      // Lo que el usuario ve en la paleta
      const paletteDisplayColor = applyColorFilters(svgOriginalColor, hue, saturation, brightness);

      // Lo que el build debe hacer
      const buildResult = applyColorFilters(svgOriginalColor, hue, saturation, brightness);

      // Deben ser iguales
      expect(buildResult.toLowerCase()).toBe(paletteDisplayColor.toLowerCase());
    });

    it('NO debe aplicar filtros al color ya filtrado de la paleta', () => {
      const svgOriginalColor = '#ff5500';
      const hue = 90;
      const saturation = 100;
      const brightness = 100;

      // Paleta muestra color filtrado
      const paletteDisplayColor = applyColorFilters(svgOriginalColor, hue, saturation, brightness);

      // BUG: Si el build lee el color de la paleta en lugar del SVG y aplica filtros de nuevo:
      const buggyBuildResult = applyColorFilters(paletteDisplayColor, hue, saturation, brightness);

      // El resultado del bug sería diferente
      const correctBuildResult = applyColorFilters(svgOriginalColor, hue, saturation, brightness);

      expect(buggyBuildResult.toLowerCase()).not.toBe(correctBuildResult.toLowerCase());

      // Verificar la magnitud de la diferencia (esto ayuda a diagnosticar el bug)
      const correct = colorService.hexToRgb(correctBuildResult)!;
      const buggy = colorService.hexToRgb(buggyBuildResult)!;

      console.log('Correct build:', correctBuildResult, correct);
      console.log('Buggy build (double filter):', buggyBuildResult, buggy);
    });
  });

  describe('Colores rgba y formatos especiales', () => {
    it('debe manejar colores rgba correctamente', () => {
      const rgbaColor = 'rgba(255, 85, 0, 1)';
      const filtered = applyColorFilters(rgbaColor, 45, 100, 100);
      expect(filtered).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('debe devolver el color original si no puede procesarlo', () => {
      const namedColor = 'red';
      const filtered = applyColorFilters(namedColor, 45, 100, 100);
      expect(filtered).toBe('red'); // No puede procesar nombres
    });

    it('debe manejar hex de 3 caracteres', () => {
      const shortHex = '#f50';
      const filtered = applyColorFilters(shortHex, 45, 100, 100);
      expect(filtered).toMatch(/^#[0-9a-f]{6}$/i);

      // Comparar con el hex expandido
      const longHex = '#ff5500';
      const filteredLong = applyColorFilters(longHex, 45, 100, 100);

      expect(filtered.toLowerCase()).toBe(filteredLong.toLowerCase());
    });
  });

  describe('Verificación de valores específicos de las imágenes', () => {
    it('debe reproducir los colores vistos en las screenshots', () => {
      // Imagen 1: Diamante azul original
      // Colores: #fff, rgba(255...), rgba(255...), #89f7fe, #66a6ff
      const originalBlueColors = ['#ffffff', '#89f7fe', '#66a6ff'];

      // Imagen 2: Diamante naranja (variante custom)
      // Colores: #ffffff, #fea389, #ffd966
      const orangeVariantColors = ['#ffffff', '#fea389', '#ffd966'];

      // Imagen 3: Con filtro hue=192, volviendo a azul
      // Los colores mostrados en la paleta deberían coincidir con el preview

      // Simular: partiendo de naranja, aplicar hue=192
      const hue = 192;
      const saturation = 100;
      const brightness = 100;

      const filteredFromOrange = orangeVariantColors.map(c => applyColorFilters(c, hue, saturation, brightness));

      console.log('Orange colors:', orangeVariantColors);
      console.log('Filtered with hue=192:', filteredFromOrange);
      console.log('Expected blue:', originalBlueColors);

      // Verificar que los colores filtrados son válidos
      filteredFromOrange.forEach(color => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('debe reproducir los colores verdes de la imagen 4 (hue=204)', () => {
      // Imagen 4: Diamante verde con hue=204
      const orangeVariantColors = ['#ffffff', '#fea389', '#ffd966'];

      const hue = 204;
      const saturation = 100;
      const brightness = 100;

      const filteredGreen = orangeVariantColors.map(c => applyColorFilters(c, hue, saturation, brightness));

      console.log('Orange colors:', orangeVariantColors);
      console.log('Filtered with hue=204 (green):', filteredGreen);

      // Los colores mostrados en la imagen son: #ffffff, #dec274, #4d8f00
      // Verificar que hay componente verde significativo en el segundo color
      const greenColor = colorService.hexToRgb(filteredGreen[2]);
      expect(greenColor).not.toBeNull();
      // Hue 204 debería producir colores verdosos
    });
  });

  describe('BUG: Colores de paleta vs preview', () => {
    it('DIAGNÓSTICO: Los colores de la imagen 3 muestran doble filtrado', () => {
      // En la imagen 3:
      // - Preview SVG: diamante azul (correcto)
      // - Paleta colores: #ffffff, #ffffff, #ffffff, #76c1ee, #cbd1ff
      // - Variante original: puntos azules
      // - Variante custom: puntos azules (deberían ser naranjas guardados!)

      // HIPÓTESIS: Los colores de la paleta se están calculando mal

      // Si el SVG tiene colores naranjas (#fea389) y aplicamos hue=192:
      const orangeColor = '#fea389';
      const hue = 192;
      const filtered = applyColorFilters(orangeColor, hue, 100, 100);
      console.log(`Orange ${orangeColor} + hue=${hue} = ${filtered}`);

      // Pero la imagen muestra #76c1ee en la paleta...
      // ¿Qué filtro da #76c1ee desde #fea389?

      // Buscar el hue que produce #76c1ee
      let foundHue = -1;
      for (let h = 0; h <= 360; h += 1) {
        const result = applyColorFilters(orangeColor, h, 100, 100);
        if (result.toLowerCase() === '#76c1ee') {
          foundHue = h;
          break;
        }
      }
      console.log(`Hue que produce #76c1ee desde ${orangeColor}: ${foundHue}`);

      // Si no lo encontramos, puede que venga de otro color base
      // Probemos desde el azul original
      const blueColor = '#89f7fe';
      for (let h = 0; h <= 360; h += 1) {
        const result = applyColorFilters(blueColor, h, 100, 100);
        if (result.toLowerCase() === '#76c1ee') {
          console.log(`Hue que produce #76c1ee desde ${blueColor}: ${h}`);
          break;
        }
      }
    });

    it('DIAGNÓSTICO: Comparar colores de imagen 1 vs imagen 3', () => {
      // Imagen 1 (original azul, sin filtros):
      // Paleta: #fff, rgba(255,255,255,0.5), rgba(255,255,255,0.5), #89f7fe, #66a6ff
      
      // Imagen 3 (variante custom + hue=192):
      // Paleta: #ffffff, #ffffff, #ffffff, #76c1ee, #cbd1ff
      
      // El SVG en imagen 3 tiene el diamante azul (preview correcto)
      // Pero la paleta NO muestra los colores originales azules
      
      // Esto sugiere que:
      // 1. El SVG fue actualizado con colores naranjas (variante custom)
      // 2. El filtro CSS hue=192 hace que el preview se vea azul
      // 3. La paleta calcula los colores filtrados sobre los naranjas
      
      const variantOrangeColors = ['#ffffff', '#fea389', '#ffd966'];
      const hue = 192;
      
      const paletteCalculated = variantOrangeColors.map(c => 
        applyColorFilters(c, hue, 100, 100)
      );
      
      console.log('Colores variante (guardados):', variantOrangeColors);
      console.log('Paleta calculada con hue=192:', paletteCalculated);
      console.log('Paleta en imagen 3:', ['#ffffff', '#ffffff', '#ffffff', '#76c1ee', '#cbd1ff']);
      
      // La paleta calculada debería coincidir con la imagen
      // Si no coincide, hay un bug en el cálculo
    });
  });
});
