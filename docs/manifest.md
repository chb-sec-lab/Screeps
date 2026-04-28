# System Manifest

Hub | Overview | Principles | Architecture | Observations | Alerts | Runbook

## Purpose

Systemweite Richtlinien für Architekturgrenzen, Missionsprioritäten und operative Standards.

## Topology

Gesteuert durch die `registry` in `config.rooms.js`:
- CORE: `W7N8` (Primärbasis, geräumig)
- CORE: `W7N7` (Sekundärbasis, 2 Quellen, wird zurückerobert)
- CORE: `W8N8` (Westliche Basis, 1 Quelle, enges Layout)
- REMOTE: `W6N8` (Östliche Mine, 1 Quelle, an W7N8 angebunden)
- REMOTE: `W8N7` (Westliche Mine, 1 Quelle, an W7N8 angebunden)
- REMOTE: `W9N6` (Neue südliche Mine, 2 Quellen, an W7N8 angebunden)
- QUARANTINED: `W6N7` (Feindliche Bot-Aktivität, zur globalen `BLACKLIST` hinzugefügt)

## Operational Priorities

1.  Kontinuität der Wirtschaft hat Vorrang (`harvester`, `hauler`).
2.  Einhaltung der Missionsquoten durch Raumzuweisung.
3.  Bedrohungsgesteuerte Verteidigung vor nicht-kritischen Wachstumsarbeiten.
4.  Deterministisches, beobachtbares Verhalten vor Ad-hoc-Optimierung.

## Assignment Contract

- `builder`, `repairer`, `janitor`: `memory.workRoom` oder `memory.office`
- `upgrader`, `claimer`: `memory.targetRoom`
- `remoteMiner`, `remoteHauler`: `memory.targetRoom`, `memory.homeRoom`
- `mineralMiner`, `chemist`: `memory.workRoom` (automatisch Räumen mit Extraktoren zugewiesen)
- Rollenmodule bleiben generisch und raumunabhängig.

## Erzwingung von Quoten (Evolution Protocol)

Das System verwendet das **Evolution Protocol**, eine im `RoomManager` implementierte Logik, die die Anzahl der benötigten Arbeiter (Builder, Upgrader etc.) dynamisch an das Raum-Level (RCL) und die vorhandene Infrastruktur anpasst. Manuelle Quoten in `config.roles.js` sind nicht mehr nötig.

- **Phase 1 (RCL 1-2 "Bootstrap"):** Fokus auf schnelles Wachstum mit vielen Buildern und Upgradern.
- **Phase 2 (RCL 3 "Basic Infra"):** Einführung von Logistik (Hauler) und Wartung (Repairer), sobald Container und Türme verfügbar sind.
- **Phase 3 (RCL 4+ "Empire"):** Reduzierung der Builder zugunsten einer stabilen Wirtschaft, die Remote-Mining und andere fortgeschrittene Operationen unterstützt.

- **Self-Healing Logistics:** Hauler- und Scavenger-Quoten skalieren automatisch nach oben, wenn lokale Container überlaufen (>1800 Energie) oder übermäßig viel fallengelassene Energie erkannt wird, wodurch manuelle Anpassungen pro Raum entfallen.
- **Fact-Based Scaling:** Harvester-Quoten skalieren bei RCL 3+ dynamisch von 2 auf 1 pro Quelle herunter, da ein einzelner großer Harvester die Regenerationsrate der Quelle von 10 Energie/Tick perfekt auslastet.

Remote-Mining wird über `Memory.remoteRooms` gesteuert. Der `RemoteManager` fordert die benötigten `remoteMiner` und `remoteHauler` automatisch an. Verteidiger (`defender`) werden vom `DefenceManager` bei Bedarf mit hoher Priorität in die Spawn-Warteschlange geschoben.

## Verteidigungs- und Wartungsrichtlinie

- Verteidiger werden bei Bedarf gespawnt, wenn Feinde in `CORE`- oder `REMOTE`-Räumen entdeckt werden.
- **Diplomatie:** Bekannte friedliche Spieler können global auf eine Whitelist (`ALLIES`-Array) gesetzt werden, um eine sichere Durchfahrt durch Bunker-Ramparts zu ermöglichen.
- **Notfall-Wiederherstellung:** Builder priorisieren Baustellen für `STRUCTURE_SPAWN` bedingungslos über alle Reparaturen, um eine Wiederherstellung nach einem Wipe zu garantieren.
- **Smart-Bunker:** Ramparts werden nur direkt über kritischen Strukturen (Spawns, Towers, Storage, Terminals) gebaut. Türme priorisieren die schwächste Rampe bis zu `50k` Trefferpunkten.
- **Edge-Links:** Remote-Hauler liefern Energie an Links an der Raumgrenze, um die Umlaufzeiten drastisch zu verkürzen.
- **Universal Survival:** Kritische Überlebenslogik (z.B. Kiting vor Feinden) ist in `utils.survival` zentralisiert, um konsistentes Verhalten über alle Rollen hinweg zu gewährleisten.
- Veraltete oder feststeckende Creeps können durch Setzen von `memory.recycle = true` außer Dienst gestellt werden, wodurch sie zur Energierückgewinnung zum nächsten Spawn geleitet werden.
