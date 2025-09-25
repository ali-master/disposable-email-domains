// Node pool for memory reuse
const nodePool: TrieNode[] = [];
const getPooledNode = (): TrieNode => {
  if (nodePool.length > 0) {
    const node = nodePool.pop()!;
    node.children.clear();
    node.isEndOfDomain = false;
    node.source = "";
    Object.keys(node.metadata).forEach((key) => delete node.metadata[key]);
    return node;
  }
  return new TrieNode();
};

const returnNodeToPool = (node: TrieNode): void => {
  if (nodePool.length < 10000) {
    nodePool.push(node);
  }
};

/**
 * Trie data structure for efficient domain matching
 */
export class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfDomain = false;
  source = "";
  metadata: Record<string, any> = {};
}

/**
 * Trie-based index for domain searching and matching
 */
export class TrieIndex {
  private root: TrieNode = new TrieNode();
  private static readonly DOMAIN_SEPARATOR = ".";

  /**
   * Insert domain into trie structure
   */
  insert(domain: string, source: string): void {
    // Use cached split result for better performance
    const dotIndex = domain.lastIndexOf(TrieIndex.DOMAIN_SEPARATOR);
    const parts = this.splitDomainReverse(domain, dotIndex);
    let currentNode = this.root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let childNode = currentNode.children.get(part);

      if (!childNode) {
        childNode = getPooledNode();
        currentNode.children.set(part, childNode);
      }
      currentNode = childNode;
    }

    currentNode.isEndOfDomain = true;
    currentNode.source = source;
  }

  /**
   * Optimized domain splitting in reverse order
   */
  private splitDomainReverse(domain: string, lastDotIndex: number): string[] {
    if (lastDotIndex === -1) {
      return [domain];
    }

    const parts: string[] = [];
    let currentIndex = domain.length;
    let dotIndex = lastDotIndex;

    while (dotIndex !== -1) {
      parts.push(domain.slice(dotIndex + 1, currentIndex));
      currentIndex = dotIndex;
      dotIndex = domain.lastIndexOf(TrieIndex.DOMAIN_SEPARATOR, dotIndex - 1);
    }

    if (currentIndex > 0) {
      parts.push(domain.slice(0, currentIndex));
    }

    return parts;
  }

  /**
   * Search domain in trie structure
   */
  search(domain: string): {
    found: boolean;
    matchType: "exact" | "subdomain";
    confidence: number;
    source: string;
  } {
    const dotIndex = domain.lastIndexOf(TrieIndex.DOMAIN_SEPARATOR);
    const parts = this.splitDomainReverse(domain, dotIndex);
    let currentNode = this.root;
    let exactMatch = false;
    let subdomainMatch = false;
    let matchSource = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const childNode = currentNode.children.get(part);

      if (childNode) {
        currentNode = childNode;

        if (currentNode.isEndOfDomain) {
          matchSource = currentNode.source;
          if (i === parts.length - 1) {
            exactMatch = true;
          } else {
            subdomainMatch = true;
          }
        }
      } else {
        break;
      }
    }

    if (exactMatch) {
      return { found: true, matchType: "exact", confidence: 100, source: matchSource };
    } else if (subdomainMatch) {
      return { found: true, matchType: "subdomain", confidence: 85, source: matchSource };
    }

    return { found: false, matchType: "exact", confidence: 0, source: "" };
  }

  /**
   * Batch search for multiple domains
   */
  searchBatch(domains: string[]): Array<{
    domain: string;
    found: boolean;
    matchType: "exact" | "subdomain";
    confidence: number;
    source: string;
  }> {
    return domains.map((domain) => ({
      domain,
      ...this.search(domain),
    }));
  }

  /**
   * Check if domain exists (faster than full search)
   */
  has(domain: string): boolean {
    const dotIndex = domain.lastIndexOf(TrieIndex.DOMAIN_SEPARATOR);
    const parts = this.splitDomainReverse(domain, dotIndex);
    let currentNode = this.root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const childNode = currentNode.children.get(part);

      if (!childNode) {
        return false;
      }
      currentNode = childNode;
    }

    return currentNode.isEndOfDomain;
  }

  /**
   * Clear the trie index and return nodes to pool
   */
  clear(): void {
    this.clearNode(this.root);
    this.root = new TrieNode();
  }

  private clearNode(node: TrieNode): void {
    for (const child of node.children.values()) {
      this.clearNode(child);
      returnNodeToPool(child);
    }
    node.children.clear();
  }

  /**
   * Get memory usage statistics
   */
  getStats(): { nodeCount: number; memoryEstimate: number } {
    let nodeCount = 0;
    const traverse = (node: TrieNode): void => {
      nodeCount++;
      for (const child of node.children.values()) {
        traverse(child);
      }
    };

    traverse(this.root);

    // Rough estimate: each node ~200 bytes (Map overhead + strings + metadata)
    const memoryEstimate = nodeCount * 200;

    return { nodeCount, memoryEstimate };
  }
}
