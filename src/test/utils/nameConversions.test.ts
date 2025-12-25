import {
  toVariableName,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  toCustomElementName,
  toConstantCase,
  sanitizeIdentifier,
  extractIconNameFromPath,
  parseIconPrefix,
  formatIconWithPrefix,
  normalizeIconName,
  isValidIconName,
  isValidIdentifier,
  generateUniqueName,
  truncateName,
  compareIconNames,
  groupIconsByPrefix
} from '../../utils/nameConversions';

describe('nameConversions', () => {
  describe('toVariableName', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(toVariableName('arrow-right')).toBe('arrowRight');
      expect(toVariableName('my-icon-name')).toBe('myIconName');
    });

    it('should handle colon separator (prefix:name)', () => {
      expect(toVariableName('mdi:home')).toBe('mdiHome');
      expect(toVariableName('fa:user')).toBe('faUser');
    });

    it('should handle single word', () => {
      expect(toVariableName('icon')).toBe('icon');
    });

    it('should handle empty string', () => {
      expect(toVariableName('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(toVariableName(null as any)).toBe('');
      expect(toVariableName(undefined as any)).toBe('');
    });
  });

  describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('arrowRight')).toBe('arrow-right');
      expect(toKebabCase('myIconName')).toBe('my-icon-name');
    });

    it('should convert PascalCase to kebab-case', () => {
      expect(toKebabCase('ArrowRight')).toBe('arrow-right');
      expect(toKebabCase('MyIcon')).toBe('my-icon');
    });

    it('should handle consecutive capitals', () => {
      expect(toKebabCase('XMLParser')).toBe('xml-parser');
      expect(toKebabCase('SVGIcon')).toBe('svg-icon');
    });

    it('should remove special characters', () => {
      expect(toKebabCase('my_icon')).toBe('my-icon');
      expect(toKebabCase('icon@2x')).toBe('icon-2x');
    });

    it('should handle empty string', () => {
      expect(toKebabCase('')).toBe('');
    });
  });

  describe('toPascalCase', () => {
    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('arrow-right')).toBe('ArrowRight');
      expect(toPascalCase('my-icon')).toBe('MyIcon');
    });

    it('should convert snake_case to PascalCase', () => {
      expect(toPascalCase('arrow_right')).toBe('ArrowRight');
    });

    it('should handle single word', () => {
      expect(toPascalCase('icon')).toBe('Icon');
    });

    it('should handle empty string', () => {
      expect(toPascalCase('')).toBe('');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('arrowRight')).toBe('arrow_right');
    });

    it('should convert PascalCase to snake_case', () => {
      expect(toSnakeCase('ArrowRight')).toBe('arrow_right');
    });

    it('should handle empty string', () => {
      expect(toSnakeCase('')).toBe('');
    });
  });

  describe('toCustomElementName', () => {
    it('should convert PascalCase to kebab-case with hyphen', () => {
      expect(toCustomElementName('MyIcon')).toBe('my-icon');
    });

    it('should add -icon suffix if no hyphen', () => {
      expect(toCustomElementName('Icon')).toBe('icon-icon');
      expect(toCustomElementName('svg')).toBe('svg-icon');
    });

    it('should keep existing hyphen', () => {
      expect(toCustomElementName('sg-icon')).toBe('sg-icon');
    });

    it('should handle empty string', () => {
      expect(toCustomElementName('')).toBe('icon-element');
    });
  });

  describe('toConstantCase', () => {
    it('should convert to SCREAMING_SNAKE_CASE', () => {
      expect(toConstantCase('arrowRight')).toBe('ARROW_RIGHT');
      expect(toConstantCase('my-icon')).toBe('MY_ICON');
    });

    it('should handle empty string', () => {
      expect(toConstantCase('')).toBe('');
    });
  });

  describe('sanitizeIdentifier', () => {
    it('should replace invalid characters', () => {
      expect(sanitizeIdentifier('my-icon')).toBe('my_icon');
      expect(sanitizeIdentifier('icon@2x')).toBe('icon_2x');
    });

    it('should prefix with underscore if starts with number', () => {
      expect(sanitizeIdentifier('2icon')).toBe('_2icon');
    });

    it('should handle empty string', () => {
      expect(sanitizeIdentifier('')).toBe('unnamed');
    });

    it('should handle valid identifiers unchanged', () => {
      expect(sanitizeIdentifier('myIcon')).toBe('myIcon');
      expect(sanitizeIdentifier('_icon')).toBe('_icon');
      expect(sanitizeIdentifier('$icon')).toBe('$icon');
    });
  });

  describe('extractIconNameFromPath', () => {
    it('should extract name from Unix path', () => {
      expect(extractIconNameFromPath('/path/to/arrow-right.svg')).toBe('arrow-right');
    });

    it('should extract name from Windows path', () => {
      expect(extractIconNameFromPath('C:\\icons\\my-icon.svg')).toBe('my-icon');
    });

    it('should remove extension', () => {
      expect(extractIconNameFromPath('icon.svg')).toBe('icon');
      // Note: dots in filename get converted to hyphens
      expect(extractIconNameFromPath('icon.min.svg')).toBe('icon-min');
    });

    it('should handle empty string', () => {
      expect(extractIconNameFromPath('')).toBe('');
    });

    it('should clean up special characters', () => {
      expect(extractIconNameFromPath('/path/Icon Name.svg')).toBe('icon-name');
    });
  });

  describe('parseIconPrefix', () => {
    it('should parse prefix and name', () => {
      expect(parseIconPrefix('mdi:home')).toEqual({ prefix: 'mdi', name: 'home' });
      expect(parseIconPrefix('fa:user')).toEqual({ prefix: 'fa', name: 'user' });
    });

    it('should return null prefix for names without colon', () => {
      expect(parseIconPrefix('arrow-right')).toEqual({ prefix: null, name: 'arrow-right' });
    });

    it('should handle empty string', () => {
      expect(parseIconPrefix('')).toEqual({ prefix: null, name: '' });
    });

    it('should handle colon at start', () => {
      expect(parseIconPrefix(':home')).toEqual({ prefix: null, name: ':home' });
    });
  });

  describe('formatIconWithPrefix', () => {
    it('should format with prefix', () => {
      expect(formatIconWithPrefix('mdi', 'home')).toBe('mdi:home');
    });

    it('should return name only when no prefix', () => {
      expect(formatIconWithPrefix(null, 'arrow')).toBe('arrow');
      expect(formatIconWithPrefix('', 'arrow')).toBe('arrow');
    });

    it('should handle empty name', () => {
      expect(formatIconWithPrefix('mdi', '')).toBe('');
    });
  });

  describe('normalizeIconName', () => {
    it('should lowercase', () => {
      expect(normalizeIconName('ArrowRight')).toBe('arrowright');
    });

    it('should replace invalid characters', () => {
      expect(normalizeIconName('my_icon')).toBe('my-icon');
    });

    it('should preserve colons', () => {
      expect(normalizeIconName('mdi:Home')).toBe('mdi:home');
    });

    it('should handle empty string', () => {
      expect(normalizeIconName('')).toBe('');
    });
  });

  describe('isValidIconName', () => {
    it('should return true for valid names', () => {
      expect(isValidIconName('arrow')).toBe(true);
      expect(isValidIconName('arrow-right')).toBe(true);
      expect(isValidIconName('mdi:home')).toBe(true);
      expect(isValidIconName('icon123')).toBe(true);
    });

    it('should return false for invalid names', () => {
      expect(isValidIconName('')).toBe(false);
      expect(isValidIconName('123icon')).toBe(false);
      expect(isValidIconName('icon_name')).toBe(false);
      expect(isValidIconName('Icon')).toBe(false);
    });
  });

  describe('isValidIdentifier', () => {
    it('should return true for valid JS identifiers', () => {
      expect(isValidIdentifier('icon')).toBe(true);
      expect(isValidIdentifier('myIcon')).toBe(true);
      expect(isValidIdentifier('_icon')).toBe(true);
      expect(isValidIdentifier('$icon')).toBe(true);
      expect(isValidIdentifier('icon123')).toBe(true);
    });

    it('should return false for invalid identifiers', () => {
      expect(isValidIdentifier('')).toBe(false);
      expect(isValidIdentifier('123icon')).toBe(false);
      expect(isValidIdentifier('my-icon')).toBe(false);
      expect(isValidIdentifier('my icon')).toBe(false);
    });
  });

  describe('generateUniqueName', () => {
    it('should return base name if unique', () => {
      expect(generateUniqueName('icon', ['other'])).toBe('icon');
    });

    it('should append number if name exists', () => {
      expect(generateUniqueName('icon', ['icon'])).toBe('icon-1');
      expect(generateUniqueName('icon', ['icon', 'icon-1'])).toBe('icon-2');
    });

    it('should handle empty base name', () => {
      expect(generateUniqueName('', [])).toBe('icon');
    });

    it('should handle empty existing names', () => {
      expect(generateUniqueName('test', [])).toBe('test');
    });
  });

  describe('truncateName', () => {
    it('should not truncate short names', () => {
      expect(truncateName('icon', 10)).toBe('icon');
    });

    it('should truncate at word boundary', () => {
      expect(truncateName('arrow-right-icon', 11)).toBe('arrow-right');
    });

    it('should truncate without word boundary if needed', () => {
      expect(truncateName('verylongname', 5)).toBe('veryl');
    });

    it('should handle empty string', () => {
      expect(truncateName('', 10)).toBe('');
    });

    it('should handle null', () => {
      expect(truncateName(null as any, 10)).toBe('');
    });
  });

  describe('compareIconNames', () => {
    it('should compare alphabetically', () => {
      expect(compareIconNames('apple', 'banana')).toBeLessThan(0);
      expect(compareIconNames('banana', 'apple')).toBeGreaterThan(0);
      expect(compareIconNames('apple', 'apple')).toBe(0);
    });

    it('should be case-insensitive', () => {
      expect(compareIconNames('Apple', 'apple')).toBe(0);
      expect(compareIconNames('ARROW', 'arrow')).toBe(0);
    });
  });

  describe('groupIconsByPrefix', () => {
    it('should group icons by prefix', () => {
      const icons = ['mdi:home', 'mdi:star', 'fa:user', 'arrow'];
      const groups = groupIconsByPrefix(icons);
      
      expect(groups['mdi']).toEqual(['home', 'star']);
      expect(groups['fa']).toEqual(['user']);
      expect(groups['_unprefixed']).toEqual(['arrow']);
    });

    it('should handle empty array', () => {
      expect(groupIconsByPrefix([])).toEqual({});
    });

    it('should handle all unprefixed', () => {
      const icons = ['arrow', 'star', 'home'];
      const groups = groupIconsByPrefix(icons);
      
      expect(groups['_unprefixed']).toEqual(['arrow', 'star', 'home']);
    });
  });
});
