// How strictly the API reads its inputs. Spec: playerId is a UUID, checkpoint is the integer 5000, 7500 or 10000.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { claim, play, playUntil, playerPool, rewardHistory, summary } from "../helpers/api.mjs";

const pool = playerPool();
after(() => pool.cleanup());

// BUG-002: the checkpoint segment is converted with Number() before it is checked,
// so spellings that are not the integer 5000 still claim checkpoint 5000.
describe("TC-API-060 only the integer spelling of a checkpoint is accepted", () => {
  for (const [label, value] of [
    ["decimal", "5000.0"],
    ["exponent", "5e3"],
    ["hexadecimal", "0x1388"],
    ["leading plus", "+5000"],
    ["leading zero", "05000"],
    ["leading space", "%205000"],
    ["trailing space", "5000%20"],
  ]) {
    it(`${label} (${JSON.stringify(decodeURIComponent(value))}) should be 400`, { todo: "BUG-002: answers 201 and claims 5000" }, async () => {
      const id = pool.newPlayer();
      await playUntil(id, 5000);
      const res = await claim(id, value);
      assert.equal(res.status, 400, `got ${res.status} ${JSON.stringify(res.body)}`);
    });
  }
});

describe("TC-API-061 a loose spelling cannot be used to claim twice", () => {
  it("5000 then 5e3 -> 201 then 409, one reward row", async () => {
    const id = pool.newPlayer();
    await playUntil(id, 5000);
    assert.equal((await claim(id, 5000)).status, 201);
    assert.equal((await claim(id, "5e3")).status, 409);
    assert.equal((await rewardHistory(id)).body.length, 1);
  });
});

// BUG-003: the id column is plain text, so the same UUID in upper case is another player.
describe("TC-API-062 a UUID means the same player in any letter case", () => {
  it("should read the lowercase player's score through the uppercase spelling", { todo: "BUG-003: uppercase is a separate player with total 0" }, async () => {
    const id = pool.newPlayer();
    const { body } = await play(id);
    pool.track(id.toUpperCase());
    assert.equal((await summary(id.toUpperCase())).body.totalScore, body.totalScore);
  });
});
