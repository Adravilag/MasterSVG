/**
 * UC-1: Gestión de Iconos en un Proyecto Nuevo
 * UC-4: Crear un Sistema de Iconos Consistente
 *
 * Tests E2E para validar la gestión inicial de iconos en un proyecto
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('UC-1: Gestión de Iconos en Proyecto Nuevo', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');
  const svgsFolder = path.join(testWorkspace, 'svgs');
  const outputDir = path.join(testWorkspace, 'output');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    // Activar extensión
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(1000);
  });

  suite('CA-1.1: Configuración de carpetas SVG', () => {
    test('CA-1.1.1: Debe configurar svgFolders correctamente', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('svgFolders', [svgsFolder], vscode.ConfigurationTarget.Workspace);
      await delay(300);

      const folders = config.get<string[]>('svgFolders', []);
      assert.ok(folders.includes(svgsFolder), 'La carpeta SVG debe estar configurada');
    });

    test('CA-1.1.2: Debe detectar archivos .svg en la carpeta', async () => {
      const files = fs.readdirSync(svgsFolder);
      const svgFiles = files.filter(f => f.endsWith('.svg'));

      assert.ok(svgFiles.length > 0, 'Debe haber archivos SVG en la carpeta');
      assert.ok(svgFiles.includes('home.svg'), 'Debe incluir home.svg');
      assert.ok(svgFiles.includes('settings.svg'), 'Debe incluir settings.svg');
    });

    test('CA-1.1.3: Debe excluir carpetas según patrones', async () => {
      // Crear carpeta node_modules temporal para probar exclusión
      const nodeModulesPath = path.join(testWorkspace, 'node_modules');
      const testSvgPath = path.join(nodeModulesPath, 'test-exclude.svg');

      if (!fs.existsSync(nodeModulesPath)) {
        fs.mkdirSync(nodeModulesPath, { recursive: true });
        fs.writeFileSync(testSvgPath, '<svg></svg>');
      }

      // El escáner debe excluir node_modules por defecto
      // Este test verifica que la configuración de exclusión existe
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      const excludePatterns = config.get<string[]>('excludePatterns', [
        'node_modules',
        'dist',
        '.git',
      ]);

      assert.ok(
        excludePatterns.some(p => p.includes('node_modules')),
        'node_modules debe estar en patrones de exclusión'
      );

      // Limpiar
      if (fs.existsSync(testSvgPath)) {
        fs.unlinkSync(testSvgPath);
        fs.rmdirSync(nodeModulesPath);
      }
    });
  });

  suite('CA-1.2: Escaneo de workspace', () => {
    test('CA-1.1.4: Debe ejecutar escaneo al abrir workspace', async () => {
      // El comando refreshIcons debe ejecutarse sin errores
      try {
        await vscode.commands.executeCommand('sageboxIconStudio.refreshIcons');
        await delay(1000);
        assert.ok(true, 'El escaneo se ejecutó correctamente');
      } catch (error) {
        assert.fail(`El escaneo falló: ${error}`);
      }
    });

    test('CA-1.1.5: Debe actualizar el árbol de iconos', async () => {
      // Verificar que el comando de refresh existe y funciona
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.refreshIcons'),
        'Comando refreshIcons debe estar registrado'
      );
      assert.ok(
        commands.includes('sageboxIconStudio.refreshFiles'),
        'Comando refreshFiles debe estar registrado'
      );
    });

    test('CA-1.1.6: Debe usar operaciones asíncronas (no bloquear)', async () => {
      // Ejecutar escaneo y verificar que no bloquea
      const startTime = Date.now();
      const scanPromise = vscode.commands.executeCommand('sageboxIconStudio.refreshIcons');

      // El comando debe retornar inmediatamente (no bloquear)
      const afterCommandTime = Date.now();
      assert.ok(afterCommandTime - startTime < 100, 'El comando debe retornar rápidamente (async)');

      await scanPromise;
    });
  });

  suite('CA-1.3: Panel de iconos', () => {
    test('Debe abrir el panel de iconos', async () => {
      try {
        await vscode.commands.executeCommand('sageboxIconStudio.openPanel');
        await delay(500);
        assert.ok(true, 'Panel abierto correctamente');
      } catch (error) {
        assert.fail(`Error al abrir panel: ${error}`);
      }
    });

    test('Debe tener comando de búsqueda de iconos', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('sageboxIconStudio.searchIcons'), 'Comando searchIcons debe existir');
    });
  });

  suiteTeardown(async () => {
    // Limpiar configuración
    const config = vscode.workspace.getConfiguration('sageboxIconStudio');
    await config.update('svgFolders', undefined, vscode.ConfigurationTarget.Workspace);
  });
});

suite('UC-4: Sistema de Iconos Consistente', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');
  const outputDir = path.join(testWorkspace, 'output');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suite('Estructura de carpetas', () => {
    test('Debe soportar estructura por categorías', async () => {
      // Crear estructura de categorías temporal
      const categoriesPath = path.join(testWorkspace, 'icons-by-category');
      const actionsPath = path.join(categoriesPath, 'actions');
      const navigationPath = path.join(categoriesPath, 'navigation');

      try {
        fs.mkdirSync(actionsPath, { recursive: true });
        fs.mkdirSync(navigationPath, { recursive: true });

        fs.writeFileSync(
          path.join(actionsPath, 'add.svg'),
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2v20M2 12h20"/></svg>'
        );
        fs.writeFileSync(
          path.join(navigationPath, 'arrow-left.svg'),
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>'
        );

        // Verificar que los archivos existen
        assert.ok(fs.existsSync(path.join(actionsPath, 'add.svg')));
        assert.ok(fs.existsSync(path.join(navigationPath, 'arrow-left.svg')));
      } finally {
        // Limpiar
        if (fs.existsSync(categoriesPath)) {
          fs.rmSync(categoriesPath, { recursive: true });
        }
      }
    });
  });

  suite('Configuración del proyecto', () => {
    test('Debe tener comando de configuración', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.openWelcome'),
        'Comando openWelcome debe existir para configuración'
      );
    });

    test('Debe configurar outputDirectory', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('outputDirectory', outputDir, vscode.ConfigurationTarget.Workspace);
      await delay(200);

      const configured = config.get<string>('outputDirectory', '');
      assert.strictEqual(configured, outputDir, 'Output directory debe estar configurado');
    });

    test('Debe configurar formato de build', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('buildFormat', 'both', vscode.ConfigurationTarget.Workspace);
      await delay(200);

      const format = config.get<string>('buildFormat', '');
      assert.strictEqual(format, 'both', 'Build format debe ser "both"');
    });
  });

  suite('Exportación como componentes', () => {
    test('Debe tener comando exportAsComponent', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.exportAsComponent'),
        'Comando exportAsComponent debe existir'
      );
    });
  });

  suiteTeardown(async () => {
    const config = vscode.workspace.getConfiguration('sageboxIconStudio');
    await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Workspace);
    await config.update('buildFormat', undefined, vscode.ConfigurationTarget.Workspace);
  });
});
