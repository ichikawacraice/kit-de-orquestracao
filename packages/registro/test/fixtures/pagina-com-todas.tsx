"use client"

// A página do teste no Next vazio (scripts/num-next-vazio.mjs): usa toda peça
// do registro, com os caminhos que o `shadcn add` escreve no projeto.
import { PlusIcon } from "lucide-react"

import { Bloco } from "@/components/ui/bloco"
import { BlocoDeTinta, GrupoDeTinta, NotaDoBloco, TextoDoBloco } from "@/components/ui/bloco-de-tinta"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ComMotivo } from "@/components/ui/com-motivo"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DicaDeAjuda, rotuloSobre } from "@/components/ui/dica-de-ajuda"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConteudoDoMenu, GatilhoDoMenu, GrupoDoMenu, ItemDoMenu, Menu } from "@/components/ui/menu"
import { Painel, PainelDeSecao, RolagemDoPainel } from "@/components/ui/painel"
import { Secao, TopoDoPainel } from "@/components/ui/secao"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EsperaDaLista, Skeleton } from "@/components/ui/skeleton"
import { ToastProvider, useToast } from "@/components/ui/toast"
import { Ajuda } from "@/components/ui/tooltip"
import { COR_DO_TOM_DENSO } from "@/lib/idioma-de-cor"
import { cn } from "@/lib/utils"

function Conteudo() {
  const avisar = useToast()
  const [confirmacao, pedir] = useConfirm()
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <Bloco titulo="Formulário" acao={<Button size="sm">Ação</Button>}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" />
        </div>
        <Select>
          <SelectTrigger aria-label="Escolha">
            <SelectValue placeholder="Escolha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button onClick={async () => (await pedir({ titulo: "Excluir?", destrutivo: true })) && avisar({ titulo: "Excluído", tom: "ok" })}>
            <PlusIcon />
            Salvar
          </Button>
          <ComMotivo motivo="Falta o nome">
            <Button disabled>Publicar</Button>
          </ComMotivo>
          <Ajuda texto="Abre o histórico">
            <Button variant="ghost">Histórico</Button>
          </Ajuda>
          <DicaDeAjuda texto="Como o prazo conta" rotulo={rotuloSobre("Prazo")} />
          <Menu>
            <GatilhoDoMenu asChild>
              <Button variant="outline">Mais</Button>
            </GatilhoDoMenu>
            <ConteudoDoMenu>
              <GrupoDoMenu>
                <ItemDoMenu onEscolher={() => {}}>Duplicar</ItemDoMenu>
              </GrupoDoMenu>
            </ConteudoDoMenu>
          </Menu>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Abrir</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Título</DialogTitle>
                <DialogDescription>Descrição</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button>Ok</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Bloco>
      <Card>
        <CardHeader>
          <CardTitle>Cartão</CardTitle>
          <CardDescription>Descrição</CardDescription>
        </CardHeader>
        <CardContent>
          <Secao primeira titulo="Seção" contagem="2/3">
            <BlocoDeTinta tom="espera">
              <TextoDoBloco>Decisão sua.</TextoDoBloco>
              <NotaDoBloco>há 2 h</NotaDoBloco>
            </BlocoDeTinta>
          </Secao>
          <GrupoDeTinta tom="ruim" titulo="Falhas" contagem={1}>
            <p className={cn("text-xs", COR_DO_TOM_DENSO.ruim)}>Quebrou</p>
          </GrupoDeTinta>
        </CardContent>
      </Card>
      <Painel className="h-64">
        <TopoDoPainel titulo="Painel" />
        <RolagemDoPainel>
          <EsperaDaLista linhas={3} alturaDaLinha="h-10" rotulo="As linhas" />
          <Skeleton className="h-4" />
        </RolagemDoPainel>
      </Painel>
      <PainelDeSecao titulo="Em painel">conteúdo</PainelDeSecao>
      {confirmacao}
    </main>
  )
}

export default function Page() {
  return (
    <ToastProvider>
      <Conteudo />
    </ToastProvider>
  )
}
