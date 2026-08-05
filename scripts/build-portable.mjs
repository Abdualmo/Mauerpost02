import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const outDir = "portable";
try {
  rmSync(outDir, { recursive: true, force: true });
} catch {
  /* ignore */
}
mkdirSync(outDir, { recursive: true });

// Build a single HTML with everything inlined
const dist = "dist";
const assetsDir = join(dist, "assets");
const files = readdirSync(assetsDir);
const cssFile = files.find((f) => f.endsWith(".css"));
const jsFile = files.find((f) => f.endsWith(".js"));

if (!cssFile || !jsFile) {
  console.error("Run `npm run build` first — no dist assets found.");
  process.exit(1);
}

const css = readFileSync(join(assetsDir, cssFile), "utf8");
const js = readFileSync(join(assetsDir, jsFile), "utf8");

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>VacationPlanner Gold</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${js}</script>
</body>
</html>
`;

writeFileSync(join(outDir, "VacationPlanner.html"), html);

// Starter data file
writeFileSync(
  join(outDir, "vpg-daten.json"),
  JSON.stringify(
    {
      version: 1,
      exportedAt: null,
      activeCompanyId: null,
      companies: [],
      employees: [],
      vacations: [],
    },
    null,
    2,
  ),
);

// README
const readme = `VacationPlanner Gold — USB-Ausgabe
====================================

So benutzt du die App vom USB-Stick:

1. Kopiere diesen Ordner (mit allen Dateien) auf deinen USB-Stick.
2. Stecke den USB-Stick in einen Rechner.
3. Doppelklicke "VacationPlanner.html" — die App öffnet sich in
   deinem Standard-Browser.

Empfehlung: Chrome, Edge oder Opera (dann funktioniert das
Auto-Speichern in die Datei).

Beim ersten Start:
------------------
Oben in der App erscheint ein Hinweis "Von USB-Stick nutzen?".
Klicke dort auf "Datei öffnen" und wähle die Datei "vpg-daten.json"
aus diesem Ordner. Ab da wird jede Änderung automatisch dorthin
gespeichert — deine Daten wandern mit dem Stick.

Wichtige Hinweise:
------------------
* Nimm den Stick nur heraus, wenn du gerade nichts änderst
  (im Header steht dann "Gespeichert").
* Wenn dein Browser kein Auto-Speichern kann (z. B. Firefox),
  nutze in den Einstellungen "Exportieren" und "Importieren" —
  funktioniert überall.
* Backups: exportiere die Datei ab und zu und lege sie
  zusätzlich an einem sicheren Ort ab.
* Der Ordner enthält keine persönlichen Daten aus dem Netz —
  alles läuft rein lokal in deinem Browser.
`;
writeFileSync(join(outDir, "README.txt"), readme);

// Zip it
const zipPath = "portable/VacationPlanner-Gold-USB.zip";
try {
  rmSync(zipPath, { force: true });
} catch {
  /* ignore */
}
execSync(
  `cd portable && zip -q VacationPlanner-Gold-USB.zip VacationPlanner.html vpg-daten.json README.txt`,
);

console.log("Portable package ready in:", outDir);
console.log("Files:");
readdirSync(outDir).forEach((f) => console.log("  -", f));
