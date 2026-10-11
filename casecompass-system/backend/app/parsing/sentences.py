"""Sentence segmentation tuned for Indian court documents.

Legal text is full of periods that do not end sentences: dates (12.01.2026),
abbreviations (No., Pvt., Ltd., M/s., Hon'ble), section references (u/s. 173)
and numbered paragraphs. Offsets into the page text are kept so every extracted
item can point back to its exact sentence.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

ABBREV = {
    "no", "nos", "pvt", "ltd", "co", "corp", "inc", "m/s", "ms", "mr", "mrs", "dr", "sh", "smt", "shri", "km",
    "hon'ble", "honble", "vs", "v", "p", "pp", "para", "paras", "sec", "s", "ss", "u/s", "r/w", "art", "cl",
    "i.e", "e.g", "etc", "viz", "ors", "anr", "ex", "exh", "rs", "crl", "civ", "misc", "st", "nd", "rd", "th",
    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "dt", "w.e.f", "approx",
    "a", "b", "c", "d", "i", "ii", "iii", "iv", "vi", "vii", "viii", "ix", "x", "o", "ia", "i.a", "cs", "comm",
    "fir", "j", "cpc", "crpc", "ipc", "bns", "bnss", "sr", "jr", "dept", "govt", "addl", "asst",
}

# candidate boundary: sentence punctuation, optional closing quote/bracket, then whitespace
_BOUNDARY = re.compile(r'[.!?]["”’)\]]*\s+')
_HEADING = re.compile(r"^[A-Z0-9 .,()/&'’:-]{3,80}$")


@dataclass
class Sentence:
    start: int
    end: int
    text: str
    heading: bool = False


def _word_before(text: str, idx: int) -> str:
    j = idx
    while j > 0 and not text[j - 1].isspace():
        j -= 1
    return text[j:idx].lower().strip("(\"'“‘")


def _split_block(text: str, base: int) -> list[Sentence]:
    out: list[Sentence] = []
    start = 0
    for m in _BOUNDARY.finditer(text):
        dot = m.start()
        prev = _word_before(text, dot)
        nxt = text[m.end(): m.end() + 1]
        # period between digits (12.01.2026, 3.5) is never a boundary
        if dot > 0 and text[dot - 1].isdigit() and nxt.isdigit():
            continue
        if prev.rstrip(".") in ABBREV:
            continue
        # single capital letter initial ("R. Sharma")
        if len(prev) == 1 and prev.isalpha():
            continue
        # next char must look like the start of a sentence
        if nxt and not (nxt.isupper() or nxt.isdigit() or nxt in "\"“‘(["):
            continue
        seg = text[start:m.end()].strip()
        if seg:
            s = start + (len(text[start:m.end()]) - len(text[start:m.end()].lstrip()))
            out.append(Sentence(base + s, base + s + len(seg), seg))
        start = m.end()
    seg = text[start:].strip()
    if seg:
        s = start + (len(text[start:]) - len(text[start:].lstrip()))
        out.append(Sentence(base + s, base + s + len(seg), seg))
    return out


def _segments(block: str) -> list[tuple[int, str]]:
    """Split a paragraph at hard line breaks. A line break is soft (a wrap) when the line before it is
    long and does not end a clause; short lines such as addresses or 'Dated: 12.01.2026' are hard breaks."""
    lines = block.split("\n")
    if len(lines) == 1:
        return [(0, block)]
    longest = max(len(ln.strip()) for ln in lines) or 1
    segs, start, pos = [], 0, 0
    for i, ln in enumerate(lines[:-1]):
        pos += len(ln) + 1
        st = ln.strip()
        soft = len(st) >= 0.62 * longest and not st.endswith((".", ":", ";", "?", "!")) and len(st) > 35
        if not soft:
            segs.append((start, block[start:pos - 1]))
            start = pos
    segs.append((start, block[start:]))
    return [(s, t) for s, t in segs if t.strip()]


def split_sentences(text: str) -> list[Sentence]:
    """Split page text into sentences with offsets. Short ALL-CAPS lines become headings."""
    out: list[Sentence] = []
    # blocks: blank-line separated paragraphs; single newlines inside a paragraph are spaces
    for bm in re.finditer(r"(?:[^\n]|\n(?!\s*\n))+", text):
        block = bm.group(0)
        base = bm.start()
        # pull leading heading lines out of the block
        lines = block.split("\n")
        offset = 0
        while lines and _HEADING.match(lines[0].strip()) and len(lines[0].strip()) <= 80 and lines[0].strip().upper() == lines[0].strip() and any(c.isalpha() for c in lines[0]):
            ln = lines.pop(0)
            st = ln.strip()
            if st:
                s = base + offset + ln.index(st)
                out.append(Sentence(s, s + len(st), st, heading=True))
            offset += len(ln) + 1
        rest = block[offset:]
        if rest.strip():
            for seg_start, seg in _segments(rest):
                flat = seg.replace("\n", " ")
                out.extend(_split_block(flat, base + offset + seg_start))
    return out


def normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()
