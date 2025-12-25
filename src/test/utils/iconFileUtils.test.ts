import {
  generateIconEntry,
  createIconExportPattern,
  iconExportExists,
  replaceIconExport,
  findIconsObjectPosition,
  extractIconsObjectContent,
  addIconToIconsObject,
  insertIconBeforeObject,
  generateNewIconsFileContent,
  updateIconsFileContent,
  generateWebComponentHeader,
  componentNameToTagName,
  generateVariantsFile,
  generateAnimationsFile,
  parseIconNames,
  parseIconVariables,
  isValidIconsFile,
  countIconsInFile,
  removeIconFromFile,
  COLOR_PRESETS,
  generateColorPresetButtons
} from '../../utils/iconFileUtils';

describe('iconFileUtils', () => {
  describe('generateIconEntry', () => {
    it('should generate icon entry with default viewBox', () => {
      const result = generateIconEntry('homeIcon', 'home', '<path d="M10 20"/>');
      expect(result).toContain('export const homeIcon = {');
      expect(result).toContain("name: 'home'");
      expect(result).toContain('body: `<path d="M10 20"/>`');
      expect(result).toContain("viewBox: '0 0 24 24'");
    });

    it('should use custom viewBox when provided', () => {
      const result = generateIconEntry('icon', 'test', '<path/>', '0 0 16 16');
      expect(result).toContain("viewBox: '0 0 16 16'");
    });

    it('should handle special characters in body', () => {
      const result = generateIconEntry('icon', 'test', '<path fill="#fff"/>');
      expect(result).toContain('<path fill="#fff"/>');
    });

    it('should generate proper JS syntax', () => {
      const result = generateIconEntry('myIcon', 'my-icon', '<g></g>');
      expect(result).toMatch(/^export const \w+ = \{/);
      expect(result).toMatch(/\};$/);
    });
  });

  describe('createIconExportPattern', () => {
    it('should create pattern matching export const', () => {
      const pattern = createIconExportPattern('homeIcon');
      expect(pattern.test('export const homeIcon = { name: "home" };')).toBe(true);
    });

    it('should match multiline exports', () => {
      const pattern = createIconExportPattern('icon');
      const content = `export const icon = {
  name: 'test',
  body: '<path/>'
};`;
      expect(pattern.test(content)).toBe(true);
    });

    it('should not match different names', () => {
      const pattern = createIconExportPattern('homeIcon');
      expect(pattern.test('export const otherIcon = {};')).toBe(false);
    });
  });

  describe('iconExportExists', () => {
    it('should return true when icon export exists', () => {
      const content = 'export const homeIcon = { name: "home" };';
      expect(iconExportExists(content, 'homeIcon')).toBe(true);
    });

    it('should return false when icon does not exist', () => {
      const content = 'export const otherIcon = {};';
      expect(iconExportExists(content, 'homeIcon')).toBe(false);
    });

    it('should handle empty content', () => {
      expect(iconExportExists('', 'icon')).toBe(false);
    });
  });

  describe('replaceIconExport', () => {
    it('should replace existing icon export', () => {
      const content = `export const icon = {
  name: 'old'
};`;
      const newEntry = `export const icon = {
  name: 'new'
};`;
      const result = replaceIconExport(content, 'icon', newEntry);
      expect(result).toContain("name: 'new'");
      expect(result).not.toContain("name: 'old'");
    });
  });

  describe('findIconsObjectPosition', () => {
    it('should find position of icons object', () => {
      const content = 'const x = 1;\nexport const icons = {\n  icon\n};';
      const position = findIconsObjectPosition(content);
      expect(position).toBe(13); // Position after newline
    });

    it('should return null if not found', () => {
      expect(findIconsObjectPosition('const x = 1;')).toBeNull();
    });

    it('should handle empty content', () => {
      expect(findIconsObjectPosition('')).toBeNull();
    });
  });

  describe('extractIconsObjectContent', () => {
    it('should extract content from icons object', () => {
      const content = 'export const icons = { homeIcon, userIcon };';
      expect(extractIconsObjectContent(content)).toBe('homeIcon, userIcon');
    });

    it('should handle empty icons object', () => {
      const content = 'export const icons = {};';
      expect(extractIconsObjectContent(content)).toBe('');
    });

    it('should return null if not found', () => {
      expect(extractIconsObjectContent('const x = 1;')).toBeNull();
    });

    it('should handle multiline content', () => {
      const content = `export const icons = {
  homeIcon,
  userIcon
};`;
      const result = extractIconsObjectContent(content);
      expect(result).toContain('homeIcon');
      expect(result).toContain('userIcon');
    });
  });

  describe('addIconToIconsObject', () => {
    it('should add icon to existing icons object', () => {
      const content = 'export const icons = { existingIcon };';
      const result = addIconToIconsObject(content, 'newIcon');
      expect(result).toContain('existingIcon');
      expect(result).toContain('newIcon');
    });

    it('should handle empty icons object', () => {
      const content = 'export const icons = {};';
      const result = addIconToIconsObject(content, 'newIcon');
      expect(result).toContain('newIcon');
    });

    it('should return unchanged if no icons object', () => {
      const content = 'const x = 1;';
      expect(addIconToIconsObject(content, 'icon')).toBe(content);
    });
  });

  describe('insertIconBeforeObject', () => {
    it('should insert content at position', () => {
      const content = 'export const icons = {};';
      const result = insertIconBeforeObject(content, 'const icon = {};', 0);
      expect(result).toBe('const icon = {};\n\nexport const icons = {};');
    });

    it('should handle middle insertion', () => {
      const content = 'beforeafter';
      const result = insertIconBeforeObject(content, 'middle', 6);
      expect(result).toBe('beforemiddle\n\nafter');
    });
  });

  describe('generateNewIconsFileContent', () => {
    it('should generate complete icons.js file', () => {
      const entry = 'export const icon = { name: "test" };';
      const result = generateNewIconsFileContent('icon', entry);
      
      expect(result).toContain('Auto-generated by Icon Manager');
      expect(result).toContain('Do not edit manually');
      expect(result).toContain(entry);
      expect(result).toContain('export const icons = {');
      expect(result).toContain('icon');
    });
  });

  describe('updateIconsFileContent', () => {
    it('should replace existing icon', () => {
      const content = `export const icon = { name: 'old' };
export const icons = { icon };`;
      const entry = `export const icon = { name: 'new' };`;
      const result = updateIconsFileContent(content, 'icon', entry);
      
      expect(result).toContain("name: 'new'");
      expect(result).not.toContain("name: 'old'");
    });

    it('should add new icon before icons object', () => {
      const content = `export const existing = { name: 'existing' };

export const icons = { existing };`;
      const entry = `export const newIcon = { name: 'new' };`;
      const result = updateIconsFileContent(content, 'newIcon', entry);
      
      expect(result).toContain("name: 'new'");
      expect(result).toContain('newIcon');
    });

    it('should append to end if no icons object', () => {
      const content = '// some content';
      const entry = `export const icon = { name: 'test' };`;
      const result = updateIconsFileContent(content, 'icon', entry);
      
      expect(result).toContain(content);
      expect(result).toContain(entry);
    });
  });

  describe('generateWebComponentHeader', () => {
    it('should generate header with tag name', () => {
      const result = generateWebComponentHeader('my-icon');
      
      expect(result).toContain('Auto-generated Web Component');
      expect(result).toContain('<my-icon name="icon-name">');
      expect(result).toContain('variant="dark-theme"');
      expect(result).toContain('animation="spin"');
    });
  });

  describe('componentNameToTagName', () => {
    it('should convert PascalCase to kebab-case', () => {
      expect(componentNameToTagName('MyIcon')).toBe('my-icon');
      expect(componentNameToTagName('IconComponent')).toBe('icon-component');
    });

    it('should convert camelCase to kebab-case', () => {
      expect(componentNameToTagName('myIcon')).toBe('my-icon');
    });

    it('should add -icon suffix if no hyphen', () => {
      expect(componentNameToTagName('Icon')).toBe('icon-icon');
      expect(componentNameToTagName('svg')).toBe('svg-icon');
    });

    it('should keep existing hyphen', () => {
      expect(componentNameToTagName('my-custom')).toBe('my-custom');
    });

    it('should handle multiple capitals', () => {
      // SVGIcon becomes svgicon since capitals at start don't have preceding lowercase
      expect(componentNameToTagName('SVGIcon')).toBe('svgicon-icon');
    });
  });

  describe('generateVariantsFile', () => {
    it('should generate variants.js content', () => {
      const variants = {
        'home': { 'dark': ['#fff', '#000'], 'light': ['#000', '#fff'] }
      };
      const defaults = { 'home': 'dark' };
      
      const result = generateVariantsFile(variants, defaults);
      
      expect(result).toContain('Auto-generated by Icon Manager');
      expect(result).toContain('export const Variants');
      expect(result).toContain('export const defaultVariants');
      expect(result).toContain('"home"');
      expect(result).toContain('"dark"');
    });

    it('should handle empty variants', () => {
      const result = generateVariantsFile({}, {});
      expect(result).toContain('export const Variants = {}');
      expect(result).toContain('export const defaultVariants = {}');
    });
  });

  describe('generateAnimationsFile', () => {
    it('should generate animations.js content', () => {
      const animations = {
        'home': { type: 'spin', duration: 1, timing: 'ease', iteration: 'infinite' }
      };
      
      const result = generateAnimationsFile(animations);
      
      expect(result).toContain('Auto-generated by Icon Manager');
      expect(result).toContain('export const animations');
      expect(result).toContain('"spin"');
      expect(result).toContain('"duration"');
    });

    it('should handle empty animations', () => {
      const result = generateAnimationsFile({});
      expect(result).toContain('export const animations = {}');
    });
  });

  describe('parseIconNames', () => {
    it('should extract icon names from content', () => {
      const content = `export const homeIcon = { name: 'home', body: '' };
export const userIcon = { name: 'user', body: '' };`;
      
      const names = parseIconNames(content);
      expect(names).toEqual(['home', 'user']);
    });

    it('should handle double quotes', () => {
      const content = `export const icon = { name: "test", body: '' };`;
      expect(parseIconNames(content)).toEqual(['test']);
    });

    it('should return empty array for no icons', () => {
      expect(parseIconNames('const x = 1;')).toEqual([]);
    });
  });

  describe('parseIconVariables', () => {
    it('should extract variable names from content', () => {
      const content = `export const homeIcon = { name: 'home' };
export const userIcon = { name: 'user' };`;
      
      const vars = parseIconVariables(content);
      expect(vars).toEqual(['homeIcon', 'userIcon']);
    });

    it('should return empty array for no icons', () => {
      expect(parseIconVariables('const x = 1;')).toEqual([]);
    });
  });

  describe('isValidIconsFile', () => {
    it('should return true for file with icons object', () => {
      const content = 'export const icons = { icon };';
      expect(isValidIconsFile(content)).toBe(true);
    });

    it('should return true for file with body property', () => {
      const content = "export const icon = { body: '<path/>' };";
      expect(isValidIconsFile(content)).toBe(true);
    });

    it('should return false for invalid content', () => {
      expect(isValidIconsFile('const x = 1;')).toBe(false);
      expect(isValidIconsFile('')).toBe(false);
    });
  });

  describe('countIconsInFile', () => {
    it('should count icons in file', () => {
      const content = `export const icon1 = { name: 'a' };
export const icon2 = { name: 'b' };
export const icon3 = { name: 'c' };`;
      
      expect(countIconsInFile(content)).toBe(3);
    });

    it('should return 0 for no icons', () => {
      expect(countIconsInFile('')).toBe(0);
    });
  });

  describe('removeIconFromFile', () => {
    it('should remove icon export and from object', () => {
      const content = `export const icon1 = { name: 'a' };
export const icon2 = { name: 'b' };

export const icons = {
  icon1,
  icon2
};`;
      
      const result = removeIconFromFile(content, 'icon1');
      expect(result).not.toContain("export const icon1");
      expect(result).toContain("export const icon2");
    });

    it('should handle single icon in object', () => {
      const content = `export const icon = { name: 'a' };
export const icons = { icon };`;
      
      const result = removeIconFromFile(content, 'icon');
      expect(result).toContain('export const icons = {}');
    });

    it('should clean up extra newlines', () => {
      const content = `export const icon = { name: 'a' };


export const icons = { icon };`;
      
      const result = removeIconFromFile(content, 'icon');
      expect(result).not.toMatch(/\n{3,}/);
    });
  });

  describe('COLOR_PRESETS', () => {
    it('should have 8 color presets', () => {
      expect(COLOR_PRESETS).toHaveLength(8);
    });

    it('should have color and name for each preset', () => {
      COLOR_PRESETS.forEach(preset => {
        expect(preset).toHaveProperty('color');
        expect(preset).toHaveProperty('name');
        expect(preset.color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('should include white and black', () => {
      const colors = COLOR_PRESETS.map(p => p.color);
      expect(colors).toContain('#ffffff');
      expect(colors).toContain('#000000');
    });
  });

  describe('generateColorPresetButtons', () => {
    it('should generate buttons for all presets', () => {
      const result = generateColorPresetButtons();
      COLOR_PRESETS.forEach(preset => {
        expect(result).toContain(preset.color);
        expect(result).toContain(`title="${preset.name}"`);
      });
    });

    it('should mark active color', () => {
      const result = generateColorPresetButtons('#3b82f6');
      expect(result).toContain('data-color="#3b82f6"');
      // Blue should be active - class comes before data-color
      expect(result).toContain('class="color-preset active" style="background: #3b82f6"');
    });

    it('should default to white as active', () => {
      const result = generateColorPresetButtons();
      expect(result).toMatch(/data-color="#ffffff"[^>]*active|class="color-preset active"[^>]*data-color="#ffffff"/);
    });
  });
});
