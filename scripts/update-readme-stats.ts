#!/usr/bin/env bun

/**
 * README Stats Updater
 *
 * Dynamically updates the README.md file with current domain statistics
 * from the latest sync operation. This script is designed to run in
 * GitHub Actions workflows to keep statistics current.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

interface RepositoryStats {
  url: string;
  success: boolean;
  domainsCount: number;
  downloadTime: number;
  fileSize: number;
  errorMessage?: string;
}

interface SyncStatistics {
  totalRepositories: number;
  successfulDownloads: number;
  failedDownloads: number;
  totalDomains: number;
  uniqueDomains: number;
  duplicates: number;
  newDomains: number;
  removedDomains: number;
  processingTime: number;
  lastSyncTimestamp: string;
  repositoryStats: Record<string, RepositoryStats>;
}

class ReadmeStatsUpdater {
  private readonly statsPath: string;
  private readonly readmePath: string;
  private readonly domainsPath: string;

  private static readonly START_MARKER = "<!-- START STATS -->";
  private static readonly END_MARKER = "<!-- END STATS -->";

  constructor(
    statsPath = "data/stats.json",
    readmePath = "README.md",
    domainsPath = "data/domains.txt",
  ) {
    this.statsPath = statsPath;
    this.readmePath = readmePath;
    this.domainsPath = domainsPath;
  }

  /**
   * Main method to update README with current statistics
   */
  public async updateReadme(): Promise<void> {
    try {
      console.log("🚀 Starting README statistics update...");

      const stats = this.loadStatistics();
      const readme = this.loadReadme();
      const updatedReadme = this.injectStatistics(readme, stats);

      this.saveReadme(updatedReadme);

      console.log("✅ README successfully updated with current statistics");
      console.log(
        `📊 Updated with ${stats.uniqueDomains.toLocaleString()} domains from ${stats.totalRepositories} sources`,
      );
    } catch (error) {
      console.error("❌ Failed to update README:", error);
      process.exit(1);
    }
  }

  /**
   * Load and parse statistics from JSON file
   */
  private loadStatistics(): SyncStatistics {
    if (!existsSync(this.statsPath)) {
      throw new Error(`Statistics file not found: ${this.statsPath}`);
    }
    const statsContent = readFileSync(this.statsPath, "utf-8");
    return JSON.parse(statsContent) as SyncStatistics;
  }

  /**
   * Load current README content
   */
  private loadReadme(): string {
    if (!existsSync(this.readmePath)) {
      throw new Error(`README file not found: ${this.readmePath}`);
    }
    return readFileSync(this.readmePath, "utf-8");
  }

  /**
   * Save updated README content
   */
  private saveReadme(content: string): void {
    writeFileSync(this.readmePath, content, "utf-8");
  }

  /**
   * Inject statistics into README content.
   * Flow:
   * 1. Remove legacy blocks (old markers) to prevent duplicates.
   * 2. Replace inside existing <!-- START STATS --> ... <!-- END STATS --> if present.
   * 3. Else insert before Features heading.
   * 4. Fallback after Features section body.
   * 5. Last resort append.
   */
  private injectStatistics(readme: string, stats: SyncStatistics): string {
    const statsSection = this.generateStatsSection(stats).trim();
    const cleaned = this.removeLegacyBlocks(readme);
    return this.insertOrReplaceStats(cleaned, statsSection);
  }

  /**
   * Generate the statistics section markdown
   */
  private generateStatsSection(stats: SyncStatistics): string {
    const lastUpdate = new Date(stats.lastSyncTimestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const successRate = ((stats.successfulDownloads / stats.totalRepositories) * 100).toFixed(1);
    const processingTimeSeconds = (stats.processingTime / 1000).toFixed(2);

    // Get file size if available
    let fileSize = "N/A";
    if (existsSync(this.domainsPath)) {
      const sizeBytes = readFileSync(this.domainsPath, "utf-8").length;
      fileSize = this.formatFileSize(sizeBytes);
    }

    // Check if report.md exists
    const reportPath = "data/report.md";
    const hasReport = existsSync(reportPath);

    // Repository performance
    const repoStats = Object.values(stats.repositoryStats);
    const avgDownloadTime =
      repoStats.reduce((sum, repo) => sum + repo.downloadTime, 0) / (repoStats.length || 1);
    const totalDataSize = repoStats.reduce((sum, repo) => sum + repo.fileSize, 0);

    const reportSection = hasReport
      ? `\n> 📋 **[View Detailed Report](${reportPath})** | Last sync analysis and insights`
      : "";

    return `
## 📊 Current Statistics

> **Last Updated**: ${lastUpdate} | **Next Sync**: Automated twice daily (6 AM & 6 PM UTC)${reportSection}

<div align="center">

### 🎯 Domain Coverage

| 📧 **Total Domains** | 🆕 **Recent Additions** | 🗑️ **Recent Removals** | 📈 **Growth Rate** |
|:---:|:---:|:---:|:---:|
| **${stats.uniqueDomains.toLocaleString()}** | **${stats.newDomains.toLocaleString()}** | **${stats.removedDomains.toLocaleString()}** | **${this.calculateGrowthRate(stats)}** |

### ⚡ Performance Metrics

| 🚀 **Sync Time** | ✅ **Success Rate** | 📦 **File Size** | 🔄 **Deduplication** |
|:---:|:---:|:---:|:---:|
| **${processingTimeSeconds}s** | **${successRate}%** | **${fileSize}** | **${stats.duplicates.toLocaleString()} removed** |

</div>

### 🏆 Top Contributing Sources

| Repository | Domains | Success | Performance |
|------------|---------|---------|-------------|
${this.generateRepositoryTable(stats.repositoryStats)}

<details>
<summary>📈 <strong>Detailed Metrics</strong></summary>

#### 🔍 Sync Analysis
- **Total Sources**: ${stats.totalRepositories} repositories monitored
- **Active Sources**: ${stats.successfulDownloads} successfully synchronized
- **Failed Sources**: ${stats.failedDownloads} temporary failures
- **Processing Efficiency**: ${(stats.uniqueDomains / (stats.processingTime / 1000)).toFixed(0)} domains/second
- **Average Download Time**: ${(avgDownloadTime / 1000).toFixed(2)}s per repository
- **Total Data Processed**: ${this.formatFileSize(totalDataSize)}

#### 🎯 Quality Metrics
- **Duplicate Detection**: ${stats.duplicates.toLocaleString()} duplicates identified and removed
- **Data Integrity**: ${successRate}% repository success rate
- **Coverage Efficiency**: ${((stats.uniqueDomains / (stats.uniqueDomains + stats.duplicates)) * 100).toFixed(1)}% unique domains retained

</details>

---
`.trim();
  }

  /**
   * Generate repository statistics table
   */
  private generateRepositoryTable(repositoryStats: Record<string, RepositoryStats>): string {
    const repos = Object.values(repositoryStats)
      .sort((a, b) => b.domainsCount - a.domainsCount)
      .slice(0, 10);
    return repos
      .map((repo) => {
        const repoName = this.extractRepoName(repo.url);
        const status = repo.success ? "✅" : "❌";
        const domains = repo.domainsCount.toLocaleString();
        const performance = repo.success
          ? `${(repo.downloadTime / 1000).toFixed(2)}s (${this.formatFileSize(repo.fileSize)})`
          : repo.errorMessage || "Failed";
        return `| [${repoName}](${repo.url}) | ${domains} | ${status} | ${performance} |`;
      })
      .join("\n");
  }

  /**
   * Extract repository name from URL
   */
  private extractRepoName(url: string): string {
    const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
    return match ? match[1] : url.replace(/^https?:\/\//, "").substring(0, 30);
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Calculate growth rate based on recent changes
   */
  private calculateGrowthRate(stats: SyncStatistics): string {
    const netChange = stats.newDomains - stats.removedDomains;
    if (stats.uniqueDomains === 0) return "0.00%";
    const growthPercent = (netChange / stats.uniqueDomains) * 100;
    if (netChange > 0) return `+${growthPercent.toFixed(2)}%`;
    if (netChange < 0) return `${growthPercent.toFixed(2)}%`;
    return "0.00%";
  }

  /**
   * Remove legacy blocks:
   * - <!-- STATS --> ... <!-- END STATS -->
   * - <#comment #comment=" STATS "></#comment> ... <!-- END STATS -->
   * (We do NOT remove the new <!-- START STATS --> ... <!-- END STATS --> block here.)
   */
  private removeLegacyBlocks(readme: string): string {
    return readme
      .replace(/<!--\s*STATS\s*-->[\s\S]*?<!--\s*END\s+STATS\s*-->/gi, "")
      .replace(
        /<#comment\s+#comment\s*=\s*["']\s*STATS\s*["']\s*><\/#comment>[\s\S]*?<!--\s*END\s+STATS\s*-->/gi,
        "",
      )
      .trim();
  }

  /**
   * Core insertion / replacement logic using the new standard markers.
   */
  private insertOrReplaceStats(readme: string, statsContent: string): string {
    const start = ReadmeStatsUpdater.START_MARKER;
    const end = ReadmeStatsUpdater.END_MARKER;

    const existingBlockRegex = /<!--\s*START\s+STATS\s*-->[\s\S]*?<!--\s*END\s+STATS\s*-->/i;

    // 1. Replace existing block content.
    if (existingBlockRegex.test(readme)) {
      return readme.replace(existingBlockRegex, `${start}\n${statsContent.trim()}\n${end}`);
    }

    const newBlock = `${start}\n${statsContent.trim()}\n${end}\n`;

    // 2. Primary insertion BEFORE Features heading
    const featuresHeadingRegex = /^##[^\n]*Features[^\n]*$/im;
    const featuresMatch = readme.match(featuresHeadingRegex);
    if (featuresMatch && typeof featuresMatch.index === "number") {
      const idx = featuresMatch.index;
      const before = readme.slice(0, idx).replace(/\n{3,}$/, "\n\n");
      const after = readme.slice(idx).replace(/^\n+/, "");
      return `${before}${before.endsWith("\n") ? "" : "\n"}${newBlock}${after}`;
    }

    // 3. Fallback: after entire Features section block
    const afterFeaturesRegex = /(?:^##[^\n]*Features[^\n]*\n[\s\S]*?(?=^## |^###|\Z))/m;
    const afterFeaturesMatch = readme.match(afterFeaturesRegex);
    if (afterFeaturesMatch && typeof afterFeaturesMatch.index === "number") {
      const insertPos = afterFeaturesMatch.index + afterFeaturesMatch[0].length;
      const pre = readme.slice(0, insertPos).replace(/\n{3,}$/, "\n\n");
      const post = readme.slice(insertPos).replace(/^\n+/, "\n");
      return `${pre}${newBlock}${post}`;
    }

    // 4. Last resort: append
    return `${readme.replace(/\n+$/, "\n\n")}${newBlock}`;
  }

  /**
   * Generate a summary report for workflow output
   */
  public generateWorkflowSummary(stats: SyncStatistics): void {
    console.log("\n📋 README Update Summary");
    console.log("========================");
    console.log(`📧 Total Domains: ${stats.uniqueDomains.toLocaleString()}`);
    console.log(`🆕 New Domains: ${stats.newDomains.toLocaleString()}`);
    console.log(`🗑️ Removed Domains: ${stats.removedDomains.toLocaleString()}`);
    console.log(`⚡ Processing Time: ${(stats.processingTime / 1000).toFixed(2)}s`);
    console.log(
      `✅ Success Rate: ${((stats.successfulDownloads / stats.totalRepositories) * 100).toFixed(1)}%`,
    );
    console.log(`🔄 Duplicates Removed: ${stats.duplicates.toLocaleString()}`);
    console.log(`📊 Last Sync: ${new Date(stats.lastSyncTimestamp).toISOString()}`);

    if (process.env.GITHUB_ACTIONS) {
      console.log(`::set-output name=total_domains::${stats.uniqueDomains}`);
      console.log(`::set-output name=new_domains::${stats.newDomains}`);
      console.log(`::set-output name=removed_domains::${stats.removedDomains}`);
      console.log(
        `::set-output name=success_rate::${((stats.successfulDownloads / stats.totalRepositories) * 100).toFixed(1)}`,
      );
      console.log(`::set-output name=processing_time::${stats.processingTime}`);
    }
  }
}

// CLI execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const statsPath = args[0] || "data/stats.json";
  const readmePath = args[1] || "README.md";
  const domainsPath = args[2] || "data/domains.txt";

  const updater = new ReadmeStatsUpdater(statsPath, readmePath, domainsPath);

  try {
    const stats = updater["loadStatistics"]();
    await updater.updateReadme();
    updater.generateWorkflowSummary(stats);
  } catch (error) {
    console.error("💥 Script execution failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  void main();
}

export { ReadmeStatsUpdater, type SyncStatistics, type RepositoryStats };
