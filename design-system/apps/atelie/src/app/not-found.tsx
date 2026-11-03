import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NaoEncontrada() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8">
      <h1 className="t-display">Esta página não existe no ateliê</h1>
      <Button asChild variant="link">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  )
}
