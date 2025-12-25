/**
 * Tests for outputFileManager.ts
 */

import {
  toVariableName,
  toIconName,
  generateIconEntry,
  generateIconExport,
  iconExportExistsInContent,
  replaceIconExportInContent,
  findIconsObjectPosition,
  addIconBeforeIconsObject,
  updateIconsFileContent,
  generateNewIconsFileContent,
  generateSpriteSymbol,
  symbolExistsInSprite,
  replaceSymbolInSprite,
  addSymbolToSprite,
  updateSpriteContent,
  generateNewSpriteContent,
  generateDefaultVariantsContent,
  generateDefaultAnimationsContent,
  removeIconExportFromContent,
  removeSymbolFromSpriteContent,
  buildIconsFileContent,
  buildSpriteFileContent,
  getIconsFilePath,
  getSpriteFilePath,
  getWebComponentFilePath,
  getVariantsFilePath,
  getAnimationsFilePath,
  calculateRelativePath,
  countIconsInContent,
  countSymbolsInSprite,
  extractIconNamesFromContent,
  extractSymbolIdsFromSprite,
  SvgTransformerInterface,
} from '../../utils/outputFileManager';

describe('outputFileManager', () => {
  describe('toVariableName', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(toVariableName('arrow-right')).toBe('arrowRight');
      expect(toVariableName('user-circle')).toBe('userCircle');
    });

    it('should handle colon separator (prefix:name)', () => {
      expect(toVariableName('mdi:home')).toBe('mdiHome');
      expect(toVariableName('fa:user')).toBe('faUser');
    });

    it('should handle single word', () => {
      expect(toVariableName('home')).toBe('home');
    });

    it('should handle multiple hyphens', () => {
      expect(toVariableName('arrow-circle-right')).toBe('arrowCircleRight');
    });
  });

  describe('toIconName', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(toIconName('arrowRight')).toBe('arrow-right');
      expect(toIconName('userCircle')).toBe('user-circle');
    });

    it('should handle single word', () => {
      expect(toIconName('home')).toBe('home');
    });

    it('should handle already kebab-case', () => {
      expect(toIconName('arrow-right')).toBe('arrow-right');
    });
  });

  describe('generateIconEntry', () => {
    it('should generate icon entry object', () => {
      const entry = generateIconEntry('home', '<path d="M0 0"/>', '0 0 24 24');
      
      expect(entry.name).toBe('home');
      expect(entry.body).toBe('<path d="M0 0"/>');
      expect(entry.viewBox).toBe('0 0 24 24');
    });

    it('should use default viewBox', () => {
      const entry = generateIconEntry('home', '<path/>');
      
      expect(entry.viewBox).toBe('0 0 24 24');
    });
  });

  describe('generateIconExport', () => {
    it('should generate export statement', () => {
      const result = generateIconExport('arrow-right', '<path d="M0 0"/>');
      
      expect(result).toContain('export const arrowRight');
      expect(result).toContain("name: 'arrow-right'");
      expect(result).toContain('body: `<path d="M0 0"/>`');
      expect(result).toContain("viewBox: '0 0 24 24'");
    });

    it('should use custom viewBox', () => {
      const result = generateIconExport('home', '<path/>', '0 0 16 16');
      
      expect(result).toContain("viewBox: '0 0 16 16'");
    });
  });

  describe('iconExportExistsInContent', () => {
    const content = `export const arrowRight = { name: 'arrow-right' };`;

    it('should return true for existing icon', () => {
      expect(iconExportExistsInContent(content, 'arrow-right')).toBe(true);
    });

    it('should return false for non-existing icon', () => {
      expect(iconExportExistsInContent(content, 'home')).toBe(false);
    });
  });

  describe('replaceIconExportInContent', () => {
    it('should replace existing icon export', () => {
      const content = `export const home = {
  name: 'home',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};`;
      const newExport = `export const home = {
  name: 'home',
  body: \`<circle/>\`,
  viewBox: '0 0 16 16'
};`;
      
      const result = replaceIconExportInContent(content, 'home', newExport);
      
      expect(result).toContain('<circle/>');
      expect(result).not.toContain('<path/>');
    });
  });

  describe('findIconsObjectPosition', () => {
    it('should find position of icons object', () => {
      const content = `export const home = {};\n\nexport const icons = {\n  home\n};`;
      const pos = findIconsObjectPosition(content);
      
      expect(pos).toBeGreaterThan(0);
    });

    it('should return -1 if not found', () => {
      const content = `export const home = {};`;
      const pos = findIconsObjectPosition(content);
      
      expect(pos).toBe(-1);
    });
  });

  describe('addIconBeforeIconsObject', () => {
    it('should add icon before icons object', () => {
      const content = `export const icons = {\n  home\n};`;
      const iconExport = `export const arrowRight = { name: 'arrow-right' };`;
      
      const result = addIconBeforeIconsObject(content, iconExport, 'arrow-right');
      
      expect(result).toContain(iconExport);
      expect(result.indexOf(iconExport)).toBeLessThan(result.indexOf('export const icons'));
    });

    it('should add icon to icons object', () => {
      const content = `export const icons = {\n  home\n};`;
      const iconExport = `export const arrowRight = { name: 'arrow-right' };`;
      
      const result = addIconBeforeIconsObject(content, iconExport, 'arrow-right');
      
      expect(result).toContain('arrowRight');
    });

    it('should append at end if no icons object', () => {
      const content = `const something = true;`;
      const iconExport = `export const home = { name: 'home' };`;
      
      const result = addIconBeforeIconsObject(content, iconExport, 'home');
      
      expect(result).toContain(iconExport);
    });
  });

  describe('updateIconsFileContent', () => {
    it('should add new icon', () => {
      const content = `export const icons = {\n};`;
      const result = updateIconsFileContent(content, 'home', '<path/>', '0 0 24 24');
      
      expect(result).toContain('export const home');
    });

    it('should update existing icon', () => {
      const content = `export const home = {
  name: 'home',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};\n\nexport const icons = {\n  home\n};`;
      
      const result = updateIconsFileContent(content, 'home', '<circle/>', '0 0 16 16');
      
      expect(result).toContain('<circle/>');
      expect(result).not.toContain('<path/>');
    });
  });

  describe('generateNewIconsFileContent', () => {
    it('should generate complete icons.js file', () => {
      const result = generateNewIconsFileContent('home', '<path/>');
      
      expect(result).toContain('// Auto-generated');
      expect(result).toContain('export const home');
      expect(result).toContain('export const icons');
    });
  });

  describe('generateSpriteSymbol', () => {
    it('should generate symbol element', () => {
      const result = generateSpriteSymbol('home', '<path/>', '0 0 24 24');
      
      expect(result).toContain('<symbol id="home"');
      expect(result).toContain('viewBox="0 0 24 24"');
      expect(result).toContain('<path/>');
      expect(result).toContain('</symbol>');
    });
  });

  describe('symbolExistsInSprite', () => {
    const content = `<svg><symbol id="home"></symbol></svg>`;

    it('should return true for existing symbol', () => {
      expect(symbolExistsInSprite(content, 'home')).toBe(true);
    });

    it('should return false for non-existing symbol', () => {
      expect(symbolExistsInSprite(content, 'arrow')).toBe(false);
    });

    it('should handle single quotes', () => {
      const singleQuoteContent = `<svg><symbol id='home'></symbol></svg>`;
      expect(symbolExistsInSprite(singleQuoteContent, 'home')).toBe(true);
    });
  });

  describe('replaceSymbolInSprite', () => {
    it('should replace existing symbol', () => {
      const content = `<svg><symbol id="home"><path/></symbol></svg>`;
      const newSymbol = `  <symbol id="home" viewBox="0 0 24 24">\n    <circle/>\n  </symbol>`;
      
      const result = replaceSymbolInSprite(content, 'home', newSymbol);
      
      expect(result).toContain('<circle/>');
      expect(result).not.toContain('<path/>');
    });
  });

  describe('addSymbolToSprite', () => {
    it('should add symbol before closing svg', () => {
      const content = `<svg></svg>`;
      const symbol = `  <symbol id="home"><path/></symbol>`;
      
      const result = addSymbolToSprite(content, symbol);
      
      expect(result).toContain('<symbol id="home"');
      expect(result.indexOf('symbol')).toBeLessThan(result.indexOf('</svg>'));
    });
  });

  describe('updateSpriteContent', () => {
    it('should add new symbol', () => {
      const content = `<svg></svg>`;
      const result = updateSpriteContent(content, 'home', '<path/>');
      
      expect(result).toContain('<symbol id="home"');
    });

    it('should replace existing symbol', () => {
      const content = `<svg><symbol id="home"><path/></symbol></svg>`;
      const result = updateSpriteContent(content, 'home', '<circle/>');
      
      expect(result).toContain('<circle/>');
    });
  });

  describe('generateNewSpriteContent', () => {
    it('should generate complete sprite file', () => {
      const result = generateNewSpriteContent('home', '<path/>');
      
      expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(result).toContain('<symbol id="home"');
      expect(result).toContain('</svg>');
    });
  });

  describe('generateDefaultVariantsContent', () => {
    it('should generate variants.js content', () => {
      const result = generateDefaultVariantsContent();
      
      expect(result).toContain('Auto-generated');
      expect(result).toContain('defaultVariants');
      expect(result).toContain('Variants');
    });
  });

  describe('generateDefaultAnimationsContent', () => {
    it('should generate animations.js content', () => {
      const result = generateDefaultAnimationsContent();
      
      expect(result).toContain('Auto-generated');
      expect(result).toContain('animations');
      expect(result).toContain('spin');
    });
  });

  describe('removeIconExportFromContent', () => {
    it('should remove icon export', () => {
      const content = `export const home = {
  name: 'home',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};

export const icons = {
  home
};`;
      
      const result = removeIconExportFromContent(content, 'home');
      
      expect(result).not.toContain('export const home');
      expect(result).toContain('export const icons');
    });

    it('should remove from icons object', () => {
      const content = `export const home = {};
export const arrow = {};

export const icons = {
  home,
  arrow
};`;
      
      const result = removeIconExportFromContent(content, 'home');
      
      expect(result).toContain('arrow');
      expect(result).not.toMatch(/\bhome\b/);
    });
  });

  describe('removeSymbolFromSpriteContent', () => {
    it('should remove symbol', () => {
      const content = `<svg>
  <symbol id="home"><path/></symbol>
  <symbol id="arrow"><circle/></symbol>
</svg>`;
      
      const result = removeSymbolFromSpriteContent(content, 'home');
      
      expect(result).not.toContain('id="home"');
      expect(result).toContain('id="arrow"');
    });
  });

  describe('buildIconsFileContent', () => {
    const mockTransformer: SvgTransformerInterface = {
      extractSvgBody: (svg: string) => svg.replace(/<\/?svg[^>]*>/g, ''),
      extractSvgAttributes: () => ({ viewBox: '0 0 24 24' })
    };

    it('should build content from multiple icons', () => {
      const icons = [
        { name: 'home', svg: '<svg><path/></svg>' },
        { name: 'arrow', svg: '<svg><circle/></svg>' }
      ];
      
      const result = buildIconsFileContent(icons, mockTransformer);
      
      expect(result).toContain('export const home');
      expect(result).toContain('export const arrow');
      expect(result).toContain('export const icons');
    });

    it('should skip icons without svg', () => {
      const icons = [
        { name: 'home', svg: '<svg><path/></svg>' },
        { name: 'arrow', svg: '' }
      ];
      
      const result = buildIconsFileContent(icons, mockTransformer);
      
      expect(result).toContain('home');
      expect(result).not.toContain('arrow');
    });
  });

  describe('buildSpriteFileContent', () => {
    const mockTransformer: SvgTransformerInterface = {
      extractSvgBody: (svg: string) => svg.replace(/<\/?svg[^>]*>/g, ''),
      extractSvgAttributes: () => ({ viewBox: '0 0 24 24' })
    };

    it('should build sprite from multiple icons', () => {
      const icons = [
        { name: 'home', svg: '<svg><path/></svg>' },
        { name: 'arrow', svg: '<svg><circle/></svg>' }
      ];
      
      const result = buildSpriteFileContent(icons, mockTransformer);
      
      expect(result).toContain('<?xml version="1.0"');
      expect(result).toContain('<symbol id="home"');
      expect(result).toContain('<symbol id="arrow"');
    });
  });

  describe('path utilities', () => {
    it('getIconsFilePath should return icons.js path', () => {
      const result = getIconsFilePath('/output');
      expect(result).toMatch(/icons\.js$/);
    });

    it('getSpriteFilePath should return sprite.svg path', () => {
      const result = getSpriteFilePath('/output');
      expect(result).toMatch(/sprite\.svg$/);
    });

    it('getWebComponentFilePath should return icon.js path', () => {
      const result = getWebComponentFilePath('/output');
      expect(result).toMatch(/icon\.js$/);
    });

    it('getVariantsFilePath should return variants.js path', () => {
      const result = getVariantsFilePath('/output');
      expect(result).toMatch(/variants\.js$/);
    });

    it('getAnimationsFilePath should return animations.js path', () => {
      const result = getAnimationsFilePath('/output');
      expect(result).toMatch(/animations\.js$/);
    });
  });

  describe('calculateRelativePath', () => {
    it('should calculate relative path', () => {
      const result = calculateRelativePath('/src/pages/index.html', '/src/icons/icon.js');
      expect(result).toContain('icons/icon.js');
    });

    it('should add ./ prefix if needed', () => {
      const result = calculateRelativePath('/src/index.html', '/src/icon.js');
      expect(result.startsWith('./')).toBe(true);
    });
  });

  describe('countIconsInContent', () => {
    it('should count icons', () => {
      const content = `
export const home = { name: 'home' };
export const arrow = { name: 'arrow' };
export const icons = {};`;
      
      expect(countIconsInContent(content)).toBe(2);
    });

    it('should return 0 for no icons', () => {
      expect(countIconsInContent('const x = 1;')).toBe(0);
    });
  });

  describe('countSymbolsInSprite', () => {
    it('should count symbols', () => {
      const content = `<svg>
  <symbol id="home"></symbol>
  <symbol id="arrow"></symbol>
</svg>`;
      
      expect(countSymbolsInSprite(content)).toBe(2);
    });

    it('should return 0 for no symbols', () => {
      expect(countSymbolsInSprite('<svg></svg>')).toBe(0);
    });
  });

  describe('extractIconNamesFromContent', () => {
    it('should extract icon names', () => {
      const content = `
export const home = { name: 'home', body: '' };
export const arrowRight = { name: 'arrow-right', body: '' };`;
      
      const names = extractIconNamesFromContent(content);
      
      expect(names).toContain('home');
      expect(names).toContain('arrow-right');
    });

    it('should handle double quotes', () => {
      const content = `const home = { name: "home" };`;
      const names = extractIconNamesFromContent(content);
      expect(names).toContain('home');
    });
  });

  describe('extractSymbolIdsFromSprite', () => {
    it('should extract symbol IDs', () => {
      const content = `<svg>
  <symbol id="home"></symbol>
  <symbol id="arrow-right"></symbol>
</svg>`;
      
      const ids = extractSymbolIdsFromSprite(content);
      
      expect(ids).toContain('home');
      expect(ids).toContain('arrow-right');
    });

    it('should handle single quotes', () => {
      const content = `<svg><symbol id='home'></symbol></svg>`;
      const ids = extractSymbolIdsFromSprite(content);
      expect(ids).toContain('home');
    });
  });
});
