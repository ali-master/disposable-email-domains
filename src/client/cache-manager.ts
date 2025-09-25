import { debug as createDebugger } from "debug";
import type { EmailValidationResult, CacheStats } from "./types";
import type { ICache, CacheConfig } from "./cache-factory";
import { CacheFactoryRegistry } from "./cache-factory-impl";

const debug = createDebugger("disposable-email:cache-manager");

/**
 * Cache manager that supports multiple cache backends via factory pattern
 */
export class CacheManager {
  private cache: ICache;
  private cacheType: string;
  private pendingOperations = new Map<string, Promise<EmailValidationResult | null>>();
  private batchGetQueue: string[] = [];
  private batchSetQueue: Array<{ key: string; value: EmailValidationResult; ttl?: number }> = [];
  private batchTimeout?: NodeJS.Timeout;
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_DELAY = 10; // milliseconds

  constructor(cacheTypeOrInstance: string | ICache = "memory", config?: CacheConfig) {
    if (typeof cacheTypeOrInstance === "string") {
      this.cacheType = cacheTypeOrInstance;
      this.cache = CacheFactoryRegistry.create(cacheTypeOrInstance, config);
      debug("Cache manager initialized with type: %s", cacheTypeOrInstance);
    } else {
      this.cacheType = "custom";
      this.cache = cacheTypeOrInstance;
      debug("Cache manager initialized with custom cache instance");
    }
  }

  /**
   * Get cached result for email with deduplication
   */
  async get(email: string): Promise<EmailValidationResult | null> {
    // Deduplicate concurrent requests for the same email
    const pending = this.pendingOperations.get(email);
    if (pending) {
      return pending;
    }

    const promise = this.performGet(email);
    this.pendingOperations.set(email, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingOperations.delete(email);
    }
  }

  private async performGet(email: string): Promise<EmailValidationResult | null> {
    try {
      const result = await this.cache.get(email);
      if (result) {
        debug("Cache hit for email: %s", email);
      } else {
        debug("Cache miss for email: %s", email);
      }
      return result;
    } catch (error) {
      debug("Cache get error for email %s: %o", email, error);
      return null;
    }
  }

  /**
   * Batch get multiple emails at once
   */
  async getBatch(emails: string[]): Promise<Map<string, EmailValidationResult | null>> {
    const results = new Map<string, EmailValidationResult | null>();

    // Check for pending operations first
    const emailsToFetch: string[] = [];
    const pendingPromises: Promise<EmailValidationResult | null>[] = [];

    for (const email of emails) {
      const pending = this.pendingOperations.get(email);
      if (pending) {
        pendingPromises.push(
          pending.then((result) => {
            results.set(email, result);
            return result;
          }),
        );
      } else {
        emailsToFetch.push(email);
      }
    }

    // Wait for pending operations
    if (pendingPromises.length > 0) {
      await Promise.all(pendingPromises);
    }

    // Fetch remaining emails
    if (emailsToFetch.length > 0) {
      try {
        // @ts-expect-error
        if (this.cache.getBatch) {
          // @ts-expect-error
          const batchResults = await this.cache.getBatch(emailsToFetch);
          for (const [email, result] of batchResults) {
            results.set(email, result);
          }
        } else {
          // Fallback to individual gets with concurrency limit
          const promises = emailsToFetch.map((email) => this.get(email));
          const individualResults = await Promise.all(promises);
          for (let i = 0; i < emailsToFetch.length; i++) {
            results.set(emailsToFetch[i], individualResults[i]);
          }
        }
      } catch (error) {
        debug("Batch get error: %o", error);
        // Set null for all failed emails
        for (const email of emailsToFetch) {
          results.set(email, null);
        }
      }
    }

    return results;
  }

  /**
   * Cache validation result with batching
   */
  async set(email: string, result: EmailValidationResult, ttl?: number): Promise<void> {
    // @ts-expect-error
    if (this.cache.setBatch) {
      // Add to batch queue
      this.batchSetQueue.push({ key: email, value: result, ttl });

      if (this.batchSetQueue.length >= this.BATCH_SIZE) {
        await this.flushSetBatch();
      } else if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => this.flushSetBatch(), this.BATCH_DELAY);
      }
    } else {
      try {
        await this.cache.set(email, result, ttl);
        debug("Cached result for email: %s", email);
      } catch (error) {
        debug("Cache set error for email %s: %o", email, error);
      }
    }
  }

  private async flushSetBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = undefined;
    }

    if (this.batchSetQueue.length === 0) return;

    const batch = this.batchSetQueue.splice(0);
    try {
      // @ts-expect-error
      await this.cache.setBatch!(batch);
      debug("Batch cached %d results", batch.length);
    } catch (error) {
      debug("Batch set error: %o", error);
    }
  }

  /**
   * Check if email is cached
   */
  async has(email: string): Promise<boolean> {
    try {
      return await this.cache.has(email);
    } catch (error) {
      debug("Cache has error for email %s: %o", email, error);
      return false;
    }
  }

  /**
   * Remove cached entry
   */
  async delete(email: string): Promise<boolean> {
    try {
      const deleted = await this.cache.delete(email);
      if (deleted) {
        debug("Deleted cache entry for email: %s", email);
      }
      return deleted;
    } catch (error) {
      debug("Cache delete error for email %s: %o", email, error);
      return false;
    }
  }

  /**
   * Clear all cached entries
   */
  async clear(): Promise<void> {
    try {
      // Flush any pending batches first
      await this.flushSetBatch();

      await this.cache.clear();
      this.pendingOperations.clear();
      debug("Cache cleared");
    } catch (error) {
      debug("Cache clear error: %o", error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const stats = await this.cache.getStats();
      debug("Cache stats retrieved: %o", stats);
      return stats;
    } catch (error) {
      debug("Cache stats error: %o", error);
      return {
        size: 0,
        hitRate: 0,
        entries: 0,
      };
    }
  }

  /**
   * Remove expired entries based on TTL
   */
  async cleanup(ttlMs?: number): Promise<number> {
    try {
      if (this.cache.cleanup) {
        const removedCount = await this.cache.cleanup(ttlMs);
        debug("Cache cleanup removed %d entries", removedCount);
        return removedCount;
      }
      return 0;
    } catch (error) {
      debug("Cache cleanup error: %o", error);
      return 0;
    }
  }

  /**
   * Switch to a different cache backend
   */
  async switchCache(cacheTypeOrInstance: string | ICache, config?: CacheConfig): Promise<void> {
    try {
      // Flush pending operations
      await this.flushSetBatch();

      // Close current cache
      if (this.cache.close) {
        await this.cache.close();
      }

      // Create new cache
      if (typeof cacheTypeOrInstance === "string") {
        this.cacheType = cacheTypeOrInstance;
        this.cache = CacheFactoryRegistry.create(cacheTypeOrInstance, config);
      } else {
        this.cacheType = "custom";
        this.cache = cacheTypeOrInstance;
      }

      debug("Switched to cache type: %s", this.cacheType);
    } catch (error) {
      debug("Cache switch error: %o", error);
      throw error;
    }
  }

  /**
   * Close cache connection and flush pending operations
   */
  async close(): Promise<void> {
    try {
      // Flush any pending batches
      await this.flushSetBatch();

      if (this.cache.close) {
        await this.cache.close();
        debug("Cache connection closed");
      }

      this.pendingOperations.clear();
    } catch (error) {
      debug("Cache close error: %o", error);
    }
  }

  /**
   * Get cache type
   */
  getCacheType(): string {
    return this.cacheType;
  }

  /**
   * Get pending operations count for monitoring
   */
  getPendingOperationsCount(): number {
    return this.pendingOperations.size;
  }
}
