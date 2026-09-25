import releases from "./releases.json";

export type GameId = "pac-wa" | "naitris" | "naisnake" | "naippy-wa";

export interface GameCatalogEntry {
  id: GameId;
  displayName: string;
  logo: string;
  cover: string;
  tagline: string;
  description: string;
  genre: string;
  controls: string;
  bestScoreKey: string;
  accent: string;
  releaseVersion: string;
  launchPath: string;
}

const entry = (game: Omit<GameCatalogEntry, "releaseVersion" | "launchPath">): GameCatalogEntry => {
  const releaseVersion = releases[game.id];
  return {
    ...game,
    releaseVersion,
    launchPath: `./games/${game.id}/${releaseVersion}/index.html`,
  };
};

export const GAMES: readonly GameCatalogEntry[] = [
  entry({
    id: "pac-wa",
    displayName: "Pac-Wa",
    logo: "./branding/pac-wa-logo.png",
    cover: "./covers/pac-wa.png",
    tagline: "CHOMP THE MAZE. TURN THE TABLES.",
    description: "Guide Naiwa through a neon maze, clear every pellet, and power up to chase the ghosts.",
    genre: "MAZE ARCADE",
    controls: "ARROWS / WASD / SWIPE",
    bestScoreKey: "naiwa-high-score",
    accent: "#ffd83d",
  }),
  entry({
    id: "naitris",
    displayName: "Naitris",
    logo: "./branding/naitris-logo.png",
    cover: "./covers/naitris.png",
    tagline: "STACK. CLEAR. SHINE.",
    description: "Stack bright blocks beneath the midnight sky and clear lines before the board fills.",
    genre: "BLOCK PUZZLE",
    controls: "ARROWS / WASD / TOUCH",
    bestScoreKey: "naitris.best-score",
    accent: "#25d9ff",
  }),
  entry({
    id: "naisnake",
    displayName: "NaiSnake",
    logo: "./branding/naisnake-logo.png",
    cover: "./covers/naisnake.png",
    tagline: "GROW LONG. STAY HUNGRY.",
    description: "Eat apples, chase the milk, and grow as long as you can.",
    genre: "ARCADE SURVIVAL",
    controls: "ARROWS / WASD / SWIPE",
    bestScoreKey: "naisnake-best-score",
    accent: "#70f5c1",
  }),
  entry({
    id: "naippy-wa",
    displayName: "Naippy Wa",
    logo: "./branding/naippy-wa-logo.png",
    cover: "./covers/naippy-wa.png",
    tagline: "FIND YOUR RHYTHM. KEEP FLYING.",
    description: "Flap through a bright pixel countryside and slip between the watchful pillars.",
    genre: "FLYING ARCADE",
    controls: "SPACE / CLICK / TAP",
    bestScoreKey: "naiy-waa.best-score",
    accent: "#52e4f2",
  }),
] as const;
