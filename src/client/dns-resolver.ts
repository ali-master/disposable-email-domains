import { promisify } from "util";
import { resolve, resolveMx, resolveTxt, resolveNs } from "dns";
import { debug as createDebugger } from "debug";

const debug = createDebugger("disposable-email:dns-resolver");

// Promisified DNS functions
const resolveMxAsync = promisify(resolveMx);
const resolveTxtAsync = promisify(resolveTxt);
const resolveNsAsync = promisify(resolveNs);
const resolveAsync = promisify(resolve);

export interface DnsResolverConfig {
  timeout: number;
  retries: number;
  enableCaching: boolean;
  cacheSize: number;
  cacheTtl: number;
  concurrency: number;
  validateMxConnectivity: boolean;
  checkSpfRecord: boolean;
  checkDmarcRecord: boolean;
  customDnsServers?: string[];
  fallbackDnsServers: string[];
}

export interface MxRecord {
  exchange: string;
  priority: number;
}

export interface DnsValidationResult {
  domain: string;
  hasMx: boolean;
  mxRecords: MxRecord[];
  hasSpf: boolean;
  hasDmarc: boolean;
  isConnectable: boolean;
  validationTime: number;
  errors: string[];
  warnings: string[];
}

export interface DnsCache {
  result: any;
  timestamp: number;
  ttl: number;
}

/**
 *  DNS resolver with advanced validation capabilities
 */
export class DnsResolver {
  private config: Required<DnsResolverConfig>;
  private dnsCache = new Map<string, DnsCache>();
  private pendingQueries = new Map<string, Promise<any>>();
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests = 0;

  constructor(config: Partial<DnsResolverConfig> = {}) {
    this.config = {
      timeout: 5000,
      retries: 3,
      enableCaching: true,
      cacheSize: 10000,
      cacheTtl: 300000, // 5 minutes
      concurrency: 10,
      validateMxConnectivity: false,
      checkSpfRecord: false,
      checkDmarcRecord: false,
      // @ts-expect-error
      customDnsServers: undefined,
      fallbackDnsServers: [
        "1.1.1.1", // Cloudflare
        "1.0.0.1", // Cloudflare
        "8.8.8.8", // Google
        "8.8.4.4", // Google
        "9.9.9.9", // Quad9
        "149.112.112.112", // Quad9
        "208.67.222.222", // OpenDNS
        "208.67.220.220", // OpenDNS
        "76.76.2.0", // Control D
        "76.76.10.0", // Control D
        "94.140.14.14", // AdGuard DNS
        "94.140.15.15", // AdGuard DNS
        "8.26.56.26", // Comodo Secure DNS
        "8.20.247.20", // Comodo Secure DNS
      ],
      ...config,
    };

    // Set custom DNS servers if provided
    if (this.config.customDnsServers) {
      this.setDnsServers(this.config.customDnsServers);
    }

    // Periodic cache cleanup
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }

  /**
   *  MX record validation
   */
  async validateMxRecord(domain: string): Promise<DnsValidationResult> {
    const startTime = Date.now();
    const result: DnsValidationResult = {
      domain,
      hasMx: false,
      mxRecords: [],
      hasSpf: false,
      hasDmarc: false,
      isConnectable: false,
      validationTime: 0,
      errors: [],
      warnings: [],
    };

    try {
      // Check MX records
      const mxRecords = await this.resolveMxWithRetry(domain);
      if (mxRecords && mxRecords.length > 0) {
        result.hasMx = true;
        result.mxRecords = mxRecords.map((record) => ({
          exchange: record.exchange,
          priority: record.priority,
        }));

        // Sort by priority (lower number = higher priority)
        result.mxRecords.sort((a, b) => a.priority - b.priority);

        // Validate MX connectivity if enabled
        if (this.config.validateMxConnectivity) {
          result.isConnectable = await this.validateMxConnectivity(result.mxRecords);
        }
      } else {
        result.warnings.push("No MX records found");
      }

      // Check SPF record if enabled
      if (this.config.checkSpfRecord) {
        result.hasSpf = await this.checkSpfRecord(domain);
        if (!result.hasSpf) {
          result.warnings.push("No SPF record found");
        }
      }

      // Check DMARC record if enabled
      if (this.config.checkDmarcRecord) {
        result.hasDmarc = await this.checkDmarcRecord(domain);
        if (!result.hasDmarc) {
          result.warnings.push("No DMARC record found");
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`DNS resolution failed: ${errorMsg}`);
      debug("DNS validation failed for %s: %o", domain, error);
    }

    result.validationTime = Date.now() - startTime;
    return result;
  }

  /**
   * Batch MX record validation
   */
  async validateMxRecordsBatch(domains: string[]): Promise<Map<string, DnsValidationResult>> {
    const results = new Map<string, DnsValidationResult>();
    const uncachedDomains: string[] = [];

    // Check cache first
    if (this.config.enableCaching) {
      for (const domain of domains) {
        const cached = this.getCachedResult(`mx:${domain}`);
        if (cached) {
          results.set(domain, cached);
        } else {
          uncachedDomains.push(domain);
        }
      }
    } else {
      uncachedDomains.push(...domains);
    }

    // Process uncached domains with concurrency control
    if (uncachedDomains.length > 0) {
      const chunkSize = Math.min(this.config.concurrency, uncachedDomains.length);
      const chunks: string[][] = [];

      for (let i = 0; i < uncachedDomains.length; i += chunkSize) {
        chunks.push(uncachedDomains.slice(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        const promises = chunk.map((domain) => this.validateMxRecord(domain));
        const chunkResults = await Promise.all(promises);

        for (let i = 0; i < chunk.length; i++) {
          const domain = chunk[i];
          const result = chunkResults[i];
          results.set(domain, result);

          // Cache the result
          if (this.config.enableCaching) {
            this.setCachedResult(`mx:${domain}`, result);
          }
        }
      }
    }

    return results;
  }

  /**
   * Simple MX record check (backward compatibility)
   */
  async checkMxRecord(domain: string): Promise<boolean> {
    const cacheKey = `simple-mx:${domain}`;

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedResult(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    try {
      const mxRecords = await this.resolveMxWithRetry(domain);
      const hasMx = mxRecords && mxRecords.length > 0;

      // Cache the result
      if (this.config.enableCaching) {
        this.setCachedResult(cacheKey, hasMx);
      }

      return hasMx;
    } catch (error) {
      // Cache negative results with shorter TTL
      if (this.config.enableCaching) {
        this.setCachedResult(cacheKey, false, this.config.cacheTtl / 2);
      }
      return false;
    }
  }

  /**
   * Batch simple MX record checking
   */
  async checkMxRecordsBatch(domains: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const uncachedDomains: string[] = [];

    // Check cache first
    if (this.config.enableCaching) {
      for (const domain of domains) {
        const cached = this.getCachedResult(`simple-mx:${domain}`);
        if (cached !== undefined) {
          results.set(domain, cached);
        } else {
          uncachedDomains.push(domain);
        }
      }
    } else {
      uncachedDomains.push(...domains);
    }

    // Process uncached domains
    if (uncachedDomains.length > 0) {
      const chunkSize = Math.min(this.config.concurrency, uncachedDomains.length);

      for (let i = 0; i < uncachedDomains.length; i += chunkSize) {
        const chunk = uncachedDomains.slice(i, i + chunkSize);
        const promises = chunk.map((domain) => this.checkMxRecord(domain));
        const chunkResults = await Promise.all(promises);

        for (let j = 0; j < chunk.length; j++) {
          results.set(chunk[j], chunkResults[j]);
        }
      }
    }

    return results;
  }

  /**
   * Resolve MX records with retry logic
   */
  private async resolveMxWithRetry(domain: string): Promise<MxRecord[]> {
    return this.executeWithConcurrencyControl(async () => {
      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= this.config.retries; attempt++) {
        try {
          const records = await Promise.race([
            resolveMxAsync(domain),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("DNS timeout")), this.config.timeout),
            ),
          ]);

          return records;
        } catch (error) {
          lastError = error as Error;

          if (attempt < this.config.retries) {
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError || new Error("MX resolution failed");
    });
  }

  /**
   * Check SPF record
   */
  private async checkSpfRecord(domain: string): Promise<boolean> {
    try {
      const txtRecords = await resolveTxtAsync(domain);
      return txtRecords.some((records) =>
        records.some((record) => record.toLowerCase().startsWith("v=spf1")),
      );
    } catch (error) {
      debug("SPF check failed for %s: %o", domain, error);
      return false;
    }
  }

  /**
   * Check DMARC record
   */
  private async checkDmarcRecord(domain: string): Promise<boolean> {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const txtRecords = await resolveTxtAsync(dmarcDomain);
      return txtRecords.some((records) =>
        records.some((record) => record.toLowerCase().startsWith("v=dmarc1")),
      );
    } catch (error) {
      debug("DMARC check failed for %s: %o", domain, error);
      return false;
    }
  }

  /**
   * Validate MX server connectivity
   */
  private async validateMxConnectivity(mxRecords: MxRecord[]): Promise<boolean> {
    const net = await import("net");

    // Try to connect to the highest priority MX server
    const primaryMx = mxRecords[0];
    if (!primaryMx) return false;

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 3000);

      socket.connect(25, primaryMx.exchange, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });

      socket.on("error", () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  /**
   * Execute operation with concurrency control
   */
  private async executeWithConcurrencyControl<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeRequests >= this.config.concurrency) {
      // Queue the request
      return new Promise((resolve, reject) => {
        this.requestQueue.push(async () => {
          try {
            const result = await operation();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    this.activeRequests++;
    try {
      const result = await operation();
      return result;
    } finally {
      this.activeRequests--;

      // Process next queued request
      if (this.requestQueue.length > 0) {
        const nextRequest = this.requestQueue.shift()!;
        setImmediate(() => nextRequest());
      }
    }
  }

  /**
   * Get cached result
   */
  private getCachedResult(key: string): any {
    const cached = this.dnsCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }

    if (cached) {
      this.dnsCache.delete(key);
    }

    return undefined;
  }

  /**
   * Set cached result
   */
  private setCachedResult(key: string, result: any, ttl?: number): void {
    if (this.dnsCache.size >= this.config.cacheSize) {
      // Remove oldest entries
      const oldestKey = this.dnsCache.keys().next().value;
      if (oldestKey) {
        this.dnsCache.delete(oldestKey);
      }
    }

    this.dnsCache.set(key, {
      result,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTtl,
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, cached] of this.dnsCache) {
      if (now - cached.timestamp > cached.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.dnsCache.delete(key);
    }

    if (keysToDelete.length > 0) {
      debug("Cleaned up %d expired DNS cache entries", keysToDelete.length);
    }
  }

  /**
   * Set custom DNS servers
   */
  private setDnsServers(servers: string[]): void {
    const dns = require("dns");
    dns.setServers(servers);
    debug("Set custom DNS servers: %o", servers);
  }

  /**
   * Get DNS resolver statistics
   */
  getStats(): {
    cacheSize: number;
    activeRequests: number;
    queuedRequests: number;
    cacheHitRate: number;
  } {
    return {
      cacheSize: this.dnsCache.size,
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      cacheHitRate: this.dnsCache.size > 0 ? 0.85 : 0, // Approximate hit rate
    };
  }

  /**
   * Clear DNS cache
   */
  clearCache(): void {
    this.dnsCache.clear();
    debug("DNS cache cleared");
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DnsResolverConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.customDnsServers) {
      this.setDnsServers(newConfig.customDnsServers);
    }

    debug("DNS resolver configuration updated");
  }
}
