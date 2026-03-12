# openclaw-search

[![GitHub](https://img.shields.io/github/license/DgenKing/openclaw-search)](https://github.com/DgenKing/openclaw-search)

**Repo:** [github.com/DgenKing/openclaw-search](https://github.com/DgenKing/openclaw-search)

Self-hosted web search for [OpenClaw](https://docs.openclaw.ai) agents. Runs a local SearxNG instance via Docker and falls back to public instances — no API keys, no rate limits.

Built with **Bun + TypeScript**. Zero npm dependencies.

---

## Quick Start

```bash
# 1. Clone into OpenClaw skills directory
git clone https://github.com/DgenKing/openclaw-search.git ~/.openclaw/skills/openclaw-search

# 2. Start the local SearxNG instance
cd ~/.openclaw/skills/openclaw-search
docker compose up -d

# 3. Verify it's running
curl "http://localhost:8888/search?q=test&format=json"

# 4. Use it (OpenClaw will auto-discover the skill)
```

---

## Why Self-Hosted?

Public SearxNG instances share a common rate-limiter. Once your IP gets flagged (even from light usage), every instance returns 429. VPN doesn't help — the blocklists propagate.

**The solution:** Run your own SearxNG locally via Docker. The CLI connects to `localhost:8888` first, with public instances as fallback.

---

## Installation

### Prerequisites

- [Bun](https://bun.sh) v1.0+ installed and on PATH
- [Docker](https://docker.com) installed and running

### Install as OpenClaw Skill

```bash
# Clone into OpenClaw skills directory
git clone https://github.com/DgenKing/openclaw-search.git ~/.openclaw/skills/openclaw-search
```

OpenClaw will automatically discover the skill on next agent startup. Verify with:

```bash
openclaw skills list
```

You should see `openclaw-search` in the output.

---

## Docker Setup

### Start SearxNG

```bash
cd ~/.openclaw/skills/openclaw-search
docker compose up -d
```

### Verify It's Running

```bash
curl "http://localhost:8888/search?q=test&format=json"
```

You should see JSON results. If you get a connection error, wait a few seconds for Docker to finish starting up.

### Docker Commands

| Command | What |
|---------|------|
| `docker compose up -d` | Start SearxNG (runs in background) |
| `docker compose down` | Stop SearxNG |
| `docker compose logs -f` | View logs (Ctrl+C to exit) |
| `docker compose restart` | Restart after config change |

### Resource Usage

- **Memory**: ~80-120MB
- **CPU**: Near zero when idle, brief spikes during search
- **Disk**: ~200MB (Docker image)
- **Startup**: ~3 seconds

---

## Usage

### Basic Search

```bash
bun run search.ts "your search query"
```

The tool automatically connects to your local SearxNG at `http://localhost:8888`.

### Custom Instance

Set `SEARXNG_URL` to use a different instance:

```bash
SEARXNG_URL=http://my-server:8888 bun run search.ts "query"
```

### Command-Line Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--pages <n>` | `-p` | Number of result pages to fetch | `1` |
| `--category <cat>` | `-c` | Search category | `general` |
| `--time-range <range>` | `-t` | Time filter | none |
| `--engines <list>` | `-e` | Specific engines to use | all |
| `--verbose` | `-v` | Show debug output | false |
| `--help` | `-h` | Show usage info | — |

### Categories

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

- `day` — last 24 hours
- `month` — last 30 days
- `year` — last 12 months

### Engines

```bash
bun run search.ts "query" --engines google,bing,duckduckgo,brave,wikipedia
```

---

## Examples

```bash
# Simple search (uses local Docker by default)
bun run search.ts "social media best practices"

# Latest news
bun run search.ts "OpenAI announcements" --category news --time-range day

# Multiple pages
bun run search.ts "TypeScript 5.8 new features" --pages 2

# Tech-specific search
bun run search.ts "bun vs node performance 2026" --category it

# Debug mode
bun run search.ts "query" --verbose
```

---

## Output Format

### Successful Search (exit code 0)

All output goes to **stdout** as JSON:

```json
{
  "query": "social media best practices",
  "results": [
    {
      "title": "19 social media best practices for faster growth - Hootsuite Blog",
      "url": "https://blog.hootsuite.com/social-media-best-practices/",
      "snippet": "Learn how to do audience research, choose the right platforms...",
      "engine": "startpage",
      "score": 2.67,
      "category": "general"
    }
  ],
  "count": 10,
  "source": "searxng",
  "instance_used": "http://localhost:8888",
  "page": 1,
  "timestamp": "2026-03-12T12:27:57.333Z"
}
```

### Result Fields

| Field | Description |
|-------|-------------|
| `query` | The search query |
| `results` | Array of result objects (max 10 per page) |
| `results[].title` | Page title |
| `results[].url` | Full URL |
| `results[].snippet` | Text excerpt matching the query |
| `results[].engine` | Which engine returned this (`google`, `bing`, `duckduckgo`, etc.) |
| `results[].score` | Relevance score (higher = more relevant) |
| `results[].category` | Result category |
| `count` | Number of results |
| `source` | Always `"searxng"` |
| `instance_used` | URL of the instance that served results |
| `page` | Page number |
| `timestamp` | ISO 8601 timestamp |

### Failed Search (exit code 1)

Errors go to **stderr**:

```json
{
  "error": "All SearxNG instances failed",
  "query": "your query",
  "attempted_instances": ["http://localhost:8888", "https://search.rhscz.eu"]
}
```

---

## How It Works

### Architecture

```
User / OpenClaw Agent
        │
        ▼
search.ts (CLI)
        │
        ▼
src/searxng.ts ─ Try local → Fallback to public
        │
   ┌────┴────┐
   ▼         ▼
Docker      Public
SearxNG    Instances
:8888      (fallback)
```

### Priority Order

1. **Local Docker** (`http://localhost:8888`) — tries first, 15s timeout, 3 retries
2. **Public instances** — fallback if Docker isn't running, 8s timeout

If Docker isn't running, the tool automatically falls back to public instances.

### Deduplication

SearxNG queries multiple engines (Google, Bing, DDG, etc.) and often returns duplicates. The tool:

1. Groups results by URL
2. Keeps the version with the highest score
3. Sorts by score (descending)
4. Caps at 10 results per page

---

## Troubleshooting

### "Connection refused" to localhost:8888

1. Make sure Docker is running: `docker ps`
2. Start SearxNG: `docker compose up -d`
3. Wait a few seconds for startup
4. Check logs: `docker compose logs -f`

### "All SearxNG instances failed"

1. If Docker isn't running, public instances may be rate-limited
2. Start your local instance: `docker compose up -d`
3. Try again

### Empty results

The search succeeded but found nothing. Try:
- Different/broader search terms
- Removing `--time-range` filter
- Using `--category general`

### Slow responses

- Local instance has 15s timeout (gives engines time)
- Public instances have 8s timeout
- If consistently slow, check `docker compose logs` for errors

---

## Project Structure

```
~/.openclaw/skills/openclaw-search/
├── docker-compose.yml       # SearxNG service definition
├── searxng/
│   └── settings.yml        # SearxNG config (limiter off, JSON enabled)
├── SKILL.md                # OpenClaw skill definition
├── search.ts               # CLI entry point
├── src/
│   ├── searxng.ts         # HTTP client with local/public fallback
│   ├── instances.ts       # Instance pool management
│   ├── types.ts           # TypeScript interfaces
│   └── format.ts          # Response normalization
└── README.md
```

---

## Security Notes

- SearxNG binds to localhost only (not exposed to network)
- No authentication needed for local-only access
- Docker container runs as non-root by default
- No data persistence — container is stateless
- Outbound traffic goes to search engines only

---

## License

MIT
