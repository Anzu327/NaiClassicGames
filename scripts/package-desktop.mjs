import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";
import electronPackage from "electron/package.json" with { type: "json" };

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "out");
const stage = path.join(output, "desktop-stage");
const release = JSON.parse(await readFile(path.join(root, "src/releases.json"), "utf8"));
const appPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const target = process.argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length);
const platform = target ?? process.platform;
const arch = platform === "darwin" ? "arm64" : "x64";

if (!((platform === "darwin" && process.platform === "darwin" && process.arch === "arm64") ||
  (platform === "win32" && (process.platform === "darwin" || process.platform === "win32")))) {
  throw new Error(`Desktop packaging supports macOS arm64 and Windows x64; got ${process.platform} ${process.arch} -> ${platform} ${arch}`);
}

await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await writeFile(path.join(stage, "package.json"), JSON.stringify({
  name: appPackage.name,
  version: appPackage.version,
  private: true,
  main: "main.cjs",
}, null, 2));
await cp(path.join(root, "desktop/main.cjs"), path.join(stage, "main.cjs"));

const built = path.join(root, "dist");
await cp(built, path.join(stage, "dist"), {
  recursive: true,
  filter: (source) => {
    const parts = path.relative(built, source).split(path.sep);
    if (parts.at(-1) === ".DS_Store") return false;
    if (parts[0] !== "games" || parts.length < 3) return true;
    return release[parts[1]] === parts[2];
  },
});

const packaged = await packager({
  dir: stage,
  out: path.join(output, "packaged"),
  name: "NaiClassicGames",
  platform,
  arch,
  electronVersion: electronPackage.version,
  asar: true,
  overwrite: true,
  appBundleId: "games.nai.classic.launcher",
  icon: path.join(root, "desktop", platform === "darwin" ? "icon.icns" : "icon.ico"),
  osxSign: platform === "darwin" ? { identity: "-", identityValidation: false } : false,
  osxNotarize: false,
  win32metadata: { CompanyName: "NaiClassicGames", FileDescription: "NaiClassicGames" },
});

if (platform === "darwin") {
  const appPath = path.join(packaged[0], "NaiClassicGames.app");
  // Re-seal the complete bundle so its executable and embedded frameworks share an identity.
  await run("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  await run("codesign", ["--verify", "--deep", "--strict", appPath]);
}

const archive = path.join(output, `NaiClassicGames-${platform === "darwin" ? "mac-arm64" : "win-x64"}.zip`);
await rm(archive, { force: true });
if (platform === "darwin") {
  await run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", packaged[0], archive]);
} else if (process.platform === "darwin") {
  await run("zip", ["-q", "-r", archive, path.basename(packaged[0])], { cwd: path.dirname(packaged[0]) });
} else {
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  await run("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -LiteralPath ${quote(packaged[0])} -DestinationPath ${quote(archive)} -Force`]);
}

console.log(`Desktop package: ${packaged[0]}`);
console.log(`ZIP archive: ${archive}`);
