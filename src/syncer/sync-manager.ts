import { promises as fs } from "node:fs";
import { join } from "node:path";
import type {
  Repository,
  SyncStats,
  RepositoryStats,
  DomainEntry,
  SyncOptions,
  SyncResult,
} from "./types";

/**
 * DisposableEmailSyncManager - A manager for downloading and synchronizing
 * disposable email domains from multiple sources with detailed statistics and deduplication.
 *
 * Features:
 * - Multi-source downloading with concurrency control
 * - Intelligent deduplication with source tracking
 * -  statistics generation
 * - Backup and versioning support
 * - Error handling and retry mechanisms
 */
export class DisposableEmailSyncManager {
  private readonly domains = new Map<string, DomainEntry>();
  private readonly previousDomains = new Set<string>();
  private readonly syncOptions: Required<SyncOptions>;

  constructor(options: SyncOptions = {}) {
    this.syncOptions = {
      outputPath: options.outputPath ?? "dist",
      enableStats: options.enableStats ?? true,
      enableBackup: options.enableBackup ?? true,
      concurrency: options.concurrency ?? 5,
      timeout: options.timeout ?? 30000,
      retries: options.retries ?? 3,
    };
  }

  /**
   * Main synchronization method that orchestrates the entire process
   */
  async sync(repositories: Repository[]): Promise<SyncResult> {
    const startTime = Date.now();
    const stats = this.initializeStats(repositories.length);
    const errors: Error[] = [];

    try {
      // Load previous domains for comparison
      await this.loadPreviousDomains();

      // Download from all repositories with concurrency control
      const downloadResults = await this.downloadFromRepositories(repositories);

      // Process results and update stats
      this.processDownloadResults(downloadResults, stats);

      // Calculate final statistics
      this.calculateFinalStats(stats, startTime);

      // Generate outputs
      await this.generateOutputs(stats);

      return {
        domains: new Set(this.domains.keys()),
        stats,
        errors,
      };
    } catch (error) {
      errors.push(error as Error);
      throw error;
    }
  }

  /**
   * Downloads domains from all repositories with controlled concurrency
   */
  private async downloadFromRepositories(repositories: Repository[]): Promise<RepositoryStats[]> {
    const results: RepositoryStats[] = [];
    const semaphore = new Semaphore(this.syncOptions.concurrency);

    const downloadPromises = repositories.map(async (repo) => {
      return semaphore.acquire(async () => {
        return this.downloadFromRepository(repo);
      });
    });

    const downloadResults = await Promise.allSettled(downloadPromises);

    downloadResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          url: repositories[index].url,
          success: false,
          domainsCount: 0,
          error: result.reason.message,
          downloadTime: 0,
          fileSize: 0,
        });
      }
    });

    return results;
  }

  /**
   * Downloads domains from a single repository with retry logic
   */
  private async downloadFromRepository(repo: Repository): Promise<RepositoryStats> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.syncOptions.retries; attempt++) {
      try {
        const domains = await this.fetchDomainsFromRepository(repo);
        const downloadTime = Date.now() - startTime;

        // Add domains to our collection
        domains.forEach((domain) => this.addDomain(domain, repo.url));

        return {
          url: repo.url,
          success: true,
          domainsCount: domains.length,
          downloadTime,
          fileSize: domains.join("\n").length,
        };
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.syncOptions.retries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
        }
      }
    }

    return {
      url: repo.url,
      success: false,
      domainsCount: 0,
      error: lastError?.message ?? "Unknown error",
      downloadTime: Date.now() - startTime,
      fileSize: 0,
    };
  }

  /**
   * Fetches domains from a repository based on its type
   */
  private async fetchDomainsFromRepository(repo: Repository): Promise<string[]> {
    switch (repo.type) {
      case "git":
        return this.fetchFromGitRepository(repo);
      case "raw":
        return this.fetchFromRawUrl(repo);
      case "api":
        return this.fetchFromApi(repo);
      default:
        throw new Error(`Unsupported repository type: ${repo.type}`);
    }
  }

  /**
   * Fetches domains from GitHub repository using raw file URLs
   */
  private async fetchFromGitRepository(repo: Repository): Promise<string[]> {
    const allDomains: string[] = [];

    for (const filePath of repo.blocklist_files) {
      const rawUrl = this.convertToRawGitHubUrl(repo.url, filePath);
      const domains = await this.fetchFromRawUrl({ ...repo, url: rawUrl });
      allDomains.push(...domains);
    }

    return allDomains;
  }

  /**
   * Fetches domains from a raw text URL
   */
  private async fetchFromRawUrl(repo: Repository): Promise<string[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.syncOptions.timeout);

    try {
      const response = await fetch(repo.url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "DisposableEmailSyncManager/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      return this.parseDomainList(text);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetches domains from an API endpoint
   */
  private async fetchFromApi(repo: Repository): Promise<string[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.syncOptions.timeout);

    try {
      const response = await fetch(repo.url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "DisposableEmailSyncManager/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle different API response formats
      if (Array.isArray(data)) {
        return data.filter((item) => typeof item === "string");
      } else {
        // @ts-ignore
        if (data.domains && Array.isArray(data.domains)) {
          // @ts-ignore
          return data.domains;
        } else if (typeof data === "object") {
          // @ts-ignore
          return Object.keys(data);
        }
      }

      throw new Error("Unsupported API response format");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Converts GitHub repository URL to raw file URL
   */
  private convertToRawGitHubUrl(repoUrl: string, filePath: string): string {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub URL: ${repoUrl}`);
    }

    const [, owner, repo] = match;
    const cleanFilePath = filePath.startsWith("/") ? filePath.slice(1) : filePath;

    return `https://raw.githubusercontent.com/${owner}/${repo}/${cleanFilePath}`;
  }

  /**
   * Parses domain list from text content with various formats support
   */
  private parseDomainList(text: string): string[] {
    const domains: string[] = [];
    const lines = text.split("\n");

    for (let line of lines) {
      line = line.trim();

      // Skip empty lines and comments
      if (!line || line.startsWith("#") || line.startsWith("//") || line.startsWith(";")) {
        continue;
      }

      // Extract domain from various formats
      const domain = this.extractDomain(line);
      if (domain && this.isValidDomain(domain)) {
        domains.push(domain.toLowerCase());
      }
    }

    return domains;
  }

  /**
   * Extracts domain from various line formats
   */
  private extractDomain(line: string): string | null {
    // Remove common prefixes and suffixes
    line = line
      .replace(/^(0\.0\.0\.0\s+|127\.0\.0\.1\s+|localhost\s+)/, "") // Host file format
      .replace(/^\*\./, "") // Wildcard format
      .replace(/\s.*$/, "") // Remove trailing content
      .replace(/[,;].*$/, "") // Remove trailing separators
      .trim();

    // Extract email domain from email format
    const emailMatch = line.match(/@(.+)$/);
    if (emailMatch) {
      return emailMatch[1];
    }

    return line || null;
  }

  /**
   * Validates domain format using regex
   */
  private isValidDomain(domain: string): boolean {
    if (!domain || domain.length > 253) return false;

    const domainRegex =
      /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    return domainRegex.test(domain) && !domain.includes("..") && domain.includes(".");
  }

  /**
   * Adds a domain to the collection with source tracking
   */
  private addDomain(domain: string, source: string): void {
    const normalizedDomain = domain.toLowerCase().trim();
    const now = new Date().toISOString();

    if (this.domains.has(normalizedDomain)) {
      const entry = this.domains.get(normalizedDomain)!;
      entry.sources.add(source);
      entry.lastSeen = now;
    } else {
      this.domains.set(normalizedDomain, {
        domain: normalizedDomain,
        sources: new Set([source]),
        firstSeen: now,
        lastSeen: now,
      });
    }
  }

  /**
   * Loads previous domain list for comparison
   */
  private async loadPreviousDomains(): Promise<void> {
    try {
      const filePath = join(this.syncOptions.outputPath, "domains.txt");
      const content = await fs.readFile(filePath, "utf-8");
      const domains = content.split("\n").filter((line) => line.trim());
      domains.forEach((domain) => this.previousDomains.add(domain.trim().toLowerCase()));
    } catch {
      // File doesn't exist, which is fine for first run
    }
  }

  /**
   * Processes download results and updates statistics
   */
  private processDownloadResults(results: RepositoryStats[], stats: SyncStats): void {
    results.forEach((result) => {
      stats.repositoryStats.set(result.url, result);

      if (result.success) {
        stats.successfulDownloads++;
      } else {
        stats.failedDownloads++;
      }
    });
  }

  /**
   * Calculates final statistics after processing
   */
  private calculateFinalStats(stats: SyncStats, startTime: number): void {
    const currentDomains = new Set(this.domains.keys());

    stats.totalDomains = this.domains.size;
    stats.uniqueDomains = this.domains.size;
    stats.duplicates = Array.from(this.domains.values()).reduce(
      (sum, entry) => sum + (entry.sources.size - 1),
      0,
    );

    // Calculate new and removed domains
    stats.newDomains = Array.from(currentDomains).filter(
      (domain) => !this.previousDomains.has(domain),
    ).length;

    stats.removedDomains = Array.from(this.previousDomains).filter(
      (domain) => !currentDomains.has(domain),
    ).length;

    stats.processingTime = Date.now() - startTime;
    stats.lastSyncTimestamp = new Date().toISOString();
  }

  /**
   * Generates all output files and statistics
   */
  private async generateOutputs(stats: SyncStats): Promise<void> {
    await fs.mkdir(this.syncOptions.outputPath, { recursive: true });

    // Create backup BEFORE generating new files (if backup is enabled and previous file exists)
    if (this.syncOptions.enableBackup) {
      await this.createBackup();
    }

    // Generate main domains list
    await this.generateDomainsList();

    // Generate statistics if enabled
    if (this.syncOptions.enableStats) {
      await this.generateStatistics(stats);
      await this.generateDetailedReport(stats);
    }
  }

  /**
   * Generates the main domains list file
   */
  private async generateDomainsList(): Promise<void> {
    const sortedDomains = Array.from(this.domains.keys()).sort();
    const content = sortedDomains.join("\n") + "\n";

    await fs.writeFile(join(this.syncOptions.outputPath, "domains.txt"), content, "utf-8");

    // Also generate JSON format with metadata
    const domainsWithMetadata = Array.from(this.domains.values()).map((entry) => ({
      domain: entry.domain,
      sources: Array.from(entry.sources),
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
    }));

    await fs.writeFile(
      join(this.syncOptions.outputPath, "domains.json"),
      JSON.stringify(domainsWithMetadata, null, 2),
      "utf-8",
    );
  }

  /**
   * Generates statistics file
   */
  private async generateStatistics(stats: SyncStats): Promise<void> {
    const statisticsData = {
      ...stats,
      repositoryStats: Object.fromEntries(stats.repositoryStats),
    };

    await fs.writeFile(
      join(this.syncOptions.outputPath, "stats.json"),
      JSON.stringify(statisticsData, null, 2),
      "utf-8",
    );
  }

  /**
   * Generates detailed human-readable report
   */
  private async generateDetailedReport(stats: SyncStats): Promise<void> {
    const report = this.buildDetailedReport(stats);

    await fs.writeFile(join(this.syncOptions.outputPath, "report.md"), report, "utf-8");
  }

  /**
   * Builds detailed markdown report
   */
  private buildDetailedReport(stats: SyncStats): string {
    const successRate = ((stats.successfulDownloads / stats.totalRepositories) * 100).toFixed(1);

    return `# Disposable Email Domains Sync Report

## Summary
- **Last Sync**: ${stats.lastSyncTimestamp}
- **Processing Time**: ${(stats.processingTime / 1000).toFixed(2)}s
- **Total Repositories**: ${stats.totalRepositories}
- **Successful Downloads**: ${stats.successfulDownloads}
- **Failed Downloads**: ${stats.failedDownloads}
- **Success Rate**: ${successRate}%

## Domain Statistics
- **Total Unique Domains**: ${stats.uniqueDomains.toLocaleString()}
- **New Domains**: ${stats.newDomains.toLocaleString()}
- **Removed Domains**: ${stats.removedDomains.toLocaleString()}
- **Duplicate Entries Found**: ${stats.duplicates.toLocaleString()}

## Repository Details

${Array.from(stats.repositoryStats.values())
  .map(
    (repo) => `
### ${repo.url}
- **Status**: ${repo.success ? "✅ Success" : "❌ Failed"}
- **Domains**: ${repo.domainsCount.toLocaleString()}
- **Download Time**: ${repo.downloadTime}ms
- **File Size**: ${repo.fileSize.toLocaleString()} bytes
${repo.error ? `- **Error**: ${repo.error}` : ""}
`,
  )
  .join("\n")}

---
*Generated by DisposableEmailSyncManager*
`;
  }

  /**
   * Creates backup of previous version
   */
  private async createBackup(): Promise<void> {
    try {
      const currentFile = join(this.syncOptions.outputPath, "domains.txt");

      // Check if the current file exists before attempting backup
      try {
        const stats = await fs.stat(currentFile);
        if (stats.size === 0) {
          // File exists but is empty, skip backup
          return;
        }
      } catch {
        // File doesn't exist, skip backup
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupDir = join(this.syncOptions.outputPath, "backups");
      await fs.mkdir(backupDir, { recursive: true });

      const backupFile = join(backupDir, `domains-${timestamp}.txt`);

      // Copy the existing file to backup
      await fs.copyFile(currentFile, backupFile);

      // Verify backup was created successfully
      const backupStats = await fs.stat(backupFile);
      if (backupStats.size === 0) {
        // Remove empty backup file
        await fs.unlink(backupFile);
      }
    } catch (error) {
      // Backup creation is optional, but log the error in verbose mode
      console.warn(`⚠️  Backup creation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Initializes statistics object
   */
  private initializeStats(repositoryCount: number): SyncStats {
    return {
      totalRepositories: repositoryCount,
      successfulDownloads: 0,
      failedDownloads: 0,
      totalDomains: 0,
      uniqueDomains: 0,
      duplicates: 0,
      newDomains: 0,
      removedDomains: 0,
      processingTime: 0,
      lastSyncTimestamp: "",
      repositoryStats: new Map(),
    };
  }

  /**
   * Simple delay utility for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore implementation for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    await this.waitForPermit();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private async waitForPermit(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  private release(): void {
    if (this.waitQueue.length > 0) {
      const nextResolver = this.waitQueue.shift()!;
      nextResolver();
    } else {
      this.permits++;
    }
  }
}
