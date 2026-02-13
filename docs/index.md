SCOS (Screeps Colony Operating System)

Version: 6.3.x
Kernel: Single-pass orchestration with priority spawn ladder
Status: RCL 5, active multi-room expansion

Project Goal

Build a resilient colony that can expand and recover automatically with clear, low-noise observability.

Current Strategic Rooms

- Home: `E58S56`
- Target (owned/developed): `E57S56`
- Expansion (reserve + mine): `E57S55`

Current Enforced Room Quotas

- `E57S56`: builders `2`, upgraders `1`
- `E57S55`: claimers `1` (reserve mode), remote miners `4`

Observability

Heartbeat logs provide:

- Energy and total role population
- Active room assignments by mission quota
- Spawn status (`IDLE` or `BUSY` with remaining time)
- Next/blocked spawn action
- Spawn queue preview with deficits

Documentation Map

- `docs/MANIFEST.md`: source-of-truth operations and mission policy
- `docs/PRINCIPLES.md`: engineering standards and design intent
- `docs/Recue Commands`: operational runbook and quick checks
