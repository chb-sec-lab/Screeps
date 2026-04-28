# Modul: RemoteManager

Der **RemoteManager** ist der Schlüssel zu einem hochskalierenden Wirtschafts-Netzwerk. Er erweitert den Einfluss eines `Office` auf unbeanspruchte Nachbarräume ("Territories").

## Funktionsübersicht

1. **Zuweisung:** Liest `Memory.remoteRooms` und filtert alle Räume heraus, die dem übergeordneten `Office` zugeteilt sind.
2. **Personal-Pool:** Hält den Pool an `remoteMiners` und `remoteHaulers` konstant. Sterben Creeps, stellt er sofort eine Anfrage an den `RoomManager`.
3. **Infrastruktur-Planung:**
   - **Miner-Plattformen:** Miner werden so programmiert, dass sie direkt auf Containern stehen (Stationary Mining). Sie müssen sich nie bewegen.
   - **Edge-Links:** Sobald das `Office` RCL 5 erreicht, berechnet der RemoteManager die kürzeste Distanz zum Raumaustritt (Exit) in Richtung des Territories und setzt einen Link 2 Felder davon entfernt.

## Effizienz-Vorteil: Edge-Links
Normalerweise bricht die Effizienz von Remote-Mining ab 2 Räumen Distanz zusammen, weil Hauler zu lange unterwegs sind. Durch Edge-Links (Rand-Links) wird der Transport im Basisraum eliminiert. Der Hauler betritt den Basisraum, gibt an der Grenze ab und kehrt um. Ein Core-Link entlädt die Energie direkt ins Storage.

## Code Integration
Der RemoteManager wird exklusiv vom `Office` aufgerufen und erfordert keine manuelle Initialisierung im `main.js`.