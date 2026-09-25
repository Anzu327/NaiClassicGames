import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_IDS } from "./game-map.mjs";

const launcherRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, token, index, all) => {
  if (token.startsWith("--")) pairs.push([token.slice(2), all[index + 1]]);
  return pairs;
}, []));
const id = args.id;
const version = args.version;
if (!id || !GAME_IDS.includes(id) || !version) {
  console.error(`Usage: npm run activate:game -- --id <${GAME_IDS.join("|")}> --version <version>`);
  process.exit(1);
}

const release = join(launcherRoot, "public", "games", id, version, "index.html");
if (!existsSync(release)) {
  console.error(`Cannot activate unpublished snapshot: ${release}`);
  process.exit(1);
}

const releasesFile = join(launcherRoot, "src", "releases.json");
const releases = JSON.parse(readFileSync(releasesFile, "utf8"));
releases[id] = version;
writeFileSync(releasesFile, `${JSON.stringify(releases, null, 2)}\n`);
console.log(`Activated ${id}@${version}`);
