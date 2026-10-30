"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogLateral,
  DialogLongo,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Amostra, Amostras } from "./_amostra"

const PARAGRAFOS = Array.from({ length: 12 }, (_, i) => `Cláusula ${i + 1}: o conteúdo longo rola entre o cabeçalho e o rodapé, que ficam parados.`)

export default function DemoDoDialogo() {
  return (
    <Amostras>
      <Amostra titulo="Curto" primeira>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Renomear</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renomear o relatório</DialogTitle>
              <DialogDescription>O nome novo aparece na lista para todo mundo.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="demo-dialogo-nome">Nome</Label>
              <Input id="demo-dialogo-nome" defaultValue="Relatório do mês" />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button>Salvar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Amostra>
      <Amostra titulo="Longo">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Ler os termos</Button>
          </DialogTrigger>
          <DialogLongo
            titulo="Termos do contrato"
            descricao="Versão de outubro."
            largura="sm:max-w-xl"
            rodape={
              <DialogClose asChild>
                <Button>Fechar</Button>
              </DialogClose>
            }
          >
            <div className="flex flex-col gap-3 px-5 py-4 text-sm text-foreground-2">
              {PARAGRAFOS.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </DialogLongo>
        </Dialog>
      </Amostra>
      <Amostra titulo="Lateral">
        <Dialog modal={false}>
          <DialogTrigger asChild>
            <Button variant="secondary">Ver detalhes</Button>
          </DialogTrigger>
          <DialogLateral titulo="Detalhes do pedido">
            <p className="text-sm text-foreground-2">A coluna lateral sob demanda, sem bloquear a tela.</p>
          </DialogLateral>
        </Dialog>
      </Amostra>
    </Amostras>
  )
}
