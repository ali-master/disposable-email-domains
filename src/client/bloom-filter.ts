/**
 * Bloom filter for probabilistic membership testing
 */
export class BloomFilter {
  private readonly bitArray: Uint8Array;
  private readonly hashSeeds: number[];
  private readonly size: number;
  private readonly numHashFunctions: number;
  private readonly byteSize: number;
  private bitsPerByte = 8;

  constructor(expectedElements: number, falsePositiveRate = 0.01) {
    this.size = Math.ceil((-expectedElements * Math.log(falsePositiveRate)) / Math.log(2) ** 2);
    this.numHashFunctions = Math.ceil((this.size / expectedElements) * Math.log(2));
    this.byteSize = Math.ceil(this.size / this.bitsPerByte);
    this.bitArray = new Uint8Array(this.byteSize);
    this.hashSeeds = this.generateHashSeeds();
  }

  private generateHashSeeds(): number[] {
    const seeds = [];
    for (let i = 0; i < this.numHashFunctions; i++) {
      seeds.push(i * 0x9e3779b9); // Golden ratio hash constant
    }
    return seeds;
  }

  private hash(str: string, seed: number): number {
    let hash1 = 0x811c9dc5; // FNV offset basis
    let hash2 = seed;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash1 ^= char;
      hash1 = Math.imul(hash1, 0x01000193); // FNV prime

      hash2 = (hash2 << 5) - hash2 + char;
      hash2 = hash2 & hash2; // Convert to 32-bit integer
    }

    // Combine the two hashes using double hashing technique
    return Math.abs((hash1 + hash2) % this.size);
  }

  add(item: string): void {
    for (let i = 0; i < this.numHashFunctions; i++) {
      const bitIndex = this.hash(item, this.hashSeeds[i]);
      const byteIndex = Math.floor(bitIndex / this.bitsPerByte);
      const bitPosition = bitIndex % this.bitsPerByte;
      this.bitArray[byteIndex] |= 1 << bitPosition;
    }
  }

  contains(item: string): boolean {
    for (let i = 0; i < this.numHashFunctions; i++) {
      const bitIndex = this.hash(item, this.hashSeeds[i]);
      const byteIndex = Math.floor(bitIndex / this.bitsPerByte);
      const bitPosition = bitIndex % this.bitsPerByte;

      if ((this.bitArray[byteIndex] & (1 << bitPosition)) === 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Batch check multiple items for better performance
   */
  containsBatch(items: string[]): boolean[] {
    return items.map((item) => this.contains(item));
  }

  clear(): void {
    this.bitArray.fill(0);
  }

  getSize(): number {
    return this.size;
  }

  getFalsePositiveRate(): number {
    let bitsSet = 0;
    for (let i = 0; i < this.byteSize; i++) {
      let byte = this.bitArray[i];
      // Count bits using Brian Kernighan's algorithm
      while (byte) {
        bitsSet++;
        byte &= byte - 1;
      }
    }
    return Math.pow(bitsSet / this.size, this.numHashFunctions);
  }

  /**
   * Get memory usage in bytes
   */
  getMemoryUsage(): number {
    return this.byteSize + this.hashSeeds.length * 4; // 4 bytes per number
  }

  /**
   * Merge another bloom filter into this one
   */
  merge(other: BloomFilter): void {
    if (this.size !== other.size || this.numHashFunctions !== other.numHashFunctions) {
      throw new Error("Cannot merge bloom filters with different parameters");
    }

    for (let i = 0; i < this.byteSize; i++) {
      this.bitArray[i] |= other.bitArray[i];
    }
  }
}
