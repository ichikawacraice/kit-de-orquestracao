/**
 * **As opções dos plugins do kit e o liga/desliga deles, lidos do disco.**
 *
 * O gate não é hook de plugin: não recebe `CLAUDE_PLUGIN_OPTION_*`. O valor que o app grava para a opção de um plugin
 * está em `pluginConfigs["<plugin>@ichikawa-kit"].options` do `~/.claude/settings.json` (só o escopo de usuário
 * vale; o projeto não injeta opção). Arquivo ausente ou ilegível = nenhuma opção = o padrão de quem lê (ligado).
 * Precedência (A7): `kit.json` do projeto com a chave > opção do plugin > padrão; plugin desligado em `enabledPlugins` não roda.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const MARKETPLACE_DO_KIT = "ichikawa-kit";
/** O nome do marketplace até o F344: quem não migrou guarda opção e liga/desliga sob ele, e ele vale enquanto o novo não diz nada. */
export const MARKETPLACE_ANTIGO_DO_KIT = "kit-de-orquestracao";

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

/** A pasta de configuração da conta: `CLAUDE_CONFIG_DIR` quando o env o diz, senão `<home>/.claude`. */
export const pastaDeConfig = (home = homedir(), env = process.env) => (env?.CLAUDE_CONFIG_DIR ? env.CLAUDE_CONFIG_DIR : join(home, ".claude"));

/**
 * Os nomes que um plugin do kit já teve (F332: o `design` virou `kit-design`, porque o `design` da Anthropic o ofuscava). A conta
 * e o projeto que ainda não migraram guardam opção e liga/desliga sob o nome velho: ele vale enquanto o novo não diz nada.
 */
export const NOMES_ANTIGOS = Object.freeze({ "kit-design": Object.freeze(["design"]) });
const idsDe = (plugin) => [MARKETPLACE_DO_KIT, MARKETPLACE_ANTIGO_DO_KIT].flatMap((m) => [plugin, ...(NOMES_ANTIGOS[plugin] ?? [])].map((n) => `${n}@${m}`));

/** As opções gravadas para o plugin do kit (`{}` sem nada gravado); as do nome velho valem quando o novo não tem nenhuma. */
export function opcoesDoPlugin(plugin, home = homedir(), env = process.env) {
  const configs = lerSettings(join(pastaDeConfig(home, env), "settings.json"))?.pluginConfigs;
  for (const id of idsDe(plugin)) {
    const opcoes = configs?.[id]?.options;
    if (objeto(opcoes) && Object.keys(opcoes).length) return opcoes;
  }
  return {};
}

/** Booleano da opção: `false`/"false" desliga; ausente ou outra coisa fica no padrão. */
export function booleanoDaOpcao(valor, padrao = true) {
  if (valor === false || /^(false|0|no|off)$/i.test(String(valor ?? ""))) return false;
  if (valor === true || /^(true|1|yes|on)$/i.test(String(valor ?? ""))) return true;
  return padrao;
}

/**
 * O que `enabledPlugins` diz do plugin (ou do nome velho dele): `true`, `false` ou `undefined` (ninguém diz). Vale a camada mais próxima:
 * `.claude/settings.local.json` > `.claude/settings.json` do projeto > `settings.json` da pasta de configuração da conta (`~/.claude`, ou `CLAUDE_CONFIG_DIR`).
 */
export function pluginLigado(plugin, raiz, home = homedir(), env = process.env) {
  for (const caminho of [join(raiz, ".claude", "settings.local.json"), join(raiz, ".claude", "settings.json"), join(pastaDeConfig(home, env), "settings.json")]) {
    const ligados = lerSettings(caminho)?.enabledPlugins;
    // na mesma camada, o nome novo vence o velho
    for (const id of idsDe(plugin)) if (typeof ligados?.[id] === "boolean") return ligados[id];
  }
  return undefined;
}
