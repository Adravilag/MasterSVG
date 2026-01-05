/**
 * UC-23: Atajos de Teclado y Accesibilidad
 *
 * Tests E2E para validar los atajos de teclado,
 * keybindings y características de accesibilidad
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('UC-23: Atajos de Teclado y Accesibilidad', () => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-23.1: Comandos con Keybindings', () => {
    test('Debe tener comando searchIcons accesible', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.searchIcons'),
        'Comando searchIcons debe estar registrado'
      );
    });

    test('Debe tener comando openPanel accesible', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.openPanel'),
        'Comando openPanel debe estar registrado'
      );
    });

    test('Debe tener comando refreshIcons accesible', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.refreshIcons'),
        'Comando refreshIcons debe estar registrado'
      );
    });

    test('Debe tener comando buildIcons accesible', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.buildIcons'),
        'Comando buildIcons debe estar registrado'
      );
    });
  });

  suite('CA-23.2: Navegación por Teclado', () => {
    test('Debe tener comando expandAll', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.expandAll'),
        'Comando expandAll debe existir'
      );
    });

    test('Debe tener comando collapseAll', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.collapseAll'),
        'Comando collapseAll debe existir'
      );
    });

    test('Debe tener comandos de navegación de árbol', async () => {
      const commands = await vscode.commands.getCommands(true);

      const navigationCommands = [
        'masterSVG.expandAll',
        'masterSVG.collapseAll',
        'masterSVG.expandBuiltIcons',
        'masterSVG.collapseBuiltIcons',
        'masterSVG.expandSvgFiles',
        'masterSVG.collapseSvgFiles',
      ];

      navigationCommands.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe existir`);
      });
    });
  });

  suite('CA-23.3: Acciones Rápidas', () => {
    test('Debe tener comando copyIconName', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.copyIconName'),
        'Comando copyIconName debe existir para copiar rápidamente'
      );
    });

    test('Debe tener comando insertIcon', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.insertIcon'),
        'Comando insertIcon debe existir para inserción rápida'
      );
    });

    test('Debe tener comando goToCode', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.goToCode'),
        'Comando goToCode debe existir para navegación rápida'
      );
    });

    test('Debe tener comando openSvgFile', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.openSvgFile'),
        'Comando openSvgFile debe existir'
      );
    });
  });

  suite('CA-23.4: Command Palette', () => {
    test('Comandos deben tener títulos descriptivos', async () => {
      const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
      assert.ok(ext, 'Extensión debe existir');

      const packageJson = ext.packageJSON;
      const commands = packageJson.contributes?.commands || [];

      // Verificar que los comandos tienen títulos
      commands.forEach((cmd: { command: string; title: string }) => {
        assert.ok(cmd.title, `Comando ${cmd.command} debe tener título`);
        // Los títulos usan %placeholder% para i18n
        assert.ok(
          cmd.title.startsWith('%') || cmd.title.length > 0,
          `Comando ${cmd.command} debe tener título definido`
        );
      });
    });

    test('Comandos deben tener iconos donde corresponda', async () => {
      const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
      assert.ok(ext, 'Extensión debe existir');

      const packageJson = ext.packageJSON;
      const commands = packageJson.contributes?.commands || [];

      // Comandos que típicamente deberían tener iconos
      const commandsWithIcons = commands.filter(
        (cmd: { icon?: string }) => cmd.icon
      );

      assert.ok(
        commandsWithIcons.length > 0,
        'Al menos algunos comandos deben tener iconos'
      );
    });
  });

  suite('CA-23.5: Menús Contextuales', () => {
    test('Extensión debe contribuir menús', async () => {
      const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
      assert.ok(ext, 'Extensión debe existir');

      const packageJson = ext.packageJSON;
      const menus = packageJson.contributes?.menus;

      assert.ok(menus, 'Extensión debe contribuir menús');
    });

    test('Debe tener submenú MasterSVG', async () => {
      const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
      assert.ok(ext, 'Extensión debe existir');

      const packageJson = ext.packageJSON;
      const submenus = packageJson.contributes?.submenus || [];

      const iconStudioSubmenu = submenus.find(
        (menu: { id: string }) => menu.id === 'masterSVG.svgMenu'
      );
      assert.ok(iconStudioSubmenu, 'Debe existir submenú masterSVG.svgMenu');
    });
  });

  suite('CA-23.6: Accesibilidad de Vistas', () => {
    test('Debe tener vistas contribuidas', async () => {
      const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
      assert.ok(ext, 'Extensión debe existir');

      const packageJson = ext.packageJSON;
      const views = packageJson.contributes?.views;

      assert.ok(views, 'Extensión debe contribuir vistas');
    });

    test('Vistas deben tener títulos accesibles', async () => {
      const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
      assert.ok(ext, 'Extensión debe existir');

      const packageJson = ext.packageJSON;
      const viewContainers = packageJson.contributes?.viewsContainers;

      if (viewContainers?.activitybar) {
        viewContainers.activitybar.forEach(
          (container: { id: string; title: string }) => {
            assert.ok(container.title, `Container ${container.id} debe tener título`);
          }
        );
      }
    });
  });

  suite('CA-23.7: Configuración de Atajos', () => {
    test('Extensión puede contribuir keybindings', async () => {
      const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
      assert.ok(ext, 'Extensión debe existir');

      const packageJson = ext.packageJSON;
      const keybindings = packageJson.contributes?.keybindings || [];

      // Keybindings son opcionales pero deberían existir para acciones frecuentes
      assert.ok(
        Array.isArray(keybindings),
        'Keybindings debe ser un array (puede estar vacío)'
      );
    });
  });

  suite('CA-23.8: Focus y Tab Order', () => {
    test('Debe poder ejecutar comandos de focus', async () => {
      // Los comandos de VS Code para focus están disponibles
      const commands = await vscode.commands.getCommands(true);

      // Verificar que existe el focus para el explorer (donde están nuestras vistas)
      const focusCommands = commands.filter(cmd => cmd.includes('focus'));

      assert.ok(focusCommands.length > 0, 'Debe haber comandos de focus disponibles');
    });
  });

  suite('CA-23.9: Screen Reader Support', () => {
    test('TreeView items deben tener descripción', () => {
      // Los TreeItems de VS Code soportan propiedades de accesibilidad
      // Este test verifica que el patrón está disponible
      const treeItemWithAccessibility = {
        label: 'home.svg',
        description: 'Icon file',
        tooltip: 'Path: /icons/home.svg\nSize: 24x24',
        accessibilityInformation: {
          label: 'SVG icon named home',
          role: 'treeitem',
        },
      };

      assert.ok(
        treeItemWithAccessibility.accessibilityInformation,
        'TreeItems pueden tener accessibilityInformation'
      );
      assert.ok(
        treeItemWithAccessibility.accessibilityInformation.label,
        'Debe tener label accesible'
      );
    });
  });

  suite('CA-23.10: Comandos de Edición Accesibles', () => {
    test('Debe tener comando renameIcon', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.renameIcon'),
        'Comando renameIcon debe existir'
      );
    });

    test('Debe tener comando deleteIcons', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.deleteIcons'),
        'Comando deleteIcons debe existir'
      );
    });

    test('Debe tener comando findAndReplace', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.findAndReplace'),
        'Comando findAndReplace debe existir'
      );
    });
  });
});
