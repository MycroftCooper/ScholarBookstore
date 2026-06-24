import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

const root = path.resolve(import.meta.dirname, "..");
const decoder = new TextDecoder("utf-8", { fatal: true });

const excludedDirs = new Set([
  ".git",
  ".next",
  ".codex-runtime",
  ".gocache",
  ".gomodcache",
  "node_modules",
  "uploads",
]);

const includedExtensions = new Set([
  ".css",
  ".env",
  ".example",
  ".go",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".sql",
  ".ts",
  ".tsx",
]);

const mojibakeCodepoints = [
  0x7f01,
  0x7487,
  0x8930,
  0x9286,
  0x93c2,
  0x93c8,
  0x93c9,
  0x9418,
  0x9422,
  0x95ab,
  0x935a,
  0x6fb6,
  0x6d93,
  0x6d63,
  0x951b,
];

const mojibakeChars = mojibakeCodepoints.map((value) =>
  String.fromCodePoint(value),
);

const mojibakeFragmentCodepoints = [
  [0x93b4, 0x6220],
  [0x7487, 0x52ee],
  [0x93c2, 0x56e9],
  [0x9354, 0x72ba],
  [0x7ecb, 0x5d85],
  [0x9417, 0x581d],
  [0x68f0, 0x55d7],
  [0x93ba, 0x30e5],
  [0x7481, 0x3088],
  [0x935d, 0x5d85],
  [0x6d93, 0x5d85],
  [0x6fb6, 0x8fab],
  [0x5bee, 0x20ac],
  [0x9286, 0x3f],
  [0x951b, 0x3f],
  [0x923e, 0x3f],
];

const mojibakeFragments = mojibakeFragmentCodepoints.map((fragment) =>
  String.fromCodePoint(...fragment),
);

function shouldScan(filePath) {
  const ext = path.extname(filePath);
  const name = path.basename(filePath);
  return includedExtensions.has(ext) || name.includes(".env");
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (excludedDirs.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile() && shouldScan(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r\n|\r|\n/).length;
}

function findTextIssues(text) {
  const issues = [];
  if (text.includes("\uFFFD")) {
    issues.push({ reason: "replacement character", index: text.indexOf("\uFFFD") });
  }
  for (const char of mojibakeChars) {
    const index = text.indexOf(char);
    if (index !== -1) {
      issues.push({
        reason: `mojibake codepoint U+${char.codePointAt(0).toString(16).toUpperCase()}`,
        index,
      });
      break;
    }
  }
  for (const fragment of mojibakeFragments) {
    const index = text.indexOf(fragment);
    if (index !== -1) {
      issues.push({ reason: `mojibake fragment ${JSON.stringify(fragment)}`, index });
      break;
    }
  }
  return issues;
}

const hits = [];
const files = await listFiles(root);

for (const file of files) {
  const bytes = await readFile(file);
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    hits.push({
      file,
      line: 1,
      reason: "file is not valid UTF-8",
    });
    continue;
  }

  for (const issue of findTextIssues(text)) {
    hits.push({
      file,
      line: lineOf(text, issue.index),
      reason: issue.reason,
    });
  }
}

if (hits.length > 0) {
  for (const hit of hits) {
    const rel = path.relative(root, hit.file);
    console.error(`${rel}:${hit.line} ${hit.reason}`);
  }
  process.exitCode = 1;
} else {
  console.log("Encoding check passed.");
}
