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

/**
 * Advanced Email Disposable Checker with comprehensive features
 */
export class DisposableEmailChecker {
  private config: Required<EmailCheckerConfig>;
  private disposableDomainsSet = new Set<string>();
  private allowlistSet = new Set<string>();
  private blacklistSet = new Set<string>();

  // Component instances
  private domainTrie?: TrieIndex;
  private bloomFilter?: BloomFilter;
  private cacheManager: CacheManager | undefined;
  private metricsManager: MetricsManager;
  private dataLoader: DataLoader;
  private emailValidator: EmailValidator;
  private domainChecker: DomainChecker;
  private analyticsEngine: AnalyticsEngine;

  private lastUpdateTime = 0;

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
      customPatterns: [],
      trustedDomains: ["gmail.com", "outlook.com", "yahoo.com", "hotmail.com"],
      suspiciousPatterns: [],
      // Cache configuration defaults
      cacheType: "memory",
      cacheConfig: {
        maxSize: 10000,
        defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
        cleanupInterval: 60 * 60 * 1000, // 1 hour
      },
      customCache: undefined,
      ...config,
    };

    // Initialize components
    this.initializeCacheManager();
    this.metricsManager = new MetricsManager();
    this.dataLoader = new DataLoader();
    this.emailValidator = new EmailValidator(this.config.strictValidation);
    this.analyticsEngine = new AnalyticsEngine(this.disposableDomainsSet);

    // Initialize domain checker (will be properly configured after data loading)
    this.domainChecker = new DomainChecker(
      this.disposableDomainsSet,
      this.allowlistSet,
      this.blacklistSet,
      this.config.trustedDomains,
      this.config.enableSubdomainChecking,
    );

    this.initialize();
  }

  /**
   * Initialize cache manager with proper configuration
   */
  private initializeCacheManager(): void {
    if (!this.config.enableCaching) {
      // Use no-op cache when caching is disabled
      this.cacheManager = new CacheManager("noop");
      return;
    }

    // Use custom cache instance if provided
    if (this.config.customCache) {
      this.cacheManager = new CacheManager(this.config.customCache);
      return;
    }

    // Merge cache configuration with backward compatibility
    const cacheConfig = {
      maxSize: this.config.cacheSize || this.config.cacheConfig?.maxSize || 10000,
      defaultTtl: this.config.cacheConfig?.defaultTtl || 24 * 60 * 60 * 1000,
      cleanupInterval: this.config.cacheConfig?.cleanupInterval,
      ...this.config.cacheConfig,
    };

    // Use specified cache type or default to memory
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

      // Update components with loaded data
      this.updateComponents();

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

    this.analyticsEngine.updateDisposableDomains(this.disposableDomainsSet);
  }

  /**
   * Main email validation and checking method
   */
  public async checkEmail(email: string): Promise<EmailValidationResult> {
    const startTime = performance.now();

    try {
      // Check cache first
      if (this.config.enableCaching) {
        const cached = await this.cacheManager!.get(email);
        if (cached) {
          this.metricsManager.updateMetrics("cache_hit");

          return {
            ...cached,
            validationTime: performance.now() - startTime,
          };
        }
      }

      const result = await this.performEmailCheck(email, startTime);

      // Cache the result
      if (this.config.enableCaching) {
        await this.cacheManager!.set(email, result);
      }

      this.metricsManager.updateMetrics("validation", result);
      this.metricsManager.updateCacheHitRate((await this.cacheManager!.getStats()).hitRate);

      return result;
    } catch (error) {
      this.metricsManager.updateMetrics("error");
      return {
        email,
        isValid: false,
        isDisposable: false,
        isAllowed: false,
        isBlacklisted: false,
        domain: "",
        localPart: "",
        matchType: "none",
        confidence: 0,
        validationTime: performance.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }
  }

  /**
   * Perform comprehensive email validation and checking
   */
  private async performEmailCheck(
    email: string,
    startTime: number,
  ): Promise<EmailValidationResult> {
    const result: EmailValidationResult = {
      email: email.toLowerCase(),
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

    // Step 6: Pattern-based analysis
    if (this.config.enablePatternMatching) {
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

    // Step 7: MX record validation (if enabled)
    if (this.config.checkMxRecord) {
      try {
        const hasMx = await this.emailValidator.checkMxRecord(domain);
        if (!hasMx) {
          result.warnings.push("No MX record found for domain");
          result.confidence = Math.max(result.confidence, 60);
        }
      } catch (error) {
        result.warnings.push("Failed to check MX record");
      }
    }

    result.validationTime = performance.now() - startTime;
    return result;
  }

  /**
   * Batch email validation for improved performance
   */
  public async checkEmailsBatch(emails: string[]): Promise<EmailValidationResult[]> {
    const startTime = performance.now();
    const results: EmailValidationResult[] = [];

    // Process in chunks for better memory management
    const chunkSize = 100;
    for (let i = 0; i < emails.length; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map((email) => this.checkEmail(email)));
      results.push(...chunkResults);
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
    return this.analyticsEngine.generateValidationReport(results);
  }

  /**
   * Get domain statistics and insights
   */
  public getDomainInsights(): DomainInsights {
    return this.analyticsEngine.getDomainInsights();
  }

  /**
   * Advanced search with fuzzy matching
   */
  public searchSimilarDomains(domain: string, threshold = 0.8): string[] {
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
}
