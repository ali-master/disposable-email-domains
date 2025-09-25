/**
 * Type definitions for email validation and checking
 */

/**
 * Email validation result with detailed information
 */
export interface EmailValidationResult {
  email: string;
  isValid: boolean;
  isDisposable: boolean;
  isAllowed: boolean;
  isBlacklisted: boolean;
  domain: string;
  localPart: string;
  matchType: "exact" | "subdomain" | "pattern" | "none";
  confidence: number; // 0-100
  source?: string;
  validationTime: number; // milliseconds
  errors: string[];
  warnings: string[];
  // DNS validation results (optional)
  dnsValidation?: {
    hasMx: boolean;
    mxRecords: Array<{ exchange: string; priority: number }>;
    hasSpf: boolean;
    hasDmarc: boolean;
    isConnectable: boolean;
    dnsValidationTime: number;
  };
}

/**
 * Performance metrics for tracking validation operations
 */
export interface PerformanceMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  disposableDetected: number;
  allowedOverrides: number;
  blacklistedDetected: number;
  averageValidationTime: number;
  cacheHitRate: number;
  indexSize: number;
  lastUpdated: string;
  throughputPerSecond: number;
  // DNS metrics
  dnsValidations?: number;
  dnsSuccessRate?: number;
  averageDnsTime?: number;
}

/**
 * Configuration options for the email checker
 */
export interface EmailCheckerConfig {
  // Data sources
  disposableDomainsUrl?: string;
  localDataPath?: string;
  allowlistPath?: string;
  blacklistPath?: string;

  // Validation options
  strictValidation?: boolean;
  checkMxRecord?: boolean;
  enableSubdomainChecking?: boolean;
  enablePatternMatching?: boolean;

  // Advanced DNS validation options
  dnsValidation?: {
    timeout?: number;
    retries?: number;
    enableCaching?: boolean;
    cacheSize?: number;
    cacheTtl?: number;
    concurrency?: number;
    validateMxConnectivity?: boolean;
    checkSpfRecord?: boolean;
    checkDmarcRecord?: boolean;
    customDnsServers?: string[];
    fallbackDnsServers?: string[];
  };

  // Performance options
  enableCaching?: boolean;
  cacheSize?: number;
  enableIndexing?: boolean;
  indexingStrategy?: "trie" | "hash" | "bloom" | "hybrid";

  // Cache options
  cacheType?: string; // 'memory', 'redis', 'database', 'filesystem', 'noop', etc.
  cacheConfig?: {
    maxSize?: number;
    defaultTtl?: number;
    cleanupInterval?: number;
    [key: string]: any; // Allow custom config properties
  };
  customCache?: any; // Custom cache instance implementing ICache interface

  // Update options
  autoUpdate?: boolean;
  updateInterval?: number; // hours

  // Custom options
  customPatterns?: RegExp[];
  trustedDomains?: string[];
  suspiciousPatterns?: string[];
}

/**
 * Cache entry for validation results
 */
export interface CacheEntry {
  result: EmailValidationResult;
  timestamp: number;
  hitCount: number;
}

/**
 * Validation report structure
 */
export interface ValidationReport {
  summary: {
    total: number;
    valid: number;
    invalid: number;
    disposable: number;
    allowed: number;
    blacklisted: number;
  };
  details: EmailValidationResult[];
  performance: {
    totalTime: number;
    averageTimePerEmail: number;
    throughput: number;
  };
}

/**
 * Domain insights structure
 */
export interface DomainInsights {
  topLevelDomains: Map<string, number>;
  suspiciousPatterns: Map<string, number>;
  domainLengthDistribution: Map<string, number>;
  mostCommonSubdomains: Map<string, number>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  hitRate: number;
  entries: number;
}

/**
 * Performance benchmark results
 */
export interface BenchmarkResults {
  hash: number;
  trie: number;
  bloom: number;
  hybrid: number;
}
