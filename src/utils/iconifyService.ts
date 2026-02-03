import * as https from 'https';
import {
  IconifySearchResult as CentralizedIconifySearchResult,
  IconifySearchResultExtended as CentralizedIconifySearchResultExtended,
  IconifySearchOptions as CentralizedIconifySearchOptions,
  IconifyIconSet as CentralizedIconifyIconSet,
  IconifyCollection as CentralizedIconifyCollection,
} from '../services/types/mastersvgTypes';

// Re-export for backwards compatibility
export type IconifySearchResult = CentralizedIconifySearchResult;
export type IconifySearchResultExtended = CentralizedIconifySearchResultExtended;
export type IconifySearchOptions = CentralizedIconifySearchOptions;
export type IconifyIconSet = CentralizedIconifyIconSet;
export type IconifyCollection = CentralizedIconifyCollection;

/**
 * Cache for search results and collections
 */
const searchCache = new Map<string, { data: IconifySearchResult[]; timestamp: number }>();
const collectionsCache: { data: Record<string, IconifyCollection> | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Popular icon collections for quick access
 */
export const POPULAR_COLLECTIONS = [
  { prefix: 'mdi', name: 'Material Design Icons', total: 7000 },
  { prefix: 'lucide', name: 'Lucide', total: 1500 },
  { prefix: 'heroicons', name: 'Heroicons', total: 300 },
  { prefix: 'tabler', name: 'Tabler Icons', total: 5000 },
  { prefix: 'ph', name: 'Phosphor', total: 9000 },
  { prefix: 'ri', name: 'Remix Icon', total: 2800 },
  { prefix: 'carbon', name: 'Carbon', total: 2000 },
  { prefix: 'fluent', name: 'Fluent UI', total: 4500 },
  { prefix: 'ic', name: 'Google Material Icons', total: 2500 },
  { prefix: 'bi', name: 'Bootstrap Icons', total: 2000 },
];

/**
 * Generate cache key for search
 */
function getSearchCacheKey(query: string, options?: IconifySearchOptions): string {
  return `${query}:${options?.limit || 50}:${options?.prefixes?.join(',') || ''}:${options?.category || ''}`;
}

/**
 * Search for icons on Iconify API with caching
 */
export async function searchIconify(
  query: string,
  limitOrOptions: number | IconifySearchOptions = 50
): Promise<IconifySearchResult[]> {
  const options: IconifySearchOptions =
    typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions;

  const cacheKey = getSearchCacheKey(query, options);
  const cached = searchCache.get(cacheKey);

  // Return cached results if valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  return new Promise((resolve, reject) => {
    let url = `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=${options.limit || 50}`;

    if (options.prefixes?.length) {
      url += `&prefixes=${options.prefixes.join(',')}`;
    }
    if (options.category) {
      url += `&category=${encodeURIComponent(options.category)}`;
    }

    https
      .get(url, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            const icons: IconifySearchResult[] = [];

            if (result.icons && Array.isArray(result.icons)) {
              for (const iconId of result.icons) {
                const [prefix, name] = iconId.split(':');
                if (prefix && name) {
                  icons.push({ prefix, name });
                }
              }
            }

            // Cache results
            searchCache.set(cacheKey, { data: icons, timestamp: Date.now() });
            resolve(icons);
          } catch (parseError) {
            reject(parseError);
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Search icons from a specific collection
 */
export async function searchInCollection(
  prefix: string,
  query?: string,
  limit: number = 100
): Promise<IconifySearchResult[]> {
  if (query) {
    return searchIconify(query, { limit, prefixes: [prefix] });
  }

  // If no query, get icons from the collection
  return new Promise(resolve => {
    const url = `https://api.iconify.design/collection?prefix=${prefix}&info=true&chars=true`;

    https
      .get(url, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const result = JSON.parse(data);
              const icons: IconifySearchResult[] = [];

              // Get icons from uncategorized or all categories
              if (result.uncategorized) {
                for (const name of result.uncategorized.slice(0, limit)) {
                  icons.push({ prefix, name });
                }
              } else if (result.categories) {
                for (const category of Object.values(result.categories) as string[][]) {
                  for (const name of category) {
                    if (icons.length >= limit) break;
                    icons.push({ prefix, name });
                  }
                  if (icons.length >= limit) break;
                }
              }

              resolve(icons);
            } else {
              resolve([]);
            }
          } catch {
            resolve([]);
          }
        });
      })
      .on('error', () => resolve([]));
  });
}

/**
 * Clear search cache
 */
export function clearSearchCache(): void {
  searchCache.clear();
}

/**
 * Clear collections cache
 */
export function clearCollectionsCache(): void {
  collectionsCache.data = null;
  collectionsCache.timestamp = 0;
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  clearSearchCache();
  clearCollectionsCache();
}

/**
 * Fetch SVG content for a specific icon from Iconify
 */
export async function fetchIconSvg(
  prefix: string,
  name: string,
  color?: string
): Promise<string | null> {
  return new Promise(resolve => {
    let url = `https://api.iconify.design/${prefix}/${name}.svg`;
    if (color) {
      url += `?color=${encodeURIComponent(color)}`;
    }

    https
      .get(url, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200 && data.includes('<svg')) {
            resolve(data);
          } else {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });
}

/**
 * Get icon info from Iconify
 */
export async function getIconInfo(prefix: string, name: string): Promise<IconifyIconSet | null> {
  return new Promise(resolve => {
    const url = `https://api.iconify.design/${prefix}.json?icons=${name}`;

    https
      .get(url, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });
}

/**
 * Get available icon collections from Iconify with caching
 */
export async function getCollections(): Promise<Record<string, IconifyCollection> | null> {
  // Return cached collections if valid
  if (collectionsCache.data && Date.now() - collectionsCache.timestamp < CACHE_TTL) {
    return collectionsCache.data;
  }

  return new Promise(resolve => {
    const url = 'https://api.iconify.design/collections';

    https
      .get(url, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const collections = JSON.parse(data);
              collectionsCache.data = collections;
              collectionsCache.timestamp = Date.now();
              resolve(collections);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });
}

/**
 * Get collections grouped by category
 */
export async function getCollectionsByCategory(): Promise<
  Record<string, Array<{ prefix: string } & IconifyCollection>> | null
> {
  const collections = await getCollections();
  if (!collections) return null;

  const grouped: Record<string, Array<{ prefix: string } & IconifyCollection>> = {};

  for (const [prefix, info] of Object.entries(collections)) {
    const category = info.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({ prefix, ...info });
  }

  // Sort collections within each category by total icons
  for (const category of Object.keys(grouped)) {
    grouped[category].sort((a, b) => (b.total || 0) - (a.total || 0));
  }

  return grouped;
}

/**
 * Get popular collections with full info
 */
export async function getPopularCollections(): Promise<
  Array<{ prefix: string } & IconifyCollection>
> {
  const collections = await getCollections();
  if (!collections) {
    // Return default popular collections if API fails
    return POPULAR_COLLECTIONS.map(c => ({
      prefix: c.prefix,
      name: c.name,
      total: c.total,
    }));
  }

  return POPULAR_COLLECTIONS.map(c => ({
    prefix: c.prefix,
    ...collections[c.prefix],
  })).filter(c => c.name);
}
