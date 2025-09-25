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
   * Get cached result for email
   */
  async get(email: string): Promise<EmailValidationResult | null> {
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
   * Cache validation result
   */
  async set(email: string, result: EmailValidationResult, ttl?: number): Promise<void> {
    try {
      await this.cache.set(email, result, ttl);
      debug("Cached result for email: %s", email);
    } catch (error) {
      debug("Cache set error for email %s: %o", email, error);
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
      await this.cache.clear();
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
   * Close cache connection
   */
  async close(): Promise<void> {
    try {
      if (this.cache.close) {
        await this.cache.close();
        debug("Cache connection closed");
      }
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
   * Get underlying cache instance (for advanced usage)
   */
  getCacheInstance(): ICache {
    return this.cache;
  }

  /**
   * Switch to different cache type
   */
  async switchCache(cacheTypeOrInstance: string | ICache, config?: CacheConfig): Promise<void> {
    // Close existing cache
    await this.close();

    // Initialize new cache
    if (typeof cacheTypeOrInstance === "string") {
      this.cacheType = cacheTypeOrInstance;
      this.cache = CacheFactoryRegistry.create(cacheTypeOrInstance, config);
      debug("Switched to cache type: %s", cacheTypeOrInstance);
    } else {
      this.cacheType = "custom";
      this.cache = cacheTypeOrInstance;
      debug("Switched to custom cache instance");
    }
  }
}
