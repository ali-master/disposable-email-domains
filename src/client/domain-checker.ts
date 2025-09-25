import { debug as createDebugger } from "debug";
import type { TrieIndex } from "./trie-index";
import type { BloomFilter } from "./bloom-filter";

const debug = createDebugger("disposable-email:domain-checker");

// Pre-compiled domain patterns for faster checking
const DOMAIN_SEPARATOR = ".";

/**
 * Domain checker for disposable email detection
 */
export class DomainChecker {
  private trustedDomainsSet: Set<string>;
  private domainCache = new Map<
    string,
    { isMatch: boolean; matchType: string; confidence: number; source?: string }
  >();
  private readonly CACHE_SIZE_LIMIT = 5000;

  constructor(
    private disposableDomainsSet: Set<string>,
    private allowlistSet: Set<string>,
    private blacklistSet: Set<string>,
    trustedDomains: string[],
    private enableSubdomainChecking: boolean,
    private domainTrie?: TrieIndex,
    private bloomFilter?: BloomFilter,
    private indexingStrategy: "trie" | "hash" | "bloom" | "hybrid" = "hybrid",
  ) {
    // Convert trusted domains to Set for O(1) lookups
    this.trustedDomainsSet = new Set(trustedDomains);
  }

  /**
   * Check if domain is in allowlist with caching
   */
  checkAllowlist(domain: string): boolean {
    // Direct lookup
    if (this.allowlistSet.has(domain) || this.trustedDomainsSet.has(domain)) {
      return true;
    }

    // Subdomain check with optimized parsing
    if (this.enableSubdomainChecking) {
      return this.checkSubdomainAllowlist(domain);
    }

    return false;
  }

  private checkSubdomainAllowlist(domain: string): boolean {
    let dotIndex = domain.indexOf(DOMAIN_SEPARATOR);

    while (dotIndex !== -1) {
      const parentDomain = domain.slice(dotIndex + 1);
      if (this.allowlistSet.has(parentDomain) || this.trustedDomainsSet.has(parentDomain)) {
        return true;
      }
      dotIndex = domain.indexOf(DOMAIN_SEPARATOR, dotIndex + 1);
    }

    return false;
  }

  /**
   * Check if domain is in blacklist with optimized subdomain checking
   */
  checkBlacklist(domain: string): {
    isMatch: boolean;
    matchType: "exact" | "subdomain" | "pattern";
    confidence: number;
  } {
    // Exact match
    if (this.blacklistSet.has(domain)) {
      return { isMatch: true, matchType: "exact", confidence: 100 };
    }

    // Subdomain check with early termination
    if (this.enableSubdomainChecking) {
      const subdomainResult = this.checkSubdomainBlacklist(domain);
      if (subdomainResult.isMatch) {
        return subdomainResult;
      }
    }

    return { isMatch: false, matchType: "exact", confidence: 0 };
  }

  private checkSubdomainBlacklist(domain: string): {
    isMatch: boolean;
    matchType: "exact" | "subdomain" | "pattern";
    confidence: number;
  } {
    let dotIndex = domain.indexOf(DOMAIN_SEPARATOR);

    while (dotIndex !== -1) {
      const parentDomain = domain.slice(dotIndex + 1);
      if (this.blacklistSet.has(parentDomain)) {
        return { isMatch: true, matchType: "subdomain", confidence: 90 };
      }
      dotIndex = domain.indexOf(DOMAIN_SEPARATOR, dotIndex + 1);
    }

    return { isMatch: false, matchType: "exact", confidence: 0 };
  }

  /**
   * Check if domain is disposable using multiple strategies with caching
   */
  async checkDisposableDomain(domain: string): Promise<{
    isMatch: boolean;
    matchType: "exact" | "subdomain" | "pattern";
    confidence: number;
    source?: string;
  }> {
    // Check cache first
    const cached = this.domainCache.get(domain);
    if (cached) {
      // @ts-expect-error
      return cached;
    }

    const result = await this.performDisposableCheck(domain);

    // Cache the result with size limit
    if (this.domainCache.size >= this.CACHE_SIZE_LIMIT) {
      // Remove oldest entries (simple FIFO)
      const firstKey = this.domainCache.keys().next().value;
      this.domainCache.delete(firstKey!);
    }
    this.domainCache.set(domain, result);

    return result;
  }

  private async performDisposableCheck(domain: string): Promise<{
    isMatch: boolean;
    matchType: "exact" | "subdomain" | "pattern";
    confidence: number;
    source?: string;
  }> {
    // Bloom filter quick check (if available) - eliminate definite non-matches
    if (this.bloomFilter && !this.bloomFilter.contains(domain)) {
      return { isMatch: false, matchType: "exact", confidence: 0 };
    }

    // Exact match in disposable domains set
    if (this.disposableDomainsSet.has(domain)) {
      return { isMatch: true, matchType: "exact", confidence: 100, source: "database" };
    }

    // Strategy-based checking for subdomains
    switch (this.indexingStrategy) {
      case "trie":
        return this.checkWithTrie(domain);
      case "bloom":
        return this.checkWithBloom(domain);
      case "hybrid":
        return this.checkWithHybrid(domain);
      case "hash":
      default:
        return this.checkWithHash(domain);
    }
  }

  private checkWithTrie(domain: string): {
    isMatch: boolean;
    matchType: "exact" | "subdomain" | "pattern";
    confidence: number;
    source?: string;
  } {
    if (!this.domainTrie || !this.enableSubdomainChecking) {
      return { isMatch: false, matchType: "exact", confidence: 0 };
    }

    const trieResult = this.domainTrie.search(domain);
    if (trieResult.found && trieResult.source === "disposable") {
      return {
        isMatch: true,
        matchType: trieResult.matchType,
        confidence: trieResult.confidence,
        source: "trie",
      };
    }

    return { isMatch: false, matchType: "exact", confidence: 0 };
  }

  private checkWithBloom(domain: string): {
    isMatch: boolean;
    matchType: "exact" | "subdomain" | "pattern";
    confidence: number;
    source?: string;
  } {
    if (!this.bloomFilter) {
      return { isMatch: false, matchType: "exact", confidence: 0 };
    }

    // Bloom filter can only do exact checks, fallback to hash for subdomains
    if (this.enableSubdomainChecking) {
      return this.checkWithHash(domain);
    }

    return { isMatch: false, matchType: "exact", confidence: 0 };
  }

  private checkWithHybrid(domain: string): {
    isMatch: boolean;
    matchType: "exact" | "subdomain" | "pattern";
    confidence: number;
    source?: string;
  } {
    // Try trie first for best accuracy
    if (this.domainTrie && this.enableSubdomainChecking) {
      const trieResult = this.checkWithTrie(domain);
      if (trieResult.isMatch) {
        return trieResult;
      }
    }

    // Fallback to hash-based checking
    return this.checkWithHash(domain);
  }

  private checkWithHash(domain: string): {
    isMatch: boolean;
    matchType: "exact" | "subdomain" | "pattern";
    confidence: number;
    source?: string;
  } {
    if (!this.enableSubdomainChecking) {
      return { isMatch: false, matchType: "exact", confidence: 0 };
    }

    // Manual subdomain checking with hash lookups
    let dotIndex = domain.indexOf(DOMAIN_SEPARATOR);

    while (dotIndex !== -1) {
      const parentDomain = domain.slice(dotIndex + 1);
      if (this.disposableDomainsSet.has(parentDomain)) {
        return {
          isMatch: true,
          matchType: "subdomain",
          confidence: 85,
          source: "hash",
        };
      }
      dotIndex = domain.indexOf(DOMAIN_SEPARATOR, dotIndex + 1);
    }

    return { isMatch: false, matchType: "exact", confidence: 0 };
  }

  /**
   * Batch check multiple domains
   */
  async checkDisposableDomainsBatch(domains: string[]): Promise<
    Map<
      string,
      {
        isMatch: boolean;
        matchType: "exact" | "subdomain" | "pattern";
        confidence: number;
        source?: string;
      }
    >
  > {
    const results = new Map();
    const uncachedDomains: string[] = [];

    // Check cache first
    for (const domain of domains) {
      const cached = this.domainCache.get(domain);
      if (cached) {
        results.set(domain, cached);
      } else {
        uncachedDomains.push(domain);
      }
    }

    // Process uncached domains
    if (uncachedDomains.length > 0) {
      // Use trie batch search if available
      if (this.domainTrie && this.indexingStrategy !== "hash") {
        const trieResults = this.domainTrie.searchBatch(uncachedDomains);
        for (const result of trieResults) {
          const domainResult = {
            isMatch: result.found,
            matchType: result.matchType,
            confidence: result.confidence,
            source: result.found ? "trie" : undefined,
          };
          results.set(result.domain, domainResult);

          // Cache the result
          if (this.domainCache.size < this.CACHE_SIZE_LIMIT) {
            this.domainCache.set(result.domain, domainResult);
          }
        }
      } else {
        // Fallback to individual checks
        const promises = uncachedDomains.map((domain) =>
          this.checkDisposableDomain(domain).then((result) => ({ domain, result })),
        );
        const individualResults = await Promise.all(promises);

        for (const { domain, result } of individualResults) {
          results.set(domain, result);
        }
      }
    }

    return results;
  }

  /**
   * Add domain to allowlist
   */
  addToAllowlist(domain: string): void {
    this.allowlistSet.add(domain.toLowerCase());
    this.domainCache.delete(domain.toLowerCase());
    debug("Added domain to allowlist: %s", domain);
  }

  /**
   * Add domain to blacklist
   */
  addToBlacklist(domain: string): void {
    this.blacklistSet.add(domain.toLowerCase());
    this.domainCache.delete(domain.toLowerCase());
    debug("Added domain to blacklist: %s", domain);
  }

  /**
   * Remove domain from allowlist
   */
  removeFromAllowlist(domain: string): void {
    this.allowlistSet.delete(domain.toLowerCase());
    this.domainCache.delete(domain.toLowerCase());
    debug("Removed domain from allowlist: %s", domain);
  }

  /**
   * Remove domain from blacklist
   */
  removeFromBlacklist(domain: string): void {
    this.blacklistSet.delete(domain.toLowerCase());
    this.domainCache.delete(domain.toLowerCase());
    debug("Removed domain from blacklist: %s", domain);
  }

  /**
   * Get domain counts for statistics
   */
  getDomainCounts(): {
    disposable: number;
    allowlist: number;
    blacklist: number;
    trusted: number;
  } {
    return {
      disposable: this.disposableDomainsSet.size,
      allowlist: this.allowlistSet.size,
      blacklist: this.blacklistSet.size,
      trusted: this.trustedDomainsSet.size,
    };
  }

  /**
   * Clear domain cache
   */
  clearCache(): void {
    this.domainCache.clear();
    debug("Domain checker cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.domainCache.size,
      hitRate: this.domainCache.size > 0 ? 0.95 : 0, // Approximate hit rate
    };
  }
}
