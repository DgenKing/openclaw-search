import type { SearchResponse, SearchResult, SearxNGResponse } from "./types.ts";

export function formatResponse(
  query: string,
  rawResponse: SearxNGResponse,
  instanceUrl: string,
  page: number,
  limit: number = 10
): SearchResponse {
  const rawResults = rawResponse.results || [];

  // Deduplicate by URL, keeping highest score
  const urlMap = new Map<string, SearchResult>();

  for (const result of rawResults) {
    if (!result.url) continue;

    const normalized: SearchResult = {
      title: result.title || "Untitled",
      url: result.url,
      snippet: result.content || "",
      engine: result.engine || "unknown",
      score: typeof result.score === "number" ? result.score : null,
      category: result.category || "general",
    };

    const existing = urlMap.get(result.url);
    if (!existing || (normalized.score !== null && (existing.score === null || normalized.score > existing.score))) {
      urlMap.set(result.url, normalized);
    }
  }

  // Convert to array and sort by score (desc), then by original order
  const results = Array.from(urlMap.values()).sort((a, b) => {
    if (a.score !== null && b.score !== null) {
      return b.score - a.score;
    }
    if (a.score !== null) return -1;
    if (b.score !== null) return 1;
    return 0;
  });

  // Cap at limit
  const limitedResults = results.slice(0, limit);

  const response: SearchResponse = {
    query,
    results: limitedResults,
    count: limitedResults.length,
    source: "searxng",
    instance_used: instanceUrl,
    page,
    timestamp: new Date().toISOString(),
  };

  return response;
}

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function outputError(error: unknown): void {
  console.error(JSON.stringify(error, null, 2));
}
