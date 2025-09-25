import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { debug as createDebugger } from "debug";

const debug = createDebugger("disposable-email:data-loader");

/**
 * Data loader for managing disposable domains, allowlists, and blacklists
 */
export class DataLoader {
  /**
   * Load disposable domains from URL or local file
   */
  async loadDisposableDomains(
    localDataPath: string,
    disposableDomainsUrl: string,
    autoUpdate: boolean,
  ): Promise<Set<string>> {
    try {
      let domains: string[] = [];

      // Try loading from local file first
      if (existsSync(localDataPath)) {
        const content = readFileSync(localDataPath, "utf-8");
        domains = content
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        debug("Loaded %d domains from local file: %s", domains.length, localDataPath);
      }

      // Download from URL if auto-update is enabled or local file doesn't exist
      if (autoUpdate || domains.length === 0) {
        try {
          debug("Downloading disposable domains from URL: %s", disposableDomainsUrl);
          const response = await fetch(disposableDomainsUrl);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const content = await response.text();
          const downloadedDomains = content
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

          if (downloadedDomains.length > domains.length) {
            domains = downloadedDomains;

            // Save to local file
            const dir = localDataPath.split("/").slice(0, -1).join("/");
            if (dir && !existsSync(dir)) {
              mkdirSync(dir, { recursive: true });
            }

            writeFileSync(localDataPath, domains.join("\n"), "utf-8");
            debug("Saved %d domains to local file: %s", domains.length, localDataPath);
          }
        } catch (downloadError) {
          debug("Failed to download domains, using local data: %o", downloadError);
        }
      }

      // Populate and validate domains set
      const domainsSet = new Set<string>();
      domains.forEach((domain) => {
        if (this.isValidDomain(domain)) {
          domainsSet.add(domain.toLowerCase());
        }
      });

      debug("Loaded %d valid disposable domains", domainsSet.size);
      return domainsSet;
    } catch (error) {
      debug("Failed to load disposable domains: %o", error);
      throw error;
    }
  }

  /**
   * Load allowlist domains from file
   */
  async loadAllowlist(allowlistPath: string): Promise<Set<string>> {
    if (!existsSync(allowlistPath)) {
      debug("Allowlist file not found: %s", allowlistPath);
      return new Set<string>();
    }

    try {
      const content = readFileSync(allowlistPath, "utf-8");
      const domains = content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const allowlistSet = new Set<string>();
      domains.forEach((domain) => {
        if (this.isValidDomain(domain)) {
          allowlistSet.add(domain.toLowerCase());
        }
      });

      debug("Loaded %d allowlisted domains from: %s", allowlistSet.size, allowlistPath);
      return allowlistSet;
    } catch (error) {
      debug("Failed to load allowlist from %s: %o", allowlistPath, error);
      return new Set<string>();
    }
  }

  /**
   * Load blacklist domains from file
   */
  async loadBlacklist(blacklistPath: string): Promise<Set<string>> {
    if (!existsSync(blacklistPath)) {
      debug("Blacklist file not found: %s", blacklistPath);
      return new Set<string>();
    }

    try {
      const content = readFileSync(blacklistPath, "utf-8");
      const domains = content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const blacklistSet = new Set<string>();
      domains.forEach((domain) => {
        if (this.isValidDomain(domain)) {
          blacklistSet.add(domain.toLowerCase());
        }
      });

      debug("Loaded %d blacklisted domains from: %s", blacklistSet.size, blacklistPath);
      return blacklistSet;
    } catch (error) {
      debug("Failed to load blacklist from %s: %o", blacklistPath, error);
      return new Set<string>();
    }
  }

  /**
   * Save domains set to file
   */
  saveDomains(domains: Set<string>, filePath: string): void {
    try {
      const dir = filePath.split("/").slice(0, -1).join("/");
      if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const content = Array.from(domains).sort().join("\n");
      writeFileSync(filePath, content, "utf-8");
      debug("Saved %d domains to: %s", domains.size, filePath);
    } catch (error) {
      debug("Failed to save domains to %s: %o", filePath, error);
      throw error;
    }
  }

  /**
   * Validate domain format
   */
  private isValidDomain(domain: string): boolean {
    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  /**
   * Get file size in bytes
   */
  getFileSize(filePath: string): number {
    try {
      if (existsSync(filePath)) {
        return readFileSync(filePath, "utf-8").length;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Check if file exists and is readable
   */
  isFileAccessible(filePath: string): boolean {
    try {
      return existsSync(filePath) && readFileSync(filePath, "utf-8").length > 0;
    } catch {
      return false;
    }
  }
}
