import * as https from 'https';

export interface IconifySearchResult {
  prefix: string;
  name: string;
}

/**
 * Search for icons on Iconify API
 */
export async function searchIconify(query: string, limit: number = 50): Promise<IconifySearchResult[]> {
  return new Promise((resolve, reject) => {
    const url = `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=${limit}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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

          resolve(icons);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Fetch SVG content for a specific icon from Iconify
 */
export async function fetchIconSvg(prefix: string, name: string, color?: string): Promise<string | null> {
  return new Promise((resolve) => {
    let url = `https://api.iconify.design/${prefix}/${name}.svg`;
    if (color) {
      url += `?color=${encodeURIComponent(color)}`;
    }

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 && data.includes('<svg')) {
          resolve(data);
        } else {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Iconify icon set response
 */
export interface IconifyIconSet {
  prefix: string;
  icons: Record<string, { body: string; width?: number; height?: number }>;
  width?: number;
  height?: number;
}

/**
 * Get icon info from Iconify
 */
export async function getIconInfo(prefix: string, name: string): Promise<IconifyIconSet | null> {
  return new Promise((resolve) => {
    const url = `https://api.iconify.design/${prefix}.json?icons=${name}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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
    }).on('error', () => resolve(null));
  });
}

/**
 * Iconify collection info
 */
export interface IconifyCollection {
  name: string;
  total: number;
  author?: { name: string; url?: string };
  license?: { title: string; spdx?: string; url?: string };
  samples?: string[];
  category?: string;
}

/**
 * Get available icon collections from Iconify
 */
export async function getCollections(): Promise<Record<string, IconifyCollection> | null> {
  return new Promise((resolve) => {
    const url = 'https://api.iconify.design/collections';

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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
    }).on('error', () => resolve(null));
  });
}

