import { debug as createDebugger } from "debug";
import type {
  EmailValidationResult,
  EmailCheckerConfig,
  PerformanceMetrics,
  CacheStats,
  ValidationReport,
  DomainInsights,
  BenchmarkResults,
} from "./types";
import { TrieIndex } from "./trie-index";
import { BloomFilter } from "./bloom-filter";
import { CacheManager } from "./cache-manager";
import { MetricsManager } from "./metrics-manager";
import { DataLoader } from "./data-loader";
import { EmailValidator } from "./email-validator";
import { DomainChecker } from "./domain-checker";
import { AnalyticsEngine } from "./analytics-engine";

const debug = createDebugger("disposable-email:disposable-email-checker");

// Pre-compile regex patterns for reuse
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

// Object pools for result reuse
const resultPool: EmailValidationResult[] = [];
const getPooledResult = (): EmailValidationResult => {
  if (resultPool.length > 0) {
    const result = resultPool.pop()!;
    // Reset properties
    result.email = "";
    result.isValid = false;
    result.isDisposable = false;
    result.isAllowed = false;
    result.isBlacklisted = false;
    result.domain = "";
    result.localPart = "";
    result.matchType = "none";
    result.confidence = 0;
    result.validationTime = 0;
    result.errors.length = 0;
    result.warnings.length = 0;
    result.source = undefined;
    return result;
  }
  return {
    email: "",
    isValid: false,
    isDisposable: false,
    isAllowed: false,
    isBlacklisted: false,
    domain: "",
    localPart: "",
    matchType: "none",
    confidence: 0,
    validationTime: 0,
    errors: [],
    warnings: [],
  };
};

const returnToPool = (result: EmailValidationResult): void => {
  if (resultPool.length < 1000) {
    resultPool.push(result);
  }
};

/**
 * Advanced Email Disposable Checker with features
 */
export class DisposableEmailChecker {
  private config: Required<EmailCheckerConfig>;
  private disposableDomainsSet = new Set<string>();
  private allowlistSet = new Set<string>();
  private blacklistSet = new Set<string>();

  // Component instances - lazy initialized
  private domainTrie?: TrieIndex;
  private bloomFilter?: BloomFilter;
  private cacheManager: CacheManager | undefined;
  private metricsManager: MetricsManager;
  private dataLoader: DataLoader;
  private emailValidator: EmailValidator;
  private domainChecker: DomainChecker;
  private analyticsEngine?: AnalyticsEngine;

  private lastUpdateTime = 0;
  private initialized = false;
  private initializationPromise?: Promise<void>;

  // Cache frequently used arrays to avoid allocations
  private static readonly TRUSTED_DOMAINS = Object.freeze([
    "gmail.com",
    "outlook.com",
    "yahoo.com",
    "hotmail.com",
  ]);
  private static readonly EMPTY_PATTERNS = Object.freeze([]);

  constructor(config: Partial<EmailCheckerConfig> = {}) {
    this.config = {
      disposableDomainsUrl:
        "https://raw.githubusercontent.com/ali-master/disposable-email-domains/data/domains.txt",
      localDataPath: "data/domains.txt",
      allowlistPath: "config/allowlist.txt",
      blacklistPath: "config/blacklist.txt",
      strictValidation: false,
      checkMxRecord: false,
      enableSubdomainChecking: true,
      enablePatternMatching: true,
      enableCaching: true,
      cacheSize: 10000,
      enableIndexing: true,
      indexingStrategy: "hybrid",
      autoUpdate: false,
      updateInterval: 24,
      // Advanced DNS validation defaults
      dnsValidation: {
        timeout: 5000,
        retries: 3,
        enableCaching: true,
        cacheSize: 5000,
        cacheTtl: 300000, // 5 minutes
        concurrency: 10,
        validateMxConnectivity: false,
        checkSpfRecord: false,
        checkDmarcRecord: false,
        fallbackDnsServers: ["8.8.8.8", "1.1.1.1", "208.67.222.222"],
      },
      // @ts-expect-error
      customPatterns: DisposableEmailChecker.EMPTY_PATTERNS,
      // @ts-expect-error
      trustedDomains: DisposableEmailChecker.TRUSTED_DOMAINS,
      // @ts-expect-error
      suspiciousPatterns: DisposableEmailChecker.EMPTY_PATTERNS,
      // Cache configuration defaults
      cacheType: "memory",
      cacheConfig: {
        maxSize: 10000,
        defaultTtl: 86400000, // Pre-calculated: 24 * 60 * 60 * 1000
        cleanupInterval: 3600000, // Pre-calculated: 60 * 60 * 1000
      },
      customCache: undefined,
      ...config,
    };

    // Initialize only essential components immediately
    this.initializeCacheManager();
    this.metricsManager = new MetricsManager();
    this.dataLoader = new DataLoader();
    // Initialize EmailValidator with DNS configuration
    this.emailValidator = new EmailValidator(
      this.config.strictValidation,
      this.config.dnsValidation,
    );

    // Initialize domain checker with empty sets (will be updated after data loading)
    this.domainChecker = new DomainChecker(
      this.disposableDomainsSet,
      this.allowlistSet,
      this.blacklistSet,
      this.config.trustedDomains,
      this.config.enableSubdomainChecking,
    );
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (!this.initializationPromise) {
      this.initializationPromise = this.initialize();
    }

    await this.initializationPromise;
  }

  /**
   * Initialize cache manager with proper configuration
   */
  private initializeCacheManager(): void {
    if (!this.config.enableCaching) {
      this.cacheManager = new CacheManager("noop");
      return;
    }

    if (this.config.customCache) {
      this.cacheManager = new CacheManager(this.config.customCache);
      return;
    }

    const cacheConfig = {
      maxSize: this.config.cacheSize || this.config.cacheConfig?.maxSize || 10000,
      defaultTtl: this.config.cacheConfig?.defaultTtl || 86400000,
      cleanupInterval: this.config.cacheConfig?.cleanupInterval,
      ...this.config.cacheConfig,
    };

    const cacheType = this.config.cacheType || "memory";
    this.cacheManager = new CacheManager(cacheType, cacheConfig);
  }

  /**
   * Initialize the email checker with data loading and indexing
   */
  private async initialize(): Promise<void> {
    try {
      await this.loadAllData();

      if (this.config.enableIndexing) {
        await this.buildIndex();
      }

      this.updateComponents();
      this.initialized = true;

      debug(
        "AdvancedEmailChecker initialized with %d disposable domains",
        this.disposableDomainsSet.size,
      );
    } catch (error) {
      debug("Failed to initialize AdvancedEmailChecker: %o", error);
      throw error;
    }
  }

  /**
   * Load all data (disposable domains, allowlist, blacklist)
   */
  private async loadAllData(): Promise<void> {
    const [disposableDomains, allowlist, blacklist] = await Promise.all([
      this.dataLoader.loadDisposableDomains(
        this.config.localDataPath,
        this.config.disposableDomainsUrl,
        this.config.autoUpdate,
      ),
      this.dataLoader.loadAllowlist(this.config.allowlistPath),
      this.dataLoader.loadBlacklist(this.config.blacklistPath),
    ]);

    this.disposableDomainsSet = disposableDomains;
    this.allowlistSet = allowlist;
    this.blacklistSet = blacklist;
    this.lastUpdateTime = Date.now();
  }

  /**
   * Build search index based on configuration
   */
  private async buildIndex(): Promise<void> {
    const startTime = Date.now();

    switch (this.config.indexingStrategy) {
      case "trie":
        this.buildTrieIndex();
        break;
      case "bloom":
        this.buildBloomFilter();
        break;
      case "hybrid":
        this.buildTrieIndex();
        this.buildBloomFilter();
        break;
      case "hash":
        // Hash-based indexing is already implemented via Set
        break;
    }

    const buildTime = Date.now() - startTime;
    debug("Built %s index in %d ms", this.config.indexingStrategy, buildTime);

    this.metricsManager.updateIndexSize(this.disposableDomainsSet.size);
  }

  /**
   * Build trie index for efficient prefix matching
   */
  private buildTrieIndex(): void {
    this.domainTrie = new TrieIndex();

    for (const domain of this.disposableDomainsSet) {
      this.domainTrie.insert(domain, "disposable");
    }

    for (const domain of this.allowlistSet) {
      this.domainTrie.insert(domain, "allowed");
    }

    for (const domain of this.blacklistSet) {
      this.domainTrie.insert(domain, "blacklisted");
    }
  }

  /**
   * Build bloom filter for fast membership testing
   */
  private buildBloomFilter(): void {
    const totalDomains = this.disposableDomainsSet.size + this.blacklistSet.size;
    this.bloomFilter = new BloomFilter(totalDomains, 0.01);

    for (const domain of this.disposableDomainsSet) {
      this.bloomFilter.add(domain);
    }

    for (const domain of this.blacklistSet) {
      this.bloomFilter.add(domain);
    }
  }

  /**
   * Update components with loaded data
   */
  private updateComponents(): void {
    this.domainChecker = new DomainChecker(
      this.disposableDomainsSet,
      this.allowlistSet,
      this.blacklistSet,
      this.config.trustedDomains,
      this.config.enableSubdomainChecking,
      this.domainTrie,
      this.bloomFilter,
      this.config.indexingStrategy,
    );

    // Lazy initialize analytics engine only when needed
    if (!this.analyticsEngine) {
      this.analyticsEngine = new AnalyticsEngine(this.disposableDomainsSet);
    } else {
      this.analyticsEngine.updateDisposableDomains(this.disposableDomainsSet);
    }
  }

  /**
   * Main email validation and checking method
   */
  public async checkEmail(email: string): Promise<EmailValidationResult> {
    await this.ensureInitialized();

    const startTime = performance.now();
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Quick format validation before cache check
      if (!EMAIL_PATTERN.test(normalizedEmail)) {
        const result = getPooledResult();
        result.email = normalizedEmail;
        result.validationTime = performance.now() - startTime;
        result.errors.push("Invalid email format");
        return result;
      }

      // Check cache first
      if (this.config.enableCaching) {
        const cached = await this.cacheManager!.get(normalizedEmail);
        if (cached) {
          this.metricsManager.updateMetrics("cache_hit");
          cached.validationTime = performance.now() - startTime;
          return cached;
        }
      }

      const result = await this.performEmailCheck(normalizedEmail, startTime);

      // Cache the result
      if (this.config.enableCaching) {
        await this.cacheManager!.set(normalizedEmail, result);
      }

      this.metricsManager.updateMetrics("validation", result);
      this.metricsManager.updateCacheHitRate((await this.cacheManager!.getStats()).hitRate);

      return result;
    } catch (error) {
      this.metricsManager.updateMetrics("error");
      const result = getPooledResult();
      result.email = normalizedEmail;
      result.validationTime = performance.now() - startTime;
      result.errors.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  /**
   * Perform email validation and checking
   */
  private async performEmailCheck(
    email: string,
    startTime: number,
  ): Promise<EmailValidationResult> {
    const result = getPooledResult();
    result.email = email;

    // Step 1: Basic format validation
    const isValidFormat = this.emailValidator.validateEmailFormat(email, result);
    if (!isValidFormat) {
      result.validationTime = performance.now() - startTime;
      return result;
    }

    // Step 2: Parse email components
    const { localPart, domain } = this.emailValidator.parseEmail(email);
    result.localPart = localPart;
    result.domain = domain;
    result.isValid = true;

    // Step 3: Check against allowlist (highest priority)
    if (this.domainChecker.checkAllowlist(domain)) {
      result.isAllowed = true;
      result.matchType = "exact";
      result.confidence = 100;
      result.validationTime = performance.now() - startTime;
      return result;
    }

    // Step 4: Check against blacklist
    const blacklistResult = this.domainChecker.checkBlacklist(domain);
    if (blacklistResult.isMatch) {
      result.isBlacklisted = true;
      result.matchType = blacklistResult.matchType;
      result.confidence = blacklistResult.confidence;
    }

    // Step 5: Check for disposable domains
    const disposableResult = await this.domainChecker.checkDisposableDomain(domain);
    if (disposableResult.isMatch) {
      result.isDisposable = true;
      result.matchType = disposableResult.matchType;
      result.confidence = Math.max(result.confidence, disposableResult.confidence);
      result.source = disposableResult.source;
    }

    // Step 6: Pattern-based analysis (only if enabled and patterns exist)
    if (this.config.enablePatternMatching && this.config.customPatterns.length > 0) {
      const patternResult = this.emailValidator.analyzePatterns(
        email,
        localPart,
        domain,
        this.config.customPatterns,
      );
      if (patternResult.suspiciousScore > 0) {
        result.warnings = patternResult.warnings;
        result.confidence = Math.max(result.confidence, patternResult.suspiciousScore);

        if (patternResult.suspiciousScore >= 80) {
          result.isDisposable = true;
          result.matchType = "pattern";
        }
      }
    }

    // Step 7: DNS record validation (or simple)
    if (this.config.checkMxRecord) {
      try {
        // Check if DNS validation is enabled
        const dnsConfig = this.config.dnsValidation;
        const needsValidation =
          dnsConfig?.validateMxConnectivity ||
          dnsConfig?.checkSpfRecord ||
          dnsConfig?.checkDmarcRecord;

        if (needsValidation) {
          //  DNS validation
          const dnsResult = await this.emailValidator.validateMxRecord(domain);
          result.dnsValidation = {
            hasMx: dnsResult.hasMx,
            mxRecords: dnsResult.mxRecords,
            hasSpf: dnsResult.hasSpf,
            hasDmarc: dnsResult.hasDmarc,
            isConnectable: dnsResult.isConnectable,
            dnsValidationTime: dnsResult.validationTime,
          };

          if (!dnsResult.hasMx) {
            result.warnings.push("No MX record found for domain");
            result.confidence = Math.max(result.confidence, 60);
          }

          // Add additional warnings based on DNS validation
          result.warnings.push(...dnsResult.warnings);

          if (dnsResult.errors.length > 0) {
            result.warnings.push("DNS validation encountered errors");
          }
        } else {
          // Simple MX record check (backward compatibility)
          const hasMx = await this.emailValidator.checkMxRecord(domain);
          if (!hasMx) {
            result.warnings.push("No MX record found for domain");
            result.confidence = Math.max(result.confidence, 60);
          }
        }
      } catch (error) {
        result.warnings.push("Failed to check DNS records");
      }
    }

    result.validationTime = performance.now() - startTime;
    return result;
  }

  /**
   * Batch email validation for improved performance
   */
  public async checkEmailsBatch(emails: string[]): Promise<EmailValidationResult[]> {
    await this.ensureInitialized();

    const startTime = performance.now();
    const results: EmailValidationResult[] = [];

    // Pre-normalize and filter emails
    const normalizedEmails = emails.map((email) => email.toLowerCase().trim());
    const uniqueEmails = [...new Set(normalizedEmails)];

    // Check cache for all emails at once
    const cachePromises = this.config.enableCaching
      ? uniqueEmails.map((email) => this.cacheManager!.get(email))
      : [];

    const cachedResults = this.config.enableCaching ? await Promise.all(cachePromises) : [];

    const uncachedEmails: string[] = [];
    const resultMap = new Map<string, EmailValidationResult>();

    // Separate cached vs uncached
    for (let i = 0; i < uniqueEmails.length; i++) {
      const email = uniqueEmails[i];
      const cached = cachedResults[i];

      if (cached) {
        resultMap.set(email, cached);
        this.metricsManager.updateMetrics("cache_hit");
      } else {
        uncachedEmails.push(email);
      }
    }

    // Process uncached emails in optimized chunks
    const chunkSize = Math.min(50, Math.max(10, Math.floor(uncachedEmails.length / 4)));
    const processingPromises: Promise<void>[] = [];

    for (let i = 0; i < uncachedEmails.length; i += chunkSize) {
      const chunk = uncachedEmails.slice(i, i + chunkSize);

      processingPromises.push(
        Promise.all(chunk.map((email) => this.checkEmail(email))).then((chunkResults) => {
          for (let j = 0; j < chunk.length; j++) {
            resultMap.set(chunk[j], chunkResults[j]);
          }
        }),
      );
    }

    await Promise.all(processingPromises);

    // Maintain original order and handle duplicates
    for (const email of normalizedEmails) {
      results.push(resultMap.get(email)!);
    }

    const totalTime = performance.now() - startTime;
    debug("Batch processed %d emails in %d ms", emails.length, Math.round(totalTime));

    return results;
  }

  /**
   * Generate detailed validation report
   */
  public async generateValidationReport(emails: string[]): Promise<ValidationReport> {
    const results = await this.checkEmailsBatch(emails);
    // @ts-expect-error
    return this.analyticsEngine?.generateValidationReport(results);
  }

  /**
   * Get domain statistics and insights
   */
  public getDomainInsights(): DomainInsights {
    if (!this.analyticsEngine) {
      this.analyticsEngine = new AnalyticsEngine(this.disposableDomainsSet);
    }
    return this.analyticsEngine.getDomainInsights();
  }

  /**
   * Advanced search with fuzzy matching
   */
  public searchSimilarDomains(domain: string, threshold = 0.8): string[] {
    if (!this.analyticsEngine) {
      this.analyticsEngine = new AnalyticsEngine(this.disposableDomainsSet);
    }
    return this.analyticsEngine.searchSimilarDomains(domain, threshold);
  }

  /**
   * Force update of disposable domains
   */
  public async forceUpdate(): Promise<void> {
    debug("Forcing update of disposable domains...");
    await this.loadAllData();

    if (this.config.enableIndexing) {
      await this.buildIndex();
    }

    this.updateComponents();
    debug("Force update completed");
  }

  /**
   * Add domain to custom allowlist
   */
  public addToAllowlist(domain: string): void {
    this.domainChecker.addToAllowlist(domain);
  }

  /**
   * Add domain to custom blacklist
   */
  public addToBlacklist(domain: string): void {
    this.domainChecker.addToBlacklist(domain);
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return this.metricsManager.getMetrics();
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<CacheStats> {
    return this.cacheManager!.getStats();
  }

  /**
   * Clear cache
   */
  public async clearCache(): Promise<void> {
    await this.cacheManager!.clear();
    debug("Cache cleared");
  }

  /**
   * Export metrics and statistics to JSON
   */
  public async exportStatistics(): Promise<string> {
    const stats = {
      metrics: this.getMetrics(),
      cacheStats: await this.getCacheStats(),
      domainCounts: this.domainChecker.getDomainCounts(),
      configuration: this.config,
      lastUpdate: new Date(this.lastUpdateTime).toISOString(),
    };

    return JSON.stringify(stats, null, 2);
  }

  /**
   * Switch cache backend at runtime
   */
  public async switchCacheBackend(cacheTypeOrInstance: string | any, config?: any): Promise<void> {
    await this.cacheManager!.switchCache(cacheTypeOrInstance, config);
    debug(
      "Cache backend switched to: %s",
      typeof cacheTypeOrInstance === "string" ? cacheTypeOrInstance : "custom",
    );
  }

  /**
   * Perform cache cleanup
   */
  public async cleanupCache(ttlMs?: number): Promise<number> {
    const removedCount = await this.cacheManager!.cleanup(ttlMs);
    debug("Cache cleanup removed %d entries", removedCount);
    return removedCount;
  }

  /**
   * Close all resources (cache connections, etc.)
   */
  public async close(): Promise<void> {
    await this.cacheManager!.close();
    debug("DisposableEmailChecker resources closed");
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<EmailCheckerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update components that depend on config
    this.emailValidator.setStrictValidation(this.config.strictValidation);

    // Rebuild index if indexing strategy changed
    if (newConfig.indexingStrategy && this.config.enableIndexing) {
      void this.buildIndex();
      this.updateComponents();
    }
  }

  /**
   * Get configuration
   */
  public getConfig(): Required<EmailCheckerConfig> {
    return { ...this.config };
  }

  /**
   *  DNS validation for a domain
   */
  public async validateDomain(
    domain: string,
  ): Promise<import("./dns-resolver").DnsValidationResult> {
    await this.ensureInitialized();
    return this.emailValidator.validateMxRecord(domain);
  }

  /**
   * Batch DNS validation for multiple domains
   */
  public async validateDomainsBatch(
    domains: string[],
  ): Promise<Map<string, import("./dns-resolver").DnsValidationResult>> {
    await this.ensureInitialized();
    return this.emailValidator.validateMxRecordsBatch(domains);
  }

  /**
   * Update DNS resolver configuration
   */
  public updateDnsConfig(newConfig: Partial<import("./dns-resolver").DnsResolverConfig>): void {
    this.emailValidator.updateDnsConfig(newConfig);
    debug("DNS configuration updated");
  }

  /**
   * Get statistics including DNS performance
   */
  public getStats(): {
    performance: PerformanceMetrics;
    cache: Promise<CacheStats>;
    dns: ReturnType<EmailValidator["getStats"]>["dnsStats"];
    domains: ReturnType<DomainChecker["getDomainCounts"]>;
  } {
    return {
      performance: this.getMetrics(),
      cache: this.getCacheStats(),
      dns: this.emailValidator.getStats().dnsStats,
      domains: this.domainChecker.getDomainCounts(),
    };
  }

  /**
   * Clear all caches (email validation and DNS)
   */
  public async clearAllCaches(): Promise<void> {
    await this.clearCache();
    this.emailValidator.clearDnsCache();
    this.domainChecker.clearCache();
    debug("All caches cleared");
  }
}
