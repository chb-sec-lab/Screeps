# SCOS - Screeps Colony Operating System

[Hub](../index.html) | [Overview](index.md) | [Manifest](manifest.md) | [Principles](principles.md) | [Architecture](architecture.md) | [Observations](observations.md) | [Alerts](alerts.md) | [Runbook](recue-commands.md)

## Executive Summary

SCOS is a production-oriented Screeps system focused on stability, observability, and scalable multi-room expansion.

- Version: `6.3.x`
- Kernel: single-pass orchestration with priority spawn ladder
- Status: `RCL 5`, active multi-room expansion

## Active Topology

- Home: `E58S56`
- Target (Develop): `E57S56`
- Expansion (Reserve + Mine): `E57S55`

## Enforced Mission Quotas

- `builder@E57S56`: `2`
- `upgrader@E57S56`: `1`
- `claimer@E57S55` (reserve): `1`
- `remoteMiner@E57S55`: `4`
- `hauler@E57S55`: `1`

## Observability Model

Heartbeat logs are emitted every 20 ticks and show:

- energy and capacity (`NRG`)
- population by role (`POP`)
- room context (`ROOMS`)
- mission assignments (`ASSIGN`)
- spawn status with remaining time (`Spawn`)
- prioritized deficit queue (`QUEUE`)

## Documentation Map

- HTML docs (recommended for navigation):
- `overview.html`, `manifest.html`, `principles.html`, `architecture.html`, `runbook.html`, `observations.html`, `alerts.html`
- Markdown remains the editable source:
- update `.md` files, then run `python3 scripts/build-docs.py`
- [System Manifest](manifest.md): policy, quotas, ownership
- [Engineering Principles](principles.md): architecture and quality standards
- [Operational Runbook](recue-commands.md): live checks and recovery actions

## Job Search Positioning

This project demonstrates:

- structured orchestration over ad-hoc scripting
- memory-driven role assignment in multi-room operations
- operational logging for fast diagnosis
- iterative, documentation-driven improvement
