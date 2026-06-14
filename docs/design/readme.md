# Dream Fly 夢飛 — Design System

The brand and product design system for **Dream Fly 夢飛體操館** — a professional gymnastics & cheerleading academy (體操館) offering 幼兒體操 (toddler gymnastics), 兒童基礎 (kids fundamentals), 競技啦啦隊 (competitive cheerleading), 成人體操 (adult gymnastics) and 跑酷 (parkour). The audience is Traditional-Chinese-speaking parents and students in Taiwan.

The identity pairs an **athletic-collegiate spirit** (the 狼爪 "wolf-claw" mascot, varsity DREAM FLY wordmark, DF monogram) with **clean, trustworthy digital product surfaces** (bright blue, generous white space, gold energy accents).

> **Brand theme colours: 藍 (blue) · 白 (white) · 黃 (gold).**

---

## Source materials

This system was reverse-engineered from assets the client provided. Keep these for reference (the reader may or may not have access):

- **`uploads/dream_fly.pen`** — a large design-tool document (~222k lines of JSON) containing a full multi-surface product design: marketing site, courses/member experience, commerce/ticketing, member account, mobile app, admin backend, coach portal, and a `SEC/DesignSystem` token sheet. **All token values in this system were lifted verbatim from its `variables` block.** Authentic Traditional-Chinese product copy throughout was sampled from here.
- **Logo artwork** (now in `assets/`):
  - `原-狼爪中文夢飛LOGO透明圖.png` → `assets/logo-wolfclaw-full.png` (primary mark, transparent)
  - `原-DF英文狼爪.jpg` → `assets/logo-df-monogram.png` (navy DF-in-claw, knocked-out transparent)
  - `DFT恤萬年款正面JPG檔.jpg` → `assets/logo-dreamfly-cheerleading.jpg` (varsity apparel lockup)
- No external Figma/GitHub/codebase was attached — the `.pen` file is the source of truth.

---

## CONTENT FUNDAMENTALS

How Dream Fly writes.

- **Language:** Traditional Chinese (繁體中文) first, with English used as supporting kickers/labels (e.g. `COURSES · 課程分類`, `DESIGN SYSTEM · 設計規範`). The brand name stays bilingual: **Dream Fly 夢飛**.
- **Voice:** warm, reassuring, parent-to-parent. The copy lowers the barrier to trying — it never hard-sells. Signature line: **「先試一堂，再決定孩子的體操路線」** ("Try one class first, then decide your child's gymnastics path").
- **Person:** speaks to the parent about *their child* (孩子) and to students as *you* (你/您). Polite but not stiff.
- **Concreteness over hype:** specifics build trust — `15 分鐘評估 + 60 分鐘體驗`, `小班制`, `每班 6–8 人`, `1:6 師生比`, `3 歲起`. Numbers are real and reassuring, never vanity metrics.
- **CTA style:** short, action-first verbs — `預約免費試上`、`查看課程與時段`、`加入購物車`、`立即報名`. The single strongest CTA may use the gold accent button; everything else is blue.
- **Casing:** English set in UPPERCASE for kickers/wordmark (DREAM FLY), Title/Sentence case for UI labels. No ALL-CAPS Chinese.
- **Emoji:** used *sparingly* and only in friendly product chrome (a section title 🧩, a dashboard greeting 👋). Not in marketing headlines, never decorative spam.
- **Tone words:** 安全 (safe), 專業 (professional), 循序漸進 (step-by-step), 信任 (trust), 自信 (confidence).

---

## VISUAL FOUNDATIONS

- **Colour vibe:** bright, optimistic, athletic. **Blue `#0066CC` leads** (primary actions, links, active states); **gold `#FFD700` is the energy accent** (one strong CTA, "最受歡迎/熱門" flags, hero highlights, stars) — used in small doses against blue/navy. **Deep navy `#0F172A`** is the "ink": hero overlays, footers, the logo claw, admin sidebar. White grounds everything.
- **Backgrounds:** light surfaces (`#F8F9FA` page, `#FFFFFF` cards). Heroes are **full-bleed gymnastics photography** under a navy left-to-right gradient overlay (`#0F172AF2 → #0F172A55`) for legible white text. Dashboards use a blue→darker-blue gradient banner (`115deg`). No noisy textures, no purple gradients.
- **Imagery:** real, warm, in-motion gym/cheer photography (kids tumbling, coaches spotting). Full-colour, bright, never desaturated or heavily filtered. Coach cards use portrait photos; member avatars fall back to a coloured initial (works with Chinese surnames).
- **Typography:** **Geist** for headings & admin chrome (geometric, confident), **Inter** for body/UI, **Geist Mono** for times/prices/IDs. Noto Sans TC backs all Chinese glyphs. Display 48 → xs 12 on a clear ramp. Headings 700; body 400/500; CTAs 700.
- **Corner radii:** controls `8px` (md), cards `12px` (lg), hero/dialog panels `16px` (xl), pills/badges/avatars fully round. Square `4px` only for tags. Friendly but not bubbly.
- **Cards:** white fill, `1px #E5E7EB` border, soft shadow (`0 4px 12px rgba(0,0,0,.08)`), 12px radius, 24px padding. Hover lifts `-2px` with a stronger shadow. Featured/selected cards get a `2px` blue border instead of an accent left-bar.
- **Elevation:** four soft, low-spread steps — `soft` (controls), `card` (resting cards), `lifted` (hover/toasts/popovers), `strong` (modals). Shadows are neutral grey/navy, never coloured.
- **Borders & dividers:** hairline `#E5E7EB`; emphasis `#CBD5E1`. Inputs use a 1.5px border that turns blue with a 3px blue focus ring (`rgba(0,102,204,.3)`).
- **Buttons:** filled blue (primary), filled gold w/ navy text (accent, rare), white + blue 1.5px outline (secondary), text-only (ghost), red (danger). Hover = `brightness(0.94)`; press = `translateY(1px)`. No glow, no gradient fills on buttons.
- **Motion:** quick and functional — `.15s` ease on colour/shadow/filter, `.18s` on card lift, `.4s` on progress-bar fills. No bounces, no infinite decorative loops. Reduced-motion friendly (visible end-state is the base style).
- **Transparency / blur:** sticky headers use `rgba(255,255,255,0.92)` + `blur(10px)`. Hero badges and dashboard banner chips use white at 12–16% opacity. Modal overlays are navy at 55% + slight blur.
- **Layout:** marketing content max-width ~1240px, centred, 32px gutters; product apps use a fixed left sidebar (240–248px) + sticky 64–72px top bar + scrolling content. 4px spacing grid throughout.

---

## ICONOGRAPHY

- **System:** **[Lucide](https://lucide.dev)** — the single icon library used across every surface (declared `"library": "lucide"` throughout the source). Stroke icons, ~2px weight, rounded caps/joins.
- **Delivery:** load via CDN — `https://unpkg.com/lucide@latest/dist/umd/lucide.min.js` — then place `<i data-lucide="name"></i>` and call `lucide.createIcons()` after render. Component cards & UI kits already do this.
- **Sizing:** 16–18px inline with text, 20–24px in buttons/nav, 26–28px in feature tiles. Icon colour follows context (primary blue on tints, `currentColor` in buttons, gold for stars/flags).
- **Common icons in use:** `graduation-cap, baby, rotate-cw, sparkles, dumbbell, flame, music, users, shield-check, award, medal, calendar-days, calendar-check, calendar-off, ticket, shopping-cart, credit-card, star, target, layers, check, plus, arrow-right, chevron-right/down, pencil-line, log-out, key-round, bell, search, settings`.
- **Emoji as icons:** only inside internal/admin section headers (🧩 元件, 🎨 設計系統, 🖥 桌機) and the occasional friendly greeting — never as primary UI iconography.
- **No hand-drawn SVG icons.** Use Lucide; if a needed glyph is missing, pick the nearest Lucide match rather than drawing one.

---

## INDEX — what's in this system

**Root**
- `styles.css` — the single entry point consumers link (imports only).
- `readme.md` — this guide. `SKILL.md` — portable Agent-Skill wrapper.

**`tokens/`** — `fonts.css` · `colors.css` · `typography.css` · `spacing.css` · `base.css`

**`assets/`** — logos: `logo-wolfclaw-full.png/.jpg`, `logo-df-monogram.png/.jpg`, `logo-dreamfly-cheerleading.jpg`

**`guidelines/`** — foundation specimen cards (Colors ×4, Type ×3, Spacing/Elevation ×3, Brand ×3) shown in the Design System tab.

**`components/`** — reusable React primitives (namespace `window.DreamFlyDesignSystem_9975ce`):
- `core/` — **Button, IconButton, Badge, Tag, Avatar, Card**
- `forms/` — **Input, Select, Checkbox, Radio, Switch**
- `feedback/` — **ProgressBar, Stepper, Toast, Dialog**
- `navigation/` — **Tabs**
- Each has `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md`; each directory has one `@dsCard` HTML demo.

**`ui_kits/`** — full-screen product recreations (each composes the primitives):
- `marketing/` — desktop marketing homepage (hero, courses, coaches, pricing, footer)
- `member/` — logged-in member web app (dashboard, course catalog, checkout stepper)
- `mobile/` — phone-framed member app (home, my courses, bottom nav)
- `admin/` — unified staff backend (role switch admin/coach, stat cards, member data table)

---

## Usage

Consumers link one file and read components off the namespace:

```html
<link rel="stylesheet" href="styles.css" />
<script src="_ds_bundle.js"></script>
<script>
  const { Button, Card, Badge } = window.DreamFlyDesignSystem_9975ce;
</script>
```

Build product UI by composing primitives; reach for the UI kits as starting layouts. Stay on token variables (`var(--df-*)`) — don't hard-code hexes.

## Caveats / substitutions

- **Fonts** (Geist, Geist Mono, Inter, Noto Sans TC) load from **Google Fonts** rather than bundled `@font-face` binaries, so the compiler reports "Fonts: none" — this is expected. Swap to self-hosted files if you need offline/locked builds.
- **Photography** in the kits uses Unsplash placeholders for gym/coach imagery — replace with real Dream Fly studio photos before production.
- The athletic varsity wordmark is a fixed **graphic asset**, not a webfont; use the logo PNGs for the mark, Geist for surrounding type.
