// Checkpoints and rewards: locked -> claimable -> claimed, and what is refused.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHECKPOINTS, MAX_SCORE, claim, play, playUntil, playerPool, rewardHistory, summary } from "../helpers/api.mjs";

const pool = playerPool();
after(() => pool.cleanup());

const statuses = (res) => res.body.checkpoints.map((c) => c.status);

describe("TC-API-020 a new player's checkpoints", () => {
  it("are locked and carry the configured points and reward names", async () => {
    const res = await summary(pool.newPlayer());
    assert.deepEqual(
      res.body.checkpoints.map(({ points, reward, status }) => ({ points, reward, status })),
      CHECKPOINTS.map((c) => ({ ...c, status: "locked" })),
    );
  });
});

describe("TC-API-021 claiming before the score is reached", () => {
  it("is refused with 400 for a player who has not played", async () => {
    const res = await claim(pool.newPlayer(), 5000);
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.message, ["Score has not reached this checkpoint"]);
  });

  it("is refused with 400 for the next checkpoint a player has not reached", async () => {
    const id = pool.newPlayer();
    const { at } = { at: (await playUntil(id, 5000)).at(-1).totalScore };
    const next = CHECKPOINTS.find((c) => c.points > at);
    if (!next) return; // already at the maximum; nothing is left to be refused
    const res = await claim(id, next.points);
    assert.equal(res.status, 400);
  });
});

describe("TC-API-022 a checkpoint the game does not have", () => {
  for (const value of ["0", "1", "2500", "4999", "5001", "7501", "10001", "-5000", "abc", "5000abc"]) {
    it(`/rewards/${value}/claim -> 400`, async () => {
      const res = await claim(pool.newPlayer(), value);
      assert.equal(res.status, 400);
      assert.deepEqual(res.body.message, ["checkpoint must be one of the following values: 5000, 7500, 10000"]);
    });
  }
});

describe("TC-API-023 claiming a reached checkpoint", () => {
  it("answers 201 with the reward, and the summary flips to claimed", async () => {
    const id = pool.newPlayer();
    await playUntil(id, 5000);
    assert.equal(statuses(await summary(id))[0], "claimable");

    const res = await claim(id, 5000);
    assert.equal(res.status, 201);
    assert.equal(res.body.checkpoint, 5000);
    assert.equal(res.body.reward, "รางวัล A");
    assert.ok(!Number.isNaN(Date.parse(res.body.claimedAt)));
    assert.equal(statuses(await summary(id))[0], "claimed");
  });
});

describe("TC-API-024 claiming twice", () => {
  it("answers 409 the second time and records the reward once", async () => {
    const id = pool.newPlayer();
    await playUntil(id, 5000);
    assert.equal((await claim(id, 5000)).status, 201);
    const again = await claim(id, 5000);
    assert.equal(again.status, 409);
    assert.deepEqual(again.body.message, ["Reward already claimed"]);
    assert.equal((await rewardHistory(id)).body.length, 1);
  });
});

describe("TC-API-025 all three rewards", () => {
  it("can be claimed once the maximum is reached, and list newest first", async () => {
    const id = pool.newPlayer();
    await playUntil(id, MAX_SCORE);
    for (const { points, reward } of CHECKPOINTS) {
      const res = await claim(id, points);
      assert.equal(res.status, 201, `claim ${points}`);
      assert.equal(res.body.reward, reward);
    }
    assert.deepEqual(statuses(await summary(id)), ["claimed", "claimed", "claimed"]);
    const history = (await rewardHistory(id)).body;
    assert.deepEqual(history.map((row) => row.rewardName), ["รางวัล C", "รางวัล B", "รางวัล A"]);
    assert.deepEqual(history.map((row) => row.checkpoint), [10000, 7500, 5000]);
  });
});

describe("TC-API-026 the status model follows the total", () => {
  it("shows claimable exactly for the checkpoints the total has reached", async () => {
    const id = pool.newPlayer();
    const rounds = await playUntil(id, 5000);
    const total = rounds.at(-1).totalScore;
    const expected = CHECKPOINTS.map((c) => (total >= c.points ? "claimable" : "locked"));
    assert.deepEqual(statuses(await summary(id)), expected);
  });
});

describe("TC-API-027 two claims at the same moment", () => {
  it("produce exactly one 201 and the rest 409, and one reward row", async () => {
    const id = pool.newPlayer();
    await playUntil(id, 5000);
    const results = await Promise.all(Array.from({ length: 10 }, () => claim(id, 5000)));
    const codes = results.map((r) => r.status).sort();
    assert.deepEqual(codes, [201, ...Array(9).fill(409)]);
    assert.equal((await rewardHistory(id)).body.length, 1);
  });
});
