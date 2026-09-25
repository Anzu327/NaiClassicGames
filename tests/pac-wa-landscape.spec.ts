import { expect, test } from "@playwright/test";

test("Pac-Wa has working side controls on a landscape phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-landscape", "Landscape phone layout only.");
  await page.goto("/");
  await page.getByRole("button", { name: "Enter game library" }).click();
  await page.getByRole("button", { name: "Play Pac-Wa" }).click();

  const frame = page.frameLocator('iframe[title="Pac-Wa game"]');
  await expect(frame.getByRole("button", { name: "START GAME" })).toBeVisible({ timeout: 15_000 });
  await expect(frame.getByRole("navigation", { name: "Movement controls" })).toBeVisible();
  const layout = await frame.locator(".game-shell").evaluate(() => {
    const board = document.querySelector(".game-wrap")!.getBoundingClientRect();
    const controls = document.querySelector(".portrait-controls")!.getBoundingClientRect();
    return {
      boardRight: board.right,
      controlsLeft: controls.left,
      boardRatio: board.width / board.height,
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportHeight: innerHeight,
      documentHeight: document.documentElement.scrollHeight,
    };
  });
  expect(layout.boardRight).toBeLessThan(layout.controlsLeft);
  expect(layout.boardRatio).toBeCloseTo(16 / 9, 1);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);

  await frame.getByRole("button", { name: "START GAME" }).click();
  await frame.getByRole("button", { name: "Move left" }).click();
  await expect(frame.locator("body")).toHaveAttribute("data-direction", "left");
  await frame.getByRole("button", { name: "Pause" }).click();
  await expect(frame.locator("body")).toHaveAttribute("data-phase", "paused");
});
