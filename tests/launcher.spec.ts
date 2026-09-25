import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Enter game library" })).toBeVisible();
  await page.getByRole("button", { name: "Enter game library" }).click();
  await expect(page.getByRole("img", { name: "NaiClassicGames" })).toBeVisible();
});

test("shows a title screen before revealing the game library", async ({ page }) => {
  await page.reload();
  const intro = page.getByRole("button", { name: "Enter game library" });
  await expect(intro).toBeVisible();
  await expect(intro.getByText("CLICK / TAP TO START")).toBeVisible();
  const introParticles = page.locator("#intro-particle-field");
  await expect(introParticles).toBeVisible();
  await expect(introParticles).toHaveAttribute("data-naiwa-variants", "4");
  await expect(introParticles).toHaveAttribute("data-naiwa-particles", /[8-9]|1[0-6]/);
  await expect(page.getByRole("button", { name: "Play Pac-Wa" })).toBeHidden();
  await intro.click();
  await expect(page.getByRole("button", { name: "Play Pac-Wa" })).toBeVisible();
  await expect(intro).toBeHidden();
});

test("renders moving pixel and Naiwa particles across the background", async ({ page }) => {
  const field = page.locator("#particle-field");
  await expect(field).toBeVisible();
  await expect(field).toHaveAttribute("data-pixel-particles", /[2-9][0-9]/);
  await expect(field).toHaveAttribute("data-naiwa-particles", /[8-9]|1[0-6]/);
  await expect(field).toHaveAttribute("data-naiwa-variants", "4");
  const coverage = await field.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return { left: 0, right: 0 };
    const middle = Math.floor(canvas.width / 2);
    const left = context.getImageData(0, 0, middle, canvas.height).data;
    const right = context.getImageData(middle, 0, canvas.width - middle, canvas.height).data;
    const occupied = (pixels: Uint8ClampedArray) => {
      let count = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) count += 1;
      return count;
    };
    return { left: occupied(left), right: occupied(right) };
  });
  expect(coverage.left).toBeGreaterThan(0);
  expect(coverage.right).toBeGreaterThan(0);
  const signature = async () => field.evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!pixels) return 0;
    let value = 0;
    for (let index = 3; index < pixels.length; index += 64) value = (value + pixels[index]! * index) % 2_147_483_647;
    return value;
  });
  const before = await signature();
  await page.waitForTimeout(300);
  expect(await signature()).not.toBe(before);
});

test("browses the four-game catalog with buttons and keyboard", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Play Pac-Wa" })).toBeVisible();
  await page.getByRole("button", { name: "Next game" }).click();
  await expect(page.getByRole("button", { name: "Play Naitris" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Play NaiSnake" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Play Naippy Wa" })).toBeVisible();
  await page.getByRole("button", { name: "Next game" }).click();
  await expect(page.getByRole("button", { name: "Play Pac-Wa" })).toBeVisible();
  await page.getByRole("button", { name: "Previous game" }).click();
  await expect(page.getByRole("button", { name: "Play Naippy Wa" })).toBeVisible();
});

test("reveals the work explanation only after the about button is clicked", async ({ page }, testInfo) => {
  const dialog = page.getByRole("dialog", { name: "NAI WA AND THE SHAPE OF ADAPTATION" });
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "About this work" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Nai Wa changing between six standing poses" })).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Nai Classic Games logo" })).toBeAttached();
  await expect(dialog.getByText("When adapting becomes an instinct")).toBeVisible();
  await page.getByRole("button", { name: "Close about this work" }).click();
  await expect(dialog).toBeHidden();
  if (!testInfo.project.name.startsWith("mobile")) {
    await expect(page.getByRole("button", { name: "About this work" })).toBeFocused();
  }
});

test("opens the website QR code from its own home button", async ({ page }) => {
  const button = page.getByRole("button", { name: "Show website QR code" });
  const dialog = page.getByRole("dialog", { name: "SCAN TO OPEN" });
  await expect(button).toBeVisible();
  await button.click();
  await expect(dialog).toBeVisible();
  const image = dialog.getByRole("img", { name: "QR code for the website" });
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty("naturalWidth", 450);
  await page.getByRole("button", { name: "Close QR code" }).click();
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test("supports pointer dragging and persists the active game", async ({ page }) => {
  const stage = page.locator("#card-stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error("card stage missing");
  await page.mouse.move(box.x + box.width * .72, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .3, box.y + box.height * .5, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Play Naitris" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Enter game library" }).click();
  await expect(page.getByRole("button", { name: "Play Naitris" })).toBeVisible();
});

test("launches a committed snapshot and returns to the same selection", async ({ page }) => {
  await page.getByRole("button", { name: "Play Pac-Wa" }).click();
  const frame = page.frameLocator('iframe[title="Pac-Wa game"]');
  await expect(frame.getByRole("button", { name: "START GAME" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Back to library" }).click();
  await expect(page.getByRole("button", { name: "Play Pac-Wa" })).toBeVisible();
});

test("sound starts only after interaction and mute persists", async ({ page }) => {
  const contextsBefore = await page.evaluate(() => document.querySelectorAll("audio").length);
  expect(contextsBefore).toBe(0);
  const sound = page.getByRole("button", { name: "Mute launcher sound" });
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.getByRole("button", { name: "Enter game library" }).click();
  await expect(page.getByRole("button", { name: "Unmute launcher sound" })).toHaveAttribute("aria-pressed", "true");
});

test("captures the launcher", async ({ page }, testInfo) => {
  await page.waitForTimeout(700);
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  await page.screenshot({ path: testInfo.outputPath("launcher.png") });
});
