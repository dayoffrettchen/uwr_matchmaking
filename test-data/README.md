# Testdaten-Import

`uwr-30-spieler-import.json` ist ein vollständiger JSON-Export für die Importfunktion unter **Einstellungen → JSON importieren**.

Achtung: Der JSON-Import ersetzt die aktuellen App-Daten, weil er wie ein normaler Export alle Tabellen enthält.

## Enthaltene Daten

- 1 offenes Testtraining: `Testtraining 30 Spieler`.
- 30 angemeldete Spieler aus der bereinigten Namensliste.
- Für jeden Spieler sind alle drei Positionen (`goalkeeper`, `defender`, `forward`) spielberechtigt.
- Jeder Spieler ist für das Testtraining angemeldet und hat eine passende `bin da`-Nachricht.

## Umrechnung der initialen Stärke

| Marker | `skillRating` | Positionsrating |
| --- | ---: | ---: |
| `+++` | 8 | 1300 |
| `++` | 7 | 1200 |
| `+` | 6 | 1100 |
| `0` oder kein Marker | 5 | 1000 |
| `-` | 4 | 900 |
| `--` | 3 | 800 |

`Friedi` hatte keinen Marker in der gelieferten Liste und ist deshalb neutral wie `0` eingestuft.
