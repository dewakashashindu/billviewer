/** Presentation-only cleanup. Original errors and server logging are unchanged. */
export function displayMessage(value: string): string {
  const text = value.trim();
  if (!text) return value;
  const technical = /\b(?:database|schema|server logs?|db_\w*|sql(?:\s+server)?|dbo\.|tbl_[a-z0-9_]+|vw_[a-z0-9_]+|sp_[a-z0-9_]+|information_schema|encryption key|smtp configuration|actual (?:view )?columns|missing required columns|unable to map .{0,50}(?:view|columns)|txnnumbers|recon_txn_type)\b/i;
  if (!technical.test(text)) return value;
  const unchanged = /no (?:changes|data) (?:were |was )?(?:committed|saved)|nothing was saved/i.test(text);
  const suffix = unchanged ? ' No changes were saved.' : '';
  if (/delete blocked|reference table.*missing/i.test(text)) return 'Unable to verify related records, so deletion was blocked. Please contact support.';
  if (/too long|exceeds.{0,30}(?:length|limit)/i.test(text)) return 'One of the entered values is too long. Please shorten it and try again.' + suffix;
  if (/duplicate|duplicated/i.test(text)) return 'Duplicate records were found. Please contact support before continuing.';
  if (/email|smtp/i.test(text)) return 'Unable to send the email. Please try again or contact support.' + suffix;
  if (/not configured|not connected|connection/i.test(text)) return 'The service is temporarily unavailable. Please try again or contact support.' + suffix;
  if (/not found in database|unable to map|missing required columns|actual (?:view )?columns/i.test(text)) return 'Unable to load the requested information. Please contact support.';
  if (/confirm/i.test(text)) return 'Unable to confirm this document. Please try again or contact support.' + suffix;
  if (/save|saved|committed|operation|failed/i.test(text)) return 'Unable to complete the request. Please try again or contact support.' + suffix;
  return 'Unable to complete the request. Please contact support.';
}
