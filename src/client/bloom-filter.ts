/**
 * Bloom filter for probabilistic membership testing
 */
export class BloomFilter {
  private bitArray: boolean[];
  private hashFunctions: ((str: string) => number)[];
  private size: number;
  private numHashFunctions: number;

  constructor(expectedElements: number, falsePositiveRate = 0.01) {
    this.size = Math.ceil((-expectedElements * Math.log(falsePositiveRate)) / Math.log(2) ** 2);
    this.numHashFunctions = Math.ceil((this.size / expectedElements) * Math.log(2));
    this.bitArray = new Array(this.size).fill(false);
    this.hashFunctions = this.generateHashFunctions();
  }

  private generateHashFunctions(): ((str: string) => number)[] {
    const functions = [];
    for (let i = 0; i < this.numHashFunctions; i++) {
      functions.push((str: string) => {
        let hash = 0;
        for (let j = 0; j < str.length; j++) {
          hash = ((hash << 5) + hash + str.charCodeAt(j) + i) % this.size;
        }
        return Math.abs(hash);
      });
    }
    return functions;
  }

  add(item: string): void {
    for (const hashFunction of this.hashFunctions) {
      const index = hashFunction(item);
      this.bitArray[index] = true;
    }
  }

  contains(item: string): boolean {
    for (const hashFunction of this.hashFunctions) {
      const index = hashFunction(item);
      if (!this.bitArray[index]) {
        return false;
      }
    }
    return true;
  }

  clear(): void {
    this.bitArray.fill(false);
  }

  getSize(): number {
    return this.size;
  }

  getFalsePositiveRate(): number {
    const bitsSet = this.bitArray.filter((bit) => bit).length;
    return Math.pow(bitsSet / this.size, this.numHashFunctions);
  }
}
