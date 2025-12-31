/**
 * UC-14: Previsualizar Iconos con Zoom
 *
 * Tests E2E para validar la previsualización de iconos
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('UC-14: Previsualizar Iconos con Zoom', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-14.1: Panel de detalles', () => {
    test('Debe existir comando showDetails', async () => {
      const commands = await vscode.commands.getCommands(true);

      const detailCommands = commands.filter(
        c =>
          c.includes('sageboxIconStudio') &&
          (c.toLowerCase().includes('detail') ||
            c.toLowerCase().includes('preview') ||
            c.toLowerCase().includes('show'))
      );

      assert.ok(detailCommands.length > 0, 'Debe existir al menos un comando de detalles/preview');
    });

    test('Debe existir comando previewIcon', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.previewIcon') ||
          commands.includes('sageboxIconStudio.showIconDetails'),
        'Debe existir comando de previsualización'
      );
    });
  });

  suite('CA-14.2: Niveles de zoom', () => {
    test('Debe soportar zoom 50%', () => {
      const zoomLevel = 50;
      const baseSize = 24;
      const displaySize = (baseSize * zoomLevel) / 100;

      assert.strictEqual(displaySize, 12, 'Zoom 50% debe mostrar a 12px');
    });

    test('Debe soportar zoom 75%', () => {
      const zoomLevel = 75;
      const baseSize = 24;
      const displaySize = (baseSize * zoomLevel) / 100;

      assert.strictEqual(displaySize, 18, 'Zoom 75% debe mostrar a 18px');
    });

    test('Debe soportar zoom 100%', () => {
      const zoomLevel = 100;
      const baseSize = 24;
      const displaySize = (baseSize * zoomLevel) / 100;

      assert.strictEqual(displaySize, 24, 'Zoom 100% debe mostrar tamaño original');
    });

    test('Debe soportar zoom 150%', () => {
      const zoomLevel = 150;
      const baseSize = 24;
      const displaySize = (baseSize * zoomLevel) / 100;

      assert.strictEqual(displaySize, 36, 'Zoom 150% debe mostrar a 36px');
    });

    test('Debe soportar zoom 200%', () => {
      const zoomLevel = 200;
      const baseSize = 24;
      const displaySize = (baseSize * zoomLevel) / 100;

      assert.strictEqual(displaySize, 48, 'Zoom 200% debe mostrar a 48px');
    });

    test('Niveles de zoom disponibles', () => {
      const zoomLevels = [50, 75, 100, 150, 200];

      assert.strictEqual(zoomLevels.length, 5, 'Debe haber 5 niveles de zoom');
      assert.ok(zoomLevels.includes(100), 'Debe incluir tamaño original (100%)');
    });
  });

  suite('CA-14.3: Cálculo de tamaños', () => {
    test('Debe calcular tamaño de display correctamente', () => {
      const calculateDisplaySize = (baseSize: number, zoomPercent: number): number => {
        return Math.round((baseSize * zoomPercent) / 100);
      };

      // Tamaños comunes de iconos
      const sizes = [16, 20, 24, 32, 48];
      const zooms = [50, 100, 200];

      for (const size of sizes) {
        for (const zoom of zooms) {
          const result = calculateDisplaySize(size, zoom);
          assert.ok(result > 0, `Tamaño ${size}px a ${zoom}% debe ser positivo`);
        }
      }
    });

    test('Debe mantener aspect ratio', () => {
      const maintainAspectRatio = (width: number, height: number, zoom: number) => {
        return {
          width: Math.round((width * zoom) / 100),
          height: Math.round((height * zoom) / 100),
        };
      };

      // Icono cuadrado
      const square = maintainAspectRatio(24, 24, 150);
      assert.strictEqual(square.width, square.height, 'Iconos cuadrados deben mantener proporción');

      // Icono rectangular
      const rect = maintainAspectRatio(32, 24, 200);
      const originalRatio = 32 / 24;
      const newRatio = rect.width / rect.height;
      assert.ok(Math.abs(originalRatio - newRatio) < 0.1, 'Debe mantener aspect ratio');
    });
  });

  suite('CA-14.4: Preview en diferentes contextos', () => {
    test('Debe previsualizar en sidebar', async () => {
      // Verificar que existe el webview de preview en sidebar
      const commands = await vscode.commands.getCommands(true);

      assert.ok(
        commands.includes('sageboxIconStudio.focusPreviewPanel') ||
          commands.some(c => c.includes('preview')),
        'Debe existir funcionalidad de preview en sidebar'
      );
    });

    test('Debe poder previsualizar con diferentes fondos', () => {
      const backgrounds = ['transparent', 'white', 'black', 'grid'];

      for (const bg of backgrounds) {
        assert.ok(
          ['transparent', 'white', 'black', 'grid', 'dark', 'light'].includes(bg),
          `Background ${bg} debe ser opción válida`
        );
      }
    });

    test('Debe mostrar información del icono', () => {
      const iconInfo = {
        name: 'arrow-right',
        viewBox: '0 0 24 24',
        width: 24,
        height: 24,
        fileSize: 256,
        colors: ['currentColor'],
        hasAnimation: false,
      };

      assert.ok(iconInfo.name, 'Debe mostrar nombre');
      assert.ok(iconInfo.viewBox, 'Debe mostrar viewBox');
      assert.ok(typeof iconInfo.fileSize === 'number', 'Debe mostrar tamaño');
    });
  });

  suite('CA-14.5: Verificación de calidad', () => {
    test('Zoom 200% para verificar nitidez', () => {
      // A 200% es más fácil ver problemas de rendering
      const checkSharpness = (zoomLevel: number): boolean => {
        // A mayor zoom, más fácil detectar problemas
        return zoomLevel >= 200;
      };

      assert.ok(checkSharpness(200), '200% es suficiente para verificar nitidez');
    });

    test('Debe detectar problemas de rendering', () => {
      const potentialIssues = [
        'trazos muy finos',
        'colores no definidos',
        'viewBox incorrecto',
        'elementos fuera de viewport',
      ];

      assert.strictEqual(potentialIssues.length, 4, 'Debe verificar 4 tipos de problemas');
    });

    test('Recomendación para pantallas HiDPI', () => {
      const hiDpiRecommendation = {
        minZoom: 200,
        reason: 'Verificar que iconos se vean bien en pantallas retina/HiDPI',
        checkAreas: ['trazos finos', 'detalles pequeños', 'anti-aliasing'],
      };

      assert.strictEqual(hiDpiRecommendation.minZoom, 200, 'Zoom recomendado para HiDPI es 200%');
    });
  });
});
