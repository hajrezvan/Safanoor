import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const port = 3034;
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
  {
    cwd: new URL("../ui/", import.meta.url),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "pipe",
  },
);
let output = "";
server.stdout.on("data", (chunk) => {
  output = (output + chunk).slice(-4000);
});
server.stderr.on("data", (chunk) => {
  output = (output + chunk).slice(-4000);
});
try {
  let ready = false;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      ready = (await fetch(`http://localhost:${port}/auth/jwt/sign-in`)).ok;
      if (ready) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, `Production server failed to start: ${output}`);
  assert.equal(
    (await fetch(`http://localhost:${port}/dev/design`)).status,
    404,
  );
  assert.equal(
    (await fetch(`http://localhost:${port}/manifest.webmanifest`)).status,
    200,
  );
  console.log(
    "Production smoke passed: login, manifest and development-only design gate.",
  );
} finally {
  server.kill("SIGTERM");
}
