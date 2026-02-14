# SCOS Alerts Log

[Hub](../index.html) | [Overview](index.md) | [Manifest](manifest.md) | [Architecture](architecture.md) | [Observations](observations.md)

## Purpose

Track urgent production incidents and response quality. Keep entries brief and factual.

## Severity Scale

- `SEV-1`: immediate threat to survival (home collapse, spawn deadlock, complete defense failure)
- `SEV-2`: major degradation (target room unsafe, mission blocked, repeated spawn failures)
- `SEV-3`: local issue with workaround (single-role instability, temporary routing issue)

## Entry Template

- Date-Time (UTC): `YYYY-MM-DDTHH:MM:SSZ`
- Severity: `SEV-x`
- Trigger: what happened
- Scope: affected room(s)/role(s)
- Immediate Response: first mitigation
- Resolution: final fix
- Follow-up: preventive action

## Entries

- Date-Time (UTC): `2026-02-14T10:21:00Z`
- Severity: `SEV-2`
- Trigger: invader pressure in `E57S56` while logistics and builder traffic were active
- Scope: `remoteMiner`, `upgrader`, `builder` losses and interruptions
- Immediate Response: threat-driven defender priority and emergency spawn path
- Resolution: defender routing with memory-based target assignment
- Follow-up: continue extension rollout in `E57S56` to improve local spawn throughput
