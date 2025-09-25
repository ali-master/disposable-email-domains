/**
 * Cache factory implementation with built-in cache types
 */

import { debug as createDebugger } from "debug";
import { BaseCacheFactory } from "./cache-factory";
import type {
  ICache,
  ICacheFactory,
  CacheConfig,
  CacheEntry,
  CacheStats,
  IEventDrivenCache,
  CacheEvent,
  CacheEventType,
} from "./cache-factory";
import type { EmailValidationResult } from "./types";

const debug = createDebugger("disposable-email:cache-factory");

/**
 * In-memory LRU cache implementation
 */
export class MemoryCache implements IEventDrivenCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private readonly cleanupInterval?: NodeJS.Timeout;
  private eventListeners = new Map<CacheEventType, Set<(event: CacheEvent) => void>>();

  constructor(config: CacheConfig = {}) {
    this.maxSize = config.maxSize || 10000;
    this.defaultTtl = config.defaultTtl || 24 * 60 * 60 * 1000; // 24 hours

    debug(
      "Memory cache initialized with maxSize: %d, defaultTtl: %d",
      this.maxSize,
      this.defaultTtl,
    );

    // Setup automatic cleanup if specified
    if (config.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, config.cleanupInterval);
      debug("Cleanup interval set to %d ms", config.cleanupInterval);
    }
  }

  async get(key: string): Promise<EmailValidationResult | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.emit("miss", { key });
      return null;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.emit("expire", { key });
      debug("Cache entry expired for key: %s", key);
      return null;
    }

    entry.hitCount++;
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.emit("hit", { key });
    debug("Cache hit for key: %s (hitCount: %d)", key, entry.hitCount);
    return entry.result;
  }

  async set(key: string, result: EmailValidationResult, ttl?: number): Promise<void> {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (LRU eviction)
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) {
        debug("No oldest key found for eviction");
        return;
      }

      this.cache.delete(oldestKey);
      debug("LRU eviction: removed key %s", oldestKey);
    }

    const entry: CacheEntry = {
      result: { ...result },
      timestamp: Date.now(),
      hitCount: 0,
      ttl: ttl || this.defaultTtl,
    };

    this.cache.set(key, entry);
    this.emit("set", { key });
    debug("Cache set for key: %s with TTL: %d", key, entry.ttl);
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.emit("delete", { key });
      debug("Cache entry deleted for key: %s", key);
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.emit("clear");
    debug("Cache cleared");
  }

  async getStats(): Promise<CacheStats> {
    const totalHits = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + entry.hitCount,
      0,
    );
    const totalRequests = this.cache.size + totalHits;

    const stats: CacheStats = {
      size: this.cache.size,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      entries: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
    };

    debug("Cache stats: %o", stats);
    return stats;
  }

  cleanup(ttlMs?: number): number {
    const now = Date.now();
    const threshold = ttlMs || this.defaultTtl;
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now - entry.timestamp > threshold) {
        this.cache.delete(key);
        removedCount++;
        this.emit("expire", { key });
      }
    }

    if (removedCount > 0) {
      debug("Cleanup removed %d expired entries", removedCount);
    }
    return removedCount;
  }

  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      debug("Cleanup interval cleared");
    }
  }

  // Event system implementation
  on(event: CacheEventType, listener: (event: CacheEvent) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: CacheEventType, listener: (event: CacheEvent) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  emit(event: CacheEventType, data: Partial<CacheEvent> = {}): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const eventData: CacheEvent = {
        type: event,
        timestamp: Date.now(),
        ...data,
      };

      listeners.forEach((listener) => {
        try {
          listener(eventData);
        } catch (error) {
          debug("Error in event listener for %s: %o", event, error);
        }
      });
    }
  }

  private estimateMemoryUsage(): number {
    return this.cache.size * 500; // Rough estimation per entry
  }
}

/**
 * No-op cache implementation (disables caching)
 */
export class NoOpCache implements ICache {
  async get(): Promise<EmailValidationResult | null> {
    return null;
  }

  async set(): Promise<void> {
    // Do nothing
  }

  async has(): Promise<boolean> {
    return false;
  }

  async delete(): Promise<boolean> {
    return false;
  }

  async clear(): Promise<void> {
    // Do nothing
  }

  async getStats(): Promise<CacheStats> {
    return {
      size: 0,
      hitRate: 0,
      entries: 0,
    };
  }
}

/**
 * Memory cache factory
 */
export class MemoryCacheFactory extends BaseCacheFactory {
  create(config?: CacheConfig): ICache {
    debug("Creating memory cache with config: %o", config);
    return new MemoryCache(config);
  }

  getType(): string {
    return "memory";
  }
}

/**
 * No-op cache factory
 */
export class NoOpCacheFactory extends BaseCacheFactory {
  create(): ICache {
    debug("Creating no-op cache");
    return new NoOpCache();
  }

  getType(): string {
    return "noop";
  }
}

/**
 * Main cache factory registry
 */
export class CacheFactoryRegistry {
  private static factories = new Map<string, ICacheFactory>();
  private static defaultFactory = "memory";

  static {
    // Register built-in factories
    CacheFactoryRegistry.register("memory", new MemoryCacheFactory());
    CacheFactoryRegistry.register("noop", new NoOpCacheFactory());
  }

  /**
   * Register a cache factory
   */
  static register(type: string, factory: ICacheFactory): void {
    this.factories.set(type, factory);
    debug("Registered cache factory: %s", type);
  }

  /**
   * Create cache instance by type
   */
  static create(type: string = this.defaultFactory, config?: CacheConfig): ICache {
    const factory = this.factories.get(type);
    if (!factory) {
      debug("Unknown cache type: %s, falling back to %s", type, this.defaultFactory);
      return this.create(this.defaultFactory, config);
    }

    return factory.create(config);
  }

  /**
   * Get available cache types
   */
  static getAvailableTypes(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Set default cache factory type
   */
  static setDefault(type: string): void {
    if (this.factories.has(type)) {
      this.defaultFactory = type;
      debug("Default cache factory set to: %s", type);
    } else {
      throw new Error(`Unknown cache factory type: ${type}`);
    }
  }

  /**
   * Unregister a cache factory
   */
  static unregister(type: string): boolean {
    const deleted = this.factories.delete(type);
    if (deleted) {
      debug("Unregistered cache factory: %s", type);
    }
    return deleted;
  }
}
