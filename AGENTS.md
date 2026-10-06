# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Coding standards live in the `coding-standards` skill** (`.claude/skills/coding-standards/`, local
> and git-ignored) — read it before writing, changing, or reviewing code. This file is **orientation**
> (what the project is, how to run it); the skill holds the **rules**.

## What this is

Dream Fly (夢飛) — the frontend for a **gymnastics & competitive-cheer academy** (體操與競技啦啦學苑).
SvelteKit 2 + Svelte 5 (runes-era) + TypeScript (strict), Vite, Vitest + Testing Library. The backend is
the sibling repo **`dream_fly_backend`** (Rust/Axum + PostgreSQL + Redis), serving a REST API under
`/api/v1`. Every surface calls it for real.

Mock data lives only in a handful of **P2-commented** spots where no backend endpoint exists, session
management is out of scope, or the gap is purely cosmetic — treat them as known gaps, not bugs: the
mobile-admin identity chip, its page-1-only list fetches, its read-only venue screen and demo ticket-edit
toast (the admin desktop equivalents are wired), the admin settings page's local-only login-device list,
and the shell badges that have no backend feed (coach Topbar's `NOTIFS` bell, the hardcoded `badge: 3` on
coach's 訊息中心 nav item, admin Topbar's 「目前有 3 則新通知」 toast, mobile-admin's
`ADMIN_NOTIFS`/`COACH_NOTIFS`). Fields the backend has no column for are left out, never faked
(`docs/adr/0023`, `docs/adr/0026`); `docs/adr/0006` holds the full inventory.

Google OAuth login exists for `member` and `mobile` only: the backend's Google flow grants just the
`member` role, so `staff` and `mobile-admin` have no Google option.

## Running the full stack

The frontend has no mock mode — start `dream_fly_backend` first:

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

Scripts are in `package.json`. What it doesn't tell you:

- `npm install` is **required on every fresh checkout**: `package-lock.json` is gitignored, so a
  clone has no deps until installed. A missing `@lucide/svelte` at build time means this step was skipped.
  In a worktree run `sh scripts/worktree-setup.sh` instead (a symlinked `node_modules` breaks vitest).
- `src/lib/api/generated/` is a byte-exact mirror of the backend's committed ts-rs `bindings/` (the wire types).
  Never edit it by hand: regenerate in the backend (`WIRE_BINDINGS=write cargo test --test wire_types`), then
  `npm run wire:sync`. `npm run check` first runs `wire:check` and fails on stale/missing/extra files; it resolves
  the sibling backend from the main checkout and fails when it has no `bindings/`. Override with `DREAMFLY_BACKEND_DIR`.
- `npm run check` (svelte-check) is the only lint: the repo has no ESLint or Prettier, so match the
  surrounding style by hand.
- Vitest runs in jsdom with setup in `src/vitest-setup.ts`.

**Verification gate** for any change: `npm run check && npm run test`, plus `npm run build` for anything
that touches routing or SSR. A change is done when the gate is green.

## Architecture

Mapped in **`docs/architecture.md`** — read it before touching routing, layouts, surfaces, `src/lib`
stores, or the cart/checkout/auth flow. In one breath: seven UI **surfaces** split at the root layout
(public/marketing vs six app surfaces), `src/lib` organised per surface, and an auth/cart/checkout core
backed by `dream_fly_backend` (Bearer tokens + a thin `localStorage` cache) where 報名 (course enrolment)
and 訂閱 (pass subscription) are independent (ADR 0001).

## Domain docs (read before working in an area)

- **`GLOSSARY.md`** — the domain glossary (報名 / 方案 / 訂閱 / 購物車 / 結帳 / 洽詢 / 候補, and the
  frontend's own terms: 本人帳號資料, 水合閘門, session 閘門, 暖機清單…). Use these exact terms in code,
  tests, and issue titles; each entry's *Avoid* line marks the wrong synonyms.
- **`docs/adr/`** — architecture decisions. Read any ADR that touches your area; if your change
  contradicts one, surface the conflict explicitly.
- **`docs/design/`** — the original JSX design prototypes (reference only; not shipped code).
- **`docs/agents/`** — `issue-tracker.md` (issues/PRDs are GitHub issues via the `gh` CLI),
  `triage-labels.md` (triage label names), `domain.md` (how skills consume the domain docs).
