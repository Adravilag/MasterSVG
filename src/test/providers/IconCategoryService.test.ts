/**
 * Tests for IconCategoryService
 *
 * Tests icon categorization and grouping functionality
 */

import * as path from 'path';
import {
  IconCategoryService,
  IconStorageMapsForCategory,
  CategoryInfo,
} from '../../providers/IconCategoryService';
import { WorkspaceIcon } from '../../types/icons';

// Mock path module
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  basename: (p: string, ext?: string) => {
    const parts = p.split(/[\\/]/);
    const name = parts[parts.length - 1] || '';
    return ext ? name.replace(ext, '') : name;
  },
}));

describe('IconCategoryService', () => {
  // Helper to create storage maps
  function createStorage(options?: {
    svgFiles?: Map<string, WorkspaceIcon>;
    libraryIcons?: Map<string, WorkspaceIcon>;
    inlineSvgs?: Map<string, WorkspaceIcon>;
    svgReferences?: Map<string, WorkspaceIcon[]>;
  }): IconStorageMapsForCategory {
    return {
      svgFiles: options?.svgFiles || new Map(),
      libraryIcons: options?.libraryIcons || new Map(),
      inlineSvgs: options?.inlineSvgs || new Map(),
      svgReferences: options?.svgReferences || new Map(),
    };
  }

  // Helper to create icon
  function createIcon(name: string, options?: Partial<WorkspaceIcon>): WorkspaceIcon {
    return {
      name,
      path: `/icons/${name}.svg`,
      source: 'workspace',
      ...options,
    };
  }

  describe('getCategories', () => {
    test('should return empty array for empty storage', () => {
      const storage = createStorage();
      const categories = IconCategoryService.getCategories(storage);

      expect(categories).toEqual([]);
    });

    test('should categorize workspace icons by folder', () => {
      const svgFiles = new Map<string, WorkspaceIcon>();
      svgFiles.set('icon1', createIcon('icon1', { category: 'icons' }));
      svgFiles.set('icon2', createIcon('icon2', { category: 'icons' }));
      svgFiles.set('icon3', createIcon('icon3', { category: 'assets' }));

      const storage = createStorage({ svgFiles });
      const categories = IconCategoryService.getCategories(storage);

      expect(categories.length).toBe(2);

      const iconsCategory = categories.find(c => c.name === 'icons');
      const assetsCategory = categories.find(c => c.name === 'assets');

      expect(iconsCategory?.count).toBe(2);
      expect(assetsCategory?.count).toBe(1);
    });

    test('should use "workspace" as default category', () => {
      const svgFiles = new Map<string, WorkspaceIcon>();
      svgFiles.set('icon1', createIcon('icon1')); // No category

      const storage = createStorage({ svgFiles });
      const categories = IconCategoryService.getCategories(storage);

      expect(categories.length).toBe(1);
      expect(categories[0].name).toBe('workspace');
      expect(categories[0].count).toBe(1);
    });

    test('should categorize library icons by source file', () => {
      const libraryIcons = new Map<string, WorkspaceIcon>();
      libraryIcons.set(
        'arrow',
        createIcon('arrow', {
          path: '/output/icons.js',
          source: 'library',
        })
      );
      libraryIcons.set(
        'check',
        createIcon('check', {
          path: '/output/icons.js',
          source: 'library',
        })
      );
      libraryIcons.set(
        'close',
        createIcon('close', {
          path: '/output/sprite.svg',
          source: 'library',
        })
      );

      const storage = createStorage({ libraryIcons });
      const categories = IconCategoryService.getCategories(storage);

      const iconsJsCategory = categories.find(c => c.name === '📦 icons.js');
      const spriteCategory = categories.find(c => c.name === '📦 sprite.svg');

      expect(iconsJsCategory?.count).toBe(2);
      expect(iconsJsCategory?.type).toBe('library');
      expect(spriteCategory?.count).toBe(1);
    });

    test('should categorize inline SVGs by file', () => {
      const inlineSvgs = new Map<string, WorkspaceIcon>();
      inlineSvgs.set(
        'inline1',
        createIcon('inline1', {
          filePath: '/src/App.tsx',
          source: 'inline',
        })
      );
      inlineSvgs.set(
        'inline2',
        createIcon('inline2', {
          filePath: '/src/App.tsx',
          source: 'inline',
        })
      );
      inlineSvgs.set(
        'inline3',
        createIcon('inline3', {
          filePath: '/src/Nav.tsx',
          source: 'inline',
        })
      );

      const storage = createStorage({ inlineSvgs });
      const categories = IconCategoryService.getCategories(storage);

      const appCategory = categories.find(c => c.name === '📄 App.tsx');
      const navCategory = categories.find(c => c.name === '📄 Nav.tsx');

      expect(appCategory?.count).toBe(2);
      expect(appCategory?.type).toBe('file');
      expect(navCategory?.count).toBe(1);
    });

    test('should categorize SVG references by file', () => {
      const svgReferences = new Map<string, WorkspaceIcon[]>();
      svgReferences.set('/src/page.html', [createIcon('ref1'), createIcon('ref2')]);
      svgReferences.set('/src/other.html', [createIcon('ref3')]);

      const storage = createStorage({ svgReferences });
      const categories = IconCategoryService.getCategories(storage);

      const pageCategory = categories.find(c => c.name === '🔗 page.html');
      const otherCategory = categories.find(c => c.name === '🔗 other.html');

      expect(pageCategory?.count).toBe(2);
      expect(pageCategory?.type).toBe('file');
      expect(otherCategory?.count).toBe(1);
    });

    test('should sort categories: library first, then alphabetically', () => {
      const libraryIcons = new Map<string, WorkspaceIcon>();
      libraryIcons.set(
        'lib',
        createIcon('lib', {
          path: '/output/icons.js',
          source: 'library',
        })
      );

      const inlineSvgs = new Map<string, WorkspaceIcon>();
      inlineSvgs.set(
        'inline',
        createIcon('inline', {
          filePath: '/src/App.tsx',
          source: 'inline',
        })
      );

      const svgFiles = new Map<string, WorkspaceIcon>();
      svgFiles.set('file', createIcon('file', { category: 'assets' }));

      const storage = createStorage({ libraryIcons, inlineSvgs, svgFiles });
      const categories = IconCategoryService.getCategories(storage);

      // Library should be first
      expect(categories[0].type).toBe('library');
      expect(categories[0].name).toBe('📦 icons.js');
    });
  });

  describe('getIconsByCategory', () => {
    test('should return empty array for non-existent category', () => {
      const storage = createStorage();
      const icons = IconCategoryService.getIconsByCategory('nonexistent', storage);

      expect(icons).toEqual([]);
    });

    describe('built: prefix', () => {
      test('should get built icons by file', () => {
        const libraryIcons = new Map<string, WorkspaceIcon>();
        libraryIcons.set(
          'arrow',
          createIcon('arrow', {
            path: '/output/icons.js',
            source: 'library',
            isBuilt: true,
          })
        );
        libraryIcons.set(
          'check',
          createIcon('check', {
            path: '/output/icons.js',
            source: 'library',
            isBuilt: true,
          })
        );
        libraryIcons.set(
          'close',
          createIcon('close', {
            path: '/output/sprite.svg',
            source: 'library',
            isBuilt: true,
          })
        );

        const storage = createStorage({ libraryIcons });
        const icons = IconCategoryService.getIconsByCategory('built:icons.js', storage);

        expect(icons.length).toBe(2);
        expect(icons.map(i => i.name).sort()).toEqual(['arrow', 'check']);
      });

      test('should only return built icons', () => {
        const libraryIcons = new Map<string, WorkspaceIcon>();
        libraryIcons.set(
          'built',
          createIcon('built', {
            path: '/output/icons.js',
            source: 'library',
            isBuilt: true,
          })
        );
        libraryIcons.set(
          'notbuilt',
          createIcon('notbuilt', {
            path: '/output/icons.js',
            source: 'library',
            isBuilt: false,
          })
        );

        const storage = createStorage({ libraryIcons });
        const icons = IconCategoryService.getIconsByCategory('built:icons.js', storage);

        expect(icons.length).toBe(1);
        expect(icons[0].name).toBe('built');
      });

      test('should sort by name', () => {
        const libraryIcons = new Map<string, WorkspaceIcon>();
        libraryIcons.set(
          'zebra',
          createIcon('zebra', {
            path: '/output/icons.js',
            source: 'library',
            isBuilt: true,
          })
        );
        libraryIcons.set(
          'alpha',
          createIcon('alpha', {
            path: '/output/icons.js',
            source: 'library',
            isBuilt: true,
          })
        );

        const storage = createStorage({ libraryIcons });
        const icons = IconCategoryService.getIconsByCategory('built:icons.js', storage);

        expect(icons[0].name).toBe('alpha');
        expect(icons[1].name).toBe('zebra');
      });
    });

    describe('folder: prefix', () => {
      test('should get workspace icons by folder', () => {
        const svgFiles = new Map<string, WorkspaceIcon>();
        svgFiles.set('icon1', createIcon('icon1', { category: 'icons' }));
        svgFiles.set('icon2', createIcon('icon2', { category: 'icons' }));
        svgFiles.set('icon3', createIcon('icon3', { category: 'assets' }));

        const storage = createStorage({ svgFiles });
        const icons = IconCategoryService.getIconsByCategory('folder:icons', storage);

        expect(icons.length).toBe(2);
      });

      test('should use "root" for icons without category', () => {
        const svgFiles = new Map<string, WorkspaceIcon>();
        svgFiles.set('icon1', createIcon('icon1')); // No category

        const storage = createStorage({ svgFiles });
        const icons = IconCategoryService.getIconsByCategory('folder:root', storage);

        expect(icons.length).toBe(1);
      });
    });

    describe('inline: prefix', () => {
      test('should get inline SVGs by file path', () => {
        const inlineSvgs = new Map<string, WorkspaceIcon>();
        inlineSvgs.set(
          'inline1',
          createIcon('inline1', {
            filePath: '/src/App.tsx',
            source: 'inline',
            line: 10,
          })
        );
        inlineSvgs.set(
          'inline2',
          createIcon('inline2', {
            filePath: '/src/App.tsx',
            source: 'inline',
            line: 20,
          })
        );
        inlineSvgs.set(
          'inline3',
          createIcon('inline3', {
            filePath: '/src/Nav.tsx',
            source: 'inline',
          })
        );

        const storage = createStorage({ inlineSvgs });
        const icons = IconCategoryService.getIconsByCategory('inline:/src/App.tsx', storage);

        expect(icons.length).toBe(2);
      });

      test('should sort by line number', () => {
        const inlineSvgs = new Map<string, WorkspaceIcon>();
        inlineSvgs.set(
          'inline1',
          createIcon('inline1', {
            filePath: '/src/App.tsx',
            source: 'inline',
            line: 50,
          })
        );
        inlineSvgs.set(
          'inline2',
          createIcon('inline2', {
            filePath: '/src/App.tsx',
            source: 'inline',
            line: 10,
          })
        );

        const storage = createStorage({ inlineSvgs });
        const icons = IconCategoryService.getIconsByCategory('inline:/src/App.tsx', storage);

        expect(icons[0].line).toBe(10);
        expect(icons[1].line).toBe(50);
      });
    });

    describe('refs: prefix', () => {
      test('should get SVG references by file path', () => {
        const svgReferences = new Map<string, WorkspaceIcon[]>();
        svgReferences.set('/src/page.html', [
          createIcon('ref1', { line: 10 }),
          createIcon('ref2', { line: 20 }),
        ]);

        const storage = createStorage({ svgReferences });
        const icons = IconCategoryService.getIconsByCategory('refs:/src/page.html', storage);

        expect(icons.length).toBe(2);
      });

      test('should sort by line number', () => {
        const svgReferences = new Map<string, WorkspaceIcon[]>();
        svgReferences.set('/src/page.html', [
          createIcon('ref1', { line: 50 }),
          createIcon('ref2', { line: 10 }),
        ]);

        const storage = createStorage({ svgReferences });
        const icons = IconCategoryService.getIconsByCategory('refs:/src/page.html', storage);

        expect(icons[0].line).toBe(10);
        expect(icons[1].line).toBe(50);
      });

      test('should return empty array for non-existent file', () => {
        const svgReferences = new Map<string, WorkspaceIcon[]>();

        const storage = createStorage({ svgReferences });
        const icons = IconCategoryService.getIconsByCategory('refs:/nonexistent.html', storage);

        expect(icons).toEqual([]);
      });
    });

    describe('legacy emoji prefixes', () => {
      test('should handle 📦 prefix for library icons', () => {
        const libraryIcons = new Map<string, WorkspaceIcon>();
        libraryIcons.set(
          'arrow',
          createIcon('arrow', {
            path: '/output/icons.js',
            source: 'library',
          })
        );

        const storage = createStorage({ libraryIcons });
        const icons = IconCategoryService.getIconsByCategory('📦 icons.js', storage);

        expect(icons.length).toBe(1);
      });

      test('should handle 📄 prefix for inline SVGs', () => {
        const inlineSvgs = new Map<string, WorkspaceIcon>();
        inlineSvgs.set(
          'inline1',
          createIcon('inline1', {
            filePath: '/src/App.tsx',
            source: 'inline',
          })
        );

        const storage = createStorage({ inlineSvgs });
        const icons = IconCategoryService.getIconsByCategory('📄 App.tsx', storage);

        expect(icons.length).toBe(1);
      });

      test('should handle 🔗 prefix for SVG references', () => {
        const svgReferences = new Map<string, WorkspaceIcon[]>();
        svgReferences.set('/src/page.html', [createIcon('ref1')]);

        const storage = createStorage({ svgReferences });
        const icons = IconCategoryService.getIconsByCategory('🔗 page.html', storage);

        expect(icons.length).toBe(1);
      });
    });

    describe('workspace folder categories', () => {
      test('should get icons by workspace category', () => {
        const svgFiles = new Map<string, WorkspaceIcon>();
        svgFiles.set('icon1', createIcon('icon1', { category: 'myCategory' }));
        svgFiles.set('icon2', createIcon('icon2', { category: 'myCategory' }));
        svgFiles.set('icon3', createIcon('icon3', { category: 'other' }));

        const storage = createStorage({ svgFiles });
        const icons = IconCategoryService.getIconsByCategory('myCategory', storage);

        expect(icons.length).toBe(2);
      });

      test('should sort by name', () => {
        const svgFiles = new Map<string, WorkspaceIcon>();
        svgFiles.set('zebra', createIcon('zebra', { category: 'test' }));
        svgFiles.set('alpha', createIcon('alpha', { category: 'test' }));

        const storage = createStorage({ svgFiles });
        const icons = IconCategoryService.getIconsByCategory('test', storage);

        expect(icons[0].name).toBe('alpha');
        expect(icons[1].name).toBe('zebra');
      });
    });
  });

  describe('CategoryInfo interface', () => {
    test('should have correct structure', () => {
      const category: CategoryInfo = {
        name: 'icons',
        count: 5,
        type: 'folder',
      };

      expect(category.name).toBe('icons');
      expect(category.count).toBe(5);
      expect(category.type).toBe('folder');
    });

    test('should support all type values', () => {
      const library: CategoryInfo = { name: 'lib', count: 1, type: 'library' };
      const file: CategoryInfo = { name: 'file', count: 2, type: 'file' };
      const folder: CategoryInfo = { name: 'folder', count: 3, type: 'folder' };

      expect(library.type).toBe('library');
      expect(file.type).toBe('file');
      expect(folder.type).toBe('folder');
    });
  });
});
