# Engineering Principles

[Hub](../index.html) | [Startpage (HTML)](index.html) | [Overview](index.md) | [Manifest](manifest.md) | [Architecture](architecture.md) | [Observations](observations.md) | [Alerts](alerts.md) | [Runbook](recue-commands.md)

## Motivation

This project is a practical engineering framework for resilient automation:

- Structure over randomness
- Transparency over black-box behavior
- Recoverability over fragile special cases

## Core Principles

- System design outperforms pure willpower.
- Clear invariants matter more than short-lived tricks.
- Observability is part of architecture, not a debug add-on.
- Maintainability and explainability are first-class requirements.

## Non-Goals

- No leaderboard race optimization.
- No premature micro-optimization at readability cost.
- No opaque "magic" algorithms in production behavior.
- No alert fatigue without clear actionability.

## Human + AI Collaboration

- Ambiguous information is treated as a hypothesis until verified.
- Runtime errors and experiment errors are evaluated separately.
- Correctness and traceability take priority over speed.

## Definition of Done

A rollout phase is done when:

- Economy remains stable.
- Role invariants are documented and enforced.
- Logs remain compact, periodic, and decision-oriented.
- The system recovers after losses without manual rescue loops.
- Code and documentation remain consistent.

## Observability Standard

Operational logs must show immediately:

- What is missing now (deficit queue)?
- Which room each mission-critical role is assigned to?
- Whether spawning is productive, blocked, or idle?
