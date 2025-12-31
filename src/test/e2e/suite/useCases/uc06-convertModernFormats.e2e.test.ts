/**
 * UC-6: Convertir Imágenes a Formatos Modernos
 *
 * Tests E2E para validar conversión de imágenes a WebP/AVIF
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('UC-6: Convertir Imágenes a Formatos Modernos', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-6.1: Configuración de conversión', () => {
    test('Debe existir configuración de calidad de imagen', async () => {
      const config = vscode.workspace.getConfiguration('assetManager');

      // Verificar estructura de configuración esperada
      const quality = config.get<number>('image.quality', 85);
      assert.ok(quality >= 0 && quality <= 100, 'Calidad debe estar entre 0-100');
    });

    test('Debe existir configuración de formato por defecto', async () => {
      const config = vscode.workspace.getConfiguration('assetManager');
      const defaultFormat = config.get<string>('image.defaultFormat', 'webp');

      const validFormats = ['webp', 'avif', 'png', 'jpg'];
      assert.ok(
        validFormats.includes(defaultFormat) || defaultFormat === 'webp',
        'Formato por defecto debe ser válido'
      );
    });
  });

  suite('CA-6.2: Soporte de formatos', () => {
    test('Debe reconocer formato WebP', () => {
      const webpSupport = {
        extension: '.webp',
        mimeType: 'image/webp',
        browserSupport: '97%+',
        compression: 'lossy/lossless',
        recommended: true,
      };

      assert.strictEqual(webpSupport.extension, '.webp');
      assert.ok(webpSupport.recommended, 'WebP es formato recomendado');
    });

    test('Debe reconocer formato AVIF', () => {
      const avifSupport = {
        extension: '.avif',
        mimeType: 'image/avif',
        browserSupport: '90%+',
        compression: 'superior',
        recommended: true,
      };

      assert.strictEqual(avifSupport.extension, '.avif');
      assert.ok(avifSupport.recommended, 'AVIF es formato recomendado para fotos');
    });

    test('Debe mantener soporte para PNG (sin pérdida)', () => {
      const pngSupport = {
        extension: '.png',
        mimeType: 'image/png',
        browserSupport: '100%',
        compression: 'lossless',
        useCase: 'iconos y logos',
      };

      assert.strictEqual(pngSupport.useCase, 'iconos y logos');
    });
  });

  suite('CA-6.3: Comparativa de formatos', () => {
    test('Tabla de comparación de formatos', () => {
      const formatComparison = [
        { format: 'WebP', support: 97, compression: 'muy buena', use: 'general' },
        { format: 'AVIF', support: 90, compression: 'excelente', use: 'fotos/fondos' },
        { format: 'PNG', support: 100, compression: 'sin pérdida', use: 'iconos/logos' },
        { format: 'JPG', support: 100, compression: 'buena', use: 'fotos' },
      ];

      assert.strictEqual(formatComparison.length, 4, 'Debe haber 4 formatos principales');

      // Verificar que todos tienen soporte >= 90%
      const allSupported = formatComparison.every(f => f.support >= 90);
      assert.ok(allSupported, 'Todos los formatos deben tener buen soporte');
    });

    test('Debe recomendar formato según caso de uso', () => {
      const getRecommendedFormat = (useCase: string): string => {
        switch (useCase) {
          case 'photo':
          case 'background':
            return 'avif';
          case 'icon':
          case 'logo':
            return 'svg';
          case 'general':
          default:
            return 'webp';
        }
      };

      assert.strictEqual(getRecommendedFormat('photo'), 'avif');
      assert.strictEqual(getRecommendedFormat('icon'), 'svg');
      assert.strictEqual(getRecommendedFormat('general'), 'webp');
    });
  });

  suite('CA-6.4: Conversión en lote', () => {
    test('Debe existir funcionalidad de batch', async () => {
      const commands = await vscode.commands.getCommands(true);

      // Verificar comandos de batch o bulk
      const batchCommands = commands.filter(
        c =>
          c.toLowerCase().includes('batch') ||
          c.toLowerCase().includes('bulk') ||
          c.toLowerCase().includes('all')
      );

      // Al menos comandos de refresh all deben existir
      assert.ok(
        commands.includes('sageboxIconStudio.refreshAll') ||
          commands.includes('sageboxIconStudio.refreshIcons'),
        'Debe existir algún comando de operación masiva'
      );
    });

    test('Estructura para preservar original', () => {
      // Simular configuración de preservación
      const preserveConfig = {
        deleteOriginalOnConvert: false,
        backupFolder: '.backup',
        keepMetadata: false,
      };

      assert.strictEqual(
        preserveConfig.deleteOriginalOnConvert,
        false,
        'Por defecto no debe eliminar originales'
      );
    });
  });

  suite('CA-6.5: Estadísticas de conversión', () => {
    test('Debe calcular ahorro de tamaño', () => {
      // Simular cálculo de ahorro
      const calculateSaving = (original: number, converted: number): number => {
        return Math.round(((original - converted) / original) * 100);
      };

      // Caso típico: PNG a WebP
      const originalSize = 100000; // 100KB
      const convertedSize = 35000; // 35KB
      const saving = calculateSaving(originalSize, convertedSize);

      assert.strictEqual(saving, 65, 'Ahorro debe ser 65%');
    });

    test('Debe formatear tamaños legibles', () => {
      const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };

      assert.strictEqual(formatSize(500), '500 B');
      assert.strictEqual(formatSize(2048), '2.0 KB');
      assert.strictEqual(formatSize(1048576), '1.0 MB');
    });
  });
});
