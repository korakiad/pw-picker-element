const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

/** @type {import('esbuild').BuildOptions} */
const opts = {
  entryPoints: ["src/cli.ts"],
  bundle: true,
  outfile: "dist/cli.js",
  external: ["playwright-core", "ws"],
  format: "cjs",
  platform: "node",
  target: "node22",
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
};

function copyFloatBall() {
  const src = path.join("src", "injected", "float-ball.js");
  const dest = path.join("dist", "injected", "float-ball.js");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

esbuild.build(opts).then(() => copyFloatBall());
