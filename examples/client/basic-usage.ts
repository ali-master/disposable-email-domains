/**
 * Basic Email Validation Examples
 *
 * This example demonstrates the fundamental usage of the DisposableEmailChecker
 * with default settings and basic configuration options.
 */

import {
  DisposableEmailChecker,
  createEmailChecker,
  quickCheck,
  quickCheckBatch,
} from "../../src/client";

/**
 * Example 1: Simple email validation
 */
export async function basicEmailValidation() {
  console.log("🚀 Basic Email Validation Example\n");

  // Create checker with default configuration
  const checker = new DisposableEmailChecker();

  // Test various email addresses
  const testEmails = [
    "user@gmail.com", // Valid, trusted domain
    "test@10minutemail.com", // Disposable
    "invalid-email", // Invalid format
    "user@mytempmail.org", // Disposable
    "admin@company.com", // Valid business email
  ];

  for (const email of testEmails) {
    const result = await checker.checkEmail(email);

    console.log(`📧 Email: ${email}`);
    console.log(`   ✅ Valid: ${result.isValid}`);
    console.log(`   🗑️ Disposable: ${result.isDisposable}`);
    console.log(`   🎯 Confidence: ${result.confidence}%`);
    console.log(`   ⚡ Time: ${result.validationTime.toFixed(2)}ms`);

    if (result.errors.length > 0) {
      console.log(`   ❌ Errors: ${result.errors.join(", ")}`);
    }

    if (result.warnings.length > 0) {
      console.log(`   ⚠️ Warnings: ${result.warnings.join(", ")}`);
    }

    console.log("");
  }

  // Get performance metrics
  const metrics = checker.getMetrics();
  console.log("📊 Performance Metrics:");
  console.log(`   Total validations: ${metrics.totalValidations}`);
  console.log(
    `   Success rate: ${((metrics.successfulValidations / metrics.totalValidations) * 100).toFixed(1)}%`,
  );
  console.log(`   Disposable detected: ${metrics.disposableDetected}`);
  console.log(`   Average time: ${metrics.averageValidationTime.toFixed(2)}ms`);
  console.log(`   Throughput: ${metrics.throughputPerSecond.toFixed(0)} emails/sec\n`);
}

/**
 * Example 2: Using convenience functions
 */
export async function convenienceFunctions() {
  console.log("🛠️ Convenience Functions Example\n");

  // Quick single email check
  const result1 = await quickCheck("test@tempmail.org");
  console.log("Quick check result:", {
    email: result1.email,
    isDisposable: result1.isDisposable,
    confidence: result1.confidence,
  });

  // Batch processing with convenience function
  const emails = ["user1@gmail.com", "temp@10minutemail.com", "business@company.co.uk"];

  const batchResults = await quickCheckBatch(emails);
  console.log("\nBatch results:");
  batchResults.forEach((result) => {
    console.log(
      `  ${result.email}: ${result.isDisposable ? "Disposable" : "Clean"} (${result.confidence}%)`,
    );
  });

  // Using factory function with custom config
  const customChecker = createEmailChecker({
    strictValidation: true,
    enablePatternMatching: true,
    trustedDomains: ["gmail.com", "company.com"],
  });

  const strictResult = await customChecker.checkEmail("a@test.co");
  console.log("\nStrict validation result:", {
    isValid: strictResult.isValid,
    errors: strictResult.errors,
  });
}

/**
 * Example 3: Batch processing and reporting
 */
export async function batchProcessingExample() {
  console.log("📊 Batch Processing and Reporting Example\n");

  const checker = new DisposableEmailChecker({
    enableCaching: true,
    cacheType: "memory",
    cacheConfig: {
      maxSize: 1000,
      defaultTtl: 30 * 60 * 1000, // 30 minutes
    },
  });

  // Large batch of emails
  const emailBatch = [
    "user1@gmail.com",
    "temp1@10minutemail.com",
    "user2@yahoo.com",
    "fake@tempmail.org",
    "business@company.com",
    "test@guerrillamail.com",
    "admin@outlook.com",
    "spam@throaway.email",
    "contact@startup.io",
    "noreply@service.com",
  ];

  // Process batch
  const results = await checker.checkEmailsBatch(emailBatch);

  // Generate detailed report
  const report = await checker.generateValidationReport(emailBatch);

  console.log("📋 Validation Report:");
  console.log(`   Total emails: ${report.summary.total}`);
  console.log(`   Valid emails: ${report.summary.valid}`);
  console.log(`   Invalid emails: ${report.summary.invalid}`);
  console.log(`   Disposable emails: ${report.summary.disposable}`);
  console.log(`   Allowed emails: ${report.summary.allowed}`);
  console.log(`   Blacklisted emails: ${report.summary.blacklisted}\n`);

  console.log("⚡ Performance:");
  console.log(`   Total time: ${report.performance.totalTime.toFixed(2)}ms`);
  console.log(`   Average per email: ${report.performance.averageTimePerEmail.toFixed(2)}ms`);
  console.log(`   Throughput: ${report.performance.throughput.toFixed(0)} emails/sec\n`);

  // Cache statistics
  const cacheStats = await checker.getCacheStats();
  console.log("💾 Cache Statistics:");
  console.log(`   Cache size: ${cacheStats.size}`);
  console.log(`   Hit rate: ${cacheStats.hitRate.toFixed(1)}%`);
  console.log(`   Total entries: ${cacheStats.entries}\n`);

  // Export detailed statistics
  const statsJson = await checker.exportStatistics();
  console.log("📤 Exported statistics (sample):");
  const stats = JSON.parse(statsJson);
  console.log("   Domain counts:", stats.domainCounts);
  console.log("   Configuration:", {
    cacheType: stats.configuration.cacheType,
    indexingStrategy: stats.configuration.indexingStrategy,
    enableSubdomainChecking: stats.configuration.enableSubdomainChecking,
  });
}

/**
 * Example 4: Advanced configuration
 */
export async function advancedConfiguration() {
  console.log("⚙️ Advanced Configuration Example\n");

  const checker = new DisposableEmailChecker({
    // Validation options
    strictValidation: true,
    enableSubdomainChecking: true,
    enablePatternMatching: true,
    checkMxRecord: false, // Requires DNS resolution implementation

    // Performance options
    enableCaching: true,
    cacheType: "memory",
    enableIndexing: true,
    indexingStrategy: "hybrid", // Uses both trie and bloom filter

    // Data sources
    localDataPath: "data/domains.txt",
    allowlistPath: "config/custom-allowlist.txt",
    blacklistPath: "config/custom-blacklist.txt",

    // Cache configuration
    cacheConfig: {
      maxSize: 5000,
      defaultTtl: 60 * 60 * 1000, // 1 hour
      cleanupInterval: 15 * 60 * 1000, // 15 minutes
    },

    // Custom patterns and trusted domains
    customPatterns: [
      /^noreply@/i, // No-reply addresses
      /^admin@.*\.temp$/i, // Admin on temp domains
      /\d{8,}@/, // Long numeric prefixes
    ],
    trustedDomains: ["gmail.com", "outlook.com", "company.com", "university.edu"],
  });

  // Test with various email types
  const testCases = [
    "user@gmail.com", // Trusted domain
    "noreply@service.com", // Matches custom pattern
    "user@sub.tempmail.org", // Subdomain check
    "12345678@example.com", // Numeric pattern
    "admin@company.temp", // Custom pattern match
  ];

  console.log("🧪 Testing advanced validation:");
  for (const email of testCases) {
    const result = await checker.checkEmail(email);

    console.log(`\n📧 ${email}:`);
    console.log(
      `   Status: ${result.isDisposable ? "🗑️ Disposable" : result.isAllowed ? "✅ Allowed" : "🟢 Clean"}`,
    );
    console.log(`   Match type: ${result.matchType}`);
    console.log(`   Confidence: ${result.confidence}%`);

    if (result.source) {
      console.log(`   Source: ${result.source}`);
    }

    if (result.warnings.length > 0) {
      console.log(`   Warnings: ${result.warnings.join("; ")}`);
    }
  }

  // Demonstrate dynamic domain management
  console.log("\n🔧 Dynamic Domain Management:");

  // Add to custom allowlist
  checker.addToAllowlist("newpartner.com");
  const allowedResult = await checker.checkEmail("user@newpartner.com");
  console.log(`   Added newpartner.com to allowlist: ${allowedResult.isAllowed}`);

  // Add to custom blacklist
  checker.addToBlacklist("suspicious.net");
  const blockedResult = await checker.checkEmail("user@suspicious.net");
  console.log(`   Added suspicious.net to blacklist: ${blockedResult.isBlacklisted}`);
}

// Run examples if called directly
if (import.meta.main) {
  console.log("📚 DisposableEmailChecker - Basic Usage Examples\n");

  try {
    await basicEmailValidation();
    await convenienceFunctions();
    await batchProcessingExample();
    await advancedConfiguration();

    console.log("✅ All examples completed successfully!");
  } catch (error) {
    console.error("❌ Example failed:", error);
    process.exit(1);
  }
}
