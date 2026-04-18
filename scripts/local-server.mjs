import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const HOST = "127.0.0.1";
const PORT = 4173;
const PID_FILE = "/tmp/genericalgoid-local-server.pid";
const LOG_FILE = "/tmp/genericalgoid-local-server.log";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readPid() {
  try {
    const value = await fsp.readFile(PID_FILE, "utf8");
    const pid = Number.parseInt(value, 10);
    return Number.isInteger(pid) ? pid : null;
  } catch {
    return null;
  }
}

async function writePid(pid) {
  await fsp.writeFile(PID_FILE, `${pid}\n`, "utf8");
}

async function removePid() {
  await fsp.rm(PID_FILE, { force: true });
}

function contentTypeFor(filename) {
  return MIME_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
}

function resolveRequestPath(rawUrl) {
  const url = new URL(rawUrl, `http://${HOST}:${PORT}`);
  let requestPath = decodeURIComponent(url.pathname);
  if (requestPath === "/") {
    requestPath = "/index.html";
  }
  const absolutePath = path.resolve(projectRoot, `.${requestPath}`);
  if (!absolutePath.startsWith(projectRoot)) {
    return null;
  }
  return absolutePath;
}

async function serveFile(filePath, response) {
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  if (stat.isDirectory()) {
    return serveFile(path.join(filePath, "index.html"), response);
  }

  response.writeHead(200, {
    "Content-Type": contentTypeFor(filePath),
    "Content-Length": stat.size,
    "Cache-Control": "no-cache"
  });

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Failed to read file");
  });
  stream.pipe(response);
}

async function runServer() {
  const server = http.createServer(async (request, response) => {
    const filePath = resolveRequestPath(request.url ?? "/");
    if (!filePath) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }
    await serveFile(filePath, response);
  });

  server.on("error", async (error) => {
    console.error(`[local-server] ${error.message}`);
    if (error.code === "EADDRINUSE") {
      const pid = await readPid();
      if (pid && !isProcessAlive(pid)) {
        await removePid();
      }
    }
    process.exit(1);
  });

  server.listen(PORT, HOST, async () => {
    await writePid(process.pid);
    console.log(`[local-server] running on http://${HOST}:${PORT}/`);
  });

  const shutdown = async () => {
    server.close(() => {
      removePid().finally(() => process.exit(0));
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function startServer() {
  const existingPid = await readPid();
  if (existingPid && isProcessAlive(existingPid)) {
    console.log(`[local-server] already running on http://${HOST}:${PORT}/ (pid ${existingPid})`);
    return;
  }

  if (existingPid) {
    await removePid();
  }

  const logFd = fs.openSync(LOG_FILE, "a");
  const child = spawn(process.execPath, [__filename, "serve"], {
    cwd: projectRoot,
    detached: true,
    stdio: ["ignore", logFd, logFd]
  });
  child.unref();

  await writePid(child.pid);
  console.log(`[local-server] started http://${HOST}:${PORT}/ (pid ${child.pid})`);
  console.log(`[local-server] log: ${LOG_FILE}`);
}

async function stopServer() {
  const pid = await readPid();
  if (!pid) {
    console.log("[local-server] not running");
    return;
  }

  if (!isProcessAlive(pid)) {
    await removePid();
    console.log("[local-server] stale pid file removed");
    return;
  }

  process.kill(pid, "SIGTERM");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isProcessAlive(pid)) {
      await removePid();
      console.log(`[local-server] stopped pid ${pid}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  process.kill(pid, "SIGKILL");
  await removePid();
  console.log(`[local-server] force-stopped pid ${pid}`);
}

async function showStatus() {
  const pid = await readPid();
  if (pid && isProcessAlive(pid)) {
    console.log(`[local-server] running on http://${HOST}:${PORT}/ (pid ${pid})`);
    return;
  }
  if (pid) {
    await removePid();
  }
  console.log("[local-server] not running");
}

async function restartServer() {
  await stopServer();
  await startServer();
}

const command = process.argv[2] ?? "start";

if (command === "serve") {
  await runServer();
} else if (command === "start") {
  await startServer();
} else if (command === "stop") {
  await stopServer();
} else if (command === "status") {
  await showStatus();
} else if (command === "restart") {
  await restartServer();
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
