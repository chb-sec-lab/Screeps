# Screeps – Autonomous Colony Log

## 🏗 Architecture & Workflow
We utilize a decoupled development environment to bypass Steam/Flatpak sandbox restrictions on Linux:
*   **IDE:** VSCodium (Flatpak) with local Git Repository.
*   **Runtime:** Screeps Client (Steam via Proton).
*   **Deployment:** Custom Bash script (`deploy.sh`) copies source files to the specific Steam AppData folder.
*   **Versioning:** Git serves as the Single Source of Truth.

## ⚡ Current Status (Phase 1)
*   **RCL:** 4
*   **Population:** 
    *   Harvesters: 10 (Maintenance mode)
    *   Upgraders: Capped at 5 (Energy efficiency)
*   **Expansion:** "Diplomat" creep logic implemented to reserve neighbor room.

## 📝 Lessons Learned
*   **Module Exports:** In NodeJS/Screeps, objects must be assigned to a variable *before* being exported via `module.exports`. Direct assignment causing `ReferenceError` stops the entire game loop.
*   **File Systems:** Managing permissions between two Flatpak containers (VSCodium & Steam) requires manual intervention (directory ownership/copying).

---
* [Daily Observations](observations.md)
* [Architecture](architecture.md)
* [Workflow](workflow.md)