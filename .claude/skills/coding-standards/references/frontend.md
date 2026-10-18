# Frontend conventions (this repo)

SvelteKit 2 + Svelte 5 + TypeScript (strict). Talks to the Rust backend through per-surface `api.ts` seams (`$lib/api/client`). For *where* things live (surfaces, stores, the auth/cart/checkout wiring), read `docs/architecture.md`. This file is what you must *do* when you touch them.

## Tests: thin components, pure logic, co-located

- Extract pure logic out of `.svelte` into a sibling `.ts` so Vitest can test it without rendering (e.g. `checkout-math.ts`, `attendance-tally.ts`, `classes-filter.ts`). When you add logic to a component, pull the testable part into a `.ts` and unit-test it there.
- Test component behaviour with `@testing-library/svelte`.
- Co-locate tests as `*.test.ts` next to the unit (routes mirror this as `page.test.ts` / `layout.test.ts`). New behaviour ships with a test.

## Surfaces

- The root `src/routes/+layout.svelte` switches on `$page.url.pathname`: only the public/marketing site gets the shared `Header`/`Footer`; app surfaces bring their own chrome.
- Adding a new top-level app surface? Add its path prefix to the `isAppSurface` check in the root layout, or it inherits the marketing header/footer.

## State & persistence

- Server-backed shared stores go through the 水合閘門 / session 閘門 and pages enter them via 頁面進場包 — each single source is defined in its owner module's header (`hydration-gate.ts`, `session-gate.ts`) and `GLOSSARY.md` names it; build on them.
- One cart implementation: `createCart` in `lib/cart.ts`. The persisted app-wide `cart` is re-exported from `lib/member/stores.ts`; `mobile` takes its own non-persisted instance from the same factory. Extend that factory for any cart change.
- `localStorage` persistence (`authStore`, the app-wide `cart`) follows the SSR-guard → load → subscribe-write-back pattern. In tests, use the non-persisting factory (e.g. `createCart(persist=false)`) so tests never share `localStorage`.

## Domain invariants

- Treat ADR-decided behaviour as intentional, not a bug. Example: ADR-0001 makes course 報名 and pass 訂閱 independent — a pass never auto-covers course enrolment. Read the relevant `docs/adr/` entry before changing domain logic.
