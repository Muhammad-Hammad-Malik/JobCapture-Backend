// Closed list of skills (technologies / tools). Each has a canonical name, a group for UI grouping,
// and aliases used to normalize whatever the LLM (or an admin) writes.
// Anything not here is kept in `unknownSkills` for review instead of being silently dropped.
const g = (group, entries) =>
  entries.map(e => (typeof e === 'string' ? { name: e, group, aliases: [] } : { name: e[0], group, aliases: e[1] }));

const SKILL_DEFS = [
  ...g('Languages', [
    ['JavaScript', ['js', 'ecmascript', 'es6']],
    ['TypeScript', ['ts']],
    ['Python', ['asyncio', 'openpyxl', 'pypdf2', 'fuzzywuzzy', 'pydantic', 'celery', 'conda', 'conda/anaconda', 'pip']],
    'Java',
    ['C#', ['csharp', 'c sharp']],
    ['C++', ['cpp']],
    'C',
    ['Go', ['golang', 'go lang']],
    'Rust',
    'PHP',
    ['Ruby', []],
    'Kotlin',
    'Swift',
    'Dart',
    'Scala',
    'R',
    ['SQL', ['t-sql', 'pl/sql', 'plsql']],
    ['Bash / Shell', ['bash', 'shell', 'shell scripting', 'powershell']],
    ['Objective-C', ['objc', 'objective c']],
    'Elixir',
    'Solidity',
  ]),
  ...g('Frontend', [
    ['React', ['react.js', 'reactjs', 'react js']],
    ['Next.js', ['nextjs', 'next js']],
    ['Angular', ['angularjs', 'angular js', 'angular 2+']],
    ['Vue.js', ['vue', 'vuejs', 'vue js']],
    ['Nuxt.js', ['nuxt', 'nuxtjs']],
    'Svelte',
    ['Redux', ['zustand', 'ngrx', 'rxjs', 'mobx', 'tanstack query', 'react query']],
    ['Tailwind CSS', ['tailwind', 'tailwindcss']],
    ['Webpack / Vite', ['webpack','vite','rollup']],
    ['HTML / CSS', ['html', 'css', 'html5', 'css3', 'html/css', 'sass', 'scss']],
    'Bootstrap',
    ['jQuery', ['jquery']],
    ['Material UI', ['mui', 'material-ui']],
  ]),
  ...g('Backend & Frameworks', [
    ['Node.js', ['node', 'nodejs', 'node js']],
    ['Express.js', ['express', 'expressjs', 'express js']],
    ['NestJS', ['nest.js', 'nest js', 'nest']],
    ['Django', ['drf', 'django rest framework']],
    'Flask',
    ['FastAPI', ['fast api', 'fast-api']],
    'Laravel',
    'Symfony',
    'CodeIgniter',
    ['Spring Boot', ['spring', 'springboot', 'spring framework']],
    ['.NET', ['dotnet', 'dot net', '.net core', 'dotnet core', 'asp.net', 'asp.net core', 'asp net', '.net framework', 'blazor', 'wpf', 'wpf/xaml', 'wpf / xaml', 'windows forms', 'winforms', 'linq', 'ado.net', 'asp.net mvc', 'mvc', 'signalr', 'dapper', 'xaml']],
    ['Ruby on Rails', ['rails', 'ror', 'ruby on rails (ror)']],
    'GraphQL',
    ['REST APIs', ['rest', 'restful', 'rest api', 'restful apis', 'restful api', 'apis', 'api', 'api development', 'openapi', 'swagger', 'openapi/swagger', 'http', 'json', 'webhooks', 'xml-rpc', 'xml', 'soap']],
    'gRPC',
    ['Microservices', ['microservice', 'micro-services']],
    ['WebSockets', ['socket.io', 'socketio', 'socket io']],
    ['Entity Framework', ['ef core', 'entity framework core']],
    'Hibernate',
    ['Authentication', ['jwt','oauth','oauth2','auth0','sso','saml','okta']],
    ['Message Queues', ['rabbitmq','sqs','activemq','message queue','pub/sub']],
    ['Payment Integrations', ['stripe','paypal','payment gateway','payment gateways','twilio']],
    'Prisma',
    ['ORMs', ['typeorm','sequelize','sqlalchemy','drizzle orm','drizzle']],
  ]),
  ...g('Mobile', [
    ['React Native', ['reactnative', 'react-native', 'expo']],
    ['Flutter', ['bloc', 'getx', 'riverpod', 'bloc / riverpod']],
    'Android',
    'iOS',
    'SwiftUI',
    ['Jetpack Compose', ['compose']],
    'Xamarin',
    'Ionic',
  ]),
  ...g('AI & Data', [
    ['Machine Learning', ['ml', 'ml/ai']],
    ['Deep Learning', ['dl', 'neural networks']],
    ['NLP', ['natural language processing']],
    ['Computer Vision', ['cv', 'yolo', 'ocr', 'ocr/document parsing', 'imagenet', 'coco', 'image processing']],
    ['LLMs', ['llm', 'large language models', 'generative ai', 'gen ai', 'genai', 'gpt', 'openai', 'openai api', 'claude', 'gemini', 'chatgpt', 'anthropic', 'llama', 'openal', 'chatbots', 'chatbot', 'al', 'copilots', 'glm', 'embeddings']],
    ['RAG', ['retrieval augmented generation', 'retrieval-augmented generation', 'vector search', 'vector database', 'vector databases', 'pinecone', 'chromadb', 'faiss', 'qdrant', 'knowledge graphs', 'graphrag']],
    ['AI Agents', ['agentic', 'agentic ai', 'ai agent', 'agents', 'agentic systems', 'multi-agent', 'multi-agent systems', 'a2a communication', 'agent runtimes', 'agent frameworks', 'tool calling', 'mcp integrations', 'crewai', 'autogen', 'langgraph', 'semantic kernel']],
    ['Prompt Engineering', ['prompting', 'prompt design']],
    'LangChain',
    ['LlamaIndex', []],
    ['TensorFlow', ['keras']],
    'PyTorch',
    ['Scikit-learn', ['sklearn', 'scikit learn']],
    'Pandas',
    'NumPy',
    'OpenCV',
    ['Hugging Face', ['huggingface', 'transformers']],
    ['Apache Spark', ['spark', 'pyspark']],
    ['Apache Airflow', ['airflow']],
    ['Kafka', ['apache kafka']],
    'dbt',
    'Snowflake',
    'Databricks',
    ['Power BI', ['powerbi', 'power-bi']],
    'Tableau',
    ['ETL', ['elt', 'data pipelines', 'data pipeline']],
    ['Data Warehousing', ['data warehouse', 'bigquery', 'redshift']],
    'Hadoop',
    ['Excel', ['microsoft excel', 'ms excel', 'advanced excel', 'google sheets', 'google sheet']],
  ]),
  ...g('Databases', [
    ['PostgreSQL', ['postgres', 'postgresql', 'psql']],
    'MySQL',
    ['MongoDB', ['mongo', 'mongo db', 'mongoose']],
    'Redis',
    ['SQL Server', ['mssql', 'ms sql', 'microsoft sql server', 'sql server']],
    ['Oracle Database', ['oracle db', 'oracle database']],
    ['Elasticsearch', ['elastic search', 'elk', 'opensearch']],
    'DynamoDB',
    'Firebase',
    'SQLite',
    'Cassandra',
    ['Neo4j', ['graphdb', 'graph databases', 'vector/graph databases']],
    'Supabase',
    'MariaDB',
  ]),
  ...g('Cloud & DevOps', [
    ['AWS', ['amazon web services', 'aws lambda', 'ec2', 's3']],
    ['Azure', ['microsoft azure', 'azure devops', 'azure administration', 'azure services', 'azure functions']],
    ['GCP', ['google cloud', 'google cloud platform']],
    'Docker',
    ['Kubernetes', ['k8s']],
    ['Terraform', ['infrastructure as code', 'iac', 'pulumi']],
    'Ansible',
    'Jenkins',
    ['CI/CD', ['cicd', 'ci cd', 'continuous integration', 'github actions', 'gitlab ci', 'argocd', 'fluxcd', 'argocd/fluxcd', 'gitops']],
    'Linux',
    'Nginx',
    ['Prometheus & Grafana', ['prometheus', 'grafana']],
    'Helm',
    ['Monitoring & Observability', ['datadog','new relic','sentry','loki','elk/loki','opentelemetry']],
    ['Windows Server', ['iis','active directory','windows administration']],
    ['Cloud Platforms (Other)', ['heroku','digitalocean','vercel','netlify','cloudflare','cloudflare cdn']],
    ['Networking', ['cisco', 'ccna', 'tcp/ip', 'routing and switching', 'firewalls', 'dns', 'dhcp', 'vlan', 'vlans', 'lan/wan', 'tcp / ip', 'lan', 'wan', 'mikrotik', 'ubiquiti', 'tp-link omada', 'omada']],
    ['Serverless', ['lambda functions']],
  ]),
  ...g('Testing & Security', [
    'Selenium',
    'Cypress',
    'Playwright',
    'Appium',
    'Postman',
    'JMeter',
    ['Jest', ['vitest', 'mocha', 'jasmine']],
    'Cucumber',
    ['Snyk', ['dependency scanning','sast','dast']],
    'Pytest',
    'TestRail',
    ['Manual Testing', ['manual qa', 'manual test', 'test cases', 'bug reporting', 'sdlc/stlc', 'responsiveness testing', 'ui testing', 'ui/ux testing', 'crm testing', 'game qa', 'multiplayer testing', 'test case design', 'exploratory testing', 'uat']],
    ['Test Automation', ['automation testing', 'automated testing', 'qa automation', 'sdet', 'testng', 'restassured', 'robot framework', 'qa automation framework', 'maestro']],
    ['API Testing', ['api test', 'rest assured']],
    ['Performance Testing', ['load testing', 'stress testing', 'k6', 'lighthouse', 'pagespeed insights', 'web vitals', 'gatling', 'locust']],
    ['Penetration Testing', ['pentesting', 'pen testing', 'pentest', 'red teaming', 'vapt']],
    ['Security Operations', ['siem', 'soc', 'splunk', 'incident response', 'cloud security', 'threat detection', 'ai security', 'edr', 'xdr']],
    ['OWASP', ['owasp top 10', 'application security', 'appsec']],
  ]),
  ...g('Platforms & CMS', [
    ['Salesforce', ['marketing cloud', 'salesforce marketing cloud', 'sales cloud', 'service cloud', 'apex', 'lwc']],
    ['Microsoft Dynamics 365', ['dynamics 365', 'd365', 'dynamics crm', 'dynamics']],
    'ServiceNow',
    'Odoo',
    ['SAP', ['sap erp', 'sap abap', 'sap hana']],
    ['Oracle ERP', ['oracle ebs', 'oracle fusion', 'oracle finance', 'oracle scm', 'oracle e-business suite']],
    ['Power Platform', ['power apps', 'powerapps', 'power automate']],
    'WordPress',
    'Shopify',
    'Magento',
    'WooCommerce',
    'Webflow',
    'Wix',
    'NetSuite',
    'Acumatica',
    ['Google Workspace', ['google apps script','apps script','g suite','google docs']],
    ['Microsoft Office', ['ms office','office 365','word','powerpoint','microsoft 365']],
    ['Workflow Automation', ['n8n', 'zapier', 'make.com', 'integromat']],
  ]),
  ...g('Design & Product', [
    ['Figma', ['sketch']],
    ['Adobe Creative Suite', ['photoshop', 'illustrator', 'adobe xd', 'indesign', 'adobe creative cloud']],
    ['Video Editing', ['premiere pro', 'after effects', 'davinci resolve', 'final cut']],
    ['Wireframing & Prototyping', ['wireframing', 'prototyping']],
    'Jira',
    ['Project Management Tools', ['trello','clickup','asana','confluence','notion','monday.com','linear']],
    ['Agile / Scrum', ['agile', 'scrum', 'kanban', 'sprint planning', 'sdlc', 'stlc']],
  ]),
  ...g('Other Tech', [
    'Git',
    ['Blockchain', ['web3', 'smart contracts', 'ethereum']],
    'Unity',
    ['Unreal Engine', ['unreal']],
    ['Embedded Systems', ['embedded c', 'firmware', 'arduino', 'raspberry pi', 'microcontrollers', 'rtos']],
    ['IoT', ['internet of things', 'mqtt']],
    ['Robotics', ['ros', 'ros2']],
    ['AI Coding Tools', ['cursor','claude code','github copilot','copilot','windsurf','codex','agentic coding','ai-assisted development','ai-assisted development workflows','vibe coding']],
    ['MCP', ['model context protocol']],
    ['Web Scraping', ['scraping', 'scrapy', 'beautifulsoup']],
  ]),
  ...g('Business', [
    'SEO',
    ['Google Ads', ['ppc', 'paid media', 'google adwords', 'meta ads', 'facebook ads']],
    ['Content Writing', ['copywriting', 'blog writing']],
    ['Lead Generation', ['cold outreach', 'cold calling', 'outbound sales', 'prospecting', 'upwork', 'upwork bidding', 'fiverr', 'linkedin outreach', 'upwork business development', 'bidding']],
    ['CRM Tools', ['hubspot', 'zoho crm', 'pipedrive', 'gohighlevel', 'go high level', 'zoho', 'zoho crm']],
    ['Social Media Marketing', ['social media management']],
    ['Recruitment & Sourcing', ['talent sourcing', 'technical recruiting', 'headhunting']],
    ['Accounting Software', ['quickbooks', 'xero', 'tally']],
  ]),
];

const SKILLS = SKILL_DEFS.map(s => s.name);
const SKILL_GROUPS = [...new Set(SKILL_DEFS.map(s => s.group))];

const normKey = str => String(str).toLowerCase().replace(/\s+/g, ' ').trim();
const ALIAS_MAP = new Map();
for (const def of SKILL_DEFS) {
  ALIAS_MAP.set(normKey(def.name), def.name);
  for (const alias of def.aliases) ALIAS_MAP.set(normKey(alias), def.name);
}

// Returns the canonical skill name for any spelling we know, else null.
function canonicalSkill(input) {
  if (typeof input !== 'string') return null;
  return ALIAS_MAP.get(normKey(input)) || null;
}

// Maps a list of raw skill strings -> { skills: canonical unique list, unknown: leftovers }.
const GROUP_NAMES = new Set(SKILL_GROUPS.map(normKey));

// Concepts, domains and soft-skills that are not tools/technologies — dropped silently.
const IGNORED_TERMS = new Set(
  [
    'oop', 'object-oriented programming', 'object oriented programming', 'data structures', 'algorithms',
    'dependency injection', 'clean architecture', 'design patterns', 'saas', 'b2b', 'b2c', 'fintech', 'ai',
    'devops', 'medical billing', 'db', 'troubleshooting', 'documentation', 'team coordination',
    'knowledge management', 'ticketing systems', 'saas/enterprise support', 'communication', 'leadership',
    'prd/brd documentation', 'prds', 'brds', 'frs', 'srs', 'problem solving', 'erp', 'hardware/software integration',
    'communication protocols', 'device drivers', 'directx', 'directx/graphics', 'sandbox isolation', 'microvms',
    'firecracker', 'a/b testing', 'modern frontend frameworks', 'no-code/low-code', 'ai automation',
    'ai-driven testing', 'agentic', 'geo', 'aso', 'llmo', 'provider', 'message', 'cloud & devops',
  ].map(normKey),
);

function normalizeSkills(list) {
  const skills = [];
  const unknown = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const canonical = canonicalSkill(raw);
    if (canonical) {
      if (!skills.includes(canonical)) skills.push(canonical);
    } else if (
      typeof raw === 'string' &&
      raw.trim() &&
      !GROUP_NAMES.has(normKey(raw)) &&
      !IGNORED_TERMS.has(normKey(raw)) &&
      !unknown.includes(raw.trim())
    ) {
      unknown.push(raw.trim());
    }
  }
  return { skills, unknown };
}

// Default role category implied by a skill; used when the model returned a technology as a category.
const SKILL_DEFAULT_CATEGORY = {
  '.NET': 'Backend', Java: 'Backend', PHP: 'Backend', Laravel: 'Backend', Django: 'Backend', FastAPI: 'Backend',
  Flask: 'Backend', 'Node.js': 'Backend', NestJS: 'Backend', 'Ruby on Rails': 'Backend', 'Spring Boot': 'Backend',
  Go: 'Backend', Python: 'Backend', React: 'Frontend', Angular: 'Frontend', 'Vue.js': 'Frontend', 'Next.js': 'Frontend',
  Flutter: 'Mobile Development', 'React Native': 'Mobile Development', Android: 'Mobile Development', iOS: 'Mobile Development',
  Salesforce: 'ERP & CRM Development', ServiceNow: 'ERP & CRM Development', Odoo: 'ERP & CRM Development',
  'Microsoft Dynamics 365': 'ERP & CRM Development', WordPress: 'CMS & E-commerce Development', Shopify: 'CMS & E-commerce Development',
  'Workflow Automation': 'Software Engineering', AWS: 'DevOps & Cloud', Docker: 'DevOps & Cloud', Kubernetes: 'DevOps & Cloud',
  'Machine Learning': 'AI / ML Engineering', LLMs: 'AI / ML Engineering', Selenium: 'QA & Testing', 'Test Automation': 'QA & Testing',
};

module.exports = { SKILL_DEFS, SKILL_DEFAULT_CATEGORY, SKILLS, SKILL_GROUPS, canonicalSkill, normalizeSkills };
