// Codemod de tema: reemplaza clases de la paleta oscura por roles semánticos
// cuyo valor OSCURO es idéntico. Lo que no tiene equivalente exacto se reporta.
// Uso: node scripts/theme-codemod.mjs . <archivo...>   (--dry para no escribir)
// Reglas y criterio: docs/MODO_CLARO_ESPECIFICACION.md. Después de correrlo, revisar
// a mano la lista "revisar" y todo lo que quede SOBRE oro o media (debe seguir blanco).
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const [root, ...files] = args.filter((a) => a !== "--dry");

const LADDER = new Set(["90", "85", "80", "70", "65", "60", "55", "50", "40", "30", "25", "20", "15"]);
const B = String.raw`(?<=^|[\s"'\x60:!{(\[,])`; // inicio de utilidad (tras variante o separador)
const E = String.raw`(?![\w/.\-\[])`; // fin de utilidad sin modificador

const rules = [
  // Texto dorado degradado (oro → amber-100 → oro) ⇒ tokens gilt, idénticos en oscuro.
  [/from-(?:brand|gold) via-amber-100 to-(?:brand-hover|goldHover)/g, () => "from-gilt-start via-gilt-mid to-gilt-end"],
  // Texto translúcido → escalera fg-N (ink/N compuesto no alcanza contraste en claro).
  [new RegExp(`${B}text-white/(\\d+)${E}`, "g"), (m, n) => (LADDER.has(n) ? `text-fg-${n}` : m)],
  [new RegExp(`${B}text-white${E}`, "g"), () => "text-foreground-strong"],
  [new RegExp(`${B}border-white/10${E}`, "g"), () => "border-line-subtle"],
  [new RegExp(`${B}(bg|border|divide|ring|outline|shadow|fill|stroke)-white/(\\d+)${E}`, "g"), (_m, u, n) => `${u}-ink/${n}`],
  [new RegExp(`${B}text-textMuted(/\\d+)?${E}`, "g"), (_m, a = "") => `text-foreground-muted${a}`],
  [new RegExp(`${B}text-textMain(/\\d+)?${E}`, "g"), (_m, a = "") => `text-foreground${a}`],
  [new RegExp(`${B}(text|fill|stroke|caret|decoration)-goldHover${E}`, "g"), (_m, u) => `${u}-accent-hover`],
  [new RegExp(`${B}(text|fill|stroke|caret|decoration)-gold(/\\d+)?${E}`, "g"), (_m, u, a = "") => `${u}-accent${a}`],
  [new RegExp(`${B}(bg|from|via|to)-goldHover(/\\d+)?${E}`, "g"), (_m, u, a = "") => `${u}-brand-hover${a}`],
  // Opacidades arbitrarias de tintes/bordes: white/[0.04] ⇒ ink/[0.04] (idéntico en oscuro).
  [new RegExp(`${B}(bg|border|divide)-white/(\\[[\\d.]+\\])`, "g"), (_m, u, a) => `${u}-ink/${a}`],
  [new RegExp(`${B}(bg|from|via|to|shadow)-gold(/\\d+)?${E}`, "g"), (_m, u, a = "") => `${u}-brand${a}`],
  // Borde oro sólido = funcional (foco/selección) → acento legible; translúcido = decorativo → marca.
  [new RegExp(`${B}border-gold${E}`, "g"), () => "border-accent"],
  [new RegExp(`${B}border-gold/(\\d+)${E}`, "g"), (_m, n) => `border-brand/${n}`],
  // Texto de estado *-400 ⇒ familia semántica (mismo valor oklch en oscuro; legible en claro).
  [new RegExp(`${B}text-red-400${E}`, "g"), () => "text-danger"],
  [new RegExp(`${B}text-amber-400${E}`, "g"), () => "text-warning"],
  [new RegExp(`${B}text-sky-400${E}`, "g"), () => "text-info"],
  [new RegExp(`${B}text-emerald-400${E}`, "g"), () => "text-success"],
  [new RegExp(`${B}text-purple-400${E}`, "g"), () => "text-violet"],
  [new RegExp(`${B}ring-gold(/\\d+)?${E}`, "g"), (_m, a = "") => `ring-focus${a}`],
  [new RegExp(`${B}ring-offset-darker${E}`, "g"), () => "ring-offset-surface-page"],
  [new RegExp(`${B}text-darker${E}`, "g"), () => "text-on-brand"],
  [new RegExp(`${B}(bg|from|via|to|border)-darker(/\\d+)?${E}`, "g"), (_m, u, a = "") => `${u}-surface-page${a}`],
  [new RegExp(`${B}(bg|from|via|to|border)-dark(/\\d+)?${E}`, "g"), (_m, u, a = "") => `${u}-surface-panel${a}`],
];

// Lo que queda sin tocar y requiere decisión humana.
// Gradientes blancos NO se convierten: sobre oro/imagen deben seguir blancos.
const leftovers = /(?:text|bg|border|ring|from|via|to|shadow|divide)-(?:white|black|gold|darker|dark)(?:\/[\d.[\]]+)?(?![\w-])|#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])|rgba?\([^)]*\)|oklch\([^)]*\)|\[color-scheme:[a-z]+\]/g;

let total = 0;
for (const rel of files) {
  const file = path.resolve(root, rel);
  const before = fs.readFileSync(file, "utf8");
  let after = before;
  let count = 0;
  for (const [re, fn] of rules) {
    after = after.replace(re, (...m) => {
      const out = fn(...m);
      if (out !== m[0]) count++;
      return out;
    });
  }
  total += count;
  const left = [...new Set(after.match(leftovers) ?? [])];
  console.log(`\n${rel}: ${count} reemplazos`);
  if (left.length) console.log(`  revisar: ${left.join("  ")}`);
  if (!dry && after !== before) fs.writeFileSync(file, after);
}
console.log(`\nTotal: ${total}`);
