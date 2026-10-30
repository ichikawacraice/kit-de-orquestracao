// A demonstração viva de cada item do registro, pelo nome do item. Toda
// entrada do registry.json precisa de uma aqui, e só elas: test/catalogo.test.tsx
// cruza as duas listas. Bloco de tela novo no registro entra com a dele.
import type { ComponentType } from "react"

import BlocoDeTinta from "./demos/bloco-de-tinta"
import Bloco from "./demos/bloco"
import Button from "./demos/button"
import Card from "./demos/card"
import ComMotivo from "./demos/com-motivo"
import ConfirmDialog from "./demos/confirm-dialog"
import Dialog from "./demos/dialog"
import DicaDeAjuda from "./demos/dica-de-ajuda"
import Estilo from "./demos/estilo"
import IdiomaDeCor from "./demos/idioma-de-cor"
import Input from "./demos/input"
import Label from "./demos/label"
import Menu from "./demos/menu"
import Painel from "./demos/painel"
import Secao from "./demos/secao"
import Select from "./demos/select"
import Skeleton from "./demos/skeleton"
import Toast from "./demos/toast"
import Tooltip from "./demos/tooltip"

export const DEMOS: Record<string, ComponentType> = {
  "bloco-de-tinta": BlocoDeTinta,
  "bloco": Bloco,
  "button": Button,
  "card": Card,
  "com-motivo": ComMotivo,
  "confirm-dialog": ConfirmDialog,
  "dialog": Dialog,
  "dica-de-ajuda": DicaDeAjuda,
  "estilo": Estilo,
  "idioma-de-cor": IdiomaDeCor,
  "input": Input,
  "label": Label,
  "menu": Menu,
  "painel": Painel,
  "secao": Secao,
  "select": Select,
  "skeleton": Skeleton,
  "toast": Toast,
  "tooltip": Tooltip,
}
