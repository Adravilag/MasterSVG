import { optimize, Config } from 'svgo';

export interface OptimizeResult {
  svg: string;
  originalSize: number;
  optimizedSize: number;
  savings: number;
  savingsPercent: number;
}

export interface OptimizeOptions {
  removeComments?: boolean;
  removeMetadata?: boolean;
  removeTitle?: boolean;
  removeDesc?: boolean;
  removeUselessDefs?: boolean;
  removeEditorsNSData?: boolean;
  removeEmptyAttrs?: boolean;
  removeHiddenElems?: boolean;
  removeEmptyText?: boolean;
  removeEmptyContainers?: boolean;
  minifyStyles?: boolean;
  convertColors?: boolean;
  convertPathData?: boolean;
  convertTransform?: boolean;
  removeUnusedNS?: boolean;
  sortAttrs?: boolean;
  mergePaths?: boolean;
  removeOffCanvasPaths?: boolean;
  precision?: number;
}

const defaultOptions: OptimizeOptions = {
  removeComments: true,
  removeMetadata: true,
  removeTitle: false,
  removeDesc: true,
  removeUselessDefs: true,
  removeEditorsNSData: true,
  removeEmptyAttrs: true,
  removeHiddenElems: true,
  removeEmptyText: true,
  removeEmptyContainers: true,
  minifyStyles: true,
  convertColors: true,
  convertPathData: true,
  convertTransform: true,
  removeUnusedNS: true,
  sortAttrs: true,
  mergePaths: false,
  removeOffCanvasPaths: false,
  precision: 3
};

export class SvgOptimizer {
  /**
   * Optimize SVG using SVGO
   */
  optimize(svg: string, options: OptimizeOptions = {}): OptimizeResult {
    const opts = { ...defaultOptions, ...options };
    const originalSize = new Blob([svg]).size;

    const svgoConfig: Config = {
      multipass: true,
      plugins: this.buildPluginList(opts)
    };

    try {
      const result = optimize(svg, svgoConfig);
      const optimizedSize = new Blob([result.data]).size;
      const savings = originalSize - optimizedSize;
      const savingsPercent = originalSize > 0 ? (savings / originalSize) * 100 : 0;

      return {
        svg: result.data,
        originalSize,
        optimizedSize,
        savings,
        savingsPercent
      };
    } catch (error) {
      // Return original if optimization fails
      return {
        svg,
        originalSize,
        optimizedSize: originalSize,
        savings: 0,
        savingsPercent: 0
      };
    }
  }

  /**
   * Build SVGO plugin list from options
   */
  private buildPluginList(opts: OptimizeOptions): Config['plugins'] {
    const plugins: Config['plugins'] = [
      'removeDoctype',
      'removeXMLProcInst',
      'removeXMLNS',
    ];

    if (opts.removeComments) plugins.push('removeComments');
    if (opts.removeMetadata) plugins.push('removeMetadata');
    if (opts.removeTitle) plugins.push('removeTitle');
    if (opts.removeDesc) plugins.push('removeDesc');
    if (opts.removeUselessDefs) plugins.push('removeUselessDefs');
    if (opts.removeEditorsNSData) plugins.push('removeEditorsNSData');
    if (opts.removeEmptyAttrs) plugins.push('removeEmptyAttrs');
    if (opts.removeHiddenElems) plugins.push('removeHiddenElems');
    if (opts.removeEmptyText) plugins.push('removeEmptyText');
    if (opts.removeEmptyContainers) plugins.push('removeEmptyContainers');
    if (opts.removeUnusedNS) plugins.push('removeUnusedNS');
    if (opts.sortAttrs) plugins.push('sortAttrs');
    
    if (opts.minifyStyles) {
      plugins.push({
        name: 'minifyStyles',
        params: { usage: true }
      });
    }

    if (opts.convertColors) {
      plugins.push({
        name: 'convertColors',
        params: { currentColor: false, names2hex: true, rgb2hex: true, shorthex: true, shortname: true }
      });
    }

    if (opts.convertPathData) {
      plugins.push({
        name: 'convertPathData',
        params: {
          floatPrecision: opts.precision || 3,
          transformPrecision: opts.precision || 3
        }
      });
    }

    if (opts.convertTransform) {
      plugins.push({
        name: 'convertTransform',
        params: { floatPrecision: opts.precision || 3 }
      });
    }

    if (opts.mergePaths) {
      plugins.push('mergePaths');
    }

    if (opts.removeOffCanvasPaths) {
      plugins.push('removeOffCanvasPaths');
    }

    // Always add these cleanup plugins
    plugins.push('cleanupIds');
    plugins.push('removeUselessStrokeAndFill');
    plugins.push('cleanupNumericValues');
    plugins.push('collapseGroups');

    return plugins;
  }

  /**
   * Format file size for display
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get optimization presets
   */
  getPresets(): Record<string, OptimizeOptions> {
    return {
      safe: {
        removeComments: true,
        removeMetadata: true,
        removeDesc: true,
        removeEditorsNSData: true,
        removeEmptyAttrs: true,
        removeEmptyContainers: true,
        removeUnusedNS: true,
        sortAttrs: true,
        precision: 3
      },
      aggressive: {
        ...defaultOptions,
        removeTitle: true,
        mergePaths: true,
        precision: 2
      },
      minimal: {
        removeComments: true,
        removeMetadata: true,
        removeEditorsNSData: true
      }
    };
  }
}
