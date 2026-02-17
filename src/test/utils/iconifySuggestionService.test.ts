/**
 * Tests for IconifySuggestionProvider
 *
 * After refactor: contextTags drive search, colors are for preview only.
 */

jest.mock('../../utils/iconifyService', () => ({
  searchIconify: jest.fn(),
  fetchIconSvg: jest.fn(),
  getIconInfo: jest.fn(),
}));

import { IconifySuggestionProvider } from '../../utils/iconifySuggestionService';
import { searchIconify, fetchIconSvg, getIconInfo } from '../../utils/iconifyService';

const mockSearch = searchIconify as jest.MockedFunction<typeof searchIconify>;
const mockFetchSvg = fetchIconSvg as jest.MockedFunction<typeof fetchIconSvg>;
const mockGetInfo = getIconInfo as jest.MockedFunction<typeof getIconInfo>;

describe('IconifySuggestionProvider', () => {
  let provider: IconifySuggestionProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new IconifySuggestionProvider();

    // Default mocks
    mockSearch.mockResolvedValue([
      { prefix: 'mdi', name: 'heart' },
      { prefix: 'mdi', name: 'stethoscope' },
    ]);
    mockFetchSvg.mockResolvedValue('<svg>mock</svg>');
    mockGetInfo.mockResolvedValue({
      prefix: 'mdi',
      icons: {},
      info: { name: 'Material Design Icons', total: 7000, license: { title: 'MIT', spdx: 'MIT' } },
    } as any);
  });

  it('should return empty array when no contextTags provided', async () => {
    const result = await provider.suggest({ colors: ['#0066ff'], contextTags: [], limit: 5 });
    expect(result).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('should return empty when colors are given but no contextTags', async () => {
    const result = await provider.suggest({ colors: ['#ff0000'], limit: 5 });
    expect(result).toEqual([]);
  });

  it('should search Iconify using contextTags, not colors', async () => {
    await provider.suggest({
      colors: ['#0066ff'],
      contextTags: ['health', 'clinic'],
      limit: 5,
    });

    // Should search by contextTags
    expect(mockSearch).toHaveBeenCalledWith('health', expect.any(Object));
    expect(mockSearch).toHaveBeenCalledWith('clinic', expect.any(Object));
    // Should NOT search by color names or color-derived tags
    const allCalls = mockSearch.mock.calls.map(c => c[0]);
    expect(allCalls).not.toContain('blue');
    expect(allCalls).not.toContain('water');
    expect(allCalls).not.toContain('medical');
  });

  it('should return suggestions when contextTags are provided', async () => {
    const result = await provider.suggest({
      contextTags: ['health'],
      limit: 5,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(mockSearch).toHaveBeenCalledWith('health', expect.any(Object));
  });

  it('should include enrichment data (previewSvg, collection, license, ariaLabel)', async () => {
    const result = await provider.suggest({
      contextTags: ['health'],
      colors: ['#ff0000'],
      limit: 2,
    });

    expect(result.length).toBeGreaterThan(0);
    const first = result[0];
    expect(first.previewSvg).toBe('<svg>mock</svg>');
    expect(first.collection).toBe('Material Design Icons');
    expect(first.license).toBe('MIT');
    expect(first.ariaLabel).toBeDefined();
  });

  it('should pass colors into matchingColors for preview', async () => {
    const colors = ['#ff0000', '#00ff00'];
    const result = await provider.suggest({
      contextTags: ['medical'],
      colors,
      limit: 2,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].matchingColors).toEqual(colors);
  });

  it('should deduplicate icons found across multiple tags', async () => {
    mockSearch.mockResolvedValue([{ prefix: 'mdi', name: 'heart' }]);

    const result = await provider.suggest({
      contextTags: ['love', 'health'],
      limit: 10,
    });

    const hearts = result.filter(r => r.name === 'heart');
    expect(hearts.length).toBe(1);
  });

  it('should accumulate score when icon matches multiple tags', async () => {
    // Same icon returned for both tags
    mockSearch.mockResolvedValue([{ prefix: 'mdi', name: 'heart' }]);

    const singleTag = await provider.suggest({ contextTags: ['love'], limit: 10 });
    const multiTag = await provider.suggest({ contextTags: ['love', 'health'], limit: 10 });

    const scoreSingle = singleTag.find(r => r.name === 'heart')?.score ?? 0;
    const scoreMulti = multiTag.find(r => r.name === 'heart')?.score ?? 0;
    expect(scoreMulti).toBeGreaterThan(scoreSingle);
  });

  it('should score higher when icon name matches tag', async () => {
    mockSearch.mockImplementation(async (query) => {
      if (query === 'hospital') return [{ prefix: 'mdi', name: 'hospital' }];
      return [{ prefix: 'mdi', name: 'random-icon' }];
    });

    const result = await provider.suggest({
      contextTags: ['hospital', 'nature'],
      limit: 10,
    });

    const hospital = result.find(r => r.name === 'hospital');
    const random = result.find(r => r.name === 'random-icon');
    expect(hospital).toBeDefined();
    expect(random).toBeDefined();
    if (hospital && random) {
      expect(hospital.score).toBeGreaterThan(random.score);
    }
  });

  it('should handle API failures gracefully', async () => {
    mockSearch.mockRejectedValue(new Error('Network error'));

    const result = await provider.suggest({
      contextTags: ['health'],
      limit: 5,
    });

    expect(result).toEqual([]);
  });

  it('should respect the limit option', async () => {
    mockSearch.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({ prefix: 'mdi', name: `icon-${i}` }))
    );

    const result = await provider.suggest({
      contextTags: ['dashboard'],
      limit: 5,
    });

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('should generate ariaLabel from icon name and tags', async () => {
    mockSearch.mockResolvedValue([{ prefix: 'mdi', name: 'heart-pulse' }]);

    const result = await provider.suggest({
      contextTags: ['health'],
      limit: 1,
    });

    expect(result[0].ariaLabel).toContain('heart pulse');
  });
});
