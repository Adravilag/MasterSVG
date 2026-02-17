import {
  IconSuggestion,
  IconSuggestionOptions,
  IconSuggestionProvider,
  IconifyIconSet,
  IconifyCollection,
} from '../services/types/mastersvgTypes';
import { searchIconify, getIconInfo, fetchIconSvg } from './iconifyService';

/** Respuesta extendida de getIconInfo (puede incluir info de colección) */
interface IconifyIconSetWithInfo extends IconifyIconSet {
  info?: IconifyCollection;
}

/** --- CONFIGURACIÓN Y TIPOS --- */

const CACHE_TTL_MS = 300_000; // 5 minutos

/** --- GESTIÓN DE CACHÉ --- */

type CacheEntry<T> = { data: T; ts: number };

class SuggestionCache {
  private static readonly svgMap = new Map<string, CacheEntry<string | null>>();
  private static readonly infoMap = new Map<string, CacheEntry<IconifyIconSetWithInfo | null>>();

  static getSvg(key: string): string | null | undefined {
    const entry = this.svgMap.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
    return undefined;
  }

  static setSvg(key: string, data: string | null): void {
    this.svgMap.set(key, { data, ts: Date.now() });
  }

  static getInfo(key: string): IconifyIconSetWithInfo | null | undefined {
    const entry = this.infoMap.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
    return undefined;
  }

  static setInfo(key: string, data: IconifyIconSetWithInfo | null): void {
    this.infoMap.set(key, { data, ts: Date.now() });
  }
}

/** --- PROVEEDOR PRINCIPAL --- */

export class IconifySuggestionProvider implements IconSuggestionProvider {

  /**
   * Suggest icons based on contextTags (search) and colors (preview tinting only).
   * Colors are NOT used for search queries — they are stored on results for UI preview.
   */
  public async suggest(options: IconSuggestionOptions): Promise<IconSuggestion[]> {
    const { contextTags = [], colors = [], limit = 12 } = options;

    if (contextTags.length === 0) return [];

    const uniqueTags = Array.from(new Set(contextTags.map(t => t.toLowerCase().trim()).filter(Boolean)));

    const iconsByTag = await this.performConcurrentSearch(uniqueTags, limit);

    const iconMap = this.processAndScoreIcons(iconsByTag, uniqueTags);

    const topIcons = Array.from(iconMap.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);

    return Promise.all(topIcons.map(icon => this.enrichIcon(icon, colors)));
  }

  private async performConcurrentSearch(tags: string[], limit: number): Promise<IconSuggestion[][]> {
    const perTagLimit = Math.max(6, Math.ceil(limit / tags.length));

    return Promise.all(
      tags.map(async (tag) => {
        try {
          const results = await searchIconify(tag, { limit: perTagLimit });
          // Transformamos IconifySearchResult a IconSuggestion inmediatamente
          return results.map(icon => ({
            ...icon,
            score: 0, // Inicializamos el score obligatorio
            tags: [tag]
          }));
        } catch {
          return []; // En caso de error devolvemos array vacío (tipo IconSuggestion[])
        }
      })
    );
  }

  private processAndScoreIcons(
    resultsByTag: IconSuggestion[][],
    searchTags: string[]
  ): Map<string, IconSuggestion> {
    const iconMap = new Map<string, IconSuggestion>();

    resultsByTag.forEach((icons, index) => {
      const currentTag = searchTags[index];
      icons.forEach(icon => {
        const id = `${icon.prefix}:${icon.name}`;
        const tagScore = this.calculateTagScore(icon.name, currentTag);

        const existing = iconMap.get(id);
        if (existing) {
          // Accumulate: each additional tag match adds score
          iconMap.set(id, {
            ...existing,
            score: Math.min((existing.score || 0) + tagScore, 1),
            tags: Array.from(new Set([...(existing.tags || []), currentTag]))
          });
        } else {
          iconMap.set(id, {
            ...icon,
            score: tagScore,
            tags: [currentTag]
          });
        }
      });
    });

    return iconMap;
  }

  /**
   * Score contribution for a single tag match.
   * Scores accumulate across tags — an icon matching 3 tags scores ~3x higher.
   */
  private calculateTagScore(name: string, tag: string): number {
    let score = 0.3; // base per-tag relevance
    if (name.includes(tag)) score += 0.2; // nombre coincide con el tag
    return score;
  }

  /**
   * Enrich icon with preview SVG, collection, license and ariaLabel.
   * Colors are attached for UI preview purposes only.
   */
  private async enrichIcon(icon: IconSuggestion, colors: string[] = []): Promise<IconSuggestion> {
    const key = `${icon.prefix}:${icon.name}`;

    const [svg, info] = await Promise.all([
      this.fetchSvgCached(key, icon.prefix, icon.name),
      this.fetchInfoCached(key, icon.prefix, icon.name),
    ]);

    return {
      ...icon,
      previewSvg: svg || undefined,
      collection: info?.info?.name,
      license: info?.info?.license?.title,
      matchingColors: colors.length > 0 ? colors : undefined,
      ariaLabel: this.formatAriaLabel(icon.name, icon.tags),
    };
  }

  private async fetchSvgCached(key: string, prefix: string, name: string): Promise<string | null> {
    const cached = SuggestionCache.getSvg(key);
    if (cached !== undefined) return cached;
    try {
      const data = await fetchIconSvg(prefix, name);
      SuggestionCache.setSvg(key, data);
      return data;
    } catch {
      return null;
    }
  }

  private async fetchInfoCached(key: string, prefix: string, name: string): Promise<IconifyIconSetWithInfo | null> {
    const cached = SuggestionCache.getInfo(key);
    if (cached !== undefined) return cached;
    try {
      const data = (await getIconInfo(prefix, name)) as IconifyIconSetWithInfo | null;
      SuggestionCache.setInfo(key, data);
      return data;
    } catch {
      return null;
    }
  }

  private formatAriaLabel(name: string, tags?: string[]): string {
    const cleanName = name.replace(/[-_]/g, ' ');
    return tags?.length ? `${cleanName} icon, related to ${tags.join(', ')}` : `${cleanName} icon`;
  }
}
