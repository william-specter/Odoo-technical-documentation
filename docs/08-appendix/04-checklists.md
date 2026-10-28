# Appendix D — Checklists

> **Use.** Copy the relevant checklist into the ticket/PR/runbook. A checklist is only useful if a named person signs it.

---

## 1. Architecture review

- [ ] Scope and non-goals documented.
- [ ] Module dependency graph is acyclic and declared.
- [ ] No core source modifications.
- [ ] Custom modules have a single responsibility.
- [ ] Inheritance strategy chosen deliberately (`_inherit`/prototype/`_inherits`/mixin).
- [ ] State machines documented with guards.
- [ ] Security model: groups, ACLs, record rules, field groups, portal.
- [ ] Multi-company and multi-currency addressed.
- [ ] Integration contracts versioned, idempotent, monitored.
- [ ] Data migration strategy and reconciliation.
- [ ] Performance targets and dataset.
- [ ] Upgrade path and version pinning.
- [ ] ADRs for non-obvious decisions.
- [ ] Observability: logs, metrics, alerts.
- [ ] Backup/restore and rollback.

---

## 2. Code review

### ORM
- [ ] `@api.model_create_multi` on `create`.
- [ ] `super()` in every override.
- [ ] Recordset-safe (no `ensure_one` in loops).
- [ ] Complete `@api.depends`.
- [ ] No `cr.commit()`/`cr.rollback()` in model code.
- [ ] No raw SQL without flush/parameterisation.
- [ ] No `sudo()` without justification.
- [ ] No N+1 or unbounded `search([])`.
- [ ] No mutable default (`{}`/`[]`) in fields.
- [ ] No `NewId` persisted.

### Schema
- [ ] `_description`, `_order` (with `id`), `_rec_name`.
- [ ] `company_id` + record rule for business models.
- [ ] Indexes on filtered FKs.
- [ ] SQL constraints for race-free uniqueness.
- [ ] Explicit `ondelete`.
- [ ] Migration for removed/renamed/required fields.
- [ ] `_check_company_auto` + `check_company=True`.

### Security
- [ ] ACLs for every operation.
- [ ] Record rules for ownership/company.
- [ ] Field groups on sensitive fields.
- [ ] Controllers call `check_access`.
- [ ] Portal routes scoped to partner.
- [ ] No secrets in code/logs.
- [ ] Server actions restricted to system group.

### Views/UI
- [ ] Stable xpath anchors.
- [ ] No whole-form `position="replace"`.
- [ ] Access modifiers consistent with groups.
- [ ] Assets in correct bundle.
- [ ] Translations for user-facing strings.
- [ ] Mobile/tablet check (if relevant).

### Operations
- [ ] Cron idempotent + progress commits.
- [ ] External calls postcommit/outbox.
- [ ] Structured logs, no PII.
- [ ] Config via ICP/company.
- [ ] Tests cover change.
- [ ] Documentation/ADR updated.

---

## 3. Security review

- [ ] Threat model for the feature.
- [ ] Authentication method appropriate.
- [ ] Authorization at model and record level.
- [ ] Least privilege for API/integration users.
- [ ] Portal/public access scoped.
- [ ] File upload validation.
- [ ] No SQL injection.
- [ ] No XSS in QWeb/HTML.
- [ ] CSRF on state-changing routes.
- [ ] Secrets outside the database.
- [ ] 2FA for admins.
- [ ] Audit trail for sensitive actions.
- [ ] Dependency scan.
- [ ] Pen test findings closed.

---

## 4. Performance review

- [ ] Dataset defined (volumes, growth).
- [ ] Hot paths identified.
- [ ] `search()` bounded.
- [ ] Aggregations use `_read_group`.
- [ ] Indexes verified with `EXPLAIN`.
- [ ] No sequential scans on large tables.
- [ ] Computes batched; dependencies complete.
- [ ] Prefetch controlled.
- [ ] No `flush()` per record.
- [ ] Long transactions avoided.
- [ ] Worker/connection pool sized.
- [ ] Read replica for reports (if needed).
- [ ] Performance test at 2× peak.
- [ ] p95 targets met.

---

## 5. Data migration

- [ ] Source profiled (rows, nulls, duplicates, formats).
- [ ] Mapping signed off by business.
- [ ] External ID strategy.
- [ ] Idempotent scripts.
- [ ] Load order defined.
- [ ] Reconciliation metrics and tolerance.
- [ ] Dry run on staging.
- [ ] Rollback plan.
- [ ] Attachments/filestore handled.
- [ ] Cutover timing and freeze.
- [ ] Post-load validation (counts, totals, samples).

---

## 6. Upgrade

- [ ] Backup DB + filestore verified.
- [ ] Staging restore tested.
- [ ] Installed modules and custom code inventoried.
- [ ] Deprecated APIs/models removed.
- [ ] Migration scripts tested.
- [ ] `noupdate` records reviewed.
- [ ] Views validated.
- [ ] Tests pass.
- [ ] Smoke flows pass.
- [ ] Accounting/stock totals reconciled.
- [ ] Cron jobs active.
- [ ] Rollback tested.
- [ ] Maintenance window scheduled.

---

## 7. Go-live

- [ ] Sponsor go/no-go.
- [ ] Backup verified and restorable.
- [ ] Cutover plan with owners/timings.
- [ ] Final data load rehearsed.
- [ ] Reconciliation signed off.
- [ ] Critical flows smoke-tested.
- [ ] Users trained and credentials issued.
- [ ] Support desk briefed.
- [ ] Monitoring/alerts live.
- [ ] Integrations enabled and monitored.
- [ ] Email/SMS/payment providers live.
- [ ] Print/report templates verified.
- [ ] Legal/fiscal sign-off.
- [ ] Rollback criteria agreed.

---

## 8. Hypercare

- [ ] Daily triage scheduled.
- [ ] Severity/SLA agreed.
- [ ] Escalation path.
- [ ] Known issues log.
- [ ] Adoption metrics.
- [ ] Performance monitoring.
- [ ] Data quality checks.
- [ ] Knowledge transfer.
- [ ] Handover checklist.
- [ ] Exit criteria.

---

## 9. Support readiness

- [ ] Runbooks: restart, restore, cron, locks, integration, rollback.
- [ ] On-call rota.
- [ ] Monitoring dashboards.
- [ ] Alert routing.
- [ ] Access management.
- [ ] Backup/restore drill.
- [ ] Incident process.
- [ ] Vendor escalation.
- [ ] Documentation index.
- [ ] Training records.

---

## 10. Sign-off template

```markdown
# Checklist Sign-off

- Checklist: <name>
- Release/Change: <id>
- Date:
- Reviewer:
- Evidence links:

| Item | Status | Comment |
|---|---|---|

Decision: approved / approved with conditions / rejected
Conditions:
```

Continue with `05-sources.md`.
