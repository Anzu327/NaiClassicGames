import "./styles.css";
import { LauncherAudio } from "./audio";
import { GAMES, type GameCatalogEntry, type GameId } from "./gameCatalog";
import { ParticleField } from "./particles";

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
};

const introScreen = byId<HTMLElement>("intro-screen");
const introButton = byId<HTMLButtonElement>("intro-button");
const appShell = byId<HTMLDivElement>("app-shell");
const introParticleCanvas = byId<HTMLCanvasElement>("intro-particle-field");
const particleCanvas = byId<HTMLCanvasElement>("particle-field");
const stage = byId<HTMLDivElement>("card-stage");
const pagination = byId<HTMLDivElement>("pagination");
const previousButton = byId<HTMLButtonElement>("previous-button");
const nextButton = byId<HTMLButtonElement>("next-button");
const detailLogo = byId<HTMLImageElement>("detail-logo");
const activeGameName = byId<HTMLHeadingElement>("active-game-name");
const description = byId<HTMLParagraphElement>("description");
const genre = byId<HTMLElement>("genre");
const controls = byId<HTMLElement>("controls");
const bestScore = byId<HTMLElement>("best-score");
const gameCount = byId<HTMLElement>("game-count");
const selectionStatus = byId<HTMLElement>("selection-status");
const playButton = byId<HTMLButtonElement>("play-button");
const soundButton = byId<HTMLButtonElement>("sound-button");
const fullscreenButton = byId<HTMLButtonElement>("fullscreen-button");
const qrButton = byId<HTMLButtonElement>("qr-button");
const qrDialog = byId<HTMLDialogElement>("qr-dialog");
const qrCloseButton = byId<HTMLButtonElement>("qr-close-button");
const aboutButton = byId<HTMLButtonElement>("about-button");
const aboutDialog = byId<HTMLDialogElement>("about-dialog");
const aboutCloseButton = byId<HTMLButtonElement>("about-close-button");
const backgroundNaiwa = document.querySelector<HTMLElement>(".background-naiwa")!;
const overlay = byId<HTMLElement>("player-overlay");
const iframeHost = byId<HTMLDivElement>("iframe-host");
const loading = byId<HTMLElement>("player-loading");
const playerError = byId<HTMLElement>("player-error");
const playerLogo = byId<HTMLImageElement>("player-logo");
const backButton = byId<HTMLButtonElement>("back-button");
const retryButton = byId<HTMLButtonElement>("retry-button");
const errorBackButton = byId<HTMLButtonElement>("error-back-button");

const audio = new LauncherAudio();
const introParticles = new ParticleField(introParticleCanvas);
const backgroundParticles = new ParticleField(particleCanvas, false);
const cards: HTMLButtonElement[] = [];
const dots: HTMLButtonElement[] = [];
let activeIndex = initialIndex();
let dragStartX: number | undefined;
let dragOffset = 0;
let activePointer: number | undefined;
let iframeTimeout: number | undefined;
let playing = false;
let lastPlayFocus: HTMLElement = playButton;
let wheelLocked = false;
let introVisible = true;

function initialIndex(): number {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const requested = params.get("game") ?? localStorage.getItem("nai-classic-games.active-game");
  const index = GAMES.findIndex((game) => game.id === requested);
  return index >= 0 ? index : 0;
}

function activeGame(): GameCatalogEntry {
  return GAMES[activeIndex] ?? GAMES[0]!;
}

function createLibrary(): void {
  GAMES.forEach((game, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "game-card";
    card.dataset.gameId = game.id;
    card.setAttribute("aria-label", `Select ${game.displayName}`);
    card.innerHTML = `
      <span class="card-art"><img class="card-cover" src="${game.cover}" alt="" draggable="false" /></span>
      <span class="card-shade" aria-hidden="true"></span>
      <img class="card-logo" src="${game.logo}" alt="" draggable="false" />
      <span class="card-tagline">${game.tagline}</span>
    `;
    card.addEventListener("click", () => setActive(index));
    stage.append(card);
    cards.push(card);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "page-dot";
    dot.setAttribute("aria-label", `Select ${game.displayName}`);
    dot.addEventListener("click", () => setActive(index));
    pagination.append(dot);
    dots.push(dot);
  });
}

function setActive(index: number, options: { announce?: boolean; sound?: boolean } = {}): void {
  const clamped = Math.max(0, Math.min(GAMES.length - 1, index));
  if (clamped === activeIndex && options.announce !== false) return;
  const changed = clamped !== activeIndex;
  activeIndex = clamped;
  const game = activeGame();
  localStorage.setItem("nai-classic-games.active-game", game.id);
  history.replaceState({ game: game.id }, "", `#game=${game.id}`);
  if (changed && options.sound !== false) audio.playSelect();
  if (changed) audio.selectGame(game.id);
  updateDetails(options.announce !== false);
  layoutCards();
}

function updateDetails(announce: boolean): void {
  const game = activeGame();
  document.documentElement.style.setProperty("--active-accent", game.accent);
  detailLogo.src = game.logo;
  detailLogo.alt = game.displayName;
  detailLogo.dataset.gameId = game.id;
  activeGameName.textContent = game.displayName;
  description.textContent = game.description;
  genre.textContent = game.genre;
  controls.textContent = game.controls;
  bestScore.textContent = readScore(game).toString().padStart(6, "0");
  gameCount.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(GAMES.length).padStart(2, "0")}`;
  playButton.setAttribute("aria-label", `Play ${game.displayName}`);
  previousButton.disabled = false;
  nextButton.disabled = false;
  cards.forEach((card, index) => {
    const selected = index === activeIndex;
    card.classList.toggle("is-active", selected);
    card.setAttribute("aria-current", selected ? "true" : "false");
    card.tabIndex = selected ? 0 : -1;
  });
  dots.forEach((dot, index) => {
    const selected = index === activeIndex;
    dot.classList.toggle("is-active", selected);
    dot.setAttribute("aria-current", selected ? "true" : "false");
  });
  if (announce) selectionStatus.textContent = `${game.displayName}, game ${activeIndex + 1} of ${GAMES.length}`;
}

function readScore(game: GameCatalogEntry): number {
  const value = Number(localStorage.getItem(game.bestScoreKey) ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function layoutCards(offset = dragOffset): void {
  const width = stage.clientWidth;
  if (!width) return;
  const mobile = width < 700;
  const cardWidth = Math.min(width * (mobile ? 0.86 : 0.76), 760);
  const gap = cardWidth * (mobile ? 0.9 : 0.74);
  cards.forEach((card, index) => {
    let distance = index - activeIndex;
    const half = GAMES.length / 2;
    if (distance > half) distance -= GAMES.length;
    if (distance < -half) distance += GAMES.length;
    const scale = distance === 0 ? 1 : Math.max(0.64, 0.8 - Math.abs(distance) * 0.05);
    const x = distance * gap + offset;
    card.style.width = `${cardWidth}px`;
    card.style.zIndex = String(10 - Math.abs(distance));
    card.style.opacity = String(Math.abs(distance) > 2 ? 0 : distance === 0 ? 1 : 0.62);
    card.style.transform = `translate3d(calc(-50% + ${x}px), -50%, 0) scale(${scale}) rotateY(${distance * -3.5}deg)`;
    card.style.pointerEvents = Math.abs(distance) <= 1 ? "auto" : "none";
  });
  backgroundNaiwa.style.transform = `translate3d(${Math.max(-8, Math.min(8, -offset / 32))}px, 0, 0)`;
}

function changeBy(delta: number): void {
  const target = (activeIndex + delta + GAMES.length) % GAMES.length;
  setActive(target);
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  activePointer = event.pointerId;
  dragStartX = event.clientX;
  dragOffset = 0;
  stage.setPointerCapture(event.pointerId);
  stage.classList.add("is-dragging");
  void audio.ensureStarted();
}

function onPointerMove(event: PointerEvent): void {
  if (event.pointerId !== activePointer || dragStartX === undefined) return;
  dragOffset = event.clientX - dragStartX;
  layoutCards(dragOffset);
}

function onPointerEnd(event: PointerEvent): void {
  if (event.pointerId !== activePointer || dragStartX === undefined) return;
  const threshold = Math.min(92, stage.clientWidth * 0.12);
  if (Math.abs(dragOffset) >= threshold) changeBy(dragOffset < 0 ? 1 : -1);
  activePointer = undefined;
  dragStartX = undefined;
  dragOffset = 0;
  stage.classList.remove("is-dragging");
  layoutCards();
}

function launchGame(pushHistory = true): void {
  const game = activeGame();
  if (playing) return;
  playing = true;
  lastPlayFocus = document.activeElement instanceof HTMLElement ? document.activeElement : playButton;
  if (pushHistory) history.pushState({ play: game.id }, "", `#play=${game.id}`);
  overlay.hidden = false;
  document.body.classList.add("is-playing");
  playerLogo.src = game.logo;
  playerLogo.alt = game.displayName;
  loading.hidden = false;
  playerError.hidden = true;
  iframeHost.replaceChildren();
  audio.playConfirm();
  audio.fadeOut();

  const iframe = document.createElement("iframe");
  iframe.title = `${game.displayName} game`;
  iframe.allow = "autoplay; fullscreen";
  iframe.src = game.launchPath;
  iframe.addEventListener("load", () => {
    if (iframeTimeout) window.clearTimeout(iframeTimeout);
    loading.hidden = true;
    iframe.classList.add("is-ready");
    try {
      iframe.contentDocument?.addEventListener("keydown", (event) => {
        if (event.shiftKey && event.key === "Escape") closeGame();
      }, true);
      iframe.contentWindow?.focus();
    } catch { /* The committed snapshots are same-origin; the toolbar remains the fallback. */ }
  });
  iframe.addEventListener("error", showPlayerError);
  iframeHost.append(iframe);
  iframeTimeout = window.setTimeout(showPlayerError, 8_000);
}

function showPlayerError(): void {
  loading.hidden = true;
  playerError.hidden = false;
}

function closeGame(fromHistory = false): void {
  if (!playing) return;
  if (!fromHistory && history.state?.play) {
    history.back();
    return;
  }
  playing = false;
  if (iframeTimeout) window.clearTimeout(iframeTimeout);
  iframeHost.replaceChildren();
  overlay.hidden = true;
  document.body.classList.remove("is-playing");
  updateDetails(false);
  audio.playBack();
  audio.fadeIn();
  window.setTimeout(() => lastPlayFocus.focus(), 0);
}

function retryGame(): void {
  if (iframeTimeout) window.clearTimeout(iframeTimeout);
  playing = false;
  iframeHost.replaceChildren();
  launchGame(false);
}

function syncSoundButton(): void {
  soundButton.setAttribute("aria-pressed", String(audio.isMuted));
  soundButton.setAttribute("aria-label", audio.isMuted ? "Unmute launcher sound" : "Mute launcher sound");
  soundButton.classList.toggle("is-muted", audio.isMuted);
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

function openAbout(): void {
  if (aboutDialog.open) return;
  aboutDialog.showModal();
  document.body.classList.add("is-reading-about");
  audio.playSelect();
  aboutCloseButton.focus();
}

function closeAbout(): void {
  if (!aboutDialog.open) return;
  aboutDialog.close();
}

function enterLibrary(): void {
  if (!introVisible) return;
  introVisible = false;
  document.body.classList.remove("is-intro");
  introScreen.classList.add("is-leaving");
  introScreen.setAttribute("aria-hidden", "true");
  appShell.removeAttribute("aria-hidden");
  appShell.removeAttribute("inert");
  introParticles.stop();
  backgroundParticles.start();
  void audio.ensureStarted();
  audio.playConfirm();
  window.setTimeout(() => {
    introScreen.hidden = true;
    playButton.focus({ preventScroll: true });
  }, 420);
}

createLibrary();
audio.setTheme(activeGame().id);
updateDetails(false);
requestAnimationFrame(() => layoutCards());
syncSoundButton();

introButton.addEventListener("click", enterLibrary);
previousButton.addEventListener("click", () => changeBy(-1));
nextButton.addEventListener("click", () => changeBy(1));
stage.addEventListener("pointerdown", onPointerDown);
stage.addEventListener("pointermove", onPointerMove);
stage.addEventListener("pointerup", onPointerEnd);
stage.addEventListener("pointercancel", onPointerEnd);
stage.addEventListener("wheel", (event) => {
  if (wheelLocked || Math.abs(event.deltaY) + Math.abs(event.deltaX) < 14) return;
  event.preventDefault();
  wheelLocked = true;
  changeBy((event.deltaX || event.deltaY) > 0 ? 1 : -1);
  window.setTimeout(() => { wheelLocked = false; }, 450);
}, { passive: false });

playButton.addEventListener("click", () => launchGame());
backButton.addEventListener("click", () => closeGame());
errorBackButton.addEventListener("click", () => closeGame());
retryButton.addEventListener("click", retryGame);
soundButton.addEventListener("click", () => { void audio.ensureStarted(); audio.toggleMuted(); syncSoundButton(); });
fullscreenButton.addEventListener("click", toggleFullscreen);
qrButton.addEventListener("click", () => { qrDialog.showModal(); qrCloseButton.focus(); });
qrCloseButton.addEventListener("click", () => qrDialog.close());
qrDialog.addEventListener("click", (event) => { if (event.target === qrDialog) qrDialog.close(); });
qrDialog.addEventListener("close", () => qrButton.focus({ preventScroll: true }));
aboutButton.addEventListener("click", openAbout);
aboutCloseButton.addEventListener("click", closeAbout);
aboutDialog.addEventListener("click", (event) => {
  if (event.target === aboutDialog) closeAbout();
});
aboutDialog.addEventListener("cancel", () => closeAbout());
aboutDialog.addEventListener("close", () => {
  document.body.classList.remove("is-reading-about");
  requestAnimationFrame(() => aboutButton.focus({ preventScroll: true }));
});
window.addEventListener("resize", () => layoutCards());
window.addEventListener("popstate", () => {
  if (playing && !history.state?.play) closeGame(true);
  else if (!playing && history.state?.play) {
    const index = GAMES.findIndex((game) => game.id === history.state.play);
    if (index >= 0) { setActive(index, { announce: false, sound: false }); launchGame(false); }
  }
});

window.addEventListener("keydown", (event) => {
  if (introVisible) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      enterLibrary();
    }
    return;
  }
  if (playing) {
    if (event.shiftKey && event.key === "Escape") { event.preventDefault(); closeGame(); }
    return;
  }
  if (aboutDialog.open || qrDialog.open) return;
  if (event.key === "ArrowLeft") { event.preventDefault(); changeBy(-1); }
  else if (event.key === "ArrowRight") { event.preventDefault(); changeBy(1); }
  else if (event.key === "Enter" && document.activeElement === playButton) launchGame();
  else if (event.key.toLowerCase() === "m") { audio.toggleMuted(); syncSoundButton(); }
  else if (event.key.toLowerCase() === "f") toggleFullscreen();
});

const unlockAudio = (): void => { void audio.ensureStarted(); };
window.addEventListener("pointerdown", unlockAudio, { once: true, passive: true });
window.addEventListener("keydown", unlockAudio, { once: true });
document.addEventListener("visibilitychange", () => document.hidden ? audio.suspend() : audio.resume());
