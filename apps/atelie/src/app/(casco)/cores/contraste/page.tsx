import { Bloco } from "@/components/ui/bloco"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AbasDasCores } from "@/components/vitrine/abas-das-cores"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { AmostraDeRazao } from "@/components/vitrine/razao"
import { LinkDaRegra } from "@/components/vitrine/regra"
import { FUNDOS, LINHAS_DA_MATRIZ, PARES } from "@/vitrine/cores"
import { razao, valor, type Tema } from "@/vitrine/tokens"

export const metadata = { title: "Contraste" }

const TEMAS: { id: Tema; titulo: string }[] = [
  { id: "claro", titulo: "Claro" },
  { id: "escuro", titulo: "Escuro" },
]

const piso = (p: number) => `${String(p).replace(".", ",")}:1`

function Matriz({ tema }: { tema: Tema }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="t-coluna">{tema === "claro" ? "Claro" : "Escuro"}</figcaption>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tinta</TableHead>
            {FUNDOS.map((f) => (
              <TableHead key={f}>{f.slice(2)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {LINHAS_DA_MATRIZ.map((l) => (
            <TableRow key={l.id}>
              <TableCell>
                <span className="flex flex-col">
                  <span className="t-medida text-foreground">{l.rotulo}</span>
                  <span className="text-legenda text-muted-foreground">
                    piso {piso(l.piso)} · <LinkDaRegra codigo={l.regra} />
                  </span>
                </span>
              </TableCell>
              {FUNDOS.map((f) => {
                const [frente, fundo] = [l.cor(tema).toUpperCase(), valor(f, tema)]
                return (
                  <TableCell key={f}>
                    <AmostraDeRazao frente={frente} fundo={fundo} razao={razao(frente, fundo)} piso={l.piso} contorno={l.contorno} />
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </figure>
  )
}

export default function Contraste() {
  return (
    <PaginaDaVitrine
      titulo="Cores"
      filtros={<AbasDasCores atual="contraste" />}
      abertura="Posso escrever esta tinta sobre este fundo? Cada número está escrito na própria tinta, sobre o próprio fundo, e vem da mesma conta que o teste dos tokens usa. Só o que fica abaixo do piso ganha aviso."
    >
      <Bloco nome="matriz" titulo="Tinta sobre os quatro fundos" legenda="O texto pode cair em qualquer um deles." className="flex flex-col gap-6">
        {TEMAS.map((t) => (
          <Matriz key={t.id} tema={t.id} />
        ))}
      </Bloco>
      <Bloco nome="pares" titulo="Os pares das peças" legenda="O que a marca, o carimbo, o terminal e a IA pagam.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Par</TableHead>
              <TableHead>Piso</TableHead>
              {TEMAS.map((t) => (
                <TableHead key={t.id}>{t.titulo}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PARES.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-foreground">{p.descricao}</span>
                    <span className="text-legenda text-muted-foreground">
                      {p.regra ? <LinkDaRegra codigo={p.regra} /> : "cobrado pelo teste dos tokens, sem regra na base"}
                      {p.nota ? ` · ${p.nota}` : null}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="t-medida">{p.piso === null ? "registro" : piso(p.piso)}</TableCell>
                {TEMAS.map((t) => {
                  const m = p.medir(t.id)
                  return (
                    <TableCell key={t.id}>
                      <AmostraDeRazao frente={m.frente} fundo={m.fundo} razao={m.razao} piso={p.piso} />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Bloco>
    </PaginaDaVitrine>
  )
}
