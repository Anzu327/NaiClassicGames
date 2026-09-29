const { app, BrowserWindow, net, protocol, session } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const origin = "app://nai-classic";
const assetRoot = path.join(__dirname, "dist");
const isLocalUrl = (url) => url.protocol === "app:" && url.hostname === "nai-classic";

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function localAsset(request) {
  const url = new URL(request.url);
  if (!isLocalUrl(url)) return new Response("Not found", { status: 404 });

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (pathname.includes("\\") || pathname.includes("\0")) {
    return new Response("Bad request", { status: 400 });
  }

  const asset = path.resolve(assetRoot, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (!asset.startsWith(`${assetRoot}${path.sep}`)) {
    return new Response("Not found", { status: 404 });
  }

  return fs.stat(asset).then((stat) => {
    if (!stat.isFile()) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(asset).toString());
  }).catch(() => new Response("Not found", { status: 404 }));
}

function createWindow() {
  const window = new BrowserWindow({
    title: "NaiClassicGames",
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#031635",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.loadURL(`${origin}/index.html`);
}

app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, target) => {
    if (!isLocalUrl(new URL(target))) event.preventDefault();
  });
});

app.whenReady().then(() => {
  protocol.handle("app", localAsset);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(permission === "fullscreen" && isLocalUrl(new URL(contents.getURL())));
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
