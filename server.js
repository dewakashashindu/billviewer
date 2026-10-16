// ============================================================
// server.js — SmarterASP.NET (IIS httpPlatformHandler) entry point
// ------------------------------------------------------------
// SmarterASP/IIS assigns a DYNAMIC port via process.env.PORT
// (web.config maps PORT = %HTTP_PLATFORM_PORT%).
// Do NOT hardcode 3000 in production — 3000 is only a local fallback.
// ============================================================
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = process.env.PORT || 3000;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  }).listen(port, () => {
    console.log(`billviewer ready on port ${port}`);
  });
});
