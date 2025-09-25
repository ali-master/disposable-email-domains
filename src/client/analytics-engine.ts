import type { DomainInsights, EmailValidationResult, ValidationReport } from "./types";

/**
 * Analytics engine for domain insights and fuzzy matching
 */
export class AnalyticsEngine {
  constructor(private disposableDomainsSet: Set<string>) {}

  /**
   * Generate detailed validation report
   */
  async generateValidationReport(results: EmailValidationResult[]): Promise<ValidationReport> {
    const summary = {
      total: results.length,
      valid: results.filter((r) => r.isValid).length,
      invalid: results.filter((r) => !r.isValid).length,
      disposable: results.filter((r) => r.isDisposable).length,
      allowed: results.filter((r) => r.isAllowed).length,
      blacklisted: results.filter((r) => r.isBlacklisted).length,
    };

    const totalTime = results.reduce((sum, r) => sum + r.validationTime, 0);

    return {
      summary,
      details: results,
      performance: {
        totalTime,
        averageTimePerEmail: results.length > 0 ? totalTime / results.length : 0,
        throughput: totalTime > 0 ? (results.length / totalTime) * 1000 : 0, // emails per second
      },
    };
  }

  /**
   * Get domain statistics and insights
   */
  getDomainInsights(): DomainInsights {
    const tlds = new Map<string, number>();
    const patterns = new Map<string, number>();
    const lengths = new Map<string, number>();
    const subdomains = new Map<string, number>();

    const suspiciousPatterns = [/temp|throw|fake|trash|junk|spam|test|demo/i, /^\d+/, /\d{4,}/];

    for (const domain of this.disposableDomainsSet) {
      // TLD analysis
      const tld = domain.split(".").pop() || "";
      tlds.set(tld, (tlds.get(tld) || 0) + 1);

      // Length distribution
      const lengthRange = this.getLengthRange(domain.length);
      lengths.set(lengthRange, (lengths.get(lengthRange) || 0) + 1);

      // Subdomain analysis
      const parts = domain.split(".");
      if (parts.length > 2) {
        const subdomain = parts[0];
        subdomains.set(subdomain, (subdomains.get(subdomain) || 0) + 1);
      }

      // Pattern analysis
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(domain)) {
          const patternName = pattern.source || "unknown";
          patterns.set(patternName, (patterns.get(patternName) || 0) + 1);
        }
      }
    }

    return {
      topLevelDomains: tlds,
      suspiciousPatterns: patterns,
      domainLengthDistribution: lengths,
      mostCommonSubdomains: subdomains,
    };
  }

  /**
   * Advanced search with fuzzy matching
   */
  searchSimilarDomains(domain: string, threshold = 0.8): string[] {
    const results: string[] = [];
    const domainLower = domain.toLowerCase();

    // Simple Levenshtein distance-based fuzzy search
    for (const disposableDomain of this.disposableDomainsSet) {
      const similarity = this.calculateSimilarity(domainLower, disposableDomain);
      if (similarity >= threshold) {
        results.push(disposableDomain);
      }
    }

    return results.sort(
      (a, b) => this.calculateSimilarity(domainLower, b) - this.calculateSimilarity(domainLower, a),
    );
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen;
  }

  /**
   * Get length range for categorization
   */
  private getLengthRange(length: number): string {
    if (length <= 5) return "1-5";
    if (length <= 10) return "6-10";
    if (length <= 15) return "11-15";
    if (length <= 20) return "16-20";
    return "20+";
  }

  /**
   * Analyze domain trends over time
   */
  analyzeTrends(historicalData: Array<{ date: string; count: number }>): {
    trend: "increasing" | "decreasing" | "stable";
    growthRate: number;
    averageGrowth: number;
  } {
    if (historicalData.length < 2) {
      return { trend: "stable", growthRate: 0, averageGrowth: 0 };
    }

    const growthRates = [];
    for (let i = 1; i < historicalData.length; i++) {
      const prev = historicalData[i - 1].count;
      const current = historicalData[i].count;
      const rate = prev > 0 ? ((current - prev) / prev) * 100 : 0;
      growthRates.push(rate);
    }

    const averageGrowth = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    const latestGrowthRate = growthRates[growthRates.length - 1];

    let trend: "increasing" | "decreasing" | "stable";
    if (averageGrowth > 1) {
      trend = "increasing";
    } else if (averageGrowth < -1) {
      trend = "decreasing";
    } else {
      trend = "stable";
    }

    return {
      trend,
      growthRate: latestGrowthRate,
      averageGrowth,
    };
  }

  /**
   * Generate domain quality score
   */
  calculateQualityScore(domains: Set<string>): number {
    let score = 100;
    const totalDomains = domains.size;

    if (totalDomains === 0) return 0;

    // Penalize for potential false positives
    let suspiciousCount = 0;
    let duplicatePatterns = 0;
    const patterns = new Set<string>();

    for (const domain of domains) {
      // Check for suspicious patterns that might indicate false positives
      if (/^[a-z]+\.com$/.test(domain) && domain.length <= 6) {
        suspiciousCount++;
      }

      // Check for pattern duplicates
      const pattern = domain.replace(/\d+/g, "X");
      if (patterns.has(pattern)) {
        duplicatePatterns++;
      } else {
        patterns.add(pattern);
      }
    }

    // Apply penalties
    score -= (suspiciousCount / totalDomains) * 20;
    score -= (duplicatePatterns / totalDomains) * 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Update disposable domains set
   */
  updateDisposableDomains(domains: Set<string>): void {
    this.disposableDomainsSet = domains;
  }
}
