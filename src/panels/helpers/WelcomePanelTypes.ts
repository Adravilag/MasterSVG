/**
 * WelcomePanelTypes - Type definitions for WelcomePanel
 *
 * Centralizes all interfaces and types used by WelcomePanel helpers.
 */

/** Session configuration options stored during wizard flow */
export interface SessionConfig {
  svgFolders: string[];
  outputDirectory: string;
  framework: string;
  buildFormat: string;
  webComponentName: string;
  scanOnStartup: boolean;
  defaultIconSize: number;
  previewBackground: string;
  autoGenerateLicenses: boolean;
  frontendRoot: string;
  createMsignore: boolean;
  separateOutputStructure: boolean;
}

/** Webview context with computed state values */
export interface WebviewContext {
  sourceDir: string;
  outputDir: string;
  buildFormat: string;
  framework: string;
  webComponentName: string;
  scanOnStartup: boolean;
  defaultIconSize: number;
  previewBackground: string;
  isFrontendConfigured: boolean;
  isSourceConfigured: boolean;
  isOutputConfigured: boolean;
  isBuildFormatConfigured: boolean;
  isWebComponentConfigured: boolean;
  isFullyConfigured: boolean;
  outputDirDisplay: string;
  webComponentDisplay: string;
  frontendRoot: string;
  suggestedFrontendRoots: string[];
  suggestedSourceDirs: string[];
  suggestedOutputDirs: string[];
  separateOutputStructure: boolean;
}

/** Options for template replacement functions */
export interface TemplateReplacementOptions {
  html: string;
  ctx: WebviewContext;
  tr: Record<string, string>;
  languageOptions: string;
  step4Section: string;
  previewCode: string;
  previewWindowTitle: string;
  previewGallery: string;
  previewSummary: string;
  setupGuide: string;
  finishButton: string;
}

/** Options for preview replacement functions */
export interface PreviewReplacementOptions {
  html: string;
  ctx: WebviewContext;
  tr: Record<string, string>;
  previewCode: string;
  previewWindowTitle: string;
  previewGallery: string;
  previewSummary: string;
  setupGuide: string;
  finishButton: string;
}

/** Message payload from webview */
export interface WebviewMessage {
  command: string;
  directory?: string;
  format?: string;
  framework?: string;
  name?: string;
  language?: string;
  value?: boolean | number | string;
}

/** Creates default session config */
export function createDefaultSessionConfig(): SessionConfig {
  return {
    svgFolders: [],
    outputDirectory: '',
    framework: '',
    buildFormat: '',
    webComponentName: '',
    scanOnStartup: true,
    defaultIconSize: 24,
    previewBackground: 'transparent',
    autoGenerateLicenses: false,
    frontendRoot: '',
    createMsignore: true,
    separateOutputStructure: false,
  };
}
