// @vitest-environment node
/* scripts/wire.mjs 行為測試：在暫存目錄建一個「前端 repo + worktree + 後端」的迷你版面，
 * 直接跑真的腳本，確認後端位置怎麼找、找不到時會失敗(ADR-0027 2026-10-06 增補)。 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' });

let base, front, worktree;

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), 'wire-test-'));
	front = join(base, 'dream_fly_frontend');
	mkdirSync(join(front, 'scripts'), { recursive: true });
	cpSync(new URL('./wire.mjs', import.meta.url), join(front, 'scripts/wire.mjs'));
	git(front, 'init', '-q');
	git(front, 'add', '-A');
	git(front, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init', '--no-verify');
	worktree = join(front, '.claude/worktrees/w');
	git(front, 'worktree', 'add', '-q', worktree);
});

afterEach(() => rmSync(base, { recursive: true, force: true }));

function bindings(dir, content = 'export type A = string;\n') {
	mkdirSync(join(dir, 'bindings'), { recursive: true });
	writeFileSync(join(dir, 'bindings/A.ts'), content);
}

function wire(checkout, mode, env = {}) {
	const { DREAMFLY_BACKEND_DIR: _, ...rest } = process.env;
	return spawnSync('node', [join(checkout, 'scripts/wire.mjs'), mode], {
		cwd: tmpdir(),
		env: { ...rest, ...env },
		encoding: 'utf8'
	});
}

const generated = (checkout) => readFileSync(join(checkout, 'src/lib/api/generated/A.ts'), 'utf8');

describe('wire.mjs', () => {
	it('worktree 內預設找 main checkout 隔壁的 dream_fly_backend', () => {
		bindings(join(base, 'dream_fly_backend'));
		expect(wire(worktree, 'sync').status).toBe(0);
		expect(generated(worktree)).toBe('export type A = string;\n');
		const check = wire(worktree, 'check');
		expect(check.status).toBe(0);
		expect(check.stdout).toContain('1 files up to date');
	});

	it('找不到 bindings/ 時 check 失敗(不再靜默跳過)', () => {
		const r = wire(worktree, 'check');
		expect(r.status).toBe(1);
		expect(r.stderr).toContain('no bindings/');
	});

	it('相對的 DREAMFLY_BACKEND_DIR 以執行中的 checkout 為基準，不是 main checkout', () => {
		bindings(join(worktree, 'fake-backend'), 'export type A = number;\n');
		expect(wire(worktree, 'sync', { DREAMFLY_BACKEND_DIR: 'fake-backend' }).status).toBe(0);
		expect(generated(worktree)).toBe('export type A = number;\n');
	});

	it('generated/ 和後端不一致時 check 列出 stale 並失敗', () => {
		bindings(join(base, 'dream_fly_backend'));
		wire(front, 'sync');
		bindings(join(base, 'dream_fly_backend'), 'export type A = boolean;\n');
		const r = wire(front, 'check');
		expect(r.status).toBe(1);
		expect(r.stderr).toContain('stale    A.ts');
	});
});
