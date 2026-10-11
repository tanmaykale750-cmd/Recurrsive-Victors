# CaseCompass

**Legal case timeline and action organizer** (P-02, Domain 6: Public Systems & Civic Technology)

CaseCompass turns a bundle of case documents (PDFs, scanned pages, phone photos) into a source-linked chronology. Every event, date and deadline points back to the document, page and exact sentence it came from. Unclear dates are quarantined instead of guessed, conflicting dates are shown side by side, missing referenced documents are flagged, and the result exports as a court-ready Chronology of Events and List of Dates.

> CaseCompass organises the supplied record. It is not legal advice, does not predict outcomes and does not connect to live court systems.

---

## Quick start

### Option A: Docker (everything in two containers)

```bash
cp backend/.env.example .env          # optional: add GROQ_API_KEY
docker compose up --build
```

Open **http://localhost:8000** and create an account (name, phone, email, password). The app starts empty: create a case and upload its documents.

### Option B: Local development

Requirements: Python 3.11 to 3.13 (PaddlePaddle has no wheels for 3.14 yet), Node 20+, PostgreSQL 14+. OCR is PaddleOCR, installed by `pip`; nothing else to install. On the first scanned upload (or at startup) it downloads its models once, about 40 MB, into `~/.paddlex`. Supported: Linux x86_64/arm64, Windows x64 and Apple-silicon Macs (not Intel Macs).

```bash
# database
createuser casecompass -P            # password: casecompass
createdb casecompass -O casecompass

# backend  (http://localhost:8000, API docs at /docs)
cd backend
pip install -r requirements.txt
cp .env.example .env                 # set DATABASE_URL, JWT_SECRET, optionally GROQ_API_KEY
uvicorn app.main:app --reload

# frontend (http://localhost:5173, proxies /api to :8000)
cd ../frontend
npm install
npm run dev
```

### Tests

```bash
cd backend
createdb casecompass_test -O casecompass
python -m pytest -q                  # 32 tests: parsing, OCR layer, AI grounding, civil + criminal pipelines, API rules
```

The pipeline tests generate their own fictional documents in a temporary folder (`backend/tests/fixtures/bundles.py`) and upload them to a test database. Nothing is added to the application or to your real database.

---

## What it does (problem-statement features)

| # | Page | Features |
|---|------|----------|
| 1 | **Dashboard** | Ongoing and closed cases, recent activity, **Case Health** summary (date conflicts, missing referenced documents, verified upcoming deadlines, quarantined dates, other gaps), quick access to flagged issues, next deadlines. |
| 2 | **Upload Documents** | Drag-and-drop PDFs, scans, images and Word files; live processing status per file (6 pipeline steps); per-document extraction view (dates, events, references, rejected items); searchable case bundle; expected-documents checklist by case type and stage; open, re-process or remove a document. |
| 3 | **Case Timeline** | Interactive swim-lane timeline (zoom, pan, overview, keyboard) and a chronological list with source citations; filter chips for **Deadlines only**, **Flagged only** and **document type**; detail panel with the exact sentence, notes and date correction. |
| 4 | **Review & Resolve** | Side-by-side conflicting records; missing referenced documents; **Quarantined Dates drawer**; plain-language jargon tooltips; reviewer notes; corrections that require a reason; review status; full correction history; reopen any decision. |
| 5 | **Calendar & Deadlines** | Month and week views of verified deadlines and hearings; each entry links to its source document; optional reminders (in-app and as `.ics` calendar alarms). |
| 6 | **Chronology Report** | Chronology of Events and List of Dates with page-level citations; Part A verified entries kept separate from Part B unresolved issues; flagged contradictions; Appendix A missing documents; Appendix B correction log; **PDF and Word export** generated on the server. |

Accounts: sign up with **name, phone, email and password**. Every reviewer action is logged under that name. Each user sees only their own cases.

### USPs and where they live

| USP | Implementation |
|---|---|
| 1. Court-Ready Chronology Bundle Generator | `backend/app/reports/` builds one report structure that feeds the on-screen A4 preview, the PDF (ReportLab) and the Word file (python-docx). |
| 2. Plain-Language Jargon Decoder | `backend/app/glossary.py` (≈80 civil and criminal terms). Terms are highlighted in every quote and title; tooltips come **only** from the glossary. The AI never writes definitions. |
| 3. Case Health "Red Flag" dashboard | Counts come from the flagging engine and update as issues are resolved. |
| 4. Confidence-Gated Date Quarantine | `backend/app/parsing/dates.py` + OCR word confidences. Blurry, handwritten, illegible, vague or relative dates never reach the timeline; they go to the Quarantined Dates drawer, where a suggested date (if one could be read) can be confirmed in one click. |
| 5. Multi-Filter Timeline | Deadlines only (future, not yet completed on record), Flagged only, and by document type (Pleadings, Court orders, Notices, Applications); combinable with search. |
| 6. Court-Ready Report Export | Same report pipeline as USP 1, with a readiness check before export. |
| 7. Reviewer Notes and Dispute Resolution History | Notes on any timeline entry or issue; date corrections with a mandatory reason; extracted data is never overwritten (decisions are separate rows); every flag, note, correction and reopening is in the audit log with name and time. |

---

## Architecture

```
frontend/  React 19 + Vite + Tailwind v4        backend/  FastAPI + SQLAlchemy 2 + PostgreSQL
  pages/ (6 workflow pages + sign-in)              routers/   auth, cases, documents, review, exports
  state/CaseStore  ── REST /api ──────────────▶   services/  pipeline (background worker), bundle, timeline
  data/caseData (live case bundle)                 parsing/   text_extract (PyMuPDF), ocr (PaddleOCR),
                                                              sentences, dates, classify, lexicon,
                                                              references, analyze
                                                   flagging/  engine, sequence
                                                   ai/        groq (client), tasks (grounded prompts)
                                                   reports/   builder, export (PDF / DOCX)
```

**Data principle:** extracted records (documents, pages, events, references) are evidence and are never edited. Reviewer decisions (resolutions, event corrections, notes, statuses) are separate rows that can be withdrawn; the audit log is append-only.

### Document parsing pipeline

Each upload runs through a single background worker (so flag recomputation never races). The UI shows each step live.

1. **Reading text (OCR):** every PDF page is inspected with **PyMuPDF** first.
   - *Text layer* pages are read directly.
   - *Scans* are rendered (at the scan's own resolution, up to 300 dpi) and read with **PaddleOCR** (PP-OCRv6 detection + recognition, with automatic rotation of sideways pages). This includes scans that carry a scanner's invisible OCR layer (its dates are not trusted), pages whose text layer is garbled, and scans with only a thin typed stamp on top, such as an e-filing or digital-signature footer (common in eCourts downloads).
   - *Mixed* pages, typed text with a pasted scan such as a received stamp, keep their text layer and OCR each image region, in reading order.

   Images and multi-page TIFFs go straight to OCR; Word files are read directly. OCR output is laid out into lines and paragraphs, and common OCR glitches are repaired (missing spaces such as "before16.10.2026", "framed.Matter", "beforethe"). Every OCR'd word keeps a confidence as a character span, and dates get extra checks:
   - **Second read:** each date is cropped from its line and recognised again on its own, keeping per-character probabilities. A date is only as confident as its weakest digit.
   - **Disagreement or stain:** if the two reads disagree, or grey ink stains the date, it is held below the threshold.
   - **Unread ink:** ink between words that produced no text becomes an `[illegible]` token, so "Received on [smudge]" is flagged instead of silently dropped.

   On 180 deliberately damaged test dates, no wrong date was ever trusted; clean and highlighted dates on noisy phone-style images all passed.
2. **Classification:** rule-based scoring of headings, body and filename assigns a document type and the stage-template document it corresponds to (e.g. *Written Statement*, *Final Police Chargesheet*). The AI is consulted only when the rules are unsure, and must choose from the same closed list. Identifiers (IA numbers, case numbers, FIR numbers, exhibit marks), the document's own date and a readable title are extracted.
3. **Finding dates and events:** sentence segmentation tuned for Indian legal text (dates such as 12.01.2026, "No.", "Pvt. Ltd.", "M/s", "Hon'ble"). A **deterministic date engine** classifies every date-like expression: exact, approximate ("on or about"), OCR-repaired, month-only, relative ("within two weeks"), vague ("late autumn of the preceding year"), illegible ("1?/0?/2026", or a date slot whose OCR words fall below the confidence threshold) or invalid. Only exact, confidently read dates become events. Dates that merely identify another document ("order dated 22.05.2026") are kept as references. In a court order, operative sentences with no date of their own ("an injunction is granted") take the order's date, which is labelled as such.
4. **Linking source sentences:** every event is checked to be a verbatim sentence of its page before it is stored. Anything that fails is rejected and listed as rejected.
5. **Checking references:** specific references (orders by date, IA and other numbered applications, FIRs, exhibits, named reports, seizure memos) are matched against every document in the bundle.
6. **Flagging** (whole case): see below.

### Where AI is used (Groq), and where it is not

Set `GROQ_API_KEY` to enable it. Without a key, or if the API fails, everything runs rule-based. The sidebar shows which mode is active, and each document records whether AI was used.

| Task | What the model does | Guardrail |
|---|---|---|
| Event refinement | Writes short neutral titles, decides event / hearing / deadline, identifies the party, and spots dates that only refer to another document. | The model only sees sentences the parser found, with the dates the parser read. Any date not in that list, any unknown sentence id or any malformed output is **rejected** and shown in the document's *Rejected* tab. |
| Document classification | Picks a type when the rules are unsure. | Must choose from the closed list of types and templates. |
| Same-event matching | Decides whether two differently worded sentences describe the same act (for borderline conflict candidates). | Only consulted for pairs already similar by wording; rules decide clear cases. |

**Not AI:** reading and normalising dates, OCR confidence gating, deadline calculation (never done), jargon definitions (glossary only), legal advice or outcome predictions (never).

### Flagging rules

| Flag | When it is raised | Notes |
|---|---|---|
| **Date conflict** | The same real-world step (e.g. *legal notice received by Defendant*, *summons served on Defendant*, *accused arrested*) is dated differently in different records. | Records are clustered by a procedural lexicon (civil and criminal steps, party-aware, application-number-aware) plus wording similarity. Same-date records are merged as **corroboration** ("also stated in D05 p.1"), never as conflicts. |
| **Missing referenced document** | A specific document is referred to but nothing in the bundle matches it. | Closes automatically, with a logged reason, when the document is uploaded ("now in the bundle as D13"). |
| **Quarantined date** | Low OCR confidence (< 85% by default, weakest character of a second read), illegible stamp or unread ink after a date cue, vague or month-only wording, approximate dates, OCR-repaired digits, impossible dates, or relative deadlines. | Relative deadlines are never calculated. If their base date is itself in conflict, the note says so. |
| **Undated event** | A procedural step (mediation, arrest, seizure, reply filed …) is mentioned but never dated anywhere in the record. | |
| **Skipped step** | Case-type sequence rules, e.g. counter-claim with no reply; plaint with no proof of service; bail application with no order; chargesheet with no cognizance order; charges framed with no plea; conviction with no order on sentence. | Wording states what is not on record, never what should happen. |
| **Deadline completed** | A stated deadline whose completing step is on record (e.g. written statement filed on 08.04.2026, before the 10.04.2026 deadline). | Completed deadlines drop out of *Deadlines only* and the upcoming list. |

Issues have stable fingerprints, so a reviewer's status, notes and decisions survive re-processing. When a condition disappears, the issue closes automatically; if it returns, the issue reopens.

### Case-type document templates

`backend/app/stages.py` holds the stage-by-stage expected documents for **civil suits** (pre-suit and initiation → defence entry → interlocutory motions and discovery → trial and evidence → final disposal and appeal), **criminal cases** (registration and investigation → chargesheet and cognizance → pre-trial and framing of charges → trial → verdict) and **tribunal / consumer** matters. Uploaded documents are mapped to these templates to show the current stage and which expected documents are not in the bundle.

---

## API overview

Interactive docs: `http://localhost:8000/docs`

| Method & path | Purpose |
|---|---|
| `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` · `PUT /api/auth/me/settings` | Accounts (name, phone, email, password) and reviewer settings |
| `GET/POST /api/cases` · `PATCH/DELETE /api/cases/{id}` | Cases |
| `GET /api/cases/{id}/bundle` | Everything the UI needs for a case |
| `POST /api/cases/{id}/documents` (multipart) · `GET /api/cases/{id}/documents` | Upload and processing status |
| `GET /api/documents/{id}/extraction` · `GET /api/documents/{id}/file` · `POST …/reprocess` · `DELETE /api/documents/{id}` | Extraction view, original file, re-process, remove |
| `POST /api/cases/{id}/issues/{code}/status` · `…/resolve` · `…/reopen` | Review decisions (validated per issue type; reason required) |
| `POST /api/cases/{id}/notes` | Notes on issues or timeline entries |
| `POST/DELETE /api/cases/{id}/events/{code}/correction` | Correct a stated date (the original is kept) or withdraw the correction |
| `PUT /api/cases/{id}/reminders/{code}` · `GET /api/notifications` | Reminders (verified, upcoming deadlines only) |
| `GET /api/cases/{id}/report` · `report.pdf` · `report.docx` · `calendar.ics` | Chronology preview and exports; calendar with reminder alarms |

---

## Configuration

See `backend/.env.example`. Key settings: `DATABASE_URL`, `JWT_SECRET`, `GROQ_API_KEY`, `GROQ_MODEL` (default `llama-3.3-70b-versatile`).

OCR settings:

| Setting | Default | Notes |
|---|---|---|
| `OCR_MIN_CONFIDENCE` | 85 | Dates read below this (0–100) are quarantined. |
| `OCR_DET_MODEL` / `OCR_REC_MODEL` | `PP-OCRv6_small_det` / `PP-OCRv6_small_rec` | `PP-OCRv6_medium_*` is more accurate and about 2.5× slower on CPU. For Hindi or Marathi pages use `devanagari_PP-OCRv5_mobile_rec` with `PP-OCRv5_mobile_det` (the date engine reads Latin digits). |
| `OCR_DET_MODEL_DIR` / `OCR_REC_MODEL_DIR` / `OCR_ORIENTATION_MODEL_DIR` | empty | Offline servers: folders with downloaded models (each holds `inference.yml` + weights). Copy them from `~/.paddlex/official_models` on a machine with internet. |
| `OCR_FIX_ROTATION` | true | Turns sideways or upside-down scans upright (one extra small model). |
| `OCR_DEVICE` | auto | `cpu`, `gpu` or `gpu:0` (GPU needs `paddlepaddle-gpu` instead of `paddlepaddle`). |
| `OCR_DPI` | 300 | Highest render resolution for scanned PDF pages. |
| `OCR_MODEL_SOURCE` | huggingface | First download source: `huggingface`, `bos`, `modelscope` or `aistudio` (the others are fallbacks). |
| `OCR_PRELOAD` | true | Loads the models in the background at startup. `GET /api/health` shows the OCR state. |

`paddlepaddle` is pinned to 3.2.2: versions 3.3.0 and 3.3.1 crash on CPU with oneDNN ([Paddle#77340](https://github.com/PaddlePaddle/Paddle/issues/77340)). The Docker image bakes the models in at build time (`--build-arg PRELOAD_OCR_MODELS=0` to skip).

## Limitations and notes

- OCR was verified end to end with the real PaddleOCR pipeline (PP-OCRv6 small models) on the generated test bundles and on synthetic damaged dates; scanned pages took about 2–3 s each on CPU in testing.
- The Groq integration was verified with mocked responses in tests. Run one real document with your key and check the *Rejected* tab to confirm the model behaves as expected.
- Extraction is lexicon- and rule-driven, tuned on Indian civil and criminal court documents. Unusual phrasing may need new lexicon entries in `parsing/lexicon.py`.
- Glossary definitions are plain-language summaries and should be reviewed by a legal professional before production use.
- Schema is created with SQLAlchemy `create_all`. Add Alembic migrations before running in production.
- Design notes for the interface are in `docs/design.md`.
