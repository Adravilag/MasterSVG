import { ConcurrentTaskOptions } from '../types/scanner';

/**
 * Utility class for efficient concurrent processing of tasks
 * Implements a semaphore pattern to limit concurrent operations
 */
export class ConcurrentProcessor {
  /**
   * Process items concurrently with a limit on simultaneous operations
   * Uses a pool-based approach for optimal performance
   */
  static async processConcurrent<T, R>(options: ConcurrentTaskOptions<T, R>): Promise<R[]> {
    const { items, processor, concurrency, onProgress } = options;
    const results: R[] = new Array(items.length);
    let currentIndex = 0;
    let completedCount = 0;
    const total = items.length;

    // Worker function that processes items from the queue
    const worker = async (): Promise<void> => {
      while (true) {
        // Get next index to process
        const index = currentIndex++;
        if (index >= total) break;

        try {
          results[index] = await processor(items[index]);
        } catch (_error) {
          // Store undefined for failed items, let caller handle errors
          results[index] = undefined as R;
        }

        completedCount++;
        if (onProgress) {
          onProgress(completedCount, total);
        }
      }
    };

    // Create workers up to concurrency limit
    const workerCount = Math.min(concurrency, total);
    const workers: Promise<void>[] = [];
    for (let i = 0; i < workerCount; i++) {
      workers.push(worker());
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    return results;
  }

  /**
   * Process items in batches with concurrent processing within each batch
   * Useful for very large datasets to prevent memory issues
   */
  static async processBatches<T, R>(options: {
    items: T[];
    processor: (item: T) => Promise<R>;
    batchSize: number;
    concurrency: number;
    onBatchComplete?: (batchIndex: number, totalBatches: number) => void;
  }): Promise<R[]> {
    const { items, processor, batchSize, concurrency, onBatchComplete } = options;
    const results: R[] = [];
    const totalBatches = Math.ceil(items.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, items.length);
      const batch = items.slice(start, end);

      const batchResults = await this.processConcurrent({
        items: batch,
        processor,
        concurrency,
      });

      results.push(...batchResults);

      if (onBatchComplete) {
        onBatchComplete(i + 1, totalBatches);
      }
    }

    return results;
  }

  /**
   * Process items with timeout per item
   * Prevents hanging on slow file operations
   */
  static async processWithTimeout<T, R>(
    item: T,
    processor: (item: T) => Promise<R>,
    timeoutMs: number,
    defaultValue: R
  ): Promise<R> {
    return Promise.race([
      processor(item),
      new Promise<R>(resolve => setTimeout(() => resolve(defaultValue), timeoutMs)),
    ]);
  }

  /**
   * Chunk an array into smaller arrays of specified size
   */
  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Simple debouncer for scan operations
 */
export class ScanDebouncer {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Debounce a function call by key
   */
  debounce(key: string, fn: () => void, delay: number): void {
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.timers.delete(key);
      fn();
    }, delay);

    this.timers.set(key, timer);
  }

  /**
   * Cancel a pending debounced call
   */
  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Cancel all pending calls
   */
  cancelAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
