/**
 * Type definitions for MasterSVG Providers
 * Defines interfaces for tree views, scanners, and workspace providers
 */

import * as vscode from 'vscode';

// ============================================================================
// SVG Item Types
// ============================================================================

/**
 * SVG item collapsible state
 */
export type SvgItemCollapsibleState = 'none' | 'collapsed' | 'expanded';

/**
 * SVG item context value for commands
 */
export type SvgItemContextValue =
  | 'iconItem'
  | 'categoryItem'
  | 'sectionItem'
  | 'folderItem'
  | 'usageItem'
  | 'actionItem';

/**
 * Options for creating SvgItem
 */
export interface SvgItemOptions {
  /** Display label */
  label: string;
  /** Number of items (for categories) */
  count: number;
  /** Collapsible state */
  collapsibleState: vscode.TreeItemCollapsibleState;
  /** Context value for commands */
  contextValue?: SvgItemContextValue;
  /** Item tooltip */
  tooltip?: string;
  /** Item description */
  description?: string;
  /** Icon path or ThemeIcon */
  iconPath?: string | vscode.ThemeIcon;
  /** Resource URI */
  resourceUri?: vscode.Uri;
  /** Command to execute on click */
  command?: vscode.Command;
}

// ============================================================================
// Tree Provider Types
// ============================================================================

/**
 * Tree section identifier
 */
export type TreeSectionId =
  | 'workspaceIcons'
  | 'libraryIcons'
  | 'builtIcons'
  | 'inlineIcons'
  | 'unusedIcons'
  | 'recentIcons';

/**
 * Tree section definition
 */
export interface TreeSection {
  /** Section identifier */
  id: TreeSectionId;
  /** Section label */
  label: string;
  /** Section description */
  description?: string;
  /** Whether section is expanded by default */
  expanded: boolean;
  /** Section icon */
  icon?: string | vscode.ThemeIcon;
  /** Priority for sorting */
  priority: number;
}

/**
 * Tree refresh options
 */
export interface TreeRefreshOptions {
  /** Force full refresh */
  force?: boolean;
  /** Clear cache before refresh */
  clearCache?: boolean;
  /** Specific element to refresh */
  element?: vscode.TreeItem;
}

// ============================================================================
// Category Types
// ============================================================================

/**
 * Category definition
 */
export interface CategoryDefinition {
  /** Category identifier */
  id: string;
  /** Display name */
  name: string;
  /** Category description */
  description?: string;
  /** Icon patterns to match */
  patterns: string[];
  /** Keywords for matching */
  keywords?: string[];
  /** Category icon */
  icon?: string;
  /** Parent category (for hierarchical categories) */
  parent?: string;
}

/**
 * Categorized icon result
 */
export interface CategorizedIcon {
  /** Icon name */
  name: string;
  /** Icon path */
  path: string;
  /** Assigned category */
  category: string;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Category statistics
 */
export interface CategoryStats {
  /** Category id */
  categoryId: string;
  /** Number of icons */
  iconCount: number;
  /** Percentage of total */
  percentage: number;
}

// ============================================================================
// Scanner Types
// ============================================================================

/**
 * Scan target type
 */
export type ScanTarget = 'workspace' | 'folder' | 'file';

/**
 * Scan mode
 */
export type ScanMode = 'quick' | 'full' | 'incremental';

/**
 * Scanner options
 */
export interface ScannerOptions {
  /** Target to scan */
  target: ScanTarget;
  /** Scan mode */
  mode: ScanMode;
  /** Include patterns (glob) */
  include?: string[];
  /** Exclude patterns (glob) */
  exclude?: string[];
  /** Maximum depth for folder scanning */
  maxDepth?: number;
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Progress callback */
  onProgress?: (progress: ScanProgressInfo) => void;
  /** Cancellation token */
  cancellationToken?: vscode.CancellationToken;
}

/**
 * Scan progress information
 */
export interface ScanProgressInfo {
  /** Current file being scanned */
  currentFile?: string;
  /** Files scanned so far */
  scannedFiles: number;
  /** Total files to scan (if known) */
  totalFiles?: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Status message */
  message: string;
}

/**
 * Scan result summary
 */
export interface ScanResultSummary {
  /** Total icons found */
  totalIcons: number;
  /** Files scanned */
  filesScanned: number;
  /** Errors encountered */
  errors: ScanError[];
  /** Scan duration in ms */
  duration: number;
  /** Icons by source */
  bySource: {
    file: number;
    inline: number;
    library: number;
  };
}

/**
 * Scan error
 */
export interface ScanError {
  /** Error type */
  type: 'read' | 'parse' | 'permission' | 'unknown';
  /** File path */
  file: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
}

// ============================================================================
// Inline SVG Scanner Types
// ============================================================================

/**
 * Inline SVG match
 */
export interface InlineSvgMatch {
  /** Full SVG content */
  svg: string;
  /** Start position in file */
  startIndex: number;
  /** End position in file */
  endIndex: number;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Extracted name (from id, class, or generated) */
  name: string;
  /** ViewBox if present */
  viewBox?: string;
}

/**
 * File type for inline scanning
 */
export type InlineScanFileType = 'html' | 'jsx' | 'tsx' | 'vue' | 'svelte' | 'astro' | 'php' | 'erb';

/**
 * Inline scanner configuration
 */
export interface InlineScannerConfig {
  /** File types to scan */
  fileTypes: InlineScanFileType[];
  /** Minimum SVG size (bytes) to consider */
  minSize?: number;
  /** Maximum SVG size (bytes) to consider */
  maxSize?: number;
  /** Extract name from attributes */
  extractNames?: boolean;
  /** Include script-generated SVGs */
  includeGenerated?: boolean;
}

// ============================================================================
// Built Icon Provider Types
// ============================================================================

/**
 * Built icon metadata
 */
export interface BuiltIconMetadata {
  /** Icon name */
  name: string;
  /** File path */
  path: string;
  /** Build timestamp */
  builtAt: number;
  /** Original source path */
  sourcePath?: string;
  /** Icon variants */
  variants?: string[];
  /** Applied optimizations */
  optimizations?: string[];
  /** File size in bytes */
  size: number;
}

/**
 * Built icons manifest
 */
export interface BuiltIconsManifest {
  /** Manifest version */
  version: string;
  /** Build timestamp */
  generatedAt: number;
  /** Icons in manifest */
  icons: BuiltIconMetadata[];
  /** Total count */
  count: number;
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** Cache timestamp */
  timestamp: number;
  /** Time to live in ms */
  ttl: number;
  /** Access count */
  hits: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total entries */
  entries: number;
  /** Cache hits */
  hits: number;
  /** Cache misses */
  misses: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Memory usage (estimated) */
  memoryUsage: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum entries */
  maxEntries: number;
  /** Default TTL in ms */
  defaultTtl: number;
  /** Enable LRU eviction */
  lruEviction: boolean;
  /** Persist to disk */
  persist?: boolean;
}

// ============================================================================
// Hover & Completion Provider Types
// ============================================================================

/**
 * Hover content options
 */
export interface HoverContentOptions {
  /** Show preview image */
  showPreview: boolean;
  /** Preview size in pixels */
  previewSize: number;
  /** Show file path */
  showPath: boolean;
  /** Show file size */
  showSize: boolean;
  /** Show dimensions */
  showDimensions: boolean;
  /** Show usage count */
  showUsageCount: boolean;
}

/**
 * Completion item data
 */
export interface IconCompletionData {
  /** Icon name */
  name: string;
  /** Icon path */
  path: string;
  /** Icon source */
  source: 'workspace' | 'library' | 'built';
  /** Category */
  category?: string;
  /** Usage frequency */
  usageCount?: number;
}

/**
 * Completion context
 */
export interface IconCompletionContext {
  /** Document language */
  language: string;
  /** Trigger character */
  triggerChar?: string;
  /** Whether in import statement */
  isImport: boolean;
  /** Whether in JSX/HTML attribute */
  isAttribute: boolean;
  /** Current word */
  currentWord: string;
}

// ============================================================================
// Usage Scanner Types
// ============================================================================

/**
 * Icon usage location
 */
export interface IconUsageLocation {
  /** File path */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Usage type */
  type: 'import' | 'inline' | 'reference' | 'dynamic';
  /** Code snippet */
  snippet: string;
  /** Surrounding context */
  context?: string;
}

/**
 * Icon usage summary
 */
export interface IconUsageSummary {
  /** Icon name */
  iconName: string;
  /** Total usage count */
  totalUsages: number;
  /** Usages by type */
  byType: Record<string, number>;
  /** Usages by file */
  byFile: Record<string, number>;
  /** All locations */
  locations: IconUsageLocation[];
}

/**
 * Unused icon result
 */
export interface UnusedIconResult {
  /** Icon name */
  name: string;
  /** Icon path */
  path: string;
  /** Last modified date */
  lastModified?: Date;
  /** File size in bytes */
  size: number;
  /** Reason considered unused */
  reason: 'no-references' | 'only-excluded-files' | 'deprecated';
}

// ============================================================================
// Code Action Provider Types
// ============================================================================

/**
 * SVG to icon conversion options
 */
export interface SvgConversionOptions {
  /** Target framework */
  framework?: 'react' | 'vue' | 'svelte' | 'angular';
  /** Icon name */
  iconName: string;
  /** Optimize SVG */
  optimize: boolean;
  /** Add to library */
  addToLibrary: boolean;
  /** Generate component */
  generateComponent: boolean;
}

/**
 * Code action kind for SVG operations
 */
export type SvgCodeActionKind =
  | 'mastersvg.extract'
  | 'mastersvg.optimize'
  | 'mastersvg.convert'
  | 'mastersvg.addToLibrary';
