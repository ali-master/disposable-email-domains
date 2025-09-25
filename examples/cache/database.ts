import { debug as createDebugger } from "debug";
import type {
  ICache,
  ICacheFactory,
  CacheConfig,
  CacheStats,
  RedisLikeCache,
  DatabaseLikeCache,
  FileSystemLikeCache,
  BaseCacheFactory,
} from "../src/client/cache-factory";
import type { EmailValidationResult } from "../src/client/types";

const debug = createDebugger("disposable-email:cache-database-example");

/**
 * Example Database cache implementation
 * Developers should replace this with actual database implementation
 */
export class ExampleDatabaseCache implements DatabaseLikeCache {
  private db: any; // Replace with actual database client type
  private tableName: string;

  constructor(config: CacheConfig & { database?: any; tableName?: string } = {}) {
    this.db = config.database; // Developer should pass database client instance
    this.tableName = config.tableName || "email_cache";

    debug("Database cache initialized with table: %s", this.tableName);
    this.initializeTable();
  }

  private async initializeTable(): Promise<void> {
    if (!this.db) return;

    try {
      // Example SQL - adapt to your database
      await this.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          key VARCHAR(255) PRIMARY KEY,
          result TEXT NOT NULL,
          timestamp BIGINT NOT NULL,
          hit_count INT DEFAULT 0,
          expires_at BIGINT,
          INDEX idx_expires_at (expires_at)
        )
      `);
      debug("Database table initialized: %s", this.tableName);
    } catch (error) {
      debug("Database initialization error: %o", error);
    }
  }

  async get(key: string): Promise<EmailValidationResult | null> {
    if (!this.db) return null;

    try {
      const rows = await this.query(
        `SELECT result, expires_at FROM ${this.tableName} WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)`,
        [key, Date.now()],
      );

      if (rows.length === 0) return null;

      // Update hit count
      await this.query(`UPDATE ${this.tableName} SET hit_count = hit_count + 1 WHERE key = ?`, [
        key,
      ]);

      debug("Database cache hit for key: %s", key);
      return JSON.parse(rows[0].result);
    } catch (error) {
      debug("Database get error for key %s: %o", key, error);
      return null;
    }
  }

  async set(key: string, result: EmailValidationResult, ttl?: number): Promise<void> {
    if (!this.db) return;

    try {
      const expiresAt = ttl ? Date.now() + ttl : null;
      const resultJson = JSON.stringify(result);

      await this.query(
        `INSERT INTO ${this.tableName} (key, result, timestamp, expires_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE result = ?, timestamp = ?, expires_at = ?`,
        [key, resultJson, Date.now(), expiresAt, resultJson, Date.now(), expiresAt],
      );

      debug("Database cache set for key: %s", key);
    } catch (error) {
      debug("Database set error for key %s: %o", key, error);
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.db) return false;

    try {
      const rows = await this.query(
        `SELECT 1 FROM ${this.tableName} WHERE key = ? AND (expires_at IS NULL OR expires_at > ?) LIMIT 1`,
        [key, Date.now()],
      );
      return rows.length > 0;
    } catch (error) {
      debug("Database has error for key %s: %o", key, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.db) return false;

    try {
      const result = await this.query(`DELETE FROM ${this.tableName} WHERE key = ?`, [key]);
      const deleted = result.affectedRows > 0;
      if (deleted) debug("Database deleted key: %s", key);
      return deleted;
    } catch (error) {
      debug("Database delete error for key %s: %o", key, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.db) return;

    try {
      await this.query(`TRUNCATE TABLE ${this.tableName}`);
      debug("Database cache cleared");
    } catch (error) {
      debug("Database clear error: %o", error);
    }
  }

  async getStats(): Promise<CacheStats> {
    if (!this.db) {
      return { size: 0, hitRate: 0, entries: 0 };
    }

    try {
      const [countRows, hitRows] = await Promise.all([
        this.query(
          `SELECT COUNT(*) as count FROM ${this.tableName} WHERE expires_at IS NULL OR expires_at > ?`,
          [Date.now()],
        ),
        this.query(`SELECT AVG(hit_count) as avg_hits FROM ${this.tableName}`),
      ]);

      return {
        size: countRows[0].count,
        hitRate: hitRows[0].avg_hits || 0,
        entries: countRows[0].count,
        customMetrics: {
          tableName: this.tableName,
        },
      };
    } catch (error) {
      debug("Database stats error: %o", error);
      return { size: 0, hitRate: 0, entries: 0 };
    }
  }

  async cleanup(ttlMs?: number): Promise<number> {
    if (!this.db) return 0;

    try {
      const result = await this.query(
        `DELETE FROM ${this.tableName} WHERE expires_at IS NOT NULL AND expires_at <= ?`,
        [Date.now()],
      );
      const deletedCount = result.affectedRows;
      debug("Database cleanup removed %d expired entries", deletedCount);
      return deletedCount;
    } catch (error) {
      debug("Database cleanup error: %o", error);
      return 0;
    }
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error("Database not configured");
    // This is where developers would implement their actual database query
    // Example: return await this.db.query(sql, params);
    throw new Error("Database query method must be implemented by developer");
  }

  async beginTransaction(): Promise<void> {
    if (this.db && this.db.beginTransaction) {
      await this.db.beginTransaction();
    }
  }

  async commit(): Promise<void> {
    if (this.db && this.db.commit) {
      await this.db.commit();
    }
  }

  async rollback(): Promise<void> {
    if (this.db && this.db.rollback) {
      await this.db.rollback();
    }
  }
}

export class DatabaseCacheFactory extends BaseCacheFactory {
  constructor(private database?: any) {
    super();
  }

  create(config?: CacheConfig): ICache {
    return new ExampleDatabaseCache({ ...config, database: this.database });
  }

  getType(): string {
    return "database";
  }
}
