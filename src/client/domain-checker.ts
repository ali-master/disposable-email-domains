import { debug as createDebugger } from "debug";
import type { TrieIndex } from "./trie-index";
import type { BloomFilter } from "./bloom-filter";

const debug = createDebugger("disposable-email:domain-checker");

/**
 * Domain checker for disposable email detection
 */
export class DomainChecker {
  constructor(
    private disposableDomainsSet: Set<string>,
    private allowlistSet: Set<string>,
    private blacklistSet: Set<string>,
    private trustedDomains: string[],
    private enableSubdomainChecking: boolean,
    private domainTrie?: TrieIndex,
    private bloomFilter?: BloomFilter,
    private indexingStrategy: "trie" | "hash" | "bloom" | "hybrid" = "hybrid",
  ) {}

  /**
   * Check if domain is in allowlist
   */
  checkAllowlist(domain: string): boolean {
    if (this.allowlistSet.has(domain)) {
      return true;
    }

    // Check trusted domains
    if (this.trustedDomains.includes(domain)) {
      return true;
    }

    // Check subdomains if enabled
    if (this.enableSubdomainChecking) {
      const parts = domain.split(".");
      for (let i = 1; i < parts.length; i++) {
        const parentDomain = parts.slice(i).join(".");
        if (this.allowlistSet.has(parentDomain) || this.trustedDomains.includes(parentDomain)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if domain is in blacklist
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

    // Subdomain check
    if (this.enableSubdomainChecking) {
      const parts = domain.split(".");
      for (let i = 1; i < parts.length; i++) {
        const parentDomain = parts.slice(i).join(".");
        if (this.blacklistSet.has(parentDomain)) {
          return { isMatch: true, matchType: "subdomain", confidence: 90 };
        }
      }
    }

    return { isMatch: false, matchType: "exact", confidence: 0 };
  }

  /**
   * Check if domain is disposable using multiple strategies
   */
  async checkDisposableDomain(domain: string): Promise<{
    isMatch: boolean;
    matchType: "exact" | "subdomain" | "pattern";
    confidence: number;
    source?: string;
  }> {
    // Bloom filter quick check (if available)
    if (this.bloomFilter && !this.bloomFilter.contains(domain)) {
      // Definitely not in the set
      return { isMatch: false, matchType: "exact", confidence: 0 };
    }

    // Exact match in disposable domains set
    if (this.disposableDomainsSet.has(domain)) {
      return { isMatch: true, matchType: "exact", confidence: 100, source: "database" };
    }

    // Trie-based subdomain checking
    if (this.enableSubdomainChecking && this.indexingStrategy !== "hash" && this.domainTrie) {
      const trieResult = this.domainTrie.search(domain);
      if (trieResult.found && trieResult.source === "disposable") {
        return {
          isMatch: true,
          matchType: trieResult.matchType,
          confidence: trieResult.confidence,
          source: "trie-index",
        };
      }
    }

    // Fallback subdomain check for hash-based indexing
    if (this.enableSubdomainChecking && this.indexingStrategy === "hash") {
      const parts = domain.split(".");
      for (let i = 1; i < parts.length; i++) {
        const parentDomain = parts.slice(i).join(".");
        if (this.disposableDomainsSet.has(parentDomain)) {
          return {
            isMatch: true,
            matchType: "subdomain",
            confidence: 85,
            source: "subdomain-check",
          };
        }
      }
    }

    return { isMatch: false, matchType: "exact", confidence: 0 };
  }

  /**
   * Add domain to allowlist
   */
  addToAllowlist(domain: string): void {
    if (this.isValidDomain(domain)) {
      this.allowlistSet.add(domain.toLowerCase());

      if (this.domainTrie && this.indexingStrategy !== "hash") {
        this.domainTrie.insert(domain.toLowerCase(), "allowed");
      }

      debug("Added %s to allowlist", domain);
    } else {
      debug("Invalid domain format, not added to allowlist: %s", domain);
    }
  }

  /**
   * Add domain to blacklist
   */
  addToBlacklist(domain: string): void {
    if (this.isValidDomain(domain)) {
      this.blacklistSet.add(domain.toLowerCase());

      if (this.domainTrie && this.indexingStrategy !== "hash") {
        this.domainTrie.insert(domain.toLowerCase(), "blacklisted");
      }

      debug("Added %s to blacklist", domain);
    } else {
      debug("Invalid domain format, not added to blacklist: %s", domain);
    }
  }

  /**
   * Remove domain from allowlist
   */
  removeFromAllowlist(domain: string): boolean {
    return this.allowlistSet.delete(domain.toLowerCase());
  }

  /**
   * Remove domain from blacklist
   */
  removeFromBlacklist(domain: string): boolean {
    return this.blacklistSet.delete(domain.toLowerCase());
  }

  /**
   * Get domain counts
   */
  getDomainCounts(): {
    disposable: number;
    allowed: number;
    blacklisted: number;
  } {
    return {
      disposable: this.disposableDomainsSet.size,
      allowed: this.allowlistSet.size,
      blacklisted: this.blacklistSet.size,
    };
  }

  /**
   * Validate domain format
   */
  private isValidDomain(domain: string): boolean {
    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  /**
   * Update domain sets
   */
  updateDomainSets(
    disposableDomains?: Set<string>,
    allowlist?: Set<string>,
    blacklist?: Set<string>,
  ): void {
    if (disposableDomains) {
      this.disposableDomainsSet = disposableDomains;
    }
    if (allowlist) {
      this.allowlistSet = allowlist;
    }
    if (blacklist) {
      this.blacklistSet = blacklist;
    }
  }
}
