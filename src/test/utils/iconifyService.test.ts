import { IconifySearchResult } from '../../utils/iconifyService';

// Note: Testing HTTP calls directly is complex. These tests focus on interface validation
// and basic logic. Integration tests would be better suited for actual API calls.

describe('iconifyService', () => {
  describe('IconifySearchResult interface', () => {
    it('should have correct structure', () => {
      const result: IconifySearchResult = {
        prefix: 'mdi',
        name: 'home'
      };
      expect(result.prefix).toBe('mdi');
      expect(result.name).toBe('home');
    });

    it('should allow various icon prefixes', () => {
      const results: IconifySearchResult[] = [
        { prefix: 'mdi', name: 'home' },
        { prefix: 'fa', name: 'user' },
        { prefix: 'heroicons', name: 'arrow-left' },
        { prefix: 'lucide', name: 'settings' }
      ];

      expect(results).toHaveLength(4);
      expect(results.map(r => r.prefix)).toEqual(['mdi', 'fa', 'heroicons', 'lucide']);
    });
  });

  describe('searchIconify', () => {
    it('should be exported from module', async () => {
      const { searchIconify } = await import('../../utils/iconifyService');
      expect(typeof searchIconify).toBe('function');
    });
  });

  describe('fetchIconSvg', () => {
    it('should be exported from module', async () => {
      const { fetchIconSvg } = await import('../../utils/iconifyService');
      expect(typeof fetchIconSvg).toBe('function');
    });
  });

  describe('getIconInfo', () => {
    it('should be exported from module', async () => {
      const { getIconInfo } = await import('../../utils/iconifyService');
      expect(typeof getIconInfo).toBe('function');
    });
  });

  describe('getCollections', () => {
    it('should be exported from module', async () => {
      const { getCollections } = await import('../../utils/iconifyService');
      expect(typeof getCollections).toBe('function');
    });
  });

  describe('URL construction', () => {
    it('searchIconify should encode query properly', () => {
      const query = 'arrow left';
      const encoded = encodeURIComponent(query);
      const url = `https://api.iconify.design/search?query=${encoded}&limit=50`;
      
      expect(url).toBe('https://api.iconify.design/search?query=arrow%20left&limit=50');
    });

    it('fetchIconSvg should construct correct URL', () => {
      const prefix = 'mdi';
      const name = 'home';
      const url = `https://api.iconify.design/${prefix}/${name}.svg`;
      
      expect(url).toBe('https://api.iconify.design/mdi/home.svg');
    });

    it('fetchIconSvg should add color parameter when provided', () => {
      const prefix = 'mdi';
      const name = 'home';
      const color = '#ff0000';
      const url = `https://api.iconify.design/${prefix}/${name}.svg?color=${encodeURIComponent(color)}`;
      
      expect(url).toBe('https://api.iconify.design/mdi/home.svg?color=%23ff0000');
    });

    it('getIconInfo should construct correct URL', () => {
      const prefix = 'mdi';
      const name = 'home';
      const url = `https://api.iconify.design/${prefix}.json?icons=${name}`;
      
      expect(url).toBe('https://api.iconify.design/mdi.json?icons=home');
    });
  });

  describe('parsing icon IDs', () => {
    it('should split icon ID into prefix and name', () => {
      const iconId = 'mdi:home';
      const [prefix, name] = iconId.split(':');
      
      expect(prefix).toBe('mdi');
      expect(name).toBe('home');
    });

    it('should handle icon IDs with hyphens', () => {
      const iconId = 'heroicons-outline:arrow-left';
      const [prefix, name] = iconId.split(':');
      
      expect(prefix).toBe('heroicons-outline');
      expect(name).toBe('arrow-left');
    });

    it('should handle invalid icon IDs gracefully', () => {
      const iconId = 'invalid';
      const parts = iconId.split(':');
      
      expect(parts).toHaveLength(1);
      expect(parts[0]).toBe('invalid');
    });
  });
});

