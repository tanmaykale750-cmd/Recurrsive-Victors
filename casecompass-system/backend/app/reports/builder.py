"""Chronology of Events and List of Dates: one structure feeds the preview, the PDF and the Word file."""
from __future__ import annotations

from datetime import date, datetime

from ..services.timeline import build_issues, build_nodes

DEFAULT_OPTIONS = {"citations": True, "conflicts": True, "quarantine": True, "gaps": True, "missingAppendix": True, "correctionLog": True}
ISSUE_LABEL = {"conflict": "Date conflict", "missing": "Missing document", "quarantine": "Quarantined date", "undated": "Undated event", "sequence": "Skipped step"}
STATUS_LABEL = {"open": "Open", "in_review": "In review", "resolved": "Resolved"}


def num(d: str) -> str:
    return date.fromisoformat(d).strftime("%d.%m.%Y")


def long(d: str) -> str:
    dt = date.fromisoformat(d)
    return f"{dt.day} {dt.strftime('%b %Y')}"


def when(ts: str) -> str:
    return datetime.fromisoformat(ts).strftime("%d %b %Y, %H:%M")


def verified_cols(cite: bool) -> list[dict]:
    return [{"key": "no", "label": "No.", "w": 0.06}, {"key": "date", "label": "Date", "w": 0.14},
            {"key": "particulars", "label": "Particulars", "w": 0.38 if cite else 0.6},
            *([{"key": "source", "label": "Source (document, page)", "w": 0.26}] if cite else []),
            {"key": "note", "label": "Note", "w": 0.16 if cite else 0.2}]


def unresolved_cols(cite: bool) -> list[dict]:
    return [{"key": "no", "label": "No.", "w": 0.06}, {"key": "type", "label": "Issue", "w": 0.14}, {"key": "date", "label": "Date(s) in record", "w": 0.18},
            {"key": "particulars", "label": "Particulars", "w": 0.3 if cite else 0.5},
            *([{"key": "source", "label": "Source", "w": 0.2}] if cite else []), {"key": "status", "label": "Status", "w": 0.12}]


MISSING_COLS = [{"key": "title", "label": "Document", "w": 0.3}, {"key": "referredIn", "label": "Referred to in", "w": 0.4},
                {"key": "status", "label": "Status", "w": 0.12}, {"key": "note", "label": "Reviewer note", "w": 0.18}]
LOG_COLS = [{"key": "at", "label": "When", "w": 0.18}, {"key": "who", "label": "By", "w": 0.14}, {"key": "detail", "label": "Correction", "w": 0.68}]


def build_report(b: dict, opts: dict | None = None) -> dict:
    o = {**DEFAULT_OPTIONS, **(opts or {})}
    docs = b["docs"]

    def src(doc: str | None, page, cite: bool) -> str:
        if not doc or doc not in docs:
            return "—"
        return f"{docs[doc]['name']}, p. {page}" if cite else docs[doc]["name"]

    nodes = build_nodes(b)
    verified = []
    for n in [x for x in nodes if x["cls"] not in ("conflict", "missing")]:
        note = "Date corrected by reviewer" if n.get("corrected") else "Date confirmed by reviewer" if n.get("confirmed") else ""
        if n.get("fulfilled"):
            note = (note + "; " if note else "") + f"Completed on record ({n['fulfilled']['doc']}, {num(n['fulfilled']['date'])})"
        if n.get("sources"):
            note = (note + "; " if note else "") + "Also in " + ", ".join(f"{s['doc']} p.{s['page']}" for s in n["sources"])
        verified.append({"no": len(verified) + 1, "date": num(n["date"]),
                         "particulars": n["title"] + (" (deadline as stated in the record)" if n["kind"] == "deadline" else ""),
                         "source": src(n.get("doc"), n.get("page"), o["citations"]), "note": note})

    allowed = {"conflict": o["conflicts"], "quarantine": o["quarantine"], "missing": o["gaps"], "undated": o["gaps"], "sequence": o["gaps"]}
    unresolved = []
    issues = build_issues(b)
    for i in [x for x in issues if x["status"] != "resolved" and allowed[x["type"]]]:
        it = i["item"]
        d, source, part = "Not stated", src(it.get("doc"), it.get("page"), o["citations"]), i["title"]
        if i["type"] == "conflict":
            d = " / ".join(f"{num(x['date'])} (Record {'ABCDEFGH'[k]})" for k, x in enumerate(it["dates"]))
            source = "; ".join(src(x["doc"], x["page"], o["citations"]) for x in it["dates"])
            part += ": records give different dates"
        elif i["type"] == "quarantine":
            d = "Not confirmed"
            part += f": {(it.get('reason') or '').lower()}"
        elif i["type"] == "missing":
            d = num(it["date"]) if it.get("date") else "Not stated"
            part = f"{it['title']}: referred to, not in bundle"
        else:
            part += f": {it.get('why', '')}"
        unresolved.append({"no": len(unresolved) + 1, "type": ISSUE_LABEL[i["type"]], "date": d, "particulars": part, "source": source,
                           "status": STATUS_LABEL[i["status"]]})

    missing = [{"title": i["title"], "referredIn": src(i["item"].get("doc"), i["item"].get("page"), True), "status": STATUS_LABEL[i["status"]],
                "note": (i["resolution"] or {}).get("reason", "")} for i in issues if i["type"] == "missing"]
    corrections = [{"at": when(h["at"]), "who": h["who"], "detail": f"{h['action']}. {h['detail']}"}
                   for h in reversed(b["history"]) if h["kind"] in ("correction",)]
    c = b["case"]
    return {
        "meta": {
            "heading": "CHRONOLOGY OF EVENTS AND LIST OF DATES",
            "matter": f"In the matter of {c['no']}" if c.get("no") else "Chronology of the case record",
            "parties": c["title"],
            "court": c.get("court") or "",
            "prepared": f"Prepared from the supplied record with CaseCompass on {long(b['today'])} by {b['user']['name']}",
            "disclaimer": "This document organises the supplied record. It is not legal advice and makes no prediction about the outcome.",
        },
        "verified": verified, "unresolved": unresolved,
        "missing": missing if o["missingAppendix"] else [], "corrections": corrections if o["correctionLog"] else [],
        "opts": o,
        "cols": {"verified": verified_cols(o["citations"]), "unresolved": unresolved_cols(o["citations"]), "missing": MISSING_COLS, "log": LOG_COLS},
    }
