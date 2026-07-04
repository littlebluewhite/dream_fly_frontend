# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Coding standards live in the `coding-standards` skill** (`.claude/skills/coding-standards/`) — consult
> it before writing, changing, or reviewing code. It carries the general principles (Think Before Coding,
> Simplicity First, Surgical Changes, Goal-Driven) plus this repo's frontend conventions and a review
> checklist. This file is **orientation** (what the project is, how to run it); the **rules** for how to
> write code here are in the skill.

## What this is

Dream Fly (夢飛) — the frontend for a **gymnastics & competitive-cheer academy** (體操與競技啦啦學苑).
SvelteKit 2 + Svelte 5 (runes-era) + TypeScript (strict), Vite, Vitest + Testing Library. The backend is
the sibling repo **`dream_fly_backend`** (Rust/Axum + PostgreSQL + Redis), serving a REST API under
`/api/v1`. Auth, cart, checkout, and the member/admin/coach seams all call it for real now. Mock data
remains only in explicitly **P2-commented** spots where no backend endpoint exists yet (reports/analytics,
coach attendance/messages/student roster, member rewards redemption, member weekly schedule, the two
mobile surfaces, Google OAuth login) — see `docs/adr/0006` for the full inventory.

> `README.md` is a quick-start summary; `CONTEXT.md`, `docs/adr/`, and `docs/architecture.md` remain the
> authoritative deep references.

## Running the full stack

The frontend has no standalone mock mode anymore — start `dream_fly_backend` first:

```bash
# in the sibling dream_fly_backend/ checkout
docker-compose up -d      # Postgres + Redis; migrations auto-apply when the server starts
cargo run --bin seed      # idempotent dev seed (admin/member/coach accounts, courses, products, coupons…)
cargo run                 # serves http://localhost:3000/api/v1

# in this repo
npm install
npm run dev                # http://localhost:5173
```

`.env` (see `.env.example`): `VITE_API_BASE_URL`, defaults to `http://localhost:3000/api/v1` if unset.

## Commands

- `npm install` — **required on every fresh checkout/worktree**: `package-lock.json` is gitignored, so a
  clone has no deps until installed. (A missing `@lucide/svelte` at build time almost always means this
  step was skipped — a merge/branch carries no dependency fix.)
- `npm run dev` — Vite dev server at http://localhost:5173
- `npm run build` / `npm run preview` — production build / preview
- `npm run check` — `svelte-kit sync && svelte-check`. This is the type-check gate; **there is no ESLint
  or Prettier** in this repo, so `check` is the closest thing to a linter.
- `npm run test` — `vitest run` (jsdom env, setup in `src/vitest-setup.ts`). `npm run test:watch` to watch.
- Run one test file: `npx vitest run src/lib/checkout-gate.test.ts`
- Run tests by name: `npx vitest run -t "blocks open redirect"`

**Verification gate** for any change: `npm run check && npm run test`; add `npm run build` for anything
that touches routing or SSR.

## Architecture

Mapped in **`docs/architecture.md`** — read it before touching routing, layouts, surfaces, `src/lib`
stores, or the cart/checkout/auth flow. In one breath: seven UI **surfaces** split at the root layout
(public/marketing vs six app surfaces), `src/lib` organised per surface, and an auth/cart/checkout core
backed by the real `dream_fly_backend` API (Bearer tokens + a thin `localStorage` cache) where 報名
(course enrolment) and 訂閱 (pass subscription) are independent (ADR 0001).

## Domain docs (read before working in an area)

- **`CONTEXT.md`** — the domain glossary (報名 / 方案 / 訂閱 / 購物車 / 結帳 / 洽詢 / 候補, etc.). Use these
  exact terms in code, tests, and issue titles; don't drift to synonyms the glossary lists under *Avoid*.
- **`docs/adr/`** — architecture decisions. Read any ADR that touches your area; if your change
  contradicts one, surface it explicitly rather than silently overriding.
- **`docs/architecture.md`** — how the frontend is wired (surfaces, `src/lib` layout, auth/cart/checkout).
- **`docs/design/`** — the original JSX design prototypes (reference only; not shipped code).
- **`docs/agents/`** — `issue-tracker.md` (issues/PRDs are GitHub issues via the `gh` CLI),
  `triage-labels.md` (five canonical triage labels), `domain.md` (how to consume the domain docs above).
