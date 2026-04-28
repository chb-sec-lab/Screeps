# Modular Colony Architecture (MCA)

Dieses Dokument beschreibt die skalierbare, objektorientierte "Boardroom"-Architektur für Screeps. Sie maximiert Effizienz und CPU-Sicherheit durch strikte Aufgabentrennung und Edge-Logistik.

## 🏢 Struktur-Überblick

- **Boardroom:** Das Singleton, das über `Game.rooms` iteriert. Es vermeidet fest kodierte Namen und instanziiert für jeden eigenen Raum ein `Office`.
- **Office:** Der Manager eines einzelnen Raums. Kapselt `RoomManager`, `RemoteManager` und `DefenceManager`.
- **RoomManager:** Zuständig für Bau, Spawn-Warteschlangen und den **Janitor** (Wartung der Infrastruktur).
- **RemoteManager:** Automatisiert Außengebiete. Platziert **Edge-Links** an den Raumgrenzen, um die Laufwege der Hauler-Pools dramatisch zu verkürzen.
- **DefenceManager:** Schützt die Kolonie. Fordert gezielt `outpostDefender` an, sobald Feinde in Remote-Gebieten gesichtet werden.

## 🚀 Warum diese Architektur überlegen ist

1. **Skalierbarkeit:** Keine festen Raumnamen im Code. Die KI iteriert dynamisch über den Boardroom. Egal ob 1 oder 10 Räume, die Logik skaliert nahtlos mit.
2. **Effizienz (Edge-Links):** Hauler aus Remote-Minen müssen nicht mehr bis zum Storage im Herzen der Basis laufen. Sie betreten den Basis-Raum, werfen die Energie in einen "Edge-Link" direkt am Ausgang, und drehen sofort um. Die Energie wird in 1 Tick ins Zentrum ge-beamt.
3. **Sicherheit:** Der DefenceManager operiert unabhängig. Fällt die Wirtschaft aus, funktioniert das Überwachungsradar der Remote-Gebiete trotzdem weiter.

## ⚙️ How-To-Use: Remote-Räume aktivieren

Um ein neues Gebiet in dein Imperium aufzunehmen, musst du den Code nicht ändern. Füge das Gebiet einfach zur dynamischen Konfiguration in die Konsole oder direkt ins Memory ein:

```javascript
// Konsolen-Befehl im Spiel:
Memory.remoteRooms['W9N6'] = { 
    base: 'W7N8',   // Dein Office, das diesen Raum verwaltet
    miners: 1,      // Anzahl der Miner
    haulers: 2      // Anzahl der Transport-Hauler im Pool
};
```
Der `RemoteManager` des Office "W7N8" wird dies im nächsten Tick erkennen, Container planen, Edge-Links setzen und die Einheiten über den `RoomManager` anfordern.

---
*Detaillierte Dokumentationen zu den einzelnen Klassen findest du unter `docs/Boardroom.md`, `docs/RemoteManager.md` etc.*