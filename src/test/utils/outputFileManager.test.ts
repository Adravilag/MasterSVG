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

    it('should handle icons with complex body containing braces', () => {
      const content = `export const hexagon = {
  name: 'hexagon',
  body: \`<defs>
    <linearGradient id="hexagonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#11998e"/>
      <stop offset="100%" style="stop-color:#38ef7d"/>
    </linearGradient>
  </defs>
  <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" fill="url(#hexagonGradient)" stroke="#fff" stroke-width="2"/>\`,
  viewBox: '0 0 100 100'
};

export const icons = {// Icons will be added here,
  hexagon};`;
      
      const result = removeIconExportFromContent(content, 'hexagon');
      
      expect(result).not.toContain('export const hexagon');
      expect(result).toContain('export const icons');
      expect(result).toContain('}');
      // Verify the icons object is still valid (has opening and closing brace)
      expect(result).toMatch(/export const icons = \{[\s\S]*\}/);
    });

    it('should preserve closing brace when removing last icon', () => {
      const content = `export const home = {
  name: 'home',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};

export const icons = {
  home
};`;
      
      const result = removeIconExportFromContent(content, 'home');
      
      // The icons object should still be valid with empty content
      expect(result).toMatch(/export const icons = \{\s*\}/);
    });

    it('should clean up placeholder comment when all icons removed', () => {
      const content = `export const hexagon = {
  name: 'hexagon',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};

export const icons = {// Icons will be added here,
  hexagon};`;
      
      const result = removeIconExportFromContent(content, 'hexagon');
      
      // Should have valid empty icons object
      expect(result).toMatch(/export const icons = \{\s*\}/);
      // Should not have orphaned comment
      expect(result).not.toMatch(/export const icons = \{\/\//);
    });

    it('should handle removing multiple icons sequentially', () => {
      let content = `export const icon1 = {
  name: 'icon1',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};

export const icon2 = {
  name: 'icon2',
  body: \`<circle/>\`,
  viewBox: '0 0 24 24'
};

export const icons = {// Icons will be added here,
  icon1,
  icon2};`;
      
      // Remove first icon
      content = removeIconExportFromContent(content, 'icon1');
      expect(content).toContain('icon2');
      expect(content).not.toContain('icon1');
      expect(content).toMatch(/export const icons = \{[\s\S]*icon2[\s\S]*\}/);
      
      // Remove second icon
      content = removeIconExportFromContent(content, 'icon2');
      expect(content).not.toContain('icon1');
      expect(content).not.toContain('icon2');
      expect(content).toMatch(/export const icons = \{\s*\}/);
    });
  });

  describe('removeIconExportFromContent - consistency tests', () => {
    it('should produce valid JS syntax after removing single icon', () => {
      const content = `// Auto-generated by Bezier SVG - Icon Manager
// Add icons using "Add to Icon Collection" or drag SVG files here

// Icon exports will be added here
// Example: export const arrowRight = { name: 'arrow-right', body: '...', viewBox: '0 0 24 24' };

// Collection of all icons
export const hexagon = {
  name: 'hexagon',
  body: \`<polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5"/>\`,
  viewBox: '0 0 100 100'
};

export const icons = {// Icons will be added here,
  hexagon};`;
      
      const result = removeIconExportFromContent(content, 'hexagon');
      
      // Should not have syntax errors - verify structure
      expect(result).toMatch(/export const icons = \{\s*\};?/);
      expect(result).not.toContain('hexagon');
      // Should not have orphaned content like just "};" or "// Icons will be added here};"
      expect(result).not.toMatch(/export const icons = \{[^}]*hexagon/);
    });

    it('should produce valid JS syntax after removing all icons one by one', () => {
      let content = `// Auto-generated
export const star = {
  name: 'star',
  body: \`<path d="M12 2l3 7h7l-5.5 5 2 7L12 17l-6.5 4 2-7L2 9h7z"/>\`,
  viewBox: '0 0 24 24'
};

export const heart = {
  name: 'heart',
  body: \`<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>\`,
  viewBox: '0 0 24 24'
};

export const moon = {
  name: 'moon',
  body: \`<path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>\`,
  viewBox: '0 0 24 24'
};

export const icons = {
  star,
  heart,
  moon
};`;

      // Remove all icons one by one
      content = removeIconExportFromContent(content, 'star');
      expect(content).toMatch(/export const icons = \{[\s\S]*heart[\s\S]*moon[\s\S]*\}/);
      expect(content).not.toContain('export const star');
      
      content = removeIconExportFromContent(content, 'heart');
      expect(content).toMatch(/export const icons = \{[\s\S]*moon[\s\S]*\}/);
      expect(content).not.toContain('export const heart');
      
      content = removeIconExportFromContent(content, 'moon');
      expect(content).toMatch(/export const icons = \{\s*\}/);
      expect(content).not.toContain('export const moon');
    });

    it('should handle icons with animation config', () => {
      const content = `export const spinner = {
  name: 'spinner',
  body: \`<circle cx="12" cy="12" r="10"/>\`,
  viewBox: '0 0 24 24',
  animation: { type: 'spin', duration: 1, timing: 'linear', iteration: 'infinite', delay: 0, direction: 'normal' }
};

export const icons = {
  spinner
};`;

      const result = removeIconExportFromContent(content, 'spinner');
      
      expect(result).not.toContain('spinner');
      expect(result).toMatch(/export const icons = \{\s*\}/);
    });

    it('should handle icons with complex SVG body containing braces and special chars', () => {
      const content = `export const complexIcon = {
  name: 'complex-icon',
  body: \`<defs>
    <style>
      .cls-1 { fill: #000; }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
    <linearGradient id="grad1">
      <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect class="cls-1" x="0" y="0" width="100" height="100" fill="url(#grad1)"/>\`,
  viewBox: '0 0 100 100'
};

export const icons = {// Icons will be added here,
  complexIcon};`;

      const result = removeIconExportFromContent(content, 'complex-icon');
      
      expect(result).not.toContain('complexIcon');
      expect(result).not.toContain('complex-icon');
      expect(result).toMatch(/export const icons = \{\s*\}/);
    });

    it('should handle mixed format with newlines and comments', () => {
      const content = `// Generated file
export const icon1 = {
  name: 'icon1',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};

// Another icon
export const icon2 = {
  name: 'icon2',
  body: \`<rect/>\`,
  viewBox: '0 0 24 24'
};

export const icons = {
  // First icon
  icon1,
  // Second icon
  icon2
};`;

      let result = removeIconExportFromContent(content, 'icon1');
      expect(result).toContain('icon2');
      expect(result).not.toMatch(/\bicon1\b/);
      
      result = removeIconExportFromContent(result, 'icon2');
      expect(result).toMatch(/export const icons = \{\s*\}/);
    });

    it('should not break when icon name is part of another word', () => {
      const content = `export const home = {
  name: 'home',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};

export const homeOutline = {
  name: 'home-outline',
  body: \`<rect/>\`,
  viewBox: '0 0 24 24'
};

export const icons = {
  home,
  homeOutline
};`;

      const result = removeIconExportFromContent(content, 'home');
      
      expect(result).not.toMatch(/export const home\s*=/);
      expect(result).toContain('homeOutline');
      expect(result).toMatch(/export const icons = \{[\s\S]*homeOutline[\s\S]*\}/);
    });

    it('should handle kebab-case icon names correctly', () => {
      const content = `export const arrowRight = {
  name: 'arrow-right',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};

export const arrowLeft = {
  name: 'arrow-left',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};

export const icons = {
  arrowRight,
  arrowLeft
};`;

      const result = removeIconExportFromContent(content, 'arrow-right');
      
      expect(result).not.toContain('arrowRight');
      expect(result).toContain('arrowLeft');
      expect(result).toMatch(/export const icons = \{[\s\S]*arrowLeft[\s\S]*\}/);
    });

    it('should result in parseable JavaScript', () => {
      const content = `export const test = {
  name: 'test',
  body: \`<svg></svg>\`,
  viewBox: '0 0 24 24'
};

export const icons = {
  test
};`;

      const result = removeIconExportFromContent(content, 'test');
      
      // The result should be valid JS - at minimum check basic structure
      expect(result).toMatch(/export const icons = \{\s*\};?/);
      // No dangling commas before closing brace
      expect(result).not.toMatch(/,\s*\}/);
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

  describe('renameIconInContent', () => {
    it('should rename icon name property in icons.js format', () => {
      const content = `export const materialSymbolsHouse = {
  name: 'material-symbols-house',
  body: \`<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>\`,
  viewBox: '0 0 24 24'
};

export const icons = {
  materialSymbolsHouse
};`;

      const oldName = 'material-symbols-house';
      const newName = 'house';
      
      // Pattern to match name: 'iconName' or name: "iconName"
      const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const namePattern = new RegExp(`(name:\\s*['"])${escapedOldName}(['"])`, 'g');
      
      const newContent = content.replace(namePattern, `$1${newName}$2`);
      
      expect(newContent).toContain(`name: 'house'`);
      expect(newContent).not.toContain(`name: 'material-symbols-house'`);
    });

    it('should find icon name with test pattern', () => {
      const content = `export const materialSymbolsHouse = {
  name: 'material-symbols-house',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};`;

      const oldName = 'material-symbols-house';
      const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Test pattern (non-global)
      const testPattern = new RegExp(`name:\\s*['"]${escapedOldName}['"]`);
      
      expect(testPattern.test(content)).toBe(true);
    });

    it('should rename symbol id in sprite.svg', () => {
      const content = `<svg>
  <symbol id="material-symbols-house" viewBox="0 0 24 24">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </symbol>
</svg>`;

      const oldName = 'material-symbols-house';
      const newName = 'house';
      
      const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const symbolPattern = new RegExp(`(<symbol[^>]*id=["'])${escapedOldName}(["'])`, 'g');
      
      const newContent = content.replace(symbolPattern, `$1${newName}$2`);
      
      expect(newContent).toContain(`id="house"`);
      expect(newContent).not.toContain(`id="material-symbols-house"`);
    });
  });
});

