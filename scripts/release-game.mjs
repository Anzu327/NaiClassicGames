import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { GAME_IDS, GAME_SOURCES } from "./game-map.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const launcherRoot = resolve(scriptDir, "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, token, index, all) => {
  if (token.startsWith("--")) pairs.push([token.slice(2), all[index + 1]]);
  return pairs;
}, []));

const id = args.id;
const version = args.version;
if (!id || !GAME_IDS.includes(id) || !version || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(version)) {
  console.error(`Usage: npm run release:game -- --id <${GAME_IDS.join("|")}> --version <semver>`);
  process.exit(1);
}

const sourceRoot = resolve(launcherRoot, GAME_SOURCES[id]);
const dist = join(sourceRoot, "dist");
const target = join(launcherRoot, "public", "games", id, version);
if (existsSync(target)) {
  console.error(`Release already exists and is immutable: ${target}`);
  process.exit(1);
}

const build = spawnSync("npm", ["run", "build"], { cwd: sourceRoot, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);
if (!existsSync(join(dist, "index.html"))) {
  console.error(`Missing build entry: ${join(dist, "index.html")}`);
  process.exit(1);
}

const files = walk(dist);
const rootPathPattern = /(?:src|href)=["']\/(?!\/)|["']\/(?:assets|branding|backgrounds|generated|obstacles|runtime)\//;
for (const file of files.filter((path) => /\.(?:html|js|css)$/i.test(path))) {
  if (rootPathPattern.test(readFileSync(file, "utf8"))) {
    console.error(`Snapshot is not subpath-safe; root-relative asset found in ${file}`);
    process.exit(1);
  }
}

mkdirSync(dirname(target), { recursive: true });
cpSync(dist, target, { recursive: true, errorOnExist: true });
console.log(`Published ${id}@${version} to ${target}`);
console.log(`Activate it with: npm run activate:game -- --id ${id} --version ${version}`);

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
