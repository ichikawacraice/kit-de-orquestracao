import * as React from "react"

/**
 * O que precisa rodar ANTES do primeiro desenho, para a tela nascer certa: o
 * tema guardado (a classe `.dark`) e a barra recolhida (a marca
 * `data-barra-recolhida`), os dois no `<html>`.
 *
 * Vai UMA vez, no lugar que não se redesenha na navegação:
 * - no Next, o `<head>` do layout raiz: `<ScriptsAntesDoDesenho />`;
 * - no Vite, o `index.html`, com `CODIGO_ANTES_DO_DESENHO` num `<script>`.
 *
 * Nunca dentro de um componente que o cliente desenha: lá o React não executa
 * `<script>`. O `<html>` leva `suppressHydrationWarning`, porque a classe e a
 * marca não vêm do servidor.
 */
const CHAVE_DO_TEMA = "wicomm-tema"
const CHAVE_DA_BARRA = "wicomm-barra"
const ESCURO = "(prefers-color-scheme: dark)"

const CODIGO_ANTES_DO_DESENHO = `try{var h=document.documentElement,t=localStorage.getItem(${JSON.stringify(CHAVE_DO_TEMA)});h.classList.toggle("dark",t==="escuro"||(t!=="claro"&&matchMedia(${JSON.stringify(ESCURO)}).matches));h.toggleAttribute("data-barra-recolhida",localStorage.getItem(${JSON.stringify(CHAVE_DA_BARRA)})==="recolhida")}catch(_){}`

function ScriptsAntesDoDesenho() {
  return <script dangerouslySetInnerHTML={{ __html: CODIGO_ANTES_DO_DESENHO }} />
}

export { CHAVE_DA_BARRA, CHAVE_DO_TEMA, CODIGO_ANTES_DO_DESENHO, ESCURO, ScriptsAntesDoDesenho }
