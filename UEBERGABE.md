# VacationPlanner Gold — Übergabedokumentation

*Stand: 2026-08-09 · Branch `claude/vacationplanner-app-description-h3od1j`*

Diese Datei ist die vollständige technische und funktionale Übergabe für eine
Person oder KI, die dieses Projekt ohne Vorwissen übernimmt. Sie beschreibt
**was** die App tut, **wie** sie aufgebaut ist, **welche Regeln unantastbar
sind** und **wie man sie baut, testet und ausliefert**.

---

## 1. Was ist das?

**VacationPlanner Gold** ist eine deutschsprachige Urlaubs- und
Abwesenheitsverwaltung für kleine Unternehmen. Zentrale Eigenschaften:

- **Komplett offline.** Kein Backend, kein Server, kein Login, keine Cloud.
- **Läuft im Browser** als einzelne HTML-Datei (`file://`) — auch vom USB-Stick.
- **Daten bleiben dauerhaft erhalten** (localStorage + optionale
  Datei-Synchronisierung auf den USB-Stick).
- **Erzeugt HTML-Jahresberichte** pro Mitarbeiter — eine einzelne, in sich
  geschlossene Datei zum Öffnen im Browser oder zum Herunterladen.

Das Endziel des Auftraggebers, wörtlich sinngemäß:

> USB-Stick rein → App starten → lokal nutzen → Daten speichern → App schließen
> → später wieder öffnen → alle Daten sind weiterhin da. Ohne Cloud, offline.

---

## 2. Tech-Stack

| Bereich        | Wahl                                                   |
|----------------|--------------------------------------------------------|
| UI             | React 18 (reines JSX, **kein** TypeScript)             |
| Build          | Vite 5                                                  |
| Styling        | Tailwind CSS                                            |
| Icons          | lucide-react                                            |
| Bericht        | HTML-Generator in `lib/htmlReport.js` (keine Abhängigkeit) |
| Datenspeicher  | localStorage (primär) + File System Access API (USB)   |
| State          | React Context (Auth, Data, Portable, Confirm) — kein Redux |
| Tests          | Playwright (nur Chromium verfügbar, kein WebKit)       |

---

## 3. Projektstruktur

```
src/
  main.jsx                      Einstiegspunkt
  App.jsx                       Routing (State-basiert: home ↔ detail, KEIN Router-Lib)
                                Provider-Reihenfolge:
                                Confirm → Auth → Data → (Shell mit Portable)
  index.css                     Tailwind + eigene Utilities/Farben

  lib/
    vacation.js   ★ HERZSTÜCK — die gesamte Geschäftslogik (siehe §5)
    storage.js      localStorage-Schicht, Keys, Soft-Delete/Papierkorb
    htmlReport.js   Jahresbericht als eigenständige HTML-Datei (öffnen/download)
    portable.js     File System Access API + IndexedDB-Handle + JSON Export/Import
    date.js         Datums-Helfer (fmtDate, todayISO)

  contexts/
    ConfirmContext.jsx   useConfirm() — In-App-Dialog statt window.confirm
    AuthContext.jsx      Firmen-Bootstrap, canManage=true immer, resetAll()
    DataContext.jsx      CRUD, archive/trash/purge
    PortableContext.jsx  USB-Sync-Status

  pages/
    HomePage.jsx           Übersicht, Suche, Filter, Archiv-/Papierkorb-Tabs
    EmployeeDetailPage.jsx Kalender, Bilanz, Einträge, Jahresbericht-Button

  components/vacation/
    AppHeader.jsx  EmployeeForm.jsx  EmployeeTable.jsx  SwipeableRow.jsx
    TimeOffForm.jsx  MonthCalendar.jsx  YearCalendar.jsx  SummaryCards.jsx
    EntryList.jsx  EntryActionDialog.jsx  UsedVacationPopover.jsx
    SettingsPanel.jsx

scripts/
  build-single.mjs     → dist/vpg-single.html            (Single-File-App)
  build-portable.mjs   → portable/VacationPlanner-Gold-USB.zip
```

---

## 4. Datenmodelle

**Company**
```
{ id, name, defaultVacationDays, recurringCompanyVacation[],
  address, contact, logo(dataURL), specialLeaveTypes[] }
```

**Employee**
```
{ id, companyId, fullName, firstName, lastName, personalNumber,
  department, yearlyVacationDays, weeklyHours, hireDate, terminationDate,
  contractStatus('unbefristet'|'befristet'), birthDate,
  probationStart, probationEnd, employmentType, role, userId,
  workDays[], archived, archivedAt, deletedAt }
```
`workDays` sind die Wochentage, an denen der Mitarbeiter tatsächlich arbeitet,
als **1 = Montag … 7 = Sonntag** (Standard `[1,2,3,4,5]`). Achtung: `getDay()`
aus date-fns liefert 0 für Sonntag — dafür gibt es `isoWeekday()` in
`vacation.js`. Altdatensätze ohne das Feld gelten als volle Woche Mo–Fr.

**Vacation** (`employeeId: null` = firmenweiter Eintrag, z. B. Betriebsurlaub)
```
{ id, companyId, employeeId, startDate, endDate,
  type, notes, reason, halfDayStart, halfDayEnd }
```
Typen: `urlaub` · `krankheit` · `betriebsurlaub` · `sonderurlaub`

**SpecialLeaveType**
```
{ id, label, days, active }
```

**localStorage-Keys** (alle unter Präfix `vpg.`):
`vpg.companies` · `vpg.employees` · `vpg.vacations` · `vpg.activeCompany` ·
`vpg.warningsAcked`

---

## 5. Geschäftslogik (`src/lib/vacation.js`) — das Herzstück

Diese Datei ist getestet und korrekt. **Nicht ohne Grund ändern.** Wichtigste
Funktionen:

- `easterSunday(year)` — Meeus/Butcher-Algorithmus.
- `getGermanHolidays(year)` — 9 bundesweite Feiertage, **berechnet, nicht
  hardcoded**.
- `isWorkday(dateISO)` — nur Mo–Fr und kein Feiertag.
- `isWorkdayForEmployee(dateISO, employee)` — zusätzlich gegen die
  individuellen `workDays` geprüft. **Anzeige und Berechnung benutzen beide
  diese Funktion** — nie eine der beiden separat umbauen.
- `countWorkdaysInYear(start, end, year, employee)`.
- Die Aggregate (`urlaubWorkdaysInYear`, `urlaubWorkdaysInQ1`,
  `sickWorkdaysInYear`, `sonderurlaubWorkdaysInYear`,
  `sonderurlaubUsageByReason`) nehmen das Mitarbeiter-**Objekt**, nicht nur
  die id. Das ist Absicht: ihr Ergebnis hängt von den Arbeitstagen ab, und ein
  optionaler Parameter wurde in der Praxis vergessen → stillschweigend zu hohe
  Werte.
- `proratedAnnual(...)` — anteiliger Jahresanspruch bei unterjährigem Eintritt
  (volle Monate, `Math.round`).
- `computeCarryover` / `isCarryoverAvailable` — Vorjahresrest, nutzbar bis 31.03.
- `shouldDeductCompanyVacation(...)` — Betriebsurlaub-Gate: nur abziehen, wenn
  Mitarbeiter zum Zeitpunkt beschäftigt ist (hireDate ≤ start UND kein/späteres
  terminationDate UND today ≥ start).
- `sonderurlaubWorkdaysInYear` / `sonderurlaubUsageByReason` — **getrennt
  erfasst**.
- `sickWorkdaysInYear`.
- `computeYearStats(...)` — zentrale Aggregation. Liefert u. a.:
  `annual, annualFull, prorated, carryoverTotal, carryoverAvailable,
  carryoverRemaining, usedTotal, usedUrlaub, usedCompany, usedAgainstAnnual,
  remaining (kann negativ sein), sickTotal, sonderurlaubTotal, negative`.
- `materializeRecurring(...)` — wiederkehrende Regeln (MM-DD) → Jahres-Einträge,
  inkl. Jahreswechsel-Split.
- `halfDayAdjustment` / `isHalfDayFor` — Halbtage.
- `isProbationEndingSoon`, `shouldWarnHighCarryover` (>10 Tage ab 1.11.),
  `isPastTermination`, `crossesTermination`.

---

## 6. Unantastbare Regeln (vom Auftraggeber mehrfach betont)

1. **Sonderurlaub und Krankheit werden NIE vom normalen Urlaubsanspruch
   abgezogen.** Sie werden getrennt gezählt.
2. **Deutsche Feiertage werden berechnet, nicht hardcoded.**
3. **Der Jahresbericht ist HTML, nicht PDF** (Stand 08/2026 vom Auftraggeber
   so entschieden; die frühere jsPDF-Variante wurde ersatzlos entfernt).
   `lib/htmlReport.js` erzeugt eine vollständig eigenständige Datei: eigenes
   `<style>`, **keine** externen Fonts/Skripte/Bilder, damit sie offline und
   vom USB-Stick funktioniert. Bericht und Bildschirm müssen dieselben
   Funktionen aus `vacation.js` benutzen, damit die Zahlen nicht auseinander
   laufen. Wer daran etwas ändert, prüft beides.
4. **Download läuft über Blob + unsichtbaren `<a download>`** — kein
   `window.open` (das brach seinerzeit iOS). Nur der Weg »Im Browser öffnen«
   benutzt `window.open` und muss deshalb **synchron im Klick-Handler**
   bleiben, sonst greift der Popup-Blocker.
5. **Kein `window.confirm`** — stattdessen `useConfirm()` aus dem
   ConfirmContext (natives confirm wird in Sandboxes blockiert).
6. **Modals als Sibling des Headers rendern** (React Fragment). `backdrop-blur`
   auf `<header>` erzeugt sonst einen Containing-Block, der `position:fixed`
   im Modal auf den Header-Streifen begrenzt.
7. **Gold-Design beibehalten:** Farben #F5F0E8 (Hintergrund), #C8A96B (Gold),
   #5E9EA0 (Teal), #D64545 (Rot).
8. **Keine deutschen Anführungszeichen „…" in JS-Strings** — sie brechen den
   Single-File-Build. Guillemets »…« verwenden.
9. **Komplett offline** — kein Login, kein Backend.

---

## 7. Bauen, Testen, Ausliefern

**Setup**
```bash
npm install
```

**Entwicklung**
```bash
npm run dev          # Vite-Dev-Server
```

**Single-File-HTML** (alles inline — CSS+JS in einer Datei)
```bash
npm run build                     # normaler Vite-Build nach dist/
node scripts/build-single.mjs     # → dist/vpg-single.html
```
`dist/vpg-single.html` per Doppelklick (`file://`) im Browser öffnen.
localStorage funktioniert unter `file://` in Chrome/Edge/Firefox.

**USB-/Portable-ZIP**
```bash
node scripts/build-portable.mjs   # → portable/VacationPlanner-Gold-USB.zip
```
Die ZIP enthält `VacationPlanner.html` (Single-File-App), `vpg-daten.json`
(Datenablage) und `README.txt`. Nutzer entpackt auf USB, doppelklickt die HTML.

**Tests (Playwright, Chromium)**
Die Test-Skripte liegen im Scratchpad und sind **nicht** im Repo committet.
Sie laufen gegen `dist/vpg-single.html` bzw. `portable/VacationPlanner.html`
per `file://` mit dem vorinstallierten Chromium
(`/opt/pw-browsers/chromium-*/chrome-linux/chrome`). **Kein WebKit verfügbar** —
iOS ist nur per User-Agent-Spoofing simulierbar, nicht echt testbar.

---

## 8. Datenpersistenz & USB-Portabilität — der wichtige Vorbehalt

- **localStorage** ist der primäre Speicher. Daten bleiben **pro Browser/Gerät**
  erhalten — sie wandern **nicht** automatisch mit der HTML-Datei auf dem Stick.
- **File System Access API** (`showSaveFilePicker`/`showOpenFilePicker`, in
  `portable.js`) erlaubt echtes Schreiben in eine Datei auf dem Stick —
  **aber nur in Chromium (Chrome/Edge)** und **nur nach einmaliger
  Ordner-/Datei-Freigabe** durch den Nutzer. Das Datei-Handle wird in IndexedDB
  persistiert.
- **Fallback:** manueller JSON-Export/-Import.

**Zentrale offene Spannung:** Ein rein file://-basierter „Ordner, der beim
Doppelklick völlig ohne Nutzeraktion automatisch in dieselbe USB-Datei
schreibt" ist mit Browser-Sicherheit **nicht** möglich. Wenn der Auftraggeber
genau das (null Nutzeraktion, jeder Browser) verlangt, ist der saubere Weg eine
echte Desktop-App via **Electron oder Tauri** — das vorher mit dem Nutzer
klären, nicht eigenmächtig umbauen.

---

## 9. Bekannte, bereits behobene Fehler (nicht erneut einführen)

| Problem | Ursache | Fix |
|---|---|---|
| Download bricht auf iOS | zusätzliches `window.open()` nach dem `<a download>`-Klick zählt nicht mehr als User-Geste | `window.open` aus dem Download-Pfad entfernt, nur Blob + `<a download>` |
| Betriebsurlaub fehlte pro Mitarbeiter | firmenweite Einträge (employeeId=null) herausgefiltert | `collectYearEntries` schließt sie ein |
| Halbtage gingen verloren | `createVacation` reichte Flags nicht durch | `halfDayStart/halfDayEnd/reason` ergänzt |
| Single-File-Build brach | Vite-Code-Splitting | `inlineDynamicImports: true` |
| Modal nur im Header sichtbar | `backdrop-blur` auf Header → Containing-Block | Modal als Sibling rendern |
| Build brach an Strings | deutsche „…" Anführungszeichen | Guillemets »…« |

---

## 10. Offene Punkte / mögliche nächste Schritte

- **Echter iOS-Gerätetest** durch den Nutzer steht aus (Sandbox hat kein echtes
  WebKit). Falls der Nutzer Download-Probleme auf echtem iPhone/iPad meldet:
  zuerst dort ansetzen.
- **»Bericht drucken«-Button** ist in `EmployeeDetailPage.jsx` noch vorhanden.
  Der Nutzer hat mehrfach gesagt, Print sei nicht nötig. Entfernen wäre
  konsistent, ist aber **noch nicht ausdrücklich beauftragt** — vor dem Löschen
  kurz mit dem Nutzer abstimmen (der Button funktioniert aktuell).
- **Echte USB-Portabilität ohne Nutzeraktion** → ggf. Electron/Tauri (siehe §8).

---

## 11. Startanleitung für die neue KI

1. `git log` prüfen (Branch `claude/vacationplanner-app-description-h3od1j`).
2. `npm install`, dann `npm run build && node scripts/build-single.mjs`.
3. `dist/vpg-single.html` im Browser öffnen und durchklicken.
4. Zuerst lesen: `src/lib/vacation.js` (Logik), `src/lib/storage.js`
   (Persistenz), `src/lib/htmlReport.js` (Bericht), `src/pages/EmployeeDetailPage.jsx`.
5. **Regeln aus §6 respektieren.** Berechnungslogik in `vacation.js` und die
   Berichts-Implementierung nur mit gutem Grund anfassen.
