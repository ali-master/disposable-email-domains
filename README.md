# Disposable Email Domains - TypeScript SDK & CLI

<!-- STATS -->
## 📊 Current Statistics

> **Last Updated**: September 25, 2025 at 02:46 PM GMT+3:30 | **Next Sync**: Automated twice daily (6 AM & 6 PM UTC)
> 📋 **[View Detailed Report](data/report.md)** | Last sync analysis and insights

<div align="center">

### 🎯 Domain Coverage

| 📧 **Total Domains** | 🆕 **Recent Additions** | 🗑️ **Recent Removals** | 📈 **Growth Rate** |
|:---:|:---:|:---:|:---:|
| **119,617** | **0** | **0** | **0.00%** |

### ⚡ Performance Metrics

| 🚀 **Sync Time** | ✅ **Success Rate** | 📦 **File Size** | 🔄 **Deduplication** |
|:---:|:---:|:---:|:---:|
| **0.93s** | **100.0%** | **1.8 MB** | **164,496 removed** |

</div>

### 🏆 Top Contributing Sources

| Repository | Domains | Success | Performance |
|------------|---------|---------|-------------|
| [kslr/disposable-email-domains](https://github.com/kslr/disposable-email-domains) | 110,498 | ✅ | 0.32s (1.6 MB) |
| [FGRibreau/mailchecker](https://github.com/FGRibreau/mailchecker) | 55,857 | ✅ | 0.30s (838.3 KB) |
| [wesbos/burner-email-providers](https://github.com/wesbos/burner-email-providers) | 27,284 | ✅ | 0.23s (388.1 KB) |
| [groundcat/disposable-email-domain-list](https://github.com/groundcat/disposable-email-domain-list) | 27,120 | ✅ | 0.17s (401.7 KB) |
| [disposable/disposable-email-domains](https://github.com/disposable/disposable-email-domains) | 27,038 | ✅ | 0.16s (381.4 KB) |
| [sublime-security/static-files](https://github.com/sublime-security/static-files) | 10,523 | ✅ | 0.18s (144.0 KB) |
| [7c/fakefilter](https://github.com/7c/fakefilter) | 8,784 | ✅ | 0.11s (126.7 KB) |
| [disposable-email-domains/disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) | 4,725 | ✅ | 0.08s (59.7 KB) |
| [willwhite/freemail](https://github.com/willwhite/freemail) | 4,462 | ✅ | 0.06s (61.8 KB) |
| [eser/sanitizer-svc](https://github.com/eser/sanitizer-svc) | 3,855 | ✅ | 0.14s (48.9 KB) |

<details>
<summary>📈 <strong>Detailed Metrics</strong></summary>

#### 🔍 Sync Analysis
- **Total Sources**: 15 repositories monitored
- **Active Sources**: 15 successfully synchronized
- **Failed Sources**: 0 temporary failures
- **Processing Efficiency**: 129176 domains/second
- **Average Download Time**: 0.15s per repository
- **Total Data Processed**: 4.1 MB

#### 🎯 Quality Metrics
- **Duplicate Detection**: 164,496 duplicates identified and removed
- **Data Integrity**: 100.0% repository success rate
- **Coverage Efficiency**: 42.1% unique domains retained

</details>

---
<!-- END STATS --><div align="center">
  <img src="assets/logo.svg" alt="Disposable Email Domains Logo" width="120" height="120">
  
  <p><strong>A powerful TypeScript SDK and CLI for detecting disposable email addresses with real-time synchronization and DNS validation</strong></p>
  
  [![npm version](https://badge.fury.io/js/%40usex%2Fdisposable-email-domains.svg)](https://www.npmjs.com/package/@usex/disposable-email-domains)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Tests](https://github.com/ali-master/disposable-email-domains/actions/workflows/test.yml/badge.svg)](https://github.com/ali-master/disposable-email-domains/actions)
</div>

---

## 🚀 Features

- **🎯 79,502+ Disposable Domains** - database with real-time updates
- **⚡ High Performance** - Advanced caching, indexing, and analytics engine  
- **🔧 TypeScript-First** - Fully typed with strict TypeScript definitions
- **🛡️ Advanced Validation** - Email format, MX record checking, and pattern matching
- **🌐 DNS Validation** - MX records, SPF, DMARC, and connectivity testing
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

### DNS Validation

```typescript
import { DisposableEmailChecker } from '@usex/disposable-email-domains';

const checker = new DisposableEmailChecker({
  checkMxRecord: true,
  dnsValidation: {
    validateMxConnectivity: true,
    checkSpfRecord: true,
    checkDmarcRecord: true,
    timeout: 5000,
    retries: 3,
    concurrency: 10
  }
});

const result = await checker.checkEmail('user@example.com');
console.log('DNS Validation Results:', result.dnsValidation);
// {
//   hasMx: true,
//   mxRecords: [{ exchange: 'mail.example.com', priority: 10 }],
//   hasSpf: true,
//   hasDmarc: true,
//   isConnectable: true,
//   dnsValidationTime: 123
// }
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
  customPatterns: [/temp.*\.com$/i, /test.*\.org$/i],
  
  // Advanced DNS validation
  dnsValidation: {
    timeout: 8000,
    retries: 5,
    enableCaching: true,
    cacheSize: 5000,
    cacheTtl: 300000, // 5 minutes
    concurrency: 15,
    validateMxConnectivity: true,
    checkSpfRecord: true,
    checkDmarcRecord: true,
    customDnsServers: ['1.1.1.1', '8.8.8.8'],
    fallbackDnsServers: ['208.67.222.222', '9.9.9.9']
  }
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
  checkMxRecord?: boolean;          // Enable MX record checking
  enableSubdomainChecking?: boolean; // Check subdomains against patterns
  enablePatternMatching?: boolean;   // Use regex pattern matching

  // Advanced DNS Validation Options
  dnsValidation?: {
    timeout?: number;                 // DNS query timeout (default: 5000ms)
    retries?: number;                 // Number of retry attempts (default: 3)
    enableCaching?: boolean;          // Enable DNS result caching (default: true)
    cacheSize?: number;               // Max DNS cache entries (default: 5000)
    cacheTtl?: number;                // DNS cache TTL (default: 300000ms)
    concurrency?: number;             // Max concurrent DNS queries (default: 10)
    validateMxConnectivity?: boolean; // Test SMTP connectivity (default: false)
    checkSpfRecord?: boolean;         // Check SPF records (default: false)
    checkDmarcRecord?: boolean;       // Check DMARC records (default: false)
    customDnsServers?: string[];      // Custom DNS servers
    fallbackDnsServers?: string[];    // Fallback DNS servers
  };

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

#### Core Email Validation Methods

##### `checkEmail(email: string): Promise<EmailValidationResult>`

Validates a single email address with checks including DNS validation.

```typescript
const result = await checker.checkEmail('test@example.com');
console.log(result);
// {
//   email: 'test@example.com',
//   isValid: true,
//   isDisposable: false,
//   domain: 'example.com',
//   localPart: 'test',
//   confidence: 95,
//   validationTime: 45,
//   dnsValidation: {
//     hasMx: true,
//     mxRecords: [{ exchange: 'mail.example.com', priority: 10 }],
//     hasSpf: true,
//     hasDmarc: true,
//     isConnectable: true,
//     dnsValidationTime: 123
//   }
// }
```

##### `checkEmailsBatch(emails: string[]): Promise<EmailValidationResult[]>`

Validates multiple emails efficiently with batch processing and DNS validation.

```typescript
const results = await checker.checkEmailsBatch([
  'user1@gmail.com',
  'user2@tempmail.com'
]);
```

#### DNS Validation Methods

##### `validateDomain(domain: string): Promise<DnsValidationResult>`

Performs DNS validation for a domain.

```typescript
const dnsResult = await checker.validateDomain('example.com');
console.log(dnsResult);
// {
//   domain: 'example.com',
//   hasMx: true,
//   mxRecords: [
//     { exchange: 'mail1.example.com', priority: 10 },
//     { exchange: 'mail2.example.com', priority: 20 }
//   ],
//   hasSpf: true,
//   hasDmarc: true,
//   isConnectable: true,
//   validationTime: 234,
//   errors: [],
//   warnings: []
// }
```

##### `validateDomainsBatch(domains: string[]): Promise<Map<string, DnsValidationResult>>`

Batch DNS validation for multiple domains with intelligent caching and concurrency control.

```typescript
const domainResults = await checker.validateDomainsBatch([
  'gmail.com',
  'tempmail.com',
  'outlook.com'
]);

for (const [domain, result] of domainResults) {
  console.log(`${domain}: MX=${result.hasMx}, SPF=${result.hasSpf}`);
}
```

#### DNS Configuration Management

##### `updateDnsConfig(newConfig: Partial<DnsResolverConfig>): void`

Updates DNS resolver configuration at runtime.

```typescript
checker.updateDnsConfig({
  timeout: 10000,
  retries: 5,
  customDnsServers: ['1.1.1.1', '8.8.8.8'],
  validateMxConnectivity: true
});
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

#### Analytics & Metrics

##### `getStats(): object`

Retrieves statistics including DNS performance metrics.

```typescript
const stats = checker.getStats();
console.log('DNS Stats:', stats.dns);
// {
//   cacheSize: 1234,
//   activeRequests: 5,
//   queuedRequests: 2,
//   cacheHitRate: 0.87
// }
```

##### `getMetrics(): PerformanceMetrics`

Retrieves performance metrics including DNS validation statistics.

```typescript
const metrics = checker.getMetrics();
console.log(`DNS validations: ${metrics.dnsValidations}`);
console.log(`DNS success rate: ${metrics.dnsSuccessRate}%`);
console.log(`Average DNS time: ${metrics.averageDnsTime}ms`);
```

#### Cache Management

##### `clearAllCaches(): Promise<void>`

Clears all caches including email validation and DNS caches.

```typescript
await checker.clearAllCaches();
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
  
  // DNS validation results (when enabled)
  dnsValidation?: {
    hasMx: boolean;                 // Has MX records
    mxRecords: Array<{              // MX record details
      exchange: string;
      priority: number;
    }>;
    hasSpf: boolean;                // Has SPF record
    hasDmarc: boolean;              // Has DMARC record
    isConnectable: boolean;         // SMTP server is connectable
    dnsValidationTime: number;      // DNS validation time in ms
  };
}
```

### DnsValidationResult Interface

```typescript
interface DnsValidationResult {
  domain: string;                   // Domain being validated
  hasMx: boolean;                   // Has MX records
  mxRecords: MxRecord[];            // Array of MX records
  hasSpf: boolean;                  // Has SPF record
  hasDmarc: boolean;                // Has DMARC record
  isConnectable: boolean;           // SMTP connectivity test result
  validationTime: number;           // Total validation time
  errors: string[];                 // Validation errors
  warnings: string[];               // Validation warnings
}

interface MxRecord {
  exchange: string;                 // Mail server hostname
  priority: number;                 // MX priority (lower = higher priority)
}
```

## 🎯 Advanced Usage Examples

### Enterprise DNS Configuration

```typescript
import { DisposableEmailChecker } from '@usex/disposable-email-domains';

// Enterprise-grade DNS validation setup
const checker = new DisposableEmailChecker({
  checkMxRecord: true,
  dnsValidation: {
    timeout: 10000,
    retries: 5,
    enableCaching: true,
    cacheSize: 10000,
    cacheTtl: 600000, // 10 minutes
    concurrency: 20,
    validateMxConnectivity: true,
    checkSpfRecord: true,
    checkDmarcRecord: true,
    customDnsServers: [
      '1.1.1.1',        // Cloudflare
      '8.8.8.8',        // Google
      '208.67.222.222'  // OpenDNS
    ],
    fallbackDnsServers: [
      '9.9.9.9',        // Quad9
      '76.76.19.19'     // Alternate DNS
    ]
  }
});

const result = await checker.checkEmail('enterprise@company.com');
if (result.dnsValidation) {
  console.log(`MX Records: ${result.dnsValidation.mxRecords.length}`);
  console.log(`SPF Protected: ${result.dnsValidation.hasSpf}`);
  console.log(`DMARC Policy: ${result.dnsValidation.hasDmarc}`);
  console.log(`Mail Server Accessible: ${result.dnsValidation.isConnectable}`);
}
```

### High-Performance Batch Processing with DNS

```typescript
async function validateLargeEmailList(emails: string[]) {
  const checker = new DisposableEmailChecker({
    enableCaching: true,
    cacheSize: 50000,
    checkMxRecord: true,
    dnsValidation: {
      enableCaching: true,
      cacheSize: 20000,
      concurrency: 25,
      timeout: 6000,
      retries: 3
    }
  });

  const batchSize = 100;
  const results: EmailValidationResult[] = [];
  
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const batchResults = await checker.checkEmailsBatch(batch);
    results.push(...batchResults);
    
    console.log(`Processed ${Math.min(i + batchSize, emails.length)}/${emails.length} emails`);
    
    // Report DNS performance
    const stats = checker.getStats();
    console.log(`DNS cache hit rate: ${(stats.dns.cacheHitRate * 100).toFixed(1)}%`);
  }
  
  return results;
}
```

### Custom DNS Server Configuration

```typescript
import { DisposableEmailChecker, DnsResolver } from '@usex/disposable-email-domains';

// Custom DNS resolver with specific servers for different regions
const customDnsConfig = {
  timeout: 8000,
  retries: 4,
  customDnsServers: [
    '1.1.1.1',      // Cloudflare (Global)
    '8.8.8.8',      // Google (Global)
    '9.9.9.9'       // Quad9 (Global)
  ],
  fallbackDnsServers: [
    '208.67.222.222', // OpenDNS
    '76.76.19.19'     // Alternate DNS
  ],
  validateMxConnectivity: true,
  checkSpfRecord: true,
  checkDmarcRecord: true
};

const checker = new DisposableEmailChecker({
  checkMxRecord: true,
  dnsValidation: customDnsConfig
});

// Direct DNS resolver usage
const dnsResolver = new DnsResolver(customDnsConfig);
const mxResult = await dnsResolver.validateMxRecord('gmail.com');
console.log('Gmail MX Records:', mxResult.mxRecords);
```

### Real-time DNS Monitoring

```typescript
class EmailValidationMonitor {
  private checker: DisposableEmailChecker;
  
  constructor() {
    this.checker = new DisposableEmailChecker({
      checkMxRecord: true,
      dnsValidation: {
        enableCaching: true,
        validateMxConnectivity: true,
        checkSpfRecord: true,
        checkDmarcRecord: true,
        timeout: 5000,
        retries: 3
      }
    });
  }

  async validateWithMonitoring(email: string) {
    const startTime = Date.now();
    const result = await this.checker.checkEmail(email);
    const totalTime = Date.now() - startTime;
    
    // Log validation metrics
    console.log({
      email: result.email,
      isValid: result.isValid,
      isDisposable: result.isDisposable,
      totalValidationTime: totalTime,
      emailValidationTime: result.validationTime,
      dnsValidationTime: result.dnsValidation?.dnsValidationTime,
      mxRecordCount: result.dnsValidation?.mxRecords.length || 0,
      hasSpf: result.dnsValidation?.hasSpf,
      hasDmarc: result.dnsValidation?.hasDmarc,
      isConnectable: result.dnsValidation?.isConnectable
    });
    
    // Get DNS performance stats
    const stats = this.checker.getStats();
    console.log('DNS Performance:', {
      cacheSize: stats.dns.cacheSize,
      activeRequests: stats.dns.activeRequests,
      queuedRequests: stats.dns.queuedRequests,
      cacheHitRate: `${(stats.dns.cacheHitRate * 100).toFixed(1)}%`
    });
    
    return result;
  }
}
```

## 🌐 DNS Validation Features

### MX Record Validation

- **MX Record Resolution** - Resolves and validates MX records with priority sorting
- **SMTP Connectivity Testing** - Tests actual connectivity to mail servers on port 25
- **Timeout and Retry Logic** - Configurable timeouts with exponential backoff
- **Concurrent Processing** - Intelligent concurrency control for batch operations

### Advanced DNS Record Checking

- **SPF Record Validation** - Checks for Sender Policy Framework records
- **DMARC Policy Detection** - Validates Domain-based Message Authentication policies
- **Custom DNS Servers** - Support for custom DNS servers with fallback options
- **Intelligent Caching** - Multi-level caching with TTL and cleanup management

### Performance Optimizations

- **Batch Processing** - Process multiple domains with controlled concurrency
- **Connection Pooling** - Reuse DNS connections for better performance
- **Cache Management** - Intelligent cache cleanup and size management
- **Request Deduplication** - Avoid duplicate DNS queries for the same domain

## 📊 Performance Benchmarks

### DNS Validation Performance

```typescript
// Single domain validation: ~50-200ms (depending on DNS response)
// Batch domain validation (100 domains): ~2-5s with caching
// DNS cache hit rate: >90% in typical production usage
// Memory usage: <10MB additional for DNS caching

// With connectivity testing enabled:
// Single validation: ~100-500ms (includes SMTP connection test)
// Batch validation: Scaled linearly with concurrency control
```

Run DNS benchmarks locally:
```bash
bun run benchmark:dns
```

## 🔧 CLI Usage with DNS Validation

```bash
# Validate email with DNS checking
npx disposable-email-domains check user@example.com --dns --spf --dmarc --connectivity

# Batch validation with DNS verification
npx disposable-email-domains batch emails.txt --dns --output results.json

# Domain-only DNS validation
npx disposable-email-domains dns-check example.com --verbose

# Custom DNS server configuration
npx disposable-email-domains check user@example.com --dns-servers 1.1.1.1,8.8.8.8
```

## 🔄 Domain Synchronization

We maintain an up-to-date database by synchronizing with 8+ trusted sources:



For advanced synchronization features and custom source management, see our [Syncer Documentation](./docs/syncer.md).

## 🧪 Testing

We maintain test coverage with 50+ test cases targeting 80%+ coverage:

```bash
# Run all tests
bun run test

# Run with coverage
bun run test:coverage

# Run benchmarks
bun run test:bench
```

## 📄 License

MIT © [Ali Torki](https://github.com/ali-master)

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/ali-master">Ali Torki</a></p>
</div>