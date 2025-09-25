/**
 * Core type definitions for the disposable email domains sync manager
 */

export interface Repository {
  name?: string;
  type: "git" | "raw" | "api";
  url: string;
  blocklist_files: string[];
  description?: string;
  priority?: number;
  branch?: string;
}

export interface RepositoryConfig {
  repositories: Repository[];
  metadata?: {
    version?: string;
    last_updated?: string;
    total_sources?: number;
    description?: string;
    maintainer?: string;
  };
}

export interface SyncStats {
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
  repositoryStats: Map<string, RepositoryStats>;
}

export interface RepositoryStats {
  url: string;
  success: boolean;
  domainsCount: number;
  error?: string;
  downloadTime: number;
  fileSize: number;
}

export interface DomainEntry {
  domain: string;
  sources: Set<string>;
  firstSeen: string;
  lastSeen: string;
}

export interface SyncOptions {
  outputPath?: string;
  enableStats?: boolean;
  enableBackup?: boolean;
  concurrency?: number;
  timeout?: number;
  retries?: number;
}

export interface SyncResult {
  domains: Set<string>;
  stats: SyncStats;
  errors: Error[];
}
