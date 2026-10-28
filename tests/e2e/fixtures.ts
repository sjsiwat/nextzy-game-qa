import { randomUUID } from "node:crypto";
import { expect, test as base } from "@playwright/test";
import { reset } from "../helpers/api.mjs";

/**
 * Each test plays as its own throwaway player. The id is written to
 * localStorage before the app loads (it reads the key `nextzy-player-id`),
 * so state can be prepared through the API, and the player is reset afterwards.
 */
export const test = base.extend<{ playerId: string }>({
  playerId: async ({ page }, use) => {
    const id = randomUUID();
    await page.addInitScript((value: string) => localStorage.setItem("nextzy-player-id", value), id);
    await use(id);
    await reset(id);
  },
});

export { expect };

export const formatNumber = (value: number) => value.toLocaleString("en-US");
export const ALLOWED_SCORES = [300, 500, 1000, 3000];
