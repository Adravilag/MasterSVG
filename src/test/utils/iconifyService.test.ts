/**
 * Tests for iconifyService
 *
 * Tests Iconify API integration including search, fetch SVG, and collections.
 */

import { EventEmitter } from 'events';

// Create mock response class before jest.mock
class MockIncomingMessage extends EventEmitter {
  statusCode: number;
  constructor(statusCode: number = 200) {
    super();
    this.statusCode = statusCode;
  }
}

// Create mock request class
class MockClientRequest extends EventEmitter {
  // Empty implementation
}

// Mock https module
jest.mock('https', () => ({
  get: jest.fn(),
}));

import * as https from 'https';
import {
  searchIconify,
  fetchIconSvg,
  getIconInfo,
  getCollections,
  IconifySearchResult,
  clearAllCaches,
} from '../../utils/iconifyService';

const mockHttpsGet = https.get as jest.MockedFunction<typeof https.get>;

describe('iconifyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllCaches();
  });

  describe('IconifySearchResult interface', () => {
    it('should have correct structure', () => {
      const result: IconifySearchResult = {
        prefix: 'mdi',
        name: 'home',
      };
      expect(result.prefix).toBe('mdi');
      expect(result.name).toBe('home');
    });

    it('should allow various icon prefixes', () => {
      const results: IconifySearchResult[] = [
        { prefix: 'mdi', name: 'home' },
        { prefix: 'fa', name: 'user' },
        { prefix: 'heroicons', name: 'arrow-left' },
        { prefix: 'lucide', name: 'settings' },
      ];

      expect(results).toHaveLength(4);
      expect(results.map(r => r.prefix)).toEqual(['mdi', 'fa', 'heroicons', 'lucide']);
    });
  });

  describe('searchIconify', () => {
    it('should return parsed icons on successful response', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', JSON.stringify({
            icons: ['mdi:home', 'mdi:user', 'fa:star'],
          }));
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await searchIconify('home');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ prefix: 'mdi', name: 'home' });
      expect(result[1]).toEqual({ prefix: 'mdi', name: 'user' });
      expect(result[2]).toEqual({ prefix: 'fa', name: 'star' });
    });

    it('should return empty array when no icons in response', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', JSON.stringify({ icons: [] }));
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await searchIconify('nonexistent');
      expect(result).toEqual([]);
    });

    it('should reject on JSON parse error', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', 'invalid json');
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      await expect(searchIconify('test')).rejects.toThrow();
    });

    it('should reject on network error', async () => {
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation(() => {
        process.nextTick(() => {
          mockRequest.emit('error', new Error('Network error'));
        });
        return mockRequest as any;
      });

      await expect(searchIconify('test')).rejects.toThrow('Network error');
    });

    it('should use custom limit parameter', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((url, callback) => {
        expect(url).toContain('limit=10');
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', JSON.stringify({ icons: [] }));
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      await searchIconify('test', 10);
    });

    it('should skip icons without valid prefix:name format', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', JSON.stringify({
            icons: ['mdi:home', 'invalid', ':empty', 'prefix:'],
          }));
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await searchIconify('test');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ prefix: 'mdi', name: 'home' });
    });
  });

  describe('fetchIconSvg', () => {
    it('should return SVG content on successful response', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();
      const svgContent = '<svg viewBox="0 0 24 24"><path d="M10 20l-5-5"/></svg>';

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', svgContent);
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await fetchIconSvg('mdi', 'home');
      expect(result).toBe(svgContent);
    });

    it('should return null when status is not 200', async () => {
      const mockResponse = new MockIncomingMessage(404);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', 'Not Found');
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await fetchIconSvg('mdi', 'nonexistent');
      expect(result).toBeNull();
    });

    it('should return null when response does not contain SVG', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', 'plain text');
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await fetchIconSvg('mdi', 'home');
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation(() => {
        process.nextTick(() => {
          mockRequest.emit('error', new Error('Network error'));
        });
        return mockRequest as any;
      });

      const result = await fetchIconSvg('mdi', 'home');
      expect(result).toBeNull();
    });

    it('should add color parameter when provided', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((url, callback) => {
        expect(url).toContain('color=%23ff0000');
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', '<svg></svg>');
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      await fetchIconSvg('mdi', 'home', '#ff0000');
    });
  });

  describe('getIconInfo', () => {
    it('should return icon info on successful response', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();
      const iconData = {
        prefix: 'mdi',
        icons: {
          home: { body: '<path d="M10 20l-5-5"/>', width: 24, height: 24 },
        },
      };

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', JSON.stringify(iconData));
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await getIconInfo('mdi', 'home');
      expect(result).toEqual(iconData);
    });

    it('should return null when status is not 200', async () => {
      const mockResponse = new MockIncomingMessage(404);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', 'Not Found');
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await getIconInfo('mdi', 'nonexistent');
      expect(result).toBeNull();
    });

    it('should return null on JSON parse error', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', 'invalid json');
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await getIconInfo('mdi', 'home');
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation(() => {
        process.nextTick(() => {
          mockRequest.emit('error', new Error('Network error'));
        });
        return mockRequest as any;
      });

      const result = await getIconInfo('mdi', 'home');
      expect(result).toBeNull();
    });
  });

  describe('getCollections', () => {
    it('should return collections on successful response', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();
      const collectionsData = {
        mdi: { name: 'Material Design Icons', total: 6000 },
        fa: { name: 'Font Awesome', total: 1500 },
      };

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', JSON.stringify(collectionsData));
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await getCollections();
      expect(result).toEqual(collectionsData);
    });

    it('should return null when status is not 200', async () => {
      const mockResponse = new MockIncomingMessage(500);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', 'Server Error');
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await getCollections();
      expect(result).toBeNull();
    });

    it('should return null on JSON parse error', async () => {
      const mockResponse = new MockIncomingMessage(200);
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation((_url, callback) => {
        (callback as (res: MockIncomingMessage) => void)(mockResponse);
        process.nextTick(() => {
          mockResponse.emit('data', 'invalid json');
          mockResponse.emit('end');
        });
        return mockRequest as any;
      });

      const result = await getCollections();
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      const mockRequest = new MockClientRequest();

      mockHttpsGet.mockImplementation(() => {
        process.nextTick(() => {
          mockRequest.emit('error', new Error('Network error'));
        });
        return mockRequest as any;
      });

      const result = await getCollections();
      expect(result).toBeNull();
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
