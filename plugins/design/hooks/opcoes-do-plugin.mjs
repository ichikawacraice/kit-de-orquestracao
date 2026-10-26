/**
 * **As opções dos plugins do kit e o liga/desliga deles, lidos do disco.**
 *
 * Cópia de `gate/opcoes-do-plugin.mjs`: o plugin não importa de fora da própria pasta. `test/opcoes-do-plugin.test.mjs` confere que as duas concordam.
 *
 * O gate não é hook de plugin: não recebe `CLAUDE_PLUGIN_OPTION_*`. O valor que o app grava para a opção de um plugin
 * está em `pluginConfigs["<plugin>@kit-de-orquestracao"].options` do `~/.claude/settings.json` (só o escopo de usuário
 * vale; o projeto não injeta opção). Arquivo ausente ou ilegível = nenhuma opção = o padrão de quem lê (ligado).
 * Precedência (A7): `kit.json` do projeto com a chave > opção do plugin > padrão; plugin desligado em `enabledPlugins` não roda.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const MARKETPLACE_DO_KIT = "kit-de-orquestracao";

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

/** As opções gravadas para o plugin do kit (`{}` sem nada gravado). */
export function opcoesDoPlugin(plugin, home = homedir()) {
  const opcoes = lerSettings(join(home, ".claude", "settings.json"))?.pluginConfigs?.[`${plugin}@${MARKETPLACE_DO_KIT}`]?.options;
  return objeto(opcoes) ? opcoes : {};
}

/** Booleano da opção: `false`/"false" desliga; ausente ou outra coisa fica no padrão. */
export function booleanoDaOpcao(valor, padrao = true) {
  if (valor === false || /^(false|0|no|off)$/i.test(String(valor ?? ""))) return false;
  if (valor === true || /^(true|1|yes|on)$/i.test(String(valor ?? ""))) return true;
  return padrao;
}

/**
 * O que `enabledPlugins` diz do plugin: `true`, `false` ou `undefined` (ninguém diz). Vale a camada mais próxima:
 * `.claude/settings.local.json` > `.claude/settings.json` do projeto > `~/.claude/settings.json`.
 */
export function pluginLigado(plugin, raiz, home = homedir()) {
  const id = `${plugin}@${MARKETPLACE_DO_KIT}`;
  for (const caminho of [join(raiz, ".claude", "settings.local.json"), join(raiz, ".claude", "settings.json"), join(home, ".claude", "settings.json")]) {
    const v = lerSettings(caminho)?.enabledPlugins?.[id];
    if (typeof v === "boolean") return v;
  }
  return undefined;
}
