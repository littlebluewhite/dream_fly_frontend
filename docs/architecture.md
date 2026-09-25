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
one exception to the single-file pattern: it's a pure barrel re-exporting 7 concern modules that live
alongside it (`waitlist.ts`, `leave.ts`, `points.ts`, `subscriptions.ts`, `checkout-sync.ts`,
`notifications.ts`, `ui.ts`) plus a pass-through of lib-root's `cart.ts` — the cart factory moved up out
of the surface folder on 2026-08-03 (R9 C2, `docs/adr/0019`) and the barrel kept re-exporting it, so the
five call sites that pull `cart` alongside other member symbols in one import clause stay untouched —
new store/function additions go in the owning module, never in the barrel
file itself. `nav.ts` is the navigation model — the `NAV` item list, the `isActive` predicate, and the
layout's longest-prefix `resolve()` title/subtitle map — as pure functions with a sibling `nav.test.ts`;
`admin`'s joined the family on 2026-08-10 (R11 C7), lifting `NAV`+`isActive` out of its
`Sidebar.svelte` (whose `<script context="module">` block is gone with them) and `TITLES`+`resolve` out
of `routes/admin/+layout.svelte`, so all four chrome-bearing surfaces — `admin`/`coach`/`mobile`/
`mobile-admin` — now share the same shape, and `Sidebar.test.ts`'s five `isActive` cases moved to
`admin/nav.test.ts` (mirroring what `coach` already looked like). Sidebar labels and `TITLES` labels
still disagree in a few spots (會員管理 vs 學員管理) — a pre-existing divergence kept verbatim, not
unified. `admin/api.ts` picked up a narrower version of the same shape on 2026-07-23 (R8 C5): its
Reports group (`GET /reports/admin` types/mappers/`getReports`, 336 lines) moved out to
`admin/reports-api.ts`, with `admin/api.ts` re-exporting it name-by-name so its 42 existing consumers —
`mobile-admin/api.ts`'s own re-export of `getReports` included — stay untouched; the file's other groups
(Settings, Courses) weren't preemptively split (`docs/adr/0018`). Cross-surface shared code lives in: lib-root single-file pure modules
(`checkout-math.ts`/`checkout-gate.ts`/`checkout-order.ts`/`load-gate.ts`/`hydration-gate.ts`, joined
2026-07-11 by `cart-item.ts` — the `CartItem` types + `courseToCartItem`/`passToCartItem` adapters lifted
out of `member/data.ts` so member/mobile/public routes stop reaching into a surface facade for them, and
2026-07-16 by `format.ts` — `fmtNT` + `fmtRatio` single-sourced from what were four per-surface `fmtNT`
copies and three percentage formatters; `admin`'s `fmtPct` and `member`'s `fmtRate` survive as one-line
surface bindings over `fmtRatio` carrying each surface's null-label — and 2026-08-03 by `cart.ts`, the
`createCart` factory plus the app-wide persisted singleton and `cartCount`, lifted byte-for-byte out of
`member/cart.ts` because the cart is a global concept, not a member-surface one, see `docs/adr/0019`),
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
(`docs/adr/0014`). Since 2026-07-23 (R8 C4) a sixth per-entity display lookup joined the
venues/tickets/members/classes/course-level family: `domain/sessions.ts`'s `SESSION_STATUS` (plus the
`TodayStatus` union and `deriveSessionStatus`, moved verbatim from `coach/api.ts`), collapsing three
hand-copied today's-session-status tables (`coach`'s `CLASS_STATUS` label, `admin`'s and
`mobile-admin`'s own today-status label tables) — the canonical `live` label is `coach`'s and
`mobile-admin`'s pre-existing `上課中`, so `admin`'s former `進行中` is the one that changed
(`docs/adr/0018`). `domain/class-detail.ts` (2026-08-10, R11 C5) is a different kind of resident, closer
to `session-format.ts` than to those six: `classDetailRows` — the 12-row `[icon, label, value]` course
detail list behind `admin`'s `ClassDialog` and `mobile-admin`'s `ClassSheet`, until then two
byte-identical untested inline copies — plus `classFill(enrolled, cap)`, the full/percentage derivation
four call sites each carried their own copy of. It maps to no backend enum and yields no `Tone`, so it
isn't a seventh per-entity lookup; its one behaviour change is that `cap <= 0` now gives `pct: 0`
instead of the `Infinity`/`NaN` the old inline `Math.round(enrolled / cap * 100)` fed straight into a
progress bar (`docs/adr/0013`). `domain/leave-requests.ts` (2026-09-26, R12) is another entity-file
resident of that kind. Its `leaveAction(lr)` gives the one 請假 rule: `pending` → cancel, `approved`
without a makeup → book 補課, `approved` with one → already booked, else nothing. Until then that rule
was hand-copied in member/mine and mobile's `MyCourseDetail`. It lives in an entity file rather than
`member-app.ts`, whose header restricts it to constants and lookups, and mobile imports it directly as a
pure function (`docs/adr/0022`).
Four facades consume it — each of `admin`'s, `mobile-admin`'s, `member`'s, and `mobile`'s `data.ts` —
but since 2026-08-03 (R9 C4, `docs/adr/0019`) **none of them re-exports a pass-through any more**: every
export line that carried no local type fact (no narrowing annotation, no `as` assertion, no local
interface) and did no value transformation, over a same-name-same-type symbol from `$lib/domain` or
`$lib/api/wire`, was retired across four batches (mobile → member → mobile-admin → admin, ~50 symbols),
and its consumers now import the canonical source directly — import-site aliases where a facade had
renamed something (`EnrolledCourse as MyCourse`, `Activity as ActivityRow`). What the four `data.ts`
files still hold is what makes them facades in the first place: local interfaces and local mock arrays,
the ops pair's `.map`
builders over the `*_BASE` arrays, real mappers (`admin`'s `mapMemberAccount`), the `docs/adr/0013`
Form 2/3 narrowing re-asserts that genuinely re-assert a stricter local type over the same reference
(`member`'s and `mobile`'s `LEAVE_STATUS`/`LEVEL_TONE`, `member`'s `NOTIFS_SEED` and its one
`as`-assertion narrowing `UPCOMING`, `mobile-admin`'s five status tables),
and one ADR-named boundary seam (`mobile-admin`'s `LEVEL_TINT`/`Student`, whose
canonical home stays `coach/data.ts` — `docs/adr/0014`). `coach` has no persona mapping into this
shared ops-pair/member-app seed, so it stays
outside the four-facade group above — though since 2026-07-23 (R8 C4) it's no longer true that `coach`
doesn't consume `lib/domain/` at all: `coach/data.ts` and `coach/api.ts` both import directly from
`domain/sessions.ts` (the display-lookup single source described just above) for `SESSION_STATUS` and
`deriveSessionStatus` respectively. The dedicated type-export regression guard that used to bind each
re-exported *type* to a live value (so a silently dropped type export fails `npm run check` instead of
disappearing at transpile time) is gone with the pass-throughs it was guarding:
`src/lib/mobile/data.test.ts` was deleted outright in R9 C4 batch 1, following `admin`'s own file,
which ADR 0009 had already emptied out. The guards that remain are about the domain values themselves, not the facades'
wiring — `domain/member-app.test.ts`, `status-lookups.test.ts` and `course-level.test.ts` keep their
literal snapshots and row/key-count canaries in full, plus `toBe` same-reference pins for exactly the
narrowing re-asserts that survived.

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
`mobile-admin`'s `stores.ts`; each surface builds its own singleton by importing the factory directly
(the `stores.ts` re-exports of `createOverlay`/`OverlayEntry`/`OverlayState` had no consumers and were
retired on 2026-09-26, R12). Push and sheet are non-intersecting id namespaces (K6-4, 2026-07-14), so
the factory takes two type parameters. Since 2026-09-26 (R12, `docs/adr/0022`) those parameters are
each surface's registry rather than bare id unions: the `PUSH`/`SHEETS` id → component maps moved out
of the two `OverlayHost.svelte` files into `src/lib/mobile/overlay-registry.ts` and
`src/lib/mobile-admin/overlay-registry.ts` (`satisfies OverlayRegistry`), and
`overlay = createOverlay<MobilePushRegistry, MobileSheetRegistry>()` derives the legal ids from the
registry keys and each id's props from the registered component's props minus the host-injected
`onBack`/`onClose`. A `push()`/`sheet()` call with an unknown id, a wrong or missing required prop, or a
host-injected prop is a compile error, pinned by `@ts-expect-error` lines in
`components/mobile/overlay.test.ts`. `stores.ts` pulls the registry in with a statement-level
`import type` only, so the overlay components never enter the stores' runtime import chain.

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
- **One persistent cart** spanning guest → login → checkout: since 2026-08-03 (R9 C2, `docs/adr/0019`)
  the factory and the singleton both live at lib-root in `src/lib/cart.ts` — the single app-wide
  `cart = createCart(true)` (persisted to `dreamfly_cart_v3` — string uuid item ids deduped by
  `(type, id)`; no migration runs against the old `dreamfly_cart_v2` key, see `docs/adr/0006`) plus the
  `cartCount` badge derived. `lib/member/stores.ts` still re-exports `createCart`/`cart`/`cartCount`, now
  as a pass-through of `$lib/cart`, so the five call sites that mix `cart` with member-domain symbols
  in one import clause didn't change; the public chrome (`components/Header.svelte`,
  `components/CartDropdown.svelte`, `routes/cart/+page.svelte`) imports `$lib/cart` directly.
  The old `member/cart.ts` was deleted rather
  than left as a shell — a shell that re-ran `createCart(true)` would produce a second persisting
  singleton double-writing `localStorage`. The `createCart(persist=false)` factory exists so tests get an
  isolated, non-persisting cart — and so does `mobile`, which builds its own non-persisting instance
  behind a deliberately narrow seam in `mobile/stores.ts` exposing exactly four members
  (`subscribe`/`add`/`remove`/`clear`), with the mobile-only `icon` override expressed as its own
  `addItem` input rather than as a factory option: **a shared factory is not a shared store instance**.
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
  (waitlist) — see the `AddResult = 'added' | 'bumped' | 'waitlisted'` add path in `lib/cart.ts`
  (re-exported through member stores).
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
redeclaring its own copy (`docs/adr/0007`; since 2026-07-11 `mobile-admin/data.ts` takes the `OrderStatus`
type from wire instead of holding a verbatim copy, and its two dynamic badge lookups use wire's
`orderStatusBadge` fallback — which left a re-exported `ORDER_STATUS` table consumer-less, so it
was dropped, and R9 C4 dropped the outward `OrderStatus` re-export too, keeping only the file-local
`import type` its own `OrderRow.status` needs; since 2026-07-16 it also re-exports `LEVEL_TINT` and the
`Student` type from
`$lib/coach/data` — coach stays the single source — for mobile-admin's two coach-side consumers, a
boundary seam R9 C4 re-checked and kept byte-for-byte (`docs/adr/0014`, `docs/adr/0019`); since 2026-07-20 — R5 C7 — wire also owns two pieces of order knowledge as zero-import
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
`load()`), consumed at 55 call sites (one per route page across 45 route pages — the member 我的課程 page's
second, in-card attendance-history gate retired on 2026-08-03 when R10 D folded it into
`member/mine-controller.ts`, `docs/adr/0008` — plus 10 mobile/mobile-admin overlay screens since R5 C4 wired
VenuesScreen/TicketsScreen, mobile's `MyCourseDetail` among them with its own in-card attendance gate,
the last one still overriding `slot="error"` with a bare `ErrorState` because it already sits inside
a `Card`; mobile-admin's `CoachesScreen` is the tenth, converted on 2026-08-10 from an `onMount`
self-hydrate to a real three-state gate — see the hydration section below) —
`ScheduleCalendar` keeps its bespoke inline template outside the wrapper. Data that already lives in a store
(member/mobile's notification centre; mobile-admin's ops collections and messages) hydrates once behind
a `*Hydrated` guard (`notificationsHydrated` — shared by member and mobile since 2026-09-26 —
`opsHydrated`, `messagesHydrated`), with
`gate.refresh()` always re-fetching for `ErrorState`'s retry regardless of the guard — but the guard's
mechanism and ownership differ by surface. Member/mobile notifications are page-owned: since 2026-07-13
the page's own `createLoadGate` call carries a `hydrate: { flag, into }` option instead of hand-rolled
`skip`+`onData` — `flag` is the `*Hydrated` writable, `into` performs the store write, and the guard
short-circuit (`load()` only), the post-await mutation-wins re-check (also `load()`'s apply path only —
`refresh()`/`silentRefresh()` deliberately never re-check the flag) and the flag-flip (shared by all
three) that used to be hand-rolled at the page now
live inside `load()`/`refresh()`/`silentRefresh()` themselves (`docs/adr/0008`; since 2026-07-20 those
three decision points — guard short-circuit, mutation-wins re-check, flag-flip — delegate to the shared
`HydrationCore` in `src/lib/hydration-gate.ts`, one home for the protocol's vocabulary, while the gate's
reentry bookkeeping stays put — `docs/adr/0016`). What covers the refresh family instead is a *fourth*
decision point added 2026-08-03 (R10 A, `docs/adr/0020`): `fetchGenStable` — capture the gate's monotonic
mutation generation on entry, re-read it when the response lands, and if a local mutation happened inside
that window discard the snapshot and refetch in place until it is stable. It deliberately stays outside
`HydrationCore` (it reads the generation, never the flag) and is deliberately never applied to `load()`
(hydrate's contract is mutation-wins-discard, with the reconcile chain owing the refetch; refresh's is
explicit freshness, so a discard *must* be followed by one). A page opts in through the optional
`hydrate.gen` reader, which today only `session-gate`'s `pageEntry()` wires. A *fifth* decision point
followed on 2026-08-10 (R11 C1, `docs/adr/0021`) — the **mutation settle signal**, an axis orthogonal
to the generation one. Optimistic mutators are mark-before-await (write the store + `markMutated()`
*first*, `await` the PATCH after), so "the PATCH is still in flight" is invisible to a generation
check: a GET leaving inside that window reaches the server before the write does, gets the old truth
back, finds the generation stable, and applies it — the exact GET/PATCH race `docs/adr/0020` had
explicitly left out of scope. So `markMutated(tail?)` now takes the mutation's network tail and books
it with `tail.then(done, done)` (a rejection settles too — failing that structurally rather than
trusting call sites to `catch`), `pendingSettle()` reports whether any tail is outstanding, and
`fetchGenStable` waits on it in a re-asking loop *before* capturing the generation and firing. **Wait
by tails, discard by generations, never swap the two** — the honest boundaries (a hung tail makes
refresh wait with it; a continuous mutation stream starves refresh until the user stops) are in the
ADR. When idle, `pendingSettle()` returns `undefined` **synchronously** — a hard contract, since one
extra microtask would push the generation capture past a caller's "refresh then synchronously
`markMutated`" and unpick R10's in-flight pins. Pages opt in through `hydrate.pendingSettle`, wired in
the same single line of `pageEntry()`; the enrolled call sites are `member/notifications.ts`'s
`markRead`/`markAllRead` — two since 2026-09-26, when mobile's twin pair merged into them (four before).
The gate's own
`generation`/`destroyed` bookkeeping (no page-local flag needed any more) still discards a response that
resolves after the page unmounts (member's read-state *mutations* —
`markRead`/`markAllRead`, optimistic update + PATCH + `markMutated()` — live in `member/notifications.ts`
since 2026-07-11, and since 2026-09-26 (R12) they are mobile's mutators too — mobile's former twin,
the leaf module `mobile/notifications.ts`, merged into that one module; the page keeps only the toast).
Mobile-admin's ops collections and
messages are store-owned: the write lives in `stores.ts`'s `hydrateOps`/`hydrateMessages`, which the gate
calls directly as `fetch`/`refresh` — the gate's own bookkeeping protects only the page's local phase,
never the shared store; store-write protection instead comes from the `*Hydrated` guard itself, which
mutators (`markOrderPaid`/`markMessageRead`) also flip true (a mutation *is* the session's
source of truth) and which is rechecked right before the hydrate write lands, so a mutation racing an
in-flight fetch always wins. The member/course/coach writes don't go through `markMutated()` at all:
Task 20 and Round 4's Task F5 moved them to the real `/users`/`/courses`/`/coaches` API followed by an
unconditional `refreshOps()` refetch, and since 2026-09-26 (R12, `docs/adr/0022`) that pairing lives
*in the store* rather than at four call sites — per-entity, add/edit-split write verbs
`addMember`/`saveMember`, `addCourse`/`saveCourse` (body built by desktop's `buildCourseBody` against
the current `$coaches`) and `addCoach`/`saveCoach` (wrapping `coach-save.ts`, returning its outcome
untouched). Each verb throws on a failed write (coach verbs return the failing outcome) and otherwise
awaits the refetch before resolving, so a caller's success toast lands together with the updated list;
a failed refetch after a successful write is only `console.error`ed. There's deliberately no generic
CRUD helper and no `isNew` flag (`docs/adr/0018` C6, `docs/adr/0012`). "Unconditional" describes the
refetch *call*, nothing guards it; what it *applies* has been generation-stable since R10, see
`docs/adr/0020`. `markOrderPaid(order)` is the one write that doesn't refetch: since R12 it
`PATCH`es `/orders/{id}/status` first, then applies the server's status to `$orders` with desktop's
`applyStatusChange()` (so 收款時間 shows the order date), then `markMutated()`. The same gate also
publishes `opsPages` (backend `total`/`perPage` for the page-1-only members/classes/orders lists), which
the three pages show as header totals plus a `searchCapHint()` line once `total > perPage`. That store-owned
guard + post-await re-check
protocol is itself a shared factory since 2026-07-08 — `src/lib/hydration-gate.ts`'s
`createHydrationGate` (`hydrate`/`refresh`/`markMutated`, plus the read-only `mutationGen` reader since
R10), which `mobile-admin/stores.ts`'s
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
`MyCourseDetail`'s open-refresh — accepting once-per-session freshness, with in-flight
cross-login responses discarded since R7 and, **as of 2026-08-03 (R10 A), the explicit-refresh window
closed too**: `gate.refresh` runs the generation-stable refetch loop, so a cancel landing inside that
window discards the stale snapshot and refetches instead of reverting the row to pending.
`docs/adr/0016`'s second known-latent is closed by `docs/adr/0020` — deliberately *not* by extending
mutation-wins into refresh, which that ADR records as an explicit rejection. Separately, member's
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

Two shapes exist for a page whose data already lives in a cross-route store (`docs/adr/0008`); a third,
mobile's own notifications shape, merged into member's on 2026-09-26 (kept below as history). Picking
between them only depends on one question — can the store's hydration be triggered from more
than one place, independent of any single page's own load-gate?

- **member notifications — several entry points, one shared flag**: the notifications *page* drives its own
  load-gate, and `member/api.ts`'s `getDashboard()` also opportunistically hydrates the same store
  (`hydrateSessionStores`, see above) — independent triggers that must agree on one guard (since
  2026-09-26 mobile's notifications page is a third, see the next bullet). The store
  therefore owns a full `createHydrationGate` instance (wrapped by `createSessionGate`, see the next
  section), and the page's `createLoadGate({ ...notificationsPageEntry })` reads/writes that *same*
  `gate.hydrated` writable rather than declaring its own.
- **mobile notifications — merged into member's since 2026-09-26**: mobile used to have its own
  shape here. Until 2026-08-03 `notifsHydrated` was a plain `writable(false)` with hand-flipping
  mutators; R9 C3 (`docs/adr/0019`) rebuilt it as the leaf module `src/lib/mobile/notifications.ts` on
  its own `createSessionGate`, deliberately *not* re-exported from `mobile/stores.ts` to avoid a
  `stores ⇄ api` cycle. That module was a near-verbatim twin of member's — same endpoint, same
  `mapNotification`, same gate — over the same server-side read state, so R12 (`docs/adr/0022`) deleted it.
  Mobile now reaches member's gate through its own seam: `mobile/stores.ts` re-exports
  `notifications`/`unreadCount`/`notificationsHydrated`/`notificationsPageEntry`/`markRead`/`markAllRead`
  from `$lib/member/stores`, which no longer closes a cycle. The mobile notifications page is therefore a
  third entry point into the member shape above, and a read on one surface shows on the other in the same
  session.
- **mobile-admin ops/messages — store-owned, multiple mutators**: `hydrateOps`/`hydrateMessages` (and
  their `refresh*` counterparts) live in `stores.ts`, not the page — the page's gate calls them directly
  as its `fetch`/`refresh`. Several mutators (`markOrderPaid`/`markMessageRead`) can flip the guard, and
  none of them is "the page", so the fetch/apply/guard lifecycle has to live where the mutators do: the
  full `createHydrationGate` factory, store-owned. Their `refresh*` counterparts get the generation-stable
  refetch for free since R10 — the store-owned gate holds the mutation generation itself, so no page-side
  `hydrate.gen` wiring is involved; "write → `markMutated` → `await refreshOps()`" stays a single fetch
  whose snapshot applies as before (`docs/adr/0020`'s conservation pin). Neither mutator enrols a settle
  tail in R11's fifth decision point, deliberately: `markOrderPaid` (a real `PATCH` since R12, see
  above) only calls `markMutated()` after the write has already settled, so there's no in-flight tail
  to book, and `markMessageRead`'s fire-and-forget is a standing decision — booking it would make
  `refreshMessages()` start waiting on a read receipt, which is a behaviour change, not a fix
  (`docs/adr/0021`). The overlay screens sitting on this store got consistent about their own three
  states on 2026-08-10 (R11 C3): `CoachesScreen` replaced its `onMount` self-hydrate with
  `createLoadGate({ fetch: hydrateOps, refresh: refreshOps })` + `<LoadGate>`, so its coach cards no
  longer render seed rows (editable ones, at that) during the hydrate window — the risk `docs/adr/0016`
  had parked as a future candidate, now closed; `stores.ts` itself needed no change.

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

`src/lib/session-gate.ts` (2026-07-22, R7 C1, `docs/adr/0017`) is the single source. It shipped with
three factories; since 2026-08-03 (R9 C3, `docs/adr/0019`) it has **two**, both sitting between
`authStore` and the domain stores:

- **`createSessionGate<T>({ fetch, apply, reset })`** — waitlist / leave / notifications (one gate
  shared by member and mobile since 2026-09-26; mobile had its own until then). Builds a `HydrationGate` (via `createHydrationGate`) plus `mutate(request, writeBack)`,
  which absorbs what used to be five hand-copied mutator skeletons: snapshot hydration state + epoch
  before `await`, discard an epoch-stale write-back (result still returned — the server-side effect
  already happened), re-check completeness on write-back (a prior reconcile may have flipped the flag
  back to `false`), `markMutated()`, then conditionally queue a serialized, retryable reconciliation
  refetch. It also returns **`pageEntry()`** (R9 C3): the `{ fetch, hydrate }` pair a page needs to
  build its own load-gate, where `fetch` is the *epoch-checking* one and `hydrate.flag`/`hydrate.into`
  are the gate's own `hydrated` writable and `apply` function — same instances, not copies. Since
  2026-08-03 (R10 A) the pack also carries `hydrate.gen` — `gate.mutationGen`, the same reader — so the
  page's refresh family and the store gate read **one** mutation-generation ledger rather than each
  keeping its own. That closes the reconcile window for free: `queueReconcile` is byte-for-byte
  unchanged, because a reconcile refetch whose snapshot predates a later mutation is now discarded and
  refetched by `gate.refresh`'s own generation check instead of needing a second queued reconcile
  (`docs/adr/0020`).
- **`createSessionRefresher<T>({ fetch, apply, reset })`** — points / subscriptions. Keeps their
  pre-existing unconditional-refetch semantics (no guard) but adds identity-change reset and *silent*
  in-flight cross-login discard (`return`, not `throw` — throwing would inject a new "switched
  accounts" failure mode into `redeemReward`'s and `placeOrder`'s existing rejection chains).

The retired third factory was `onSessionReset(reset)` — reset-only, gate ownership left with the
caller — whose sole consumer was mobile notifs; once that store moved onto a full `createSessionGate`
in R9 C3 it had no production callers left and was deleted along with its test describe.

Each factory call opens its own `authStore` subscription (five module-level subscriptions total since
mobile's notification gate merged into member's in R12; six before) rather than sharing a registry. Session-gate is deliberately *not* folded into
`hydration-gate.ts` itself: that module is consumed by ~49 pages across every surface including
`staff`/`mobile-admin`, whose identity source isn't member's `authStore` — folding member-auth
awareness into the repo's widest shared seam would be a wrong-direction dependency.

This closed two real cross-login leaks (notifications, mobile notifs) and the points/subscriptions
residual window that `docs/adr/0016` had flagged as "not in this round's write set, tracked
separately." The one known-latent gap it left open — symmetric across `member`'s notifications page and
mobile's notifications screen, where each page's own `createLoadGate({ fetch: getNotifications, hydrate })`
called the raw API getter directly and so escaped the epoch check — **is closed as of 2026-08-03**
(R9 C3). Both pages now spread the gate's own entry pack — since 2026-09-26 the *same* pack,
`createLoadGate({ ...notificationsPageEntry })`, mobile's reached through `mobile/stores.ts` — and can no
longer reach a raw getter. The original judgement
call stands unchanged: epoch knowledge still lives only in `session-gate.ts`, `load-gate.ts` still knows
nothing about it, and `session-gate.ts`'s only new dependency on it is a type-only
`import type { LoadGateHydrateOptions }`. There is no new code path either — a stale response makes
`epochFetch` throw, which lands in the load-gate's existing error state, and the user's retry re-enters
the *same* `epochFetch` under the new epoch. See `docs/adr/0019` for the full walkthrough and
`docs/adr/0017` for why the guard-short-circuit and navigate-away cases were already safe.

## Single-page controllers, orchestrators, and twin modules (coach, admin, member)

Some pages have a same-page-only state-orchestration layer thick enough to be worth extracting into a
sibling `.ts` (per the Testing convention below) but not general enough to become a shared
`lib/<surface>/` module consumed by more than one caller — see `docs/adr/0012` for the four-part test
this round (K1/K3/K4) settled on, and its contrast with the cross-page "list-page controller factory"
that `docs/adr/0011` already rejected.

- **`src/lib/coach/attendance-controller.ts`**'s `createAttendanceController` (K1) sits in front of
  `coach/attendance/+page.svelte` — since 2026-09-26 (R12) it also owns the draft transitions, which used
  to be the separate pure reducer `attendance-draft.ts` and are now non-exported internals tested through
  the controller's interface (since 2026-08-03,
  R10 B, mobile-admin's coach attendance page is a second caller — it joined the sanctioned twin class
  below, `docs/adr/0014`): a single
  `AttendanceViewState` snapshot store replaces five mirrored page variables, with `saveAttendance` and
  an optional `now` (defaulting to the exported `nowHHMM` since R12) injected as deps (no Svelte component/lifecycle imports — `svelte/store` only — and construction is
  side-effect-free, SSR-safe). `save()` layers an incrementing
  save-token guard on top of the pre-existing state-based stale guard — not a replacement for it —
  closing a latent ABA hole where an in-flight save's late response could land on a class switched away
  from mid-save. Since R12 (D1, `docs/adr/0022`) attendance notes are honestly local-only: the backend's
  `PUT /sessions/{id}/attendance` has no notes field, so `applyNote` only writes `notes` and no longer
  marks the draft dirty, and both note editors say 「僅存本機，重新整理後會消失」.
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
  fifth: the 結帳 payment lifecycle as a three-field snapshot store (`step`/`paying`/`paid`)
  with `placeOrder` as the single injected dep. The idempotency-key lifecycle (fresh key per checkout
  open, same key across a failed retry — the double-charge safety machine), `setOpen` edge detection
  (`freshCheckout | resumedInFlight | noop`) and the paying guard live inside, returning `kind`-tagged
  outcomes (`orderPlaced`/`orderFailed`/`alreadyPaying`/`nothingChargeable`, original throwable passed
  through) so toast text and all form/preview state stay on the component — this supersedes
  `docs/adr/0008`'s "keep the double-charge guard in the dialog" note; `docs/adr/0016` records the
  re-adjudication. Since 2026-08-10 (R11 C2) it has **two** consumers on **different lifecycle layers,
  with no branch inside the machine**: member's `CheckoutDialog` never unmounts across a checkout, so it
  drives the key through `setOpen`'s closed→open edge (`freshCheckout` re-issues, `resumedInFlight`
  keeps an in-flight attempt alive); mobile's `CartSheet` is *per-mount* — the overlay host's `{#if}`
  rebuilds it on every open, so it news up its own controller each time and **deliberately never calls
  `setOpen`**, the constructor-time key being that checkout's key, with a failed retry reusing it via
  `confirmPay`'s existing catch path. `CartSheet` dropped its hand-rolled twin of the same machine
  (local `step`/`paying`/`paid` plus its own `crypto.randomUUID()`) and is now a thin adapter, reaching
  the factory through `mobile/stores.ts`'s seam; the two mount-level invariants are pinned by
  `checkout-controller.test.ts`'s own "mount 級生命週期" describe (`docs/adr/0014`, `docs/adr/0012`).
- **`src/lib/coach/messages-controller.ts`**'s `createMessagesController` (2026-07-23, R8 C1) is the
  sixth: `coach/messages/+page.svelte`'s conversation-thread orchestration as a single
  `MessagesViewState` snapshot store, with `getThread`/`markRead`/`sendMessage`/`getStudents`/
  `createConversation` injected as deps. `selectThread` returns two independent promises rather than a
  single outcome — `threadReady` layers an incrementing-token stale-guard (the same shape as
  `attendance-controller`'s save-token guard) over the `getThread` fetch, while `badgeCleared`
  (`markRead`) is deliberately unguarded and never blocks on `threadReady`, so a stuck read-receipt call
  can't delay the thread-loaded/failed toast; `send`'s stale-response guard instead re-checks a captured
  `conversationId` snapshot; `confirmCompose`'s `creating` guard mirrors `checkout-controller`'s
  `alreadyPaying`. `closeCompose()` — not in the original card scope — was added when wiring surfaced a
  latent bug: once `composeOpen` moved into the controller's snapshot, assigning it directly from the
  page (the old `Dialog onClose` idiom) only touched the page's destructured mirror, which the
  controller's next `publish()` would overwrite back to `true`. Toast text, the conversations list and
  its gate, and the tab×search filtering (still `conversations-filter.ts`, K3) stay on the page;
  `docs/adr/0018` records the criterion walkthrough.
- **`src/lib/member/mine-controller.ts`**'s `createMineController` (2026-08-03, R10 D) is the seventh
  and the second in `messages-controller`'s shape: member/mine's *inner* coordination — course
  selection × the in-card attendance-history load × the waitlist-cancel busy guard — as one
  `MineViewState` snapshot (`active`/`attState`/`attendance`/`cancellingId`) with
  `getEnrolmentAttendance`/`cancelWaitlist` as its only deps. The page's inner `attGate` is gone; the
  same "latest request wins" invariant now comes from the controller's own incrementing `seq`/`token`
  guard (`attendance-controller`'s shape again), and "write `active` before fetching" is structural
  rather than a comment — `fetchAttendance(id)` takes the id as a parameter and never reads the
  `active` closure. Toast copy and the outer `getMine` gate stay on the page; the 24 existing page
  tests are byte-for-byte unchanged (`docs/adr/0012`, `docs/adr/0008`).
- **`src/lib/public/contact-form.ts`**'s `createContactForm` (2026-08-03, R10 C) is the eighth and
  `public`'s first form machine: `ContactForm.svelte`'s four sequential validation guards, submit and
  3-second reset choreography, with `send` and `schedule: (fn, ms) => cancel` (a timer effect, the same
  injection habit as `attendance-controller`'s `now`) as deps and 洽詢-domain outcome kinds
  (`inquirySent`/`validationFailed`/`failed`/`alreadySubmitting`). It also draws a boundary the ADR now
  states outright: *validation* copy lives in the machine as exported consts (single string source for
  the module's own mapping and the component's inline error box — `login-submit.ts`'s
  `EMPTY_FIELDS_ERROR` was the precedent), while *toast* copy stays at the call site as criterion ④
  always required. A real bug fell out of the extraction: a leftover reset timer from an earlier
  successful submit used to cut the next success message short (`docs/adr/0012`).
- **`src/lib/mobile/pref-sync.ts`**'s `createPrefSync` (2026-08-10, R11 C4) was the ninth — since
  2026-09-26 (R12) it's reclassified as a mobile-shared module and the roster is back to eight (see the
  end of this bullet): mobile's
  account-settings preference sync — background hydrate on mount, optimistic per-key writes, one
  in-flight `saveChain`, a whole-object resync when a save fails and a single-key rollback when the
  resync fails too — with `getPreferences`/`savePreferences` as its I/O deps and domain outcome kinds
  (`saved`/`resynced`/`rolledBack`). Unlike the other eight it does **not** own its state store:
  `prefs` is the caller's pre-existing cross-screen singleton, injected as a dep and still bound
  directly by the markup, so the module owns write *timing* and serialization only and its return type
  isn't a `Readable`. The invariant worth knowing: a queued save does **not** freeze its snapshot when
  queued — it re-`get()`s the whole object when its turn comes, so rapid toggling always stacks on the
  latest state including a previous failure's rollback. `SettingsScreen.svelte`'s preference-sync
  orchestration dropped from 41 lines to a 13-line shell (the component's `<script>` as a whole is
  still ~64 lines — logout, the save button and the markup bindings never moved), and five
  render-dance tests moved to `pref-sync.test.ts` as no-render units (`docs/adr/0012`). R12 fixed
  `EditProfileSheet` bypassing it, which gave it a second caller on the same surface. So it now exports a
  module-level singleton `prefSync`, and both screens share one `saveChain` against the one `prefs`
  store: two instances would each serialize only their own writes. That makes it a mobile-shared
  store-sync module rather than a single-page controller. It isn't a desktop↔mobile twin either
  (`docs/adr/0012` R12 addendum).

The same deps-injected, outcome-tagged shape also has a sanctioned *twin* variant since 2026-07-16 —
modules whose callers are desktop↔mobile twins with byte-identical orchestration rather than a single
page: `member/leave-form.ts` (the 請假/補課 form machines behind `LeaveDialog`/`MakeupDialog` and
mobile's `LeaveSheet`/`MakeupSheet`) and `member/cancel-leave.ts` (the shared cancel-leave busy guard
behind member/mine and mobile's `MyCourseDetail`). Gate wiring, error mappers, and toast copy stay at
each call site — `docs/adr/0012`'s criterion ① is relaxed for exactly this class by `docs/adr/0014`.
Since 2026-07-23 (R8 C2) `admin/settings-form.ts`'s `createSettingsForm` joins this class too — the
admin desktop settings page and mobile-admin's `AdminSettingsScreen` share one factory for their
byte-identical 10-field draft-flattening/assembly orchestration, deliberately *not* split into a
leave-form-style shared core plus two wrapper factories since there's only one outcome domain to serve
(`docs/adr/0018`). Since 2026-08-03 (R10 B) `coach/attendance-controller.ts` joins it as well: the
mobile-admin coach attendance page dropped its hand-copied thin orchestration (five mirrored variables
plus its own saved/saving flags) and became a second caller, taking desktop semantics with it — an
unsaved draft survives a class switch, switching mid-save is blocked with a toast, a late save response
is dropped as `stale`, and (until R12's D1 made notes local-only) note edits counted as unsaved
changes. The mapping layer that used to reshape
the desktop seam's rows for it (`mapAttRow` plus `RosterEntry`/`ROSTER`) retired in favour of a
zero-mapping re-export from `mobile-admin/api.ts` (`docs/adr/0014`). Since 2026-08-10 (R11 C2)
`member/checkout-controller.ts` is in the class as well — mobile's `CartSheet` retired its hand-rolled
payment machine and became the factory's second caller (details in the controller bullet above), which
also reverses `docs/adr/0016`'s original "非 twin: mobile CartSheet's payment flow is structurally
different" note: the difference turned out to be *wiring* (who supplies `placeOrder`, who drives the
lifecycle), not the machine. The same batch single-sourced the twins' coupon-apply step as
`member/checkout.ts`'s `applyCouponCode` (trim guard + `validateCoupon` + one shared 404/network copy),
collapsing both call sites to three lines; `validateCoupon` itself stays exported because its three
unit tests are the only pin on the 404-vs-other-error split that `applyCouponCode` merges away.
Since 2026-07-22 (R7 C8) `src/lib/login-submit.ts`'s `submitLogin(io: LoginSubmitIO)`
pushes the pattern further still — an IO-callback orchestrator, not a deps-injected snapshot store,
shared by *four* surfaces' login pages (`member`/`mobile`/`mobile-admin`/`staff`) rather than a
desktop↔mobile pair. It collapses what used to be a byte-identical `submit()` skeleton (re-entrancy
guard → optional empty-fields check → clear error, lock → login → resolve a role-based redirect target
→ navigate → catch → unlock) into
one module; each page keeps its own `let busy`/`let error` locals and markup unchanged, wiring them
through the `LoginSubmitIO` callbacks. Since 2026-08-03 (R9 C1, `docs/adr/0019`) the same file holds
three siblings covering member's other three auth pages — `submitRegister`, `submitPasswordReset` and
`submitForgot`, each with its own narrow IO interface (`RegisterSubmitIO`/`PasswordResetSubmitIO`/
`ForgotSubmitIO`) — deliberately *not* refactored into a shared private core or a generic
`submitAuthAction`: the four functions' success side effects and catch policies genuinely differ
(register always has a redirect target, password-reset neither navigates nor logs in, forgot swallows
the error silently), and the timing contracts they encode differ in the same breath — `navigate`/
`onSuccess` fire *before* the `finally` unlock while forgot's `onSettled` fires *after* it. Forgot's
anti-enumeration guarantee is structural rather than documentary: `ForgotSubmitIO` simply has no
`setError`, so no call site can leak whether the address existed.

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
