// Closed list of job categories. A job can belong to several (primary first).
// `track` drives the Tech / Non-tech switch. `hint` is what the LLM sees in its prompt.
const CATEGORY_DEFS = [
  // ---- Tech: software engineering
  { name: 'Fullstack', track: 'tech', hint: 'builds both frontend and backend of web apps, in any stack (not only MERN/MEAN)' },
  { name: 'Frontend', track: 'tech', hint: 'web UI engineering: React, Angular, Vue, HTML/CSS/JS' },
  { name: 'Backend', track: 'tech', hint: 'server-side/API engineering in any language: Node, Python, Java, PHP, .NET, Go, Ruby...' },
  { name: 'Mobile Development', track: 'tech', hint: 'iOS, Android, Flutter, React Native apps' },
  { name: 'Software Engineering', track: 'tech', hint: 'generic software engineer/developer role with no clearer specialization' },
  { name: 'Software Architecture', track: 'tech', hint: 'software/system architect, principal/staff-level design ownership' },
  { name: 'Engineering Management', track: 'tech', hint: 'tech lead, engineering manager, head of engineering, CTO' },
  { name: 'Game Development', track: 'tech', hint: 'Unity, Unreal, game programming' },
  { name: 'Blockchain & Web3', track: 'tech', hint: 'smart contracts, Solidity, crypto/web3 engineering' },
  { name: 'Embedded & IoT', track: 'tech', hint: 'embedded systems, firmware, IoT, robotics, hardware-adjacent software' },
  { name: 'ERP & CRM Development', track: 'tech', hint: 'Salesforce, Dynamics 365, ServiceNow, Odoo, SAP, Oracle ERP, Power Platform developers/consultants' },
  { name: 'CMS & E-commerce Development', track: 'tech', hint: 'WordPress, Shopify, Magento, Webflow, WooCommerce development' },
  // ---- Tech: AI & data
  { name: 'AI / ML Engineering', track: 'tech', hint: 'AI/ML engineer, LLM/GenAI/agent developer, computer vision, NLP, MLOps' },
  { name: 'Data Science', track: 'tech', hint: 'data scientist, applied ML research, statistical modelling' },
  { name: 'Data Engineering & BI', track: 'tech', hint: 'data engineer, ETL, pipelines, warehouses, BI developer' },
  { name: 'Data Analysis', track: 'tech', hint: 'data analyst, reporting/dashboards, analytics' },
  { name: 'Database Administration', track: 'tech', hint: 'DBA, database developer/administrator' },
  // ---- Tech: infra, quality, security
  { name: 'DevOps & Cloud', track: 'tech', hint: 'DevOps, SRE, cloud engineer/architect, platform & infrastructure engineering, CI/CD' },
  { name: 'QA & Testing', track: 'tech', hint: 'QA, SQA, manual/automation testing, SDET, test lead' },
  { name: 'Cybersecurity', track: 'tech', hint: 'security engineer, pentester, red team, SOC, DevSecOps' },
  { name: 'IT Support & Systems', track: 'tech', hint: 'IT support, helpdesk, system administrator, IT executive/manager' },
  { name: 'Network Engineering', track: 'tech', hint: 'network engineer, infrastructure/network administrator' },
  { name: 'Technical Support', track: 'tech', hint: 'product/technical support engineer, application support (customer-facing, technical)' },
  { name: 'Solutions & Pre-sales Engineering', track: 'tech', hint: 'solutions engineer/consultant, pre-sales technical roles, technical consultants' },
  // ---- Tech-adjacent product & delivery
  { name: 'UI/UX Design', track: 'tech', hint: 'product/UI/UX designer for software, design systems, Figma' },
  { name: 'Product Management', track: 'tech', hint: 'product manager/owner/strategist for software products' },
  { name: 'Project & Delivery Management', track: 'tech', hint: 'project manager, scrum master, PMO, delivery manager' },
  { name: 'Business Analysis', track: 'tech', hint: 'business analyst/systems analyst for software projects' },
  { name: 'Technical Writing', track: 'tech', hint: 'documentation/technical writer, proposal writer for technical bids' },
  // ---- Non-tech
  { name: 'Sales & Business Development', track: 'non-tech', hint: 'BD, sales, SDR/BDR, account executive, bidding/lead generation' },
  { name: 'Marketing & SEO', track: 'non-tech', hint: 'digital marketing, SEO, paid media, growth, performance marketing' },
  { name: 'Content & Social Media', track: 'non-tech', hint: 'content writer, social media, PR, video editing, copywriting' },
  { name: 'Graphic & Creative Design', track: 'non-tech', hint: 'graphic designer, art director, motion/video designer (not software UI/UX)' },
  { name: 'HR & Recruitment', track: 'non-tech', hint: 'HR, recruiter, talent acquisition, sourcer' },
  { name: 'Customer Success & Support', track: 'non-tech', hint: 'customer success/support/service roles that are not technical' },
  { name: 'Finance & Accounting', track: 'non-tech', hint: 'accountant, finance, payroll, bookkeeping' },
  { name: 'Operations & Administration', track: 'non-tech', hint: 'operations, admin, virtual assistant, office roles' },
  { name: 'Other (Non-tech)', track: 'non-tech', hint: 'any non-technical role that fits nothing above' },
];

const CATEGORIES = CATEGORY_DEFS.map(c => c.name);
const TRACKS = ['tech', 'non-tech'];
const CATEGORY_TRACK = Object.fromEntries(CATEGORY_DEFS.map(c => [c.name, c.track]));

// A job's track follows its PRIMARY (first) category, so a secondary tag can't flip a role's track.
function deriveTrack(categories) {
  if (!categories || categories.length === 0) return null;
  return CATEGORY_TRACK[categories[0]] || null;
}

module.exports = { CATEGORY_DEFS, CATEGORIES, TRACKS, CATEGORY_TRACK, deriveTrack };
