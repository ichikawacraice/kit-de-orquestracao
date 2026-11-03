import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

// Site estático: `next build` grava tudo em `out/`, junto com o registro que o
// `scripts/registro.mjs` deixou em `public/r/v{versao}/`.
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  // O indicador do dev cairia dentro de cada palco.
  devIndicators: false,
  // As peças vêm da fonte do registro (packages/registro), fora desta pasta.
  turbopack: { root: fileURLToPath(new URL("../..", import.meta.url)) },
}

export default config
