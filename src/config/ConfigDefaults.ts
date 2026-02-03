/**
 * ConfigDefaults - Default values for mastersvg.config.json
 *
 * Provides sensible defaults for all configuration options.
 */

import {
  MasterSvgConfig,
  PartialMasterSvgConfig,
  SourceConfig,
  OutputConfig,
  FrameworkConfig,
  OptimizationConfig,
  IconsConfig,
  AnimationConfig,
  LicensesConfig,
  EditorConfig,
  AnimationPreset,
} from './ConfigSchema';

/** Default animation presets */
export const DEFAULT_ANIMATION_PRESETS: Record<string, AnimationPreset> = {
  spin: {
    duration: 1000,
    timing: 'linear',
    iteration: 'infinite',
  },
  pulse: {
    duration: 2000,
    timing: 'ease-in-out',
    iteration: 'infinite',
  },
  bounce: {
    duration: 500,
    timing: 'ease',
    iteration: 3,
  },
  shake: {
    duration: 500,
    timing: 'ease-in-out',
    iteration: 1,
  },
  fade: {
    duration: 1000,
    timing: 'ease',
    iteration: 1,
  },
};

/** Default source configuration */
export const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  directories: ['src/assets/svg'],
  ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
};

/** Default output configuration */
export const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  format: 'icons.ts',
  structure: 'flat',
  directory: 'src/icons',
};

/** Default framework configuration */
export const DEFAULT_FRAMEWORK_CONFIG: FrameworkConfig = {
  type: 'react',
  typescript: true,
  component: {
    name: 'Icon',
    webComponentTag: 'svg-icon',
  },
};

/** Default optimization configuration */
export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  svgo: {
    enabled: true,
    removeComments: true,
    removeMetadata: true,
    removeTitle: false,
    removeDimensions: true,
    convertColors: {
      currentColor: false,
    },
  },
};

/** Default icons configuration */
export const DEFAULT_ICONS_CONFIG: IconsConfig = {
  defaultSize: 24,
  naming: 'kebab-case',
  prefix: '',
  categories: {
    enabled: true,
    source: 'folders',
  },
};

/** Default animation configuration */
export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  presets: DEFAULT_ANIMATION_PRESETS,
};

/** Default licenses configuration */
export const DEFAULT_LICENSES_CONFIG: LicensesConfig = {
  autoGenerate: false,
  outputFile: 'ICON_LICENSES.md',
  includeIconify: true,
};

/** Default editor configuration */
export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  scanOnStartup: true,
  previewBackground: 'checkered',
  autoImport: true,
  deleteAfterBuild: false,
};

/** Complete default configuration */
export const DEFAULT_CONFIG: MasterSvgConfig = {
  $schema: 'https://mastersvg.dev/schema/v1.json',
  version: '1.0',
  source: DEFAULT_SOURCE_CONFIG,
  output: DEFAULT_OUTPUT_CONFIG,
  framework: DEFAULT_FRAMEWORK_CONFIG,
  optimization: DEFAULT_OPTIMIZATION_CONFIG,
  icons: DEFAULT_ICONS_CONFIG,
  animations: DEFAULT_ANIMATION_CONFIG,
  licenses: DEFAULT_LICENSES_CONFIG,
  editor: DEFAULT_EDITOR_CONFIG,
};

/**
 * Deep merges user config with defaults
 */
export function mergeWithDefaults(userConfig: PartialMasterSvgConfig): MasterSvgConfig {
  return {
    $schema: userConfig.$schema ?? DEFAULT_CONFIG.$schema,
    version: userConfig.version ?? DEFAULT_CONFIG.version,
    source: {
      ...DEFAULT_SOURCE_CONFIG,
      ...userConfig.source,
    },
    output: {
      ...DEFAULT_OUTPUT_CONFIG,
      ...userConfig.output,
    },
    framework: {
      ...DEFAULT_FRAMEWORK_CONFIG,
      ...userConfig.framework,
      component: {
        ...DEFAULT_FRAMEWORK_CONFIG.component,
        ...userConfig.framework?.component,
      },
    },
    optimization: {
      svgo: {
        ...DEFAULT_OPTIMIZATION_CONFIG.svgo,
        ...userConfig.optimization?.svgo,
        convertColors: {
          ...DEFAULT_OPTIMIZATION_CONFIG.svgo?.convertColors,
          ...userConfig.optimization?.svgo?.convertColors,
        },
      },
    },
    icons: {
      ...DEFAULT_ICONS_CONFIG,
      ...userConfig.icons,
      categories: {
        ...DEFAULT_ICONS_CONFIG.categories,
        ...userConfig.icons?.categories,
      },
    },
    animations: {
      presets: {
        ...DEFAULT_ANIMATION_PRESETS,
        ...userConfig.animations?.presets,
      },
    },
    licenses: {
      ...DEFAULT_LICENSES_CONFIG,
      ...userConfig.licenses,
    },
    editor: {
      ...DEFAULT_EDITOR_CONFIG,
      ...userConfig.editor,
    },
  };
}

/**
 * Creates a minimal config for a specific framework
 */
export function createMinimalConfig(framework: FrameworkConfig['type']): Partial<MasterSvgConfig> {
  const isTypescript = ['react', 'vue', 'angular', 'solid', 'qwik'].includes(framework);
  
  return {
    version: '1.0',
    source: {
      directories: ['src/assets/svg'],
    },
    output: {
      format: isTypescript ? 'icons.ts' : 'icons.js',
      structure: 'flat',
      directory: 'src/icons',
    },
    framework: {
      type: framework,
      typescript: isTypescript,
    },
  };
}
