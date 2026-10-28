import { randomUUID } from "node:crypto";

export const API_URL = process.env.API_URL ?? "https://nextzy-game.onrender.com";
export const WEB_URL = process.env.WEB_URL ?? "https://nextzy-game.vercel.app";

export const SCORES = [300, 500, 1000, 3000];
export const MAX_SCORE = 10000;
export const CHECKPOINTS = [
  { points: 5000, reward: "รางวัล A" },
  { points: 7500, reward: "รางวัล B" },
  { points: 10000, reward: "รางวัล C" },
];

/** One HTTP call. Never throws on a non-2xx; the status is what the tests assert on. */
export async function call(method, path, { headers } = {}) {
  const response = await fetch(`${API_URL}${path}`, { method, headers });
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // not JSON (an empty 204, say): keep the raw text
  }
  return { status: response.status, body, headers: response.headers };
}

/**
 * Every test gets its own throwaway player so tests cannot interfere with each
 * other, and every player is reset (deleted, with its history) when the file
 * finishes. Call `track()` for any id a test makes up itself.
 */
export function playerPool() {
  const ids = new Set();
  return {
    track(id) {
      ids.add(id);
      return id;
    },
    newPlayer() {
      return this.track(randomUUID());
    },
    async cleanup() {
      await Promise.all([...ids].map((id) => call("POST", `/players/${id}/reset`)));
      ids.clear();
    },
  };
}

export const play = (id) => call("POST", `/players/${id}/game/play`);
export const summary = (id) => call("GET", `/players/${id}/summary`);
export const claim = (id, checkpoint) => call("POST", `/players/${id}/rewards/${checkpoint}/claim`);
export const reset = (id) => call("POST", `/players/${id}/reset`);
export const playHistory = (id) => call("GET", `/players/${id}/history/plays`);
export const rewardHistory = (id) => call("GET", `/players/${id}/history/rewards`);

/** Play one round at a time until the total reaches `target`. Returns every result. */
export async function playUntil(id, target, maxRounds = 80) {
  const results = [];
  for (let i = 0; i < maxRounds; i++) {
    const { status, body } = await play(id);
    if (status !== 201) throw new Error(`play returned ${status}: ${JSON.stringify(body)}`);
    results.push(body);
    if (body.totalScore >= target) return results;
  }
  throw new Error(`did not reach ${target} in ${maxRounds} rounds`);
}
