function BarraDoEditor({ voltar, nome }: { voltar: string; nome: string }) {
  return (
    <div data-superficie className="superficie flex h-11 items-center gap-3 rounded-2xl px-2">
      <a href={voltar} aria-label="Voltar aos documentos">
        ←
      </a>
      <h1 className="t-titulo">{nome}</h1>
    </div>
  )
}

export { BarraDoEditor }
