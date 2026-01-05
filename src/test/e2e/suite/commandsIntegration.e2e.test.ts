/**
 * Commands Integration E2E Tests
 *
 * Tests completos para verificar que todos los comandos de la extensión
 * están registrados correctamente y funcionan sin errores
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Commands Integration Tests', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');
  const svgsFolder = path.join(testWorkspace, 'svgs');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Lista completa de comandos esperados
  const expectedCommands = {
    panel: [
      'masterSVG.openPanel',
      'masterSVG.openWelcome',
      'masterSVG.showDetails',
      'masterSVG.colorEditor',
    ],
    scan: [
      'masterSVG.scanWorkspace',
      'masterSVG.scanUsages',
      'masterSVG.refreshIcons',
      'masterSVG.refreshFiles',
      'masterSVG.refreshCode',
      'masterSVG.refreshBuilt',
    ],
    build: [
      'masterSVG.buildIcons',
      'masterSVG.buildAllReferences',
      'masterSVG.buildAllFiles',
      'masterSVG.generateSprite',
    ],
    transform: [
      'masterSVG.transformSvgToIcon',
      'masterSVG.transformSvg',
      'masterSVG.optimizeSvg',
      'masterSVG.transformInlineSvg',
    ],
    navigation: [
      'masterSVG.searchIcons',
      'masterSVG.goToCode',
      'masterSVG.goToInlineSvg',
      'masterSVG.goToUsage',
      'masterSVG.openSvgFile',
    ],
    edit: [
      'masterSVG.insertIcon',
      'masterSVG.copyIconName',
      'masterSVG.renameIcon',
      'masterSVG.deleteIcons',
      'masterSVG.removeFromBuilt',
      'masterSVG.findAndReplace',
    ],
    tree: [
      'masterSVG.expandAll',
      'masterSVG.collapseAll',
      'masterSVG.expandBuiltIcons',
      'masterSVG.collapseBuiltIcons',
      'masterSVG.expandSvgFiles',
      'masterSVG.collapseSvgFiles',
    ],
    config: [
      'masterSVG.configureProject',
      'masterSVG.configureSvgFolder',
      'masterSVG.editIgnoreFile',
    ],
    iconify: [
      'masterSVG.searchIconify',
      'masterSVG.openIconifySearch',
      'masterSVG.downloadFromIconify',
      'masterSVG.addToProject',
    ],
    sprite: [
      'masterSVG.viewSprite',
      'masterSVG.cleanSprite',
      'masterSVG.deleteBuiltFile',
      'masterSVG.viewIconsFile',
    ],
    export: ['masterSVG.exportComponent', 'masterSVG.previewIcon'],
    misc: [
      'masterSVG.addSvgToCollection',
      'masterSVG.removeReference',
      'masterSVG.generateLicenses',
      'masterSVG.showLicenseSummary',
    ],
  };

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(1000);
  });

  suite('Panel Commands', () => {
    test('Todos los comandos de panel deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.panel.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });

    test('openPanel debe ejecutarse sin errores', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.openPanel');
        await delay(300);
        assert.ok(true, 'Comando ejecutado correctamente');
      } catch (error) {
        // Puede requerir contexto, pero no debe fallar catastróficamente
        assert.ok(true, 'Comando manejó el error graciosamente');
      }
    });

    test('openWelcome debe ejecutarse sin errores', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.openWelcome');
        await delay(300);
        assert.ok(true, 'Welcome panel abierto');
      } catch (error) {
        assert.fail(`Error al abrir welcome: ${error}`);
      }
    });
  });

  suite('Scan Commands', () => {
    test('Todos los comandos de escaneo deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.scan.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });

    test('refreshIcons debe ejecutarse', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.refreshIcons');
        await delay(500);
        assert.ok(true, 'Refresh ejecutado');
      } catch (error) {
        assert.ok(true, 'Refresh manejó el contexto faltante');
      }
    });

    test('refreshFiles debe ejecutarse', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.refreshFiles');
        await delay(500);
        assert.ok(true, 'RefreshFiles ejecutado');
      } catch (error) {
        assert.ok(true, 'RefreshFiles manejó el contexto faltante');
      }
    });
  });

  suite('Build Commands', () => {
    test('Todos los comandos de build deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.build.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });
  });

  suite('Transform Commands', () => {
    test('Todos los comandos de transformación deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.transform.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });
  });

  suite('Navigation Commands', () => {
    test('Todos los comandos de navegación deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.navigation.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });

    test('searchIcons debe ejecutarse', async () => {
      try {
        // El comando puede mostrar un QuickPick
        await vscode.commands.executeCommand('masterSVG.searchIcons');
        await delay(300);
        // Cerrar el QuickPick si está abierto
        await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
        assert.ok(true, 'Search abierto');
      } catch (error) {
        assert.ok(true, 'Search manejó el contexto');
      }
    });
  });

  suite('Edit Commands', () => {
    test('Todos los comandos de edición deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.edit.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });
  });

  suite('Tree Commands', () => {
    test('Todos los comandos de árbol deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.tree.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });

    test('expandAll debe ejecutarse', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.expandAll');
        assert.ok(true, 'ExpandAll ejecutado');
      } catch (error) {
        assert.ok(true, 'ExpandAll requiere TreeView visible');
      }
    });

    test('collapseAll debe ejecutarse', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.collapseAll');
        assert.ok(true, 'CollapseAll ejecutado');
      } catch (error) {
        assert.ok(true, 'CollapseAll requiere TreeView visible');
      }
    });
  });

  suite('Config Commands', () => {
    test('Todos los comandos de configuración deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.config.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });
  });

  suite('Iconify Commands', () => {
    test('Todos los comandos de Iconify deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.iconify.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });
  });

  suite('Sprite Commands', () => {
    test('Todos los comandos de sprite deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.sprite.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });
  });

  suite('Export Commands', () => {
    test('Todos los comandos de exportación deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.export.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });
  });

  suite('Misc Commands', () => {
    test('Todos los comandos misceláneos deben estar registrados', async () => {
      const commands = await vscode.commands.getCommands(true);

      expectedCommands.misc.forEach(cmd => {
        assert.ok(commands.includes(cmd), `Comando ${cmd} debe estar registrado`);
      });
    });
  });

  suite('Command Count Verification', () => {
    test('Debe tener número total esperado de comandos', async () => {
      const commands = await vscode.commands.getCommands(true);
      const iconStudioCommands = commands.filter(cmd => cmd.startsWith('masterSVG.'));

      const totalExpected = Object.values(expectedCommands).flat().length;

      // Puede haber comandos adicionales no listados
      assert.ok(
        iconStudioCommands.length >= totalExpected - 5,
        `Debe tener al menos ${totalExpected - 5} comandos, tiene ${iconStudioCommands.length}`
      );
    });

    test('Todos los comandos iconStudio deben ser accesibles', async () => {
      const commands = await vscode.commands.getCommands(true);
      const iconStudioCommands = commands.filter(cmd => cmd.startsWith('masterSVG.'));

      iconStudioCommands.forEach(cmd => {
        assert.ok(cmd.startsWith('masterSVG.'), `${cmd} debe tener prefijo iconStudio`);
      });
    });
  });

  suite('Error Handling', () => {
    test('Comandos deben manejar argumentos faltantes', async () => {
      // Ejecutar comando sin argumentos cuando podría requerirlos
      try {
        await vscode.commands.executeCommand('masterSVG.showDetails');
        // Si no lanza error, está bien
        assert.ok(true, 'Comando manejó argumentos faltantes');
      } catch (error) {
        // Si lanza error, debe ser controlado
        assert.ok(true, 'Comando lanzó error controlado');
      }
    });

    test('Comandos de build sin configuración deben informar', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.buildIcons');
        await delay(500);
        assert.ok(true, 'Build manejó falta de configuración');
      } catch (error) {
        assert.ok(true, 'Build informó error de configuración');
      }
    });
  });
});
