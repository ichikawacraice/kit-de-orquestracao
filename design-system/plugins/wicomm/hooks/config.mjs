/**
 * **A configuração do plugin `wicomm` num projeto, lida do disco.**
 *
 * O contrato é um arquivo só: `design/wicomm.json` na raiz do projeto (o mesmo que carrega a versão do sistema, a
 * densidade e as peças instaladas). Projeto que já configurava o motor no `.claude/kit.json` (seção `design`, e
 * `guarda.tronco`) continua funcionando: essas chaves valem quando o `design/wicomm.json` não as diz.
 *
 * Precedência de cada chave: `design/wicomm.json` > `.claude/kit.json` > opção do plugin > padrão.
 *
 * O plugin não depende de marketplace nenhum: o liga/desliga e as opções valem para `wicomm@<qualquer marketplace>`.
 * Outro plugin de design ligado ou desligado não muda nada aqui.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const PLUGIN = "wicomm";
export const ARQUIVO_DO_PROJETO = join("design", "wicomm.json");

const objeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** JSON de um arquivo de settings, ou `null` se falta ou não lê (nunca lança: erro de leitura é "sem opção"). */
export function lerSettings(caminho) {
  try {
    if (!existsSync(caminho)) return null;
    const lido = JSON.parse(readFileSync(caminho, "utf-8").replace(/^﻿/, ""));
    return objeto(lido) ? lido : null;
  } catch {
    return null;
  }
}

/** JSON de um arquivo do projeto: `{}` quando falta; ilegível é erro (config quebrada não fica calada). */
export function lerJsonDoProjeto(caminho) {
  if (!existsSync(caminho)) return {};
  let lido;
  try {
    lido = JSON.parse(readFileSync(caminho, "utf-8").replace(/^﻿/, ""));
  } catch (e) {
    throw new Error(`${caminho} ilegível: ${e.message}`);
  }
  return objeto(lido) ? lido : {};
}

/** A pasta de configuração da conta: `CLAUDE_CONFIG_DIR` quando o env o diz, senão `<home>/.claude`. */
export const pastaDeConfig = (home = homedir(), env = process.env) => (env?.CLAUDE_CONFIG_DIR ? env.CLAUDE_CONFIG_DIR : join(home, ".claude"));

const doPlugin = (id) => typeof id === "string" && id.split("@")[0] === PLUGIN && id.includes("@");

/** As opções gravadas para `wicomm@*` em `pluginConfigs` do settings da conta (`{}` sem nada gravado). */
export function opcoesDoPlugin(home = homedir(), env = process.env) {
  const configs = lerSettings(join(pastaDeConfig(home, env), "settings.json"))?.pluginConfigs;
  if (!objeto(configs)) return {};
  const chave = Object.keys(configs).find(doPlugin);
  const opcoes = chave ? configs[chave]?.options : null;
  return objeto(opcoes) ? opcoes : {};
}

/** Booleano da opção: `false`/"false" desliga; ausente ou outra coisa fica no padrão. */
export function booleanoDaOpcao(valor, padrao = true) {
  if (valor === false || /^(false|0|no|off)$/i.test(String(valor ?? ""))) return false;
  if (valor === true || /^(true|1|yes|on)$/i.test(String(valor ?? ""))) return true;
  return padrao;
}

/**
 * O que `enabledPlugins` diz de `wicomm@*`: `true`, `false` ou `undefined` (ninguém diz). Vale a camada mais próxima:
 * `.claude/settings.local.json` > `.claude/settings.json` do projeto > `settings.json` da conta.
 */
export function pluginLigado(raiz, home = homedir(), env = process.env) {
  for (const caminho of [join(raiz, ".claude", "settings.local.json"), join(raiz, ".claude", "settings.json"), join(pastaDeConfig(home, env), "settings.json")]) {
    const ligados = lerSettings(caminho)?.enabledPlugins;
    if (!objeto(ligados)) continue;
    const chave = Object.keys(ligados).find(doPlugin);
    if (chave && typeof ligados[chave] === "boolean") return ligados[chave];
  }
  return undefined;
}

/**
 * O valor de uma opção do plugin: a variável `CLAUDE_PLUGIN_OPTION_<CHAVE>` que o app exporta para o hook; sem ela, o
 * que o app gravou em `pluginConfigs`; sem nenhum dos dois, `undefined` (vale o padrão de quem lê).
 */
export function opcao(chave, { home = homedir(), env = process.env } = {}) {
  const doEnv = env[`CLAUDE_PLUGIN_OPTION_${chave.toUpperCase()}`];
  if (doEnv !== undefined && doEnv !== "") return doEnv;
  return opcoesDoPlugin(home, env)[chave];
}

/**
 * A configuração do projeto, já com a precedência aplicada: as chaves do motor (`pasta`, `fontes`, `kit`, `revisoes`,
 * `visual`, `negadoAoDesigner`, `largura`, `guarda`, `cobrarCritica`, `tronco`) e as do sistema (`versao`,
 * `densidade`, `pecas`, `registro`). Arquivo ilegível é erro.
 */
export function configDoProjeto(raiz) {
  const wicomm = lerJsonDoProjeto(join(raiz, ARQUIVO_DO_PROJETO));
  const kit = lerJsonDoProjeto(join(raiz, ".claude", "kit.json"));
  const doKit = objeto(kit.design) ? { ...kit.design } : {};
  if (typeof kit?.guarda?.tronco === "string" && kit.guarda.tronco) doKit.tronco = kit.guarda.tronco;
  return { ...doKit, ...wicomm, temArquivo: existsSync(join(raiz, ARQUIVO_DO_PROJETO)) };
}
