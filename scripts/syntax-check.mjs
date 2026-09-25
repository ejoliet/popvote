#!/usr/bin/env node
// AIDEV-NOTE: extracts each inline <script> block from index.html and runs
// `node --check` on it, plus every scripts/*.mjs and test/*.mjs file.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

let failed = false;

function check(label, code, { module: isModule = false } = {}) {
  const args = isModule ? ['--input-type=module', '--check'] : ['--check'];
  try {
    execFileSync(process.execPath, args, { input: code, stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`OK   ${label}`);
  } catch (err) {
    failed = true;
    console.log(`FAIL ${label}`);
    console.error(err.stderr ? err.stderr.toString() : err.message);
  }
}

// inline <script>…</script> blocks from index.html (skip <script src=...>)
const html = readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const tmpDir = mkdtempSync(path.join(tmpdir(), 'popvote-syntax-'));
blocks.forEach((code, i) => {
  const file = path.join(tmpDir, `index-block-${i}.js`);
  writeFileSync(file, code);
  check(`index.html inline <script> #${i + 1}`, code);
});

// scripts/*.mjs and test/*.mjs
for (const dir of ['scripts', 'test']) {
  const files = globSync(path.join(repoRoot, dir, '*.mjs'));
  for (const file of files) {
    if (path.resolve(file) === path.resolve(fileURLToPath(import.meta.url))) continue;
    check(path.relative(repoRoot, file), readFileSync(file, 'utf8'), { module: true });
  }
}

process.exit(failed ? 1 : 0);
