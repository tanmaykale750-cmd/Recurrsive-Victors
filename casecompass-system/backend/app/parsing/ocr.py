"""PaddleOCR reading for scanned pages and photos.

What this module guarantees to the rest of the parser:

* Page text comes back in reading order, one line per printed line and a blank line between
  paragraphs, so sentence splitting works the same as on a PDF text layer.
* Every word carries a confidence from 0 to 100, stored as character spans over the page text.
* Dates are read twice: once inside the full line, then again from a tight crop of just the date,
  keeping each character's probability. A date is only as confident as its weakest digit. If the
  two reads disagree, or grey ink stains the date, it is held below the trust threshold, so it is
  quarantined rather than guessed. (On 180 deliberately damaged test dates, no wrong date was trusted.)
* Ink the recogniser could not turn into text (a smudged stamp, an over-written date) is kept as an
  ``[illegible]`` token with confidence 0. "Received on [illegible]" is then flagged as an illegible
  date instead of silently disappearing.

Models are downloaded by PaddleOCR on first use (or loaded from OCR_*_MODEL_DIR for offline
servers) and kept in memory for the life of the process.
"""
from __future__ import annotations

import logging
import os
import re
import threading
import time
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageOps

from ..config import settings
from .dates import DATE_CUE, find_dates

log = logging.getLogger(__name__)

ILLEGIBLE = "[illegible]"
#: after a failed model load, wait this long before trying again
RETRY_AFTER_SECONDS = 300
#: a whole line read below this score is treated as unreadable ink, not as text
ILLEGIBLE_LINE_SCORE = 0.40


class OCRUnavailable(RuntimeError):
    """PaddleOCR is not installed, or its models could not be loaded."""


# --------------------------------------------------------------------------- engine


@dataclass
class OcrLine:
    """One text line as PaddleOCR returned it (coordinates in the image that was read)."""

    text: str
    score: float  # 0..1
    quad: np.ndarray  # 4x2: top-left, top-right, bottom-right, bottom-left
    pieces: list[str] = field(default_factory=list)  # recogniser word pieces; joined they give `text`
    piece_x: list[tuple[float, float]] = field(default_factory=list)  # x-range of each piece

    @property
    def x0(self) -> float:
        return float(self.quad[:, 0].min())

    @property
    def x1(self) -> float:
        return float(self.quad[:, 0].max())

    @property
    def y0(self) -> float:
        return float(self.quad[:, 1].min())

    @property
    def y1(self) -> float:
        return float(self.quad[:, 1].max())

    @property
    def h(self) -> float:
        return max(1.0, self.y1 - self.y0)

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2


class _CharProbs:
    """Wraps the recogniser's CTC decoder to also keep each output character's probability.
    PaddleOCR reports only the mean over a line, which hides a single doubtful digit."""

    def __init__(self, inner) -> None:
        self.inner = inner
        self.last: list[list[float]] = []

    def __call__(self, pred, *args, **kwargs):
        out = self.inner(pred, *args, **kwargs)
        try:
            probs = np.asarray(pred[0])
            idx, best = probs.argmax(axis=-1), probs.max(axis=-1)
            per = []
            for b in range(len(idx)):
                keep = np.ones(len(idx[b]), dtype=bool)
                keep[1:] = idx[b][1:] != idx[b][:-1]  # CTC: merge repeats, drop blanks (index 0)
                keep &= idx[b] != 0
                per.append(best[b][keep].astype(float).tolist())
            self.last = per
        except Exception:  # noqa: BLE001 - per-character scores are a bonus; means still work
            self.last = []
        return out


class PaddleEngine:
    """Lazily created PaddleOCR pipeline plus a stand-alone recogniser for second reads."""

    def __init__(self) -> None:
        self._ocr = None
        self._rec = None
        self._lock = threading.RLock()
        self.state = "not_loaded"  # not_loaded | loading | ready | error
        self.error: str | None = None
        self._failed_at = 0.0

    # ---- configuration
    @staticmethod
    def _common_args() -> dict:
        args: dict = {"enable_mkldnn": settings.ocr_enable_mkldnn}
        if settings.ocr_device:
            args["device"] = settings.ocr_device
        if settings.ocr_engine:
            args["engine"] = settings.ocr_engine
        if settings.ocr_cpu_threads:
            args["cpu_threads"] = settings.ocr_cpu_threads
        return args

    def models(self) -> dict:
        return {"detection": settings.ocr_det_model, "recognition": settings.ocr_rec_model,
                "orientation": "PP-LCNet_x1_0_doc_ori" if settings.ocr_fix_rotation else None}

    # ---- lifecycle
    def load(self) -> None:
        with self._lock:
            if self._ocr is not None:
                return
            if self.state == "error" and time.monotonic() - self._failed_at < RETRY_AFTER_SECONDS:
                raise OCRUnavailable(self.error)  # do not retry a failed download on every upload
            self.state, self.error = "loading", None
            # skip PaddleX's slow connectivity probe at import; downloads still fall back across hosts
            os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
            if settings.ocr_model_source:
                os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", settings.ocr_model_source)
            try:
                from paddleocr import PaddleOCR, TextRecognition
            except ImportError as e:
                self.state, self.error = "error", "PaddleOCR is not installed (pip install -r requirements.txt)."
                self._failed_at = time.monotonic()
                raise OCRUnavailable(self.error) from e
            try:
                common = self._common_args()
                self._ocr = PaddleOCR(
                    text_detection_model_name=settings.ocr_det_model,
                    text_detection_model_dir=settings.ocr_det_model_dir or None,
                    text_recognition_model_name=settings.ocr_rec_model,
                    text_recognition_model_dir=settings.ocr_rec_model_dir or None,
                    use_doc_orientation_classify=settings.ocr_fix_rotation,
                    doc_orientation_classify_model_dir=settings.ocr_orientation_model_dir or None,
                    use_doc_unwarping=False,  # warping moves text away from the page coordinates we crop from
                    use_textline_orientation=False,
                    return_word_box=True,
                    text_rec_score_thresh=0.0,  # keep weak lines: they become [illegible], never vanish
                    **common,
                )
                self._rec = TextRecognition(model_name=settings.ocr_rec_model,
                                            model_dir=settings.ocr_rec_model_dir or None, **common)
                pred = getattr(self._rec, "paddlex_predictor", None)
                if pred is not None and callable(getattr(pred, "post_op", None)):
                    pred.post_op = _CharProbs(pred.post_op)
            except Exception as e:  # noqa: BLE001 - surfaced to the user as a processing error
                self._ocr = self._rec = None
                self.state, self._failed_at = "error", time.monotonic()
                self.error = (f"Could not load the PaddleOCR models ({type(e).__name__}: {str(e)[:300]}). "
                              "The first run downloads them, so the server needs internet access once; "
                              "on an offline server set OCR_DET_MODEL_DIR and OCR_REC_MODEL_DIR "
                              "(and OCR_ORIENTATION_MODEL_DIR, or OCR_FIX_ROTATION=false).")
                log.error(self.error)
                raise OCRUnavailable(self.error) from e
            self.state = "ready"
            log.info("PaddleOCR ready: %s + %s", settings.ocr_det_model, settings.ocr_rec_model)

    def status(self) -> dict:
        try:
            import importlib.util

            installed = importlib.util.find_spec("paddleocr") is not None
        except (ImportError, ValueError):
            installed = False
        return {"engine": "PaddleOCR", "installed": installed, "state": self.state, "error": self.error, "models": self.models()}

    # ---- inference
    def read(self, bgr: np.ndarray) -> tuple[list[OcrLine], np.ndarray]:
        """Read one page. Returns the lines and the image their coordinates refer to (the page may
        have been turned upright by the orientation model)."""
        self.load()
        with self._lock:
            res = self._ocr.predict(bgr)[0]
        frame = bgr
        pre = res.get("doc_preprocessor_res")
        if pre is not None and pre.get("output_img") is not None:
            frame = pre["output_img"]
        words = res.get("text_word") or []
        regions = res.get("text_word_region") or []
        lines = []
        for i, (text, score, poly) in enumerate(zip(res["rec_texts"], res["rec_scores"], res["rec_polys"])):
            quad = np.asarray(poly, dtype=np.float32).reshape(-1, 2)
            if quad.shape[0] != 4:  # polygons: fall back to their bounding box
                x0, y0 = quad.min(axis=0)
                x1, y1 = quad.max(axis=0)
                quad = np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], dtype=np.float32)
            pieces = [str(p) for p in words[i]] if i < len(words) else []
            px = []
            if i < len(regions):
                for box in regions[i]:
                    b = np.asarray(box, dtype=np.float32).reshape(-1, 2)
                    px.append((float(b[:, 0].min()), float(b[:, 0].max())))
            lines.append(OcrLine(str(text), float(score), quad, pieces, px))
        return lines, frame

    def reread(self, crops: list[np.ndarray]) -> list[tuple[str, float, list[float] | None]]:
        """Recognise crops without detection (used to double-check dates). Returns, per crop, the
        text, the mean score and, when available, each character's probability."""
        if not crops:
            return []
        self.load()
        out = []
        with self._lock:
            hook = getattr(getattr(self._rec, "paddlex_predictor", None), "post_op", None)
            for crop in crops:  # one at a time: no padding to a batch-mates' width
                r = self._rec.predict(crop)[0]
                text = str(r["rec_text"])
                chars = hook.last[0] if isinstance(hook, _CharProbs) and hook.last else None
                out.append((text, float(r["rec_score"]), chars if chars and len(chars) == len(text) else None))
        return out


_engine = PaddleEngine()


def get_engine() -> PaddleEngine:
    return _engine


def status() -> dict:
    return _engine.status()


def warm_up() -> None:
    """Load (and on first run download) the models. Errors are recorded, not raised."""
    try:
        _engine.load()
    except OCRUnavailable:
        pass


# --------------------------------------------------------------------------- image helpers


def to_bgr(img: Image.Image) -> np.ndarray:
    """PIL image (any mode, any EXIF orientation) -> 8-bit BGR array PaddleOCR expects."""
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[-1])
        img = bg
    elif img.mode.startswith("I;16") or img.mode == "I":
        arr = np.asarray(img, dtype=np.float32)
        span = float(arr.max() - arr.min()) or 1.0
        img = Image.fromarray(((arr - arr.min()) * 255.0 / span).astype(np.uint8))
    img = img.convert("RGB")
    longest = max(img.size)
    if longest < 1200:  # tiny screenshots: give the detector enough pixels per character
        scale = 1600 / longest
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    rgb = np.asarray(img, dtype=np.uint8)
    return np.ascontiguousarray(rgb[:, :, ::-1])


def _strip(img: np.ndarray, quad: np.ndarray) -> np.ndarray:
    """Warp a (possibly skewed) line quad to an upright strip, as PaddleOCR does before recognition."""
    import cv2

    q = quad.astype(np.float32)
    w = int(round(max(np.linalg.norm(q[0] - q[1]), np.linalg.norm(q[3] - q[2]))))
    h = int(round(max(np.linalg.norm(q[0] - q[3]), np.linalg.norm(q[1] - q[2]))))
    w, h = max(w, 2), max(h, 2)
    m = cv2.getPerspectiveTransform(q, np.float32([[0, 0], [w, 0], [w, h], [0, h]]))
    return cv2.warpPerspective(img, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def _has_ink(gray: np.ndarray, paper: float, x0: float, x1: float, y0: float, y1: float, lh: float) -> bool:
    """Is there unrecognised ink (smudge, handwriting, stamp) in this box? Speckle, ruled lines,
    underscores and box borders do not count."""
    import cv2

    H, W = gray.shape[:2]
    xa, xb, ya, yb = int(max(0, x0)), int(min(W, x1)), int(max(0, y0)), int(min(H, y1))
    if xb - xa < 0.6 * lh or yb - ya < 4:
        return False
    crop = gray[ya:yb, xa:xb]
    mask = (crop < paper - 45).astype(np.uint8)
    n, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    kept = 0
    for i in range(1, n):
        _, _, w, h, area = stats[i]
        if area < 0.02 * lh * lh:
            continue  # scanner speckle
        if w < 0.12 * lh and h > 0.5 * (yb - ya):
            continue  # vertical rule or box border
        if h < 0.12 * lh and w > 1.2 * lh:
            continue  # underline, blank to fill in, horizontal rule
        kept += int(area)
    return kept >= 0.03 * crop.size and kept >= 0.15 * lh * lh


def _stained(crop: np.ndarray) -> bool:
    """Grey, unsaturated marks over a date that are not part of the letter strokes (a smudge, a
    blot, a faded over-stamp). The recogniser can read straight through these and turn a 4 into a
    1 with high confidence, so a stained date is never trusted. Coloured highlighter is ignored."""
    import cv2

    if crop.size == 0 or crop.ndim != 3:
        return False
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).astype(np.float32)
    sat = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)[:, :, 1]
    paper, ink = float(np.percentile(gray, 90)), float(np.percentile(gray, 3))
    if paper - ink < 60:
        return False  # too little contrast to tell a stain from faint print
    strokes = (gray < ink + 0.35 * (paper - ink)).astype(np.uint8)
    near = cv2.dilate(strokes, np.ones((3, 3), np.uint8), iterations=2).astype(bool)
    stain = (gray < paper - 0.25 * (paper - ink)) & ~near & (sat < 70)
    return float(stain.mean()) > 0.02


# --------------------------------------------------------------------------- text helpers

# OCR often drops the space after punctuation or between a word and a date ("framed.Matter",
# "before16.10.2026"). Only these unambiguous cases are repaired; nothing else in the text changes.
_SPACE_AFTER = [
    re.compile(r"(?<=[A-Za-z])[,;](?=[A-Za-z])"),  # failed,issues
    re.compile(r"(?<=[a-z]{2})\.(?=[A-Z][a-z])"),  # framed.Matter
    re.compile(r"(?<=\d{4})\.(?=[A-Z][a-z])"),  # 16.10.2026.Reply
    re.compile(r"(?<=[a-z]{2})(?=\d)"),  # before16.10.2026, Section420
    re.compile(r"(?<=[./-]\d{4})(?=[a-z]{2})"),  # 16.10.2026before
    re.compile(r"(?<=\d)(?=[a-z]{3,})"),  # 6,20,000from (ordinals like 15th are two letters)
    re.compile(r"(?<=[a-z]{3})(?=[A-Z][a-z]{2})"),  # InvestigatingOfficer
    re.compile(r"(?<=\b[a-z]{2})(?=[A-Z]{2,}\b)"),  # toIA
    re.compile(r"(?<=[a-z]{3}ed)(?=(?:on|by|to|at|the)\b)"),  # issuedon, servedby
    # a short list of glued function-word pairs (beforethe, asper, ofthe); the cut is after group 1
    re.compile(r"\b(before|after|under|with|from|of|on|in|to|as|by|at|for|and|or|is|was|be|till|until|against|between|through)"
               r"(?=(?:the|his|her|its|their|said|per|that|this)\b)", re.I),
]


def _normalise(text: str) -> tuple[str, list[int]]:
    """Collapse whitespace and repair the missing spaces above. Returns the repaired text and, for
    each of its characters, the index of the character in `text` it came from."""
    chars, idx = [], []
    for i, ch in enumerate(text):
        if ch.isspace():
            if chars and chars[-1] != " ":
                chars.append(" ")
                idx.append(i)
        else:
            chars.append(ch)
            idx.append(i)
    while chars and chars[-1] == " ":
        chars.pop()
        idx.pop()
    flat = "".join(chars)
    cuts = sorted({(m.end(1) if rx.groups else m.end()) for rx in _SPACE_AFTER for m in rx.finditer(flat)})
    out, out_idx, prev = [], [], 0
    for c in cuts:
        if c <= prev or c >= len(flat) or flat[c] == " ":
            continue
        out.append(flat[prev:c])
        out_idx.extend(idx[prev:c])
        out.append(" ")
        out_idx.append(idx[c - 1])
        prev = c
    out.append(flat[prev:])
    out_idx.extend(idx[prev:])
    return "".join(out), out_idx


def _alnum(s: str) -> str:
    return re.sub(r"[^0-9A-Za-z]", "", s).upper()


def _weakest(text: str, chars: list[float], expected: str) -> float:
    """Lowest character probability over the part of `text` that spells `expected` (alphanumerics;
    the crop may include a neighbouring character or two)."""
    pos = [i for i, ch in enumerate(text) if ch.isalnum()]
    flat = "".join(text[i] for i in pos).upper()
    at = flat.find(expected)
    if at < 0 or not expected:
        return min(chars) if chars else 0.0
    first, last = pos[at], pos[at + len(expected) - 1]
    return min(chars[first:last + 1])


def _targets(text: str) -> list[tuple[int, int]]:
    """Character spans worth a second read: every date-like mention with digits, and the first one or
    two tokens after a date cue when they look like a date or like OCR noise."""
    spans = [(m.start, m.end) for m in find_dates(text) if any(c.isdigit() for c in m.text)]
    for m in DATE_CUE.finditer(text):
        toks = list(re.finditer(r"\S+", text[m.end():]))[:2]
        if not toks:
            continue
        first = toks[0].group(0).rstrip(".,;:")
        # digits, stray symbols or broken casing ("2 WOREs") look like a misread date; words and
        # acronyms ("the", "behalf", "IA No. 214/2026") do not
        suspicious = (any(c.isdigit() for c in first) or bool(re.search(r"[^A-Za-z'()\-]", first))
                      or bool(re.search(r"[A-Z]{2,}[a-z]|[a-z][A-Z]", first)))
        if suspicious:
            a = m.end() + toks[0].start()
            b = m.end() + toks[-1].end()
            if not any(s < b and e > a for s, e in spans):
                spans.append((a, b))
    return spans


@dataclass
class _Line:
    src: OcrLine
    text: str  # repaired text
    idx: list[int]  # repaired char -> source char
    conf: list[float]  # per repaired char, 0..100


def _x_range(line: _Line, a: int, b: int) -> tuple[float, float]:
    """Fractions (0..1) along the line where repaired chars [a, b) sit, from the recogniser's word boxes."""
    src = line.src
    ra, rb = line.idx[a], line.idx[b - 1] + 1
    left, right = float(src.quad[0][0]), float(src.quad[1][0])
    span = right - left
    if src.pieces and len(src.pieces) == len(src.piece_x) and "".join(src.pieces) == src.text and span > 1:
        xs, pos = [], 0
        for piece, (px0, px1) in zip(src.pieces, src.piece_x):
            if pos < rb and pos + len(piece) > ra:
                xs.extend((px0, px1))
            pos += len(piece)
        if xs:
            return max(0.0, (min(xs) - left) / span), min(1.0, (max(xs) - left) / span)
    n = max(1, len(src.text))
    return ra / n, rb / n


def _verify_dates(lines: list[_Line], frame: np.ndarray, engine) -> None:
    """Second read of every date: crop it from its line and recognise it on its own."""
    jobs = []  # (line, start, end) in the line's repaired text
    for ln in lines:
        for a, b in _targets(ln.text):
            jobs.append((ln, a, b))
    if not jobs:
        return

    strips: dict[int, np.ndarray] = {}

    def crop(job, pad_factor: float) -> np.ndarray:
        ln, a, b = job
        strip = strips.get(id(ln))
        if strip is None:
            strip = strips[id(ln)] = _strip(frame, ln.src.quad)
        h, w = strip.shape[:2]
        f0, f1 = _x_range(ln, a, b)
        pad = pad_factor * h  # roughly one character either side; the word boxes are approximate
        xa, xb = int(max(0, f0 * w - pad)), int(min(w, f1 * w + pad))
        if xb - xa < h:
            mid = (xa + xb) // 2
            xa, xb = max(0, mid - h // 2), min(w, mid + h // 2 + 1)
        return strip[:, xa:xb]

    def agrees(job, text: str) -> bool:
        ln, a, b = job
        expected = _alnum(ln.text[a:b])
        return bool(expected) and expected in _alnum(text)

    reads = engine.reread([crop(j, 0.5) for j in jobs])
    retry = [i for i, j in enumerate(jobs) if not agrees(j, reads[i][0])]
    if retry:  # the crop may have clipped a digit: try once more with a wider margin
        for i, again in zip(retry, engine.reread([crop(jobs[i], 1.2) for i in retry])):
            if agrees(jobs[i], again[0]):
                reads[i] = again

    cap = max(0.0, settings.ocr_min_confidence - 1)
    for job, (text, score, chars) in zip(jobs, reads):
        ln, a, b = job
        ok = agrees(job, text) and not _stained(crop(job, 0.15))
        conf = 100.0 * score
        if ok and chars:
            conf = 100.0 * _weakest(text, chars, _alnum(ln.text[a:b]))
        for k in range(a, b):
            c = min(ln.conf[k], round(conf, 1))
            ln.conf[k] = c if ok else min(c, cap)  # reads disagree, or the date is stained: never trusted


# --------------------------------------------------------------------------- page assembly


@dataclass
class _Tok:
    text: str
    x0: float
    x1: float
    conf: float


@dataclass
class _Row:
    lines: list[_Line]
    y0: float
    y1: float
    cy: float
    h: float
    toks: list[_Tok] = field(default_factory=list)


def _tokens(ln: _Line) -> list[_Tok]:
    """Words of a line with their x-range on the page (from the recogniser's character positions)."""
    left, right = float(ln.src.quad[0][0]), float(ln.src.quad[1][0])
    out = []
    for m in re.finditer(r"\S+", ln.text):
        f0, f1 = _x_range(ln, m.start(), m.end())
        out.append(_Tok(m.group(0), left + f0 * (right - left), left + f1 * (right - left), min(ln.conf[m.start():m.end()])))
    return out


def _rows(lines: list[_Line]) -> list[_Row]:
    """Group lines that sit on the same baseline (a label and its value, a stamp next to text)."""
    rows: list[_Row] = []
    for ln in sorted(lines, key=lambda l: (l.src.cy, l.src.x0)):
        s = ln.src
        for row in reversed(rows[-4:]):
            if abs(s.cy - row.cy) < 0.5 * min(s.h, row.h):
                n = len(row.lines)
                row.lines.append(ln)
                row.cy = (row.cy * n + s.cy) / (n + 1)
                row.y0, row.y1, row.h = min(row.y0, s.y0), max(row.y1, s.y1), max(row.h, s.h)
                break
        else:
            rows.append(_Row([ln], s.y0, s.y1, s.cy, s.h))
    for row in rows:
        per_line = [t for t in (_tokens(ln) for ln in row.lines) if t]
        per_line.sort(key=lambda ts: ts[0].x0)
        row.toks = [t for ts in per_line for t in ts]
    rows.sort(key=lambda r: r.cy)
    return rows


def _mark_unread_ink(rows: list[_Row], gray: np.ndarray) -> None:
    """Insert [illegible] wherever a row has ink between two recognised words, or just after the
    last one, that the recogniser returned no text for (it can sit inside a detection box)."""
    if not rows:
        return
    paper = float(np.percentile(gray, 90))
    right_edge = max(r.toks[-1].x1 for r in rows if r.toks)
    for row in rows:
        lh = row.h
        y0, y1 = row.y0 + 0.1 * lh, row.y1 - 0.1 * lh
        out: list[_Tok] = []
        for i, tok in enumerate(row.toks):
            out.append(tok)
            nxt = row.toks[i + 1] if i + 1 < len(row.toks) else None
            gx0 = tok.x1 + 0.15 * lh
            # after the last word: look up to the page's text margin, and at least a few characters on
            gx1 = (nxt.x0 - 0.15 * lh) if nxt else min(tok.x1 + 8 * lh, max(right_edge + 0.5 * lh, tok.x1 + 4 * lh), gray.shape[1])
            if gx1 - gx0 >= 0.8 * lh and _has_ink(gray, paper, gx0, gx1, y0, y1, lh):
                out.append(_Tok(ILLEGIBLE, gx0, gx1, 0.0))
        row.toks = out


def assemble(lines: list[OcrLine], frame: np.ndarray, page_no: int, engine=None):
    """Turn PaddleOCR lines into page text with per-word confidence spans."""
    import cv2

    from .text_extract import PageText

    work: list[_Line] = []
    for src in lines:
        raw = src.text.strip()
        if not any(c.isalnum() for c in raw):
            continue  # punctuation-only specks: border dashes, "|" from table rules
        if src.score < ILLEGIBLE_LINE_SCORE:
            src = OcrLine(ILLEGIBLE, 0.0, src.quad)
            raw = ILLEGIBLE
        text, idx = _normalise(raw)
        work.append(_Line(src, text, idx, [round(100.0 * src.score, 1)] * len(text)))

    if engine is not None and work:
        _verify_dates([ln for ln in work if ln.text != ILLEGIBLE], frame, engine)

    rows = _rows(work)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 else frame
    _mark_unread_ink(rows, gray)

    # paragraph breaks: a vertical gap clearly larger than the usual gap between lines
    gaps = [rows[i + 1].y0 - rows[i].y1 for i in range(len(rows) - 1)]
    heights = sorted(r.h for r in rows) or [1.0]
    med_h = heights[len(heights) // 2]
    med_gap = sorted(gaps)[len(gaps) // 2] if len(gaps) >= 3 else 0.0

    parts: list[str] = []
    words: list[list[float]] = []
    real: list[float] = []
    pos = 0
    for i, row in enumerate(rows):
        if i:
            sep = "\n\n" if gaps[i - 1] > med_gap + 0.35 * med_h else "\n"
            parts.append(sep)
            pos += len(sep)
        for j, tok in enumerate(row.toks):
            if j:
                parts.append(" ")
                pos += 1
            parts.append(tok.text)
            words.append([pos, pos + len(tok.text), round(tok.conf, 1)])
            if tok.text != ILLEGIBLE:
                real.append(tok.conf)
            pos += len(tok.text)
    mean = round(sum(real) / len(real), 1) if real else 0.0
    return PageText(page_no=page_no, text="".join(parts), method="ocr", confidence=mean, words=words)


def ocr_image(img: Image.Image | np.ndarray, page_no: int, engine=None):
    """OCR one page image (PIL image, or a BGR array) and return a PageText."""
    eng = engine or get_engine()
    bgr = img if isinstance(img, np.ndarray) else to_bgr(img)
    lines, frame = eng.read(bgr)
    return assemble(lines, frame, page_no, eng)


if __name__ == "__main__":  # python -m app.parsing.ocr --download   (used by the Docker build)
    import json
    import sys

    logging.basicConfig(level=logging.INFO)
    warm_up()
    print(json.dumps(status(), indent=2))
    sys.exit(0 if _engine.state == "ready" else 1)
