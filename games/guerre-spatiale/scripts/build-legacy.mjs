import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const jsDir = path.join(rootDir, "js");

const order = [
  "constants.js",
  "bonusRegistry.js",
  "state.js",
  "audio.js",
  "render.js",
  "game.js",
  "input.js",
  "main.js",
];

function stripModuleSyntax(source) {
  const withoutImports = source.replace(/^\s*import\b[\s\S]*?;\s*$/gm, "");
  return withoutImports.replace(/^\s*export\s+/gm, "");
}

function normalizeLineEndings(source) {
  return source.replace(/\r\n?/g, "\n");
}

async function buildLegacyBundle() {
  const parts = [];

  for (const fileName of order) {
    const filePath = path.join(jsDir, fileName);
    const raw = await readFile(filePath, "utf8");
    const transformed = stripModuleSyntax(normalizeLineEndings(raw)).trim();
    parts.push(`// ---- ${fileName} ----\n${transformed}\n`);
  }

  const output = `(function () {\n"use strict";\n\n${parts.join("\n")}\n})();\n`;
  const outPath = path.join(jsDir, "main.legacy.js");
  await writeFile(outPath, output, "utf8");
  console.log(`Legacy bundle generated: ${path.relative(rootDir, outPath)}`);
}

buildLegacyBundle().catch((error) => {
  console.error("Legacy bundle generation failed:", error);
  process.exit(1);
});
