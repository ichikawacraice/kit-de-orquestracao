export function useConfirm(): [null, (opcoes: { titulo: string; confirmar: string }) => Promise<boolean>] {
  return [null, async () => true]
}
