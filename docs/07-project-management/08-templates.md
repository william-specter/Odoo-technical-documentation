# Project Management VIII — Document Templates

> **Use.** Copy these into your project repository. Keep them short and current; a stale document is worse than no document.

---

## 1. Architecture Decision Record (ADR)

```markdown
# ADR-0001: <Title>

- Status: proposed | accepted | superseded | rejected
- Date: YYYY-MM-DD
- Deciders: <names>
- Related: <links>

## Context

What problem are we solving? What constraints (Odoo version, modules, data,
performance, compliance) apply?

## Options

### Option A — <name>
- Description
- Pros
- Cons
- Cost/effort

### Option B — <name>
...

## Decision

We choose Option X because ...

## Consequences

- Positive:
- Negative:
- Migration/rollback:
- Follow-ups:

## Evidence

- Source references:
- Prototype/benchmark:
```

---

## 2. Solution specification

```markdown
# Solution Specification: <Feature>

## 1. Summary
One paragraph.

## 2. Business context
Actors, process, frequency, volume, pain.

## 3. Requirements
| ID | Requirement | Priority | Acceptance |
|---|---|---|---|

## 4. Scope
In scope / out of scope.

## 5. Odoo design
- Modules:
- Models (new/extended):
- Fields:
- State machine:
- Security (groups/ACL/rules):
- Views/actions:
- Automation/cron:
- Reports:

## 6. Data model
ER diagram + table/field definitions.

## 7. Flows
Sequence/activity diagrams.

## 8. Integration
Contracts, auth, idempotency, retries, monitoring.

## 9. Migration
Data mapping, scripts, reconciliation.

## 10. Performance
Dataset, targets, indexes.

## 11. Tests
Unit/integration/tour/performance/security.

## 12. Risks
| Risk | Mitigation |

## 13. Open questions
```

---

## 3. Test plan

```markdown
# Test Plan: <Release>

## 1. Scope
What is tested / not tested.

## 2. Environments
URL, DB, data set, version.

## 3. Roles
Who tests what.

## 4. Scenarios
| ID | Scenario | Precondition | Steps | Expected | Actual | Status |

## 5. Non-functional
| Type | Target | Result |

## 6. Defects
| ID | Severity | Description | Owner | Status |

## 7. Exit criteria
- critical/high closed
- UAT sign-off
- performance met

## 8. Sign-off
Name, role, date.
```

---

## 4. Cutover checklist

```markdown
# Cutover Plan: <Release>

## Timeline
| T | Activity | Owner | Duration | Verify | Rollback |

## Pre-requisites
- [ ] backup verified
- [ ] final extract ready
- [ ] users notified
- [ ] support rota
- [ ] rollback tested

## Go/No-Go
| Criterion | Owner | Status |

## Communication
| Time | Audience | Channel | Message |

## Post-cutover
- [ ] smoke tests
- [ ] reconciliation
- [ ] monitoring
- [ ] hypercare kickoff
```

---

## 5. RAID log

```markdown
# RAID Log

## Risks
| ID | Risk | P | I | Score | Mitigation | Owner | Trigger | Status |

## Assumptions
| ID | Assumption | Impact if false | Owner | Validate by |

## Issues
| ID | Issue | Severity | Owner | Due | Status | Resolution |

## Dependencies
| ID | Dependency | Owner | Needed by | Status | Impact |
```

---

## 6. Change request

```markdown
# Change Request CR-<NN>

- Requested by:
- Date:
- Related epic/story:

## Description
What is requested and why.

## Impact
- Scope:
- Schedule:
- Cost (PD):
- Architecture:
- Data/migration:
- Security:
- Testing:

## Options
1. Do it now
2. Defer to phase 2
3. Reject

## Decision
Approved/rejected by: <sponsor> on <date>.

## Implementation
Epic/stories, owner, target release.
```

---

## 7. Data mapping specification

```markdown
# Data Mapping: <Source> → Odoo

## Source profile
- System:
- Table/view:
- Rows:
- Owner:
- Quality notes:

## Mapping
| Source field | Odoo model.field | Type | Transform | Required | Default | Notes |

## Keys
- External ID strategy:
- Deduplication:
- Idempotency:

## Reconciliation
| Metric | Source | Odoo | Tolerance |

## Cutover
- Extract window:
- Load order:
- Rollback:
```

---

## 8. Code review checklist

```markdown
# Code Review: <PR>

## Correctness
- [ ] requirement met
- [ ] edge cases handled
- [ ] state guards
- [ ] idempotent

## Odoo
- [ ] `_inherit` + `super()`
- [ ] recordset-safe
- [ ] complete `@api.depends`
- [ ] no `cr.commit()`
- [ ] no raw SQL without flush
- [ ] no `sudo()` without justification
- [ ] no N+1/unbounded search

## Schema
- [ ] `_description`, `_order`, `_rec_name`
- [ ] company_id + rule
- [ ] indexes
- [ ] constraints
- [ ] migration

## Security
- [ ] ACLs
- [ ] record rules
- [ ] field groups
- [ ] controller access checks
- [ ] no secrets

## Tests
- [ ] unit/integration
- [ ] tour (if UI)
- [ ] performance (if hot)
- [ ] migration

## Docs
- [ ] ADR/spec updated
- [ ] changelog
```

---

## 9. Runbook

```markdown
# Runbook: <Operation>

## Trigger
When to use this runbook.

## Impact
What is affected, for how long.

## Pre-checks
- [ ] backup
- [ ] access
- [ ] maintenance window

## Steps
1. ...
2. ...

## Verification
- [ ] health check
- [ ] smoke test
- [ ] reconciliation

## Rollback
1. ...

## Escalation
| Level | Contact | When |
```

---

## 10. Handover

```markdown
# Handover: <Project>

## Scope delivered
## Architecture
## Environments
## Access/credentials (secure transfer)
## Runbooks
## Monitoring/alerts
## Open issues/backlog
## Support model/SLA
## Training records
## Warranty
## Sign-off
```

---

## 11. Document conventions

- one document = one decision or one plan,
- version and date every document,
- link to source/evidence,
- keep templates in the repo, not in a wiki that drifts,
- review at gates.

Continue with Volume 8: appendix.
