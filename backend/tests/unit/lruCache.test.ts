import test from "node:test";
import assert from "node:assert/strict";
import { LruCache } from "../../src/utils/lruCache";

test("returns what was stored, and counts hits and misses", () => {
  const c = new LruCache<number>(3, 1000);
  assert.equal(c.get("a"), undefined);
  c.set("a", 1);
  assert.equal(c.get("a"), 1);
  assert.deepEqual(c.stats(), { size: 1, hits: 1, misses: 1, hitRate: 0.5 });
});

test("entries expire after the time-to-live", () => {
  let t = 0;
  const c = new LruCache<string>(3, 1000, () => t);
  c.set("a", "x");
  t = 999;
  assert.equal(c.get("a"), "x");
  t = 1000;
  assert.equal(c.get("a"), undefined);
  assert.equal(c.size, 0, "expired entry is removed, not kept");
});

test("when full, the least-recently-used entry is evicted", () => {
  const c = new LruCache<number>(2, 1000);
  c.set("a", 1);
  c.set("b", 2);
  c.get("a"); // "a" is now more recent than "b"
  c.set("c", 3); // evicts "b"
  assert.equal(c.get("b"), undefined);
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("c"), 3);
});

test("overwriting a key refreshes its value and lifetime", () => {
  let t = 0;
  const c = new LruCache<number>(2, 1000, () => t);
  c.set("a", 1);
  t = 900;
  c.set("a", 2);
  t = 1500; // 600 ms after the overwrite: still valid
  assert.equal(c.get("a"), 2);
});

test("clear() empties the cache; hitRate is null before any lookup", () => {
  const c = new LruCache<number>(2, 1000);
  assert.equal(c.stats().hitRate, null);
  c.set("a", 1);
  c.clear();
  assert.equal(c.size, 0);
});