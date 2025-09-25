// Export all types
export type {
  EmailValidationResult,
  PerformanceMetrics,
  EmailCheckerConfig,
  CacheEntry,
  ValidationReport,
  DomainInsights,
  CacheStats,
  BenchmarkResults,
} from "./types";

// Export cache factory types and interfaces
export type {
  ICache,
  ICacheFactory,
  CacheConfig,
  RedisLikeCache,
  DatabaseLikeCache,
  FileSystemLikeCache,
  IEventDrivenCache,
  CacheEvent,
  CacheEventType,
} from "./cache-factory";

// Export main classes
export { DisposableEmailChecker } from "./disposable-email-checker";

// Export individual components for advanced usage
export { TrieIndex } from "./trie-index";
export { BloomFilter } from "./bloom-filter";
export { CacheManager } from "./cache-manager";
export { MetricsManager } from "./metrics-manager";
export { DataLoader } from "./data-loader";
export { EmailValidator } from "./email-validator";
export { DomainChecker } from "./domain-checker";
export { AnalyticsEngine } from "./analytics-engine";

// Export cache factory components
export { BaseCacheFactory } from "./cache-factory";
export {
  MemoryCache,
  NoOpCache,
  MemoryCacheFactory,
  NoOpCacheFactory,
  CacheFactoryRegistry,
} from "./cache-factory-impl";

// Convenience functions
import { DisposableEmailChecker } from "./disposable-email-checker";
import type { EmailCheckerConfig, EmailValidationResult } from "./types";

/**
 * Create a new email checker instance with optional configuration
 */
export const createEmailChecker = (config?: Partial<EmailCheckerConfig>): DisposableEmailChecker =>
  new DisposableEmailChecker(config);

/**
 * Quick email validation with default configuration
 */
export const quickCheck = async (
  email: string,
  config?: Partial<EmailCheckerConfig>,
): Promise<EmailValidationResult> => {
  const checker = new DisposableEmailChecker(config);
  return await checker.checkEmail(email);
};

/**
 * Batch email validation with default configuration
 */
export const quickCheckBatch = async (
  emails: string[],
  config?: Partial<EmailCheckerConfig>,
): Promise<EmailValidationResult[]> => {
  const checker = new DisposableEmailChecker(config);
  return await checker.checkEmailsBatch(emails);
};

/**
 * Create email checker with custom cache
 */
export const createEmailCheckerWithCache = (
  customCache: any,
  config?: Partial<EmailCheckerConfig>,
): DisposableEmailChecker => {
  return new DisposableEmailChecker({
    ...config,
    customCache,
  });
};

/**
 * Default export for the main class
 */
export default DisposableEmailChecker;
