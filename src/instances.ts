import type { Instance } from "./types.ts";

const DEFAULT_LOCAL_URL = "http://localhost:8888";

const INSTANCE_URLS = [
  "https://search.rhscz.eu",
  "https://searx.tiekoetter.com",
  "https://search.inetol.net",
  "https://search.rowie.at",
  "https://ooglester.com",
  "https://search.pi.vps.pw",
  "https://searxng.shreven.org",
  "https://kantan.cat",
  "https://searx.ro",
  "https://searxng.website",
  "https://search.sapti.me",
  "https://search.hbubli.cc",
  "https://search.bladerunn.in",
  "https://searxng.canine.tools",
  "https://search.minus27315.dev",
];

let instances: Instance[] = [];
let currentIndex = 0;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function initializeInstances(): void {
  // Priority: SEARXNG_URL env var > localhost:8888 > public instances
  const customUrl = process.env.SEARXNG_URL;
  const localUrl = customUrl ? customUrl.replace(/\/+$/, "") : DEFAULT_LOCAL_URL;

  // Local instance first, then public instances as fallback
  const urls = [localUrl, ...INSTANCE_URLS];

  // Don't shuffle if using custom URL or localhost - keep local first
  const shuffledUrls = customUrl ? urls : urls;

  instances = shuffledUrls.map((url) => ({
    url,
    healthy: true,
    lastChecked: 0,
    avgResponseMs: 0,
  }));
  currentIndex = 0;
}

export function getNextInstance(): Instance | null {
  if (instances.length === 0) return null;

  // Try up to instances.length times
  for (let i = 0; i < instances.length; i++) {
    const instance = instances[currentIndex];
    currentIndex = (currentIndex + 1) % instances.length;

    if (instance.healthy) {
      return instance;
    }
  }

  // If all marked unhealthy, return first one anyway (fallback)
  return instances[0];
}

export function markInstanceUnhealthy(url: string): void {
  const instance = instances.find((i) => i.url === url);
  if (instance) {
    instance.healthy = false;
  }
}

export function markInstanceHealthy(url: string, responseTimeMs: number): void {
  const instance = instances.find((i) => i.url === url);
  if (instance) {
    instance.healthy = true;
    instance.lastChecked = Date.now();
    // Rolling average
    if (instance.avgResponseMs === 0) {
      instance.avgResponseMs = responseTimeMs;
    } else {
      instance.avgResponseMs = (instance.avgResponseMs + responseTimeMs) / 2;
    }
  }
}

export function getAllInstanceUrls(): string[] {
  return instances.map((i) => i.url);
}
