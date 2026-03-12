#!/usr/bin/env bun

import { search } from "./src/searxng.ts";
import { outputJson, outputError } from "./src/format.ts";

interface CLIFlags {
  query: string;
  pages?: number;
  category?: string;
  timeRange?: string;
  engines?: string;
}

function parseArgs(args: string[]): CLIFlags {
  const flags: CLIFlags = {
    query: "",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--pages" || arg === "-p") {
      const val = args[++i];
      flags.pages = val ? parseInt(val, 10) : undefined;
    } else if (arg === "--category" || arg === "-c") {
      flags.category = args[++i];
    } else if (arg === "--time-range" || arg === "-t") {
      flags.timeRange = args[++i];
    } else if (arg === "--engines" || arg === "-e") {
      flags.engines = args[++i];
    } else if (!arg.startsWith("-")) {
      // Treat non-flag argument as query (can be concatenated with previous args)
      if (!flags.query) {
        flags.query = arg;
      } else {
        flags.query += " " + arg;
      }
    }
  }

  return flags;
}

function showUsage(): void {
  const usage = `Usage: bun run search.ts <query> [options]

Search the web using SearxNG instances.

Arguments:
  <query>              Search query (required)

Options:
  --pages, -p <n>      Number of pages (default: 1)
  --category, -c <cat> Search category (default: general)
  --time-range, -t     Time range: day, month, year
  --engines, -e        Comma-separated engine names

Examples:
  bun run search.ts "latest bun updates"
  bun run search.ts "latest bun updates" --category general --pages 2
  bun run search.ts "rust news" --time-range day --engines google,bing`;
  console.error(usage);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showUsage();
    process.exit(1);
  }

  const flags = parseArgs(args);

  if (!flags.query.trim()) {
    outputError({
      error: "Query is required",
      query: "",
      attempted_instances: [],
    });
    process.exit(1);
  }

  try {
    const result = await search({
      query: flags.query,
      pages: flags.pages,
      category: flags.category,
      timeRange: flags.timeRange,
      engines: flags.engines,
    });

    outputJson(result);
    process.exit(0);
  } catch (error) {
    outputError({
      error: error instanceof Error ? error.message : "Unknown error",
      query: flags.query,
      attempted_instances: [],
    });
    process.exit(1);
  }
}

main();
