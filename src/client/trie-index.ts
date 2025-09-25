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

  /**
   * Insert domain into trie structure
   */
  insert(domain: string, source: string): void {
    const parts = domain.split(".").reverse(); // Reverse for suffix matching
    let currentNode = this.root;

    for (const part of parts) {
      if (!currentNode.children.has(part)) {
        currentNode.children.set(part, new TrieNode());
      }
      currentNode = currentNode.children.get(part)!;
    }

    currentNode.isEndOfDomain = true;
    currentNode.source = source;
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
    const parts = domain.split(".").reverse();
    let currentNode = this.root;
    let exactMatch = false;
    let subdomainMatch = false;
    let matchSource = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (currentNode.children.has(part)) {
        currentNode = currentNode.children.get(part)!;

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
   * Clear the trie index
   */
  clear(): void {
    this.root = new TrieNode();
  }
}
