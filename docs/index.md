# SCOS - Screeps Colony Operating System

[Hub](../index.html) | [Startseite (HTML)](index.html) | [Manifest](manifest.md) | [Principles](principles.md) | [Architecture](architecture.md) | [Observations](observations.md) | [Alerts](alerts.md) | [Runbook](recue-commands.md)

## Executive Summary

SCOS ist ein lern- und produktionsnahes Screeps-System mit Fokus auf Stabilitaet, Observability und skalierbarer Mehrraum-Expansion.

- Version: `6.3.x`
- Kernel: Single-pass orchestration mit Priority-Spawn-Ladder
- Status: `RCL 5`, aktive Multi-Room-Expansion

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

Heartbeat-Logs liefern alle 20 Ticks:

- Energie-/Kapazitaetsstatus (`NRG`)
- Populationsstatus nach Rolle (`POP`)
- Raumkontext (`ROOMS`)
- Missionszuweisung (`ASSIGN`)
- Spawnstatus inkl. Restzeit (`Spawn`)
- Priorisierte Defizit-Queue (`QUEUE`)

## Documentation Map

- HTML docs (recommended for navigation):
- `overview.html`, `manifest.html`, `principles.html`, `architecture.html`, `runbook.html`, `observations.html`, `alerts.html`
- Markdown remains the editable source:
- update `.md` files, then run `python3 scripts/build-docs.py`
- [System Manifest](manifest.md): Betriebsregeln, Quoten, Ownership
- [Engineering Principles](principles.md): Architektur- und Qualitaetsgrundsaetze
- [Operational Runbook](recue-commands.md): Live-Checks und Recovery-Aktionen

## Job Search Positioning

Das Projekt demonstriert:

- Strukturierte Orchestrierung statt ad-hoc-Skripting
- Memory-driven Role Assignment in Multi-Room-Setups
- Operational Logging fuer schnelle Diagnose
- Iterative, dokumentationsgetriebene Weiterentwicklung
