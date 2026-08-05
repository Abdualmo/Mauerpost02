# VacationPlanner Gold — Zusammenfassung

## Was ist die App

Eine elegante Urlaubsverwaltungs-App für kleine Firmen, komplett im Browser laufend, mit warmem Gold-Design (`#C8A96B`) auf beigem Hintergrund. Läuft entweder online (Weblink) oder komplett offline vom USB-Stick.

- **Web-Link (immer aktuell):** https://claude.ai/code/artifact/e6ed5a1c-d205-4e49-8572-b9c475736b77
- **GitHub-Branch:** `claude/vacationplanner-app-description-h3od1j`

## 🎯 Funktionen im Überblick

### Mitarbeiter

- Anlegen mit Name, Urlaubstage, Wochenstunden, Eintritts-/Geburtsdatum, Rolle, Probezeit, Arbeitszeitmodell (Vollzeit/Teilzeit/Minijob/Sonstige)
- Löschen per Wisch nach links + In-App-Bestätigung
- Archivieren (statt löschen) und jederzeit wiederherstellen

### Urlaub / Abwesenheit

- Eintragen per Kalender-Klick (1. Klick = Start, 2. Klick = Ende)
- Drei Arten: Urlaub (gold), Krankheit (rot), Betriebsurlaub (teal)
- Halbtagsurlaub — erster/letzter Tag als halber Tag, zählt als 0,5
- Klick auf belegten Tag: Notiz, einzelner Tag entfernen (splittet Zeitraum), oder komplett löschen

### Berechnungslogik

- Nur Mo–Fr zählen als Arbeitstage
- Feiertage (9 bundesweite) automatisch berechnet inkl. beweglicher (Ostern, Pfingsten…) — reduzieren nicht den Urlaubsanspruch
- Anteiliger Anspruch bei unterjährigem Eintritt (nur volle Monate, Halbtags-Rundung)
- Vorjahresrest automatisch übernommen, gilt bis 31.03., dann verfallen
- Q1-Urlaub wird zuerst gegen Übertrag verrechnet
- Negative Bilanz → komplette Zeile rot markiert
- Warnung ab 1.11. bei > 10 Resttagen, per Tap ausblendbar

### Ansichten

- Übersichtstabelle mit allen aktiven Mitarbeitern
- Detailseite pro Mitarbeiter mit 5 Übersichtskarten (Anspruch, Genommen, Verbleibend, Vorjahr, Krankheit) und 12-Monats-Kalender
- Probezeit-Notice oben auf der Startseite, wenn Probezeit in den nächsten 30 Tagen endet
- Geburtstag wird rosa mit 🎂 im Kalender markiert
- Betriebsurlaub jährlich wiederkehrend, Zeiträume über Jahreswechsel werden korrekt gesplittet

### Einstellungen

Modernes Modal mit vier Sektionen:

1. **Firma** — Name, Standard-Urlaubstage (Auto-Save)
2. **Wiederkehrender Betriebsurlaub** — Regeln editieren
3. **Daten & Speicher** — USB-Datei verbinden / Export / Import
4. **Gefahrenzone** — Alles zurücksetzen

## 💾 Datenspeicherung — deine drei Optionen

| Modus | Wie | Für wen |
|---|---|---|
| Nur Browser | Öffne Weblink, alles bleibt lokal in deinem Browser (localStorage) | Einfach, ein Gerät |
| USB-Stick + Auto-Save | HTML vom Stick öffnen → einmal Datei verbinden → Chrome/Edge speichert automatisch | Portabel, mehrere Rechner |
| USB-Stick + Export/Import | Nach Änderungen manuell exportieren, beim nächsten Start importieren | iPad/Safari, Firefox |

Keine Cloud, kein Server, kein Login. Deine Daten verlassen dein Gerät nie.

## 🐛 Behobene Bugs im Verlauf

- Login/Passwort-Chaos → kein Login mehr, App öffnet direkt
- Betriebsurlaub wurde nicht angezeigt → firmenweite Einträge korrekt gefiltert
- „Löschen"-Button im Bearbeiten-Dialog reagierte nicht → In-App-Bestätigung statt `confirm()` (das im iPad-Sandbox blockiert war)
- Einstellungen-Dialog abgeschnitten auf iPad → backdrop-blur-Bug im Header gefixt (Panel jetzt Geschwister statt Kind)
- Halbtag-Flags nicht gespeichert → im Storage-Layer nachgereicht

## ✅ Testabdeckung

137 automatisierte Playwright-Tests grün, verteilt auf 5 Suites:

- Grundfunktionen (21 Tests)
- Features v2 (12) — Prorata, Warnung, Löschen, Dialog
- Löschen-Flow (9)
- Features v4 (17) — Halbtag, Feiertage, Krank, Negativ, Archiv, Probezeit
- Einstellungen (44)
- Einstellungen-Viewport-Fix (35)

Getestet auf Desktop 1400×900, iPad Landscape/Portrait, iPhone, Mini-Handy 360×620.

## ⚖️ Rechtlicher Schutz beim Verkauf (Kurzfassung)

> Keine Rechtsberatung — für den echten Vertrag zum Fachanwalt für IT-Recht.

- Kein „Verkauf" — sondern zeitlich befristetes, einfaches, nicht übertragbares, nicht unterlizenzierbares Nutzungsrecht (max. 5 Jahre, umgeht Erschöpfungsgrundsatz)
- Vertragsstrafe 10.000–50.000 € pro Vorfall bei Verstoß
- NDA integriert, Nachwirkung 3–5 Jahre
- Kein Quellcode raus — nur die kompilierte, minifizierte HTML. Bei Bedarf Code-Escrow
- Wasserzeichen in jeder ausgelieferten Kopie (Kunden-ID identifiziert Herkunft bei Missbrauch)
- Markenschutz beim DPMA (~300 €) für Produktnamen/Logo
- Wartungsvertrag separat — bindet Kunde an dich, verhindert „ich habe alles gekauft"-Argument

## 🚀 Wo alles liegt

| Bereitstellung | Wie erreichen |
|---|---|
| Web-App | Link oben, im Browser bookmarken |
| USB-Stick | ZIP entpacken, `VacationPlanner.html` doppelklicken |
| Quellcode | GitHub-Repo, Branch `claude/vacationplanner-app-description-h3od1j` |
| Pull Request | https://github.com/Abdualmo/Mauerpost02/pull/2 |
| Backup-Datei | `vpg-daten.json` auf dem USB-Stick |

## 💡 Mögliche nächste Schritte, falls gewünscht

- Wasserzeichen-Injektor in den Build-Prozess einbauen (pro Kunde eindeutige Marker)
- Lizenzschlüssel-System mit optionaler Online-Aktivierung
- PDF-Export von Urlaubslisten pro Jahr/Mitarbeiter
- Kalenderwochen anzeigen
- Bundesland-spezifische Feiertage (aktuell: nur bundesweite 9)
- Mehrbenutzer-Version mit echtem Backend (Supabase) — falls gemeinsame Nutzung von mehreren Geräten gewünscht
- Code-Obfuscation für schwereren Nachbau vor Verkauf
