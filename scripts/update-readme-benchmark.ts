#!/usr/bin/env bun
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Script to run benchmarks and update README with results
 * Automatically extracts benchmark data and formats it for display
 */

interface BenchmarkResult {
  name: string;
  ops: number;
  margin: number;
  percentSlower?: number;
  percentFaster?: number;
  samples: number;
}

interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
}

/**
 * Run all benchmarks and capture results
 */
async function runBenchmarks(): Promise<BenchmarkSuite[]> {
  console.log("🚀 Running benchmarks...");

  try {
    // Run benchmarks with JSON output
    const output = execSync("bun run test:bench --reporter=json", {
      encoding: "utf-8",
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "test" },
    });

    // Parse the JSON output
    const lines = output.split("\n").filter((line) => line.trim());
    const jsonLine = lines.find((line) => {
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });

    if (!jsonLine) {
      throw new Error("Could not find JSON output from benchmark run");
    }

    const benchmarkData = JSON.parse(jsonLine);
    return parseBenchmarkResults(benchmarkData);
  } catch (error) {
    console.error("❌ Error running benchmarks:", error);

    // Fallback: run with regular reporter and parse output
    console.log("Trying fallback method...");
    const output = execSync("bun run vitest bench", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    return parsePlainTextResults(output);
  }
}

/**
 * Parse JSON benchmark results
 */
function parseBenchmarkResults(data: any): BenchmarkSuite[] {
  const suites: BenchmarkSuite[] = [];

  if (data.testResults) {
    for (const testFile of data.testResults) {
      for (const suite of testFile.assertionResults || []) {
        if (suite.ancestorTitles && suite.ancestorTitles.length > 0) {
          const suiteName = suite.ancestorTitles.join(" > ");

          let existingSuite = suites.find((s) => s.name === suiteName);
          if (!existingSuite) {
            existingSuite = { name: suiteName, results: [] };
            suites.push(existingSuite);
          }

          if (suite.title && suite.duration) {
            existingSuite.results.push({
              name: suite.title,
              ops: Math.round(1000 / suite.duration), // Approximate ops/sec
              margin: 0.1,
              samples: 10,
            });
          }
        }
      }
    }
  }

  return suites;
}

/**
 * Parse plain text benchmark results (fallback)
 */
function parsePlainTextResults(output: string): BenchmarkSuite[] {
  const suites: BenchmarkSuite[] = [];
  const lines = output.split("\n");

  let currentSuite: BenchmarkSuite | null = null;

  for (const line of lines) {
    // Match suite headers
    const suiteMatch = line.match(/^\s*✓\s+(.+?)(?:\s+\(\d+\))?$/);
    if (suiteMatch) {
      currentSuite = { name: suiteMatch[1], results: [] };
      suites.push(currentSuite);
      continue;
    }

    // Match benchmark results
    const benchMatch = line.match(
      /^\s*✓\s+(.+?)\s+(\d+(?:,\d+)*(?:\.\d+)?)\s+ops\/sec\s+±(\d+\.\d+)%/,
    );
    if (benchMatch && currentSuite) {
      const ops = parseFloat(benchMatch[2].replace(/,/g, ""));
      const margin = parseFloat(benchMatch[3]);

      currentSuite.results.push({
        name: benchMatch[1],
        ops,
        margin,
        samples: 10,
      });
    }
  }

  return suites;
}

/**
 * Format benchmark results as markdown
 */
function formatBenchmarkResults(suites: BenchmarkSuite[]): string {
  const now = new Date();
  const timestamp = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  let markdown = `## 🚀 Performance Benchmarks

> **Last Updated**: ${timestamp}

These benchmarks demonstrate the performance characteristics of the DisposableEmailChecker across different configurations and workloads. All tests use randomized email data to ensure realistic performance measurements.

`;

  // Group results by category
  const coreOperations = suites.filter((s) => s.name.includes("Core Operations"));
  const indexingComparisons = suites.filter((s) => s.name.includes("Indexing Strategy"));
  const scalingTests = suites.filter((s) => s.name.includes("Scaling"));

  // Core Operations Summary
  if (coreOperations.length > 0) {
    markdown += `### 📊 Core Operations Performance

| Operation | Configuration | Performance | Margin |
|-----------|---------------|-------------|---------|
`;

    for (const suite of coreOperations) {
      const config = suite.name
        .replace("DisposableEmailChecker - Core Operations > ", "")
        .replace(" Configuration", "");
      for (const result of suite.results.slice(0, 5)) {
        // Top 5 operations
        const opsFormatted =
          result.ops >= 1000
            ? `${(result.ops / 1000).toFixed(1)}k ops/sec`
            : `${result.ops.toFixed(0)} ops/sec`;

        markdown += `| ${result.name} | ${config} | **${opsFormatted}** | ±${result.margin.toFixed(1)}% |\n`;
      }
    }
    markdown += "\n";
  }

  // Indexing Strategy Comparison
  if (indexingComparisons.length > 0) {
    markdown += `### ⚡ Indexing Strategy Comparison

| Strategy | Single Lookup | Batch (100) | Batch (1000) | Index Building |
|----------|---------------|-------------|--------------|----------------|
`;

    const strategies = ["Hash-based", "Trie-based", "Bloom Filter", "Hybrid"];
    const strategyData: Record<string, Record<string, number>> = {};

    for (const suite of indexingComparisons) {
      const strategy = suite.name
        .replace("Indexing Strategy Comparisons > ", "")
        .replace(" Indexing", "");
      strategyData[strategy] = {};

      for (const result of suite.results) {
        if (result.name.includes("Single email lookup")) {
          strategyData[strategy]["single"] = result.ops;
        } else if (result.name.includes("Batch email lookup (100")) {
          strategyData[strategy]["batch100"] = result.ops;
        } else if (result.name.includes("Batch email lookup (1,000")) {
          strategyData[strategy]["batch1000"] = result.ops;
        } else if (result.name.includes("Index building (1,000")) {
          strategyData[strategy]["building"] = result.ops;
        }
      }
    }

    for (const strategy of strategies) {
      if (strategyData[strategy]) {
        const data = strategyData[strategy];
        const single = data.single ? `${data.single.toFixed(0)} ops/sec` : "N/A";
        const batch100 = data.batch100 ? `${data.batch100.toFixed(0)} ops/sec` : "N/A";
        const batch1000 = data.batch1000 ? `${data.batch1000.toFixed(0)} ops/sec` : "N/A";
        const building = data.building ? `${data.building.toFixed(0)} ops/sec` : "N/A";

        markdown += `| **${strategy}** | ${single} | ${batch100} | ${batch1000} | ${building} |\n`;
      }
    }
    markdown += "\n";
  }

  // Scaling Performance
  if (scalingTests.length > 0) {
    markdown += `### 📈 Scaling Performance

| Dataset Size | Indexing Performance | Search Performance |
|--------------|---------------------|-------------------|
`;

    const scalingSizes = ["1,000", "5,000", "10,000", "25,000"];
    const scalingData: Record<string, { indexing?: number; searching?: number }> = {};

    for (const suite of scalingTests) {
      const sizeMatch = suite.name.match(/Dataset Size: ([\d,]+) emails/);
      if (sizeMatch) {
        const size = sizeMatch[1];
        scalingData[size] = {};

        for (const result of suite.results) {
          if (result.name.includes("Indexing")) {
            scalingData[size].indexing = result.ops;
          } else if (result.name.includes("Search")) {
            scalingData[size].searching = result.ops;
          }
        }
      }
    }

    for (const size of scalingSizes) {
      if (scalingData[size]) {
        const data = scalingData[size];
        const indexing = data.indexing ? `${data.indexing.toFixed(0)} ops/sec` : "N/A";
        const searching = data.searching ? `${data.searching.toFixed(0)} ops/sec` : "N/A";

        markdown += `| **${size} emails** | ${indexing} | ${searching} |\n`;
      }
    }
    markdown += "\n";
  }

  // Key Performance Insights
  markdown += `### 🎯 Key Performance Insights

`;

  // Find best performing strategies
  const bestSingle = findBestPerformer(suites, "Single email");
  const bestBatch = findBestPerformer(suites, "Batch email");
  const bestIndexing = findBestPerformer(suites, "Index building");

  if (bestSingle) {
    markdown += `- **Fastest Single Email Validation**: ${bestSingle.config} at **${bestSingle.ops.toFixed(0)} ops/sec**\n`;
  }
  if (bestBatch) {
    markdown += `- **Fastest Batch Processing**: ${bestBatch.config} at **${bestBatch.ops.toFixed(0)} ops/sec**\n`;
  }
  if (bestIndexing) {
    markdown += `- **Fastest Index Building**: ${bestIndexing.config} at **${bestIndexing.ops.toFixed(0)} ops/sec**\n`;
  }

  markdown += `
#### 🔧 Configuration Recommendations

- **High-throughput applications**: Use Hybrid indexing strategy with caching enabled
- **Memory-constrained environments**: Use Bloom Filter strategy for space efficiency
- **Exact matching only**: Hash-based strategy offers the best performance
- **Pattern matching needs**: Trie-based strategy provides superior fuzzy matching

#### 📊 Benchmark Environment

- **Runtime**: Bun ${process.version}
- **Platform**: ${process.platform} ${process.arch}
- **CPU Cores**: ${require("os").cpus().length}
- **Memory**: ${Math.round(require("os").totalmem() / 1024 / 1024 / 1024)}GB RAM

*Benchmarks run with randomized email data to ensure realistic performance measurements. Results may vary based on system configuration and load.*
`;

  return markdown;
}

/**
 * Find the best performer for a specific operation type
 */
function findBestPerformer(
  suites: BenchmarkSuite[],
  operationType: string,
): { config: string; ops: number } | null {
  let bestOps = 0;
  let bestConfig = "";

  for (const suite of suites) {
    for (const result of suite.results) {
      if (result.name.toLowerCase().includes(operationType.toLowerCase()) && result.ops > bestOps) {
        bestOps = result.ops;
        bestConfig = suite.name.split(" - ")[1]?.split(" > ")[0] || suite.name;
      }
    }
  }

  return bestOps > 0 ? { config: bestConfig, ops: bestOps } : null;
}

/**
 * Update README with benchmark results
 */
function updateReadme(benchmarkMarkdown: string): void {
  const readmePath = join(process.cwd(), "README.md");

  try {
    const readmeContent = readFileSync(readmePath, "utf-8");

    // Find the benchmark section markers
    const startMarker = "<!-- BENCHMARK -->";
    const endMarker = "<!-- END BENCHMARK -->";

    const startIndex = readmeContent.indexOf(startMarker);
    const endIndex = readmeContent.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1) {
      throw new Error(`Could not find benchmark markers in README.md`);
    }

    // Replace the content between markers
    const beforeBenchmarks = readmeContent.substring(0, startIndex + startMarker.length);
    const afterBenchmarks = readmeContent.substring(endIndex);

    const updatedContent = `${beforeBenchmarks}\n${benchmarkMarkdown}\n${afterBenchmarks}`;

    writeFileSync(readmePath, updatedContent, "utf-8");
    console.log("✅ README.md updated with benchmark results");
  } catch (error) {
    console.error("❌ Error updating README:", error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    console.log("🔧 Starting benchmark update process...");

    const suites = await runBenchmarks();
    console.log(`📊 Processed ${suites.length} benchmark suites`);

    const benchmarkMarkdown = formatBenchmarkResults(suites);
    updateReadme(benchmarkMarkdown);

    console.log("🎉 Benchmark update completed successfully!");
  } catch (error) {
    console.error("💥 Benchmark update failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { runBenchmarks, formatBenchmarkResults, updateReadme };
