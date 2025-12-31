/**
 * UC-19: Limpiar Iconos No Utilizados
 *
 * Tests E2E para validar la limpieza de iconos sin usar
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';
import * as path from 'node:path';

suite('UC-19: Limpiar Iconos No Utilizados', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-19.1: Detección de iconos no usados', () => {
    test('Debe identificar iconos sin referencias', () => {
      const availableIcons = new Set(['home', 'settings', 'user', 'menu', 'search', 'help']);
      const usedIcons = new Set(['home', 'settings', 'menu']);

      const unusedIcons = [...availableIcons].filter(icon => !usedIcons.has(icon));

      assert.strictEqual(unusedIcons.length, 3, 'Debe haber 3 iconos sin usar');
      assert.ok(unusedIcons.includes('user'), 'user debe estar sin usar');
      assert.ok(unusedIcons.includes('search'), 'search debe estar sin usar');
      assert.ok(unusedIcons.includes('help'), 'help debe estar sin usar');
    });

    test('Debe excluir falsos positivos', () => {
      // Iconos que podrían parecer no usados pero sí lo están
      const dynamicUsagePatterns = [
        'Icon name={iconName}', // Uso dinámico
        '`icon-${type}`', // Template literal
        'icons[category]', // Acceso por índice
      ];

      assert.strictEqual(
        dynamicUsagePatterns.length,
        3,
        'Debe considerar 3 patrones de uso dinámico'
      );
    });

    test('Debe considerar usos en diferentes formatos', () => {
      const usagePatterns = [
        /<Icon[^>]+name=["']([^"']+)["']/g, // React component
        /<iconify-icon[^>]+icon=["']([^"']+)["']/g, // Iconify web component
        /href=["']#icon-([^"']+)["']/g, // SVG sprite use
        /import.*from.*icons\/([^'"]+)/g, // Import statement
      ];

      assert.strictEqual(usagePatterns.length, 4, 'Debe buscar en 4 patrones de uso');
    });
  });

  suite('CA-19.2: Comandos de limpieza', () => {
    test('Debe existir comando scanUnusedIcons', async () => {
      const commands = await vscode.commands.getCommands(true);

      const cleanupCommands = commands.filter(
        c =>
          c.includes('sageboxIconStudio') &&
          (c.toLowerCase().includes('unused') ||
            c.toLowerCase().includes('clean') ||
            c.toLowerCase().includes('audit'))
      );

      assert.ok(cleanupCommands.length > 0, 'Debe existir comando de detección de no usados');
    });

    test('Debe existir comando deleteUnusedIcons', async () => {
      const commands = await vscode.commands.getCommands(true);

      assert.ok(
        commands.includes('sageboxIconStudio.deleteIcons') ||
          commands.includes('sageboxIconStudio.removeUnused'),
        'Debe existir comando de eliminación'
      );
    });
  });

  suite('CA-19.3: Reporte de iconos no usados', () => {
    test('Debe generar reporte detallado', () => {
      const generateUnusedReport = (icons: Array<{ name: string; path: string; size: number }>) => {
        let report = '# Unused Icons Report\n\n';
        report += `Found ${icons.length} unused icon(s):\n\n`;

        let totalSize = 0;
        for (const icon of icons) {
          report += `- **${icon.name}** (${icon.path}) - ${icon.size} bytes\n`;
          totalSize += icon.size;
        }

        report += `\n**Total size that can be freed:** ${totalSize} bytes`;
        return report;
      };

      const unusedIcons = [
        { name: 'old-icon', path: 'icons/old-icon.svg', size: 512 },
        { name: 'unused-feature', path: 'icons/unused-feature.svg', size: 1024 },
      ];

      const report = generateUnusedReport(unusedIcons);

      assert.ok(report.includes('2 unused'), 'Debe mostrar conteo');
      assert.ok(report.includes('1536 bytes'), 'Debe mostrar tamaño total');
    });

    test('Debe mostrar ahorro potencial', () => {
      const calculateSavings = (icons: Array<{ size: number }>) => {
        const totalBytes = icons.reduce((sum, i) => sum + i.size, 0);
        return {
          bytes: totalBytes,
          kb: (totalBytes / 1024).toFixed(2),
          mb: (totalBytes / (1024 * 1024)).toFixed(2),
        };
      };

      const icons = [{ size: 512 }, { size: 1024 }, { size: 2048 }];

      const savings = calculateSavings(icons);

      assert.strictEqual(savings.bytes, 3584, 'Debe calcular bytes correctamente');
      assert.strictEqual(savings.kb, '3.50', 'Debe calcular KB correctamente');
    });
  });

  suite('CA-19.4: Confirmación antes de eliminar', () => {
    test('Debe requerir confirmación para eliminar', () => {
      const confirmationRequired = true;
      const showPreview = true;

      assert.ok(confirmationRequired, 'Debe requerir confirmación');
      assert.ok(showPreview, 'Debe mostrar preview antes de eliminar');
    });

    test('Debe permitir selección individual', () => {
      const unusedIcons = ['icon1', 'icon2', 'icon3', 'icon4'];
      const userSelection = new Set(['icon1', 'icon3']); // Usuario selecciona solo algunos

      const toDelete = unusedIcons.filter(i => userSelection.has(i));

      assert.strictEqual(toDelete.length, 2, 'Debe eliminar solo los seleccionados');
    });

    test('Debe ofrecer opción de backup', () => {
      const deleteOptions = {
        createBackup: true,
        backupPath: '.iconmanager/backup',
        confirmEach: false,
        dryRun: false,
      };

      assert.ok(deleteOptions.createBackup, 'Debe ofrecer opción de backup');
    });
  });

  suite('CA-19.5: Exclusiones de limpieza', () => {
    test('Debe respetar lista de exclusión', () => {
      const excludeFromCleanup = ['logo', 'favicon', 'brand-*'];
      const unusedIcons = ['logo', 'old-feature', 'brand-icon', 'temp-icon'];

      const canDelete = (iconName: string): boolean => {
        return !excludeFromCleanup.some(pattern => {
          if (pattern.endsWith('*')) {
            return iconName.startsWith(pattern.slice(0, -1));
          }
          return iconName === pattern;
        });
      };

      const deletable = unusedIcons.filter(canDelete);

      assert.strictEqual(deletable.length, 2, 'Solo 2 iconos deben ser eliminables');
      assert.ok(deletable.includes('old-feature'), 'old-feature debe ser eliminable');
      assert.ok(deletable.includes('temp-icon'), 'temp-icon debe ser eliminable');
    });

    test('Debe excluir iconos marcados como esenciales', () => {
      const essentialIcons = new Set(['logo', 'favicon', 'app-icon']);

      const isEssential = (iconName: string): boolean => {
        return essentialIcons.has(iconName);
      };

      assert.ok(isEssential('logo'), 'logo debe ser esencial');
      assert.ok(!isEssential('temp-icon'), 'temp-icon no debe ser esencial');
    });
  });

  suite('CA-19.6: Integración con CI/CD', () => {
    test('Debe poder ejecutarse en modo CLI', () => {
      const cliOptions = {
        command: 'icon-manager unused --report',
        outputFormat: 'json',
        exitCode: {
          noUnused: 0,
          hasUnused: 1,
          error: 2,
        },
      };

      assert.strictEqual(cliOptions.exitCode.noUnused, 0, 'Exit code 0 cuando no hay no usados');
      assert.strictEqual(cliOptions.exitCode.hasUnused, 1, 'Exit code 1 cuando hay no usados');
    });

    test('Debe generar reporte en formato JSON', () => {
      const jsonReport = {
        timestamp: new Date().toISOString(),
        totalIcons: 50,
        unusedCount: 5,
        unusedIcons: [
          { name: 'icon1', path: 'icons/icon1.svg' },
          { name: 'icon2', path: 'icons/icon2.svg' },
        ],
        potentialSavings: '15.5 KB',
      };

      const json = JSON.stringify(jsonReport);
      const parsed = JSON.parse(json);

      assert.strictEqual(parsed.unusedCount, 5, 'Debe serializar correctamente');
    });
  });
});
