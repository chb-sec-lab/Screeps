# SCOS Alerts Log

[Hub](hub.html) | [Overview](index.md) | [Manifest](manifest.md) | [Architecture](architecture.md) | [Observations](observations.md)

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

- Date-Time (UTC): `2026-02-14T22:34:00Z`
- Severity: `SEV-2`
- Trigger: kernel loop crash during active intruder period (`TypeError: _.maxBy is not a function`)
- Scope: full colony orchestration paused due to exception in `main.js`
- Immediate Response: replaced unsupported lodash helper with runtime-safe native loop selection for urgent threat room
- Resolution: loop recovered and threat handling resumed without repeated crash spam
- Follow-up: avoid non-portable lodash helpers in Screeps runtime and prefer explicit JS loops in critical paths

- Date-Time (UTC): `2026-02-15T09:15:00Z`
- Severity: `SEV-2`
- Trigger: CPU limit reached (20/20) and expansion blocked by undetected Invader Cores
- Scope: Global CPU performance, rooms `E57S55` and `E58S55`
- Immediate Response: Optimized kernel loops and updated defender role to target cores
- Resolution: CPU usage stabilized below limit; defenders successfully engaged and cleared Invader Cores
- Follow-up: Monitor CPU overhead during concurrent multi-room combat operations

- Date-Time (UTC): `2026-02-15T15:00:00Z`
- Severity: `SEV-2`
- Trigger: Persistent hostile presence in `E57S55` caused total loss of energy imports, starving the target room `E57S56` infrastructure.
- Scope: `E57S56` (infrastructure buffers) and `E57S55` (remote miners/claimer).
- Immediate Response: Reduced `TARGET_UPGRADER_QUOTA` and `TARGET_BUILDER_QUOTA` to 1. Reduced `E57S55` remote miners to 1.
- Resolution: Shifted the `claimer` spawn priority to `E58S55` to safely secure and double energy output from the secondary mining room.
- Follow-up: Evaluate if `E57S55` should be abandoned completely if hostility continues.
