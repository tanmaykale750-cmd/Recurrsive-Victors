<<<<<<< HEAD
# CaseCompass

**Legal case timeline and action organizer** (P-02, Domain 6: Public Systems & Civic Technology).

CaseCompass turns a bundle of case documents into a source-linked chronology. Every event, date and deadline points back to the document, page and exact sentence it came from. Unclear dates are quarantined instead of guessed, conflicting dates are shown side by side, and deadlines appear only when the record states them.

> CaseCompass organises the supplied record. It is not legal advice, does not predict outcomes, and does not connect to live court systems. The demo uses fictional case material only.

## Pages (workflow order, left sidebar)

| # | Page | What it does |
|---|------|--------------|
| 1 | **Dashboard** | Case header with stage progress; **Case health** red-flag widget (date conflicts, missing referenced documents, verified deadlines upcoming, plus quarantine and gap counts); needs-attention list; next deadlines; recent activity; ongoing / closed cases. Fits on one 1440×900 screen. |
| 2 | **Upload Documents** | Drag-and-drop PDFs, scans and images; processing queue with pipeline step per file; extraction drawer (Dates · Events · References · Rejected); searchable case bundle; expected-documents checklist by case type and stage. |
| 3 | **Case Timeline** | Timeline / List toggle. Interactive swim-lane timeline (Events, Hearings, Deadlines, Issues) with zoom (buttons, Ctrl/⌘ + scroll, fit), drag to pan, overview minimap, Today marker, arrow-key navigation and a detail panel. Filter chips: Deadlines only, Flagged only, document type. List view groups by month and keeps conflict records A and B together. |
| 4 | **Review & Resolve Issues** | Two-pane queue (Conflicts · Missing · Quarantined · Gaps) with status filter. Side-by-side conflict records, required reasons, missing-document actions (requested / link a file / not needed), the **Quarantined dates drawer** with one-step confirm, legal-term tooltips, notes, per-issue history, reopen, and a full correction-history drawer. |
| 5 | **Calendar & Deadline Tracker** | Month and week views showing verified deadlines and hearings only; entry popovers with source link and reminder switch; upcoming rail with optional reminders and lead times (7 / 3 / 1 days); `.ics` export. |
| 6 | **Chronology Report & Export** | Readiness check, include toggles, A4 paper preview: Part A verified chronology, Part B unresolved issues, Appendix A missing documents, Appendix B correction log. Real PDF and Word export generated in the browser. |

**Everywhere:** ⌘K / Ctrl+K (or `/`) command palette for pages, entries, issues, documents and glossary terms; source drawer showing document, page and exact sentence; plain-language jargon tooltips (switchable in Settings); light and dark themes.

## Design system

The redesign replaces the earlier dense, multi-colour interface with a calm, professional one. Full notes are in [`docs/design.md`](docs/design.md).

- **Tokens** live in `src/index.css`. Raw values sit on `:root` and `:root[data-theme="dark"]`; Tailwind reads them via `@theme inline`, so utilities such as `bg-surface`, `text-ink-2`, `border-line`, `text-danger` and `bg-warning-soft` follow the theme automatically.
- **Colour:** one accent (`primary`, muted legal navy) plus four status colours (`danger`, `warning`, `success`, `quarantine`) and `brass` for the logo mark and the report's "Court-ready" badge only. Each status colour has a `-soft` tint for icon chips and banners.
- **Type:** Inter for the whole UI (tabular numbers on dates and counts); Source Serif 4 only inside the report paper preview.
- **Theme toggle:** sidebar footer. The choice is saved in `localStorage` (`cc-theme`) and applied before first paint by a small script in `index.html`.
- **Sidebar:** 248px, collapsible to a 72px icon rail (saved as `cc-sidebar`), automatic rail below 1280px, off-canvas drawer below 768px.
- **Accessibility:** WCAG 2.1 AA contrast in both themes (verified with axe-core on every page), visible focus rings, labelled icon buttons, focus-trapped drawers that close on Esc, keyboard navigation in the timeline (← →), issue queue (↑ ↓) and segmented controls.

## Tech stack

- **React 19** + **Vite**
- **Tailwind CSS v4** (tokens via `@theme inline`)
- **Headless UI** (dialogs, drawers, popovers, listbox, combobox, disclosure, switch)
- **Floating UI** (tooltips and jargon decoder)
- **react-icons** (Lucide), **dayjs**
- **pdf-lib** (PDF) and **docx** (Word), loaded on demand only when you export
- `class-variance-authority`, `clsx`, `tailwind-merge`

## Getting started

Requires **Node.js 20 or newer**.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

Hash routing (`#/timeline`) means `dist/` works on any static host (GitHub Pages, Netlify, Vercel) without server configuration.

## Project structure

```
src/
  App.jsx                     page list (order = sidebar order) + routing
  main.jsx                    entry point: UiProvider + CaseProvider
  index.css                   design tokens (light/dark), base styles, utilities
  data/caseData.js            fictional demo case (replace with your API)
  state/
    CaseStore.jsx             case state: review status, corrections, notes, history, reminders, uploads
    UiStore.jsx               interface state: theme, sidebar, palette, history and quarantine drawers
  lib/
    selectors.js              timeline nodes, issues, filters, glossary matching
    report.js                 chronology report builder (shared by preview, PDF, Word)
    exportPdf.js, exportWord.js
    dates.js, kinds.js (theme colour mapping), router.jsx, cn.js
  components/
    ui/                       Button, Card, Badge, StatusDot, Citation, Callout, Progress,
                              ConfidenceMeter, EmptyState, Skeleton, CountUp, DateBlock,
                              SegmentedControl, FilterChip, Tabs, Switch, Field/Input/Select,
                              Tooltip, Drawer, JargonTerm (+ Decorated, Quote), Toaster
    layout/                   AppShell, Sidebar, Topbar, CommandPalette
    shared/                   SourceDrawer, SourceCard, HistoryDrawer, QuarantineDrawer,
                              QuarantineCard, form helpers
    dashboard/                CaseHealth, Panels (needs attention, deadlines, activity, cases)
    upload/                   Dropzone + queue, BundleTable, ExpectedDocs, ExtractionDrawer
    timeline/                 TimelineCanvas, Mark, NodeDetail, TimelineList, model
    review/                   IssueQueue, IssueDetail, IssueForms
    calendar/                 CalendarParts (month/week, popovers), UpcomingRail
    report/                   Paper (A4 preview)
  pages/                      the six pages (each under 130 lines)
```

## Connecting a backend

All demo data lives in `src/data/caseData.js`, and all case-state changes go through `src/state/CaseStore.jsx`. To connect your OCR and extraction service:

1. Replace the constants in `caseData.js` (`DOCS`, `ITEMS`, `GAPS`, `QUARANTINE`) with API responses. Keep the same shape: every item needs `doc`, `page` and `quote`.
2. In `CaseStore.jsx`, replace the simulated pipeline in `addFiles` with a real upload, and send `resolve`, `addNote` and `setStatus` to your API.
3. Set `TODAY_STR` from the real date (`dayjs().format('YYYY-MM-DD')`); it is fixed only so the demo stays stable.
4. Wire the source drawer's "Open document" button to your document viewer.

## Design rules the code enforces

- An item without a source sentence is never shown.
- Relative deadlines ("within two weeks") are never calculated; they stay quarantined until a reviewer confirms a date and its basis.
- Conflicting dates are never merged. Both records are shown until a reviewer picks one.
- Every correction needs a reason, is logged with a name and time, and can be reopened.
- The calendar and reminders only ever show verified dates.
- No outcome predictions or legal advice anywhere in the interface or exports.
=======
# Recurrsive-Victors
>>>>>>> cd260bfc27d23aa51294ed4d67bc456e64676eef
