# Coach + Staff design sources — RECOVERY STATUS (2026-06-15)

These `docs/design/coach/*.jsx` and `docs/design/staff/login.jsx` are **recovered**, not the
original handoff export. The original Claude Design handoff
(`api.anthropic.com/v1/design/h/wgtN5uNGUL44_uqi0b3hqg`) now returns **404**, the local
extraction (job `0d509d32` tmp) was deleted, and the claude.ai "Dream Fly Design System"
project has **no coach/staff ui_kit** (only admin/marketing/member/mobile). Sources were
reconstructed from prior Claude Code session transcripts (Read tool-results, merged by
absolute line number; 0 content conflicts → numbering verified consistent).

## Fidelity per file
| file | status | line coverage | build basis |
|------|--------|---------------|-------------|
| `coach/data.jsx` | ✅ COMPLETE | 153/153 | byte-faithful |
| `coach/shell.jsx` | ✅ COMPLETE | 230/230 | byte-faithful |
| `coach/views_messages.jsx` | ✅ COMPLETE | 102/102 | byte-faithful |
| `coach/views_attendance.jsx` | 🟡 PARTIAL | 130/154 (gap L1–24) | jsx + plan |
| `coach/views_dashboard.jsx` | 🟡 PARTIAL | 125/268 (gaps L1–54,95–109,142–215) | jsx + plan |
| `coach/views_students.jsx` | 🟡 PARTIAL | 100/214 (gaps L1–59,90–144) | jsx + plan |
| `coach/app.jsx` | 🟡 PARTIAL | 33/60 (React wiring; not ported directly) | plan |
| `coach/views_settings.jsx` | 🔴 MISSING | 0 | **plan only** |
| `staff/login.jsx` | 🔴 MOSTLY MISSING | 22/204 (only `RolePortal` tail L183–204) | **plan only** |

Partial files are **line-aligned** (blank lines fill un-recovered ranges) so the
implementation plan's `file.jsx:NN` line citations still resolve.

## Implication for the build
The **data layer** + **shared chrome** (sidebar/topbar/profile-menu/notif-menu) + **messages
view** are byte-faithful. The 4 partial views are built from recovered jsx **+** the
codex-hardened plan. **`settings` + `login` are built from the plan only** — these two are the
ones to scrutinise for visual fidelity at review time.

## To raise fidelity (optional, user action)
Open `/Users/wilson08/Documents/dream_fly.pen` in Pencil. Once open, the coach/staff frames
can be read via the Pencil MCP for a pixel-level cross-check — most valuable for `settings`
and `login`. Without it, those two are reconstructed from the plan and flagged for review.
