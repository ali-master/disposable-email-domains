import { debug as createDebugger } from "debug";
import type {
  ICache,
  CacheConfig,
  CacheStats,
  FileSystemLikeCache,
  BaseCacheFactory,
} from "../src/client/cache-factory";
import type { EmailValidationResult } from "../src/client/types";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const debug = createDebugger("disposable-email:cache-filesystem-example");

/**
 * Example File System cache implementation
 */
export class ExampleFileSystemCache implements FileSystemLikeCache {
  private cacheDir: string;
  private maxSize: number;

  constructor(config: CacheConfig & { cacheDirectory?: string } = {}) {
    this.cacheDir = config.cacheDirectory || "./cache/email-validation";
    this.maxSize = config.maxSize || 10000;

    debug("File system cache initialized with directory: %s", this.cacheDir);
    this.ensureDirectory();
  }

  async ensureDirectory(): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
      debug("Created cache directory: %s", this.cacheDir);
    }
  }

  getFilePath(key: string): string {
    // Hash the key to create a valid filename
    const hash = Buffer.from(key).toString("base64url");
    return join(this.cacheDir, `${hash}.json`);
  }

  async get(key: string): Promise<EmailValidationResult | null> {
    const filePath = this.getFilePath(key);

    try {
      if (!existsSync(filePath)) return null;

      const data = JSON.parse(readFileSync(filePath, "utf-8"));

      // Check TTL
      if (data.expiresAt && Date.now() > data.expiresAt) {
        await this.delete(key);
        return null;
      }

      debug("File system cache hit for key: %s", key);
      return data.result;
    } catch (error) {
      debug("File system get error for key %s: %o", key, error);
      return null;
    }
  }

  async set(key: string, result: EmailValidationResult, ttl?: number): Promise<void> {
    await this.ensureDirectory();
    const filePath = this.getFilePath(key);

    try {
      const data = {
        result,
        timestamp: Date.now(),
        expiresAt: ttl ? Date.now() + ttl : null,
        hitCount: 0,
      };

      writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      debug("File system cache set for key: %s", key);
    } catch (error) {
      debug("File system set error for key %s: %o", key, error);
    }
  }

  async has(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    return existsSync(filePath);
  }

  async delete(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);

    try {
      if (existsSync(filePath)) {
        require("fs").unlinkSync(filePath);
        debug("File system deleted key: %s", key);
        return true;
      }
      return false;
    } catch (error) {
      debug("File system delete error for key %s: %o", key, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const files = require("fs").readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          require("fs").unlinkSync(join(this.cacheDir, file));
        }
      }
      debug("File system cache cleared");
    } catch (error) {
      debug("File system clear error: %o", error);
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const files = require("fs").readdirSync(this.cacheDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      return {
        size: jsonFiles.length,
        hitRate: 0, // Would need to track this
        entries: jsonFiles.length,
        customMetrics: {
          cacheDirectory: this.cacheDir,
          diskSize: await this.getFileSize(),
        },
      };
    } catch (error) {
      debug("File system stats error: %o", error);
      return { size: 0, hitRate: 0, entries: 0 };
    }
  }

  async getFileSize(): Promise<number> {
    try {
      const files = require("fs").readdirSync(this.cacheDir);
      let totalSize = 0;

      for (const file of files) {
        if (file.endsWith(".json")) {
          const stats = require("fs").statSync(join(this.cacheDir, file));
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }
}

export class FileSystemCacheFactory extends BaseCacheFactory {
  create(config?: CacheConfig): ICache {
    return new ExampleFileSystemCache(config);
  }

  getType(): string {
    return "filesystem";
  }
}
