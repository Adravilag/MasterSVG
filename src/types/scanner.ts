/**
 * Configuration options for scanner performance optimization
 */
export interface ScannerConfig {
  /**
   * Maximum number of files to process concurrently
   * @default 10
   */
  concurrencyLimit: number;

  /**
   * Maximum depth to scan directories
   * @default 20
   */
  maxDepth: number;

  /**
   * Maximum number of files to scan
   * @default 5000
   */
  maxFiles: number;

  /**
   * Batch size for processing files
   * @default 50
   */
  batchSize: number;

  /**
   * Enable progress reporting
   * @default true
   */
  enableProgress: boolean;

  /**
   * Timeout per file in milliseconds
   * @default 5000
   */
  fileTimeout: number;
}

/**
 * Default scanner configuration optimized for large projects
 */
export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  concurrencyLimit: 10,
  maxDepth: 20,
  maxFiles: 5000,
  batchSize: 50,
  enableProgress: true,
  fileTimeout: 5000,
};

/**
 * Progress callback for scan operations
 */
export interface ScanProgress {
  /**
   * Current phase of the scan
   */
  phase: 'preparing' | 'scanning' | 'processing' | 'complete';

  /**
   * Number of items processed so far
   */
  processed: number;

  /**
   * Total number of items to process (if known)
   */
  total?: number;

  /**
   * Current file being processed
   */
  currentFile?: string;

  /**
   * Percentage complete (0-100)
   */
  percentage?: number;
}

/**
 * Callback type for progress reporting
 */
export type ProgressCallback = (progress: ScanProgress) => void;

/**
 * Result of a scan operation
 */
export interface ScanResult<T> {
  /**
   * The scanned items
   */
  items: T;

  /**
   * Number of files scanned
   */
  filesScanned: number;

  /**
   * Number of items found
   */
  itemsFound: number;

  /**
   * Time taken in milliseconds
   */
  duration: number;

  /**
   * Whether the scan was truncated due to limits
   */
  truncated: boolean;

  /**
   * Any errors encountered during scanning
   */
  errors: ScanError[];
}

/**
 * Error encountered during scanning
 */
export interface ScanError {
  /**
   * File path where error occurred
   */
  filePath: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Error code if available
   */
  code?: string;
}

/**
 * Options for concurrent task execution
 */
export interface ConcurrentTaskOptions<T, R> {
  /**
   * Items to process
   */
  items: T[];

  /**
   * Function to process each item
   */
  processor: (item: T) => Promise<R>;

  /**
   * Maximum concurrent tasks
   */
  concurrency: number;

  /**
   * Optional progress callback
   */
  onProgress?: (processed: number, total: number) => void;
}
