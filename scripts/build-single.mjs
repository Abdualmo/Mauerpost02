import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const assetsDir = join(dist, "assets");
const files = readdirSync(assetsDir);
const cssFile = files.find((f) => f.endsWith(".css"));
const jsFile = files.find((f) => f.endsWith(".js"));

if (!cssFile || !jsFile) {
  console.error("Could not find CSS or JS asset in dist/assets");
  process.exit(1);
}

const css = readFileSync(join(assetsDir, cssFile), "utf8");
const js = readFileSync(join(assetsDir, jsFile), "utf8");
const html = readFileSync(join(dist, "index.html"), "utf8");

// Read from the vite index.html body content (root div) — we'll rebuild the shell for the artifact:
//   Artifacts inject the boilerplate wrapper. We just write the <title>, <style>, <div id="root">, <script>.
const out = `<title>VacationPlanner Gold</title>
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;

writeFileSync("dist/vpg-single.html", out);
console.log("wrote dist/vpg-single.html", out.length, "bytes");
