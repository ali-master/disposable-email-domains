#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { YAML } from "bun";
import { DisposableEmailSyncManager } from "./sync-manager";
import type { Repository, SyncOptions, RepositoryConfig } from "./types";

/**
 * Command-line interface for the Disposable Email Domains Sync Manager
 *
 * Usage examples:
 * - Basic sync: bun run sync
 * - Custom config: bun run sync --config ./custom-repos.yaml
 * - High concurrency: bun run sync --concurrency 10
 * - Quick sync without stats: bun run sync --no-stats --no-backup
 */

interface CLIOptions {
  config?: string;
  output?: string;
  concurrency?: string;
  timeout?: string;
  retries?: string;
  "no-stats"?: boolean;
  "no-backup"?: boolean;
  verbose?: boolean;
  help?: boolean;
}

class CLI {
  private readonly defaultConfigPath = "configs/repositories.yaml";

  async run(): Promise<void> {
    try {
      const options = this.parseCommandLineArgs();

      if (options.help) {
        this.printHelp();
        return;
      }

      if (options.verbose) {
        console.log("🚀 Starting Disposable Email Domains Sync...\n");
      }

      const repositories = await this.loadRepositories(options.config ?? this.defaultConfigPath);
      const syncOptions = this.buildSyncOptions(options);

      const manager = new DisposableEmailSyncManager(syncOptions);

      if (options.verbose) {
        console.log(`📁 Output directory: ${syncOptions.outputPath}`);
        console.log(`🔗 Processing ${repositories.length} repositories`);
        console.log(`⚡ Concurrency: ${syncOptions.concurrency}`);
        console.log(`⏱️  Timeout: ${syncOptions.timeout}ms\n`);
      }

      const result = await manager.sync(repositories);

      // Display results
      this.displayResults(result, options.verbose || false);
    } catch (error) {
      console.error("❌ Sync failed:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  private parseCommandLineArgs(): CLIOptions {
    const { values } = parseArgs({
      options: {
        config: { type: "string", short: "c" },
        output: { type: "string", short: "o" },
        concurrency: { type: "string" },
        timeout: { type: "string" },
        retries: { type: "string" },
        "no-stats": { type: "boolean" },
        "no-backup": { type: "boolean" },
        verbose: { type: "boolean", short: "v" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: false,
    });

    return values as CLIOptions;
  }

  private async loadRepositories(configPath: string): Promise<Repository[]> {
    try {
      const configContent = await readFile(configPath, "utf-8");
      const config = YAML.parse(configContent) as RepositoryConfig;

      if (!config || !config.repositories || !Array.isArray(config.repositories)) {
        throw new Error("Invalid configuration format. Expected 'repositories' array.");
      }

      // Log metadata if available and verbose
      if (config.metadata) {
        const { version, description, total_sources, last_updated } = config.metadata;
        console.log(`📋 Configuration: ${description || "Disposable Email Domains"}`);
        if (version) console.log(`   Version: ${version}`);
        if (total_sources) console.log(`   Total sources: ${total_sources}`);
        if (last_updated) console.log(`   Last updated: ${last_updated}`);
        console.log();
      }

      // Validate and process repositories
      const repositories = config.repositories.map((repo, index) => {
        if (!repo.url) {
          throw new Error(`Repository at index ${index} is missing required 'url' field`);
        }

        // Set default type if not specified
        if (!repo.type) {
          repo.type = this.inferRepositoryType(repo.url);
        }

        // Set default blocklist files if not specified
        if (!repo.blocklist_files || repo.blocklist_files.length === 0) {
          throw new Error(
            `Repository at index ${index} is missing 'blocklist_files'. Please specify the files to fetch.`,
          );
        }

        // Validate repository type
        if (!["git", "raw", "api"].includes(repo.type)) {
          throw new Error(
            `Repository at index ${index} has invalid type '${repo.type}'. Must be 'git', 'raw', or 'api'.`,
          );
        }

        return repo;
      });

      // Sort by priority if specified (lower number = higher priority)
      repositories.sort((a, b) => (a.priority || 999) - (b.priority || 999));

      return repositories;
    } catch (error) {
      if (error instanceof Error && error.message.includes("ENOENT")) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      throw new Error(
        `Failed to load repository configuration from ${configPath}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private inferRepositoryType(url: string): Repository["type"] {
    if (url.includes("github.com") || url.includes("gitlab.com") || url.includes("bitbucket.org")) {
      return "git";
    } else if (url.includes("/api/") || url.endsWith(".json")) {
      return "api";
    } else {
      return "raw";
    }
  }

  private buildSyncOptions(options: CLIOptions): SyncOptions {
    return {
      outputPath: options.output || "data",
      enableStats: !options["no-stats"],
      enableBackup: !options["no-backup"],
      concurrency: options.concurrency ? parseInt(options.concurrency, 10) : 5,
      timeout: options.timeout ? parseInt(options.timeout, 10) : 30000,
      retries: options.retries ? parseInt(options.retries, 10) : 3,
    };
  }

  private displayResults(result: any, verbose: boolean): void {
    const { stats } = result;

    console.log("\n✅ Sync completed successfully!\n");

    console.log("📊 Summary:");
    console.log(`   • Total domains: ${stats.uniqueDomains.toLocaleString()}`);
    console.log(`   • New domains: ${stats.newDomains.toLocaleString()}`);
    console.log(`   • Removed domains: ${stats.removedDomains.toLocaleString()}`);
    console.log(`   • Processing time: ${(stats.processingTime / 1000).toFixed(2)}s`);
    console.log(
      `   • Success rate: ${((stats.successfulDownloads / stats.totalRepositories) * 100).toFixed(1)}%`,
    );

    if (verbose) {
      console.log("\n🔍 Repository Details:");
      Array.from(stats.repositoryStats.values()).forEach((repo: any) => {
        const status = repo.success ? "✅" : "❌";
        const timing = repo.downloadTime ? ` (${repo.downloadTime}ms)` : "";
        console.log(
          `   ${status} ${repo.url} (${repo.domainsCount.toLocaleString()} domains)${timing}`,
        );

        if (!repo.success && repo.error) {
          console.log(`      ⚠️  Error: ${repo.error}`);

          // Add helpful suggestions based on error type
          if (repo.error.includes("timeout") || repo.error.includes("ETIMEDOUT")) {
            console.log(`      💡 Suggestion: Try increasing timeout with --timeout <ms>`);
          } else if (repo.error.includes("404") || repo.error.includes("Not Found")) {
            console.log(`      💡 Suggestion: Repository may have moved or file path changed`);
          } else if (repo.error.includes("403") || repo.error.includes("rate limit")) {
            console.log(
              `      💡 Suggestion: Rate limited by GitHub, try again later or reduce concurrency`,
            );
          } else if (repo.error.includes("Network") || repo.error.includes("ENOTFOUND")) {
            console.log(`      💡 Suggestion: Check internet connection or DNS resolution`);
          } else if (repo.error.includes("SSL") || repo.error.includes("certificate")) {
            console.log(`      💡 Suggestion: SSL/TLS certificate issue, check repository URL`);
          }
        }
      });
    }

    // failed downloads section
    if (stats.failedDownloads > 0) {
      console.log(`\n⚠️  ${stats.failedDownloads} repositories failed to download`);

      // Show detailed failure information even in non-verbose mode
      const failedRepos = Array.from(stats.repositoryStats.values()).filter(
        (repo: any) => !repo.success,
      );

      if (failedRepos.length > 0) {
        console.log("\n🔍 Failed Repository Details:");
        failedRepos.forEach((repo: any, index: number) => {
          console.log(`\n   ${index + 1}. ${repo.url}`);
          console.log(`      ❌ Error: ${repo.error || "Unknown error"}`);
          console.log(`      ⏱️  Processing time: ${repo.downloadTime || 0}ms`);

          // Show which repository config this corresponds to
          const repoName = this.getRepositoryName(repo.url);
          if (repoName) {
            console.log(`      📋 Source: ${repoName}`);
          }

          // Provide specific troubleshooting steps
          console.log(`      🔧 Troubleshooting:`);

          if (repo.error?.includes("timeout") || repo.error?.includes("ETIMEDOUT")) {
            console.log(`         • Increase timeout: --timeout 60000`);
            console.log(`         • Reduce concurrency: --concurrency 2`);
          } else if (repo.error?.includes("404")) {
            console.log(`         • Verify repository URL is correct`);
            console.log(`         • Check if repository or file path has changed`);
            console.log(`         • Try accessing the URL in a browser`);
          } else if (repo.error?.includes("403") || repo.error?.includes("rate limit")) {
            console.log(`         • Wait a few minutes before retrying`);
            console.log(`         • Reduce concurrency: --concurrency 1`);
            console.log(`         • Consider using authentication for higher limits`);
          } else if (repo.error?.includes("Network") || repo.error?.includes("ENOTFOUND")) {
            console.log(`         • Check your internet connection`);
            console.log(`         • Verify DNS resolution: ping github.com`);
            console.log(`         • Try again in a few minutes`);
          } else if (repo.error?.includes("Invalid JSON")) {
            console.log(`         • API endpoint may have changed format`);
            console.log(`         • Check repository documentation for API changes`);
          } else {
            console.log(`         • Try running with --verbose for more details`);
            console.log(`         • Check repository accessibility in browser`);
            console.log(`         • Consider reporting this issue if persistent`);
          }
        });

        // General recommendations
        console.log(`\n💡 General Recovery Options:`);
        console.log(`   • Retry with: bun run sync --verbose`);
        console.log(`   • Increase timeout: bun run sync --timeout 60000`);
        console.log(`   • Reduce load: bun run sync --concurrency 2`);
        console.log(`   • Skip problematic repos by creating a custom config`);

        // Show command to create minimal working config
        const successfulRepos = Array.from(stats.repositoryStats.values()).filter(
          (repo: any) => repo.success,
        );
        if (successfulRepos.length > 0) {
          console.log(`\n✅ ${successfulRepos.length} repositories downloaded successfully:`);
          console.log(
            `   Total domains from successful sources: ${successfulRepos.reduce((sum: number, repo: any) => sum + repo.domainsCount, 0).toLocaleString()}`,
          );
        }
      }
    }

    console.log(`\n📁 Output files generated in: ${stats.outputPath || "dist"}/`);
    console.log("   • domains.txt - Plain text list");
    console.log("   • domains.json - JSON with metadata");
    if (stats.enableStats) {
      console.log("   • stats.json - Detailed statistics");
      console.log("   • report.md - Human-readable report");
    }
  }

  private getRepositoryName(url: string): string | null {
    // Map URLs to friendly names based on known patterns
    const nameMap: Record<string, string> = {
      "disposable-email-domains/disposable-email-domains": "Disposable Email Domains (Main)",
      "disposable/disposable": "Disposable Email Domains (Alternative)",
      "7c/fakefilter": "FakeFilter Data",
      "wesbos/burner-email-providers": "Burner Email Providers",
      "FGRibreau/mailchecker": "Mail Checker List",
      "MattKetmo/EmailChecker": "EmailChecker Throwaway Domains",
      "willwhite/freemail": "Freemail Domains",
      "sublime-security/static-files": "Sublime Security Disposable Providers",
    };

    for (const [pattern, name] of Object.entries(nameMap)) {
      if (url.includes(pattern)) {
        return name;
      }
    }

    return null;
  }

  private printHelp(): void {
    console.log(`
Disposable Email Domains Sync Manager

USAGE:
  bun run sync [OPTIONS]

OPTIONS:
  -c, --config <path>     Repository configuration file (default: configs/repositories.yaml)
  -o, --output <path>     Output directory (default: dist)
  --concurrency <num>     Number of concurrent downloads (default: 5)
  --timeout <ms>          Request timeout in milliseconds (default: 30000)
  --retries <num>         Number of retry attempts (default: 3)
  --no-stats              Disable statistics generation
  --no-backup             Disable backup creation
  -v, --verbose           Enable verbose output
  -h, --help              Show this help message

EXAMPLES:
  bun run sync                              # Basic sync with default settings
  bun run sync --config configs/custom.yaml # Use custom repository configuration
  bun run sync --concurrency 10 --verbose  # High concurrency with detailed output
  bun run sync --no-stats --no-backup      # Quick sync without extras

For more information, visit: https://github.com/ali-master/disposable-email-domains
`);
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  new CLI().run().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { CLI };
