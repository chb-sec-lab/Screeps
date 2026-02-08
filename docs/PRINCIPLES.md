Engineering Principles & Motivation

🧠 Motivation

Beyond learning JavaScript, this project is driven by a personal inquiry into structure and sustainability.

I naturally prioritize contribution and support, which often creates tension around having "enough" margin. This project explores how to build systems—technical and personal—that are resilient, predictable, and generous without being fragile.

In Screeps, as in life:

Willpower is irrelevant; structure determines outcomes.

If a system is noisy, overloaded, or poorly bounded, it degrades over time.

If assumptions are wrong, reality corrects them continuously.

If observability is missing, failure appears "sudden" even though it was structural.

Calm systems outperform noisy ones over time.

🛑 Non-Goals

To maintain focus and sanity, we explicitly define what we are NOT doing:

No Leaderboard Chasing: We maximize internal stability, not global rank.

No Premature Optimization: We prioritize code readability and maintainability over raw CPU efficiency.

No "Black Box" Code: If we cannot explain the logic, we do not deploy it. Explainability is a requirement.

No Alert Fatigue: We use Game.notify strictly for actionable, critical failures, avoiding signal noise.

🎓 The Teaching Angle

This repository serves as a foundation for coaching (targeting 16-18+ demographics) on:

Planning: How structure reduces stress and cognitive load.

Autonomy: How freedom emerges from good design constraints.

Balance: Engineering rest, effort, and recovery cycles.

🛡 Error Handling Protocol

Given the collaborative nature of this project (Human + AI), we adhere to a strict interpretation rule:

Ambiguity: When interpreting UI/Screenshots, explicit confidence levels must be stated.

Verification: Runtime errors are distinguished from Console experimentation errors.

Trust: We value correctness and understanding over speed of implementation.

✅ Definition of Done (Phase 1 & 2)

A phase is considered complete not when features exist, but when:

The economy is stable (no congestion loops).

Invariants (Role Caps) are documented and enforced.

The console output is bounded (no scroll-spam).

The system can recover from a total wipe without human intervention.

Documentation Consistency: The codebase matches the README and PRINCIPLES exactly.