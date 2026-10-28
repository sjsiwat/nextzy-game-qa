// History limits and shapes, and the reset operation.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { claim, play, playHistory, playUntil, playerPool, reset, rewardHistory, summary } from "../helpers/api.mjs";

const pool = playerPool();
after(() => pool.cleanup());

describe("TC-API-030 play history is limited to the latest 100", () => {
  it("returns 100 rows, newest first, after 105 rounds", async () => {
    const id = pool.newPlayer();
    const drawn = [];
    for (let i = 0; i < 105; i++) drawn.push((await play(id)).body.score);
    const { body } = await playHistory(id);
    assert.equal(body.length, 100);
    assert.deepEqual(body.map((row) => row.score), drawn.slice(-100).reverse());
    for (let i = 1; i < body.length; i++) assert.ok(body[i].id < body[i - 1].id, "ids strictly descend");
  });
});

describe("TC-API-031 history of a player who never played", () => {
  it("is an empty list for both histories", async () => {
    const id = pool.newPlayer();
    assert.deepEqual((await playHistory(id)).body, []);
    assert.deepEqual((await rewardHistory(id)).body, []);
  });
});

describe("TC-API-032 reward history shape", () => {
  it("lists id, checkpoint, rewardName and createdAt", async () => {
    const id = pool.newPlayer();
    await playUntil(id, 5000);
    await claim(id, 5000);
    const [row] = (await rewardHistory(id)).body;
    assert.deepEqual(Object.keys(row).sort(), ["checkpoint", "createdAt", "id", "rewardName"]);
    assert.equal(row.rewardName, "รางวัล A");
  });
});

describe("TC-API-040 reset", () => {
  it("answers 204 with no body and clears score, plays and rewards", async () => {
    const id = pool.newPlayer();
    await playUntil(id, 5000);
    await claim(id, 5000);
    const res = await reset(id);
    assert.equal(res.status, 204);
    assert.equal(res.body, "");
    assert.equal((await summary(id)).body.totalScore, 0);
    assert.deepEqual((await playHistory(id)).body, []);
    assert.deepEqual((await rewardHistory(id)).body, []);
  });

  it("lets the same checkpoint be claimed again afterwards (not 409)", async () => {
    const id = pool.newPlayer();
    await playUntil(id, 5000);
    assert.equal((await claim(id, 5000)).status, 201);
    await reset(id);
    await playUntil(id, 5000);
    assert.equal((await claim(id, 5000)).status, 201);
  });
});

describe("TC-API-041 reset is idempotent", () => {
  it("answers 204 for a player that never existed, and again on repeat", async () => {
    const id = pool.newPlayer();
    assert.equal((await reset(id)).status, 204);
    assert.equal((await reset(id)).status, 204);
  });
});

describe("TC-API-042 reset only touches its own player", () => {
  it("leaves another player's score and history alone", async () => {
    const [a, b] = [pool.newPlayer(), pool.newPlayer()];
    await play(a);
    const kept = (await play(b)).body.totalScore;
    await reset(a);
    assert.equal((await summary(a)).body.totalScore, 0);
    assert.equal((await summary(b)).body.totalScore, kept);
    assert.equal((await playHistory(b)).body.length, 1);
  });
});
