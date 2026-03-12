import type { SearxNGResponse, SearchResponse } from "./types.ts";
import {
  initializeInstances,
  getNextInstance,
  markInstanceUnhealthy,
  markInstanceHealthy,
  getAllInstanceUrls,
} from "./instances.ts";
import { formatResponse, outputError } from "./format.ts";

export interface SearchOptions {
  query: string;
  pages?: number;
  category?: string;
  timeRange?: string;
  engines?: string;
}

const DEFAULT_TIMEOUT = 8000; // 8 seconds

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

export async function search(options: SearchOptions): Promise<SearchResponse> {
  initializeInstances();

  const attemptedInstances: string[] = [];
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const instance = getNextInstance();

    if (!instance) {
      throw new Error("No instances available");
    }

    attemptedInstances.push(instance.url);

    const url = buildSearchUrl(instance.url, options);
    const startTime = Date.now();

    try {
      const response = await fetchWithTimeout(url.toString(), DEFAULT_TIMEOUT);

      if (!response.ok) {
        markInstanceUnhealthy(instance.url);
        continue;
      }

      const data = (await response.json()) as SearxNGResponse;
      const responseTime = Date.now() - startTime;

      markInstanceHealthy(instance.url, responseTime);

      // Return normalized response
      return formatResponse(
        options.query,
        data,
        instance.url,
        options.pages || 1
      );
    } catch (error) {
      markInstanceUnhealthy(instance.url);
      continue;
    }
  }

  // All instances failed
  const error = {
    error: "All SearxNG instances failed",
    query: options.query,
    attempted_instances: attemptedInstances,
  };

  outputError(error);
  process.exit(1);
}
