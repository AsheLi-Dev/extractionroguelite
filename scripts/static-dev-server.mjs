import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_PORT = 3000;
const MAX_CONCURRENT_FILES = 32;

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".wav", "audio/wav"],
  [".mp3", "audio/mpeg"],
  [".txt", "text/plain; charset=utf-8"],
  [".tsx", "text/plain; charset=utf-8"],
  [".tmx", "application/xml; charset=utf-8"],
  [".tmj", "application/json; charset=utf-8"],
  [".ttf", "font/ttf"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

let activeFileReads = 0;
const waitQueue = [];

function parsePort(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--port" || arg === "-p" || arg === "-l") {
      const value = Number(argv[index + 1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
    if (arg.startsWith("--port=") || arg.startsWith("-p=") || arg.startsWith("-l=")) {
      const [, raw] = arg.split("=", 2);
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  const envPort = Number(process.env.PORT);
  return Number.isFinite(envPort) && envPort > 0 ? envPort : DEFAULT_PORT;
}

function getContentType(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

function normalizeRequestPath(urlPathname = "/") {
  const decodedPath = decodeURIComponent(urlPathname);
  const candidatePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const normalizedPath = path.posix.normalize(candidatePath);
  if (normalizedPath.startsWith("../") || normalizedPath.includes("/../")) {
    return null;
  }
  return normalizedPath.replace(/^\/+/, "");
}

async function withFileSlot(work) {
  if (activeFileReads >= MAX_CONCURRENT_FILES) {
    await new Promise((resolve) => waitQueue.push(resolve));
  }

  activeFileReads += 1;
  try {
    return await work();
  } finally {
    activeFileReads -= 1;
    const next = waitQueue.shift();
    if (next) next();
  }
}

async function resolveFilePath(requestUrl) {
  const normalized = normalizeRequestPath(requestUrl.pathname);
  if (!normalized) return null;

  let absolutePath = path.resolve(ROOT_DIR, normalized);
  if (!absolutePath.startsWith(ROOT_DIR)) return null;

  try {
    const stats = await fs.stat(absolutePath);
    if (stats.isDirectory()) {
      absolutePath = path.join(absolutePath, "index.html");
    }
  } catch (error) {
    if (error?.code === "ENOENT" && !path.extname(absolutePath)) {
      absolutePath = path.resolve(ROOT_DIR, normalized, "index.html");
    }
  }

  if (!absolutePath.startsWith(ROOT_DIR)) return null;
  return absolutePath;
}

async function sendFile(response, filePath) {
  try {
    const [stats, body] = await withFileSlot(async () => {
      const fileStats = await fs.stat(filePath);
      if (!fileStats.isFile()) {
        const error = new Error("Not a file");
        error.code = "ENOENT";
        throw error;
      }
      const fileBody = await fs.readFile(filePath);
      return [fileStats, fileBody];
    });

    response.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Content-Length": stats.size,
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    if (error?.code === "EMFILE") {
      response.writeHead(503, {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": "1",
      });
      response.end("Server temporarily busy");
      return;
    }

    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
  }
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const filePath = await resolveFilePath(requestUrl);
    if (!filePath) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }
    await sendFile(response, filePath);
  } catch (_error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
  }
});

server.on("clientError", (error, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  if (error?.code && error.code !== "ECONNRESET") {
    console.error("Client error:", error.code);
  }
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const port = parsePort(process.argv.slice(2));
server.listen(port, "127.0.0.1", () => {
  console.log(`Static dev server running at http://127.0.0.1:${port}`);
});
