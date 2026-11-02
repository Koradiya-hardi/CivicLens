process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "testsecret";
process.env.CLIENT_URL = "http://localhost:5173,https://civiclens.example.com";
process.env.CHAT_RATE_LIMIT_PER_MIN = "3";

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import mongoose from "mongoose";

import { createApp } from "../../src/app";
import User from "../../src/models/User.model";
import { generateToken } from "../../src/utils/generateToken";

const U: any = User;
const oid = () => new mongoose.Types.ObjectId();
const mk = (role: string) => ({ _id: oid(), name: role, email: `${role}@x.com`, role });
const alice = mk("user");
const bob = mk("user");
const byId = new Map([[String(alice._id), alice], [String(bob._id), bob]]);
const findOneCalls: unknown[] = [];

let server: http.Server;
let base = "";

before(async () => {
  U.findById = async (id: unknown) => byId.get(String(id)) ?? null;
  U.findOne = (q: unknown) => {
    findOneCalls.push(q);
    const r = { select: () => r, then: (res: (v: unknown) => void) => Promise.resolve(null).then(res) };
    return r;
  };
  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => server.close());

const call = (method: string, path: string, opts: { body?: string; headers?: Record<string, string> } = {}) =>
  fetch(base + path, { method, body: opts.body, headers: { "content-type": "application/json", ...opts.headers } });

test("security headers are present and the server doesn't advertise Express", async () => {
  const r = await call("GET", "/api/health");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.ok(r.headers.get("content-security-policy"));
  assert.ok(r.headers.get("strict-transport-security"));
});

test("/uploads skips the CSP (so PDFs open in the browser) but keeps the other headers", async () => {
  const r = await call("GET", "/uploads/2026/01/missing.pdf");
  assert.equal(r.status, 404);
  assert.equal(r.headers.get("content-security-policy"), null);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("cross-origin-resource-policy"), "cross-origin");
});

test("CORS: listed origins are allowed, others are not, and no-Origin tools still work", async () => {
  const ok = await call("GET", "/api/health", { headers: { origin: "https://civiclens.example.com" } });
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://civiclens.example.com");
  const dev = await call("GET", "/api/health", { headers: { origin: "http://localhost:5173" } });
  assert.equal(dev.headers.get("access-control-allow-origin"), "http://localhost:5173");
  const bad = await call("GET", "/api/health", { headers: { origin: "https://evil.example.org" } });
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
  assert.equal((await call("GET", "/api/health")).status, 200);
});

test("unknown routes give JSON 404", async () => {
  const r = await call("GET", "/api/nope");
  assert.equal(r.status, 404);
  assert.equal(((await r.json()) as { success: boolean }).success, false);
});

test("malformed JSON is a 400 with a readable message", async () => {
  const r = await call("POST", "/api/auth/login", { body: "{not json" });
  assert.equal(r.status, 400);
  assert.match(((await r.json()) as { message: string }).message, /not valid JSON/);
});

test("a 150 KB body is refused on normal routes (413) but accepted on /api/resources", async () => {
  const big = JSON.stringify({ email: "a@b.com", password: "x".repeat(150_000) });
  assert.equal((await call("POST", "/api/auth/login", { body: big })).status, 413);
  // /api/resources has the 10 MB allowance: the body is parsed, THEN auth rejects the missing token.
  const r = await call("POST", "/api/resources", { body: JSON.stringify({ content: "x".repeat(150_000) }) });
  assert.equal(r.status, 401);
});

test("NoSQL-injection login ({\"$ne\": null}) is rejected before touching the database", async () => {
  findOneCalls.length = 0;
  const r = await call("POST", "/api/auth/login", { body: JSON.stringify({ email: { $ne: null }, password: { $ne: null } }) });
  assert.equal(r.status, 400);
  assert.equal(findOneCalls.length, 0, "User.findOne must never be called with operator objects");
});

test("password length is capped at 72 characters on register", async () => {
  const r = await call("POST", "/api/auth/register", {
    body: JSON.stringify({ name: "A", email: "a@b.com", password: "p".repeat(73) }),
  });
  assert.equal(r.status, 400);
  assert.match(JSON.stringify(await r.json()), /8 and 72/);
});

test("admin routes still reject anonymous and non-admin callers", async () => {
  assert.equal((await call("GET", "/api/admin/health")).status, 401);
  const r = await call("GET", "/api/admin/health", { headers: { authorization: `Bearer ${generateToken(String(alice._id))}` } });
  assert.equal(r.status, 403);
});

test("chat is limited per USER: the 4th message in a minute gets 429, another user is unaffected", async () => {
  const tokenA = generateToken(String(alice._id));
  const tokenB = generateToken(String(bob._id));
  const send = (t: string) => call("POST", "/api/chat/ask", { body: JSON.stringify({}), headers: { authorization: `Bearer ${t}` } });
  // an empty body is a cheap 400 from the controller; the limiter counts every request regardless
  for (let i = 0; i < 3; i++) assert.equal((await send(tokenA)).status, 400, `request ${i + 1}`);
  const blocked = await send(tokenA);
  assert.equal(blocked.status, 429);
  assert.match(((await blocked.json()) as { message: string }).message, /wait a moment/);
  assert.equal((await send(tokenB)).status, 400, "a different user has their own allowance");
});