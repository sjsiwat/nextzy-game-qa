import { expect, formatNumber, test, ALLOWED_SCORES } from "./fixtures";
import { claim, play, playHistory, playUntil, summary } from "../helpers/api.mjs";

const SPIN = "สุ่มคะแนน";

test.describe("Home", () => {
  test("E2E-001 a new player sees an empty, locked board", async ({ page, playerId }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "สะสมคะแนน" })).toBeVisible();
    await expect(page.getByText("0/10,000", { exact: true })).toBeVisible();
    await expect(page.getByText("ยังไม่มีประวัติ")).toBeVisible();
    // Locked rewards are labels, not buttons: nothing can be claimed yet.
    await expect(page.getByRole("button", { name: /กดรับรางวัล/ })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "ประวัติการเล่น" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("link", { name: "ไปเล่นเกม" })).toHaveAttribute("href", "/game");
    // Looking at the page must not create the player.
    expect((await summary(playerId)).body.totalScore).toBe(0);
  });

  test("E2E-004 shows a round played on the Game page in the total and the history", async ({ page, playerId }) => {
    const { body } = await play(playerId);
    await page.goto("/");
    await expect(page.getByText(`${formatNumber(body.totalScore)}/10,000`, { exact: true })).toBeVisible();
    await expect(page.getByText(`เล่นได้ ${formatNumber(body.score)} คะแนน`)).toBeVisible();
  });

  test("E2E-005 claims a reward: dialog, then a claimed label, then the reward history", async ({ page, playerId }) => {
    await playUntil(playerId, 5000);
    await page.goto("/");

    await page.getByRole("button", { name: "กดรับรางวัล A" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "ยินดีด้วย" })).toBeVisible();
    await expect(dialog).toContainText("คุณได้รับรางวัล A");
    await dialog.getByRole("button", { name: "ปิด" }).last().click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole("button", { name: "กดรับรางวัล A" })).toHaveCount(0);
    await expect(page.getByText("ได้รางวัล A แล้ว")).toBeVisible();
    await page.getByRole("tab", { name: "ประวัติรางวัล" }).click();
    await expect(page.getByText("ได้รับรางวัล A")).toBeVisible();
    expect((await summary(playerId)).body.checkpoints[0].status).toBe("claimed");
  });

  test("E2E-006 RESET clears the score and the history straight away", async ({ page, playerId }) => {
    await play(playerId);
    await page.goto("/");
    await expect(page.getByText(/^[\d,]+\/10,000$/)).not.toHaveText("0/10,000");

    // Observation: there is no confirmation step before this destructive action.
    test.info().annotations.push({ type: "observation", description: "RESET deletes data without a confirmation prompt" });
    await page.getByRole("button", { name: "RESET" }).click();

    await expect(page.getByText("0/10,000", { exact: true })).toBeVisible();
    await expect(page.getByText("ยังไม่มีประวัติ")).toBeVisible();
    expect((await summary(playerId)).body.totalScore).toBe(0);
  });

  test("E2E-007 shows a server-unreachable message with a working retry", async ({ page }) => {
    await page.route("**/players/**", (route) => route.abort());
    await page.goto("/");
    const alert = page.locator("main").getByRole("alert"); // Next.js adds its own route-announcer alert outside <main>
    await expect(alert).toContainText("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");

    await page.unroute("**/players/**");
    await alert.getByRole("button", { name: "ลองอีกครั้ง" }).click();
    await expect(page.getByText("0/10,000", { exact: true })).toBeVisible();
    await expect(alert).toBeHidden();
  });
});

test.describe("Game", () => {
  test("E2E-002 a round: the button locks, the dialog shows a valid score, the total follows", async ({ page, playerId }) => {
    await page.goto("/game");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("คะแนนสะสม 0/10,000");

    const spin = page.getByRole("button", { name: SPIN });
    await spin.click();
    await expect(spin).toBeDisabled();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "ได้รับ" })).toBeVisible();
    const shown = Number((await dialog.getByText(/คะแนน$/).innerText()).replace(/[^\d]/g, ""));
    expect(ALLOWED_SCORES).toContain(shown);

    // The server is the source of truth: what the dialog says is what it drew.
    const history = (await playHistory(playerId)).body;
    expect(history).toHaveLength(1);
    expect(history[0].score).toBe(shown);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`${formatNumber(shown)}/10,000`);

    await dialog.getByRole("button", { name: "ปิด" }).last().click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: SPIN })).toBeEnabled();
  });

  test("E2E-003 a second round adds to the first", async ({ page, playerId }) => {
    await page.goto("/game");
    const totals: number[] = [];
    for (let round = 0; round < 2; round++) {
      await page.getByRole("button", { name: SPIN }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "ปิด" }).last().click();
      await expect(dialog).toBeHidden();
      totals.push((await summary(playerId)).body.totalScore);
    }
    expect(totals[1]).toBeGreaterThan(totals[0]);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`${formatNumber(totals[1])}/10,000`);
  });

  test("E2E-008 a failed round shows an error, restores the board, and can be retried", async ({ page }) => {
    await page.goto("/game");
    await page.route("**/game/play", (route) => route.abort());
    await page.getByRole("button", { name: SPIN }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    await expect(page.getByRole("button", { name: SPIN })).toBeEnabled();

    await page.unroute("**/game/play");
    await page.getByRole("button", { name: SPIN }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  });

  test("E2E-009 Escape closes the result dialog and the next round is possible", async ({ page }) => {
    await page.goto("/game");
    await page.getByRole("button", { name: SPIN }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: SPIN })).toBeEnabled();
  });

  test("E2E-010 leaving mid-round still records the round on the server", async ({ page, playerId }) => {
    await page.goto("/game");
    await page.getByRole("button", { name: SPIN }).click();
    await page.getByRole("link", { name: "กลับหน้าหลัก" }).click();
    await expect(page).toHaveURL("/");
    // The round was accepted before the player left, so Home must agree with the server.
    await expect.poll(async () => (await summary(playerId)).body.totalScore).toBeGreaterThan(0);
    const total = (await summary(playerId)).body.totalScore;
    await page.reload();
    await expect(page.getByText(`${formatNumber(total)}/10,000`, { exact: true })).toBeVisible();
  });

  test("E2E-011 at the maximum the total stays 10,000 while the drawn score is still shown", async ({ page, playerId }) => {
    await playUntil(playerId, 10000);
    await page.goto("/game");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("10,000/10,000");
    await page.getByRole("button", { name: SPIN }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("10,000/10,000");
    expect((await summary(playerId)).body.totalScore).toBe(10000);
  });
});

test.describe("Players and layout", () => {
  test("E2E-012 the score survives a reload, and a fresh browser profile is a different player", async ({ page, browser, playerId }) => {
    await play(playerId);
    const total = (await summary(playerId)).body.totalScore;
    await page.goto("/");
    await page.reload();
    await expect(page.getByText(`${formatNumber(total)}/10,000`, { exact: true })).toBeVisible();

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto("/");
    await expect(otherPage.getByText("0/10,000", { exact: true })).toBeVisible();
    await other.close();
  });

  for (const width of [300, 375, 500]) {
    test(`E2E-013 no horizontal scrolling at ${width}px on Home and Game`, async ({ page }) => {
      await page.setViewportSize({ width, height: 860 });
      for (const path of ["/", "/game"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test("E2E-014 a claimed reward cannot be claimed again from another tab", async ({ page, context, playerId }) => {
    await playUntil(playerId, 5000);
    await page.goto("/");
    const stale = await context.newPage();
    await stale.goto("/");
    await page.getByRole("button", { name: "กดรับรางวัล A" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ปิด" }).last().click();

    // The second tab still shows the button; pressing it must be handled, not crash the page.
    await stale.getByRole("button", { name: "กดรับรางวัล A" }).click();
    await expect(stale.locator("main").getByRole("alert")).toBeVisible();
    await expect(stale.getByText("ได้รางวัล A แล้ว")).toBeVisible();
    expect((await claim(playerId, 5000)).status).toBe(409);
  });
});
