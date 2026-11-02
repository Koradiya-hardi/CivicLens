import test from "node:test";
import assert from "node:assert/strict";
import { createCachedEmbedder } from "../../src/services/embedding.service";

const makeFake = () => {
  const calls: string[][] = [];
  const embed = async (texts: string[]) => {
    calls.push(texts);
    return texts.map((t) => [t.length, 0.5, 0.25]);
  };
  return { calls, embed };
};

test("the model runs once for a repeated question, whatever its casing or spacing", async () => {
  const { calls, embed } = makeFake();
  const embedOne = createCachedEmbedder(embed);
  const a = await embedOne("How do I renew my license?");
  const b = await embedOne("  how do i   RENEW my license?  ");
  assert.equal(calls.length, 1);
  assert.deepEqual(a, b);
});

test("different questions are embedded separately", async () => {
  const { calls, embed } = makeFake();
  const embedOne = createCachedEmbedder(embed);
  await embedOne("one");
  await embedOne("two");
  assert.equal(calls.length, 2);
});

test("callers get a copy: changing it does not corrupt the cache", async () => {
  const { embed } = makeFake();
  const embedOne = createCachedEmbedder(embed);
  const first = await embedOne("hello");
  first[0] = 999;
  const second = await embedOne("hello");
  assert.notEqual(second[0], 999);
});

test("a failed embedding is not cached, so the next try runs again", async () => {
  let fail = true;
  let runs = 0;
  const embedOne = createCachedEmbedder(async (texts) => {
    runs++;
    if (fail) throw new Error("model not available");
    return texts.map(() => [1]);
  });
  await assert.rejects(() => embedOne("q"));
  fail = false;
  assert.deepEqual(await embedOne("q"), [1]);
  assert.equal(runs, 2);
  assert.equal(embedOne.cache.size, 1);
});