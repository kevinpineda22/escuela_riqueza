// Detector de voseo / rioplatense en texto visible. Marca candidatos; se revisan a mano.
// Uso: node scripts/voseo-scan.mjs $(git ls-files "src/**/*.tsx" "src/**/*.ts")
// La interfaz le habla al usuario de TÚ (neutro): "Toca", "Puedes", "Haz clic", "aquí".
import fs from "node:fs";

// Formas agudas en -á/-é/-í que NO son voseo (tú/usted/3ª persona, adverbios, sustantivos).
const OK = new Set(`está más aquí allí ahí así será podrá habrá estará tendrá verá quizá sofá
mamá papá acá_ok café bebé además atrás jamás detrás través inglés francés interés también quién
según sí país maíz raíz perú ojalá allá después cortés portugués japonés alemán
hará irá dirá sabrá querrá saldrá vendrá pondrá cabrá valdrá hablará tú mí dé sé qué
cuál cómo dónde cuándo cuánto él aún rubí colibrí menú bambú champú vudú tabú marroquí
clic podrás estarás tendrás verás harás irás recibirás verás recibirá`.split(/\s+/));

// Palabras y giros rioplatenses sin tilde.
const WORDS = /(?<!\p{L})(vos|che|dale|laburo|laburar|copado|re\s+(?:bien|lindo|fácil)|celu|boludo|piola|chabón|pibe|mina|bondi|guita|fijate|acordate|asegurate|avisame|decime|contame|mandame|escribime|llamame|mostrame|dejame|pasame|sentate|quedate|olvidate|sumate|unite|registrate|anotate|conectate|suscribite|ingresá|ingresás|acá|recién|titila|titilan|agarrá|agarrar|ahorita)(?!\p{L})/giu;

// Candidatos agudos: imperativo voseante (-á/-é/-í) o presente voseante (-ás/-és/-ís).
const ACUTE = /(?<!\p{L})(\p{L}{3,}(?:á|é|í)s?)(?!\p{L})/giu;

let hits = 0;
for (const file of process.argv.slice(2)) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Solo líneas con texto de interfaz probable (no comentarios de código).
    if (/^(\/\/|\*|\/\*)/.test(trimmed)) return;
    const found = new Set();
    for (const m of line.matchAll(WORDS)) found.add(m[0]);
    for (const m of line.matchAll(ACUTE)) {
      const w = m[1].toLowerCase();
      if (OK.has(w)) continue;
      if (/(?:ará|erá|irá|arás|erás|irás)$/.test(w)) continue; // futuros
      if (/ón$|ión$/.test(w)) continue;
      found.add(m[1]);
    }
    if (found.size) {
      hits++;
      console.log(`${file}:${i + 1}  [${[...found].join(", ")}]  ${trimmed.slice(0, 150)}`);
    }
  });
}
console.log(`\n${hits} línea(s) candidata(s).`);
