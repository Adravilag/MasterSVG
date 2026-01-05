/**
 * Tests for iconPickerHtml utility module
 */

import {
  DEFAULT_COLOR_PRESETS,
  escapeHtmlAttribute,
  generateIconCard,
  generateIconCards,
  generateColorPresetButton,
  generateColorPresets,
  getIconPickerStyles,
  getIconPickerScript,
  generateToolbarHtml,
  getIconPickerHtml,
  IconSearchResult,
  ColorPreset,
} from '../../utils/iconPickerHtml';

describe('iconPickerHtml', () => {
  // ==========================================================================
  // DEFAULT_COLOR_PRESETS Tests
  // ==========================================================================

  describe('DEFAULT_COLOR_PRESETS', () => {
    it('should have 8 color presets', () => {
      expect(DEFAULT_COLOR_PRESETS).toHaveLength(8);
    });

    it('should have color and title for each preset', () => {
      DEFAULT_COLOR_PRESETS.forEach(preset => {
        expect(preset.color).toBeDefined();
        expect(preset.title).toBeDefined();
        expect(preset.color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('should include white and black presets', () => {
      const colors = DEFAULT_COLOR_PRESETS.map(p => p.color);
      expect(colors).toContain('#ffffff');
      expect(colors).toContain('#000000');
    });

    it('should have unique colors', () => {
      const colors = DEFAULT_COLOR_PRESETS.map(p => p.color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });
  });

  // ==========================================================================
  // escapeHtmlAttribute Tests
  // ==========================================================================

  describe('escapeHtmlAttribute', () => {
    it('should escape ampersand', () => {
      expect(escapeHtmlAttribute('a & b')).toBe('a &amp; b');
    });

    it('should escape double quotes', () => {
      expect(escapeHtmlAttribute('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtmlAttribute("it's")).toBe('it&#39;s');
    });

    it('should escape less than', () => {
      expect(escapeHtmlAttribute('a < b')).toBe('a &lt; b');
    });

    it('should escape greater than', () => {
      expect(escapeHtmlAttribute('a > b')).toBe('a &gt; b');
    });

    it('should escape multiple special characters', () => {
      expect(escapeHtmlAttribute('<"test" & \'value\'>')).toBe(
        '&lt;&quot;test&quot; &amp; &#39;value&#39;&gt;'
      );
    });

    it('should handle empty string', () => {
      expect(escapeHtmlAttribute('')).toBe('');
    });

    it('should not modify strings without special characters', () => {
      expect(escapeHtmlAttribute('simple text')).toBe('simple text');
    });
  });

  // ==========================================================================
  // generateIconCard Tests
  // ==========================================================================

  describe('generateIconCard', () => {
    const mockIcon: IconSearchResult = { prefix: 'mdi', name: 'home' };

    it('should generate valid icon card HTML', () => {
      const html = generateIconCard(mockIcon);
      expect(html).toContain('class="icon-card"');
      expect(html).toContain('data-prefix="mdi"');
      expect(html).toContain('data-name="home"');
    });

    it('should include preview image', () => {
      const html = generateIconCard(mockIcon);
      expect(html).toContain('class="icon-preview"');
      expect(html).toContain('<img src=');
      expect(html).toContain('api.iconify.design/mdi/home.svg');
    });

    it('should include add button', () => {
      const html = generateIconCard(mockIcon);
      expect(html).toContain('class="add-btn"');
      expect(html).toContain('+ Add');
      expect(html).toContain("onclick=\"addIcon('mdi', 'home')\"");
    });

    it('should use default white color', () => {
      const html = generateIconCard(mockIcon);
      expect(html).toContain('color=%23ffffff');
    });

    it('should use provided preview color', () => {
      const html = generateIconCard(mockIcon, '#ff0000');
      expect(html).toContain('color=%23ff0000');
    });

    it('should escape special characters in name', () => {
      const icon: IconSearchResult = { prefix: 'test', name: 'icon<script>' };
      const html = generateIconCard(icon);
      expect(html).toContain('icon&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('should display icon info', () => {
      const html = generateIconCard(mockIcon);
      expect(html).toContain('class="icon-name"');
      expect(html).toContain('class="icon-prefix"');
      expect(html).toContain('>home<');
      expect(html).toContain('>mdi<');
    });
  });

  // ==========================================================================
  // generateIconCards Tests
  // ==========================================================================

  describe('generateIconCards', () => {
    it('should generate multiple cards', () => {
      const icons: IconSearchResult[] = [
        { prefix: 'mdi', name: 'home' },
        { prefix: 'mdi', name: 'settings' },
      ];
      const html = generateIconCards(icons);
      expect(html).toContain('data-name="home"');
      expect(html).toContain('data-name="settings"');
    });

    it('should handle empty array', () => {
      const html = generateIconCards([]);
      expect(html).toBe('');
    });

    it('should apply same color to all cards', () => {
      const icons: IconSearchResult[] = [
        { prefix: 'mdi', name: 'home' },
        { prefix: 'mdi', name: 'star' },
      ];
      const html = generateIconCards(icons, '#00ff00');
      const matches = html.match(/color=%2300ff00/g);
      expect(matches).toHaveLength(2);
    });
  });

  // ==========================================================================
  // generateColorPresetButton Tests
  // ==========================================================================

  describe('generateColorPresetButton', () => {
    const preset: ColorPreset = { color: '#3b82f6', title: 'Blue' };

    it('should generate preset button', () => {
      const html = generateColorPresetButton(preset);
      expect(html).toContain('class="color-preset"');
      expect(html).toContain('style="background: #3b82f6"');
      expect(html).toContain('data-color="#3b82f6"');
      expect(html).toContain('title="Blue"');
    });

    it('should add active class when active', () => {
      const html = generateColorPresetButton(preset, true);
      expect(html).toContain('class="color-preset active"');
    });

    it('should not add active class when not active', () => {
      const html = generateColorPresetButton(preset, false);
      expect(html).toContain('class="color-preset"');
      expect(html).not.toContain('active');
    });
  });

  // ==========================================================================
  // generateColorPresets Tests
  // ==========================================================================

  describe('generateColorPresets', () => {
    it('should generate all default presets', () => {
      const html = generateColorPresets();
      DEFAULT_COLOR_PRESETS.forEach(preset => {
        expect(html).toContain(preset.color);
      });
    });

    it('should mark active color', () => {
      const html = generateColorPresets(DEFAULT_COLOR_PRESETS, '#000000');
      expect(html).toContain('data-color="#000000"');
    });

    it('should use custom presets', () => {
      const customPresets: ColorPreset[] = [
        { color: '#custom1', title: 'Custom 1' },
        { color: '#custom2', title: 'Custom 2' },
      ];
      const html = generateColorPresets(customPresets);
      expect(html).toContain('#custom1');
      expect(html).toContain('#custom2');
    });
  });

  // ==========================================================================
  // getIconPickerStyles Tests
  // ==========================================================================

  describe('getIconPickerStyles', () => {
    it('should return CSS string', () => {
      const css = getIconPickerStyles();
      expect(typeof css).toBe('string');
      expect(css.length).toBeGreaterThan(0);
    });

    it('should include icon card styles', () => {
      const css = getIconPickerStyles();
      expect(css).toContain('.icon-card');
    });

    it('should include grid styles', () => {
      const css = getIconPickerStyles();
      expect(css).toContain('.grid');
      expect(css).toContain('grid-template-columns');
    });

    it('should include color picker styles', () => {
      const css = getIconPickerStyles();
      expect(css).toContain('.color-picker');
      expect(css).toContain('.color-preset');
    });

    it('should include add button styles', () => {
      const css = getIconPickerStyles();
      expect(css).toContain('.add-btn');
    });

    it('should use VS Code theme variables', () => {
      const css = getIconPickerStyles();
      expect(css).toContain('var(--vscode-');
    });
  });

  // ==========================================================================
  // getIconPickerScript Tests
  // ==========================================================================

  describe('getIconPickerScript', () => {
    it('should return JavaScript string', () => {
      const js = getIconPickerScript();
      expect(typeof js).toBe('string');
      expect(js.length).toBeGreaterThan(0);
    });

    it('should include addIcon function', () => {
      const js = getIconPickerScript();
      expect(js).toContain('function addIcon');
    });

    it('should include updateIconColors function', () => {
      const js = getIconPickerScript();
      expect(js).toContain('function updateIconColors');
    });

    it('should handle message events', () => {
      const js = getIconPickerScript();
      expect(js).toContain("window.addEventListener('message'");
    });

    it('should include vscode API', () => {
      const js = getIconPickerScript();
      expect(js).toContain('acquireVsCodeApi');
    });

    it('should handle iconAdded message', () => {
      const js = getIconPickerScript();
      expect(js).toContain('iconAdded');
    });
  });

  // ==========================================================================
  // generateToolbarHtml Tests
  // ==========================================================================

  describe('generateToolbarHtml', () => {
    it('should include color picker input', () => {
      const html = generateToolbarHtml();
      expect(html).toContain('type="color"');
      expect(html).toContain('id="colorPicker"');
    });

    it('should include color presets', () => {
      const html = generateToolbarHtml();
      expect(html).toContain('class="color-presets"');
    });

    it('should use provided active color', () => {
      const html = generateToolbarHtml('#ff0000');
      expect(html).toContain('value="#ff0000"');
    });

    it('should default to white', () => {
      const html = generateToolbarHtml();
      expect(html).toContain('value="#ffffff"');
    });

    it('should include color picker label', () => {
      const html = generateToolbarHtml();
      expect(html).toContain('Color:');
    });
  });

  // ==========================================================================
  // getIconPickerHtml Tests
  // ==========================================================================

  describe('getIconPickerHtml', () => {
    const mockIcons: IconSearchResult[] = [
      { prefix: 'mdi', name: 'home' },
      { prefix: 'mdi', name: 'star' },
    ];

    it('should generate complete HTML document', () => {
      const html = getIconPickerHtml(mockIcons, 'home');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('should include query in title', () => {
      const html = getIconPickerHtml(mockIcons, 'test-query');
      expect(html).toContain('<title>Icon Picker</title>');
      expect(html).toContain('Iconify Browser');
      expect(html).toContain('test-query');
    });

    it('should include icon count', () => {
      const html = getIconPickerHtml(mockIcons, 'home');
      expect(html).toContain('Found 2 icons');
    });

    it('should escape query in HTML', () => {
      const html = getIconPickerHtml(mockIcons, '<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('"<script>"');
    });

    it('should include styles', () => {
      const html = getIconPickerHtml(mockIcons, 'home');
      expect(html).toContain('<style>');
      expect(html).toContain('.icon-card');
    });

    it('should include script', () => {
      const html = getIconPickerHtml(mockIcons, 'home');
      expect(html).toContain('<script>');
      expect(html).toContain('acquireVsCodeApi');
    });

    it('should include toolbar', () => {
      const html = getIconPickerHtml(mockIcons, 'home');
      expect(html).toContain('class="toolbar"');
    });

    it('should include icon cards', () => {
      const html = getIconPickerHtml(mockIcons, 'home');
      expect(html).toContain('data-name="home"');
      expect(html).toContain('data-name="star"');
    });

    it('should use custom preview color', () => {
      const html = getIconPickerHtml(mockIcons, 'home', '#00ff00');
      expect(html).toContain('color=%2300ff00');
    });

    it('should handle empty icons array', () => {
      const html = getIconPickerHtml([], 'nothing');
      expect(html).toContain('Found 0 icons');
      expect(html).toContain('<!DOCTYPE html>');
    });
  });
});
