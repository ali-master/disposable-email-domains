import { debug as createDebugger } from "debug";
import type {
  ICache,
  CacheConfig,
  CacheStats,
  RedisLikeCache,
  BaseCacheFactory,
} from "../src/client/cache-factory";
import type { EmailValidationResult } from "../src/client/types";

const debug = createDebugger("disposable-email:cache-redis-example");

/**
 * Example Redis cache implementation
 * Developers should replace this with actual Redis client implementation
 */
export class ExampleRedisCache implements RedisLikeCache {
  private client: any; // Replace with actual Redis client type
  private keyPrefix: string;
  private defaultTtl: number;

  constructor(config: CacheConfig & { redisClient?: any; keyPrefix?: string } = {}) {
    this.client = config.redisClient; // Developer should pass Redis client instance
    this.keyPrefix = config.keyPrefix || "disposable-email:";
    this.defaultTtl = config.defaultTtl || 86400; // 24 hours in seconds

    debug("Redis cache initialized with prefix: %s", this.keyPrefix);
  }

  async get(key: string): Promise<EmailValidationResult | null> {
    if (!this.client) {
      throw new Error("Redis client not configured");
    }

    try {
      const data = await this.client.get(`${this.keyPrefix}${key}`);
      if (!data) return null;

      const parsed = JSON.parse(data);
      debug("Redis cache hit for key: %s", key);
      return parsed.result;
    } catch (error) {
      debug("Redis get error for key %s: %o", key, error);
      return null;
    }
  }

  async set(key: string, result: EmailValidationResult, ttl?: number): Promise<void> {
    if (!this.client) {
      throw new Error("Redis client not configured");
    }

    try {
      const data = JSON.stringify({
        result,
        timestamp: Date.now(),
        hitCount: 0,
      });

      const expiry = ttl ? Math.floor(ttl / 1000) : this.defaultTtl;
      await this.client.setex(`${this.keyPrefix}${key}`, expiry, data);
      debug("Redis cache set for key: %s with TTL: %d", key, expiry);
    } catch (error) {
      debug("Redis set error for key %s: %o", key, error);
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const exists = await this.client.exists(`${this.keyPrefix}${key}`);
      return exists === 1;
    } catch (error) {
      debug("Redis has error for key %s: %o", key, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const deleted = await this.client.del(`${this.keyPrefix}${key}`);
      debug("Redis deleted key: %s", key);
      return deleted === 1;
    } catch (error) {
      debug("Redis delete error for key %s: %o", key, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.client) return;

    try {
      const keys = await this.client.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
        debug("Redis cleared %d keys", keys.length);
      }
    } catch (error) {
      debug("Redis clear error: %o", error);
    }
  }

  async getStats(): Promise<CacheStats> {
    if (!this.client) {
      return { size: 0, hitRate: 0, entries: 0 };
    }

    try {
      const keys = await this.client.keys(`${this.keyPrefix}*`);
      const info = await this.client.info("memory");
      const memoryUsage = this.parseMemoryInfo(info);

      return {
        size: keys.length,
        hitRate: 0, // Would need to track this separately
        entries: keys.length,
        memoryUsage,
        customMetrics: {
          keyPrefix: this.keyPrefix,
          redisInfo: info,
        },
      };
    } catch (error) {
      debug("Redis stats error: %o", error);
      return { size: 0, hitRate: 0, entries: 0 };
    }
  }

  async ping(): Promise<string> {
    if (!this.client) throw new Error("Redis client not configured");
    return await this.client.ping();
  }

  async flushAll(): Promise<void> {
    if (!this.client) return;
    await this.client.flushall();
    debug("Redis flushed all data");
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client) return false;
    const result = await this.client.expire(`${this.keyPrefix}${key}`, seconds);
    return result === 1;
  }

  async close(): Promise<void> {
    if (this.client && this.client.quit) {
      await this.client.quit();
      debug("Redis connection closed");
    }
  }

  private parseMemoryInfo(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

/**
 * Example factory implementations
 */
export class RedisCacheFactory extends BaseCacheFactory {
  constructor(private redisClient?: any) {
    super();
  }

  create(config?: CacheConfig): ICache {
    return new ExampleRedisCache({ ...config, redisClient: this.redisClient });
  }

  getType(): string {
    return "redis";
  }
}
