# Engineering Workflow & Architecture

This document outlines the development workflow established to bypass technical constraints (SMB/Flatpak) and ensure a stable deployment pipeline.

## 1. Development Environment
*   **IDE:** VSCodium (Linux/Flatpak)
*   **Repository:** Git (hosted on SMB share)
*   **Runtime:** Screeps Client via Steam (Proton/Flatpak)

## 2. Deployment Strategy
Due to file permission limitations on the SMB share (ACLs not supported) and sandbox restrictions of the Steam Flatpak client, direct symlinks are not viable.

**Solution: "Build & Deploy" Script**
We utilize a dedicated deployment script (`deploy.sh`) to decouple the development environment from the runtime environment.

*   **Source:** `/projects/Screeps/src` (Git Repo)
*   **Target:** `~/.var/app/.../Screeps/scripts/screeps.com/0.001beta/` (Local SSD)
*   **Process:**
    1.  Code is written and saved in VSCodium.
    2.  `Ctrl+Shift+B` triggers the deploy task.
    3.  Script copies files to the Steam directory.
    4.  Screeps hot-reloads the changes immediately.

## 3. Current Objectives (Phase 1)
*   **Stability:** Ensure the main loop never crashes (Exception Handling).
*   **Observability:** Implement console logging for creep census and spawn status.
*   **Expansion ("Annex Alpha"):**
    *   Strategy: Reservation first (GCL 1 limit).
    *   Role: `Diplomat` (Claimer creep).
    *   Goal: Secure neighboring room for remote mining.

## 4. Coding Standards
*   **Case Sensitivity:** Strict adherence to lowercase filenames (Linux compatibility).
*   **Loop Architecture:** Code acts as a control loop, checking state every tick.
*   **Resilience:** System must recover from full energy depletion (harvester fallback).