import { defineConfig } from "@playwright/test";

const WEB_URL = process.env.WEB_URL ?? "https://nextzy-game.vercel.app";

export default defineConfig({
  testDir: "tests/e2e",
  // The API runs on a free Render plan that sleeps; the first request after a
  // quiet spell can take up to a minute, so timeouts are generous on purpose.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: 1,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    // Uses the Chrome already installed on the machine, so no browser download.
    channel: "chrome",
    // The game is designed for 300-500px wide screens.
    viewport: { width: 430, height: 860 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
