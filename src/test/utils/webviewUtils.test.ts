import {
  WEBVIEW_COLOR_PRESETS,
  ANIMATION_KEYFRAMES_CSS,
  VSCODE_CSS_VARIABLES,
  escapeHtml,
  escapeTemplateString,
  escapeJsonForHtml,
  generateNonce,
  createButton,
  createColorPresetButton,
  generateColorPresetsGrid,
  createIconCard,
  getCheckerboardCss,
  buildAnimationStyleInline,
  createSvgWrapper,
  getBaseWebviewStyles,
  wrapInHtmlDocument,
  getVscodeApiScript,
  formatFileSize,
  truncateText,
  generateWebviewId,
  parseColorToHex,
  createProgressBar,
  createBadge,
  createTooltip
} from '../../utils/webviewUtils';

describe('webviewUtils', () => {
  describe('WEBVIEW_COLOR_PRESETS', () => {
    it('should have 12 color presets', () => {
      expect(WEBVIEW_COLOR_PRESETS).toHaveLength(12);
    });

    it('should have color and name for each preset', () => {
      WEBVIEW_COLOR_PRESETS.forEach(preset => {
        expect(preset.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(preset.name).toBeTruthy();
      });
    });

    it('should include white and black', () => {
      const colors = WEBVIEW_COLOR_PRESETS.map(p => p.color);
      expect(colors).toContain('#ffffff');
      expect(colors).toContain('#000000');
    });
  });

  describe('ANIMATION_KEYFRAMES_CSS', () => {
    it('should contain spin animation', () => {
      expect(ANIMATION_KEYFRAMES_CSS).toContain('@keyframes icon-spin');
      expect(ANIMATION_KEYFRAMES_CSS).toContain('rotate(360deg)');
    });

    it('should contain pulse animation', () => {
      expect(ANIMATION_KEYFRAMES_CSS).toContain('@keyframes icon-pulse');
    });

    it('should contain bounce animation', () => {
      expect(ANIMATION_KEYFRAMES_CSS).toContain('@keyframes icon-bounce');
    });

    it('should contain shake animation', () => {
      expect(ANIMATION_KEYFRAMES_CSS).toContain('@keyframes icon-shake');
    });

    it('should contain fade animation', () => {
      expect(ANIMATION_KEYFRAMES_CSS).toContain('@keyframes icon-fade');
    });
  });

  describe('VSCODE_CSS_VARIABLES', () => {
    it('should have all expected variables', () => {
      expect(VSCODE_CSS_VARIABLES.fontFamily).toBe('var(--vscode-font-family)');
      expect(VSCODE_CSS_VARIABLES.editorBackground).toBe('var(--vscode-editor-background)');
      expect(VSCODE_CSS_VARIABLES.foreground).toBe('var(--vscode-foreground)');
      expect(VSCODE_CSS_VARIABLES.buttonBackground).toBe('var(--vscode-button-background)');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('"quotes"')).toBe('&quot;quotes&quot;');
      expect(escapeHtml("'apostrophe'")).toBe('&#039;apostrophe&#039;');
      expect(escapeHtml('&ampersand')).toBe('&amp;ampersand');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(escapeHtml(null as any)).toBe('');
      expect(escapeHtml(undefined as any)).toBe('');
    });

    it('should not modify safe strings', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('escapeTemplateString', () => {
    it('should escape backticks', () => {
      expect(escapeTemplateString('`code`')).toBe('\\`code\\`');
    });

    it('should escape dollar signs', () => {
      expect(escapeTemplateString('${var}')).toBe('\\${var}');
    });

    it('should escape backslashes', () => {
      expect(escapeTemplateString('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('should handle empty string', () => {
      expect(escapeTemplateString('')).toBe('');
    });
  });

  describe('escapeJsonForHtml', () => {
    it('should escape single quotes', () => {
      const result = escapeJsonForHtml({ name: "test's" });
      // Single quotes are escaped with backslash for safe embedding in JS strings
      expect(result).toContain("\\'");
    });

    it('should escape less-than sign', () => {
      const result = escapeJsonForHtml({ html: '<div>' });
      expect(result).toContain('\\u003c');
    });

    it('should produce valid JSON-like string', () => {
      const obj = { a: 1, b: 'test' };
      const result = escapeJsonForHtml(obj);
      expect(result).toContain('"a":1');
    });
  });

  describe('generateNonce', () => {
    it('should generate 32-character string', () => {
      expect(generateNonce()).toHaveLength(32);
    });

    it('should only contain alphanumeric characters', () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate unique values', () => {
      const nonces = new Set<string>();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce());
      }
      expect(nonces.size).toBe(100);
    });
  });

  describe('createButton', () => {
    it('should create primary button by default', () => {
      const btn = createButton('Click Me', 'handleClick()');
      expect(btn).toContain('btn-primary');
      expect(btn).toContain('Click Me');
      expect(btn).toContain('onclick="handleClick()"');
    });

    it('should create secondary button', () => {
      const btn = createButton('Cancel', 'cancel()', 'secondary');
      expect(btn).toContain('btn-secondary');
    });

    it('should include icon when provided', () => {
      const btn = createButton('Save', 'save()', 'primary', '💾');
      expect(btn).toContain('💾 Save');
    });

    it('should escape onclick handler', () => {
      const btn = createButton('Test', 'fn("value")');
      expect(btn).toContain('&quot;');
    });
  });

  describe('createColorPresetButton', () => {
    it('should create button with color', () => {
      const btn = createColorPresetButton('#ff0000');
      expect(btn).toContain('style="background: #ff0000"');
      expect(btn).toContain('data-color="#ff0000"');
    });

    it('should add active class when active', () => {
      const btn = createColorPresetButton('#ff0000', true);
      expect(btn).toContain('class="color-preset active"');
    });

    it('should not add active class when inactive', () => {
      const btn = createColorPresetButton('#ff0000', false);
      expect(btn).not.toContain('active');
    });

    it('should add title when provided', () => {
      const btn = createColorPresetButton('#ff0000', false, 'Red');
      expect(btn).toContain('title="Red"');
    });
  });

  describe('generateColorPresetsGrid', () => {
    it('should generate buttons for all presets', () => {
      const grid = generateColorPresetsGrid();
      expect(grid).toContain('#ffffff');
      expect(grid).toContain('#000000');
    });

    it('should mark active color', () => {
      const grid = generateColorPresetsGrid('#ffffff');
      expect(grid).toContain('class="color-preset active"');
    });

    it('should use custom presets', () => {
      const customPresets = [
        { color: '#123456', name: 'Custom' }
      ] as const;
      const grid = generateColorPresetsGrid(undefined, customPresets);
      expect(grid).toContain('#123456');
    });
  });

  describe('createIconCard', () => {
    it('should create card with prefix and name', () => {
      const card = createIconCard('mdi', 'home');
      expect(card).toContain('data-prefix="mdi"');
      expect(card).toContain('data-name="home"');
    });

    it('should include iconify API URL', () => {
      const card = createIconCard('mdi', 'home');
      expect(card).toContain('https://api.iconify.design/mdi/home.svg');
    });

    it('should escape special characters', () => {
      const card = createIconCard('pre<fix', 'na"me');
      expect(card).toContain('&lt;');
      expect(card).toContain('&quot;');
    });
  });

  describe('getCheckerboardCss', () => {
    it('should return valid CSS', () => {
      const css = getCheckerboardCss();
      expect(css).toContain('linear-gradient');
      expect(css).toContain('background-size');
    });

    it('should use provided size', () => {
      const css = getCheckerboardCss(32);
      expect(css).toContain('32px');
    });
  });

  describe('buildAnimationStyleInline', () => {
    it('should return empty for null animation', () => {
      expect(buildAnimationStyleInline(null)).toBe('');
    });

    it('should return empty for none animation', () => {
      expect(buildAnimationStyleInline('none')).toBe('');
    });

    it('should build animation style with defaults', () => {
      const style = buildAnimationStyleInline('spin');
      expect(style).toBe('animation: icon-spin 1s ease infinite;');
    });

    it('should build animation style with custom values', () => {
      const style = buildAnimationStyleInline('bounce', 2, 'linear', '3');
      expect(style).toBe('animation: icon-bounce 2s linear 3;');
    });
  });

  describe('createSvgWrapper', () => {
    it('should create SVG with body and viewBox', () => {
      const svg = createSvgWrapper('<path d="M10 20"/>', '0 0 24 24');
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('<path d="M10 20"/>');
    });

    it('should apply size', () => {
      const svg = createSvgWrapper('', '0 0 24 24', '32px');
      expect(svg).toContain('width="32px"');
      expect(svg).toContain('height="32px"');
    });

    it('should apply fill color', () => {
      const svg = createSvgWrapper('', '0 0 24 24', '1em', '#ff0000');
      expect(svg).toContain('fill="#ff0000"');
    });

    it('should include animation style', () => {
      const svg = createSvgWrapper('', '0 0 24 24', '1em', 'currentColor', 'animation: spin 1s;');
      expect(svg).toContain('animation: spin 1s;');
    });
  });

  describe('getBaseWebviewStyles', () => {
    it('should return CSS with VS Code variables', () => {
      const styles = getBaseWebviewStyles();
      expect(styles).toContain('--vscode-font-family');
      expect(styles).toContain('--vscode-editor-background');
    });

    it('should include button styles', () => {
      const styles = getBaseWebviewStyles();
      expect(styles).toContain('.btn-primary');
      expect(styles).toContain('.btn-secondary');
    });

    it('should include color preset styles', () => {
      const styles = getBaseWebviewStyles();
      expect(styles).toContain('.color-preset');
    });
  });

  describe('wrapInHtmlDocument', () => {
    it('should create valid HTML document', () => {
      const html = wrapInHtmlDocument('Test', '.class {}', '<div>Content</div>');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Test</title>');
      expect(html).toContain('.class {}');
      expect(html).toContain('<div>Content</div>');
    });

    it('should include script when provided', () => {
      const html = wrapInHtmlDocument('Test', '', '', 'console.log("hi")');
      expect(html).toContain('<script>console.log("hi")</script>');
    });

    it('should escape title', () => {
      const html = wrapInHtmlDocument('<script>alert(1)</script>', '', '');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('getVscodeApiScript', () => {
    it('should return vscode API acquisition', () => {
      const script = getVscodeApiScript();
      expect(script).toContain('acquireVsCodeApi()');
      expect(script).toContain('const vscode');
    });
  });

  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
    });

    it('should format with decimals', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('truncateText', () => {
    it('should not truncate short text', () => {
      expect(truncateText('short', 10)).toBe('short');
    });

    it('should truncate long text with ellipsis', () => {
      expect(truncateText('this is a long text', 10)).toBe('this is...');
    });

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(truncateText(null as any, 10)).toBeFalsy();
    });

    it('should handle exact length', () => {
      expect(truncateText('exact', 5)).toBe('exact');
    });
  });

  describe('generateWebviewId', () => {
    it('should generate ID with prefix', () => {
      const id = generateWebviewId('btn');
      expect(id).toMatch(/^btn-/);
    });

    it('should use default prefix', () => {
      const id = generateWebviewId();
      expect(id).toMatch(/^el-/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateWebviewId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('parseColorToHex', () => {
    it('should return hex colors as-is', () => {
      expect(parseColorToHex('#ff0000')).toBe('#ff0000');
      expect(parseColorToHex('#FF0000')).toBe('#ff0000');
    });

    it('should expand 3-digit hex', () => {
      expect(parseColorToHex('#f00')).toBe('#ff0000');
      expect(parseColorToHex('#abc')).toBe('#aabbcc');
    });

    it('should convert RGB to hex', () => {
      expect(parseColorToHex('rgb(255, 0, 0)')).toBe('#ff0000');
      expect(parseColorToHex('rgb(0, 255, 0)')).toBe('#00ff00');
    });

    it('should return null for invalid colors', () => {
      expect(parseColorToHex('')).toBeNull();
      expect(parseColorToHex('invalid')).toBeNull();
      expect(parseColorToHex(null as any)).toBeNull();
    });
  });

  describe('createProgressBar', () => {
    it('should create progress bar with percent', () => {
      const bar = createProgressBar(50);
      expect(bar).toContain('width: 50%');
    });

    it('should show label by default', () => {
      const bar = createProgressBar(75);
      expect(bar).toContain('75%');
    });

    it('should hide label when specified', () => {
      const bar = createProgressBar(75, false);
      expect(bar).not.toContain('progress-label');
    });

    it('should clamp percent to 0-100', () => {
      expect(createProgressBar(-10)).toContain('width: 0%');
      expect(createProgressBar(150)).toContain('width: 100%');
    });

    it('should use custom color', () => {
      const bar = createProgressBar(50, true, '#ff0000');
      expect(bar).toContain('background: #ff0000');
    });
  });

  describe('createBadge', () => {
    it('should create default badge', () => {
      const badge = createBadge('New');
      expect(badge).toContain('New');
      expect(badge).toContain('badge-background');
    });

    it('should create success badge', () => {
      const badge = createBadge('Done', 'success');
      expect(badge).toContain('charts-green');
    });

    it('should create warning badge', () => {
      const badge = createBadge('Warning', 'warning');
      expect(badge).toContain('charts-yellow');
    });

    it('should create error badge', () => {
      const badge = createBadge('Error', 'error');
      expect(badge).toContain('charts-red');
    });

    it('should escape text', () => {
      const badge = createBadge('<script>');
      expect(badge).toContain('&lt;script&gt;');
    });
  });

  describe('createTooltip', () => {
    it('should create tooltip wrapper', () => {
      const tooltip = createTooltip('Content', 'Tooltip text');
      expect(tooltip).toContain('Content');
      expect(tooltip).toContain('title="Tooltip text"');
    });

    it('should escape tooltip text', () => {
      const tooltip = createTooltip('Test', '"quoted"');
      expect(tooltip).toContain('&quot;quoted&quot;');
    });
  });
});
