/**
 * Cache factory interfaces and abstract classes for custom caching implementations
 */

import type { EmailValidationResult } from "./types";

/**
 * Cache entry with metadata
 */
export interface CacheEntry {
  result: EmailValidationResult;
  timestamp: number;
  hitCount: number;
  ttl?: number; // Time to live in milliseconds
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  size: number;
  hitRate: number;
  entries: number;
  memoryUsage?: number;
  customMetrics?: Record<string, any>;
}

/**
 * Abstract cache interface that all cache implementations must follow
 */
export interface ICache {
  /**
   * Get cached result for email
   */
  get(key: string): Promise<EmailValidationResult | null> | EmailValidationResult | null;

  /**
   * Cache validation result
   */
  set(key: string, result: EmailValidationResult, ttl?: number): Promise<void> | void;

  /**
   * Check if key exists in cache
   */
  has(key: string): Promise<boolean> | boolean;

  /**
   * Remove entry from cache
   */
  delete(key: string): Promise<boolean> | boolean;

  /**
   * Clear all cached entries
   */
  clear(): Promise<void> | void;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats> | CacheStats;

  /**
   * Clean up expired entries
   */
  cleanup?(ttlMs?: number): Promise<number> | number;

  /**
   * Close cache connection (for external caches like Redis)
   */
  close?(): Promise<void> | void;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  maxSize?: number;
  defaultTtl?: number; // Default TTL in milliseconds
  cleanupInterval?: number; // Cleanup interval in milliseconds
  [key: string]: any; // Allow custom config properties
}

/**
 * Cache factory interface for creating cache instances
 */
export interface ICacheFactory {
  /**
   * Create a cache instance
   */
  create(config?: CacheConfig): ICache;

  /**
   * Get the cache type name
   */
  getType(): string;
}

/**
 * Abstract base cache factory
 */
export abstract class BaseCacheFactory implements ICacheFactory {
  abstract create(config?: CacheConfig): ICache;
  abstract getType(): string;
}

/**
 * Redis cache implementation interface (for developer reference)
 * Developers can implement this interface for Redis caching
 */
export interface RedisLikeCache extends ICache {
  /**
   * Redis-specific methods can be added here
   */
  ping?(): Promise<string>;
  flushAll?(): Promise<void>;
  expire?(key: string, seconds: number): Promise<boolean>;
}

/**
 * Database cache implementation interface (for developer reference)
 * Developers can implement this interface for database caching
 */
export interface DatabaseLikeCache extends ICache {
  /**
   * Database-specific methods can be added here
   */
  query?(sql: string, params?: any[]): Promise<any>;
  beginTransaction?(): Promise<void>;
  commit?(): Promise<void>;
  rollback?(): Promise<void>;
}

/**
 * File system cache implementation interface (for developer reference)
 */
export interface FileSystemLikeCache extends ICache {
  /**
   * File system specific methods
   */
  getFilePath?(key: string): string;
  ensureDirectory?(): Promise<void>;
  getFileSize?(): Promise<number>;
}

/**
 * Cache event types for event-driven caching
 */
export type CacheEventType = "hit" | "miss" | "set" | "delete" | "clear" | "expire" | "error";

/**
 * Cache event interface
 */
export interface CacheEvent {
  type: CacheEventType;
  key?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Event-driven cache interface
 */
export interface IEventDrivenCache extends ICache {
  /**
   * Add event listener
   */
  on(event: CacheEventType, listener: (event: CacheEvent) => void): void;

  /**
   * Remove event listener
   */
  off(event: CacheEventType, listener: (event: CacheEvent) => void): void;

  /**
   * Emit cache event
   */
  emit(event: CacheEventType, data?: Partial<CacheEvent>): void;
}
