import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createApp } from "./app";
import { countUsers, createUser, openDatabase } from "./db";
import { cleanupTemporaryFiles, ensureDirs } from "./storage";

// Optional local .env. Platforms like Render inject env vars directly and do not ship a .env file.
const envPath = path.resolve(".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envPath);
  } catch {
    /* ignore malformed local env files */
  }
}

ensureDirs();
cleanupTemporaryFiles();
const db = openDatabase();

const email = process.env.ADMIN_EMAIL?.trim();
const password = process.env.ADMIN_PASSWORD || "";
if (countUsers(db) === 0) {
  if (email && password.length >= 8) {
    createUser(db, { email, name: "Administrator", password, role: "admin" });
    console.log(JSON.stringify({ level: "info", message: "Created the initial administrator.", email }));
  } else {
    console.log(
      JSON.stringify({
        level: "info",
        message: "No users exist. Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) and restart to create an administrator.",
      }),
    );
  }
}

const app = createApp(db);
const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(JSON.stringify({ level: "info", message: `Document Studio API listening on ${port}` }));
});
