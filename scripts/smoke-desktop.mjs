import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platform = process.platform;
const defaultExecutablePath = platform === "darwin"
  ? path.join(root, "out/packaged/NaiClassicGames-darwin-arm64/NaiClassicGames.app/Contents/MacOS/NaiClassicGames")
  : path.join(root, "out/packaged/NaiClassicGames-win32-x64/NaiClassicGames.exe");
const executablePath = process.argv[2] ?? defaultExecutablePath;
const dataDir = await mkdtemp(path.join(tmpdir(), "nai-classic-smoke-"));

const games = [
  { name: "Pac-Wa", start: "#primary-button" },
  { name: "Naitris", start: "#primary-button" },
  { name: "NaiSnake", start: "#primary-button" },
  { name: "Naippy Wa", start: ".start-button" },
];

let app;
try {
  app = await _electron.launch({ executablePath, args: [`--user-data-dir=${dataDir}`] });
  const page = await app.firstWindow();
  const brokenAssets = [];
  page.on("response", (response) => {
    if (response.status() >= 400) brokenAssets.push(`${response.status()} ${response.url()}`);
  });
  await app.context().setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Enter game library" }).waitFor();
  await page.locator("#intro-qr-button").click();
  const qr = page.locator("#qr-dialog img");
  await qr.waitFor();
  assert.equal(await qr.getAttribute("src"), "./qrcode_anzu327.github.io.png");
  assert.equal(await qr.evaluate((image) => image.naturalWidth), 450);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Enter game library" }).click();

  for (const [index, game] of games.entries()) {
    await page.getByRole("button", { name: `Play ${game.name}` }).click();
    const frame = page.frameLocator(`iframe[title="${game.name} game"]`);
    await frame.locator(game.start).waitFor({ timeout: 20_000 });
    await frame.locator(game.start).click();
    await frame.locator("canvas").first().waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: "Back to library" }).click();
    if (index < games.length - 1) await page.getByRole("button", { name: "Next game" }).click();
  }

  await page.evaluate(() => {
    localStorage.setItem("naiwa-high-score", "123");
    localStorage.setItem("nai-classic-games.active-game", "pac-wa");
    history.replaceState(null, "", "#game=pac-wa");
  });
  await page.reload();
  await page.getByRole("button", { name: "Enter game library" }).click();
  assert.equal(await page.locator("#best-score").innerText(), "000123");
  assert.deepEqual(brokenAssets, []);
  console.log(`Offline desktop smoke passed: ${games.map((game) => game.name).join(", ")}; best score persists.`);
} finally {
  if (app) await app.close();
  await rm(dataDir, { recursive: true, force: true });
}
