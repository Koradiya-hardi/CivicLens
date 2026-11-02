import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { AppError, errorHandler } from "../../src/middleware/errorHandler";

const run = (err: unknown) => {
  const out: { status?: number; body?: Record<string, unknown> } = {};
  const res = {
    status(code: number) { out.status = code; return this; },
    json(b: Record<string, unknown>) { out.body = b; return this; },
  } as unknown as Response;
  const origErr = console.error, origWarn = console.warn;
  console.error = () => {}; console.warn = () => {};
  try { errorHandler(err as Error, { method: "GET", originalUrl: "/x" } as Request, res, () => {}); }
  finally { console.error = origErr; console.warn = origWarn; }
  return out;
};

test("AppError keeps its own status and message", () => {
  const r = run(new AppError("nope", 403));
  assert.equal(r.status, 403);
  assert.equal(r.body?.message, "nope");
});

test("oversized and malformed JSON become 413 and 400, not 500", () => {
  assert.equal(run(Object.assign(new Error("x"), { type: "entity.too.large" })).status, 413);
  assert.equal(run(Object.assign(new Error("x"), { type: "entity.parse.failed" })).status, 400);
});

test("Mongoose problems map to 4xx", () => {
  assert.equal(run(Object.assign(new Error("x"), { name: "CastError", path: "_id" })).status, 400);
  assert.equal(run(Object.assign(new Error("x"), { name: "ValidationError", errors: { a: { message: "bad a" } } })).body?.message, "bad a");
  assert.equal(run(Object.assign(new Error("dup"), { code: 11000 })).status, 409);
});

test("unknown errors are 500, and the message is hidden in production", () => {
  const before = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    assert.equal(run(new Error("db password is hunter2")).body?.message, "db password is hunter2");
    process.env.NODE_ENV = "production";
    const r = run(new Error("db password is hunter2"));
    assert.equal(r.status, 500);
    assert.ok(!String(r.body?.message).includes("hunter2"));
    assert.equal(r.body?.stack, undefined);
  } finally { process.env.NODE_ENV = before; }
});