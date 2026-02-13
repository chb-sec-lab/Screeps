# Engineering Principles

[Startseite (HTML)](index.html) | [Overview](index.md) | [Manifest](MANIFEST.md) | [Runbook](Recue%20Commands)

## Motivation

Das Projekt dient als Lern- und Engineering-Rahmen fuer belastbare Automatisierung:

- Struktur statt Zufall
- Transparenz statt Blackbox
- Wiederherstellbarkeit statt fragiler Spezialfaelle

## Core Principles

- Systemdesign gewinnt gegen reine Willenskraft.
- Klare Invarianten sind wichtiger als kurzfristige Tricks.
- Beobachtbarkeit ist Teil der Architektur, nicht nur Debug-Hilfe.
- Wartbarkeit und Erklaerbarkeit haben Prioritaet.

## Non-Goals

- Kein Leaderboard-Optimierungsrennen.
- Keine verfruehte Mikro-Optimierung auf Kosten der Lesbarkeit.
- Keine schwer erklaerbaren "Magic"-Algorithmen im Live-Betrieb.
- Keine Alarmflut ohne konkrete Handlungsoption.

## Human + AI Collaboration

- Unklare Informationen werden als Hypothese behandelt.
- Runtime-Fehler und experimentelle Console-Fehler werden getrennt bewertet.
- Korrektheit und Nachvollziehbarkeit haben Vorrang vor Geschwindigkeit.

## Definition of Done

Eine Ausbaustufe gilt als abgeschlossen, wenn:

- Die Oekonomie stabil bleibt.
- Rollen-Invarianten dokumentiert und erzwungen sind.
- Logs kompakt, regelmaessig und entscheidungsorientiert bleiben.
- Das System nach Verlusten ohne manuelle Rettungsaktionen wieder hochfaehrt.
- Code und Dokumentation konsistent sind.

## Observability Standard

Operative Logs muessen unmittelbar zeigen:

- Was fehlt aktuell? (Defizit-Queue)
- Wer ist welchem Raum zugeordnet? (Mission-Assignment)
- Ist der Spawn produktiv, blockiert oder idle?
