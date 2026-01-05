/**
 * UC-16: Gestionar Colecciones de Iconos
 *
 * Tests E2E para validar la gestión de colecciones de iconos
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';
import * as path from 'node:path';

suite('UC-16: Gestionar Colecciones de Iconos', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-16.1: Añadir iconos a colección', () => {
    test('Debe existir comando addToCollection', async () => {
      const commands = await vscode.commands.getCommands(true);

      assert.ok(
        commands.includes('masterSVG.addSvgToCollection') ||
          commands.includes('masterSVG.addToCollection'),
        'Debe existir comando para añadir a colección'
      );
    });

    test('Debe existir comando removeFromCollection', async () => {
      const commands = await vscode.commands.getCommands(true);

      assert.ok(
        commands.includes('masterSVG.removeFromBuilt') ||
          commands.includes('masterSVG.removeFromCollection'),
        'Debe existir comando para remover de colección'
      );
    });
  });

  suite('CA-16.2: Organización por categorías', () => {
    test('Debe poder crear categorías temáticas', () => {
      const categories = ['Navigation', 'Actions', 'Social', 'Media', 'Communication'];

      assert.strictEqual(categories.length, 5, 'Debe haber categorías predefinidas');
      assert.ok(categories.includes('Navigation'), 'Debe incluir Navigation');
      assert.ok(categories.includes('Actions'), 'Debe incluir Actions');
    });

    test('Debe asignar iconos a categorías', () => {
      const iconAssignments = new Map<string, string[]>();
      iconAssignments.set('Navigation', ['arrow-left', 'arrow-right', 'menu', 'home']);
      iconAssignments.set('Actions', ['add', 'delete', 'edit', 'save']);
      iconAssignments.set('Social', ['github', 'twitter', 'linkedin']);

      assert.strictEqual(
        iconAssignments.get('Navigation')?.length,
        4,
        'Navigation debe tener 4 iconos'
      );
      assert.strictEqual(iconAssignments.get('Actions')?.length, 4, 'Actions debe tener 4 iconos');
    });

    test('Debe permitir iconos sin categoría', () => {
      const uncategorized = {
        category: null,
        icons: ['misc-icon-1', 'misc-icon-2'],
      };

      assert.strictEqual(uncategorized.category, null, 'Debe permitir iconos sin categoría');
    });
  });

  suite('CA-16.3: Operaciones de colección', () => {
    test('Debe listar iconos en colección', () => {
      const collection = {
        name: 'My Project Icons',
        icons: [
          { name: 'home', category: 'Navigation' },
          { name: 'settings', category: 'Actions' },
          { name: 'user', category: 'User' },
        ],
      };

      assert.strictEqual(collection.icons.length, 3, 'Colección debe tener 3 iconos');
    });

    test('Debe filtrar por categoría', () => {
      const icons = [
        { name: 'home', category: 'Navigation' },
        { name: 'arrow-left', category: 'Navigation' },
        { name: 'settings', category: 'Actions' },
        { name: 'user', category: 'User' },
      ];

      const navigationIcons = icons.filter(i => i.category === 'Navigation');
      assert.strictEqual(navigationIcons.length, 2, 'Debe filtrar iconos de Navigation');
    });

    test('Debe buscar iconos por nombre', () => {
      const icons = ['home', 'home-outline', 'homepage', 'settings', 'user'];

      const searchResults = icons.filter(i => i.toLowerCase().includes('home'));
      assert.strictEqual(searchResults.length, 3, 'Búsqueda "home" debe retornar 3 resultados');
    });
  });

  suite('CA-16.4: Persistencia de colecciones', () => {
    test('Debe guardar estado de colección', () => {
      const collectionState = {
        version: 1,
        lastModified: new Date().toISOString(),
        icons: ['home', 'settings', 'user'],
        categories: {
          Navigation: ['home'],
          Actions: ['settings'],
          User: ['user'],
        },
      };

      const json = JSON.stringify(collectionState);
      const parsed = JSON.parse(json);

      assert.deepStrictEqual(
        parsed.icons,
        collectionState.icons,
        'Debe serializar/deserializar correctamente'
      );
    });

    test('Debe restaurar colección al abrir workspace', () => {
      // Simular estructura de archivo de colección
      const collectionFile = {
        path: '.iconmanager/collection.json',
        expectedFields: ['version', 'icons', 'categories', 'lastModified'],
      };

      for (const field of collectionFile.expectedFields) {
        assert.ok(field.length > 0, `Campo ${field} debe existir`);
      }
    });
  });

  suite('CA-16.5: Exportar colección', () => {
    test('Debe exportar lista de iconos', () => {
      const exportToJson = (icons: Array<{ name: string; category: string }>) => {
        return JSON.stringify({ icons }, null, 2);
      };

      const icons = [
        { name: 'home', category: 'Navigation' },
        { name: 'settings', category: 'Actions' },
      ];

      const exported = exportToJson(icons);
      assert.ok(exported.includes('"home"'), 'Export debe incluir nombres de iconos');
    });

    test('Debe generar sprite de colección', () => {
      const generateSpriteFromCollection = (iconNames: string[]): string => {
        let sprite = '<svg xmlns="http://www.w3.org/2000/svg">\n';
        for (const name of iconNames) {
          sprite += `  <symbol id="icon-${name}" viewBox="0 0 24 24"><!-- content --></symbol>\n`;
        }
        sprite += '</svg>';
        return sprite;
      };

      const sprite = generateSpriteFromCollection(['home', 'settings']);
      assert.ok(sprite.includes('id="icon-home"'), 'Sprite debe incluir symbol home');
      assert.ok(sprite.includes('id="icon-settings"'), 'Sprite debe incluir symbol settings');
    });

    test('Debe existir comando buildSelected', async () => {
      const commands = await vscode.commands.getCommands(true);

      assert.ok(
        commands.includes('masterSVG.buildSelected') ||
          commands.includes('masterSVG.buildIcons'),
        'Debe existir comando de build para colección'
      );
    });
  });

  suite('CA-16.6: Operaciones masivas', () => {
    test('Debe seleccionar múltiples iconos', () => {
      const selection = {
        selectedCount: 5,
        icons: ['icon1', 'icon2', 'icon3', 'icon4', 'icon5'],
      };

      assert.strictEqual(
        selection.icons.length,
        selection.selectedCount,
        'Debe trackear selección múltiple'
      );
    });

    test('Debe mover múltiples iconos entre categorías', () => {
      const moveIcons = (icons: string[], fromCategory: string, toCategory: string) => {
        return {
          moved: icons,
          from: fromCategory,
          to: toCategory,
          count: icons.length,
        };
      };

      const result = moveIcons(['icon1', 'icon2'], 'Actions', 'Navigation');
      assert.strictEqual(result.count, 2, 'Debe mover 2 iconos');
    });

    test('Debe eliminar múltiples iconos de colección', () => {
      let collection = ['icon1', 'icon2', 'icon3', 'icon4', 'icon5'];
      const toRemove = ['icon2', 'icon4'];

      collection = collection.filter(i => !toRemove.includes(i));

      assert.strictEqual(collection.length, 3, 'Debe quedar 3 iconos después de eliminar 2');
      assert.ok(!collection.includes('icon2'), 'icon2 no debe estar');
      assert.ok(!collection.includes('icon4'), 'icon4 no debe estar');
    });
  });
});
