import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const [pkg, ...args] = process.argv.slice(2);

if (!pkg) {
  console.error("usage: node scripts/bin.mjs <package> [args...]");
  process.exit(1);
}

const pkgJson = require(`${pkg}/package.json`);
const binField = pkgJson.bin;
const binRel =
  typeof binField === "string"
    ? binField
    : binField?.[pkg] ?? Object.values(binField ?? {})[0];

if (!binRel) {
  console.error(`Paket ${pkg} tidak punya bin.`);
  process.exit(1);
}

const pkgDir = path.dirname(require.resolve(`${pkg}/package.json`));
const binPath = path.resolve(pkgDir, binRel);

const child = spawn(process.execPath, [binPath, ...args], {
  stdio: "inherit",
  shell: false,
  env: process.env,
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
