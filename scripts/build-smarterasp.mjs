#!/usr/bin/env node
// ============================================================
// scripts/build-smarterasp.mjs
// Packages Next.js standalone build into ./deploy-smarterasp
// AND creates ./smarterasp-deploy.zip ready to upload & extract
// directly into SmarterASP.NET site root (e.g. www\site1\).
// ============================================================
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const standaloneDir = path.join(rootDir, ".next", "standalone");
const staticDir = path.join(rootDir, ".next", "static");
const publicDir = path.join(rootDir, "public");
const outDir = path.join(rootDir, "deploy-smarterasp");
const zipOutPath = path.join(rootDir, "smarterasp-deploy.zip");

if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
  console.error(
    "❌ .next/standalone/server.js not found. Make sure next.config.ts has output: 'standalone' and run `npm run build` first."
  );
  process.exit(1);
}

console.log("📦 Preparing SmarterASP.NET standalone package in ./deploy-smarterasp ...");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 1. Copy standalone server + minimal node_modules + .next server output (dereference any symlinks)
fs.cpSync(standaloneDir, outDir, { recursive: true, dereference: true });

// 2. Copy .next/static -> deploy-smarterasp/.next/static
if (fs.existsSync(staticDir)) {
  fs.cpSync(staticDir, path.join(outDir, ".next", "static"), {
    recursive: true,
    dereference: true,
  });
}

// 3. Copy public -> deploy-smarterasp/public
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, path.join(outDir, "public"), {
    recursive: true,
    dereference: true,
  });
}

// 4. Copy IIS web.config + .env.example
for (const file of ["web.config", ".env.example"]) {
  const src = path.join(rootDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(outDir, file));
  }
}

// 5. Remove unused `sharp` image binaries (images.unoptimized = true) to keep zip small & OS-portable
for (const unused of ["@img", "sharp", "@emnapi"]) {
  fs.rmSync(path.join(outDir, "node_modules", unused), {
    recursive: true,
    force: true,
  });
}

// 6. Copy FULL pure-JS @swc/helpers (both cjs/ and esm/ + _/) so Node 20..25+ (`module-sync`) never miss a helper
const swcSrc = path.join(rootDir, "node_modules", "@swc", "helpers");
const swcDst = path.join(outDir, "node_modules", "@swc", "helpers");
if (fs.existsSync(swcSrc)) {
  fs.rmSync(swcDst, { recursive: true, force: true });
  fs.cpSync(swcSrc, swcDst, { recursive: true, dereference: true });
}

// 7. Enhance deploy-smarterasp/server.js:
//    - Strip build-machine absolute paths
//    - Ensure .env.production / .env.local / .env in site1/ are loaded before Next starts
//    - Keep Turbopack external hash fallback shim
const serverJsPath = path.join(outDir, "server.js");
let serverJs = fs.readFileSync(serverJsPath, "utf8");
serverJs = serverJs.replaceAll(JSON.stringify(rootDir), JSON.stringify("."));

const bootstrapPreamble = `// SmarterASP.NET IIS bootstrap (loads .env.production / .env.local & guards module resolution)
const Module = require('module');
const _origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  try {
    return _origResolve.call(this, request, parent, isMain, options);
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && typeof request === 'string') {
      const stripped = request.replace(/-[0-9a-f]{16}(\\/|$)/, '$1');
      if (stripped !== request) {
        return _origResolve.call(this, stripped, parent, isMain, options);
      }
    }
    throw err;
  }
};
try {
  const pathMod = require('path');
  process.chdir(__dirname);
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(pathMod.join(__dirname), false);
} catch (envErr) {
  console.warn('Warning: @next/env loadEnvConfig skipped:', envErr && envErr.message);
}
`;

serverJs = bootstrapPreamble + "\n" + serverJs;
fs.writeFileSync(serverJsPath, serverJs, "utf8");

// 8. Self-verification checks
const requiredFiles = [
  "server.js",
  "web.config",
  ".next/BUILD_ID",
  ".next/static",
  "public",
  "node_modules/next/package.json",
  "node_modules/mssql/package.json",
  "node_modules/@swc/helpers/package.json",
  "node_modules/@swc/helpers/_/_interop_require_default/package.json",
  "node_modules/@swc/helpers/cjs/_interop_require_default.cjs",
  "node_modules/@swc/helpers/esm/_interop_require_default.js",
];

for (const rel of requiredFiles) {
  const full = path.join(outDir, rel);
  if (!fs.existsSync(full)) {
    console.error(`❌ Verification failed — missing required artifact: ${rel}`);
    process.exit(1);
  }
}

let symlinkCount = 0;
let fileCount = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    const lstat = fs.lstatSync(p);
    if (lstat.isSymbolicLink()) {
      symlinkCount++;
      console.error(`❌ Unexpected symlink: ${p}`);
    } else if (lstat.isDirectory()) {
      walk(p);
    } else {
      fileCount++;
    }
  }
}
walk(outDir);

if (symlinkCount > 0) {
  process.exit(1);
}

console.log(
  `✅ SmarterASP standalone folder ready at ./deploy-smarterasp (${fileCount} files, 0 symlinks)`
);

// 9. Automatically create ./smarterasp-deploy.zip (works on Windows 10/11 + Linux + macOS)
fs.rmSync(zipOutPath, { force: true });
const topEntries = fs.readdirSync(outDir);
let zipped = false;

if (process.platform === "win32") {
  // Windows 10/11 built-in bsdtar creates standard ZIP with forward slashes and includes `.next`
  try {
    execFileSync("tar.exe", ["-a", "-c", "-f", zipOutPath, ...topEntries], {
      cwd: outDir,
      stdio: "inherit",
    });
    zipped = fs.existsSync(zipOutPath);
  } catch {
    // Fallback to .NET ZipFile on older Windows
    const psCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${outDir.replace(/'/g, "''")}', '${zipOutPath.replace(/'/g, "''")}', [System.IO.Compression.CompressionLevel]::Optimal, $false)`;
    execFileSync("powershell.exe", ["-NoProfile", "-Command", psCmd], {
      stdio: "inherit",
    });
    zipped = fs.existsSync(zipOutPath);
  }
} else {
  try {
    execFileSync("zip", ["-qr", "-9", zipOutPath, ...topEntries], {
      cwd: outDir,
      stdio: "inherit",
    });
    zipped = fs.existsSync(zipOutPath);
  } catch {
    execFileSync("tar", ["-a", "-c", "-f", zipOutPath, ...topEntries], {
      cwd: outDir,
      stdio: "inherit",
    });
    zipped = fs.existsSync(zipOutPath);
  }
}

if (zipped) {
  const sizeMb = (fs.statSync(zipOutPath).size / (1024 * 1024)).toFixed(2);
  console.log(`🎉 Created ready-to-upload ZIP: ./smarterasp-deploy.zip (${sizeMb} MB)`);
}
