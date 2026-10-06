// Mirrors the backend's committed ts-rs bindings into src/lib/api/generated/.
//   node scripts/wire.mjs sync   copy bindings/ here, deleting files the backend no longer has
//   node scripts/wire.mjs check  byte-compare; list stale/missing/extra files and exit 1 on drift
// Backend dir: $DREAMFLY_BACKEND_DIR, default ../dream_fly_backend beside the main checkout. No bindings/ => exit 1.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Worktrees live under .claude/worktrees/, so the sibling is resolved from the main checkout (git's common dir).
const mainCheckout = dirname(
	execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim()
);
const backendDir = resolve(mainCheckout, process.env.DREAMFLY_BACKEND_DIR || '../dream_fly_backend');
const source = join(backendDir, 'bindings');
const target = join(root, 'src/lib/api/generated');

/** Relative posix paths of every file under dir (empty when dir is missing). */
function listFiles(dir) {
	if (!existsSync(dir)) return [];
	const out = [];
	const walk = (d) => {
		for (const name of readdirSync(d)) {
			const p = join(d, name);
			if (statSync(p).isDirectory()) walk(p);
			else out.push(relative(dir, p).split(sep).join('/'));
		}
	};
	walk(dir);
	return out.sort();
}

function sync(srcFiles, dstFiles) {
	for (const f of dstFiles) if (!srcFiles.includes(f)) rmSync(join(target, f));
	for (const f of srcFiles) {
		mkdirSync(dirname(join(target, f)), { recursive: true });
		writeFileSync(join(target, f), readFileSync(join(source, f)));
	}
	console.log(`wire: synced ${srcFiles.length} files from ${source}`);
}

function check(srcFiles, dstFiles) {
	const problems = [];
	for (const f of srcFiles) {
		if (!dstFiles.includes(f)) problems.push(`missing  ${f}`);
		else if (!readFileSync(join(source, f)).equals(readFileSync(join(target, f)))) problems.push(`stale    ${f}`);
	}
	for (const f of dstFiles) if (!srcFiles.includes(f)) problems.push(`extra    ${f}`);
	if (problems.length === 0) return console.log(`wire: ${srcFiles.length} files up to date`);
	console.error(`wire: generated/ is out of date with ${source}\n${problems.map((p) => `  ${p}`).join('\n')}`);
	console.error('wire: run `npm run wire:sync`');
	process.exit(1);
}

const mode = process.argv[2];
if (mode !== 'sync' && mode !== 'check') {
	console.error('usage: node scripts/wire.mjs <sync|check>');
	process.exit(2);
}
if (!existsSync(source)) {
	console.error(`wire: no bindings/ at ${source}; set DREAMFLY_BACKEND_DIR to the backend checkout`);
	process.exit(1);
}
const srcFiles = listFiles(source);
const dstFiles = listFiles(target);
(mode === 'sync' ? sync : check)(srcFiles, dstFiles);
