import { spawnSync } from "node:child_process";
const commands = [
  ["npm", ["run", "typecheck:shared"]],
  ["npm", ["run", "test:shared"]],
  ["npm", ["--prefix", "api", "run", "typecheck"]],
  ["npm", ["--prefix", "api", "run", "lint"]],
  ["npm", ["--prefix", "api", "test"]],
  ["npm", ["--prefix", "api", "run", "test:e2e"]],
  ["corepack", ["yarn", "--cwd", "ui", "typecheck"]],
  ["corepack", ["yarn", "--cwd", "ui", "lint"]],
  ["npm", ["run", "test:ui"]],
  ["npm", ["run", "contract"]],
  ["corepack", ["yarn", "--cwd", "ui", "build"]],
  ["node", ["scripts/check-production.mjs"]],
];
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
