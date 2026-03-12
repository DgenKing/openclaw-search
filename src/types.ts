export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  engine: string;
  score: number | null;
  category: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  count: number;
  source: "searxng";
  instance_used: string;
  page: number;
  timestamp: string;
}

export interface SearchError {
  error: string;
  query: string;
  attempted_instances: string[];
}

export interface Instance {
  url: string;
  healthy: boolean;
  lastChecked: number;
  avgResponseMs: number;
}

export interface SearxNGResult {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
  score?: number;
  category?: string;
}

export interface SearxNGResponse {
  query?: string;
  results?: SearxNGResult[];
  number_of_results?: number;
}
