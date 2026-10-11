"""The three places CaseCompass uses AI, each grounded and validated.

1. refine_events     - turn parser-found dated sentences into clean event titles, kinds and parties,
                       and spot dates that merely refer to another document.
2. classify_document - pick a document type from the closed list when the rules are unsure.
3. same_event        - decide whether two sentences from different documents describe the same
                       real-world event (used for borderline conflict candidates).

The AI never writes definitions (jargon tooltips come only from the glossary), never
calculates deadlines and never comments on the merits or likely outcome of a case.
"""
from __future__ import annotations

import json
import logging

from .groq import AIUnavailable, client

log = logging.getLogger(__name__)

GROUND_RULES = (
    "You assist a legal case-chronology tool used in Indian courts. Follow these rules strictly:\n"
    "- Use ONLY the sentences provided. Never add facts, dates or documents that are not in them.\n"
    "- Every date you output must be copied exactly from the list of dates given for that sentence (ISO format).\n"
    "- Never calculate or infer a date. Never give legal advice, opinions or predictions about the outcome.\n"
    "- Titles are short, neutral descriptions (max 80 characters) of what the sentence records.\n"
    "- Reply with a single JSON object only."
)


def refine_events(doc_title: str, doc_type: str, sentences: list[dict]) -> dict:
    """sentences: [{id, page, text, dates: [iso, ...]}]. Returns {"events": [...], "references": [...]}."""
    system = GROUND_RULES + (
        "\n\nTask: for each sentence, list the events it records. For every event return:\n"
        '{"sentence_id": int, "date": "YYYY-MM-DD", "kind": "event" | "hearing" | "deadline", "title": str, '
        '"party": str | null, "is_reference": bool}\n'
        "- kind=deadline when the sentence directs someone to do something on or before the date.\n"
        "- kind=hearing when the matter is listed, adjourned or posted to the date.\n"
        "- is_reference=true when the date only identifies another document (e.g. 'order dated ...') and nothing "
        "happened on it according to this sentence.\n"
        "Also list references to other documents: "
        '{"sentence_id": int, "label": str, "quote": str} where quote is the exact words naming the document.\n'
        'Return {"events": [...], "references": [...]}.'
    )
    user = json.dumps({"document": doc_title, "document_type": doc_type, "sentences": sentences}, ensure_ascii=False)
    return client.json_chat(system, user, max_tokens=3000)


def classify_document(first_page: str, filename: str, allowed_types: list[str], allowed_templates: list[str]) -> dict:
    system = GROUND_RULES + (
        "\n\nTask: classify the document. Choose doc_type from this list only: "
        + ", ".join(allowed_types)
        + ". Choose template from this list only, or null: "
        + ", ".join(allowed_templates)
        + '. Return {"doc_type": str, "template": str | null, "confidence": number between 0 and 1}.'
    )
    user = json.dumps({"filename": filename, "first_page": first_page[:3500]}, ensure_ascii=False)
    out = client.json_chat(system, user, max_tokens=200)
    if out.get("doc_type") not in allowed_types:
        raise AIUnavailable("AI returned a document type outside the allowed list")
    if out.get("template") not in allowed_templates:
        out["template"] = None
    return out


def same_event(a: str, b: str) -> bool | None:
    system = GROUND_RULES + (
        "\n\nTask: two sentences come from different documents in the same case. Do they describe the same "
        "real-world event (the same act by the same party), regardless of the date each gives? "
        'Return {"same_event": true | false}.'
    )
    try:
        out = client.json_chat(system, json.dumps({"a": a, "b": b}, ensure_ascii=False), max_tokens=50)
        v = out.get("same_event")
        return v if isinstance(v, bool) else None
    except AIUnavailable:
        return None
