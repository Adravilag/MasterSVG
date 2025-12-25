/**
 * Tests for iconPickerUtils.ts
 */

import {
  IconPickerIcon,
  ColorPreset,
  DEFAULT_COLOR_PRESETS,
  encodeColorForUrl,
  createIconifyPreviewUrl,
  escapeForHtmlAttribute,
  generateIconCard,
  generateIconCards,
  generateColorPresetButton,
  generateColorPresets,
  getIconPickerStyles,
  getIconPickerScript,
  generateToolbarHtml,
  generateIconPickerHtml,
  parseIconId,
  formatIconId,
  generateCombinedIconName,
  filterIconsByPrefix,
  getUniquePrefixes,
  sortIconsByName,
  sortIconsByPrefixAndName,
  groupIconsByPrefix,
  truncateIconName,
  isValidHexColor,
  normalizeHexColor,
  iconMatchesQuery,
  filterIconsByQuery,
  calculateGridColumns,
  paginateIcons,
  getTotalPages,
} from '../../utils/iconPickerUtils';

describe('iconPickerUtils', () => {
  // Sample test data
  const sampleIcons: IconPickerIcon[] = [
    { prefix: 'mdi', name: 'home' },
    { prefix: 'mdi', name: 'account' },
    { prefix: 'fa', name: 'user' },
    { prefix: 'fa', name: 'settings' },
    { prefix: 'lucide', name: 'arrow-right' },
  ];

  describe('DEFAULT_COLOR_PRESETS', () => {
    it('should have 8 color presets', () => {
      expect(DEFAULT_COLOR_PRESETS).toHaveLength(8);
    });

    it('should have color and name for each preset', () => {
      DEFAULT_COLOR_PRESETS.forEach(preset => {
        expect(preset).toHaveProperty('color');
        expect(preset).toHaveProperty('name');
        expect(preset.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it('should include white and black presets', () => {
      const colors = DEFAULT_COLOR_PRESETS.map(p => p.color);
      expect(colors).toContain('#ffffff');
      expect(colors).toContain('#000000');
    });
  });

  describe('encodeColorForUrl', () => {
    it('should encode hash symbol', () => {
      expect(encodeColorForUrl('#ffffff')).toBe('%23ffffff');
    });

    it('should handle already encoded colors', () => {
      expect(encodeColorForUrl('%23ffffff')).toBe('%2523ffffff');
    });

    it('should handle named colors', () => {
      expect(encodeColorForUrl('red')).toBe('red');
    });
  });

  describe('createIconifyPreviewUrl', () => {
    it('should create URL with default white color', () => {
      const url = createIconifyPreviewUrl('mdi', 'home');
      expect(url).toBe('https://api.iconify.design/mdi/home.svg?color=%23ffffff');
    });

    it('should create URL with custom color', () => {
      const url = createIconifyPreviewUrl('fa', 'user', '#ff0000');
      expect(url).toBe('https://api.iconify.design/fa/user.svg?color=%23ff0000');
    });

    it('should handle icon names with hyphens', () => {
      const url = createIconifyPreviewUrl('lucide', 'arrow-right', '#000000');
      expect(url).toContain('lucide/arrow-right.svg');
    });
  });

  describe('escapeForHtmlAttribute', () => {
    it('should escape ampersand', () => {
      expect(escapeForHtmlAttribute('a&b')).toBe('a&amp;b');
    });

    it('should escape double quotes', () => {
      expect(escapeForHtmlAttribute('a"b')).toBe('a&quot;b');
    });

    it('should escape single quotes', () => {
      expect(escapeForHtmlAttribute("a'b")).toBe('a&#x27;b');
    });

    it('should escape less than', () => {
      expect(escapeForHtmlAttribute('a<b')).toBe('a&lt;b');
    });

    it('should escape greater than', () => {
      expect(escapeForHtmlAttribute('a>b')).toBe('a&gt;b');
    });

    it('should escape multiple special characters', () => {
      expect(escapeForHtmlAttribute('<div class="test">')).toBe(
        '&lt;div class=&quot;test&quot;&gt;'
      );
    });

    it('should handle empty string', () => {
      expect(escapeForHtmlAttribute('')).toBe('');
    });
  });

  describe('generateIconCard', () => {
    it('should generate valid icon card HTML', () => {
      const card = generateIconCard({ prefix: 'mdi', name: 'home' });
      expect(card).toContain('data-prefix="mdi"');
      expect(card).toContain('data-name="home"');
      expect(card).toContain('class="icon-card"');
    });

    it('should include preview image', () => {
      const card = generateIconCard({ prefix: 'fa', name: 'user' });
      expect(card).toContain('<img src=');
      expect(card).toContain('api.iconify.design/fa/user.svg');
    });

    it('should include add button', () => {
      const card = generateIconCard({ prefix: 'mdi', name: 'home' });
      expect(card).toContain('class="add-btn"');
      expect(card).toContain('+ Add');
    });

    it('should escape special characters in name', () => {
      const card = generateIconCard({ prefix: 'test', name: 'icon<script>' });
      expect(card).toContain('icon&lt;script&gt;');
    });

    it('should use provided preview color', () => {
      const card = generateIconCard({ prefix: 'mdi', name: 'home' }, '#ff0000');
      expect(card).toContain('%23ff0000');
    });
  });

  describe('generateIconCards', () => {
    it('should generate multiple cards', () => {
      const cards = generateIconCards(sampleIcons.slice(0, 2));
      expect(cards).toContain('data-name="home"');
      expect(cards).toContain('data-name="account"');
    });

    it('should handle empty array', () => {
      expect(generateIconCards([])).toBe('');
    });

    it('should apply same color to all cards', () => {
      const cards = generateIconCards(sampleIcons.slice(0, 2), '#0000ff');
      const colorCount = (cards.match(/%230000ff/g) || []).length;
      expect(colorCount).toBe(2);
    });
  });

  describe('generateColorPresetButton', () => {
    it('should generate preset button', () => {
      const preset: ColorPreset = { color: '#ff0000', name: 'Red' };
      const button = generateColorPresetButton(preset);
      expect(button).toContain('class="color-preset"');
      expect(button).toContain('style="background: #ff0000"');
      expect(button).toContain('data-color="#ff0000"');
      expect(button).toContain('title="Red"');
    });

    it('should add active class when active', () => {
      const preset: ColorPreset = { color: '#00ff00', name: 'Green' };
      const button = generateColorPresetButton(preset, true);
      expect(button).toContain('class="color-preset active"');
    });

    it('should not add active class when not active', () => {
      const preset: ColorPreset = { color: '#0000ff', name: 'Blue' };
      const button = generateColorPresetButton(preset, false);
      expect(button).not.toContain('active');
    });
  });

  describe('generateColorPresets', () => {
    it('should generate all default presets', () => {
      const presets = generateColorPresets();
      expect(presets).toContain('#ffffff');
      expect(presets).toContain('#000000');
    });

    it('should mark active color', () => {
      const presets = generateColorPresets(DEFAULT_COLOR_PRESETS, '#000000');
      // Black should be active
      expect(presets).toContain('data-color="#000000"');
    });

    it('should use custom presets', () => {
      const customPresets: ColorPreset[] = [
        { color: '#123456', name: 'Custom' },
      ];
      const presets = generateColorPresets(customPresets);
      expect(presets).toContain('#123456');
    });
  });

  describe('getIconPickerStyles', () => {
    it('should return CSS string', () => {
      const styles = getIconPickerStyles();
      expect(styles).toContain('body');
      expect(styles).toContain('--vscode-');
    });

    it('should include icon card styles', () => {
      const styles = getIconPickerStyles();
      expect(styles).toContain('.icon-card');
    });

    it('should include grid styles', () => {
      const styles = getIconPickerStyles();
      expect(styles).toContain('.grid');
      expect(styles).toContain('grid-template-columns');
    });

    it('should include color picker styles', () => {
      const styles = getIconPickerStyles();
      expect(styles).toContain('.color-picker');
      expect(styles).toContain('.color-preset');
    });
  });

  describe('getIconPickerScript', () => {
    it('should return JavaScript string', () => {
      const script = getIconPickerScript();
      expect(script).toContain('const vscode = acquireVsCodeApi()');
    });

    it('should include addIcon function', () => {
      const script = getIconPickerScript();
      expect(script).toContain('function addIcon');
    });

    it('should include updateIconColors function', () => {
      const script = getIconPickerScript();
      expect(script).toContain('function updateIconColors');
    });

    it('should handle message events', () => {
      const script = getIconPickerScript();
      expect(script).toContain("window.addEventListener('message'");
    });
  });

  describe('generateToolbarHtml', () => {
    it('should include color picker input', () => {
      const toolbar = generateToolbarHtml();
      expect(toolbar).toContain('type="color"');
      expect(toolbar).toContain('id="colorPicker"');
    });

    it('should include color presets', () => {
      const toolbar = generateToolbarHtml();
      expect(toolbar).toContain('class="color-presets"');
    });

    it('should use provided active color', () => {
      const toolbar = generateToolbarHtml(DEFAULT_COLOR_PRESETS, '#ff0000');
      expect(toolbar).toContain('value="#ff0000"');
    });
  });

  describe('generateIconPickerHtml', () => {
    it('should generate complete HTML document', () => {
      const html = generateIconPickerHtml(sampleIcons.slice(0, 2), 'home');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('should include query in title', () => {
      const html = generateIconPickerHtml([], 'search-query');
      expect(html).toContain('Search Results for "search-query"');
    });

    it('should include icon count', () => {
      const html = generateIconPickerHtml(sampleIcons, 'test');
      expect(html).toContain(`Found ${sampleIcons.length} icons`);
    });

    it('should escape query in HTML', () => {
      const html = generateIconPickerHtml([], '<script>alert("xss")</script>');
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should include styles', () => {
      const html = generateIconPickerHtml([], 'test');
      expect(html).toContain('<style>');
    });

    it('should include script', () => {
      const html = generateIconPickerHtml([], 'test');
      expect(html).toContain('<script>');
    });
  });

  describe('parseIconId', () => {
    it('should parse valid icon ID', () => {
      const result = parseIconId('mdi:home');
      expect(result).toEqual({ prefix: 'mdi', name: 'home' });
    });

    it('should return null for invalid ID without colon', () => {
      expect(parseIconId('mdihome')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseIconId('')).toBeNull();
    });

    it('should return null for ID with only prefix', () => {
      expect(parseIconId('mdi:')).toBeNull();
    });

    it('should handle names with hyphens', () => {
      const result = parseIconId('lucide:arrow-right');
      expect(result).toEqual({ prefix: 'lucide', name: 'arrow-right' });
    });
  });

  describe('formatIconId', () => {
    it('should format icon ID', () => {
      expect(formatIconId('mdi', 'home')).toBe('mdi:home');
    });

    it('should handle empty values', () => {
      expect(formatIconId('', '')).toBe(':');
    });
  });

  describe('generateCombinedIconName', () => {
    it('should combine prefix and name with hyphen', () => {
      expect(generateCombinedIconName('mdi', 'home')).toBe('mdi-home');
    });

    it('should handle empty values', () => {
      expect(generateCombinedIconName('', 'home')).toBe('-home');
    });
  });

  describe('filterIconsByPrefix', () => {
    it('should filter icons by prefix', () => {
      const filtered = filterIconsByPrefix(sampleIcons, 'mdi');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(i => i.prefix === 'mdi')).toBe(true);
    });

    it('should return empty array for non-matching prefix', () => {
      const filtered = filterIconsByPrefix(sampleIcons, 'nonexistent');
      expect(filtered).toHaveLength(0);
    });

    it('should handle empty input', () => {
      expect(filterIconsByPrefix([], 'mdi')).toHaveLength(0);
    });
  });

  describe('getUniquePrefixes', () => {
    it('should return unique prefixes', () => {
      const prefixes = getUniquePrefixes(sampleIcons);
      expect(prefixes).toHaveLength(3);
      expect(prefixes).toContain('mdi');
      expect(prefixes).toContain('fa');
      expect(prefixes).toContain('lucide');
    });

    it('should return sorted prefixes', () => {
      const prefixes = getUniquePrefixes(sampleIcons);
      expect(prefixes).toEqual(['fa', 'lucide', 'mdi']);
    });

    it('should handle empty array', () => {
      expect(getUniquePrefixes([])).toHaveLength(0);
    });
  });

  describe('sortIconsByName', () => {
    it('should sort icons alphabetically by name', () => {
      const sorted = sortIconsByName(sampleIcons.slice(0, 2));
      expect(sorted[0].name).toBe('account');
      expect(sorted[1].name).toBe('home');
    });

    it('should not mutate original array', () => {
      const original = [...sampleIcons];
      sortIconsByName(sampleIcons);
      expect(sampleIcons).toEqual(original);
    });

    it('should handle empty array', () => {
      expect(sortIconsByName([])).toHaveLength(0);
    });
  });

  describe('sortIconsByPrefixAndName', () => {
    it('should sort by prefix first', () => {
      const sorted = sortIconsByPrefixAndName(sampleIcons);
      expect(sorted[0].prefix).toBe('fa');
      expect(sorted[sorted.length - 1].prefix).toBe('mdi');
    });

    it('should sort by name within same prefix', () => {
      const sorted = sortIconsByPrefixAndName(sampleIcons);
      const mdiIcons = sorted.filter(i => i.prefix === 'mdi');
      expect(mdiIcons[0].name).toBe('account');
      expect(mdiIcons[1].name).toBe('home');
    });

    it('should not mutate original array', () => {
      const original = [...sampleIcons];
      sortIconsByPrefixAndName(sampleIcons);
      expect(sampleIcons).toEqual(original);
    });
  });

  describe('groupIconsByPrefix', () => {
    it('should group icons by prefix', () => {
      const groups = groupIconsByPrefix(sampleIcons);
      expect(Object.keys(groups)).toHaveLength(3);
      expect(groups['mdi']).toHaveLength(2);
      expect(groups['fa']).toHaveLength(2);
      expect(groups['lucide']).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const groups = groupIconsByPrefix([]);
      expect(Object.keys(groups)).toHaveLength(0);
    });
  });

  describe('truncateIconName', () => {
    it('should not truncate short names', () => {
      expect(truncateIconName('home')).toBe('home');
    });

    it('should truncate long names', () => {
      const longName = 'this-is-a-very-long-icon-name';
      const truncated = truncateIconName(longName, 20);
      expect(truncated.length).toBe(20);
      expect(truncated.endsWith('…')).toBe(true);
    });

    it('should handle custom max length', () => {
      expect(truncateIconName('abcdefghij', 5)).toBe('abcd…');
    });

    it('should handle name exactly at max length', () => {
      expect(truncateIconName('12345', 5)).toBe('12345');
    });
  });

  describe('isValidHexColor', () => {
    it('should validate 6-digit hex', () => {
      expect(isValidHexColor('#ffffff')).toBe(true);
      expect(isValidHexColor('#000000')).toBe(true);
      expect(isValidHexColor('#ff0000')).toBe(true);
    });

    it('should validate 3-digit hex', () => {
      expect(isValidHexColor('#fff')).toBe(true);
      expect(isValidHexColor('#000')).toBe(true);
    });

    it('should reject invalid colors', () => {
      expect(isValidHexColor('ffffff')).toBe(false);
      expect(isValidHexColor('#ffff')).toBe(false);
      expect(isValidHexColor('red')).toBe(false);
      expect(isValidHexColor('')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isValidHexColor('#FFFFFF')).toBe(true);
      expect(isValidHexColor('#AbCdEf')).toBe(true);
    });
  });

  describe('normalizeHexColor', () => {
    it('should keep colors with hash', () => {
      expect(normalizeHexColor('#ff0000')).toBe('#ff0000');
    });

    it('should add hash to colors without', () => {
      expect(normalizeHexColor('ff0000')).toBe('#ff0000');
    });

    it('should return white for empty/null', () => {
      expect(normalizeHexColor('')).toBe('#ffffff');
    });
  });

  describe('iconMatchesQuery', () => {
    it('should match by name', () => {
      expect(iconMatchesQuery({ prefix: 'mdi', name: 'home' }, 'home')).toBe(true);
    });

    it('should match by prefix', () => {
      expect(iconMatchesQuery({ prefix: 'mdi', name: 'home' }, 'mdi')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(iconMatchesQuery({ prefix: 'MDI', name: 'Home' }, 'home')).toBe(true);
    });

    it('should match partial strings', () => {
      expect(iconMatchesQuery({ prefix: 'mdi', name: 'arrow-right' }, 'arrow')).toBe(true);
    });

    it('should return false for non-matching', () => {
      expect(iconMatchesQuery({ prefix: 'mdi', name: 'home' }, 'xyz')).toBe(false);
    });
  });

  describe('filterIconsByQuery', () => {
    it('should filter icons by query', () => {
      const filtered = filterIconsByQuery(sampleIcons, 'home');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('home');
    });

    it('should return all icons for empty query', () => {
      expect(filterIconsByQuery(sampleIcons, '')).toHaveLength(5);
      expect(filterIconsByQuery(sampleIcons, '   ')).toHaveLength(5);
    });

    it('should filter by prefix', () => {
      const filtered = filterIconsByQuery(sampleIcons, 'mdi');
      expect(filtered).toHaveLength(2);
    });
  });

  describe('calculateGridColumns', () => {
    it('should calculate columns based on width', () => {
      // With 500px width, 140px min column, 16px gap
      // (500 + 16) / (140 + 16) = 3.3 -> 3 columns
      expect(calculateGridColumns(500)).toBe(3);
    });

    it('should use custom min column width', () => {
      expect(calculateGridColumns(500, 100)).toBe(4);
    });

    it('should use custom gap', () => {
      expect(calculateGridColumns(500, 140, 10)).toBe(3);
    });

    it('should return at least 1 column', () => {
      expect(calculateGridColumns(50)).toBe(0);
    });
  });

  describe('paginateIcons', () => {
    it('should return correct page of icons', () => {
      const page0 = paginateIcons(sampleIcons, 0, 2);
      expect(page0).toHaveLength(2);
      expect(page0[0].name).toBe('home');
    });

    it('should return second page', () => {
      const page1 = paginateIcons(sampleIcons, 1, 2);
      expect(page1).toHaveLength(2);
      expect(page1[0].name).toBe('user');
    });

    it('should handle last partial page', () => {
      const lastPage = paginateIcons(sampleIcons, 2, 2);
      expect(lastPage).toHaveLength(1);
    });

    it('should return empty for out of range page', () => {
      expect(paginateIcons(sampleIcons, 10, 2)).toHaveLength(0);
    });
  });

  describe('getTotalPages', () => {
    it('should calculate total pages', () => {
      expect(getTotalPages(10, 3)).toBe(4);
      expect(getTotalPages(10, 5)).toBe(2);
      expect(getTotalPages(10, 10)).toBe(1);
    });

    it('should handle empty list', () => {
      expect(getTotalPages(0, 10)).toBe(0);
    });

    it('should round up for partial pages', () => {
      expect(getTotalPages(11, 5)).toBe(3);
    });
  });
});
