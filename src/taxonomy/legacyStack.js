// The old single-value `stack` field is kept (derived) so existing clients such as the mobile
// admin app keep working while they migrate to `categories` + `skills`.
const LEGACY_STACKS = [
  'Fullstack',
  'MERN',
  'MEAN',
  'Angular + .NET',
  '.NET',
  'Backend',
  'Frontend',
  'AI Engineer',
  'Software Engineer',
];

function deriveLegacyStack(categories = [], skills = []) {
  const has = s => skills.includes(s);
  const primary = categories[0];
  if (has('React') && has('Node.js') && has('MongoDB')) return 'MERN';
  if (has('Angular') && has('Node.js') && has('MongoDB')) return 'MEAN';
  if (has('Angular') && has('.NET')) return 'Angular + .NET';
  if (has('.NET') && ['Backend', 'Fullstack', 'Software Engineering'].includes(primary)) return '.NET';
  if (primary === 'Fullstack') return 'Fullstack';
  if (primary === 'Frontend') return 'Frontend';
  if (primary === 'Backend') return 'Backend';
  if (primary === 'AI / ML Engineering') return 'AI Engineer';
  return 'Software Engineer';
}

module.exports = { LEGACY_STACKS, deriveLegacyStack };
