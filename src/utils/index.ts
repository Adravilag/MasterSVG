/**
 * Utils barrel export
 * Re-exports all utilities for clean imports
 */

// Constants
export * from './constants';

// Configuration
export { getConfig, getOutputDirectory, getFullOutputPath } from './configHelper';
export type { FrameworkType, IconStudioConfig } from './configHelper';
export { getSvgConfig } from './config';

// File managers
export * from './outputFileManager';
export * from './iconsFileManager';

// Extension helpers
export {
  loadTemplate,
  clearTemplateCache,
  getOutputFormat,
  generateIconSnippet,
  toVariableName,
  toIconName,
  toCustomElementName,
  findImportInsertPosition,
  hasImport,
  generateImportStatement,
  generateIconEntry,
  generateIconsFileContent,
  generateVariantsFileContent,
  generateAnimationsFileContent,
  generateSvgSymbol,
  generateSpriteFileContent,
  generateScriptTag,
  parseIconifySearchResults,
  iconExistsInFile,
  replaceIconInFile,
  addIconToFile,
} from './extensionHelpers';
export type { IconifySearchResult, IconifySearchResponse } from './extensionHelpers';

// Error handling
export { ErrorHandler } from './errorHandler';

// Icon build helpers
export { buildIcon, showDeleteOriginalPrompt } from './iconBuildHelpers';
export type { BuildIconOptions, BuildResult, DeletePromptOptions } from './iconBuildHelpers';
