import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // O caminho que o registro usa nas importações entre peças; o `shadcn add`
    // o reescreve para os aliases do projeto que instala.
    alias: { "@/registry": fileURLToPath(new URL("./registry", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/preparo.ts"],
  },
})
