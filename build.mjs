#!/usr/bin/env node
/**
 * Build the static documentation index for the Odoo Internals Field Manual.
 *
 * Scans all Markdown files under docs/, extracts titles/descriptions, and emits:
 *   - assets/js/docs-data.js  (content embedded for offline file:// use)
 *   - docs/manifest.json      (metadata for tooling)
 *
 * Usage: node build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const DOCS = path.join(ROOT, 'docs');

const SECTION_META = {
  '00-overview': { title: 'Orientation', short: 'Orientation', icon: '00' },
  '01-business-logic': { title: 'Business Logic Layer', short: 'Business Logic', icon: '01' },
  '02-flows': { title: 'End-to-End Flows', short: 'Flows', icon: '02' },
  '03-database': { title: 'Database Design', short: 'Database', icon: '03' },
  '04-modules': { title: 'Module Relationships', short: 'Modules', icon: '04' },
  '05-scope': { title: 'ERP Scope Boundaries', short: 'Scope', icon: '05' },
  '06-engineering': { title: 'Software Engineering', short: 'Engineering', icon: '06' },
  '07-project-management': { title: 'Project Management', short: 'Project Mgmt', icon: '07' },
  '08-appendix': { title: 'Appendix', short: 'Appendix', icon: '08' },
};

const PAGE_TITLES = {
  '00-overview/01-architecture': 'Architecture and Runtime Model',
  '00-overview/02-glossary': 'Glossary of Odoo Internals',
  '01-business-logic/01-orm-runtime': 'ORM Runtime and Model Semantics',
  '01-business-logic/02-transactions': 'Transactions, Concurrency, and Data Integrity',
  '01-business-logic/03-service-layer': 'Service Structure, Injection, and Orchestration',
  '01-business-logic/04-business-rules-events': 'Business Rules, Events, and Automation Triggers',
  '01-business-logic/05-security': 'Security Model',
  '02-flows/01-sales': 'Sales and CRM (Quote to Cash)',
  '02-flows/02-purchase': 'Purchase (Requisition to Payables)',
  '02-flows/03-inventory': 'Inventory and Stock Valuation',
  '02-flows/04-accounting': 'Accounting (Invoice to Financial Statements)',
  '02-flows/05-manufacturing': 'Manufacturing (Plan to Produce)',
  '02-flows/06-cross-module': 'Cross-Module Document Flow',
  '03-database/01-conventions': 'Schema Conventions and Storage',
  '03-database/02-inheritance': 'Inheritance Strategies and Schema Effects',
  '03-database/03-er-model': 'Core Entity-Relationship Model',
  '03-database/04-indexes-performance': 'Indexing, Query Performance, and Scaling',
  '03-database/05-migrations': 'Migrations, Upgrades, and Data Evolution',
  '04-modules/01-dependency-system': 'Manifest, Loading, and Dependency Semantics',
  '04-modules/02-module-map': 'Platform Map and Dependency Clusters',
  '04-modules/03-extension-points': 'Extension Points Ranked by Safety',
  '04-modules/04-circular-dependencies': 'Circular Dependencies and Coupling',
  '04-modules/05-upgrade-compat': 'Version Compatibility and 18→19 Changes',
  '05-scope/01-coverage': 'Functional Coverage Matrix',
  '05-scope/02-gaps': 'Functional Gaps and Engineering Consequences',
  '05-scope/03-performance': 'Performance Bottlenecks and Scaling Limits',
  '05-scope/04-doc-gaps': 'Where Documentation Misleads or Stops',
  '06-engineering/01-use-cases': 'Use Case Model',
  '06-engineering/02-domain-model': 'Domain Model and Aggregates',
  '06-engineering/03-sequence-diagrams': 'Sequence Diagrams',
  '06-engineering/04-activity-diagrams': 'Activity Diagrams and BPMN Mapping',
  '06-engineering/05-state-machines': 'State Machines Reference',
  '06-engineering/06-nfr': 'Non-Functional Requirements',
  '06-engineering/07-testing-strategy': 'Test Strategy',
  '07-project-management/01-delivery-lifecycle': 'Delivery Lifecycle',
  '07-project-management/02-estimation': 'Estimation and Budgeting',
  '07-project-management/03-team-and-roles': 'Team Structure and Roles',
  '07-project-management/04-quality-gates': 'Quality Gates and Definition of Done',
  '07-project-management/05-environments-ci': 'Environments, CI/CD, and Operations',
  '07-project-management/06-risk-register': 'Risk Register',
  '07-project-management/07-implementation-playbook': 'Implementation Playbook',
  '07-project-management/08-templates': 'Document Templates',
  '08-appendix/01-code-map': 'Source Code Map',
  '08-appendix/02-sql-cookbook': 'SQL Cookbook',
  '08-appendix/03-debug-playbook': 'Debugging and Incident Playbook',
  '08-appendix/04-checklists': 'Checklists',
  '08-appendix/05-sources': 'Sources and Version Matrix',
};

const PAGE_DESCRIPTIONS = {
  intro: 'A developer-focused technical reference for the mechanics the official documentation does not explain.',
  '00-overview/01-architecture': 'Process model, request lifecycle, registry, environment, cursor, module loading, async machinery and architectural invariants.',
  '00-overview/02-glossary': "Precise runtime meanings for Odoo's overloaded terms, from ACLs and actions to quants and wizards.",
  '01-business-logic/01-orm-runtime': 'Recordset semantics, field machinery, cache, recomputation, CRUD internals, inheritance, access control and performance rules.',
  '01-business-logic/02-transactions': 'Transaction boundaries, isolation, savepoints, retries, locks, cron transactions and exactly-once pitfalls.',
  '01-business-logic/03-service-layer': 'How Odoo expresses services, dependency injection, orchestration, wizards, controllers and reliable integration.',
  '01-business-logic/04-business-rules-events': 'Decision matrix for computes, constraints, onchange, tracking, automation, server actions, cron and bus.',
  '01-business-logic/05-security': 'ACLs, record rules, field groups, sudo, multi-company, portal and a security review checklist.',
  '02-flows/01-sales': 'Quote-to-cash: sales and CRM states, procurement, delivery, invoicing, pricing, down payments and accounting.',
  '02-flows/02-purchase': 'Requisition-to-payables: RFQ approval, receipts, vendor bills, three-way match, landed costs and returns.',
  '02-flows/03-inventory': 'Inventory model, routes, reservation, quants, validation, v19 valuation, returns, scrap and locking.',
  '02-flows/04-accounting': 'Journal entry lifecycle, taxes, reconciliation, payments, assets, lock dates, hash chain and stock valuation accounting.',
  '02-flows/05-manufacturing': 'Plan-to-produce: BoMs, MO states, work orders, consumption, costing, subcontracting and quality.',
  '02-flows/06-cross-module': 'How demand becomes procurement, manufacturing, logistics and accounting documents across modules.',
  '03-database/01-conventions': 'Table and column conventions, magic fields, relation tables, indexes, constraints, JSONB and filestore.',
  '03-database/02-inheritance': 'Extension, prototype, delegation and mixin inheritance, MRO and their schema consequences.',
  '03-database/03-er-model': 'Core ER model for parties, products, sales, stock, accounting and manufacturing, including hidden columns.',
  '03-database/04-indexes-performance': 'Query cost model, indexing, N+1, prefetch, locks, autovacuum, worker sizing and profiling.',
  '03-database/05-migrations': 'Schema evolution, module migration scripts, noupdate, backfills, OpenUpgrade and rollback.',
  '04-modules/01-dependency-system': 'Manifest semantics, loading phases, auto-install, external dependencies and module statistics.',
  '04-modules/02-module-map': 'A layered map of 1,469 modules, bridge modules, enterprise clusters and impact analysis.',
  '04-modules/03-extension-points': 'Extension points ranked by safety, with override pitfalls and a decision matrix.',
  '04-modules/04-circular-dependencies': 'Manifest cycles, Python import cycles, data cycles, auto-install coupling and composition rules.',
  '04-modules/05-upgrade-compat': 'The 18→19 breaking changes: procurement, valuation, product type, UoM, states, tax engine and APIs.',
  '05-scope/01-coverage': 'Out-of-box vs configure vs custom coverage across commercial, logistics, manufacturing, finance, HR and platform.',
  '05-scope/02-gaps': 'Where standard Odoo stops and what it costs to cross the boundary, from APS to IFRS 15.',
  '05-scope/03-performance': 'The ten bottlenecks that matter, sizing rules, load testing and acceptance criteria.',
  '05-scope/04-doc-gaps': 'Version drift, stale comments, removed models and the documentation traps that break custom code.',
  '06-engineering/01-use-cases': 'Actors, system context and a catalogue of 28 use cases with flows and traceability.',
  '06-engineering/02-domain-model': 'Ubiquitous language, class diagram, aggregates, invariants and domain-event mapping.',
  '06-engineering/03-sequence-diagrams': 'Method-level sequences for request handling, sales, purchase, delivery, invoicing, payments, MOs, cron and integrations.',
  '06-engineering/04-activity-diagrams': 'Decision flows for sales, purchase, delivery, posting, manufacturing, close, integration and triage, with BPMN mapping.',
  '06-engineering/05-state-machines': 'Legal states, transitions, triggers and guards for sales, CRM, purchase, stock, accounting, assets, MRP, modules and cron.',
  '06-engineering/06-nfr': 'Measurable availability, performance, security, audit, localization, backup and observability requirements.',
  '06-engineering/07-testing-strategy': 'Test pyramid, Odoo test classes, security/performance tests, CI and UAT for customisations.',
  '07-project-management/01-delivery-lifecycle': 'Phases, gates, artifacts and RACI from discovery to hypercare.',
  '07-project-management/02-estimation': 'Person-day heuristics, complexity multipliers, data/integration drivers and a sample budget.',
  '07-project-management/03-team-and-roles': 'Roles, decision rights, team sizing and collaboration rituals.',
  '07-project-management/04-quality-gates': 'Design, code, test, UAT, go-live and closure gates with checklists and metrics.',
  '07-project-management/05-environments-ci': 'Environment topology, database copies, neutralization, CI/CD, backup, monitoring and runbooks.',
  '07-project-management/06-risk-register': 'Odoo-specific risks, scoring, mitigation and contingency planning.',
  '07-project-management/07-implementation-playbook': 'A phase-by-phase implementation guide from kickoff to handover, including a 90-day plan.',
  '07-project-management/08-templates': 'ADR, specification, test plan, cutover, RAID, change request, data mapping, runbook and handover templates.',
  '08-appendix/01-code-map': 'A file-by-file map of the ORM, runtime, modules, tools and key business modules.',
  '08-appendix/02-sql-cookbook': 'Read-only diagnostic queries for schema, modules, sales, purchase, stock, accounting, performance and security.',
  '08-appendix/03-debug-playbook': 'First response, common errors, ORM/stock/accounting/MRP debugging, performance profiling and postmortems.',
  '08-appendix/04-checklists': 'Architecture, code, security, performance, migration, upgrade, go-live and support checklists.',
  '08-appendix/05-sources': 'Version matrix, evidence index, official docs coverage, limitations and verification commands.',
};

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function stripFirstHeading(md) {
  return md.replace(/^#\s+.*\n+/, '');
}

function firstParagraph(md) {
  const body = stripFirstHeading(md)
    .replace(/^>.*$/gm, '')
    .trim();
  const blocks = body.split(/\n\s*\n/);
  for (const block of blocks) {
    const t = block.trim();
    if (!t || t.startsWith('#') || t.startsWith('|') || t.startsWith('```') || t.startsWith('-') || t.startsWith('*')) continue;
    return t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '').slice(0, 220);
  }
  return '';
}

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function extractHeadings(md) {
  const headings = [];
  const seen = new Map();
  const re = /^(#{2,3})\s+(.+)$/gm;
  let m;
  while ((m = re.exec(md))) {
    const text = m[2].replace(/<[^>]+>/g, '').replace(/[*_`]/g, '').trim();
    let id = slugifyHeading(text) || 'section';
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    if (n > 1) id = `${id}-${n}`;
    headings.push({ level: m[1].length, text, id });
  }
  return headings;
}

const files = walk(DOCS).sort((a, b) => a.localeCompare(b));
const pages = [];
const sections = new Map();

// Home page
const readmePath = path.join(ROOT, 'README.md');
if (fs.existsSync(readmePath)) {
  const md = fs.readFileSync(readmePath, 'utf8');
  pages.push({
    slug: 'intro',
    section: 'start',
    title: 'Odoo Internals Field Manual',
    description: 'A developer-focused technical reference for the mechanics the official documentation does not explain.',
    file: 'README.md',
    markdown: md,
    headings: extractHeadings(md),
    words: md.split(/\s+/).length,
  });
  sections.set('start', { id: 'start', title: 'Start Here', short: 'Start', icon: '★', pages: ['intro'] });
}

for (const file of files) {
  const rel = path.relative(DOCS, file).split(path.sep).join('/');
  const section = rel.split('/')[0];
  const base = rel.replace(/\.md$/, '');
  const slug = base;
  const md = fs.readFileSync(file, 'utf8');
  const h1 = md.match(/^#\s+(.+)$/m);
  const title = PAGE_TITLES[slug] || (h1 ? h1[1].replace(/[*_`]/g, '').trim() : slug);
  const description = PAGE_DESCRIPTIONS[slug] || firstParagraph(md);
  pages.push({
    slug,
    section,
    title,
    description,
    file: rel,
    markdown: md,
    headings: extractHeadings(md),
    words: md.split(/\s+/).length,
  });
  if (!sections.has(section)) {
    const meta = SECTION_META[section] || { title: section, short: section, icon: section.slice(0, 2) };
    sections.set(section, { id: section, title: meta.title, short: meta.short, icon: meta.icon, pages: [] });
  }
  sections.get(section).pages.push(slug);
}

// Preserve section order, page order by filename (already sorted).
const sectionOrder = ['start', ...Object.keys(SECTION_META), ...sections.keys()];
const orderedSections = [];
const seenSections = new Set();
for (const id of sectionOrder) {
  if (seenSections.has(id) || !sections.has(id)) continue;
  seenSections.add(id);
  const s = sections.get(id);
  s.pages = [...new Set(s.pages)];
  orderedSections.push(s);
}

const flat = [];
for (const section of orderedSections) {
  for (const slug of section.pages) {
    const page = pages.find(p => p.slug === slug);
    if (!page) continue;
    flat.push({
      slug: page.slug,
      section: page.section,
      sectionTitle: section.title,
      title: page.title,
      description: page.description,
      headings: page.headings,
      words: page.words,
      minutes: Math.max(1, Math.round(page.words / 220)),
    });
  }
}

const data = {
  generated: new Date().toISOString(),
  version: '19.0+e.20260826',
  title: 'Odoo Internals Field Manual',
  subtitle: 'Business logic, flows, schema, modules, scope, engineering and delivery',
  sections: orderedSections,
  pages: flat,
  content: Object.fromEntries(pages.map(p => [p.slug, p.markdown])),
};

fs.mkdirSync(path.join(ROOT, 'assets', 'js'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'assets', 'js', 'docs-data.js'),
  `/* Generated by build.mjs — do not edit by hand. */\nwindow.ODOO_DOCS = ${JSON.stringify(data)};\n`,
  'utf8'
);

fs.writeFileSync(
  path.join(DOCS, 'manifest.json'),
  JSON.stringify({ generated: data.generated, version: data.version, sections: orderedSections, pages: flat }, null, 2),
  'utf8'
);

const totalWords = pages.reduce((n, p) => n + p.words, 0);
console.log(`Indexed ${pages.length} pages in ${orderedSections.length} sections (${totalWords.toLocaleString()} words).`);
console.log(`Output: assets/js/docs-data.js (${(fs.statSync(path.join(ROOT, 'assets', 'js', 'docs-data.js')).size / 1024).toFixed(1)} KB)`);
