// Auditoría de modo claro: marca strings de clases con un fondo OSCURO FIJO que
// no tienen override `light:` para esa misma propiedad. Distingue "oscuro y ya
// tratado" de "oscuro y olvidado" (así se escapó la base radial del 404).
// Uso: node scripts/theme-audit.mjs <archivo...>
// Las islas intencionales (data-theme="dark", media) se revisan a mano: el
// script no sabe si un elemento está dentro de una.
import fs from "node:fs";

// Fondos oscuros fijos que en claro quedarían como manchas negras.
const DARK_BG = [
  /(?<![\w:-])bg-\[#(?:0|1)[0-9a-f]{5}\]/i, // bg-[#050505]
  /(?<![\w:-])bg-\[(?:radial|linear)-gradient\([^\]]*#(?:0|1)[0-9a-f]{5}/i, // radial con base oscura
  /(?<![\w:-])bg-black(?:\/\d+)?(?![\w-])/, // bg-black/40 (inputs, overlays)
  /(?<![\w:-])from-\[#(?:0|1)[0-9a-f]{5}\]/i, // gradientes oscuros
  /(?<![\w:-])shadow-\[[^\]]*rgba\(0,0,0,0\.[5-9]/, // sombras negras pesadas
];
const HAS_LIGHT = {
  bg: /light:(?:bg|from)-/,
  shadow: /light:shadow-/,
};

let total = 0;
for (const file of process.argv.slice(2)) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    // Cada literal de clases de la línea ("…", '…' o `…`).
    for (const [, cls] of line.matchAll(/["'`]([^"'`]*(?:bg-|shadow-)[^"'`]*)["'`]/g)) {
      for (const re of DARK_BG) {
        const hit = cls.match(re);
        if (!hit) continue;
        const need = hit[0].startsWith("shadow") ? HAS_LIGHT.shadow : HAS_LIGHT.bg;
        if (need.test(cls)) continue;
        total++;
        console.log(`${file}:${i + 1}  ${hit[0].slice(0, 70)}`);
      }
    }
  });
}
console.log(`\n${total} fondo(s) oscuro(s) sin override claro.`);
process.exitCode = total ? 1 : 0;
