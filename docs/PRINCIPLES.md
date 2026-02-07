Engineering Principles & Motivation

🧠 Motivation

Beyond learning JavaScript, this project is driven by a personal inquiry into structure and sustainability.

I naturally prioritize contribution and support, which often creates tension around having "enough" margin. This project explores how to build systems—technical and personal—that are resilient, predictable, and generous without being fragile.

In Screeps, as in life:

Willpower is irrelevant; structure determines outcomes.

If a system is noisy, overloaded, or poorly bounded, it degrades over time.

If observability is missing, failure appears "sudden" even though it was structural.

Calm systems outperform noisy ones over time.

🛑 Non-Goals

To maintain focus and sanity, we explicitly define what we are NOT doing:

No Leaderboard Chasing: We are not competing for global rank.

No Premature Optimization: We do not save CPU at the cost of readability.

No "Black Box" Code: If we cannot explain it, we do not deploy it.

No Alert Fatigue: We use Game.notify only for actionable, critical failures.

🎓 The Teaching Angle

This repository serves as a foundation for coaching (targeting 16-18+ demographics) on:

Planning: How structure reduces stress.

Autonomy: How freedom emerges from good design.

Balance: Engineering rest and effort.

🛡 Error Handling Protocol

Given the collaborative nature of this project (Human + AI), we adhere to a strict interpretation rule:

Ambiguity: When interpreting UI/Screenshots, confidence levels must be stated.

Verification: Runtime errors are distinguished from Console experimentation errors.

Trust: We value correctness over speed.

✅ Definition of Done (Phase 1 & 2)

A phase is considered complete not when features exist, but when:

The economy is stable (no congestion loops).

Invariants (Role Caps) are documented and enforced.

The console output is bounded (no scroll-spam).

The system can recover from a total wipe without human intervention.