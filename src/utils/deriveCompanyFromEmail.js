// Free/personal email providers we should never mistake for a company name.
const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'aol.com',
  'protonmail.com',
  'msn.com',
  'zoho.com',
  'gmx.com',
]);

function deriveCompanyFromEmail(email) {
  const domain = email?.split('@')[1]?.toLowerCase();
  if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) return null;
  const namePart = domain.split('.')[0];
  if (!namePart) return null;
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

module.exports = { deriveCompanyFromEmail, GENERIC_EMAIL_DOMAINS };
