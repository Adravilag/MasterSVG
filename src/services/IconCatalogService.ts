import * as vscode from 'vscode';
import * as https from 'https';
import * as path from 'path';
import * as fs from 'fs';

// Icon collection metadata
export interface IconCollection {
  id: string;
  name: string;
  license: string;
  licenseUrl: string;
  website: string;
  description: string;
  totalIcons: number;
  style: 'outline' | 'solid' | 'mixed';
}

// Icon from catalog
export interface CatalogIcon {
  name: string;
  collection: string;
  svg: string;
  tags?: string[];
  category?: string;
}

// Icon with full metadata (when added to project)
export interface IconWithMetadata extends CatalogIcon {
  addedAt: number;
  license: string;
  licenseUrl: string;
  collectionName: string;
}

// Collections registry
export const ICON_COLLECTIONS: Record<string, IconCollection> = {
  lucide: {
    id: 'lucide',
    name: 'Lucide Icons',
    license: 'ISC',
    licenseUrl: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE',
    website: 'https://lucide.dev',
    description: 'Beautiful & consistent icons. Community-driven fork of Feather Icons.',
    totalIcons: 1400,
    style: 'outline'
  },
  heroicons: {
    id: 'heroicons',
    name: 'Heroicons',
    license: 'MIT',
    licenseUrl: 'https://github.com/tailwindlabs/heroicons/blob/master/LICENSE',
    website: 'https://heroicons.com',
    description: 'Beautiful hand-crafted SVG icons, by the makers of Tailwind CSS.',
    totalIcons: 580,
    style: 'mixed'
  },
  tabler: {
    id: 'tabler',
    name: 'Tabler Icons',
    license: 'MIT',
    licenseUrl: 'https://github.com/tabler/tabler-icons/blob/master/LICENSE',
    website: 'https://tabler-icons.io',
    description: 'Over 4200 pixel-perfect icons for web design.',
    totalIcons: 4200,
    style: 'outline'
  },
  bootstrap: {
    id: 'bootstrap',
    name: 'Bootstrap Icons',
    license: 'MIT',
    licenseUrl: 'https://github.com/twbs/icons/blob/main/LICENSE',
    website: 'https://icons.getbootstrap.com',
    description: 'Official open source SVG icon library for Bootstrap.',
    totalIcons: 2000,
    style: 'mixed'
  },
  'material-design': {
    id: 'material-design',
    name: 'Material Design Icons',
    license: 'Apache-2.0',
    licenseUrl: 'https://github.com/google/material-design-icons/blob/master/LICENSE',
    website: 'https://fonts.google.com/icons',
    description: 'Material Design icons by Google.',
    totalIcons: 2500,
    style: 'mixed'
  },
  phosphor: {
    id: 'phosphor',
    name: 'Phosphor Icons',
    license: 'MIT',
    licenseUrl: 'https://github.com/phosphor-icons/core/blob/main/LICENSE',
    website: 'https://phosphoricons.com',
    description: 'Flexible icon family for interfaces, diagrams, presentations.',
    totalIcons: 1200,
    style: 'mixed'
  }
};

// License text templates
const LICENSE_TEXTS: Record<string, string> = {
  'MIT': `MIT License

Copyright (c) {year} {author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,

  'ISC': `ISC License

Copyright (c) {year} {author}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`,

  'Apache-2.0': `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`
};

export class IconCatalogService {
  private cache: Map<string, CatalogIcon[]> = new Map();
  private usedIcons: Map<string, IconWithMetadata> = new Map();
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadUsedIcons();
  }

  // Get all collections
  getCollections(): IconCollection[] {
    return Object.values(ICON_COLLECTIONS);
  }

  // Get collection by ID
  getCollection(id: string): IconCollection | undefined {
    return ICON_COLLECTIONS[id];
  }

  // Search icons across all collections or specific one
  async searchIcons(query: string, collectionId?: string): Promise<CatalogIcon[]> {
    const results: CatalogIcon[] = [];
    const collections = collectionId 
      ? [collectionId] 
      : Object.keys(ICON_COLLECTIONS);

    for (const colId of collections) {
      try {
        const icons = await this.fetchCollectionIcons(colId);
        const filtered = icons.filter(icon => 
          icon.name.toLowerCase().includes(query.toLowerCase()) ||
          icon.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        );
        results.push(...filtered);
      } catch (error) {
        console.error(`Error searching ${colId}:`, error);
      }
    }

    return results;
  }

  // Fetch icons from a collection (with caching)
  async fetchCollectionIcons(collectionId: string): Promise<CatalogIcon[]> {
    // Check cache first
    if (this.cache.has(collectionId)) {
      return this.cache.get(collectionId)!;
    }

    let icons: CatalogIcon[] = [];

    switch (collectionId) {
      case 'lucide':
        icons = await this.fetchLucideIcons();
        break;
      case 'heroicons':
        icons = await this.fetchHeroicons();
        break;
      case 'tabler':
        icons = await this.fetchTablerIcons();
        break;
      case 'bootstrap':
        icons = await this.fetchBootstrapIcons();
        break;
      case 'phosphor':
        icons = await this.fetchPhosphorIcons();
        break;
      default:
        console.warn(`Unknown collection: ${collectionId}`);
    }

    // Cache results
    this.cache.set(collectionId, icons);
    return icons;
  }

  // Fetch Lucide icons
  private async fetchLucideIcons(): Promise<CatalogIcon[]> {
    try {
      // Fetch icon list from Lucide's npm package data
      const tagsData = await this.fetchJson('https://unpkg.com/lucide-static@latest/tags.json');
      const icons: CatalogIcon[] = [];

      for (const [name, tags] of Object.entries(tagsData as Record<string, string[]>)) {
        icons.push({
          name,
          collection: 'lucide',
          svg: '', // Will be fetched on demand
          tags
        });
      }

      return icons;
    } catch (error) {
      console.error('Error fetching Lucide icons:', error);
      return [];
    }
  }

  // Fetch single Lucide icon SVG
  async fetchLucideIconSvg(name: string): Promise<string> {
    const svg = await this.fetchText(`https://unpkg.com/lucide-static@latest/icons/${name}.svg`);
    return svg;
  }

  // Fetch Heroicons
  private async fetchHeroicons(): Promise<CatalogIcon[]> {
    try {
      // Use jsdelivr to get directory listing
      const outlineIcons = await this.fetchGitHubDirectory('tailwindlabs', 'heroicons', 'src/24/outline');
      const solidIcons = await this.fetchGitHubDirectory('tailwindlabs', 'heroicons', 'src/24/solid');

      const icons: CatalogIcon[] = [];
      
      for (const file of outlineIcons) {
        if (file.endsWith('.svg')) {
          icons.push({
            name: file.replace('.svg', '') + '-outline',
            collection: 'heroicons',
            svg: '',
            tags: ['outline']
          });
        }
      }

      for (const file of solidIcons) {
        if (file.endsWith('.svg')) {
          icons.push({
            name: file.replace('.svg', '') + '-solid',
            collection: 'heroicons',
            svg: '',
            tags: ['solid']
          });
        }
      }

      return icons;
    } catch (error) {
      console.error('Error fetching Heroicons:', error);
      return [];
    }
  }

  // Fetch single Heroicon SVG
  async fetchHeroiconSvg(name: string): Promise<string> {
    const isOutline = name.endsWith('-outline');
    const baseName = name.replace(/-outline$|-solid$/, '');
    const style = isOutline ? 'outline' : 'solid';
    const svg = await this.fetchText(
      `https://raw.githubusercontent.com/tailwindlabs/heroicons/master/src/24/${style}/${baseName}.svg`
    );
    return svg;
  }

  // Fetch Tabler icons
  private async fetchTablerIcons(): Promise<CatalogIcon[]> {
    try {
      const files = await this.fetchGitHubDirectory('tabler', 'tabler-icons', 'icons/outline');
      return files
        .filter(f => f.endsWith('.svg'))
        .map(f => ({
          name: f.replace('.svg', ''),
          collection: 'tabler',
          svg: '',
          tags: ['outline']
        }));
    } catch (error) {
      console.error('Error fetching Tabler icons:', error);
      return [];
    }
  }

  // Fetch single Tabler icon SVG
  async fetchTablerIconSvg(name: string): Promise<string> {
    return this.fetchText(
      `https://raw.githubusercontent.com/tabler/tabler-icons/master/icons/outline/${name}.svg`
    );
  }

  // Fetch Bootstrap icons
  private async fetchBootstrapIcons(): Promise<CatalogIcon[]> {
    try {
      const files = await this.fetchGitHubDirectory('twbs', 'icons', 'icons');
      return files
        .filter(f => f.endsWith('.svg'))
        .map(f => ({
          name: f.replace('.svg', ''),
          collection: 'bootstrap',
          svg: '',
          tags: []
        }));
    } catch (error) {
      console.error('Error fetching Bootstrap icons:', error);
      return [];
    }
  }

  // Fetch single Bootstrap icon SVG
  async fetchBootstrapIconSvg(name: string): Promise<string> {
    return this.fetchText(
      `https://raw.githubusercontent.com/twbs/icons/main/icons/${name}.svg`
    );
  }

  // Fetch Phosphor icons
  private async fetchPhosphorIcons(): Promise<CatalogIcon[]> {
    try {
      const files = await this.fetchGitHubDirectory('phosphor-icons', 'core', 'assets/regular');
      return files
        .filter(f => f.endsWith('.svg'))
        .map(f => ({
          name: f.replace('.svg', ''),
          collection: 'phosphor',
          svg: '',
          tags: ['regular']
        }));
    } catch (error) {
      console.error('Error fetching Phosphor icons:', error);
      return [];
    }
  }

  // Fetch single Phosphor icon SVG
  async fetchPhosphorIconSvg(name: string): Promise<string> {
    return this.fetchText(
      `https://raw.githubusercontent.com/phosphor-icons/core/main/assets/regular/${name}.svg`
    );
  }

  // Generic icon SVG fetcher
  async fetchIconSvg(icon: CatalogIcon): Promise<string> {
    switch (icon.collection) {
      case 'lucide':
        return this.fetchLucideIconSvg(icon.name);
      case 'heroicons':
        return this.fetchHeroiconSvg(icon.name);
      case 'tabler':
        return this.fetchTablerIconSvg(icon.name);
      case 'bootstrap':
        return this.fetchBootstrapIconSvg(icon.name);
      case 'phosphor':
        return this.fetchPhosphorIconSvg(icon.name);
      default:
        throw new Error(`Unknown collection: ${icon.collection}`);
    }
  }

  // Add icon to project with metadata
  addIconToProject(icon: CatalogIcon, svg: string): IconWithMetadata {
    const collection = ICON_COLLECTIONS[icon.collection];
    const iconWithMeta: IconWithMetadata = {
      ...icon,
      svg,
      addedAt: Date.now(),
      license: collection.license,
      licenseUrl: collection.licenseUrl,
      collectionName: collection.name
    };

    const key = `${icon.collection}:${icon.name}`;
    this.usedIcons.set(key, iconWithMeta);
    this.saveUsedIcons();

    return iconWithMeta;
  }

  // Get all used icons
  getUsedIcons(): IconWithMetadata[] {
    return Array.from(this.usedIcons.values());
  }

  // Get used icons by collection
  getUsedIconsByCollection(): Map<string, IconWithMetadata[]> {
    const byCollection = new Map<string, IconWithMetadata[]>();
    
    for (const icon of this.usedIcons.values()) {
      const list = byCollection.get(icon.collection) || [];
      list.push(icon);
      byCollection.set(icon.collection, list);
    }

    return byCollection;
  }

  // Generate license files for used icons
  async generateLicenseFiles(workspacePath: string): Promise<string[]> {
    const byCollection = this.getUsedIconsByCollection();
    const generatedFiles: string[] = [];
    const licensesDir = path.join(workspacePath, 'icon-licenses');

    // Create directory
    if (!fs.existsSync(licensesDir)) {
      fs.mkdirSync(licensesDir, { recursive: true });
    }

    // Generate license file for each collection used
    for (const [collectionId, icons] of byCollection) {
      const collection = ICON_COLLECTIONS[collectionId];
      if (!collection) continue;

      const licenseText = LICENSE_TEXTS[collection.license] || `See ${collection.licenseUrl}`;
      const year = new Date().getFullYear();
      
      // Replace placeholders
      const finalLicense = licenseText
        .replace('{year}', year.toString())
        .replace('{author}', collection.name);

      const licenseFile = path.join(licensesDir, `LICENSE-${collectionId}.txt`);
      fs.writeFileSync(licenseFile, `${collection.name}\n${'='.repeat(collection.name.length)}\n\n${finalLicense}`);
      generatedFiles.push(licenseFile);
    }

    // Generate ATTRIBUTION.md
    const attributionContent = this.generateAttributionMarkdown(byCollection);
    const attributionFile = path.join(licensesDir, 'ATTRIBUTION.md');
    fs.writeFileSync(attributionFile, attributionContent);
    generatedFiles.push(attributionFile);

    return generatedFiles;
  }

  // Generate attribution markdown
  private generateAttributionMarkdown(byCollection: Map<string, IconWithMetadata[]>): string {
    let content = `# Icon Attribution\n\n`;
    content += `This project uses icons from the following open-source icon collections:\n\n`;

    for (const [collectionId, icons] of byCollection) {
      const collection = ICON_COLLECTIONS[collectionId];
      if (!collection) continue;

      content += `## ${collection.name}\n\n`;
      content += `- **Website:** ${collection.website}\n`;
      content += `- **License:** ${collection.license} ([View License](${collection.licenseUrl}))\n`;
      content += `- **Icons used:** ${icons.length}\n\n`;
      content += `### Icons from this collection:\n\n`;
      
      icons.forEach(icon => {
        content += `- \`${icon.name}\`\n`;
      });
      
      content += `\n---\n\n`;
    }

    content += `\n*Generated by Icon Manager VS Code Extension on ${new Date().toISOString().split('T')[0]}*\n`;

    return content;
  }

  // Save used icons to storage
  private saveUsedIcons(): void {
    const data = Array.from(this.usedIcons.entries());
    this.context.globalState.update('usedIcons', data);
  }

  // Load used icons from storage
  private loadUsedIcons(): void {
    const data = this.context.globalState.get<[string, IconWithMetadata][]>('usedIcons', []);
    this.usedIcons = new Map(data);
  }

  // Clear used icons
  clearUsedIcons(): void {
    this.usedIcons.clear();
    this.saveUsedIcons();
  }

  // Helper: Fetch JSON
  private fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  // Helper: Fetch text
  private fetchText(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          return this.fetchText(res.headers.location!).then(resolve).catch(reject);
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  // Helper: Fetch GitHub directory listing
  private async fetchGitHubDirectory(owner: string, repo: string, path: string): Promise<string[]> {
    try {
      const data = await this.fetchJson(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
      );
      return data.map((item: any) => item.name);
    } catch (error) {
      console.error(`Error fetching GitHub directory ${owner}/${repo}/${path}:`, error);
      return [];
    }
  }
}
