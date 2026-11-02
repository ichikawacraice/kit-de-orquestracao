// As skills de fora no `kit doutor` (F333, ADR 0014): o que ter (dependência do catálogo) e o que desligar (plugin de fora
// com skill que o kit barra). Só lê: instalar e desligar é a pessoa quem decide, com o comando que a linha traz.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKETPLACE } from './pacote.mjs';

const CATALOGO = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'orquestracao', 'skills-de-fora.json');
const lerJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return null; } };

/**
 * Os plugins da máquina, por nome: os do CLI (`installed_plugins.json`) e os que a conta do app baixa (o manifesto `rpm`
 * mais recente em `local-agent-mode-sessions`, caminho não documentado do app). → Map nome → [{ origem: 'cli'|'app', id }].
 * Os do marketplace do kit ficam de fora: mesmo com nome parecido, plugin do kit nunca é de fora.
 */
export function pluginsPresentes(home) {
  const presentes = new Map();
  const por = (nome, entrada) => { if (!presentes.has(nome)) presentes.set(nome, []); presentes.get(nome).push(entrada); };
  for (const id of Object.keys(lerJson(join(home, '.claude', 'plugins', 'installed_plugins.json'))?.plugins ?? {})) {
    if (!id.endsWith(`@${MARKETPLACE}`)) por(id.split('@')[0], { origem: 'cli', id });
  }
  const sessoes = join(home, 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions');
  let maisRecente = null;
  try {
    for (const a of readdirSync(sessoes)) for (const b of readdirSync(join(sessoes, a))) {
      const m = join(sessoes, a, b, 'rpm', 'manifest.json');
      if (!existsSync(m)) continue;
      const quando = statSync(m).mtimeMs;
      if (!maisRecente || quando > maisRecente.quando) maisRecente = { m, quando };
    }
  } catch { /* sem o app, ou pasta que não é de sessão */ }
  if (maisRecente) {
    for (const p of lerJson(maisRecente.m)?.plugins ?? []) {
      const nome = lerJson(join(dirname(maisRecente.m), String(p.id), '.claude-plugin', 'plugin.json'))?.name;
      if (typeof nome === 'string') por(nome, { origem: 'app', id: nome });
    }
  }
  return presentes;
}

/**
 * A dependência `id` (nome@marketplace) vale para este projeto: instalada com esse id exato, em `user` ou no escopo de
 * projeto/local deste projeto, e não desligada em `enabledPlugins` (a camada mais próxima vence). → { ok, motivo }.
 */
function dependenciaValida(id, home, destino, configs) {
  const entradas = lerJson(join(home, '.claude', 'plugins', 'installed_plugins.json'))?.plugins?.[id];
  const aqui = (e) => e?.scope === 'user' || (destino && typeof e?.projectPath === 'string' && (destino === e.projectPath || destino.startsWith(`${e.projectPath}/`)));
  if (!Array.isArray(entradas) || !entradas.length) return { ok: false, motivo: 'não instalado' };
  if (!entradas.some(aqui)) return { ok: false, motivo: 'instalado só no escopo de outro projeto' };
  for (const c of [...configs].reverse()) {
    const v = c?.enabledPlugins?.[id];
    if (typeof v === 'boolean') return v ? { ok: true } : { ok: false, motivo: 'instalado mas desligado em enabledPlugins' };
  }
  return { ok: true };
}

/**
 * As linhas do doutor (`ok:`, `falha:`, `aviso:`, `info:`) e quantas falhas. `configs`: os settings da conta, do projeto
 * e o local, nessa ordem (o doutor já os lê); sem eles, lê de `home` e `destino`.
 */
export function conferirSkillsDeFora({ home, destino = '', configs, catalogo = lerJson(CATALOGO) }) {
  configs ??= [join(home, '.claude', 'settings.json'), ...(destino ? [join(destino, '.claude', 'settings.json'), join(destino, '.claude', 'settings.local.json')] : [])].map(lerJson);
  const linhas = [];
  let falhas = 0;
  if (!catalogo) return { linhas: ['aviso: não consegui ler o catálogo de skills de fora do kit (plugins/orquestracao/skills-de-fora.json)'], falhas: 0 };
  const presentes = pluginsPresentes(home);
  for (const p of (catalogo.plugins ?? []).filter((x) => x.saida === 'depender')) {
    const id = `${p.plugin}@${p.marketplace}`;
    const v = dependenciaValida(id, home, destino, configs);
    if (v.ok) { linhas.push(`ok: ${p.plugin} instalado (o kit usa: ${p.motivo})`); continue; }
    falhas++;
    // outro superpowers (outro marketplace, ou o da conta do app) não satisfaz a dependência do plugin
    const outro = (presentes.get(p.plugin) ?? []).filter((o) => o.id !== id).map((o) => (o.origem === 'app' ? 'o da conta do app' : o.id));
    const comoConsertar = v.motivo === 'instalado mas desligado em enabledPlugins' ? `Ligue: \`claude plugin enable ${id}\``
      : `Instale: \`claude plugin install ${id}\`${p.repositorioDoMarketplace ? ` (se o marketplace ${p.marketplace} faltar, antes: \`claude plugin marketplace add ${p.repositorioDoMarketplace}\`)` : ''}`;
    linhas.push(`falha: ${id} ${v.motivo}${outro.length ? ` (${outro.join(', ')} não conta: a dependência é este id)` : ''}; o kit usa: ${p.motivo} Sem ele o plugin orquestracao não carrega. ${comoConsertar}`);
  }
  const barradas = (catalogo.skills ?? []).filter((s) => s.saida === 'barrar' || (s.saida === 'absorver' && s.feito === true));
  const porPlugin = new Map();
  for (const s of barradas) {
    const plugin = s.skill.split(':')[0];
    if (!porPlugin.has(plugin)) porPlugin.set(plugin, []);
    porPlugin.get(plugin).push(s);
  }
  for (const [plugin, skills] of porPlugin) {
    const onde = presentes.get(plugin);
    if (!onde?.length) continue;
    const lista = skills.map((s) => `${s.skill} → ${s.use}`).join('; ');
    const dependencia = (catalogo.plugins ?? []).some((p) => p.plugin === plugin && p.saida === 'depender');
    const como = onde.map((o) => (o.origem === 'app' ? 'no app (lista de plugins da conta)' : `só para você neste projeto com \`claude plugin disable ${o.id} --scope local\``));
    // da dependência não há o que fazer (o plugin fica): só informa o que o kit barra nela
    if (dependencia) { linhas.push(`info: o kit barra neste projeto ${lista}, do plugin ${plugin} (dependência do kit: o plugin fica)`); continue; }
    linhas.push(`aviso: plugin ${plugin} instalado; o kit barra neste projeto ${lista} (as outras skills dele seguem livres); se não usa as outras, desligue-o ${como.join(' e ')}: cada sessão deixa de carregar as descrições`);
  }
  return { linhas, falhas };
}
