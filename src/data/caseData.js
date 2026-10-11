/* =========================================================
   DEMO DATA: fictional case material only.
   In production, replace these constants with responses from
   your backend (OCR + extraction service). Live court systems
   are never used or assumed.
   ========================================================= */

// Fixed "today" keeps the demo stable. Use dayjs().format('YYYY-MM-DD') in production.
export const TODAY_STR = '2026-10-11'
export const REVIEWER = 'Ananya K.'

export const ACTIVE_CASE = {
  id: 'c1',
  title: 'Mehta Traders v. Orion Logistics Pvt. Ltd.',
  short: 'Mehta Traders v. Orion',
  no: 'CS (COMM) 118/2026',
  court: 'Commercial Court (fictional)',
  type: 'civil',
}

/* Documents in the uploaded bundle. `refs` = other documents this one refers to. */
export const DOCS = {
  D01: { name: 'Legal notice dated 12.01.2026', type: 'Notice', pages: 3, uploaded: '2026-02-02', format: 'PDF', refs: [] },
  D02: { name: 'Plaint, CS (COMM) 118/2026', type: 'Pleading', pages: 24, uploaded: '2026-02-21', format: 'PDF', refs: [{ label: 'Legal notice dated 12.01.2026', doc: 'D01' }, { label: 'Exhibit P-1: Supply agreement', doc: 'D03' }] },
  D03: { name: 'Exhibit P-1: Supply agreement', type: 'Exhibit', pages: 11, uploaded: '2026-02-21', format: 'Scanned PDF', refs: [] },
  D04: { name: 'Summons service report', type: 'Court record', pages: 2, uploaded: '2026-03-14', format: 'Scanned image', refs: [{ label: 'Plaint, CS (COMM) 118/2026', doc: 'D02' }] },
  D05: { name: 'Written statement of Defendant', type: 'Pleading', pages: 31, uploaded: '2026-04-12', format: 'PDF', refs: [{ label: 'Legal notice dated 12.01.2026', doc: 'D01' }, { label: 'Summons service report', doc: 'D04' }] },
  D06: { name: 'Counter-claim of Defendant', type: 'Pleading', pages: 14, uploaded: '2026-04-12', format: 'PDF', refs: [{ label: 'Written statement of Defendant', doc: 'D05' }] },
  D07: { name: 'Replication of Plaintiff', type: 'Pleading', pages: 12, uploaded: '2026-05-08', format: 'PDF', refs: [{ label: 'Written statement of Defendant', doc: 'D05' }] },
  D08: { name: 'IA No. 214/2026 (interim injunction)', type: 'Application', pages: 9, uploaded: '2026-05-20', format: 'PDF', refs: [{ label: 'Plaint, CS (COMM) 118/2026', doc: 'D02' }] },
  D09: { name: 'Order dated 03.06.2026', type: 'Court order', pages: 4, uploaded: '2026-06-05', format: 'Scanned PDF', refs: [{ label: 'Order dated 22.05.2026', gap: 'G01' }, { label: 'IA No. 214/2026', doc: 'D08' }] },
  D10: { name: 'Affidavit of admission/denial', type: 'Affidavit', pages: 6, uploaded: '2026-07-30', format: 'PDF', refs: [] },
  D11: { name: 'Order sheet dated 14.09.2026', type: 'Court order', pages: 2, uploaded: '2026-09-16', format: 'Scanned image', refs: [{ label: 'IA No. 302/2026', gap: 'G02' }, { label: 'Mediation report', gap: 'G03' }] },
  D12: { name: 'Order dated 25.09.2026', type: 'Court order', pages: 3, uploaded: '2026-09-27', format: 'PDF', refs: [{ label: 'IA No. 302/2026', gap: 'G02' }, { label: 'Order sheet dated 14.09.2026', doc: 'D11' }] },
}

/* Every item must carry a source: document, page and the exact sentence. */
export const ITEMS = [
  { id: 'E01', kind: 'event', date: '2026-01-12', title: 'Legal notice issued to Orion Logistics', doc: 'D01', page: 1, quote: 'This legal notice is issued on 12.01.2026 on behalf of our client, M/s Mehta Traders, calling upon you to clear the outstanding dues.' },
  { id: 'C01', kind: 'conflict', title: 'Defendant receives the legal notice', dates: [
    { date: '2026-01-16', doc: 'D07', page: 3, quote: 'The Defendant received the legal notice on 16.01.2026, as shown by the postal acknowledgement.' },
    { date: '2026-01-19', doc: 'D05', page: 4, quote: 'The answering Defendant received the alleged legal notice only on 19.01.2026.' }] },
  { id: 'E02', kind: 'event', date: '2026-02-20', title: 'Plaint filed; suit for recovery instituted', doc: 'D02', page: 1, quote: 'The present suit for recovery of money is instituted before this Court on 20.02.2026.' },
  { id: 'C02', kind: 'conflict', title: 'Summons served on Defendant', dates: [
    { date: '2026-03-06', doc: 'D04', page: 1, quote: 'Summons duly served upon the Defendant through its authorised representative on 06.03.2026.' },
    { date: '2026-03-11', doc: 'D05', page: 1, quote: 'The summons in the present suit were served upon the Defendant on 11.03.2026.' }] },
  { id: 'E03', kind: 'event', date: '2026-04-08', title: 'Written statement filed by Defendant', doc: 'D05', page: 1, quote: 'Written statement on behalf of the Defendant, filed on 08.04.2026.' },
  { id: 'E04', kind: 'event', date: '2026-04-08', title: 'Counter-claim filed by Defendant', doc: 'D06', page: 1, quote: 'The Defendant raises the present counter-claim against the Plaintiff, filed along with the written statement on 08.04.2026.' },
  { id: 'L01', kind: 'deadline', date: '2026-04-10', title: 'Written statement to be filed', party: 'Defendant', doc: 'D04', page: 2, quote: 'The Defendant is directed to file its written statement on or before 10.04.2026.' },
  { id: 'E05', kind: 'event', date: '2026-05-06', title: 'Replication filed by Plaintiff', doc: 'D07', page: 1, quote: 'Replication on behalf of the Plaintiff to the written statement, filed on 06.05.2026.' },
  { id: 'E06', kind: 'event', date: '2026-05-19', title: 'IA 214/2026 filed seeking interim injunction', doc: 'D08', page: 1, quote: 'Application seeking an interim injunction restraining the Defendant from alienating the goods, filed on 19.05.2026.' },
  { id: 'E07', kind: 'event', date: '2026-06-03', title: 'Ad-interim injunction granted; notice issued on IA', doc: 'D09', page: 2, quote: 'In continuation of order dated 22.05.2026, an ad-interim injunction is granted ex parte till the next date of hearing. Notice be issued on the IA.' },
  { id: 'H01', kind: 'hearing', date: '2026-07-15', title: 'Hearing on admission/denial of documents', doc: 'D09', page: 3, quote: 'List for admission/denial of documents on 15.07.2026.' },
  { id: 'E08', kind: 'event', date: '2026-07-29', title: 'Affidavit of admission/denial filed', doc: 'D10', page: 1, quote: 'Affidavit of admission/denial of documents on behalf of the Plaintiff, sworn and filed on 29.07.2026.' },
  { id: 'E09', kind: 'event', date: '2026-09-14', title: 'Issues framed; listed for Plaintiff evidence', doc: 'D11', page: 1, quote: "The mediation having failed, issues are framed. Matter is listed for the Plaintiff's evidence." },
  { id: 'E10', kind: 'event', date: '2026-09-25', title: 'Local Commissioner appointed to record evidence', doc: 'D12', page: 1, quote: 'Having heard the parties on IA No. 302/2026, a Local Commissioner is appointed to record evidence.' },
  { id: 'L02', kind: 'deadline', date: '2026-10-16', title: 'Plaintiff to file affidavits of evidence', party: 'Plaintiff', doc: 'D11', page: 1, quote: 'The Plaintiff shall file affidavits of evidence on or before 16.10.2026.' },
  { id: 'L03', kind: 'deadline', date: '2026-10-21', title: "Deposit of Commissioner's fee", party: 'Plaintiff', doc: 'D12', page: 2, quote: "The Commissioner's fee shall be deposited by the Plaintiff on or before 21.10.2026." },
  { id: 'H02', kind: 'hearing', date: '2026-11-04', title: 'Next date of hearing before the Court', doc: 'D12', page: 3, quote: 'List before the Court on 04.11.2026.' },
  { id: 'L04', kind: 'deadline', date: '2026-11-30', title: 'Commissioner to submit report', party: 'Local Commissioner', doc: 'D12', page: 2, quote: 'The Local Commissioner shall submit the report on or before 30.11.2026.' },
  { id: 'L05', kind: 'deadline', date: '2026-12-18', title: 'Cross-examination of PW-1 to conclude', party: 'Defendant', doc: 'D12', page: 3, quote: 'Cross-examination of PW-1 shall be concluded by 18.12.2026.' },
]

/* Gaps: referenced-but-missing documents, undated events, skipped steps. */
export const GAPS = [
  { id: 'G01', type: 'missing', date: '2026-05-22', title: 'Order dated 22.05.2026', doc: 'D09', page: 2, quote: 'In continuation of order dated 22.05.2026, an ad-interim injunction is granted ex parte…', why: 'Referred to in a later order, but not in the uploaded bundle.' },
  { id: 'G02', type: 'missing', title: 'IA No. 302/2026', doc: 'D12', page: 1, quote: 'Having heard the parties on IA No. 302/2026, a Local Commissioner is appointed…', why: 'The application is referred to by number. Neither the application nor its date is in the bundle.' },
  { id: 'G03', type: 'undated', title: 'Referral to mediation and its failure', doc: 'D11', page: 1, quote: 'The mediation having failed, issues are framed.', why: 'The record mentions mediation but gives no date for the referral or the report.' },
  { id: 'G04', type: 'sequence', title: 'No reply to the counter-claim on record', doc: 'D06', page: 1, quote: 'The Defendant raises the present counter-claim against the Plaintiff…', why: 'A counter-claim was filed on 08.04.2026, but no written statement or reply to it appears in the bundle.' },
]

/* Dates the parser refused to guess. Confidence = OCR confidence for the snippet. */
export const QUARANTINE = [
  { id: 'Q01', title: 'Payment demanded in the legal notice', reason: 'Relative deadline, no rule supplied', confidence: 94, doc: 'D01', page: 2, quote: '…you are hereby called upon to pay the said amount within 15 days of receipt of this notice.', note: 'The receipt date itself is in conflict (16.01 vs 19.01). CaseCompass will not calculate this deadline.' },
  { id: 'Q02', title: 'Court stamp on summons report', reason: 'Low OCR confidence', confidence: 41, doc: 'D04', page: 2, quote: 'Received on 1?/0?/2026 [stamp partly illegible]', note: 'Handwritten stamp. Two digits could not be read.' },
  { id: 'Q03', title: 'Dispatch of the consignment', reason: 'Vague date wording', confidence: 88, doc: 'D05', page: 7, quote: '…the consignment was dispatched on or about late autumn of the preceding year.', note: 'No calendar date can be read from this phrase.' },
  { id: 'Q04', title: 'Reply to IA 302/2026', reason: 'Relative deadline, no rule supplied', confidence: 97, doc: 'D11', page: 1, quote: 'Reply to IA No. 302/2026 be filed within two weeks.', note: 'Base date is unclear: the date of the order or the date the copy was received.' },
]

/* Glossary supplied by the user. Definitions explain words, not what to do. */
export const GLOSSARY = [
  { term: 'Plaint', alias: ['plaint'], def: 'The written complaint that starts a civil case. It sets out what the plaintiff claims and what they ask the court for.' },
  { term: 'Instituted', alias: ['instituted'], def: 'Formally started or filed in court.' },
  { term: 'Written statement', alias: ['written statement'], def: "The defendant's formal written reply to the plaint." },
  { term: 'Replication', alias: ['replication'], def: "The plaintiff's reply to new points raised in the written statement." },
  { term: 'Counter-claim', alias: ['counter-claim'], def: 'A claim the defendant makes against the plaintiff within the same case.' },
  { term: 'Summons', alias: ['summons'], def: 'A court document telling a person that a case has been filed against them and that they must respond or appear.' },
  { term: 'Legal notice', alias: ['legal notice'], def: 'A formal letter sent before a case is filed, telling the other side about a claim or demand.' },
  { term: 'Ex parte', alias: ['ex parte'], def: 'Done or decided after hearing only one side, without the other side present.' },
  { term: 'Ad-interim', alias: ['ad-interim'], def: 'A short-term order that lasts only until the court hears the matter more fully.' },
  { term: 'Interim injunction', alias: ['interim injunction'], def: 'A temporary court order telling someone to do, or stop doing, something while the case continues.' },
  { term: 'Interlocutory application (IA)', alias: ['IA'], def: 'A request made to the court during a case, before the final decision.' },
  { term: 'Affidavit', alias: ['affidavit', 'affidavits'], def: 'A written statement of facts that the person swears is true.' },
  { term: 'Admission/denial of documents', alias: ['admission/denial'], def: "The stage where each side states which of the other side's documents it accepts and which it disputes." },
  { term: 'Framing of issues', alias: ['issues are framed', 'issues framed'], def: "The court's written list of the specific questions of fact and law the case must decide." },
  { term: 'Mediation', alias: ['mediation'], def: 'A process where a neutral person helps the parties try to reach a settlement.' },
  { term: 'Local Commissioner', alias: ['local commissioner', 'commissioner'], def: 'A person the court appoints to carry out a task for it, such as recording evidence.' },
  { term: 'Cross-examination', alias: ['cross-examination'], def: 'Questioning of a witness by the opposing side.' },
  { term: 'PW-1', alias: ['PW-1'], def: 'Short for "Plaintiff Witness No. 1", the first witness called by the plaintiff.' },
  { term: 'Decree', alias: ['decree'], def: "The formal statement of the court's final decision in a civil case." },
  { term: 'Locus standi', alias: ['locus standi'], def: 'The right of a person to bring a particular case before the court.' },
  { term: 'Certiorari', alias: ['certiorari'], def: 'A writ through which a higher court reviews the decision of a lower court or authority.' },
  { term: 'Cognizance', alias: ['cognizance'], def: 'When a court formally takes notice of an offence so that proceedings can begin.' },
  { term: 'Chargesheet', alias: ['chargesheet'], def: 'The final report the police file in court after completing an investigation.' },
  { term: 'Maintainability', alias: ['maintainability'], def: 'Whether a case can legally be heard by that court or tribunal at all.' },
  { term: 'Rejoinder', alias: ['rejoinder'], def: "A reply to the other side's response." },
]

export const ONGOING_CASES = [
  { id: 'c1', title: 'Mehta Traders v. Orion Logistics Pvt. Ltd.', no: 'CS (COMM) 118/2026', type: 'Civil suit', court: 'Commercial Court (fictional)', stage: 4, stageName: 'Trial and evidence', docs: 12, conflicts: 2, missing: 2, deadlines: 4, next: '2026-10-16', active: true },
  { id: 'c2', title: 'State v. R. Kulkarni', no: 'CC 552/2026', type: 'Criminal case', court: 'Judicial Magistrate (fictional)', stage: 2, stageName: 'Chargesheet and cognizance', docs: 7, conflicts: 0, missing: 1, deadlines: 1, next: '2026-10-28' },
  { id: 'c3', title: 'Sharma Electronics v. Nova Appliances', no: 'CC/TRB/91/2026', type: 'Consumer tribunal', court: 'District Consumer Commission (fictional)', stage: 3, stageName: 'Interim relief', docs: 9, conflicts: 1, missing: 0, deadlines: 2, next: '2026-11-09' },
]

export const PAST_CASES = [
  { id: 'p1', title: 'Kapoor Foods v. Sunrise Cold Storage', no: 'CS 77/2024', type: 'Civil suit', closed: '2025-08-14', last: 'Judgment and decree', docs: 41, events: 96 },
  { id: 'p2', title: 'State v. P. Naidu', no: 'CC 1189/2023', type: 'Criminal case', closed: '2025-11-20', last: 'Final judgment and order on sentence', docs: 63, events: 140 },
  { id: 'p3', title: 'Deshmukh Textiles v. Apex Couriers', no: 'CC/412/2024', type: 'Consumer tribunal', closed: '2026-03-02', last: 'Final order', docs: 18, events: 37 },
]

/* Expected documents per stage, from the case-type templates. */
export const STAGES = {
  civil: {
    label: 'Civil suit', now: 3,
    present: ['Legal notice', 'Plaint (complaint)', 'Initial supporting exhibits', 'Summons service report', 'Written statement', 'Counter-claims', 'Replication / rejoinder', 'Interim applications', 'Affidavits'],
    list: [
      { n: 'Pre-suit and initiation', m: 'Month 0', docs: ['Legal notice', 'Plaint (complaint)', 'Initial supporting exhibits'] },
      { n: 'Defence entry', m: 'Months 1–3', docs: ['Summons service report', 'Written statement', 'Counter-claims', 'Replication / rejoinder'] },
      { n: 'Interlocutory motions and discovery', m: 'Months 4–8', docs: ['Interim applications', 'Affidavits', 'Interrogatories', 'Additional documents list'] },
      { n: 'Trial and evidence', m: 'Months 9–18', docs: ['Affidavits of evidence', 'Deposition transcripts', 'Cross-examination transcripts', 'Commissioner reports'] },
      { n: 'Final disposal and appeal', m: 'Months 19–24+', docs: ['Final written arguments', 'Judgment', 'Decree', 'Appeal petition'] },
    ],
  },
  criminal: {
    label: 'Criminal case', now: -1, present: [],
    list: [
      { n: 'Registration and investigation', m: 'Day 0 – Month 3', docs: ['FIR or private complaint', 'Arrest / bail applications', 'Bail orders'] },
      { n: 'Chargesheet and cognizance', m: 'Months 3–6', docs: ['Final police chargesheet', 'Seizure memos', 'Forensic / cyber expert reports', 'Witness statements'] },
      { n: 'Pre-trial and framing of charges', m: 'Months 6–9', docs: ['Discharge petitions', 'Order framing charges', 'Plea statements'] },
      { n: 'Trial proceedings', m: 'Months 10–30', docs: ['Daily order sheets', 'Prosecution witness transcripts', 'Statement of the accused', 'Defence witness transcripts'] },
      { n: 'Verdict', m: 'Months 30+', docs: ['Final judgment', 'Order on sentence', 'Appeal memorandum'] },
    ],
  },
  tribunal: {
    label: 'Tribunal / consumer', now: -1, present: [],
    list: [
      { n: 'Filing', m: 'Month 0', docs: ['Consumer / company petition', 'Statutory notice', 'Initial evidence (invoices, tax notices, ledgers)'] },
      { n: 'Response', m: 'Months 1–2', docs: ['Tribunal notice', 'Reply / counter-affidavit', 'Maintainability objections', "Petitioner's rejoinder"] },
      { n: 'Interim relief', m: 'Months 3–4', docs: ['Interim stay / injunction applications', 'Ad-interim orders', 'Compliance affidavits'] },
      { n: 'Evidence and audit', m: 'Months 5–8', docs: ['CA audit / valuation reports', 'Expert testimonies', 'Written submissions', 'Hearing order sheets'] },
      { n: 'Final disposal', m: 'Months 9–12+', docs: ['Final tribunal award / order', 'Execution / compliance petitions', 'Appellate challenge filings'] },
    ],
  },
}

/* Activity already on file before this session. */
export const SEED_HISTORY = [
  { id: 'h1', at: '2026-09-27T14:12:00', who: REVIEWER, action: 'Uploaded', detail: 'Order dated 25.09.2026 (3 pages)', ref: 'D12' },
  { id: 'h2', at: '2026-09-27T14:13:00', who: 'CaseCompass', action: 'Extracted', detail: '5 items from Order dated 25.09.2026, including 3 stated deadlines', ref: 'D12' },
  { id: 'h3', at: '2026-09-27T14:13:30', who: 'CaseCompass', action: 'Flagged', detail: 'IA No. 302/2026 is referred to but not in the bundle', issueId: 'G02' },
  { id: 'h4', at: '2026-09-16T10:40:00', who: REVIEWER, action: 'Uploaded', detail: 'Order sheet dated 14.09.2026 (2 pages)', ref: 'D11' },
  { id: 'h5', at: '2026-09-16T10:41:00', who: 'CaseCompass', action: 'Quarantined', detail: '"within two weeks" has no base date, held for review', issueId: 'Q04' },
  { id: 'h6', at: '2026-04-12T17:05:00', who: 'CaseCompass', action: 'Flagged', detail: 'Two different dates for service of summons (06.03 and 11.03)', issueId: 'C02' },
]
