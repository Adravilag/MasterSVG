import {
  createSymbolEntry,
  createNewSpriteContent,
  createSymbolPattern,
  escapeRegExp,
  symbolExistsInSprite,
  replaceSymbolInSprite,
  addSymbolToSprite,
  updateSpriteContent,
  extractSymbolIds,
  removeSymbolFromSprite,
  isValidSpriteContent,
  getSymbolCount,
  createUseReference,
  createInlineUseReference,
  ANIMATION_KEYFRAMES,
  getAnimationStyles,
  buildAnimationStyle
} from '../../utils/spriteUtils';

describe('spriteUtils', () => {
  describe('createSymbolEntry', () => {
    it('should create a symbol entry with default viewBox', () => {
      const result = createSymbolEntry('home', '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>');
      expect(result).toBe('  <symbol id="home" viewBox="0 0 24 24">\n    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>\n  </symbol>');
    });

    it('should create a symbol entry with custom viewBox', () => {
      const result = createSymbolEntry('icon', '<path d="..."/>', '0 0 16 16');
      expect(result).toContain('viewBox="0 0 16 16"');
    });

    it('should properly indent the body', () => {
      const result = createSymbolEntry('test', '<g><path/></g>');
      expect(result).toContain('\n    <g><path/></g>\n');
    });

    it('should handle empty body', () => {
      const result = createSymbolEntry('empty', '');
      expect(result).toBe('  <symbol id="empty" viewBox="0 0 24 24">\n    \n  </symbol>');
    });

    it('should handle special characters in icon name', () => {
      const result = createSymbolEntry('arrow-left', '<path/>');
      expect(result).toContain('id="arrow-left"');
    });
  });

  describe('createNewSpriteContent', () => {
    it('should create valid sprite content', () => {
      const symbol = createSymbolEntry('test', '<path/>');
      const result = createNewSpriteContent(symbol);
      
      expect(result).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(result).toContain('style="display: none;"');
      expect(result).toContain(symbol);
      expect(result).toContain('</svg>');
    });

    it('should include the symbol entry', () => {
      const symbol = '  <symbol id="icon" viewBox="0 0 24 24">\n    <path/>\n  </symbol>';
      const result = createNewSpriteContent(symbol);
      expect(result).toContain(symbol);
    });
  });

  describe('escapeRegExp', () => {
    it('should escape special regex characters', () => {
      expect(escapeRegExp('test.*')).toBe('test\\.\\*');
      expect(escapeRegExp('a+b')).toBe('a\\+b');
      expect(escapeRegExp('(foo)')).toBe('\\(foo\\)');
      expect(escapeRegExp('a[b]c')).toBe('a\\[b\\]c');
      expect(escapeRegExp('$value')).toBe('\\$value');
    });

    it('should not modify strings without special characters', () => {
      expect(escapeRegExp('simple')).toBe('simple');
      expect(escapeRegExp('icon-name')).toBe('icon-name');
    });

    it('should handle empty string', () => {
      expect(escapeRegExp('')).toBe('');
    });

    it('should escape multiple special characters', () => {
      expect(escapeRegExp('test.*.?+^${}()|[]\\end')).toBe('test\\.\\*\\.\\?\\+\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\end');
    });
  });

  describe('createSymbolPattern', () => {
    it('should create a regex pattern for symbol ID', () => {
      const pattern = createSymbolPattern('home');
      expect(pattern.test('<symbol id="home" viewBox="0 0 24 24"><path/></symbol>')).toBe(true);
    });

    it('should match symbols with single quotes', () => {
      const pattern = createSymbolPattern('icon');
      expect(pattern.test("<symbol id='icon' viewBox='0 0 24 24'><path/></symbol>")).toBe(true);
    });

    it('should not match different IDs', () => {
      const pattern = createSymbolPattern('home');
      expect(pattern.test('<symbol id="home2" viewBox="0 0 24 24"><path/></symbol>')).toBe(false);
    });

    it('should handle special characters in icon name', () => {
      const pattern = createSymbolPattern('arrow-left');
      expect(pattern.test('<symbol id="arrow-left" viewBox="0 0 24 24"><path/></symbol>')).toBe(true);
    });
  });

  describe('symbolExistsInSprite', () => {
    const spriteContent = `<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="home" viewBox="0 0 24 24"><path d="M10 20"/></symbol>
  <symbol id="user" viewBox="0 0 24 24"><path d="M12 12"/></symbol>
</svg>`;

    it('should return true for existing symbol', () => {
      expect(symbolExistsInSprite(spriteContent, 'home')).toBe(true);
      expect(symbolExistsInSprite(spriteContent, 'user')).toBe(true);
    });

    it('should return false for non-existing symbol', () => {
      expect(symbolExistsInSprite(spriteContent, 'settings')).toBe(false);
    });

    it('should handle empty sprite', () => {
      expect(symbolExistsInSprite('<svg></svg>', 'icon')).toBe(false);
    });
  });

  describe('replaceSymbolInSprite', () => {
    const spriteContent = `<svg>
  <symbol id="home" viewBox="0 0 24 24"><path d="old"/></symbol>
</svg>`;

    it('should replace existing symbol', () => {
      const newSymbol = '  <symbol id="home" viewBox="0 0 24 24">\n    <path d="new"/>\n  </symbol>';
      const result = replaceSymbolInSprite(spriteContent, 'home', newSymbol);
      
      expect(result).toContain('path d="new"');
      expect(result).not.toContain('path d="old"');
    });

    it('should not modify content if symbol not found', () => {
      const result = replaceSymbolInSprite(spriteContent, 'other', 'new-symbol');
      expect(result).toBe(spriteContent);
    });
  });

  describe('addSymbolToSprite', () => {
    const spriteContent = `<svg>
  <symbol id="home" viewBox="0 0 24 24"><path/></symbol>
</svg>`;

    it('should add symbol before closing svg tag', () => {
      const newSymbol = '  <symbol id="user" viewBox="0 0 24 24"><path/></symbol>';
      const result = addSymbolToSprite(spriteContent, newSymbol);
      
      expect(result).toContain(newSymbol);
      expect(result.indexOf(newSymbol)).toBeLessThan(result.lastIndexOf('</svg>'));
    });

    it('should preserve existing symbols', () => {
      const newSymbol = '  <symbol id="user"><path/></symbol>';
      const result = addSymbolToSprite(spriteContent, newSymbol);
      
      expect(result).toContain('id="home"');
      expect(result).toContain('id="user"');
    });
  });

  describe('updateSpriteContent', () => {
    const spriteContent = `<svg>
  <symbol id="home" viewBox="0 0 24 24"><path d="old"/></symbol>
</svg>`;

    it('should replace symbol if it exists', () => {
      const newSymbol = '  <symbol id="home" viewBox="0 0 24 24">\n    <path d="new"/>\n  </symbol>';
      const result = updateSpriteContent(spriteContent, 'home', newSymbol);
      
      expect(result).toContain('path d="new"');
      expect(result).not.toContain('path d="old"');
    });

    it('should add symbol if it does not exist', () => {
      const newSymbol = '  <symbol id="user" viewBox="0 0 24 24"><path/></symbol>';
      const result = updateSpriteContent(spriteContent, 'user', newSymbol);
      
      expect(result).toContain('id="home"');
      expect(result).toContain('id="user"');
    });
  });

  describe('extractSymbolIds', () => {
    it('should extract all symbol IDs', () => {
      const content = `<svg>
  <symbol id="home" viewBox="0 0 24 24"><path/></symbol>
  <symbol id="user" viewBox="0 0 24 24"><path/></symbol>
  <symbol id="settings" viewBox="0 0 24 24"><path/></symbol>
</svg>`;
      
      const ids = extractSymbolIds(content);
      expect(ids).toEqual(['home', 'user', 'settings']);
    });

    it('should handle single quotes', () => {
      const content = "<svg><symbol id='icon' viewBox='0 0 24 24'></symbol></svg>";
      expect(extractSymbolIds(content)).toEqual(['icon']);
    });

    it('should return empty array for no symbols', () => {
      expect(extractSymbolIds('<svg></svg>')).toEqual([]);
    });

    it('should handle empty content', () => {
      expect(extractSymbolIds('')).toEqual([]);
    });
  });

  describe('removeSymbolFromSprite', () => {
    const spriteContent = `<svg>
  <symbol id="home" viewBox="0 0 24 24"><path/></symbol>
  <symbol id="user" viewBox="0 0 24 24"><path/></symbol>
</svg>`;

    it('should remove specified symbol', () => {
      const result = removeSymbolFromSprite(spriteContent, 'home');
      
      expect(result).not.toContain('id="home"');
      expect(result).toContain('id="user"');
    });

    it('should not modify if symbol not found', () => {
      const result = removeSymbolFromSprite(spriteContent, 'settings');
      expect(result).toBe(spriteContent);
    });
  });

  describe('isValidSpriteContent', () => {
    it('should return true for valid sprite', () => {
      expect(isValidSpriteContent('<svg><symbol id="test"></symbol></svg>')).toBe(true);
    });

    it('should return true for empty svg', () => {
      expect(isValidSpriteContent('<svg></svg>')).toBe(true);
    });

    it('should return false for invalid content', () => {
      expect(isValidSpriteContent('<div>not svg</div>')).toBe(false);
      expect(isValidSpriteContent('')).toBe(false);
      expect(isValidSpriteContent('<svg>')).toBe(false);
    });
  });

  describe('getSymbolCount', () => {
    it('should return correct count', () => {
      const content = `<svg>
  <symbol id="a"></symbol>
  <symbol id="b"></symbol>
  <symbol id="c"></symbol>
</svg>`;
      expect(getSymbolCount(content)).toBe(3);
    });

    it('should return 0 for empty sprite', () => {
      expect(getSymbolCount('<svg></svg>')).toBe(0);
    });
  });

  describe('createUseReference', () => {
    it('should create use reference with default size', () => {
      const result = createUseReference('sprite.svg', 'home');
      expect(result).toBe('<svg width="24" height="24"><use href="sprite.svg#home"></use></svg>');
    });

    it('should create use reference with custom size', () => {
      const result = createUseReference('sprite.svg', 'icon', '32');
      expect(result).toContain('width="32"');
      expect(result).toContain('height="32"');
    });

    it('should include class attribute when provided', () => {
      const result = createUseReference('sprite.svg', 'icon', '24', 'icon-class');
      expect(result).toContain('class="icon-class"');
    });

    it('should not include class attribute when not provided', () => {
      const result = createUseReference('sprite.svg', 'icon');
      expect(result).not.toContain('class=');
    });
  });

  describe('createInlineUseReference', () => {
    it('should create inline use reference', () => {
      const result = createInlineUseReference('home');
      expect(result).toBe('<svg width="24" height="24"><use href="#home"></use></svg>');
    });

    it('should include custom size', () => {
      const result = createInlineUseReference('icon', '48');
      expect(result).toContain('width="48"');
    });

    it('should include class when provided', () => {
      const result = createInlineUseReference('icon', '24', 'my-icon');
      expect(result).toContain('class="my-icon"');
    });
  });

  describe('ANIMATION_KEYFRAMES', () => {
    it('should have all animation types', () => {
      expect(ANIMATION_KEYFRAMES.spin).toContain('@keyframes icon-spin');
      expect(ANIMATION_KEYFRAMES.pulse).toContain('@keyframes icon-pulse');
      expect(ANIMATION_KEYFRAMES.bounce).toContain('@keyframes icon-bounce');
      expect(ANIMATION_KEYFRAMES.shake).toContain('@keyframes icon-shake');
      expect(ANIMATION_KEYFRAMES.fade).toContain('@keyframes icon-fade');
    });

    it('should have valid keyframe definitions', () => {
      expect(ANIMATION_KEYFRAMES.spin).toContain('rotate(360deg)');
      expect(ANIMATION_KEYFRAMES.pulse).toContain('scale(1.1)');
      expect(ANIMATION_KEYFRAMES.bounce).toContain('translateY(-4px)');
      expect(ANIMATION_KEYFRAMES.shake).toContain('translateX');
      expect(ANIMATION_KEYFRAMES.fade).toContain('opacity');
    });
  });

  describe('getAnimationStyles', () => {
    it('should return all keyframes as CSS', () => {
      const result = getAnimationStyles();
      
      expect(result).toContain('icon-spin');
      expect(result).toContain('icon-pulse');
      expect(result).toContain('icon-bounce');
      expect(result).toContain('icon-shake');
      expect(result).toContain('icon-fade');
    });
  });

  describe('buildAnimationStyle', () => {
    it('should return empty string for null animation', () => {
      expect(buildAnimationStyle(null)).toBe('');
    });

    it('should return empty string for none animation', () => {
      expect(buildAnimationStyle('none')).toBe('');
    });

    it('should build animation style with defaults', () => {
      const result = buildAnimationStyle('spin');
      expect(result).toBe('animation: icon-spin 1s ease infinite;');
    });

    it('should build animation style with custom values', () => {
      const result = buildAnimationStyle('pulse', 2, 'linear', '3');
      expect(result).toBe('animation: icon-pulse 2s linear 3;');
    });

    it('should handle all animation types', () => {
      expect(buildAnimationStyle('bounce')).toContain('icon-bounce');
      expect(buildAnimationStyle('shake')).toContain('icon-shake');
      expect(buildAnimationStyle('fade')).toContain('icon-fade');
    });
  });
});
