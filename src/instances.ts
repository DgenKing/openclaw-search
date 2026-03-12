import type { Instance } from "./types.ts";

const INSTANCE_URLS = [
  "https://priv.au",
  "https://search.rhscz.eu",
  "https://searx.tiekoetter.com",
  "https://search.inetol.net",
  "https://searxng.site",
  "https://search.rowie.at",
  "https://ooglester.com",
  "https://search.abohiccups.com",
  "https://search.bladerunn.in",
  "https://searx.namejeff.xyz",
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
  const shuffledUrls = shuffleArray(INSTANCE_URLS);
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
