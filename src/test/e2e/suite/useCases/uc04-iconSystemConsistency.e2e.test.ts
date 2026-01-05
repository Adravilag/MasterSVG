/**
 * UC-4: Crear un Sistema de Iconos Consistente
 *
 * Tests E2E para validar la creación de sistemas de iconos uniformes
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('UC-4: Crear un Sistema de Iconos Consistente', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');
  const iconsFolder = path.join(testWorkspace, 'icons-system');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }

    // Crear estructura de carpetas para sistema de iconos
    const folders = ['actions', 'navigation', 'social'];
    for (const folder of folders) {
      const folderPath = path.join(iconsFolder, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    }

    // Crear iconos de prueba
    const baseSvg = (name: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>${name}</title><path d="M12 2L2 22h20z"/></svg>`;

    fs.writeFileSync(path.join(iconsFolder, 'actions', 'add.svg'), baseSvg('add'));
    fs.writeFileSync(path.join(iconsFolder, 'actions', 'delete.svg'), baseSvg('delete'));
    fs.writeFileSync(path.join(iconsFolder, 'actions', 'edit.svg'), baseSvg('edit'));
    fs.writeFileSync(path.join(iconsFolder, 'navigation', 'arrow-left.svg'), baseSvg('arrow-left'));
    fs.writeFileSync(path.join(iconsFolder, 'navigation', 'menu.svg'), baseSvg('menu'));
    fs.writeFileSync(path.join(iconsFolder, 'social', 'github.svg'), baseSvg('github'));

    await delay(500);
  });

  suiteTeardown(async () => {
    // Limpiar estructura de prueba
    if (fs.existsSync(iconsFolder)) {
      fs.rmSync(iconsFolder, { recursive: true, force: true });
    }
  });

  suite('CA-4.1: Estructura de carpetas', () => {
    test('Debe soportar estructura jerárquica de carpetas', () => {
      const actionsPath = path.join(iconsFolder, 'actions');
      const navPath = path.join(iconsFolder, 'navigation');
      const socialPath = path.join(iconsFolder, 'social');

      assert.ok(fs.existsSync(actionsPath), 'Carpeta actions debe existir');
      assert.ok(fs.existsSync(navPath), 'Carpeta navigation debe existir');
      assert.ok(fs.existsSync(socialPath), 'Carpeta social debe existir');
    });

    test('Debe detectar iconos en subcarpetas', () => {
      const actionsIcons = fs.readdirSync(path.join(iconsFolder, 'actions'));
      const svgFiles = actionsIcons.filter(f => f.endsWith('.svg'));

      assert.strictEqual(svgFiles.length, 3, 'Actions debe tener 3 iconos');
      assert.ok(svgFiles.includes('add.svg'), 'Debe incluir add.svg');
      assert.ok(svgFiles.includes('delete.svg'), 'Debe incluir delete.svg');
      assert.ok(svgFiles.includes('edit.svg'), 'Debe incluir edit.svg');
    });

    test('Debe mantener categorización por carpeta', () => {
      // Verificar que los iconos mantienen su organización
      const navIcons = fs.readdirSync(path.join(iconsFolder, 'navigation'));
      const socialIcons = fs.readdirSync(path.join(iconsFolder, 'social'));

      assert.ok(navIcons.includes('arrow-left.svg'), 'Navigation debe incluir arrow-left');
      assert.ok(navIcons.includes('menu.svg'), 'Navigation debe incluir menu');
      assert.ok(socialIcons.includes('github.svg'), 'Social debe incluir github');
    });
  });

  suite('CA-4.2: Configuración de proyecto', () => {
    test('Debe existir comando configureProject', async () => {
      const commands = await vscode.commands.getCommands(true);
      // Verificar comandos de configuración relacionados
      const configCommands = commands.filter(
        c => c.includes('masterSVG') && (c.includes('config') || c.includes('Config'))
      );
      assert.ok(configCommands.length > 0, 'Debe haber comandos de configuración');
    });

    test('Debe poder configurar múltiples carpetas SVG', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      await config.update(
        'svgFolders',
        [
          path.join(iconsFolder, 'actions'),
          path.join(iconsFolder, 'navigation'),
          path.join(iconsFolder, 'social'),
        ],
        vscode.ConfigurationTarget.Workspace
      );

      await delay(300);

      const folders = config.get<string[]>('svgFolders', []);
      assert.ok(folders.length >= 3, 'Debe tener al menos 3 carpetas configuradas');
    });

    test('Debe soportar convenciones de nombres', async () => {
      // Los nombres de iconos deben seguir convención kebab-case
      const allIcons = [
        ...fs.readdirSync(path.join(iconsFolder, 'actions')),
        ...fs.readdirSync(path.join(iconsFolder, 'navigation')),
        ...fs.readdirSync(path.join(iconsFolder, 'social')),
      ].filter(f => f.endsWith('.svg'));

      const kebabCaseRegex = /^[a-z]+(-[a-z]+)*\.svg$/;
      const validNames = allIcons.filter(name => kebabCaseRegex.test(name));

      assert.strictEqual(
        validNames.length,
        allIcons.length,
        'Todos los iconos deben seguir convención kebab-case'
      );
    });
  });

  suite('CA-4.3: Exportación consistente', () => {
    test('Debe existir comando exportAsComponent', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.exportComponent'),
        'Comando exportComponent debe existir'
      );
    });

    test('Debe poder seleccionar framework de salida', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      const supportedFormats = ['jsx', 'tsx', 'vue', 'svelte', 'astro', 'html'];

      for (const format of supportedFormats) {
        await config.update('outputFormat', format, vscode.ConfigurationTarget.Workspace);
        const currentFormat = config.get<string>('outputFormat');
        assert.strictEqual(currentFormat, format, `Debe soportar formato ${format}`);
      }
    });
  });

  suite('CA-4.4: Documentación visual', () => {
    test('Debe existir comando openPanel para catálogo visual', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.openPanel'),
        'Comando openPanel debe existir para visualizar catálogo'
      );
    });

    test('Debe poder abrir panel sin errores', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.openPanel');
        await delay(500);
        assert.ok(true, 'Panel abierto correctamente');
      } catch (error) {
        assert.fail(`Error al abrir panel: ${error}`);
      }
    });
  });
});
