# SCOS Alerts Log

[Hub](../index.html) | [Overview](index.md) | [Manifest](manifest.md) | [Architecture](architecture.md) | [Observations](observations.md)

## Purpose

Track urgent production incidents and response quality. Keep entries brief and factual.

## Severity Scale

- `SEV-1`: Immediate threat to survival (home collapse, spawn deadlock, complete defense failure)
- `SEV-2`: Major degradation (target room unsafe, mission blocked, repeated spawn failures)
- `SEV-3`: Local issue with workaround (single-role instability, temporary routing issue)

## Entry Template

- Date (UTC): `YYYY-MM-DD`
- Severity: `SEV-x`
- Trigger: what happened
- Scope: affected room(s)/role(s)
- Immediate Response: first mitigation
- Resolution: final fix
- Follow-up: preventive action

## Entries

- Date (UTC): `2026-02-14`
- Severity: `SEV-2`
- Trigger: Invader pressure in `E57S56` while logistics and builder traffic were active
- Scope: `remoteMiner`, `upgrader`, `builder` losses and interruptions
- Immediate Response: threat-driven defender priority and emergency spawn path
- Resolution: defender routing with memory-based target assignment
- Follow-up: continue extension rollout in `E57S56` to improve local spawn throughput
