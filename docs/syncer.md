# Domain Synchronization Manager Documentation

The Domain Synchronization Manager is a powerful component of the Disposable Email Domains SDK that handles downloading, processing, and synchronizing disposable email domain lists from multiple trusted sources with intelligent deduplication and statistics.

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Repository Types](#repository-types)
- [Advanced Usage](#advanced-usage)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)
- [Statistics & Monitoring](#statistics--monitoring)
- [Examples](#examples)

## 🎯 Overview

The syncer provides:

- **Multi-source synchronization** from Git repositories, direct URLs, and local files
- **Intelligent deduplication** with source tracking and conflict resolution
- **Concurrent processing** with configurable concurrency limits
- **statistics** including performance metrics and domain analysis
- **Backup and versioning** support for data integrity
- **Error handling and retry** mechanisms for robust operation

### Architecture Flowchart

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Repository    │    │   Repository    │    │   Repository    │
│   Source #1     │    │   Source #2     │    │   Source #N     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Sync Manager            │
                    │   - Concurrent Downloads  │
                    │   - Error Handling        │
                    │   - Retry Logic          │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Domain Processor        │
                    │   - Validation           │
                    │   - Normalization        │
                    │   - Source Tracking      │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Deduplication Engine    │
                    │   - Intelligent Merging  │
                    │   - Conflict Resolution  │
                    │   - Statistics Tracking  │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Output Generator        │
                    │   - Multiple Formats     │
                    │   - Backup Creation      │
                    │   - Statistics Report    │
                    └─────────────────────────────┘
```

## 🚀 Quick Start

### Basic Synchronization

```typescript
import { DisposableEmailSyncManager } from '@usex/disposable-email-domains/syncer';

const manager = new DisposableEmailSyncManager({
  outputPath: './data',
  enableStats: true,
  concurrency: 5
});

const repositories = [
  {
    type: 'git' as const,
    url: 'https://github.com/disposable/disposable-email-domains',
    blocklist_files: ['/refs/heads/main/disposable_email_blocklist.conf']
  },
  {
    type: 'url' as const,
    url: 'https://raw.githubusercontent.com/wesbos/burner-email-providers/master/emails.txt'
  }
];

const result = await manager.sync(repositories);
console.log(`Synced ${result.domains.size} unique domains`);
```

### Using the Quick Sync Function

```typescript
import { quickSync } from '@usex/disposable-email-domains/syncer';

const result = await quickSync([
  {
    type: 'git',
    url: 'https://github.com/FGRibreau/mailchecker',
    blocklist_files: ['/refs/heads/master/list.txt']
  }
], {
  concurrency: 10,
  enableStats: true
});

console.log(`Processing completed in ${result.stats.totalTime}ms`);
```

## 📚 API Reference

### DisposableEmailSyncManager

The main class for managing domain synchronization operations.

#### Constructor

```typescript
constructor(options?: SyncOptions)
```

**Parameters:**
- `options` (optional): Configuration options for the sync manager

#### Methods

##### `sync(repositories: Repository[]): Promise<SyncResult>`

Main synchronization method that orchestrates the entire process.

```typescript
const result = await manager.sync(repositories);
```

**Parameters:**
- `repositories`: Array of repository configurations to sync from

**Returns:** Promise resolving to `SyncResult` containing domains, statistics, and errors.

### Types & Interfaces

#### SyncOptions

```typescript
interface SyncOptions {
  outputPath?: string;        // Output directory path (default: 'dist')
  enableStats?: boolean;      // Generate detailed statistics (default: true)
  enableBackup?: boolean;     // Create backups of previous data (default: true)
  concurrency?: number;       // Max concurrent downloads (default: 5)
  timeout?: number;          // Request timeout in ms (default: 30000)
  retries?: number;          // Number of retry attempts (default: 3)
}
```

#### Repository

```typescript
interface Repository {
  type: 'git' | 'url' | 'local';
  url: string;
  blocklist_files?: string[];    // For git repositories
  allowlist_files?: string[];    // For git repositories
  format?: 'txt' | 'json' | 'csv' | 'auto';
  encoding?: string;             // File encoding (default: 'utf-8')
  headers?: Record<string, string>; // Custom HTTP headers for URL requests
}
```

#### SyncResult

```typescript
interface SyncResult {
  domains: Set<string>;        // All unique domains found
  stats: SyncStats;           //  statistics
  errors: Error[];            // Any errors encountered
}
```

#### SyncStats

```typescript
interface SyncStats {
  totalRepositories: number;
  successfulRepositories: number;
  failedRepositories: number;
  totalDomains: number;
  uniqueDomains: number;
  duplicatesRemoved: number;
  newDomains: number;
  removedDomains: number;
  totalTime: number;
  averageDownloadTime: number;
  repositoryStats: RepositoryStats[];
  processingEfficiency: number;
  dataIntegrityScore: number;
}
```

#### RepositoryStats

```typescript
interface RepositoryStats {
  url: string;
  success: boolean;
  domainsCount: number;
  downloadTime: number;
  fileSize: number;
  error?: string;
  format?: string;
  encoding?: string;
}
```

## ⚙️ Configuration

### Basic Configuration

```typescript
const manager = new DisposableEmailSyncManager({
  outputPath: './output',
  enableStats: true,
  enableBackup: true,
  concurrency: 8,
  timeout: 45000,
  retries: 5
});
```

### Advanced Configuration with Custom Processing

```typescript
class CustomSyncManager extends DisposableEmailSyncManager {
  constructor(options: SyncOptions) {
    super(options);
  }

  // Override domain validation logic
  protected validateDomain(domain: string): boolean {
    // Custom validation logic
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) && 
           !domain.includes('localhost') &&
           domain.length > 3;
  }

  // Override deduplication logic
  protected deduplicateDomains(domains: Map<string, DomainEntry>): Map<string, DomainEntry> {
    // Custom deduplication with priority rules
    const result = new Map<string, DomainEntry>();
    
    for (const [domain, entry] of domains) {
      if (!result.has(domain) || this.shouldReplaceEntry(result.get(domain)!, entry)) {
        result.set(domain, entry);
      }
    }
    
    return result;
  }
}
```

## 🗄️ Repository Types

### Git Repository

Syncs from Git repositories by accessing raw file contents.

```typescript
{
  type: 'git',
  url: 'https://github.com/disposable/disposable-email-domains',
  blocklist_files: [
    '/refs/heads/main/disposable_email_blocklist.conf',
    '/refs/heads/main/additional_domains.txt'
  ],
  allowlist_files: ['/refs/heads/main/whitelist.txt'],
  format: 'txt'
}
```

**Features:**
- Support for multiple files per repository
- Branch and tag specification
- Automatic format detection
- Error resilience for missing files

### Direct URL

Downloads from direct HTTP/HTTPS URLs.

```typescript
{
  type: 'url',
  url: 'https://example.com/disposable-domains.txt',
  format: 'txt',
  headers: {
    'User-Agent': 'DisposableEmailDomains/1.0',
    'Accept': 'text/plain'
  },
  encoding: 'utf-8'
}
```

**Features:**
- Custom HTTP headers support
- Multiple format support (txt, json, csv)
- Encoding specification
- Redirect following

### Local File

Processes local files on the filesystem.

```typescript
{
  type: 'local',
  url: '/path/to/local/domains.txt',
  format: 'txt',
  encoding: 'utf-8'
}
```

**Features:**
- File system access
- Multiple format support
- Encoding detection
- Directory scanning support

## 🎯 Advanced Usage

### Multi-Format Processing

```typescript
const repositories = [
  // Text format
  {
    type: 'url',
    url: 'https://example.com/domains.txt',
    format: 'txt'
  },
  // JSON format
  {
    type: 'url',
    url: 'https://api.example.com/domains.json',
    format: 'json'
  },
  // CSV format
  {
    type: 'local',
    url: './data/domains.csv',
    format: 'csv'
  }
];
```

### Custom Processing Pipeline

```typescript
class AdvanceSyncManager extends DisposableEmailSyncManager {
  private domainCategories = new Map<string, string>();
  
  async sync(repositories: Repository[]): Promise<SyncResult> {
    const result = await super.sync(repositories);
    
    // Post-process domains for categorization
    await this.categorizeDomains(result.domains);
    
    // Generate additional outputs
    await this.generateCategoryReport();
    await this.generateTrendAnalysis();
    
    return result;
  }
  
  private async categorizeDomains(domains: Set<string>): Promise<void> {
    for (const domain of domains) {
      const category = this.determineDomainCategory(domain);
      this.domainCategories.set(domain, category);
    }
  }
  
  private determineDomainCategory(domain: string): string {
    if (domain.includes('temp')) return 'temporary';
    if (domain.includes('mail')) return 'email-service';
    if (domain.includes('10min')) return 'short-lived';
    return 'general';
  }
}
```

### Batch Processing with Progress Tracking

```typescript
class ProgressTrackingSyncManager extends DisposableEmailSyncManager {
  private onProgress?: (progress: SyncProgress) => void;
  
  constructor(options: SyncOptions, onProgress?: (progress: SyncProgress) => void) {
    super(options);
    this.onProgress = onProgress;
  }
  
  protected async downloadFromRepositories(repositories: Repository[]): Promise<RepositoryStats[]> {
    const results: RepositoryStats[] = [];
    
    for (let i = 0; i < repositories.length; i++) {
      const repo = repositories[i];
      
      // Report progress
      this.onProgress?.({
        current: i + 1,
        total: repositories.length,
        currentRepository: repo.url,
        completed: i / repositories.length
      });
      
      const result = await this.downloadFromRepository(repo);
      results.push(result);
    }
    
    return results;
  }
}

interface SyncProgress {
  current: number;
  total: number;
  currentRepository: string;
  completed: number; // 0-1
}
```

## ⚡ Performance Optimization

### Concurrency Tuning

```typescript
// High-throughput configuration
const highThroughputManager = new DisposableEmailSyncManager({
  concurrency: 15,          // Higher concurrency for faster processing
  timeout: 60000,           // Longer timeout for reliability
  retries: 2,               // Fewer retries for speed
  enableStats: false        // Disable stats for minimal overhead
});

// Reliability-focused configuration  
const reliableManager = new DisposableEmailSyncManager({
  concurrency: 3,           // Lower concurrency for stability
  timeout: 30000,           // Standard timeout
  retries: 5,               // More retries for resilience
  enableStats: true,        // Full statistics tracking
  enableBackup: true        // Data backup enabled
});
```

### Memory Optimization

```typescript
class MemoryOptimizedSyncManager extends DisposableEmailSyncManager {
  private readonly maxDomainsInMemory = 50000;
  private domainBatches: string[][] = [];
  
  protected processDomains(domains: string[]): void {
    // Process domains in batches to reduce memory usage
    const batchSize = Math.min(this.maxDomainsInMemory, domains.length);
    
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      this.processBatch(batch);
    }
  }
  
  private processBatch(batch: string[]): void {
    // Process each batch independently
    const processedBatch = batch
      .filter(domain => this.validateDomain(domain))
      .map(domain => this.normalizeDomain(domain));
    
    this.domainBatches.push(processedBatch);
  }
}
```

## 🚨 Error Handling

###  Error Handling

```typescript
class RobustSyncManager extends DisposableEmailSyncManager {
  async sync(repositories: Repository[]): Promise<SyncResult> {
    try {
      return await super.sync(repositories);
    } catch (error) {
      console.error('Sync failed:', error);
      
      // Attempt recovery with reduced repository set
      const criticalRepos = repositories.filter(repo => 
        repo.url.includes('github.com') // Prioritize GitHub sources
      );
      
      if (criticalRepos.length > 0) {
        console.log('Attempting recovery with critical repositories...');
        return await super.sync(criticalRepos);
      }
      
      throw error;
    }
  }
  
  protected async downloadFromRepository(repo: Repository): Promise<RepositoryStats> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.syncOptions.retries; attempt++) {
      try {
        return await super.downloadFromRepository(repo);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.syncOptions.retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retry ${attempt}/${this.syncOptions.retries} for ${repo.url} in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}
```

### Graceful Degradation

```typescript
const manager = new DisposableEmailSyncManager({
  concurrency: 5,
  retries: 3
});

// Handle partial failures gracefully
const repositories = [
  { type: 'git', url: 'https://github.com/reliable/source1' },
  { type: 'url', url: 'https://unreliable.com/domains.txt' },
  { type: 'git', url: 'https://github.com/reliable/source2' }
];

const result = await manager.sync(repositories);

if (result.errors.length > 0) {
  console.warn(`${result.errors.length} repositories failed, but continuing with ${result.domains.size} domains`);
  
  // Log failed repositories for manual review
  result.stats.repositoryStats
    .filter(stat => !stat.success)
    .forEach(stat => console.log(`Failed: ${stat.url} - ${stat.error}`));
}
```

## 📊 Statistics & Monitoring

### Detailed Statistics Analysis

```typescript
const result = await manager.sync(repositories);
const stats = result.stats;

console.log('=== Sync Statistics ===');
console.log(`Total Repositories: ${stats.totalRepositories}`);
console.log(`Success Rate: ${(stats.successfulRepositories / stats.totalRepositories * 100).toFixed(1)}%`);
console.log(`Unique Domains: ${stats.uniqueDomains}`);
console.log(`Duplicates Removed: ${stats.duplicatesRemoved}`);
console.log(`Processing Efficiency: ${stats.processingEfficiency.toFixed(2)} domains/second`);
console.log(`Data Integrity Score: ${stats.dataIntegrityScore.toFixed(1)}%`);

// Repository performance analysis
stats.repositoryStats
  .sort((a, b) => b.domainsCount - a.domainsCount)
  .forEach((repo, index) => {
    console.log(`${index + 1}. ${repo.url}`);
    console.log(`   Domains: ${repo.domainsCount}, Time: ${repo.downloadTime}ms, Size: ${repo.fileSize} bytes`);
  });
```

### Performance Monitoring

```typescript
class MonitoredSyncManager extends DisposableEmailSyncManager {
  private performanceMetrics = {
    syncCount: 0,
    totalSyncTime: 0,
    averageSyncTime: 0,
    peakMemoryUsage: 0,
    errorRate: 0
  };
  
  async sync(repositories: Repository[]): Promise<SyncResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const result = await super.sync(repositories);
      
      // Update success metrics
      this.updateMetrics(startTime, startMemory, true);
      
      return result;
    } catch (error) {
      // Update failure metrics
      this.updateMetrics(startTime, startMemory, false);
      throw error;
    }
  }
  
  private updateMetrics(startTime: number, startMemory: number, success: boolean): void {
    const syncTime = Date.now() - startTime;
    const currentMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = currentMemory - startMemory;
    
    this.performanceMetrics.syncCount++;
    this.performanceMetrics.totalSyncTime += syncTime;
    this.performanceMetrics.averageSyncTime = 
      this.performanceMetrics.totalSyncTime / this.performanceMetrics.syncCount;
    this.performanceMetrics.peakMemoryUsage = 
      Math.max(this.performanceMetrics.peakMemoryUsage, memoryIncrease);
    
    if (!success) {
      this.performanceMetrics.errorRate = 
        (this.performanceMetrics.errorRate * (this.performanceMetrics.syncCount - 1) + 1) / 
        this.performanceMetrics.syncCount;
    }
  }
  
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }
}
```

## 💡 Examples

### Complete Production Setup

```typescript
import { DisposableEmailSyncManager } from '@usex/disposable-email-domains/syncer';
import { writeFileSync } from 'fs';

class ProductionSyncManager {
  private manager: DisposableEmailSyncManager;
  
  constructor() {
    this.manager = new DisposableEmailSyncManager({
      outputPath: './data/production',
      enableStats: true,
      enableBackup: true,
      concurrency: 8,
      timeout: 30000,
      retries: 3
    });
  }
  
  async performDailySync(): Promise<void> {
    const repositories = [
      {
        type: 'git' as const,
        url: 'https://github.com/FGRibreau/mailchecker',
        blocklist_files: ['/refs/heads/master/list.txt']
      },
      {
        type: 'git' as const,
        url: 'https://github.com/wesbos/burner-email-providers',
        blocklist_files: ['/refs/heads/master/emails.txt']
      },
      {
        type: 'git' as const,
        url: 'https://github.com/disposable/disposable-email-domains',
        blocklist_files: ['/refs/heads/main/disposable_email_blocklist.conf']
      },
      {
        type: 'url' as const,
        url: 'https://raw.githubusercontent.com/7c/fakefilter/main/txt/data.txt'
      }
    ];
    
    try {
      console.log('Starting daily domain synchronization...');
      const result = await this.manager.sync(repositories);
      
      // Save results in multiple formats
      this.saveResults(result);
      
      // Generate and send report
      await this.generateDailyReport(result);
      
      console.log(`Sync completed successfully: ${result.domains.size} domains`);
      
    } catch (error) {
      console.error('Daily sync failed:', error);
      await this.handleSyncFailure(error);
    }
  }
  
  private saveResults(result: SyncResult): void {
    const domains = Array.from(result.domains).sort();
    
    // Save as text file
    writeFileSync('./data/domains.txt', domains.join('\n'));
    
    // Save as JSON
    writeFileSync('./data/domains.json', JSON.stringify({
      domains,
      metadata: {
        count: domains.length,
        lastUpdated: new Date().toISOString(),
        sources: result.stats.successfulRepositories
      }
    }, null, 2));
    
    // Save statistics
    writeFileSync('./data/sync-stats.json', JSON.stringify(result.stats, null, 2));
  }
  
  private async generateDailyReport(result: SyncResult): Promise<void> {
    const report = {
      date: new Date().toISOString().split('T')[0],
      summary: {
        totalDomains: result.domains.size,
        newDomains: result.stats.newDomains,
        removedDomains: result.stats.removedDomains,
        successfulSources: result.stats.successfulRepositories,
        totalSources: result.stats.totalRepositories
      },
      performance: {
        syncTime: result.stats.totalTime,
        processingSpeed: result.stats.processingEfficiency,
        dataIntegrity: result.stats.dataIntegrityScore
      },
      errors: result.errors.map(error => error.message)
    };
    
    writeFileSync(`./reports/daily-${report.date}.json`, JSON.stringify(report, null, 2));
    
    // Send notification if configured
    if (process.env.WEBHOOK_URL) {
      await this.sendWebhookNotification(report);
    }
  }
  
  private async sendWebhookNotification(report: any): Promise<void> {
    try {
      const response = await fetch(process.env.WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Domain sync completed: ${report.summary.totalDomains} domains (${report.summary.newDomains} new)`
        })
      });
      
      if (!response.ok) {
        console.warn('Failed to send webhook notification');
      }
    } catch (error) {
      console.warn('Webhook notification failed:', error);
    }
  }
  
  private async handleSyncFailure(error: Error): Promise<void> {
    // Log error details
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    writeFileSync('./logs/sync-error.json', JSON.stringify(errorReport, null, 2));
    
    // Attempt emergency fallback sync
    try {
      console.log('Attempting emergency fallback sync...');
      const fallbackRepos = [
        {
          type: 'local' as const,
          url: './data/backup/domains.txt'
        }
      ];
      
      await this.manager.sync(fallbackRepos);
      console.log('Emergency fallback completed');
    } catch (fallbackError) {
      console.error('Emergency fallback also failed:', fallbackError);
    }
  }
}

// Usage
const syncManager = new ProductionSyncManager();
await syncManager.performDailySync();
```

### Custom Repository Format Handler

```typescript
class CustomFormatSyncManager extends DisposableEmailSyncManager {
  protected parseDomains(content: string, format: string = 'txt'): string[] {
    switch (format) {
      case 'txt':
        return super.parseDomains(content, format);
        
      case 'yaml':
        return this.parseYamlDomains(content);
        
      case 'xml':
        return this.parseXmlDomains(content);
        
      case 'custom':
        return this.parseCustomFormat(content);
        
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  private parseYamlDomains(content: string): string[] {
    // Simple YAML parsing for domain lists
    const lines = content.split('\n');
    const domains: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        const domain = trimmed.substring(2).trim();
        if (this.isValidDomain(domain)) {
          domains.push(domain);
        }
      }
    }
    
    return domains;
  }
  
  private parseXmlDomains(content: string): string[] {
    // Simple XML parsing for domain lists
    const domainMatches = content.match(/<domain>(.*?)<\/domain>/g) || [];
    return domainMatches
      .map(match => match.replace(/<\/?domain>/g, '').trim())
      .filter(domain => this.isValidDomain(domain));
  }
  
  private parseCustomFormat(content: string): string[] {
    // Custom format: JSON with nested structure
    try {
      const data = JSON.parse(content);
      const domains: string[] = [];
      
      if (data.disposable_domains && Array.isArray(data.disposable_domains)) {
        domains.push(...data.disposable_domains);
      }
      
      if (data.categories) {
        for (const category of Object.values(data.categories)) {
          if (Array.isArray(category)) {
            domains.push(...category);
          }
        }
      }
      
      return domains.filter(domain => this.isValidDomain(domain));
    } catch (error) {
      throw new Error(`Failed to parse custom format: ${error}`);
    }
  }
  
  private isValidDomain(domain: string): boolean {
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) && 
           !domain.includes('..') && 
           domain.length > 3 && 
           domain.length < 253;
  }
}
```

---

## 🔗 Related Documentation

- [Client SDK Documentation](../README.md) - Main SDK usage and API reference
- [CLI Documentation](./cli.md) - Command-line interface guide
- [Cache Adapters](../examples/cache/) - Custom cache implementations
- [Performance Benchmarks](../benchmarks/) - Performance testing and optimization

## 📞 Support

For syncer-specific questions and issues:

- 🐛 [Report Issues](https://github.com/ali-master/disposable-email-domains/issues)
- 💬 [Join Discussions](https://github.com/ali-master/disposable-email-domains/discussions)
- 📧 [Email Support](mailto:ali@usex.dev)

---

<div align="center">
  <p><strong>Domain Synchronization Manager</strong> - Part of the Disposable Email Domains SDK</p>
  <p>Made with ❤️ by <a href="https://github.com/ali-master">Ali Torki</a></p>
</div>
