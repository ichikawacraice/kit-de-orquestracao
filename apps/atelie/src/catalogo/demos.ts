// A demonstração viva de cada item do registro, pelo nome do item. Toda
// entrada do registry.json precisa de uma aqui, e só elas: test/catalogo.test.tsx
// cruza as duas listas. Bloco de tela novo no registro entra com a dele.
import type { ComponentType } from "react"

import AntesDoDesenho from "./demos/antes-do-desenho"
import Bloco from "./demos/bloco"
import BlocoDeTinta from "./demos/bloco-de-tinta"
import Button from "./demos/button"
import Card from "./demos/card"
import Casco from "./demos/casco"
import ChipDeEstado from "./demos/chip-de-estado"
import ComMotivo from "./demos/com-motivo"
import ConfirmDialog from "./demos/confirm-dialog"
import Dialog from "./demos/dialog"
import DicaDeAjuda from "./demos/dica-de-ajuda"
import Entrada from "./demos/entrada"
import Estado from "./demos/estado"
import Estilo from "./demos/estilo"
import Ficha from "./demos/ficha"
import IdiomaDeCor from "./demos/idioma-de-cor"
import Input from "./demos/input"
import Label from "./demos/label"
import LinkDoApp from "./demos/link-do-app"
import Lista from "./demos/lista"
import Logotipo from "./demos/logotipo"
import MedalhaoDoIcone from "./demos/medalhao-do-icone"
import Menu from "./demos/menu"
import MenuDaConta from "./demos/menu-da-conta"
import MenuDoTema from "./demos/menu-do-tema"
import Mesa from "./demos/mesa"
import Painel from "./demos/painel"
import Secao from "./demos/secao"
import Select from "./demos/select"
import SeletorDeVista from "./demos/seletor-de-vista"
import Skeleton from "./demos/skeleton"
import Table from "./demos/table"
import TelaDeErro from "./demos/tela-de-erro"
import Toast from "./demos/toast"
import Tooltip from "./demos/tooltip"
import TopoDaPagina from "./demos/topo-da-pagina"
import Trilha from "./demos/trilha"
import TrilhoDoPercurso from "./demos/trilho-do-percurso"
import Vazio from "./demos/vazio"

export const DEMOS: Record<string, ComponentType> = {
  "antes-do-desenho": AntesDoDesenho,
  "bloco": Bloco,
  "bloco-de-tinta": BlocoDeTinta,
  "button": Button,
  "card": Card,
  "casco": Casco,
  "chip-de-estado": ChipDeEstado,
  "com-motivo": ComMotivo,
  "confirm-dialog": ConfirmDialog,
  "dialog": Dialog,
  "dica-de-ajuda": DicaDeAjuda,
  "entrada": Entrada,
  "estado": Estado,
  "estilo": Estilo,
  "ficha": Ficha,
  "idioma-de-cor": IdiomaDeCor,
  "input": Input,
  "label": Label,
  "link-do-app": LinkDoApp,
  "lista": Lista,
  "logotipo": Logotipo,
  "medalhao-do-icone": MedalhaoDoIcone,
  "menu": Menu,
  "menu-da-conta": MenuDaConta,
  "menu-do-tema": MenuDoTema,
  "mesa": Mesa,
  "painel": Painel,
  "secao": Secao,
  "select": Select,
  "seletor-de-vista": SeletorDeVista,
  "skeleton": Skeleton,
  "table": Table,
  "tela-de-erro": TelaDeErro,
  "toast": Toast,
  "tooltip": Tooltip,
  "topo-da-pagina": TopoDaPagina,
  "trilha": Trilha,
  "trilho-do-percurso": TrilhoDoPercurso,
  "vazio": Vazio,
}
