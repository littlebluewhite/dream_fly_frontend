# Architecture

How Dream Fly's frontend is wired. Read this before touching routing, layouts, surfaces, `src/lib` stores, or the cart/checkout/auth flow. The *rules* for changing this code live in the `coding-standards` skill; this file is the *facts* — what exists and where it lives.

## Seven surfaces, separated at the root layout

`src/routes/+layout.svelte` is the hinge. It inspects `$page.url.pathname` and only wraps the **public /
marketing** site in the shared `Header`/`Footer`. The six "app" surfaces start with a path prefix and
bring their own chrome via a nested `+layout.svelte` (or a layout-resetting `+page@.svelte`, e.g. the
member login). `global.css` loads at the root for everyone, so design tokens / `.btn` / `.card` apply
everywhere regardless of surface.

| Surface | Routes | Chrome |
| --- | --- | --- |
| Public / marketing (guest) | `/`, `/courses`, `/coaches`, `/venues`, `/schedule`, `/tickets`, `/contact`, `/cart` | shared `Header`/`Footer` |
| Member centre | `/member/*` | nested layout |
| Admin back-office | `/admin/*` | nested layout |
| Coach work-portal | `/coach/*` | nested layout |
| Staff login + role switch | `/staff/login` | bare |
| Mobile (member) | `/mobile/*` | nested layout + overlay host |
| Mobile-admin (staff) | `/mobile-admin/*` (`admin` + `coach`) | nested layout + overlay host |

(Adding a new surface has a wiring rule — see the `coding-standards` skill → `references/frontend.md`.)

## `src/lib` is organized by surface, not by file type

Each surface owns a folder under `src/lib/` (`admin/`, `coach/`, `member/`, `mobile/`, `mobile-admin/`,
`staff/`) typically containing: `data.ts` (mock seed), `stores.ts` (Svelte stores), `nav.ts`, `format.ts`,
`api.ts` (mock API seam — see below), and a `components/` (or `overlays/`) subfolder. Cross-surface shared
code lives in: `lib/components/` (marketing/shared UI, plus the `ui/` and `mobile/` shelves below),
`lib/data/` (marketing seed + nav config), `lib/domain/` (single-source seed feeding several facades —
see below), `lib/stores/` (`authStore` is cross-cutting; the toast deep store `toasts.ts` /
`marketingToasts.ts` is cross-cutting too, via three adapters in `lib/components/toast/` per ADR 0005 —
`notificationsStore` alone stays public/marketing-only), `lib/styles/` (`global.css` + design tokens),
`lib/types/`, `lib/utils/`.

## `src/lib/domain/` — single source for the ops-pair and member-app facades

`src/lib/domain/` holds mock seed that used to be duplicated across surfaces: ops entities (`venues.ts`,
`tickets.ts`, `coaches.ts`, `activity.ts`, `reports.ts`) plus base arrays (`CLASSES_BASE`, `MEMBERS_BASE`,
`ORDERS_BASE` in `classes.ts` / `members.ts` / `orders.ts`) shared by the admin↔mobile-admin ops-pair, and
`member-app.ts` — the member↔mobile desktop/mobile twin seed (16 constants; `ANNOUNCE` stays forked in
each facade because one announcement's background colour differs between the two). Four facades consume
it — each of `admin`'s, `mobile-admin`'s, `member`'s, and `mobile`'s `data.ts` — mostly as verbatim
pass-through re-exports; where shapes diverge, the ops pair imports the `*_BASE` arrays and layers its
own derived fields on top via `.map` builders, while `member`/`mobile` re-export the same domain value
under an `as` assertion to their own stricter local type (same reference, no transformation); `coach`
has no persona mapping into the shared seed, so it doesn't consume `lib/domain/` at all. Because a facade
could silently drop a re-exported *type* without vitest noticing (type-only imports erase at transpile
time), the `facade-type-exports` convention (`src/lib/admin/facade-type-exports.test.ts`, mirrored inline
in `src/lib/mobile/data.test.ts`) binds each re-exported type to a live value so a dropped export fails
`npm run check` to compile, not just at runtime.

## Shared component shelves: `lib/components/ui` and `lib/components/mobile`

`lib/components/ui/` is the cross-surface primitive shelf (`Button`, `Card`, `Input`, `Dialog`, … barrelled
through `index.ts`) plus four async three-state components hoisted off the member pilot — `Skeleton`,
`SkelCard`, `ErrorState`, `EmptyState` — consumed by mock-API-seam pages across every surface for their
loading/error states; the shimmer animation `Skeleton` uses (`df-shimmer`) is now a `@keyframes` in
`global.css` instead of a per-component style block. `lib/components/mobile/` is the parallel shelf for
the two mobile surfaces — `Sheet`, `TabBar`, `ScreenHeader`, plus smaller pieces (`HeaderIcon`, `NoteBox`,
`SectionTitle`, …) — consumed directly by both `mobile` and `mobile-admin`'s pages/overlays; each surface
still wraps the shared `TabBar` in its own thin local component to attach its own tab items.

## Auth / cart / checkout — the domain core (read `docs/adr/0001` first)

Where the pieces live (the *rules* for changing them are in the `coding-standards` skill):

- **auth-at-checkout**: guests browse and fill the cart freely; login is required **only** at 結帳
  (checkout). Session lives in `lib/stores/authStore.ts` (mock, persisted to `localStorage` key
  `dreamfly_auth`).
- **One persistent cart** spanning guest → login → checkout: `lib/member/stores.ts` exports the single
  app-wide `cart = createCart(true)` (persisted to `dreamfly_cart_v2`). The `createCart(persist=false)`
  factory exists so tests get an isolated, non-persisting cart.
- **Routing contract is single-sourced** in `lib/checkout-gate.ts`: `checkoutTarget()`, `wantsCheckout()`,
  and `safeRedirect()` (open-redirect guard — only same-origin root-relative `?redirect=` targets allowed).
- **Course vs Pass**: a `type: 'course'` line checks out as 報名 (enrolment; mock, awards points only —
  does **not** write to schedule); a `type: 'pass'` line as 訂閱 (entitlement, persisted to
  `dreamfly_subscriptions`). Per ADR 0001 the two are independent.
- **Waitlist guard:** a full course (`spots: 0`) is blocked from the paid cart and routed to 候補
  (waitlist) — see the `AddResult = 'added' | 'bumped' | 'waitlisted'` add path in member stores.
- **Staff role switch:** `lib/staff/roles.ts` maps admin↔coach and remembers the last role in
  `df_staff_last_role`.

Known, deferred caveat (ADR 0001): persisted stores read `localStorage` at module-init, which can cause a
hydration flicker on a hard reload of a logged-in SSR page. Intentional follow-up, not a regression.

## Mock API 接縫 (seam): every app surface has an `api.ts`

Every app surface except `public` and `staff` — `admin`, `coach`, `member`, `mobile`, `mobile-admin` — has
`src/lib/<surface>/api.ts`: async getters that wrap the surface's seed through one knob,
`reply = <T>(value: T) => Promise.resolve(value)`, so swapping in a real `fetch()` later touches only that
one file, never the call sites (full design: `docs/superpowers/specs/2026-06-21-mock-api-seam-design.md`).
Pages that used to import seed constants directly now do a legacy `onMount` + plain `let` three-phase gate
(`phase: 'loading' | 'error' | 'ready'`, no runes — deliberate, see the spec), rendering
`Skeleton`/`SkelCard` while loading and `ErrorState` on failure. Data that already lives in a store
(mobile's notification centre; mobile-admin's ops collections and messages) hydrates once behind a
`*Hydrated` guard (`notifsHydrated`, `opsHydrated`, `messagesHydrated`) with a page-level `load()` /
`refresh()` split so `ErrorState`'s retry always refetches, and pages track their own `alive` flag so a
response that resolves after unmount can't overwrite a shared store. Layout shells stay outside the seam
— a deliberate boundary, not an oversight: `admin`'s `Sidebar.svelte` / `Topbar.svelte` have no `data.ts`
or `api.ts` import at all (hardcoded nav config), while `coach`'s do import seed from `data.ts` — a
static `COACH` profile object, plus `NOTIFS` feeding the Topbar's unread-bell dropdown — but
synchronously, never through `api.ts` or the phase gate. `public` is excluded because
its pages may later move to a SvelteKit `+page.ts` load instead (SSR/SEO, out of scope here); `staff` is
excluded because it's pre-auth login/role-switch UI with no `data.ts` to seam.

## Testing

Vitest + `@testing-library/svelte` (jsdom, setup in `src/vitest-setup.ts`), with co-located `*.test.ts`.
The *convention* — extract pure logic into a sibling `.ts` so it's testable without rendering — is a
coding standard; see the `coding-standards` skill → `references/frontend.md`.

## Mobile surfaces use an overlay host, not nested routes

`/mobile` and `/mobile-admin` render most secondary views as sheets/screens via `OverlayHost.svelte` +
an `overlays/` folder, rather than as additional SvelteKit routes. New mobile views usually mean a new
overlay component + a store entry, not a new route.
