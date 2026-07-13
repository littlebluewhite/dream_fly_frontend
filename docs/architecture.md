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
file itself. Cross-surface shared code lives in: lib-root single-file pure modules
(`checkout-math.ts`/`checkout-gate.ts`/`checkout-order.ts`/`load-gate.ts`/`hydration-gate.ts`, joined
2026-07-11 by `cart-item.ts` — the `CartItem` types + `courseToCartItem`/`passToCartItem` adapters lifted
out of `member/data.ts` so member/mobile/public routes stop reaching into a surface facade for them),
`lib/components/` (marketing/shared UI, plus the `ui/`
and `mobile/` shelves below), `lib/data/` (marketing seed + nav config), `lib/domain/` (single-source
seed feeding several facades —
see below), `lib/stores/` (`authStore` is cross-cutting; the toast deep store `toasts.ts` /
`marketingToasts.ts` is cross-cutting too, via three adapters in `lib/components/toast/` per ADR 0005 —
`notificationsStore` alone stays public/marketing-only; `read-state.ts`'s `createReadState` factory,
2026-07-08, is the shared per-item read/unread store shape behind mobile's, mobile-admin's, and coach's
notification bells), `lib/styles/` (`global.css` + design tokens),
`lib/types/`, `lib/utils/`.

## `src/lib/domain/` — single source for the ops-pair and member-app facades

`src/lib/domain/` holds mock seed that used to be duplicated across surfaces: ops entities (`venues.ts`,
`tickets.ts`, `coaches.ts`, `activity.ts`) plus base arrays (`CLASSES_BASE`, `MEMBERS_BASE`,
`ORDERS_BASE` in `classes.ts` / `members.ts` / `orders.ts`) shared by the admin↔mobile-admin ops-pair, and
`member-app.ts` — the member↔mobile desktop/mobile twin seed (7 constants; `ANNOUNCE` stays forked in
each facade because one announcement's background colour differs between the two). Task 1 (C2 死種子退役,
2026-07) retired 8 of the original 15 constants once every consumer had moved onto real backend seams —
`CATALOG`/`MAKEUP_SLOTS`/`REWARDS`/`REPORTS`/`CERTS` (value + interface) outright, and `MY_COURSES`/
`SCHEDULE`/`ORDERS` down to type-only exports — `EnrolledCourse`/`ScheduleBlock`/`Order` still back type
annotations in `mobile/api.ts` and the facades' own local interfaces, just with no sample value left.
Four facades consume it — each of `admin`'s, `mobile-admin`'s, `member`'s, and `mobile`'s `data.ts` —
mostly as verbatim pass-through re-exports; where shapes diverge, the ops pair imports the `*_BASE`
arrays and layers its own derived fields on top via `.map` builders, while `member`/`mobile` re-export
the same domain value under an `as` assertion to their own stricter local type (same reference, no
transformation); `coach` has no persona mapping into the shared seed, so it doesn't consume `lib/domain/`
at all. Because a facade could silently drop a re-exported *type* without vitest noticing (type-only
imports erase at transpile time), `src/lib/mobile/data.test.ts` binds each of its re-exported types to a
live value so a dropped export fails `npm run check` to compile, not just at runtime — the only facade
left needing this guard now that member-app.ts is down to 7 constants; admin's former dedicated
type-export regression file was retired once ADR 0009 emptied out the reports-domain re-exports it was
guarding.

## Shared component shelves: `lib/components/ui` and `lib/components/mobile`

`lib/components/ui/` is the cross-surface primitive shelf (`Button`, `Card`, `Input`, `Dialog`, … barrelled
through `index.ts`) plus four async three-state components hoisted off the member pilot — `Skeleton`,
`SkelCard`, `ErrorState`, `EmptyState` — consumed by mock-API-seam pages across every surface for their
loading/error states; the shimmer animation `Skeleton` uses (`df-shimmer`) is now a `@keyframes` in
`global.css` instead of a per-component style block. `lib/components/mobile/` is the parallel shelf for
the two mobile surfaces — `Sheet`, `TabBar`, `ScreenHeader`, plus smaller pieces (`HeaderIcon`, `NoteBox`,
`SectionTitle`, …) — consumed directly by both `mobile` and `mobile-admin`'s pages/overlays; each surface
still wraps the shared `TabBar` in its own thin local component to attach its own tab items. The same
shelf also holds `overlay.ts` (2026-07-08) — the `createOverlay` factory (push/pop screen stack + one
bottom sheet) single-sourced from what used to be two byte-identical copies inside `mobile`'s and
`mobile-admin`'s `stores.ts`; each surface still re-exports it and builds its own singleton, now
instantiated with its own push/sheet id unions since 2026-07-14
(`overlay = createOverlay<MobilePushId, MobileSheetId>()` in `mobile/stores.ts`, K6-4 — push and sheet
are non-intersecting id namespaces, so a single shared type parameter would let an id legal only on one
side leak onto the other) so a `push()`/`sheet()` call carrying an id outside that surface's registered
set is a compile error.

`src/lib/icon-registry.ts` (K6, 2026-07-13/14) is the single source of every icon name used anywhere in
the codebase. It sits at lib-root rather than under `lib/components/`, deliberately: `lib/components/`
(including `Icon.svelte`) already imports lib-root values downward, and this way `lib/domain`/each
surface's `data.ts` only need a type-only import of `IconName` — erased at transpile time, so no
`domain → components` runtime edge opens. `Icon.svelte`'s `name` prop and every data-layer `icon` field
are typed `IconName = keyof typeof ICONS`, so an unregistered icon name is now a `npm run check` failure
everywhere it's used, not just where `<Icon>` renders it. Together with the overlay id unions above, this
let `src/lib/mobile/foundation-contracts.test.ts` retire its icon-registry-completeness and
overlay-map-completeness source scans — both were a strict subset of what `check` now catches; the
file's two remaining contracts are route inventory (a deleted route only 404s at navigation time) and CSS
safety (two regression regexes `check` can't reach). See `docs/adr/0012` for the full K6 rationale,
including a type-assertion lesson from the same batch.

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
- **Course vs Pass**: checkout syncs the cart and `POST /orders`s it (`placeOrder()` in member stores and
  mobile stores — both thin adapters since 2026-07-08 over the shared wire orchestration
  `src/lib/checkout-order.ts`'s `submitOrder()`, see `docs/adr/0003`'s appendix — since 2026-07-13
  mobile's cart itself is typed as the shared `CartItem` (`$lib/cart-item`, see above) rather than a
  surface-local `CartInput`/`CartLine` pair, so `placeOrder()` passes `get(cart)` straight to
  `submitOrder()` with no projection step; the former `toOrderItem` adapter is gone); the
  backend creates both artifacts atomically in one transaction. A `type: 'course'` line becomes a real 報名
  (enrolment row); the member's weekly schedule is real too, hydrated from `GET /schedule/me`
  (`member/api.ts`'s `getSchedule()`, derived from the member's active enrolments, see `docs/adr/0006`);
  a `type: 'pass'` line becomes a real 訂閱 (entitlement), re-hydrated from
  `GET /subscriptions/me` after checkout rather than persisted verbatim — the old `dreamfly_subscriptions`
  `localStorage` key is gone. Per ADR 0001 the two remain independent products.
- **Waitlist guard:** a full course (`spots: 0`) is blocked from the paid cart and routed to 候補
  (waitlist) — see the `AddResult = 'added' | 'bumped' | 'waitlisted'` add path in member stores.
  Since 2026-07-11 mobile's cart takes the same shape: `add()` only returns `'waitlisted'` and the
  three call sites `await joinWaitlist()` against the real `/waitlist` endpoint (the old in-memory
  mobile-only waitlist array is gone), so a mobile 候補 is the same server row the desktop
  member/mine card shows.
- **Staff role switch:** `lib/staff/roles.ts` maps admin↔coach and remembers the last role in
  `df_staff_last_role` — a local UI convenience, independent of the real role check at staff login.

Known, deferred caveat (ADR 0001): persisted stores read `localStorage` at module-init, which can cause a
hydration flicker on a hard reload of a logged-in SSR page. Intentional follow-up, not a regression.

## API 接縫 (seam): every app surface but `staff` has an `api.ts`

Every app surface except `staff` — `public`, `admin`, `coach`, `member`, `mobile`, `mobile-admin` — has
`src/lib/<surface>/api.ts`: async getters that originally all wrapped the surface's seed through one knob,
`reply = <T>(value: T) => Promise.resolve(value)` (full design:
`docs/superpowers/specs/2026-06-21-mock-api-seam-design.md`). That knob is exactly where the swap to the
real `dream_fly_backend` API landed, and the knob itself is gone now — no surface's `api.ts` calls
`reply()` any more. `public`, `admin`, `coach`, and `member`'s getters mostly call `api<T>()`
(`lib/api/client.ts`) instead; the handful of P2-commented gaps that have no backend equivalent (or are
purely cosmetic) just return the mock/hardcoded value directly inside the same `async` getter — full
inventory in `docs/adr/0006`. `mobile` and `mobile-admin` (Round 3, Task 19/20) landed the same way: both
hold an `api.ts` that re-delegates to the real getters already built for their desktop counterpart
(`mobile` → `$lib/member/api.ts`; `mobile-admin` → `$lib/admin` + `$lib/coach`), adding light field-mapping
only where the mobile shape diverges, with their own small residual mock spots (same ADR 0006 inventory)
inlined the same direct way. Backend wire shapes shared across ≥2
surfaces — order-status badges, list-page envelopes, member/coach paired DTOs, display atoms like
`ageRange`/`initialOf` — live in the single source `src/lib/api/wire.ts` rather than each `api.ts`
redeclaring its own copy (`docs/adr/0007`; since 2026-07-11 `mobile-admin/data.ts` re-exports the `OrderStatus` type
from wire instead of holding a verbatim copy, and its two dynamic badge lookups use wire's
`orderStatusBadge` fallback — which left a re-exported `ORDER_STATUS` table consumer-less, so it
was dropped). Error-toast plumbing is single-sourced the same way:
`src/lib/api/error-text.ts`'s `apiErrorMessage` (pass-through) and `apiErrorText` (status-table, never
leaks the backend message) replaced 22 per-page inline mappers — 12 are table-form, each call site
keeping its own 1-4-line entity text table; the other 10 are pass-through, delegating outright
(`docs/adr/0011`).
Pages that used to import seed constants directly, or hand-roll their own `onMount` + local `phase`
variable (every app surface, `mobile-admin` included), now call `gate.load()` on a
`createLoadGate`/`createPagedLoadGate` gate from the single source `src/lib/load-gate.ts` (`docs/adr/0008`)
and read `$gate` for `'loading' | 'error' | 'ready'`, rendering
`Skeleton`/`SkelCard` while loading and `ErrorState` on failure. Since 2026-07-08 that branching is itself
usually collapsed into a presentation wrapper, `src/lib/components/ui/LoadGate.svelte` (`slot="loading"` /
`slot="error"` with `let:retry`, default slot for ready; retry always calls `gate.refresh()`, never
`load()`), consumed at 53 of those call sites (45 route pages + 7 mobile/mobile-admin overlay screens,
plus in-card attendance-history gates on the member 我的課程 page and mobile's `MyCourseDetail`, which
override `slot="error"` with a bare `ErrorState` because they already sit inside a `Card`) —
`ScheduleCalendar` keeps its bespoke inline template outside the wrapper. Data that already lives in a store
(member/mobile's notification centre; mobile-admin's ops collections and messages) hydrates once behind
a `*Hydrated` guard (`notificationsHydrated`, `notifsHydrated`, `opsHydrated`, `messagesHydrated`), with
`gate.refresh()` always re-fetching for `ErrorState`'s retry regardless of the guard — but the guard's
mechanism and ownership differ by surface. Member/mobile notifications are page-owned: since 2026-07-13
the page's own `createLoadGate` call carries a `hydrate: { flag, into }` option instead of hand-rolled
`skip`+`onData` — `flag` is the `*Hydrated` writable, `into` performs the store write, and the guard
short-circuit / post-await mutation-wins re-check / flag-flip that used to be hand-rolled at the page now
live inside `load()`/`refresh()`/`silentRefresh()` themselves (`docs/adr/0008`). The gate's own
`generation`/`destroyed` bookkeeping (no page-local flag needed any more) still discards a response that
resolves after the page unmounts (member's read-state *mutations* —
`markRead`/`markAllRead`, optimistic update + PATCH + `markMutated()` — live in `member/notifications.ts`
since 2026-07-11; mobile's equivalent mutators flip `notifsHydrated` — a plain `writable(false)`, not a
`createHydrationGate` instance — by hand in `mobile/stores.ts`; the page keeps only the toast).
Mobile-admin's ops collections and
messages are store-owned: the write lives in `stores.ts`'s `hydrateOps`/`hydrateMessages`, which the gate
calls directly as `fetch`/`refresh` — the gate's own bookkeeping protects only the page's local phase,
never the shared store; store-write protection instead comes from the `*Hydrated` guard itself, which
mutators (`markOrderPaid`/`markMessageRead`) also flip true (a mutation *is* the session's
source of truth) and which is rechecked right before the hydrate write lands, so a mutation racing an
in-flight fetch always wins (`saveMember`/`saveClass`/`saveCoach` no longer exist as local mutators —
Task 20 moved class/member writes and Round 4's Task F5 moved coach writes to the real
`/courses`/`/users`/`/coaches` API followed by an unconditional `refreshOps()`
refetch, bypassing `markMutated()` entirely). That store-owned guard + post-await re-check
protocol is itself a shared factory since 2026-07-08 — `src/lib/hydration-gate.ts`'s
`createHydrationGate` (`hydrate`/`refresh`/`markMutated`), which `mobile-admin/stores.ts`'s
`hydrateOps`/`hydrateMessages` build on; since 2026-07-11 `member/notifications.ts` is the factory's
second adopter — `refreshNotifications` *is* `gate.hydrate` and `notificationsHydrated` *is* the gate's
own writable (same instance, so the page-owned load-gate wiring above keeps reading/writing it
unchanged), retiring the last hand-carried copy of the guard/re-check protocol. Separately, member's
`getDashboard()`/`getAccount()` getters (`member/api.ts`) also opportunistically hydrate session-scoped
stores (points/notifications/subscriptions) as a side effect, behind a private, named
`hydrateSessionStores(caller, tasks)` helper (2026-07-13) — `Promise.allSettled`, best-effort (a failed
hydrate only `console.error`s, never throws) — deliberately unlike `getPoints()`'s own fail-hard points
refresh, which is page-critical rather than incidental. Layout shells stay outside the seam
— a deliberate boundary, not an oversight: `admin`'s `Sidebar.svelte` / `Topbar.svelte` have no `data.ts`
or `api.ts` import at all (hardcoded nav config), while `coach`'s do import seed from `data.ts` — a
static `COACH` profile object, plus `NOTIFS` feeding the Topbar's unread-bell dropdown — but
synchronously, never through `api.ts` or the load gate. `staff` remains excluded because it's pre-auth
login/role-switch UI with no `data.ts` to seam. `public` gained its own seam later (`src/lib/public/api.ts`
+ `adapters.ts` — the one place that converts the backend's `*_cents`/enum/id shapes into the existing
marketing types, including cents→NT$ conversion via the shared `ntd()` helper — single *definition*
here, not its only caller, see `docs/adr/0006`) once its
pages moved off static mock arrays onto the real `/courses`, `/coaches`, `/venues`, `/schedule`, `/posts`,
`/contact` endpoints. `src/lib/public/calendar-grid.ts` (2026-07-08) is the same shape applied to
`ScheduleCalendar`'s date-grid math — Sunday-leading grid/date pure functions pulled out of the component,
which is now a thin adapter over them; deliberately incompatible with, and never merged into, coach's own
Monday-leading `schedule-dates.ts`.

## Single-page controllers and orchestrators (coach, admin)

Some pages have a same-page-only state-orchestration layer thick enough to be worth extracting into a
sibling `.ts` (per the Testing convention below) but not general enough to become a shared
`lib/<surface>/` module consumed by more than one caller — see `docs/adr/0012` for the four-part test
this round (K1/K3/K4) settled on, and its contrast with the cross-page "list-page controller factory"
that `docs/adr/0011` already rejected.

- **`src/lib/coach/attendance-controller.ts`**'s `createAttendanceController` (K1) sits between the
  existing pure reducer `attendance-draft.ts` and `coach/attendance/+page.svelte`: a single
  `AttendanceViewState` snapshot store replaces five mirrored page variables, with `saveAttendance`/`now`
  injected as deps (no Svelte component/lifecycle imports — `svelte/store` only — and construction is
  side-effect-free, SSR-safe). `save()` layers an incrementing
  save-token guard on top of the pre-existing state-based stale guard — not a replacement for it —
  closing a latent ABA hole where an in-flight save's late response could land on a class switched away
  from mid-save.
- **`src/lib/coach/conversations-filter.ts`** (K3) is a framework-free port of
  `coach/messages/+page.svelte`'s tab × search filtering, selection-fallback, and compose-insert logic
  (`filterConversations`/`pickSelection`/`applyCreatedConversation`), consumed only by that page.
- **`src/lib/admin/components/coach-save.ts`**'s `saveNewCoach`/`saveCoachEdit` (K4) is a stateless async
  orchestrator for `admin/coaches/+page.svelte`'s two-step account-then-coach create sequence and its
  `pendingUserId` retry sentinel — sentinel *semantics* live in the module, sentinel *storage* stays on
  the page. Both functions return a `kind`-tagged outcome so the page — not the module — picks the error
  mapper (`docs/adr/0011`) and toast text.

## Testing

Vitest + `@testing-library/svelte` (jsdom, setup in `src/vitest-setup.ts`), with co-located `*.test.ts`.
The *convention* — extract pure logic into a sibling `.ts` so it's testable without rendering — is a
coding standard; see the `coding-standards` skill → `references/frontend.md`.

## Mobile surfaces use an overlay host, not nested routes

`/mobile` and `/mobile-admin` render most secondary views as sheets/screens via `OverlayHost.svelte` +
an `overlays/` folder, rather than as additional SvelteKit routes. New mobile views usually mean a new
overlay component + a store entry, not a new route.
