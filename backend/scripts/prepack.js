#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../");
const frontendDir = path.join(repoRoot, "frontend");
const backendDir = path.join(repoRoot, "backend");
const publicDir = path.join(backendDir, "public");

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function main() {
  console.log("[prepack] Building frontend...");
  const res = spawnSync("npm", ["run", "build", "-w", "frontend"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) {
    console.error("[prepack] Frontend build failed");
    process.exit(res.status || 1);
  }

  const distDir = path.join(frontendDir, "dist");
  if (!fs.existsSync(distDir)) {
    console.error("[prepack] Frontend dist not found:", distDir);
    process.exit(1);
  }

  console.log("[prepack] Copying frontend dist into backend/public...");
  if (fs.existsSync(publicDir)) {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
  copyDir(distDir, publicDir);

  console.log("[prepack] Done.");
}

main();
