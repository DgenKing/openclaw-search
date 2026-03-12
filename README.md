# openclaw-search

Free, keyless web search for [OpenClaw](https://docs.openclaw.ai) agents. Queries public [SearxNG](https://docs.searxng.org) instances and returns structured JSON — no API keys, no cost, no rate limits (within reason).

Built with **Bun + TypeScript**. Zero npm dependencies.

---

## What It Does

`openclaw-search` is an OpenClaw skill that gives your agent real-time web search. When a user asks something that needs current information, OpenClaw loads this skill and runs the CLI tool. The tool hits public SearxNG meta-search instances (which aggregate Google, Bing, DuckDuckGo, Brave, and others), normalizes the results, and outputs clean JSON to stdout.

**Why SearxNG?**
- Free forever — no API keys, no billing, no quotas
- Meta-search — one query hits multiple engines (Google, Bing, DDG, etc.)
- Privacy-respecting — no tracking, no ads in results
- Dozens of public instances — if one goes down, the tool automatically tries another

---

## Installation

### Prerequisites

- [Bun](https://bun.sh) v1.0+ installed and on PATH

### Install as OpenClaw Skill

Copy or symlink the project into your OpenClaw skills directory:

```bash
# Clone
git clone https://github.com/DgenKing/openclaw-search.git ~/.openclaw/skills/openclaw-search

# Or symlink from wherever you cloned it
ln -s /path/to/openclaw-search ~/.openclaw/skills/openclaw-search
```

OpenClaw will automatically discover the skill on next agent startup. Verify with:

```bash
openclaw skills list
```

You should see `openclaw-search` in the output.

### Standalone (without OpenClaw)

You can also use it as a standalone CLI tool:

```bash
git clone https://github.com/DgenKing/openclaw-search.git
cd openclaw-search
bun run search.ts "your query here"
```

No `bun install` needed — there are zero dependencies.

---

## Usage

### Basic Search

```bash
bun run search.ts "your search query"
```

This queries public SearxNG instances and prints JSON results to stdout.

### Command-Line Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--pages <n>` | `-p` | Number of result pages to fetch | `1` |
| `--category <cat>` | `-c` | Search category | `general` |
| `--time-range <range>` | `-t` | Time filter | none |
| `--engines <list>` | `-e` | Specific engines to use | all |
| `--help` | `-h` | Show usage info | — |

### Categories

Use `--category` to search specific content types:

- `general` — web pages (default)
- `news` — news articles
- `images` — image results
- `videos` — video results
- `music` — music/audio
- `files` — downloadable files
- `it` — tech/programming
- `science` — academic/scientific
- `social media` — social platforms

### Time Ranges

Use `--time-range` to filter by recency:

- `day` — last 24 hours
- `month` — last 30 days
- `year` — last 12 months

### Engines

Use `--engines` with a comma-separated list to target specific search engines:

```bash
bun run search.ts "query" --engines google,bing,duckduckgo,brave,wikipedia
```

---

## Examples

```bash
# Simple web search
bun run search.ts "how to use Bun test runner"

# Latest news from today
bun run search.ts "OpenAI announcements" --category news --time-range day

# Search 2 pages of results from Google and Bing only
bun run search.ts "TypeScript 5.8 new features" --pages 2 --engines google,bing

# Science/academic results from the past year
bun run search.ts "transformer architecture improvements" --category science --time-range year

# Tech-specific search
bun run search.ts "bun vs node performance benchmarks 2026" --category it
```

---

## Output Format

### Successful Search (exit code 0)

All output goes to **stdout** as pretty-printed JSON:

```json
{
  "query": "bun typescript tutorial",
  "results": [
    {
      "title": "Getting Started with Bun and TypeScript",
      "url": "https://bun.sh/docs/typescript",
      "snippet": "Bun natively supports TypeScript out of the box. Every file can be .ts or .tsx with no extra configuration...",
      "engine": "google",
      "score": 4.2,
      "category": "general"
    },
    {
      "title": "Bun TypeScript Guide - Complete Tutorial",
      "url": "https://example.com/bun-ts-guide",
      "snippet": "Learn how to set up a Bun project with TypeScript, including testing, bundling, and deployment...",
      "engine": "duckduckgo",
      "score": 3.8,
      "category": "general"
    }
  ],
  "count": 10,
  "source": "searxng",
  "instance_used": "https://priv.au",
  "page": 1,
  "timestamp": "2026-03-12T14:30:00.000Z"
}
```

### Result Fields

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | The search query that was sent |
| `results` | array | Array of search result objects (max 10 per page) |
| `results[].title` | string | Page title |
| `results[].url` | string | Full URL to the page |
| `results[].snippet` | string | Text excerpt from the page matching the query |
| `results[].engine` | string | Which search engine returned this result (`google`, `bing`, `duckduckgo`, etc.) |
| `results[].score` | number \| null | Relevance score (higher = more relevant, null if unavailable) |
| `results[].category` | string | Result category (`general`, `news`, `images`, etc.) |
| `count` | number | Number of results returned |
| `source` | string | Always `"searxng"` |
| `instance_used` | string | URL of the SearxNG instance that served the results |
| `page` | number | Which page of results this is |
| `timestamp` | string | ISO 8601 timestamp of when the search was performed |

### Failed Search (exit code 1)

Errors go to **stderr** as JSON:

```json
{
  "error": "All SearxNG instances failed",
  "query": "your search query",
  "attempted_instances": [
    "https://priv.au",
    "https://searxng.site",
    "https://search.rhscz.eu"
  ]
}
```

### Empty Results (exit code 0)

A search that finds nothing is **not** an error — it returns normally with an empty array:

```json
{
  "query": "xyzzy123notarealthing",
  "results": [],
  "count": 0,
  "source": "searxng",
  "instance_used": "https://priv.au",
  "page": 1,
  "timestamp": "2026-03-12T14:30:00.000Z"
}
```

---

## How It Works

### Architecture

```
search.ts (CLI entry point)
    │
    ├── src/searxng.ts      SearxNG client — builds URLs, fetches, handles fallback
    ├── src/instances.ts     Instance pool — 10 public servers, shuffle, health tracking
    ├── src/types.ts         TypeScript interfaces for all data shapes
    └── src/format.ts        Normalizes raw SearxNG → clean JSON, deduplicates, sorts
```

### Instance Fallback

The tool ships with 10 hardcoded public SearxNG instances. On each run:

1. The instance list is **shuffled randomly** (distributes load)
2. The tool tries the first healthy instance
3. If it fails (timeout, HTTP error, bad JSON), that instance is marked unhealthy
4. The tool moves to the next instance
5. This continues until one succeeds or all 10 fail

Each instance gets an **8-second timeout**. Worst case (all fail) takes ~80 seconds, but in practice 1-2 tries is enough.

### Deduplication

SearxNG is a meta-search engine — it queries Google, Bing, DuckDuckGo, and others simultaneously. The same page often appears from multiple engines. The tool:

1. Groups results by URL
2. Keeps the version with the highest relevance score
3. Sorts all results by score (descending)
4. Caps at 10 results per page

### Current Instance List

These are all confirmed to support `format=json` (sourced from [searx.space](https://searx.space)):

| Instance | URL |
|----------|-----|
| priv.au | `https://priv.au` |
| search.rhscz.eu | `https://search.rhscz.eu` |
| searx.tiekoetter.com | `https://searx.tiekoetter.com` |
| search.inetol.net | `https://search.inetol.net` |
| searxng.site | `https://searxng.site` |
| search.rowie.at | `https://search.rowie.at` |
| ooglester.com | `https://ooglester.com` |
| search.abohiccups.com | `https://search.abohiccups.com` |
| search.bladerunn.in | `https://search.bladerunn.in` |
| searx.namejeff.xyz | `https://searx.namejeff.xyz` |

---

## Troubleshooting

### "All SearxNG instances failed"

This means all 10 instances returned errors or timed out. Common causes:

- **Rate limiting**: Public instances limit requests. Wait 10-30 seconds and retry.
- **Network issues**: Check your internet connection.
- **Instances down**: Rare for all 10 to be down simultaneously. Check [searx.space](https://searx.space) for live status.

### Empty results but no error

The search succeeded but found nothing relevant. Try:

- Broader or different search terms
- Removing `--time-range` filter (it's very restrictive)
- Using `--category general` instead of a specific category

### Slow responses

- Each instance has an 8s timeout. If the first instance is slow, it waits the full 8s before trying the next.
- The shuffle randomizes which instance goes first, so performance varies between runs.
- If consistently slow, your network may have high latency to European servers (most instances are EU-based).

### "bun: command not found"

Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

---

## Project Structure

```
~/.openclaw/skills/openclaw-search/
├── SKILL.md              OpenClaw skill definition (agent reads this)
├── search.ts             CLI entry point — parses args, orchestrates search
├── src/
│   ├── searxng.ts        SearxNG HTTP client with fallback rotation
│   ├── instances.ts      Instance pool management (shuffle, health tracking)
│   ├── types.ts          TypeScript interfaces (SearchResult, SearchResponse, etc.)
│   └── format.ts         Response normalization, deduplication, JSON output
├── tsconfig.json         Bun TypeScript config
├── package.json          Project metadata (zero dependencies)
├── design.md             Architecture design document
└── README.md             This file
```

---

## Technical Details

- **Runtime**: Bun (uses built-in `fetch`, no polyfills)
- **Language**: TypeScript (strict mode)
- **Dependencies**: None — zero npm packages
- **Output**: JSON only on stdout, human-readable errors on stderr
- **Timeout**: 8 seconds per instance
- **Max results**: 10 per page (configurable in source)
- **Max instances tried**: 10 before giving up
- **SearxNG API**: Uses `format=json` parameter on `/search` endpoint

---

## License

MIT
