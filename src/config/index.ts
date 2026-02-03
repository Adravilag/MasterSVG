/**
 * Config module exports
 *
 * Centralized configuration management for MasterSVG.
 */

// Schema types
export {
  // Basic types
  AnimationTiming,
  AnimationIteration,
  AnimationDirection,
  FrameworkType,
  OutputFormat,
  OutputStructure,
  NamingConvention,
  CategorySource,
  PreviewBackground,
  // Config sections
  AnimationPreset,
  AnimationConfig,
  SourceConfig,
  OutputConfig,
  OutputPaths,
  FrameworkConfig,
  ComponentConfig,
  OptimizationConfig,
  SvgoConfig,
  ColorConversionConfig,
  IconsConfig,
  CategoryConfig,
  LicensesConfig,
  EditorConfig,
  // Main config
  MasterSvgConfig,
  PartialMasterSvgConfig,
} from './ConfigSchema';

// Defaults
export {
  DEFAULT_CONFIG,
  DEFAULT_SOURCE_CONFIG,
  DEFAULT_OUTPUT_CONFIG,
  DEFAULT_FRAMEWORK_CONFIG,
  DEFAULT_OPTIMIZATION_CONFIG,
  DEFAULT_ICONS_CONFIG,
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_ANIMATION_PRESETS,
  DEFAULT_LICENSES_CONFIG,
  DEFAULT_EDITOR_CONFIG,
  mergeWithDefaults,
  createMinimalConfig,
} from './ConfigDefaults';

// Service
export {
  ConfigService,
  ConfigChangeListener,
  CONFIG_FILE_NAME,
  getConfig,
  createConfig,
} from './ConfigService';
