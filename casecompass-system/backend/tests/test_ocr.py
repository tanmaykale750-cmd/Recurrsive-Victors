"""OCR layer and PDF page planning. A fake engine stands in for PaddleOCR, so these run without
models; the API tests exercise the real PaddleOCR pipeline end to end."""
import numpy as np
import pymupdf
import pytest
from PIL import Image, ImageDraw, ImageFont

from app.config import settings
from app.parsing import ocr, text_extract
from app.parsing.analyze import analyze
from app.parsing.text_extract import ExtractionError, PageText, _garbled, _plan, extract_pages

CHAR_W, LINE_H = 20.0, 40.0


def line(text, x0, y0, score=0.99):
    """An OcrLine as PaddleOCR would return it, with word pieces (words, spaces, symbols)."""
    import re

    pieces = re.findall(r"[A-Za-z0-9.]+|\s+|[^A-Za-z0-9.\s]+", text)
    px, x = [], x0
    for p in pieces:
        px.append((x, x + CHAR_W * len(p)))
        x += CHAR_W * len(p)
    x1 = x0 + CHAR_W * len(text)
    quad = np.array([[x0, y0], [x1, y0], [x1, y0 + LINE_H], [x0, y0 + LINE_H]], dtype=np.float32)
    return ocr.OcrLine(text, score, quad, pieces, px)


class FakeEngine:
    def __init__(self, lines, rereads=None):
        self.lines, self.rereads, self.asked = lines, rereads or {}, []

    def read(self, bgr):
        return self.lines, bgr

    def reread(self, crops):
        out = []
        for _ in crops:
            key = len(self.asked)
            self.asked.append(key)
            out.append(self.rereads.get(key, ("", 0.0, None)))
        return out


def blank(w=1600, h=600):
    return np.full((h, w, 3), 250, dtype=np.uint8)


def page_from(lines, frame=None, rereads=None):
    eng = FakeEngine(lines, rereads)
    return ocr.ocr_image(frame if frame is not None else blank(), 1, engine=eng), eng


def word_conf(pt, word):
    i = pt.text.index(word)
    return min(w[2] for w in pt.words if w[0] < i + len(word) and w[1] > i)


# --------------------------------------------------------------------------- layout


def test_rows_paragraphs_and_word_spans():
    pt, _ = page_from([
        line("ORDER SHEET", 100, 40),
        line("Dated:", 100, 100), line("Pune", 600, 102),  # same row, separate boxes
        line("The suit is decreed with costs.", 100, 200),  # a clear vertical gap -> new paragraph
        line("Office to draw the decree.", 100, 242),
    ])
    assert pt.text == "ORDER SHEET\nDated: Pune\n\nThe suit is decreed with costs.\nOffice to draw the decree."
    assert pt.method == "ocr" and pt.confidence == 99.0
    for a, b, c in pt.words:
        assert pt.text[a:b].strip() == pt.text[a:b] and c == 99.0


def test_punctuation_specks_dropped_and_weak_lines_marked_illegible():
    pt, _ = page_from([line("|", 50, 40), line("Notice issued to the Defendant", 100, 40), line("xq;r", 100, 120, score=0.2)])
    assert pt.text == "Notice issued to the Defendant\n\n[illegible]"
    assert word_conf(pt, "[illegible]") == 0.0


def test_unread_ink_between_words_becomes_illegible():
    frame = blank()
    img = Image.fromarray(frame)
    d = ImageDraw.Draw(img)
    for cx in range(372, 470, 14):  # blots where the date should be, after "Received on"
        d.ellipse([cx - 9, 108, cx + 9, 128], fill=140)
    frame = np.asarray(img).copy()
    lines = [line("Received on", 100, 100), line("26 stamp", 520, 100)]
    pt, _ = page_from(lines, frame)
    assert pt.text == "Received on [illegible] 26 stamp"
    # the same gap without ink, or with only an underline (a blank to fill in), stays empty
    assert page_from(lines)[0].text == "Received on 26 stamp"
    img = Image.fromarray(blank())
    ImageDraw.Draw(img).line([370, 136, 500, 136], fill=30, width=2)
    assert page_from(lines, np.asarray(img).copy())[0].text == "Received on 26 stamp"


def test_normalise_repairs_missing_spaces_and_keeps_an_index_map():
    for raw, want in [
        ("filed on or before16.10.2026.Reply toIA No.", "filed on or before 16.10.2026. Reply to IA No."),
        ("appear beforethe Investigating Officer asper", "appear before the Investigating Officer as per"),
        ("Notice be issuedon IA", "Notice be issued on IA"),
        ("together into upon husband 15th Bethel", "together into upon husband 15th Bethel"),
    ]:
        out, idx = ocr._normalise(raw)
        assert out == want and len(idx) == len(out)
        assert all(raw[idx[i]] == ch for i, ch in enumerate(out) if ch != " ")


# --------------------------------------------------------------------------- second read of dates


def test_agreeing_second_read_scores_the_date_by_its_weakest_digit():
    chars = [0.99] * len("served on 12.03.2026")
    chars[len("served on 12.0")] = 0.62  # one doubtful digit
    lines = [line("Summons served on 12.03.2026 at the office.", 100, 100)]
    pt, eng = page_from(lines, rereads={0: ("served on 12.03.2026", 0.95, chars)})
    assert len(eng.asked) == 1
    assert word_conf(pt, "12.03.2026") == 62.0
    assert word_conf(pt, "Summons") == 99.0  # the rest of the line keeps the line score


def test_disagreeing_second_read_is_never_trusted():
    lines = [line("Summons served on 12.03.2026 at the office.", 100, 100)]
    pt, eng = page_from(lines, rereads={0: ("17.08.2026", 0.99, None), 1: ("17.08.2026", 0.99, None)})
    assert len(eng.asked) == 2  # retried once with a wider crop
    assert word_conf(pt, "12.03.2026") < settings.ocr_min_confidence


def test_stain_over_a_date_is_detected_but_highlighter_is_not():
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 34)
    clean = Image.new("RGB", (260, 60), (250, 250, 250))
    ImageDraw.Draw(clean).text((10, 10), "24.07.2025", font=font, fill=(25, 25, 25))
    stained = clean.copy()
    d = ImageDraw.Draw(stained)
    for cx, cy in [(40, 30), (60, 22), (150, 35), (205, 28), (225, 40)]:
        d.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(150, 150, 150))
    highlighted = clean.copy()
    ImageDraw.Draw(highlighted, "RGBA").rectangle([5, 8, 250, 52], fill=(255, 120, 190, 110))
    bgr = lambda im: np.asarray(im)[:, :, ::-1].copy()  # noqa: E731
    assert not ocr._stained(bgr(clean))
    assert ocr._stained(bgr(stained))
    assert not ocr._stained(bgr(highlighted))


# --------------------------------------------------------------------------- analysis of OCR'd text


def test_illegible_stamp_and_doubtful_header_dates_are_quarantined():
    pt = PageText(1, "Received on [illegible] 26 [stamp partly illegible]", "ocr", 97.0,
                  [[0, 8, 98.0], [9, 11, 98.0], [12, 23, 0.0], [24, 26, 97.0], [27, 33, 97.0], [34, 40, 97.0], [41, 51, 97.0]])
    an = analyze([pt], doc_code="D1", doc_type="Report", doc_date=None, doc_title="t", use_ai=False)
    assert [q["reason"] for q in an.quarantine] == ["Illegible date stamp"]
    # a short header-like line with a low-confidence date is quarantined, not filed as a header
    pt = PageText(1, "Received on 14.02.2024", "ocr", 90.0, [[0, 8, 98.0], [9, 11, 98.0], [12, 22, 61.0]])
    an = analyze([pt], doc_code="D1", doc_type="Report", doc_date=None, doc_title="t", use_ai=False)
    assert [q["reason"] for q in an.quarantine] == ["Low OCR confidence"]
    # a broken date after a cue, read confidently, is still an illegible date
    pt = PageText(1, "The written statement was filed on 3.62036 at the registry.", "ocr", 98.0,
                  [[a, a + len(w), 98.0] for a, w in [(0, "The"), (4, "written"), (12, "statement"), (22, "was"), (26, "filed"),
                                                     (32, "on"), (35, "3.62036"), (43, "at"), (46, "the"), (50, "registry.")]])
    an = analyze([pt], doc_code="D1", doc_type="Report", doc_date=None, doc_title="t", use_ai=False)
    assert [q["reason"] for q in an.quarantine] == ["Illegible date stamp"]


# --------------------------------------------------------------------------- PDF page planning


def _img_bytes(text="SCANNED ORDER  Dated 12.03.2026", size=(1240, 1754)):
    im = Image.new("RGB", size, (248, 248, 248))
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 30)
    ImageDraw.Draw(im).text((100, 200), text, font=font, fill=(20, 20, 20))
    import io

    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


LONG = ("The Plaintiff filed the present suit for recovery of money on 20.02.2026 against the Defendant "
        "under the supply agreement, and the Defendant filed its written statement on 08.04.2026. ") * 4


def _pdf(tmp_path, build):
    doc = pymupdf.open()
    page = doc.new_page()
    build(page)
    path = tmp_path / "t.pdf"
    doc.save(path)
    return pymupdf.open(path)[0]


def test_page_plans(tmp_path):
    def text_page(p):
        p.insert_textbox(pymupdf.Rect(72, 72, 520, 700), LONG, fontsize=11)

    def scan(p):
        p.insert_image(p.rect, stream=_img_bytes())

    def scan_with_scanner_ocr_layer(p):
        p.insert_image(p.rect, stream=_img_bytes())
        p.insert_textbox(pymupdf.Rect(72, 72, 520, 700), LONG, fontsize=11, render_mode=3)

    def scan_with_efiling_footer(p):
        p.insert_image(p.rect, stream=_img_bytes())
        p.insert_text((72, 820), "Digitally signed by the Registrar, District Court Pune on 12.03.2026", fontsize=8)

    def typed_page_with_stamp_image(p):
        p.insert_textbox(pymupdf.Rect(72, 72, 520, 500), LONG, fontsize=11)
        p.insert_image(pymupdf.Rect(300, 600, 520, 720), stream=_img_bytes("RECEIVED 14.03.2026", (880, 480)))

    assert _plan(_pdf(tmp_path, text_page)) == "text"
    assert _plan(_pdf(tmp_path, scan)) == "ocr"
    assert _plan(_pdf(tmp_path, scan_with_scanner_ocr_layer)) == "ocr"
    assert _plan(_pdf(tmp_path, scan_with_efiling_footer)) == "ocr"
    assert _plan(_pdf(tmp_path, typed_page_with_stamp_image)) == "mixed"


def test_garbled_text_layers():
    assert _garbled("(cid:12)(cid:7)(cid:44)(cid:9) (cid:3)(cid:18)")
    assert _garbled("��� �� text")
    assert _garbled("Thx prsnt st fr rcvry mny wth cst nd ntrst grntd by th crt n ths mttr")
    assert not _garbled(LONG)


def test_mixed_page_reads_text_layer_and_ocrs_the_stamp(tmp_path, monkeypatch):
    path = tmp_path / "mixed.pdf"
    doc = pymupdf.open()
    p = doc.new_page()
    p.insert_textbox(pymupdf.Rect(72, 72, 520, 500), LONG, fontsize=11)
    p.insert_image(pymupdf.Rect(300, 600, 520, 720), stream=_img_bytes("RECEIVED 14.03.2026", (880, 480)))
    doc.save(path)
    monkeypatch.setattr(ocr, "_engine", FakeEngine([line("RECEIVED 14.03.2026", 60, 60)], {0: ("RECEIVED 14.03.2026", 0.99, None)}))
    pages, fmt = extract_pages(path)
    assert fmt == "PDF" and pages[0].method == "mixed"
    assert pages[0].text.startswith("The Plaintiff filed") and pages[0].text.endswith("RECEIVED 14.03.2026")
    stamp = pages[0].text.index("14.03.2026")
    assert text_extract.span_confidence(pages[0].words, stamp, stamp + 10) == 99.0
    assert text_extract.span_confidence(pages[0].words, 0, 10) is None  # text-layer words need no confidence


def test_missing_ocr_engine_fails_scans_clearly_but_not_text_pdfs(tmp_path, monkeypatch):
    def boom(*a, **k):
        raise ocr.OCRUnavailable("models could not be downloaded")

    monkeypatch.setattr(ocr, "ocr_image", boom)
    doc = pymupdf.open()
    doc.new_page().insert_image(pymupdf.Rect(0, 0, 595, 842), stream=_img_bytes())
    doc.save(tmp_path / "scan.pdf")
    with pytest.raises(ExtractionError, match="OCR engine is unavailable"):
        extract_pages(tmp_path / "scan.pdf")
    doc = pymupdf.open()
    doc.new_page().insert_textbox(pymupdf.Rect(72, 72, 520, 700), LONG, fontsize=11)
    doc.save(tmp_path / "typed.pdf")
    pages, fmt = extract_pages(tmp_path / "typed.pdf")
    assert fmt == "PDF" and pages[0].method == "text" and "20.02.2026" in pages[0].text
