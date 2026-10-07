// Cheap deterministic cross-check used by the re-classification script: if the TITLE strongly
// implies a category and the LLM didn't return it, the job is flagged for human review.
const TITLE_RULES = [
  [/\b(qa|sqa|sdet|quality assurance|test(er|ing)?|test automation)\b/i, 'QA & Testing'],
  [/devops|devsecops|\bsre\b|cloud (engineer|architect)|infrastructure engineer/i, 'DevOps & Cloud'],
  [/data engineer|\betl\b|\bbi (developer|engineer)\b/i, 'Data Engineering & BI'],
  [/data scien/i, 'Data Science'],
  [/data analyst/i, 'Data Analysis'],
  [/\b(ios|android|flutter|react native)\b|mobile app (developer|engineer)/i, 'Mobile Development'],
  [/full[\s-]?stack/i, 'Fullstack'],
  [/front[\s-]?end/i, 'Frontend'],
  [/back[\s-]?end/i, 'Backend'],
  [/\b(ai|al|ml|llm)\b.*\b(engineer|developer|scientist)\b|\b(engineer|developer)\b.*\b(ai|al|ml)\b|machine learning|computer vision/i, 'AI / ML Engineering'],
  [/(?<!physical )security (engineer|analyst|researcher)|red team|pentest|cyber/i, 'Cybersecurity'],
  [/ui\/?ux/i, 'UI/UX Design'],
  [/\b(business development|bdr?e?|sdr|account executive)\b|(?<!pre-?)\bsales\b/i, 'Sales & Business Development'],
  [/recruit|\bhr\b|human resources|talent/i, 'HR & Recruitment'],
  [/project manager|scrum master|\bpmo\b/i, 'Project & Delivery Management'],
  [/product manager/i, 'Product Management'],
  [/business analyst/i, 'Business Analysis'],
  [/accountant|accounting/i, 'Finance & Accounting'],
  [/\bseo\b|\bmarketing\b(?! cloud)|paid media/i, 'Marketing & SEO'],
  [/content writer|social media|video editor|copywrit/i, 'Content & Social Media'],
  [/salesforce|dynamics|servicenow|odoo|oracle .*consultant|erp/i, 'ERP & CRM Development'],
  [/wordpress|shopify|magento/i, 'CMS & E-commerce Development'],
];

function titleHints(title) {
  return TITLE_RULES.filter(([re]) => re.test(title || '')).map(([, cat]) => cat);
}

module.exports = { titleHints };
