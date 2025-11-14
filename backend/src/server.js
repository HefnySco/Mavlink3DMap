#!/usr/bin/env node
"use strict";

const path = require("path");
const express = require("express");
const fs = require("fs");

function startServer({ port = 8080, publicDir } = {}) {
  const app = express();
  const resolvedPublic = publicDir || path.resolve(__dirname, "../public");

  app.use(express.static(resolvedPublic));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // If a specific HTML file is requested and exists, serve it directly
  app.get(/.*\.html$/, (req, res, next) => {
    const requested = path.join(resolvedPublic, req.path);
    if (requested.startsWith(resolvedPublic) && fs.existsSync(requested)) {
      return res.sendFile(requested);
    }
    return next();
  });

  // SPA fallback: only for extensionless routes (e.g., /foo/bar)
  app.get(/^[^.?]*$/, (req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(resolvedPublic, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.listen(port, () => {
    console.log(`Mavlink3DMap web server listening on http://localhost:${port}`);
    console.log(`Serving static files from: ${resolvedPublic}`);
  });
}

if (require.main === module) {
  const port = parseInt(process.env.PORT || "8080", 10);
  startServer({ port });
}

module.exports = { startServer };
