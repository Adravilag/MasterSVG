/**
 * Tests para iconifyApi.ts
 * 
 * Funciones de integración con la API de Iconify
 */

import {
  IconifySearchResult,
  parseIconifySearchResults,
  buildSearchUrl,
  buildSvgUrl,
  buildPreviewUrl,
  isValidSvgResponse
} from '../../utils/iconifyApi';

describe('iconifyApi', () => {
  // =====================================================
  // parseIconifySearchResults
  // =====================================================
  describe('parseIconifySearchResults', () => {
    test('debe parsear resultados válidos de Iconify', () => {
      const data = {
        icons: ['lucide:arrow-right', 'heroicons:home', 'tabler:star']
      };
      
      const result = parseIconifySearchResults(data);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ prefix: 'lucide', name: 'arrow-right' });
      expect(result[1]).toEqual({ prefix: 'heroicons', name: 'home' });
      expect(result[2]).toEqual({ prefix: 'tabler', name: 'star' });
    });

    test('debe manejar data vacía', () => {
      expect(parseIconifySearchResults({})).toEqual([]);
      expect(parseIconifySearchResults({ icons: [] })).toEqual([]);
    });

    test('debe manejar data nula o undefined', () => {
      expect(parseIconifySearchResults(null)).toEqual([]);
      expect(parseIconifySearchResults(undefined)).toEqual([]);
    });

    test('debe ignorar iconos sin formato válido', () => {
      const data = {
        icons: ['lucide:arrow', 'invalid', ':noprefix', 'noname:', '', 'a:b:c']
      };
      
      const result = parseIconifySearchResults(data);
      // Solo lucide:arrow es válido
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ prefix: 'lucide', name: 'arrow' });
    });

    test('debe manejar icons que no es array', () => {
      const data = { icons: 'not-an-array' };
      expect(parseIconifySearchResults(data)).toEqual([]);
    });

    test('debe parsear gran cantidad de iconos', () => {
      const icons = Array.from({ length: 100 }, (_, i) => `collection${i}:icon${i}`);
      const data = { icons };
      
      const result = parseIconifySearchResults(data);
      expect(result).toHaveLength(100);
      expect(result[0]).toEqual({ prefix: 'collection0', name: 'icon0' });
      expect(result[99]).toEqual({ prefix: 'collection99', name: 'icon99' });
    });
  });

  // =====================================================
  // buildSearchUrl
  // =====================================================
  describe('buildSearchUrl', () => {
    test('debe construir URL de búsqueda correcta', () => {
      const url = buildSearchUrl('arrow');
      expect(url).toBe('https://api.iconify.design/search?query=arrow&limit=50');
    });

    test('debe usar límite por defecto de 50', () => {
      const url = buildSearchUrl('home');
      expect(url).toContain('limit=50');
    });

    test('debe respetar límite personalizado', () => {
      const url = buildSearchUrl('user', 100);
      expect(url).toContain('limit=100');
    });

    test('debe encodear caracteres especiales', () => {
      const url = buildSearchUrl('arrow right');
      expect(url).toContain('query=arrow%20right');
    });

    test('debe manejar caracteres unicode', () => {
      const url = buildSearchUrl('flecha ➡️');
      expect(url).toContain('query=flecha%20');
    });

    test('debe manejar query vacía', () => {
      const url = buildSearchUrl('');
      expect(url).toBe('https://api.iconify.design/search?query=&limit=50');
    });
  });

  // =====================================================
  // buildSvgUrl
  // =====================================================
  describe('buildSvgUrl', () => {
    test('debe construir URL de SVG sin color', () => {
      const url = buildSvgUrl('lucide', 'arrow-right');
      expect(url).toBe('https://api.iconify.design/lucide/arrow-right.svg');
    });

    test('debe incluir color cuando se proporciona', () => {
      const url = buildSvgUrl('heroicons', 'home', '#ff0000');
      expect(url).toBe('https://api.iconify.design/heroicons/home.svg?color=%23ff0000');
    });

    test('debe encodear color correctamente', () => {
      const url = buildSvgUrl('tabler', 'star', '#3b82f6');
      expect(url).toContain('color=%233b82f6');
    });

    test('debe manejar colores con formato diferente', () => {
      const url1 = buildSvgUrl('lucide', 'check', 'red');
      expect(url1).toContain('color=red');
      
      const url2 = buildSvgUrl('lucide', 'x', 'rgb(255,0,0)');
      expect(url2).toContain('color=rgb');
    });

    test('debe manejar nombres con guiones', () => {
      const url = buildSvgUrl('material-symbols', 'arrow-forward-ios');
      expect(url).toBe('https://api.iconify.design/material-symbols/arrow-forward-ios.svg');
    });
  });

  // =====================================================
  // buildPreviewUrl
  // =====================================================
  describe('buildPreviewUrl', () => {
    test('debe usar color blanco por defecto', () => {
      const url = buildPreviewUrl('lucide', 'home');
      expect(url).toContain('color=%23ffffff');
    });

    test('debe usar color personalizado', () => {
      const url = buildPreviewUrl('lucide', 'home', '#000000');
      expect(url).toContain('color=%23000000');
    });

    test('debe construir URL completa correctamente', () => {
      const url = buildPreviewUrl('heroicons', 'star', '#fbbf24');
      expect(url).toBe('https://api.iconify.design/heroicons/star.svg?color=%23fbbf24');
    });
  });

  // =====================================================
  // isValidSvgResponse
  // =====================================================
  describe('isValidSvgResponse', () => {
    test('debe retornar true para SVG válido con status 200', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>';
      expect(isValidSvgResponse(svg, 200)).toBe(true);
    });

    test('debe retornar false para status diferente a 200', () => {
      const svg = '<svg></svg>';
      expect(isValidSvgResponse(svg, 404)).toBe(false);
      expect(isValidSvgResponse(svg, 500)).toBe(false);
      expect(isValidSvgResponse(svg, 301)).toBe(false);
    });

    test('debe retornar false si data no contiene <svg', () => {
      expect(isValidSvgResponse('Not found', 200)).toBe(false);
      expect(isValidSvgResponse('{"error": "not found"}', 200)).toBe(false);
      expect(isValidSvgResponse('<html><body>Error</body></html>', 200)).toBe(false);
    });

    test('debe retornar true para SVG con atributos', () => {
      const svg = '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10"/></svg>';
      expect(isValidSvgResponse(svg, 200)).toBe(true);
    });

    test('debe retornar true para SVG con namespace', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#id"/></svg>';
      expect(isValidSvgResponse(svg, 200)).toBe(true);
    });

    test('debe manejar SVG minificado', () => {
      const svg = '<svg><path d="M0 0h24v24H0z"/></svg>';
      expect(isValidSvgResponse(svg, 200)).toBe(true);
    });

    test('debe retornar false para string vacío', () => {
      expect(isValidSvgResponse('', 200)).toBe(false);
    });
  });

  // =====================================================
  // IconifySearchResult interface
  // =====================================================
  describe('IconifySearchResult interface', () => {
    test('debe tener campos prefix y name', () => {
      const result: IconifySearchResult = {
        prefix: 'lucide',
        name: 'arrow-right'
      };
      
      expect(result.prefix).toBe('lucide');
      expect(result.name).toBe('arrow-right');
    });

    test('debe permitir diferentes colecciones', () => {
      const collections: IconifySearchResult[] = [
        { prefix: 'lucide', name: 'home' },
        { prefix: 'heroicons', name: 'home' },
        { prefix: 'tabler', name: 'home' },
        { prefix: 'mdi', name: 'home' },
        { prefix: 'ph', name: 'house' },
        { prefix: 'carbon', name: 'home' }
      ];
      
      expect(collections).toHaveLength(6);
      expect(collections.every(c => c.prefix && c.name)).toBe(true);
    });
  });
});
