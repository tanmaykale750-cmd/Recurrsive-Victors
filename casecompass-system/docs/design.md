# CaseCompass design notes

## What changed and why

The previous interface was functional but overloaded: a ~3,500px dashboard with nine stacked sections (including a full timeline and full calendar duplicated from their own pages), a disclaimer banner and a triple title on every page, a timeline page that stacked the graph above a ~2,000px expanded list, overlapping timeline labels, fourteen kind colours plus gradients, and a dark gradient sidebar that stopped short of the viewport.

The redesign kept every feature and rebuilt the presentation layer. In the full-stack version, case data now comes from the FastAPI backend (`src/state/CaseStore.jsx`, live bundle in `src/data/caseData.js`), and the PDF/Word exports are generated on the server.

## Density rules

- One H1 and one line of description per page. The sidebar shows the workflow step, so the content area does not repeat it.
- At most 4–5 blocks above the fold at 1440×900. The dashboard fits on one screen with no scrolling.
- One primary (filled) button per page view; everything else is secondary or ghost.
- Lists show five items with a "View all" link.
- Source sentences open in a right-hand drawer; secondary detail lives in tabs, popovers and expandable rows.
- Status is a dot plus a label, not a filled tag on every row.
- The disclaimer is a quiet line in the sidebar footer and in every export, not a banner.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#F7F8FA` | `#0E1116` | app background (`bg` in the original prompt) |
| `surface` | `#FFFFFF` | `#161A21` | cards, sidebar, drawers |
| `surface-2` | `#F1F3F6` | `#1D222B` | hover, selected rows, inputs |
| `line` | `#E4E7EC` | `#272D38` | 1px borders (`border` in the original prompt) |
| `ink` | `#111827` | `#E6E8EC` | primary text (`text`) |
| `ink-2` | `#4B5563` | `#A3AAB8` | secondary text (`text-2`) |
| `ink-3` | `#5E6A7D`* | `#8B93A2`* | meta, captions (`text-3`) |
| `primary` | `#2B4C7E` | `#7FA3E0` | brand, primary buttons, active nav, links |
| `primary-soft` | `#EAF0F8` | `#1E2A3D` | active nav background |
| `danger` | `#B83232`* | `#F07B7B` | date conflicts, deadlines ≤ 7 days |
| `warning` | `#8A5B00`* | `#E8B04B` | missing documents, deadlines ≤ 30 days |
| `success` | `#25734A`* | `#5FC48E` | verified / resolved, later deadlines |
| `quarantine` | `#6B5BC4` | `#A99BF0` | quarantined (uncertain) dates |
| `brass` | `#A3824F` | `#C9A774` | logo mark and the "Court-ready" badge only |

\* Darkened slightly from the brief's values (`#8A93A3`, `#C53B3B`, `#B7791F`, `#2F855A`, dark `#6B7382`) so small text meets WCAG AA (≥ 4.5:1), including coloured text on its own tint. Hues are unchanged.

Every status colour has a `-soft` variant (`color-mix` ~11% into `surface`) for icon chips and banners. `KIND_COLOR` in `src/lib/kinds.js` maps all timeline kinds onto these six colours as CSS variables, so they follow the theme.

## Type, shape, motion

- Inter 400/500/600 for the UI; scale 12 / 13 / 14 (body) / 16 / 20 / 24 (H1); only the health-tile numbers reach 32px. `tabular-nums` on dates, counts and tables.
- Source Serif 4 only in the report paper preview, so it reads like a court document.
- 8px grid, 10px card radius, 8px controls, 1px borders, shadows only on floating layers.
- 150–220ms ease-out; pages fade and rise 6px; drawers slide; health numbers count up once; hover changes background, never position. `prefers-reduced-motion` disables animation.

## The six USPs, where they live

1. **Court-Ready Chronology Bundle**: Report page (Part A / Part B / Appendix A / Appendix B, PDF + Word).
2. **Plain-Language Jargon Decoder**: `JargonTerm` / `Decorated` wrap glossary terms in every quote and title; tooltip on hover or focus; switch in Settings.
3. **Case Health ("Red Flag") dashboard**: `components/dashboard/CaseHealth.jsx`.
4. **Confidence-Gated Date Quarantine Drawer**: `components/shared/QuarantineDrawer.jsx` + `QuarantineCard.jsx`, opened from the Review header, the dashboard health footer and quarantine links.
5. **Multi-Filter Timeline**: filter chips on the Timeline page (slices + document types, combinable with search) and lane toggles.
6. **Court-Ready Report Export**: same as 1, with a readiness check before export.

## Verification performed

- `npm run build` passes with no warnings (vendor chunks split).
- Playwright screenshots of all six pages at 1440×900 and 390×844, light and dark; no horizontal page scroll at 390px.
- End-to-end flow on the production build: upload → extraction drawer → resolve a conflict with a reason → confirm a quarantined date → it appears on the timeline and calendar → reminder on → report toggles → PDF and Word downloads (contents checked) → command palette → jargon tooltip → theme and sidebar persistence.
- axe-core WCAG 2 A/AA scan: zero violations on all six pages in both themes.
