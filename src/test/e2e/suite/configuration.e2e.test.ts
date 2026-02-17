/**
 * Configuration E2E Tests
 *
 * Tests para validar que todas las configuraciones de la extensión
 * funcionan correctamente y persisten adecuadamente
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Configuration E2E Tests', () => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Guardar valores originales para restaurar
  const originalValues: Record<string, unknown> = {};

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suiteTeardown(async () => {
    // Restaurar valores originales
    const config = vscode.workspace.getConfiguration('iconStudio');
    for (const [key, value] of Object.entries(originalValues)) {
      await config.update(key, value, vscode.ConfigurationTarget.Global);
    }
  });

  suite('Language Configuration', () => {
    test('Debe tener configuración language', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const language = config.get<string>('language');

      assert.ok(
        language === undefined || typeof language === 'string',
        'Language debe ser string o undefined'
      );
    });

    test('Debe aceptar valores válidos de idioma', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const validLanguages = ['auto', 'en', 'es', 'zh', 'ru'];

      for (const lang of validLanguages) {
        await config.update('language', lang, vscode.ConfigurationTarget.Global);
        await delay(100);

        const current = vscode.workspace
          .getConfiguration('iconStudio')
          .get<string>('language');
        assert.strictEqual(current, lang, `Idioma ${lang} debe ser aceptado`);
      }

      // Restaurar
      await config.update('language', 'auto', vscode.ConfigurationTarget.Global);
    });
  });

  suite('Component Configuration', () => {
    test('componentName debe tener valor por defecto', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const componentName = config.get<string>('componentName', 'sg-icon');

      assert.ok(typeof componentName === 'string', 'componentName debe ser string');
      assert.ok(componentName.length > 0, 'componentName no debe estar vacío');
    });

    test('componentImport debe tener valor por defecto', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const componentImport = config.get<string>('componentImport', '@/components/ui/Icon');

      assert.ok(typeof componentImport === 'string', 'componentImport debe ser string');
    });

    test('Debe poder cambiar componentName', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      originalValues['componentName'] = config.get<string>('componentName');

      await config.update('componentName', 'custom-icon', vscode.ConfigurationTarget.Global);
      await delay(100);

      const updated = vscode.workspace
        .getConfiguration('iconStudio')
        .get<string>('componentName');
      assert.strictEqual(updated, 'custom-icon', 'ComponentName debe actualizarse');
    });
  });

  suite('SVG Folders Configuration', () => {
    test('svgFolders debe ser array', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const folders = config.get<string[]>('svgFolders', []);

      assert.ok(Array.isArray(folders), 'svgFolders debe ser array');
    });

    test('svgFolders debe tener valores por defecto', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const folders = config.get<string[]>('svgFolders', []);

      assert.ok(folders.length > 0, 'Debe tener carpetas por defecto');
    });

    test('Debe poder agregar carpetas personalizadas', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      originalValues['svgFolders'] = config.get<string[]>('svgFolders');

      const customFolders = ['my-icons', 'custom-svgs'];
      await config.update('svgFolders', customFolders, vscode.ConfigurationTarget.Global);
      await delay(100);

      const updated = vscode.workspace
        .getConfiguration('iconStudio')
        .get<string[]>('svgFolders');
      assert.deepStrictEqual(updated, customFolders, 'Carpetas deben actualizarse');
    });
  });

  suite('Output Configuration', () => {
    test('outputFormat debe tener valores válidos', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const format = config.get<string>('outputFormat', 'jsx');

      const validFormats = ['jsx', 'vue', 'svelte', 'astro', 'html'];
      assert.ok(validFormats.includes(format), `Formato ${format} debe ser válido`);
    });

    test('outputDirectory puede estar vacío', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const outputDir = config.get<string>('outputDirectory', '');

      assert.ok(typeof outputDir === 'string', 'outputDirectory debe ser string');
    });

    test('buildFormat debe tener valores válidos', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const buildFormat = config.get<string>('buildFormat', '');

      const validFormats = ['', 'icons.js', 'sprite.svg'];
      assert.ok(
        validFormats.includes(buildFormat),
        `BuildFormat ${buildFormat} debe ser válido`
      );
    });
  });

  suite('Icon Size Configuration', () => {
    test('defaultIconSize debe ser número', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const size = config.get<number>('defaultIconSize', 24);

      assert.ok(typeof size === 'number', 'defaultIconSize debe ser número');
    });

    test('defaultIconSize debe estar en rango válido', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const size = config.get<number>('defaultIconSize', 24);

      assert.ok(size >= 8, 'Tamaño mínimo debe ser 8');
      assert.ok(size <= 512, 'Tamaño máximo debe ser 512');
    });

    test('Debe poder cambiar defaultIconSize', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      originalValues['defaultIconSize'] = config.get<number>('defaultIconSize');

      await config.update('defaultIconSize', 48, vscode.ConfigurationTarget.Global);
      await delay(100);

      const updated = vscode.workspace
        .getConfiguration('iconStudio')
        .get<number>('defaultIconSize');
      assert.strictEqual(updated, 48, 'DefaultIconSize debe actualizarse');
    });
  });

  suite('SVGO Configuration', () => {
    test('svgoOptimize debe ser boolean', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const optimize = config.get<boolean>('svgoOptimize', true);

      assert.ok(typeof optimize === 'boolean', 'svgoOptimize debe ser boolean');
    });

    test('svgoRemoveViewBox debe ser boolean', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const removeViewBox = config.get<boolean>('svgoRemoveViewBox', false);

      assert.ok(typeof removeViewBox === 'boolean', 'svgoRemoveViewBox debe ser boolean');
    });

    test('svgoRemoveColors debe ser boolean', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const removeColors = config.get<boolean>('svgoRemoveColors', false);

      assert.ok(typeof removeColors === 'boolean', 'svgoRemoveColors debe ser boolean');
    });
  });

  suite('Preview Configuration', () => {
    test('previewBackground debe tener valor válido', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const background = config.get<string>('previewBackground', 'checkered');

      const validBackgrounds = ['transparent', 'light', 'dark', 'checkered'];
      assert.ok(
        validBackgrounds.includes(background),
        `Background ${background} debe ser válido`
      );
    });

    test('Debe poder cambiar previewBackground', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      originalValues['previewBackground'] = config.get<string>('previewBackground');

      await config.update('previewBackground', 'dark', vscode.ConfigurationTarget.Global);
      await delay(100);

      const updated = vscode.workspace
        .getConfiguration('iconStudio')
        .get<string>('previewBackground');
      assert.strictEqual(updated, 'dark', 'Background debe actualizarse');
    });
  });

  suite('Naming Convention Configuration', () => {
    test('namingConvention debe tener valor válido', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const convention = config.get<string>('namingConvention', 'kebab-case');

      const validConventions = ['kebab-case', 'camelCase', 'PascalCase', 'snake_case'];
      assert.ok(
        validConventions.includes(convention),
        `Convención ${convention} debe ser válida`
      );
    });
  });

  suite('Auto Features Configuration', () => {
    test('autoImport debe ser boolean', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const autoImport = config.get<boolean>('autoImport', true);

      assert.ok(typeof autoImport === 'boolean', 'autoImport debe ser boolean');
    });

    test('deleteAfterBuild debe ser boolean', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const deleteAfter = config.get<boolean>('deleteAfterBuild', false);

      assert.ok(typeof deleteAfter === 'boolean', 'deleteAfterBuild debe ser boolean');
    });
  });

  suite('Animation Configuration', () => {
    test('defaultAnimation debe tener valor válido', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const animation = config.get<string>('defaultAnimation', 'none');

      assert.ok(typeof animation === 'string', 'defaultAnimation debe ser string');
    });
  });

  suite('Configuration Scopes', () => {
    test('Configuración global debe funcionar', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');

      await config.update('webComponentName', 'test-global', vscode.ConfigurationTarget.Global);
      await delay(100);

      const value = vscode.workspace
        .getConfiguration('iconStudio')
        .get<string>('webComponentName');
      assert.strictEqual(value, 'test-global', 'Configuración global debe aplicarse');

      // Limpiar
      await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Configuración de workspace debe tener prioridad', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');

      // Establecer global
      await config.update('webComponentName', 'global-value', vscode.ConfigurationTarget.Global);
      await delay(100);

      // Establecer workspace (debe tener prioridad)
      await config.update('webComponentName', 'workspace-value', vscode.ConfigurationTarget.Workspace);
      await delay(100);

      const value = vscode.workspace
        .getConfiguration('iconStudio')
        .get<string>('webComponentName');

      // Workspace tiene prioridad sobre global
      assert.strictEqual(
        value,
        'workspace-value',
        'Configuración de workspace debe tener prioridad'
      );

      // Limpiar
      await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Workspace);
      await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
    });
  });

  suite('Configuration Inspection', () => {
    test('Debe poder inspeccionar configuración', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const inspection = config.inspect<string>('componentName');

      assert.ok(inspection, 'Debe poder inspeccionar configuración');
      assert.ok(
        inspection.defaultValue !== undefined,
        'Debe tener valor por defecto'
      );
    });
  });
});
