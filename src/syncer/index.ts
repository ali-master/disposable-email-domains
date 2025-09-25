export { DisposableEmailSyncManager } from "./sync-manager";
export { CLI } from "./cli";
export type {
  Repository,
  RepositoryConfig,
  SyncStats,
  RepositoryStats,
  DomainEntry,
  SyncOptions,
  SyncResult,
} from "./types";

import { DisposableEmailSyncManager } from "./sync-manager";
import type { Repository, SyncOptions, SyncResult } from "./types";

/**
 * Quick sync function for simple use cases
 *
 * @example
 * ```typescript
 * import { quickSync } from '  @usex/disposable-email-domains';
 *
 * const result = await quickSync([
 *   {
 *     type: 'git',
 *     url: 'https://github.com/disposable-email-domains/disposable-email-domains',
 *     blocklist_files: ['/refs/heads/main/disposable_email_blocklist.conf']
 *   }
 * ]);
 *
 * console.log(`Synced ${result.domains.size} domains`);
 * ```
 */
export async function quickSync(
  repositories: Repository[],
  options?: SyncOptions,
): Promise<SyncResult> {
  const manager = new DisposableEmailSyncManager(options);
  return manager.sync(repositories);
}

/**
 * Create a new sync manager instance with configuration
 *
 * @example
 * ```typescript
 * import { createSyncManager } from '@usex/disposable-email-domains';
 *
 * const manager = createSyncManager({
 *   concurrency: 10,
 *   enableStats: true,
 *   outputPath: './output'
 * });
 *
 * const result = await manager.sync(repositories);
 * ```
 */
export function createSyncManager(options?: SyncOptions): DisposableEmailSyncManager {
  return new DisposableEmailSyncManager(options);
}

/**
 * Default repository configurations for popular disposable email sources
 */
export const DEFAULT_REPOSITORIES: Repository[] = [
  {
    type: "git",
    url: "https://github.com/disposable-email-domains/disposable-email-domains",
    blocklist_files: ["/refs/heads/main/disposable_email_blocklist.conf"],
  },
  {
    type: "git",
    url: "https://github.com/disposable/disposable",
    blocklist_files: ["/refs/heads/main/disposable_email_blocklist.conf"],
  },
  {
    type: "git",
    url: "https://github.com/7c/fakefilter",
    blocklist_files: ["/refs/heads/main/txt/data.txt"],
  },
  {
    type: "git",
    url: "https://github.com/wesbos/burner-email-providers",
    blocklist_files: ["/refs/heads/master/emails.txt"],
  },
  {
    type: "git",
    url: "https://github.com/FGRibreau/mailchecker",
    blocklist_files: ["/refs/heads/master/list.txt"],
  },
];
