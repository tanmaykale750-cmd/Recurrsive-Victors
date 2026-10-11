"""Server-side view of the effective timeline (after reviewer decisions), used by the report,
calendar export and notifications. Mirrors the frontend's selectors so both always agree."""
from __future__ import annotations

from datetime import date

LETTERS = "ABCDEFGH"


def urgency(d: str, today: date, red: int = 7, amber: int = 30) -> str:
    n = (date.fromisoformat(d) - today).days
    if n < 0:
        return "past"
    if n <= red:
        return "red"
    if n <= amber:
        return "amber"
    return "green"


def build_nodes(b: dict) -> list[dict]:
    """Everything that can be placed on the timeline. Unresolved conflicts appear once per record."""
    res, st = b["resolutions"], b["status"]
    today = date.fromisoformat(b["today"])
    s = b["user"]["settings"] or {}
    out = []
    for it in b["items"]:
        if it["kind"] == "conflict":
            r = res.get(it["id"])
            if r and r.get("type") == "corrected":
                basis = r.get("basis", "A")
                idx = LETTERS.index(basis) if basis in LETTERS[: len(it["dates"])] else 0
                src = it["dates"][idx]
                out.append({**it, "nodeId": it["id"], "kind": "event", "date": r["date"], "doc": src["doc"], "page": src["page"],
                            "quote": src["quote"], "cls": "corrected", "corrected": True})
            else:
                for i, d in enumerate(it["dates"]):
                    out.append({**it, "nodeId": f"{it['id']}-{i}", "date": d["date"], "doc": d["doc"], "page": d["page"], "quote": d["quote"],
                                "ci": i, "cls": "conflict"})
        else:
            r = res.get(it["id"])
            if r and r.get("type") == "corrected":
                out.append({**it, "nodeId": it["id"], "date": r["date"], "corrected": True, "originalDates": [it["date"]]})
            else:
                out.append({**it, "nodeId": it["id"]})
    for g in b["gaps"]:
        r = res.get(g["id"])
        if g["type"] == "missing" and g.get("date") and st.get(g["id"]) != "resolved":
            out.append({**g, "nodeId": g["id"], "kind": "missing", "cls": "missing"})
        if g["type"] == "undated" and r and r.get("type") == "dated":
            out.append({**g, "nodeId": g["id"], "kind": "event", "date": r["date"], "confirmed": True})
    for q in b["quarantine"]:
        r = res.get(q["id"])
        if r and r.get("type") == "confirmed":
            out.append({**q, "nodeId": q["id"], "kind": r.get("kind", "event"), "date": r["date"], "confirmed": True})
    for n in out:
        if "cls" not in n:
            if n["kind"] == "deadline":
                n["cls"] = urgency(n["date"], today, s.get("red", 7), s.get("amber", 30))
            elif n.get("confirmed"):
                n["cls"] = "confirmed"
            else:
                n["cls"] = "hearing" if n["kind"] == "hearing" else "event"
    return sorted(out, key=lambda n: (n["date"], n["nodeId"]))


def build_issues(b: dict) -> list[dict]:
    items = [{"id": c["id"], "type": "conflict", "title": c["title"], "item": c} for c in b["items"] if c["kind"] == "conflict"]
    items += [{"id": g["id"], "type": g["type"], "title": g["title"], "item": g} for g in b["gaps"]]
    items += [{"id": q["id"], "type": "quarantine", "title": q["title"], "item": q} for q in b["quarantine"]]
    for i in items:
        i["status"] = b["status"].get(i["id"], "open")
        i["resolution"] = b["resolutions"].get(i["id"])
    return items


def verified_deadlines(b: dict, upcoming_only: bool = True) -> list[dict]:
    today = date.fromisoformat(b["today"])
    return [n for n in build_nodes(b) if n["kind"] == "deadline" and n["cls"] not in ("conflict", "missing")
            and (not upcoming_only or date.fromisoformat(n["date"]) >= today)]
