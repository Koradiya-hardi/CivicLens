import test from "node:test";
import assert from "node:assert/strict";
import { checkEnv, parseAllowedOrigins } from "../../src/config/env";

const good = { MONGODB_URI: "mongodb://x", JWT_SECRET: "a".repeat(40), GEMINI_API_KEY: "k", CLIENT_URL: "https://app.example.com" };

test("a complete production setup has no problems", () => {
  const r = checkEnv({ ...good, NODE_ENV: "production" });
  assert.deepEqual(r, { errors: [], warnings: [] });
});

test("missing database URI and JWT secret are errors", () => {
  const r = checkEnv({});
  assert.ok(r.errors.some((e) => e.includes("MONGODB_URI")));
  assert.ok(r.errors.some((e) => e.includes("JWT_SECRET")));
});

test("a weak or short JWT secret fails in production but only warns in development", () => {
  assert.ok(checkEnv({ ...good, NODE_ENV: "production", JWT_SECRET: "short" }).errors.some((e) => e.includes("too weak")));
  assert.ok(checkEnv({ ...good, NODE_ENV: "production", JWT_SECRET: "changeme" }).errors.length > 0);
  const dev = checkEnv({ ...good, NODE_ENV: "development", JWT_SECRET: "short" });
  assert.equal(dev.errors.length, 0);
  assert.ok(dev.warnings.some((w) => w.includes("JWT_SECRET")));
});

test("production requires CLIENT_URL; development does not", () => {
  const { CLIENT_URL: _drop, ...noClient } = good;
  assert.ok(checkEnv({ ...noClient, NODE_ENV: "production" }).errors.some((e) => e.includes("CLIENT_URL")));
  assert.equal(checkEnv({ ...noClient, NODE_ENV: "development" }).errors.length, 0);
});

test("missing Gemini key is a warning, not an error", () => {
  const { GEMINI_API_KEY: _drop, ...noKey } = good;
  const r = checkEnv(noKey);
  assert.equal(r.errors.length, 0);
  assert.ok(r.warnings.some((w) => w.includes("GEMINI_API_KEY")));
});

test("a non-numeric PORT is an error", () => {
  assert.ok(checkEnv({ ...good, PORT: "abc" }).errors.some((e) => e.includes("PORT")));
  assert.equal(checkEnv({ ...good, PORT: "5001" }).errors.length, 0);
});

test("parseAllowedOrigins handles lists, spaces, trailing slashes and the default", () => {
  assert.deepEqual(parseAllowedOrigins("https://a.com/, http://localhost:5173 "), ["https://a.com", "http://localhost:5173"]);
  assert.deepEqual(parseAllowedOrigins(undefined), ["http://localhost:5173"]);
});