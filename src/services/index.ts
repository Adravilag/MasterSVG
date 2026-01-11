/**
 * Services barrel export
 * Re-exports all services for clean imports
 */

// Animation services
export { AnimationService, ANIMATION_KEYFRAMES } from './AnimationService';
export type { AnimationSettings, DetectedAnimation } from './AnimationService';
export { getAnimationService } from './AnimationAssignmentService';
export type { IconAnimation, AnimationsData } from './AnimationAssignmentService';
export { ANIMATION_KEYFRAMES as ANIMATION_KEYFRAMES_CSS, ANIMATION_CATEGORIES, ANIMATION_BUTTONS, getKeyframesForAnimation, getAllAnimationTypes } from './AnimationKeyframes';

// Color service
export { ColorService } from './ColorService';

// SVG manipulation services
export { SvgTransformer } from './SvgTransformer';
export { SvgOptimizer } from './SvgOptimizer';
export { SvgManipulationService } from './SvgManipulationService';
export { SpriteGenerator } from './SpriteGenerator';

// Component & Framework services
export { ComponentExporter } from './ComponentExporter';
export { FrameworkDetectorService } from './FrameworkDetectorService';
export { FrameworkWrapperService } from './FrameworkWrapperService';

// Code services
export { CodeFormatterService } from './CodeFormatterService';
export { SyntaxHighlighter } from './SyntaxHighlighter';

// Icon services
export { IconPersistenceService, getIconPersistenceService } from './IconPersistenceService';
export { IconUsageSearchService } from './IconUsageSearchService';
export { UsageFinderService, getUsageFinderService } from './UsageFinderService';

// Variants service
export { VariantsService } from './VariantsService';
export type { Variant, ColorMapping, AnimationPreset, VariantsData } from './VariantsService';

// Template services
export { IconEditorTemplateService } from './IconEditorTemplateService';
export { PreviewTemplateService } from './PreviewTemplateService';

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

// Astro services
export { AstroLibraryService } from './AstroLibraryService';
export { AstroLibraryPanel } from './AstroLibraryPanel';
