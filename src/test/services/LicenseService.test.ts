/**
 * Tests for LicenseService
 */

import { 
  parseIconifyName, 
  groupByCollection,
  generateCombinedLicense,
  IconAttribution 
} from '../../services/LicenseService';

describe('LicenseService', () => {
  describe('parseIconifyName', () => {
    it('should parse common Iconify prefixes', () => {
      expect(parseIconifyName('mdi-home')).toEqual({ prefix: 'mdi', name: 'home' });
      expect(parseIconifyName('fa-star')).toEqual({ prefix: 'fa', name: 'star' });
      expect(parseIconifyName('lucide-arrow-right')).toEqual({ prefix: 'lucide', name: 'arrow-right' });
      expect(parseIconifyName('tabler-user')).toEqual({ prefix: 'tabler', name: 'user' });
    });

    it('should parse multi-segment prefixes', () => {
      expect(parseIconifyName('material-symbols-home')).toEqual({ prefix: 'material-symbols', name: 'home' });
      expect(parseIconifyName('fa-solid-star')).toEqual({ prefix: 'fa-solid', name: 'star' });
      expect(parseIconifyName('icon-park-outline-add')).toEqual({ prefix: 'icon-park-outline', name: 'add' });
    });

    it('should fallback to generic parsing for unknown prefixes', () => {
      expect(parseIconifyName('unknown-icon')).toEqual({ prefix: 'unknown', name: 'icon' });
      expect(parseIconifyName('custom-my-icon')).toEqual({ prefix: 'custom', name: 'my-icon' });
    });

    it('should return null for invalid icon names', () => {
      expect(parseIconifyName('simpleicon')).toBeNull();
      expect(parseIconifyName('')).toBeNull();
    });
  });

  describe('groupByCollection', () => {
    it('should group attributions by collection prefix', () => {
      const attributions: IconAttribution[] = [
        {
          iconName: 'mdi-home',
          prefix: 'mdi',
          collection: 'Material Design Icons',
          author: { name: 'Pictogrammers' },
          license: { title: 'Apache 2.0', spdx: 'Apache-2.0' }
        },
        {
          iconName: 'mdi-star',
          prefix: 'mdi',
          collection: 'Material Design Icons',
          author: { name: 'Pictogrammers' },
          license: { title: 'Apache 2.0', spdx: 'Apache-2.0' }
        },
        {
          iconName: 'lucide-arrow',
          prefix: 'lucide',
          collection: 'Lucide',
          author: { name: 'Lucide Contributors' },
          license: { title: 'ISC', spdx: 'ISC' }
        }
      ];

      const grouped = groupByCollection(attributions);
      
      expect(grouped.size).toBe(2);
      expect(grouped.get('mdi')?.length).toBe(2);
      expect(grouped.get('lucide')?.length).toBe(1);
    });

    it('should handle empty attributions', () => {
      const grouped = groupByCollection([]);
      expect(grouped.size).toBe(0);
    });
  });

  describe('generateCombinedLicense', () => {
    it('should generate markdown content with license info', () => {
      const attributions: IconAttribution[] = [
        {
          iconName: 'mdi-home',
          prefix: 'mdi',
          collection: 'Material Design Icons',
          author: { name: 'Pictogrammers', url: 'https://github.com/Templarian/MaterialDesign' },
          license: { title: 'Apache 2.0', spdx: 'Apache-2.0', url: 'https://apache.org/licenses' }
        }
      ];

      const allIconNames = ['mdi-home', 'mdi-star', 'local-icon'];
      const content = generateCombinedLicense(attributions, allIconNames);

      expect(content).toContain('# Icon Licenses');
      expect(content).toContain('Material Design Icons');
      expect(content).toContain('Apache 2.0');
      expect(content).toContain('Pictogrammers');
      expect(content).toContain('mdi-home');
      expect(content).toContain('mdi-star');
      // local-icon should not be included (not from Iconify)
      expect(content).not.toContain('local-icon');
    });

    it('should include license and author URLs when available', () => {
      const attributions: IconAttribution[] = [
        {
          iconName: 'fa-star',
          prefix: 'fa',
          collection: 'Font Awesome',
          author: { name: 'Font Awesome', url: 'https://fontawesome.com' },
          license: { title: 'CC BY 4.0', spdx: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }
        }
      ];

      const content = generateCombinedLicense(attributions, ['fa-star']);

      expect(content).toContain('https://fontawesome.com');
      expect(content).toContain('https://creativecommons.org/licenses/by/4.0/');
    });

    it('should use collapsible section for collections with many icons', () => {
      const attributions: IconAttribution[] = [
        {
          iconName: 'mdi-home',
          prefix: 'mdi',
          collection: 'Material Design Icons',
          author: { name: 'Pictogrammers' },
          license: { title: 'Apache 2.0', spdx: 'Apache-2.0' }
        }
      ];

      // Create more than 10 icons
      const manyIcons = Array.from({ length: 15 }, (_, i) => `mdi-icon-${i}`);
      const content = generateCombinedLicense(attributions, manyIcons);

      expect(content).toContain('<details>');
      expect(content).toContain('</details>');
      expect(content).toContain('Show 15 icons');
    });
  });
});
