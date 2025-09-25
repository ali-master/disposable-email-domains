import type { EmailValidationResult } from "./types";
import { promisify } from "util";
import { resolve } from "dns";

const resolveMx = promisify(resolve);

// Pre-compiled patterns for better performance
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const AT_SYMBOL = "@";

// Frozen arrays for performance
const SUSPICIOUS_PATTERNS = Object.freeze([
  /^\d+@/, // Starts with numbers
  /temp|throw|fake|trash|junk|spam|test|demo/i, // Common disposable keywords
  /^\w{1,3}@/, // Very short local part
  /\+.*@/, // Plus addressing (often used for disposables)
  /^(no-?reply|noreply)@/i, // No-reply addresses
  /\d{10,}@/, // Long numeric sequences
]);

const SUSPICIOUS_DOMAIN_PATTERNS = Object.freeze([/-temp-/, /-fake-/, /temp\d+/, /\d{5,}/]);

// Cache for MX record lookups
const mxCache = new Map<string, boolean>();
const MX_CACHE_TTL = 300000; // 5 minutes
const mxCacheTimestamps = new Map<string, number>();

/**
 * Email validator for format validation and parsing
 */
export class EmailValidator {
  private strictValidation: boolean;
  private compiledCustomPatterns: RegExp[] = [];

  constructor(strictValidation = false) {
    this.strictValidation = strictValidation;
  }

  /**
   * Validate email format using regex patterns
   */
  validateEmailFormat(email: string, result: EmailValidationResult): boolean {
    // Quick length check first
    if (email.length > 254) {
      result.errors.push("Email address too long (max 254 characters)");
      return false;
    }

    // Find @ symbol position for faster parsing
    const atIndex = email.indexOf(AT_SYMBOL);
    if (atIndex === -1 || atIndex === 0 || atIndex === email.length - 1) {
      result.errors.push("Invalid email format - missing or misplaced @ symbol");
      return false;
    }

    // Check for multiple @ symbols
    if (email.indexOf(AT_SYMBOL, atIndex + 1) !== -1) {
      result.errors.push("Invalid email format - multiple @ symbols");
      return false;
    }

    const localPart = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);

    // Length checks
    if (localPart.length > 64) {
      result.errors.push("Local part too long (max 64 characters)");
      return false;
    }

    if (domain.length > 253) {
      result.errors.push("Domain too long (max 253 characters)");
      return false;
    }

    // Regex validation
    const regex = this.strictValidation ? STRICT_EMAIL_REGEX : EMAIL_REGEX;
    if (!regex.test(email)) {
      result.errors.push("Invalid email format");
      return false;
    }

    return true;
  }

  /**
   * Parse email into components with caching
   */
  parseEmail(email: string): { localPart: string; domain: string } {
    const atIndex = email.indexOf(AT_SYMBOL);
    const localPart = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1).toLowerCase();

    return { localPart, domain };
  }

  /**
   * Batch parse multiple emails
   */
  parseEmailsBatch(emails: string[]): Array<{ localPart: string; domain: string }> {
    return emails.map((email) => this.parseEmail(email));
  }

  /**
   * Analyze email patterns for suspicious behavior
   */
  analyzePatterns(
    email: string,
    localPart: string,
    domain: string,
    customPatterns: RegExp[] = [],
  ): { suspiciousScore: number; warnings: string[] } {
    let suspiciousScore = 0;
    const warnings: string[] = [];

    // Update compiled custom patterns if needed
    if (customPatterns !== this.compiledCustomPatterns) {
      this.compiledCustomPatterns = customPatterns;
    }

    // Check built-in suspicious patterns
    for (let i = 0; i < SUSPICIOUS_PATTERNS.length; i++) {
      const pattern = SUSPICIOUS_PATTERNS[i];
      if (pattern.test(email)) {
        suspiciousScore += 20;
        warnings.push(`Matches suspicious pattern: ${pattern.source}`);
      }
    }

    // Check custom patterns
    for (let i = 0; i < this.compiledCustomPatterns.length; i++) {
      const pattern = this.compiledCustomPatterns[i];
      if (pattern.test(email)) {
        suspiciousScore += 25;
        warnings.push(`Matches custom pattern: ${pattern.source}`);
      }
    }

    // Additional heuristics
    if (localPart.length <= 2) {
      suspiciousScore += 15;
      warnings.push("Very short local part");
    }

    // Check domain patterns
    for (let i = 0; i < SUSPICIOUS_DOMAIN_PATTERNS.length; i++) {
      const pattern = SUSPICIOUS_DOMAIN_PATTERNS[i];
      if (pattern.test(domain)) {
        suspiciousScore += 30;
        warnings.push("Domain contains suspicious keywords");
        break; // Only add this warning once
      }
    }

    // Check for numeric-heavy local parts
    const numericRatio = (localPart.match(/\d/g) || []).length / localPart.length;
    if (numericRatio > 0.7) {
      suspiciousScore += 20;
      warnings.push("Local part is mostly numeric");
    }

    // Check for consecutive dots or dashes
    if (domain.includes("..") || domain.includes("--")) {
      suspiciousScore += 25;
      warnings.push("Domain has consecutive dots or dashes");
    }

    return { suspiciousScore: Math.min(suspiciousScore, 100), warnings };
  }

  /**
   * Check MX record with caching
   */
  async checkMxRecord(domain: string): Promise<boolean> {
    const now = Date.now();

    // Check cache first
    const cached = mxCache.get(domain);
    const timestamp = mxCacheTimestamps.get(domain);

    if (cached !== undefined && timestamp && now - timestamp < MX_CACHE_TTL) {
      return cached;
    }

    try {
      const records = await resolveMx(domain);
      const hasMx = records && records.length > 0;

      // Cache the result
      mxCache.set(domain, hasMx);
      mxCacheTimestamps.set(domain, now);

      // Cleanup old cache entries periodically
      if (mxCache.size > 10000) {
        this.cleanupMxCache();
      }

      return hasMx;
    } catch (error) {
      // Cache negative results for shorter time
      mxCache.set(domain, false);
      mxCacheTimestamps.set(domain, now);
      return false;
    }
  }

  /**
   * Batch MX record checking
   */
  async checkMxRecordsBatch(domains: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const uncachedDomains: string[] = [];
    const now = Date.now();

    // Check cache first
    for (const domain of domains) {
      const cached = mxCache.get(domain);
      const timestamp = mxCacheTimestamps.get(domain);

      if (cached !== undefined && timestamp && now - timestamp < MX_CACHE_TTL) {
        results.set(domain, cached);
      } else {
        uncachedDomains.push(domain);
      }
    }

    // Check uncached domains with concurrency limit
    if (uncachedDomains.length > 0) {
      const BATCH_SIZE = 10;
      for (let i = 0; i < uncachedDomains.length; i += BATCH_SIZE) {
        const batch = uncachedDomains.slice(i, i + BATCH_SIZE);
        const promises = batch.map((domain) => this.checkMxRecord(domain));
        const batchResults = await Promise.all(promises);

        for (let j = 0; j < batch.length; j++) {
          results.set(batch[j], batchResults[j]);
        }
      }
    }

    return results;
  }

  private cleanupMxCache(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [domain, timestamp] of mxCacheTimestamps) {
      if (now - timestamp > MX_CACHE_TTL) {
        entriesToDelete.push(domain);
      }
    }

    for (const domain of entriesToDelete) {
      mxCache.delete(domain);
      mxCacheTimestamps.delete(domain);
    }
  }

  /**
   * Set strict validation mode
   */
  setStrictValidation(strict: boolean): void {
    this.strictValidation = strict;
  }

  /**
   * Get validation statistics
   */
  getStats(): { mxCacheSize: number; mxCacheHitRate: number } {
    return {
      mxCacheSize: mxCache.size,
      mxCacheHitRate: mxCache.size > 0 ? mxCache.size / (mxCache.size + mxCacheTimestamps.size) : 0,
    };
  }

  /**
   * Clear MX cache
   */
  clearMxCache(): void {
    mxCache.clear();
    mxCacheTimestamps.clear();
  }
}
