import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";

mkdirSync("out", { recursive: true });

const runner = process.platform === "win32" ? "bun.exe" : "bun";
const children = [];
let shuttingDown = false;

function start(args) {
  const child = spawn(runner, ["x", ...args], { stdio: "inherit" });
  children.push(child);
  child.on("exit", (code) => {
    if (!shuttingDown && code !== 0) shutdown(code ?? 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

// Next owns hot reload on 3001; Pages Functions own /api on the public 3000 port.
start(["next", "dev", "--port", "3001"]);
start([
  "wrangler",
  "pages",
  "dev",
  "out",
  "--d1",
  "diapalace_db=diapalace-db-local",
  "--port",
  "3000",
  "--proxy",
  "3001",
]);
