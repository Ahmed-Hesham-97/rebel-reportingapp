/** Company Google Workspace / Gmail domain for Rebel Marketing Cafe staff. */
export const COMPANY_EMAIL_DOMAIN = "rebelmarketingcafe.com";

export function isCompanyEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(`@${COMPANY_EMAIL_DOMAIN}`);
}
