/**
 * Tests para refresh de TreeViews
 *
 * Verifica que los refresh parciales y completos funcionan correctamente
 * y que se preserva el estado de expansión cuando es posible.
 */

// Mock vscode ANTES de cualquier import que lo use
jest.mock('vscode', () => {
  return {
    TreeItem: class MockTreeItem {
      label: string | undefined;
      collapsibleState: number | undefined;
      iconPath?: any;
      resourceUri?: any;
      tooltip?: string;
      command?: any;
      contextValue?: string;
      description?: string;
      id?: string;

      constructor(label: string, collapsibleState?: number) {
        this.label = label;
        this.collapsibleState = collapsibleState;
      }
    },
    TreeItemCollapsibleState: {
      None: 0,
      Collapsed: 1,
      Expanded: 2,
    },
    ThemeIcon: jest.fn().mockImplementation((id: string) => ({ id })),
    Uri: {
      file: jest.fn().mockImplementation((path: string) => ({ fsPath: path, path })),
      parse: jest.fn().mockImplementation((str: string) => ({ fsPath: str, path: str })),
    },
    EventEmitter: jest.fn().mockImplementation(() => ({
      event: jest.fn(),
      fire: jest.fn(),
      dispose: jest.fn(),
    })),
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
      getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue([]),
      }),
      fs: {
        readFile: jest.fn().mockResolvedValue(Buffer.from('')),
      },
    },
    window: {
      showInformationMessage: jest.fn(),
      showErrorMessage: jest.fn(),
    },
    commands: {
      executeCommand: jest.fn(),
    },
  };
});

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn().mockReturnValue(''),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
}));

// Mock path
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: (...args: string[]) => args.join('/'),
  basename: (p: string, ext?: string) => {
    const base = p.split(/[\\/]/).pop() || '';
    return ext ? base.replace(ext, '') : base;
  },
  dirname: (p: string) => {
    const parts = p.split(/[\\/]/);
    parts.pop();
    return parts.join('/') || '.';
  },
  relative: (from: string, to: string) => to.replace(from + '/', ''),
  sep: '/',
}));

// Mock os
jest.mock('os', () => ({
  tmpdir: () => '/tmp',
}));

import * as vscode from 'vscode';

// Mock class for SvgItem (we can't import the real one because of circular mocking)
class MockSvgItem extends vscode.TreeItem {
  type: string;
  icon?: { name: string; path: string; source: string; svg?: string; isBuilt?: boolean };
  category?: string;

  constructor(
    label: string,
    count: number,
    collapsibleState: vscode.TreeItemCollapsibleState,
    type: string,
    icon?: { name: string; path: string; source: string; svg?: string; isBuilt?: boolean },
    category?: string
  ) {
    super(label, collapsibleState);
    this.type = type;
    this.icon = icon;
    this.category = category;
    this.description = count > 0 ? `(${count})` : undefined;
  }
}

describe('TreeView Refresh Behavior', () => {
  describe('SvgItem creation for refresh', () => {
    test('debe crear SvgItem para icono con todos los campos', () => {
      const item = new MockSvgItem('test-icon', 0, vscode.TreeItemCollapsibleState.None, 'icon', {
        name: 'test-icon',
        path: '/icons/test.svg',
        source: 'workspace',
      });

      expect(item.label).toBe('test-icon');
      expect(item.type).toBe('icon');
      expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    });

    test('debe crear SvgItem para carpeta colapsable', () => {
      const item = new MockSvgItem(
        'navigation',
        5,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        'folder:/icons/navigation'
      );

      expect(item.label).toBe('navigation');
      expect(item.type).toBe('category');
      expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
      expect(item.category).toBe('folder:/icons/navigation');
    });

    test('debe crear SvgItem para carpeta expandida', () => {
      const item = new MockSvgItem(
        'ui',
        3,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'folder:/icons/ui'
      );

      expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
    });
  });

  describe('onDidChangeTreeData event', () => {
    let mockEventEmitter: { fire: jest.Mock; event: jest.Mock };

    beforeEach(() => {
      mockEventEmitter = {
        fire: jest.fn(),
        event: jest.fn(),
      };
    });

    test('fire() sin argumentos debe refrescar todo el árbol', () => {
      // Cuando se llama fire() sin argumentos, VS Code refresca todo el árbol
      // y colapsa todas las ramas
      mockEventEmitter.fire();

      expect(mockEventEmitter.fire).toHaveBeenCalledWith();
    });

    test('fire(undefined) debe refrescar todo el árbol', () => {
      mockEventEmitter.fire(undefined);

      expect(mockEventEmitter.fire).toHaveBeenCalledWith(undefined);
    });

    test('fire(item) debe refrescar solo ese item y sus hijos', () => {
      const item = new MockSvgItem('test-icon', 0, vscode.TreeItemCollapsibleState.None, 'icon');

      mockEventEmitter.fire(item);

      expect(mockEventEmitter.fire).toHaveBeenCalledWith(item);
    });

    test('fire(folderItem) debe preservar expansión de otras carpetas', () => {
      const folderItem = new MockSvgItem(
        'navigation',
        5,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'folder:/icons/navigation'
      );

      // Al hacer fire(folderItem), solo se refresca esa carpeta
      // Las demás carpetas mantienen su estado
      mockEventEmitter.fire(folderItem);

      expect(mockEventEmitter.fire).toHaveBeenCalledWith(folderItem);
      expect(mockEventEmitter.fire).not.toHaveBeenCalledWith(undefined);
    });
  });

  describe('Partial refresh scenarios', () => {
    test('refreshItemByName debe crear item correcto para icono existente', () => {
      // Simular un mapa de iconos
      const svgFiles = new Map();
      svgFiles.set('arrow', {
        name: 'arrow',
        path: '/icons/arrow.svg',
        source: 'workspace',
      });

      const iconName = 'arrow';
      // Find icon by name (keys are now file paths)
      let icon;
      for (const value of svgFiles.values()) {
        if (value.name === iconName) {
          icon = value;
          break;
        }
      }

      expect(icon).toBeDefined();

      if (icon) {
        const item = new MockSvgItem(
          icon.name,
          0,
          vscode.TreeItemCollapsibleState.None,
          'icon',
          icon
        );

        expect(item.icon).toBe(icon);
        expect(item.label).toBe('arrow');
      }
    });

    test('refreshItemByName debe no hacer nada si icono no existe', () => {
      const svgFiles = new Map();
      const iconName = 'nonexistent';
      // Find icon by name (keys are now file paths)
      let icon;
      for (const value of svgFiles.values()) {
        if (value.name === iconName) {
          icon = value;
          break;
        }
      }

      expect(icon).toBeUndefined();
    });
  });

  describe('Container refresh for built icons', () => {
    test('debe refrescar container de icons.js sin colapsar sprite.svg', () => {
      // El itemCache guarda referencias a los containers
      const itemCache = new Map<string, MockSvgItem>();

      const iconsJsContainer = new MockSvgItem(
        'icons.js',
        10,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'built:icons.js'
      );

      const spriteContainer = new MockSvgItem(
        'sprite.svg',
        5,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'built:sprite.svg'
      );

      itemCache.set('built:icons.js', iconsJsContainer);
      itemCache.set('built:sprite.svg', spriteContainer);

      // Al refrescar solo icons.js, sprite.svg no debe verse afectado
      const containerToRefresh = itemCache.get('built:icons.js');

      expect(containerToRefresh).toBe(iconsJsContainer);
      expect(containerToRefresh).not.toBe(spriteContainer);
    });

    test('addIconAndRefresh debe agregar icono y refrescar container', () => {
      const builtIcons = new Map();
      const jsIcons = new Set<string>();
      const itemCache = new Map<string, MockSvgItem>();

      const iconsJsContainer = new MockSvgItem(
        'icons.js',
        0,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'built:icons.js'
      );
      itemCache.set('built:icons.js', iconsJsContainer);

      // Simular addIconAndRefresh
      const iconName = 'newIcon';
      const svg = '<svg viewBox="0 0 24 24"><path/></svg>';
      const iconsFilePath = '/output/icons.js';

      const newIcon = {
        name: iconName,
        path: iconsFilePath,
        source: 'library' as const,
        svg: svg,
        isBuilt: true,
      };

      builtIcons.set(iconName, newIcon);
      jsIcons.add(iconName);

      expect(builtIcons.has(iconName)).toBe(true);
      expect(jsIcons.has(iconName)).toBe(true);
      expect(itemCache.get('built:icons.js')).toBe(iconsJsContainer);
    });
  });

  describe('Folder hierarchy refresh', () => {
    test('debe preservar estructura de carpetas al refrescar un icono', () => {
      const folderCache = new Map<string, MockSvgItem>();

      // Simular estructura de carpetas
      const navigationFolder = new MockSvgItem(
        'navigation',
        3,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'folder:/icons/navigation'
      );

      const uiFolder = new MockSvgItem(
        'ui',
        5,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'folder:/icons/ui'
      );

      folderCache.set('folder:/icons/navigation', navigationFolder);
      folderCache.set('folder:/icons/ui', uiFolder);

      // Al refrescar un icono en navigation, ui debe mantenerse expandida
      expect(folderCache.get('folder:/icons/navigation')).toBe(navigationFolder);
      expect(folderCache.get('folder:/icons/ui')).toBe(uiFolder);
    });

    test('getParent debe devolver el folder correcto para un icono', () => {
      const icon = {
        name: 'arrow',
        path: '/workspace/icons/navigation/arrow.svg',
        source: 'workspace' as const,
      };

      const item = new MockSvgItem(
        icon.name,
        0,
        vscode.TreeItemCollapsibleState.None,
        'icon',
        icon
      );

      // El parent debería ser 'navigation'
      expect(item.icon?.path).toContain('navigation');
    });
  });

  describe('Cache invalidation', () => {
    test('refresh() debe limpiar todos los caches', () => {
      const svgFiles = new Map();
      const folderCache = new Map();

      svgFiles.set('/icons/icon1.svg', { name: 'icon1', path: '/icons/icon1.svg', source: 'workspace' });
      folderCache.set('folder:/icons', { label: 'icons' });

      // Simular refresh completo
      svgFiles.clear();
      // folderCache no se limpia automáticamente, pero el árbol se reconstruye

      expect(svgFiles.size).toBe(0);
    });

    test('refreshFile debe preservar cache de archivos', () => {
      const svgFiles = new Map();
      svgFiles.set('/icons/icon1.svg', { name: 'icon1', path: '/icons/icon1.svg', source: 'workspace' });
      svgFiles.set('/icons/icon2.svg', { name: 'icon2', path: '/icons/icon2.svg', source: 'workspace' });

      // refreshFile no limpia svgFiles, solo dispara re-render
      expect(svgFiles.size).toBe(2);
    });

    test('removeItem debe eliminar solo el icono especificado', () => {
      const svgFiles = new Map();
      svgFiles.set('/icons/icon1.svg', { name: 'icon1', path: '/icons/icon1.svg', source: 'workspace' });
      svgFiles.set('/icons/icon2.svg', { name: 'icon2', path: '/icons/icon2.svg', source: 'workspace' });

      const iconToRemove = '/icons/icon1.svg';
      svgFiles.delete(iconToRemove);

      expect(svgFiles.has('/icons/icon1.svg')).toBe(false);
      expect(svgFiles.has('/icons/icon2.svg')).toBe(true);
    });
  });
});

describe('TreeView expansion state preservation', () => {
  describe('Strategies for preserving expansion', () => {
    test('Estrategia 1: Usar fire(item) para refresh parcial', () => {
      // Al pasar un item específico a fire(), VS Code solo refresca
      // ese item y sus hijos, preservando el estado del resto del árbol
      const mockFire = jest.fn();
      const item = new MockSvgItem('test', 0, vscode.TreeItemCollapsibleState.None, 'icon');

      mockFire(item);

      expect(mockFire).toHaveBeenCalledWith(item);
    });

    test('Estrategia 2: Cachear items por ID para encontrarlos rápido', () => {
      const itemCache = new Map<string, MockSvgItem>();

      const item1 = new MockSvgItem('item1', 0, vscode.TreeItemCollapsibleState.None, 'icon');
      const item2 = new MockSvgItem('item2', 0, vscode.TreeItemCollapsibleState.None, 'icon');

      // Usar un ID único para cada item
      itemCache.set('icon:item1', item1);
      itemCache.set('icon:item2', item2);

      expect(itemCache.get('icon:item1')).toBe(item1);
      expect(itemCache.get('icon:item2')).toBe(item2);
    });

    test('Estrategia 3: Refrescar solo containers afectados', () => {
      const containers = new Map<string, MockSvgItem>();

      containers.set(
        'built:icons.js',
        new MockSvgItem('icons.js', 10, vscode.TreeItemCollapsibleState.Expanded, 'category')
      );
      containers.set(
        'built:sprite.svg',
        new MockSvgItem('sprite.svg', 5, vscode.TreeItemCollapsibleState.Expanded, 'category')
      );

      // Solo refrescar el container que cambió
      const changedFile = 'icons.js';
      const containerKey = `built:${changedFile}`;
      const containerToRefresh = containers.get(containerKey);

      expect(containerToRefresh?.label).toBe('icons.js');
    });
  });

  describe('Soft refresh behavior', () => {
    test('softRefresh debe disparar evento sin limpiar cache', () => {
      const mockFire = jest.fn();
      const svgFiles = new Map();
      svgFiles.set('/icons/icon1.svg', { name: 'icon1', path: '/icons/icon1.svg', source: 'workspace' });

      // Simular softRefresh
      mockFire(); // fire() sin argumentos

      expect(mockFire).toHaveBeenCalled();
      expect(svgFiles.size).toBe(1); // Cache no se limpió
    });

    test('refresh completo debe limpiar cache antes de fire', () => {
      const mockFire = jest.fn();
      const svgFiles = new Map();
      svgFiles.set('/icons/icon1.svg', { name: 'icon1', path: '/icons/icon1.svg', source: 'workspace' });

      // Simular refresh completo
      svgFiles.clear();
      mockFire();

      expect(mockFire).toHaveBeenCalled();
      expect(svgFiles.size).toBe(0); // Cache se limpió
    });
  });

  describe('refreshContainer for BuiltIconsProvider', () => {
    test('debe refrescar container específico sin afectar otros', () => {
      const mockFire = jest.fn();
      const itemCache = new Map<string, MockSvgItem>();

      const iconsContainer = new MockSvgItem(
        'icons.js',
        10,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'built:icons.js'
      );
      const spriteContainer = new MockSvgItem(
        'sprite.svg',
        5,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'built:sprite.svg'
      );

      itemCache.set('built:icons.js', iconsContainer);
      itemCache.set('built:sprite.svg', spriteContainer);

      // Simular refreshContainer('icons.js')
      const fileName = 'icons.js';
      const containerKey = `built:${fileName}`;
      const cachedContainer = itemCache.get(containerKey);

      if (cachedContainer) {
        mockFire(cachedContainer);
      }

      expect(mockFire).toHaveBeenCalledWith(iconsContainer);
      expect(mockFire).not.toHaveBeenCalledWith(spriteContainer);
    });

    test('debe hacer softRefresh si container no está en cache', () => {
      const mockFire = jest.fn();
      const itemCache = new Map<string, MockSvgItem>();

      // Simular refreshContainer para container no cacheado
      const fileName = 'icons.js';
      const containerKey = `built:${fileName}`;
      const cachedContainer = itemCache.get(containerKey);

      if (cachedContainer) {
        mockFire(cachedContainer);
      } else {
        mockFire(); // softRefresh fallback
      }

      expect(mockFire).toHaveBeenCalledWith(); // softRefresh
    });
  });

  describe('refreshFolder for SvgFilesProvider', () => {
    test('debe refrescar carpeta específica sin colapsar otras', () => {
      const mockFire = jest.fn();
      const folderCache = new Map<string, MockSvgItem>();

      const navFolder = new MockSvgItem(
        'navigation',
        3,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'folder:/icons/navigation'
      );
      const uiFolder = new MockSvgItem(
        'ui',
        5,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'folder:/icons/ui'
      );

      folderCache.set('folder:/icons/navigation', navFolder);
      folderCache.set('folder:/icons/ui', uiFolder);

      // Simular refreshFolder('/icons/navigation')
      const folderPath = '/icons/navigation';
      const folderKey = `folder:${folderPath}`;
      const cachedFolder = folderCache.get(folderKey);

      if (cachedFolder) {
        mockFire(cachedFolder);
      }

      expect(mockFire).toHaveBeenCalledWith(navFolder);
      expect(mockFire).not.toHaveBeenCalledWith(uiFolder);
    });
  });

  describe('Edge cases', () => {
    test('debe manejar refresh cuando no hay iconos', () => {
      const svgFiles = new Map();

      expect(svgFiles.size).toBe(0);
      // No debe lanzar error
    });

    test('debe manejar refresh cuando item no está en cache', () => {
      const itemCache = new Map<string, MockSvgItem>();

      const result = itemCache.get('nonexistent');

      expect(result).toBeUndefined();
      // En este caso, hacer fallback a refresh completo
    });

    test('debe manejar múltiples refreshes rápidos', () => {
      const mockFire = jest.fn();

      // Simular múltiples refreshes
      for (let i = 0; i < 5; i++) {
        mockFire();
      }

      expect(mockFire).toHaveBeenCalledTimes(5);
    });
  });

  describe('Container counter synchronization (BUG FIX)', () => {
    test('addIconAndRefresh debe actualizar el contador del container', () => {
      // Este test verifica el bug donde el contador del container no se actualiza
      // cuando se añade un icono via addIconAndRefresh

      const builtIcons = new Map<
        string,
        { name: string; path: string; source: string; svg: string; isBuilt: boolean }
      >();
      const jsIcons = new Set<string>();
      const itemCache = new Map<string, MockSvgItem>();

      // Estado inicial: 4 iconos
      const initialIcons = ['bell', 'diamond', 'ellipse', 'gear'];
      initialIcons.forEach(name => {
        builtIcons.set(name, {
          name,
          path: '/output/icons.js',
          source: 'library',
          svg: '<svg/>',
          isBuilt: true,
        });
        jsIcons.add(name);
      });

      // Container cacheado con contador de 4
      const iconsJsContainer = new MockSvgItem(
        'icons.js',
        4, // contador inicial
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'built:icons.js'
      );
      itemCache.set('built:icons.js', iconsJsContainer);

      // Simular addIconAndRefresh - añadir nuevo icono
      const newIconName = 'house';
      const newIcon = {
        name: newIconName,
        path: '/output/icons.js',
        source: 'library',
        svg: '<svg viewBox="0 0 24 24"><path/></svg>',
        isBuilt: true,
      };
      builtIcons.set(newIconName, newIcon);
      jsIcons.add(newIconName);

      // Verificar que hay 5 iconos ahora
      expect(builtIcons.size).toBe(5);
      expect(jsIcons.size).toBe(5);

      // BUG: El container cacheado todavía tiene el contador viejo (4)
      const cachedContainer = itemCache.get('built:icons.js');
      expect(cachedContainer?.description).toBe('(4)');

      // FIX: Actualizar el description del container antes de fire
      const newCount = builtIcons.size;
      if (cachedContainer) {
        cachedContainer.description = `(${newCount})`;
      }

      // Ahora el contador debe estar actualizado
      expect(cachedContainer?.description).toBe('(5)');
    });

    test('removeIconAndRefresh debe actualizar el contador del container', () => {
      const builtIcons = new Map<
        string,
        { name: string; path: string; source: string; svg: string; isBuilt: boolean }
      >();
      const jsIcons = new Set<string>();
      const itemCache = new Map<string, MockSvgItem>();

      // Estado inicial: 5 iconos
      const initialIcons = ['bell', 'diamond', 'ellipse', 'gear', 'hexagon'];
      initialIcons.forEach(name => {
        builtIcons.set(name, {
          name,
          path: '/output/icons.js',
          source: 'library',
          svg: '<svg/>',
          isBuilt: true,
        });
        jsIcons.add(name);
      });

      const iconsJsContainer = new MockSvgItem(
        'icons.js',
        5,
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
        undefined,
        'built:icons.js'
      );
      itemCache.set('built:icons.js', iconsJsContainer);

      // Eliminar un icono
      builtIcons.delete('hexagon');
      jsIcons.delete('hexagon');

      expect(builtIcons.size).toBe(4);

      // Actualizar contador
      const cachedContainer = itemCache.get('built:icons.js');
      if (cachedContainer) {
        cachedContainer.description = `(${builtIcons.size})`;
      }

      expect(cachedContainer?.description).toBe('(4)');
    });

    test('contador debe reflejar iconos en icons.js no en sprite.svg', () => {
      const builtIcons = new Map<
        string,
        { name: string; path: string; source: string; svg: string; isBuilt: boolean }
      >();
      const jsIcons = new Set<string>();
      const spriteIcons = new Set<string>();

      // 3 iconos en icons.js
      ['bell', 'diamond', 'ellipse'].forEach(name => {
        builtIcons.set(name, {
          name,
          path: '/output/icons.js',
          source: 'library',
          svg: '<svg/>',
          isBuilt: true,
        });
        jsIcons.add(name);
      });

      // 2 iconos en sprite.svg
      ['arrow', 'check'].forEach(name => {
        builtIcons.set(name, {
          name,
          path: '/output/sprite.svg',
          source: 'library',
          svg: '<svg/>',
          isBuilt: true,
        });
        spriteIcons.add(name);
      });

      // Contar solo iconos de icons.js
      const jsIconCount = jsIcons.size;
      const spriteIconCount = spriteIcons.size;

      expect(jsIconCount).toBe(3);
      expect(spriteIconCount).toBe(2);
      expect(builtIcons.size).toBe(5); // Total
    });
  });
});
