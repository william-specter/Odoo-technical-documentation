# Software Engineering VI — Non-Functional Requirements

> **Purpose.** NFRs that must be specified before build, not discovered in production. Each requirement is measurable and tied to an Odoo mechanism or operational control.

---

## 1. Availability

| Requirement | Target | Mechanism |
|---|---|---|
| Business-hours availability | 99.5% | redundant workers, monitored DB |
| Month-end availability | 99.9% | maintenance window, read replica for reports |
| Planned downtime | < 4 h/month | rolling restarts, staging-tested upgrades |
| Recovery time objective (RTO) | < 4 h | restore from backup/replica |
| Recovery point objective (RPO) | < 15 min | WAL archiving / streaming replica |

**Odoo reality:** there is no built-in HA. You need:

- a load balancer with health checks,
- multiple Odoo workers behind it,
- PostgreSQL streaming replication or managed HA,
- shared filestore (NFS/S3) or per-worker sync,
- session affinity or a shared session store,
- a cron singleton (only one worker runs cron, or distributed locking).

**[WARNING]** Two Odoo clusters writing to the same database without coordination will double-run cron jobs and corrupt sequences. Use one cron instance or advisory locks.

---

## 2. Performance

| Scenario | p95 target | Measurement |
|---|---|---|
| Interactive page | < 2 s | browser/APM |
| JSON-RPC read | < 500 ms | load test |
| SO confirm (50 lines) | < 2 s | profiler |
| Picking validate (100 lines) | < 3 s | profiler |
| Invoice post | < 1 s | profiler |
| Report (1 year, 1M lines) | < 30 s | SQL timing |
| Batch import (10k rows) | < 10 min | cron log |

Define the dataset: number of products, partners, open orders, stock moves per month, invoice lines per year. Performance on an empty database is meaningless.

---

## 3. Scalability

| Dimension | Design target | Limit |
|---|---|---|
| Concurrent users | 200 | workers × threads |
| Orders/day | 10,000 | DB write throughput |
| SKUs | 100,000 | product/variant queries |
| Stock moves/month | 1,000,000 | table size/index |
| Invoice lines/year | 5,000,000 | reporting |
| Attachments | 1 TB | filestore/backup |
| Companies | 50 | record rules/multi-company |

Scaling levers, in order:

1. query/index optimisation,
2. worker/connection tuning,
3. read replica for reporting,
4. archiving/partitioning,
5. horizontal scaling (stateless workers + shared DB),
6. external services for heavy work (BI, search, integrations).

---

## 4. Security

| Requirement | Control |
|---|---|
| Authentication | session + password policy + 2FA for admins |
| Authorization | ACLs + record rules + field groups |
| Least privilege | dedicated API users, minimal groups |
| Encryption in transit | TLS everywhere, HSTS |
| Encryption at rest | disk/DB encryption (Odoo does not encrypt fields by default) |
| Secrets | environment variables/secret manager, not ICP |
| Audit | `mail.tracking`, `ir.logging`, DB audit |
| Vulnerability management | pinned versions, CVE monitoring, dependency scan |
| Penetration test | before go-live and annually |
| Data residency | database/filestore location |

**[WARNING]** Odoo does not encrypt individual fields. Sensitive data (salary, health, credentials) requires column encryption, a secrets manager, or a separate store.

---

## 5. Auditability

| Event | Evidence | Retention |
|---|---|---|
| Field changes | `mail.tracking.value` | policy-dependent |
| Document posting | `account.move` + hash | legal (7–10 years) |
| Access | web server logs, `ir.logging` | 1 year |
| Configuration changes | `ir.model.data`, DB audit | 1–7 years |
| Integrations | outbox/event log | 1–3 years |
| Deletions | `unlink` logs (logger) | 1 year |

Requirements:

- audit records must be immutable (no UI edit),
- timestamps in UTC,
- user id and IP where relevant,
- correlation id for integrations.

---

## 6. Data quality

| Requirement | Control |
|---|---|
| Mandatory fields | `required=True` + SQL NOT NULL |
| Uniqueness | SQL unique constraints |
| Referential integrity | FKs + `ondelete` |
| Duplicates | partner/product dedupe rules, `base_vat` |
| Completeness | import validation, dashboards |
| Timeliness | SLA on integrations |
| Consistency | reconciliation reports |

Data quality is a process, not a constraint. Assign ownership per domain (customer, vendor, product, chart of accounts).

---

## 7. Localization and compliance

| Requirement | Control |
|---|---|
| Chart of accounts | one `l10n_<country>` per company |
| Tax rules | localization + fiscal positions |
| E-invoicing | `account_edi*` + country connector |
| Legal reports | `account_reports` localization |
| Payroll | country localization + legal review |
| Retention | legal archive policy |
| GDPR | data minimization, erasure process, DPA |
| SOX/ITGC | change management, access reviews, segregation of duties |

**[WARNING]** Odoo's localization coverage varies. Verify the specific country/version with an accountant, not just the module name.

---

## 8. Maintainability

| Requirement | Control |
|---|---|
| No core modifications | custom modules only |
| Version control | Git, one branch per environment |
| Code review | mandatory for `_inherit`, security, migrations |
| Tests | unit + integration + tour for critical flows |
| Documentation | ADRs, data dictionary, runbooks |
| Upgrade path | pinned version, migration scripts |
| Dependency hygiene | minimal modules, pinned versions |
| Observability | structured logs, metrics, traces |

---

## 9. Observability

| Signal | Source | Alert |
|---|---|---|
| HTTP 5xx rate | reverse proxy | > 1% for 5 min |
| p95 latency | APM/access log | > 2 s for 10 min |
| DB connections | `pg_stat_activity` | > 80% max |
| Long transactions | `pg_stat_activity` | > 5 min |
| Lock waits | `pg_locks` | > 30 s |
| Cron failures | `ir.cron.failure_count` | > 3 |
| Disk usage | OS | > 80% |
| Filestore size | OS/S3 | growth > 20%/week |
| Backup success | backup job | any failure |
| Replication lag | PostgreSQL | > 60 s |

Logs must include request id, user id, database, and duration. Do not log secrets or full payloads containing personal data.

---

## 10. Backup and disaster recovery

| Item | Requirement |
|---|---|
| Database backup | daily full + WAL archiving |
| Filestore backup | daily incremental, same retention |
| Restore test | monthly, timed |
| Off-site copy | encrypted, separate region |
| Retention | 30 daily, 12 monthly, 7 yearly (policy) |
| RTO/RPO | documented and tested |
| Runbook | step-by-step restore + validation |

**[INVARIANT]** A backup is not valid until restored and smoke-tested. Include filestore and verify attachments.

---

## 11. Usability and accessibility

- responsive backend for desktop/tablet,
- keyboard navigation for high-volume screens,
- WCAG 2.1 AA where legally required (core is partial),
- translated UI and reports,
- timezone-aware dates,
- clear error messages (use `UserError`, not stack traces).

---

## 12. Operability

| Requirement | Control |
|---|---|
| Deployment | reproducible (containers/ansible), versioned |
| Rollback | DB+filestore restore or blue/green |
| Maintenance mode | drain workers, block writes |
| Feature flags | ICP/company settings |
| Runbooks | upgrade, restore, incident, close |
| On-call | escalation, ownership |
| Capacity planning | quarterly review |

---

## 13. NFR acceptance checklist

- [ ] Performance tested on production-like data.
- [ ] Load test at 2× peak.
- [ ] Backup restore tested.
- [ ] Failover tested.
- [ ] Security review/pen test done.
- [ ] Access review completed.
- [ ] Audit trails verified.
- [ ] Localization signed off by accountant.
- [ ] Monitoring/alerts live.
- [ ] Runbooks written and rehearsed.
- [ ] RTO/RPO met in a drill.
- [ ] Upgrade path tested on a copy.

---

## 14. Evidence index

| Topic | File |
|---|---|
| Worker config | `tools/config.py:393-491` |
| Connection pool | `sql_db.py:610-690` |
| Cron | `addons/base/models/ir_cron.py` |
| Bus | `addons/bus/models/bus.py` |
| Attachments | `addons/base/models/ir_attachment.py` |
| Lock dates | `addons/account/models/company.py:76-112` |
| Tracking | `addons/mail/models/mail_thread.py` |

Continue with `07-testing-strategy.md`.
