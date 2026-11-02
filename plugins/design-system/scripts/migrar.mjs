#!/usr/bin/env node
/**
 * **Migra um projeto do plugin `wicomm` para o `design-system` + o tema** (F345).
 *
 *   node scripts/migrar.mjs <raiz>            — mostra o que muda, sem gravar
 *   node scripts/migrar.mjs <raiz> --aplicar  — grava
 *
 * O que muda, e só isto:
 * - `.claude/settings.json` do projeto: `wicomm@*` fica `false` (sem a chave, entra `wicomm@wicomm: false`, para o que a
 *   conta diz não valer aqui); `design-system@<marketplace>` e
 *   `tema-<tema>@<marketplace>` ficam `true`; o marketplace entra em `extraKnownMarketplaces`. Os dois plugins nunca
 *   ficam ligados juntos (o `design-system` cede ao `wicomm` enquanto ele está ligado, mas o projeto não depende disso).
 * - `.claude/kit.json`, quando existe e lista `design.designers`: acrescenta `design-system:designer`. O `wicomm:designer`
 *   fica: a trava do kit só libera o nome novo quando ele estiver na lista, e o antigo não atrapalha.
 *
 * O que NÃO muda: o `design/wicomm.json` (o plugin e as guardas leem os dois nomes, e o script das guardas do projeto o
 * passa por `--config`), as dependências npm, o `components.json`, o `.claude/settings.local.json` (é de cada pessoa).
 * Rodar de novo não muda nada.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** O marketplace onde o `design-system` e o tema moram, e o repositório dele. */
export const MARKETPLACE = { nome: "ichikawa-kit", repo: "ichikawacraice/kit-de-orquestracao" };

const objeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function lerJson(caminho) {
  if (!existsSync(caminho)) return null;
  try {
    return JSON.parse(readFileSync(caminho, "utf-8").replace(/^﻿/, ""));
  } catch (e) {
    throw new Error(`${caminho} ilegível: ${e.message}`);
  }
}

/**
 * O plano da migração: `{ arquivos: { caminho: conteúdo novo }, mudancas: [frase] }`. Não grava. `tema` é o id do tema
 * (o sufixo do plugin `tema-<id>`).
 */
export function planejar(raiz, { tema = "wicomm", marketplace = MARKETPLACE } = {}) {
  const arquivos = {};
  const mudancas = [];

  const caminhoSettings = join(raiz, ".claude", "settings.json");
  const settings = lerJson(caminhoSettings) ?? {};
  if (!objeto(settings)) throw new Error(`${caminhoSettings} não é um objeto`);
  const ligados = objeto(settings.enabledPlugins) ? { ...settings.enabledPlugins } : {};
  const antigos = Object.keys(ligados).filter((id) => id.split("@")[0] === "wicomm");
  // Sem a chave no projeto, valeria o que a conta diz: o `wicomm` ligado na conta guardaria este projeto no lugar do
  // `design-system`. Desligado aqui, quem guarda é sempre o nome novo.
  if (antigos.length === 0) antigos.push("wicomm@wicomm");
  for (const id of antigos) {
    if (ligados[id] !== false) {
      ligados[id] = false;
      mudancas.push(`desliga ${id} (o nome antigo deste plugin)`);
    }
  }
  for (const nome of ["design-system", `tema-${tema}`]) {
    const id = `${nome}@${marketplace.nome}`;
    const outro = Object.keys(ligados).find((k) => k.split("@")[0] === nome && k !== id);
    if (outro) throw new Error(`${nome} já está declarado por outro marketplace (${outro}): um plugin num marketplace só, senão os hooks rodam duas vezes`);
    if (ligados[id] !== true) {
      ligados[id] = true;
      mudancas.push(`liga ${id}`);
    }
  }
  const conhecidos = objeto(settings.extraKnownMarketplaces) ? { ...settings.extraKnownMarketplaces } : {};
  if (!conhecidos[marketplace.nome]) {
    conhecidos[marketplace.nome] = { source: { source: "github", repo: marketplace.repo } };
    mudancas.push(`declara o marketplace ${marketplace.nome} (${marketplace.repo})`);
  }
  const novoSettings = { ...settings, extraKnownMarketplaces: conhecidos, enabledPlugins: ligados };
  if (JSON.stringify(novoSettings) !== JSON.stringify(settings)) arquivos[caminhoSettings] = JSON.stringify(novoSettings, null, 2) + "\n";

  const caminhoKit = join(raiz, ".claude", "kit.json");
  const kit = lerJson(caminhoKit);
  if (objeto(kit) && objeto(kit.design) && Array.isArray(kit.design.designers) && !kit.design.designers.includes("design-system:designer")) {
    const novoKit = { ...kit, design: { ...kit.design, designers: [...kit.design.designers, "design-system:designer"] } };
    arquivos[caminhoKit] = JSON.stringify(novoKit, null, 2) + "\n";
    mudancas.push("acrescenta design-system:designer aos designers do .claude/kit.json");
  }

  return { arquivos, mudancas };
}

export function aplicar(plano) {
  for (const [caminho, conteudo] of Object.entries(plano.arquivos)) {
    mkdirSync(dirname(caminho), { recursive: true });
    writeFileSync(caminho, conteudo);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const [raiz = ".", ...resto] = process.argv.slice(2);
  try {
    const plano = planejar(resolve(raiz));
    if (plano.mudancas.length === 0) {
      console.log("Nada a migrar: o projeto já está no design-system.");
    } else {
      console.log((resto.includes("--aplicar") ? "Migrado:\n" : "A migração faria (rode com --aplicar para gravar):\n") + plano.mudancas.map((m) => `- ${m}`).join("\n"));
      if (resto.includes("--aplicar")) aplicar(plano);
    }
  } catch (e) {
    console.error(`falha na migração: ${e.message}`);
    process.exit(1);
  }
}
