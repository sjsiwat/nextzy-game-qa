// Parallel requests. The service claims the transaction keeps totals correct.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_SCORE, play, playHistory, playerPool, summary } from "../helpers/api.mjs";

const pool = playerPool();
after(() => pool.cleanup());

describe("TC-API-050 25 parallel rounds for an existing player", () => {
  it("all succeed, every round is recorded, and the total is the capped sum", async () => {
    const id = pool.newPlayer();
    const first = (await play(id)).body.score;
    const results = await Promise.all(Array.from({ length: 25 }, () => play(id)));
    assert.ok(results.every((r) => r.status === 201), "no request failed");
    const sum = first + results.reduce((total, r) => total + r.body.score, 0);
    assert.equal((await summary(id)).body.totalScore, Math.min(sum, MAX_SCORE));
    assert.equal((await playHistory(id)).body.length, 26);
  });
});

describe("TC-API-051 no lost update below the cap", () => {
  it("two parallel rounds add up exactly, across 15 players", async () => {
    for (let trial = 0; trial < 15; trial++) {
      const id = pool.newPlayer();
      const first = (await play(id)).body.score; // at most 3000, so three rounds stay under 10000
      const [a, b] = await Promise.all([play(id), play(id)]);
      assert.equal(a.status, 201);
      assert.equal(b.status, 201);
      assert.equal((await summary(id)).body.totalScore, first + a.body.score + b.body.score, `trial ${trial}`);
    }
  });
});

// BUG-001: the first two rounds of a brand-new player, sent at the same moment,
// make one of them fail with 500. Marked `todo` so the suite stays green while
// the defect is open; the failure output is the evidence.
describe("TC-API-052 parallel first rounds of a brand-new player", () => {
  it("should both succeed, and add up", { todo: "BUG-001: second request answers 500" }, async () => {
    for (let trial = 0; trial < 3; trial++) {
      const id = pool.newPlayer();
      const [a, b] = await Promise.all([play(id), play(id)]);
      assert.deepEqual([a.status, b.status], [201, 201], `trial ${trial}: ${JSON.stringify([a.body, b.body])}`);
      assert.equal((await summary(id)).body.totalScore, a.body.score + b.body.score);
    }
  });
});
