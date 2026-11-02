import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { stripUnsafeKeys, sanitizeInput } from "../../src/middleware/ security";

test("removes $operators at the top level and when nested", () => {
  const out = stripUnsafeKeys({ email: { $ne: null }, ok: "yes", deep: { a: { $gt: 1, keep: 2 } } });
  assert.deepEqual(out, { email: {}, ok: "yes", deep: { a: { keep: 2 } } });
});

test("removes dotted keys (field-path tricks)", () => {
  assert.deepEqual(stripUnsafeKeys({ "profile.role": "admin", name: "x" }), { name: "x" });
});

test("cleans objects inside arrays; leaves plain values alone", () => {
  assert.deepEqual(stripUnsafeKeys([{ $where: "1" }, "s", 3, null, true]), [{}, "s", 3, null, true]);
  assert.equal(stripUnsafeKeys("hello"), "hello");
  assert.equal(stripUnsafeKeys(null), null);
});

test("does not change harmless input (same keys and values)", () => {
  const input = { question: "How do I renew my license?", conversationId: "abc", tags: ["a", "b"], n: { x: 1 } };
  assert.deepEqual(stripUnsafeKeys(input), input);
});

test("drops anything nested deeper than the limit instead of recursing forever", () => {
  let deep: Record<string, unknown> = { leaf: true };
  for (let i = 0; i < 50; i++) deep = { n: deep };
  const out = JSON.stringify(stripUnsafeKeys(deep));
  assert.ok(!out.includes("leaf"));
});

test("sanitizeInput cleans body, query and params, then continues", () => {
  const req = { body: { a: { $ne: 1 } }, query: { "x.y": "1", ok: "2" }, params: { id: "5" } } as unknown as Request;
  let called = false;
  sanitizeInput(req, {} as Response, () => { called = true; });
  assert.deepEqual(req.body, { a: {} });
  assert.deepEqual(req.query, { ok: "2" });
  assert.deepEqual(req.params, { id: "5" });
  assert.ok(called);
});

test("sanitizeInput copes with a missing body", () => {
  const req = { query: {}, params: {} } as unknown as Request;
  let called = false;
  sanitizeInput(req, {} as Response, () => { called = true; });
  assert.ok(called);
});