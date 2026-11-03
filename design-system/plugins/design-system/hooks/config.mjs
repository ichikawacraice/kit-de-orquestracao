/**
 * **A configuração do plugin `design-system` num projeto, lida do disco.**
 *
 * O contrato é um arquivo só: `design/design-system.json` na raiz do projeto (o mesmo que carrega a versão do sistema, a
 * densidade e as peças instaladas). O nome antigo, `design/wicomm.json`, vale para sempre no projeto que já o tem: o
 * script das guardas do projeto o passa por `--config`, e renomeá-lo quebraria o CI dele. Projeto que já configurava o motor no `.claude/kit.json` (seção `design`, e
 * `guarda.tronco`) continua funcionando: essas chaves valem quando o `design/design-system.json` não as diz.
 *
 * Precedência de cada chave: `design/design-system.json` > `.claude/kit.json` > opção do plugin > padrão.
 *
 * O plugin não depende de marketplace nenhum: o liga/desliga e as opções valem para `design-system@<qualquer marketplace>`.
 * As opções gravadas pelos nomes antigos (`wicomm@*`, `kit-design@*`) valem enquanto o nome novo não tem as suas. O
 * liga/desliga do nome antigo não vale: depois da migração o `wicomm` fica desligado e o `design-system` ligado. Mas
 * enquanto o `wicomm` vai mesmo guardar ESTE projeto, este plugin cede a ele (`cedeAoAntigo`): os dois têm os mesmos
 * hooks, e rodar os dois daria a guarda em dobro.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const PLUGIN = "design-system";
/** Os nomes antigos do mesmo plugin: as opções gravadas para eles se herdam (ver o cabeçalho). */
export const NOMES_ANTIGOS = ["wicomm", "kit-design"];
/** O plugin de onde este saiu, com os mesmos hooks: enquanto ligado, este cede. */
export const PLUGIN_ANTIGO = "wicomm";
export const ARQUIVO_DO_PROJETO = join("design", "design-system.json");
export const ARQUIVO_ANTIGO = join("design", "wicomm.json");

/**
 * O arquivo de configuração deste projeto: o nome novo se existe; senão o antigo, se existe; senão o novo (para criar).
 * É nele que se grava. Os dois juntos: grava-se no novo, e `configDoProjeto` lê o antigo por baixo dele.
 */
export function arquivoDoProjeto(raiz) {
  if (existsSync(join(raiz, ARQUIVO_DO_PROJETO))) return join(raiz, ARQUIVO_DO_PROJETO);
  if (existsSync(join(raiz, ARQUIVO_ANTIGO))) return join(raiz, ARQUIVO_ANTIGO);
  return join(raiz, ARQUIVO_DO_PROJETO);
}

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

const doPlugin = (nome = PLUGIN) => (id) => typeof id === "string" && id.split("@")[0] === nome && id.includes("@");

/**
 * As opções gravadas para `design-system@*` em `pluginConfigs` do settings da conta (`{}` sem nada gravado). Sem
 * nenhuma, as do primeiro nome antigo que tiver (`wicomm@*`, depois `kit-design@*`): quem desligou a guarda no plugin
 * antigo não a vê ligar de novo ao migrar.
 */
export function opcoesDoPlugin(home = homedir(), env = process.env) {
  const configs = lerSettings(join(pastaDeConfig(home, env), "settings.json"))?.pluginConfigs;
  if (!objeto(configs)) return {};
  for (const nome of [PLUGIN, ...NOMES_ANTIGOS]) {
    const chave = Object.keys(configs).find(doPlugin(nome));
    const opcoes = chave ? configs[chave]?.options : null;
    if (objeto(opcoes) && Object.keys(opcoes).length > 0) return opcoes;
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
 * O que `enabledPlugins` diz de `design-system@*`: `true`, `false` ou `undefined` (ninguém diz). Vale a camada mais próxima:
 * `.claude/settings.local.json` > `.claude/settings.json` do projeto > `settings.json` da conta.
 */
export function pluginLigado(raiz, home = homedir(), env = process.env, nome = PLUGIN) {
  for (const caminho of [join(raiz, ".claude", "settings.local.json"), join(raiz, ".claude", "settings.json"), join(pastaDeConfig(home, env), "settings.json")]) {
    const ligados = lerSettings(caminho)?.enabledPlugins;
    if (!objeto(ligados)) continue;
    const chave = Object.keys(ligados).find(doPlugin(nome));
    if (chave && typeof ligados[chave] === "boolean") return ligados[chave];
  }
  return undefined;
}

/**
 * Se `<nome>@*` está instalado para este projeto, segundo o `plugins/installed_plugins.json` da conta: instalação de
 * escopo `user`, ou de escopo `project`/`local` com o `projectPath` desta raiz. Arquivo que falta ou não lê: `false`.
 */
export function pluginInstalado(raiz, home = homedir(), env = process.env, nome = PLUGIN) {
  const plugins = lerSettings(join(pastaDeConfig(home, env), "plugins", "installed_plugins.json"))?.plugins;
  if (!objeto(plugins)) return false;
  const alvo = resolve(raiz);
  return Object.keys(plugins)
    .filter(doPlugin(nome))
    .some((id) => (Array.isArray(plugins[id]) ? plugins[id] : []).some((i) => i?.scope === "user" || (typeof i?.projectPath === "string" && resolve(i.projectPath) === alvo)));
}

/**
 * Se a guarda do antigo (`wicomm`, congelado) roda neste projeto: a condição da `lerConfig` dele, copiada. Ele lê o
 * `design/wicomm.json` sobre a seção `design` do `.claude/kit.json` e as opções de `wicomm@*` (não as do nome novo);
 * guarda com a `guarda` ligada e com `visual` ou uma pasta do front. A cópia não deriva: o antigo não muda mais.
 */
export function antigoGuarda(raiz, home = homedir(), env = process.env) {
  const kit = lerJsonDoProjeto(join(raiz, ".claude", "kit.json"));
  const projeto = { ...(objeto(kit.design) ? kit.design : {}), ...lerJsonDoProjeto(join(raiz, ARQUIVO_ANTIGO)) };
  const configs = lerSettings(join(pastaDeConfig(home, env), "settings.json"))?.pluginConfigs;
  const chave = objeto(configs) ? Object.keys(configs).find(doPlugin(PLUGIN_ANTIGO)) : undefined;
  const opcoes = chave && objeto(configs[chave]?.options) ? configs[chave].options : {};
  const guarda = typeof projeto.guarda === "boolean" ? projeto.guarda : booleanoDaOpcao(opcoes.guarda);
  if (!guarda) return false;
  if (Array.isArray(projeto.visual) && projeto.visual.some((v) => typeof v === "string" && v.length > 0)) return true;
  return [projeto.pasta, opcoes.pasta_do_front].some((p) => typeof p === "string" && p.length > 0);
}

/**
 * Este plugin cede ao antigo (`wicomm@*`) só quando o antigo guarda mesmo ESTE projeto: ligado, instalado para ele e
 * com a guarda dele rodando (`antigoGuarda`). Ligado só na conta sem instalação, declarado mas não instalado, ou num
 * projeto que ele não guarda (só o `design/design-system.json`, que ele não lê), o antigo fica inerte, e ceder
 * deixaria o projeto sem guarda nenhuma; não ceder quando ele guarda daria a guarda em dobro.
 */
export const cedeAoAntigo = (raiz, home = homedir(), env = process.env) =>
  pluginLigado(raiz, home, env, PLUGIN_ANTIGO) === true && pluginInstalado(raiz, home, env, PLUGIN_ANTIGO) && antigoGuarda(raiz, home, env);

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
 * `densidade`, `pecas`, `registro`). Com os dois nomes do arquivo, o antigo vale por baixo do novo, chave a chave: o
 * `design/design-system.json` criado ao lado de um `design/wicomm.json` não apaga o que o antigo diz. Arquivo ilegível
 * é erro.
 */
export function configDoProjeto(raiz) {
  const antigo = lerJsonDoProjeto(join(raiz, ARQUIVO_ANTIGO));
  const novo = lerJsonDoProjeto(join(raiz, ARQUIVO_DO_PROJETO));
  const kit = lerJsonDoProjeto(join(raiz, ".claude", "kit.json"));
  const doKit = objeto(kit.design) ? { ...kit.design } : {};
  if (typeof kit?.guarda?.tronco === "string" && kit.guarda.tronco) doKit.tronco = kit.guarda.tronco;
  return { ...doKit, ...antigo, ...novo, temArquivo: existsSync(arquivoDoProjeto(raiz)) };
}
