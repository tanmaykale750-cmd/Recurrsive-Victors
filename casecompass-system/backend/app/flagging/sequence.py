"""Procedural-sequence rules: a step that, by the usual course of the case type, should be followed by
another, where the follow-up is not in the record. These are prompts to check the bundle, not legal
conclusions; the wording says what is (not) on record, never what should happen."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable


@dataclass
class SeqContext:
    case_type: str
    templates: set[str]
    keys: set[str]
    texts: dict[str, str]  # doc code -> full text
    docs_by_template: dict[str, list]  # template -> [Document]
    events_by_key: dict[str, list]  # event_key -> [Event]

    def any_text(self, pattern: str) -> bool:
        rx = re.compile(pattern, re.I)
        return any(rx.search(t) for t in self.texts.values())


@dataclass
class Rule:
    id: str
    case_types: tuple[str, ...]
    applies: Callable[[SeqContext], bool]
    title: str
    why: Callable[[SeqContext], str]
    anchor: Callable[[SeqContext], tuple]  # (doc, page, quote) source of the gap


def _first_event(ctx: SeqContext, key: str):
    evs = sorted(ctx.events_by_key.get(key, []), key=lambda e: e.date)
    return evs[0] if evs else None


def _anchor_event(key: str, template: str | None = None):
    def f(ctx: SeqContext):
        ev = _first_event(ctx, key)
        if ev:
            return ev.document_id, ev.page, ev.quote
        if template and ctx.docs_by_template.get(template):
            d = ctx.docs_by_template[template][0]
            return d.id, 1, (ctx.texts.get(d.code, "") or d.title)[:300]
        return None, None, None
    return f


def _date(ctx: SeqContext, key: str) -> str:
    ev = _first_event(ctx, key)
    return f" on {ev.date.strftime('%d.%m.%Y')}" if ev else ""


RULES: list[Rule] = [
    Rule(
        "counterclaim_no_reply", ("civil",),
        lambda c: "Counter-Claims" in c.templates and not c.any_text(r"\b(written statement|reply)\s+to\s+(the\s+)?counter[- ]claim"),
        "No reply to the counter-claim on record",
        lambda c: f"A counter-claim was filed{_date(c, 'counterclaim_filed')}, but no written statement or reply to it appears in the bundle.",
        _anchor_event("counterclaim_filed", "Counter-Claims"),
    ),
    Rule(
        "plaint_no_service", ("civil",),
        lambda c: "Plaint (Complaint)" in c.templates and "summons_served" not in c.keys and "Summons Service Report" not in c.templates,
        "No proof of service of summons on record",
        lambda c: "The suit has been filed, but no summons service report or record of service appears in the bundle.",
        _anchor_event("suit_filed", "Plaint (Complaint)"),
    ),
    Rule(
        "bail_no_order", ("criminal",),
        lambda c: ("Arrest/Bail Applications" in c.templates or "bail_applied" in c.keys)
        and not ({"bail_granted", "bail_rejected"} & c.keys) and "Bail Orders" not in c.templates,
        "No order on the bail application on record",
        lambda c: f"A bail application was filed{_date(c, 'bail_applied')}, but no order deciding it appears in the bundle.",
        _anchor_event("bail_applied", "Arrest/Bail Applications"),
    ),
    Rule(
        "chargesheet_no_cognizance", ("criminal",),
        lambda c: ("Final Police Chargesheet" in c.templates or "chargesheet_filed" in c.keys) and "cognizance_taken" not in c.keys,
        "No order taking cognizance on record",
        lambda c: f"The chargesheet was filed{_date(c, 'chargesheet_filed')}, but no order taking cognizance appears in the bundle.",
        _anchor_event("chargesheet_filed", "Final Police Chargesheet"),
    ),
    Rule(
        "charges_no_plea", ("criminal",),
        lambda c: "charges_framed" in c.keys and "plea_recorded" not in c.keys and "Plea Statements" not in c.templates,
        "Plea of the accused not on record",
        lambda c: f"Charges were framed{_date(c, 'charges_framed')}, but no record of the plea appears in the bundle.",
        _anchor_event("charges_framed", "Court Order Framing Charges"),
    ),
    Rule(
        "conviction_no_sentence", ("criminal",),
        lambda c: c.any_text(r"\b(is|stands) convicted\b") and "sentence_passed" not in c.keys and "Order on Sentence" not in c.templates,
        "No order on sentence on record",
        lambda c: "The judgment records a conviction, but no order on sentence appears in the bundle.",
        _anchor_event("judgment_pronounced", "Final Judgment (Conviction/Acquittal)"),
    ),
    Rule(
        "petition_no_reply", ("tribunal",),
        lambda c: "Consumer / Company Petition" in c.templates and "Reply / Counter-Affidavit" not in c.templates,
        "No reply or counter-affidavit on record",
        lambda c: "The petition is on record, but no reply or counter-affidavit appears in the bundle.",
        _anchor_event("complaint_filed", "Consumer / Company Petition"),
    ),
]
