import type { EmailValidationResult } from "./types";

/**
 * Email validator for format validation and parsing
 */
export class EmailValidator {
  private readonly emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  private readonly strictEmailRegex =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  // Suspicious patterns for enhanced detection
  private readonly suspiciousPatterns = [
    /^\d+@/, // Starts with numbers
    /temp|throw|fake|trash|junk|spam|test|demo/i, // Common disposable keywords
    /^\w{1,3}@/, // Very short local part
    /\+.*@/, // Plus addressing (often used for disposables)
    /^(no-?reply|noreply)@/i, // No-reply addresses
    /\d{10,}@/, // Long numeric sequences
  ];

  constructor(private strictValidation = false) {}

  /**
   * Validate email format using regex patterns
   */
  validateEmailFormat(email: string, result: EmailValidationResult): boolean {
    const regex = this.strictValidation ? this.strictEmailRegex : this.emailRegex;

    if (!regex.test(email)) {
      result.errors.push("Invalid email format");
      return false;
    }

    // Additional format checks
    if (email.length > 254) {
      result.errors.push("Email address too long (max 254 characters)");
      return false;
    }

    const [localPart, domain] = email.split("@");

    if (localPart.length > 64) {
      result.errors.push("Local part too long (max 64 characters)");
      return false;
    }

    if (domain.length > 253) {
      result.errors.push("Domain too long (max 253 characters)");
      return false;
    }

    return true;
  }

  /**
   * Parse email into components
   */
  parseEmail(email: string): { localPart: string; domain: string } {
    const [localPart, domain] = email.toLowerCase().split("@");
    return { localPart, domain };
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

    // Check built-in suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(email)) {
        suspiciousScore += 20;
        warnings.push(`Matches suspicious pattern: ${pattern.source}`);
      }
    }

    // Check custom patterns
    for (const pattern of customPatterns) {
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

    if (domain.includes("-temp-") || domain.includes("-fake-")) {
      suspiciousScore += 30;
      warnings.push("Domain contains suspicious keywords");
    }

    if (/\d{6,}/.test(localPart)) {
      suspiciousScore += 10;
      warnings.push("Local part contains long numeric sequence");
    }

    return { suspiciousScore: Math.min(suspiciousScore, 100), warnings };
  }

  /**
   * Check MX record for domain (simplified implementation)
   */
  async checkMxRecord(domain: string): Promise<boolean> {
    // This is a placeholder implementation
    // In a real-world scenario, you would use DNS resolution
    try {
      // You could use a library like 'dns' in Node.js
      // const dns = require('dns').promises;
      // const mxRecords = await dns.resolveMx(domain);
      // return mxRecords.length > 0;

      // For now, return true for common domains
      const commonDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"];
      return commonDomains.some((d) => domain.endsWith(d));
    } catch {
      return false;
    }
  }

  /**
   * Validate domain format
   */
  isValidDomain(domain: string): boolean {
    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  /**
   * Set strict validation mode
   */
  setStrictValidation(strict: boolean): void {
    this.strictValidation = strict;
  }
}
