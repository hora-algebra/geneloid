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
const MONITOR_PID_FILE = "/tmp/genericalgoid-local-server-monitor.pid";
const SERVER_PID_FILE = "/tmp/genericalgoid-local-server.pid";
const LOG_FILE = "/tmp/genericalgoid-local-server.log";
const START_TIMEOUT_MS = 5000;
const STOP_TIMEOUT_MS = 4000;
const RESTART_DELAY_MS = 750;

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

function timestamp() {
  return new Date().toISOString();
}

function logLine(message) {
  return `[${timestamp()}] ${message}\n`;
}

async function appendLog(message) {
  await fsp.appendFile(LOG_FILE, logLine(message), "utf8");
}

function appendLogSync(message) {
  fs.appendFileSync(LOG_FILE, logLine(message), "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function readPid(filePath) {
  try {
    const value = await fsp.readFile(filePath, "utf8");
    const pid = Number.parseInt(value, 10);
    return Number.isInteger(pid) ? pid : null;
  } catch {
    return null;
  }
}

async function writePid(filePath, pid) {
  await fsp.writeFile(filePath, `${pid}\n`, "utf8");
}

async function removePid(filePath) {
  await fsp.rm(filePath, { force: true });
}

function removePidSync(filePath) {
  fs.rmSync(filePath, { force: true });
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

async function waitForProcessExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return true;
    }
    await sleep(100);
  }
  return !isProcessAlive(pid);
}

async function waitForServerReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await new Promise((resolve, reject) => {
        const request = http.request(
          {
            host: HOST,
            port: PORT,
            path: "/",
            method: "HEAD",
            timeout: 500
          },
          (response) => {
            response.resume();
            response.on("end", resolve);
          }
        );
        request.on("timeout", () => {
          request.destroy(new Error("timeout"));
        });
        request.on("error", reject);
        request.end();
      });
      return true;
    } catch {
      await sleep(100);
    }
  }
  return false;
}

async function readLogTail(maxLines = 40) {
  try {
    const raw = await fsp.readFile(LOG_FILE, "utf8");
    return raw.trim().split("\n").slice(-maxLines).join("\n");
  } catch {
    return "";
  }
}

function installCrashLogging(role, cleanup = null) {
  process.on("uncaughtException", async (error) => {
    try {
      await appendLog(`[${role}] uncaughtException: ${error?.stack ?? error}`);
    } finally {
      try {
        cleanup?.();
      } finally {
        process.exit(1);
      }
    }
  });

  process.on("unhandledRejection", async (reason) => {
    try {
      await appendLog(`[${role}] unhandledRejection: ${reason?.stack ?? reason}`);
    } finally {
      try {
        cleanup?.();
      } finally {
        process.exit(1);
      }
    }
  });
}

async function runServer() {
  let shuttingDown = false;
  const server = http.createServer(async (request, response) => {
    const filePath = resolveRequestPath(request.url ?? "/");
    if (!filePath) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }
    await serveFile(filePath, response);
  });

  const cleanup = () => {
    removePidSync(SERVER_PID_FILE);
  };
  installCrashLogging("server", cleanup);

  server.on("error", async (error) => {
    await appendLog(`[server ${process.pid}] error: ${error.message}`);
    if (error.code === "EADDRINUSE") {
      const existingPid = await readPid(SERVER_PID_FILE);
      if (existingPid && !isProcessAlive(existingPid)) {
        await removePid(SERVER_PID_FILE);
      }
    }
    cleanup();
    process.exit(1);
  });

  server.listen(PORT, HOST, async () => {
    await writePid(SERVER_PID_FILE, process.pid);
    await appendLog(`[server ${process.pid}] listening on http://${HOST}:${PORT}/`);
  });

  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    await appendLog(`[server ${process.pid}] shutdown via ${signal}`);
    server.close(() => {
      cleanup();
      process.exit(0);
    });
    setTimeout(() => {
      cleanup();
      process.exit(0);
    }, 1000).unref();
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGHUP", () => {
    void shutdown("SIGHUP");
  });
}

async function runMonitor() {
  let stopping = false;
  let child = null;

  const cleanup = () => {
    removePidSync(MONITOR_PID_FILE);
  };
  installCrashLogging("monitor", cleanup);

  const shutdown = async (signal) => {
    if (stopping) {
      return;
    }
    stopping = true;
    await appendLog(`[monitor ${process.pid}] shutdown via ${signal}`);
    const activeChild = child;
    cleanup();
    if (activeChild?.pid && isProcessAlive(activeChild.pid)) {
      activeChild.kill("SIGTERM");
      const exited = await waitForProcessExit(activeChild.pid, STOP_TIMEOUT_MS);
      if (!exited && isProcessAlive(activeChild.pid)) {
        activeChild.kill("SIGKILL");
        await waitForProcessExit(activeChild.pid, 1000);
      }
    }
    await removePid(SERVER_PID_FILE);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGHUP", () => {
    void shutdown("SIGHUP");
  });

  const spawnChild = async () => {
    if (stopping) {
      return;
    }
    const logFd = fs.openSync(LOG_FILE, "a");
    const spawned = spawn(process.execPath, [__filename, "serve"], {
      cwd: projectRoot,
      stdio: ["ignore", logFd, logFd]
    });
    child = spawned;
    await appendLog(`[monitor ${process.pid}] spawned server pid ${spawned.pid}`);

    spawned.on("exit", async (code, signal) => {
      const exitedPid = spawned.pid;
      if (child === spawned) {
        child = null;
      }
      const trackedPid = await readPid(SERVER_PID_FILE);
      if (trackedPid === exitedPid) {
        await removePid(SERVER_PID_FILE);
      }
      await appendLog(
        `[monitor ${process.pid}] server pid ${exitedPid} exited code=${code ?? "null"} signal=${signal ?? "null"}`
      );
      if (!stopping) {
        await sleep(RESTART_DELAY_MS);
        await spawnChild();
      }
    });

    spawned.on("error", async (error) => {
      await appendLog(`[monitor ${process.pid}] failed to spawn server: ${error.message}`);
    });
  };

  await writePid(MONITOR_PID_FILE, process.pid);
  await appendLog(`[monitor ${process.pid}] supervisor started`);
  await spawnChild();
}

async function startServer() {
  const existingMonitorPid = await readPid(MONITOR_PID_FILE);
  if (existingMonitorPid && isProcessAlive(existingMonitorPid)) {
    const ready = await waitForServerReady(1500);
    if (ready) {
      console.log(`[local-server] already running on http://${HOST}:${PORT}/ (monitor ${existingMonitorPid})`);
      return;
    }
    console.log(`[local-server] monitor ${existingMonitorPid} is alive but the server is not responding yet`);
  } else if (existingMonitorPid) {
    await removePid(MONITOR_PID_FILE);
  }

  const existingServerPid = await readPid(SERVER_PID_FILE);
  if (existingServerPid && !isProcessAlive(existingServerPid)) {
    await removePid(SERVER_PID_FILE);
  }

  const logFd = fs.openSync(LOG_FILE, "a");
  const child = spawn(process.execPath, [__filename, "monitor"], {
    cwd: projectRoot,
    detached: true,
    stdio: ["ignore", logFd, logFd]
  });
  child.unref();

  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const monitorPid = await readPid(MONITOR_PID_FILE);
    const serverPid = await readPid(SERVER_PID_FILE);
    const ready = await waitForServerReady(100);
    if (ready && monitorPid && isProcessAlive(monitorPid) && serverPid && isProcessAlive(serverPid)) {
      console.log(`[local-server] running on http://${HOST}:${PORT}/ (monitor ${monitorPid}, server ${serverPid})`);
      console.log(`[local-server] log: ${LOG_FILE}`);
      return;
    }
    if (!isProcessAlive(child.pid)) {
      break;
    }
    await sleep(100);
  }

  const tail = await readLogTail();
  console.error("[local-server] failed to start");
  if (tail) {
    console.error(tail);
  }
  process.exit(1);
}

async function stopServer() {
  const monitorPid = await readPid(MONITOR_PID_FILE);
  const serverPid = await readPid(SERVER_PID_FILE);

  if (!monitorPid && !serverPid) {
    console.log("[local-server] not running");
    return;
  }

  if (monitorPid && isProcessAlive(monitorPid)) {
    process.kill(monitorPid, "SIGTERM");
    const stopped = await waitForProcessExit(monitorPid, STOP_TIMEOUT_MS);
    if (!stopped && isProcessAlive(monitorPid)) {
      process.kill(monitorPid, "SIGKILL");
      await waitForProcessExit(monitorPid, 1000);
    }
  } else if (monitorPid) {
    await removePid(MONITOR_PID_FILE);
  }

  const latestServerPid = serverPid ?? (await readPid(SERVER_PID_FILE));
  if (latestServerPid && isProcessAlive(latestServerPid)) {
    process.kill(latestServerPid, "SIGTERM");
    const stopped = await waitForProcessExit(latestServerPid, STOP_TIMEOUT_MS);
    if (!stopped && isProcessAlive(latestServerPid)) {
      process.kill(latestServerPid, "SIGKILL");
      await waitForProcessExit(latestServerPid, 1000);
    }
  }

  await removePid(MONITOR_PID_FILE);
  await removePid(SERVER_PID_FILE);
  console.log("[local-server] stopped");
}

async function showStatus() {
  const monitorPid = await readPid(MONITOR_PID_FILE);
  const serverPid = await readPid(SERVER_PID_FILE);
  const monitorAlive = monitorPid && isProcessAlive(monitorPid);
  const serverAlive = serverPid && isProcessAlive(serverPid);
  const ready = await waitForServerReady(250);

  if (monitorPid && !monitorAlive) {
    await removePid(MONITOR_PID_FILE);
  }
  if (serverPid && !serverAlive) {
    await removePid(SERVER_PID_FILE);
  }

  if (monitorAlive || serverAlive || ready) {
    const monitorPart = monitorAlive ? `monitor ${monitorPid}` : "monitor down";
    const serverPart = serverAlive ? `server ${serverPid}` : ready ? "server responding" : "server down";
    const status = ready ? "healthy" : "degraded";
    console.log(`[local-server] ${status}: http://${HOST}:${PORT}/ (${monitorPart}, ${serverPart})`);
    return;
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
} else if (command === "monitor") {
  await runMonitor();
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
