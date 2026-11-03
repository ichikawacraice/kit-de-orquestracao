import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const aqui = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    // Os mesmos aliases do tsconfig: `@/registry` é a fonte do registro.
    alias: [
      { find: /^@\/registry\//, replacement: aqui("../../packages/registro/registry/") },
      { find: /^@\//, replacement: aqui("./src/") },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/preparo.ts"],
  },
})
