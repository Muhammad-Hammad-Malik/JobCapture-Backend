// Turns a company name into a stable comparison key so spelling variants collapse together:
//   "Techtimize Pvt. Ltd." / "TECHTIMIZE" / "Tech Timize (Private) Limited"  ->  "techtimize"
// Only legal-form words and punctuation/spacing are ignored. Anything fuzzier is left to an admin
// merge, because wrongly joining two different companies is worse than leaving a duplicate.
const LEGAL_WORDS = new Set([
  'pvt', 'private', 'ltd', 'limited', 'llc', 'llp', 'inc', 'incorporated', 'corp', 'corporation',
  'co', 'company', 'gmbh', 'plc', 'smc', 'sdn', 'bhd', 'pte', 'ag', 'bv',
]);

function companyKey(name) {
  let s = String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ');
  const tokens = s.split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && LEGAL_WORDS.has(tokens[tokens.length - 1])) tokens.pop();
  if (tokens.length > 1 && tokens[0] === 'the') tokens.shift();
  const key = tokens.join('');
  return key.length >= 2 ? key : null;
}

// A "company" that is really the poster's own name (no company found in the post).
function looksLikePosterName(company, posterName) {
  return !!posterName && !!companyKey(company) && companyKey(company) === companyKey(posterName);
}

module.exports = { companyKey, looksLikePosterName };
