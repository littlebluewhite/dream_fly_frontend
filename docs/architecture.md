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
`api.ts` (API seam — see below), and a `components/` (or `overlays/`) subfolder. `member/stores.ts` is the
one exception to the single-file pattern: it's a pure barrel re-exporting 8 concern modules that live
alongside it (`cart.ts`, `waitlist.ts`, `leave.ts`, `points.ts`, `subscriptions.ts`, `checkout-sync.ts`,
`notifications.ts`, `ui.ts`) — new store/function additions go in the owning module, never in the barrel
file itself. Cross-surface shared code lives in: `lib/components/` (marketing/shared UI, plus the `ui/`
and `mobile/` shelves below), `lib/data/` (marketing seed + nav config), `lib/domain/` (single-source
seed feeding several facades —
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
  (checkout). Session lives in `lib/stores/authStore.ts`, backed by the real `/auth/*` API: access token
  in memory only, refresh token in `localStorage` under `dreamfly_refresh` (`lib/api/tokens.ts`), rotated
  single-flight on 401 (see `docs/adr/0006`). The `dreamfly_auth` `localStorage` key still exists but is
  now only a first-paint cache of the member profile (so the UI doesn't flash "logged out" before
  `hydrate()` resolves) — the actual truth is whether the refresh token is still valid against the server.
- **One persistent cart** spanning guest → login → checkout: `lib/member/stores.ts` exports the single
  app-wide `cart = createCart(true)` (persisted to `dreamfly_cart_v3` — string uuid item ids deduped by
  `(type, id)`; no migration runs against the old `dreamfly_cart_v2` key, see `docs/adr/0006`). The
  `createCart(persist=false)` factory exists so tests get an isolated, non-persisting cart.
- **Routing contract is single-sourced** in `lib/checkout-gate.ts`: `checkoutTarget()`, `wantsCheckout()`,
  and `safeRedirect()` (open-redirect guard — only same-origin root-relative `?redirect=` targets allowed).
- **Course vs Pass**: checkout syncs the cart and `POST /orders`s it (`placeOrder()` in member stores); the
  backend creates both artifacts atomically in one transaction. A `type: 'course'` line becomes a real 報名
  (enrolment row); the member's weekly schedule is real too, hydrated from `GET /schedule/me`
  (`member/api.ts`'s `getSchedule()`, derived from the member's active enrolments, see `docs/adr/0006`);
  a `type: 'pass'` line becomes a real 訂閱 (entitlement), re-hydrated from
  `GET /subscriptions/me` after checkout rather than persisted verbatim — the old `dreamfly_subscriptions`
  `localStorage` key is gone. Per ADR 0001 the two remain independent products.
- **Waitlist guard:** a full course (`spots: 0`) is blocked from the paid cart and routed to 候補
  (waitlist) — see the `AddResult = 'added' | 'bumped' | 'waitlisted'` add path in member stores.
- **Staff role switch:** `lib/staff/roles.ts` maps admin↔coach and remembers the last role in
  `df_staff_last_role` — a local UI convenience, independent of the real role check at staff login.

Known, deferred caveat (ADR 0001): persisted stores read `localStorage` at module-init, which can cause a
hydration flicker on a hard reload of a logged-in SSR page. Intentional follow-up, not a regression.

## API 接縫 (seam): every app surface but `staff` has an `api.ts`

Every app surface except `staff` — `public`, `admin`, `coach`, `member`, `mobile`, `mobile-admin` — has
`src/lib/<surface>/api.ts`: async getters that originally all wrapped the surface's seed through one knob,
`reply = <T>(value: T) => Promise.resolve(value)` (full design:
`docs/superpowers/specs/2026-06-21-mock-api-seam-design.md`). That knob is exactly where the swap to the
real `dream_fly_backend` API landed: `public`, `admin`, `coach`, and `member`'s getters now mostly call
`api<T>()` (`lib/api/client.ts`) instead, falling back to `reply()` only for a handful of P2-commented gaps
that have no backend equivalent (or are purely cosmetic) — full inventory in `docs/adr/0006`. `mobile` and
`mobile-admin` (Round 3, Task 19/20) no longer call `reply()` throughout either: both now hold a thin
`api.ts` that re-delegates to the real getters already built for their desktop counterpart (`mobile` →
`$lib/member/api.ts`; `mobile-admin` → `$lib/admin` + `$lib/coach`), falling back to `reply()` only for
their own small residual mock spots (same ADR 0006 inventory). Backend wire shapes shared across ≥2
surfaces — order-status badges, list-page envelopes, member/coach paired DTOs, display atoms like
`ageRange`/`initialOf` — live in the single source `src/lib/api/wire.ts` rather than each `api.ts`
redeclaring its own copy (`docs/adr/0007`).
Pages that used to import seed constants directly, or hand-roll their own `onMount` + local `phase`
variable (every app surface, `mobile-admin` included), now call `gate.load()` on a
`createLoadGate`/`createPagedLoadGate` gate from the single source `src/lib/load-gate.ts` (`docs/adr/0008`)
and read `$gate` for `'loading' | 'error' | 'ready'`, rendering
`Skeleton`/`SkelCard` while loading and `ErrorState` on failure. Data that already lives in a store
(mobile's notification centre; mobile-admin's ops collections and messages) hydrates once behind a
`*Hydrated` guard (`notifsHydrated`, `opsHydrated`, `messagesHydrated`) passed to the gate as `skip`, with
`gate.refresh()` always re-fetching for `ErrorState`'s retry regardless of the guard — but the guard's
ownership differs by surface. Member/mobile notifications are page-owned: the store write happens in the
gate's `onData`, and the gate's own `generation`/`destroyed` bookkeeping (no page-local flag needed any
more) discards a response that resolves after the page unmounts. Mobile-admin's ops collections and
messages are store-owned: the write lives in `stores.ts`'s `hydrateOps`/`hydrateMessages`, which the gate
calls directly as `fetch`/`refresh` — the gate's own bookkeeping protects only the page's local phase,
never the shared store; store-write protection instead comes from the `*Hydrated` guard itself, which
mutators (`saveMember`/`saveClass`/`saveCoach`/`markOrderPaid`/`markMessageRead`) also flip true (a
mutation *is* the session's source of truth) and which is rechecked right before the hydrate write lands,
so a mutation racing an in-flight fetch always wins. Layout shells stay outside the seam
— a deliberate boundary, not an oversight: `admin`'s `Sidebar.svelte` / `Topbar.svelte` have no `data.ts`
or `api.ts` import at all (hardcoded nav config), while `coach`'s do import seed from `data.ts` — a
static `COACH` profile object, plus `NOTIFS` feeding the Topbar's unread-bell dropdown — but
synchronously, never through `api.ts` or the load gate. `staff` remains excluded because it's pre-auth
login/role-switch UI with no `data.ts` to seam. `public` gained its own seam later (`src/lib/public/api.ts`
+ `adapters.ts` — the one place that converts the backend's `*_cents`/enum/id shapes into the existing
marketing types, including the single cents→NT$ conversion point `ntd()`, see `docs/adr/0006`) once its
pages moved off static mock arrays onto the real `/courses`, `/coaches`, `/venues`, `/schedule`, `/posts`,
`/contact` endpoints.

## Testing

Vitest + `@testing-library/svelte` (jsdom, setup in `src/vitest-setup.ts`), with co-located `*.test.ts`.
The *convention* — extract pure logic into a sibling `.ts` so it's testable without rendering — is a
coding standard; see the `coding-standards` skill → `references/frontend.md`.

## Mobile surfaces use an overlay host, not nested routes

`/mobile` and `/mobile-admin` render most secondary views as sheets/screens via `OverlayHost.svelte` +
an `overlays/` folder, rather than as additional SvelteKit routes. New mobile views usually mean a new
overlay component + a store entry, not a new route.
