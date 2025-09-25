import type { PerformanceMetrics, EmailValidationResult } from "./types";

/**
 * Performance metrics manager for tracking validation operations
 */
export class MetricsManager {
  private metrics: PerformanceMetrics;
  private startTime: number;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.startTime = Date.now();
  }

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      disposableDetected: 0,
      allowedOverrides: 0,
      blacklistedDetected: 0,
      averageValidationTime: 0,
      cacheHitRate: 0,
      indexSize: 0,
      lastUpdated: new Date().toISOString(),
      throughputPerSecond: 0,
    };
  }

  /**
   * Update metrics based on operation type
   */
  updateMetrics(operation: string, result?: EmailValidationResult): void {
    this.metrics.totalValidations++;

    switch (operation) {
      case "validation":
        if (result) {
          this.metrics.successfulValidations++;
          if (result.isDisposable) this.metrics.disposableDetected++;
          if (result.isAllowed) this.metrics.allowedOverrides++;
          if (result.isBlacklisted) this.metrics.blacklistedDetected++;

          // Update average validation time
          const currentAvg = this.metrics.averageValidationTime;
          const count = this.metrics.successfulValidations;
          this.metrics.averageValidationTime =
            (currentAvg * (count - 1) + result.validationTime) / count;
        }
        break;
      case "error":
        this.metrics.failedValidations++;
        break;
      case "cache_hit":
        this.updateCacheHitRate();
        break;
    }

    this.updateThroughput();
    this.metrics.lastUpdated = new Date().toISOString();
  }

  /**
   * Update cache hit rate
   */
  updateCacheHitRate(hitRate?: number): void {
    if (hitRate !== undefined) {
      this.metrics.cacheHitRate = hitRate;
    }
  }

  /**
   * Update index size
   */
  updateIndexSize(size: number): void {
    this.metrics.indexSize = size;
  }

  /**
   * Calculate throughput per second
   */
  private updateThroughput(): void {
    const timeElapsed = (Date.now() - this.startTime) / 1000;
    if (timeElapsed > 0) {
      this.metrics.throughputPerSecond = this.metrics.totalValidations / timeElapsed;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.startTime = Date.now();
  }

  /**
   * Get success rate percentage
   */
  getSuccessRate(): number {
    if (this.metrics.totalValidations === 0) return 0;
    return (this.metrics.successfulValidations / this.metrics.totalValidations) * 100;
  }

  /**
   * Get detection rate percentage
   */
  getDetectionRate(): number {
    if (this.metrics.successfulValidations === 0) return 0;
    return (this.metrics.disposableDetected / this.metrics.successfulValidations) * 100;
  }

  /**
   * Export metrics as JSON string
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        ...this.metrics,
        successRate: this.getSuccessRate(),
        detectionRate: this.getDetectionRate(),
        exportTimestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }
}
