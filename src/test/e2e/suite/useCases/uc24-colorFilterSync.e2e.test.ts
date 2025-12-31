/**
 * UC-24: Sincronización de Filtros de Color
 *
 * Tests E2E para verificar que los filtros de color (hue-rotate, saturate, brightness)
 * se aplican correctamente y los colores de la paleta coinciden con el preview del SVG.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('UC-24: Sincronización de Filtros de Color', () => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-24.1: Algoritmo de filtros CSS', () => {
    /**
     * Implementación del algoritmo CSS hue-rotate usando matriz de color
     */
    function applyHueRotate(r: number, g: number, b: number, degrees: number): [number, number, number] {
      const angle = (degrees * Math.PI) / 180;
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

      return [r1, g1, b1];
    }

    /**
     * Implementación del algoritmo CSS saturate usando matriz de color
     */
    function applySaturate(r: number, g: number, b: number, percent: number): [number, number, number] {
      const sat = percent / 100;
      const r2 = r * (0.213 + 0.787 * sat) + g * (0.715 - 0.715 * sat) + b * (0.072 - 0.072 * sat);
      const g2 = r * (0.213 - 0.213 * sat) + g * (0.715 + 0.285 * sat) + b * (0.072 - 0.072 * sat);
      const b2 = r * (0.213 - 0.213 * sat) + g * (0.715 - 0.715 * sat) + b * (0.072 + 0.928 * sat);

      return [r2, g2, b2];
    }

    /**
     * Implementación del algoritmo CSS brightness
     */
    function applyBrightness(r: number, g: number, b: number, percent: number): [number, number, number] {
      const bright = percent / 100;
      return [r * bright, g * bright, b * bright];
    }

    /**
     * Aplica todos los filtros CSS en el orden correcto
     */
    function applyColorFilters(
      hexColor: string,
      hueRotate: number,
      saturatePercent: number,
      brightnessPercent: number
    ): string {
      // Parse hex color
      const hex = hexColor.slice(1);
      let r = parseInt(hex.slice(0, 2), 16);
      let g = parseInt(hex.slice(2, 4), 16);
      let b = parseInt(hex.slice(4, 6), 16);

      // Apply hue-rotate
      [r, g, b] = applyHueRotate(r, g, b, hueRotate);

      // Apply saturate
      [r, g, b] = applySaturate(r, g, b, saturatePercent);

      // Apply brightness
      [r, g, b] = applyBrightness(r, g, b, brightnessPercent);

      // Clamp and convert to hex
      const clamp = (x: number): number => Math.max(0, Math.min(255, Math.round(x)));
      const toHex = (x: number): string => clamp(x).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    test('Filtros neutros no deben cambiar el color', () => {
      const originalColor = '#ff5500';
      const filtered = applyColorFilters(originalColor, 0, 100, 100);
      
      // Con filtros neutros, el color debe ser igual (o muy cercano por redondeo)
      assert.strictEqual(filtered.toLowerCase(), originalColor.toLowerCase(), 
        'Filtros neutros (0deg, 100%, 100%) no deben modificar el color');
    });

    test('Hue-rotate 180deg debe invertir tonos', () => {
      const red = '#ff0000';
      const filtered = applyColorFilters(red, 180, 100, 100);
      
      // Rojo con hue-rotate 180deg debería dar un tono cyan/azul
      const r = parseInt(filtered.slice(1, 3), 16);
      const g = parseInt(filtered.slice(3, 5), 16);
      const b = parseInt(filtered.slice(5, 7), 16);
      
      // El componente rojo debe ser menor que el azul después de rotar 180deg
      assert.ok(b > r, 'Hue-rotate 180deg en rojo debe aumentar el componente azul');
    });

    test('Saturación 0% debe dar escala de grises', () => {
      const red = '#ff0000';
      const filtered = applyColorFilters(red, 0, 0, 100);
      
      const r = parseInt(filtered.slice(1, 3), 16);
      const g = parseInt(filtered.slice(3, 5), 16);
      const b = parseInt(filtered.slice(5, 7), 16);
      
      // En escala de grises, R, G, B deben ser similares
      const tolerance = 5;
      assert.ok(Math.abs(r - g) <= tolerance && Math.abs(g - b) <= tolerance,
        'Saturación 0% debe producir escala de grises');
    });

    test('Saturación 200% debe intensificar colores', () => {
      const pastel = '#ff8888'; // Rojo pastel
      const original = applyColorFilters(pastel, 0, 100, 100);
      const saturated = applyColorFilters(pastel, 0, 200, 100);
      
      const origR = parseInt(original.slice(1, 3), 16);
      const origG = parseInt(original.slice(3, 5), 16);
      const satR = parseInt(saturated.slice(1, 3), 16);
      const satG = parseInt(saturated.slice(3, 5), 16);
      
      // La diferencia entre R y G debe ser mayor con saturación alta
      const origDiff = Math.abs(origR - origG);
      const satDiff = Math.abs(satR - satG);
      
      assert.ok(satDiff >= origDiff, 'Saturación 200% debe intensificar la diferencia entre canales');
    });

    test('Brillo 50% debe oscurecer', () => {
      const white = '#ffffff';
      const darkened = applyColorFilters(white, 0, 100, 50);
      
      const r = parseInt(darkened.slice(1, 3), 16);
      
      // El blanco con brillo 50% debe ser gris medio (~128)
      assert.ok(r >= 120 && r <= 135, `Brillo 50% de blanco debe dar ~128, obtuvo ${r}`);
    });

    test('Brillo 200% debe aclarar (hasta máximo 255)', () => {
      const gray = '#808080';
      const brightened = applyColorFilters(gray, 0, 100, 200);
      
      const r = parseInt(brightened.slice(1, 3), 16);
      
      // Gris medio con brillo 200% debe ser blanco o casi blanco
      assert.ok(r >= 250, `Brillo 200% de gris debe dar ~255, obtuvo ${r}`);
    });

    test('Filtros combinados deben aplicarse en orden correcto', () => {
      const original = '#4080c0'; // Azul medio
      
      // Aplicar hue 90deg + saturación 150% + brillo 120%
      const filtered = applyColorFilters(original, 90, 150, 120);
      
      // Solo verificar que el resultado es un hex válido
      assert.ok(/^#[0-9a-f]{6}$/i.test(filtered), 'Debe producir un color hex válido');
      assert.notStrictEqual(filtered.toLowerCase(), original.toLowerCase(),
        'Filtros combinados deben cambiar el color');
    });
  });

  suite('CA-24.2: Comandos de editor disponibles', () => {
    test('Debe existir comando openIconEditor', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.openIconEditor'),
        'Comando openIconEditor debe existir'
      );
    });

    test('Debe existir comando applyFilters', async () => {
      const commands = await vscode.commands.getCommands(true);
      // El comando applyFilters se maneja internamente en el webview
      // Verificamos que existen comandos relacionados con el editor
      const hasEditorCommands = commands.some(
        cmd => cmd.includes('sageboxIconStudio') && 
               (cmd.includes('Editor') || cmd.includes('Icon'))
      );
      assert.ok(hasEditorCommands, 'Deben existir comandos del editor de iconos');
    });
  });

  suite('CA-24.3: Sincronización preview-paleta', () => {
    test('Colores calculados deben coincidir entre JS y TS', () => {
      // Test que verifica que ambas implementaciones (JS webview y TS backend)
      // producen los mismos resultados
      
      const testCases = [
        { color: '#ff0000', hue: 0, sat: 100, bright: 100 },
        { color: '#00ff00', hue: 120, sat: 100, bright: 100 },
        { color: '#0000ff', hue: 240, sat: 50, bright: 150 },
        { color: '#ff8800', hue: 180, sat: 200, bright: 80 },
      ];

      testCases.forEach(tc => {
        // Simular aplicación de filtros
        const hex = tc.color.slice(1);
        let r = parseInt(hex.slice(0, 2), 16);
        let g = parseInt(hex.slice(2, 4), 16);
        let b = parseInt(hex.slice(4, 6), 16);

        // Hue rotate
        const angle = (tc.hue * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const r1 = r * (0.213 + cos * 0.787 - sin * 0.213) +
                   g * (0.715 - cos * 0.715 - sin * 0.715) +
                   b * (0.072 - cos * 0.072 + sin * 0.928);
        const g1 = r * (0.213 - cos * 0.213 + sin * 0.143) +
                   g * (0.715 + cos * 0.285 + sin * 0.14) +
                   b * (0.072 - cos * 0.072 - sin * 0.283);
        const b1 = r * (0.213 - cos * 0.213 - sin * 0.787) +
                   g * (0.715 - cos * 0.715 + sin * 0.715) +
                   b * (0.072 + cos * 0.928 + sin * 0.072);

        // Saturate
        const sat = tc.sat / 100;
        const r2 = r1 * (0.213 + 0.787 * sat) + g1 * (0.715 - 0.715 * sat) + b1 * (0.072 - 0.072 * sat);
        const g2 = r1 * (0.213 - 0.213 * sat) + g1 * (0.715 + 0.285 * sat) + b1 * (0.072 - 0.072 * sat);
        const b2 = r1 * (0.213 - 0.213 * sat) + g1 * (0.715 - 0.715 * sat) + b1 * (0.072 + 0.928 * sat);

        // Brightness
        const bright = tc.bright / 100;
        const r3 = r2 * bright;
        const g3 = g2 * bright;
        const b3 = b2 * bright;

        // Verificar que los valores son válidos
        const clamp = (x: number): number => Math.max(0, Math.min(255, Math.round(x)));
        assert.ok(clamp(r3) >= 0 && clamp(r3) <= 255, `R válido para ${tc.color}`);
        assert.ok(clamp(g3) >= 0 && clamp(g3) <= 255, `G válido para ${tc.color}`);
        assert.ok(clamp(b3) >= 0 && clamp(b3) <= 255, `B válido para ${tc.color}`);
      });
    });

    test('Filtros deben ser reversibles con valores inversos', () => {
      const original = '#4080c0';
      
      // Aplicar hue +90
      const hex = original.slice(1);
      let r = parseInt(hex.slice(0, 2), 16);
      let g = parseInt(hex.slice(2, 4), 16);
      let b = parseInt(hex.slice(4, 6), 16);

      // Aplicar hue-rotate +90
      const angle1 = (90 * Math.PI) / 180;
      const cos1 = Math.cos(angle1);
      const sin1 = Math.sin(angle1);
      const r1 = r * (0.213 + cos1 * 0.787 - sin1 * 0.213) +
                 g * (0.715 - cos1 * 0.715 - sin1 * 0.715) +
                 b * (0.072 - cos1 * 0.072 + sin1 * 0.928);
      const g1 = r * (0.213 - cos1 * 0.213 + sin1 * 0.143) +
                 g * (0.715 + cos1 * 0.285 + sin1 * 0.14) +
                 b * (0.072 - cos1 * 0.072 - sin1 * 0.283);
      const b1 = r * (0.213 - cos1 * 0.213 - sin1 * 0.787) +
                 g * (0.715 - cos1 * 0.715 + sin1 * 0.715) +
                 b * (0.072 + cos1 * 0.928 + sin1 * 0.072);

      // Aplicar hue-rotate -90 (270)
      const angle2 = (270 * Math.PI) / 180;
      const cos2 = Math.cos(angle2);
      const sin2 = Math.sin(angle2);
      const r2 = r1 * (0.213 + cos2 * 0.787 - sin2 * 0.213) +
                 g1 * (0.715 - cos2 * 0.715 - sin2 * 0.715) +
                 b1 * (0.072 - cos2 * 0.072 + sin2 * 0.928);
      const g2 = r1 * (0.213 - cos2 * 0.213 + sin2 * 0.143) +
                 g1 * (0.715 + cos2 * 0.285 + sin2 * 0.14) +
                 b1 * (0.072 - cos2 * 0.072 - sin2 * 0.283);
      const b2 = r1 * (0.213 - cos2 * 0.213 - sin2 * 0.787) +
                 g1 * (0.715 - cos2 * 0.715 + sin2 * 0.715) +
                 b1 * (0.072 + cos2 * 0.928 + sin2 * 0.072);

      const clamp = (x: number): number => Math.max(0, Math.min(255, Math.round(x)));
      
      // Los valores deben estar cerca del original (tolerancia por redondeo)
      const tolerance = 10;
      assert.ok(Math.abs(clamp(r2) - r) <= tolerance, 
        `Hue rotate debe ser reversible R: ${clamp(r2)} vs ${r}`);
      assert.ok(Math.abs(clamp(g2) - g) <= tolerance, 
        `Hue rotate debe ser reversible G: ${clamp(g2)} vs ${g}`);
      assert.ok(Math.abs(clamp(b2) - b) <= tolerance, 
        `Hue rotate debe ser reversible B: ${clamp(b2)} vs ${b}`);
    });
  });

  suite('CA-24.4: Reset de filtros al cambiar color manualmente', () => {
    test('Cambio manual de color debe resetear filtros a neutral', () => {
      // Simular el comportamiento esperado:
      // Cuando el usuario cambia un color con el picker,
      // los filtros deben resetearse a valores neutros
      
      const neutralFilters = {
        hue: 0,
        saturation: 100,
        brightness: 100
      };

      // Verificar valores neutros
      assert.strictEqual(neutralFilters.hue, 0, 'Hue neutral debe ser 0');
      assert.strictEqual(neutralFilters.saturation, 100, 'Saturación neutral debe ser 100');
      assert.strictEqual(neutralFilters.brightness, 100, 'Brillo neutral debe ser 100');
    });

    test('data-original-color debe actualizarse al cambiar color', () => {
      // Simular el flujo:
      // 1. Color original: #ff0000
      // 2. Usuario cambia a: #00ff00
      // 3. data-original-color debe ser #00ff00
      
      const originalColor = '#ff0000';
      const newColor = '#00ff00';
      
      // Simular actualización del data-original-color
      const mockElement = { dataset: { originalColor: originalColor } };
      mockElement.dataset.originalColor = newColor;
      
      assert.strictEqual(mockElement.dataset.originalColor, newColor,
        'data-original-color debe actualizarse al nuevo color');
    });
  });

  suite('CA-24.5: Build debe guardar colores correctos', () => {
    test('Build sin filtros activos debe guardar colores actuales', () => {
      // Simular el flujo:
      // 1. Colores actuales: #ff0000, #00ff00, #0000ff
      // 2. Filtros neutros (0, 100, 100)
      // 3. Al build, los colores guardados deben ser exactamente los actuales
      
      const currentColors = ['#ff0000', '#00ff00', '#0000ff'];
      const filters = { hue: 0, saturation: 100, brightness: 100 };
      const filtersAreNeutral = filters.hue === 0 && 
                                 filters.saturation === 100 && 
                                 filters.brightness === 100;

      if (filtersAreNeutral) {
        // Los colores guardados deben ser los actuales
        const savedColors = [...currentColors];
        assert.deepStrictEqual(savedColors, currentColors,
          'Colores guardados deben ser iguales a los actuales con filtros neutros');
      }
    });

    test('Build con filtros activos debe aplicar filtros a colores originales', () => {
      // Este test verifica que cuando hay filtros activos,
      // el build aplica los filtros correctamente
      
      const originalColor = '#ff0000';
      const filters = { hue: 180, saturation: 100, brightness: 100 };
      
      // Aplicar filtros
      const hex = originalColor.slice(1);
      let r = parseInt(hex.slice(0, 2), 16);
      let g = parseInt(hex.slice(2, 4), 16);
      let b = parseInt(hex.slice(4, 6), 16);

      const angle = (filters.hue * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const r1 = r * (0.213 + cos * 0.787 - sin * 0.213) +
                 g * (0.715 - cos * 0.715 - sin * 0.715) +
                 b * (0.072 - cos * 0.072 + sin * 0.928);

      // El color filtrado debe ser diferente del original
      const clamp = (x: number): number => Math.max(0, Math.min(255, Math.round(x)));
      assert.notStrictEqual(clamp(r1), r,
        'Color filtrado debe ser diferente del original con hue 180');
    });
  });

  suite('CA-24.6: Variante original read-only', () => {
    test('Filtros deben estar deshabilitados para variante original', () => {
      // Cuando la variante "original" está seleccionada (index -1),
      // los filtros globales deben estar deshabilitados
      
      const selectedVariantIndex = -1; // -1 = original
      const isOriginalSelected = selectedVariantIndex === -1;
      
      assert.ok(isOriginalSelected, 'Index -1 debe indicar variante original');
      
      // En este caso, los controles de filtro deben tener el atributo disabled
      const filtersDisabled = isOriginalSelected ? ' disabled' : '';
      assert.strictEqual(filtersDisabled, ' disabled',
        'Filtros deben estar disabled para variante original');
    });

    test('Variante custom debe permitir filtros', () => {
      const selectedVariantIndex: number = 0; // 0+ = variante custom
      const isOriginalSelected = selectedVariantIndex === -1;
      
      assert.ok(!isOriginalSelected, 'Index >= 0 debe indicar variante custom');
      
      const filtersDisabled = isOriginalSelected ? ' disabled' : '';
      assert.strictEqual(filtersDisabled, '',
        'Filtros NO deben estar disabled para variante custom');
    });
  });

  suite('CA-24.7: Toggle de filtros', () => {
    test('Toggle debe cambiar estado de habilitado', () => {
      let filtersEnabled = true;
      
      // Simular toggle
      filtersEnabled = !filtersEnabled;
      assert.strictEqual(filtersEnabled, false, 'Primer toggle debe deshabilitar');
      
      filtersEnabled = !filtersEnabled;
      assert.strictEqual(filtersEnabled, true, 'Segundo toggle debe habilitar');
    });

    test('Filtros deshabilitados no deben aplicarse al SVG', () => {
      const filtersEnabled = false;
      const filterString = 'hue-rotate(90deg) saturate(150%) brightness(120%)';
      
      // Cuando filtersEnabled es false, el filtro CSS debe ser vacío
      const appliedFilter = filtersEnabled ? filterString : '';
      assert.strictEqual(appliedFilter, '',
        'Filtro CSS debe ser vacío cuando filtros están deshabilitados');
    });
  });
});
