// A paleta fixa das vozes (COR-01) como o kit a pinta: os valores do Tailwind
// INSTALADO (v4, em oklch), convertidos para hex para a conta de contraste. Lida
// do theme.css do pacote no build, para a vitrine medir a cor que a peça pinta.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

const exigir = createRequire(join(process.cwd(), "package.json"))

/** oklch (L em %, C, H em graus) → sRGB hex, com o recorte de gama. */
export function oklchParaHex(l: number, c: number, h: number): string {
  const [L, a, b] = [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)]
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  const gama = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
  return "#" + lin.map((x) => Math.round(Math.min(1, Math.max(0, gama(x))) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()
}

let cache: Record<string, string> | null = null

/** `emerald-700` → `#…`, para as quatro famílias das vozes. */
export function paleta(): Record<string, string> {
  if (cache) return cache
  const css = readFileSync(exigir.resolve("tailwindcss/theme.css"), "utf8")
  cache = {}
  for (const m of css.matchAll(/--color-(emerald|amber|rose|violet)-(\d+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/g))
    cache[`${m[1]}-${m[2]}`] = oklchParaHex(Number(m[3]) / 100, Number(m[4]), Number(m[5]))
  if (Object.keys(cache).length < 40) throw new Error("a paleta do Tailwind não foi lida do theme.css")
  return cache
}
