# Canonical PM document templates

Use these schemas when creating or repairing a project's PM source of truth. Adapt labels to the project's language, but preserve the separation of concerns.

## PRODUCT.md

```markdown
# Product

Last updated: YYYY-MM-DD

## One-sentence definition

## Target users

## Core problem

## Value proposition

## Product principles

## Constraints

## Non-goals

## Success measures
```

Keep this durable. Do not put sprint tasks or transient progress here.

## SCOPE.md

```markdown
# Scope ledger

Last updated: YYYY-MM-DD

| Capability | Decision | Delivery state | Target release | User outcome / rationale | Revisit condition |
| --- | --- | --- | --- | --- | --- |
```

Allowed decisions: `keep`, `freeze`, `defer`, `remove`, `candidate`.

Allowed delivery states: `verified`, `implemented, unverified`, `partial`, `not started`, `unknown`.

Include existing capabilities as well as proposed ones. Never delete a removed capability from the ledger merely to make scope look cleaner.

## RELEASE.md

```markdown
# Current release

Last updated: YYYY-MM-DD

## Release outcome

## Target users and rollout

## Gates

| Priority | Gate | Acceptance criterion | State | Evidence / blocker |
| --- | --- | --- | --- | --- |

## Explicitly out of scope

## Release decision

Not ready / conditionally ready / ready, with a short rationale.
```

Use outcome-focused gates. Keep P2 work outside the committed gate table.

## STATUS.md

```markdown
# Delivery status

Last updated: YYYY-MM-DD

## Summary

## In progress

| Work item | Release | State | Evidence | Next checkpoint |
| --- | --- | --- | --- | --- |

## Verified complete

## Blocked

## Recently changed
```

Keep only current execution state here. Put why a scope choice was made in `DECISIONS.md`.

## DECISIONS.md

```markdown
# Product decisions

## YYYY-MM-DD — Decision title

- Status: proposed / accepted / superseded
- Decision:
- Context:
- Rationale:
- Consequences:
- Revisit when:
- Supersedes:
```

Append decisions newest-first. Do not erase superseded decisions.
