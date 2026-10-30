"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function DemoDoCartao() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Relatório do mês</CardTitle>
        <CardDescription>Fechado em 30 de outubro.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground-2">O cartão é a peça opaca, levantada por sombra e sem contorno.</p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Abrir</Button>
      </CardFooter>
    </Card>
  )
}
