// Shared by the export menu (to preview the exact name before download) and
// the route handler (to set Content-Disposition) so the confirmation dialog
// never promises a filename the download doesn't actually use.
function sanitizedTitle(tripTitle: string) {
  return tripTitle
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pdfFileName(tripTitle: string) {
  return `ROTEIRO-${sanitizedTitle(tripTitle) || "viagem"}.pdf`;
}

// Content-Disposition's legacy `filename` parameter is defined over Latin-1,
// and some older clients ignore `filename*` entirely - so this strips
// diacritics/non-ASCII instead of just letting them through raw.
export function asciiPdfFileName(tripTitle: string) {
  const normalized = sanitizedTitle(tripTitle)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
  return `ROTEIRO-${normalized || "viagem"}.pdf`;
}
