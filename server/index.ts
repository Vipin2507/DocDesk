import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createApp } from "./app";
import { countUsers, createUser, openDatabase } from "./db";
import { cleanupTemporaryFiles, ensureDirs } from "./storage";
import { seedMasters } from "./seeds/masters";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  try {
    process.loadEnvFile?.(envPath);
  } catch {
    // Ignore .env read errors; platform environment variables take precedence
  }
}

ensureDirs();
cleanupTemporaryFiles();
const db = openDatabase();

const email = process.env.ADMIN_EMAIL?.trim() || "admin@buildesk.local";
const password = process.env.ADMIN_PASSWORD || "Buildesk123!";
if (countUsers(db) === 0) {
  if (email && password.length >= 8) {
    createUser(db, { email, name: "Administrator", password, role: "admin" });
    console.log(JSON.stringify({ level: "info", message: "Created the initial administrator.", email }));
  }
}

seedMasters(db);

const app = createApp(db);
const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8787);
const server = app.listen(port, host, () => {
  console.log(JSON.stringify({ level: "info", message: `Document Studio API listening on ${host}:${port}` }));
});

function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", message: `Received ${signal}, shutting down gracefully...` }));
  server.close(() => {
    try {
      db.close();
    } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
