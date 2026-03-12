---
name: openclaw-search
description: Search the web using SearxNG — free, no API key, JSON output
metadata: {"openclaw":{"os":["darwin","linux","win32"],"requires":{"bins":["bun"]}}}
---

# openclaw-search

Free real-time web search powered by public SearxNG instances. No API keys required. Returns structured JSON.

## When to use this skill

Use this skill whenever the user asks a question that requires **current or real-time information** from the web — news, documentation, prices, events, people, releases, weather, or anything beyond your training data.

## How to run

Execute from the skill directory (`{baseDir}`):

```bash
cd {baseDir} && bun run search.ts "<search query>"
```

### Required argument

- The search query as a quoted string (positional, first argument)

### Optional flags

| Flag | Short | Description | Example |
|------|-------|-------------|---------|
| `--pages <n>` | `-p` | Number of result pages (default: 1) | `--pages 2` |
| `--category <cat>` | `-c` | Search category: `general`, `images`, `news`, `videos`, `music`, `files`, `it`, `science`, `social media` | `--category news` |
| `--time-range <range>` | `-t` | Filter by time: `day`, `month`, `year` | `--time-range day` |
| `--engines <list>` | `-e` | Comma-separated engine names: `google`, `bing`, `duckduckgo`, `brave`, `wikipedia` | `--engines google,bing` |

### Examples

```bash
# Basic search
cd {baseDir} && bun run search.ts "latest TypeScript 5.8 features"

# News from the last day
cd {baseDir} && bun run search.ts "AI regulation 2026" --category news --time-range day

# Multiple pages with specific engines
cd {baseDir} && bun run search.ts "bun vs deno benchmarks" --pages 2 --engines google,bing
```

## Output format

The tool prints **only JSON to stdout**. Errors go to stderr.

### Success (exit code 0)

```json
{
  "query": "the search query",
  "results": [
    {
      "title": "Page Title",
      "url": "https://example.com/page",
      "snippet": "A short text excerpt from the page...",
      "engine": "google",
      "score": 3.5,
      "category": "general"
    }
  ],
  "count": 10,
  "source": "searxng",
  "instance_used": "https://priv.au",
  "page": 1,
  "timestamp": "2026-03-12T10:30:00.000Z"
}
```

### Failure (exit code 1)

```json
{
  "error": "All SearxNG instances failed",
  "query": "the search query",
  "attempted_instances": ["https://priv.au", "https://searxng.site"]
}
```

## How to interpret results

- **results**: Array of up to 10 web pages, deduplicated by URL, sorted by relevance score
- **snippet**: The most useful field — contains the text excerpt matching the query
- **score**: Higher is more relevant (can be null)
- **engine**: Which search engine returned this result
- **count**: Number of results returned (0 means no results found, not an error)
- **instance_used**: Which SearxNG server was used (for debugging)

## Self-Hosted Setup (Recommended)

For reliable, rate-limit-free searches, run SearxNG locally with Docker:

### One-time setup

```bash
cd {baseDir}
docker compose up -d
```

### Verify it's running

```bash
curl "http://localhost:8888/search?q=test&format=json"
```

### Docker commands

| Command | What |
|---------|------|
| `docker compose up -d` | Start SearxNG (runs in background) |
| `docker compose down` | Stop SearxNG |
| `docker compose logs -f` | Debug issues |
| `docker compose restart` | Restart after config change |

The CLI automatically connects to `http://localhost:8888` by default. Set `SEARXNG_URL` to override:

```bash
# Use default localhost instance
cd {baseDir} && bun run search.ts "query"

# Use custom instance
SEARXNG_URL=http://my-instance:8888 cd {baseDir} && bun run search.ts "query"
```

## Important notes

- If count is 0, the search succeeded but found nothing — try rephrasing the query
- If the tool exits with code 1, all instances failed — local Docker takes priority, then falls back to public instances
- Results are from SearxNG (meta-search engine) — it aggregates Google, Bing, DuckDuckGo, Brave, and Wikipedia
- No API key or payment is ever needed
