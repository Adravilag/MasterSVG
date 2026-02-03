/**
 * Services barrel export
 * Re-exports all services for clean imports
 */

// Animation services
export * from './animation';

// SVG manipulation services
export * from './svg';

// Framework services
export * from './framework';

// Icon services
export * from './icon';

// Template services
export * from './template';

// Astro services
export * from './astro';

// Color service
export { ColorService, getColorService } from './ColorService';

// License service
export {
  ensureCollectionsLoaded,
  fetchCollections,
  getCollectionInfo,
  parseIconifyName,
  getIconLicenseInfoSync,
  getIconLicenseInfo,
  scanIconsForAttribution,
  groupByCollection,
  generateCombinedLicense,
  generateLicenseFiles,
  getLicenseSummary,
} from './LicenseService';
export type { LicenseInfo, AuthorInfo, CollectionInfo, IconAttribution } from './LicenseService';

// Types - export specific non-duplicate types only
export type { FrameworkType, IconStudioConfig } from './types';
export type {
  FolderTreeNode,
  PreviewAnimation,
  PreviewTemplateOptions,
  CategoryInfo,
  IconStorageMaps,
  IconUsageInfo,
  ColorVariant,
  ColorMappingRecord,
  AnimationPresetConfig,
  VariantsDataFile,
  SimpleAnimationSettings,
  DetectedAnimationInfo,
  IconAnimationAssignment,
  AnimationsDataFile,
} from './types';
