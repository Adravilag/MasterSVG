/**
 * License Service for Iconify icons
 * Generates license files for icons imported from Iconify collections
 */

import * as https from 'https';
import * as path from 'path';
import * as fs from 'fs';

/**
 * License information from Iconify collection
 */
export interface LicenseInfo {
  title: string;
  spdx: string;
  url?: string;
}

/**
 * Author information from Iconify collection
 */
export interface AuthorInfo {
  name: string;
  url?: string;
}

/**
 * Collection metadata from Iconify
 */
export interface CollectionInfo {
  name: string;
  total: number;
  author: AuthorInfo;
  license: LicenseInfo;
  category?: string;
}

/**
 * Icon attribution entry
 */
export interface IconAttribution {
  iconName: string;
  prefix: string;
  collection: string;
  author: AuthorInfo;
  license: LicenseInfo;
}

/**
 * Collections cache
 */
let collectionsCache: Record<string, CollectionInfo> | null = null;

/**
 * Fetch all collections from Iconify API
 */
export async function fetchCollections(): Promise<Record<string, CollectionInfo>> {
  if (collectionsCache) {
    return collectionsCache;
  }

  return new Promise((resolve, reject) => {
    const url = 'https://api.iconify.design/collections';

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            collectionsCache = JSON.parse(data);
            resolve(collectionsCache!);
          } else {
            reject(new Error(`Failed to fetch collections: ${res.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Get collection info by prefix
 */
export async function getCollectionInfo(prefix: string): Promise<CollectionInfo | null> {
  const collections = await fetchCollections();
  return collections[prefix] || null;
}

/**
 * Parse icon name to extract Iconify prefix
 * Icons from Iconify are typically named as "prefix-name" (e.g., "mdi-home", "fa-star")
 */
export function parseIconifyName(iconName: string): { prefix: string; name: string } | null {
  // Common Iconify prefixes - sorted by length (longest first) to match properly
  const knownPrefixes = [
    // Multi-segment prefixes (must come first)
    'material-symbols-light', 'material-symbols',
    'icon-park-outline', 'icon-park-solid', 'icon-park-twotone', 'icon-park',
    'fluent-emoji-flat', 'fluent-emoji-high-contrast', 'fluent-emoji', 'fluent-color',
    'fa-solid', 'fa-regular', 'fa-brands', 'fa6-solid', 'fa6-regular', 'fa6-brands',
    'fa7-solid', 'fa7-regular', 'fa7-brands',
    'simple-icons', 'skill-icons', 'circle-flags', 'game-icons',
    'ant-design', 'eos-icons', 'grommet-icons', 'radix-icons',
    'vscode-icons', 'akar-icons', 'system-uicons',
    'pepicons-pop', 'pepicons-print', 'pepicons-pencil',
    'lets-icons', 'line-md', 'mdi-light',
    // Single-segment prefixes
    'mdi', 'fa', 'fa6', 'fa7', 'ph', 'ri', 'bi', 'ic',
    'tabler', 'lucide', 'heroicons', 'carbon', 'ion', 'fluent',
    'octicon', 'codicon', 'logos', 'devicon', 'noto', 'twemoji',
    'openmoji', 'flag', 'wi', 'healthicons',
    'ep', 'bx', 'bxs', 'bxl', 'cil', 'cib', 'cif',
    'iconoir', 'mingcute', 'solar', 'uil', 'uis', 'uim', 'uit',
    'feather', 'eva', 'prime', 'gridicons', 'jam', 'ci',
    'clarity', 'f7', 'fe', 'gg', 'la',
    'majesticons', 'memory', 'mi', 'maki', 'mynaui', 'nimbus', 'nrk',
    'ooui', 'pajamas', 'pixelarticons', 'proicons', 'quill',
    'si', 'subway', 'tdesign', 'teenyicons', 'typcn',
    'vaadin', 'whh', 'zondicons', 'streamline', 'hugeicons'
  ];

  // Try to match known prefix (already sorted by length)
  for (const prefix of knownPrefixes) {
    if (iconName.startsWith(`${prefix}-`)) {
      return {
        prefix,
        name: iconName.substring(prefix.length + 1)
      };
    }
  }

  // Try generic pattern: first segment before hyphen
  const match = iconName.match(/^([a-z0-9]+)-(.+)$/i);
  if (match) {
    return {
      prefix: match[1],
      name: match[2]
    };
  }

  return null;
}

/**
 * Get license info synchronously from cache only (for synchronous rendering)
 * Returns null if cache not loaded - use getIconLicenseInfo for async fetch
 */
export function getIconLicenseInfoSync(prefix: string): {
  name?: string;
  author?: AuthorInfo;
  license?: LicenseInfo;
} | null {
  if (collectionsCache && collectionsCache[prefix]) {
    const info = collectionsCache[prefix];
    return {
      name: info.name,
      author: info.author,
      license: info.license
    };
  }
  return null;
}

/**
 * Get license info for a single icon (for hover display)
 * Returns cached data if available, otherwise fetches from API
 */
export async function getIconLicenseInfo(iconName: string): Promise<{
  isIconify: boolean;
  collection?: string;
  author?: AuthorInfo;
  license?: LicenseInfo;
} | null> {
  const parsed = parseIconifyName(iconName);
  if (!parsed) {
    return { isIconify: false };
  }

  const { prefix } = parsed;
  
  // Check cache first
  if (collectionsCache && collectionsCache[prefix]) {
    const info = collectionsCache[prefix];
    return {
      isIconify: true,
      collection: info.name,
      author: info.author,
      license: info.license
    };
  }

  // Try to fetch from API
  try {
    const collections = await fetchCollections();
    if (collections[prefix]) {
      return {
        isIconify: true,
        collection: collections[prefix].name,
        author: collections[prefix].author,
        license: collections[prefix].license
      };
    }
  } catch {
    // API not available, return basic info
  }

  // Unknown prefix - might be Iconify but we don't have info
  return {
    isIconify: true,
    collection: prefix // Use prefix as collection name
  };
}

/**
 * Scan icons.js file to find imported Iconify icons
 */
export async function scanIconsForAttribution(iconsPath: string): Promise<IconAttribution[]> {
  const attributions: IconAttribution[] = [];
  
  if (!fs.existsSync(iconsPath)) {
    return attributions;
  }

  const content = fs.readFileSync(iconsPath, 'utf-8');
  
  // Extract icon names from the file
  const namePattern = /name:\s*['"]([^'"]+)['"]/g;
  let match;
  const iconNames: string[] = [];
  
  while ((match = namePattern.exec(content)) !== null) {
    iconNames.push(match[1]);
  }

  // Get collection info for each icon
  const collections = await fetchCollections();
  const processedPrefixes = new Set<string>();

  for (const iconName of iconNames) {
    const parsed = parseIconifyName(iconName);
    if (!parsed) continue;

    const { prefix, name } = parsed;
    
    // Skip if we already processed this prefix (for efficiency)
    if (processedPrefixes.has(prefix)) {
      const existingAttribution = attributions.find(a => a.prefix === prefix);
      if (existingAttribution) {
        continue; // Collection already added
      }
    }

    const collectionInfo = collections[prefix];
    if (collectionInfo) {
      processedPrefixes.add(prefix);
      attributions.push({
        iconName,
        prefix,
        collection: collectionInfo.name,
        author: collectionInfo.author,
        license: collectionInfo.license
      });
    }
  }

  return attributions;
}

/**
 * Group attributions by collection
 */
export function groupByCollection(attributions: IconAttribution[]): Map<string, IconAttribution[]> {
  const grouped = new Map<string, IconAttribution[]>();

  for (const attr of attributions) {
    const key = attr.prefix;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(attr);
  }

  return grouped;
}

/**
 * Generate license markdown content for a collection
 */
function generateCollectionLicense(
  prefix: string,
  attributions: IconAttribution[],
  allIconNames: string[]
): string {
  const first = attributions[0];
  const iconCount = allIconNames.filter(name => {
    const parsed = parseIconifyName(name);
    return parsed?.prefix === prefix;
  }).length;

  let content = `# ${first.collection}\n\n`;
  content += `## License Information\n\n`;
  content += `- **License**: ${first.license.title} (${first.license.spdx})\n`;
  if (first.license.url) {
    content += `- **License URL**: ${first.license.url}\n`;
  }
  content += `\n## Author\n\n`;
  content += `- **Name**: ${first.author.name}\n`;
  if (first.author.url) {
    content += `- **URL**: ${first.author.url}\n`;
  }
  content += `\n## Icons Used (${iconCount})\n\n`;
  
  // List all icons from this collection
  const iconsFromCollection = allIconNames.filter(name => {
    const parsed = parseIconifyName(name);
    return parsed?.prefix === prefix;
  });

  for (const iconName of iconsFromCollection) {
    content += `- \`${iconName}\`\n`;
  }

  content += `\n---\n`;
  content += `*This file was auto-generated by SageBox Icon Studio*\n`;

  return content;
}

/**
 * Generate combined license file content
 */
export function generateCombinedLicense(
  attributions: IconAttribution[],
  allIconNames: string[]
): string {
  const grouped = groupByCollection(attributions);
  
  let content = `# Icon Licenses\n\n`;
  content += `This file contains license information for icons imported from Iconify.\n\n`;
  content += `---\n\n`;

  for (const [prefix, attrs] of grouped) {
    const first = attrs[0];
    const iconCount = allIconNames.filter(name => {
      const parsed = parseIconifyName(name);
      return parsed?.prefix === prefix;
    }).length;

    content += `## ${first.collection}\n\n`;
    content += `| Field | Value |\n`;
    content += `|-------|-------|\n`;
    content += `| **License** | ${first.license.title} (${first.license.spdx}) |\n`;
    content += `| **Author** | ${first.author.name} |\n`;
    if (first.author.url) {
      content += `| **Author URL** | [${first.author.url}](${first.author.url}) |\n`;
    }
    if (first.license.url) {
      content += `| **License URL** | [${first.license.url}](${first.license.url}) |\n`;
    }
    content += `| **Icons Used** | ${iconCount} |\n`;
    content += `\n`;
    
    // List icons
    const iconsFromCollection = allIconNames.filter(name => {
      const parsed = parseIconifyName(name);
      return parsed?.prefix === prefix;
    });
    
    if (iconsFromCollection.length <= 10) {
      content += `**Icons**: ${iconsFromCollection.map(i => `\`${i}\``).join(', ')}\n\n`;
    } else {
      content += `<details>\n<summary>Show ${iconsFromCollection.length} icons</summary>\n\n`;
      for (const iconName of iconsFromCollection) {
        content += `- \`${iconName}\`\n`;
      }
      content += `\n</details>\n\n`;
    }
    
    content += `---\n\n`;
  }

  content += `\n*This file was auto-generated by SageBox Icon Studio on ${new Date().toISOString().split('T')[0]}*\n`;

  return content;
}

/**
 * Generate license files for Iconify icons
 */
export async function generateLicenseFiles(
  outputPath: string,
  options: {
    combined?: boolean;
    perCollection?: boolean;
    licensesFolder?: string;
  } = { combined: true, perCollection: false, licensesFolder: 'icon-licenses' }
): Promise<{ success: boolean; files: string[]; message: string }> {
  const iconsPath = path.join(outputPath, 'icons.js');
  
  if (!fs.existsSync(iconsPath)) {
    return {
      success: false,
      files: [],
      message: 'No icons.js file found. Build your icons first.'
    };
  }

  // Scan for Iconify icons
  const attributions = await scanIconsForAttribution(iconsPath);
  
  if (attributions.length === 0) {
    return {
      success: false,
      files: [],
      message: 'No Iconify icons detected in icons.js. License generation is only for icons imported from Iconify.'
    };
  }

  // Get all icon names
  const content = fs.readFileSync(iconsPath, 'utf-8');
  const namePattern = /name:\s*['"]([^'"]+)['"]/g;
  const allIconNames: string[] = [];
  let match;
  while ((match = namePattern.exec(content)) !== null) {
    allIconNames.push(match[1]);
  }

  // Create licenses directory (use configured folder name)
  const folderName = options.licensesFolder || 'icon-licenses';
  const licensesPath = path.join(outputPath, folderName);
  if (!fs.existsSync(licensesPath)) {
    fs.mkdirSync(licensesPath, { recursive: true });
  }

  const createdFiles: string[] = [];
  const grouped = groupByCollection(attributions);

  // Generate combined license file
  if (options.combined !== false) {
    const combinedContent = generateCombinedLicense(attributions, allIconNames);
    const combinedPath = path.join(licensesPath, 'LICENSES.md');
    fs.writeFileSync(combinedPath, combinedContent);
    createdFiles.push(combinedPath);
  }

  // Generate per-collection license files
  if (options.perCollection) {
    for (const [prefix, attrs] of grouped) {
      const collectionContent = generateCollectionLicense(prefix, attrs, allIconNames);
      const collectionPath = path.join(licensesPath, `LICENSE-${prefix}.md`);
      fs.writeFileSync(collectionPath, collectionContent);
      createdFiles.push(collectionPath);
    }
  }

  const collectionCount = grouped.size;
  const iconCount = allIconNames.filter(name => parseIconifyName(name) !== null).length;

  return {
    success: true,
    files: createdFiles,
    message: `Generated license files for ${iconCount} icons from ${collectionCount} collection(s).`
  };
}

/**
 * Get license summary for display
 */
export async function getLicenseSummary(outputPath: string): Promise<{
  collections: Array<{
    prefix: string;
    name: string;
    license: string;
    iconCount: number;
  }>;
  totalIcons: number;
}> {
  const iconsPath = path.join(outputPath, 'icons.js');
  
  if (!fs.existsSync(iconsPath)) {
    return { collections: [], totalIcons: 0 };
  }

  const attributions = await scanIconsForAttribution(iconsPath);
  const grouped = groupByCollection(attributions);

  // Get all icon names
  const content = fs.readFileSync(iconsPath, 'utf-8');
  const namePattern = /name:\s*['"]([^'"]+)['"]/g;
  const allIconNames: string[] = [];
  let match;
  while ((match = namePattern.exec(content)) !== null) {
    allIconNames.push(match[1]);
  }

  const collections = [];
  let totalIcons = 0;

  for (const [prefix, attrs] of grouped) {
    const first = attrs[0];
    const iconCount = allIconNames.filter(name => {
      const parsed = parseIconifyName(name);
      return parsed?.prefix === prefix;
    }).length;
    
    collections.push({
      prefix,
      name: first.collection,
      license: first.license.title,
      iconCount
    });
    
    totalIcons += iconCount;
  }

  return { collections, totalIcons };
}
