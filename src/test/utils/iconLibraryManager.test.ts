/**
 * Tests for iconLibraryManager.ts
 */

import {
  LibraryIcon,
  loadLibraryIcons,
  saveLibraryIcons,
  findIconInLibrary,
  upsertIconInLibrary,
  removeIconFromLibrary,
  getDefaultLibraryPath,
  generateIconEntryCode,
  generateNewIconsFileContent,
  updateIconsFileContent,
  iconExistsInIconsFile,
  generateSpriteSymbol,
  generateNewSpriteContent,
  updateSpriteContent,
  symbolExistsInSprite,
  generateWebComponentCode,
  componentNameToTagName,
  isValidIconName,
  validateIconName,
  generateVariantsFileContent,
  generateAnimationsFileContent,
  parseIconNamesFromContent,
  parseVariableNamesFromContent,
  countIconsInContent,
  generateIconImportStatement,
  hasImportInContent,
  findImportInsertLine,
  generateScriptTag,
  calculateRelativePath,
} from '../../utils/iconLibraryManager';

import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('iconLibraryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadLibraryIcons', () => {
    it('should load icons from existing file', () => {
      const icons = [{ name: 'home', svg: '<svg></svg>' }];
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(icons));

      const result = loadLibraryIcons('/path/to/library.json');
      expect(result).toEqual(icons);
    });

    it('should return empty array if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = loadLibraryIcons('/path/to/library.json');
      expect(result).toEqual([]);
    });

    it('should return empty array on parse error', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      const result = loadLibraryIcons('/path/to/library.json');
      expect(result).toEqual([]);
    });
  });

  describe('saveLibraryIcons', () => {
    it('should create directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.writeFileSync.mockImplementation(() => undefined);

      const icons = [{ name: 'home', svg: '<svg></svg>' }];
      saveLibraryIcons('/path/to/library.json', icons);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/path/to', { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should save icons as JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => undefined);

      const icons = [{ name: 'home', svg: '<svg></svg>' }];
      saveLibraryIcons('/path/to/library.json', icons);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/path/to/library.json',
        JSON.stringify(icons, null, 2)
      );
    });
  });

  describe('findIconInLibrary', () => {
    const icons: LibraryIcon[] = [
      { name: 'home', svg: '<svg></svg>' },
      { name: 'user', svg: '<svg></svg>' },
    ];

    it('should find existing icon', () => {
      expect(findIconInLibrary(icons, 'home')).toBe(0);
      expect(findIconInLibrary(icons, 'user')).toBe(1);
    });

    it('should return -1 for non-existing icon', () => {
      expect(findIconInLibrary(icons, 'settings')).toBe(-1);
    });
  });

  describe('upsertIconInLibrary', () => {
    it('should add new icon', () => {
      const icons: LibraryIcon[] = [];
      const newIcon = { name: 'home', svg: '<svg></svg>' };

      const result = upsertIconInLibrary(icons, newIcon);
      
      expect(result.added).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.icons).toHaveLength(1);
    });

    it('should update existing icon when overwrite is true', () => {
      const icons: LibraryIcon[] = [{ name: 'home', svg: '<svg>old</svg>' }];
      const newIcon = { name: 'home', svg: '<svg>new</svg>' };

      const result = upsertIconInLibrary(icons, newIcon, true);
      
      expect(result.added).toBe(false);
      expect(result.updated).toBe(true);
      expect(result.icons[0].svg).toBe('<svg>new</svg>');
    });

    it('should not update when overwrite is false', () => {
      const icons: LibraryIcon[] = [{ name: 'home', svg: '<svg>old</svg>' }];
      const newIcon = { name: 'home', svg: '<svg>new</svg>' };

      const result = upsertIconInLibrary(icons, newIcon, false);
      
      expect(result.added).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.icons[0].svg).toBe('<svg>old</svg>');
    });
  });

  describe('removeIconFromLibrary', () => {
    it('should remove existing icon', () => {
      const icons: LibraryIcon[] = [
        { name: 'home', svg: '<svg></svg>' },
        { name: 'user', svg: '<svg></svg>' },
      ];

      const result = removeIconFromLibrary(icons, 'home');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('user');
    });

    it('should return same array if icon not found', () => {
      const icons: LibraryIcon[] = [{ name: 'home', svg: '<svg></svg>' }];

      const result = removeIconFromLibrary(icons, 'user');
      expect(result).toHaveLength(1);
    });
  });

  describe('getDefaultLibraryPath', () => {
    it('should return path in APPDATA', () => {
      const originalAppData = process.env.APPDATA;
      process.env.APPDATA = 'C:\\Users\\Test\\AppData\\Roaming';

      const result = getDefaultLibraryPath();
      expect(result).toContain('icon-manager');
      expect(result).toContain('icons.json');

      process.env.APPDATA = originalAppData;
    });
  });

  describe('generateIconEntryCode', () => {
    it('should generate icon entry with default viewBox', () => {
      const result = generateIconEntryCode('homeIcon', 'home', '<path d="M0 0"/>');
      
      expect(result).toContain('export const homeIcon');
      expect(result).toContain("name: 'home'");
      expect(result).toContain('<path d="M0 0"/>');
      expect(result).toContain("viewBox: '0 0 24 24'");
    });

    it('should use custom viewBox', () => {
      const result = generateIconEntryCode('icon', 'test', '<path/>', '0 0 32 32');
      expect(result).toContain("viewBox: '0 0 32 32'");
    });
  });

  describe('generateNewIconsFileContent', () => {
    it('should generate complete icons.js file', () => {
      const entries = [
        { varName: 'homeIcon', entry: "export const homeIcon = { name: 'home' };" },
        { varName: 'userIcon', entry: "export const userIcon = { name: 'user' };" },
      ];

      const result = generateNewIconsFileContent(entries);
      
      expect(result).toContain('// Auto-generated by Icon Manager');
      expect(result).toContain('export const icons = {');
      expect(result).toContain('homeIcon');
      expect(result).toContain('userIcon');
    });
  });

  describe('updateIconsFileContent', () => {
    it('should replace existing icon', () => {
      const content = `export const homeIcon = {
  name: 'home',
  body: '<old/>'
};

export const icons = {
  homeIcon
};`;

      const newEntry = `export const homeIcon = {
  name: 'home',
  body: '<new/>'
};`;

      const result = updateIconsFileContent(content, 'homeIcon', newEntry);
      expect(result).toContain('<new/>');
      expect(result).not.toContain('<old/>');
    });

    it('should add new icon before icons object', () => {
      const content = `export const icons = {
  homeIcon
};`;

      const newEntry = `export const userIcon = {
  name: 'user'
};`;

      const result = updateIconsFileContent(content, 'userIcon', newEntry);
      expect(result).toContain('userIcon');
    });

    it('should append at end if no icons object', () => {
      const content = `// Some content`;
      const newEntry = `export const homeIcon = {};`;

      const result = updateIconsFileContent(content, 'homeIcon', newEntry);
      expect(result).toContain('// Some content');
      expect(result).toContain('export const homeIcon');
    });
  });

  describe('iconExistsInIconsFile', () => {
    it('should return true for existing icon', () => {
      const content = 'export const homeIcon = {};';
      expect(iconExistsInIconsFile(content, 'homeIcon')).toBe(true);
    });

    it('should return false for non-existing icon', () => {
      const content = 'export const homeIcon = {};';
      expect(iconExistsInIconsFile(content, 'userIcon')).toBe(false);
    });
  });

  describe('generateSpriteSymbol', () => {
    it('should generate symbol with default viewBox', () => {
      const result = generateSpriteSymbol('home', '<path d="M0 0"/>');
      
      expect(result).toContain('<symbol id="home"');
      expect(result).toContain('viewBox="0 0 24 24"');
      expect(result).toContain('<path d="M0 0"/>');
      expect(result).toContain('</symbol>');
    });

    it('should use custom viewBox', () => {
      const result = generateSpriteSymbol('home', '<path/>', '0 0 48 48');
      expect(result).toContain('viewBox="0 0 48 48"');
    });
  });

  describe('generateNewSpriteContent', () => {
    it('should generate sprite with symbols', () => {
      const symbols = [
        '<symbol id="home"></symbol>',
        '<symbol id="user"></symbol>',
      ];

      const result = generateNewSpriteContent(symbols);
      
      expect(result).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(result).toContain('style="display: none;"');
      expect(result).toContain('<symbol id="home">');
      expect(result).toContain('<symbol id="user">');
      expect(result).toContain('</svg>');
    });
  });

  describe('updateSpriteContent', () => {
    it('should replace existing symbol', () => {
      const content = `<svg>
<symbol id="home" viewBox="0 0 24 24"><path d="old"/></symbol>
</svg>`;

      const newSymbol = '<symbol id="home" viewBox="0 0 24 24"><path d="new"/></symbol>';
      const result = updateSpriteContent(content, 'home', newSymbol);
      
      expect(result).toContain('<path d="new"/>');
      expect(result).not.toContain('<path d="old"/>');
    });

    it('should add new symbol before closing svg', () => {
      const content = `<svg>
</svg>`;

      const newSymbol = '<symbol id="home"></symbol>';
      const result = updateSpriteContent(content, 'home', newSymbol);
      
      expect(result).toContain('<symbol id="home">');
    });
  });

  describe('symbolExistsInSprite', () => {
    it('should return true for existing symbol', () => {
      const content = '<symbol id="home" viewBox="0 0 24 24">';
      expect(symbolExistsInSprite(content, 'home')).toBe(true);
    });

    it('should return false for non-existing symbol', () => {
      const content = '<symbol id="home">';
      expect(symbolExistsInSprite(content, 'user')).toBe(false);
    });

    it('should handle single quotes', () => {
      const content = "<symbol id='home'>";
      expect(symbolExistsInSprite(content, 'home')).toBe(true);
    });
  });

  describe('generateWebComponentCode', () => {
    it('should generate web component with tag name', () => {
      const result = generateWebComponentCode('my-icon');
      
      expect(result).toContain('class IconElement extends HTMLElement');
      expect(result).toContain("customElements.define('my-icon'");
      expect(result).toContain("import { icons } from './icons.js'");
      expect(result).toContain('observedAttributes');
    });

    it('should include animation styles', () => {
      const result = generateWebComponentCode('my-icon');
      
      expect(result).toContain('@keyframes icon-spin');
      expect(result).toContain('@keyframes icon-pulse');
      expect(result).toContain('@keyframes icon-bounce');
    });
  });

  describe('componentNameToTagName', () => {
    it('should convert PascalCase to kebab-case', () => {
      expect(componentNameToTagName('MyIcon')).toBe('my-icon');
    });

    it('should convert camelCase to kebab-case', () => {
      expect(componentNameToTagName('myIcon')).toBe('my-icon');
    });

    it('should add -icon suffix if no hyphen', () => {
      expect(componentNameToTagName('Icon')).toBe('icon-icon');
      expect(componentNameToTagName('svg')).toBe('svg-icon');
    });

    it('should keep existing hyphen', () => {
      expect(componentNameToTagName('my-icon')).toBe('my-icon');
    });
  });

  describe('isValidIconName', () => {
    it('should return true for valid names', () => {
      expect(isValidIconName('home')).toBe(true);
      expect(isValidIconName('home-icon')).toBe(true);
      expect(isValidIconName('icon123')).toBe(true);
      expect(isValidIconName('MyIcon')).toBe(true);
    });

    it('should return false for invalid names', () => {
      expect(isValidIconName('')).toBe(false);
      expect(isValidIconName('123icon')).toBe(false);
      expect(isValidIconName('-icon')).toBe(false);
      expect(isValidIconName('icon_name')).toBe(false);
      expect(isValidIconName('icon name')).toBe(false);
    });
  });

  describe('validateIconName', () => {
    it('should return null for valid names', () => {
      expect(validateIconName('home')).toBeNull();
      expect(validateIconName('home-icon')).toBeNull();
    });

    it('should return error for empty name', () => {
      expect(validateIconName('')).toBe('Icon name is required');
    });

    it('should return error for invalid format', () => {
      expect(validateIconName('123')).toContain('Must start with a letter');
    });
  });

  describe('generateVariantsFileContent', () => {
    it('should generate variants.js content', () => {
      const variants = {
        home: { dark: ['#fff', '#000'] },
      };

      const result = generateVariantsFileContent(variants);
      
      expect(result).toContain('export const Variants');
      expect(result).toContain('export const defaultVariants');
      expect(result).toContain('"home"');
      expect(result).toContain('"dark"');
    });
  });

  describe('generateAnimationsFileContent', () => {
    it('should generate animations.js content', () => {
      const animations = {
        spinner: { type: 'spin', duration: 1, timing: 'linear', iteration: 'infinite' },
      };

      const result = generateAnimationsFileContent(animations);
      
      expect(result).toContain('export const animations');
      expect(result).toContain('"spinner"');
      expect(result).toContain('"spin"');
    });
  });

  describe('parseIconNamesFromContent', () => {
    it('should extract icon names', () => {
      const content = `
        name: 'home',
        name: "user",
        name: 'settings',
      `;

      const result = parseIconNamesFromContent(content);
      expect(result).toEqual(['home', 'user', 'settings']);
    });

    it('should return empty array for no icons', () => {
      expect(parseIconNamesFromContent('no icons here')).toEqual([]);
    });
  });

  describe('parseVariableNamesFromContent', () => {
    it('should extract variable names', () => {
      const content = `
        export const homeIcon = {};
        export const userIcon = {};
        export const icons = {};
      `;

      const result = parseVariableNamesFromContent(content);
      expect(result).toEqual(['homeIcon', 'userIcon']);
    });
  });

  describe('countIconsInContent', () => {
    it('should count icons', () => {
      const content = `
        name: 'home',
        name: "user",
      `;

      expect(countIconsInContent(content)).toBe(2);
    });

    it('should return 0 for no icons', () => {
      expect(countIconsInContent('')).toBe(0);
    });
  });

  describe('generateIconImportStatement', () => {
    it('should generate import with PascalCase names', () => {
      const result = generateIconImportStatement(['home', 'user-profile'], '@/icons');
      
      expect(result).toBe("import { Home, UserProfile } from '@/icons';");
    });
  });

  describe('hasImportInContent', () => {
    it('should return true for existing import', () => {
      const content = "import { Icon } from '@/components';";
      expect(hasImportInContent(content, 'Icon')).toBe(true);
    });

    it('should return false for non-existing import', () => {
      const content = "import { Button } from '@/components';";
      expect(hasImportInContent(content, 'Icon')).toBe(false);
    });
  });

  describe('findImportInsertLine', () => {
    it('should find line after last import', () => {
      const lines = [
        "import a from 'a';",
        "import b from 'b';",
        '',
        'const x = 1;',
      ];

      expect(findImportInsertLine(lines)).toBe(2);
    });

    it('should return 0 for no imports', () => {
      const lines = ['const x = 1;'];
      expect(findImportInsertLine(lines)).toBe(0);
    });

    it('should skip comments at start', () => {
      const lines = [
        '// Comment',
        '/* Block */',
        "import x from 'x';",
        'code',
      ];

      expect(findImportInsertLine(lines)).toBe(3);
    });
  });

  describe('generateScriptTag', () => {
    it('should generate script tag', () => {
      const result = generateScriptTag('./icons/icon.js');
      expect(result).toBe('    <script type="module" src="./icons/icon.js"></script>\n');
    });
  });

  describe('calculateRelativePath', () => {
    it('should calculate relative path', () => {
      const result = calculateRelativePath('/project/src', '/project/icons/icon.js');
      expect(result).toContain('icons/icon.js');
    });

    it('should add ./ prefix if needed', () => {
      const result = calculateRelativePath('/project', '/project/icons/icon.js');
      expect(result.startsWith('./')).toBe(true);
    });
  });
});
