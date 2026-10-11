/* The chronology report is built by the backend (GET /api/cases/:id/report) so the preview,
   the PDF and the Word file always come from one structure. */
export const DEFAULT_REPORT_OPTIONS = {
  citations: true,
  conflicts: true,
  quarantine: true,
  gaps: true,
  missingAppendix: true,
  correctionLog: true,
}
