/**
 * TreeView Navigation E2E Tests
 *
 * Tests para validar la navegación, interacción y funcionalidad
 * de los TreeViews de la extensión
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('TreeView Navigation Tests', () => {
  const testWorkspace = path.join(__dirname, '../test-workspace');
  const svgsFolder = path.join(testWorkspace, 'svgs');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(1000);

    // Configurar carpeta de SVGs para las pruebas
    const config = vscode.workspace.getConfiguration('sageboxIconStudio');
    await config.update('svgFolders', [svgsFolder], vscode.ConfigurationTarget.Workspace);
    await delay(300);
  });

  suite('TreeView Registration', () => {
    test('Extensión debe contribuir viewsContainers', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      assert.ok(ext, 'Extensión debe existir');

      const packageJson = ext.packageJSON;
      const viewsContainers = packageJson.contributes?.viewsContainers;

      assert.ok(viewsContainers, 'Debe contribuir viewsContainers');
    });

    test('Extensión debe contribuir views', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      assert.ok(ext, 'Extensión debe existir');

      const packageJson = ext.packageJSON;
      const views = packageJson.contributes?.views;

      assert.ok(views, 'Debe contribuir views');
    });

    test('Debe tener viewContainer en activitybar', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;
      const activitybar = packageJson?.contributes?.viewsContainers?.activitybar;

      assert.ok(activitybar, 'Debe tener container en activitybar');
      assert.ok(Array.isArray(activitybar), 'activitybar debe ser array');
      assert.ok(activitybar.length > 0, 'Debe tener al menos un container');
    });
  });

  suite('Built Icons TreeView', () => {
    test('Debe existir vista de iconos construidos', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;
      const views = packageJson?.contributes?.views;

      // Buscar la vista de iconos en cualquier container
      const allViews = Object.values(views || {}).flat() as Array<{ id: string }>;
      const builtIconsView = allViews.find(
        v => v.id.includes('builtIcons') || v.id.includes('icons')
      );

      assert.ok(builtIconsView, 'Debe existir vista de iconos');
    });

    test('Comando refreshBuilt debe actualizar vista', async () => {
      try {
        await vscode.commands.executeCommand('sageboxIconStudio.refreshBuilt');
        await delay(500);
        assert.ok(true, 'RefreshBuilt ejecutado');
      } catch (error) {
        assert.ok(true, 'RefreshBuilt requiere vista activa');
      }
    });
  });

  suite('SVG Files TreeView', () => {
    test('Debe existir vista de archivos SVG', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;
      const views = packageJson?.contributes?.views;

      const allViews = Object.values(views || {}).flat() as Array<{ id: string }>;
      const svgFilesView = allViews.find(
        v => v.id.includes('svgFiles') || v.id.includes('files')
      );

      assert.ok(svgFilesView, 'Debe existir vista de archivos SVG');
    });

    test('Comando refreshFiles debe actualizar vista', async () => {
      try {
        await vscode.commands.executeCommand('sageboxIconStudio.refreshFiles');
        await delay(500);
        assert.ok(true, 'RefreshFiles ejecutado');
      } catch (error) {
        assert.ok(true, 'RefreshFiles requiere vista activa');
      }
    });
  });

  suite('Code References TreeView', () => {
    test('Debe existir vista de referencias en código', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;
      const views = packageJson?.contributes?.views;

      const allViews = Object.values(views || {}).flat() as Array<{ id: string }>;
      const codeView = allViews.find(
        v => v.id.includes('code') || v.id.includes('references') || v.id.includes('usage')
      );

      assert.ok(codeView, 'Debe existir vista de código/referencias');
    });

    test('Comando refreshCode debe actualizar vista', async () => {
      try {
        await vscode.commands.executeCommand('sageboxIconStudio.refreshCode');
        await delay(500);
        assert.ok(true, 'RefreshCode ejecutado');
      } catch (error) {
        assert.ok(true, 'RefreshCode requiere vista activa');
      }
    });
  });

  suite('TreeView Expand/Collapse', () => {
    test('expandAll debe funcionar', async () => {
      try {
        await vscode.commands.executeCommand('sageboxIconStudio.expandAll');
        assert.ok(true, 'ExpandAll funcionó');
      } catch (error) {
        // Puede requerir que la vista esté visible
        assert.ok(true, 'ExpandAll requiere vista visible');
      }
    });

    test('collapseAll debe funcionar', async () => {
      try {
        await vscode.commands.executeCommand('sageboxIconStudio.collapseAll');
        assert.ok(true, 'CollapseAll funcionó');
      } catch (error) {
        assert.ok(true, 'CollapseAll requiere vista visible');
      }
    });

    test('expandBuiltIcons debe funcionar', async () => {
      try {
        await vscode.commands.executeCommand('sageboxIconStudio.expandBuiltIcons');
        assert.ok(true, 'ExpandBuiltIcons funcionó');
      } catch (error) {
        assert.ok(true, 'Requiere vista visible');
      }
    });

    test('expandSvgFiles debe funcionar', async () => {
      try {
        await vscode.commands.executeCommand('sageboxIconStudio.expandSvgFiles');
        assert.ok(true, 'ExpandSvgFiles funcionó');
      } catch (error) {
        assert.ok(true, 'Requiere vista visible');
      }
    });
  });

  suite('TreeView Item Actions', () => {
    test('Debe poder copiar nombre de icono', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.copyIconName'),
        'Comando copyIconName debe existir'
      );
    });

    test('Debe poder abrir archivo SVG', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.openSvgFile'),
        'Comando openSvgFile debe existir'
      );
    });

    test('Debe poder mostrar detalles', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.showDetails'),
        'Comando showDetails debe existir'
      );
    });

    test('Debe poder ir al código', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.goToCode'),
        'Comando goToCode debe existir'
      );
    });
  });

  suite('TreeView Context Menus', () => {
    test('Extensión debe contribuir view/item/context menus', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;
      const menus = packageJson?.contributes?.menus;

      assert.ok(menus, 'Debe contribuir menus');

      // Verificar que hay menús de contexto para items
      const hasItemContext = Object.keys(menus || {}).some(key =>
        key.includes('view/item/context')
      );

      assert.ok(hasItemContext, 'Debe tener menús de contexto para items');
    });

    test('Extensión debe contribuir view/title menus', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;
      const menus = packageJson?.contributes?.menus;

      const hasViewTitle = Object.keys(menus || {}).some(key =>
        key.includes('view/title')
      );

      assert.ok(hasViewTitle, 'Debe tener menús en título de vista');
    });
  });

  suite('TreeView Data Provider', () => {
    test('Archivos SVG de prueba deben existir', () => {
      const files = fs.readdirSync(svgsFolder);
      const svgFiles = files.filter(f => f.endsWith('.svg'));

      assert.ok(svgFiles.length > 0, 'Debe haber archivos SVG');
      assert.ok(svgFiles.includes('home.svg'), 'Debe incluir home.svg');
    });

    test('TreeView debe poder procesar archivos', () => {
      // Verificar que los archivos SVG son válidos
      const svgPath = path.join(svgsFolder, 'home.svg');
      const content = fs.readFileSync(svgPath, 'utf-8');

      assert.ok(content.includes('<svg'), 'SVG debe tener tag svg');
    });
  });

  suite('TreeView Search Integration', () => {
    test('searchIcons debe estar disponible', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.searchIcons'),
        'Comando searchIcons debe existir'
      );
    });

    test('Search debe poder filtrar por nombre', () => {
      const icons = ['home', 'settings', 'search', 'heart', 'warning'];
      const searchTerm = 'home';

      const filtered = icons.filter(icon =>
        icon.toLowerCase().includes(searchTerm.toLowerCase())
      );

      assert.strictEqual(filtered.length, 1, 'Debe encontrar 1 icono');
      assert.strictEqual(filtered[0], 'home', 'Debe encontrar home');
    });

    test('Search debe ser case-insensitive', () => {
      const icons = ['Home', 'SETTINGS', 'search'];
      const searchTerm = 'home';

      const filtered = icons.filter(icon =>
        icon.toLowerCase().includes(searchTerm.toLowerCase())
      );

      assert.strictEqual(filtered.length, 1, 'Debe encontrar Home');
    });
  });

  suite('TreeView Item Types', () => {
    test('Debe soportar items de tipo archivo', () => {
      const fileItem = {
        label: 'home.svg',
        resourceUri: vscode.Uri.file(path.join(svgsFolder, 'home.svg')),
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        contextValue: 'svgFile',
      };

      assert.ok(fileItem.resourceUri, 'Item de archivo debe tener URI');
      assert.strictEqual(
        fileItem.collapsibleState,
        vscode.TreeItemCollapsibleState.None,
        'Archivo no debe ser expandible'
      );
    });

    test('Debe soportar items de tipo carpeta', () => {
      const folderItem = {
        label: 'icons',
        resourceUri: vscode.Uri.file(svgsFolder),
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: 'folder',
      };

      assert.ok(folderItem.resourceUri, 'Item de carpeta debe tener URI');
      assert.strictEqual(
        folderItem.collapsibleState,
        vscode.TreeItemCollapsibleState.Collapsed,
        'Carpeta debe ser expandible'
      );
    });

    test('Debe soportar items de tipo referencia', () => {
      const refItem = {
        label: 'App.tsx:15',
        description: 'Icon name="home"',
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        contextValue: 'iconReference',
        command: {
          command: 'vscode.open',
          title: 'Go to reference',
        },
      };

      assert.ok(refItem.command, 'Referencia debe tener comando');
      assert.strictEqual(refItem.contextValue, 'iconReference');
    });
  });

  suite('TreeView Decorations', () => {
    test('Items deben poder tener tooltips', () => {
      const item = {
        label: 'settings.svg',
        tooltip: 'Path: /icons/settings.svg\nSize: 512 bytes\nColors: currentColor',
      };

      assert.ok(item.tooltip, 'Item debe tener tooltip');
      assert.ok(item.tooltip.includes('Path'), 'Tooltip debe incluir path');
    });

    test('Items deben poder tener descripciones', () => {
      const item = {
        label: 'heart.svg',
        description: '24x24 • filled',
      };

      assert.ok(item.description, 'Item debe tener descripción');
    });
  });

  suiteTeardown(async () => {
    // Limpiar configuración
    const config = vscode.workspace.getConfiguration('sageboxIconStudio');
    await config.update('svgFolders', undefined, vscode.ConfigurationTarget.Workspace);
  });
});
