
export class LruCache<V> {
  private store = new Map<string, { value: V; expires: number }>();
  hits = 0;
  misses = 0;

  constructor(private max: number, private ttlMs: number, private now: () => number = Date.now) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expires <= this.now()) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    // Re-insert so this key becomes the "most recently used" (Maps keep insertion order).
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: V): void {
    this.store.delete(key);
    this.store.set(key, { value, expires: this.now() + this.ttlMs });
    while (this.store.size > this.max) {
      const oldest = this.store.keys().next().value as string;
      this.store.delete(oldest);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  stats() {
    const total = this.hits + this.misses;
    return { size: this.size, hits: this.hits, misses: this.misses, hitRate: total ? this.hits / total : null };
  }
}