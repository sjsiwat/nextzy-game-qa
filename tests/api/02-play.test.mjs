// Rules of a round: drawn score, accumulation, summary and history stay consistent.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_SCORE, SCORES, play, playHistory, playerPool, summary } from "../helpers/api.mjs";

const pool = playerPool();
after(() => pool.cleanup());

describe("TC-API-010 one round", () => {
  it("answers 201 with a drawn score from the allowed set", async () => {
    const id = pool.newPlayer();
    const { status, body } = await play(id);
    assert.equal(status, 201);
    assert.ok(SCORES.includes(body.score), `score ${body.score} is one of ${SCORES}`);
    assert.equal(body.totalScore, body.score, "a new player's total equals the first draw");
    assert.deepEqual(Object.keys(body).sort(), ["score", "totalScore"]);
  });
});

describe("TC-API-011 accumulation", () => {
  it("adds each draw to the running total, capped at the maximum", async () => {
    const id = pool.newPlayer();
    let expected = 0;
    for (let round = 1; round <= 6; round++) {
      const { body } = await play(id);
      expected = Math.min(expected + body.score, MAX_SCORE);
      assert.equal(body.totalScore, expected, `total after round ${round}`);
    }
  });
});

describe("TC-API-012 summary agrees with the last round", () => {
  it("reports the same total and the configured maximum", async () => {
    const id = pool.newPlayer();
    await play(id);
    const last = (await play(id)).body;
    const res = await summary(id);
    assert.equal(res.status, 200);
    assert.equal(res.body.totalScore, last.totalScore);
    assert.equal(res.body.maxScore, MAX_SCORE);
  });
});

describe("TC-API-013 play history", () => {
  it("records every round, newest first, with the drawn score", async () => {
    const id = pool.newPlayer();
    const drawn = [];
    for (let i = 0; i < 4; i++) drawn.push((await play(id)).body.score);
    const { status, body } = await playHistory(id);
    assert.equal(status, 200);
    assert.deepEqual(body.map((row) => row.score), drawn.reverse());
    for (const row of body) {
      assert.ok(Number.isInteger(row.id));
      assert.ok(!Number.isNaN(Date.parse(row.createdAt)));
    }
  });
});

describe("TC-API-014 the draw", () => {
  it("only ever returns allowed scores, and over 200 draws all four appear", async () => {
    const id = pool.newPlayer();
    await play(id); // make the player exist; see BUG-001 for why parallel plays need this
    const seen = new Set();
    for (let batch = 0; batch < 8; batch++) {
      const results = await Promise.all(Array.from({ length: 25 }, () => play(id)));
      for (const { status, body } of results) {
        assert.equal(status, 201);
        assert.ok(SCORES.includes(body.score));
        seen.add(body.score);
      }
    }
    assert.deepEqual([...seen].sort((a, b) => a - b), SCORES);
  });
});

describe("TC-API-015 an unknown player", () => {
  it("reads as a zero summary and never writes anything", async () => {
    const id = pool.newPlayer();
    const res = await summary(id);
    assert.equal(res.body.totalScore, 0);
    assert.deepEqual(res.body.checkpoints.map((c) => c.status), ["locked", "locked", "locked"]);
    assert.deepEqual((await playHistory(id)).body, []);
  });
});
