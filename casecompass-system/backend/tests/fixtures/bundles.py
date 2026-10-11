"""Test fixtures only: fictional case bundles generated as real files.

Not part of the application. The test suite uploads these through the API so the full
pipeline (text layer, OCR, classification, extraction, flagging) is exercised exactly as
with real uploads. The civil bundle mixes text PDFs, scanned PDFs and a phone-style JPG.
All names, numbers and events are fictional.
"""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
COURT = "IN THE COURT OF THE DISTRICT JUDGE (COMMERCIAL COURT), PUNE"
MAGISTRATE = "IN THE COURT OF THE JUDICIAL MAGISTRATE FIRST CLASS, PUNE"

# kind: pdf (text layer) | scan (image-only PDF, needs OCR) | jpg (photo of a page)
CIVIL = [
    ("Legal_notice_12.01.2026.pdf", "pdf", [
        "LEGAL NOTICE\nDated: 12.01.2026\n\nTo,\nOrion Logistics Pvt. Ltd.,\nPlot 14, MIDC Bhosari, Pune 411026\n\n"
        "Subject: Legal notice for recovery of outstanding dues\n\n"
        "Under instructions from and on behalf of our client, M/s Mehta Traders, we serve upon you the following legal notice.\n\n"
        "This legal notice is issued on 12.01.2026 on behalf of our client, M/s Mehta Traders, calling upon you to clear the "
        "outstanding dues. Our client supplied packaging material to you and raised invoices that remain unpaid.",
        "You are hereby called upon to pay the said amount within 15 days of receipt of this notice, failing which our client "
        "will initiate legal proceedings against you at your risk as to costs.\n\nYours faithfully,\nAdvocate for M/s Mehta Traders",
    ]),
    ("Plaint_CS_COMM_118_2026.pdf", "pdf", [
        f"{COURT}\nCS (COMM) 118/2026\n\nM/s Mehta Traders, Pune ... Plaintiff\nVersus\nOrion Logistics Pvt. Ltd., Pune ... Defendant\n\n"
        "PLAINT\nSUIT FOR RECOVERY OF MONEY\n\n"
        "The present suit for recovery of money is instituted before this Court on 20.02.2026. The Plaintiff supplied goods to the "
        "Defendant under the supply agreement marked as Exhibit P-1. The Plaintiff issued a legal notice dated 12.01.2026 to the "
        "Defendant, which remains unanswered.",
        "The Plaintiff therefore prays that this Court may be pleased to pass a decree for Rs. 18,40,000 with interest and costs.",
    ]),
    ("Exhibit_P1_Supply_agreement.pdf", "scan", [
        "EXHIBIT P-1\nSUPPLY AGREEMENT\n\nThis Supply Agreement is made on 05.08.2025 between M/s Mehta Traders, Pune (the Supplier) "
        "and Orion Logistics Pvt. Ltd., Pune (the Buyer). The Supplier shall deliver packaging material as per purchase orders "
        "issued by the Buyer from time to time. The Buyer shall pay each invoice as per the agreed terms.",
    ]),
    ("Summons_service_report.pdf", "scan", [
        "SUMMONS SERVICE REPORT\nIn CS (COMM) 118/2026\n\nReport of the Process Server\n\n"
        "Summons duly served upon the Defendant through its authorised representative on 06.03.2026. The authorised "
        "representative signed the acknowledgement in my presence.",
        "The Defendant is directed to file its written statement on or before 10.04.2026.\n\n[[STAMP:Received on 1?/0?/2026 [stamp partly illegible]]]",
    ]),
    ("Written_statement_Defendant.pdf", "pdf", [
        f"{COURT}\nCS (COMM) 118/2026\n\nWRITTEN STATEMENT ON BEHALF OF THE DEFENDANT\n\n"
        "Written statement on behalf of the Defendant, filed on 08.04.2026. The summons in the present suit were served upon the "
        "Defendant on 11.03.2026.",
        "The answering Defendant received the alleged legal notice only on 19.01.2026. The contents of the legal notice dated "
        "12.01.2026 are denied.",
        "It is denied that the goods were supplied as alleged. Without prejudice, the consignment was dispatched on or about late "
        "autumn of the preceding year.",
    ]),
    ("Counter_claim_Defendant.pdf", "pdf", [
        "COUNTER-CLAIM ON BEHALF OF THE DEFENDANT\nIn CS (COMM) 118/2026\n\n"
        "The Defendant raises the present counter-claim against the Plaintiff, filed along with the written statement on "
        "08.04.2026. The Defendant claims damages of Rs. 4,50,000 for delayed and defective supplies.",
    ]),
    ("Replication_Plaintiff.pdf", "pdf", [
        "REPLICATION ON BEHALF OF THE PLAINTIFF\nIn CS (COMM) 118/2026\n\n"
        "Replication on behalf of the Plaintiff to the written statement, filed on 06.05.2026. The contents of the written "
        "statement are denied except what is specifically admitted.",
        "The Defendant received the legal notice on 16.01.2026, as shown by the postal acknowledgement.",
    ]),
    ("IA_214_2026_interim_injunction.pdf", "pdf", [
        f"{COURT}\nI.A. No. 214/2026 in CS (COMM) 118/2026\n\nAPPLICATION UNDER ORDER XXXIX RULES 1 AND 2 CPC FOR INTERIM INJUNCTION\n\n"
        "Application seeking an interim injunction restraining the Defendant from alienating the goods, filed on 19.05.2026. "
        "The Plaintiff apprehends that the Defendant may dispose of the goods during the pendency of the suit.",
    ]),
    ("Order_03.06.2026.pdf", "scan", [
        f"{COURT}\nCS (COMM) 118/2026\n\nORDER\nDated: 03.06.2026\n\n"
        "Present: Counsel for the Plaintiff. None for the Defendant.\n\n"
        "In continuation of order dated 22.05.2026, an ad-interim injunction is granted ex parte till the next date of hearing. "
        "Notice be issued on IA No. 214/2026.",
        "List for admission/denial of documents on 15.07.2026.",
    ]),
    ("Affidavit_admission_denial.pdf", "pdf", [
        "AFFIDAVIT OF ADMISSION/DENIAL OF DOCUMENTS\nOn behalf of the Plaintiff in CS (COMM) 118/2026\n\n"
        "Affidavit of admission/denial of documents on behalf of the Plaintiff, sworn and filed on 29.07.2026. The deponent admits "
        "the documents filed by the Plaintiff and denies the documents filed by the Defendant.",
    ]),
    ("Order_sheet_14.09.2026.jpg", "jpg", [
        f"{COURT}\nCS (COMM) 118/2026\n\nORDER SHEET\nDated: 14.09.2026\n\n"
        "The mediation having failed, issues are framed. Matter is listed for the Plaintiff's evidence. The Plaintiff shall file "
        "affidavits of evidence on or before 16.10.2026. Reply to IA No. 302/2026 be filed within two weeks.",
    ]),
    ("Order_25.09.2026.pdf", "pdf", [
        f"{COURT}\nCS (COMM) 118/2026\n\nORDER\nDated: 25.09.2026\n\n"
        "Having heard the parties on IA No. 302/2026, a Local Commissioner is appointed to record evidence. This order is in "
        "continuation of the order sheet dated 14.09.2026.",
        "The Commissioner's fee shall be deposited by the Plaintiff on or before 21.10.2026. The Local Commissioner shall submit "
        "the report on or before 30.11.2026.",
        "Cross-examination of PW-1 shall be concluded by 18.12.2026. List before the Court on 04.11.2026.",
    ]),
]

CRIMINAL = [
    ("FIR_112_2026_Kothrud.pdf", "scan", [
        "FIRST INFORMATION REPORT\nFIR No. 112/2026\nPolice Station: Kothrud, Pune\nDate and time of FIR: 02.03.2026, 18:40\n\n"
        "The FIR was registered on 02.03.2026 on the complaint of Sunita Deshpande alleging cheating and criminal breach of trust. "
        "The complainant states that the accused collected Rs. 6,20,000 from her for a business investment sometime in the first "
        "week of January 2026 and stopped responding thereafter.",
    ]),
    ("Bail_application_87_2026.pdf", "pdf", [
        f"{MAGISTRATE}\nBail Application No. 87/2026 in FIR No. 112/2026\n\nAPPLICATION FOR REGULAR BAIL ON BEHALF OF THE ACCUSED\n\n"
        "The accused was arrested on 05.03.2026 and has been in judicial custody since then. The bail application is filed on "
        "09.03.2026 on behalf of the accused. The investigation is substantially complete and the accused undertakes to cooperate.",
    ]),
    ("Order_on_bail_16.03.2026.jpg", "jpg", [
        f"{MAGISTRATE}\nORDER ON BAIL\nDated: 16.03.2026\n\n"
        "The accused was arrested on 04.03.2026 as per the arrest memo. Bail is granted to the accused on furnishing a personal "
        "bond of Rs. 50,000 with one surety. The accused shall appear before the Investigating Officer on 23.03.2026.",
    ]),
    ("Chargesheet_FIR_112_2026.pdf", "pdf", [
        "FINAL REPORT UNDER SECTION 193 BNSS (CHARGESHEET)\nFIR No. 112/2026, Police Station Kothrud\n\n"
        "The chargesheet is filed on 28.05.2026 against the accused R. Kulkarni. The forensic report on the mobile phone recovered "
        "from the accused is awaited and will be filed separately. The seizure memo dated 06.03.2026 is annexed.",
    ]),
]

SETS = {"civil": CIVIL, "criminal": CRIMINAL}


# --------------------------------------------------------------------------- rendering

def _pdf(path: Path, pages: list[str]) -> None:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

    head = ParagraphStyle("h", fontName="Times-Bold", fontSize=12, leading=16, alignment=1, spaceAfter=4)
    body = ParagraphStyle("b", fontName="Times-Roman", fontSize=12, leading=17, spaceAfter=10)
    story = []
    for i, page in enumerate(pages):
        for block in page.split("\n\n"):
            lines = block.split("\n")
            if all(ln.isupper() or ln.strip().endswith(("2026", "Plaintiff", "Defendant", "Versus")) for ln in lines if ln.strip()) and len(block) < 400:
                for ln in lines:
                    story.append(Paragraph(ln.replace("&", "&amp;"), head if ln.isupper() else body))
            else:
                story.append(Paragraph("<br/>".join(ln.replace("&", "&amp;") for ln in lines), body))
            story.append(Spacer(1, 4))
        if i < len(pages) - 1:
            story.append(PageBreak())
    SimpleDocTemplate(str(path), pagesize=A4, leftMargin=72, rightMargin=72, topMargin=72, bottomMargin=72).build(story)


def _render_page(text: str, seed: int) -> Image.Image:
    W, H = 1654, 2339  # A4 at 200 dpi
    img = Image.new("L", (W, H), 250)
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(str(FONT_DIR / "DejaVuSerif.ttf"), 34)
    fb = ImageFont.truetype(str(FONT_DIR / "DejaVuSerif-Bold.ttf"), 34)
    x0, y, maxw = 150, 170, W - 300
    for block in text.split("\n\n"):
        for line in block.split("\n"):
            if line.startswith("[[STAMP:"):
                stamp = line[8:-2]
                y += 30
                bw = d.textlength(stamp, font=f) + 60
                d.rectangle([x0, y, x0 + bw, y + 90], outline=70, width=4)
                d.text((x0 + 30, y + 24), stamp, font=f, fill=55)
                rnd = random.Random(seed)
                for _ in range(26):  # ink smudges over the date digits
                    cx = x0 + 30 + d.textlength("Received on ", font=f) + rnd.randint(0, 150)
                    cy = y + 30 + rnd.randint(0, 40)
                    r = rnd.randint(5, 13)
                    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rnd.randint(120, 175))
                y += 120
                continue
            font = fb if line.isupper() else f
            words, cur = line.split(" "), ""
            for w in words:
                trial = (cur + " " + w).strip()
                if d.textlength(trial, font=font) > maxw:
                    d.text((x0, y), cur, font=font, fill=25)
                    y += 50
                    cur = w
                else:
                    cur = trial
            if cur:
                cx = x0 + (maxw - d.textlength(cur, font=font)) / 2 if line.isupper() else x0
                d.text((cx, y), cur, font=font, fill=25)
            y += 50
        y += 28
    rnd = random.Random(seed)
    img = img.rotate(rnd.uniform(-0.6, 0.6), fillcolor=250, resample=Image.BICUBIC)
    px = img.load()
    for _ in range(9000):  # scanner speckle
        px[rnd.randrange(W), rnd.randrange(H)] = rnd.randint(140, 220)
    return img.filter(ImageFilter.GaussianBlur(0.6))


def _scan_pdf(path: Path, pages: list[str]) -> None:
    imgs = [_render_page(p, i + len(path.name)).convert("RGB") for i, p in enumerate(pages)]
    imgs[0].save(path, "PDF", resolution=200.0, save_all=True, append_images=imgs[1:])


def _jpg(path: Path, pages: list[str]) -> None:
    _render_page(pages[0], len(path.name)).convert("RGB").save(path, "JPEG", quality=82)


def build_set(name: str, out_dir: Path) -> list[Path]:
    """Generate (once per directory) and return the files of a bundle."""
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for filename, kind, pages in SETS[name]:
        p = out_dir / filename
        if not p.exists():
            {"pdf": _pdf, "scan": _scan_pdf, "jpg": _jpg}[kind](p, pages)
        paths.append(p)
    return paths
