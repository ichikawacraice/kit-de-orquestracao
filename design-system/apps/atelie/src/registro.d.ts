// Os módulos em JavaScript do pacote do registro, para o TypeScript do ateliê.
declare module "@wicomm/registro/lib/registro.mjs" {
  export const VERSAO: string
  export function registro(): { items: { name: string; type: string }[] }
}
