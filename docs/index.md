# SCOS - Screeps Colony Operating System

[Startseite (HTML)](index.html) | [Manifest](MANIFEST.md) | [Principles](PRINCIPLES.md) | [Runbook](Recue%20Commands)

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

- [System Manifest](MANIFEST.md): Betriebsregeln, Quoten, Ownership
- [Engineering Principles](PRINCIPLES.md): Architektur- und Qualitaetsgrundsaetze
- [Operational Runbook](Recue%20Commands): Live-Checks und Recovery-Aktionen

## Job Search Positioning

Das Projekt demonstriert:

- Strukturierte Orchestrierung statt ad-hoc-Skripting
- Memory-driven Role Assignment in Multi-Room-Setups
- Operational Logging fuer schnelle Diagnose
- Iterative, dokumentationsgetriebene Weiterentwicklung
