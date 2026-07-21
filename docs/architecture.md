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
out of `member/data.ts` so member/mobile/public routes stop reaching into a surface facade for them, and
2026-07-16 by `format.ts` — `fmtNT` + `fmtRatio` single-sourced from what were four per-surface `fmtNT`
copies and three percentage formatters; `admin`'s `fmtPct` and `member`'s `fmtRate` survive as one-line
surface bindings over `fmtRatio` carrying each surface's null-label),
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
`member-app.ts` — the member↔mobile desktop/mobile twin seed (12 constants; `ANNOUNCE` stays forked in
each facade because one announcement's background colour differs between the two). Task 1 (C2 死種子退役,
2026-07) retired 8 of the original 15 constants once every consumer had moved onto real backend seams —
`CATALOG`/`MAKEUP_SLOTS`/`REWARDS`/`REPORTS`/`CERTS` (value + interface) outright, and `MY_COURSES`/
`SCHEDULE`/`ORDERS` down to type-only exports — `EnrolledCourse`/`ScheduleBlock`/`Order` still back type
annotations in `mobile/api.ts` and the facades' own local interfaces, just with no sample value left.
Since 2026-07-14 the per-entity ops-pair files (`venues.ts`/`tickets.ts`/`members.ts`/`classes.ts`, plus
`course-level.ts`) each also single-source a status/type → tone-and-label display lookup
(`VENUE_STATUS`/`TICKET_TYPE`/`MEMBER_STATUS`+`MEMBER_ACCOUNT_STATUS`/`STATUS_TONE`/`LEVEL_TONE`), and
four more member↔mobile display constants (`WEEK`/`TIME_ROWS`/`COACH_REPLIES`/`NOTIF_CATS`) joined
`member-app.ts` the same round, taking its count from 7 to 11 (`docs/adr/0013`); `LEAVE_STATUS` followed
on 2026-07-16 (count 12), consumed by `member`'s and `mobile`'s `data.ts` as pure-annotation narrowing
re-asserts, and the same batch moved `session-format.ts` — pure per-session display derivation — from
`member/` into `domain/`, imported directly by its six member/mobile consumers with no facade hop
(`docs/adr/0014`).
Four facades consume it — each of `admin`'s, `mobile-admin`'s, `member`'s, and `mobile`'s `data.ts` —
mostly as verbatim pass-through re-exports; where shapes diverge, the ops pair imports the `*_BASE`
arrays and layers its own derived fields on top via `.map` builders, while `member`/`mobile` re-export
the same domain value under an `as` assertion to their own stricter local type (same reference, no
transformation); `coach` has no persona mapping into the shared seed, so it doesn't consume `lib/domain/`
at all. Because a facade could silently drop a re-exported *type* without vitest noticing (type-only
imports erase at transpile time), `src/lib/mobile/data.test.ts` binds each of its re-exported types to a
live value so a dropped export fails `npm run check` to compile, not just at runtime — the only facade
left needing this guard now that member-app.ts holds 12 constants; admin's former dedicated
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
file's remaining contracts are route inventory (a deleted route only 404s at navigation time), CSS
safety (two regression regexes `check` can't reach), and — since 2026-07-16 — the mobile
seam-consolidation source scan plus the `mobile/stores.ts` member-source allowlist (`docs/adr/0014`). Since
2026-07-20 (R5 C3) the scanner machinery itself — `walk`, the comment/string/template-aware
import-specifier extraction, and the reach predicate, six codex hardening rounds deep — lives in the
first-class test-support module `src/lib/testing/import-scan.ts` with its 39 self-proving fixtures moved
verbatim to `import-scan.test.ts`; the contract file consumes the module's three exports and keeps a
four-line smoke canary (one positive, one negative form) so a dead scanner still trips locally, while a
dogfood contract inside `import-scan.test.ts` pins that no production file under `src/lib`/`src/routes`
imports `$lib/testing`. See `docs/adr/0012` for the full K6 rationale,
including a type-assertion lesson from the same batch. Since 2026-07-22 (R7 C2) `src/lib/testing/`
gained two more first-class residents alongside `import-scan.ts` — `fake-router.ts`
(`fakeRouter(overrides, defaults?)`, a fetch-path lookup stub with fn-eval support) and
`auth-mock.ts` (`makeAuthMockA`/`makeAuthMockB`, canonical `vi.mock('$lib/stores/authStore')`
factories) — collapsing 29 test files' hand-rolled copies of the same two fixtures onto one source
each; the dogfood contract's production-file scan excludes `src/lib/testing/` itself (it's the
module being scanned *for*, not a production consumer).

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
  surface-local `CartInput`/`CartLine` pair, and since 2026-07-20 (R5 C6) `placeOrder()` passes
  `chargeableLines(get(cart), get(subscriptions))` — the branded chargeable filter, a no-op for
  today's course-only mobile carts — to `submitOrder()`; the former `toOrderItem` adapter is gone); the
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
- **Google OAuth callback is one shared component:** `lib/components/GoogleCallbackCard.svelte`
  (2026-07-22, R7 C7) takes `successPath`/`loginPath` props; `member`'s and `mobile`'s
  `/login/google` routes are both ten-line shells over it. `staff`/`mobile-admin` still have no
  Google option (`docs/adr/0006`).

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
inlined the same direct way. Since 2026-07-16 `mobile`'s *remaining* direct reaches into `$lib/member`
are consolidated too: production code imports member stores/actions/types only through
`mobile/stores.ts`'s re-export block (plus the new `mobile/auth.ts` for the Google-OAuth effect trio),
an invariant pinned by a source-scan contract in `mobile/foundation-contracts.test.ts` and
same-reference identity pins in `mobile/stores.test.ts`; test files stay exempt because
`vi.mock('$lib/member/stores')` *is* their wiring proof (`docs/adr/0014`). Backend wire shapes shared across ≥2
surfaces — order-status badges, list-page envelopes, member/coach paired DTOs, display atoms like
`ageRange`/`initialOf` — live in the single source `src/lib/api/wire.ts` rather than each `api.ts`
redeclaring its own copy (`docs/adr/0007`; since 2026-07-11 `mobile-admin/data.ts` re-exports the `OrderStatus` type
from wire instead of holding a verbatim copy, and its two dynamic badge lookups use wire's
`orderStatusBadge` fallback — which left a re-exported `ORDER_STATUS` table consumer-less, so it
was dropped; since 2026-07-16 it also re-exports `LEVEL_TINT` and the `Student` type from
`$lib/coach/data` — coach stays the single source — for mobile-admin's two coach-side consumers,
`docs/adr/0014`; since 2026-07-20 — R5 C7 — wire also owns two pieces of order knowledge as zero-import
pure helpers: `orderIdentity`, the dual-identity protocol picking the display `order_number` vs the real
uuid for `PATCH /orders/{id}/status`, and `taxFromGross`, the 5% tax-inclusive display derivation
`round(amount - amount/1.05)` whose unit follows the caller — consumed by admin's `mapAdminOrder`,
member's `mapOrder` and mobile-admin's ORDERS builder). Error-toast plumbing is single-sourced the same way:
`src/lib/api/error-text.ts`'s `apiErrorMessage` (pass-through) and `apiErrorText` (status-table, never
leaks the backend message) replaced 22 per-page inline mappers — 12 are table-form, each call site
keeping its own 1-4-line entity text table; the other 10 are pass-through, delegating outright
(`docs/adr/0011`). Coach's six pages (four desktop + mobile-admin's two coach pages) also shared
byte-identical *load*-error copy — the gate `onError` title/body pairs — single-sourced since 2026-07-16
in `src/lib/coach/load-error-copy.ts` (name-based `CoachNotFoundError` discrimination, so page tests that
stub the whole api module keep working; mobile-admin consumes it through `mobile-admin/api.ts`'s
re-export); per-entity *action* error tables stay at call sites — `docs/adr/0014` draws that boundary.
Pages that used to import seed constants directly, or hand-roll their own `onMount` + local `phase`
variable (every app surface, `mobile-admin` included), now call `gate.load()` on a
`createLoadGate`/`createPagedLoadGate` gate from the single source `src/lib/load-gate.ts` (`docs/adr/0008`)
and read `$gate` for `'loading' | 'error' | 'ready'`, rendering
`Skeleton`/`SkelCard` while loading and `ErrorState` on failure. Since 2026-07-08 that branching is itself
usually collapsed into a presentation wrapper, `src/lib/components/ui/LoadGate.svelte` (`slot="loading"` /
`slot="error"` with `let:retry`, default slot for ready; retry always calls `gate.refresh()`, never
`load()`), consumed at 55 call sites (46 uses across 45 route pages — the member 我的課程 page carries a second,
in-card attendance-history gate — plus 9 mobile/mobile-admin overlay screens since R5 C4 wired
VenuesScreen/TicketsScreen, mobile's `MyCourseDetail` among them with its own in-card attendance gate;
the two in-card gates override `slot="error"` with a bare `ErrorState` because they already sit inside
a `Card`) —
`ScheduleCalendar` keeps its bespoke inline template outside the wrapper. Data that already lives in a store
(member/mobile's notification centre; mobile-admin's ops collections and messages) hydrates once behind
a `*Hydrated` guard (`notificationsHydrated`, `notifsHydrated`, `opsHydrated`, `messagesHydrated`), with
`gate.refresh()` always re-fetching for `ErrorState`'s retry regardless of the guard — but the guard's
mechanism and ownership differ by surface. Member/mobile notifications are page-owned: since 2026-07-13
the page's own `createLoadGate` call carries a `hydrate: { flag, into }` option instead of hand-rolled
`skip`+`onData` — `flag` is the `*Hydrated` writable, `into` performs the store write, and the guard
short-circuit / post-await mutation-wins re-check / flag-flip that used to be hand-rolled at the page now
live inside `load()`/`refresh()`/`silentRefresh()` themselves (`docs/adr/0008`; since 2026-07-20 those
three decision points — guard short-circuit, mutation-wins re-check, flag-flip — delegate to the shared
`HydrationCore` in `src/lib/hydration-gate.ts`, one home for the protocol's vocabulary, while the gate's
reentry bookkeeping stays put — `docs/adr/0016`). The gate's own
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
unchanged), retiring the last hand-carried copy of the guard/re-check protocol. Since 2026-07-20 (R5 C1,
`docs/adr/0016`) member's 候補 waitlist and 請假 leave-requests stores adopted `createHydrationGate`
directly, each hand-rolling a byte-identical session-identity epoch/reconcile-chain skeleton beside it.
Since 2026-07-22 (R7 C1, `docs/adr/0017`) waitlist, leave, *and* notifications all sit on the
session-identity-aware factories in `src/lib/session-gate.ts` instead — see the dedicated section
below; `hydrateWaitlist`/`hydrateLeaveRequests`/`refreshNotifications` *are* `gate.hydrate` behind
`waitlistHydrated`/`leaveRequestsHydrated`/`notificationsHydrated`, and the five hand-copied mutator
skeletons collapse into one `gate.mutate()`. `refreshWaitlist` is still deleted outright (YAGNI, the
notifications precedent); `refreshLeaveRequests` still keeps its name as `gate.refresh` for
`MyCourseDetail`'s open-refresh — accepting once-per-session freshness, now with in-flight
cross-login responses discarded too, but still without a mutation-wins re-check on that
explicit-refresh window, recorded as known-latent (`docs/adr/0016`, unaffected by the R7 change). Separately, member's
`getDashboard()`/`getAccount()`/`getMine()` getters (`member/api.ts`) also opportunistically hydrate
session-scoped stores (points/notifications/subscriptions; `getMine()` — the third adopter, 2026-07-16 —
候補 waitlist + 請假 leave-requests) as a side effect, behind a private, named
`hydrateSessionStores(caller, tasks)` helper (2026-07-13) — `Promise.allSettled`, best-effort (a failed
hydrate only `console.error`s, never throws) — deliberately unlike `getPoints()`'s own fail-hard points
refresh, which is page-critical rather than incidental. The first two tail-await the hydrate after their
main fetch; `getMine()` instead runs it in *parallel* with the main fetch (`Promise.all`), preserving the
mine page's pre-existing parallel shape rather than quietly serializing it (`docs/adr/0014`). Layout shells stay outside the seam
— a deliberate boundary, not an oversight: `admin`'s `Sidebar.svelte` / `Topbar.svelte` have no `data.ts`
or `api.ts` import at all (hardcoded nav config), while `coach`'s Topbar still imports `NOTIFS` from
`data.ts` for its unread-bell dropdown — synchronously, never through `api.ts` or the load gate (coach's
workflow notifications have no backend feed yet, a standing P2 untouched by the identity change below).
The identity slot itself is a separate axis: since 2026-07-14 both shells read it off `$authStore.member`
— avatar initial, display name, and profile popover on `admin`'s and `coach`'s `Sidebar.svelte`; on
`coach`'s `Topbar.svelte` just the avatar-initial disc (its only popover is the notification bell, not an
identity surface) — still a synchronous store read, not a new `api.ts`/load-gate seam, replacing the
mock `COACH` constant and admin's local `PROFILE.name`/`PROFILE.initial` fields (`docs/adr/0013`).
`staff` remains excluded because it's pre-auth login/role-switch UI with no `data.ts` to seam. `public`
gained its own seam later (`src/lib/public/api.ts`
+ `adapters.ts` — the one place that converts the backend's `*_cents`/enum/id shapes into the existing
marketing types, including cents→NT$ conversion via the shared `ntd()` helper — single *definition*
here, not its only caller, see `docs/adr/0006`) once its
pages moved off static mock arrays onto the real `/courses`, `/coaches`, `/venues`, `/schedule`, `/posts`,
`/contact` endpoints. `src/lib/public/calendar-grid.ts` (2026-07-08) is the same shape applied to
`ScheduleCalendar`'s date-grid math — Sunday-leading grid/date pure functions pulled out of the component,
which is now a thin adapter over them; deliberately incompatible with, and never merged into, coach's own
Monday-leading `schedule-dates.ts`. Its sibling `calendar-selection.ts` (2026-07-16) does the same for the
component's *selection* transitions — month paging and date/time-slot picking as pure
`CalendarSelection → CalendarSelection` functions, with `gate.refresh()` staying a component-side effect
at the `loadMonth` call site; the bespoke inline three-state template (ADR 0008's standing exemption) is
untouched.

## Load gate vs. hydration gate: which one owns a shared store's fetch?

Three shapes exist for a page whose data already lives in a cross-route store (`docs/adr/0008`), and
picking between them only depends on one question — can the store's hydration be triggered from more
than one place, independent of any single page's own load-gate?

- **member notifications — two entry points, one shared flag**: the notifications *page* drives its own
  load-gate, and `member/api.ts`'s `getDashboard()` also opportunistically hydrates the same store
  (`hydrateSessionStores`, see above) — two independent triggers that must agree on one guard. The store
  therefore owns a full `createHydrationGate` instance, and the page's
  `createLoadGate({ hydrate: { flag, into } })` reads/writes that *same* `gate.hydrated` writable rather
  than declaring its own.
- **mobile notifications — one entry point, a plain flag suffices for hydration, not for session
  identity**: nothing outside the notifications page hydrates `notifs`, so there's no second
  *hydration* trigger to coordinate with. `notifsHydrated` stays a plain `writable(false)` wired
  straight into the page's `createLoadGate({ hydrate })` option; its mutators (`markRead`/
  `markAllRead`, since 2026-07-14 real `PATCH /notifications/{id}/read` calls — see `docs/adr/0013`)
  flip it by hand instead of calling a `markMutated()` on a gate instance that would otherwise just
  wrap the same one assignment. That simplicity only covers the hydration axis, though: a plain flag
  has no way of knowing when the logged-in identity changes, so since 2026-07-22 (R7 C1,
  `docs/adr/0017`) the flag's *session* axis is supplied separately by `onSessionReset` — the third
  factory in `src/lib/session-gate.ts` — which resets both `notifsBase` and `notifsHydrated` to boot
  state on identity change while leaving gate ownership with the caller.
- **mobile-admin ops/messages — store-owned, multiple mutators**: `hydrateOps`/`hydrateMessages` (and
  their `refresh*` counterparts) live in `stores.ts`, not the page — the page's gate calls them directly
  as its `fetch`/`refresh`. Several mutators (`markOrderPaid`/`markMessageRead`) can flip the guard, and
  none of them is "the page", so the fetch/apply/guard lifecycle has to live where the mutators do: the
  full `createHydrationGate` factory, store-owned.

Rule of thumb: reach for the standalone `createHydrationGate` when a store's hydration can be triggered
from more than one place (another getter, another mutator, another page); a lone page with a lone mutator
can wire a plain writable straight into `load-gate.ts`'s `hydrate` option instead.

## Session gate: session-identity-aware resets on top of the hydration gate

`createHydrationGate`/`createLoadGate`'s guard/mutation-wins protocol (above) knows nothing about
*who* is logged in — it only tracks whether a store has been hydrated at all. Six member/mobile
domain stores each handled "the logged-in identity changed" differently: waitlist/leave (adopting
`createHydrationGate` per `docs/adr/0016`, R5) each hand-rolled a byte-identical session-epoch/
reconcile-chain skeleton on top of it; member notifications' and mobile's notification flags survived
a logout unchanged (a real cross-login leak — SPA logout has no full page reload, so the next
account's first hydrate was guard-short-circuited into reading the previous account's data); points/
subscriptions had no session awareness at all (unconditional refetch, but nothing reset them on
identity change, and an in-flight refetch spanning the switch would land unconditionally).

`src/lib/session-gate.ts` (2026-07-22, R7 C1, `docs/adr/0017`) is the single source, three factories
sitting between `authStore` and the domain stores:

- **`createSessionGate<T>({ fetch, apply, reset })`** — waitlist / leave / member notifications.
  Builds a `HydrationGate` (via `createHydrationGate`) plus `mutate(request, writeBack)`, which
  absorbs what used to be five hand-copied mutator skeletons: snapshot hydration state + epoch before
  `await`, discard an epoch-stale write-back (result still returned — the server-side effect already
  happened), re-check completeness on write-back (a prior reconcile may have flipped the flag back to
  `false`), `markMutated()`, then conditionally queue a serialized, retryable reconciliation refetch.
- **`createSessionRefresher<T>({ fetch, apply, reset })`** — points / subscriptions. Keeps their
  pre-existing unconditional-refetch semantics (no guard) but adds identity-change reset and *silent*
  in-flight cross-login discard (`return`, not `throw` — throwing would inject a new "switched
  accounts" failure mode into `redeemReward`'s and `placeOrder`'s existing rejection chains).
- **`onSessionReset(reset)`** — mobile notifs. Gate ownership (the plain `notifsHydrated` writable)
  stays with the caller; this factory only calls `reset` on identity change.

Each factory call opens its own `authStore` subscription (six module-level subscriptions total, same
shape as before) rather than sharing a registry. Session-gate is deliberately *not* folded into
`hydration-gate.ts` itself: that module is consumed by ~49 pages across every surface including
`staff`/`mobile-admin`, whose identity source isn't member's `authStore` — folding member-auth
awareness into the repo's widest shared seam would be a wrong-direction dependency.

This closed two real cross-login leaks (notifications, mobile notifs) and the points/subscriptions
residual window that `docs/adr/0016` had flagged as "not in this round's write set, tracked
separately." One known-latent gap remains, symmetric across `member`'s notifications page and
mobile's notifications screen: each page's own `createLoadGate({ fetch: getNotifications, hydrate })`
calls the raw API getter directly rather than the store's own `gate.hydrate`/`gate.refresh`, so it
isn't wrapped by session-gate's epoch check — staying on the page while an identity switch happens
mid-flight can still let a stale response land after the store's reset. See `docs/adr/0017` for the
full analysis (why the guard-short-circuit and navigate-away cases are already safe, and why only
that narrow window remains open).

## Single-page controllers, orchestrators, and twin modules (coach, admin, member)

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
- **`src/lib/coach/clock-controller.ts`**'s `createClockController` (2026-07-16) is the fourth: the coach
  home page's clock-in/out orchestration as a two-field snapshot store (`clockedIn`/`clocking`) with
  `clockIn`/`clockOut`/`isClockedIn` injected as deps. `ApiError` 409/404 reclassification
  (already-clocked-in / not-clocked-in) and the hydrate-vs-mutation ABA guard (`clockTouched`, mutation
  wins) live inside, returning `kind`-tagged outcomes so all six toast strings stay on the page — this
  reverses the `docs/adr/0013` note that had declined the extraction; `docs/adr/0014` records the
  re-adjudication.
- **`src/lib/member/checkout-controller.ts`**'s `createCheckoutController` (2026-07-20, R5 C5) is the
  fifth: CheckoutDialog's payment lifecycle as a three-field snapshot store (`step`/`paying`/`paid`)
  with `placeOrder` as the single injected dep. The idempotency-key lifecycle (fresh key per checkout
  open, same key across a failed retry — the double-charge safety machine), `setOpen` edge detection
  (`freshCheckout | resumedInFlight | noop`) and the paying guard live inside, returning `kind`-tagged
  outcomes (`orderPlaced`/`orderFailed`/`alreadyPaying`/`nothingChargeable`, original throwable passed
  through) so toast text and all form/preview state stay on the component — this supersedes
  `docs/adr/0008`'s "keep the double-charge guard in the dialog" note; `docs/adr/0016` records the
  re-adjudication.

The same deps-injected, outcome-tagged shape also has a sanctioned *twin* variant since 2026-07-16 —
modules whose callers are desktop↔mobile twins with byte-identical orchestration rather than a single
page: `member/leave-form.ts` (the 請假/補課 form machines behind `LeaveDialog`/`MakeupDialog` and
mobile's `LeaveSheet`/`MakeupSheet`) and `member/cancel-leave.ts` (the shared cancel-leave busy guard
behind member/mine and mobile's `MyCourseDetail`). Gate wiring, error mappers, and toast copy stay at
each call site — `docs/adr/0012`'s criterion ① is relaxed for exactly this class by `docs/adr/0014`.
Since 2026-07-22 (R7 C8) `src/lib/login-submit.ts`'s `submitLogin(io: LoginSubmitIO)` pushes the
pattern further still — an IO-callback orchestrator, not a deps-injected snapshot store, shared by
*four* surfaces' login pages (`member`/`mobile`/`mobile-admin`/`staff`) rather than a desktop↔mobile
pair. It collapses what used to be a byte-identical `submit()` skeleton (re-entrancy guard → optional
empty-fields check → clear error, lock → login → resolve a role-based redirect target → navigate →
catch → unlock) into
one module; each page keeps its own `let busy`/`let error` locals and markup unchanged, wiring them
through the `LoginSubmitIO` callbacks.

## Testing

Vitest + `@testing-library/svelte` (jsdom, setup in `src/vitest-setup.ts`), with co-located `*.test.ts`.
The *convention* — extract pure logic into a sibling `.ts` so it's testable without rendering — is a
coding standard; see the `coding-standards` skill → `references/frontend.md`. Not every `.ts` has a
same-named `.test.ts`, though: since R7 C1 (`docs/adr/0017`) `member/waitlist.ts`, `leave.ts`,
`points.ts`, and `subscriptions.ts` have no sibling test file of their own — their mutator/adapter
pins live in the topic-named `checkout-api.test.ts` and `leave-requests-api.test.ts` instead (a
pre-existing pattern), while the shared session-identity protocol itself (guard, epoch, reconcile
chain) is tested exactly once, generically, in lib-root's `session-gate.test.ts`. "Co-located" above
means co-located with the API surface a test exercises, not a strict 1:1 file-name mirror.

## Mobile surfaces use an overlay host, not nested routes

`/mobile` and `/mobile-admin` render most secondary views as sheets/screens via `OverlayHost.svelte` +
an `overlays/` folder, rather than as additional SvelteKit routes. New mobile views usually mean a new
overlay component + a store entry, not a new route.
