# SCOS Architecture

[Hub](hub.html) | [Overview](overview.html) | [Manifest](manifest.md) | [Principles](principles.md) | [Runbook](runbook.html) | [Observations](observations.md) | [Alerts](alerts.md)

## Scope

SCOS ist ein multi-room Screeps Betriebssystem, das auf zuverlässige Expansion, explizite Rollenzuweisung und erstklassige Beobachtbarkeit (Observability) ausgelegt ist.

## Strukturelle Schichten (Modular Colony Architecture)

SCOS operiert mit einer objektorientierten, modularen Architektur (MCA), um maximale Entkopplung und Skalierbarkeit zu gewährleisten.

- **Boardroom:** Das globale Singleton, das über `Game.rooms` iteriert und für jeden eigenen Raum eine `Office`-Instanz verwaltet.
- **Office:** Repräsentiert einen `CORE`-Raum und kapselt dessen Sub-Manager. Es dient als Fassade, die die Komplexität der einzelnen Manager verbirgt.
- **Sub-Manager (`RoomManager`, `RemoteManager`, `DefenceManager`):** Spezialisierte Klassen, die jeweils einen Aspekt der Kolonie verwalten (Wirtschaft, Expansion, Verteidigung). Sie sind vollständig voneinander entkoppelt und kommunizieren nur über die `Office`-Klasse.
- **Role Execution Layer (`role.*.js`):** Enthält die State-Machines für die einzelnen Creep-Typen. Diese sind generisch und raumunabhängig.
- **Utilities (`utils.*.js`):** Geteilte Hilfsfunktionen für Pfadfindung, Inventarisierung, Logging, Überleben etc.

## Operational Topology

Das System nutzt zwei zentrale Memory-Objekte zur Steuerung:
- **`config.rooms.js`:** Definiert die strategische Topologie. `CORE`-Räume sind autonome Basen, `REMOTE`-Räume sind zugewiesene Außenposten.
- **`Memory.remoteRooms`:** Eine dynamische Konfiguration, die es dem Operator erlaubt, per Konsolenbefehl neue Remote-Mining-Operationen zu starten, ohne den Code zu ändern.

## Control Model

Die Creep-Zuweisung erfolgt über Memory-Flags (`workRoom`, `targetRoom`, `homeRoom`). Die Spawn-Entscheidungen werden nicht mehr von einer zentralen `main.js`-Schleife getroffen, sondern von den dezentralen `RoomManager`-Instanzen, die ihre eigenen, priorisierten Warteschlangen (`spawnQueue`) füllen. Dies verhindert globale Deadlocks und ermöglicht eine präzisere, raum-spezifische Steuerung.

## Logging and Learning Loop

- **Heartbeat Logs:** Liefern alle 20 Ticks einen Zustands-Snapshot der gesamten Kolonie.
- **`docs/observations.md`:** Erfasst nicht-dringende Erkenntnisse und validierte Verbesserungen.
- **`docs/alerts.md`:** Erfasst dringende Vorfälle, deren Behebung und präventive Maßnahmen.
- Dokumentationsänderungen werden als Teil der Auslieferung behandelt, nicht als nachträglicher Gedanke.

## Documentation Contract

- Jede strukturelle Änderung muss aktualisiert werden:
- Missions-Richtlinie in `manifest.md`
- Begründung in `principles.md` (falls sich das Design geändert hat)
- Mindestens ein Eintrag in `observations.md` oder `alerts.md`
