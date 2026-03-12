# OpenClaw SearxNG Search Tool — Architecture Design

## Overview

A CLI search tool built with **Bun + TypeScript** that queries public SearxNG instances and outputs structured JSON to stdout. Designed as an OpenClaw skill so the agent can invoke it for real-time web search — no API keys, no cost, fully self-hosted compatible.

---

## How It Fits Into OpenClaw

OpenClaw discovers tools via **Skills** — directories containing a `SKILL.md` file with YAML frontmatter. When a user asks the agent something that needs web search, OpenClaw:

1. Scans installed skills by name/description
2. Loads the matching `SKILL.md` into context
3. Executes the shell command described in the skill
4. Reads **stdout** (our JSON) as the tool result

Our skill lives in `~/.openclaw/skills/openclaw-search/`.

---

## Directory Structure

```
~/.openclaw/skills/openclaw-search/
├── SKILL.md                   # OpenClaw skill definition
├── search.ts                  # Main CLI entry point (Bun)
├── src/
│   ├── searxng.ts             # SearxNG client (instance rotation, fetch, parse)
│   ├── instances.ts           # Instance registry (URLs, health tracking)
│   ├── types.ts               # TypeScript interfaces
│   └── format.ts              # JSON output formatter
├── tsconfig.json
└── package.json               # Bun project config
```

---

## Core Components

### 1. CLI Entry Point — `search.ts`

- Parses argv for the search query
- Accepts optional flags: `--pages`, `--category`, `--time-range`, `--engines`
- Calls the SearxNG client
- Prints JSON to stdout (only JSON, never plain text)
- Exits 0 on success, 1 on error (error JSON on stderr)

**Invocation:**
```bash
bun run search.ts "your query here"
bun run search.ts "latest bun updates" --category general --pages 2
```

### 2. SearxNG Client — `src/searxng.ts`

Responsible for querying SearxNG instances with fallback rotation.

**Logic flow:**
```
query(input) →
  pick instance (round-robin or random from healthy list) →
    build URL with params (q, format=json, safesearch, pageno, categories, engines, time_range) →
      fetch with timeout (8s AbortController) →
        on success → parse JSON → normalize results → return
        on failure → mark instance unhealthy → try next instance →
          all failed → throw SearchError
```

**Key design decisions:**
- **No retries on same instance** — move to next immediately
- **Per-request AbortController** with 8s timeout per instance
- **Normalize response** — SearxNG returns varying shapes across instances; we map to a consistent interface

### 3. Instance Registry — `src/instances.ts`

Manages the pool of public SearxNG instances.

```
Instance {
  url: string
  healthy: boolean
  lastChecked: number       // timestamp
  avgResponseMs: number     // for sorting
}
```

**Behavior:**
- Hardcoded list of known-good instances (sourced from searx.space)
- Track health per-process (in-memory, resets each invocation since CLI is stateless)
- Shuffle order on startup to distribute load
- Unhealthy instances move to end of queue, not removed

**Initial instance list** (all confirmed to support `format=json`):
- priv.au
- search.rhscz.eu
- searx.tiekoetter.com
- search.inetol.net
- searxng.site
- search.rowie.at
- ooglester.com
- search.abohiccups.com
- search.bladerunn.in
- searx.namejeff.xyz

### 4. Types — `src/types.ts`

```
SearchResult {
  title: string
  url: string
  snippet: string
  engine: string            // which engine returned it (google, bing, ddg, etc.)
  score: number | null
  category: string          // general, images, news, etc.
}

SearchResponse {
  query: string
  results: SearchResult[]
  count: number
  source: "searxng"
  instance_used: string
  page: number
  timestamp: string         // ISO 8601
}

SearchError {
  error: string
  query: string
  attempted_instances: string[]
}
```

### 5. Output Formatter — `src/format.ts`

- Takes raw SearxNG response, maps to `SearchResponse`
- Deduplicates results by URL
- Sorts by score (if available) then by original order
- Caps at configurable limit (default: 10 results)
- `JSON.stringify(result, null, 2)` to stdout

---

## SearxNG API Parameters Used

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `q` | user query | Search terms |
| `format` | `json` | Machine-readable output |
| `safesearch` | `0` | No filtering (configurable) |
| `pageno` | `1` (default) | Pagination |
| `categories` | `general` (default) | Search category |
| `time_range` | optional | `day`, `month`, `year` |
| `engines` | optional | Comma-separated engine names |

---

## OpenClaw Skill Definition

`~/.openclaw/skills/openclaw-search/SKILL.md`:

```markdown
---
name: openclaw-search
description: Search the web using SearxNG — free, no API key, JSON output
metadata: {"openclaw":{"os":["darwin","linux","win32"],"requires":{"bins":["bun"]}}}
---

Search the web for real-time results. Returns structured JSON with titles,
URLs, snippets, and scores.

Usage: bun run search.ts "<query>"

The tool outputs JSON to stdout with this shape:
{ query, results: [{ title, url, snippet, engine, score, category }], count, source, instance_used, page, timestamp }
```

---

## Data Flow

```
User asks OpenClaw a question needing web info
        │
        ▼
OpenClaw agent matches "openclaw-search" skill
        │
        ▼
Agent runs: bun run search.ts "user query"
        │
        ▼
search.ts parses args
        │
        ▼
searxng.ts picks instance from instances.ts
        │
        ▼
HTTP GET → https://<instance>/search?q=...&format=json
        │
        ├── Success → parse → normalize → format → JSON to stdout
        │
        └── Fail → next instance → ... → all fail → error JSON to stderr
        │
        ▼
OpenClaw reads stdout JSON as tool result
        │
        ▼
Agent uses results to answer user's question
```

---

## Error Handling Strategy

| Scenario | Behavior |
|----------|----------|
| No query provided | stderr usage message, exit 1 |
| Instance returns non-200 | Skip to next instance silently |
| Instance times out (>8s) | Abort, skip to next |
| Instance returns invalid JSON | Skip to next |
| All instances fail | stderr error JSON, exit 1 |
| SearxNG returns 0 results | stdout JSON with empty results array, exit 0 |
| Network offline | All instances fail → error path |

---

## Constraints & Decisions

1. **Stateless CLI** — no database, no config files, no persistent state. Each invocation is independent.
2. **No API keys** — SearxNG public instances are free and keyless.
3. **Bun-native** — use Bun's built-in fetch, no external HTTP dependencies.
4. **Zero dependencies** — pure TypeScript, no npm packages. Bun provides everything.
5. **JSON-only stdout** — never print human-readable text to stdout. All messages/errors go to stderr.
6. **Fast fail** — 8s timeout per instance, ~10 instances = worst case ~80s (but practically 2-3 tries).
7. **Deduplication** — same URL from multiple engines gets merged, keeping highest score.

---

## Future Considerations (Not In Scope Now)

- Optional instance health cache file (`~/.openclaw-search-health.json`)
- Self-hosted SearxNG instance support via env var (`SEARXNG_URL`)
- Result caching with TTL
- OpenClaw plugin format (TypeScript Gateway extension) instead of CLI skill
- Image/news/video category-specific result types
- Streaming results for large queries
