// Contract: health, the shared error envelope, and playerId validation.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { call, playerPool, API_URL } from "../helpers/api.mjs";

const pool = playerPool();
after(() => pool.cleanup());

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function assertErrorEnvelope(res, status, path) {
  assert.equal(res.status, status);
  assert.equal(res.body.statusCode, status);
  assert.ok(Array.isArray(res.body.message), "message is always an array");
  assert.ok(res.body.message.length > 0 && res.body.message.every((m) => typeof m === "string"));
  assert.equal(res.body.path, path);
  assert.match(res.body.timestamp, ISO);
}

describe("TC-API-001 health", () => {
  it("answers 200 with status ok", async () => {
    const res = await call("GET", "/health");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: "ok" });
  });
});

describe("TC-API-002 a malformed playerId is rejected on every player endpoint", () => {
  const endpoints = [
    ["GET", "summary"],
    ["POST", "game/play"],
    ["POST", "rewards/5000/claim"],
    ["POST", "reset"],
    ["GET", "history/plays"],
    ["GET", "history/rewards"],
  ];
  for (const [method, tail] of endpoints) {
    it(`${method} /players/:id/${tail} -> 400 in the shared envelope`, async () => {
      const path = `/players/not-a-uuid/${tail}`;
      const res = await call(method, path);
      assertErrorEnvelope(res, 400, path);
      assert.deepEqual(res.body.message, ["playerId must be a UUID"]);
    });
  }
});

describe("TC-API-003 unknown route", () => {
  it("answers 404 in the same envelope", async () => {
    const res = await call("GET", "/nope");
    assertErrorEnvelope(res, 404, "/nope");
  });
});

describe("TC-API-004 playerId shapes", () => {
  const rejected = [
    ["too long", (id) => `${id}0`],
    ["too short", (id) => id.slice(0, -1)],
    ["contains a space", (id) => `${id.slice(0, 8)}%20${id.slice(9)}`],
    ["non-hex characters", () => "zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz"],
    ["an invalid version digit", () => "11111111-1111-1111-1111-111111111111"],
  ];
  for (const [label, make] of rejected) {
    it(`rejects an id that is ${label}`, async () => {
      const res = await call("GET", `/players/${make(pool.newPlayer())}/summary`);
      assert.equal(res.status, 400);
    });
  }

  it("accepts a well-formed lowercase v4 UUID and returns a zero summary", async () => {
    const res = await call("GET", `/players/${pool.newPlayer()}/summary`);
    assert.equal(res.status, 200);
    assert.equal(res.body.totalScore, 0);
  });

  it("accepts a trailing slash", async () => {
    const res = await call("GET", `/players/${pool.newPlayer()}/summary/`);
    assert.equal(res.status, 200);
  });
});

describe("TC-API-005 base URL under test", () => {
  it("is reachable", async () => {
    assert.ok(API_URL.startsWith("http"), `API_URL is ${API_URL}`);
  });
});
