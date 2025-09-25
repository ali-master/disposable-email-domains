# Disposable Email Domains - TypeScript SDK

<div align="center">
  <img src="assets/logo.svg" alt="Disposable Email Domains Logo" width="120" height="120">
  
  <p><strong>A powerful TypeScript SDK for detecting disposable email addresses with real-time synchronization</strong></p>
  
  [![npm version](https://badge.fury.io/js/%40usex%2Fdisposable-email-domains.svg)](https://www.npmjs.com/package/@usex/disposable-email-domains)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

---

## 🚀 Features

- **🎯 79,502+ Disposable Domains** - Comprehensive database with real-time updates
- **⚡ High Performance** - Advanced caching, indexing, and analytics engine  
- **🔧 TypeScript-First** - Fully typed with strict TypeScript definitions
- **🛡️ Advanced Validation** - Email format, MX record checking, and pattern matching
- **📊 Analytics & Insights** - Domain statistics, performance metrics, and validation reports
- **🔄 Multi-Source Sync** - Intelligent deduplication from 8+ active repositories
- **💾 Flexible Caching** - Memory, Redis, Database, and custom cache adapters
- **🎨 Extensible Architecture** - Plugin system for custom validation rules

## 📦 Installation

```bash
# Using bun (recommended)
bun add @usex/disposable-email-domains

# Using npm
npm install @usex/disposable-email-domains

# Using yarn  
yarn add @usex/disposable-email-domains
```

## 🏁 Quick Start

### Basic Email Validation

```typescript
import { DisposableEmailChecker } from '@usex/disposable-email-domains';

const checker = new DisposableEmailChecker();

// Simple validation
const result = await checker.checkEmail('test@mailinator.com');
console.log(result.isDisposable); // true

// Batch validation
const emails = ['user@gmail.com', 'temp@10minutemail.com', 'test@yahoo.com'];
const results = await checker.checkEmailsBatch(emails);
results.forEach(result => {
  console.log(`${result.email}: ${result.isDisposable ? 'Disposable' : 'Valid'}`);
});
```

### Advanced Configuration

```typescript
import { DisposableEmailChecker } from '@usex/disposable-email-domains';

const checker = new DisposableEmailChecker({
  enableCaching: true,
  cacheSize: 10000,
  enableIndexing: true,
  indexingStrategy: 'hybrid',
  strictValidation: true,
  checkMxRecord: true,
  enableSubdomainChecking: true,
  trustedDomains: ['gmail.com', 'outlook.com', 'yahoo.com'],
  customPatterns: [/temp.*\.com$/i, /test.*\.org$/i]
});

const result = await checker.checkEmail('user@suspicious-temp-mail.com');
console.log(result);
```

## 📋 API Reference

### DisposableEmailChecker

#### Constructor Options

```typescript
interface EmailCheckerConfig {
  // Data Sources
  disposableDomainsUrl?: string;
  localDataPath?: string;
  allowlistPath?: string;
  blacklistPath?: string;

  // Validation Options
  strictValidation?: boolean;        // Enable strict RFC validation
  checkMxRecord?: boolean;          // Verify MX records exist
  enableSubdomainChecking?: boolean; // Check subdomains against patterns
  enablePatternMatching?: boolean;   // Use regex pattern matching

  // Performance Options
  enableCaching?: boolean;          // Enable result caching
  cacheSize?: number;              // Maximum cache entries
  enableIndexing?: boolean;        // Enable domain indexing
  indexingStrategy?: 'trie' | 'hash' | 'bloom' | 'hybrid';

  // Cache Configuration
  cacheType?: 'memory' | 'redis' | 'database' | 'filesystem';
  cacheConfig?: {
    maxSize?: number;
    defaultTtl?: number;           // TTL in milliseconds
    cleanupInterval?: number;
  };

  // Update Options
  autoUpdate?: boolean;            // Auto-update domain lists
  updateInterval?: number;         // Update interval in hours

  // Custom Options
  customPatterns?: RegExp[];       // Custom disposable patterns
  trustedDomains?: string[];       // Always allow these domains
  suspiciousPatterns?: string[];   // Additional suspicious patterns
}
```

#### Core Methods

##### `checkEmail(email: string): Promise<EmailValidationResult>`

Validates a single email address and returns comprehensive validation results.

```typescript
const result = await checker.checkEmail('test@example.com');
// Returns: EmailValidationResult
```

##### `checkEmailsBatch(emails: string[]): Promise<EmailValidationResult[]>`

Validates multiple emails efficiently with batch processing.

```typescript
const results = await checker.checkEmailsBatch([
  'user1@gmail.com',
  'user2@tempmail.com'
]);
```

##### `isDomainDisposable(domain: string): Promise<boolean>`

Checks if a domain is in the disposable list.

```typescript
const isDisposable = await checker.isDomainDisposable('10minutemail.com');
console.log(isDisposable); // true
```

#### Domain Management

##### `addToAllowlist(domain: string): void`

Adds a domain to the allowlist (always considered valid).

```typescript
checker.addToAllowlist('corporate-domain.com');
```

##### `addToBlacklist(domain: string): void`

Adds a domain to the blacklist (always considered invalid).

```typescript
checker.addToBlacklist('spam-domain.com');
```

##### `removeFromAllowlist(domain: string): void`

Removes a domain from the allowlist.

```typescript
checker.removeFromAllowlist('corporate-domain.com');
```

#### Analytics & Metrics

##### `getMetrics(): PerformanceMetrics`

Retrieves comprehensive performance metrics.

```typescript
const metrics = checker.getMetrics();
console.log(`Cache hit rate: ${metrics.cacheHitRate}%`);
console.log(`Average validation time: ${metrics.averageValidationTime}ms`);
```

##### `getDomainInsights(): DomainInsights`

Gets insights about domain patterns and statistics.

```typescript
const insights = checker.getDomainInsights();
console.log('Top-level domains:', insights.topLevelDomains);
```

##### `generateReport(emails: string[]): Promise<ValidationReport>`

Generates a comprehensive validation report for a list of emails.

```typescript
const report = await checker.generateReport(emailList);
console.log(`Valid emails: ${report.summary.valid}/${report.summary.total}`);
```

#### Cache Management

##### `getCacheStats(): Promise<CacheStats>`

Retrieves cache performance statistics.

```typescript
const stats = await checker.getCacheStats();
console.log(`Cache size: ${stats.size}, Hit rate: ${stats.hitRate}%`);
```

##### `clearCache(): Promise<void>`

Clears the validation cache.

```typescript
await checker.clearCache();
```

#### Data Management

##### `updateDomainList(): Promise<boolean>`

Manually triggers domain list update from configured sources.

```typescript
const success = await checker.updateDomainList();
console.log(`Update ${success ? 'successful' : 'failed'}`);
```

##### `close(): Promise<void>`

Properly closes the checker and cleans up resources.

```typescript
await checker.close();
```

### EmailValidationResult Interface

```typescript
interface EmailValidationResult {
  email: string;                    // Original email address
  isValid: boolean;                 // Is email format valid
  isDisposable: boolean;            // Is from disposable provider
  isAllowed: boolean;               // Is in allowlist
  isBlacklisted: boolean;           // Is in blacklist
  domain: string;                   // Email domain
  localPart: string;                // Local part of email
  matchType: 'exact' | 'subdomain' | 'pattern' | 'none';
  confidence: number;               // Confidence score (0-100)
  source?: string;                  // Source that identified as disposable
  validationTime: number;           // Validation time in milliseconds
  errors: string[];                 // Validation errors
  warnings: string[];               // Validation warnings
}
```

## 🎯 Advanced Usage Examples

### Custom Cache Implementation

```typescript
import { DisposableEmailChecker } from '@usex/disposable-email-domains';
import Redis from 'ioredis';

// Using Redis cache
const redis = new Redis('redis://localhost:6379');

const checker = new DisposableEmailChecker({
  cacheType: 'redis',
  customCache: redis,
  cacheConfig: {
    defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
    keyPrefix: 'email_validation:'
  }
});
```

### Pattern-Based Validation

```typescript
const checker = new DisposableEmailChecker({
  enablePatternMatching: true,
  customPatterns: [
    /^temp.*@.*$/i,           // Emails starting with "temp"
    /.*\.temp\..*$/i,         // Domains containing ".temp."
    /.*\d{10,}.*@.*$/i,       // Local parts with 10+ consecutive digits
  ],
  suspiciousPatterns: [
    'noreply', 'no-reply', 'test', 'demo'
  ]
});

const result = await checker.checkEmail('temp12345@example.com');
console.log(result.matchType); // 'pattern'
```

### Batch Processing with Progress

```typescript
async function validateLargeList(emails: string[]) {
  const batchSize = 100;
  const results: EmailValidationResult[] = [];
  
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const batchResults = await checker.checkEmailsBatch(batch);
    results.push(...batchResults);
    
    console.log(`Processed ${Math.min(i + batchSize, emails.length)}/${emails.length} emails`);
  }
  
  return results;
}
```

### Real-time Updates

```typescript
const checker = new DisposableEmailChecker({
  autoUpdate: true,
  updateInterval: 6, // Update every 6 hours
});

// Listen for update events (if using event-driven cache)
checker.on('domainListUpdated', (stats) => {
  console.log(`Domain list updated: ${stats.newDomains} new, ${stats.removedDomains} removed`);
});
```

## 📊 Performance Benchmarks

We maintain comprehensive benchmarks to ensure optimal performance:

```typescript
// Single validation: ~0.1ms average
// Batch validation (100 emails): ~5ms average  
// Cache hit rate: >95% in typical usage
// Memory usage: <50MB for 79K+ domains
```

Run benchmarks locally:
```bash
bun run test:bench
```

## 🔧 CLI Usage [WIP]

The package includes a powerful CLI for domain management and validation:

```bash
# Validate single email
npx disposable-email-domains check user@example.com

# Validate batch from file
npx disposable-email-domains batch emails.txt

# Update domain lists
npx disposable-email-domains sync

# Generate validation report
npx disposable-email-domains report emails.txt --output report.json
```

For detailed CLI documentation, see [CLI Documentation](./docs/cli.md).

## 🔄 Domain Synchronization

We maintain an up-to-date database by synchronizing with 8+ trusted sources:

<!-- STATS -->
## 📊 Current Statistics

> **Last Updated**: September 24, 2025 at 07:32 PM GMT+3:30 | **Next Sync**: Automated twice daily (6 AM & 6 PM UTC)

<div align="center">

### 🎯 Domain Coverage

| 📧 **Total Domains** | 🆕 **Recent Additions** | 🗑️ **Recent Removals** | 📈 **Growth Rate** |
|:---:|:---:|:---:|:---:|
| **79,502** | **79,502** | **0** | **+100.00%** |

### ⚡ Performance Metrics

| 🚀 **Sync Time** | ✅ **Success Rate** | 📦 **File Size** | 🔄 **Deduplication** |
|:---:|:---:|:---:|:---:|
| **1.35s** | **100.0%** | **1.2 MB** | **57,429 removed** |

</div>

### 🏆 Top Contributing Sources

| Repository | Domains | Success | Performance |
|------------|---------|---------|-------------|
| [FGRibreau/mailchecker](https://github.com/FGRibreau/mailchecker) | 55,857 | ✅ | 0.71s (838.3 KB) |
| [wesbos/burner-email-providers](https://github.com/wesbos/burner-email-providers) | 27,284 | ✅ | 1.04s (388.1 KB) |
| [disposable/disposable-email-domains](https://github.com/disposable/disposable-email-domains) | 27,102 | ✅ | 1.02s (382.4 KB) |
| [sublime-security/static-files](https://github.com/sublime-security/static-files) | 10,523 | ✅ | 0.66s (144.0 KB) |
| [7c/fakefilter](https://github.com/7c/fakefilter) | 8,780 | ✅ | 0.77s (126.7 KB) |
| [disposable-email-domains/disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) | 4,725 | ✅ | 0.59s (59.7 KB) |
| [willwhite/freemail](https://github.com/willwhite/freemail) | 4,462 | ✅ | 0.33s (61.8 KB) |
| [MattKetmo/EmailChecker](https://github.com/MattKetmo/EmailChecker) | 2,515 | ✅ | 0.29s (32.4 KB) |

<details>
<summary>📈 <strong>Detailed Metrics</strong></summary>

#### 🔍 Sync Analysis
- **Total Sources**: 8 repositories monitored
- **Active Sources**: 8 successfully synchronized
- **Failed Sources**: 0 temporary failures
- **Processing Efficiency**: 58978 domains/second
- **Average Download Time**: 0.68s per repository
- **Total Data Processed**: 2.0 MB

#### 🎯 Quality Metrics
- **Duplicate Detection**: 57,429 duplicates identified and removed
- **Data Integrity**: 100.0% repository success rate
- **Coverage Efficiency**: 58.1% unique domains retained

</details>

---
<!-- END STATS -->

For advanced synchronization features and custom source management, see our [Syncer Documentation](./docs/syncer.md).

## 🧪 Testing

We maintain comprehensive test coverage with 50+ test cases targeting 80%+ coverage:

```bash
# Run all tests
bun run test

# Run with coverage
bun test:coverage

# Run benchmarks
bun run test:bench
```

## 📄 License

MIT © [Ali Torki](https://github.com/ali-master)

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/ali-master">Ali Torki</a></p>
</div>
