import type { SearxNGResponse, SearchResponse } from "./types.ts";
import {
  initializeInstances,
  getNextInstance,
  markInstanceUnhealthy,
  markInstanceHealthy,
} from "./instances.ts";
import { formatResponse } from "./format.ts";

export interface SearchOptions {
  query: string;
  pages?: number;
  category?: string;
  timeRange?: string;
  engines?: string;
  verbose?: boolean;
}

const LOCAL_TIMEOUT = 15000; // 15 seconds for local instance
const PUBLIC_TIMEOUT = 8000; // 8 seconds for public instances

const DEFAULT_LOCAL_URL = "http://localhost:8888";

function isLocalInstance(url: string): boolean {
  return url.startsWith(DEFAULT_LOCAL_URL) || url.includes("localhost:8888");
}

async function fetchWithTimeout(
  url: string,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(
  url: string,
  timeout: number,
  maxRetries: number = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, timeout);
      return response;
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

function buildSearchUrl(
  instanceUrl: string,
  options: SearchOptions
): URL {
  const params = new URLSearchParams();
  params.set("q", options.query);
  params.set("format", "json");
  params.set("safesearch", "0");
  params.set("pageno", String(options.pages || 1));

  if (options.category) {
    params.set("categories", options.category);
  }

  if (options.timeRange) {
    params.set("time_range", options.timeRange);
  }

  if (options.engines) {
    params.set("engines", options.engines);
  }

  return new URL(`${instanceUrl}/search?${params.toString()}`);
}

export class SearchError extends Error {
  constructor(
    message: string,
    public readonly query: string,
    public readonly attemptedInstances: string[]
  ) {
    super(message);
    this.name = "SearchError";
  }
}

export async function search(options: SearchOptions): Promise<SearchResponse> {
  initializeInstances();

  const attemptedInstances: string[] = [];
  const maxAttempts = 10;
  const pages = options.pages || 1;

  // Collect results across all requested pages
  let allResults: SearchResponse | null = null;

  for (let page = 1; page <= pages; page++) {
    let pageResult: SearchResponse | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const instance = getNextInstance();

      if (!instance) {
        throw new SearchError("No instances available", options.query, attemptedInstances);
      }

      if (!attemptedInstances.includes(instance.url)) {
        attemptedInstances.push(instance.url);
      }

      const pageOptions = { ...options, pages: undefined };
      const url = buildSearchUrl(instance.url, pageOptions);
      // Set actual page number
      url.searchParams.set("pageno", String(page));

      const startTime = Date.now();
      const isLocal = isLocalInstance(instance.url);
      const timeout = isLocal ? LOCAL_TIMEOUT : PUBLIC_TIMEOUT;

      try {
        // Use retry logic for local instances
        const response = isLocal
          ? await fetchWithRetry(url.toString(), timeout, 3)
          : await fetchWithTimeout(url.toString(), timeout);

        if (!response.ok) {
          if (options.verbose) {
            console.error(`[${instance.url}] HTTP ${response.status} ${response.statusText}`);
          }
          markInstanceUnhealthy(instance.url);
          continue;
        }

        const text = await response.text();
        if (options.verbose) {
          console.error(`[${instance.url}] 200 OK, body starts: ${text.slice(0, 120)}`);
        }

        // Check if response is actually JSON (not an HTML block page)
        if (!text.trimStart().startsWith("{") && !text.trimStart().startsWith("[")) {
          if (options.verbose) {
            console.error(`[${instance.url}] Not JSON — got HTML/text response`);
          }
          markInstanceUnhealthy(instance.url);
          continue;
        }

        const data = JSON.parse(text) as SearxNGResponse;
        const responseTime = Date.now() - startTime;

        markInstanceHealthy(instance.url, responseTime);

        pageResult = formatResponse(options.query, data, instance.url, page);
        break;
      } catch (error) {
        if (options.verbose) {
          console.error(`[${instance.url}] Error: ${error instanceof Error ? error.message : error}`);
        }
        markInstanceUnhealthy(instance.url);
        continue;
      }
    }

    if (!pageResult) {
      throw new SearchError("All SearxNG instances failed", options.query, attemptedInstances);
    }

    if (!allResults) {
      allResults = pageResult;
    } else {
      // Merge page results
      allResults.results.push(...pageResult.results);
      allResults.count = allResults.results.length;
      allResults.page = page;
    }
  }

  return allResults!;
}
