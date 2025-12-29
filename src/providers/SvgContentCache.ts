import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * Cache entry for SVG content and metadata
 */
interface SvgCacheEntry {
  content: string;
  hash: string;
  lastModified: number;
  isRasterized?: boolean;
  animationType?: string | null;
  colorCount?: number;
}

/**
 * Service for caching SVG content to avoid repeated file reads
 * Provides lazy loading and metadata caching for tree view performance
 */
export class SvgContentCache {
  private static instance: SvgContentCache;
  private cache: Map<string, SvgCacheEntry> = new Map();
  private tempPathCache: Map<string, string> = new Map(); // hash -> temp file path
  private maxCacheSize = 500; // Maximum number of cached entries
  private cleanupThreshold = 0.8; // Start cleanup when cache is 80% full

  private constructor() {}

  static getInstance(): SvgContentCache {
    if (!SvgContentCache.instance) {
      SvgContentCache.instance = new SvgContentCache();
    }
    return SvgContentCache.instance;
  }

  /**
   * Get SVG content from cache or load from file
   * Returns undefined if file doesn't exist or can't be read
   */
  getContent(filePath: string): string | undefined {
    const cached = this.cache.get(filePath);
    
    if (cached) {
      // Check if file was modified
      try {
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs === cached.lastModified) {
          return cached.content;
        }
      } catch {
        // File may have been deleted
        this.cache.delete(filePath);
        return undefined;
      }
    }

    // Load from file
    return this.loadAndCache(filePath);
  }

  /**
   * Get SVG content hash (for temp file naming)
   */
  getContentHash(filePath: string): string | undefined {
    const content = this.getContent(filePath);
    if (!content) return undefined;
    
    const cached = this.cache.get(filePath);
    return cached?.hash;
  }

  /**
   * Get or compute content hash directly from content
   */
  computeHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
  }

  /**
   * Check if SVG is rasterized (cached result)
   */
  isRasterized(filePath: string): boolean {
    const cached = this.cache.get(filePath);
    if (cached && cached.isRasterized !== undefined) {
      return cached.isRasterized;
    }

    const content = this.getContent(filePath);
    if (!content) return false;

    const colorCount = this.countColors(content);
    const isRasterized = colorCount > 50;

    // Update cache with computed value
    const entry = this.cache.get(filePath);
    if (entry) {
      entry.isRasterized = isRasterized;
      entry.colorCount = colorCount;
    }

    return isRasterized;
  }

  /**
   * Get animation type (cached result)
   */
  getAnimationType(filePath: string): string | null {
    const cached = this.cache.get(filePath);
    if (cached && cached.animationType !== undefined) {
      return cached.animationType;
    }

    const content = this.getContent(filePath);
    if (!content) return null;

    const animationType = this.detectAnimation(content);

    // Update cache with computed value
    const entry = this.cache.get(filePath);
    if (entry) {
      entry.animationType = animationType;
    }

    return animationType;
  }

  /**
   * Cache a temp file path for a content hash
   */
  cacheTempPath(hash: string, tempPath: string): void {
    this.tempPathCache.set(hash, tempPath);
  }

  /**
   * Get cached temp file path
   */
  getTempPath(hash: string): string | undefined {
    return this.tempPathCache.get(hash);
  }

  /**
   * Check if temp path exists for hash
   */
  hasTempPath(hash: string): boolean {
    const path = this.tempPathCache.get(hash);
    if (!path) return false;
    
    // Verify file still exists
    try {
      return fs.existsSync(path);
    } catch {
      this.tempPathCache.delete(hash);
      return false;
    }
  }

  /**
   * Pre-cache content for a batch of files (for folder expansion)
   */
  preloadBatch(filePaths: string[]): void {
    // Use setImmediate to not block the event loop
    const batch = filePaths.slice(0, 50); // Limit batch size
    
    for (const filePath of batch) {
      if (!this.cache.has(filePath)) {
        this.loadAndCache(filePath);
      }
    }
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.tempPathCache.clear();
  }

  /**
   * Clear only temp path cache (when temp dir is cleaned)
   */
  clearTempPaths(): void {
    this.tempPathCache.clear();
  }

  private loadAndCache(filePath: string): string | undefined {
    try {
      if (!fs.existsSync(filePath)) {
        return undefined;
      }

      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const hash = this.computeHash(content);

      // Check if we need to cleanup
      if (this.cache.size >= this.maxCacheSize * this.cleanupThreshold) {
        this.cleanup();
      }

      this.cache.set(filePath, {
        content,
        hash,
        lastModified: stats.mtimeMs
      });

      return content;
    } catch {
      return undefined;
    }
  }

  /**
   * Remove oldest entries when cache is getting full
   */
  private cleanup(): void {
    // Remove 20% of entries (oldest first by insertion order)
    const entriesToRemove = Math.floor(this.maxCacheSize * 0.2);
    const keys = Array.from(this.cache.keys());
    
    for (let i = 0; i < Math.min(entriesToRemove, keys.length); i++) {
      this.cache.delete(keys[i]);
    }
  }

  /**
   * Count unique colors in SVG
   */
  private countColors(svg: string): number {
    const colorRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/gi;
    const colors = new Set<string>();
    let match;
    while ((match = colorRegex.exec(svg)) !== null) {
      colors.add(match[0].toLowerCase());
    }
    return colors.size;
  }

  /**
   * Detect animation type in SVG
   */
  private detectAnimation(svg: string): string | null {
    // Check for CSS animations
    const hasStyleAnimation = /<style[^>]*>[\s\S]*@keyframes[\s\S]*<\/style>/i.test(svg);
    const hasInlineAnimation = /animation\s*:/i.test(svg);
    
    // Check for SMIL animations
    const hasAnimate = /<animate\b/i.test(svg);
    const hasAnimateTransform = /<animateTransform\b/i.test(svg);
    const hasAnimateMotion = /<animateMotion\b/i.test(svg);
    const hasSet = /<set\b/i.test(svg);

    if (hasStyleAnimation || hasInlineAnimation) {
      if (/spin|rotate/i.test(svg)) return 'spin (CSS)';
      if (/pulse|scale/i.test(svg)) return 'pulse (CSS)';
      if (/fade|opacity/i.test(svg)) return 'fade (CSS)';
      if (/bounce/i.test(svg)) return 'bounce (CSS)';
      if (/shake/i.test(svg)) return 'shake (CSS)';
      if (/draw|stroke-dash/i.test(svg)) return 'draw (CSS)';
      return 'CSS';
    }

    if (hasAnimateTransform) return 'SMIL transform';
    if (hasAnimateMotion) return 'SMIL motion';
    if (hasAnimate || hasSet) return 'SMIL';

    return null;
  }
}
