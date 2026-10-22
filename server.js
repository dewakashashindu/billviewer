// ============================================================
// server.js — SmarterASP.NET (IIS httpPlatformHandler) entry point
// ------------------------------------------------------------
// SmarterASP/IIS assigns a DYNAMIC port via process.env.PORT
// (web.config maps PORT = %HTTP_PLATFORM_PORT%).
// Do NOT hardcode 3000 in production — 3000 is only a local fallback.
// ============================================================
const Module = require("module");
const { createServer } = require("http");

// Fallback for Windows/IIS (SmarterASP.NET) when ZIP/FTP strips Turbopack
// symlinks in .next/node_modules/ (e.g. "mssql-175261ed43fbf286" -> "mssql")
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (err) {
    if (err && err.code === "MODULE_NOT_FOUND" && typeof request === "string") {
      const stripped = request.replace(/-[0-9a-f]{16}(\/|$)/, "$1");
      if (stripped !== request) {
        return originalResolveFilename.call(this, stripped, parent, isMain, options);
      }
    }
    throw err;
  }
};

const next = require("next");

const port = process.env.PORT || 3000;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`billviewer ready on port ${port}`);
  });
});
